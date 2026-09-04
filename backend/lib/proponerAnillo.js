/**
 * Capa 3 del diseño de sinonimia: proponer anillos nuevos para el tesauro.
 *
 * Qué hace y qué NO hace, porque la diferencia es todo:
 *
 *   HACE: dado un término jurídico que no está en ningún anillo, propone
 *   cómo se escribe ESE MISMO concepto de otras formas, para que una
 *   abogada lo apruebe y se sume al tesauro.
 *
 *   NO HACE: no inventa fallos, no dice qué resolvió ningún tribunal, no
 *   busca nada. Su única salida posible son términos de búsqueda. Si se
 *   equivoca, el resultado es una propuesta mala que se rechaza — nunca
 *   una cita falsa.
 *
 * Por qué un modelo que razona y no embeddings: la distinción que sostiene
 * todo el tesauro es equivalente (mismo rubro, otro nombre) contra
 * relacionado (vecino que NO es lo mismo). Un modelo de embeddings pone
 * "daño moral" y "daño psicológico" a la misma distancia, porque aparecen
 * en los mismos textos; es exactamente el error que no podemos cometer.
 * Un modelo que razona sí puede separarlos, y además puede explicar por
 * qué — que es lo que hace revisable la propuesta.
 *
 * Nada de esto corre en una búsqueda normal: se dispara sólo cuando
 * alguien pide expresamente una propuesta para un término desconocido.
 * Sin ANTHROPIC_API_KEY configurada, el módulo avisa y no rompe nada: la
 * búsqueda y el tesauro siguen funcionando igual.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '../config.js';
import { errores } from './errores.js';

/** ¿Se puede pedir una propuesta ahora mismo? */
export function hayModelo() {
  return Boolean(ANTHROPIC_API_KEY);
}

const SISTEMA = `Sos un asistente terminológico para un buscador de jurisprudencia argentina.

Tu ÚNICA tarea: dado un término técnico del derecho argentino, decir de qué
otras formas se escribe ESE MISMO concepto en los fallos y en la doctrina.

REGLAS ABSOLUTAS
1. NO inventás fallos, carátulas, expedientes ni citas. No conocés el
   contenido de ninguna base de datos y no te pronunciás sobre qué resolvió
   ningún tribunal.
2. Tu salida son términos de búsqueda y nada más.
3. Si no conocés el término o no estás seguro, devolvés listas vacías y
   confianza baja. Una propuesta floja se descarta sin costo; una propuesta
   inventada contamina el tesauro de un estudio jurídico.

LA DISTINCIÓN QUE IMPORTA
- "equivalentes": el MISMO rubro con otro nombre. Un fallo que use
  cualquiera de estas formas se cita igual que si usara el término
  consultado. Ejemplo: "daño moral" y "consecuencias no patrimoniales" son
  el mismo rubro — el Código Civil y Comercial lo rebautizó en 2015.
- "relacionados": figuras VECINAS que NO son lo mismo. Cambian los
  presupuestos, la prueba o la legitimación. Ejemplo: "daño psicológico"
  está en el mismo artículo que el daño moral y NO es lo mismo.

Ante la duda, poné el término en "relacionados". Es el error barato.

CONTEXTO ARGENTINO QUE SUELE IMPORTAR
- El CCyC de 2015 renombró varias figuras (tenencia → cuidado personal,
  régimen de visitas → régimen de comunicación). Cuando pase, decilo en
  "nota" y poné el año en "desde".
- La doctrina y la carátula del tribunal suelen usar palabras distintas
  para lo mismo (doctrina: "usucapión"; carátula: "prescripción
  adquisitiva").
- A veces la ley usa un nombre y los fallos otro (la ley 24.240 dice
  "multa civil"; los fallos dicen "daño punitivo").`;

/** El JSON que se le pide, y el único que se acepta de vuelta. */
const FORMA = `Respondé SOLO con un objeto JSON válido, sin texto alrededor, con esta forma:
{
  "canonico": string,          // la forma más usada en los tribunales
  "equivalentes": string[],    // mismo rubro, otro nombre (puede ser [])
  "relacionados": string[],    // vecinos que NO son lo mismo (puede ser [])
  "rama": string|null,         // una de: {{RAMAS}}
  "desde": number|null,        // año de la reforma que renombró la figura
  "nota": string|null,         // por qué conviven las formas, en una frase
  "confianza": number          // 0 a 1
}`;

/** Saca el objeto JSON de la respuesta, tolerando que venga envuelto.
 *  Exportada para poder probarla sin red ni clave. */
export function leerJSON(texto) {
  const t = String(texto || '').trim();
  const desde = t.indexOf('{');
  const hasta = t.lastIndexOf('}');
  if (desde === -1 || hasta <= desde) return null;
  try {
    return JSON.parse(t.slice(desde, hasta + 1));
  } catch {
    return null;
  }
}

/**
 * Deja la propuesta en la forma exacta que espera el tesauro, y descarta
 * lo que el modelo haya agregado de más. Se normaliza acá y no del lado
 * de quien llama para que ninguna respuesta rara llegue a la pantalla.
 *
 * Exportada para poder probarla sin red ni clave.
 */
export function normalizar(crudo, termino, ramasValidas) {
  const lista = (x) => (Array.isArray(x) ? x : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .filter((s) => s.toLowerCase() !== termino.toLowerCase())
    .slice(0, 8);

  const equivalentes = lista(crudo?.equivalentes);
  // Un término no puede estar en los dos lados: si el modelo lo repitió,
  // manda el lado prudente.
  const enEq = new Set(equivalentes.map((s) => s.toLowerCase()));
  const relacionados = lista(crudo?.relacionados).filter((s) => !enEq.has(s.toLowerCase()));

  const rama = typeof crudo?.rama === 'string' && ramasValidas.includes(crudo.rama)
    ? crudo.rama
    : null;

  let confianza = Number(crudo?.confianza);
  if (!Number.isFinite(confianza)) confianza = 0;
  confianza = Math.min(1, Math.max(0, confianza));

  return {
    termino,
    canonico: String(crudo?.canonico || termino).trim(),
    equivalentes,
    relacionados,
    rama,
    desde: Number.isInteger(crudo?.desde) ? crudo.desde : null,
    nota: typeof crudo?.nota === 'string' && crudo.nota.trim() ? crudo.nota.trim() : null,
    confianza,
  };
}

/**
 * Pide una propuesta de anillo para un término.
 *
 * @param {string} termino  El término jurídico a expandir.
 * @param {object} opciones
 * @param {string[]} opciones.ramas       Ids de rama válidos, para que no invente uno.
 * @param {string[]} opciones.yaEnTesauro Términos que ya tienen anillo: se le
 *   pasan para que no proponga algo que ya está cubierto en otro lado.
 * @param {object} [opciones.cliente] Cliente ya construido. Existe para las
 *   pruebas: permite ejercitar todo el camino —incluida una negativa y una
 *   respuesta ilegible— sin clave, sin red y sin gastar un centavo.
 * @returns {Promise<object>} la propuesta ya normalizada.
 */
export async function proponerAnillo(termino, { ramas = [], yaEnTesauro = [], cliente: dado = null } = {}) {
  const t = String(termino || '').trim();
  if (!t) throw errores.consultaVacia();
  if (!dado && !hayModelo()) throw errores.modeloNoConfigurado();

  const cliente = dado || new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const cubiertos = yaEnTesauro.slice(0, 200).join(' · ');
  const pedido =
    `Término consultado: "${t}"\n\n` +
    (cubiertos ? `Ya cubiertos por otros anillos (no los repitas como canónico): ${cubiertos}\n\n` : '') +
    FORMA.replace('{{RAMAS}}', ramas.join(', ') || 'ninguna');

  let respuesta;
  try {
    respuesta = await cliente.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1200,
      system: SISTEMA,
      messages: [{ role: 'user', content: pedido }],
    });
  } catch (e) {
    // Sin esto, una clave mal copiada o una cuenta sin credito llegaban a la
    // pantalla como "se rompio algo del lado del servidor", que no le dice a
    // nadie que es lo que hay que arreglar.
    if (e?.status === 401 || e?.status === 403) throw errores.modeloClaveInvalida();
    if (e?.status === 429) throw errores.modeloFalla('hay demasiadas consultas en curso, probá en un momento');
    if (e?.status === 400 && /credit|balance|saldo/i.test(e?.message || '')) throw errores.modeloClaveInvalida();
    if (e?.status) throw errores.modeloFalla('el servicio respondió ' + e.status);
    throw errores.modeloFalla('no se pudo llegar al servicio');
  }

  // Una negativa por seguridad llega con HTTP 200: hay que mirarla antes
  // de leer el contenido, o se lee un texto vacío como si fuera respuesta.
  if (respuesta.stop_reason === 'refusal') throw errores.modeloSeNego();

  const texto = (respuesta.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const crudo = leerJSON(texto);
  if (!crudo) throw errores.modeloRespuestaIlegible();

  return normalizar(crudo, t, ramas);
}
