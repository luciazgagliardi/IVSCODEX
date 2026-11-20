/**
 * Plazos procesales, feriados, ferias y días inhábiles (frontend/calculos.js).
 * Casos del informe docs/auditoria-integral-2026/04-calculos-y-plazos.md
 * (C-01 a C-04), calculados a mano contra:
 *   - el calendario oficial 2026 (argentina.gob.ar/sites/default/files/holidays-2026-es.json);
 *   - el art. 60 ap. II, 61 ap. III y 63 de la Ley 9001 (CPCCyT de Mendoza);
 *   - la Acordada SCJM 32.674 (receso de julio de 2026) y la 31.699 (plazo de gracia);
 *   - la Acordada CSJN 11/2026 (feria de invierno, cargada como no verificada).
 *
 *   node --test test/plazosFeriados.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const C = require(join(AQUI, '..', '..', 'frontend', 'calculos.js'));

const f = (s) => new Date(s + 'T00:00:00Z');
const plazo = (notif, dias, juris, extras, tipo = 'habiles') => C.computarPlazo({ notif: f(notif), dias, tipo, juris, extras });

/* Feriados 2026 del calendario oficial (inamovibles y trasladables). */
const OFICIALES_2026 = ['2026-01-01', '2026-02-16', '2026-02-17', '2026-03-24', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-25', '2026-06-15', '2026-06-20', '2026-07-09', '2026-08-17', '2026-10-12',
  '2026-11-09', '2026-11-23', '2026-12-08', '2026-12-25'];

test('C-01: los feriados nacionales de 2026 coinciden con el calendario oficial, con el 9/11 (Decreto 1103/2026)', () => {
  assert.deepEqual(Object.keys(C.feriados(2026, 'nacion')).sort(), OFICIALES_2026);
  assert.match(C.feriados(2026, 'nacion')['2026-11-09'], /León XIV/);
  assert.ok(C.feriados(2026, 'caba')['2026-11-10'], 'el 10/11 es feriado en la Ciudad');
  assert.equal(C.feriados(2026, 'nacion')['2026-11-10'], undefined);
  assert.equal(C.diaInhabil(f('2026-11-09'), 'mendoza').tipo, 'feriado');
});

test('C-01: Nación, 05/11/2026 + 3 días hábiles vence el miércoles 11/11/2026 (gracia el 12/11)', () => {
  const r = plazo('2026-11-05', 3, 'nacion');
  assert.equal(C.iso(r.vence), '2026-11-11');
  assert.equal(C.iso(r.gracia), '2026-11-12');
  assert.equal(r.provisorio, false);
  assert.ok(r.saltados.some((s) => C.iso(s.fecha) === '2026-11-09'));
});

test('C-01: CABA, 06/11/2026 + 5 días hábiles vence el martes 17/11/2026; en Nación el 10/11 solo se avisa', () => {
  assert.equal(C.iso(plazo('2026-11-06', 5, 'caba').vence), '2026-11-17');
  const n = plazo('2026-11-06', 5, 'nacion');
  assert.equal(C.iso(n.vence), '2026-11-16');
  assert.ok(n.avisos.some((a) => /10\/11\/2026/.test(a) && /Ciudad de Buenos Aires/.test(a)));
});

test('C-02: Mendoza descuenta los no laborables turísticos (art. 60 ap. II Ley 9001): 20/03/2026 + 3 → 27/03/2026', () => {
  const r = plazo('2026-03-20', 3, 'mendoza');
  assert.equal(C.iso(r.vence), '2026-03-27');
  assert.ok(r.saltados.some((s) => C.iso(s.fecha) === '2026-03-23' && /turísticos/.test(s.motivo)));
  // en Nación el no laborable se cuenta como hábil, con aviso
  const n = plazo('2026-03-20', 3, 'nacion');
  assert.equal(C.iso(n.vence), '2026-03-26');
  assert.ok(n.avisos.some((a) => /23\/03\/2026/.test(a) && /no laborable/i.test(a)));
});

test('C-02: Mendoza, receso de julio (Acordada SCJM 32.674): 08/07/2026 + 5 → 31/07/2026', () => {
  const r = plazo('2026-07-08', 5, 'mendoza');
  assert.equal(C.iso(r.vence), '2026-07-31');
  assert.ok(r.saltados.some((s) => /Acordada SCJM 32\.674/.test(s.norma)));
  assert.equal(r.provisorio, false);
});

test('C-02: Mendoza, 04/12/2026 + 2 → 10/12/2026 (7/12 turístico y 8/12 feriado)', () => {
  assert.equal(C.iso(plazo('2026-12-04', 2, 'mendoza').vence), '2026-12-10');
});

test('C-02 y C-03: enero completo es inhábil: 28/12/2026 + 5 → 02/02/2027 (Mendoza y Nación), provisorio por falta de datos de 2027', () => {
  for (const j of ['mendoza', 'nacion']) {
    const r = plazo('2026-12-28', 5, j);
    assert.equal(C.iso(r.vence), '2027-02-02', j);
    assert.equal(r.provisorio, true, `${j}: 2027 todavía no tiene los días por decreto cargados`);
    assert.ok(r.faltantes.some((x) => /2027/.test(x)));
  }
  // en Nación la feria de enero sale del RJN, no verificado: se dice
  assert.ok(plazo('2026-12-28', 5, 'nacion').avisos.some((a) => /no verificado/i.test(a)));
});

test('C-03: Nación, feria de invierno 2026 (Acordada CSJN 11/2026, no verificada): 15/07/2026 + 5 → 05/08/2026, con aviso', () => {
  const r = plazo('2026-07-15', 5, 'nacion');
  assert.equal(C.iso(r.vence), '2026-08-05');
  assert.ok(r.avisos.some((a) => /Acordada CSJN 11\/2026/.test(a) && /no verificado/i.test(a)));
  assert.ok(r.saltados.some((s) => s.verificado === false));
});

test('C-03: los inhábiles cargados por el usuario valen solo para su jurisdicción', () => {
  const receso = [{ desde: '2026-07-13', hasta: '2026-07-24', motivo: 'Receso', juris: 'mendoza' }];
  // sin la feria cargada, Nación 08/07 + 5: 9 feriado, 10 no laborable (cuenta), 13, 14, 15, 16
  assert.equal(C.iso(plazo('2026-07-08', 5, 'nacion', receso).vence), '2026-07-16');
  // un asueto de Nación sí se descuenta en Nación
  const asueto = [{ desde: '2026-11-10', hasta: '2026-11-10', motivo: 'Asueto', juris: 'nacion' }];
  assert.equal(C.iso(plazo('2026-11-05', 3, 'nacion', asueto).vence), '2026-11-12');
  assert.equal(C.iso(plazo('2026-11-05', 3, 'mendoza', asueto).vence), '2026-11-11');
});

test('C-03: un año o una feria sin datos dan resultado provisorio, nunca silencioso', () => {
  // julio de 2027 en Mendoza: no hay acordada cargada
  const r = plazo('2027-07-08', 5, 'mendoza');
  assert.equal(r.provisorio, true);
  assert.ok(r.faltantes.length > 0);
  // CABA: sin feria de enero cargada
  const c = plazo('2026-12-28', 5, 'caba');
  assert.equal(c.provisorio, true);
  assert.ok(c.faltantes.some((x) => /feria de enero/.test(x)));
});

test('no laborables religiosos optativos: aviso, no descuento', () => {
  // 21/09/2026, Día del Perdón: se cuenta como hábil con aviso
  const r = plazo('2026-09-18', 1, 'nacion');
  assert.equal(C.iso(r.vence), '2026-09-21');
  assert.ok(r.avisos.some((a) => /Perdón/.test(a)));
  assert.equal(C.iso(plazo('2026-09-18', 1, 'mendoza').vence), '2026-09-21');
});

test('C-04: Mendoza no tiene plazo de gracia para escritos electrónicos; Nación sí (art. 124 CPCCN)', () => {
  const m = plazo('2026-03-20', 3, 'mendoza');
  assert.equal(m.gracia, null);
  assert.match(m.base, /arts?\. 60, 61 y 63 de la Ley 9001/i);
  assert.doesNotMatch(m.base, /CPCCN/);
  assert.ok(m.avisos.some((a) => /Acordada SCJM 31\.699/.test(a) && /caducidad/.test(a)));
  const n = plazo('2026-03-20', 3, 'nacion');
  assert.equal(C.iso(n.gracia), '2026-03-27');
  assert.match(n.base, /124 del CPCCN/);
});

test('días corridos: vencimiento en día inhábil se avisa', () => {
  const r = plazo('2026-11-04', 5, 'nacion', [], 'corridos');
  assert.equal(C.iso(r.vence), '2026-11-09');
  assert.ok(r.avisos.some((a) => /día inhábil/.test(a)));
});

test('entradas inválidas', () => {
  assert.ok(C.computarPlazo({ notif: null, dias: 3, juris: 'nacion' }).error);
  assert.ok(C.computarPlazo({ notif: f('2026-11-05'), dias: 0, juris: 'nacion' }).error);
  assert.ok(C.computarPlazo({ notif: f('2026-11-05'), dias: 2.5, juris: 'nacion' }).error);
});
