/**
 * Cliente de Mendoza Legal, categoría "Jurisprudencia".
 *
 * No es un tribunal ni un repositorio oficial: es la revista jurídica del
 * Colegio de Abogados de Mendoza (ISSN 2718-7667), que publica fallos
 * elegidos uno por uno —provinciales, nacionales e interamericanos— con un
 * resumen escrito por una persona y el enlace al texto completo. Este
 * proyecto ya la tenía en el catálogo de enlaces manuales ("Fuentes", m28);
 * esto la suma como buscador propio, con robot detrás, igual que se hizo con
 * Dialnet.
 *
 * Qué aporta que las otras cinco no: SELECCIÓN. Los buscadores de tribunales
 * devuelven todo lo que está cargado, sin jerarquía; acá cada entrada existe
 * porque a alguien le pareció que valía la pena. Es chiquito a propósito —177
 * artículos en toda la categoría al momento de escribir esto, contra el casi
 * millón de documentos de SAIJ— y ese es justamente el punto: no reemplaza a
 * ninguna de las otras, se busca cuando se quiere ver qué se destacó de un
 * tema, no para barrer la jurisprudencia de un tribunal.
 *
 * Se consulta por la API REST de WordPress (/wp-json/wp/v2/posts), no
 * raspando el HTML del listado. Confirmado en vivo antes de escribir este
 * archivo: es un GET público, sin sesión ni token, devuelve JSON con el
 * contenido completo de cada artículo y el total en la cabecera X-WP-Total.
 * Raspar /category/jurisprudencia/ hubiera dado lo mismo con más trabajo y
 * más frágil: la API es la interfaz documentada del propio WordPress, el
 * HTML es el tema visual, que cambia cuando cambian el diseño.
 *
 * Sobre el modo de búsqueda: el parámetro "search" de WordPress exige TODAS
 * las palabras (hace un AND entre términos, cada uno buscado en título,
 * extracto y cuerpo). Verificado contra el sitio: "daño" da 35, "moral" da
 * 13 y "daño moral" da 12 —la intersección, no la unión—. O sea que sabe
 * hacer el modo "todas" solo, igual que Mendoza, y "exacta" y "excluir" se
 * resuelven acá con lib/relevancia.js.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno, dominioHabilitado } from './descargador.js';
import { paginarFiltrado } from './paginarFiltrado.js';
import { errores } from './errores.js';

const HOST = 'mendozalegal.com';
const URL_API = `https://${HOST}/wp-json/wp/v2/posts`;

/**
 * El id de la categoría "Jurisprudencia" en este WordPress.
 *
 * Es el número que pidió el usuario cuando pidió integrar
 * mendozalegal.com/category/jurisprudencia/ — la propia página lo declara en
 * su <head> ("wp-json/wp/v2/categories/10") y en la clase del <body>
 * ("category-jurisprudencia category-10"). Va fijo y no como parámetro
 * porque el resto del sitio (Doctrina, Normativa, Capacitación) es otra
 * cosa: son artículos de opinión y novedades, no fallos, y mezclarlos en un
 * buscador de jurisprudencia sería exactamente el ruido que este proyecto
 * evita en todas las demás fuentes.
 */
const CATEGORIA_JURISPRUDENCIA = 10;

/** Tope de la API de WordPress para "per_page". Más que esto lo rechaza. */
const POR_PAGINA_MAX = 100;

/**
 * Cuántos artículos se piden de una. Sesenta y no veinte porque el filtro de
 * "frase exacta" descarta, y esta API deja pedir hasta cien en un solo
 * pedido: traer de a veinte serían tres viajes para llenar una página.
 */
const ARTICULOS_POR_TANDA = 60;

/** Cuántas tandas como mucho en un mismo pedido. Ver lib/paginarFiltrado.js. */
const MAX_TANDAS = 3;

/**
 * Tope de caracteres del cuerpo del artículo que se guarda como sumario.
 *
 * Estos artículos son cortos —la mitad no llega a 2.100 caracteres de texto,
 * el más largo de los cuarenta que se midieron tenía 5.747— así que casi
 * ninguno se recorta. El tope está para que un compendio kilométrico no
 * termine ocupando media pantalla ni inflando el índice en disco; el número
 * es el largo del sumario más largo que devuelve Mendoza (2.382), para que
 * un resultado de acá no se vea distinto de uno de allá.
 */
const MAX_SUMARIO = 2500;

/**
 * Un pedido a la API, con la misma cortesía que el resto del backend.
 *
 * Devuelve { posts, total }. El total viene en la cabecera X-WP-Total, que
 * es la única forma de saber cuántos hay en total: el cuerpo trae solo la
 * tanda pedida.
 */
async function pedirTanda({ q, desde, cuantos }) {
  await esperarTurno(HOST);

  const p = new URLSearchParams({
    categories: String(CATEGORIA_JURISPRUDENCIA),
    per_page: String(Math.min(POR_PAGINA_MAX, Math.max(1, cuantos))),
    // "offset" y no "page": el cursor de paginación apunta a una fila
    // cualquiera, no al principio de una página (ver lib/paginarFiltrado.js).
    // WordPress acepta los dos; probado en vivo, offset=5 y offset=7
    // devuelven ventanas corridas de a una, que es justo lo que hace falta.
    offset: String(Math.max(0, desde)),
    // Sin esto viaja el objeto entero de WordPress (revisiones, plantilla,
    // metadatos de Yoast, _links...): varias veces más bytes por artículo,
    // todos para tirar.
    _fields: 'id,link,date,title,content',
  });
  if (q) p.set('search', q);

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${URL_API}?${p.toString()}`, {
      signal: control.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    // Pedir más allá del final no es un fallo del sitio ni nuestro: es que
    // se acabaron los resultados. Con "offset" WordPress simplemente
    // devuelve una lista vacía, pero si alguna vez volviera a pedirse por
    // número de página contesta un 400 con "rest_post_invalid_page_number";
    // tratarlo como error dejaría al paginador mostrando "el buscador no
    // respondió" cuando en realidad llegó al final.
    if (resp.status === 400) {
      const detalle = await resp.json().catch(() => null);
      if (detalle?.code === 'rest_post_invalid_page_number') return { posts: [], total: 0 };
      throw errores.indiceFuenteFalla('mendozalegal', detalle?.message || 'pedido rechazado (400)');
    }
    if (!resp.ok) throw errores.indiceFuenteFalla('mendozalegal', `respuesta ${resp.status}`);

    const posts = await resp.json();
    if (!Array.isArray(posts)) {
      throw errores.indiceFuenteFalla('mendozalegal', 'la API no devolvió una lista de artículos');
    }
    return { posts, total: parseInt(resp.headers.get('x-wp-total') || '0', 10) || 0 };
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e; // ya es un ErrorApp
    throw errores.indiceFuenteFalla('mendozalegal', e?.cause?.message || e?.cause?.code || e?.message);
  } finally {
    clearTimeout(reloj);
  }
}

/** Saca el prefijo "Etiqueta: " que el artículo antepone a cada dato. */
function sinEtiqueta(texto) {
  return String(texto || '').replace(/^[^:]+:\s*/, '').trim();
}

function limpiar(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

/** El texto de un fragmento de HTML, resuelto por el parser del documento. */
function textoDeHtml(doc, html) {
  const caja = doc.createElement('div');
  caja.innerHTML = String(html || '');
  return limpiar(caja.textContent);
}

/**
 * Convierte el HTML de un artículo en los campos que espera el resto del
 * proyecto (los mismos que devuelven lib/indiceMza.js y compañía).
 *
 * La estructura de una entrada de jurisprudencia es siempre la misma, y es
 * lo bastante regular como para leerla sin adivinar (verificado sobre los 40
 * artículos más recientes de la categoría):
 *
 *   <p><img …></p>                          el ícono de la sección
 *   <h2>Carátula: …</h2>
 *   <h2>Tribunal: …</h2>
 *   <h2>Fecha: dd/mm/aaaa</h2>
 *   <p>…</p>                                 el resumen, uno o varios párrafos
 *   <p><a …><strong>Fallo completo</strong></a></p>
 *   <hr />
 *   <p>Encuentra más jurisprudencia en Mendoza Legal–Repositorio.</p>
 *
 * Los tres <h2> aparecen en 32 de esos 40. Los ocho que no los tienen son
 * compendios y boletines (los trimestrales de la Cámara Federal de Mendoza,
 * los cuadernillos de la Corte IDH): son varios fallos en un artículo, así
 * que no hay UNA carátula que poner, ni un "Fallo completo" que enlazar —hay
 * quince PDF, uno por trimestre—. Esos igual se devuelven —son
 * jurisprudencia y es lo que alguien busca cuando busca un tema— con el
 * título del artículo en el lugar de la carátula y sin linkFallo: quedan con
 * "Ver ficha completa", que lleva al artículo donde están todos los enlaces.
 * Elegir uno de esos quince al azar sería peor que no ofrecer ninguno.
 */
function parsearItem(post, doc) {
  // El título viene con entidades HTML sin resolver ("Abreviado &#8211;
  // Daños"): se pasa por un nodo del mismo documento para que las resuelva
  // el parser en vez de escribir a mano una tabla de entidades.
  const titulo = textoDeHtml(doc, post.title?.rendered);

  const encabezados = Array.from(doc.querySelectorAll('h1, h2, h3, h4')).map((h) => ({
    nodo: h,
    texto: limpiar(h.textContent),
  }));
  const dato = (etiqueta) => encabezados.find((h) => new RegExp(`^${etiqueta}\\s*:`, 'i').test(h.texto));

  const hCaratula = dato('car[áa]tula');
  const hTribunal = dato('tribunal');
  const hFecha = dato('fecha');

  const caratulaDeclarada = hCaratula ? sinEtiqueta(hCaratula.texto) : '';

  // El enlace al texto completo lo rotula el propio artículo ("Fallo
  // completo"), así que no hay que adivinar cuál de los enlaces es: está
  // dicho. Aparece en los mismos 32 artículos que declaran carátula.
  let linkFallo = null;
  for (const a of doc.querySelectorAll('a[href]')) {
    if (!/fallo completo|sentencia completa|texto completo/i.test(limpiar(a.textContent))) continue;
    try {
      const url = new URL(a.getAttribute('href'), `https://${HOST}/`);
      // El destino es a veces un PDF del propio sitio
      // (mendozalegal.com/omeka/files/…) y a veces el visor de la Corte
      // (sjconsulta.csjn.gov.ar): los dos están habilitados. Pero también
      // hay enlaces a sitios de terceros y a acortadores (bit.ly), y ahí
      // "Traer texto completo" fallaría con DOMINIO_NO_PERMITIDO. Mismo
      // criterio que en lib/indiceDialnet.js: ofrecer un botón que va a
      // fallar es peor que no ofrecerlo — el enlace al artículo
      // (linkFicha) sigue estando para llegar igual, a mano.
      if (dominioHabilitado(url.hostname)) linkFallo = url.toString();
      break;
    } catch {
      break; // href que no es una URL válida; el artículo queda sin linkFallo
    }
  }

  // El cuerpo del resumen: todo lo que no es el encabezado de datos ni el
  // pie de la página. Se saca del DOM en vez de recortarlo del texto plano
  // porque los datos ya viajan en sus propios campos y repetirlos acá haría
  // que el pasaje en pantalla arranque diciendo la carátula que está justo
  // arriba, en negrita (el mismo problema que resuelve inicioDelCuerpo en
  // routes/indice.js).
  for (const h of encabezados) h.nodo.remove();
  for (const nodo of doc.querySelectorAll('img, figure, script, style')) nodo.remove();
  // El <hr> separa el artículo del pie fijo ("Encuentra más jurisprudencia
  // en Mendoza Legal–Repositorio"), que es igual en todos y no dice nada del
  // caso: contarlo como texto del fallo ensuciaría las búsquedas.
  const corte = doc.querySelector('hr');
  if (corte) {
    while (corte.nextSibling) corte.nextSibling.remove();
    corte.remove();
  }
  let cuerpo = limpiar(doc.body.textContent);
  if (cuerpo.length > MAX_SUMARIO) cuerpo = `${cuerpo.slice(0, MAX_SUMARIO).trimEnd()} …`;

  return {
    id: `mendozalegal_${post.id}`,
    caratula: caratulaDeclarada || titulo,
    // El título del artículo es la síntesis editorial ("La Corte anuló un
    // fallo por cobertura de medicamento importado"), no la carátula. Va
    // adelante del cuerpo y no en un campo aparte porque el filtro por modo
    // de lib/relevancia.js mira solo carátula, sumario, voces y expediente:
    // un título que no esté en ninguno de esos cuatro haría que una búsqueda
    // de frase exacta descarte justo el artículo que WordPress encontró POR
    // el título. Cuando no hay carátula declarada el título ya ocupa ese
    // lugar, y repetirlo acá sería decir dos veces lo mismo.
    sumario: caratulaDeclarada && titulo ? `${titulo}. ${cuerpo}` : cuerpo,
    voces: [],
    // No lo publican: la ficha trae carátula, tribunal y fecha, nunca el
    // número. Se deja vacío en vez de inventarlo — el verificador de citas
    // puntúa el expediente con 60 puntos justamente porque es un dato
    // exacto, y un campo aproximado ahí haría daño.
    expediente: '',
    fecha: hFecha ? sinEtiqueta(hFecha.texto) : '',
    tribunal: hTribunal ? sinEtiqueta(hTribunal.texto) : '',
    // Sin magistrados: la revista no los publica. En su lugar va la fecha en
    // que se publicó la nota, que no es la de la sentencia y conviene
    // distinguir — sobre todo en los compendios, donde no hay otra fecha.
    magistrados: post.date ? `Publicado en Mendoza Legal el ${fechaLegible(post.date)}` : '',
    linkFallo,
    linkFicha: post.link || null,
  };
}

/** "2026-08-07T14:39:26" -> "07/08/2026". Si no se entiende, se deja como vino. */
function fechaLegible(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

function parsearItems(posts) {
  const consolaMuda = new VirtualConsole();
  consolaMuda.on('jsdomError', () => {});

  const registros = [];
  for (const post of posts) {
    let dom;
    try {
      dom = new JSDOM(`<body>${post?.content?.rendered || ''}</body>`, { virtualConsole: consolaMuda });
    } catch {
      registros.push(null); // un artículo ilegible no arruina a los demás
      continue;
    }
    try {
      const r = parsearItem(post, dom.window.document);
      // Sin carátula ni título no hay nada que mostrar, pero el artículo
      // ocupó su lugar en la tanda: va como null, no se saltea.
      registros.push(r.caratula ? r : null);
    } finally {
      dom.window.close();
    }
  }
  // Una posición por artículo que mandó la API, con null donde no se pudo
  // leer: el cursor cuenta filas del SITIO. Ver lib/paginarFiltrado.js.
  return registros;
}

/**
 * Busca en la categoría "Jurisprudencia" de Mendoza Legal.
 *
 * @param {object} args
 * @param {string} args.q texto a buscar. WordPress lo busca en el título, el
 *   extracto y el cuerpo del artículo, exigiendo todas las palabras.
 * @param {string} [args.modo] "exacta" | "todas" | "alguna". "todas" lo hace
 *   el sitio; los otros dos se resuelven acá (ver lib/relevancia.js).
 */
export async function buscarMendozaLegal({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();

  const arranque = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);

  let total = 0;
  const traer = async (offset) => {
    const { posts, total: dice } = await pedirTanda({ q: termino, desde: offset, cuantos: ARTICULOS_POR_TANDA });
    if (!total) total = dice;
    return parsearItems(posts);
  };

  // La primera tanda hace falta igual: es la que trae el total.
  const primera = await traer(arranque);
  if (!total) return { total: 0, totalFuente: 0, siguienteDesde: null, pagina, porPagina, resultados: [] };

  const hayQueFiltrar = modo === 'exacta' || String(excluir || '').trim() || anioDesde || anioHasta;
  if (!hayQueFiltrar) {
    // Sin filtro, la tanda es más grande que la página: se muestra lo que
    // entra y el cursor avanza solo por lo mostrado.
    const resultados = primera.filter(Boolean).slice(0, porPagina);
    const hasta = arranque + Math.min(primera.length, porPagina);
    return {
      total,
      totalFuente: total,
      siguienteDesde: hasta < total ? hasta : null,
      pagina,
      porPagina,
      resultados,
    };
  }

  let primeraServida = false;
  const { resultados, revisados, siguienteDesde, aflojado } = await paginarFiltrado({
    traer: async (offset) => {
      if (!primeraServida && offset === arranque) { primeraServida = true; return primera; }
      return traer(offset);
    },
    desde: arranque, total: () => total, porPagina, q: termino, modo, excluir, anioDesde, anioHasta,
    maxTandas: MAX_TANDAS,
  });

  return {
    // Filtrando de este lado, el contador que vale es el de lo que de verdad
    // quedó, no el total crudo del sitio. Igual que Mendoza, SAIJ y Dialnet.
    total: resultados.length,
    totalFuente: total,
    // La fila exacta donde sigue la página siguiente. Ver lib/paginarFiltrado.js.
    siguienteDesde,
    // "Parcial" quiere decir que el número de arriba es un PISO: salió de
    // las filas que se alcanzaron a revisar, no de todas. Acá casi nunca se
    // enciende —la categoría entera son 177 artículos y una búsqueda rara
    // vez pasa de dos tandas— pero la regla es la misma que en las otras
    // tres, y así se lee igual en las seis fuentes.
    totalParcial: siguienteDesde !== null,
    revisados,
    aflojado,
    pagina,
    porPagina,
    resultados,
  };
}
