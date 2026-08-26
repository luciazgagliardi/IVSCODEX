/**
 * Verificador de citas: ¿esto que me pegaron corresponde a un fallo real?
 *
 * El problema que resuelve es el de las citas alucinadas. Un modelo de
 * lenguaje produce citas con la forma exacta de una cita verdadera —tribunal
 * que existe, carátula creíble, tomo y página que caen en el rango correcto—
 * y no hay forma de distinguirlas leyéndolas. La única forma es ir a la
 * fuente. Eso es lo que hace este módulo: parsea la cita (lib/citas.js),
 * elige a qué buscador oficial preguntarle (lib/fuentes.js), busca con la
 * infraestructura que ya existe y puntúa lo que vuelve contra lo que decía
 * la cita.
 *
 * La regla que ordena todo el archivo: NUNCA se afirma que una cita es
 * falsa. Este proyecto puede consultar cuatro buscadores; la jurisprudencia
 * argentina está publicada en decenas de sistemas, muchos sin buscador
 * abierto, y ninguno de los cuatro tiene todo lo suyo indexado. "No lo
 * encontré" significa exactamente eso y nada más, igual que el avisoFalla de
 * routes/indice.js dice que los resultados son locales en vez de hacerlos
 * pasar por frescos. Del otro lado vale lo mismo: una coincidencia se llama
 * "verificada" solo cuando hay un identificador exacto o la carátula entera,
 * no porque un par de palabras se parezcan.
 */

import { parsearCita, normalizarExpediente, TRIBUNALES } from './citas.js';
import { fuentePorSlug, nombreDeFuente } from './fuentes.js';
import { plegar, VACIAS } from './relevancia.js';

/**
 * Cuántos buscadores oficiales se consultan como mucho en un mismo pedido.
 *
 * Dos, y no los cuatro, porque cada consulta es un pedido real a un servidor
 * de un organismo, con su espera de cortesía en el medio (ESPERA_POR_HOST_MS,
 * ver lib/descargador.js): barrer las cuatro fuentes por cada cita pegada
 * multiplicaría por cuatro el tráfico que le mandamos a sitios que nos dejan
 * entrar de onda, y encima haría esperar medio minuto a quien pregunta.
 */
const MAX_FUENTES = 2;

/** Cuántos resultados se piden por fuente y cuántos candidatos se devuelven. */
const POR_FUENTE = 20;
const MAX_CANDIDATOS = 5;

/**
 * Puntaje de cada tipo de coincidencia.
 *
 * Los dos primeros son identificadores: o coinciden exacto o no coinciden,
 * no hay parecido posible. Por eso valen solos lo que el resto junto — un
 * expediente igual es la misma causa, y punto. Los nombres de las partes, en
 * cambio, se escriben de mil maneras ("Pérez, Juan C." / "PEREZ JUAN CARLOS")
 * y hay apellidos repetidos hasta el hartazgo: valen, pero no solos.
 */
const PESOS = {
  expediente: 60,
  fallos: 55,
  parte: 18,
  materia: 6,
  fecha: 12,
  anio: 4,
  palabraClave: 3,
  topePalabrasClave: 12,
};

/** La cautela que acompaña a todo veredicto negativo. No se relaja. */
const CAUTELA =
  'No encontrarla acá no prueba que no exista: este verificador solo puede consultar los buscadores oficiales que el proyecto tiene integrados, y ninguno de ellos publica el total de lo que dictó su tribunal. Puede no estar indexada, estar cargada con otra carátula, o no ser real. Confirmalo en la fuente antes de citarla.';

/**
 * Las fuentes que este verificador puede llegar a consultar.
 *
 * NO son todas las de lib/fuentes.js, y la diferencia importa: el Buscador
 * general ofrece además Dialnet (doctrina, no sentencias) y Mendoza Legal
 * (una selección de fallos comentados por una revista). Ninguna de las dos
 * puede confirmar ni desmentir que un expediente exista, así que
 * fuentesAConsultar() no las elige nunca.
 *
 * Se calcula en vez de escribirse a mano para que no se despegue de las dos
 * listas de las que depende de verdad: los tribunales que sabe reconocer
 * lib/citas.js con su fuente, y las dos fuentes con las que se tira la red
 * ancha cuando el tribunal no se reconoce. Antes esto recorría el catálogo
 * entero y la pantalla del verificador prometía haber mirado Dialnet, que no
 * se consulta nunca — justo el tipo de exageración que este archivo existe
 * para no cometer.
 */
const RED_ANCHA = [
  { slug: 'saij', tribunal: 'fallos' },
  { slug: 'csjn', tribunal: null },
];
const FUENTES_DEL_VERIFICADOR = [
  ...new Set([
    ...TRIBUNALES.map((t) => t.fuente).filter(Boolean),
    ...RED_ANCHA.map((f) => f.slug),
  ]),
];

/** Qué se pudo mirar, dicho en una línea, para que el alcance quede a la vista. */
export function alcanceDeVerificacion() {
  return FUENTES_DEL_VERIFICADOR.map(nombreDeFuente).join(' · ');
}

/**
 * A qué fuente(s) preguntarle según el tribunal que se reconoció.
 *
 * Tres casos y una decisión en cada uno:
 *
 *   - Tribunal reconocido y con buscador en el catálogo: se le pregunta a
 *     ese y a nadie más. Buscar la misma cita en las otras tres solo agrega
 *     ruido: un homónimo en otra provincia no confirma nada.
 *   - Tribunal reconocido pero SIN buscador (los internacionales): lista
 *     vacía. Es el caso que termina en "no_verificable", que es la respuesta
 *     honesta — no se buscó, así que no hay nada que informar.
 *   - Tribunal no reconocido: se tira una red ancha pero corta, SAIJ (casi
 *     un millón de documentos de todo el país, la única base con alcance
 *     nacional que tenemos) más la faceta de la Corte Suprema. Si la cita
 *     trae tomo y página de "Fallos", en cambio, el tribunal está dicho
 *     aunque no se lo nombre: esa colección es de la Corte y de nadie más.
 */
function fuentesAConsultar(campos) {
  const t = campos.tribunal;
  if (t && t.fuente) return [{ slug: t.fuente, tribunal: t.tribunalEnFuente }];
  if (t && !t.fuente) return [];
  if (campos.fallos) return [{ slug: 'csjn', tribunal: null }];
  return RED_ANCHA.slice(0, MAX_FUENTES);
}

/**
 * Las palabras con las que se le va a preguntar al buscador.
 *
 * Se arman con los acentos originales, no con el texto plegado: el sitio del
 * TSJ CABA habla windows-1252 y devuelve CERO resultados en silencio si la
 * palabra no le llega con su acento (ver lib/indiceCaba.js). Buscar "danos"
 * ahí no da un error: da una cita "no encontrada" que en realidad estaba.
 */
function palabrasParaBuscar(texto, tope) {
  const salida = [];
  for (const bruta of String(texto || '').split(/[^\p{L}\p{N}]+/u)) {
    if (bruta.length < 3) continue;
    const plegada = plegar(bruta);
    if (VACIAS.has(plegada) || salida.some((p) => plegar(p) === plegada)) continue;
    salida.push(bruta);
    if (salida.length >= tope) break;
  }
  return salida;
}

/**
 * La consulta de texto libre que se le manda al buscador.
 *
 * Prioridad: los nombres de las partes, después el expediente, y recién al
 * final las palabras sueltas. Suena al revés —el expediente es el dato más
 * fuerte— pero los tres buscadores son de TEXTO LIBRE sobre carátula,
 * sumario y voces: los nombres están siempre en ese texto, y el número de
 * expediente aparece con otro formato, con ceros de más o directamente en un
 * campo que la búsqueda libre no mira. El expediente sirve para CONFIRMAR un
 * resultado (ahí vale 60 puntos), no para encontrarlo.
 */
function armarConsulta(campos) {
  if (campos.caratula) {
    const partes = [campos.caratula.actor, campos.caratula.demandado].filter(Boolean).join(' ');
    const palabras = palabrasParaBuscar(partes, 4);
    if (palabras.length) return { q: palabras.join(' '), de: 'carátula' };
  }
  if (campos.expediente) return { q: campos.expediente, de: 'expediente' };
  if (campos.fallos) {
    // Sin carátula ni expediente, lo único que queda es preguntar por el
    // número de la colección tal como se escribe. Es un tiro largo: ningún
    // buscador de los cuatro indexa "Fallos" por tomo y página (ver la nota
    // de LIMITACIONES abajo), así que esto encuentra algo solo si el texto
    // del propio documento se cita a sí mismo así.
    return { q: `Fallos ${campos.fallos.tomo}:${campos.fallos.pagina}`, de: 'tomo y página' };
  }
  const claves = palabrasParaBuscar(campos.texto, 4);
  if (claves.length) return { q: claves.join(' '), de: 'palabras clave' };
  return null;
}

/** Todo el texto buscable de un resultado, plegado una sola vez. */
function pajarDe(registro) {
  return plegar(
    [registro.caratula, registro.sumario, (registro.voces || []).join(' '),
     registro.expediente, registro.tribunal, registro.magistrados, registro.fecha]
      .filter(Boolean)
      .join(' ')
  );
}

/** Los apellidos de una parte, sin conectores ni siglas societarias cortas. */
function tokensDe(texto) {
  return plegar(texto)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 4 && !VACIAS.has(p));
}

/**
 * ¿Aparece este número de expediente en el resultado?
 *
 * Se compara por los grupos de dígitos y no por la cadena entera porque cada
 * sistema los escribe distinto: "13-04785621-9", "13/04785621/9" y
 * "CUIJ 13-04785621-9" son el mismo expediente. Los separadores se toleran,
 * los dígitos no: si un solo grupo cambia, es otra causa.
 */
function coincideExpediente(citado, registro, pajar) {
  const grupos = citado.match(/\d+/g) || [];
  if (!grupos.length) return false;

  const delRegistro = normalizarExpediente(registro.expediente || '');
  const delCitado = normalizarExpediente(citado);
  if (delRegistro && delCitado) {
    if (delRegistro === delCitado) return true;
    // Uno de los dos puede traer el código de fuero adelante ("CIV
    // 12345/2020" contra "12345/2020"): si el más corto tiene entropía
    // suficiente, que esté contenido en el otro alcanza.
    const corto = delRegistro.length < delCitado.length ? delRegistro : delCitado;
    const largo = corto === delRegistro ? delCitado : delRegistro;
    if (corto.length >= 8 && largo.includes(corto)) return true;
  }

  const flexible = new RegExp(grupos.join('[^0-9a-z]{0,3}'));
  return flexible.test(pajar);
}

/** ¿Aparece "340:1084" (o "tomo 340 … página 1084") en el resultado? */
function coincideFallos(fallos, pajar) {
  const { tomo, pagina } = fallos;
  if (new RegExp(`\\b${tomo}\\s*[:\\-.,]\\s*${pagina}\\b`).test(pajar)) return true;
  return new RegExp(`\\btomo\\s*${tomo}\\b[^0-9]{1,20}\\b${pagina}\\b`).test(pajar);
}

/**
 * Cuánto se parece un resultado a la cita, y por qué.
 *
 * Devuelve el puntaje, una "fuerza" (fuerte / media / débil) y las razones
 * en castellano, que son lo que después se muestra en pantalla: un número
 * suelto no le sirve a nadie para decidir, "coincide el expediente exacto"
 * sí.
 */
export function puntuarCandidato(registro, campos) {
  const pajar = pajarDe(registro);
  const porQue = [];
  let puntaje = 0;
  let exacto = false;      // coincidió un identificador: expediente o Fallos
  let partes = 0;          // cuántas de las dos partes de la carátula aparecen
  let actorCoincide = false; // específicamente el actor, no cualquiera de las dos
  let fechaIgual = false;
  let materiaCoincide = false;

  if (campos.expediente && coincideExpediente(campos.expediente, registro, pajar)) {
    puntaje += PESOS.expediente;
    exacto = true;
    porQue.push(`coincide el número de expediente (${campos.expediente})`);
  }

  if (campos.fallos && coincideFallos(campos.fallos, pajar)) {
    puntaje += PESOS.fallos;
    exacto = true;
    porQue.push(`coincide la cita de la colección Fallos (${campos.fallos.tomo}:${campos.fallos.pagina})`);
  }

  if (campos.caratula) {
    const caratulaPlegada = plegar(registro.caratula || '');
    for (const [rol, valor] of [['actor', campos.caratula.actor], ['demandado', campos.caratula.demandado]]) {
      if (!valor) continue;
      const tokens = tokensDe(valor);
      if (!tokens.length) continue;
      const encontrados = tokens.filter((t) => caratulaPlegada.includes(t) || pajar.includes(t));
      // Un nombre de varias palabras no corrobora nada con que aparezca
      // CUALQUIERA de ellas: "Fernández" solo está en miles de causas contra
      // el Estado, y "GCBA" es el demandado de buena parte de las causas de
      // CABA, así que una cita inventada con un apellido común terminaba
      // "verificada" contra un homónimo real. Hace falta que coincida MÁS DE
      // LA MITAD de las palabras del nombre —mayoría estricta, no la mitad
      // redondeada para arriba: con dos palabras (el caso más común, nombre
      // y apellido) la mitad redondeada para arriba sigue siendo una sola, y
      // ese es justo el agujero que dejaba pasar "Fernandez, Roberto" contra
      // cualquier Fernández real. Con dos palabras hacen falta las dos. Con
      // una sola palabra disponible (un apellido solo, una sigla corta) esa
      // única palabra sigue alcanzando, porque no hay con qué pedir más.
      const necesarios = Math.floor(tokens.length / 2) + 1;
      if (encontrados.length < necesarios) continue;
      partes++;
      if (rol === 'actor') actorCoincide = true;
      puntaje += PESOS.parte;
      porQue.push(`aparece el ${rol} de la carátula (${encontrados.join(', ')})`);
    }
    const tokensMateria = tokensDe(campos.caratula.materia || '');
    if (tokensMateria.length) {
      const encontradosMateria = tokensMateria.filter((t) => pajar.includes(t));
      if (encontradosMateria.length >= Math.floor(tokensMateria.length / 2) + 1) {
        puntaje += PESOS.materia;
        materiaCoincide = true;
        porQue.push('coincide la materia de la carátula');
      }
    }
  }

  if (campos.fecha) {
    const fechaRegistro = plegar(registro.fecha || '');
    const dd = String(campos.fecha.dia).padStart(2, '0');
    const mm = String(campos.fecha.mes).padStart(2, '0');
    if (new RegExp(`\\b0?${campos.fecha.dia}[/\\-.]0?${campos.fecha.mes}[/\\-.]${campos.fecha.anio}\\b`).test(fechaRegistro)
      || fechaRegistro.includes(`${campos.fecha.anio}-${mm}-${dd}`)) {
      puntaje += PESOS.fecha;
      fechaIgual = true;
      porQue.push(`coincide la fecha de la sentencia (${dd}/${mm}/${campos.fecha.anio})`);
    } else if (fechaRegistro.includes(String(campos.fecha.anio))) {
      puntaje += PESOS.anio;
      porQue.push(`coincide el año (${campos.fecha.anio}), no el día exacto`);
    }
  }

  const claves = (campos.palabrasClave || []).filter((p) => pajar.includes(p));
  if (claves.length) {
    puntaje += Math.min(claves.length * PESOS.palabraClave, PESOS.topePalabrasClave);
    porQue.push(`comparte palabras del texto de la cita (${claves.slice(0, 4).join(', ')})`);
  }

  // La fuerza no es el puntaje: es qué CLASE de coincidencia hubo. Cien
  // puntos hechos de palabras sueltas siguen siendo una coincidencia débil,
  // y ese es justo el error que este verificador tiene que no cometer.
  //
  // Sin un identificador exacto, dos cosas tienen que ser ciertas a la vez:
  //
  //   1. Que coincida el ACTOR, no cualquiera de las dos partes. Probado en
  //      vivo contra CABA, una cita inventada con nombre y apellido comunes
  //      ("Fernandez, Roberto c/ GCBA") encontró un homónimo real por dos
  //      caminos distintos: una vez porque coincidía el DEMANDADO (GCBA, que
  //      litiga contra medio Buenos Aires) más la materia ("amparo", tan
  //      genérica que tampoco distingue nada); otra vez porque el actor
  //      coincidía de pura casualidad con el segundo nombre de otra persona,
  //      en una causa de otra materia y sin la fecha. El demandado en este
  //      catálogo es a menudo una institución (GCBA, Estado Nacional) que
  //      aparece en una fracción enorme de las causas: por sí solo no
  //      distingue nada, así que no cuenta para esto aunque sí sume puntaje.
  //   2. Que además corrobore algo que un nombre parecido no explica de pura
  //      casualidad: la fecha exacta, o la materia del caso (con más de una
  //      palabra propia: "amparo" o "daños" solos son casi tan genéricos
  //      como el demandado). Es el caso de "Halabi c/ P.E.N.": el demandado
  //      es una sigla demasiado corta para contar, pero el actor más la
  //      fecha exacta sí corroboran.
  let fuerza = 'debil';
  if (exacto) fuerza = 'fuerte';
  else if (actorCoincide && (fechaIgual || materiaCoincide)) fuerza = 'media';

  // "senales" viaja aparte del texto de porQue porque de eso depende la
  // confianza, y leer el motivo contando renglones ya se equivocó una vez:
  // dos razones podían ser "coincide Fallos" + "comparte palabras sueltas",
  // que no es corroboración de nada.
  return { puntaje, fuerza, porQue, senales: { exacto, partes, fechaIgual, materiaCoincide } };
}

/** El enlace al documento, que es lo que hace citable a un resultado. */
function enlaceDe(registro) {
  return registro.linkFallo || registro.linkFicha || null;
}

/** Búsqueda real contra una fuente del catálogo. Se puede reemplazar en las pruebas. */
async function buscarEnFuenteReal(slug, { q, partes, tribunal }) {
  const fuente = fuentePorSlug(slug);
  if (!fuente) throw new Error(`fuente desconocida: ${slug}`);
  return fuente.buscar({
    q,
    // Solo lo usa lib/indiceMza.js (ver la nota de "libre" vs "partes" ahí):
    // las otras tres fuentes reciben esto de más y lo ignoran, porque
    // destructuran del objeto solo lo que conocen.
    partes,
    // "todas las palabras": con dos apellidos, exigirlos a los dos es lo que
    // separa el fallo buscado de los cientos que comparten un apellido. Ver
    // lib/relevancia.js.
    modo: 'todas',
    pagina: 1,
    porPagina: POR_FUENTE,
    tribunal: tribunal || fuente.tribunalPorDefecto || undefined,
  });
}

/**
 * Verifica una cita legal contra los buscadores oficiales del catálogo.
 *
 * @param {string} texto  la cita pegada tal cual
 * @param {{buscar?: Function}} [opciones]
 *   buscar: (slug, {q, partes, tribunal}) => Promise<{resultados: object[]}>.
 *   Se inyecta en las pruebas para no salir a la red; por defecto consulta
 *   las fuentes de verdad.
 * @returns {Promise<object>} campos detectados, veredicto, confianza,
 *   explicación, candidatos y qué fuentes se consultaron.
 */
export async function verificarCita(texto, { buscar = buscarEnFuenteReal } = {}) {
  const arranque = Date.now();
  const campos = parsearCita(texto);

  const base = {
    ok: true,
    texto: campos.texto,
    campos,
    alcance: alcanceDeVerificacion(),
    consulta: null,
    fuentesConsultadas: [],
    candidatos: [],
    advertencia: CAUTELA,
  };

  if (!campos.esCita) {
    return terminar(base, 'no_verificable', 'baja', campos.motivo, arranque);
  }

  const objetivos = fuentesAConsultar(campos);
  if (!objetivos.length) {
    const quien = campos.tribunal ? campos.tribunal.nombre : 'ese tribunal';
    return terminar(
      base,
      'no_verificable',
      'alta', // de esto sí se puede estar seguro: no hay dónde buscar
      `El tribunal que reconocí es "${quien}", y ninguno de los buscadores que este proyecto puede consultar indexa esa jurisprudencia. No se buscó nada, así que no hay ni confirmación ni desmentida: hay que verificarla en el sitio del propio tribunal.`,
      arranque
    );
  }

  const consulta = armarConsulta(campos);
  if (!consulta) {
    return terminar(
      base,
      'no_verificable',
      'media',
      'La cita no trae ningún dato con el que armar una búsqueda: sin carátula, sin expediente y sin palabras propias del caso no hay nada que preguntarle al buscador.',
      arranque
    );
  }
  base.consulta = consulta.q;
  base.consultaArmadaCon = consulta.de;

  // Búsqueda real, fuente por fuente. Una que falla no cancela a la otra:
  // los sitios oficiales se caen seguido y media respuesta es mejor que un
  // error en pantalla, siempre que se diga cuál falló (mismo criterio que
  // routes/indice.js con el índice local).
  const candidatos = [];
  for (const objetivo of objetivos.slice(0, MAX_FUENTES)) {
    const registro = { slug: objetivo.slug, nombre: nombreDeFuente(objetivo.slug), ok: false, resultados: 0, error: null };
    try {
      // Mendoza tiene un campo de búsqueda propio para nombres de partes,
      // con otra SQL atrás que sí exige cada palabra en actor/demandado (ver
      // la nota grande al principio de lib/indiceMza.js): si la consulta se
      // armó con la carátula, se la mandamos por ahí y no por "q" a secas.
      const salida = await buscar(objetivo.slug, {
        q: consulta.q,
        partes: consulta.de === 'carátula' ? consulta.q : undefined,
        tribunal: objetivo.tribunal,
      });
      const resultados = (salida && salida.resultados) || [];
      registro.ok = true;
      registro.resultados = resultados.length;
      for (const r of resultados) {
        const { puntaje, fuerza, porQue, senales } = puntuarCandidato(r, campos);
        if (!puntaje) continue;
        candidatos.push({
          senales,
          fuente: objetivo.slug,
          nombreFuente: registro.nombre,
          caratula: r.caratula || '',
          expediente: r.expediente || '',
          fecha: r.fecha || '',
          tribunal: r.tribunal || '',
          link: enlaceDe(r),
          puntaje,
          fuerza,
          porQue,
        });
      }
    } catch (e) {
      registro.error = e?.message || 'no respondió';
    }
    base.fuentesConsultadas.push(registro);
  }

  candidatos.sort((a, b) => b.puntaje - a.puntaje);
  base.candidatos = candidatos.slice(0, MAX_CANDIDATOS);

  const alguna = base.fuentesConsultadas.some((f) => f.ok);
  if (!alguna) {
    const caidas = base.fuentesConsultadas.map((f) => `${f.nombre} (${f.error})`).join('; ');
    return terminar(
      base,
      'no_verificable',
      'alta',
      `No se pudo consultar ninguna fuente en este momento: ${caidas}. La búsqueda no llegó a hacerse, así que no hay nada que concluir sobre la cita — probá de nuevo en un rato.`,
      arranque
    );
  }

  const mejor = base.candidatos[0];
  const donde = base.fuentesConsultadas.filter((f) => f.ok).map((f) => f.nombre).join(' y ');

  if (mejor && mejor.fuerza === 'fuerte') {
    // Un identificador exacto más algo que lo acompañe (la carátula, la
    // fecha) es lo más cerca de la certeza a lo que se puede llegar sin
    // abrir el documento; el identificador solo deja la puerta abierta a
    // una coincidencia numérica desafortunada.
    const corroborado = mejor.senales.partes > 0 || mejor.senales.fechaIgual;
    const confianza = corroborado ? 'alta' : 'media';
    return terminar(
      base,
      'verificada',
      confianza,
      `Encontré en ${mejor.nombreFuente} un fallo que coincide por un dato exacto: ${mejor.porQue.slice(0, 3).join('; ')}. Abrí el documento y confirmá que dice lo que la cita le atribuye — que el fallo exista no significa que sostenga lo que se le hace decir.`,
      arranque
    );
  }

  if (mejor && mejor.fuerza === 'media') {
    return terminar(
      base,
      'verificada',
      'media',
      `Encontré en ${mejor.nombreFuente} un fallo cuya carátula coincide con la de la cita (${mejor.porQue.slice(0, 3).join('; ')}), pero sin un identificador exacto —expediente o tomo y página— que lo confirme. Puede ser el mismo caso u otro con partes de apellido parecido: abrí el documento y comparalo.`,
      arranque
    );
  }

  // Nada convincente. Acá es donde se elige con cuidado cada palabra: se
  // informa qué se buscó y dónde, y se dice explícitamente que esto no
  // prueba que la cita sea falsa.
  const parecidos = base.candidatos.length
    ? ` Hay ${base.candidatos.length} resultado(s) que comparten alguna palabra con la cita, pero ninguno coincide en lo que importa; quedan listados abajo por si sirven de pista.`
    : '';
  const confianza = campos.expediente || campos.fallos || campos.caratula ? 'media' : 'baja';
  return terminar(
    base,
    'no_encontrada',
    confianza,
    `Busqué "${consulta.q}" (armada con ${consulta.de}) en ${donde} y no apareció ningún fallo que coincida con esta cita.${parecidos} ${CAUTELA}`,
    arranque
  );
}

function terminar(base, veredicto, confianza, explicacion, arranque) {
  return { ...base, veredicto, confianza, explicacion, ms: Date.now() - arranque };
}

/*
 * LIMITACIONES, dichas acá para que estén al lado del código que las tiene:
 *
 *   1. No existe un índice de la colección "Fallos" por tomo y página. Ni
 *      SAIJ ni ninguna de las otras tres fuentes expone ese dato como campo
 *      buscable, y el buscador propio de la Corte —el único que sí lo
 *      tiene— está detrás de un reCAPTCHA, o sea que pide expresamente que
 *      del otro lado haya una persona (ver lib/indiceSaij.js). Resultado:
 *      "Fallos: 340:1084" se puede CONFIRMAR si el fallo aparece por
 *      carátula y el texto trae el número, pero no se puede buscar por
 *      tomo y página. Una cita que trae solo eso termina casi siempre en
 *      "no_encontrada", y por eso ese veredicto no dice nunca "no existe".
 *   2. Los buscadores devuelven la primera página de resultados. Un fallo
 *      real cuya carátula esté escrita distinto (abreviada, con el segundo
 *      nombre, con la razón social completa) puede quedar afuera.
 *   3. Mendoza obliga a elegir el tribunal antes de buscar y no tiene un
 *      "todos": se elige uno según la cita (ver tribunalDeMendoza en
 *      lib/citas.js) y, si se eligió mal, no aparece.
 *   4. Que un fallo exista no valida lo que la cita le atribuye. Eso solo se
 *      comprueba leyendo el considerando, y por eso todos los mensajes de
 *      "verificada" terminan pidiendo que se abra el documento.
 *   5. (Arreglado, dejado acá como historia porque casi no se nota desde
 *      afuera.) El campo de texto libre del buscador de Mendoza
 *      (lib/indiceMza.js, parámetro "libre") no hace ni Y ni O entre
 *      palabras sueltas: probado en vivo, "Municipalidad" sola trae 674
 *      resultados y "Gomez" sola trae 128, pero "Gomez Municipalidad" —o
 *      "Ariana Lucia", dos nombres de pila que están uno al lado del otro en
 *      un fallo real que sabíamos que existía— traían 0. El sitio tiene un
 *      segundo campo, "partes", con otra SQL atrás que sí exige cada palabra
 *      por separado en las columnas de actor/demandado (ver la nota grande
 *      al principio de lib/indiceMza.js). armarConsulta() no cambió: sigue
 *      armando la misma consulta de varias palabras para las cuatro
 *      fuentes; lo que cambió es que, cuando esa consulta se armó con la
 *      carátula, ahora viaja al campo "partes" de Mendoza en vez de al
 *      "libre" (ver buscarEnFuenteReal). El Buscador general de la
 *      aplicación sigue usando "libre" como siempre: ahí el texto puede ser
 *      un concepto, no un nombre de partes, y ese campo es el que
 *      corresponde para eso.
 */
