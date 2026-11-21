/**
 * Evalúa el vocabulario contra la batería de regresión
 * (docs/auditoria-integral-2026/datos/consultas-referencia.json).
 *
 * Criterio (el de la batería): un caso cumple si el concepto esperado está
 * entre los canónicos reconocidos, sus descriptores SCJM o sus formas
 * expandidas, y si ninguna forma expandida está en noDebeExpandirA.
 *
 *   node ops/vocabulario/evaluar-bateria.mjs [--fallas]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizar, normalizar } from '../../backend/lib/vocabulario.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bateria = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs/auditoria-integral-2026/datos/consultas-referencia.json'), 'utf8'));

export function evaluarCaso(c) {
  const a = analizar(c.consulta);
  const esperado = normalizar(c.conceptoEsperado);
  const encontrados = new Set();
  const expandidos = new Set();
  for (const k of a.conceptos) {
    encontrados.add(normalizar(k.canonico));
    if (k.vozScjm) encontrados.add(normalizar(k.vozScjm));
    for (const x of k.expandir) { encontrados.add(normalizar(x.termino)); expandidos.add(normalizar(x.termino)); }
  }
  for (const d of a.descriptoresScjm) encontrados.add(normalizar(d.termino));
  const prohibidas = (c.noDebeExpandirA || []).map(normalizar);
  const indebidas = prohibidas.filter((p) => expandidos.has(p));
  return { cumple: encontrados.has(esperado) && !indebidas.length, indebidas, reconocidos: [...encontrados] };
}

const porForma = {};
let cumplen = 0;
const fallas = [];
for (const c of bateria.casos) {
  const r = evaluarCaso(c);
  const f = (porForma[c.forma] ||= [0, 0]);
  f[1]++;
  if (r.cumple) { f[0]++; cumplen++; } else fallas.push({ id: c.id, consulta: c.consulta, esperado: c.conceptoEsperado, indebidas: r.indebidas });
}
console.log(JSON.stringify({ casos: bateria.casos.length, cumplen, porForma: Object.fromEntries(Object.entries(porForma).map(([k, [a, b]]) => [k, `${a}/${b}`])), expansionesIndebidas: fallas.filter((f) => f.indebidas.length).map((f) => f.consulta) }, null, 1));
if (process.argv.includes('--fallas')) for (const f of fallas) console.log(`${f.id}\t${f.consulta}\t→ ${f.esperado}${f.indebidas.length ? '\tINDEBIDA: ' + f.indebidas.join(', ') : ''}`);
