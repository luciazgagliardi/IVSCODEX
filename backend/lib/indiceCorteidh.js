/**
 * Cliente del buscador de jurisprudencia de la Corte Interamericana de
 * Derechos Humanos (corteidh.or.cr).
 *
 * La página arma los resultados con un POST AJAX a get_jurisprudencia_search.cfm
 * (se lee en js/juridprudencia-search.js): campos de texto plano, sin captcha ni
 * token. Medido en vivo:
 *
 *   - Devuelve TODOS los resultados juntos en un fragmento HTML (page_rows=3000
 *     es el valor que usa su propia página), un <li class="search-result"> por
 *     documento: tipo (Sentencia, Supervisión de cumplimiento, Opinión
 *     consultiva…), título completo con la fecha, el PDF y, en las sentencias,
 *     la "ficha técnica". Si no hay nada contesta el texto "-1".
 *   - La búsqueda es por FRASE, no por palabras sueltas: "propiedad comunitaria"
 *     da 19 y "comunitaria propiedad" da cero; las comillas se toman literales.
 *     Por eso "todas las palabras" y "alguna palabra" se arman acá: una consulta
 *     por palabra, y se intersectan o se unen los resultados.
 *   - El texto que muestra la coincidencia sale del PDF (que el servidor ya sabe
 *     leer: ver routes/indice.js, fragmentos). Una sentencia larga se extrae en
 *     menos de un segundo.
 *
 * Como el sitio devuelve todo junto, la paginación es de este lado.
 */

import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';
import { plegar, VACIAS } from './relevancia.js';
import { buscarEnCorpus } from './corpusCorteidh.js';

const HOST = 'www.corteidh.or.cr';
const URL_BUSQUEDA = `https://${HOST}/get_jurisprudencia_search.cfm`;
const MAX_PALABRAS = 4; // una consulta al sitio por palabra: se pone un tope

const MESES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
};

/** "…Resolución de la Corte… de 11 de septiembre de 2026." -> "11/09/2026" (la última fecha del título). */
function fechaDelTitulo(texto) {
  let ultima = '';
  for (const m of String(texto).matchAll(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/gi)) {
    const mes = MESES[plegar(m[2])];
    if (mes) ultima = `${m[1].padStart(2, '0')}/${mes}/${m[3]}`;
  }
  return ultima;
}

const https = (u) => String(u || '').replace(/^http:\/\//i, 'https://');

const ENTIDADES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  ordm: 'º', ordf: 'ª', iquest: '¿', iexcl: '¡', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
};
function texto(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTIDADES[e] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lee el fragmento HTML de resultados. Sin JSDOM a propósito: una lista de
 * cientos de filas son varios MB y armar el DOM entero consumía la poca memoria
 * libre del servidor publicado; el formato es regular y alcanza con recortar.
 */
function parsear(html) {
  const registros = [];
  const vistos = new Set();
  for (const bloque of String(html).split(/<li class="[^"]*search-result[^"]*">/).slice(1)) {
    const id = /tbl_multimedia_(\d+)/.exec(bloque)?.[1];
    if (!id || vistos.has(id)) continue;
    vistos.add(id);

    const tipoM = /<span class="title">([\s\S]*?)<\/span>/.exec(bloque);
    const tipo = texto(tipoM?.[1]);
    // El título del documento es el texto suelto entre el rótulo del tipo y el primer <br>.
    const despues = tipoM ? bloque.slice(tipoM.index + tipoM[0].length) : bloque;
    const titulo = texto(/^([\s\S]*?)<br/i.exec(despues)?.[1]);

    const pdf = /href="([^"]*\.pdf[^"]*)"/i.exec(bloque)?.[1] || '';
    const ficha = /ver_ficha_tecnica\.cfm\?nId_Ficha=(\d+)/.exec(bloque)?.[1] || '';
    const expediente = /nId_expediente=(\d+)/.exec(bloque)?.[1] || '';

    registros.push({
      id: `corteidh_${id}`,
      expediente: tipo,
      caratula: titulo || tipo || '(sin título)',
      tribunal: 'Corte IDH',
      fecha: fechaDelTitulo(titulo),
      sumario: '',
      voces: [],
      // La ficha técnica (sumilla, derechos violados) está sólo en las sentencias;
      // si no, la página del caso. Ambas son del sitio oficial.
      linkFicha: ficha
        ? `https://${HOST}/ver_ficha_tecnica.cfm?nId_Ficha=${ficha}&lang=es`
        : expediente
          ? `https://${HOST}/ver_expediente.cfm?nId_expediente=${expediente}&lang=es`
          : null,
      linkFallo: pdf ? https(new URL(pdf, `https://${HOST}/`).toString()) : null,
    });
  }
  return registros;
}

/**
 * Pide las primeras `filas` filas de una búsqueda. El sitio no pagina de verdad
 * (probado: ni startrow, ni page, ni start cambian nada) pero sí respeta
 * page_rows, así que la página N se arma pidiendo N×20 filas y recortando.
 * Devuelve también el total que declara el sitio.
 */
async function pedir(texto, filas = 20) {
  await esperarTurno(HOST);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(URL_BUSQUEDA, {
      method: 'POST',
      signal: control.signal,
      headers: {
        'User-Agent': `Mozilla/5.0 (compatible; ${USER_AGENT})`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://${HOST}/jurisprudencia-search.cfm?lang=es`,
        Accept: 'text/html, */*;q=0.8',
      },
      body: new URLSearchParams({
        Texto_busqueda_TXT: texto,
        Texto_busqueda_TXT2: '',
        search_param: 'name',
        page_rows: String(Math.max(1, Math.min(3000, filas))),
        lang: 'es',
        id: '0',
      }).toString(),
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('corteidh', `respuesta ${resp.status}`);
    const cuerpo = await resp.text();
    if (cuerpo.trim() === '-1' || !cuerpo.trim()) return { total: 0, registros: [] };
    const total = Number(/id="recordcount"[^>]*value="(\d+)"|value="(\d+)"[^>]*id="recordcount"/.exec(cuerpo)?.slice(1).find(Boolean)) || 0;
    const registros = filas <= 1 ? [] : parsear(cuerpo); // con filas=1 sólo interesa el total
    return { total: total || registros.length, registros };
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('corteidh', e?.cause?.code || e?.message);
  } finally {
    clearTimeout(reloj);
  }
}

/** Las palabras que definen la búsqueda, tal como se escribieron (con sus tildes). */
function palabrasDe(q) {
  return String(q || '')
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((p) => (/^\d+$/.test(p) || p.length >= 3) && !VACIAS.has(plegar(p)))
    .slice(0, MAX_PALABRAS);
}

// Tope de filas que se bajan por palabra al combinar palabras, y de la ventana
// cuando hay filtros que el sitio no sabe hacer (años, exclusión). Una palabra
// con más documentos que esto no discrimina (en la Corte IDH "derecho" está en
// casi 2.700): bajar su lista entera son 7 MB y más de 10 s, y no sirve para acotar.
const MAX_POR_PALABRA = 500;
const VENTANA_CON_FILTROS = 600;

const CACHE = new Map(); // clave -> { hasta, valor }
const VIDA_MS = 5 * 60_000;
const MAX_CACHE = 60;
function conCache(clave, hacer) {
  const g = CACHE.get(clave);
  if (g && g.hasta > Date.now()) return g.valor;
  const valor = hacer();
  if (CACHE.size >= MAX_CACHE) CACHE.clear();
  CACHE.set(clave, { hasta: Date.now() + VIDA_MS, valor });
  valor.catch(() => CACHE.delete(clave)); // un pedido fallido no se recuerda
  return valor;
}

/**
 * "todas las palabras" y "alguna palabra": el sitio sólo busca frases, así que
 * se cuentan los documentos de cada palabra (una consulta de una fila, rápida)
 * y se bajan las listas de las que discriminan. Devuelve { lista, parcial }.
 *
 *  - todas: se intersectan las listas de las (hasta dos) palabras más raras; las
 *    palabras muy comunes no se exigen, porque casi no acotan.
 *  - alguna: se unen las listas; si alguna palabra tiene más del tope sólo se
 *    traen sus MAX_POR_PALABRA más recientes y se avisa que es parcial.
 */
async function listaPorPalabras(palabras, modo, frase) {
  // En paralelo: la espera de cortesía (esperarTurno) escalona los pedidos, pero
  // las descargas se superponen, así que tarda lo de la más lenta y no la suma.
  const conteos = await Promise.all(palabras.map(async (p) => ({ p, n: (await pedir(p, 1)).total })));
  conteos.sort((a, b) => a.n - b.n);

  if (modo === 'alguna') {
    const con = conteos.filter((c) => c.n > 0);
    const listas = await Promise.all(con.map((c) => pedir(c.p, MAX_POR_PALABRA)));
    const vistos = new Set();
    const lista = [];
    for (const l of listas) for (const r of l.registros) if (!vistos.has(r.id)) { vistos.add(r.id); lista.push(r); }
    // por fecha, de la más reciente a la más vieja, como muestra el propio sitio
    const clave = (r) => r.fecha.split('/').reverse().join('');
    lista.sort((a, b) => clave(b).localeCompare(clave(a)));
    return { lista, parcial: con.some((c) => c.n > MAX_POR_PALABRA) };
  }

  // todas
  if (conteos.some((c) => c.n === 0)) return { lista: [], parcial: false };
  const selectivas = conteos.filter((c) => c.n <= MAX_POR_PALABRA).slice(0, 2);
  if (!selectivas.length) {
    // todas son muy comunes: lo único acotado es la frase entera
    const { registros, total } = await pedir(frase, MAX_POR_PALABRA);
    return { lista: registros, parcial: total > MAX_POR_PALABRA };
  }
  const listas = (await Promise.all(selectivas.map(({ p }) => pedir(p, MAX_POR_PALABRA)))).map((l) => l.registros);
  const comunes = listas.map((l) => new Set(l.map((r) => r.id))).reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
  return { lista: listas[0].filter((r) => comunes.has(r.id)), parcial: false };
}

const anioDe = (fecha) => Number(String(fecha || '').slice(-4)) || null;

/** Todos los documentos del sitio (para armar el índice de texto, ver lib/corpusCorteidh.js). */
export async function listarTodo() {
  return (await pedir('', 3000)).registros;
}

/**
 * Busca en la Corte IDH. Misma forma de entrada y de salida que los otros
 * clientes (ver lib/fuentes.js).
 *
 * Primero van los documentos donde lo buscado está EN EL TEXTO (índice propio,
 * con el pasaje ya recortado: lib/corpusCorteidh.js) y después lo que encuentra
 * el buscador del sitio, que sólo mira nombres y palabras clave, sin repetir.
 */
export async function buscarCorteidh(args) {
  const termino = String(args?.q || '').trim();
  if (!termino) throw errores.consultaVacia();
  const { modo = 'todas', pagina = 1, porPagina = 20, desde = null, excluir = '', anioDesde = null, anioHasta = null } = args;
  const arranque = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);

  // Exclusión y años se aplican antes de abrir textos (fecha y carátula ya están en el índice).
  const fuera = palabrasDe(excluir).map(plegar);
  const filtro = fuera.length || anioDesde || anioHasta
    ? (d) => {
        if (fuera.some((w) => plegar(d.titulo).includes(w))) return false;
        const a = anioDe(d.fecha);
        return !(anioDesde || anioHasta) || (a && (!anioDesde || a >= anioDesde) && (!anioHasta || a <= anioHasta));
      }
    : null;

  let corp = null;
  try {
    const claveFiltro = filtro ? `${fuera.join(' ')}|${anioDesde || ''}|${anioHasta || ''}` : '';
    corp = await buscarEnCorpus(termino, modo, { desde: arranque, cuantos: porPagina, filtro, claveFiltro });
  } catch {
    corp = null; // sin índice todavía, o un archivo ilegible: sigue el buscador del sitio
  }
  // Sin coincidencias en el texto (y sin nada por verificar), sólo el sitio. Si
  // la frase exacta todavía se está verificando, se sigue: las del texto pueden
  // aparecer en la página siguiente.
  if (!corp || (!corp.total && !corp.parcial)) return buscarEnSitio(args);

  const faltan = porPagina - corp.resultados.length;
  const desdeSitio = Math.max(0, arranque - corp.total);
  let delSitio = [], extraSitio = 0, parcial = corp.parcial;
  try {
    // Del sitio se pide desde el principio, con margen para descontar los que ya
    // salieron por el texto; si la página ya se llenó con el texto, sólo hace
    // falta su total.
    const cuantos = faltan > 0 ? desdeSitio + faltan + Math.min(corp.ids.size, 300) : 20;
    const s = await buscarEnSitio({ ...args, pagina: 1, desde: 0, porPagina: Math.min(3000, cuantos) });
    const nuevos = s.resultados.filter((r) => !corp.ids.has(r.id));
    extraSitio = Math.max(0, s.total - (s.resultados.length - nuevos.length));
    if (faltan > 0) delSitio = nuevos.slice(desdeSitio, desdeSitio + faltan);
    parcial = parcial || Boolean(s.totalParcial);
  } catch {
    // el sitio no respondió: quedan los del texto
  }
  const resultados = [...corp.resultados, ...delSitio];
  const total = corp.total + extraSitio;
  const hasta = arranque + resultados.length;
  return {
    total,
    totalFuente: total,
    totalParcial: parcial,
    siguienteDesde: hasta < total || corp.parcial ? hasta : null,
    pagina,
    porPagina,
    resultados,
  };
}

/** Exclusión y rango de años, que el sitio no sabe hacer: se aplican de este lado. */
function filtrosDe({ excluir = '', anioDesde = null, anioHasta = null }) {
  const fuera = palabrasDe(excluir).map(plegar);
  return (lista) =>
    lista
      .filter((r) => !fuera.some((w) => plegar(r.caratula).includes(w)))
      .filter((r) => {
        if (!anioDesde && !anioHasta) return true;
        const a = anioDe(r.fecha);
        return a && (!anioDesde || a >= anioDesde) && (!anioHasta || a <= anioHasta);
      });
}

/** Sólo el buscador del sitio. */
async function buscarEnSitio({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();

  const palabras = palabrasDe(termino);
  const fuera = palabrasDe(excluir).map(plegar);
  const conFiltros = Boolean(fuera.length || anioDesde || anioHasta);
  const arranque = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);
  const filtrar = filtrosDe({ excluir, anioDesde, anioHasta });

  let lista, totalSitio, parcial = false, ventana = false;
  if (modo === 'exacta' || palabras.length <= 1) {
    const texto = modo === 'exacta' ? termino : palabras[0] || termino;
    if (!conFiltros) {
      // camino rápido: sólo las filas que hacen falta para esta página
      const { total, registros } = await conCache(`v|${plegar(texto)}|${arranque + porPagina}`, () => pedir(texto, arranque + porPagina));
      const resultados = registros.slice(arranque, arranque + porPagina);
      const hasta = arranque + resultados.length;
      return { total, totalFuente: total, siguienteDesde: hasta < total ? hasta : null, pagina, porPagina, resultados };
    }
    const r = await conCache(`f|${plegar(texto)}`, () => pedir(texto, VENTANA_CON_FILTROS));
    lista = r.registros; totalSitio = r.total; ventana = r.total > VENTANA_CON_FILTROS; parcial = ventana;
  } else {
    const r = await conCache(`m|${modo}|${palabras.map(plegar).join(' ')}`, () => listaPorPalabras(palabras, modo, termino));
    lista = r.lista; totalSitio = lista.length; parcial = r.parcial;
  }

  lista = filtrar(lista);
  const resultados = lista.slice(arranque, arranque + porPagina);
  const hasta = arranque + resultados.length;
  return {
    total: lista.length,
    totalFuente: parcial ? totalSitio : lista.length,
    totalParcial: parcial,
    siguienteDesde: hasta < lista.length ? hasta : null,
    pagina,
    porPagina,
    resultados,
  };
}
