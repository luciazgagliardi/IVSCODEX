import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearListadoCatamarca, parsearDetalleCatamarca } from '../lib/indiceCatamarca.js';
import { FUENTES } from '../lib/fuentes.js';

test('Catamarca: sentencia oficial mantiene id, carátula, tribunal y enlace', () => {
  const html = `<html><body><table><tbody><tr>
    <td>15/26</td><td>ESCHMULLER c/ GALLEGUILLO s/ beneficios laborales</td>
    <td>CORTE DE JUSTICIA</td><td>Sentencia Interlocutoria Casación</td>
    <td><a href="/sentencia/5339">Ver</a></td></tr></tbody></table>
    <a href="/sentencias?page=2" rel="next">Next »</a></body></html>`;
  const r = parsearListadoCatamarca(html, 'sentencias');
  assert.equal(r.siguiente, true);
  assert.equal(r.resultados.length, 1);
  assert.equal(r.resultados[0].id, 'catamarca_5339');
  assert.match(r.resultados[0].caratula, /ESCHMULLER/);
  assert.equal(r.resultados[0].provincia, 'Catamarca');
  assert.equal(r.resultados[0].linkFallo, 'https://consulta.jurisprudencia.juscatamarca.gob.ar/sentencia/5339');
});

test('Catamarca: sumarios no generan documentos artificiales ni admiten otro dominio', () => {
  const html = `<table><tr><th>Tema</th><th>Texto</th><th>Sentencia</th></tr>
    <tr><td>libertad asistida</td><td>El tribunal resolvió el recurso en relación con la progresividad de la pena.</td>
    <td><a href="/sentencia/5339">Ver Sentencia Nº 22/26</a></td></tr>
    <tr><td>fraude</td><td>Referencias ajenas</td><td><a href="https://no-oficial.example/sentencia/5432">Ver</a></td></tr></table>`;
  const r = parsearListadoCatamarca(html, 'sumarios');
  assert.equal(r.siguiente, false);
  assert.deepEqual(r.resultados.map(x=>x.id), ['catamarca_5339']);
  assert.match(r.resultados[0].sumario, /progresividad/);
  assert.deepEqual(r.resultados[0].voces, ['libertad asistida']);
});

test('Catamarca: solo texto de sentencia público y fechas verificables', () => {
  const html = `<html><body><h2>Sentencia Nº 22/26</h2><h5>Mendoza, Miguel s/ recurso de casación</h5>
    <p>Tribunal: CORTE DE JUSTICIA</p><p>Materia: Sentencia Casación Definitiva Penal</p>
    <p>Fecha: 2026-05-05</p><h4>Texto de la Sentencia</h4>
    <div>El tribunal considera los antecedentes del expediente y los agravios presentados
    por la defensa. Por tales fundamentos, resuelve hacer lugar parcialmente al recurso
    y ordenar las medidas correspondientes para la ejecución de la sentencia.</div>
    <h4>Sumarios</h4><p>No hay sumarios relacionados</p></body></html>`;
  const x = parsearDetalleCatamarca(html, 'catamarca_5339');
  assert.equal(x.id, 'catamarca_5339');
  assert.equal(x.fecha, '2026-05-05');
  assert.match(x.sumario, /hacer lugar parcialmente/);
  assert.doesNotMatch(x.sumario, /No hay sumarios/);
});

test('Catamarca aparece como una fuente nueva de búsqueda (no doctrina ni SAIJ)', () => {
  const fuente = FUENTES.find(f => f.slug === 'catamarca');
  assert.ok(fuente);
  assert.match(fuente.nombre, /Catamarca/);
  assert.equal(typeof fuente.buscar, 'function');
});
