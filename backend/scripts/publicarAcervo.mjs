/**
 * Publica el acervo: arma las tandas (scripts/armarAcervo.mjs), las deja
 * como un único commit en la rama «acervo» (se reemplaza entera, así el
 * repositorio no acumula versiones viejas) y anota la versión en
 * backend/acervo-version.txt en main, lo que dispara el despliegue en Azure
 * (.github/workflows/azure-backend.yml). Al arrancar, el servidor importa la
 * versión nueva de fondo (lib/acervo.js).
 *
 *   node scripts/publicarAcervo.mjs             (arma y publica)
 *   SIN_ARMAR=1 node scripts/publicarAcervo.mjs (publica las tandas ya armadas)
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(aqui, '..');
const REPO = path.resolve(BACKEND, '..');
const TANDAS = path.join(BACKEND, 'acervo-datos');
const RAMA_DIR = path.join(os.tmpdir(), 'iuris-acervo');
const git = (args, cwd = REPO) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const firma = '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

if (!process.env.SIN_ARMAR) execFileSync(process.execPath, [path.join(aqui, 'armarAcervo.mjs')], { cwd: BACKEND, stdio: 'inherit' });
const man = JSON.parse(await fs.readFile(path.join(TANDAS, 'manifiesto.json'), 'utf8'));

// la rama «acervo», en un directorio aparte para no tocar el trabajo en main
git(['fetch', 'origin', 'acervo']);
try { await fs.access(path.join(RAMA_DIR, '.git')); } catch {
  try { git(['worktree', 'prune']); } catch { /* nada que limpiar */ }
  await fs.rm(RAMA_DIR, { recursive: true, force: true });
  git(['worktree', 'add', '-f', RAMA_DIR, 'acervo']);
}
for (const f of await fs.readdir(RAMA_DIR)) if (f !== '.git') await fs.rm(path.join(RAMA_DIR, f), { recursive: true, force: true });
for (const f of await fs.readdir(TANDAS)) await fs.copyFile(path.join(TANDAS, f), path.join(RAMA_DIR, f));
await fs.writeFile(path.join(RAMA_DIR, 'LEAME.md'), 'Tandas del acervo de IVS CODEX (ver backend/lib/acervo.js y backend/scripts/armarAcervo.mjs en main).\nEsta rama se reemplaza entera en cada versión.\n');
git(['add', '-A'], RAMA_DIR);
// un commit sin padre: la rama queda con la versión nueva sola
const arbol = git(['write-tree'], RAMA_DIR);
const commit = git(['commit-tree', arbol, '-m', `Acervo ${man.version}${firma}`], RAMA_DIR);
git(['reset', '--hard', commit], RAMA_DIR);
git(['push', '-f', 'origin', 'HEAD:acervo'], RAMA_DIR);
console.log(`rama acervo: ${man.version} (${commit.slice(0, 7)})`);

// main: la versión anotada dispara el despliegue
git(['fetch', 'origin', 'main']);
const atras = git(['rev-list', '--count', 'HEAD..origin/main']);
if (git(['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main' || atras !== '0') {
  console.log(`main no está al día con origin (o no es la rama actual): anote ${man.version} en backend/acervo-version.txt y suba a mano.`);
  process.exit(1);
}
await fs.writeFile(path.join(BACKEND, 'acervo-version.txt'), `${man.version}\n`);
git(['commit', '-m', `Acervo ${man.version}: ${Object.entries(man.conteos).map(([k, v]) => `${k} ${v}`).join(', ')}${firma}`, '--', 'backend/acervo-version.txt']);
git(['push', 'origin', 'main']);
console.log('main: versión anotada; Azure despliega e importa de fondo.');
