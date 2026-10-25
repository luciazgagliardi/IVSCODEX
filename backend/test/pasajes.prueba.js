/**
 * Dónde coincide lo buscado y qué pasaje se muestra (frontend/pasajes.js):
 * lo mismo para la lista, el Lector y los pasajes del servidor.
 *
 *   node --test test/pasajes.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { IVSPasajes as P } from '../lib/pasajes.js';

const marcadas = (t, q, o) => P.coincidencias(t, q, o).map((c) => t.slice(c.a, c.b));
const esc = (s) => s;

test('sin acentos y por la raíz: lo que el buscador encontró se ve marcado', () => {
  assert.deepEqual(marcadas('Los despidos fueron discriminatorios.', 'despido discriminatorio'), ['despidos', 'discriminatorios']);
  assert.deepEqual(marcadas('Se reclama la INDEMNIZACIÓN por daños morales.', 'indemnizacion daño moral'), ['INDEMNIZACIÓN', 'daños', 'morales']);
  assert.deepEqual(marcadas('corresponde indemnizar el daño', 'indemnización'), ['indemnizar']);
  // una palabra corta no marca otras que empiezan igual
  assert.deepEqual(marcadas('La desidia del archivo', 'des'), []);
  assert.deepEqual(marcadas('el daño y los daños', 'daño'), ['daño', 'daños']);
  // sin conectores
  assert.deepEqual(marcadas('la casa de la sierra', 'casa de la sierra'), ['casa', 'sierra']);
});

test('frase exacta: la frase entera, con cualquier espacio en el medio, y sólo esa', () => {
  assert.deepEqual(marcadas('el despido\n   discriminatorio fue probado', 'despido discriminatorio', { modo: 'exacta' }), ['despido\n   discriminatorio']);
  assert.deepEqual(marcadas('el despido no fue discriminatorio', 'despido discriminatorio', { modo: 'exacta' }), []);
});

test('el pasaje es el tramo con más palabras de la búsqueda, no el principio ni el texto entero', () => {
  const t = `AUTOS: Pérez c/ López. VISTOS: ${'relato '.repeat(300)}Quedó probado el despido discriminatorio y la indemnización. ${'cierre '.repeat(300)}`;
  const p = P.pasaje(t, 'despido discriminatorio indemnización', { largo: 200 });
  assert.equal(p.hay, true);
  assert.ok(p.texto.length < 260, `recortado: ${p.texto.length}`);
  assert.match(p.texto, /despido discriminatorio y la indemnización/);
  assert.equal(p.marcas.length, 3);
  const h = P.html(t, 'despido discriminatorio', { largo: 200 }, esc);
  assert.match(h, /<mark>despido<\/mark> <mark>discriminatorio<\/mark>/);
  // en el cuerpo antes que en la carátula
  const conCaratula = `PÉREZ C/ BANCO S/ DESPIDO. VISTOS: ${'x '.repeat(200)}el despido fue injustificado`;
  assert.match(P.pasaje(conCaratula, 'despido', { desde: 30, largo: 80 }).texto, /despido fue injustificado/);
  // si se exige, sin coincidencia no hay pasaje
  assert.equal(P.pasaje('nada que ver', 'alonso', { exigir: true }).texto, '');
});
