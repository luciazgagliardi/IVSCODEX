import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { adquirirCandado } from '../lib/acervoCandado.js';

test('dos procesos serializan la sustitución del SQLite compartido', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivs-lock-'));
  const archivo = path.join(dir, 'acervo-import.lock');
  try {
    const liberarUno = await adquirirCandado(archivo, { version: 'v1' });
    let segundoAdquirido = false;
    const segundo = adquirirCandado(archivo, { version: 'v1', esperaMs: 3000, intervaloMs: 20 })
      .then((liberar) => { segundoAdquirido = true; return liberar; });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(segundoAdquirido, false, 'el segundo proceso no entra mientras el primero importa');
    await liberarUno();
    const liberarDos = await segundo;
    assert.equal(segundoAdquirido, true);
    await liberarDos();
    await assert.rejects(fs.stat(archivo), { code: 'ENOENT' });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('un lock abandonado se recupera sólo después de vencer su antigüedad', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivs-lock-stale-'));
  const archivo = path.join(dir, 'acervo-import.lock');
  try {
    await fs.writeFile(archivo, JSON.stringify({ token: 'proceso-muerto' }));
    const viejo = new Date(Date.now() - 5000);
    await fs.utimes(archivo, viejo, viejo);
    const liberar = await adquirirCandado(archivo, { version: 'v2', obsoletoMs: 1000 });
    const dato = JSON.parse(await fs.readFile(archivo, 'utf8'));
    assert.equal(dato.version, 'v2');
    await liberar();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
