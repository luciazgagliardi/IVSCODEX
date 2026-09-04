/**
 * Mudanza de una sola vez: lo que quedo guardado junto al codigo pasa a la
 * carpeta que sobrevive a los despliegues.
 *
 * Por que existe: hasta el 4/9/2026 el estado de runtime (cuentas, indice,
 * cache) vivia dentro de la carpeta del propio codigo, y en App Service
 * publicar reemplaza esa carpeta entera. Cada publicacion borraba las
 * cuentas registradas y todo lo que tuvieran guardado. Ahora esos datos
 * viven en /home/datos (ver DIR_DATOS en config.js), pero puede haber una
 * ultima tanda en el lugar viejo: esto la rescata antes de que el proximo
 * despliegue se la lleve.
 *
 * Reglas: no pisa nada. Si el destino ya tiene un archivo con ese nombre,
 * gana el del destino — es el que la app viene usando. Y si algo falla, se
 * avisa pero el servidor arranca igual: perder la mudanza es molesto, no
 * arrancar es peor.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIR_DATOS, DATOS_PERSISTEN } from '../config.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const VIEJO = path.resolve(aqui, '..'); // la carpeta backend/, donde vivian antes

/** Lo que vale la pena rescatar, de mas a menos importante. */
const CARPETAS = ['usuarios', 'indice', 'ocr-cache'];

async function existeConAlgo(dir) {
  try {
    return (await fs.readdir(dir)).length > 0;
  } catch {
    return false;
  }
}

/** Copia archivo por archivo, sin pisar lo que ya este en el destino. */
async function copiarSinPisar(desde, hasta) {
  await fs.mkdir(hasta, { recursive: true });
  let copiados = 0;
  for (const entrada of await fs.readdir(desde, { withFileTypes: true })) {
    const origen = path.join(desde, entrada.name);
    const destino = path.join(hasta, entrada.name);
    if (entrada.isDirectory()) {
      copiados += await copiarSinPisar(origen, destino);
      continue;
    }
    try {
      // 'wx' falla si ya existe: es la forma de no pisar sin tener que
      // preguntar primero y correr una carrera en el medio.
      await fs.copyFile(origen, destino, fs.constants.COPYFILE_EXCL);
      copiados++;
    } catch {
      /* ya estaba en el destino: se deja el del destino */
    }
  }
  return copiados;
}

/**
 * Corre la mudanza si hace falta. Devuelve un resumen para poder loguearlo.
 * No hace nada cuando los datos ya viven junto al codigo (desarrollo local).
 */
export async function mudarDatosSiHaceFalta() {
  if (!DATOS_PERSISTEN) return { mudo: false, motivo: 'los datos ya estan donde corresponde' };

  const hecho = [];
  for (const carpeta of CARPETAS) {
    const desde = path.join(VIEJO, carpeta);
    const hasta = path.join(DIR_DATOS, carpeta);
    if (desde === hasta) continue;
    if (!(await existeConAlgo(desde))) continue;
    try {
      const n = await copiarSinPisar(desde, hasta);
      if (n) hecho.push(`${carpeta}: ${n} archivo(s)`);
    } catch (e) {
      hecho.push(`${carpeta}: no se pudo (${e.message})`);
    }
  }
  return { mudo: hecho.length > 0, detalle: hecho };
}
