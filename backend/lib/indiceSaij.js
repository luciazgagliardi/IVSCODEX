/**
 * Cliente del SAIJ (Sistema Argentino de Informacion Juridica), del
 * Ministerio de Justicia de la Nacion.
 *
 * Es, por lejos, la base mas grande de las tres: al escribir esto declaraba
 * 902.998 documentos de jurisprudencia —571.950 sumarios y 324.873 fallos—
 * de todo el pais (CSJN, tribunales nacionales y las provincias), contra los
 * pocos miles por consulta que dan Mendoza y CABA. Se sumo justamente por
 * eso: habia voces del tesauro que no devolvian NADA en las otras dos y en
 * SAIJ tienen miles de resultados ("formula Acciarri": 0 en Mendoza y en
 * CABA, 5.628 aca).
 *
 * El sitio expone el mismo endpoint JSON que usa su propio buscador. Detalles
 * que costaron encontrar y conviene no volver a averiguar:
 *
 *   - El parametro de texto es "q". Hay uno "t" que el endpoint ACEPTA sin
 *     error pero ignora por completo: con t= una palabra inventada devuelve
 *     la base entera, como si no hubiera filtro. Con q= devuelve 0, que es
 *     lo correcto.
 *   - Sin el "f=" de facetas la respuesta viene vacia.
 *   - Manda 403 si no ve un User-Agent de navegador y un Referer del propio
 *     sitio.
 *   - El total NO esta en searchResults.totalSearchResults (ahi viene cuantos
 *     entraron en la pagina); esta en la faceta "Total".
 *   - Cada resultado trae el documento como JSON *serializado dentro de un
 *     string* (documentAbstract), asi que hay que parsear dos veces.
 *
 * Los sumarios son lo mas valioso: traen el texto de la doctrina en la misma
 * respuesta de busqueda, igual que Mendoza, sin tener que ir a buscar el
 * documento. Los fallos, en cambio, en SAIJ son solo ficha (caratula,
 * tribunal, fecha, magistrados): el texto completo no esta cargado, vive en
 * los sumarios relacionados. Por eso el modo por defecto es "sumarios".
 */

import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { paginarFiltrado } from './paginarFiltrado.js';
import { errores } from './errores.js';

const HOST = 'www.saij.gob.ar';
const URL_BUSQUEDA = `https://${HOST}/busqueda`;

/**
 * Qué se busca. Se expone como si fueran "tribunales" porque el frontend ya
 * sabe dibujar esos chips y mandarlos en el mismo parametro (ver
 * routes/indice.js); acá adentro son facetas de tipo de documento.
 */
const TIPOS = {
  sumarios: 'Total|Tipo de Documento/Jurisprudencia/Sumario',
  fallos: 'Total|Tipo de Documento/Jurisprudencia/Fallo',
  todo: 'Total|Tipo de Documento/Jurisprudencia',
};

/**
 * SAIJ ademas expone una faceta por tribunal, y ahi esta la Corte Suprema.
 *
 * Sirve para ofrecer jurisprudencia de la CSJN sin pasar por el sitio de la
 * propia Corte: sjconsulta.csjn.gov.ar protege TODOS sus buscadores
 * (sumarios, fallos, fallos destacados y hasta novedades) con reCAPTCHA, o
 * sea que pide expresamente que del otro lado haya una persona. Eso se
 * respeta. SAIJ publica ese mismo material de forma abierta, asi que la
 * consulta va por ahi — y en la interfaz se dice de donde sale.
 */
const TRIBUNAL_CSJN = 'CORTE SUPREMA DE JUSTICIA DE LA NACION';
// Solo los FALLOS traen el campo "tribunal"; los sumarios no, asi que
// filtrarlos por tribunal devuelve siempre cero. Por eso esta fuente busca
// siempre entre fallos y no ofrece elegir: una opcion que nunca trae nada es
// peor que no tenerla.
const FACETA_CSJN = `Total|Tipo de Documento/Jurisprudencia/Fallo|Tribunal/${TRIBUNAL_CSJN}`;

async function pedirBusqueda(parametros) {
  await esperarTurno(HOST);

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${URL_BUSQUEDA}?${parametros}`, {
      signal: control.signal,
      headers: {
        // Sin User-Agent de navegador y sin Referer propio, el sitio corta
        // con 403 antes de mirar la consulta.
        'User-Agent': `Mozilla/5.0 (compatible; ${USER_AGENT})`,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'es-AR,es;q=0.9',
        Referer: `https://${HOST}/`,
      },
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('saij', `respuesta ${resp.status}`);
    return await resp.json();
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e; // ya es un ErrorApp
    throw errores.indiceFuenteFalla('saij', e?.message);
  } finally {
    clearTimeout(reloj);
  }
}

/** El total real vive en la faceta "Total", no en totalSearchResults. */
function sacarTotal(datos) {
  const categorias = datos?.searchResults?.categoriesResultList || [];
  const total = categorias.find((c) => c.facetName === 'Total');
  const hijo = total?.facetChildren?.[0];
  return typeof hijo?.facetHits === 'number' ? hijo.facetHits : 0;
}

/** SAIJ marca los parrafos con [[p]]…[[/p]] en vez de HTML. */
function limpiarTexto(s) {
  return String(s || '')
    .replace(/\[\[\/?p\]\]/g, ' ')
    .replace(/\[\[[^\]]*\]\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1989-06-15" -> "15/06/1989", que es como lo muestran las otras fuentes. */
function fechaLegible(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

/*
 * SAIJ busca SIEMPRE con OR entre las palabras y descarta los operadores que
 * se le manden (probado a mano: "+interdicto +recobrar" se expande igual que
 * sin los "+"). De ahi salen los totales absurdos —391.476 para "interdicto
 * de recobrar"— y el ruido: sumarios sobre dementes no declarados donde solo
 * estaba la palabra "interdicto". El ranking pone arriba lo bueno, pero la
 * cola es basura, asi que el filtro por modo se hace despues, en
 * lib/relevancia.js, sobre el titulo y el texto que la respuesta ya trae.
 */

/** Los descriptores del tesauro: el equivalente a las "voces" de Mendoza. */
function sacarVoces(descriptores) {
  const lista = [].concat(descriptores?.descriptor || []);
  return lista.map((d) => d?.elegido?.termino).filter(Boolean);
}

/** De dónde viene el fallo, con lo que traiga el resumen de búsqueda. */
function sacarTribunal(c) {
  return [c?.tribunal, c?.provincia, c?.jurisdiccion?.descripcion]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' · ');
}

/**
 * Convierte un resultado crudo en un registro con la misma forma que usan
 * las otras fuentes (ver routes/indice.js y fichaIndice en el frontend).
 */
function aRegistro(bruto) {
  let doc;
  try {
    doc = JSON.parse(bruto.documentAbstract).document;
  } catch {
    return null; // un resultado ilegible no tiene por qué tirar toda la búsqueda
  }
  const c = doc?.content || {};
  const uuid = doc?.metadata?.uuid;
  if (!uuid) return null;

  const esSumario = doc?.metadata?.['document-content-type'] === 'sumario';
  // En un fallo la carátula se arma con las partes; en un sumario el título
  // ya viene armado con los descriptores.
  const caratula = esSumario
    ? c.titulo || limpiarTexto(c.sumario)
    : [c.actor, c.demandado].filter(Boolean).join(' c/ ') + (c.sobre ? ` s/ ${c.sobre}` : '');

  return {
    id: `saij_${uuid}`,
    expediente: c['numero-interno'] || c['id-infojus'] || '',
    caratula: caratula || '(sin carátula)',
    // Solo los sumarios traen la doctrina; los fallos son ficha sin texto.
    sumario: esSumario ? limpiarTexto(c.texto) : '',
    voces: sacarVoces(c.descriptores),
    fecha: fechaLegible(c.fecha),
    tribunal: sacarTribunal(c),
    magistrados: c.magistrados || '',
    // La página del documento se arma en el navegador con JavaScript, así
    // que traerla al lector no daría texto: se ofrece solo como enlace.
    linkFicha: `https://${HOST}/${uuid}`,
    linkFallo: null,
  };
}

/**
 * Busca jurisprudencia en SAIJ.
 *
 * @param {{q: string, modo?: string, excluir?: string, tribunal?: string,
 *          pagina?: number, porPagina?: number}} args
 *   tribunal es cuál de los TIPOS mirar ("sumarios" por defecto).
 */
/** Cuántas páginas de 100 se revisan antes de darse por vencido. */
const PAGINAS_A_REVISAR = 3;
const POR_PEDIDO = 100;

export async function buscarSaij({ q, modo = 'todas', excluir = '', tribunal = 'sumarios', pagina = 1, porPagina = 20, soloCsjn = false, desde = null }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();

  const faceta = soloCsjn ? FACETA_CSJN : (TIPOS[tribunal] || TIPOS.sumarios);
  // SAIJ toma un offset de fila directo ("o"), así que el cursor viaja tal
  // cual. El cálculo por número de página queda solo para quien todavía
  // llame sin cursor (lib/verificarCita.js pide siempre la primera).
  const arranque = desde === null ? (Math.max(1, pagina) - 1) * POR_PEDIDO : Math.max(0, desde);

  // SAIJ SIEMPRE filtra de este lado, en los tres modos: su buscador es un
  // OR y no sabe hacer ni "todas las palabras" ni frase. Por eso no hay acá
  // un camino "el sitio ya lo resolvió" como en Mendoza o CABA.
  let totalCrudo = 0;

  /**
   * Una tanda de cien documentos desde la fila `offset`.
   *
   * Como SAIJ ordena por relevancia pero busca con OR, los primeros
   * resultados pueden ser todos de una sola de las palabras: en "daño
   * punitivo" la primera página entera eran causas penales que solo tenían
   * "punitivo". Por eso paginarFiltrado sigue pidiendo tandas hasta llenar
   * la página, en vez de rendirse con la primera.
   */
  const traer = async (offset) => {
    const parametros = new URLSearchParams({
      q: termino,
      o: String(offset),
      p: String(POR_PEDIDO),
      f: faceta,
    });
    const datos = await pedirBusqueda(parametros.toString());
    if (!totalCrudo) totalCrudo = sacarTotal(datos);
    const crudos = datos?.searchResults?.documentResultList || [];
    // Sin filtrar los null: cada documento que mandó SAIJ ocupa su posición
    // aunque no se haya podido leer, porque el cursor cuenta filas del
    // sitio. Ver la nota de traer() en lib/paginarFiltrado.js.
    return crudos.map(aRegistro);
  };

  const { resultados, revisados, siguienteDesde, aflojado } = await paginarFiltrado({
    traer,
    desde: arranque,
    // El total llega recién adentro de la primera respuesta, así que se pasa
    // como función: paginarFiltrado la consulta después de cada tanda.
    total: () => totalCrudo,
    porPagina,
    q: termino,
    modo,
    excluir,
    maxTandas: PAGINAS_A_REVISAR,
  });

  if (!totalCrudo) return { total: 0, totalFuente: 0, siguienteDesde: null, revisados: 0, pagina, porPagina, resultados: [] };

  return {
    // El total que informa SAIJ cuenta los del OR y sobra por dos órdenes de
    // magnitud (391.476 para "interdicto de recobrar"). No se reenvía como
    // "total": se informa lo que de verdad se verificó.
    total: resultados.length,
    // Pero sí viaja aparte, porque es el único dato que dice cuánto queda
    // sin mirar. Ojo con cómo se lee: es el conteo del OR de SAIJ, un techo
    // grosero, no "la cantidad de fallos sobre el tema". El frontend lo
    // presenta como lo que es.
    totalFuente: totalCrudo,
    // La fila exacta donde sigue la página siguiente. Antes esto se calculaba
    // como (pagina-1)*porPagina, o sea que la página 2 arrancaba en la fila
    // 20 cuando la página 1 ya había revisado hasta la 300: se pisaban 280
    // filas y el usuario veía casi lo mismo dos veces. Ver
    // lib/paginarFiltrado.js.
    siguienteDesde,
    // "Parcial" quiere decir que el número de arriba es un PISO, no un
    // total: se calculó sobre las filas que se alcanzaron a revisar. Antes
    // exigía además no haber llenado la página, con el argumento de que una
    // página llena es paginación y no duda. Confundía dos cosas: que haya
    // más PÁGINAS de coincidencias buenas es normal, pero que el CONTADOR
    // salga de una muestra hay que decirlo igual. Con el tope de tres
    // páginas, la app mostraba "100 resultados que coinciden de verdad" sin
    // ninguna advertencia, y eran 100 de los primeros 100 que miró.
    totalParcial: siguienteDesde !== null,
    revisados,
    aflojado,
    pagina,
    porPagina,
    resultados,
  };
}
