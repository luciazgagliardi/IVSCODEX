/**
 * Cliente del buscador de jurisprudencia del TSJ de la Ciudad de Buenos Aires.
 *
 * Sistema viejo (IIS 6, sin HTTPS) pero simple: un único POST a
 * resultadoBusqueda.asp con campos de texto plano, sin sesión obligatoria
 * ni token. Confirmado en vivo antes de escribir este archivo:
 *
 *   - "acto administrativo" -> 827 resultados reales, filas con expediente,
 *     carátula, secretaría y un link a PDF por sentencia.
 *   - Cubre las secretarías de esa jurisdicción: Contencioso Administrativo
 *     y Tributario, Penal/Contravencional, Civil y Comercial, Laboral,
 *     Asuntos Originarios. No es un juzgado civil "general" como Mendoza,
 *     así que la mezcla de temas que aparece es distinta a la de un fuero
 *     civil de primera instancia — pero cubre más de lo que parece: ver la
 *     nota de windows-1252 más abajo, que tapaba justo los términos con
 *     acento (como "daño").
 *
 * Particularidad a tener en cuenta: es un servidor viejo y a veces corta la
 * respuesta a mitad de camino en consultas con muchos resultados (esto pasó
 * en las pruebas, no es un caso hipotético). Por eso se valida la forma de
 * la respuesta antes de darla por buena, y se deja reintentar con un error
 * tipado en vez de devolver una lista vacía como si fuera un resultado real.
 *
 * A diferencia de Mendoza, ACÁ NO HAY filtro por secretaría del lado del
 * servidor: el formulario real tiene checkboxes (chkSAO, chkSACAYT, chkSAC,
 * chkSACyC, chkSAL, chkSAG, chkTSN) pero probado a mano —reproduciendo el
 * POST exacto, con y sin el resto de los campos ocultos— el ASP los ignora
 * por completo: "despido" da 454 resultados marcando cualquier checkbox o
 * ninguno. No es un bug de este cliente, es una limitación real del sitio.
 * Cada resultado SÍ trae su secretaría (campo "secretaria", ej. "SAL"), así
 * que el filtro por secretaría en el frontend es del lado del cliente, sobre
 * lo que ya se trajo — no re-consulta al sitio.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import iconv from 'iconv-lite';
import { SCRAPER_API_KEY, USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';

const HOST = 'jurisprudencia.tsjbaires.gob.ar';
// Este servidor no habla HTTPS (IIS 6, año ~2003): es a propósito que sea http.
const URL_BUSQUEDA = `http://${HOST}/jurisprudencia/resultadoBusqueda.asp`;

/**
 * Este sitio habla windows-1252, no UTF-8 — ni para lo que le mandamos ni
 * para lo que devuelve. Mandarle "daño" en UTF-8 no tira error: el ASP
 * simplemente no lo matchea contra nada y da 0 resultados en silencio, como
 * si esa palabra no existiera en toda la base. Confirmado a mano contra el
 * sitio real: "daño moral" con acento en UTF-8 -> 0; el mismo texto
 * codificado en windows-1252 -> cientos de resultados reales. Por eso el
 * cuerpo del POST se arma byte a byte acá, no con URLSearchParams (que
 * siempre codifica en UTF-8 y no tiene forma de cambiarlo).
 */
function cuerpoWin1252(parametros) {
  return Object.entries(parametros)
    .map(([clave, valor]) => {
      const bytes = iconv.encode(String(valor ?? ''), 'win1252');
      let codificado = '';
      for (const b of bytes) {
        const c = String.fromCharCode(b);
        codificado += /[A-Za-z0-9\-_.!~*'()]/.test(c) ? c : '%' + b.toString(16).padStart(2, '0').toUpperCase();
      }
      return `${encodeURIComponent(clave)}=${codificado}`;
    })
    .join('&');
}

async function pedirBusqueda(parametros) {
  await esperarTurno(HOST);

  // Armo la URL de ScraperAPI con la URL destino
  const urlDestino = encodeURIComponent(URL_BUSQUEDA);
  const proxyUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${urlDestino}&country_code=ar&render=false`;

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  
  try {
    // Ahora hago el POST a ScraperAPI, no directo al TSJBA
    const resp = await fetch(proxyUrl, {
      method: 'POST',  // ScraperAPI reenvía tu POST al sitio destino
      signal: control.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1252',
        Accept: 'text/html, */*;q=0.8',
      },
      body: cuerpoWin1252(parametros),
    });
    
    if (!resp.ok) throw errores.indiceFuenteFalla('caba', `respuesta ${resp.status}`);
    
    const buffer = Buffer.from(await resp.arrayBuffer());
    return iconv.decode(buffer, 'win1252');
    
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('caba', e?.message);
  } finally {
    clearTimeout(reloj);
  }
}

/** Saca el total de "RS.RecordCount:<n>" que deja el ASP como comentario HTML. */
function sacarTotal(html) {
  const m = /RS\.RecordCount:(\d+)/.exec(html);
  return m ? parseInt(m[1], 10) : null;
}

/** Arma la URL real del PDF a partir de los parámetros del onclick="downloadPDF(...)". */
function urlPdf(origen, expediente, incidente, movimiento, anio) {
  const base =
    origen === 'EJE'
      ? 'https://www.tsjbaires.gov.ar/components/com_expedientes/expedientes_download_EJE.php'
      : 'https://www.tsjbaires.gov.ar/components/com_expedientes/expedientes_download.php';
  const p = new URLSearchParams({ expediente, anio, incidente, movimiento });
  return `${base}?${p.toString()}`;
}

function parsearFilas(html) {
  const consolaMuda = new VirtualConsole();
  consolaMuda.on('jsdomError', () => {});

  let dom;
  try {
    dom = new JSDOM(`<body>${html}</body>`, { virtualConsole: consolaMuda });
  } catch {
    throw errores.indiceFuenteFalla('caba', 'no pude leer el HTML de resultados');
  }
  const doc = dom.window.document;

  // Cada resultado real trae DOS <a onclick="downloadPDF(...)">: el ícono de
  // PDF en la fila con los datos (carátula, secretaría, fecha) y, más abajo,
  // un link "texto completo" (clase linkExpOcultar) para ver resaltadas las
  // coincidencias, en una fila propia sin esas celdas. Apuntan al mismo
  // documento, pero antes de excluir el segundo, el selector los traía a los
  // dos: cada fallo aparecía duplicado, con una segunda ficha en blanco (sin
  // carátula, sin nada) al lado de la real. Excluir .linkExpOcultar se queda
  // solo con el link de la fila con datos.
  const registros = [];
  const vistos = new Set();
  doc.querySelectorAll('a[onclick^="downloadPDF"]:not(.linkExpOcultar)').forEach((a) => {
    const m = /downloadPDF\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/.exec(
      a.getAttribute('onclick') || ''
    );
    if (!m) return;
    const [, origen, expediente, incidente, movimiento, anio] = m;

    const id = `caba_${expediente}_${incidente}_${movimiento}_${anio}`;
    if (vistos.has(id)) return; // por si el sitio repite igual la fila con datos
    vistos.add(id);

    const fila = a.closest('tr');
    const celdas = fila ? fila.querySelectorAll('td') : [];
    const texto = (i) => (celdas[i]?.textContent || '').trim();

    registros.push({
      id,
      expediente: texto(1),
      caratula: texto(2),
      secretaria: texto(3),
      fecha: texto(4),
      linkFallo: urlPdf(origen, expediente, incidente, movimiento, anio),
      linkFicha: null, // acá el documento y la ficha son la misma cosa: el PDF
    });
  });

  return registros;
}

/**
 * De los tres buscadores, este es el único que hace los tres modos por sí
 * mismo: el formulario tiene un campo distinto para cada uno y los tres
 * responden bien. Comprobado contra el sitio: "daño moral" da 356 como
 * frase exacta, 438 con todas las palabras y 1000 con algunas.
 */
const CAMPO_POR_MODO = {
  exacta: 'textoLibreFrase',
  todas: 'textoLibreTodas',
  alguna: 'textoLibreAlgunas',
};

/**
 * Busca en el buscador del TSJ CABA.
 *
 * No marca ninguna Secretaría: eso hace que busque en todas las bases, tal
 * como indica el propio formulario del sitio.
 */
/**
 * El propio sitio a veces devuelve 200 con su error pegado al final del HTML,
 * en vez de un codigo de error. Visto en vivo:
 *
 *   <!-- RS.RecordCount:438 -->[MySQL][ODBC 3.51 Driver]Lost connection to
 *   MySQL server at 'reading initial communication packet'...
 *
 * O sea: contesta el contador (que sale de otra consulta) pero se le cae la
 * base al ir a listar las filas. Detectarlo sirve para decir qué pasó de
 * verdad, en vez de "cortó la respuesta" a secas — que sonaba a problema de
 * red nuestro cuando en realidad su base de datos está caída.
 */
function errorDelSitio(html) {
  const cola = String(html || '').slice(-1200);
  if (/Lost connection to MySQL|\[MySQL\]\[ODBC/i.test(cola)) {
    return 'la base de datos del TSJ está caída en este momento (su propio servidor lo informa así). No es algo que podamos arreglar de este lado: hay que esperar a que la repongan.';
  }
  if (/An error occurred on the server when processing the URL/i.test(cola)) {
    return 'su servidor devolvió un error interno al listar los resultados. Probá de nuevo en un rato.';
  }
  return null;
}

export async function buscarCaba({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20 }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();

  const campo = CAMPO_POR_MODO[modo] || CAMPO_POR_MODO.todas;
  const parametros = {
    [campo]: termino,
    // El sitio también sabe excluir por su cuenta, así que no hace falta
    // filtrar después: se le pasa tal cual lo que se escribió en "Excluir".
    ...(String(excluir || '').trim() ? { textoLibreExcluyendo: String(excluir).trim() } : {}),
    hdnPaginaOrigen: 'busqueda.asp',
    pag: String(pagina),
    cantRegPagina: String(porPagina),
  };

  // Es un servidor viejo que trunca la respuesta cada tanto sin motivo. Un
  // reintento cubre ese caso; si vuelve a fallar es que está caído de verdad,
  // y ahí no se insiste más: esperarTurno ya deja una pausa entre los dos.
  let html = await pedirBusqueda(parametros);
  let total = sacarTotal(html);
  let resultados = total ? parsearFilas(html) : [];
  if (total && !resultados.length) {
    html = await pedirBusqueda(parametros);
    total = sacarTotal(html);
    resultados = total ? parsearFilas(html) : [];
  }

  if (total === null) throw errores.indiceFuenteFalla('caba', 'no encontré el contador de resultados');
  if (total === 0) return { total: 0, pagina, porPagina, resultados: [] };

  // Dice que hay resultados pero no vino ninguno: pasa cuando su servidor
  // corta la respuesta o se le cae la base. Mejor avisar qué pasó que
  // devolver una lista vacía como si la búsqueda no hubiera encontrado nada.
  if (!resultados.length) {
    throw errores.indiceFuenteFalla('caba', errorDelSitio(html) || 'cortó la respuesta antes de listar los resultados, probá de nuevo');
  }

  return { total, pagina, porPagina, resultados };
}