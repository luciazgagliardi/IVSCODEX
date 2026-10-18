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

import { JSDOM, VirtualConsole } from 'jsdom';
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';
import { plegar, VACIAS } from './relevancia.js';

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

function parsear(html) {
  const consola = new VirtualConsole();
  consola.on('jsdomError', () => {});
  let dom;
  try {
    dom = new JSDOM(`<body><ul>${html}</ul></body>`, { virtualConsole: consola });
  } catch {
    throw errores.indiceFuenteFalla('corteidh', 'no se pudo leer el HTML de resultados');
  }
  const registros = [];
  const vistos = new Set();
  for (const li of dom.window.document.querySelectorAll('li.search-result')) {
    const idMatch = /tbl_multimedia_(\d+)/.exec(li.innerHTML);
    const id = idMatch ? idMatch[1] : '';
    if (!id || vistos.has(id)) continue;
    vistos.add(id);

    const tipo = (li.querySelector('.title')?.textContent || '').replace(/\s+/g, ' ').trim();
    // El título del documento es el texto suelto del bloque, antes de la tabla de enlaces.
    const bloque = li.querySelector('div.col-12') || li;
    const copia = bloque.cloneNode(true);
    copia.querySelectorAll('.title, table, script').forEach((n) => n.remove());
    const titulo = copia.textContent.replace(/\s+/g, ' ').trim();

    const pdf = li.querySelector('a[href*=".pdf"]')?.getAttribute('href') || '';
    const ficha = li.querySelector('a.ver_ficha')?.getAttribute('id_row') || '';
    const expediente = /nId_expediente=(\d+)/.exec(li.innerHTML)?.[1] || '';

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

async function pedir(texto) {
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
        page_rows: '3000',
        lang: 'es',
        id: '0',
      }).toString(),
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('corteidh', `respuesta ${resp.status}`);
    const cuerpo = await resp.text();
    if (cuerpo.trim() === '-1' || !cuerpo.trim()) return [];
    return parsear(cuerpo);
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

// El sitio devuelve todo junto: para la página 2 no hace falta volver a preguntarle.
const CACHE = new Map(); // clave -> { hasta, lista }
const VIDA_MS = 5 * 60_000;
const MAX_CACHE = 50;

async function listaCompleta(q, modo) {
  const clave = `${modo}|${plegar(q)}`;
  const guardada = CACHE.get(clave);
  if (guardada && guardada.hasta > Date.now()) return guardada.lista;

  const palabras = palabrasDe(q);
  let lista;
  if (modo === 'exacta' || palabras.length <= 1) {
    lista = await pedir(palabras.length === 1 && modo !== 'exacta' ? palabras[0] : q.trim());
  } else {
    const porPalabra = [];
    for (const p of palabras) porPalabra.push(await pedir(p)); // de a una: esperarTurno ya espacia los pedidos
    if (modo === 'alguna') {
      const vistos = new Set();
      lista = porPalabra.flat().filter((r) => !vistos.has(r.id) && vistos.add(r.id));
    } else {
      // todas: lo que aparece en la búsqueda de cada una de las palabras
      const comunes = porPalabra.map((l) => new Set(l.map((r) => r.id))).reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
      lista = porPalabra[0].filter((r) => comunes.has(r.id));
    }
  }
  if (CACHE.size >= MAX_CACHE) CACHE.clear();
  CACHE.set(clave, { hasta: Date.now() + VIDA_MS, lista });
  return lista;
}

const anioDe = (fecha) => Number(String(fecha || '').slice(-4)) || null;

/**
 * Busca en la Corte IDH. Misma forma de entrada y de salida que los otros
 * clientes (ver lib/fuentes.js).
 */
export async function buscarCorteidh({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();

  let lista = await listaCompleta(termino, modo);

  const fuera = palabrasDe(excluir).map(plegar);
  if (fuera.length) lista = lista.filter((r) => !fuera.some((w) => plegar(r.caratula).includes(w)));
  if (anioDesde || anioHasta) {
    lista = lista.filter((r) => {
      const a = anioDe(r.fecha);
      return a && (!anioDesde || a >= anioDesde) && (!anioHasta || a <= anioHasta);
    });
  }

  const arranque = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);
  const resultados = lista.slice(arranque, arranque + porPagina);
  const hasta = arranque + resultados.length;
  return {
    total: lista.length,
    totalFuente: lista.length,
    siguienteDesde: hasta < lista.length ? hasta : null,
    pagina,
    porPagina,
    resultados,
  };
}
