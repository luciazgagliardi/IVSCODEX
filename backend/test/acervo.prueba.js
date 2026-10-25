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
  assert.deepEqual(estadoAcervo().conteos, { saij: 3, csjn: 1, scba: 1 });
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
  assert.equal((await estadoIndice('saij')).acervo, 3);
});
