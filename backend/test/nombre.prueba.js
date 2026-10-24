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

test('sólo la cita de Fallos: se averigua el nombre en las citas de otros fallos', () => {
  const n = leer('Fallos 306:1752');
  assert.equal(n.soloCita, true);
  assert.equal(n.fallos, '306:1752');
  assert.equal(n.anio, 1984, 'el año del tomo');
  assert.equal(leer('Fallos: 332:111').anio, 2009);
  const t = 'La sentencia dictada por la Corte en el precedente "Halabi" (Fallos: 332:111) no ha… ' +
    'La C.S.J.N. en "Halabi" (Fallos: 332:111), después… Ver CSJN, "Halabi, Ernesto c/ P.E.N. ley 25.873 s/ amparo", Fallos: 332:111. ' +
    'resuelto en «Bazterrica» (Fallos: 308:1392); y en la causa Montalvo (Fallos 313:1333).';
  assert.deepEqual(IVSNombre.nombresJuntoACita(t, '332:111'), ['Halabi', 'Halabi', 'Halabi']);
  assert.deepEqual(IVSNombre.nombresJuntoACita(t, '308:1392'), ['Bazterrica']);
  assert.deepEqual(IVSNombre.nombresJuntoACita(t, '313:1333'), ['Montalvo']);
  // las formas reales de los sumarios de SAIJ que citan a Fiorentino (Fallos 306:1752)
  assert.deepEqual(IVSNombre.nombresJuntoACita('Explicaron, con cita del precedente "Fiorentino" (CSJN 306:1752), que', '306:1752'), ['Fiorentino']);
  const serie = '"Charles Hnos." y se consolida en "Montenegro", "Fiorentino" y "Rayford" (Fallos: 46:36; 303:1938; 306:1752 y 308:733).';
  assert.deepEqual(IVSNombre.nombresJuntoACita(serie, '306:1752'), ['Fiorentino']);
  assert.deepEqual(IVSNombre.nombresJuntoACita(serie, '46:36'), ['Charles Hnos.']);
  assert.deepEqual(IVSNombre.nombresJuntoACita(serie, '308:733'), ['Rayford']);
  // una lista de citas sin nombres no se atribuye a nadie
  assert.deepEqual(IVSNombre.nombresJuntoACita('(Doctrina de Fallos: 95:133; 99:158; 104:284)', '104:284'), []);
  assert.equal(IVSNombre.consenso(['Halabi', 'Halabi Ernesto', 'Otro']).nombre, 'Halabi');
  // con el nombre, se ordena como cualquier búsqueda por nombre, confirmando con el año del tomo
  const b = IVSNombre.conNombre(leer('Fallos 308:1392'), 'Bazterrica');
  const r = IVSNombre.ordenar([
    { caratula: 'Blanco, María Estela c/ Clínica Bazterrica S.A. s/ recurso de hecho', fecha: '06/06/1989' },
    { caratula: 'Gustavo Mario BAZTERRICA s/ TENENCIA DE ESTUPEFACIENTES', fecha: '29/08/1986' },
  ], b);
  assert.match(r[0].caratula, /BAZTERRICA s\/ TENENCIA/);
  assert.equal(r[0].coincideNombre, true);
  assert.equal(r[1].coincideNombre, false);
});

test('la tabla de citas: cada entrada es un nombre visto junto a esa cita', async () => {
  const { readFileSync } = await import('node:fs');
  const tabla = JSON.parse(readFileSync(join(AQUI, '..', '..', 'frontend', 'datos', 'fallos-citas.json'), 'utf8'));
  assert.ok(Object.keys(tabla).length >= 50);
  for (const [cita, [nombre, veces]] of Object.entries(tabla)) {
    assert.match(cita, /^\d{1,3}:\d{1,5}$/);
    assert.ok(nombre && veces >= 1);
  }
  assert.equal(tabla['327:3677'][0], 'Vizzoti');
  assert.equal(tabla['308:490'][0], 'Strada');
});
