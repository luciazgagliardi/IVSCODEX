/**
 * HUDOC: buscador JSON oficial del Tribunal Europeo de Derechos Humanos.
 * El adaptador sólo usa la API pública /app/query/results, con paginación
 * explícita por start/length. La ficha apunta al registro del propio TEDH.
 */
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';

const HOST = 'hudoc.echr.coe.int';
const ENDPOINT = `https://${HOST}/app/query/results`;
const limpiar = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function col(row, key) {
  const c = row?.columns || row || {};
  const v = c[key];
  if (Array.isArray(v)) return limpiar(v[0]);
  if (v && typeof v === 'object') return limpiar(v.value ?? v.text ?? '');
  return limpiar(v);
}

export function registroHudoc(row) {
  const itemid = col(row, 'itemid');
  if (!itemid) return null;
  const ficha = `https://${HOST}/eng?i=${encodeURIComponent(itemid)}`;
  const titulo = col(row, 'docname') || itemid;
  return {
    id: 'hudoc_' + itemid.replace(/[^A-Za-z0-9_-]/g, '_'),
    caratula: titulo,
    tribunal: 'Tribunal Europeo de Derechos Humanos',
    fecha: col(row, 'kpdate'),
    expediente: col(row, 'appno'),
    // docname es un título, no el texto de la sentencia ni un pasaje coincidente.
    sumario: '',
    coincidenciaFuente: true,
    textoCompletoDisponible: false,
    voces: [col(row, 'doctypebranch'), col(row, 'languageisocode')].filter(Boolean),
    linkFicha: ficha,
    linkFallo: ficha,
    tipo: col(row, 'doctypebranch') || 'Decisión HUDOC',
    idioma: col(row, 'languageisocode'),
    tipoDocumento: 'Ficha oficial HUDOC; el título no es el texto de la sentencia',
    fuente: 'hudoc',
  };
}

export async function buscarHudoc({ q, pagina = 1, porPagina = 20, desde = null }) {
  const consulta = limpiar(q);
  if (!consulta) throw errores.consultaVacia();
  const cantidad = Math.max(1, Math.min(100, Number(porPagina) || 20));
  const inicio = desde === null ? (Math.max(1, Number(pagina) || 1) - 1) * cantidad : Math.max(0, Number(desde) || 0);
  const expresion = `contentsitename:ECHR AND ("${consulta.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()}")`;
  const parametros = new URLSearchParams({
    query: expresion,
    select: 'itemid,docname,appno,kpdate,doctypebranch,languageisocode',
    sort: 'kpdate Descending',
    start: String(inicio),
    length: String(cantidad),
  });
  await esperarTurno(HOST);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(`${ENDPOINT}?${parametros}`, {
      signal: control.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!respuesta.ok) throw errores.indiceFuenteFalla('hudoc', `respuesta HTTP ${respuesta.status}`);
    const datos = await respuesta.json();
    if (!datos || !Array.isArray(datos.results)) throw errores.indiceFuenteFalla('hudoc', 'respuesta JSON con forma inesperada');
    const resultados = datos.results.map(registroHudoc).filter(Boolean);
    const bruto = Number(datos.resultcount ?? datos.resultCount ?? datos.total);
    if (!Number.isFinite(bruto)) throw errores.indiceFuenteFalla('hudoc', 'no se recibió el total del buscador');
    const siguienteDesde = inicio + datos.results.length < bruto && datos.results.length ? inicio + datos.results.length : null;
    return {
      total: bruto, totalFuente: bruto, totalParcial: false,
      revisados: datos.results.length, siguienteDesde,
      pagina: Math.floor(inicio / cantidad) + 1, porPagina: cantidad, resultados,
    };
  } catch (e) {
    if (e?.codigo) throw e;
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    throw errores.indiceFuenteFalla('hudoc', e?.cause?.code || e?.message || 'error de red');
  } finally {
    clearTimeout(reloj);
  }
}
