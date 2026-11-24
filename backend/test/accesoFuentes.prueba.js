import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { esperarTurno, configurarFetchOrigenParaPruebas } from '../lib/descargador.js';
import { buscarDialnet } from '../lib/indiceDialnet.js';

test('las peticiones simultáneas al mismo host reciben turnos separados', async () => {
  const host = 'juristeca.jusbaires.gob.ar'; // intervalo propio de 400 ms
  const tiempos = await Promise.all([1, 2, 3].map(async () => {
    await esperarTurno(host);
    return Date.now();
  }));
  tiempos.sort((a, b) => a - b);
  assert.ok(tiempos[1] - tiempos[0] >= 330,
    'la segunda petición no debe salir junto con la primera');
  assert.ok(tiempos[2] - tiempos[1] >= 330,
    'la tercera petición debe esperar su propio turno');
});

test('Dialnet repite un reset transitorio y recupera la respuesta oficial', async () => {
  const original = globalThis.fetch;
  let intentos = 0;
  globalThis.fetch = async () => {
    intentos++;
    if (intentos === 1) {
      const error = new Error('socket hang up');
      error.cause = { code: 'ECONNRESET' };
      throw error;
    }
    return new Response('<html><body><div id="resultadosDeBusqueda"></div></body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  };
  const restaurarTransporte = configurarFetchOrigenParaPruebas({
    request: (...args) => globalThis.fetch(...args),
    validar: async (url) => new URL(url),
    esperar: async () => {},
  });
  try {
    const salida = await buscarDialnet({ q: 'responsabilidad civil', modo: 'todas' });
    assert.equal(intentos, 2);
    assert.equal(salida.total, 0);
    assert.deepEqual(salida.resultados, []);
  } finally {
    globalThis.fetch = original;
    restaurarTransporte();
  }
});

test('las fuentes con bloqueo de red tienen una ruta jurisdiccional alternativa en el backend', () => {
  const caba = fs.readFileSync(new URL('../lib/indiceCaba.js', import.meta.url), 'utf8');
  const rio = fs.readFileSync(new URL('../lib/indiceRioNegro.js', import.meta.url), 'utf8');
  const chubut = fs.readFileSync(new URL('../lib/indiceChubut.js', import.meta.url), 'utf8');
  assert.match(caba, /buscarProvinciaSaij\('caba_saij'/);
  assert.match(caba, /fuenteAlternativa: 'caba_saij'/);
  assert.match(rio, /buscarProvinciaSaij\('rionegro_saij'/);
  assert.match(rio, /for \(const tribunalAlternativo of \['todo', 'sumarios'\]\)/);
  assert.match(chubut, /buscarProvinciaSaij\('chubut_saij'/);
  assert.match(chubut, /fuenteAlternativa: 'chubut_saij'/);
});

test('Catamarca no abandona su índice local antes de que finalice el FTS', () => {
  const catamarca = fs.readFileSync(new URL('../lib/indiceCatamarca.js', import.meta.url), 'utf8');
  const ruta = fs.readFileSync(new URL('../routes/indice.js', import.meta.url), 'utf8');
  assert.match(catamarca, /espera: 50_000, prioridad: 8/);
  assert.match(ruta, /slug === 'catamarca' \? 50_000 : 7000/);
});
