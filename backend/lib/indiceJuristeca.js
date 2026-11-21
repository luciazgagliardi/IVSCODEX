/**
 * Cliente de JURISTECA, la base de jurisprudencia del Consejo de la
 * Magistratura de la Ciudad (juristeca.jusbaires.gob.ar): los fallos de las
 * CÁMARAS de la Ciudad —Contencioso Administrativo, Tributario y de Relaciones
 * de Consumo; Penal, Penal Juvenil, Contravencional y de Faltas; Tribunal
 * Electoral—, que el buscador del TSJ no tiene.
 *
 * Medido en vivo: GET simple, sin sesión ni captcha. «despido» da 648 fallos.
 * Cada uno trae fuero, instancia, carátula, causa, fecha, sala, los temas que
 * le asigna la base y el PDF completo (con texto): el pasaje se saca del PDF
 * (como en CABA, ver /fragmentos en routes/indice.js) y se abre en el Lector.
 * Pagina con un cursor: la página siguiente se pide con el ID del último
 * fallo de la anterior. Ese ID es el «siguienteDesde» que viaja al frontend.
 */

import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';
import { filtrarPorModo } from './relevancia.js';

const HOST = 'juristeca.jusbaires.gob.ar';
const BASE = `https://${HOST}/baj/`;

const decodificar = (t) => String(t || '').replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü' }[e] ?? m;
});
const texto = (h) => decodificar(String(h || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim();

async function pedir(params) {
  await esperarTurno(HOST);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}?${new URLSearchParams(params)}`, {
      signal: control.signal,
      headers: { 'User-Agent': `Mozilla/5.0 (compatible; ${USER_AGENT})`, Accept: 'text/html', 'Accept-Language': 'es-AR,es;q=0.9' },
    });
    if (!r.ok) throw errores.indiceFuenteFalla('juristeca', `respuesta ${r.status}`);
    return await r.text();
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('juristeca', e?.cause?.code || e?.message);
  } finally {
    clearTimeout(reloj);
  }
}

/** Cuántos fallos tiene la búsqueda: «Fallos: 648 (Ver Registros)». */
export function totalDe(html) {
  const m = /Fallos:\s*([\d.]+)/i.exec(String(html).replace(/<[^>]+>/g, ' '));
  return m ? parseInt(m[1].replace(/\./g, ''), 10) || 0 : 0;
}

export function parsear(html) {
  const out = [];
  const bloques = String(html).split(/<div class="fallo-individual" id="fallo-/).slice(1);
  for (const b of bloques) {
    const id = /^(\d+)/.exec(b)?.[1];
    if (!id) continue;
    const campo = (et) => texto(new RegExp(`<strong>${et}:?\\s*</strong>([\\s\\S]*?)(?:<strong>|</p>)`, 'i').exec(b)?.[1] || '').replace(/\.$/, '');
    const parrafos = [...b.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    const instancia = texto(parrafos.find((p) => !/<strong>|class=/.test(p) && texto(p)) || '');
    const car = texto((/<p class="caratula">([\s\S]*?)<strong>/.exec(b)?.[1] || '').replace(/^\s*•\s*/, '')).replace(/^•\s*/, '').replace(/\s*\.$/, '');
    const voces = [...(/<p class="descriptores">([\s\S]*?)<\/p>/.exec(b)?.[1] || '').matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map((m) => texto(m[1])).filter(Boolean);
    const pdf = /href="(https:\/\/juristeca\.jusbaires\.gob\.ar\/fallos\/[^"]+\.pdf)"/.exec(b)?.[1] || null;
    const fuero = campo('Fuero'), sala = campo('Sala');
    out.push({
      id: `juristeca_${id}`,
      caratula: car || '(sin carátula)',
      tribunal: [instancia, fuero, sala ? `Sala ${sala}` : ''].filter(Boolean).join(' · '),
      fecha: campo('Fecha').replace(/-/g, '/'),
      expediente: campo('Causa Nº') || campo('Causa N°'),
      sumario: '',
      voces,
      magistrados: '',
      linkFicha: pdf,
      linkFallo: pdf,
      _id: Number(id),
    });
  }
  return out;
}

/**
 * Busca en Juristeca. desde: 0 para la primera página, o el ID del último fallo
 * de la página anterior (es como pagina el sitio). El texto se busca en el
 * cuerpo de los fallos; la frase exacta y lo excluido se filtran de este lado
 * sobre carátula y temas (el pasaje llega después, del PDF).
 */
/** Descarta lo que tiene un año conocido fuera del rango; lo que no trae fecha queda. */
export function filtrarPorAnio(lista, anioDesde, anioHasta) {
  if (!anioDesde && !anioHasta) return lista;
  return lista.filter((r) => {
    const m = /(\d{4})\s*$/.exec(String(r.fecha || '').trim()) || /\b(19|20)\d{2}\b/.exec(String(r.fecha || ''));
    if (!m) return true;
    const anio = Number(m[1].length === 4 ? m[1] : m[0]);
    return (!anioDesde || anio >= Number(anioDesde)) && (!anioHasta || anio <= Number(anioHasta));
  });
}

export async function buscarJuristeca({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();
  // el total sale del primer paso del buscador del sitio
  const resumen = await pedir({ accion: 'buscar', 'buscar-fallo': '1', 'cuerpo[]': termino, ...(anioDesde ? { AnioDesde: String(anioDesde) } : {}), ...(anioHasta ? { AnioHasta: String(anioHasta) } : {}) });
  const total = totalDe(resumen);
  if (!total) return { total: 0, totalFuente: 0, siguienteDesde: null, pagina, porPagina, resultados: [] };
  const params = { accion: 'fallos', 'Texto[0]': termino, total_fallos: String(total), ...(anioDesde ? { AnioDesde: String(anioDesde) } : {}), ...(anioHasta ? { AnioHasta: String(anioHasta) } : {}) };
  if (desde) { params.ID = String(desde); params.pagina = String(Math.max(2, pagina)); }
  // El portal recibe AnioDesde/AnioHasta pero no los respeta (medido: con
  // 2023–2024, 50 de 50 resultados eran de 2026). Se filtra de este lado y,
  // con rango de años, se revisan hasta 3 páginas del portal antes de dar
  // una página por vacía: mostrar «0» tras mirar solo la primera sería un
  // falso cero.
  const filtrando = Boolean(anioDesde || anioHasta);
  let resultados = [], antes = 0, ultimo = null, hayMas = false, numPag = Math.max(1, Number(params.pagina) || 1);
  for (let vuelta = 0; vuelta < (filtrando ? 3 : 1); vuelta++) {
    const html = await pedir(params);
    let lote = parsear(html);
    ultimo = lote.length ? lote[lote.length - 1]._id : ultimo;
    hayMas = Boolean(/name="pagina"\s+value="\d+"/.test(html) && lote.length);
    if (excluir) lote = filtrarPorModo(lote, { q: '', modo: 'alguna', excluir }).lista;
    antes += lote.length;
    resultados.push(...filtrarPorAnio(lote, anioDesde, anioHasta));
    if (!filtrando || resultados.length >= porPagina || !hayMas) break;
    numPag++; params.ID = String(ultimo); params.pagina = String(Math.max(2, numPag));
  }
  const descartadosPorAnio = antes - resultados.length;
  resultados = resultados.map(({ _id, ...r }) => r);
  const filtrado = filtrando;
  return {
    // Con rango de años, el total del portal no describe lo que se muestra.
    total: filtrado ? resultados.length : total, totalFuente: total,
    siguienteDesde: hayMas ? ultimo : null,
    totalParcial: filtrado && hayMas, revisados: filtrado ? antes : 0, aflojado: false,
    ...(descartadosPorAnio ? { descartadosPorAnio } : {}),
    pagina, porPagina, resultados,
  };
}
