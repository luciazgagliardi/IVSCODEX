/**
 * Cliente del buscador de Dialnet (Universidad de La Rioja, España).
 *
 * No es un tribunal: es la base de datos de doctrina jurídica en español más
 * grande de acceso libre —revistas, libros, tesis y actas de congreso—, con
 * muchísimo contenido de autores y editoriales argentinas. Este proyecto ya
 * la tenía en el catálogo de enlaces manuales ("Fuentes" > Doctrina); esto la
 * suma como buscador propio, con robot detrás como Mendoza o CABA.
 *
 * Confirmado en vivo antes de escribir este archivo: es un GET simple, sin
 * sesión, sin token, sin CAPTCHA ni challenge de bot (a diferencia de SciELO,
 * que sí tiene uno — "Bunny Shield" — y por eso quedó afuera). Buscar
 * "responsabilidad del estado" da 30.704 resultados reales, con título,
 * autor(es), revista/libro, año y —para una parte— un PDF de texto completo
 * hospedado en el propio dialnet.unirioja.es.
 *
 * Como es un motor de búsqueda de TEXTO (Solr, a juzgar por el nombre del
 * parámetro "querysDismax"), no de expedientes: no hay carátula, tribunal
 * ni fecha de sentencia. Los campos genéricos que espera el resto del
 * proyecto (ver puntuarCandidato en verificarCita.js y fichaIndice en el
 * frontend) se rellenan con lo más parecido que tiene un artículo de
 * doctrina — el detalle de cada mapeo está en parsearItem() más abajo.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { filtrarPorModo } from './relevancia.js';
import { errores } from './errores.js';

const HOST = 'dialnet.unirioja.es';
const URL_BUSQUEDA = `https://${HOST}/buscar/documentos`;

/**
 * Cuántos documentos manda Dialnet por página. No es configurable por
 * parámetro (no encontramos uno probando a mano): es el tamaño real de
 * página del sitio, confirmado viendo que "inicio=21" es el link a la
 * "página siguiente" de una búsqueda con miles de resultados.
 */
const POR_PAGINA_DIALNET = 20;

/** Nombre legible de cada tipo de documento, por el prefijo de su <li id="tipoNNN">. */
const TIPOS = {
  articulo: 'Artículo',
  libro: 'Libro',
  capitulo: 'Capítulo de libro',
  tes: 'Tesis',
  congreso: 'Congreso',
};

async function pedirBusqueda(q, inicio) {
  await esperarTurno(HOST);

  const p = new URLSearchParams({ 'querysDismax.DOCUMENTAL_TODO': q });
  if (inicio > 1) p.set('inicio', String(inicio));

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${URL_BUSQUEDA}?${p.toString()}`, {
      signal: control.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html, */*;q=0.8' },
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('dialnet', `respuesta ${resp.status}`);
    return await resp.text();
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e; // ya es un ErrorApp
    throw errores.indiceFuenteFalla('dialnet', e?.cause?.message || e?.cause?.code || e?.message);
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * El total sale de "<p class="numeroDeResultados"> 30.704 documentos
 * encontrados </p>". Dialnet usa el punto como separador de miles (formato
 * español) y esa etiqueta directamente no aparece cuando el total es 0 —así
 * que su ausencia se lee como "sin resultados", no como un error.
 */
function sacarTotal(html) {
  const m = /numeroDeResultados[^>]*>\s*([\d.]+)\s*documentos?\s+encontrados?/i.exec(html);
  if (!m) return 0;
  return parseInt(m[1].replace(/\./g, ''), 10) || 0;
}

/** El primer año de 4 dígitos razonable (1900-2099) que aparece en la cita. */
function anioDe(texto) {
  const m = /\b(19|20)\d{2}\b/.exec(texto || '');
  return m ? m[0] : '';
}

function parsearItem(li) {
  const tipo = (li.className || '').split(/\s+/)[0] || '';
  const tipoLegible = TIPOS[tipo] || (tipo ? tipo[0].toUpperCase() + tipo.slice(1) : 'Documento');

  const enlaceTitulo = li.querySelector('.titulo .titulo a, p.titulo a');
  if (!enlaceTitulo) return null;
  const caratula = (enlaceTitulo.textContent || '').replace(/\s+/g, ' ').trim();
  const linkFicha = new URL(enlaceTitulo.getAttribute('href') || '', URL_BUSQUEDA).toString();

  const autores = Array.from(li.querySelectorAll('.autores a'))
    .map((a) => (a.textContent || '').trim())
    .filter(Boolean);

  const localizacion = (li.querySelector('.localizacion')?.textContent || '').replace(/\s+/g, ' ').trim();

  // El PDF de texto completo, cuando existe, vive en el propio dialnet.unirioja.es
  // ("/descarga/articulo/NNN.pdf"): ese sí se puede pedir con el extractor de
  // este proyecto (agregado a DOMINIOS_PERMITIDOS). El link "externo" que
  // Dialnet ofrece a veces —al sitio de la revista, fuera de su dominio— NO
  // se usa acá: no hay forma de saber de antemano si ese dominio de terceros
  // va a dejar entrar a este servidor, y ofrecer un botón que va a fallar la
  // mitad de las veces es peor que no ofrecerlo.
  const enlaceDescarga = li.querySelector('a[href^="/descarga/"]');
  const linkFallo = enlaceDescarga ? new URL(enlaceDescarga.getAttribute('href'), URL_BUSQUEDA).toString() : null;

  return {
    id: `dialnet_${li.id}`,
    caratula,
    // A propósito SIN sumario: Dialnet no manda un resumen en el listado (el
    // suyo vive en un link aparte, "info=resumen", una página por
    // documento — pedirle eso a los 20 resultados de una búsqueda tardaría
    // 20 veces la espera de cortesía por host, varios minutos). Dejando
    // esto vacío, el frontend hace exactamente lo mismo que ya hace con
    // CABA (que tampoco manda sumario): va a buscar el pasaje real al
    // documento y lo muestra con la palabra buscada resaltada, en vez de
    // solo el dato bibliográfico. Ver traerFragmentos() en frontend/index.html.
    // Esto solo funciona para los resultados con linkFallo (PDF alojado en
    // el propio Dialnet, no todos lo tienen); mientras tanto, y siempre
    // para los que no tienen PDF propio, el autor/revista/año en tribunal y
    // magistrados es lo que da una idea del contenido.
    sumario: '',
    voces: [],
    expediente: '',
    fecha: anioDe(localizacion),
    tribunal: localizacion ? `${tipoLegible} — ${localizacion}` : tipoLegible,
    magistrados: autores.length ? `Autor(es): ${autores.join(', ')}` : '',
    linkFallo,
    linkFicha,
  };
}

function parsearItems(html) {
  const consolaMuda = new VirtualConsole();
  consolaMuda.on('jsdomError', () => {});

  let dom;
  try {
    dom = new JSDOM(html, { virtualConsole: consolaMuda });
  } catch {
    throw errores.indiceFuenteFalla('dialnet', 'no pude leer el HTML de resultados');
  }
  const items = Array.from(dom.window.document.querySelectorAll('#resultadosDeBusqueda li[id]'));
  return items.map(parsearItem).filter(Boolean);
}

/**
 * Cuántas páginas reales de Dialnet (20 documentos cada una) se revisan como
 * mucho antes de darse por vencido filtrando "frase exacta" o "excluir".
 * Mismo criterio que PAGINAS_A_REVISAR en lib/indiceSaij.js: una búsqueda de
 * concepto puede traer miles de resultados de los que solo una fracción
 * cumple la frase exacta, así que hace falta mirar de a varias páginas
 * reales, no rendirse con la primera.
 */
const PAGINAS_A_REVISAR = 5;

/**
 * Busca en Dialnet.
 *
 * A diferencia de los tres buscadores de tribunales, este no filtra por
 * "todas/alguna las palabras" de su lado (es un motor de relevancia tipo
 * Solr, no un LIKE de SQL): "todas" y "alguna" confían en su propio orden.
 * Solo "exacta" (frase textual) y "excluir" se resuelven acá, igual que en
 * Mendoza, porque esos dos si hace falta garantizarlos.
 */
export async function buscarDialnet({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = POR_PAGINA_DIALNET }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();

  const arranque = (Math.max(1, pagina) - 1) * POR_PAGINA_DIALNET + 1;
  const primerHtml = await pedirBusqueda(termino, arranque);
  const total = sacarTotal(primerHtml);
  if (total === 0) return { total: 0, pagina, porPagina, resultados: [] };

  const items = parsearItems(primerHtml);

  const hayQueFiltrar = modo === 'exacta' || String(excluir || '').trim();
  if (!hayQueFiltrar) return { total, pagina, porPagina: POR_PAGINA_DIALNET, resultados: items };

  // "Frase exacta" o "excluir": Dialnet no los resuelve solo, así que hay
  // que revisar de a páginas reales (20 documentos cada una) hasta juntar
  // una página completa de coincidencias buenas o quedarnos sin más filas.
  const revisados = [...items];
  let { lista: filtrados, aflojado } = filtrarPorModo(revisados, { q: termino, modo, excluir });

  for (let i = 1; i < PAGINAS_A_REVISAR && filtrados.length < porPagina && revisados.length < total; i++) {
    const html = await pedirBusqueda(termino, arranque + i * POR_PAGINA_DIALNET);
    const siguientes = parsearItems(html);
    if (!siguientes.length) break;
    revisados.push(...siguientes);
    ({ lista: filtrados, aflojado } = filtrarPorModo(revisados, { q: termino, modo, excluir }));
  }

  return {
    // Igual que Mendoza y SAIJ: filtrando de este lado, el contador que
    // vale es el de lo que de verdad quedó, no el total crudo del sitio.
    total: filtrados.length,
    // "Parcial" es CADUCIDAD, no paginación: una página llena de
    // coincidencias buenas no es una duda, es que hay más de una página.
    // La incertidumbre de verdad es solo cuando ni revisando varias páginas
    // se llegó a llenar esta Y todavía quedan documentos de Dialnet sin
    // mirar — recién ahí puede que hubiera más entre los que no se vieron.
    totalParcial: filtrados.length < porPagina && revisados.length < total,
    revisados: revisados.length,
    aflojado,
    pagina,
    porPagina: POR_PAGINA_DIALNET,
    resultados: filtrados.slice(0, porPagina),
  };
}
