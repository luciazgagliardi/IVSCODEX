/**
 * OCR de PDFs escaneados: fotos de papel sin capa de texto.
 *
 * lib/extraerPdf.js ya detecta este caso (PDF_ESCANEADO) y no puede hacer
 * nada más: pdf.js lee el texto que el PDF ya tiene adentro, y un escaneo
 * no tiene ninguno, solo la imagen de cada página. Acá se renderiza cada
 * página a una imagen y se la pasa a Tesseract, que reconoce las letras a
 * partir de los píxeles — igual que leería una persona la foto del papel.
 *
 * Es una acción aparte, no algo que se intenta solo cuando falla lo normal:
 * tarda segundos por página en vez de milisegundos (mucho más en un plan
 * de hosting chico), y el resultado nunca es perfecto —un OCR puede
 * confundir letras parecidas, sobre todo en fotocopias de mala calidad—
 * así que quien lo pide tiene que saber que lo está pidiendo.
 *
 * Para renderizar la página se usa @hyzyla/pdfium (el motor de PDF de
 * Chrome, compilado a WebAssembly) y no pdf.js+canvas nativo: probado a
 * mano, la combinación pdf.js + @napi-rs/canvas hace un segfault real
 * —tira abajo el proceso entero, no un error atajable— con este mismo PDF,
 * y node-canvas (la alternativa clásica) ni siquiera compila sin Cairo/
 * Pango instalados en el sistema. PDFium es WASM puro: cero binarios
 * nativos, cero dependencia del sistema operativo. La imagen sale como
 * bitmap crudo (RGBA); pngjs —también JS puro, sin binarios— la empaqueta
 * en un PNG para pasarsela a Tesseract.
 */

import fs from 'node:fs/promises';
import { PDFiumLibrary } from '@hyzyla/pdfium';
import { PNG } from 'pngjs';
import { createWorker } from 'tesseract.js';
import { errores } from './errores.js';
import { OCR_MAX_PAGINAS, OCR_TIMEOUT_MS, DIR_OCR_CACHE } from '../config.js';

/**
 * Escala del render. PDFium trabaja en múltiplos de 72dpi (escala 1 = 72dpi);
 * Tesseract da su mejor resultado alrededor de 300dpi para texto de tamaño
 * normal, de ahí 300/72.
 */
const ESCALA = 300 / 72;

let libreria = null;
/** La librería WASM se inicializa una sola vez y se reutiliza entre pedidos. */
async function pdfium() {
  if (!libreria) libreria = await PDFiumLibrary.init();
  return libreria;
}

let worker = null;
/**
 * Un solo worker de Tesseract reutilizado entre pedidos: crearlo de nuevo
 * cada vez (carga el modelo del idioma, unos megabytes) es lo más lento de
 * todo el proceso. Como contrapartida, dos OCR pedidos al mismo tiempo se
 * hacen uno detrás del otro, no en paralelo — aceptable para una función
 * que ya viene con su propio límite de uso (ver limiteOcr en index.js).
 */
async function workerEspanol() {
  if (!worker) {
    // cachePath: sin esto, Tesseract tira el modelo del idioma suelto en el
    // directorio desde donde arrancó el proceso en vez de un lugar propio.
    // La carpeta tiene que existir de antemano, si no Tesseract no la crea
    // sola y sigue funcionando igual, pero sin guardar nada entre reinicios.
    await fs.mkdir(DIR_OCR_CACHE, { recursive: true }).catch(() => {});
    worker = await createWorker('spa', undefined, { cachePath: DIR_OCR_CACHE });
  }
  return worker;
}

/** RGBA crudo (lo que da PDFium) -> PNG (lo que entiende Tesseract). */
function aPng({ data, width, height }) {
  const png = new PNG({ width, height });
  Buffer.from(data.buffer, data.byteOffset, data.byteLength).copy(png.data);
  return PNG.sync.write(png);
}

/**
 * @param {Buffer} buffer PDF ya confirmado como escaneo (ver lib/extraerPdf.js)
 * @returns {Promise<{texto: string, paginas: number, paginasProcesadas: number, metodo: string}>}
 */
export async function ocrPdf(buffer) {
  // El trabajo en si (renderizar + reconocer, pagina por pagina) puede
  // tardar mucho mas en un plan de hosting con poca CPU que en desarrollo:
  // sin este limite, un pedido lento se queda esperando mas alla incluso
  // del timeout de la propia plataforma (Azure corta las conexiones
  // inactivas cerca de los 230s) y quien lo pidio nunca recibe respuesta.
  let vencido = false;
  const reloj = setTimeout(() => { vencido = true; }, OCR_TIMEOUT_MS);
  try {
    return await Promise.race([
      ocrPdfSinLimite(buffer, () => vencido),
      new Promise((_, reject) => {
        setTimeout(() => reject(errores.ocrTiempoAgotado(OCR_TIMEOUT_MS)), OCR_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(reloj);
  }
}

async function ocrPdfSinLimite(buffer, estaVencido) {
  const lib = await pdfium();
  let documento;
  try {
    documento = await lib.loadDocument(buffer);
  } catch (e) {
    throw errores.pdfIlegible(String(e?.message || '').slice(0, 120));
  }

  // pages() da un generador, no un array: hace falta materializarlo para
  // saber el total y para poder recortar a OCR_MAX_PAGINAS con slice().
  const todasLasPaginas = Array.from(documento.pages());
  const paginas = todasLasPaginas.length;
  const aProcesar = todasLasPaginas.slice(0, OCR_MAX_PAGINAS);
  const bloques = [];

  try {
    const tesseract = await workerEspanol();

    for (const pagina of aProcesar) {
      // El Promise.race de ocrPdf() ya le da por perdido el pedido a quien
      // lo llamó una vez pasado OCR_TIMEOUT_MS, pero esta funcion seguiria
      // corriendo sola de fondo si no se corta acá: en un worker compartido
      // entre pedidos (ver workerEspanol), eso demoraría al próximo.
      if (estaVencido()) break;
      const imagen = await pagina.render({ scale: ESCALA, render: aPng });
      const { data } = await tesseract.recognize(Buffer.from(imagen.data));
      const texto = (data?.text || '').trim();
      if (texto) bloques.push(texto);
    }
  } finally {
    try { documento.destroy(); } catch { /* nada que hacer */ }
  }

  const texto = bloques.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  if (texto.replace(/\s/g, '').length < 20) {
    throw errores.ocrSinTexto();
  }

  return { texto, paginas, paginasProcesadas: aProcesar.length, metodo: 'ocr' };
}
