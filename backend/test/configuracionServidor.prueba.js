import test from 'node:test';
import assert from 'node:assert/strict';
import { CORS_ORIGENES, TIMEOUT_MS, LIMITE_BUSQUEDAS_POR_FUENTE } from '../config.js';

test('el frontend público de GitHub Pages puede consultar todas las rutas de la API', () => {
  assert.ok(CORS_ORIGENES.includes('https://luciazgagliardi.github.io'));
});

test('CORS conserva los orígenes locales y suma el origen de producción aunque Azure configure una lista propia', () => {
  assert.ok(CORS_ORIGENES.includes('https://luciazgagliardi.github.io'));
  assert.ok(CORS_ORIGENES.includes('http://localhost:3000'));
  assert.ok(CORS_ORIGENES.includes('http://127.0.0.1:3000'));
});

test('los límites de red y de consulta por fuente tienen valores válidos', () => {
  assert.ok(Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS >= 10000);
  assert.ok(Number.isFinite(LIMITE_BUSQUEDAS_POR_FUENTE) && LIMITE_BUSQUEDAS_POR_FUENTE >= 20);
});
