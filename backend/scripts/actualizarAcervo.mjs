/**
 * La actualización mensual del acervo: vuelve a bajar de SAIJ los últimos
 * tres meses (scripts/cosecharSaij.mjs con RECIENTES=3), rearma las tandas y
 * las publica (scripts/publicarAcervo.mjs). Pensada para correr una vez
 * por mes (a mano o programada en la Mac).
 *
 *   node scripts/actualizarAcervo.mjs
 */

import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const correr = (script, env = {}) => execFileSync(process.execPath, [path.join(aqui, script)], { cwd: path.resolve(aqui, '..'), stdio: 'inherit', env: { ...process.env, ...env } });

console.log(`\n=== ${new Date().toISOString()} actualización del acervo ===`);
correr('cosecharSaij.mjs', { RECIENTES: process.env.RECIENTES || '3', PAUSA_MS: process.env.PAUSA_MS || '2000' });
correr('publicarAcervo.mjs');
