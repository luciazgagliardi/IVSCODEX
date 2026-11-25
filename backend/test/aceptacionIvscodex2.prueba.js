import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarPorArticulo } from '../routes/indice.js';

test('una forma fallida y otra sin coincidencias no producen un cero confirmado', async () => {
  const pedidos = [];
  const salida = await buscarPorArticulo({
    slug: 'mendoza',
    art: '1741',
    buscar: async ({ q }) => {
      pedidos.push(q);
      if (q === 'art 1741') throw new Error('respuesta 403');
      return { total: 0, resultados: [], siguienteDesde: null };
    },
  });

  assert.deepEqual(pedidos, ['art 1741', '1741']);
  assert.equal(salida.total, 0);
  assert.equal(salida.totalParcial, true);
  assert.equal(salida.revisados, 0);
  assert.match(salida.porArticulo.formas[0].error, /403/);
  assert.equal(salida.porArticulo.formas[1].encontrados, 0);
});

test('la unión por artículo deduplica fichas y conserva la marca de cita numérica', async () => {
  const pedidos = [];
  const salida = await buscarPorArticulo({
    slug: 'mendoza',
    art: '1741',
    buscar: async ({ q }) => {
      pedidos.push(q);
      if (q === 'art 1741') {
        return { resultados: [{ id: 'fallo-1', caratula: 'Pérez', citaElNumero: false }] };
      }
      return {
        resultados: [
          { id: 'fallo-1', caratula: 'Pérez' },
          { id: 'fallo-2', caratula: 'Gómez' },
        ],
      };
    },
  });

  assert.deepEqual(pedidos, ['art 1741', '1741']);
  assert.equal(salida.total, 2);
  assert.equal(salida.revisados, 3);
  assert.equal(salida.totalParcial, true);
  assert.deepEqual(salida.resultados.map((x) => x.id), ['fallo-1', 'fallo-2']);
  assert.ok(salida.resultados.every((x) => x.citaElNumero === true));
});

test('si fallan todas las formas de una búsqueda por artículo, devuelve un error y no cero', async () => {
  await assert.rejects(
    buscarPorArticulo({
      slug: 'mendoza',
      art: '1741',
      buscar: async () => { throw new Error('ECONNRESET'); },
    }),
    (error) => error instanceof Error && Boolean(error.codigo),
  );
});
