/**
 * Extraccion de texto desde PDF con pdf.js.
 *
 * pdf.js devuelve una lista plana de fragmentos con su matriz de posicion.
 * Si los concatenas sin mas, un fallo queda como un chorizo ilegible.
 * Aca los reagrupamos por linea usando la coordenada vertical, y despues
 * unimos lineas en parrafos: eso hace que el resaltado por posicion y los
 * pasajes con contexto tengan sentido.
 *
 * Tambien detectamos el caso mas comun en la justicia provincial: PDFs que
 * son fotos de papel. No tienen capa de texto y no hay nada que extraer.
 * En vez de devolver una cadena vacia, avisamos que hace falta OCR.
 */

import { errores } from './errores.js';

// El build "legacy" es el que funciona en Node sin depender de APIs del navegador.
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

/** Tolerancia vertical, en puntos, para considerar que dos fragmentos van en la misma linea. */
const TOLERANCIA_Y = 2.2;

function fragmentosALineas(items) {
  const lineas = [];
  let actual = null;

  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    const y = it.transform?.[5] ?? 0;
    const x = it.transform?.[4] ?? 0;

    if (actual && Math.abs(actual.y - y) <= TOLERANCIA_Y) {
      actual.piezas.push({ x, s: it.str });
    } else {
      if (actual) lineas.push(actual);
      actual = { y, piezas: [{ x, s: it.str }] };
    }
    if (it.hasEOL) {
      lineas.push(actual);
      actual = null;
    }
  }
  if (actual) lineas.push(actual);

  return lineas.map((l) => {
    l.piezas.sort((a, b) => a.x - b.x);
    let texto = '';
    let finAnterior = null;
    for (const p of l.piezas) {
      // Si hay un hueco horizontal apreciable, metemos un espacio.
      if (finAnterior !== null && p.x - finAnterior > 1 && !/\s$/.test(texto) && !/^\s/.test(p.s)) {
        texto += ' ';
      }
      texto += p.s;
      finAnterior = p.x + p.s.length * 4.2; // estimacion suficiente
    }
    return texto.replace(/\s+/g, ' ').trim();
  });
}

/** Une lineas sueltas en parrafos y arregla los cortes de palabra con guion. */
function lineasAParrafos(lineas) {
  const salida = [];
  let buffer = '';

  for (const cruda of lineas) {
    const linea = cruda.trim();
    if (!linea) {
      if (buffer) { salida.push(buffer.trim()); buffer = ''; }
      continue;
    }
    if (!buffer) { buffer = linea; continue; }

    if (/[-\u00AD]$/.test(buffer)) {
      buffer = buffer.replace(/[-\u00AD]$/, '') + linea; // palabra cortada
    } else if (/[.;:!?]["'\u201D\u00BB)]?$/.test(buffer)) {
      salida.push(buffer.trim());                        // cierra la oracion
      buffer = linea;
    } else {
      buffer += ' ' + linea;                             // sigue el parrafo
    }
  }
  if (buffer) salida.push(buffer.trim());
  return salida;
}

/**
 * @param {Buffer} buffer contenido del PDF
 * @returns {Promise<{titulo: string, texto: string, paginas: number, metodo: string}>}
 */
export async function extraerPdf(buffer) {
  let doc;
  try {
    doc = await getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,   // no ejecutamos JS embebido en el PDF
      disableFontFace: true,    // en Node no hace falta cargar tipografias
      useSystemFonts: false,
      verbosity: 0,
    }).promise;
  } catch (e) {
    const m = String(e?.message || '');
    if (/password/i.test(m)) throw errores.pdfIlegible('está protegido con contraseña');
    throw errores.pdfIlegible(m.slice(0, 120));
  }

  const paginas = doc.numPages;
  const bloques = [];

  try {
    for (let n = 1; n <= paginas; n++) {
      const pagina = await doc.getPage(n);
      const contenido = await pagina.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false,
      });
      const lineas = fragmentosALineas(contenido.items);
      const parrafos = lineasAParrafos(lineas);
      if (parrafos.length) bloques.push(parrafos.join('\n'));
      pagina.cleanup();
    }
  } finally {
    try { await doc.destroy(); } catch { /* nada que hacer */ }
  }

  const texto = bloques.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

  if (texto.replace(/\s/g, '').length < 40) {
    throw errores.pdfEscaneado(paginas);
  }

  let titulo = '';
  try {
    const meta = await doc.getMetadata?.();
    titulo = (meta?.info?.Title || '').trim();
  } catch { /* algunos PDF no traen metadatos */ }

  return { titulo, texto, paginas, metodo: 'pdfjs' };
}
