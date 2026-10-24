/**
 * Buscar un fallo por su nombre (frontend/nombre-fallo.js): «CSJN 1984
 * FIORENTINO S/TENENCIA ILEGITIMA DE ESTUPEFACIENTES» se separa en tribunal,
 * año, partes y objeto, y lo que devuelve la base se ordena por parecido con
 * la carátula buscada. Un tema («daño moral») no se toca.
 *
 *   node --test test/nombre.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { IVSNombre } = require(join(AQUI, '..', '..', 'frontend', 'nombre-fallo.js'));
const TEMAS = ['daño moral', 'despido', 'amparo', 'daños y perjuicios'];
const esTema = (t) => TEMAS.some((x) => IVSNombre.plano(t).includes(IVSNombre.plano(x)));
const leer = (q) => IVSNombre.interpretar(q, { esTema });

test('el ejemplo: tribunal, año, partes y objeto', () => {
  const n = leer('CSJN 1984 FIORENTINO S/TENENCIA ILEGITIMA DE ESTUPEFACIENTES');
  assert.equal(n.tribunal, 'csjn');
  assert.deepEqual(n.bases, ['csjn']);
  assert.equal(n.anio, 1984);
  assert.deepEqual(n.partes, ['fiorentino']);
  assert.deepEqual(n.objeto, ['tenencia', 'ilegitima', 'estupefacientes']);
  assert.equal(n.consulta, 'fiorentino');
});

test('otras formas de escribir un fallo', () => {
  const h = leer('CSJN, «Halabi, Ernesto c/ P.E.N. s/ amparo», Fallos: 332:111, 24/02/2009');
  assert.equal(h.tribunal, 'csjn');
  assert.equal(h.fallos, '332:111');
  assert.equal(h.fecha, '24/02/2009');
  assert.deepEqual(h.partes, ['halabi', 'ernesto']);
  assert.deepEqual(leer('CSJN 1986 Bazterrica').partes, ['bazterrica']);
  const v = leer('Vizzoti c/ AMSA');
  assert.equal(v.tribunal, null, 'sin tribunal: se busca en todas las bases');
  assert.deepEqual(v.partes, ['vizzoti']);
  assert.deepEqual(v.contra, ['amsa']);
  assert.deepEqual(leer('SCBA Pérez Juan c/ Provincia de Buenos Aires s/ daños y perjuicios').bases, ['scba']);
  assert.deepEqual(leer('SCJM Berro Paula c/ Banco BBVA p/ despido').bases, ['mendoza', 'mendozalegal']);
  assert.deepEqual(leer('TSJ López Viviana c/ GCBA').bases, ['caba']);
  assert.equal(leer('Corte IDH Fontevecchia y D Amico vs. Argentina').tribunal, 'corteidh');
});

test('un tema no es un nombre de fallo', () => {
  for (const q of ['daño moral', 'despido 2019', 'CSJN 2020 daño moral', 'responsabilidad del Estado por omisión', 'art. 1740 CCyC']) {
    assert.equal(leer(q), null, q);
  }
});

test('ordena por parecido con la carátula, el año y el lugar de la parte', () => {
  const n = leer('CSJN 1984 FIORENTINO S/TENENCIA ILEGITIMA DE ESTUPEFACIENTES');
  const lista = [
    { caratula: 'Fiorentino, Roxana María Luján c/ Socialmed S.A. y otro', fecha: '29/05/2007', tribunal: 'CORTE SUPREMA DE JUSTICIA DE LA NACION', sumario: 'El recurso…' },
    { caratula: 'Fiorentino, Diego Enrique s/ tenencia ilegítima de estupefacientes', fecha: '27/11/1984', tribunal: 'CORTE SUPREMA DE JUSTICIA DE LA NACION' },
    { caratula: 'DIEGO ENRIQUE FIORENTINO s/ TENENCIA ILEGITIMA DE ESTUPEFACIENTES', fecha: '27/11/1984', sumario: 'Procede el recurso extraordinario…' },
  ];
  const r = IVSNombre.ordenar(lista, n);
  assert.equal(r[0].caratula, 'Fiorentino, Diego Enrique s/ tenencia ilegítima de estupefacientes');
  assert.equal(r[0].coincideNombre, true);
  // las dos fichas del mismo fallo quedan en una, con el texto de la que lo tenía
  assert.equal(r.length, 2);
  assert.equal(r[0].sumario, 'Procede el recurso extraordinario…');
  assert.equal(r[0].otrasFichas.length, 1);
  assert.equal(r[1].coincideNombre, false, 'otro Fiorentino, de 2007');
  // la parte buscada como demandada es otra causa
  const b = leer('CSJN 1986 Bazterrica');
  const rb = IVSNombre.ordenar([
    { caratula: 'Plá, Silvio Roberto y otros c/ Clínica Bazterrica S.A. y otros.', fecha: '04/09/1986' },
    { caratula: 'Gustavo Mario BAZTERRICA s/ TENENCIA DE ESTUPEFACIENTES', fecha: '29/08/1986' },
  ], b);
  assert.match(rb[0].caratula, /^Gustavo Mario BAZTERRICA/);
  assert.ok(rb[0].parecido > rb[1].parecido);
});
