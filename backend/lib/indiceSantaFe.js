/**
 * Cliente del Sistema de Consulta de Jurisprudencia de la Corte Suprema de
 * Justicia de la Provincia de Santa Fe (portal.justiciasantafe.gov.ar/bdj).
 *
 * Medido en vivo: la búsqueda de sumarios es un POST simple a su
 * funciones_ajax.php, sin sesión ni captcha. «despido» da 864 sumarios; cada
 * uno trae la materia, las voces del tesauro, el título, el TEXTO del sumario
 * y la carátula con la fecha y la cita (resolución/año). La carátula lleva a la
 * página del fallo, con la sentencia COMPLETA en HTML: se abre en el Lector.
 * Pagina de a 30 («inicio» es la fila). La frase exacta, entre comillas.
 */

import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';
import { paginarFiltrado } from './paginarFiltrado.js';
import { urlParaPedir, sinClave } from './proxyOrigen.js';

const HOST = 'portal.justiciasantafe.gov.ar';
const URL_AJAX = `https://${HOST}/bdj/modulos/busqueda/ajax/funciones_ajax.php`;
const POR_PAGINA_SITIO = 30;
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

const decodificar = (t) => String(t || '').replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);?/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', deg: '°', ordm: 'º' }[e] ?? m;
});
const texto = (h) => decodificar(String(h || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim();

async function pedir(q, inicio) {
  await esperarTurno(HOST);
  const cuerpo = new URLSearchParams({ x: 'default', ax: 'fun_resultado_buscador', m: 'busqueda', mo: 'busquedaModel', a: 'buscador_sumarios', palabra_tsquery: q,
    // sin btn_buscar_sum=1 el sitio ignora «inicio» y devuelve siempre la primera página
    btn_buscar_sum: inicio > 0 ? '1' : '0', inicio: String(inicio) });
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    // por el proxy, si está configurado: Santa Fe no le contesta al datacenter publicado (ver lib/proxyOrigen.js)
    const r = await fetch(urlParaPedir(URL_AJAX, HOST), {
      method: 'POST', signal: control.signal, body: cuerpo.toString(),
      headers: { 'User-Agent': `Mozilla/5.0 (compatible; ${USER_AGENT})`, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Referer: `https://${HOST}/bdj/index.php` },
    });
    if (!r.ok) throw errores.indiceFuenteFalla('santafe', `respuesta ${r.status}`);
    return await r.text();
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('santafe', sinClave(e?.cause?.code || e?.message));
  } finally {
    clearTimeout(reloj);
  }
}

/** «Su búsqueda arrojo "864" resultados». */
export function totalDe(html) {
  const m = /arrojo\s*"?\s*([\d.]+)\s*"?\s*resultados?/i.exec(decodificar(html));
  return m ? parseInt(m[1].replace(/\./g, ''), 10) || 0 : 0;
}

/** «14-oct-2026» → «14/10/2026». */
function fechaDe(s) {
  const m = /(\d{1,2})-([a-záéíóú]{3})[a-z]*-(\d{4})/i.exec(s || '');
  return m && MESES[m[2].toLowerCase()] ? `${m[1].padStart(2, '0')}/${String(MESES[m[2].toLowerCase()]).padStart(2, '0')}/${m[3]}` : '';
}

export function parsear(html) {
  const out = [];
  const bloques = String(html).split(/<div id='div_sum_/).slice(1);
  for (const b of bloques) {
    const id = /^(\d+)/.exec(b)?.[1];
    if (!id) continue;
    const voces = [...b.matchAll(/Tesauro\s*(?:>|&gt;)\s*<\/span><span>([\s\S]*?)<\/span>/g)].map((m) => texto(m[1]).split(/\s*>\s*/).pop()).filter(Boolean);
    const cuerpo = texto(new RegExp(`<div id='p_${id}'>([\\s\\S]*?)</div>`).exec(b)?.[1] || '');
    const enlace = /<p class='caratulas'[^>]*>\s*<a[^>]*href='([^']+)'[^>]*>([\s\S]*?)<\/a>/.exec(b);
    const linea = texto(enlace?.[2] || '');
    const [car, resto = ''] = linea.split(/\s*\/\/\/\s*/);
    const partes = resto.split(/\s*;\s*/);
    out.push({
      id: `santafe_${id}`,
      caratula: car || '(sin carátula)',
      tribunal: 'Corte Suprema de Justicia de Santa Fe',
      fecha: fechaDe(partes[1] || resto),
      expediente: partes[3] ? `Resolución ${partes[3]}` : '',
      sumario: cuerpo.replace(/\s*-\s*REFERENCIAS NORMATIVAS:.*$/i, '').trim(),
      voces: [...new Set(voces)],
      magistrados: '',
      linkFicha: enlace ? decodificar(enlace[1]) : null,
      linkFallo: enlace ? decodificar(enlace[1]) : null,
    });
  }
  return out;
}

/**
 * Busca en Santa Fe. Misma forma de entrada y salida que los otros clientes
 * (ver lib/fuentes.js). El sitio busca todas las palabras; la frase exacta
 * va entre comillas; el rango de años y lo excluido se filtran de este lado.
 */
export async function buscarSantaFe({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 30, desde = null, anioDesde = null, anioHasta = null }) {
  const termino = String(q || '').trim().replace(/"/g, '');
  if (!termino) throw errores.consultaVacia();
  const consulta = modo === 'exacta' ? `"${termino}"` : termino;
  const arranque = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);
  let total = 0;
  const traer = async (offset) => {
    const base = Math.floor(offset / POR_PAGINA_SITIO) * POR_PAGINA_SITIO;
    const html = await pedir(consulta, base);
    if (!total) total = totalDe(html);
    if (!total || base >= total) return [];
    return parsear(html).slice(offset - base);
  };
  const salida = await paginarFiltrado({ traer, desde: arranque, total: () => total, porPagina, q: '', modo: 'alguna', excluir, anioDesde, anioHasta, maxTandas: 3 });
  const filtro = Boolean(excluir || anioDesde || anioHasta);
  return {
    total: filtro ? salida.resultados.length : total, totalFuente: total,
    siguienteDesde: salida.siguienteDesde, totalParcial: filtro && salida.siguienteDesde !== null,
    revisados: filtro ? salida.revisados : 0, aflojado: false, pagina, porPagina, resultados: salida.resultados,
  };
}
