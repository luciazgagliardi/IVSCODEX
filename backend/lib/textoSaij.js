/**
 * El texto completo de un documento de SAIJ, para abrirlo en el Lector sin
 * descargar nada a mano.
 *
 * La página de SAIJ (www.saij.gob.ar/<uuid>) se arma con JavaScript: traerla
 * no da texto. Pero la ficha del documento (view-document?guid=<uuid>) dice
 * dónde está el fallo:
 *   - «texto-completo»: el texto ya viene adentro (HTML);
 *   - «texto-doc»: el fallo en PDF, que se baja de descarga-archivo?guid=…
 *     (medido: casi todos los de la Corte y las cámaras desde 2004);
 *   - un SUMARIO no trae el fallo: se busca la ficha de su fallo (misma
 *     carátula y fecha) y se abre esa.
 * Si no hay fallo completo, se devuelve lo que la ficha tiene: la carátula,
 * los datos y el texto de sus sumarios.
 */

import { USER_AGENT } from '../config.js';
import { esperarTurno } from './descargador.js';

const HOST = 'www.saij.gob.ar';
const RE_SAIJ = /^https?:\/\/(?:www\.)?saij\.gob\.ar\/(?:view-document\?guid=)?([0-9a-z]{4,}(?:-[0-9a-z]+){3,})(?:[?#].*)?$/i;

/** El uuid de SAIJ de una URL de ficha (www.saij.gob.ar/<uuid> o view-document?guid=<uuid>), o null. */
export function uuidSaij(url) {
  const m = RE_SAIJ.exec(String(url || '').trim());
  return m ? m[1] : null;
}

// El Lector va por un carril propio: no queda detrás de las búsquedas y los pasajes, que también le piden a SAIJ
const CARRIL = `${HOST}#lector`;
async function pedirJson(url) {
  await esperarTurno(CARRIL);
  const r = await fetch(url, {
    headers: { 'User-Agent': `Mozilla/5.0 (compatible; ${USER_AGENT})`, Accept: 'application/json', Referer: `https://${HOST}/` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`SAIJ respondió ${r.status}`);
  return r.json();
}
export async function fichaSaij(uuid) {
  const j = await pedirJson(`https://${HOST}/view-document?guid=${encodeURIComponent(uuid)}`);
  const doc = j?.data ? JSON.parse(j.data)?.document : null;
  if (!doc) throw new Error('SAIJ no devolvió la ficha');
  return { tipo: doc.metadata?.['document-content-type'] || '', c: doc.content || {} };
}

const limpiar = (s) => String(s || '').replace(/\[\[\/?p\]\]/g, '\n').replace(/\[\[[^\]]*\]\]/g, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
const fechaDe = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || ''); };
const caratulaDe = (c) => limpiar(c.caratula) || ([c.actor, c.demandado].filter(Boolean).map(limpiar).join(' c/ ') + (c.sobre ? ` s/ ${limpiar(c.sobre)}` : ''));

/** La URL del PDF del fallo, si la ficha lo tiene. */
export function pdfDeFicha(c) {
  const td = c?.['texto-doc'];
  if (!td?.uuid) return null;
  return `https://${HOST}/descarga-archivo?guid=${encodeURIComponent(td.uuid)}&name=${encodeURIComponent(td['file-name'] || 'fallo.pdf')}`;
}

/* La ficha del fallo de un sumario: la que tiene su carátula y su fecha. */
async function fichaDelFallo(c) { return buscarFalloEnSaij(caratulaDe(c), String(c.fecha || ''), { mismaFecha: false }); }

/**
 * Un fallo en SAIJ por su carátula y su fecha (ISO o dd/mm/aaaa). Sirve para
 * abrir en el Lector un fallo de otra base cuando esa base no entrega el
 * documento (JUBA fuera de servicio, Mendoza bloqueada): SAIJ suele tenerlo.
 */
export async function buscarFalloEnSaij(car, fechaTxt, { mismaFecha = true } = {}) {
  let fecha = String(fechaTxt || '');
  const dmy = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(fecha);
  if (dmy) fecha = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const m = /^(\d{4})-(\d{2})/.exec(fecha);
  if (!car || !m) return null;
  const palabras = car.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3).slice(0, 6);
  if (!palabras.length) return null;
  const f = `Total|Tipo de Documento/Jurisprudencia/Fallo|Fecha/${m[1]}/${m[2]}`;
  const d = await pedirJson(`https://${HOST}/busqueda?${new URLSearchParams({ q: palabras.join(' '), o: '0', p: '30', f })}`);
  let mejor = null, puntos = 0;
  for (const x of d?.searchResults?.documentResultList || []) {
    let doc; try { doc = JSON.parse(x.documentAbstract).document; } catch { continue; }
    const k = doc.content || {};
    const otra = (caratulaDe(k) || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let p = palabras.filter((w) => otra.includes(w)).length / palabras.length;
    const igualFecha = String(k.fecha || '').slice(0, 10) === fecha.slice(0, 10);
    // de otra base: la fecha tiene que ser la misma y la carátula casi igual (las iniciales «C. L. M.» no alcanzan)
    if (mismaFecha && (!igualFecha || p < 0.6 || palabras.length < 2)) continue;
    if (igualFecha) p += 0.5;
    if (p > puntos) { puntos = p; mejor = doc.metadata?.uuid; }
  }
  return puntos >= 0.8 ? mejor : null;
}

/**
 * Lo que hace falta para abrir el documento: el texto ya listo, o la URL del
 * PDF para que lo lea el extractor de siempre. Con los datos de la ficha.
 */
export async function resolverSaij(uuid) {
  let { tipo, c } = await fichaSaij(uuid);
  let datos = { caratula: caratulaDe(c), tribunal: limpiar(c.tribunal), fecha: fechaDe(c.fecha) };
  // un sumario: se abre su fallo, si se encuentra; si no, el sumario mismo
  if (/sumario/i.test(tipo) || c['numero-sumario']) {
    const sumario = limpiar(c.texto);
    const otra = await fichaDelFallo(c).catch(() => null);
    if (otra) {
      ({ tipo, c } = await fichaSaij(otra));
      datos = { caratula: caratulaDe(c) || datos.caratula, tribunal: limpiar(c.tribunal) || datos.tribunal, fecha: fechaDe(c.fecha) || datos.fecha };
    } else {
      return { ...datos, texto: [datos.caratula, [datos.tribunal, datos.fecha].filter(Boolean).join(' · '), limpiar(c.titulo), sumario].filter(Boolean).join('\n\n'), metodo: 'saij-sumario' };
    }
  }
  const completo = limpiar(c['texto-completo']);
  if (completo.length > 400) return { ...datos, texto: completo, metodo: 'saij-texto-completo' };
  const pdf = pdfDeFicha(c);
  if (pdf) return { ...datos, pdf };
  // sin fallo completo: los datos y el texto de sus sumarios
  const rel = [].concat(c['sumarios-relacionados']?.['sumario-relacionado'] || []).slice(0, 6);
  const textos = [];
  for (const n of rel) {
    const mm = /^([A-Za-z])(\d{7})$/.exec(String(n));
    if (!mm) continue;
    const r = mm[2].split('').reverse().join('');
    try { const s = await fichaSaij(`123456789-0abc-defg${r.slice(0, 4)}-${r.slice(4)}${mm[1].toLowerCase()}soiramus`); if (s.c.texto) textos.push(limpiar(s.c.texto)); } catch { /* ese sumario no está */ }
  }
  return { ...datos, texto: [datos.caratula, [datos.tribunal, datos.fecha].filter(Boolean).join(' · '), ...textos].filter(Boolean).join('\n\n'), metodo: 'saij-sumarios' };
}
