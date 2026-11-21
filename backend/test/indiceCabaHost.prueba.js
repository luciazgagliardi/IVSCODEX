import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cliente = fs.readFileSync(new URL('../lib/indiceCaba.js', import.meta.url), 'utf8');
const metadatos = fs.readFileSync(new URL('../lib/fuentesInfo.js', import.meta.url), 'utf8');

import { dominioConNavegador } from '../lib/navegadorCf.js';

test('el relevo de navegador cubre el buscador oficial del TSJ y conserva el POST', () => {
  assert.equal(dominioConNavegador('jurisprudencia.tsjbaires.gov.ar'), true);
  const navegador = fs.readFileSync(new URL('../lib/navegadorCf.js', import.meta.url), 'utf8');
  assert.match(navegador, /export function consultarConNavegador/);
  assert.match(navegador, /method, headers, body/);
  assert.match(cliente, /consultarConNavegador\(URL_BUSQUEDA/);
  assert.match(cliente, /method: 'POST'/);
  assert.match(cliente, /decodificarWin1252\(salida.buffer\)/);
});

test('CABA usa el endpoint HTTPS vigente del buscador del TSJ', () => {
  assert.ok(cliente.includes("const HOST = 'jurisprudencia.tsjbaires.gov.ar';"));
  assert.ok(cliente.includes('`https://${HOST}/jurisprudencia/resultadoBusqueda.asp`'));
  assert.ok(!cliente.includes("const HOST = 'jurisprudencia.tsjbaires.gob.ar';"));
  assert.ok(metadatos.includes('https://jurisprudencia.tsjbaires.gov.ar/jurisprudencia/resultadoBusqueda.asp'));
});
