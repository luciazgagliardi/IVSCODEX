/**
 * Un Chrome de verdad para los sitios que se defienden con el desafío de
 * Cloudflare ("Just a moment...").
 *
 * El TSJ de CABA sirve los PDF desde www-test.tsjbaires.gov.ar. Desde un
 * navegador común baja sin problemas; desde el servidor publicado, Cloudflare
 * contesta 403 con `cf-mitigated: challenge`: no es un bloqueo por país sino
 * la verificación "¿es una persona?", que un navegador resuelve solo y un
 * fetch() no puede. Se midió en vivo con /api/diag-tsj (el pedido llegaba a
 * la página "Just a moment..." tanto desde Azure como desde el relevo).
 *
 * Qué hace este módulo: abre un Chrome sin interfaz, entra al sitio, espera a
 * que el desafío se resuelva y, con esa misma página ya autorizada, pide cada
 * PDF con un fetch() de la propia página (mismo origen, así que no hay CORS ni
 * hace falta copiar cookies a otro cliente: Cloudflare ata el permiso al
 * navegador que lo ganó). El navegador se abre una sola vez, se reutiliza
 * mientras haya movimiento y se cierra solo si pasan unos minutos sin uso.
 *
 * Se carga por import() dinámico: si los paquetes o el Chrome no están (otro
 * hosting, Node viejo), el resto del servidor sigue andando y esto simplemente
 * informa que no está disponible.
 */

import { enCola } from './almacen.js';

const MINUTOS_OCIOSO = 8;
const ESPERA_DESAFIO_MS = 45_000;
const ESPERA_PDF_MS = 60_000;
const SEÑALES_DE_DESAFIO = /just a moment|un momento|verificando|checking your browser|attention required/i;

const UA_NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

let navegador = null; // instancia de puppeteer
let paginas = new Map(); // origen -> página ya autorizada
let cierre = null; // temporizador de inactividad
let ultimaFalla = '';

/** Los únicos sitios para los que se abre el navegador. */
export function dominioConNavegador(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  return h === 'tsjbaires.gov.ar' || h.endsWith('.tsjbaires.gov.ar');
}

export function estadoNavegador() {
  return { abierto: Boolean(navegador), paginas: [...paginas.keys()], ultimaFalla };
}

function programarCierre() {
  clearTimeout(cierre);
  cierre = setTimeout(cerrarNavegador, MINUTOS_OCIOSO * 60_000);
  cierre.unref?.();
}

export async function cerrarNavegador() {
  clearTimeout(cierre);
  const b = navegador;
  navegador = null;
  paginas = new Map();
  if (b) await b.close().catch(() => {});
}

async function abrirNavegador() {
  if (navegador?.connected) return navegador;
  await cerrarNavegador();

  const { default: puppeteer } = await import('puppeteer-core');
  let executablePath = process.env.CHROME_PATH || '';
  let args = ['--no-sandbox', '--disable-setuid-sandbox', '--lang=es-AR', '--window-size=1366,768'];
  if (!executablePath) {
    // El paquete trae las librerías del sistema que Chrome necesita (libnspr4,
    // libnss3...) pero solo las activa si cree estar en AWS Lambda; el Linux de
    // Azure App Service no las tiene (visto en vivo: "libnspr4.so: cannot open
    // shared object file"). Se le avisa que sí, sólo durante la carga.
    const previo = process.env.AWS_EXECUTION_ENV;
    process.env.AWS_EXECUTION_ENV = previo || 'AWS_Lambda_nodejs24.x';
    let chromium;
    try {
      ({ default: chromium } = await import('@sparticuz/chromium'));
    } finally {
      if (previo === undefined) delete process.env.AWS_EXECUTION_ENV;
      else process.env.AWS_EXECUTION_ENV = previo;
    }
    executablePath = await chromium.executablePath();
    args = [...chromium.args, '--lang=es-AR', '--window-size=1366,768'];
  }
  navegador = await puppeteer.launch({
    executablePath,
    args,
    headless: 'shell',
    defaultViewport: { width: 1366, height: 768 },
    ignoreDefaultArgs: ['--enable-automation'],
  });
  navegador.on('disconnected', () => {
    navegador = null;
    paginas = new Map();
  });
  return navegador;
}

/** Disimula lo mínimo que delata a un Chrome sin interfaz. */
async function prepararPagina(pagina) {
  await pagina.setUserAgent(UA_NAVEGADOR);
  await pagina.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.6' });
  await pagina.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['es-AR', 'es', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = window.chrome || { runtime: {} };
  });
}

/** Una página de ese origen que ya superó el desafío; si no hay, la gana. */
async function paginaAutorizada(origen, informe) {
  const previa = paginas.get(origen);
  if (previa && !previa.isClosed()) return previa;

  const b = await abrirNavegador();
  const pagina = await b.newPage();
  await prepararPagina(pagina);

  const t0 = Date.now();
  let titulo = '';
  let sinDesafio = false;
  try {
    const resp = await pagina.goto(`${origen}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    informe.estadoInicial = resp?.status();
    // Una respuesta 200 que no es el desafío ya está autorizada: no hay nada que esperar.
    sinDesafio = resp?.status() === 200 && resp.headers()['cf-mitigated'] !== 'challenge';
  } catch (e) {
    informe.irA = String(e?.message || e).slice(0, 120);
  }
  while (!sinDesafio && Date.now() - t0 < ESPERA_DESAFIO_MS) {
    titulo = await pagina.title().catch(() => '');
    const cookies = await pagina.cookies().catch(() => []);
    const permiso = cookies.some((c) => c.name === 'cf_clearance');
    if (permiso || (titulo && !SEÑALES_DE_DESAFIO.test(titulo))) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  titulo = titulo || (await pagina.title().catch(() => ''));
  const cookies = await pagina.cookies().catch(() => []);
  informe.tituloFinal = titulo;
  informe.cookies = cookies.map((c) => c.name);
  informe.msDesafio = Date.now() - t0;
  if (SEÑALES_DE_DESAFIO.test(titulo)) {
    informe.cuerpo = (await pagina.evaluate(() => document.body?.innerText || '').catch(() => '')).slice(0, 300);
    await pagina.close().catch(() => {});
    throw new Error('el desafío de Cloudflare no se resolvió');
  }
  paginas.set(origen, pagina);
  return pagina;
}

/**
 * Trae una URL con el navegador. Devuelve { estado, contentType, buffer }.
 * Los pedidos se hacen de a uno: es una sola página compartida.
 */
export function traerConNavegador(urlTexto, informe = {}) {
  return enCola('navegador-cf', async () => {
    const url = new URL(urlTexto);
    const origen = url.origin;
    clearTimeout(cierre);
    try {
      let pagina = await paginaAutorizada(origen, informe);
      const pedir = () =>
        Promise.race([
          pagina.evaluate(async (u) => {
            const r = await fetch(u, { credentials: 'include' });
            const blob = await r.blob();
            const dataUrl = await new Promise((ok) => {
              const fr = new FileReader();
              fr.onload = () => ok(fr.result);
              fr.readAsDataURL(blob);
            });
            return { estado: r.status, tipo: r.headers.get('content-type') || '', dataUrl };
          }, url.toString()),
          new Promise((_, no) => setTimeout(() => no(new Error('tiempo agotado bajando el PDF')), ESPERA_PDF_MS)),
        ]);
      let r = await pedir();
      if (r.estado === 403) {
        // El permiso venció: se descarta la página y se gana de nuevo, una vez.
        paginas.delete(origen);
        await pagina.close().catch(() => {});
        pagina = await paginaAutorizada(origen, informe);
        r = await pedir();
      }
      const coma = r.dataUrl.indexOf(',');
      return {
        estado: r.estado,
        contentType: r.tipo,
        buffer: Buffer.from(r.dataUrl.slice(coma + 1), 'base64'),
      };
    } catch (e) {
      ultimaFalla = String(e?.message || e).slice(0, 200);
      throw e;
    } finally {
      programarCierre();
    }
  });
}
