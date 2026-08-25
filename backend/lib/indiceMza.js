/**
 * Cliente del buscador de jurisprudencia de la SCJM (Mendoza).
 *
 * Replica del lado del servidor el mismo pedido en dos pasos que hace el
 * propio formulario del sitio (funciones/consultar.js):
 *
 *   1. funcion=armarSql + los campos del formulario -> devuelve
 *      "<total>@@<SQL de respaldo>". Ese SQL se recibe tal cual y se
 *      reenvia intacto en el paso 2: no lo armamos nosotros a mano, es el
 *      mismo trato que le da su propio JS.
 *   2. funcion=buscar + next_p/total/mostrar/sql -> devuelve el HTML con
 *      las fichas de resultado ya renderizadas, que parseamos con jsdom.
 *
 * Respeta la misma cortesia que el resto del backend: mismo User-Agent
 * identificable y la misma espera minima entre pedidos al mismo host
 * (esperarTurno, compartida con descargador.js).
 *
 * "libre" vs "partes": el formulario tiene dos campos de texto distintos, y
 * NO son intercambiables. Probado a mano contra el sitio real: pedir
 * "Gomez Municipalidad" por "libre" da 0 resultados —incluso "Ariana Lucia",
 * dos nombres que están uno al lado del otro en un fallo real que sabemos
 * que existe—, aunque cada palabra suelta por separado sí encuentre cosas.
 * "partes" arma otra SQL bien distinta:
 *
 *   (actor LIKE '%Gomez%' OR demandado LIKE '%Gomez%' OR objeto LIKE '%Gomez%')
 *   AND (actor LIKE '%Municipalidad%' OR demandado LIKE '%Municipalidad%' OR objeto LIKE '%Municipalidad%')
 *
 * —cada palabra buscada por separado en las columnas de las partes, todas
 * las palabras exigidas a la vez. Es justo lo que hace falta para buscar por
 * carátula, y encuentra el fallo real sin problema. "libre" en cambio
 * parece buscar sobre otro conjunto de columnas (sumario, voces, tesauro) y
 * ahí SÍ como frase: sirve para buscar un concepto ("responsabilidad del
 * estado"), no un nombre de partes. Por eso buscarMza() manda una cosa u
 * otra según lo que reciba, nunca las dos juntas: mandar "libre" con el
 * mismo texto de una carátula que "partes" ya está confirmando en columnas
 * distintas puede terminar exigiendo (con AND) una coincidencia que no va a
 * pasar por el campo equivocado, y devolver 0 igual.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { filtrarPorModo } from './relevancia.js';
import { errores } from './errores.js';

const HOST = 'wwwjuri.jus.mendoza.gov.ar';
const URL_CONSULTA = `https://${HOST}/bib/jurisprudencia/funciones/consultar.php`;

/** Pedido POST comun a los dos pasos, con la misma cortesia que el descargador. */
async function pedirConsulta(parametros) {
  await esperarTurno(HOST);

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(URL_CONSULTA, {
      method: 'POST',
      signal: control.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'text/html, */*;q=0.8',
      },
      body: parametros.toString(),
    });
    if (!resp.ok) throw errores.indiceMzaFalla(`respuesta ${resp.status}`);
    return await resp.text();
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e; // ya es un ErrorApp
    throw errores.indiceMzaFalla(e?.message);
  } finally {
    clearTimeout(reloj);
  }
}

/** Paso 1: arma el SQL de respaldo y devuelve cuantas coincidencias hay. */
async function armarSql({ libre, partes = '', tribunal }) {
  const p = new URLSearchParams({
    funcion: 'armarSql',
    mostrar: '20',
    tesauro: '',
    libre,
    materia: '0',
    tribunal,
    expediente: '',
    partes,
    preopinante: '',
    cota: '0',
    fecha: '',
    ubica: '0',
    libro: '',
    fojas: '',
    norma: '0',
    numero: '',
    articulo: '',
    tribu: tribunal,
    competencia: '',
  });

  const cuerpo = await pedirConsulta(p);
  const marca = cuerpo.indexOf('@@');
  if (marca === -1) throw errores.indiceMzaFalla('no devolvió el separador "@@" esperado');

  // El total son los digitos justo antes de "@@": lo que venga antes puede
  // traer avisos propios del PHP del sitio, que no nos interesan.
  const antes = cuerpo.slice(0, marca).match(/(\d+)\s*$/);
  if (!antes) throw errores.indiceMzaFalla('no encontré el contador de resultados');

  return { total: parseInt(antes[1], 10), sql: cuerpo.slice(marca + 2) };
}

/** Paso 2: con el SQL del paso 1, trae las fichas ya renderizadas en HTML. */
function traerFichas({ sql, pagina, porPagina, total }) {
  const p = new URLSearchParams({
    funcion: 'buscar',
    next_p: String(pagina),
    total: String(total),
    mostrar: String(porPagina),
    sql,
  });
  return pedirConsulta(p);
}

/** Saca el prefijo "Etiqueta: " que el sitio antepone a varios campos. */
function sinEtiqueta(texto) {
  return String(texto || '').replace(/^[^:]+:\s*/, '').trim();
}

/** Convierte el HTML de resultados en una lista de registros estructurados. */
function parsearFichas(html) {
  const consolaMuda = new VirtualConsole();
  consolaMuda.on('jsdomError', () => {});

  let dom;
  try {
    dom = new JSDOM(`<body>${html}</body>`, { virtualConsole: consolaMuda });
  } catch {
    throw errores.indiceMzaFalla('no pude leer el HTML de resultados');
  }
  const doc = dom.window.document;

  const registros = [];
  doc.querySelectorAll('.ficha').forEach((ficha) => {
    const texto = (sel) => (ficha.querySelector(sel)?.textContent || '').trim();

    const expteTexto = sinEtiqueta(texto('.expte'));
    const guion = expteTexto.indexOf(' - ');
    const expediente = guion === -1 ? expteTexto : expteTexto.slice(0, guion).trim();
    const caratula = guion === -1 ? '' : expteTexto.slice(guion + 3).trim();

    registros.push({
      id: ficha.id || null,
      materia: texto('.materia'),
      voces: texto('.voces').split(' - ').map((v) => v.trim()).filter(Boolean),
      sumario: texto('.texto'),
      expediente,
      caratula,
      fecha: sinEtiqueta(texto('.fecha')),
      tribunal: sinEtiqueta(texto('.trib')),
      magistrados: sinEtiqueta(texto('.juez')),
      linkFicha: ficha.querySelector('.enlace_Salir')?.href || null,
      linkFallo: ficha.querySelector('a.linkfallo')?.href || null,
    });
  });

  dom.window.close();
  return registros.filter((r) => r.id); // una ficha sin id no es aprovechable
}

/**
 * Busca en el buscador de jurisprudencia del Poder Judicial de Mendoza.
 *
 * tribunal por defecto es "SC" (Suprema Corte), igual que hace el propio
 * sitio cuando no elegís nada en el selector. Los otros códigos que probamos
 * y andan: "CC" (Cámaras en lo Civil, Comercial y Minas) y "CT" (Cámaras del
 * Trabajo). "CF" (Cámara de Familia) existe como opción en el sitio pero
 * devolvió siempre 0 resultados en las pruebas — puede que ese fuero no esté
 * cargado en esta base, o que necesite un parámetro más que no mandamos
 * todavía. Primera instancia queda afuera: el sitio no la expone acá.
 *
 * @param {object} args
 * @param {string} [args.q] texto libre: conceptos, no nombres de partes (ver
 *   la nota de "libre" vs "partes" al principio del archivo).
 * @param {string} [args.partes] nombres de actor/demandado. Si viene esto, se
 *   usa en vez de "q" — son dos campos del sitio con SQL distinta atrás, no
 *   tiene sentido mandar los dos a la vez con el mismo texto.
 */
export async function buscarMza({ q, partes: partesForm, modo = 'todas', excluir = '', tribunal = 'SC', pagina = 1, porPagina = 20 }) {
  const partes = String(partesForm || '').trim();
  const libre = partes ? '' : String(q || '').trim();
  if (!libre && !partes) throw errores.consultaVacia();

  // Este buscador SOLO sabe "todas las palabras" (ver lib/relevancia.js: las
  // comillas rompen la consulta en vez de hacer frase, y el OR lo ignora),
  // así que siempre se le manda el texto pelado y los otros modos se
  // resuelven acá con lo que devolvió.
  const { total, sql } = await armarSql({ libre, partes, tribunal });
  if (total <= 0) return { total: 0, pagina, porPagina, resultados: [] };

  const hayQueFiltrar = modo === 'exacta' || String(excluir || '').trim();
  // Si vamos a descartar resultados, conviene traer de más para no quedarnos
  // con media página.
  const traer = hayQueFiltrar ? Math.min(60, porPagina * 3) : porPagina;

  const html = await traerFichas({ sql, pagina, porPagina: traer, total });
  const todos = parsearFichas(html);
  if (!hayQueFiltrar) return { total, pagina, porPagina, resultados: todos };

  const { lista, aflojado } = filtrarPorModo(todos, { q: partes || libre, modo, excluir });

  return {
    // El sitio no sabe hacer este modo, así que su contador cuenta otra cosa:
    // se informa lo que de verdad quedó después de revisar, no una estimación.
    total: lista.length,
    totalParcial: todos.length < total,
    revisados: todos.length,
    aflojado,
    pagina,
    porPagina,
    resultados: lista.slice(0, porPagina),
  };
}
