/**
 * Extraccion de texto desde .doc viejo (formato binario de Word 97-2003,
 * "Compound File Binary" — nada que ver con .docx, que es zip+XML).
 *
 * Aparece en fallos de CABA anteriores al expediente judicial electronico
 * (EJE): el propio sitio los sirve asi, sin PDF disponible (ver la nota de
 * origenes "EJE" vs otros en indiceCaba.js). No hay forma de convertirlos a
 * PDF ni de pedirle al sitio otra cosa: hay que leer el binario tal cual.
 *
 * word-extractor lee el Compound File a mano (sin depender de Word ni de
 * binarios externos tipo antiword/catdoc, que no existen en este entorno) y
 * devuelve el cuerpo del documento como texto plano.
 */

import WordExtractor from 'word-extractor';
import { errores } from './errores.js';

const extractor = new WordExtractor();

/**
 * @param {Buffer} buffer contenido del .doc
 * @returns {Promise<{titulo: string, texto: string, metodo: string}>}
 */
export async function extraerDoc(buffer) {
  let doc;
  try {
    doc = await extractor.extract(buffer);
  } catch (e) {
    throw errores.docIlegible(String(e?.message || '').slice(0, 120));
  }

  // getBody() ya viene sin encabezados/pies repetidos de pagina; sumamos
  // notas al pie si las trae, que es donde suelen ir las citas de fallos.
  const partes = [doc.getBody()];
  const notas = doc.getFootnotes?.();
  if (notas && notas.trim()) partes.push(notas.trim());

  const texto = partes.join('\n\n').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (texto.replace(/\s/g, '').length < 40) {
    throw errores.docIlegible('no tiene texto aprovechable');
  }

  return { titulo: '', texto, metodo: 'word-extractor' };
}
