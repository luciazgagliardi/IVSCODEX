/**
 * Informe reproducible del acervo mendocino publicado.
 * Uso: node scripts/auditarMendoza.mjs [directorio-de-tandas]
 * No consulta ni modifica los servidores judiciales.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(process.argv[2] || path.join(raiz, 'acervo-datos'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifiesto.json'), 'utf8'));
const resumen = {
  version: manifest.version,
  generado: manifest.generado,
  mendoza: { total: 0, SC: 0, CC: 0, CT: 0, ambiguos: 0, sinTribunal: 0, sinSumario: 0, sinEnlace: 0, sinFecha: 0, sinCaratula: 0, duplicadosId: 0 },
  saijMendoza: { total: 0, SC: 0, CC: 0, CT: 0, ambiguos: 0, sinTribunal: 0 },
  controles: {},
};
const ids = new Set();
const controles = ['daño punitivo', 'punitivo', 'multa civil', 'daño moral', 'despido indirecto', 'horas extras', 'desvalorización venal', 'accidente de tránsito'];
for (const q of controles) resumen.controles[q] = {
  mendoza: 0, saijMendoza: 0,
  porTribunal: { mendoza: { SC: 0, CC: 0, CT: 0, ambiguos: 0, sinTribunal: 0 }, saijMendoza: { SC: 0, CC: 0, CT: 0, ambiguos: 0, sinTribunal: 0 } },
};
function clase(tribunal) {
  if (!tribunal || !tribunal.trim()) return 'sinTribunal';
  const t = tribunal.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/SUPREMA CORTE|SUP\.? CORTE|SUPREMO TRIBUNAL/.test(t)) return 'SC';
  if (/CAMARA/.test(t) && /TRABAJO|LABORAL/.test(t)) return 'CT';
  if (/CAMARA/.test(t) && /CIVIL|COMERCIAL|MINAS/.test(t)) return 'CC';
  return 'ambiguos';
}
for (const nombre of manifest.archivos) {
  if (!/^(mendoza|saij)-\d+\.jsonl\.gz$/.test(nombre)) continue;
  const entrada = readline.createInterface({ input: fs.createReadStream(path.join(dir, nombre)).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const linea of entrada) {
    if (!linea) continue;
    const r = JSON.parse(linea);
    if (r.fuente !== 'mendoza' && !(r.fuente === 'saij' && String(r.provincia || '').toLowerCase() === 'mendoza')) continue;
    const propio = r.fuente === 'mendoza';
    const g = propio ? resumen.mendoza : resumen.saijMendoza;
    g.total++;
    const tribunal = clase(r.tribunal);
    g[tribunal]++;
    if (propio) {
      if (ids.has(r.id)) g.duplicadosId++;
      ids.add(r.id);
      if (!r.sumario) g.sinSumario++;
      if (!r.linkFicha && !r.linkFallo) g.sinEnlace++;
      if (!r.fecha) g.sinFecha++;
      if (!r.caratula) g.sinCaratula++;
    }
    const texto = [r.caratula, r.sumario, Array.isArray(r.voces) ? r.voces.join(' ') : r.voces].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const q of controles) if (texto.includes(q.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
      const fuente = propio ? 'mendoza' : 'saijMendoza';
      resumen.controles[q][fuente]++;
      resumen.controles[q].porTribunal[fuente][tribunal]++;
    }
  }
}
if (manifest.conteos?.mendoza != null && resumen.mendoza.total !== manifest.conteos.mendoza) {
  throw new Error(`Inconsistencia Mendoza: manifiesto ${manifest.conteos.mendoza}, filas ${resumen.mendoza.total}`);
}
console.log(JSON.stringify(resumen, null, 2));
