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
import { filtrarPorModo } from './relevancia.js';

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

/**
 * Busca en lo ya guardado. Es el respaldo para cuando el sitio oficial no
 * responde, asi que tiene que encontrar de verdad.
 *
 * Antes comparaba la consulta ENTERA como un unico texto literal y sin
 * plegar acentos: "daño moral" solo servia si esas dos palabras aparecian
 * pegadas y con la ñ igual. Resultado: con 815 fichas de CABA guardadas, el
 * respaldo devolvia CERO justo el dia que el buscador oficial se cayo, que
 * es exactamente cuando tenia que servir. Ahora usa el mismo filtro por
 * modo que el resto de la app (lib/relevancia.js).
 */
export async function buscarEnIndice(fuente, texto, { modo = 'todas', excluir = '' } = {}) {
  const q = String(texto || '').trim();
  if (!q) return [];
  const dato = await leer(fuente);
  const { lista } = filtrarPorModo(Object.values(dato.registros), { q, modo, excluir });
  return lista;
}

/** Cuántos registros hay guardados y cuándo se actualizó por última vez. */
export async function estadoIndice(fuente) {
  const dato = await leer(fuente);
  return { guardados: Object.keys(dato.registros).length, actualizadoEn: dato.actualizadoEn };
}
