/**
 * Sesiones de usuario: un token opaco por sesión, guardado en disco.
 *
 * El token viaja en el header "Authorization: Bearer <token>" — no en una
 * cookie. El frontend (GitHub Pages) y el backend (Azure) viven en dominios
 * distintos, y una cookie de sesión entre dominios distintos exige
 * SameSite=None + Secure + credentials en los dos lados; un header evita
 * toda esa superficie para esta primera versión.
 *
 * Seguridad:
 *   - En disco se guarda el SHA-256 del token, no el token: si alguien lee el
 *     archivo (un backup, un error de permisos) no puede usar las sesiones.
 *   - Cada sesión vence a los 30 días y se purgan al escribir.
 *   - Un usuario conserva como mucho 10 sesiones: la más vieja se descarta.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIR_USUARIOS } from '../config.js';
import { enCola, escribirJsonAtomico, leerJson } from './almacen.js';

const ARCHIVO = path.join(DIR_USUARIOS, 'sesiones.json');

const VIDA_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const MAX_POR_USUARIO = 10;

let listo = false;
async function asegurarCarpeta() {
  if (listo) return;
  await fs.mkdir(DIR_USUARIOS, { recursive: true, mode: 0o700 });
  listo = true;
}

async function leerTodas() {
  await asegurarCarpeta();
  return leerJson(ARCHIVO, {});
}

/** Lo que se guarda y se busca en disco: nunca el token en claro. */
const huella = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const vigente = (s) => s && typeof s.creadaEn === 'number' && Date.now() - s.creadaEn < VIDA_MS;

function purgar(dato) {
  for (const k of Object.keys(dato)) if (!vigente(dato[k])) delete dato[k];
}

export async function crearSesion(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  await enCola(ARCHIVO, async () => {
    const dato = await leerTodas();
    purgar(dato);
    const propias = Object.entries(dato)
      .filter(([, s]) => s.usuarioId === usuarioId)
      .sort((a, b) => a[1].creadaEn - b[1].creadaEn);
    while (propias.length >= MAX_POR_USUARIO) delete dato[propias.shift()[0]];
    dato[huella(token)] = { usuarioId, creadaEn: Date.now() };
    await escribirJsonAtomico(ARCHIVO, dato);
  });
  return token;
}

export async function usuarioDeToken(token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const dato = await leerTodas();
  // Las sesiones creadas antes de este cambio estaban guardadas con el token
  // en claro: se aceptan una vez y se pasan a su huella.
  const clave = Object.prototype.hasOwnProperty.call(dato, huella(token)) ? huella(token)
    : (Object.prototype.hasOwnProperty.call(dato, token) ? token : null);
  const sesion = clave ? dato[clave] : null;
  if (!vigente(sesion)) return null;
  if (clave === token) {
    enCola(ARCHIVO, async () => {
      const d = await leerTodas();
      if (d[token]) { d[huella(token)] = d[token]; delete d[token]; await escribirJsonAtomico(ARCHIVO, d); }
    }).catch(() => {});
  }
  return sesion.usuarioId;
}

export async function borrarSesion(token) {
  if (!token || typeof token !== 'string') return;
  await enCola(ARCHIVO, async () => {
    const dato = await leerTodas();
    let cambio = false;
    for (const k of [huella(token), token]) if (dato[k]) { delete dato[k]; cambio = true; }
    if (cambio) await escribirJsonAtomico(ARCHIVO, dato);
  });
}
