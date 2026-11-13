/**
 * Poder Judicial de Catamarca: registro público de sentencias y sumarios.
 *
 * El portal publica listados HTML paginados y la sentencia íntegra con un
 * identificador estable en /sentencia/:id. Se cosechan en segundo plano y
 * la búsqueda usa exclusivamente la copia indexada: no se supone una API
 * remota de consulta que el organismo no haya documentado.
 */
import { JSDOM } from 'jsdom';
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';
import { buscarEnIndice } from './indice.js';
import { buscarPagina, acervoCubre } from './acervo.js';

export const ORIGEN_CATAMARCA = 'https://consulta.jurisprudencia.juscatamarca.gob.ar';
const HOST = new URL(ORIGEN_CATAMARCA).hostname;
const limpiar = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const textoNodo = (n) => limpiar(n?.textContent);

export function parsearListadoCatamarca(html, tipo = 'sentencias') {
  const dom = new JSDOM(String(html || ''));
  try {
    const doc = dom.window.document;
    const encontrados = new Map();
    // Sólo vínculos judiciales verificables, nunca ids fabricados.
    for (const a of doc.querySelectorAll('a[href]')) {
      let url;
      try { url = new URL(a.getAttribute('href'), ORIGEN_CATAMARCA); } catch { continue; }
      const m = /^\/sentencia\/(\d+)\/?$/.exec(url.pathname);
      if (!m || url.hostname !== HOST) continue;
      const tr = a.closest('tr');
      if (!tr) continue;
      const c = [...tr.querySelectorAll('td')].map(textoNodo);
      if (tipo === 'sentencias' && c.length < 5) continue;
      if (tipo === 'sumarios' && c.length < 3) continue;
      const id = 'catamarca_' + m[1];
      const enlace = ORIGEN_CATAMARCA + '/sentencia/' + m[1];
      const r = tipo === 'sentencias'
        ? { id, fuente: 'catamarca', provincia: 'Catamarca', caratula: c[1], tribunal: c[2] || 'Corte de Justicia de Catamarca',
            fecha: '', expediente: c[0], materia: c[3], sumario: '', voces: [], linkFicha: enlace, linkFallo: enlace, tipo: 'fallo' }
        : { id, fuente: 'catamarca', provincia: 'Catamarca', caratula: 'Sentencia ' + c[2], tribunal: 'Corte de Justicia de Catamarca',
            fecha: '', expediente: c[2], materia: '', sumario: c[1], voces: c[0] ? [c[0]] : [],
            linkFicha: enlace, linkFallo: enlace, tipo: 'fallo' };
      if (r.caratula && r.caratula.length >= 3) encontrados.set(id, r);
    }
    const siguiente = [...doc.querySelectorAll('a[href]')].some(a => {
      const rel = String(a.getAttribute('rel') || '');
      const t = textoNodo(a);
      const href = a.getAttribute('href') || '';
      return /next/i.test(rel) || /(?:next|siguiente)\s*[»>]?/i.test(t) && /[?&]page=\d+/.test(href);
    });
    return { resultados: [...encontrados.values()], siguiente };
  } finally { dom.window.close(); }
}

/** Extrae sólo los campos publicados del fallo real, sin inventar metadatos. */
export function parsearDetalleCatamarca(html, id) {
  const dom = new JSDOM(String(html || ''));
  try {
    const d = dom.window.document;
    const visible = limpiar(d.body?.textContent);
    const h = [...d.querySelectorAll('h1,h2,h3,h4,h5')];
    const titulo = h.map(textoNodo).find(t => t && !/^(Texto de la Sentencia|Sumarios|Consulta Jurisprudencia)$/i.test(t) && t.length >= 15);
    const fecha = /\bFecha:\s*((?:19|20)\d{2}-\d{2}-\d{2})/.exec(visible)?.[1] || '';
    const tribunal = /\bTribunal:\s*(.{3,90}?)(?=\s+Materia:|\s+Fecha:)/i.exec(visible)?.[1] || '';
    const materia = /\bMateria:\s*(.{3,140}?)(?=\s+Fecha:|\s+Ver PDF)/i.exec(visible)?.[1] || '';
    const inicio = visible.indexOf('Texto de la Sentencia');
    const resto = inicio >= 0 ? visible.slice(inicio + 'Texto de la Sentencia'.length) : '';
    const fin = resto.search(/\bSumarios\s+(?:No hay sumarios|Tema|Texto)\b/i);
    const cuerpo = limpiar(fin >= 0 ? resto.slice(0, fin) : resto).slice(0, 45000);
    if (cuerpo.length < 100) return null;
    return { id, ...(titulo ? { caratula: titulo } : {}), ...(fecha ? { fecha } : {}),
      ...(tribunal ? { tribunal: limpiar(tribunal) } : {}), ...(materia ? { materia: limpiar(materia) } : {}),
      sumario: cuerpo };
  } finally { dom.window.close(); }
}

/** HTTP de lectura: espera por host, timeout y nada de saltar captchas. */
export async function pedirCatamarca(ruta) {
  if (!/^\/(?:sentencias|sumarios)(?:\?page=\d{1,5})?$/.test(ruta) && !/^\/sentencia\/\d+$/.test(ruta))
    throw new Error('Ruta pública no permitida');
  await esperarTurno(HOST);
  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(ORIGEN_CATAMARCA + ruta, { signal: controlador.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Accept-Language': 'es-AR,es;q=0.9' } });
    if (!r.ok) throw errores.indiceFuenteFalla('catamarca', 'respuesta ' + r.status);
    const html = await r.text();
    if (!/<html|<table/i.test(html)) throw errores.indiceFuenteFalla('catamarca', 'formato HTML no reconocido');
    return html;
  } catch (e) {
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('catamarca', e?.name === 'AbortError' ? 'tiempo agotado' : String(e?.message || e).slice(0, 120));
  } finally { clearTimeout(reloj); }
}

/**
 * Consulta paginada sobre la copia propia. El total se considera exacto
 * ÚNICAMENTE respecto de los registros cosechados, no de la web oficial.
 */
export async function buscarCatamarca({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null }) {
  const consulta = limpiar(q);
  if (!consulta) throw errores.consultaVacia();
  const offset = desde === null ? (Math.max(1, pagina) - 1) * porPagina : Math.max(0, desde);
  const filtros = { modo, excluir, anioDesde, anioHasta };
  let p = null;
  if (acervoCubre('catamarca'))
    p = await buscarPagina('catamarca', consulta, { ...filtros, desde: offset, porPagina }, { espera: 12000, prioridad: 1 });
  if (!p) {
    const lista = await buscarEnIndice('catamarca', consulta, filtros);
    p = { total: lista.length, resultados: lista.slice(offset, offset + porPagina),
      siguienteDesde: offset + porPagina < lista.length ? offset + porPagina : null };
  }
  return { ...p, totalFuente: null, totalParcial: true, revisados: 0,
    aflojado: false, pagina, porPagina, desdeIndiceLocal: true };
}
