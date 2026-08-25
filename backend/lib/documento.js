/**
 * Traer un documento judicial y devolverlo como texto.
 *
 * Esto vivia dentro de routes/extraer.js. Se saco a un modulo propio cuando
 * apareci&oacute; un segundo consumidor: la ruta de fragmentos del indice
 * (routes/indice.js), que necesita exactamente lo mismo —descargar, detectar
 * el tipo, extraer, cachear— pero para varios documentos de una y quedandose
 * solo con un pasaje de cada uno. Una sola implementacion, un solo cache.
 */

import { descargar, aTexto } from './descargador.js';
import { extraerHtml } from './extraerHtml.js';
import { extraerPdf } from './extraerPdf.js';
import { extraerDoc } from './extraerDoc.js';
import { ocrPdf } from './ocr.js';
import { leerCache, escribirCache } from './cache.js';
import { errores } from './errores.js';
import { OCR_HABILITADO } from '../config.js';

/**
 * Algunos servidores judiciales viejos (visto en el TSJ de CABA) no sirven
 * el PDF pelado: lo envuelven en un preambulo tipo correo (Content-Type,
 * Content-ID...) antes del "%PDF-". Si la firma no esta al principio pero
 * aparece mas adelante, recortamos ahi. Si no aparece en ningun lado, el
 * buffer vuelve intacto y sigue el flujo normal de deteccion.
 */
export function destaparPdf(buffer) {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return buffer;
  const cabeza = buffer.subarray(0, 2048).toString('latin1');
  const i = cabeza.indexOf('%PDF-');
  return i > 0 ? buffer.subarray(i) : buffer;
}

// Firma del "Compound File Binary" — el contenedor de los .doc viejos
// (Word 97-2003), tambien usado por .xls/.ppt de esa era. Visto en fallos
// de CABA anteriores al expediente judicial electronico (ver indiceCaba.js):
// el sitio los sirve con Content-Type "doc" a secas, asi que la firma manda.
const MAGIA_OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** Firma del contenido segun cabecera y bytes iniciales. */
export function detectarTipo(buffer, contentType) {
  const ct = (contentType || '').toLowerCase();
  const magia = buffer.subarray(0, 5).toString('latin1');

  if (magia === '%PDF-') return 'pdf';           // la firma manda sobre la cabecera
  if (buffer.subarray(0, 8).equals(MAGIA_OLE2)) return 'doc';
  if (ct.includes('application/pdf')) return 'pdf';
  if (ct.includes('msword') || ct === 'doc' || ct.includes('/doc')) return 'doc';
  if (ct.includes('html') || ct.includes('xhtml')) return 'html';
  if (ct.includes('text/plain')) return 'texto';
  if (ct.includes('xml')) return 'html';

  // Sin cabecera util: miramos si parece HTML.
  const cabeza = buffer.subarray(0, 1024).toString('latin1').toLowerCase();
  if (cabeza.includes('<html') || cabeza.includes('<!doctype html')) return 'html';
  return null;
}

/**
 * Convierte bytes en texto, eligiendo el extractor segun el tipo.
 *
 * Se usa tanto para lo que se descarga de un sitio oficial como para un
 * archivo que la persona sube desde su computadora (ver la ruta
 * /api/extraer-archivo): en los dos casos lo unico que hay son bytes, y la
 * firma del archivo es mas confiable que cualquier nombre o cabecera.
 *
 * @param {Buffer} crudo
 * @param {string} [contentType] pista opcional; la firma de los bytes manda
 * @param {string} [origen] URL base, solo para resolver enlaces del HTML
 */
export async function extraerDesdeBuffer(crudo, contentType = '', origen = '') {
  const buffer = destaparPdf(crudo);
  const tipo = detectarTipo(buffer, contentType);

  if (tipo === 'pdf') return { tipo, ...(await extraerPdf(buffer)) };
  if (tipo === 'doc') return { tipo, ...(await extraerDoc(buffer)) };
  if (tipo === 'html') return { tipo, ...extraerHtml(aTexto(buffer, contentType), origen) };
  if (tipo === 'texto') {
    const t = aTexto(buffer, contentType).trim();
    if (t.length < 120) throw errores.htmlSinTexto();
    return { tipo, titulo: '', texto: t, metodo: 'texto-plano' };
  }
  throw errores.tipoNoSoportado(contentType);
}

/**
 * Descarga y extrae un documento, usando el cache en disco.
 *
 * @param {string} url
 * @param {{refrescar?: boolean}} [opciones]
 * @returns {Promise<object>} el mismo objeto que devuelve POST /api/extraer
 */
export async function obtenerDocumento(url, { refrescar = false } = {}) {
  if (!url) throw errores.urlFaltante();

  if (!refrescar) {
    const guardado = await leerCache(url);
    if (guardado) return { ...guardado, ok: true, desdeCache: true };
  }

  const { buffer: crudo, contentType, urlFinal, saltos } = await descargar(url);
  const resultado = await extraerDesdeBuffer(crudo, contentType, urlFinal);
  const tipo = resultado.tipo;

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
    bytesDescargados: crudo.length,
    obtenidoEn: new Date().toISOString(),
    desdeCache: false,
  };

  // Si el cache falla, no le arruina la respuesta a nadie.
  escribirCache(url, salida).catch(() => {});

  return salida;
}

/**
 * Descarga un PDF y le aplica OCR en vez de leer su capa de texto (que no
 * tiene: es un escaneo, ver lib/extraerPdf.js). Mismo trato que
 * obtenerDocumento en todo lo demas —cache en disco, deteccion de tipo por
 * la firma de los bytes— pero bajo una clave de cache aparte: es la misma
 * URL, pero el resultado (y lo que costó producirlo) es otra cosa.
 *
 * @param {string} url
 * @param {{refrescar?: boolean}} [opciones]
 */
export async function ocrDocumento(url, { refrescar = false } = {}) {
  if (!url) throw errores.urlFaltante();
  if (!OCR_HABILITADO) throw errores.ocrDeshabilitado();

  const claveCache = `ocr::${url}`;
  if (!refrescar) {
    const guardado = await leerCache(claveCache);
    if (guardado) return { ...guardado, ok: true, desdeCache: true };
  }

  const { buffer: crudo, contentType, urlFinal, saltos } = await descargar(url);
  const buffer = destaparPdf(crudo);
  const tipo = detectarTipo(buffer, contentType);
  if (tipo !== 'pdf') throw errores.ocrSoloPdf(tipo);

  const resultado = await ocrPdf(buffer);

  const salida = {
    ok: true,
    url,
    urlFinal,
    redirecciones: saltos.length - 1,
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
  };

  escribirCache(claveCache, salida).catch(() => {});

  return salida;
}
