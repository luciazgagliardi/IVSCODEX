/**
 * Red de relaciones: lo que se extrae solo tiene que estar en el texto, con
 * su evidencia, y nunca se infiere «sigue», «distingue» ni «abandona».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aristasDeDocumento, RELACIONES } from '../lib/redJuridica.js';

const TEXTO = `CAMARA DE APELACIONES EN LO CIVIL. Mendoza. VISTOS Y CONSIDERANDO: `
  + `El recurrente se agravia por la tasa de interés. La deuda de reparación de daños genera intereses `
  + `desde que se produce el perjuicio (art. 1748 del Cód. Civ. y Com.). En cuanto a la condena penal, `
  + `el art. 1776 CCyC dispone que la sentencia penal condenatoria produce efectos de cosa juzgada en el proceso civil. `
  + `La Corte Suprema lo ha dicho en Fallos 300:936. No corresponde aplicar el art. 52 bis de la Ley 24.240 `
  + `porque no media relación de consumo. Por todo ello, el Tribunal RESUELVE: 1. Rechazar el recurso de apelación `
  + `incoado en contra de la sentencia de primera instancia, que se confirma en todas sus partes. 2. Costas al apelante.`;

test('extrae normas mencionadas con evidencia, sin afirmar que se aplican', () => {
  const { aristas } = aristasDeDocumento({ id: 'doc1', texto: TEXTO });
  const normas = aristas.filter((a) => a.relacion === 'menciona_norma');
  const art1748 = normas.find((a) => a.destino.articulo === 'art. 1748');
  assert.equal(art1748.destino.norma, 'CCyC (vigente)');
  assert.equal(art1748.certeza, 'confirmado');
  assert.match(art1748.evidencia.texto, /1748/);
  // Un artículo citado para descartarlo sigue siendo solo una mención.
  assert.ok(normas.some((a) => /52 bis/.test(a.destino.articulo)));
  assert.ok(!aristas.some((a) => a.relacion === 'aplica' || a.relacion === 'interpreta'));
});

test('cita literal de precedente y decisión sobre la resolución recurrida', () => {
  const { aristas } = aristasDeDocumento({ id: 'doc1', texto: TEXTO });
  assert.ok(aristas.some((a) => a.relacion === 'cita_precedente' && a.destino.cita === 'Fallos 300:936'));
  const conf = aristas.find((a) => a.relacion === 'confirma');
  assert.ok(conf, JSON.stringify(aristas.map((a) => a.relacion)));
  assert.match(conf.evidencia.texto, /confirma/);
});

test('las relaciones que exigen juicio jurídico nunca se generan automáticamente', () => {
  const { aristas } = aristasDeDocumento({ id: 'doc1', texto: TEXTO.replace('La Corte Suprema lo ha dicho', 'Siguiendo la doctrina y apartándose del criterio anterior, la Corte Suprema lo ha dicho') });
  for (const a of aristas) assert.ok(RELACIONES.automaticas.includes(a.relacion), a.relacion);
});

test('un texto breve no produce relaciones inventadas', () => {
  const r = aristasDeDocumento({ id: 'x', texto: 'art. 1 CCyC' });
  assert.equal(r.aristas.length, 0);
});
