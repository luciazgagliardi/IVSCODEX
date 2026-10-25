/**
 * Rutas de la API.
 *
 *   POST   /api/extraer          { url, refrescar? }  -> texto del documento
 *   POST   /api/ocr              { url, refrescar? }  -> texto vía OCR (PDF escaneado)
 *   POST   /api/extraer-archivo  bytes del archivo    -> texto del documento
 *   POST   /api/ocr-archivo      bytes del archivo    -> texto vía OCR (PDF escaneado)
 *   GET    /api/salud                                 -> estado del servidor
 *   GET    /api/dominios                              -> lista blanca vigente
 *   DELETE /api/cache                                 -> vacia el cache
 */

import os from 'node:os';
import { estadoCorpus } from '../lib/corpusCorteidh.js';
import { buscarFalloEnSaij } from '../lib/textoSaij.js';
import express from 'express';
import crypto from 'node:crypto';
import { dominioHabilitado } from '../lib/descargador.js';
import {
  obtenerDocumento,
  ocrDocumento,
  extraerDesdeBuffer,
  destaparPdf,
  detectarTipo,
} from '../lib/documento.js';
import { ocrPdf } from '../lib/ocr.js';
import { vaciarCache } from '../lib/cache.js';
import { errores, ErrorApp } from '../lib/errores.js';
import {
  DOMINIOS_PERMITIDOS,
  PERMITIR_CUALQUIER_DOMINIO,
  CACHE_HORAS,
  MAX_BYTES,
  TIMEOUT_MS,
  OCR_HABILITADO,
} from '../config.js';

export const router = express.Router();

/** Largo máximo de un enlace aceptado (los navegadores cortan en ~2000). */
const MAX_URL = 2048;

/** El enlace tiene que ser una cadena razonable: no un objeto ni un texto enorme. */
function urlDe(valor) {
  if (typeof valor !== 'string' || !valor.trim()) throw errores.urlFaltante();
  if (valor.length > MAX_URL) throw errores.urlInvalida('es demasiado largo');
  return valor.trim();
}

router.post('/extraer', async (req, res, next) => {
  try {
    const { refrescar } = req.body || {};
    const url = urlDe(req.body?.url);
    const arranque = Date.now();
    let salida;
    try {
      salida = await obtenerDocumento(url, { refrescar });
    } catch (e) {
      // la base no entregó el documento: el mismo fallo en SAIJ, por carátula y fecha
      const f = req.body?.ficha;
      const enSaij = f && typeof f.caratula === 'string' && typeof f.fecha === 'string' && !/saij\.gob\.ar/.test(url)
        ? await buscarFalloEnSaij(f.caratula.slice(0, 300), f.fecha.slice(0, 20)).catch(() => null) : null;
      if (!enSaij || e?.codigo === 'PDF_ESCANEADO') throw e;
      salida = { ...(await obtenerDocumento(`https://www.saij.gob.ar/${enSaij}`)), urlOriginal: url };
    }
    res.json({ ...salida, ms: Date.now() - arranque });
  } catch (e) {
    next(e);
  }
});

/**
 * El OCR es mucho más lento y pesado que la extracción normal (segundos por
 * página, contra milisegundos), así que es un botón aparte que la persona
 * pide a propósito cuando /api/extraer le avisó PDF_ESCANEADO — no algo que
 * se intenta solo. Ver lib/ocr.js y limiteOcr en index.js.
 */
router.post('/ocr', async (req, res, next) => {
  try {
    const { refrescar } = req.body || {};
    const url = urlDe(req.body?.url);
    const arranque = Date.now();
    const salida = await ocrDocumento(url, { refrescar });
    res.json({ ...salida, ms: Date.now() - arranque });
  } catch (e) {
    next(e);
  }
});

/**
 * Lee un archivo que la persona sube desde su computadora.
 *
 * Llega como bytes crudos en el cuerpo (express.raw, sin dependencias
 * nuevas: no hace falta multipart para un unico archivo). El nombre viaja
 * en la cabecera X-Nombre-Archivo solo para poder nombrarlo en la respuesta
 * —para decidir como leerlo mandan los bytes, no la extension.
 *
 * No se cachea: el cache va por URL y aca no hay ninguna. Tampoco se
 * guarda el archivo en el servidor; se lee en memoria y se devuelve el
 * texto.
 */
router.post(
  '/extraer-archivo',
  express.raw({ type: () => true, limit: MAX_BYTES }),
  async (req, res, next) => {
    try {
      const arranque = Date.now();
      const crudo = req.body;
      if (!Buffer.isBuffer(crudo) || !crudo.length) throw errores.archivoVacio();

      const nombre = String(req.get('X-Nombre-Archivo') || '').slice(0, 200);

      let resultado;
      try {
        resultado = await extraerDesdeBuffer(crudo, req.get('Content-Type') || '');
      } catch (e) {
        // "El servidor devolvió tal tipo" no tiene sentido cuando el archivo
        // lo puso la persona: acá el problema es el archivo que eligió.
        if (e?.codigo === 'TIPO_NO_SOPORTADO') throw errores.archivoNoSoportado(nombre);
        throw e;
      }

      res.json({
        ok: true,
        url: '',
        urlFinal: '',
        origen: 'archivo',
        nombreArchivo: nombre,
        redirecciones: 0,
        tipo: resultado.tipo,
        titulo: resultado.titulo || '',
        texto: resultado.texto,
        caracteres: resultado.texto.length,
        palabras: resultado.texto.split(/\s+/).filter(Boolean).length,
        paginas: resultado.paginas || null,
        metodo: resultado.metodo,
        bytesDescargados: crudo.length,
        obtenidoEn: new Date().toISOString(),
        desdeCache: false,
        ms: Date.now() - arranque,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Igual que /api/ocr pero para un archivo subido en vez de un enlace: sirve
 * para lo que no se puede bajar solo (por ejemplo, un sitio que le niega la
 * conexión al datacenter publicado) — se abre a mano en el navegador, se
 * guarda, y se sube acá para que el OCR corra sin salir de la página.
 */
router.post(
  '/ocr-archivo',
  express.raw({ type: () => true, limit: MAX_BYTES }),
  async (req, res, next) => {
    try {
      if (!OCR_HABILITADO) throw errores.ocrDeshabilitado();

      const arranque = Date.now();
      const crudo = req.body;
      if (!Buffer.isBuffer(crudo) || !crudo.length) throw errores.archivoVacio();

      const nombre = String(req.get('X-Nombre-Archivo') || '').slice(0, 200);
      const buffer = destaparPdf(crudo);
      const tipo = detectarTipo(buffer, req.get('Content-Type') || '');
      if (tipo !== 'pdf') throw errores.ocrSoloPdf(tipo);

      const resultado = await ocrPdf(buffer);

      res.json({
        ok: true,
        url: '',
        urlFinal: '',
        origen: 'archivo',
        nombreArchivo: nombre,
        redirecciones: 0,
        tipo: 'pdf',
        titulo: '',
        texto: resultado.texto,
        caracteres: resultado.texto.length,
        palabras: resultado.texto.split(/\s+/).filter(Boolean).length,
        paginas: resultado.paginas,
        paginasProcesadas: resultado.paginasProcesadas,
        metodo: 'ocr',
        bytesDescargados: crudo.length,
        obtenidoEn: new Date().toISOString(),
        desdeCache: false,
        ms: Date.now() - arranque,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get('/salud', (req, res) => {
  // Cualquiera puede preguntar si el servidor está vivo (el frontend lo hace al
  // abrir). El detalle —memoria, claves configuradas, avance de índices— es
  // información para atacar y sólo se entrega a quien administra.
  if (!puedeAdministrar(req)) return res.json({ ok: true, servicio: 'juris-et-de-jure' });
  res.json({
    ok: true,
    servicio: 'juris-et-de-jure',
    cacheHoras: CACHE_HORAS,
    maxMB: Math.round(MAX_BYTES / 1024 / 1024),
    timeoutSeg: Math.round(TIMEOUT_MS / 1000),
    modoAbierto: PERMITIR_CUALQUIER_DOMINIO,
    dominiosPermitidos: DOMINIOS_PERMITIDOS.length,
    ocrHabilitado: OCR_HABILITADO,
    // Solo un sí o un no (nunca la dirección ni la clave): sirve para saber si el relevo del TSJ está activo.
    releConfigurado: Boolean(process.env.RELE_URL && process.env.RELE_CLAVE),
    // Avance del índice de texto de la Corte IDH (lib/corpusCorteidh.js).
    corpusCorteidh: estadoCorpus(),
    // Para vigilar que el índice de texto y Chrome no aprieten la memoria del plan.
    memoriaMB: { proceso: Math.round(process.memoryUsage().rss / 1e6), libreEquipo: Math.round(os.freemem() / 1e6) },
  });
});

router.get('/dominios', (_req, res) => {
  res.json({ ok: true, modoAbierto: PERMITIR_CUALQUIER_DOMINIO, dominios: DOMINIOS_PERMITIDOS });
});

/** Chequeo rapido, sin descargar: ¿este enlace lo puedo procesar? */
router.get('/verificar', (req, res) => {
  const url = String(req.query.url || '');
  try {
    const u = new URL(url);
    const okEsquema = u.protocol === 'http:' || u.protocol === 'https:';
    const okDominio = dominioHabilitado(u.hostname);
    res.json({ ok: true, valida: okEsquema && okDominio, host: u.hostname, okEsquema, okDominio });
  } catch {
    res.json({ ok: true, valida: false, host: null, okEsquema: false, okDominio: false });
  }
});

/**
 * Vaciar el cache cambia el comportamiento de todos (cada documento vuelve a
 * pedirse al sitio oficial) y antes lo podía hacer cualquiera: se exige la
 * clave de administración (ADMIN_TOKEN, cabecera X-Admin-Token). Sin
 * ADMIN_TOKEN configurado, solo se acepta desde la propia máquina y fuera de
 * producción.
 */
function puedeAdministrar(req) {
  const clave = process.env.ADMIN_TOKEN || '';
  if (clave) {
    const dada = String(req.get('X-Admin-Token') || '');
    const a = crypto.createHash('sha256').update(dada).digest();
    const b = crypto.createHash('sha256').update(clave).digest();
    return crypto.timingSafeEqual(a, b);
  }
  const ip = req.socket?.remoteAddress || '';
  const local = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  return local && process.env.NODE_ENV !== 'production' && !req.get('X-Forwarded-For');
}

router.delete('/cache', async (req, res, next) => {
  try {
    if (!puedeAdministrar(req)) throw errores.prohibido();
    const n = await vaciarCache();
    res.json({ ok: true, borradas: n });
  } catch (e) {
    next(e);
  }
});

/**
 * Manejador de errores propio de la API: siempre responde JSON y nunca
 * devuelve detalles internos (stack, rutas, mensajes de librerías). El
 * detalle completo va solo al registro del servidor.
 */
export function manejadorErrores(err, req, res, _next) {
  if (res.headersSent) return;
  if (err instanceof ErrorApp) {
    return res.status(err.http).json(err.aJSON());
  }
  // Errores del analizador del cuerpo (express.json / express.raw).
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json(errores.cuerpoDemasiado().aJSON());
  }
  if (err && (err.type === 'entity.parse.failed' || err.type === 'encoding.unsupported' || err instanceof SyntaxError)) {
    return res.status(400).json(errores.cuerpoInvalido().aJSON());
  }
  console.error('[error no previsto]', req?.method, req?.path, err && err.stack ? err.stack : err);
  res.status(500).json({
    ok: false,
    codigo: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado en el servidor. Intente de nuevo en unos minutos.',
  });
}
