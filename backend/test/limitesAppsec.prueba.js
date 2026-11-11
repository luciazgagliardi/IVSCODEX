import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivs-cuotas-'));
process.env.DIR_USUARIOS = temp;
const { reservarConsultaIA } = await import('../lib/consumoIA.js');
const { enCola } = await import('../lib/almacen.js');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('las propuestas pagadas requieren una sesión y tienen presupuesto por cuenta', async () => {
  await assert.rejects(reservarConsultaIA('no-autenticado'), e => e?.http === 401);
  const usuario = crypto.randomUUID();
  for(let i = 1; i <= 8; i++){
    const q = await reservarConsultaIA(usuario);
    assert.equal(q.utilizados, i);
  }
  await assert.rejects(reservarConsultaIA(usuario), e => e?.codigo === 'CUOTA_IA_AGOTADA' && e?.http === 429);
  const otro = await reservarConsultaIA(crypto.randomUUID());
  assert.equal(otro.utilizados, 1);
  const guardado = JSON.parse(await fs.readFile(path.join(temp, 'consumo-ia.json'), 'utf8'));
  assert.equal(guardado.total, 9);
});

test('dos trabajos OCR con la misma clave no se ejecutan al mismo tiempo', async () => {
  let trabajando = 0, maximo = 0;
  const tarea = () => enCola('ocr-pdf-compartido', async () => {
    trabajando++;
    maximo = Math.max(maximo, trabajando);
    await new Promise(ok => setTimeout(ok, 15));
    trabajando--;
  });
  await Promise.all([tarea(), tarea(), tarea()]);
  assert.equal(maximo, 1);
  const contenido = await fs.readFile(path.join(raiz, 'lib', 'ocr.js'), 'utf8');
  assert.match(contenido, /enCola\('ocr-pdf-compartido'/);
  assert.match(contenido, /clearTimeout\(reloj\)/);
});

test('el servicio de propuestas de IA aplica sesión y presupuesto', async () => {
  const ruta = await fs.readFile(path.join(raiz, 'routes', 'indice.js'), 'utf8');
  assert.match(ruta, /router\.post\('\/tesauro\/proponer', requiereSesion/);
  assert.match(ruta, /await reservarConsultaIA\(req\.usuarioId\)/);
  const servidor = await fs.readFile(path.join(raiz, 'index.js'), 'utf8');
  assert.match(servidor, /const limiteFTSLocal = rateLimit/);
  assert.match(servidor, /app\.use\(\/\^\\\/api/);
});

test.after(async () => { await fs.rm(temp, { recursive: true, force: true }); });
