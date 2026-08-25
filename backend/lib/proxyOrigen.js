/**
 * Algunos sitios judiciales viejos le niegan la conexión al datacenter donde
 * corre el backend publicado (visto con el TSJ CABA en Azure: 403 tanto en
 * su buscador como en la descarga de los PDF) pero le contestan bien a una
 * conexión hogareña. Para esos casos puntuales, el pedido pasa por
 * ScraperAPI en vez de ir directo.
 *
 * Se usa su API por URL (api.scraperapi.com/?url=...), no su "modo proxy"
 * (un relay de red de nivel TCP/HTTP): probado en vivo, el modo proxy no
 * reconoce los parámetros extra (country_code, premium) pasados por el
 * usuario del proxy —cualquier combinación probada tuvo exactamente el
 * mismo resultado que sin ellos—, así que no hay forma de pedirle el pool
 * "premium" (residencial) que este dominio en particular necesita: sin él,
 * ScraperAPI directamente contesta "dominio protegido, agregá
 * premium=true" en vez de conectar.
 *
 * La contra de la API por URL es que ella sigue las redirecciones por su
 * cuenta si se lo dejamos, y lib/descargador.js necesita revisar cada salto
 * a mano (ver el comentario grande ahi sobre SSRF). Por eso acá se envuelve
 * la URL de cada pedido, uno por uno —incluida cada redirección— en vez de
 * envolver una sola vez "la navegación completa": quien pide siempre sabe
 * qué URL real está pidiendo y a qué host efectivamente puede seguir.
 *
 * Sin SCRAPER_API_KEY configurada (desarrollo local, típicamente) todo esto
 * no hace nada: urlParaPedir() devuelve la URL tal cual y todo sigue yendo
 * directo, como siempre.
 */

import { SCRAPER_API_KEY } from '../config.js';

/** Dominios que se sabe que le niegan la conexión al datacenter publicado. */
const SUFIJOS_VIA_PROXY = ['tsjbaires.gob.ar', 'tsjbaires.gov.ar'];

/** True si el host es uno de esos dominios o un subdominio suyo. */
export function dominioNecesitaProxy(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  return SUFIJOS_VIA_PROXY.some((s) => h === s || h.endsWith('.' + s));
}

/** Envuelve una URL para pedírsela a ScraperAPI en vez de al sitio directo. */
function urlProxy(destino) {
  const p = new URLSearchParams({
    api_key: SCRAPER_API_KEY,
    url: destino,
    country_code: 'ar', // la IP de salida importa: ver la nota de mas arriba
    premium: 'true', // este dominio puntual lo exige, ver la nota de mas arriba
    render: 'false', // es HTML de servidor, no hace falta un navegador de verdad
  });
  return `https://api.scraperapi.com/?${p.toString()}`;
}

/**
 * La URL que hay que pedirle a fetch(): la real, tal cual, si el host no
 * está en la lista o no hay key configurada; envuelta por ScraperAPI si
 * hace falta.
 */
export function urlParaPedir(destino, host) {
  if (!SCRAPER_API_KEY || !dominioNecesitaProxy(host)) return destino;
  return urlProxy(destino);
}

/**
 * Por las dudas: tapa la key si aparece en un texto antes de que llegue a
 * un mensaje de error (esos sí pueden terminar mostrados en pantalla, ver
 * routes/indice.js). fetch() a veces mete la URL pedida en el mensaje de
 * sus propios errores de red, y esa URL trae la key puesta.
 */
export function sinClave(texto) {
  const t = String(texto ?? '');
  return SCRAPER_API_KEY ? t.split(SCRAPER_API_KEY).join('[clave-oculta]') : t;
}
