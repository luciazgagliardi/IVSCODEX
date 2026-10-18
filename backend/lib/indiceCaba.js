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
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { urlParaPedir, sinClave } from './proxyOrigen.js';
import { errores } from './errores.js';
import { paginarFiltrado } from './paginarFiltrado.js';

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

  // Si este host le niega la conexión al datacenter publicado, el pedido se
  // envuelve para pasar por ScraperAPI en vez de ir directo (ver
  // lib/proxyOrigen.js). Sin key configurada esto no hace nada y va
  // directo, como siempre.
  const url = urlParaPedir(URL_BUSQUEDA, HOST);
  const porProxy = url !== URL_BUSQUEDA;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      signal: control.signal,
      headers: {
        'User-Agent': USER_AGENT,
        // ScraperAPI devuelve 415 si el Content-Type trae un "charset" que
        // no reconoce; el sitio de destino no lo necesita para nada (decide
        // la codificación por los bytes que le llegan, no por este header),
        // así que yendo por ahí se manda sin ese parámetro.
        'Content-Type': porProxy
          ? 'application/x-www-form-urlencoded'
          : 'application/x-www-form-urlencoded; charset=windows-1252',
        Accept: 'text/html, */*;q=0.8',
      },
      body: cuerpoWin1252(parametros),
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('caba', `respuesta ${resp.status}`);
    // Yendo directo la respuesta viene en windows-1252 —decodificarla como
    // UTF-8 (lo que hace resp.text() a ciegas) es lo que dejaba "ACCIÓN"
    // como "ACCI�N" en las carátulas—. Por ScraperAPI, en cambio, ya llega
    // en UTF-8: normaliza la codificación de este lado.
    if (porProxy) return await resp.text();
    const buffer = Buffer.from(await resp.arrayBuffer());
    return decodificarWin1252(buffer);
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e; // ya es un ErrorApp
    // fetch() envuelve el error real en uno generico ("fetch failed"); el
    // motivo de verdad (DNS, conexion rechazada, TLS, auth del proxy...)
    // vive en .cause. Sin esto, cualquier falla de red se ve identica.
    throw errores.indiceFuenteFalla('caba', sinClave(e?.cause?.message || e?.cause?.code || e?.message));
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

/**
 * Algunas carátulas del TSJ están guardadas en su base ya mal codificadas
 * (UTF-8 leído como windows-1252 y vuelto a guardar): "N°" queda "NÂ°" y
 * "PREVENCIÓN" queda "PREVENCIÃ“N". No es algo de este cliente: llega así
 * del sitio. Como "Ã" y "Â" no existen en castellano jurídico, cada par que
 * empieza con una de ellas se reinterpreta y se deja el resto del texto como
 * está; lo que no se pueda desarmar queda igual.
 */
const CONTINUACION =
  '[\\u0022\\u0027\\u0080-\\u00BF\\u0152\\u0153\\u0160\\u0161\\u0178\\u017D\\u017E\\u0192\\u02C6\\u02DC\\u2013\\u2014\\u2018-\\u201E\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203A\\u20AC\\u2122]';
const PAR_ROTO = new RegExp(`[\u00C2\u00C3]${CONTINUACION}`, 'g');
const UTF8_ESTRICTO = new TextDecoder('utf-8', { fatal: true });
/** El byte que originó cada carácter: tal cual hasta 0xFF, por la tabla de windows-1252 más allá. */
const aBytes = (par) =>
  Buffer.from([...par].map((c) => {
    // El sitio a veces aplana las comillas curvas a rectas: "Ó" (C3 93) llega
    // como Ã" y "Ñ" (C3 91) como Ã'.
    if (c === '"') return 0x93;
    if (c === "'") return 0x91;
    const n = c.codePointAt(0);
    return n < 0x100 ? n : iconv.encode(c, 'win1252')[0];
  }));
export function arreglarCodificacion(texto) {
  return String(texto ?? '').replace(PAR_ROTO, (par) => {
    try {
      return UTF8_ESTRICTO.decode(aBytes(par));
    } catch {
      return par;
    }
  });
}

/**
 * windows-1252 dejando pasar los cinco bytes que esa tabla no define (0x81,
 * 0x8D, 0x8F, 0x90 y 0x9D). iconv-lite los convierte en "�" y ahí se pierde
 * qué letra era: en una carátula mal codificada, "Á" e "Í" son justamente
 * esos bytes (C3 81 y C3 8D). Pasan como el carácter de control del mismo
 * número, que es lo que arreglarCodificacion sabe volver a armar.
 */
const TABLA_C1 = (() => {
  const t = {};
  for (let b = 0x80; b <= 0x9f; b++) {
    const c = iconv.decode(Buffer.from([b]), 'win1252');
    if (c !== '\uFFFD') t[String.fromCharCode(b)] = c;
  }
  return t;
})();
const decodificarWin1252 = (buffer) =>
  buffer.toString('latin1').replace(/[\u0080-\u009F]/g, (c) => TABLA_C1[c] ?? c);

function parsearFilas(html) {
  const consolaMuda = new VirtualConsole();
  consolaMuda.on('jsdomError', () => {});

  let dom;
  try {
    dom = new JSDOM(`<body>${html}</body>`, { virtualConsole: consolaMuda });
  } catch {
    throw errores.indiceFuenteFalla('caba', 'no se pudo leer el HTML de resultados');
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
    const texto = (i) => arreglarCodificacion((celdas[i]?.textContent || '').trim());

    // Debajo de cada fila el sitio agrega otra con los «Tesauro asociados»:
    // los temas con que el propio tribunal clasifica el fallo (por ejemplo
    // «INDEMNIZACION POR INCAPACIDAD», «INDICE RIPTE»). Es lo más parecido a
    // un sumario que publica la búsqueda, y viene en la misma respuesta, así
    // que sirve aunque el PDF no se pueda bajar desde el servidor.
    const voces = [];
    for (let sig = fila?.nextElementSibling; sig; sig = sig.nextElementSibling) {
      if (sig.querySelector('a[onclick^="downloadPDF"]:not(.linkExpOcultar)')) break;
      sig.querySelectorAll('a[onclick^="busqPorTerminoTesauro"]').forEach((t) => {
        const v = arreglarCodificacion((t.textContent || '').replace(/\s+/g, ' ').trim());
        if (v && !voces.includes(v)) voces.push(v);
      });
    }

    registros.push({
      id,
      expediente: texto(1),
      caratula: texto(2),
      secretaria: texto(3),
      fecha: texto(4),
      voces,
      linkFallo: urlPdf(origen, expediente, incidente, movimiento, anio),
      linkFicha: null, // acá el documento y la ficha son la misma cosa: el PDF
      // Este endpoint manda "Content-Disposition: attachment" (verificado en
      // vivo contra los dos, expedientes_download.php y
      // expedientes_download_EJE.php — el primero a veces sirve un .doc en
      // vez de un PDF, pero con la misma cabecera): el navegador SIEMPRE lo
      // descarga,
      // nunca lo muestra en la pestaña. Se lo dice al frontend para que
      // ofrezca el atajo "Descargar y abrir en el Lector" — que abre
      // directo el selector de archivo, listo para elegir lo que se acaba
      // de bajar — en vez del link genérico "Abrir el original", que en las
      // otras fuentes navega a la página del fallo pero acá no navegaría a
      // nada visible: el archivo cae solo a Descargas sin abrir pestaña, y
      // sin este aviso parecía que el botón no hacía nada.
      descarga: true,
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
    return 'su servidor devolvió un error interno al listar los resultados. Pruebe de nuevo en un rato.';
  }
  return null;
}

export async function buscarCaba({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();

  // CABA resuelve los tres modos y la exclusión en su propio formulario, así
  // que mientras no haya rango de años acá no se filtra nada y su paginación
  // YA es la de los resultados: la fila del cursor y el número de página son
  // el mismo dato visto de dos maneras. Se acepta el cursor igual para que
  // las seis fuentes hablen el mismo idioma (ver lib/paginarFiltrado.js).
  const arranque = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);

  const campo = CAMPO_POR_MODO[modo] || CAMPO_POR_MODO.todas;
  const base = {
    [campo]: termino,
    // El sitio también sabe excluir por su cuenta, así que no hace falta
    // filtrar después: se le pasa tal cual lo que se escribió en "Excluir".
    ...(String(excluir || '').trim() ? { textoLibreExcluyendo: String(excluir).trim() } : {}),
    hdnPaginaOrigen: 'busqueda.asp',
    cantRegPagina: String(porPagina),
  };

  /**
   * Una tanda de filas que empiece en `offset`.
   *
   * Su formulario pagina por número de página con tamaño fijo, así que el
   * offset se traduce a página y se recortan las filas sobrantes de adelante
   * — igual que en lib/indiceMza.js. Devuelve también el total del sitio, que
   * viene en el mismo HTML.
   */
  let totalSitio = null;
  const traerDesde = async (offset) => {
    const parametros = { ...base, pag: String(Math.floor(offset / porPagina) + 1) };
    const sobran = offset % porPagina;

    // Es un servidor viejo que trunca la respuesta cada tanto sin motivo. Un
    // reintento cubre ese caso; si vuelve a fallar es que está caído de verdad,
    // y ahí no se insiste más: esperarTurno ya deja una pausa entre los dos.
    let html = await pedirBusqueda(parametros);
    let total = sacarTotal(html);
    let filas = total ? parsearFilas(html) : [];
    if (total && !filas.length) {
      html = await pedirBusqueda(parametros);
      total = sacarTotal(html);
      filas = total ? parsearFilas(html) : [];
    }
    if (total === null) throw errores.indiceFuenteFalla('caba', 'no se encontró el contador de resultados');
    if (total && !filas.length) {
      // Dice que hay resultados pero no vino ninguno: pasa cuando su servidor
      // corta la respuesta o se le cae la base. Mejor avisar qué pasó que
      // devolver una lista vacía como si la búsqueda no hubiera encontrado nada.
      throw errores.indiceFuenteFalla('caba', errorDelSitio(html) || 'cortó la respuesta antes de listar los resultados, pruebe de nuevo');
    }
    if (totalSitio === null) totalSitio = total;
    return filas.slice(sobran);
  };

  // Con rango de años el sitio ya no alcanza —su formulario no lo acepta— y
  // CABA pasa a comportarse como las otras cinco: se recorren filas y se
  // filtra acá, con el mismo cursor que evita pisar resultados entre páginas.
  if (anioDesde || anioHasta) {
    const salida = await paginarFiltrado({
      traer: traerDesde,
      desde: arranque,
      total: () => totalSitio || 0,
      porPagina,
      q: termino,
      // El modo ya lo aplicó el sitio al elegir el campo del formulario:
      // volver a exigirlo acá descartaría de más. Lo único que se filtra de
      // este lado es el año.
      modo: 'alguna',
      excluir: '',
      anioDesde,
      anioHasta,
      // Cinco tandas de veinte = cien filas por página de resultados. Es
      // poco para un rango de años angosto, y se nota: este sitio ordena por
      // fecha descendente, así que pedir "2020 a 2022" sobre una consulta con
      // cientos de resultados recientes puede devolver cero en la primera
      // página y obligar a pasar varias. Sube mal: probado contra el sitio,
      // cantRegPagina=100 y 200 lo hacen expirar (25s sin responder), así
      // que veinte por pedido es su techo real. La app no lo esconde —
      // devuelve totalParcial y el panel dice cuántas filas se revisaron.
      maxTandas: 5,
    });
    if (!totalSitio) return { total: 0, totalFuente: 0, siguienteDesde: null, pagina, porPagina, resultados: [] };
    return {
      total: salida.resultados.length,
      totalFuente: totalSitio,
      siguienteDesde: salida.siguienteDesde,
      totalParcial: salida.siguienteDesde !== null,
      revisados: salida.revisados,
      aflojado: salida.aflojado,
      pagina,
      porPagina,
      resultados: salida.resultados,
    };
  }

  const resultados = await traerDesde(arranque);
  if (!totalSitio) return { total: 0, totalFuente: 0, siguienteDesde: null, pagina, porPagina, resultados: [] };

  // Su contador ES el total: totalFuente y total coinciden siempre.
  const hasta = arranque + resultados.length;
  return {
    total: totalSitio,
    totalFuente: totalSitio,
    siguienteDesde: hasta < totalSitio ? hasta : null,
    pagina,
    porPagina,
    resultados,
  };
}
