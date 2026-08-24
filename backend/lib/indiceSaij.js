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
import { filtrarPorModo } from './relevancia.js';
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

export async function buscarSaij({ q, modo = 'todas', excluir = '', tribunal = 'sumarios', pagina = 1, porPagina = 20 }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();

  const faceta = TIPOS[tribunal] || TIPOS.sumarios;
  const arranque = (Math.max(1, pagina) - 1) * porPagina;

  // Como SAIJ ordena por relevancia pero busca con OR, los primeros
  // resultados pueden ser todos de una sola de las palabras: en "daño
  // punitivo" la primera pagina entera eran causas penales que solo tenian
  // "punitivo". Por eso se revisan varias paginas antes de aflojar el
  // filtro, en vez de rendirse con la primera.
  const revisados = [];
  let totalCrudo = 0;
  let filtrados = [];
  let aflojado = false;

  for (let i = 0; i < PAGINAS_A_REVISAR; i++) {
    const parametros = new URLSearchParams({
      q: termino,
      o: String(arranque + i * POR_PEDIDO),
      p: String(POR_PEDIDO),
      f: faceta,
    });

    const datos = await pedirBusqueda(parametros.toString());
    if (i === 0) {
      totalCrudo = sacarTotal(datos);
      if (!totalCrudo) return { total: 0, revisados: 0, pagina, porPagina, resultados: [] };
    }

    const crudos = datos?.searchResults?.documentResultList || [];
    if (!crudos.length) break;
    revisados.push(...crudos.map(aRegistro).filter(Boolean));

    // Sin aflojar: si con todas las palabras ya alcanza, no hace falta
    // seguir pidiendo paginas ni bajar el listón.
    ({ lista: filtrados } = filtrarPorModo(revisados, { q: termino, modo, excluir, aflojar: false }));
    if (filtrados.length >= porPagina) break;
    if (revisados.length >= totalCrudo) break;
  }

  // Recién ahora, agotadas las páginas, se permite aflojar.
  if (!filtrados.length) {
    ({ lista: filtrados, aflojado } = filtrarPorModo(revisados, { q: termino, modo, excluir }));
  }

  return {
    // El total que informa SAIJ cuenta los del OR y sobra por dos órdenes de
    // magnitud (391.476 para "interdicto de recobrar"). No se reenvía: se
    // informa lo que de verdad se verificó, y que puede haber más.
    total: filtrados.length,
    totalParcial: filtrados.length >= porPagina || revisados.length < totalCrudo,
    revisados: revisados.length,
    aflojado,
    pagina,
    porPagina,
    resultados: filtrados.slice(0, porPagina),
  };
}
