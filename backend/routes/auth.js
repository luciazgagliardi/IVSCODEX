/**
 * Cuentas de usuario: registro, login, logout y "quién soy".
 *
 *   POST /api/auth/registro  { email, password, nombre?, especialidad?, actualizaciones? } -> crea la cuenta y ya deja logueado
 *   PUT  /api/auth/perfil    { nombre, especialidad, actualizaciones } -> cambia los datos del perfil
 *   POST /api/auth/login     { email, password } -> nueva sesión
 *   POST /api/auth/logout                        -> cierra la sesión del token enviado
 *   GET  /api/auth/yo                             -> quién está logueado, si alguien
 *   GET  /api/mis-datos                           -> guardados e historial de la cuenta
 *   PUT  /api/mis-datos      { fav, hist }        -> los reemplaza
 *   POST /api/mis-datos/fusionar { fav, hist }    -> los une con lo que ya había
 *
 * El token de sesión va en "Authorization: Bearer <token>" (ver lib/sesiones.js
 * para por qué no es una cookie).
 */

import express from 'express';
import { crearUsuario, verificarCredenciales, buscarPorId, actualizarPerfil } from '../lib/usuarios.js';
import { crearSesion, usuarioDeToken, borrarSesion } from '../lib/sesiones.js';
import { leerDatos, guardarDatos, fusionarDatos } from '../lib/datosUsuario.js';
import { errores, ErrorApp } from '../lib/errores.js';

export const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Largos máximos: el correo de la norma llega a 254 caracteres; la contraseña
// se acota para que nadie mande megabytes a scrypt (agotar CPU/memoria).
const MAX_EMAIL = 254;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

// Nada de lo que devuelve este router debe quedar en cachés intermedias ni en
// el navegador: llevan tokens y datos personales.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/**
 * Freno por cuenta (además del límite por IP de index.js): tras 6 fallos
 * seguidos con el mismo correo se bloquea ese correo 15 minutos. Una
 * botnet con muchas IPs no puede probar contraseñas sin fin contra una
 * sola cuenta. En memoria: se reinicia con el servidor, y está acotado.
 */
const FALLOS = new Map();
const MAX_FALLOS = 6;
const BLOQUEO_MS = 15 * 60 * 1000;
function bloqueada(correo) {
  const f = FALLOS.get(correo);
  if (!f) return false;
  if (f.hasta && f.hasta > Date.now()) return true;
  if (f.hasta) FALLOS.delete(correo);
  return false;
}
function anotarFallo(correo) {
  if (FALLOS.size > 5000) FALLOS.clear(); // tope: no es un vector de memoria
  const f = FALLOS.get(correo) || { n: 0, hasta: 0 };
  f.n += 1;
  if (f.n >= MAX_FALLOS) { f.hasta = Date.now() + BLOQUEO_MS; f.n = 0; }
  FALLOS.set(correo, f);
}

function tokenDe(req) {
  const cab = req.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(cab.trim());
  return m && m[1].trim().length <= 200 ? m[1].trim() : null;
}

function validarEmailYPassword(email, password) {
  // Solo cadenas: un objeto en el JSON ({"$ne":""}) no debe llegar más lejos.
  if (!email || typeof email !== 'string') throw errores.emailFaltante();
  const correo = email.trim();
  if (correo.length > MAX_EMAIL || !EMAIL_RE.test(correo)) throw errores.emailInvalido();
  if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD
      || password.toLowerCase() === correo.toLowerCase()) throw errores.passwordDebil();
}

/** Middleware para rutas futuras que necesiten sesión. Deja req.usuarioId. */
export async function requiereSesion(req, res, next) {
  try {
    const usuarioId = await usuarioDeToken(tokenDe(req));
    if (!usuarioId) throw errores.noAutenticado();
    req.usuarioId = usuarioId;
    next();
  } catch (e) {
    next(e instanceof ErrorApp ? e : errores.noAutenticado());
  }
}

router.post('/auth/registro', async (req, res, next) => {
  try {
    const { email, password, nombre, especialidad, actualizaciones } = req.body || {};
    validarEmailYPassword(email, password);
    let usuario;
    try {
      usuario = await crearUsuario({ email, password, nombre, especialidad, actualizaciones });
    } catch (e) {
      if (e && e.codigo === 'EMAIL_YA_REGISTRADO') throw errores.emailYaRegistrado();
      throw e;
    }
    const token = await crearSesion(usuario.id);
    res.json({ ok: true, token, usuario });
  } catch (e) {
    next(e instanceof ErrorApp ? e : errores.emailInvalido());
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || typeof email !== 'string') throw errores.emailFaltante();
    if (!password || typeof password !== 'string' || password.length > MAX_PASSWORD || email.length > MAX_EMAIL) {
      throw errores.credencialesInvalidas();
    }
    const correo = email.trim().toLowerCase();
    if (bloqueada(correo)) throw errores.demasiadosIntentos();
    const usuario = await verificarCredenciales(email, password);
    if (!usuario) { anotarFallo(correo); throw errores.credencialesInvalidas(); }
    FALLOS.delete(correo);
    const token = await crearSesion(usuario.id);
    res.json({ ok: true, token, usuario });
  } catch (e) {
    next(e instanceof ErrorApp ? e : errores.credencialesInvalidas());
  }
});

router.post('/auth/logout', async (req, res, next) => {
  try {
    await borrarSesion(tokenDe(req));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.put('/auth/perfil', requiereSesion, async (req, res, next) => {
  try {
    const usuario = await actualizarPerfil(req.usuarioId, req.body || {});
    if (!usuario) throw errores.noAutenticado();
    res.json({ ok: true, usuario });
  } catch (e) {
    next(e instanceof ErrorApp ? e : errores.noAutenticado());
  }
});

router.get('/auth/yo', requiereSesion, async (req, res, next) => {
  try {
    const usuario = await buscarPorId(req.usuarioId);
    if (!usuario) throw errores.noAutenticado();
    res.json({ ok: true, usuario });
  } catch (e) {
    next(e instanceof ErrorApp ? e : errores.noAutenticado());
  }
});

/* ------------------------------------------------------------------ *
 * Lo que la persona guarda en su cuenta
 *
 * Antes esto vivia solo en el navegador y la cuenta no servia para nada.
 * Ahora las fuentes marcadas y las busquedas recientes viajan con el
 * usuario. Ver lib/datosUsuario.js.
 * ------------------------------------------------------------------ */

router.get('/mis-datos', requiereSesion, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await leerDatos(req.usuarioId)) });
  } catch (e) {
    next(e);
  }
});

router.put('/mis-datos', requiereSesion, async (req, res, next) => {
  try {
    const { fav, hist, pasajes, anillos } = req.body || {};
    res.json({ ok: true, ...(await guardarDatos(req.usuarioId, { fav, hist, pasajes, anillos })) });
  } catch (e) {
    next(e);
  }
});

/**
 * Al entrar desde un navegador que ya venia usandose sin cuenta, lo guardado
 * ahi no se tira: se suma a lo que la cuenta ya tenia.
 */
router.post('/mis-datos/fusionar', requiereSesion, async (req, res, next) => {
  try {
    const { fav, hist, pasajes, anillos } = req.body || {};
    res.json({ ok: true, ...(await fusionarDatos(req.usuarioId, { fav, hist, pasajes })) });
  } catch (e) {
    next(e);
  }
});
