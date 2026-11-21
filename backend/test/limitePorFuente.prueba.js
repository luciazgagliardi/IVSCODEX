/**
 * Una búsqueda en todas las bases hace ~70 pedidos. El límite tiene que
 * proteger a cada fuente oficial sin dejar a la abogada sin resultados en su
 * segunda búsqueda: se cuenta por IP y por fuente, no en un cupo único.
 * Se levanta el servidor real con un límite por fuente de 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${PUERTO}/api`;
let proc;

test.before(async () => {
  proc = spawn(process.execPath, ['index.js'], {
    cwd: raiz,
    env: { ...process.env, PORT: String(PUERTO), LIMITE_BUSQUEDAS_POR_FUENTE: '1', LIMITE_PETICIONES: '3' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/salud`)).ok) return; } catch { /* todavía arrancando */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('el servidor no arrancó');
});
test.after(() => proc?.kill());

const buscar = (fuente) => fetch(`${base}/indice/${fuente}/buscar`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: '' }),
});

test('agotar el cupo de una fuente no bloquea a las demás', async () => {
  assert.notEqual((await buscar('fuenteuno')).status, 429);
  const r = await buscar('fuenteuno');
  assert.equal(r.status, 429);
  assert.equal((await r.json()).codigo, 'DEMASIADAS_PETICIONES');
  assert.notEqual((await buscar('fuentedos')).status, 429, 'otra fuente sigue disponible');
});

test('las consultas por fuente no consumen el cupo general', async () => {
  for (const f of ['a', 'b', 'c', 'd', 'e']) await buscar(f);
  // LIMITE_PETICIONES=3: si las búsquedas por fuente contaran acá, esto sería 429.
  assert.notEqual((await fetch(`${base}/vocabulario/procedencia`)).status, 429);
});

test('el buscador del TSJ CABA apunta al dominio vigente por HTTPS', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(path.join(raiz, 'lib', 'indiceCaba.js'), 'utf8');
  // jurisprudencia.tsjbaires.gob.ar dejó de resolver en DNS (20/11/2026).
  assert.match(src, /const HOST = 'jurisprudencia\.tsjbaires\.gob\.ar'/);
  assert.match(src, /https:\/\/\$\{HOST\}\/jurisprudencia\/resultadoBusqueda\.asp/);
});
