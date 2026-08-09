/**
 * Cache en disco, deliberadamente simple.
 *
 * Sirve para dos cosas: que vuelvas a abrir el mismo fallo al instante, y
 * que no le pidas veinte veces el mismo documento al servidor de la Corte.
 * Lo segundo importa: un extractor prolijo golpea poco y avisa quien es.
 *
 * Cada entrada es un JSON con nombre igual al hash de la URL.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIR_CACHE, CACHE_HORAS } from '../config.js';

let listo = false;

async function asegurarCarpeta() {
  if (listo) return;
  await fs.mkdir(DIR_CACHE, { recursive: true });
  listo = true;
}

function archivoDe(url) {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 32);
  return path.join(DIR_CACHE, `${hash}.json`);
}

/** Devuelve la entrada si existe y no vencio; si no, null. */
export async function leerCache(url) {
  if (CACHE_HORAS <= 0) return null;
  try {
    await asegurarCarpeta();
    const crudo = await fs.readFile(archivoDe(url), 'utf8');
    const dato = JSON.parse(crudo);
    const vencimiento = (dato.guardadoEn || 0) + CACHE_HORAS * 3600 * 1000;
    if (Date.now() > vencimiento) return null;
    return dato;
  } catch {
    return null; // no existe, esta corrupta o no se puede leer: da igual
  }
}

/** Guarda la entrada. Si falla, no interrumpe la respuesta al usuario. */
export async function escribirCache(url, dato) {
  if (CACHE_HORAS <= 0) return;
  try {
    await asegurarCarpeta();
    await fs.writeFile(
      archivoDe(url),
      JSON.stringify({ ...dato, guardadoEn: Date.now() }),
      'utf8'
    );
  } catch (e) {
    console.warn('[cache] no pude guardar:', e.message);
  }
}

/** Borra todo el cache. Lo usa la ruta DELETE /api/cache. */
export async function vaciarCache() {
  try {
    await asegurarCarpeta();
    const archivos = await fs.readdir(DIR_CACHE);
    let n = 0;
    for (const a of archivos) {
      if (a.endsWith('.json')) {
        await fs.unlink(path.join(DIR_CACHE, a));
        n++;
      }
    }
    return n;
  } catch {
    return 0;
  }
}
