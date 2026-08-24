/**
 * Descarga seguro de un documento remoto.
 *
 * Un proxy que baja "cualquier URL que le pasen" es un agujero de seguridad
 * clasico llamado SSRF: alguien te manda http://127.0.0.1:6379 o la URL de
 * metadatos de la nube y tu propio servidor se la trae. Por eso, antes de
 * cada salto de red:
 *
 *   1. exigimos http o https, nada de file:, ftp:, gopher:
 *   2. exigimos que el dominio este en la lista blanca
 *   3. resolvemos el DNS y rechazamos si apunta a una IP interna
 *   4. seguimos las redirecciones a mano, repitiendo 1, 2 y 3 en cada salto
 *
 * El paso 4 es el que se olvida siempre: un dominio publico puede redirigir
 * a 127.0.0.1 y, si dejas que fetch siga los redirects solo, no te enteras.
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import iconv from 'iconv-lite';

import {
  DOMINIOS_PERMITIDOS,
  PERMITIR_CUALQUIER_DOMINIO,
  PERMITIR_RED_PRIVADA,
  MAX_BYTES,
  MAX_REDIRECCIONES,
  TIMEOUT_MS,
  USER_AGENT,
  ESPERA_POR_HOST_MS,
} from '../config.js';
import { errores, ErrorApp } from './errores.js';

/* ------------------------------------------------------------------ *
 * 1. Validacion del dominio
 * ------------------------------------------------------------------ */

/**
 * True si el host es el dominio permitido o un subdominio suyo.
 * "sjconsulta.csjn.gov.ar" coincide con "csjn.gov.ar".
 * "malicioso-csjn.gov.ar" NO coincide: se exige el punto separador.
 */
export function dominioHabilitado(host) {
  if (PERMITIR_CUALQUIER_DOMINIO) return true;
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  return DOMINIOS_PERMITIDOS.some(
    (d) => h === d.toLowerCase() || h.endsWith('.' + d.toLowerCase())
  );
}

/* ------------------------------------------------------------------ *
 * 2. Deteccion de direcciones internas
 * ------------------------------------------------------------------ */

function ipv4EsPrivada(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  if (a === 0) return true;                          // 0.0.0.0/8
  if (a === 10) return true;                         // 10/8
  if (a === 127) return true;                        // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true;           // link-local y metadatos
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12
  if (a === 192 && b === 168) return true;           // 192.168/16
  if (a === 192 && b === 0) return true;             // 192.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true;                         // multicast y reservado
  return false;
}

function ipv6EsPrivada(ip) {
  const x = ip.toLowerCase();
  if (x === '::' || x === '::1') return true;
  if (x.startsWith('fe80') || x.startsWith('fc') || x.startsWith('fd')) return true;
  // IPv4 embebida: ::ffff:127.0.0.1
  const m = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return ipv4EsPrivada(m[1]);
  return false;
}

export function ipEsPrivada(ip) {
  const v = net.isIP(ip);
  if (v === 4) return ipv4EsPrivada(ip);
  if (v === 6) return ipv6EsPrivada(ip);
  return true; // si no es una IP valida, la tratamos como sospechosa
}

/** True solo para 127.0.0.0/8 y ::1. */
function esLoopback(ip) {
  if (net.isIP(ip) === 4) return ip.split('.')[0] === '127';
  const x = ip.toLowerCase();
  if (x === '::1') return true;
  const m = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return m ? m[1].split('.')[0] === '127' : false;
}

/**
 * Resuelve el host y falla si alguna de sus IPs es interna.
 *
 * PERMITIR_RED_PRIVADA levanta la restriccion SOLO para loopback, que es lo
 * que necesitan las pruebas automaticas. La red local, el rango de enlace y
 * la IP de metadatos de la nube (169.254.169.254) siguen bloqueados siempre:
 * son justamente los objetivos de un ataque SSRF y no hay motivo legitimo
 * para que este extractor los toque.
 */
async function verificarDNS(host) {
  const permitida = (ip) =>
    !ipEsPrivada(ip) || (PERMITIR_RED_PRIVADA && esLoopback(ip));

  if (net.isIP(host)) {
    if (!permitida(host)) throw errores.redPrivada(host, host);
    return;
  }

  let direcciones;
  try {
    direcciones = await dns.lookup(host, { all: true });
  } catch (e) {
    throw errores.redInalcanzable(host, e.code || 'DNS');
  }
  for (const d of direcciones) {
    if (!permitida(d.address)) throw errores.redPrivada(host, d.address);
  }
}

/* ------------------------------------------------------------------ *
 * 3. Cortesia con el sitio de origen
 * ------------------------------------------------------------------ */

const ultimoPedido = new Map();

/**
 * Espera lo necesario para no golpear dos veces seguidas el mismo host.
 * Se exporta para que otros clientes HTTP del backend (ej. lib/indiceMza.js)
 * respeten la misma cortesía sin duplicar la lógica.
 */
export async function esperarTurno(host) {
  const previo = ultimoPedido.get(host) || 0;
  const falta = previo + ESPERA_POR_HOST_MS - Date.now();
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  ultimoPedido.set(host, Date.now());
}

/* ------------------------------------------------------------------ *
 * 4. Validacion completa de una URL
 * ------------------------------------------------------------------ */

export async function validarURL(crudo) {
  if (!crudo || typeof crudo !== 'string' || !crudo.trim()) {
    throw errores.urlFaltante();
  }
  let u;
  try {
    u = new URL(crudo.trim());
  } catch (e) {
    throw errores.urlInvalida(e.message);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw errores.esquemaInvalido(u.protocol.replace(':', ''));
  }
  if (!dominioHabilitado(u.hostname)) {
    throw errores.dominioNoPermitido(u.hostname);
  }
  await verificarDNS(u.hostname);
  return u;
}

/* ------------------------------------------------------------------ *
 * 5. Lectura del cuerpo con tope de bytes
 * ------------------------------------------------------------------ */

async function leerConTope(respuesta, max) {
  const declarado = Number(respuesta.headers.get('content-length') || 0);
  if (declarado && declarado > max) throw errores.demasiadoGrande(max);

  if (!respuesta.body) {
    const b = Buffer.from(await respuesta.arrayBuffer());
    if (b.length > max) throw errores.demasiadoGrande(max);
    return b;
  }

  const partes = [];
  let total = 0;
  for await (const trozo of respuesta.body) {
    const buf = Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo);
    total += buf.length;
    if (total > max) {
      try { await respuesta.body.cancel?.(); } catch { /* da igual */ }
      throw errores.demasiadoGrande(max);
    }
    partes.push(buf);
  }
  return Buffer.concat(partes, total);
}

/* ------------------------------------------------------------------ *
 * 6. Codificacion de caracteres
 * ------------------------------------------------------------------ */

/**
 * Muchos sitios judiciales argentinos siguen sirviendo ISO-8859-1 o
 * windows-1252. Si asumis UTF-8 a ciegas, los acentos salen como rombos
 * con signo de pregunta y el fallo se vuelve ilegible. Buscamos el charset
 * en la cabecera, despues en el meta del HTML, y como ultimo recurso
 * detectamos el mojibake tipico y reintentamos en latin1.
 */
export function aTexto(buffer, contentType) {
  let charset = null;

  const m = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType || '');
  if (m) charset = m[1].toLowerCase();

  if (!charset) {
    const cabeza = buffer.subarray(0, 4096).toString('latin1');
    const m2 =
      /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(cabeza) ||
      /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i.exec(cabeza);
    if (m2) charset = m2[1].toLowerCase();
  }

  const normaliza = (c) => {
    if (!c) return 'utf-8';
    if (['utf8', 'utf-8'].includes(c)) return 'utf-8';
    if (['latin1', 'iso-8859-1', 'iso8859-1', 'windows-1252', 'cp1252'].includes(c)) {
      // windows-1252 es superconjunto de latin1 y cubre las comillas curvas
      return 'win1252';
    }
    return iconv.encodingExists(c) ? c : 'utf-8';
  };

  const elegido = normaliza(charset);
  let texto = iconv.decode(buffer, elegido);

  // Red de seguridad: si dijeron UTF-8 pero el resultado tiene el patron
  // clasico de latin1 mal interpretado, reintentamos.
  if (elegido === 'utf-8') {
    const sospecha = (texto.match(/Ã.|â€|Â./g) || []).length;
    const reemplazos = (texto.match(/\uFFFD/g) || []).length;
    if (sospecha > 5 || reemplazos > 5) {
      const alterno = iconv.decode(buffer, 'win1252');
      const sospechaAlt = (alterno.match(/Ã.|â€|Â./g) || []).length;
      if (sospechaAlt < sospecha || reemplazos > 5) texto = alterno;
    }
  }
  return texto;
}

/* ------------------------------------------------------------------ *
 * 7. La descarga en si
 * ------------------------------------------------------------------ */

/**
 * Descarga una URL siguiendo redirecciones a mano y validando cada salto.
 *
 * @param {string} urlInicial
 * @returns {Promise<{buffer: Buffer, contentType: string, urlFinal: string, saltos: string[]}>}
 */
export async function descargar(urlInicial) {
  let actual = await validarURL(urlInicial);
  const saltos = [actual.toString()];

  for (let i = 0; i <= MAX_REDIRECCIONES; i++) {
    await esperarTurno(actual.hostname);

    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

    let respuesta;
    try {
      respuesta = await fetch(actual.toString(), {
        redirect: 'manual', // las seguimos nosotros para poder revalidar
        signal: control.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/pdf,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.6',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });
    } catch (e) {
      clearTimeout(reloj);
      if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
      if (e instanceof ErrorApp) throw e;
      throw errores.redInalcanzable(actual.hostname, e?.cause?.code || e?.code || e?.message);
    } finally {
      clearTimeout(reloj);
    }

    // Redireccion: validamos el destino antes de ir
    if (respuesta.status >= 300 && respuesta.status < 400) {
      const destino = respuesta.headers.get('location');
      if (!destino) throw errores.respuestaNoOk(respuesta.status, actual.hostname);
      const siguiente = new URL(destino, actual); // resuelve rutas relativas
      actual = await validarURL(siguiente.toString());
      saltos.push(actual.toString());
      continue;
    }

    if (!respuesta.ok) {
      throw errores.respuestaNoOk(respuesta.status, actual.hostname);
    }

    const buffer = await leerConTope(respuesta, MAX_BYTES);
    return {
      buffer,
      contentType: respuesta.headers.get('content-type') || '',
      urlFinal: actual.toString(),
      saltos,
    };
  }

  throw errores.demasiadasRedirecciones(MAX_REDIRECCIONES);
}
