/**
 * Arma la tabla «Fallos tomo:página → nombre del fallo» (frontend/datos/fallos-citas.json)
 * con las citas que hacen OTROS fallos: «"Halabi" (Fallos: 332:111)», «en
 * Bazterrica (Fallos 308:1392)». Sale de los textos del respaldo
 * (backend/respaldo/*.json.gz) y del índice local; nada se inventa: cada
 * entrada dice cuántas veces se vio el nombre junto a esa cita, y sólo
 * entra si el nombre más citado le gana con claridad a los demás.
 * La usa Buscar cuando se escribe sólo la cita («Fallos 306:1892»): ver
 * frontend/nombre-fallo.js.
 *
 *   node scripts/armarCitasFallos.mjs            (sólo lo ya guardado)
 *   SAIJ=1 node scripts/armarCitasFallos.mjs     (además recorre los sumarios de SAIJ, tomo por tomo)
 *
 * Con SAIJ=1 se pregunta por cada tomo (del 200 al 348) y se leen hasta mil
 * sumarios por tomo (el tope de SAIJ por consulta), de a una consulta y con la
 * espera de cortesía de lib/descargador.js. Lo leído queda en
 * respaldo/citas-saij.json (sólo los pares cita–nombre), y la corrida retoma
 * donde quedó.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(aqui, '..');
const require = createRequire(import.meta.url);
const { IVSNombre } = require(path.join(RAIZ, '..', 'frontend', 'nombre-fallo.js'));
const SALIDA = path.join(RAIZ, '..', 'frontend', 'datos', 'fallos-citas.json');
const CACHE_SAIJ = path.join(RAIZ, 'respaldo', 'citas-saij.json');
const leerJson = async (f, def) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return def; } };
const reCitaG = /Fallos\s*:?\s*(?:T\.?\s*)?(\d{1,3})\s*:\s*(\d{1,5})(?!\d)/g;
function paresDe(t) {
  const out = [], vistas = new Set();
  let m;
  reCitaG.lastIndex = 0;
  while ((m = reCitaG.exec(t))) {
    const cita = `${+m[1]}:${+m[2]}`;
    if (vistas.has(cita)) continue;
    vistas.add(cita);
    for (const n of IVSNombre.nombresJuntoACita(t, cita)) out.push([cita, n]);
  }
  return out;
}

// SAIJ, tomo por tomo: { hechos: [tomos], docs: { uuid: [[cita, nombre], …] } }
const cacheSaij = await leerJson(CACHE_SAIJ, { hechos: [], docs: {} });
if (process.env.SAIJ) {
  const { esperarTurno } = await import('../lib/descargador.js');
  const H = { 'User-Agent': 'Mozilla/5.0 (compatible; IVS-CODEX)', Accept: 'application/json', Referer: 'https://www.saij.gob.ar/' };
  const tomos = [];
  for (let t = 348; t >= 200; t--) tomos.push(t);
  for (const tomo of tomos) {
    if (cacheSaij.hechos.includes(tomo)) continue;
    let total = null, nuevos = 0, ok = true;
    for (let o = 0; o < 1000 && (total === null || o < total); o += 100) {
      await esperarTurno('www.saij.gob.ar');
      try {
        const u = 'https://www.saij.gob.ar/busqueda?' + new URLSearchParams({ q: String(tomo), o: String(o), p: '100', f: 'Total|Tipo de Documento/Jurisprudencia/Sumario' });
        const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(30_000) });
        const d = await r.json();
        const sr = d.searchResults;
        if (!sr) { if (o === 0) ok = false; break; }
        if (total === null) total = (sr.categoriesResultList || []).find((c) => c.facetName === 'Total')?.facetChildren?.[0]?.facetHits || 0;
        for (const x of sr.documentResultList || []) {
          let doc; try { doc = JSON.parse(x.documentAbstract).document; } catch { continue; }
          const id = doc?.metadata?.uuid, t = String(doc?.content?.texto || '').replace(/\[\[[^\]]*\]\]/g, ' ');
          if (!id || cacheSaij.docs[id] || !/Fallos/.test(t)) continue;
          const pares = paresDe(t);
          if (pares.length) { cacheSaij.docs[id] = pares; nuevos++; }
        }
      } catch (e) { console.log(`  tomo ${tomo} o=${o}: ${e.message}`); ok = false; break; }
    }
    if (ok) cacheSaij.hechos.push(tomo);
    await fs.writeFile(CACHE_SAIJ, JSON.stringify(cacheSaij));
    console.log(`tomo ${tomo}: ${total ?? '?'} sumarios, ${nuevos} con cita y nombre (${Object.keys(cacheSaij.docs).length} en total)`);
  }
}

const textos = [];
for (const dir of [path.join(RAIZ, 'respaldo'), path.join(RAIZ, 'indice')]) {
  let archivos = [];
  try { archivos = await fs.readdir(dir); } catch { continue; }
  for (const a of archivos) {
    let d = null;
    try {
      const crudo = await fs.readFile(path.join(dir, a));
      d = JSON.parse(a.endsWith('.gz') ? zlib.gunzipSync(crudo) : crudo);
    } catch { continue; }
    const regs = Array.isArray(d.registros) ? d.registros : Object.values(d.registros || {});
    for (const r of regs) textos.push([r.caratula, r.sumario].filter(Boolean).join(' . '));
  }
}
const porCita = {};
for (const t of textos) {
  if (!/Fallos/.test(t)) continue;
  for (const [cita, n] of paresDe(t)) (porCita[cita] = porCita[cita] || []).push(n);
}
for (const pares of Object.values(cacheSaij.docs)) for (const [cita, n] of pares) (porCita[cita] = porCita[cita] || []).push(n);
const tabla = {};
let dudosas = 0;
for (const [cita, nombres] of Object.entries(porCita)) {
  const c = IVSNombre.consenso(nombres);
  // con dos nombres distintos igual de citados no se sabe cuál es
  if (!c || (c.otros[0] && c.otros[0].v * 2 > c.veces)) { dudosas++; continue; }
  tabla[cita] = [c.nombre, c.veces];
}
const ordenada = Object.fromEntries(Object.entries(tabla).sort((a, b) => b[1][1] - a[1][1]));
await fs.mkdir(path.dirname(SALIDA), { recursive: true });
await fs.writeFile(SALIDA, JSON.stringify(ordenada));
console.log(`${textos.length} textos, ${Object.keys(porCita).length} citas con nombre, ${Object.keys(tabla).length} en la tabla, ${dudosas} dudosas`);
console.log(Object.entries(ordenada).slice(0, 25).map(([k, v]) => `${k} ${v[0]} (${v[1]})`).join('\n'));
