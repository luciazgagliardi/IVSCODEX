/**
 * Cosecha el Poder Judicial de Río Negro para el acervo: Río Negro le niega
 * la conexión al servidor publicado (403 a todo, medido en vivo) y le contesta
 * a una conexión común, así que se baja desde acá y viaja en el acervo.
 *
 * Dos pasos, con avance guardado (se puede cortar y retomar):
 *   1. el listado de todas las sentencias (el buscador con «sentencia», que
 *      está en todas), de a 10 por página;
 *   2. el texto de cada una, de su PDF (los primeros LARGO caracteres), que es
 *      lo que después se busca, se muestra como pasaje y abre el Lector
 *      cuando el PDF no le llega al servidor.
 *
 *   node scripts/cosecharRioNegro.mjs              (Superior Tribunal)
 *   TRIBUNAL=CJ node scripts/cosecharRioNegro.mjs  (cámaras y juzgados: más de 220.000)
 *
 * Una consulta por vez, PAUSA_MS entre una y otra (2 s). Queda en
 * acervo-crudo/respaldo/rionegro.json.gz, que suma scripts/armarAcervo.mjs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parsear, totalDe } from '../lib/indiceRioNegro.js';
import { extraerDesdeBuffer } from '../lib/documento.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(aqui, '..', 'acervo-crudo', 'respaldo');
const SALIDA = path.join(DIR, 'rionegro.json.gz');
const TRIBUNAL = process.env.TRIBUNAL === 'CJ' ? 'CJ' : 'STJ';
const STJ = TRIBUNAL === 'CJ' ? '0' : '1';
const PROGRESO = path.join(DIR, `progreso-rionegro-${TRIBUNAL}.json`);
const PAUSA_MS = Number(process.env.PAUSA_MS || 2000);
const LARGO = Number(process.env.LARGO || 8000);
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; IVS-CODEX; acervo de jurisprudencia)', 'Accept-Language': 'es-AR,es;q=0.9' };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ultimo = 0;
async function pedir(url, tipo = 'text') {
  for (let intento = 1; ; intento++) {
    const falta = ultimo + PAUSA_MS - Date.now();
    if (falta > 0) await dormir(falta);
    ultimo = Date.now();
    try {
      const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`respuesta ${r.status}`);
      return tipo === 'buffer' ? { buffer: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get('content-type') || '' } : await r.text();
    } catch (e) {
      if (intento >= 5) throw e;
      console.log(`  ${new Date().toTimeString().slice(0, 8)} corte (${e.message}): espero ${intento * 2} min`);
      await dormir(intento * 120_000);
    }
  }
}
const leerJson = async (f, def) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return def; } };
async function cargar() { try { return new Map(JSON.parse(zlib.gunzipSync(await fs.readFile(SALIDA))).registros.map((r) => [r.id, r])); } catch { return new Map(); } }
async function guardar(mapa, progreso) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(SALIDA, zlib.gzipSync(JSON.stringify({ fuente: 'rionegro', generado: new Date().toISOString().slice(0, 10), registros: [...mapa.values()] })));
  await fs.writeFile(PROGRESO, JSON.stringify(progreso));
}

const mapa = await cargar();
const progreso = await leerJson(PROGRESO, { pagina: 1, total: null, listado: false });
const t0 = Date.now();
const urlPagina = (n) => `https://fallos.jusrionegro.gov.ar/protocoloweb/protocolo/buscar?${new URLSearchParams({ 'Datos[FilterProtocolo][texto]': 'sentencia', 'Datos[FilterProtocolo][stj]': STJ, page: String(n), 'per-page': '10' })}`;

// 1. el listado
while (!progreso.listado) {
  const html = await pedir(urlPagina(progreso.pagina));
  if (!progreso.total) progreso.total = totalDe(html);
  const regs = parsear(html, STJ);
  for (const r of regs) if (!mapa.has(r.id)) mapa.set(r.id, { ...r, sumario: '' }); // los fragmentos de «sentencia» no dicen nada
  if (!regs.length || progreso.pagina * 10 >= progreso.total) progreso.listado = true;
  progreso.pagina++;
  if (progreso.pagina % 25 === 0 || progreso.listado) {
    await guardar(mapa, progreso);
    console.log(`${new Date().toTimeString().slice(0, 8)} listado ${TRIBUNAL}: página ${progreso.pagina - 1} de ${Math.ceil(progreso.total / 10)}, ${mapa.size} fallos (${((Date.now() - t0) / 60000).toFixed(0)} min)`);
  }
}

// 2. el texto de cada PDF
let hechos = 0;
for (const r of mapa.values()) {
  if (r.sumario || r.sinTexto || !r.linkFallo || (STJ === '1') !== !/CÁMARA|UNIDAD|JUZGADO/i.test(r.tribunal)) continue;
  try {
    const { buffer, contentType } = await pedir(r.linkFallo, 'buffer');
    const doc = await extraerDesdeBuffer(buffer, contentType, r.linkFallo);
    const t = String(doc.texto || '').replace(/\s+/g, ' ').trim();
    if (t.length > 200) r.sumario = t.length > LARGO ? t.slice(0, LARGO).replace(/\s+\S*$/, '') + ' …' : t;
    else r.sinTexto = true;
  } catch (e) {
    r.sinTexto = true; // un escaneo sin texto o un PDF roto: se sigue con los demás
  }
  if (++hechos % 50 === 0) {
    await guardar(mapa, progreso);
    const con = [...mapa.values()].filter((x) => x.sumario).length;
    console.log(`${new Date().toTimeString().slice(0, 8)} textos: ${con} de ${mapa.size} (${((Date.now() - t0) / 60000).toFixed(0)} min)`);
  }
}
await guardar(mapa, progreso);
console.log(`fin: ${mapa.size} fallos, ${[...mapa.values()].filter((x) => x.sumario).length} con texto`);
