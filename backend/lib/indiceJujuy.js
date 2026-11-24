/**
 * Poder Judicial de Jujuy: Sistema de Jurisprudencia.
 *
 * El portal oficial (https://jurisprudencia.justiciajujuy.gov.ar) es una
 * aplicación Angular que consulta su propia API pública, sin autenticación
 * ni captcha. Se usa la misma consulta que hace la página, a pedido de quien
 * busca y con la espera entre pedidos de todo el backend.
 *
 * Verificado en vivo (20/11/2026):
 *   POST /endpoints/jurisprudencia/search/documentos?offset=<página>&limit=<tamaño>
 *     {"palabras":[...], "filtroPalabras": 1|2}
 *   - offset es el NÚMERO DE PÁGINA y empieza en 1 (offset=0 da 400).
 *   - filtroPalabras 2 = todas las palabras; 1 = cualquiera. Una frase
 *     enviada como un solo elemento se busca como frase.
 *     («daño moral»: frase 7.947; todas 9.065; cualquiera 32.531.)
 *   - Respuesta: {response:[{id_documento, fecha, organo, tipo_documento,
 *     serie, numero_expediente, anio, sumario(HTML), tesauros}], results}.
 *   - Visor público: /public/documento-sentencia?id=<id_documento>.
 *
 * Aviso legal del propio portal: cubre los organismos jurisdiccionales de
 * Jujuy EXCEPTO los tribunales de Familia, Menores y Penales; el texto es
 * informativo: sólo los protocolos de sentencias y sus copias fieles
 * agregadas al expediente son documentos auténticos. Las dos cosas se
 * informan en fuentesInfo.js.
 */
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { fetchOrigen } from './descargador.js';
import { errores } from './errores.js';
import { paginarFiltrado } from './paginarFiltrado.js';

export const ORIGEN_JUJUY = 'https://jurisprudencia.justiciajujuy.gov.ar';
const HOST = new URL(ORIGEN_JUJUY).hostname;
const URL_BUSQUEDA = `${ORIGEN_JUJUY}/endpoints/jurisprudencia/search/documentos`;
const POR_PAGINA_SITIO = 20;

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', ordm: 'º', ordf: 'ª', deg: '°' };
export function textoPlano(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&([a-zA-Z]+|#\d+);/g, (m, e) => ENTIDADES[e] ?? (e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : m))
    .replace(/\s+/g, ' ').trim();
}

/** «['DAÑO MORAL','PERDIDA DE LA CHANCE']» → ['DAÑO MORAL', 'PERDIDA DE LA CHANCE']. */
export function vocesDe(tesauros) {
  if (Array.isArray(tesauros)) return tesauros.map((v) => String(v).trim()).filter(Boolean);
  return [...String(tesauros || '').matchAll(/'([^']+)'/g)].map((m) => m[1].trim()).filter(Boolean);
}

const VACIAS_JUJUY = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'e', 'o', 'u', 'a', 'al', 'por', 'para', 'con', 'sin', 'su', 'sus', 'un', 'una', 'que', 'se', 'lo']);

/** Cuerpo de la consulta según el modo, como lo arma el propio buscador. */
export function cuerpoConsulta(q, modo) {
  const t = String(q || '').replace(/["“”«»]/g, '').replace(/\s+/g, ' ').trim();
  if (modo === 'exacta') return { palabras: [t], filtroPalabras: 2 };
  // El buscador de Jujuy exige cada palabra suelta, y las preposiciones no
  // están indexadas: «régimen de visitas» daba 0 y «régimen visitas» 1.333.
  const utiles = t.split(' ').filter((w) => w && !VACIAS_JUJUY.has(w.toLowerCase()));
  return { palabras: utiles.length ? utiles : t.split(' ').filter(Boolean), filtroPalabras: modo === 'alguna' ? 1 : 2 };
}

function fechaDe(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function registroDe(x) {
  const id = x?.id_documento;
  if (!id) return null;
  const expte = [x.serie, x.numero_expediente].filter(Boolean).join('-') + (x.anio ? `/${x.anio}` : '');
  const tipo = String(x.tipo_documento || 'Documento').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const enlace = `${ORIGEN_JUJUY}/public/documento-sentencia?id=${encodeURIComponent(id)}`;
  return {
    id: `jujuy_${id}`,
    // El listado no trae carátula: se rotula con datos que sí publica el sitio.
    caratula: expte ? `${tipo} · Expte. ${expte}` : tipo,
    expediente: expte,
    tribunal: String(x.organo || '').trim(),
    fecha: fechaDe(x.fecha),
    sumario: textoPlano(x.sumario),
    voces: vocesDe(x.tesauros),
    magistrados: '',
    provincia: 'Jujuy',
    linkFicha: enlace,
    linkFallo: enlace,
  };
}

async function pedir(cuerpo, pagina, limite) {
  try {
    const r = await fetchOrigen(`${URL_BUSQUEDA}?offset=${pagina}&limit=${limite}`, {
      method: 'POST', body: JSON.stringify(cuerpo),
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', Accept: 'application/json', Referer: `${ORIGEN_JUJUY}/public/buscador` },
    });
    if (!r.ok) throw errores.indiceFuenteFalla('jujuy', `respuesta ${r.status}`);
    const d = await r.json();
    if (!d || !Array.isArray(d.response) || typeof d.results !== 'number') throw errores.indiceFuenteFalla('jujuy', 'respuesta con forma inesperada');
    return d;
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('jujuy', e?.cause?.code || e?.message);
  }
}

/** Misma forma de entrada y salida que los demás clientes (ver lib/fuentes.js). */
export async function buscarJujuy({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null }) {
  const cuerpo = cuerpoConsulta(q, modo);
  if (!cuerpo.palabras.length || !cuerpo.palabras[0]) throw errores.consultaVacia();
  const arranque = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);
  let total = null;
  const traer = async (offset) => {
    const pag = Math.floor(offset / POR_PAGINA_SITIO) + 1;
    const d = await pedir(cuerpo, pag, POR_PAGINA_SITIO);
    total = d.results;
    if (!total || (pag - 1) * POR_PAGINA_SITIO >= total) return [];
    return d.response.map(registroDe).slice(offset % POR_PAGINA_SITIO);
  };
  const salida = await paginarFiltrado({ traer, desde: arranque, total: () => total ?? Infinity, porPagina, q: '', modo: 'alguna', excluir, anioDesde, anioHasta, maxTandas: 3 });
  const filtro = Boolean(excluir || anioDesde || anioHasta);
  return {
    total: filtro ? salida.resultados.length : (total ?? 0), totalFuente: total ?? 0,
    siguienteDesde: salida.siguienteDesde, totalParcial: filtro && salida.siguienteDesde !== null,
    revisados: filtro ? salida.revisados : 0, aflojado: false, pagina, porPagina, resultados: salida.resultados,
  };
}
