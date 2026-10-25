/**
 * Cosecha SAIJ casi entero: los SUMARIOS de jurisprudencia (con su texto) y
 * las FICHAS de los fallos (con la carátula, el tribunal y los sumarios que
 * les corresponden), para el acervo propio (ver scripts/armarAcervo.mjs y
 * lib/acervo.js): así la búsqueda sigue andando aunque SAIJ no responda.
 *
 * SAIJ devuelve como mucho 1.000 resultados por consulta (offset + 100 ≤
 * 1.000). Por eso se recorre por tramos: año → mes → jurisdicción → día,
 * bajando de nivel sólo cuando un tramo pasa de mil. La consulta es un OR
 * de palabras que tiene casi todo documento («que la de el y en»).
 *
 * Cortesía: una consulta por vez, con PAUSA_MS entre una y otra (2 s por
 * defecto). Si SAIJ corta (403, 429, 5xx o la red), espera diez minutos y
 * reintenta; a la sexta vez seguida deja el avance guardado y termina.
 *
 *   node scripts/cosecharSaij.mjs                  (sumarios y fichas, 1863–hoy)
 *   TIPOS=fallos DESDE=1990 HASTA=2026 node scripts/cosecharSaij.mjs
 *   RECIENTES=3 node scripts/cosecharSaij.mjs      (sólo los últimos 3 meses, de nuevo: la actualización mensual)
 *
 * Lo cosechado queda en backend/acervo-crudo/saij-<tipo>/<tramo>.jsonl.gz
 * (fuera del repositorio) y el avance en backend/acervo-crudo/progreso-saij.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CRUDO = path.join(aqui, '..', 'acervo-crudo');
const PROGRESO = path.join(CRUDO, 'progreso-saij.json');
const URL_SAIJ = 'https://www.saij.gob.ar/busqueda';
const Q = 'que la de el y en';
const PAUSA_MS = Number(process.env.PAUSA_MS || 2000);
const ESPERA_CORTE_MS = Number(process.env.ESPERA_CORTE_MS || 600_000);
const DESDE = Number(process.env.DESDE || 1863), HASTA = Number(process.env.HASTA || new Date().getFullYear());
const TIPOS = (process.env.TIPOS || 'sumarios,fallos').split(',');
const FACETA_TIPO = { sumarios: 'Total|Tipo de Documento/Jurisprudencia/Sumario', fallos: 'Total|Tipo de Documento/Jurisprudencia/Fallo' };
const JURISDICCIONES = ['Local', 'Federal', 'Nacional', 'Internacional', 'Extranjera', 'categoriavacia'];
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; IVS-CODEX; acervo de jurisprudencia)', Accept: 'application/json', Referer: 'https://www.saij.gob.ar/' };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const leerJson = async (f, def) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return def; } };
const limpio = (s) => String(s || '').replace(/\[\[\/?p\]\]/g, ' ').replace(/\[\[[^\]]*\]\]/g, ' ').replace(/\s+/g, ' ').trim();
const fechaDe = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || ''); };

let ultimo = 0, pedidos = 0;
async function pedir(faceta, o, p) {
  for (let intento = 1; ; intento++) {
    const falta = ultimo + PAUSA_MS - Date.now();
    if (falta > 0) await dormir(falta);
    ultimo = Date.now();
    pedidos++;
    try {
      const r = await fetch(`${URL_SAIJ}?${new URLSearchParams({ q: Q, o: String(o), p: String(p), f: faceta })}`, { headers: H, signal: AbortSignal.timeout(60_000) });
      if (r.ok) {
        const d = await r.json();
        const sr = d?.searchResults;
        if (sr) return sr;
        // 200 sin resultados (o «success:false»): el tramo no existe con esa faceta
        return null;
      }
      // pedir más allá del total da 500: no es un corte
      if (r.status === 500 && o > 0) return null;
      throw new Error(`respuesta ${r.status}`);
    } catch (e) {
      if (intento >= 6) throw new Error(`SAIJ no responde (${e.message}); avance guardado`);
      console.log(`  ${new Date().toTimeString().slice(0, 8)} corte (${e.message}): espero ${Math.round(ESPERA_CORTE_MS / 60000)} min (${intento}/5)`);
      await dormir(ESPERA_CORTE_MS);
    }
  }
}
const totalDe = (sr) => (sr?.categoriesResultList || []).find((c) => c.facetName === 'Total')?.facetChildren?.[0]?.facetHits || 0;

function aRegistro(tipo, x) {
  let doc;
  try { doc = JSON.parse(x.documentAbstract).document; } catch { return null; }
  const c = doc?.content || {}, id = doc?.metadata?.uuid;
  if (!id) return null;
  const jur = c.jurisdiccion?.descripcion || '';
  const voces = [].concat(c.descriptores?.descriptor || []).map((d) => d?.elegido?.termino).filter(Boolean);
  if (tipo === 'sumarios') {
    const texto = limpio(c.texto);
    if (!texto) return null;
    return { id, n: String(c['numero-sumario'] || ''), t: limpio(c.titulo), x: texto, f: fechaDe(c.fecha), j: jur, tt: c['tipo-tribunal'] || '', pr: c.provincia || '', v: voces.length ? voces : undefined, ni: c['numero-interno'] || undefined };
  }
  const rel = [].concat(c['sumarios-relacionados']?.['sumario-relacionado'] || []).map(String);
  return { id, n: String(c['numero-fallo'] || ''), tr: limpio(c.tribunal), f: fechaDe(c.fecha), j: jur, pr: c.provincia || '', tf: c['tipo-fallo'] || '', a: limpio(c.actor), d: limpio(c.demandado), s: limpio(c.sobre), m: limpio(c.magistrados) || undefined, rel: rel.length ? rel : undefined };
}

async function guardar(tipo, tramo, registros) {
  const dir = path.join(CRUDO, `saij-${tipo}`);
  await fs.mkdir(dir, { recursive: true });
  const nombre = tramo.replace(/[^\w-]+/g, '_');
  await fs.writeFile(path.join(dir, `${nombre}.jsonl.gz`), zlib.gzipSync(registros.map((r) => JSON.stringify(r)).join('\n')));
}

/* Un tramo entero (≤ 1.000): de a 100. */
async function bajarTramo(tipo, faceta, total) {
  const out = [];
  for (let o = 0; o < Math.min(total, 1000); o += 100) {
    const sr = await pedir(faceta, o, 100);
    if (!sr) break;
    for (const x of sr.documentResultList || []) { const r = aRegistro(tipo, x); if (r) out.push(r); }
    if ((sr.documentResultList || []).length < 100) break;
  }
  return out;
}

const progreso = await leerJson(PROGRESO, { hechos: {}, conteo: {} });
async function marcar(clave, n) { progreso.hechos[clave] = n; await fs.writeFile(PROGRESO, JSON.stringify(progreso)); }

/* Recorre un tramo: si cabe, lo baja; si no, lo parte en el nivel siguiente. */
async function recorrer(tipo, partes, nivel) {
  const clave = `${tipo}|${partes.join('|')}`;
  if (progreso.hechos[clave] != null) return progreso.hechos[clave];
  const faceta = [FACETA_TIPO[tipo], ...partes].join('|');
  const sr = await pedir(faceta, 0, 1);
  const total = sr ? totalDe(sr) : 0;
  let n = 0;
  if (!total) { await marcar(clave, 0); return 0; }
  const fecha = partes.find((p) => p.startsWith('Fecha/'));
  const conJur = partes.some((p) => p.startsWith('Jurisdicción/'));
  if (total <= 1000 || nivel === 'tope') {
    const regs = await bajarTramo(tipo, faceta, total);
    await guardar(tipo, partes.join('_'), regs);
    n = regs.length;
    if (total > 1000) console.log(`  ${clave}: ${total} (se bajan los primeros 1.000)`);
  } else if (fecha.split('/').length === 2) {
    // año → meses
    for (let m = 1; m <= 12; m++) n += await recorrer(tipo, [`${fecha}/${String(m).padStart(2, '0')}`], 'mes');
    n += await recorrerSinMes(tipo, fecha, total, n);
  } else if (!conJur) {
    // mes → jurisdicciones
    for (const j of JURISDICCIONES) n += await recorrer(tipo, [...partes, `Jurisdicción/${j}`], 'jur');
  } else if (fecha.split('/').length === 3) {
    // mes y jurisdicción → días
    for (let d = 1; d <= 31; d++) n += await recorrer(tipo, [`${fecha}/${String(d).padStart(2, '0')}`, ...partes.filter((p) => !p.startsWith('Fecha/'))], 'dia');
  } else {
    n += await recorrer(tipo, partes, 'tope');
  }
  await marcar(clave, n);
  return n;
}
/* Los documentos del año sin mes cargado: si los meses no suman el total del año. */
async function recorrerSinMes(tipo, fecha, totalAnio, enMeses) {
  if (enMeses >= totalAnio * 0.98) return 0;
  console.log(`  ${tipo} ${fecha}: ${totalAnio} en el año, ${enMeses} por mes`);
  return 0;
}

await fs.mkdir(CRUDO, { recursive: true });
const t0 = Date.now();
const RECIENTES = Number(process.env.RECIENTES || 0);
if (RECIENTES > 0) {
  // los últimos meses se vuelven a bajar enteros: SAIJ sigue cargando fallos de meses ya pasados
  const hoy = new Date(), meses = [];
  for (let i = 0; i < RECIENTES; i++) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); meses.push(`Fecha/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`); }
  for (const tipo of TIPOS) {
    for (const k of Object.keys(progreso.hechos)) if (meses.some((m) => k.startsWith(`${tipo}|${m}`))) delete progreso.hechos[k];
    for (const m of meses) {
      const n = await recorrer(tipo, [m], 'mes');
      console.log(`${new Date().toTimeString().slice(0, 8)} ${tipo} ${m.slice(6)}: ${n}`);
    }
  }
  console.log(`fin: ${pedidos} consultas, ${((Date.now() - t0) / 60000).toFixed(0)} min`);
  process.exit(0);
}
for (const tipo of TIPOS) {
  for (let anio = HASTA; anio >= DESDE; anio--) {
    const antes = pedidos;
    const n = await recorrer(tipo, [`Fecha/${anio}`], 'anio');
    if (pedidos > antes) console.log(`${new Date().toTimeString().slice(0, 8)} ${tipo} ${anio}: ${n} (${pedidos} consultas, ${((Date.now() - t0) / 60000).toFixed(0)} min)`);
  }
}
const total = Object.entries(progreso.hechos).filter(([k]) => k.split('|').length === 2).reduce((a, [, v]) => a + v, 0);
console.log(`fin: ${total} documentos, ${pedidos} consultas, ${((Date.now() - t0) / 60000).toFixed(0)} min`);
