/**
 * Juristeca (lib/indiceJuristeca.js): de cada fallo del listado salen la
 * carátula, el tribunal (instancia, fuero y sala), la causa, la fecha, los
 * temas y el PDF para el Lector.
 *
 *   node --test test/juristeca.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parsear, totalDe } from '../lib/indiceJuristeca.js';

const HTML = `<div class="fallo-individual" id="fallo-58442">
  <div class="seleccionador-fallo"><input type="checkbox" value="58442"><p><strong>ID Fallo: </strong>58442</p></div>
  <p><strong>Fuero: </strong>Contencioso Administrativo y Tributario y de Relaciones de Consumo</p>
  <p>Cámara de Apelaciones</p>
  <p class="caratula">•
      A. L. L.     c/ GCBA    .
      <strong>Causa Nº </strong>50725-2023-0. <strong>Fecha:</strong>
          28-02-2025.
      <strong>Sala: </strong>II    </p>
  <p class="descriptores"><a href="?accion=temas-fallos&DescriptoresAND[]=5729">EMPLEO PUBLICO</a> - <a href="?x">DISCRIMINACION LABORAL</a></p>
  <p class="ver"><a href="https://juristeca.jusbaires.gob.ar/fallos/58442.pdf" class="link-fallo">Ver Fallo</a></p>
</div>`;

test('un fallo de Juristeca', () => {
  assert.equal(totalDe('<h3>Fallos: 648 (Ver Registros)</h3>'), 648);
  const [r] = parsear(HTML);
  assert.equal(r.id, 'juristeca_58442');
  assert.equal(r.caratula, 'A. L. L. c/ GCBA');
  assert.equal(r.expediente, '50725-2023-0');
  assert.equal(r.fecha, '28/02/2025');
  assert.equal(r.tribunal, 'Cámara de Apelaciones · Contencioso Administrativo y Tributario y de Relaciones de Consumo · Sala II');
  assert.deepEqual(r.voces, ['EMPLEO PUBLICO', 'DISCRIMINACION LABORAL']);
  assert.equal(r.linkFallo, 'https://juristeca.jusbaires.gob.ar/fallos/58442.pdf');
});
