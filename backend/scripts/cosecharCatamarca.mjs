/**
 * Cosecha incremental de dos catálogos oficiales de Catamarca.
 * Mantiene el archivo anterior, vuelve a mirar las primeras páginas (altas
 * recientes), continúa por cursor y enriquece fichas con sentencia íntegra.
 *
 *   MAX_PAGINAS=120 MAX_DETALLES=100 node scripts/cosecharCatamarca.mjs
 *
 * No envía formularios ni elude verificaciones; usa únicamente páginas
 * públicas y limita los pedidos al servidor del Poder Judicial.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { pedirCatamarca, parsearListadoCatamarca, parsearDetalleCatamarca } from '../lib/indiceCatamarca.js';
import { combinarRegistro } from '../lib/avanceCosecha.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(RAIZ, process.env.DIR_COSECHA || 'acervo-crudo/respaldo');
const ARCHIVO = path.join(DIR, 'catamarca.json.gz');
const AVANCE = path.join(DIR, 'avance-catamarca.json');
const INFORME = path.join(DIR, 'informe-catamarca.json');
const entero = (s, d, max) => Math.max(0, Math.min(max, Number(s) || d));
const MAX_PAGINAS = entero(process.env.MAX_PAGINAS, 120, 1000);
const MAX_DETALLES = entero(process.env.MAX_DETALLES, 80, 300);
const PAUSA_MS = Math.max(1200, Math.min(20000, Number(process.env.PAUSA_MS) || 1800));
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));
await fs.mkdir(DIR, { recursive: true });

let anterior = { registros: [] };
try { anterior = JSON.parse(zlib.gunzipSync(await fs.readFile(ARCHIVO))); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
if (!Array.isArray(anterior.registros)) throw new Error('Catamarca: respaldo anterior inválido');
const registros = new Map(anterior.registros.filter(x => x?.id).map(x => [x.id, x]));
let progreso = { version: 1, paginas: { sentencias: 1, sumarios: 1 }, completadas: {} };
try { progreso = JSON.parse(await fs.readFile(AVANCE, 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
if (progreso.version !== 1 || !progreso.paginas) throw new Error('Catamarca: cursor inválido');
const antes = registros.size;
const reporte = { fuente: 'catamarca', fecha: new Date().toISOString(), anteriores: antes,
  paginas: { sentencias: 0, sumarios: 0 }, detalles: 0, errores: [], nuevos: 0 };
let ultimo = 0;
async function paso() {
  const espera = ultimo + PAUSA_MS - Date.now();
  if (espera > 0) await esperar(espera);
  ultimo = Date.now();
}
async function guardar() {
  const registrosValidos = [...registros.values()].filter(r =>
    /^catamarca_\d+$/.test(r.id) &&
    /^https:\/\/consulta\.jurisprudencia\.juscatamarca\.gob\.ar\/sentencia\/\d+$/.test(r.linkFallo || ''));
  const gzip = zlib.gzipSync(JSON.stringify({ fuente: 'catamarca', generado: new Date().toISOString(), registros: registrosValidos }), { level: 8 });
  await fs.writeFile(ARCHIVO + '.tmp', gzip);
  await fs.rename(ARCHIVO + '.tmp', ARCHIVO);
  await fs.writeFile(AVANCE + '.tmp', JSON.stringify(progreso, null, 2));
  await fs.rename(AVANCE + '.tmp', AVANCE);
  await fs.writeFile(INFORME, JSON.stringify({ ...reporte, nuevos: registros.size - antes, total: registros.size }, null, 2));
}
async function pagina(tipo, numero) {
  await paso();
  const html = await pedirCatamarca('/' + tipo + '?page=' + numero);
  const x = parsearListadoCatamarca(html, tipo);
  if (!x.resultados.length) throw new Error('Sin registros reconocibles en ' + tipo + '?page=' + numero);
  for (const r of x.resultados) registros.set(r.id, combinarRegistro(registros.get(r.id), r));
  reporte.paginas[tipo]++;
  return x.siguiente;
}

const tipos = ['sentencias', 'sumarios'];
for (const tipo of tipos) {
  let presupuesto = Math.floor(MAX_PAGINAS / tipos.length);
  // Refrescar el comienzo sin volver a cosechar todas las páginas antiguas.
  for (let n = 1; n <= 3 && presupuesto > 0; n++) {
    try { await pagina(tipo, n); presupuesto--; } catch (e) {
      reporte.errores.push({ tipo, pagina: n, error: String(e.message).slice(0, 180) });
      break;
    }
  }
  let siguiente = progreso.paginas[tipo] || 1;
  for (let i = 0; i < presupuesto && !progreso.completadas?.[tipo]; i++) {
    if (siguiente <= 3) siguiente = 4;
    try {
      const hayMas = await pagina(tipo, siguiente);
      progreso.paginas[tipo] = siguiente + 1;
      if (!hayMas) progreso.completadas[tipo] = true;
      siguiente++;
      if (i % 8 === 0) await guardar();
    } catch (e) {
      reporte.errores.push({ tipo, pagina: siguiente, error: String(e.message).slice(0, 180) });
      break; // conservar cursor, no confundir error con fin de catálogo
    }
  }
  await guardar();
}

// Enriquecer fallos incompletos leyendo su propia ficha pública, no texto inferido.
// La cosecha principal funciona igualmente si un documento falla.
const pendientes = [...registros.values()].filter(r => (r.sumario || '').length < 1200);
for (const r of pendientes.slice(0, MAX_DETALLES)) {
  try {
    await paso();
    const id = r.id.slice('catamarca_'.length);
    const detalle = parsearDetalleCatamarca(await pedirCatamarca('/sentencia/' + id), r.id);
    if (!detalle) throw Error('Sin texto judicial verificable');
    registros.set(r.id, combinarRegistro(registros.get(r.id), detalle));
    reporte.detalles++;
  } catch (e) { reporte.errores.push({ id: r.id, error: String(e.message).slice(0, 180) }); }
  if (reporte.detalles % 10 === 0) await guardar();
}
await guardar();
console.log(JSON.stringify({ ...reporte, nuevos: registros.size - antes, total: registros.size }));
if (!registros.size) process.exitCode = 2;
