/**
 * Escritura segura de los JSON de cuentas y sesiones.
 *
 * Dos problemas que evita:
 *   - Archivo a medio escribir: si el proceso se corta justo en un
 *     writeFile, el JSON queda truncado y se pierden TODAS las cuentas. Se
 *     escribe a un temporal y se renombra (rename es atómico).
 *   - Carrera entre pedidos: dos registros a la vez leían el mismo archivo y
 *     el último en escribir pisaba al otro. Todas las operaciones sobre un
 *     mismo archivo pasan por una cola (una a la vez).
 *
 * Los archivos se crean con permiso 0600: solo el usuario del proceso.
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const colas = new Map();

/** Ejecuta `tarea` después de las anteriores con la misma clave. */
export function enCola(clave, tarea) {
  const previa = colas.get(clave) || Promise.resolve();
  const actual = previa.then(tarea, tarea);
  colas.set(clave, actual.catch(() => {}));
  return actual;
}

export async function escribirJsonAtomico(archivo, dato) {
  const tmp = `${archivo}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(dato), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tmp, archivo);
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

/** Lee un JSON; si no existe devuelve `vacio`, y si está corrupto lo avisa y devuelve `vacio`. */
export async function leerJson(archivo, vacio = {}) {
  try {
    return JSON.parse(await fs.readFile(archivo, 'utf8'));
  } catch (e) {
    if (e && e.code !== 'ENOENT') console.error('[almacen] no se pudo leer', archivo.split(/[\\/]/).pop());
    return vacio;
  }
}
