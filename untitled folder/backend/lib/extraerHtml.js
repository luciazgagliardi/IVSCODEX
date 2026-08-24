/**
 * Extraccion de texto desde HTML.
 *
 * Estrategia en dos pasos:
 *
 *   1. Readability (el motor del modo lectura de Firefox) para quedarnos con
 *      el cuerpo del documento y descartar menus, banners y pies de pagina.
 *   2. Si Readability no encuentra un articulo claro -y en los sitios
 *      judiciales viejos pasa seguido, porque arman todo con tablas-,
 *      caemos a una limpieza propia: sacamos script, style, nav, header,
 *      footer, aside y formularios, y nos quedamos con el texto del body.
 *
 * Siempre devolvemos texto plano con saltos de linea preservados: es lo que
 * el lector del frontend necesita para resaltar por posicion de caracter.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { errores } from './errores.js';

const BASURA = [
  'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
  'nav', 'header', 'footer', 'aside', 'form', 'button', 'select',
  '[role="navigation"]', '[role="banner"]', '[role="search"]',
  '.menu', '.navbar', '.nav', '.breadcrumb', '.migas',
  '.sidebar', '.cookie', '.cookies', '.publicidad', '.ads',
];

/** Normaliza el espaciado sin destruir la separacion entre parrafos. */
function limpiarTexto(t) {
  return String(t || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')          // espacio duro
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')       // maximo una linea en blanco
    .trim();
}

/** Convierte el DOM en texto respetando los cortes de bloque. */
function textoDeBloques(doc) {
  const bloques = doc.querySelectorAll(
    'p, div, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, pre, article, section, tr'
  );
  if (!bloques.length) return limpiarTexto(doc.body?.textContent || '');

  const vistos = new Set();
  const partes = [];
  for (const el of bloques) {
    // Evitamos duplicar: si un contenedor ya aporto su texto, salteamos.
    const propio = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join(' ')
      .trim();
    if (!propio) continue;
    const clave = propio.slice(0, 160);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    partes.push(propio);
  }
  return limpiarTexto(partes.join('\n'));
}

/**
 * @param {string} html   documento ya decodificado a texto
 * @param {string} url    URL final, la usa Readability para resolver enlaces
 * @returns {{titulo: string, texto: string, metodo: string}}
 */
export function extraerHtml(html, url) {
  // jsdom grita por cada CSS raro; lo silenciamos para no ensuciar la consola.
  const consolaMuda = new VirtualConsole();
  consolaMuda.on('jsdomError', () => {});

  let dom;
  try {
    dom = new JSDOM(html, { url, virtualConsole: consolaMuda });
  } catch {
    throw errores.htmlSinTexto();
  }

  const doc = dom.window.document;
  const tituloPagina = (doc.querySelector('title')?.textContent || '').trim();

  // --- Paso 1: Readability sobre una copia, porque modifica el DOM ---
  let porReadability = null;
  try {
    const copia = new JSDOM(html, { url, virtualConsole: consolaMuda });
    const articulo = new Readability(copia.window.document, {
      charThreshold: 200,
      keepClasses: false,
    }).parse();
    if (articulo?.textContent) {
      const t = limpiarTexto(articulo.textContent);
      if (t.length >= 400) {
        porReadability = { titulo: (articulo.title || tituloPagina).trim(), texto: t };
      }
    }
    copia.window.close();
  } catch {
    porReadability = null; // seguimos con el respaldo
  }

  // --- Paso 2: limpieza propia ---
  for (const sel of BASURA) {
    try {
      doc.querySelectorAll(sel).forEach((n) => n.remove());
    } catch { /* selector no soportado, seguimos */ }
  }
  const propio = textoDeBloques(doc);
  dom.window.close();

  // Nos quedamos con el que traiga mas contenido util.
  let elegido, metodo;
  if (porReadability && porReadability.texto.length >= propio.length * 0.6) {
    elegido = porReadability;
    metodo = 'readability';
  } else {
    elegido = { titulo: tituloPagina, texto: propio };
    metodo = 'limpieza-propia';
  }

  if (!elegido.texto || elegido.texto.length < 120) {
    throw errores.htmlSinTexto();
  }

  return { titulo: elegido.titulo || tituloPagina || '', texto: elegido.texto, metodo };
}
