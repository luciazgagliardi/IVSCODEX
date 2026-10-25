/**
 * Río Negro (lib/indiceRioNegro.js): de cada fila del «Protocolo web» salen la
 * carátula, el tribunal con la sentencia, la fecha, los pasajes que el sitio
 * marca y el PDF del fallo para el Lector.
 *
 *   node --test test/rionegro.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parsear, totalDe } from '../lib/indiceRioNegro.js';

const FILA = `<div class="summary">Mostrando <b>1-10</b> de <b>1,205</b> elementos.</div>
<tr data-key="2ce5d044-1358"><td class="content-gridview"><div class="well well-sm contenido-column"><p class="titulo-grilla-registro">LACIAR, CLAUDIA B. y OTRAS C /SOFIASUR S.R.L. S /ACCION DE AMPARO</p><div class="contenido-column-detalle"><div class="texto-sentencia"><p>...la nulidad del <resaltar>despido</resaltar> por <resaltar>discriminatorio</resaltar> fundada...</p><p>...un <resaltar>despido</resaltar><resaltar>discriminatorio</resaltar>, con efectos...</p></div><div class="row item-grilla"><div><p>SENTENCIA: 56 - 09/05/2017 - DEFINITIVA</p></div></div><p><a href="/protocoloweb/protocolo/descargar-archivo-pdf?id_protocolo=2ce5d044-1358">Descargar</a></p><p class="organismo-grilla">SECRETARÍA CAUSAS ORIGINARIAS Y CONSTITUCIONAL STJ Nº4</p></div></td></tr>`;

test('una fila del Protocolo web', () => {
  assert.equal(totalDe(FILA), 1205);
  const [r] = parsear(FILA, '1');
  assert.equal(r.id, 'rionegro_2ce5d044-1358');
  assert.equal(r.caratula, 'LACIAR, CLAUDIA B. y OTRAS C /SOFIASUR S.R.L. S /ACCION DE AMPARO');
  assert.equal(r.fecha, '09/05/2017');
  assert.equal(r.tribunal, 'SECRETARÍA CAUSAS ORIGINARIAS Y CONSTITUCIONAL STJ Nº4 · Sentencia 56 (definitiva)');
  assert.match(r.sumario, /nulidad del despido por discriminatorio fundada/);
  // dos marcas pegadas del sitio quedan como dos palabras
  assert.match(r.sumario, /un despido discriminatorio, con efectos/);
  assert.equal(r.linkFallo, 'https://fallos.jusrionegro.gov.ar/protocoloweb/protocolo/descargar-archivo-pdf?id_protocolo=2ce5d044-1358');
});
