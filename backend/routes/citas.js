/**
 * Ruta del verificador de citas.
 *
 *   POST /api/verificar-cita  { texto } -> campos detectados + veredicto
 *
 * Se llama "verificar-cita" y no "verificar" a secas porque esa ya existe
 * (GET /api/verificar?url=, en routes/extraer.js, que dice si un enlace se
 * puede procesar). El guion sigue la forma que ya usan /api/extraer-archivo
 * y /api/ocr-archivo.
 *
 * Responde 200 aunque la cita no se pueda verificar: "no encontré nada" es
 * una respuesta legítima del servicio, no un error del pedido. Los únicos
 * errores de verdad son que no llegue texto o que llegue un escrito entero.
 * El veredicto y su cautela se arman en lib/verificarCita.js.
 */

import express from 'express';
import { verificarCita, alcanceDeVerificacion } from '../lib/verificarCita.js';
import { parsearCita } from '../lib/citas.js';
import { errores } from '../lib/errores.js';

export const router = express.Router();

/** Largo máximo del texto aceptado. Una cita larguísima entra holgada. */
const MAX_CARACTERES = 1200;

router.post('/verificar-cita', async (req, res, next) => {
  try {
    const texto = String(req.body?.texto || '').trim();
    if (!texto) throw errores.citaVacia();
    if (texto.length > MAX_CARACTERES) throw errores.citaDemasiadoLarga(MAX_CARACTERES);

    res.json(await verificarCita(texto));
  } catch (e) {
    next(e);
  }
});

/**
 * Solo el parseo, sin salir a la red.
 *
 * Sirve para ver qué entendió el lector de citas de un texto —es lo primero
 * que hay que mirar cuando una cita real vuelve como "no encontrada": nueve
 * de cada diez veces el problema es que la carátula se leyó mal, no que el
 * fallo no esté— y para probar formatos nuevos sin gastarle un pedido a
 * ningún sitio oficial.
 */
router.post('/leer-cita', (req, res, next) => {
  try {
    const texto = String(req.body?.texto || '').trim();
    if (!texto) throw errores.citaVacia();
    if (texto.length > MAX_CARACTERES) throw errores.citaDemasiadoLarga(MAX_CARACTERES);

    res.json({ ok: true, campos: parsearCita(texto), alcance: alcanceDeVerificacion() });
  } catch (e) {
    next(e);
  }
});
