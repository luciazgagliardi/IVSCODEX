/**
 * Rutas de la API.
 *
 *   POST   /api/extraer      { url, refrescar? }  -> texto del documento
 *   GET    /api/salud                             -> estado del servidor
 *   GET    /api/dominios                          -> lista blanca vigente
 *   DELETE /api/cache                             -> vacia el cache
 */

import express from 'express';
import { descargar, aTexto, dominioHabilitado } from '../lib/descargador.js';
import { extraerHtml } from '../lib/extraerHtml.js';
import { extraerPdf } from '../lib/extraerPdf.js';
import { leerCache, escribirCache, vaciarCache } from '../lib/cache.js';
import { errores, ErrorApp } from '../lib/errores.js';
import {
  DOMINIOS_PERMITIDOS,
  PERMITIR_CUALQUIER_DOMINIO,
  CACHE_HORAS,
  MAX_BYTES,
  TIMEOUT_MS,
} from '../config.js';

export const router = express.Router();

/** Firma del contenido segun cabecera y bytes iniciales. */
function detectarTipo(buffer, contentType) {
  const ct = (contentType || '').toLowerCase();
  const magia = buffer.subarray(0, 5).toString('latin1');

  if (magia === '%PDF-') return 'pdf';           // la firma manda sobre la cabecera
  if (ct.includes('application/pdf')) return 'pdf';
  if (ct.includes('html') || ct.includes('xhtml')) return 'html';
  if (ct.includes('text/plain')) return 'texto';
  if (ct.includes('xml')) return 'html';

  // Sin cabecera util: miramos si parece HTML.
  const cabeza = buffer.subarray(0, 1024).toString('latin1').toLowerCase();
  if (cabeza.includes('<html') || cabeza.includes('<!doctype html')) return 'html';
  return null;
}

router.post('/extraer', async (req, res, next) => {
  try {
    const { url, refrescar } = req.body || {};
    if (!url) throw errores.urlFaltante();

    const arranque = Date.now();

    // 1. Cache
    if (!refrescar) {
      const guardado = await leerCache(url);
      if (guardado) {
        return res.json({ ...guardado, ok: true, desdeCache: true, ms: Date.now() - arranque });
      }
    }

    // 2. Descarga (valida esquema, dominio, DNS y redirecciones)
    const { buffer, contentType, urlFinal, saltos } = await descargar(url);

    // 3. Extraccion segun tipo
    const tipo = detectarTipo(buffer, contentType);
    let resultado;

    if (tipo === 'pdf') {
      resultado = await extraerPdf(buffer);
    } else if (tipo === 'html') {
      resultado = extraerHtml(aTexto(buffer, contentType), urlFinal);
    } else if (tipo === 'texto') {
      const t = aTexto(buffer, contentType).trim();
      if (t.length < 120) throw errores.htmlSinTexto();
      resultado = { titulo: '', texto: t, metodo: 'texto-plano' };
    } else {
      throw errores.tipoNoSoportado(contentType);
    }

    const salida = {
      ok: true,
      url,
      urlFinal,
      redirecciones: saltos.length - 1,
      tipo,
      titulo: resultado.titulo || '',
      texto: resultado.texto,
      caracteres: resultado.texto.length,
      palabras: resultado.texto.split(/\s+/).filter(Boolean).length,
      paginas: resultado.paginas || null,
      metodo: resultado.metodo,
      bytesDescargados: buffer.length,
      obtenidoEn: new Date().toISOString(),
      desdeCache: false,
    };

    // 4. Cache (si falla, no le arruina la respuesta a nadie)
    escribirCache(url, salida).catch(() => {});

    res.json({ ...salida, ms: Date.now() - arranque });
  } catch (e) {
    next(e);
  }
});

router.get('/salud', (_req, res) => {
  res.json({
    ok: true,
    servicio: 'juris-et-de-jure',
    node: process.version,
    tiempoActivoSeg: Math.round(process.uptime()),
    cacheHoras: CACHE_HORAS,
    maxMB: Math.round(MAX_BYTES / 1024 / 1024),
    timeoutSeg: Math.round(TIMEOUT_MS / 1000),
    modoAbierto: PERMITIR_CUALQUIER_DOMINIO,
    dominiosPermitidos: DOMINIOS_PERMITIDOS.length,
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

router.delete('/cache', async (_req, res, next) => {
  try {
    const n = await vaciarCache();
    res.json({ ok: true, borradas: n });
  } catch (e) {
    next(e);
  }
});

/** Manejador de errores propio de la API: siempre responde JSON. */
export function manejadorErrores(err, _req, res, _next) {
  if (err instanceof ErrorApp) {
    return res.status(err.http).json(err.aJSON());
  }
  console.error('[error no previsto]', err);
  res.status(500).json({
    ok: false,
    codigo: 'ERROR_INTERNO',
    mensaje: 'Se rompió algo del lado del servidor. Mirá la consola donde corre npm start para ver el detalle.',
  });
}
