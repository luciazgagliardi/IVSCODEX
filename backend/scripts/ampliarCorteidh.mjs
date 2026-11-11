/**
 * Incorpora TODO el catálogo público de la Corte IDH al acervo común.
 * Los PDF se indexan progresivamente, con texto literal y enlace de origen.
 * Una falla de PDF no borra fichas previas ni inventa sentencias.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { listarTodo } from '../lib/indiceCorteidh.js';
import { descargar } from '../lib/descargador.js';
import { extraerDesdeBuffer } from '../lib/documento.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(raiz, process.env.DIR_COSECHA || 'acervo-crudo/respaldo');
const archivo = path.join(dir, 'corteidh.json.gz');
const avance = path.join(dir, 'avance-corteidh.json');
const informe = path.join(dir, 'informe-corteidh.json');
const MAX_PDFS = Math.max(1, Math.min(600, Number(process.env.MAX_PDFS) || 70));
const PAUSA_MS = Math.max(1500, Math.min(15000, Number(process.env.PAUSA_MS) || 2000));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const leerJson = async (f, def) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return def; throw e; } };
await fs.mkdir(dir, { recursive: true });
let anterior;
try { anterior = JSON.parse(zlib.gunzipSync(await fs.readFile(archivo)).toString()); }
catch (e) { if (e.code !== 'ENOENT') throw e; anterior = { registros: [] }; }
if (!Array.isArray(anterior.registros)) throw new Error('Respaldo Corte IDH inválido');
const mapa = new Map(anterior.registros.filter((r) => r.id).map((r) => [r.id, r]));
const inicio = mapa.size;
const estado = await leerJson(avance, { fallidos: {} });
estado.fallidos ||= {};
const reporte = { fuente: 'corteidh', fecha: new Date().toISOString(), anteriores: inicio, catalogo: 0, nuevos: 0, pdfsNuevos: 0, errores: [] };
async function guardar() {
  await fs.writeFile(archivo + '.tmp', zlib.gzipSync(JSON.stringify({ fuente: 'corteidh', generado: new Date().toISOString(), registros: [...mapa.values()] }), { level: 8 }));
  await fs.rename(archivo + '.tmp', archivo);
  await fs.writeFile(avance, JSON.stringify(estado, null, 2));
  reporte.total = mapa.size;
  reporte.nuevos = mapa.size - inicio;
  await fs.writeFile(informe, JSON.stringify(reporte, null, 2));
}
let lista;
try { lista = await listarTodo(); }
catch (e) {
  reporte.errores.push('Catálogo no disponible: ' + String(e.message).slice(0, 160));
  await guardar();
  console.log(JSON.stringify(reporte));
  process.exit(0);
}
if (!Array.isArray(lista) || !lista.length) throw new Error('El sitio oficial devolvió un catálogo vacío; no se actualiza el acervo');
reporte.catalogo = lista.length;
for (const r of lista) {
  if (!/^corteidh_\d+$/.test(r?.id || '')) continue;
  const previo = mapa.get(r.id) || {};
  mapa.set(r.id, { ...r, ...previo, fuente: 'corteidh', tipo: r.expediente || previo.tipo || 'Documento' });
}
await guardar();
let ultimo = 0;
for (const r of mapa.values()) {
  if (reporte.pdfsNuevos >= MAX_PDFS) break;
  if ((r.sumario || '').length >= 500 || !r.linkFallo) continue;
  let u;
  try { u = new URL(r.linkFallo); } catch { continue; }
  if (u.protocol !== 'https:' || !/(^|\.)corteidh\.or\.cr$/i.test(u.hostname) || !/\.pdf(?:$|[?#])/i.test(u.href)) continue;
  const errorAnterior = estado.fallidos[r.id];
  if (errorAnterior && Date.now() - new Date(errorAnterior.fecha).getTime() < 7 * 86400000) continue;
  try {
    const falta = ultimo + PAUSA_MS - Date.now();
    if (falta > 0) await dormir(falta);
    ultimo = Date.now();
    const { buffer, contentType } = await descargar(r.linkFallo);
    const { texto } = await extraerDesdeBuffer(buffer, contentType, r.linkFallo);
    const normalizado = String(texto || '').replace(/\s+/g, ' ').trim();
    if (normalizado.length < 500) throw new Error('PDF sin capa de texto suficiente');
    r.sumario = normalizado.slice(0, 100000);
    r.textoCompleto = normalizado.length <= 100000 ? normalizado : undefined;
    delete estado.fallidos[r.id];
    reporte.pdfsNuevos++;
  } catch (e) {
    estado.fallidos[r.id] = { fecha: new Date().toISOString(), motivo: String(e.message).slice(0, 150) };
    if (reporte.errores.length < 25) reporte.errores.push({ id: r.id, error: estado.fallidos[r.id].motivo });
  }
  if ((reporte.pdfsNuevos + Object.keys(estado.fallidos).length) % 10 === 0) await guardar();
}
await guardar();
console.log(JSON.stringify(reporte));
