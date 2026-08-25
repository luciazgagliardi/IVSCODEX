/**
 * Algunos sitios judiciales viejos le niegan la conexión al datacenter donde
 * corre el backend publicado (visto con el TSJ CABA en Azure: 403 tanto en
 * su buscador como en la descarga de los PDF) pero le contestan bien a una
 * conexión hogareña. Para esos casos puntuales, el pedido sale por un proxy
 * en vez de ir directo.
 *
 * Importante: esto usa ScraperAPI en "modo proxy" (un relay de red — la IP
 * de salida cambia y nada más), no su "API por URL" (que envuelve el pedido
 * como parámetro de una URL propia). La diferencia no es de gusto: el modo
 * URL le hace de intermediario de verdad al pedido —lo recibe, lo vuelve a
 * armar y lo reenvía— y en el camino re-codifica el cuerpo como UTF-8. Para
 * la mayoría de los sitios da igual, pero el TSJ CABA solo entiende
 * windows-1252 (ver lib/indiceCaba.js): con el modo URL, buscar "daño"
 * volvía con 0 resultados en vez de los cientos reales, porque la "ñ" ya no
 * llegaba como el byte que el sitio espera. El modo proxy no tiene ese
 * problema porque no toca el cuerpo en absoluto: son los mismos bytes que
 * mandaríamos yendo directo, solo que salen por otra IP.
 *
 * Sin SCRAPER_API_KEY configurada (desarrollo local, típicamente) todo esto
 * no hace nada: dispatcherPara() devuelve undefined y fetch() va directo,
 * como siempre.
 */

import { ProxyAgent } from 'undici';
import { SCRAPER_API_KEY } from '../config.js';

/** Dominios que se sabe que le niegan la conexión al datacenter publicado. */
const SUFIJOS_VIA_PROXY = ['tsjbaires.gob.ar', 'tsjbaires.gov.ar'];

/** True si el host es uno de esos dominios o un subdominio suyo. */
export function dominioNecesitaProxy(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  return SUFIJOS_VIA_PROXY.some((s) => h === s || h.endsWith('.' + s));
}

let agente = null;
/** Un solo agente reutilizado (pool de conexiones), no uno nuevo por pedido. */
function agenteProxy() {
  if (!SCRAPER_API_KEY) return null;
  if (!agente) {
    // country_code=ar: sin esto la IP de salida puede ser de cualquier
    // parte, y el TSJ CABA le devuelve una respuesta válida pero con 0
    // resultados a tráfico que no parece argentino (visto en vivo: la
    // consulta "llega" y contesta bien formada, pero vacía).
    // premium=true: sin esto ScraperAPI a veces contesta directamente "esta
    // fuente es un dominio protegido, agregá premium=true" en vez de
    // conectar (visto en vivo, con el pool de proxies comunes).
    agente = new ProxyAgent(
      `http://scraperapi.country_code=ar.premium=true:${SCRAPER_API_KEY}@proxy-server.scraperapi.com:8001`
    );
  }
  return agente;
}

/**
 * El dispatcher para pasarle a fetch() al pedirle este host, o undefined si
 * hay que ir directo (host no listado, o no hay key configurada).
 */
export function dispatcherPara(host) {
  if (!dominioNecesitaProxy(host)) return undefined;
  return agenteProxy() || undefined;
}
