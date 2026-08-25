/**
 * Algunos sitios judiciales viejos le niegan la conexión al datacenter donde
 * corre el backend publicado (visto con el TSJ CABA en Azure) pero le
 * contestan bien a una conexión hogareña. Para esos casos puntuales, el
 * pedido pasa por ScraperAPI en vez de ir directo.
 *
 * IMPORTANTE — alcance reducido a propósito: jurisprudencia.tsjbaires.gob.ar
 * (el buscador) quedó afuera. Probado en vivo, ScraperAPI lo tiene marcado
 * como "dominio protegido" y exige el pool "premium" o "ultra_premium"
 * (proxies residenciales) para conectar — ninguno de los dos está incluido
 * en el plan actual, así que no hay parámetro que lo arregle: hace falta
 * upgradear el plan de ScraperAPI, no un cambio de código. Mientras tanto,
 * el buscador de CABA sigue yendo directo y cae al índice local guardado
 * cuando el sitio no responde (ver routes/indice.js), igual que si esto no
 * existiera.
 *
 * www.tsjbaires.gov.ar (donde viven los PDF de cada fallo) es un dominio
 * distinto y todavía no se probó si también está en esa lista — por eso
 * sigue intentando por acá.
 *
 * Se usa la API por URL de ScraperAPI (api.scraperapi.com/?url=...), no su
 * "modo proxy" (un relay de red de nivel TCP/HTTP): probado en vivo, el modo
 * proxy no reconoce parámetros extra pasados por el usuario del proxy
 * (country_code, premium) —misma respuesta con o sin ellos—, así que solo
 * la API por URL deja pedir algo puntual como el país de salida.
 *
 * La contra de la API por URL es que ella sigue las redirecciones por su
 * cuenta si se lo dejamos, y lib/descargador.js necesita revisar cada salto
 * a mano (ver el comentario grande ahí sobre SSRF). Por eso acá se envuelve
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
const SUFIJOS_VIA_PROXY = ['tsjbaires.gov.ar'];

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
    render: 'false', // son PDF y HTML de servidor, no hace falta un navegador de verdad
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
