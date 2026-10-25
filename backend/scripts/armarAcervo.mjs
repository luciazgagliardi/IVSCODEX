/**
 * Arma las tandas del ACERVO (ver lib/acervo.js) con lo cosechado de SAIJ
 * (scripts/cosecharSaij.mjs → acervo-crudo/) y el respaldo de las demás
 * bases (respaldo/<base>.json.gz):
 *
 *   acervo-datos/<fuente>-NNN.jsonl.gz   (un fallo por renglón, ≤ 60.000 por tanda)
 *   acervo-datos/manifiesto.json         (versión, archivos y conteos)
 *
 * A cada sumario de SAIJ se le pone la carátula y el tribunal de su fallo
 * (las fichas traen la lista de sus sumarios), y los de la Corte Suprema
 * quedan marcados para la base «csjn». Los registros tienen la misma forma
 * que los de la búsqueda en vivo, así el servidor los trata igual.
 *
 *   node scripts/armarAcervo.mjs
 */

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(aqui, '..');
const CRUDO = path.join(RAIZ, 'acervo-crudo');
const SALIDA = process.env.DIR_ACERVO_DATOS ? path.resolve(process.env.DIR_ACERVO_DATOS) : path.join(RAIZ, 'acervo-datos');
const POR_TANDA = 60_000;
const TRIB_CORTE = /CORTE SUPREMA DE JUSTICIA DE LA NACI[OÓ]N/i;

/* Lo cosechado de un tipo: la pasada general (saij-<tipo>) y las de cada provincia
   (saij-<tipo>-<provincia>, con PROVINCIA=… en cosecharSaij.mjs), que le ponen la provincia. */
async function leerCrudo(tipo) {
  let dirs = [];
  try { dirs = (await fs.readdir(CRUDO)).filter((d) => d === `saij-${tipo}` || d.startsWith(`saij-${tipo}-`)); } catch { return []; }
  const porId = new Map();
  for (const d of dirs) {
    let archivos = [];
    try { archivos = (await fs.readdir(path.join(CRUDO, d))).filter((a) => a.endsWith('.jsonl.gz')).sort(); } catch { continue; }
    for (const a of archivos) {
      const t = zlib.gunzipSync(await fs.readFile(path.join(CRUDO, d, a))).toString('utf8');
      for (const l of t.split('\n')) {
        if (!l) continue;
        let r; try { r = JSON.parse(l); } catch { continue; }
        const ya = porId.get(r.id);
        porId.set(r.id, ya ? { ...ya, ...r, pr: r.pr || ya.pr } : r);
      }
    }
  }
  return [...porId.values()];
}
const sin = (o) => { for (const k of Object.keys(o)) if (o[k] == null || o[k] === '' || (Array.isArray(o[k]) && !o[k].length)) delete o[k]; return o; };
const caratulaDe = (f) => [f.a, f.d].filter(Boolean).join(' c/ ') + (f.s ? `${f.a || f.d ? ' ' : ''}s/ ${f.s}` : '');

const porId = new Map();
function poner(r) {
  const ya = porId.get(r.id);
  // el que trae texto gana; si los dos, el más largo
  if (!ya || (!ya.sumario && r.sumario) || ((r.sumario || '').length > (ya.sumario || '').length)) porId.set(r.id, ya ? { ...ya, ...sin(r) } : r);
}

// ---- SAIJ: fichas y sumarios ----
const fichas = await leerCrudo('fallos');
const sumarios = await leerCrudo('sumarios');
const fichaDeSumario = new Map();
for (const f of fichas) for (const n of f.rel || []) if (!fichaDeSumario.has(n)) fichaDeSumario.set(n, f);
const textoDeSumario = new Map(sumarios.map((s) => [s.n, s]));
let conCaratula = 0;
for (const s of sumarios) {
  const f = fichaDeSumario.get(s.n);
  if (f) conCaratula++;
  const corte = (f && TRIB_CORTE.test(f.tr)) || (/^A\d/.test(s.n) && s.j === 'Federal');
  poner(sin({
    id: `saij_${s.id}`, fuente: 'saij', corte, provincia: s.pr || f?.pr,
    caratula: f ? caratulaDe(f) : s.t, tribunal: f ? f.tr : (corte ? 'Corte Suprema de Justicia de la Nación' : [s.j, s.tt].filter(Boolean).join(' · ')),
    fecha: s.f, expediente: s.ni, sumario: s.x, voces: s.v, magistrados: f?.m, materia: s.t,
    linkFicha: `https://www.saij.gob.ar/${s.id}`, tipo: 'sumario',
  }));
}
for (const f of fichas) {
  // el texto de la ficha: el de su primer sumario (las fichas no traen texto propio)
  const sum = (f.rel || []).map((n) => textoDeSumario.get(n)).find(Boolean);
  poner(sin({
    id: `saij_${f.id}`, fuente: 'saij', corte: TRIB_CORTE.test(f.tr), provincia: f.pr,
    caratula: caratulaDe(f) || '(sin carátula)', tribunal: f.tr, fecha: f.f, expediente: f.n, sumario: sum?.x, voces: sum?.v, magistrados: f.m,
    linkFicha: `https://www.saij.gob.ar/${f.id}`, tipo: 'fallo',
  }));
}
console.log(`SAIJ: ${fichas.length} fichas, ${sumarios.length} sumarios (${conCaratula} con la carátula de su fallo)`);

// ---- el respaldo de las bases (incluido lo de SAIJ y la Corte que ya había) ----
// el respaldo del repositorio y la cosecha grande de cada base (acervo-crudo/respaldo/, ver armarRespaldo.mjs con DIR_SALIDA)
for (const [base, dir] of ['saij', 'csjn', 'scba', 'caba', 'mendoza', 'mendozalegal', 'dialnet', 'rionegro', 'juristeca'].flatMap((b) => [[b, path.join(RAIZ, 'respaldo')], [b, path.join(CRUDO, 'respaldo')]])) {
  let d;
  try { d = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(dir, `${base}.json.gz`)))); } catch { continue; }
  let n = 0;
  for (const r of d.registros || []) {
    if (!r?.id) continue;
    const fuente = base === 'csjn' ? 'saij' : base;
    poner(sin({ ...r, fuente, corte: base === 'csjn' || (base === 'saij' && TRIB_CORTE.test(r.tribunal || '')) }));
    n++;
  }
  console.log(`${path.relative(RAIZ, dir)} ${base}: ${n}`);
}

// ---- tandas ----
await fs.rm(SALIDA, { recursive: true, force: true });
await fs.mkdir(SALIDA, { recursive: true });
const porFuente = {};
for (const r of porId.values()) (porFuente[r.fuente] = porFuente[r.fuente] || []).push(r);
const archivos = [], conteos = {}, hash = crypto.createHash('sha1');
for (const [fuente, regs] of Object.entries(porFuente).sort()) {
  regs.sort((a, b) => (a.id < b.id ? -1 : 1));
  conteos[fuente] = regs.length;
  conteos.csjn = (conteos.csjn || 0) + regs.filter((r) => r.corte).length;
  for (let i = 0, k = 1; i < regs.length; i += POR_TANDA, k++) {
    const nombre = `${fuente}-${String(k).padStart(3, '0')}.jsonl.gz`;
    const cuerpo = regs.slice(i, i + POR_TANDA).map((r) => JSON.stringify(r)).join('\n');
    hash.update(cuerpo);
    await fs.writeFile(path.join(SALIDA, nombre), zlib.gzipSync(cuerpo, { level: 9 }));
    archivos.push(nombre);
  }
}
const version = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${hash.digest('hex').slice(0, 8)}`;
await fs.writeFile(path.join(SALIDA, 'manifiesto.json'), JSON.stringify({ version, generado: new Date().toISOString(), archivos, conteos }, null, 1));
const peso = archivos.reduce((a, f) => a + fss.statSync(path.join(SALIDA, f)).size, 0);
console.log(`acervo ${version}: ${Object.entries(conteos).map(([k, v]) => `${k} ${v}`).join(', ')} · ${archivos.length} tandas, ${(peso / 1e6).toFixed(1)} MB`);
