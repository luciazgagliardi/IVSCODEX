/**
 * El mismo IVSPasajes que usa la página (frontend/pasajes.js), para los pasajes
 * que el servidor saca de cada documento. A Azure viaja sólo backend/: el flujo
 * de despliegue copia el archivo a backend/lib/pasajes.cjs; acá, en desarrollo,
 * se toma directo del frontend.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let mod;
try { mod = require('./pasajes.cjs'); } catch { mod = require('../../frontend/pasajes.js'); }
export const { IVSPasajes } = mod;
