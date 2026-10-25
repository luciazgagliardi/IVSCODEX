/**
 * Algunos sitios judiciales viejos le niegan la conexión al datacenter donde
 * corre el backend publicado (visto con el TSJ CABA en Azure) pero le
 * contestan bien a una conexión hogareña. La idea era que esos pedidos
 * puntuales pasaran por ScraperAPI en vez de ir directo.
 *
 * Para CABA quedó DESACTIVADO A PROPÓSITO (hoy sólo van Santa Fe y Río
 * Negro, más abajo). Los dos dominios de CABA se probaron en vivo y ninguno funciona con el plan actual de
 * ScraperAPI, cada uno fallando distinto:
 *
 *   - jurisprudencia.tsjbaires.gob.ar (el buscador): ScraperAPI lo tiene
 *     marcado como "dominio protegido" y exige el pool "premium" o
 *     "ultra_premium" (proxies residenciales) para conectar — ninguno de
 *     los dos está incluido en el plan. Contesta un 500 explícito.
 *   - www.tsjbaires.gov.ar (los PDF de cada fallo): esta síno da error —
 *     conecta, descarga "un" PDF con la cantidad correcta de páginas— pero
 *     el contenido de cada página viene en blanco. Probado a mano: se
 *     renderizó la página 1 con el mismo motor que usa lib/ocr.js y es una
 *     hoja blanca, mientras que yendo directo (sin proxy) la misma URL trae
 *     el escaneo real y legible. O sea, sin el pool premium el sitio
 *     contesta con una versión vacía en vez de rechazar la conexión —peor
 *     que un error, porque parece haber funcionado.
 *
 * Con ese diagnóstico, mantener el proxy prendido para el segundo dominio
 * sería peor que no tenerlo: cambiaría un 403 honesto (que ya tiene su
 * propio camino: abrir el original y subirlo a mano, ver
 * lib/descargador.js) por un "documento en blanco" silencioso. Mejor ir
 * directo en los dos casos y aceptar el 403 cuando pase.
 *
 * Si en algún momento se actualiza el plan de ScraperAPI a uno con acceso a
 * "premium" o "ultra_premium", volver a poner los dominios en
 * SUFIJOS_VIA_PROXY y agregar `premium: 'true'` (o `ultra_premium: 'true'`)
 * a los parámetros en urlProxy() de vuelta.
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

import { SCRAPER_API_KEY, RELE_URL, RELE_CLAVE } from '../config.js';

/** Dominios que se piden a través del relevo propio (ver RELE_URL en config.js). */
// Vacío a propósito: el TSJ contesta con el desafío de Cloudflare también a los
// pedidos que pasan por el Worker (medido en vivo). Ese dominio se resuelve con
// un navegador de verdad: ver lib/navegadorCf.js.
// Río Negro sí: le niega la conexión al datacenter publicado (403 a todo, medido en vivo) y le
// contesta a cualquier conexión común. Sin relevo configurado, esto no cambia nada.
const SUFIJOS_VIA_RELE = ['jusrionegro.gov.ar'];

function dominioVaPorRele(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  return SUFIJOS_VIA_RELE.some((s) => h === s || h.endsWith('.' + s));
}

/** Dominios que se sabe que le niegan la conexión al datacenter publicado. */
// Santa Fe y Río Negro no le contestan al datacenter publicado (sin conexión o 403, medido en vivo)
// y no tienen la protección de Cloudflare que frenaba al TSJ: el plan común de ScraperAPI alcanza.
const SUFIJOS_VIA_PROXY = ['justiciasantafe.gov.ar', 'jusrionegro.gov.ar'];

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
  // El relevo propio: el Worker pide el documento desde otra red y devuelve la
  // respuesta tal cual (también las redirecciones, que se siguen a mano).
  if (RELE_URL && dominioVaPorRele(host)) {
    return `${RELE_URL}${RELE_URL.includes('?') ? '&' : '?'}k=${encodeURIComponent(RELE_CLAVE)}&url=${encodeURIComponent(destino)}`;
  }
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
  let t = String(texto ?? '');
  if (RELE_CLAVE) t = t.split(RELE_CLAVE).join('[clave-oculta]');
  return SCRAPER_API_KEY ? t.split(SCRAPER_API_KEY).join('[clave-oculta]') : t;
}
