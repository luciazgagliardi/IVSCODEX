import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';

function prepararDirectorio() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ivs-manifiesto-'));
}

function escribirTanda(dir, registros) {
  const nombre = 'saij-001.jsonl.gz';
  const cuerpo = registros.map((r) => typeof r === 'string' ? r : JSON.stringify(r)).join('\n') + '\n';
  const comprimido = zlib.gzipSync(cuerpo);
  fs.writeFileSync(path.join(dir, nombre), comprimido);
  return {
    nombre,
    sha256: crypto.createHash('sha256').update(comprimido).digest('hex'),
  };
}

function importar(dir, man) {
  const nueva = path.join(dir, 'resultado.db');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../lib/acervoImportar.js', import.meta.url), {
      workerData: { man, dirTandas: dir, nueva },
    });
    let respuesta = null;
    let asentado = false;
    worker.once('message', (r) => { respuesta = r; });
    worker.once('error', (e) => {
      if (!asentado) { asentado = true; reject(e); }
    });
    worker.once('exit', (codigo) => {
      if (asentado) return;
      asentado = true;
      if (codigo === 0 && respuesta) resolve({ nueva, respuesta });
      else reject(new Error('El importador terminó con código ' + codigo));
    });
  });
}

const corte = {
  id: 'saij_corte_prueba',
  fuente: 'saij',
  corte: true,
  caratula: 'Caso de prueba',
  tribunal: 'CORTE SUPREMA DE JUSTICIA DE LA NACION',
  fecha: '01/01/2026',
  sumario: 'Control de integridad del acervo jurídico',
};

test('el importador verifica SHA-256 y conteos exactos antes de publicar el SQLite', async () => {
  const dir = prepararDirectorio();
  try {
    const tanda = escribirTanda(dir, [corte]);
    const man = {
      version: 'integridad-ok',
      archivos: [tanda.nombre],
      conteos: { saij: 1, csjn: 1 },
      integridad: { algoritmo: 'sha256', archivos: { [tanda.nombre]: tanda.sha256 } },
    };
    const { nueva, respuesta } = await importar(dir, man);
    assert.deepEqual(respuesta.conteos, { saij: 1, csjn: 1 });
    const db = new DatabaseSync(nueva, { readOnly: true });
    try {
      assert.equal(db.prepare('SELECT count(*) AS n FROM fallos').get().n, 1);
      assert.equal(db.prepare("SELECT count(*) AS n FROM fts WHERE fts MATCH 'integridad'").get().n, 1);
      assert.equal(db.prepare("SELECT valor FROM meta WHERE clave='version'").get().valor, 'integridad-ok');
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('el importador rechaza una tanda cuyo SHA-256 no coincide', async () => {
  const dir = prepararDirectorio();
  try {
    const tanda = escribirTanda(dir, [corte]);
    const man = {
      version: 'integridad-sha-invalido',
      archivos: [tanda.nombre],
      integridad: { algoritmo: 'sha256', archivos: { [tanda.nombre]: '0'.repeat(64) } },
    };
    await assert.rejects(importar(dir, man), /SHA-256 incorrecto/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('el importador rechaza conteos distintos de los declarados en el manifiesto', async () => {
  const dir = prepararDirectorio();
  try {
    const tanda = escribirTanda(dir, [corte]);
    await assert.rejects(importar(dir, {
      version: 'integridad-conteo-invalido',
      archivos: [tanda.nombre],
      conteos: { saij: 2, csjn: 1 },
    }), /Conteo de saij no coincide: manifiesto=2, importado=1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('el importador no omite silenciosamente una línea JSONL inválida', async () => {
  const dir = prepararDirectorio();
  try {
    const tanda = escribirTanda(dir, [corte, '{esto no es JSON']);
    await assert.rejects(importar(dir, {
      version: 'integridad-json-invalido',
      archivos: [tanda.nombre],
    }), /JSON inválido en saij-001\.jsonl\.gz, línea 2/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('el importador rechaza IDs duplicados en tandas diferentes o en la misma tanda', async () => {
  const dir = prepararDirectorio();
  try {
    const tanda = escribirTanda(dir, [corte, corte]);
    await assert.rejects(importar(dir, {
      version: 'integridad-duplicados',
      archivos: [tanda.nombre],
    }), /Documento duplicado.*saij_corte_prueba/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
