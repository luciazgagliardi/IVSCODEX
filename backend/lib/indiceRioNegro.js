/**
 * Cliente del buscador de fallos del Poder Judicial de Río Negro
 * («Protocolo web», fallos.jusrionegro.gov.ar/protocoloweb).
 *
 * Medido en vivo: es un GET simple (Yii), sin sesión ni captcha, que busca en
 * el TEXTO de las sentencias. Cada resultado trae la carátula, la sentencia
 * (número, fecha y tipo), el organismo, los fragmentos del fallo donde aparece
 * lo buscado (marcados por el propio sitio) y el PDF completo, que tiene capa
 * de texto: se abre en el Lector sin descargar nada a mano. «despido» da 1.205
 * fallos del Superior Tribunal y 8.544 de cámaras y juzgados. Pagina de a 10.
 *
 * Tribunales: «STJ» (stj=1) y «Cámaras y juzgados» (stj=0).
 * Modos: 0 = todas las palabras, 1 = alguna, 2 = frase completa.
 */

import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';
import { paginarFiltrado } from './paginarFiltrado.js';
import { urlParaPedir, sinClave } from './proxyOrigen.js';

const HOST = 'fallos.jusrionegro.gov.ar';
const BASE = `https://${HOST}/protocoloweb`;
const POR_PAGINA_SITIO = 10;
const MODOS = { todas: '0', alguna: '1', exacta: '2' };

const decodificar = (t) => String(t || '').replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü' }[e] ?? m;
});
const texto = (h) => decodificar(String(h || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim();

async function pedir(q, modo, stj, pagina) {
  await esperarTurno(HOST);
  const p = new URLSearchParams({
    'Datos[FilterProtocolo][texto]': q,
    'Datos[FilterProtocolo][option_text]': MODOS[modo] || '0',
    'Datos[FilterProtocolo][stj]': stj,
    page: String(pagina),
    'per-page': String(POR_PAGINA_SITIO),
  });
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    // por el relevo, si está configurado: Río Negro no le contesta al datacenter publicado (ver lib/proxyOrigen.js)
    const r = await fetch(urlParaPedir(`${BASE}/protocolo/buscar?${p}`, HOST), {
      signal: control.signal,
      headers: { 'User-Agent': `Mozilla/5.0 (compatible; ${USER_AGENT})`, Accept: 'text/html', 'Accept-Language': 'es-AR,es;q=0.9' },
    });
    if (!r.ok) throw errores.indiceFuenteFalla('rionegro', `respuesta ${r.status}`);
    return await r.text();
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('rionegro', sinClave(e?.cause?.code || e?.message));
  } finally {
    clearTimeout(reloj);
  }
}

/** «Mostrando 1-10 de 1,205 elementos.» */
export function totalDe(html) {
  const m = /Mostrando[\s\S]{0,80}?de\s*<b>?\s*([\d.,]+)\s*<\/b>?\s*elementos?/i.exec(html) || /de\s+([\d.,]+)\s+elementos?/i.exec(html);
  return m ? parseInt(m[1].replace(/[.,]/g, ''), 10) || 0 : 0;
}

export function parsear(html, stj) {
  const out = [];
  for (const [, id, fila] of String(html).matchAll(/<tr[^>]*data-key="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const caratula = texto(/class="titulo-grilla-registro"[^>]*>([\s\S]*?)<\/p>/.exec(fila)?.[1]);
    // los fragmentos donde aparece lo buscado, en el orden del fallo
    const fragmentos = [...(/class="texto-sentencia"[^>]*>([\s\S]*?)<\/div>/.exec(fila)?.[1] || '').matchAll(/<p>([\s\S]*?)<\/p>/g)]
      .map((m) => texto(m[1].replace(/<\/resaltar>\s*<resaltar>/g, '</resaltar> <resaltar>')).replace(/^\.\.\.\s*|\s*\.\.\.$/g, '').trim()).filter(Boolean);
    const datos = texto(/SENTENCIA:([^<]*)/.exec(fila)?.[1] || '');
    const [nro, fecha, tipo] = datos.split(/\s+-\s+/);
    const organismo = texto(/class="organismo-grilla"[^>]*>([\s\S]*?)<\/p>/.exec(fila)?.[1]);
    out.push({
      id: `rionegro_${id}`,
      caratula: caratula || '(sin carátula)',
      // la sentencia va con el tribunal: no es un número de expediente
      tribunal: [organismo || (stj === '1' ? 'Superior Tribunal de Justicia de Río Negro' : 'Poder Judicial de Río Negro'),
        nro && Number(nro) ? `Sentencia ${nro.trim()}${tipo ? ` (${tipo.trim().toLowerCase()})` : ''}` : (tipo ? `Sentencia ${tipo.trim().toLowerCase()}` : '')].filter(Boolean).join(' · '),
      fecha: (fecha || '').trim(),
      expediente: '',
      sumario: fragmentos.length ? `… ${fragmentos.join(' … ')} …` : '',
      voces: [],
      magistrados: '',
      linkFicha: `${BASE}/protocolo/protocolo?id_protocolo=${encodeURIComponent(id)}&stj=${stj}`,
      linkFallo: `${BASE}/protocolo/descargar-archivo-pdf?id_protocolo=${encodeURIComponent(id)}`,
    });
  }
  return out;
}

/**
 * Busca en Río Negro. Misma forma de entrada y salida que los otros clientes
 * (ver lib/fuentes.js). El sitio resuelve los tres modos; el rango de años y
 * lo excluido se filtran de este lado.
 */
export async function buscarRioNegro({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null, tribunal = 'STJ' }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();
  const stj = tribunal === 'CJ' ? '0' : '1';
  const arranque = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);
  let total = 0;
  const traer = async (offset) => {
    const n = Math.floor(offset / POR_PAGINA_SITIO) + 1;
    const html = await pedir(termino, modo, stj, n);
    if (!total) total = totalDe(html);
    if (!total || (n - 1) * POR_PAGINA_SITIO >= total) return [];
    return parsear(html, stj).slice(offset % POR_PAGINA_SITIO);
  };
  const salida = await paginarFiltrado({
    // el sitio ya buscó en el texto completo con el modo pedido: acá sólo los años y lo excluido (sin consulta)
    traer, desde: arranque, total: () => total, porPagina, q: '',
    modo: 'alguna', excluir, anioDesde, anioHasta, maxTandas: 3,
  });
  const filtro = Boolean(excluir || anioDesde || anioHasta);
  return {
    total: filtro ? salida.resultados.length : total,
    totalFuente: total,
    siguienteDesde: salida.siguienteDesde,
    totalParcial: filtro && salida.siguienteDesde !== null,
    revisados: filtro ? salida.revisados : 0,
    aflojado: false,
    pagina,
    porPagina,
    resultados: salida.resultados,
  };
}
