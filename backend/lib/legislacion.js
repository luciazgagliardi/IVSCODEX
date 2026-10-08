/**
 * El texto oficial de un artículo, traído de InfoLeg.
 *
 * Cierra el círculo que le faltaba a la app. Hasta acá todo apuntaba a
 * JURISPRUDENCIA: qué dijeron los tribunales. Pero un fallo se lee citando
 * artículos ("conforme el art. 1741 del CCyC..."), y hasta ahora había que
 * salir a buscar ese texto a otra pestaña. Esto lo trae acá, con la misma
 * regla que el resto del proyecto: no lo escribimos nosotros, lo trae de la
 * fuente que hace fe.
 *
 * InfoLeg es el repositorio del Ministerio de Justicia de la Nación y sirve
 * "texto actualizado" (texact.htm) de los códigos y leyes principales: lo
 * que se ve ahí ya tiene incorporadas las reformas. Eso importa y no es un
 * detalle: al cargar la solapa Requisitos apareció que el art. 242 de la LCT
 * fue sustituido por el DNU 70/2023 — escribir de memoria habría dado un
 * texto viejo sin que nadie se enterara.
 *
 * Sólo derecho de fondo NACIONAL. Los códigos procesales provinciales
 * (Mendoza, ley 9001) no están en InfoLeg y cada provincia los publica a su
 * manera; meterlos exigiría un cliente por provincia y no se hace a medias:
 * la lista de abajo es la que se puede servir bien.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { leerCache, escribirCache } from './cache.js';
import { errores } from './errores.js';

const HOST = 'servicios.infoleg.gob.ar';

/**
 * Las normas que se pueden consultar. Cada URL fue verificada abriéndola y
 * comprobando que el articulado esté ahí (no un índice ni una portada).
 *
 * "texact" = texto actualizado, con las reformas ya incorporadas. Donde no
 * existe esa versión se usa "norma" (el texto original), y se dice en
 * "aviso" para que nadie suponga que está al día.
 */
export const NORMAS = [
  { clave: 'ccyc', nombre: 'Código Civil y Comercial', sigla: 'CCyCN',
    url: `https://${HOST}/infolegInternet/anexos/235000-239999/235975/texact.htm` },
  { clave: 'cn', nombre: 'Constitución Nacional', sigla: 'CN',
    url: `https://${HOST}/infolegInternet/anexos/0-4999/804/norma.htm` },
  { clave: 'lct', nombre: 'Ley de Contrato de Trabajo (20.744)', sigla: 'LCT',
    url: `https://${HOST}/infolegInternet/anexos/25000-29999/25552/texact.htm`,
    aviso: 'Régimen en reforma: el DNU 70/2023 y la Ley 27.742 (2024) modificaron varios artículos. Revise las notas de InfoLeg al pie del artículo.' },
  { clave: 'lcq', nombre: 'Ley de Concursos y Quiebras (24.522)', sigla: 'LCQ',
    url: `https://${HOST}/infolegInternet/anexos/25000-29999/25379/texact.htm` },
  { clave: 'lpa', nombre: 'Ley de Procedimientos Administrativos (19.549)', sigla: 'LPA',
    url: `https://${HOST}/infolegInternet/anexos/20000-24999/22363/texact.htm` },
  { clave: 'amparo', nombre: 'Ley de Amparo (16.986)', sigla: 'Ley 16.986',
    url: `https://${HOST}/infolegInternet/anexos/45000-49999/46871/norma.htm`,
    aviso: 'Texto original de 1966. El amparo tiene además rango constitucional desde 1994 (art. 43 CN).' },
];

export function normaPorClave(clave) {
  return NORMAS.find((n) => n.clave === String(clave || '').toLowerCase()) || null;
}

/**
 * Baja el texto plano de una norma. Se cachea en disco porque son archivos
 * grandes (el CCyC pesa 1,3 MB) que casi no cambian: pedirlos de nuevo por
 * cada consulta sería maltratar a InfoLeg de gusto.
 */
async function textoDeNorma(norma) {
  const guardado = await leerCache(norma.url);
  if (guardado && guardado.texto) return guardado.texto;

  await esperarTurno(HOST);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  let crudo;
  try {
    const resp = await fetch(norma.url, {
      signal: control.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*;q=0.8' },
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('infoleg', `respuesta ${resp.status}`);
    // InfoLeg sirve estas páginas en latin-1, no en UTF-8: decodificarlas a
    // ciegas deja "ARTÍCULO" como "ARTï¿½CULO" y rompe las búsquedas.
    const buffer = Buffer.from(await resp.arrayBuffer());
    crudo = new TextDecoder('latin1').decode(buffer);
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('infoleg', e?.cause?.message || e?.message);
  } finally {
    clearTimeout(reloj);
  }

  const consolaMuda = new VirtualConsole();
  consolaMuda.on('jsdomError', () => {});
  const dom = new JSDOM(crudo, { virtualConsole: consolaMuda });
  dom.window.document.querySelectorAll('script, style').forEach((n) => n.remove());
  const texto = (dom.window.document.body?.textContent || '').replace(/[ \s]+/g, ' ');
  dom.window.close();

  await escribirCache(norma.url, { texto });
  return texto;
}

/**
 * Dónde empieza un artículo dentro del texto de la norma.
 *
 * Los tres formatos son reales y conviven según la ley: "ARTICULO 438.-" en
 * el CCyC, "Artículo 43 .-" en la Constitución, "Art. 243." en la LCT. El
 * número va anclado con \b para que pedir el 11 no caiga en el 110.
 */
function posicionDelArticulo(texto, numero) {
  const n = String(numero).trim().replace(/\s+/g, '\\s*'); // tolera "76 bis"
  const patrones = [
    new RegExp(`ART[IÍ]CULO\\s*${n}\\b\\s*[\\.\\-–°º]`, 'i'),
    new RegExp(`Art[íi]culo\\s*${n}\\b\\s*[\\.\\-–°º]`, 'i'),
    new RegExp(`Art\\.?\\s*${n}\\b\\s*[\\.\\-–°º]`, 'i'),
    new RegExp(`ART[IÍ]CULO\\s*${n}\\b`, 'i'),
  ];
  for (const p of patrones) {
    const m = p.exec(texto);
    if (m) return m.index;
  }
  return -1;
}

/** Cuántos caracteres se devuelven como mucho de un artículo. */
const MAX_ARTICULO = 4000;

/**
 * El texto de un artículo concreto.
 *
 * Se corta en el arranque del artículo siguiente, no a un largo fijo: los
 * artículos van de dos renglones (art. 1900 CCyC) a varias pantallas (art.
 * 11 LCQ, con ocho incisos). Si no se encuentra dónde termina se recorta y
 * se avisa con "truncado", en vez de devolver media ley.
 */
export async function articuloDe(clave, numero) {
  const norma = normaPorClave(clave);
  if (!norma) throw errores.normaDesconocida(clave);
  const num = String(numero || '').trim();
  if (!/^\d{1,4}(\s*(bis|ter|quater))?$/i.test(num)) throw errores.articuloInvalido(num);

  const texto = await textoDeNorma(norma);
  const desde = posicionDelArticulo(texto, num);
  if (desde === -1) throw errores.articuloNoEncontrado(num, norma.nombre);

  // El siguiente "ARTICULO/Art." que aparezca después del arranque marca el final.
  const resto = texto.slice(desde + 10);
  const sig = /(ART[IÍ]CULO|Art[íi]culo|Art\.)\s*\d/.exec(resto);
  let cuerpo = sig ? texto.slice(desde, desde + 10 + sig.index) : texto.slice(desde, desde + MAX_ARTICULO);

  let truncado = false;
  if (cuerpo.length > MAX_ARTICULO) { cuerpo = cuerpo.slice(0, MAX_ARTICULO); truncado = true; }

  const limpio = cuerpo.trim();
  return {
    norma: norma.nombre,
    sigla: norma.sigla,
    articulo: num,
    texto: limpio,
    // La rúbrica viaja al frontend: la necesita el respaldo por navegador
    // para armar las mismas formas de búsqueda que arma el servidor.
    rubrica: rubricaDe(limpio),
    truncado,
    aviso: norma.aviso || null,
    url: norma.url,
  };
}

/**
 * La rúbrica de un artículo: el título que va después del número.
 *
 * "ARTICULO 1710.- Deber de prevención del daño. Toda persona tiene..."
 *                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *
 * Hace falta para buscar los fallos que APLICAN el artículo, no sólo los que
 * escriben su número. Medido contra Mendoza: "art 1710" da CERO resultados
 * —sus sumarios describen el tema con descriptores del tesauro, no citan el
 * articulado— mientras que "prevención del daño" da cincuenta. Sin la
 * rúbrica, buscar por artículo en esa fuente no sirve para nada.
 *
 * Devuelve null cuando el artículo no tiene título (pasa en la Constitución
 * y en las leyes viejas, que numeran sin rubricar).
 */
export function rubricaDe(textoArticulo) {
  const t = String(textoArticulo || '');
  // Después del "N.-" viene la rúbrica, y termina en el primer punto. Se
  // exige que arranque en mayúscula y que sea corta: si lo que sigue es la
  // oración del articulado ("Toda persona tiene el deber..."), no es rúbrica.
  const m = /^\s*(?:ART[IÍ]CULO|Art[íi]culo|Art\.?)\s*[\dbisterquax\s]+\s*[\.\-–—°º]+\s*([A-ZÁÉÍÓÚÑ][^.]{3,70})\./.exec(t);
  if (!m) return null;
  const r = m[1].trim();
  // Una rúbrica es un rótulo, no una oración: si trae verbo conjugado común
  // ("tiene", "debe", "es") probablemente ya es el texto del artículo.
  if (/\b(tiene|debe|puede|es|son|se)\b/i.test(r)) return null;
  return r;
}
