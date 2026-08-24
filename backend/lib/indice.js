/**
 * Índice propio en disco: la "copia guardada" de lo que se fue buscando.
 *
 * Mismo espíritu que lib/cache.js —JSON simple, sin base de datos— pero sin
 * vencimiento: acá no se descarta nada solo, se va sumando. A propósito NO
 * hace un barrido completo de ninguna fuente: solo guarda lo que alguien
 * efectivamente buscó (ver README, sección "ser buen vecino").
 *
 * Un archivo por fuente: backend/indice/<fuente>.json, con un objeto
 * { registros: { <id>: {...} }, actualizadoEn } adentro.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { DIR_INDICE } from '../config.js';

let listo = false;

async function asegurarCarpeta() {
  if (listo) return;
  await fs.mkdir(DIR_INDICE, { recursive: true });
  listo = true;
}

function archivoDe(fuente) {
  const nombre = String(fuente || '').replace(/[^a-z0-9_-]/gi, '');
  return path.join(DIR_INDICE, `${nombre}.json`);
}

async function leer(fuente) {
  try {
    await asegurarCarpeta();
    const crudo = await fs.readFile(archivoDe(fuente), 'utf8');
    const dato = JSON.parse(crudo);
    return { registros: dato.registros || {}, actualizadoEn: dato.actualizadoEn || null };
  } catch {
    return { registros: {}, actualizadoEn: null }; // no existe todavía, o está corrupto
  }
}

async function escribir(fuente, dato) {
  await asegurarCarpeta();
  await fs.writeFile(archivoDe(fuente), JSON.stringify(dato), 'utf8');
}

/** Guarda o actualiza registros por id. No borra lo que ya había. */
export async function upsertRegistros(fuente, registros) {
  const dato = await leer(fuente);
  for (const r of registros) {
    if (!r?.id) continue;
    dato.registros[r.id] = { ...r, guardadoEn: dato.registros[r.id]?.guardadoEn || Date.now() };
  }
  dato.actualizadoEn = Date.now();
  try {
    await escribir(fuente, dato);
  } catch (e) {
    console.warn('[indice] no pude guardar:', e.message); // no le arruina la respuesta a nadie
  }
  return Object.keys(dato.registros).length;
}

/** Búsqueda simple en memoria sobre lo ya guardado (voces + sumario + carátula). */
export async function buscarEnIndice(fuente, texto) {
  const q = String(texto || '').trim().toLowerCase();
  if (!q) return [];
  const dato = await leer(fuente);
  return Object.values(dato.registros).filter((r) => {
    const bolsa = [r.caratula, r.sumario, ...(r.voces || [])].join(' ').toLowerCase();
    return bolsa.includes(q);
  });
}

/** Cuántos registros hay guardados y cuándo se actualizó por última vez. */
export async function estadoIndice(fuente) {
  const dato = await leer(fuente);
  return { guardados: Object.keys(dato.registros).length, actualizadoEn: dato.actualizadoEn };
}
