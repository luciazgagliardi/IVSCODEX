/**
 * Los magistrados de cada fallo de SAIJ, desde su ficha completa.
 *
 * El listado de búsqueda de SAIJ (lo que baja scripts/cosecharSaij.mjs) no trae
 * quiénes firmaron cada fallo; la ficha de cada uno (view-document) sí
 * («magistrados: Kemelmajer Romano Bohm»). Sin ese dato, buscar a una jueza o un
 * juez por su nombre no encuentra los fallos que votó. Este script lo completa,
 * de a un fallo por vez y con pausa, y lo deja en
 * acervo-crudo/saij-magistrados.json (id → magistrados), que suma
 * scripts/armarAcervo.mjs. Se puede cortar y retomar.
 *
 *   PROVINCIAS=mendoza node scripts/completarMagistradosSaij.mjs
 *   (los nombres de carpeta de acervo-crudo: saij-fallos-<provincia>; «nacion» = saij-fallos)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CRUDO = path.join(aqui, '..', 'acervo-crudo');
const SALIDA = path.join(CRUDO, 'saij-magistrados.json');
const PROVINCIAS = (process.env.PROVINCIAS || 'mendoza').split(',').map((p) => p.trim()).filter(Boolean);
const PAUSA_MS = Number(process.env.PAUSA_MS || 2000);
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; IVS-CODEX; acervo de jurisprudencia)', Accept: 'application/json', Referer: 'https://www.saij.gob.ar/' };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function idsDe(dir) {
  const ids = [];
  let archivos = [];
  try { archivos = (await fs.readdir(dir)).filter((a) => a.endsWith('.jsonl.gz')); } catch { return ids; }
  for (const a of archivos) {
    const texto = zlib.gunzipSync(await fs.readFile(path.join(dir, a))).toString('utf8');
    for (const m of texto.matchAll(/"id":"([^"]+)"/g)) ids.push(m[1]);
  }
  return [...new Set(ids)];
}

let hecho = {};
try { hecho = JSON.parse(await fs.readFile(SALIDA, 'utf8')); } catch { /* primera vez */ }
const guardar = () => fs.writeFile(SALIDA, JSON.stringify(hecho));

const ids = [];
for (const p of PROVINCIAS) ids.push(...await idsDe(path.join(CRUDO, p === 'nacion' ? 'saij-fallos' : `saij-fallos-${p}`)));
const faltan = ids.filter((id) => !(id in hecho));
console.log(`${ids.length} fallos; faltan ${faltan.length}`);

let n = 0, ultimo = 0, conNombres = 0;
for (const id of faltan) {
  const espera = ultimo + PAUSA_MS - Date.now();
  if (espera > 0) await dormir(espera);
  ultimo = Date.now();
  for (let intento = 1; intento <= 5; intento++) {
    try {
      const r = await fetch(`https://www.saij.gob.ar/view-document?guid=${encodeURIComponent(id)}`, { headers: H, signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`respuesta ${r.status}`);
      const d = await r.json();
      let doc = d?.data;
      if (typeof doc === 'string') { try { doc = JSON.parse(doc); } catch { /* queda texto */ } }
      const m = /"magistrados"\s*:\s*"([^"]*)"/.exec(typeof doc === 'string' ? doc : JSON.stringify(doc || d));
      hecho[id] = m ? m[1].replace(/\s+/g, ' ').trim() : '';
      if (hecho[id]) conNombres++;
      break;
    } catch (e) {
      if (intento === 5) { console.log(`  ${id}: ${e.message}, se saltea`); hecho[id] = null; break; }
      await dormir(intento * 30_000);
    }
  }
  if (++n % 100 === 0) { await guardar(); console.log(`${new Date().toTimeString().slice(0, 8)} ${n} de ${faltan.length} (${conNombres} con magistrados)`); }
}
await guardar();
console.log(`fin: ${Object.keys(hecho).length} fichas revisadas`);
