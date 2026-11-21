/**
 * Rutas que los sitios oficiales excluyen de la consulta automatizada en su
 * robots.txt. Se respetan en todo lo que el servidor hace SIN una acción
 * puntual del usuario (pasajes que se traen de fondo, cosechas). Abrir un
 * documento porque la persona lo eligió —uno por acción— no es rastreo y
 * sigue funcionando.
 *
 * Verificado el 21/11/2026:
 *   https://juristeca.jusbaires.gob.ar/robots.txt → Disallow: /fallos/,
 *     /busqueda-avanzada-de-jurisprudencia/, /ics-wpd/
 *   https://www.saij.gob.ar/robots.txt → Disallow: /descarga-archivo,
 *     /convert-html-to-pdf, /archivo.php, /index.php, /urls, /_pdf
 * Si un sitio cambia su robots.txt, actualizar esta tabla y su prueba.
 */
import { ErrorApp } from './errores.js';

export const EXCLUIDAS = Object.freeze({
  'juristeca.jusbaires.gob.ar': ['/fallos/', '/busqueda-avanzada-de-jurisprudencia/', '/ics-wpd/', '/anterior/ics-wpd/'],
  'www.saij.gob.ar': ['/descarga-archivo', '/convert-html-to-pdf', '/archivo.php', '/index.php', '/urls', '/_pdf'],
  'saij.gob.ar': ['/descarga-archivo', '/convert-html-to-pdf', '/archivo.php', '/index.php', '/urls', '/_pdf'],
});

export function excluidaParaAutomatizacion(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const reglas = EXCLUIDAS[u.hostname.toLowerCase()];
  return Boolean(reglas && reglas.some((p) => u.pathname.startsWith(p)));
}

export function errorExcluida(url) {
  return new ErrorApp('EXCLUIDA_POR_ROBOTS',
    'El sitio oficial excluye este documento de la lectura automática (robots.txt). Ábralo en el Lector para leerlo completo.',
    200, { url });
}
