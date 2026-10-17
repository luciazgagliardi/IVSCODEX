/**
 * Cuentas de usuario, en un solo archivo JSON.
 *
 * Mismo espíritu que lib/indice.js: nada de base de datos, un objeto simple
 * en disco. Alcanza y sobra para la escala de hoy; si el día de mañana hace
 * falta algo más serio, migrar desde acá es un problema conocido.
 *
 * Las contraseñas nunca se guardan en texto plano: se hashean con scrypt
 * (parte del núcleo de Node, sin dependencia nueva) con una sal por usuario.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { DIR_USUARIOS } from '../config.js';
import { enCola, escribirJsonAtomico, leerJson } from './almacen.js';

const ARCHIVO = path.join(DIR_USUARIOS, 'usuarios.json');

// scrypt asíncrono: la versión síncrona (scryptSync) bloquea todo el servidor
// ~50 ms por intento, y con ráfagas de logins alcanza para dejarlo sin
// responder (denegación de servicio). Los parámetros son los mismos que usaba
// scryptSync, así que los hashes ya guardados siguen siendo válidos.
const scrypt = promisify(crypto.scrypt);
const LARGO_HASH = 64;

let listo = false;
async function asegurarCarpeta() {
  if (listo) return;
  await fs.mkdir(DIR_USUARIOS, { recursive: true, mode: 0o700 });
  listo = true;
}

async function leerTodos() {
  await asegurarCarpeta();
  return leerJson(ARCHIVO, {});
}

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** scrypt con sal aleatoria. Devuelve "sal:hash", ambos en hex. */
async function hashearPassword(password) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(String(password), sal, LARGO_HASH);
  return `${sal.toString('hex')}:${hash.toString('hex')}`;
}

// Hash de relleno: si el correo no existe se calcula igual un scrypt contra
// éste, así "no existe" y "contraseña incorrecta" tardan lo mismo y no se
// pueden distinguir midiendo tiempos (enumeración de cuentas).
const SAL_RELLENO = crypto.randomBytes(16);

/** Compara a tiempo constante, sin filtrar por cuánto tardó la respuesta. */
async function passwordCoincide(password, guardado) {
  const [salHex, hashHex] = String(guardado || '').split(':');
  if (!salHex || !hashHex) {
    await scrypt(String(password), SAL_RELLENO, LARGO_HASH);
    return false;
  }
  const sal = Buffer.from(salHex, 'hex');
  const hashGuardado = Buffer.from(hashHex, 'hex');
  const hashIntento = await scrypt(String(password), sal, LARGO_HASH);
  if (hashIntento.length !== hashGuardado.length) return false;
  return crypto.timingSafeEqual(hashIntento, hashGuardado);
}

function sinPassword(u) {
  if (!u) return null;
  const { passwordHash, ...resto } = u;
  return resto;
}

/** Crea un usuario nuevo. Tira EMAIL_YA_REGISTRADO si el correo ya existe. */
export async function crearUsuario({ email, password }) {
  const correo = normalizarEmail(email);
  const passwordHash = await hashearPassword(password);
  // Lectura + escritura en cola: dos registros simultáneos no se pisan.
  return enCola(ARCHIVO, async () => {
    const dato = await leerTodos();
    if (Object.prototype.hasOwnProperty.call(dato, correo)) {
      const e = new Error('EMAIL_YA_REGISTRADO');
      e.codigo = 'EMAIL_YA_REGISTRADO';
      throw e;
    }
    const usuario = { id: crypto.randomUUID(), email: correo, passwordHash, creadoEn: Date.now() };
    dato[correo] = usuario;
    await escribirJsonAtomico(ARCHIVO, dato);
    return sinPassword(usuario);
  });
}

/** Devuelve el usuario (sin el hash) si el correo y la contraseña coinciden, si no null. */
export async function verificarCredenciales(email, password) {
  const correo = normalizarEmail(email);
  const dato = await leerTodos();
  const usuario = Object.prototype.hasOwnProperty.call(dato, correo) ? dato[correo] : null;
  const coincide = await passwordCoincide(password, usuario ? usuario.passwordHash : '');
  return usuario && coincide ? sinPassword(usuario) : null;
}

export async function buscarPorId(id) {
  const dato = await leerTodos();
  const usuario = Object.values(dato).find((u) => u.id === id);
  return sinPassword(usuario);
}
export async function buscarPorEmail(email) {
  const correo = normalizarEmail(email);
  const dato = await leerTodos();
  const usuario = Object.prototype.hasOwnProperty.call(dato, correo)
}