import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cliente = fs.readFileSync(new URL('../lib/indiceCaba.js', import.meta.url), 'utf8');
const metadatos = fs.readFileSync(new URL('../lib/fuentesInfo.js', import.meta.url), 'utf8');

test('CABA usa el endpoint HTTPS vigente del buscador del TSJ', () => {
  assert.match(cliente, /const HOST = 'jurisprudencia\\.tsjbaires\\.gov\\.ar';/);
  assert.match(cliente, /const URL_BUSQUEDA = `https:\/\/\$\{HOST\}\/jurisprudencia\/resultadoBusqueda\\.asp`;/);
  assert.doesNotMatch(cliente, /jurisprudencia\\.tsjbaires\\.gob\\.ar/);
  assert.ok(metadatos.includes('https://jurisprudencia.tsjbaires.gov.ar/jurisprudencia/resultadoBusqueda.asp'));
});
