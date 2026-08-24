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
import { DIR_USUARIOS } from '../config.js';

const ARCHIVO = path.join(DIR_USUARIOS, 'usuarios.json');

let listo = false;
async function asegurarCarpeta() {
  if (listo) return;
  await fs.mkdir(DIR_USUARIOS, { recursive: true });
  listo = true;
}

async function leerTodos() {
  try {
    await asegurarCarpeta();
    const crudo = await fs.readFile(ARCHIVO, 'utf8');
    return JSON.parse(crudo);
  } catch {
    return {}; // no existe todavía, o está corrupto
  }
}

async function escribirTodos(dato) {
  await asegurarCarpeta();
  await fs.writeFile(ARCHIVO, JSON.stringify(dato), 'utf8');
}

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** scrypt con sal aleatoria. Devuelve "sal:hash", ambos en hex. */
function hashearPassword(password) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, sal, 64);
  return `${sal.toString('hex')}:${hash.toString('hex')}`;
}

/** Compara a tiempo constante, sin filtrar por cuánto tardó la respuesta. */
function passwordCoincide(password, guardado) {
  const [salHex, hashHex] = String(guardado || '').split(':');
  if (!salHex || !hashHex) return false;
  const sal = Buffer.from(salHex, 'hex');
  const hashGuardado = Buffer.from(hashHex, 'hex');
  const hashIntento = crypto.scryptSync(password, sal, 64);
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
  const dato = await leerTodos();
  if (dato[correo]) {
    const e = new Error('EMAIL_YA_REGISTRADO');
    e.codigo = 'EMAIL_YA_REGISTRADO';
    throw e;
  }
  const usuario = {
    id: crypto.randomUUID(),
    email: correo,
    passwordHash: hashearPassword(password),
    creadoEn: Date.now(),
  };
  dato[correo] = usuario;
  await escribirTodos(dato);
  return sinPassword(usuario);
}

/** Devuelve el usuario (sin el hash) si el correo y la contraseña coinciden, si no null. */
export async function verificarCredenciales(email, password) {
  const correo = normalizarEmail(email);
  const dato = await leerTodos();
  const usuario = dato[correo];
  if (!usuario || !passwordCoincide(password, usuario.passwordHash)) return null;
  return sinPassword(usuario);
}

export async function buscarPorId(id) {
  const dato = await leerTodos();
  const usuario = Object.values(dato).find((u) => u.id === id);
  return sinPassword(usuario);
}
