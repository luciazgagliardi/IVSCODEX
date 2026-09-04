/**
 * Cuentas de usuario: registro, login, logout y "quién soy".
 *
 *   POST /api/auth/registro  { email, password } -> crea la cuenta y ya deja logueado
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
import { crearUsuario, verificarCredenciales, buscarPorId } from '../lib/usuarios.js';
import { crearSesion, usuarioDeToken, borrarSesion } from '../lib/sesiones.js';
import { leerDatos, guardarDatos, fusionarDatos } from '../lib/datosUsuario.js';
import { errores, ErrorApp } from '../lib/errores.js';

export const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenDe(req) {
  const cab = req.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(cab.trim());
  return m ? m[1].trim() : null;
}

function validarEmailYPassword(email, password) {
  if (!email) throw errores.emailFaltante();
  if (!EMAIL_RE.test(String(email).trim())) throw errores.emailInvalido();
  if (!password || String(password).length < 8) throw errores.passwordDebil();
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
    const { email, password } = req.body || {};
    validarEmailYPassword(email, password);
    let usuario;
    try {
      usuario = await crearUsuario({ email, password });
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
    if (!email) throw errores.emailFaltante();
    if (!password) throw errores.credencialesInvalidas();
    const usuario = await verificarCredenciales(email, password);
    if (!usuario) throw errores.credencialesInvalidas();
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
