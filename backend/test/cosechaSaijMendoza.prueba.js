import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/cosecharSaij.mjs', import.meta.url));
function plan(provincia) {
  const r = spawnSync(process.execPath, [script], {
    encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, RECIENTES: '2', TIPOS: 'sumarios,fallos', SOLO_PLAN: '1', PROVINCIA: provincia },
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return JSON.parse(r.stdout);
}
test('La actualización provincial reciente incluye la faceta Mendoza en sumarios y fallos', () => {
  const p = plan('Mendoza');
  assert.equal(p.tramos.length, 4);
  assert.ok(p.tramos.every((x) => x[2] === 'Jurisdicción/Local/Mendoza'));
  assert.deepEqual([...new Set(p.tramos.map((x) => x[0]))].sort(), ['fallos', 'sumarios']);
});
test('La actualización nacional no se limita accidentalmente a Mendoza', () => {
  const p = plan('');
  assert.equal(p.tramos.length, 4);
  assert.ok(p.tramos.every((x) => x.length === 2));
});
