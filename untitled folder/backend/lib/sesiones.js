/**
 * Sesiones de usuario: un token opaco por sesión, guardado en disco.
 *
 * El token viaja en el header "Authorization: Bearer <token>" — no en una
 * cookie. El frontend (GitHub Pages) y el backend (Azure) viven en dominios
 * distintos, y una cookie de sesión entre dominios distintos exige
 * SameSite=None + Secure + credentials en los dos lados; un header evita
 * toda esa superficie para esta primera versión.
 *
 * Sin vencimiento automático todavía: una sesión dura hasta que se cierra
 * con logout. Es una simplificación deliberada, no un olvido.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIR_USUARIOS } from '../config.js';

const ARCHIVO = path.join(DIR_USUARIOS, 'sesiones.json');

let listo = false;
async function asegurarCarpeta() {
  if (listo) return;
  await fs.mkdir(DIR_USUARIOS, { recursive: true });
  listo = true;
}

async function leerTodas() {
  try {
    await asegurarCarpeta();
    const crudo = await fs.readFile(ARCHIVO, 'utf8');
    return JSON.parse(crudo);
  } catch {
    return {};
  }
}

async function escribirTodas(dato) {
  await asegurarCarpeta();
  await fs.writeFile(ARCHIVO, JSON.stringify(dato), 'utf8');
}

export async function crearSesion(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  const dato = await leerTodas();
  dato[token] = { usuarioId, creadaEn: Date.now() };
  await escribirTodas(dato);
  return token;
}

export async function usuarioDeToken(token) {
  if (!token) return null;
  const dato = await leerTodas();
  const sesion = dato[token];
  return sesion ? sesion.usuarioId : null;
}

export async function borrarSesion(token) {
  if (!token) return;
  const dato = await leerTodas();
  if (dato[token]) {
    delete dato[token];
    await escribirTodas(dato);
  }
}
