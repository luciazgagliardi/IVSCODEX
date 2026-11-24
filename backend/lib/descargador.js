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
import { lookup as dnsLookup } from 'node:dns';
import net from 'node:net';
import { Agent, fetch as fetchSeguro } from 'undici';
import iconv from 'iconv-lite';
import { dominioConNavegador, traerConNavegador } from './navegadorCf.js';

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
import { urlParaPedir, sinClave } from './proxyOrigen.js';

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

/**
 * Rangos que nunca se descargan, comparados con net.BlockList (CIDR de verdad,
 * en lugar de adivinar con prefijos de texto). Cubre lo que un ataque SSRF
 * suele usar: loopback, redes privadas, enlace local y metadatos de la nube
 * (169.254.0.0/16), CGNAT, documentación, multicast y reservado, y en IPv6
 * además las formas que envuelven una IPv4 (::ffff:a.b.c.d y su variante
 * hexadecimal, NAT64 y 6to4), que con un chequeo por texto se escapan.
 */
const BLOQUEADAS = new net.BlockList();
for (const [red, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) BLOQUEADAS.addSubnet(red, bits, 'ipv4');
for (const [red, bits] of [
  ['::', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48],
  ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10],
  ['fec0::', 10], ['ff00::', 8],
]) BLOQUEADAS.addSubnet(red, bits, 'ipv6');

export function ipEsPrivada(ip) {
  const v = net.isIP(ip);
  if (!v) return true; // si no es una IP valida, la tratamos como sospechosa
  return BLOQUEADAS.check(ip, v === 4 ? 'ipv4' : 'ipv6');
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
const permitida = (ip) => !ipEsPrivada(ip) || (PERMITIR_RED_PRIVADA && esLoopback(ip));

async function verificarDNS(host) {
  host = String(host).replace(/^\[|\]$/g, ''); // los literales IPv6 llegan entre corchetes: [::1]

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

/**
 * El agente de red que usa TODA descarga: valida la dirección en el momento
 * exacto de conectar. Chequear el DNS antes y dejar que fetch lo resuelva de
 * nuevo después deja una ventana (DNS rebinding: un dominio que contesta una
 * IP pública para el chequeo y 127.0.0.1 para la conexión). Acá la IP que se
 * valida es la misma a la que se conecta.
 */
const agenteSeguro = new Agent({
  connect: {
    lookup(host, opciones, cb) {
      dnsLookup(host, { ...opciones, all: true }, (err, direcciones) => {
        if (err) return cb(err);
        if (!direcciones.length || direcciones.some((d) => !permitida(d.address))) {
          const e = new Error('dirección no permitida');
          e.code = 'ERR_RED_PRIVADA';
          return cb(e);
        }
        if (opciones && opciones.all) return cb(null, direcciones);
        cb(null, direcciones[0].address, direcciones[0].family);
      });
    },
  },
});

/* ------------------------------------------------------------------ *
 * 3. Cortesia con el sitio de origen
 * ------------------------------------------------------------------ */

// Próximo instante reservado por host. Se reserva el turno ANTES de
// esperar: con una Map de "último pedido" varias búsquedas simultáneas leían
// el mismo valor y salían juntas, anulando toda la cortesía entre peticiones.
const siguienteTurno = new Map();

// Sitios que sirven archivos fijos (PDF de Juristeca): menos espera entre pedidos.
const ESPERA_PROPIA = { 'juristeca.jusbaires.gob.ar': 400 };

export async function esperarTurno(host) {
  const ahora = Date.now();
  const intervalo = ESPERA_PROPIA[host] ?? ESPERA_POR_HOST_MS;
  const turno = Math.max(ahora, siguienteTurno.get(host) || 0);
  siguienteTurno.set(host, turno + intervalo);
  const falta = turno - ahora;
  if (falta > 0) await new Promise((resolve) => setTimeout(resolve, falta));
}


/* ------------------------------------------------------------------ *
 * 3.b. Cliente HTTP común para consultas a fuentes
 * ------------------------------------------------------------------ */

const ESTADOS_REINTENTABLES = new Set([408, 425, 500, 502, 503, 504, 520, 522, 524]);
const ERRORES_REINTENTABLES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN',
  'ENOTFOUND', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'EPROTO',
]);

function codigoDeRed(e) {
  if (e?.cause?.code || e?.code) return String(e.cause?.code || e.code);
  if (e?.codigo === 'RED_INALCANZABLE') {
    const m = String(e.message || '').match(/\b(EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET)\b/);
    if (m) return m[1];
  }
  return '';
}

function demoraParaReintento(respuesta, intento) {
  if (respuesta?.status === 429) {
    const valor = respuesta.headers.get('retry-after');
    if (!valor) return null;
    const segundos = Number(valor);
    const ms = Number.isFinite(segundos)
      ? segundos * 1000
      : Math.max(0, Date.parse(valor) - Date.now());
    return ms >= 0 && ms <= 1000 ? Math.max(100, ms) : null;
  }
  if (!ESTADOS_REINTENTABLES.has(respuesta?.status)) return null;
  return Math.min(800, 250 * (2 ** intento));
}

function cuerpoRepetible(body) {
  return body == null || typeof body === 'string' ||
    Buffer.isBuffer(body) || body instanceof Uint8Array ||
    body instanceof ArrayBuffer || body instanceof URLSearchParams ||
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    (typeof FormData !== 'undefined' && body instanceof FormData);
}

function quitarCabecerasDeCuerpo(headers) {
  for (const nombre of ['content-length', 'content-type', 'content-encoding', 'transfer-encoding']) {
    headers.delete(nombre);
  }
}

/**
 * Cliente común de peticiones a portales oficiales.
 *
 * Usa el mismo agente de conexión segura que el descargador del Lector,
 * valida el dominio y el DNS de cada destino y redirección, respeta la
 * cortesía por host y reintenta errores de transporte y respuestas 5xx
 * transitorias. No insiste ante denegaciones permanentes ni 429 prolongados.
 * Los adaptadores conservan sus métodos, cuerpos, cabeceras y cookies.
 *
 * La fábrica permite probar la política con dependencias simuladas sin red.
 */
export function crearFetchOrigen({
  request = fetchSeguro,
  validar = validarURL,
  esperar = esperarTurno,
  preparar = urlParaPedir,
  timeoutMs = TIMEOUT_MS,
} = {}) {
  return async function fetchOrigen(urlInicial, opciones = {}, politica = {}) {
    const timeout = Math.max(250, Number(politica.timeoutMs || timeoutMs));
    const reintentos = Math.max(0, Math.min(3, Number(politica.reintentos ?? 2)));
    const signalExterno = opciones.signal;
    const validarConReintento = async (url) => {
      for (let intento = 0; intento <= reintentos; intento++) {
        try {
          return await validar(String(url));
        } catch (e) {
          const transitorio = ERRORES_REINTENTABLES.has(codigoDeRed(e));
          if (!transitorio || intento === reintentos || signalExterno?.aborted) throw e;
          await new Promise((resolve) => setTimeout(resolve, Math.min(800, 250 * (2 ** intento))));
        }
      }
      throw new Error('No se pudo validar el destino de la fuente.');
    };
    const headersIniciales = new Headers(opciones.headers || {});
    if (!headersIniciales.has('user-agent')) headersIniciales.set('User-Agent', USER_AGENT);

    let actual = await validarConReintento(urlInicial);
    let metodo = String(opciones.method || 'GET').toUpperCase();
    let cuerpo = opciones.body;
    const puedeRepetir = cuerpoRepetible(cuerpo);
    const opcionesBase = { ...opciones };
    delete opcionesBase.signal;
    delete opcionesBase.dispatcher;
    delete opcionesBase.redirect;
    delete opcionesBase.method;
    delete opcionesBase.body;

    for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
      if (politica.respetarTurno !== false) await esperar(actual.hostname);
      let redirigir = false;

      for (let intento = 0; intento <= reintentos; intento++) {
        const control = new AbortController();
        const signal = signalExterno
          ? AbortSignal.any([signalExterno, control.signal])
          : control.signal;
        const reloj = setTimeout(() => control.abort(), timeout);
        let respuesta;
        try {
          const pedida = preparar(actual.toString(), actual.hostname);
          respuesta = await request(pedida, {
            ...opcionesBase,
            method: metodo,
            ...(cuerpo !== undefined ? { body: cuerpo } : {}),
            headers: new Headers(headersIniciales),
            dispatcher: agenteSeguro,
            redirect: 'manual',
            signal,
          });
        } catch (e) {
          clearTimeout(reloj);
          if (signalExterno?.aborted) throw e;
          const transitorio = ERRORES_REINTENTABLES.has(codigoDeRed(e));
          if (transitorio && puedeRepetir && intento < reintentos) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(800, 250 * (2 ** intento))));
            continue;
          }
          throw e;
        }
        clearTimeout(reloj);

        const demora = demoraParaReintento(respuesta, intento);
        if (demora !== null && puedeRepetir && intento < reintentos) {
          try { await respuesta.body?.cancel(); } catch { /* respuesta descartada */ }
          await new Promise((resolve) => setTimeout(resolve, demora));
          continue;
        }

        if (respuesta.status >= 300 && respuesta.status < 400) {
          const destino = respuesta.headers.get('location');
          if (!destino) return respuesta;
          try { await respuesta.body?.cancel(); } catch { /* respuesta descartada */ }
          const siguiente = await validarConReintento(new URL(destino, actual).toString());
          if (siguiente.hostname !== actual.hostname) {
            headersIniciales.delete('authorization');
            headersIniciales.delete('cookie');
            headersIniciales.delete('proxy-authorization');
          }
          if (respuesta.status === 303 ||
              ((respuesta.status === 301 || respuesta.status === 302) && metodo === 'POST')) {
            metodo = metodo === 'HEAD' ? 'HEAD' : 'GET';
            cuerpo = undefined;
            quitarCabecerasDeCuerpo(headersIniciales);
          }
          actual = siguiente;
          redirigir = true;
          break;
        }

        return respuesta;
      }
      if (!redirigir) throw new Error('La consulta al origen terminó sin respuesta.');
    }
    throw errores.demasiadasRedirecciones(MAX_REDIRECCIONES);
  };
}

export const fetchOrigen = crearFetchOrigen();

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

    let respuesta, viaRele = false;
    try {
      // Algunos hosts le niegan la conexión al datacenter publicado (ver
      // lib/proxyOrigen.js); se recalcula en cada salto porque una
      // redirección puede cambiar de host (ej. a un subdominio "-test").
      const pedida = urlParaPedir(actual.toString(), actual.hostname);
      viaRele = pedida !== actual.toString() && !/api\.scraperapi\.com/.test(pedida);
      respuesta = await fetchSeguro(pedida, {
        dispatcher: agenteSeguro,
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
      if (e?.cause?.code === 'ERR_RED_PRIVADA' || e?.code === 'ERR_RED_PRIVADA') throw errores.redPrivada(actual.hostname, 'resuelta al conectar');
      throw errores.redInalcanzable(actual.hostname, sinClave(e?.cause?.code || e?.code || e?.message));
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
      // Cloudflare pide "demostrar que es una persona" (cf-mitigated:
      // challenge): un fetch() no puede, un navegador sí. Para los sitios
      // autorizados se lo hace con Chrome (lib/navegadorCf.js) y, si baja el
      // documento, sigue como si el pedido directo hubiera andado.
      if (
        respuesta.status === 403 &&
        respuesta.headers.get('cf-mitigated') === 'challenge' &&
        dominioConNavegador(actual.hostname)
      ) {
        try {
          const n = await traerConNavegador(actual.toString());
          if (n.estado >= 200 && n.estado < 300 && n.buffer.length) {
            if (n.buffer.length > MAX_BYTES) throw errores.demasiadoGrande(MAX_BYTES);
            return { buffer: n.buffer, contentType: n.contentType, urlFinal: actual.toString(), saltos };
          }
        } catch (err) {
          if (err instanceof ErrorApp) throw err;
          // Sin navegador (o sin poder pasar el desafío): sigue el aviso de siempre.
        }
      }
      const e = errores.respuestaNoOk(respuesta.status, actual.hostname, new URL(saltos[0]).hostname);
      if (viaRele) e.message += ' (el pedido pasó por el relevo y el sitio igual lo rechazó)';
      throw e;
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
