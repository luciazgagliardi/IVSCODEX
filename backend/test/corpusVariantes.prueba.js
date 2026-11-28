import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { filtrarPorModo } from '../lib/relevancia.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'docs/ivscodex-2.0/04-corpus-recuperacion-v1.json'), 'utf8'));

function evaluar(ids, caso) {
  const positivos = new Set(caso.positivos.map(e => e.documentoId));
  const negativos = new Set(caso.negativos.map(e => e.documentoId));
  const obtenidos = new Set(ids);
  return {
    recuperados: [...obtenidos].sort(),
    omitidos: [...positivos].filter(id => !obtenidos.has(id)).sort(),
    negativosRecuperados: [...obtenidos].filter(id => negativos.has(id)).sort(),
    sinEtiqueta: [...obtenidos].filter(id => !positivos.has(id) && !negativos.has(id)).sort(),
    duplicados: ids.length - obtenidos.size,
  };
}

test('diagnóstico provisional de variantes jurídicas sobre filtro e índice aislado', async t => {
  const registros = corpus.documentos.map(d => ({
    id: d.id, caratula: d.caratula, expediente: d.expediente,
    fecha: d.fecha, jurisdiccion: d.jurisdiccion, tribunal: d.tribunal,
    tipoDocumento: d.tipoDocumento, voces: [],
    sumario: fs.readFileSync(path.resolve(root, d.fuente.fixturePath), 'utf8'),
  }));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ivs-variantes-'));
  const anterior = process.env.DIR_INDICE;
  process.env.DIR_INDICE = dir;
  try {
    const { upsertRegistros, buscarEnIndice } = await import('../lib/indice.js');
    const clave = 'ivscodex2_variantes_test';
    assert.equal(await upsertRegistros(clave, registros), registros.length);
    let variantes = 0;
    for (const caso of corpus.casos) {
      assert.equal(caso.aptoParaMetricas, false);
      assert.ok(Array.isArray(caso.variantesConsulta) && caso.variantesConsulta.length > 0);
      const consultas = [caso.consulta, ...caso.variantesConsulta];
      assert.equal(new Set(consultas.map(q => q.trim().toLowerCase())).size, consultas.length);
      for (const [i, consulta] of consultas.entries()) {
        assert.ok(typeof consulta === 'string' && consulta.trim().length > 0);
        const filtro = filtrarPorModo(registros, { q: consulta, modo: 'todas', aflojar: false });
        assert.equal(filtro.aflojado, false);
        const indice = await buscarEnIndice(clave, consulta, { modo: 'todas' });
        const a = evaluar(filtro.lista.map(r => r.id), caso);
        const b = evaluar(indice.map(r => r.id), caso);
        assert.equal(a.duplicados, 0);
        assert.equal(b.duplicados, 0);
        assert.deepEqual(a.sinEtiqueta, []);
        assert.deepEqual(b.sinEtiqueta, []);
        if (i === 0) {
          // Las formulaciones ya aceptadas técnicamente siguen siendo una regresión estricta.
          assert.deepEqual(a.omitidos, []);
          assert.deepEqual(b.omitidos, []);
          assert.deepEqual(a.negativosRecuperados, []);
          assert.deepEqual(b.negativosRecuperados, []);
        } else variantes++;
        // Una variante fallida es evidencia de una brecha, no motivo para cambiar
        // sus etiquetas ni declarar el motor aprobado. Se publica el detalle en TAP.
        t.diagnostic(JSON.stringify({ caso: caso.id, consulta, variante: i > 0, filtro: a, indice: b, aptoParaMetricas: false }));
      }
    }
    assert.ok(variantes > 0);
    t.diagnostic(JSON.stringify({ consultasPrincipales: corpus.casos.length, variantes, alcance: 'fixtures completos en campo sumario; sin red, sin producción; etiquetas provisionales' }));
  } finally {
    if (anterior === undefined) delete process.env.DIR_INDICE;
    else process.env.DIR_INDICE = anterior;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
