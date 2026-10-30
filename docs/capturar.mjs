/**
 * Regenera las imágenes de docs/img/ que usa el README: la cabecera (la portada real, con la
 * marca grande) y cuatro capturas de la aplicación. Todas salen con esquinas redondeadas, un
 * filete fino y fondo transparente, para que se vean bien en el tema claro y en el oscuro de GitHub.
 *
 * Uso, desde la raíz del repositorio y con el servidor en marcha (cd backend && npm start):
 *
 *   node docs/capturar.mjs                 todas las imágenes
 *   node docs/capturar.mjs buscar lector   sólo las nombradas
 *
 * Nombres: cabecera, buscar, lector, verificar, calculos, arquitectura. «lector» también hace la
 * búsqueda, porque abre el primer resultado. «arquitectura» dibuja docs/arquitectura.html y no
 * necesita el servidor.
 *
 * Con API_REMOTA=https://…/api las consultas las contesta el servidor publicado (acervo completo y
 * Corte IDH incluida) en vez del local; CONSULTA cambia la búsqueda de ejemplo («daño moral»).
 *
 * Hace falta Chrome (CHROME_PATH si no está en la ruta de macOS) y conexión a internet: la
 * tipografía se baja de Google Fonts, y la búsqueda y la verificación consultan las bases oficiales
 * de verdad (una consulta cada una). Por eso no corre sola ni en las pruebas.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from '../backend/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DOCS = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(DOCS, 'img');
const CITA = 'CSJN, «Halabi, Ernesto c/ P.E.N. s/ amparo ley 16.986», Fallos: 332:111, 24/02/2009';
const CONSULTA = process.env.CONSULTA || 'daño moral';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Una captura (PNG) metida en un marco de esquinas redondeadas, guardada como WebP con transparencia. */
async function enmarcar(navegador, png, ancho, escala, archivo) {
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: ancho, height: 200, deviceScaleFactor: escala });
  await pagina.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent}
    .m{position:relative;width:${ancho}px;border-radius:22px;overflow:hidden}
    .m img{display:block;width:100%}
    .m::after{content:"";position:absolute;inset:0;border-radius:22px;box-shadow:inset 0 0 0 1px rgba(241,238,230,.16)}
  </style><div class="m"><img alt="" src="data:image/png;base64,${Buffer.from(png).toString('base64')}"></div>`);
  await pagina.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const caja = await pagina.$('.m');
  await caja.screenshot({ path: path.join(SALIDA, archivo), type: 'webp', quality: 92, omitBackground: true });
  await pagina.close();
  console.log('listo', archivo, Math.round(fs.statSync(path.join(SALIDA, archivo)).size / 1024) + ' KB');
}

/**
 * Con API_REMOTA (por ejemplo https://…azurewebsites.net/api) las llamadas a /api se contestan con el
 * servidor publicado, que tiene el acervo completo y todas las bases; sin ella, con el servidor local.
 */
async function usarApiRemota(pagina) {
  const remota = (process.env.API_REMOTA || '').replace(/\/$/, '');
  if (!remota) return;
  const origen = new URL(BASE).origin;
  await pagina.setRequestInterception(true);
  pagina.on('request', async (pedido) => {
    const u = new URL(pedido.url());
    if (u.origin !== origen || !u.pathname.startsWith('/api/')) return pedido.continue();
    try {
      const conCuerpo = !['GET', 'HEAD'].includes(pedido.method());
      const r = await fetch(remota + u.pathname.slice(4) + u.search, {
        method: pedido.method(),
        headers: { 'content-type': pedido.headers()['content-type'] || 'application/json' },
        body: conCuerpo ? pedido.postData() : undefined,
      });
      await pedido.respond({ status: r.status, contentType: r.headers.get('content-type') || 'application/json', body: Buffer.from(await r.arrayBuffer()) });
    } catch {
      await pedido.abort();
    }
  });
}

/** Una página de la aplicación a 1440 × 900, sin el botón flotante de Lexia ni los avisos pasajeros (#flash), que tapan los bordes. */
async function abrirAplicacion(navegador, seccion) {
  const pagina = await navegador.newPage();
  await usarApiRemota(pagina);
  await pagina.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await pagina.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await pagina.addStyleTag({ content: '#asist,#flash{display:none !important}' });
  await espera(1500);
  await pagina.evaluate((s) => window.postMessage({ ivs: 'abrir', tab: s }, location.origin), seccion);
  await espera(2500);
  return pagina;
}

const irA = async (pagina, y) => { await pagina.evaluate((v) => window.scrollTo(0, v), y); await espera(800); };

const CAPTURAS = {
  async cabecera(navegador) {
    const pagina = await navegador.newPage();
    await pagina.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await pagina.goto(`${BASE}/portada/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    // Sin los botones de la barra y con la marca grande, centrada: es el mismo logo, sólo escalado.
    await pagina.addStyleTag({ content: `
      header.cab .acts{display:none !important}
      header.cab{justify-content:center !important;padding-top:34px !important}
      header.cab .marca2{font-size:44px !important}` });
    // El titular rota entre varias frases: se espera a que el prisma se asiente y se toma justo
    // cuando está la que dice qué es el sitio.
    await espera(3500);
    for (let i = 0; i < 200; i++) {
      if (await pagina.evaluate(() => /repositorios judiciales/.test(document.querySelector('h1')?.textContent || ''))) break;
      await espera(200);
    }
    const png = await pagina.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 640 } });
    await pagina.close();
    await enmarcar(navegador, png, 1440, 2, 'cabecera.webp');
  },

  /** Buscar y, a partir de su primer resultado, el Lector: una sola búsqueda para las dos capturas. */
  async buscar(navegador, { lector = false, buscar = true } = {}) {
    const pagina = await abrirAplicacion(navegador, 'buscar');
    await pagina.click('#q');
    await pagina.type('#q', CONSULTA, { delay: 15 });
    await pagina.keyboard.press('Enter');
    // se espera a que ninguna base siga «buscando…» (hasta 90 s) antes de sacar la captura
    await espera(5000);
    for (let i = 0; i < 85; i++) {
      if (!(await pagina.evaluate(() => /buscando(\.\.\.|…)/i.test(document.body.innerText)))) break;
      await espera(1000);
    }
    await espera(1500);
    if (buscar) {
      // sin el título ni las voces sugeridas: la lista de las once bases con sus cantidades, y los pasajes
      const y = await pagina.evaluate(() => {
        const fila = document.querySelector('.bz-fila.on');
        return fila ? Math.max(0, fila.getBoundingClientRect().top + scrollY - 190) : 270;
      });
      await irA(pagina, y);
      await enmarcar(navegador, await pagina.screenshot(), 1440, 1.5, 'buscar.webp');
    }
    if (lector) {
      // «Más recientes»: el primero es la sentencia más nueva, un texto largo y siempre el mismo
      // (con «intercalados» el primer resultado cambia según qué base conteste antes).
      await pagina.evaluate(() => [...document.querySelectorAll('button')].find((e) => /^Más recientes$/i.test(e.textContent.trim()))?.click());
      await espera(1500);
      const abierto = await pagina.evaluate(() => {
        const b = [...document.querySelectorAll('button,a')].find((e) => /Abrir en el Lector/i.test(e.textContent));
        if (b) b.click();
        return !!b;
      });
      if (!abierto) throw new Error('la búsqueda no devolvió ningún resultado para abrir en el Lector');
      await espera(25000);
      // sin el título de la sección: se baja hasta que la barra de coincidencias queda pegada debajo de
      // la de arriba (su posición fija), con Lexia y el comienzo del texto a la vista
      const y = await pagina.evaluate(() => {
        const barra = document.querySelector('.barra-doc');
        return barra ? Math.max(0, barra.getBoundingClientRect().top + scrollY - 71) : 250;
      });
      await irA(pagina, y);
      await enmarcar(navegador, await pagina.screenshot(), 1440, 1.5, 'lector.webp');
    }
    await pagina.close();
  },

  async verificar(navegador) {
    const pagina = await abrirAplicacion(navegador, 'verificar');
    await pagina.click('textarea');
    await pagina.type('textarea', CITA, { delay: 10 });
    await pagina.evaluate(() => [...document.querySelectorAll('button')].find((e) => /Verificar la cita/i.test(e.textContent))?.click());
    await espera(25000);
    await irA(pagina, 400); // la cita pegada, el botón y el veredicto con sus candidatos
    await enmarcar(navegador, await pagina.screenshot(), 1440, 1.5, 'verificar.webp');
    await pagina.close();
  },

  /** El diagrama de «Cómo funciona»: se dibuja desde docs/arquitectura.html, no necesita el servidor. */
  async arquitectura(navegador) {
    const pagina = await navegador.newPage();
    await pagina.setViewport({ width: 1200, height: 520, deviceScaleFactor: 2 });
    await pagina.goto(pathToFileURL(path.join(DOCS, 'arquitectura.html')).href, { waitUntil: 'networkidle2', timeout: 60000 });
    await espera(800);
    const png = await pagina.screenshot();
    await pagina.close();
    await enmarcar(navegador, png, 1200, 2, 'arquitectura.webp');
  },

  async calculos(navegador) {
    const pagina = await abrirAplicacion(navegador, 'calculos');
    const [capital] = await pagina.$$('input[type=text]');
    await capital.click();
    await capital.type('1500000', { delay: 20 });
    await pagina.evaluate(() => {
      const [desde, hasta] = document.querySelectorAll('input[type=date]');
      const poner = (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
      poner(desde, '2023-01-01');
      poner(hasta, '2023-12-31');
    });
    const tasa = (await pagina.$$('input[type=text]'))[1];
    await tasa.click();
    await tasa.type('58,5', { delay: 20 });
    await pagina.click('body'); // sin el cursor titilando en el campo
    await espera(1500);
    await irA(pagina, 330);
    await enmarcar(navegador, await pagina.screenshot(), 1440, 1.5, 'calculos.webp');
    await pagina.close();
  },
};

const TODAS = ['cabecera', 'buscar', 'lector', 'verificar', 'calculos', 'arquitectura'];
const pedidas = process.argv.slice(2);
const nombres = pedidas.length ? pedidas : TODAS;
if (nombres.some((n) => !TODAS.includes(n))) { console.error('Nombres posibles: ' + TODAS.join(', ')); process.exit(1); }

fs.mkdirSync(SALIDA, { recursive: true });
const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
try {
  const conLector = nombres.includes('lector');
  const conBuscar = nombres.includes('buscar');
  for (const nombre of nombres) {
    if (nombre === 'lector' && conBuscar) continue; // ya salió junto con «buscar»
    if (nombre === 'buscar') await CAPTURAS.buscar(navegador, { lector: conLector, buscar: true });
    else if (nombre === 'lector') await CAPTURAS.buscar(navegador, { lector: true, buscar: false });
    else await CAPTURAS[nombre](navegador);
  }
} finally {
  await navegador.close();
}
