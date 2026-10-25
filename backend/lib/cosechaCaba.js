/**
 * Cosecha DESPACIO el Tribunal Superior de Justicia de la Ciudad desde el
 * propio servidor: el TSJ le contesta a Azure pero no a la Mac donde se arma
 * el resto del acervo (scripts/cosecharSaij.mjs).
 *
 * Dos pasos que se alternan, uno por tic, con una pausa larga entre tics:
 *   1. el listado: una página del buscador del TSJ por cada término de
 *      datos/terminos-cosecha.json (hasta 10 páginas por término);
 *   2. el texto: el PDF de un fallo listado que todavía no lo tenga (con el
 *      mismo Chrome que resuelve el desafío de Cloudflare, ver
 *      lib/navegadorCf.js), recortado a los primeros caracteres del cuerpo.
 * Cada fallo va al acervo (lib/acervo.js, agregarAlAcervo), donde ya se puede
 * buscar y abrir en el Lector, y queda en disco para las versiones nuevas.
 *
 * Para no molestar al TSJ ni a quien está usando la página: un pedido cada
 * PAUSA_MS (20 s), nada mientras alguien buscó en CABA en el último minuto,
 * y si el sitio corta, media hora de espera. El avance se guarda: un reinicio
 * del servidor retoma donde quedó.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIR_DATOS } from '../config.js';
import { buscarCaba } from './indiceCaba.js';
import { descargar } from './descargador.js';
import { traerConNavegador } from './navegadorCf.js';
import { extraerDesdeBuffer } from './documento.js';
import { agregarAlAcervo, estadoAcervo, idsConTexto } from './acervo.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVO_ESTADO = path.join(DIR_DATOS, 'acervo', 'cosecha-caba.json');
const PAUSA_MS = Number(process.env.COSECHA_CABA_PAUSA_MS || 20_000);
const ESPERA_CORTE_MS = 30 * 60_000;
const PAGINAS_POR_TERMINO = 10;
const LARGO_TEXTO = 6000;

let estado = { activa: false, termino: 0, desde: 0, pagina: 1, listados: 0, conTexto: 0, pendientes: [], ultimo: null, error: null };
let ultimoUso = 0, reloj = null, terminos = [];

/** Lo llama la búsqueda en vivo de CABA: mientras alguien la usa, la cosecha espera. */
export function marcarUsoCaba() { ultimoUso = Date.now(); }
export function estadoCosechaCaba() { const { pendientes, ...resto } = estado; return { ...resto, pendientes: pendientes.length, terminos: terminos.length }; }

async function guardar() { await fs.mkdir(path.dirname(ARCHIVO_ESTADO), { recursive: true }); await fs.writeFile(ARCHIVO_ESTADO, JSON.stringify(estado)); }

async function pasoListado() {
  const q = terminos[estado.termino];
  if (!q) return false;
  const r = await buscarCaba({ q, modo: 'todas', desde: estado.desde, porPagina: 20 });
  const regs = (r.resultados || []).filter((x) => x?.id && x.linkFallo).map((x) => ({ ...x, fuente: 'caba' }));
  if (regs.length) {
    await agregarAlAcervo(regs);
    estado.listados += regs.length;
    const conTexto = idsConTexto('caba');
    for (const x of regs) if (!conTexto.has(x.id) && !estado.pendientes.some((p) => p.id === x.id)) estado.pendientes.push(x);
  }
  if (typeof r.siguienteDesde === 'number' && estado.pagina < PAGINAS_POR_TERMINO) { estado.desde = r.siguienteDesde; estado.pagina++; }
  else { estado.termino++; estado.desde = 0; estado.pagina = 1; }
  return true;
}

/* El PDF: directo con Chrome (el pedido común se va en la redirección y el desafío de
   Cloudflare, y no le alcanzan sus 25 s); si Chrome no está, el pedido común. */
async function bajarPdf(url) {
  try {
    const n = await traerConNavegador(url);
    if (n?.estado >= 200 && n.estado < 300 && n.buffer?.length) return { buffer: n.buffer, contentType: n.contentType, urlFinal: url };
  } catch { /* sin navegador: el pedido común */ }
  return descargar(url);
}
async function pasoTexto() {
  const r = estado.pendientes.shift();
  if (!r) return false;
  let buffer, contentType, urlFinal;
  try {
    ({ buffer, contentType, urlFinal } = await bajarPdf(r.linkFallo));
  } catch (e) {
    // no se pierde: vuelve al final de la cola, hasta tres intentos
    if ((r.intentos || 0) < 2) estado.pendientes.push({ ...r, intentos: (r.intentos || 0) + 1 });
    throw e;
  }
  const doc = await extraerDesdeBuffer(buffer, contentType, urlFinal);
  const texto = String(doc.texto || '').replace(/\s+/g, ' ').trim();
  if (texto.length > 200) {
    await agregarAlAcervo([{ ...r, sumario: texto.slice(0, LARGO_TEXTO).replace(/\s+\S*$/, '') + (texto.length > LARGO_TEXTO ? ' …' : '') }]);
    estado.conTexto++;
  }
  return true;
}

async function tic() {
  reloj = null;
  let espera = PAUSA_MS;
  try {
    if (!estadoAcervo().activo || Date.now() - ultimoUso < 60_000) { espera = 60_000; return; }
    // alterna: con fallos esperando su texto, uno de cada dos tics es de texto
    const hizo = (estado.pendientes.length && estado.ultimo !== 'texto') ? await pasoTexto() || await pasoListado() : await pasoListado() || await pasoTexto();
    estado.ultimo = estado.ultimo === 'texto' ? 'listado' : 'texto';
    estado.error = null;
    if (!hizo) { estado.activa = false; console.log(`[cosecha CABA] terminada: ${estado.listados} listados, ${estado.conTexto} con texto`); await guardar(); return; }
  } catch (e) {
    estado.error = `${new Date().toISOString().slice(0, 16)} ${String(e?.message || e).slice(0, 160)}`;
    // un corte (403, 429, 5xx) es media hora; una demora o un PDF que no se pudo leer, cinco minutos
    espera = /\b(403|429|5\d\d)\b|bloque|denegad/i.test(String(e?.message || '')) ? ESPERA_CORTE_MS : 5 * 60_000;
  } finally {
    await guardar().catch(() => {});
    if (estado.activa) { reloj = setTimeout(tic, espera); reloj.unref?.(); }
  }
}

/** Arranca la cosecha (de una sola vez por proceso), unos minutos después del arranque. */
export async function iniciarCosechaCaba({ demoraMs = 5 * 60_000 } = {}) {
  if (estado.activa) return;
  try { terminos = JSON.parse(await fs.readFile(path.join(aqui, '..', 'datos', 'terminos-cosecha.json'), 'utf8')); } catch { return; }
  try { estado = { ...estado, ...JSON.parse(await fs.readFile(ARCHIVO_ESTADO, 'utf8')) }; } catch { /* primera vez */ }
  if (estado.termino >= terminos.length && !estado.pendientes.length) return;
  estado.activa = true;
  reloj = setTimeout(tic, demoraMs); reloj.unref?.();
  console.log(`  Cosecha    TSJ CABA despacio: término ${estado.termino + 1} de ${terminos.length}, ${estado.listados} listados, ${estado.conTexto} con texto`);
}
