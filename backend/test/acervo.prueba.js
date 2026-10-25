/**
 * El acervo (lib/acervo.js): las tandas se importan a SQLite con índice de
 * texto y la búsqueda de respaldo (lib/indice.js) lo usa en lugar del
 * respaldo en memoria, con los mismos modos, años y la base de la Corte.
 *
 *   node --test test/acervo.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acervo-'));
process.env.DIR_ACERVO = path.join(tmp, 'base');
process.env.DIR_ACERVO_DATOS = path.join(tmp, 'tandas');
process.env.DIR_INDICE = path.join(tmp, 'indice');
fs.mkdirSync(process.env.DIR_ACERVO_DATOS, { recursive: true });

const registros = [
  { id: 'saij_1', fuente: 'saij', corte: true, caratula: 'Fiorentino, Diego Enrique s/ tenencia ilegítima de estupefacientes', tribunal: 'CORTE SUPREMA DE JUSTICIA DE LA NACION', fecha: '27/11/1984', sumario: 'Establecida la invalidez del registro domiciliario, igual suerte debe correr el secuestro de marihuana practicado en esas circunstancias.', tipo: 'fallo' },
  { id: 'saij_2', fuente: 'saij', caratula: 'Pérez c/ López s/ daños y perjuicios', tribunal: 'Cámara Civil', fecha: '10/03/2015', sumario: 'Corresponde indemnizar el daño moral sufrido por la víctima del accidente.', voces: ['daño moral', 'accidente de tránsito'] },
  { id: 'saij_3', fuente: 'saij', caratula: 'Gómez c/ Banco s/ despido', fecha: '02/05/2021', sumario: 'La indemnización por despido debe calcularse con la mejor remuneración mensual.' },
  { id: 'saij_4', fuente: 'saij', provincia: 'Mendoza', caratula: 'Bodega Andina c/ Pérez s/ cobro', fecha: '01/03/2020', sumario: 'El contrato de elaboración de vino en la vendimia obliga al bodeguero.', linkFicha: 'https://www.saij.gob.ar/123456789-0abc-defg0000-000asoiramus' },
  { id: 'scba_1', fuente: 'scba', caratula: 'Ripodas contra Turcuman. Despido', sumario: 'Si la relación laboral se hallaba deficientemente registrada procede la indemnización.' },
];
fs.writeFileSync(path.join(process.env.DIR_ACERVO_DATOS, 'todo-001.jsonl.gz'), zlib.gzipSync(registros.map((r) => JSON.stringify(r)).join('\n')));
fs.writeFileSync(path.join(process.env.DIR_ACERVO_DATOS, 'manifiesto.json'), JSON.stringify({ version: 'prueba-1', archivos: ['todo-001.jsonl.gz'] }));

const { prepararAcervo, buscarEnAcervo, estadoAcervo, consultaFts } = await import('../lib/acervo.js');
const { buscarEnIndice, estadoIndice } = await import('../lib/indice.js');
const e = await prepararAcervo({ esperar: true });

test('las tandas se importan con sus conteos, la Corte aparte', () => {
  assert.equal(e.activo, true, e.error || '');
  assert.equal(e.version, 'prueba-1');
  assert.deepEqual(estadoAcervo().conteos, { saij: 4, csjn: 1, scba: 1 });
});

test('la consulta: raíces sin acentos, modos y exclusión', () => {
  assert.equal(consultaFts('daño moral'), '"dano"* AND "moral"*');
  assert.equal(consultaFts('indemnización despido', 'alguna'), '"indemnizaci"* OR "despido"*');
  assert.equal(consultaFts('registro domiciliario', 'exacta'), '"registro domiciliario"');
  assert.equal(consultaFts('daño', 'todas', 'moral'), '("dano"*) NOT ("moral"*)');
  assert.equal(consultaFts('de la'), null);
});

test('busca por base, por la Corte, por años y en frase exacta', () => {
  assert.deepEqual(buscarEnAcervo('saij', 'daño moral').map((r) => r.id), ['saij_2']);
  assert.deepEqual(buscarEnAcervo('csjn', 'fiorentino').map((r) => r.id), ['saij_1']);
  assert.deepEqual(buscarEnAcervo('csjn', 'despido'), []);
  assert.deepEqual(buscarEnAcervo('saij', 'indemnizacion', { anioDesde: 2020 }).map((r) => r.id), ['saij_3']);
  assert.deepEqual(buscarEnAcervo('saij', 'registro domiciliario', { modo: 'exacta' }).map((r) => r.id), ['saij_1']);
  assert.deepEqual(buscarEnAcervo('scba', 'despido').map((r) => r.id), ['scba_1']);
  assert.equal(buscarEnAcervo('mendoza', 'despido'), null, 'una base que no está en el acervo');
  // la forma de los registros de la búsqueda en vivo
  const r = buscarEnAcervo('csjn', 'estupefacientes')[0];
  assert.equal(r.caratula, 'Fiorentino, Diego Enrique s/ tenencia ilegítima de estupefacientes');
  assert.equal(r.fecha, '27/11/1984');
  assert.ok(r.sumario.startsWith('Establecida la invalidez'));
});

test('la búsqueda de respaldo usa el acervo, con años', async () => {
  const r = await buscarEnIndice('saij', 'despido', { modo: 'todas' });
  assert.deepEqual(r.map((x) => x.id), ['saij_3']);
  assert.equal((await buscarEnIndice('saij', 'daño moral', { anioHasta: 2010 })).length, 0);
  assert.equal((await estadoIndice('saij')).acervo, 4);
});

test('lo cosechado por el servidor se suma al acervo, se busca y se actualiza cuando llega su texto', async () => {
  const { agregarAlAcervo, idsConTexto } = await import('../lib/acervo.js');
  const r = { id: 'caba_1', fuente: 'caba', caratula: 'Romero, Guadalupe c/ GCBA s/ amparo', fecha: '29/4/2026', linkFallo: 'https://www.tsjbaires.gov.ar/x.pdf', voces: ['amparo'] };
  assert.equal(await agregarAlAcervo([r]), 1);
  assert.deepEqual(buscarEnAcervo('caba', 'romero').map((x) => x.id), ['caba_1']);
  assert.equal(idsConTexto('caba').size, 0);
  // llega el texto del PDF: se busca por lo que dice el fallo
  await agregarAlAcervo([{ ...r, sumario: 'El derecho a la vivienda digna exige una respuesta del Estado local.' }]);
  assert.deepEqual(buscarEnAcervo('caba', 'vivienda digna').map((x) => x.id), ['caba_1']);
  assert.equal(buscarEnAcervo('caba', 'romero').length, 1, 'no queda repetido');
  assert.ok(idsConTexto('caba').has('caba_1'));
  assert.equal(estadoAcervo().conteos.caba, 1);
  // queda en disco para la versión siguiente del acervo
  const enDisco = fs.readFileSync(path.join(process.env.DIR_ACERVO, 'cosechas', 'caba.jsonl'), 'utf8').trim().split('\n');
  assert.equal(enDisco.length, 2);
});

test('una base provincial suma, de respaldo, los fallos de SAIJ de su provincia', async () => {
  const r = await buscarEnIndice('mendoza', 'vendimia', { modo: 'todas' });
  assert.ok(r.some((x) => x.id === 'saij_4'), 'el fallo de SAIJ de Mendoza');
  assert.equal((await buscarEnIndice('scba', 'vendimia', { modo: 'todas' })).length, 0, 'no es de Buenos Aires');
});
