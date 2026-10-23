/**
 * Pruebas de las calculadoras (frontend/calculos.js), con los casos del
 * documento «IVS CODEX · Instrucciones para auditar, corregir y probar»
 * (secciones 11, 12 y 13.3). Sin red: las series se cargan con los valores
 * oficiales registrados el 23/10/2026 desde la API del Banco Central.
 *
 *   node --test test/calculos.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const C = require(join(AQUI, '..', '..', 'frontend', 'calculos.js'));
const html = readFileSync(join(AQUI, '..', '..', 'frontend', 'index.html'), 'utf8');

const f = (s) => new Date(s + 'T00:00:00Z');
const cerca = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

/* CER (BCRA, variable 30), tal como los devolvió api.bcra.gob.ar/estadisticas/v4.0/monetarias/30 */
const CER = [
  ['2024-10-02', 470.62250758042], ['2024-10-03', 471.2683611583], ['2024-10-04', 471.91510106616],
  ['2024-12-31', 515.5161457871], ['2025-01-01', 515.91069192996],
  ['2025-12-31', 676.80519117329], ['2026-01-01', 677.34450556172],
];

test('CER-01: dos fechas distintas usan cada una su propio dato (no el 04/10/2024)', () => {
  const ini = C.elegirDato(CER, '2025-01-01', true, false);
  const fin = C.elegirDato(CER, '2026-01-01', true, true);
  assert.deepEqual([ini.fecha, fin.fecha], ['2025-01-01', '2026-01-01']);
  assert.equal(ini.tardio, false);
  assert.equal(fin.tardio, false);
  const r = C.actualizar(850000, ini, fin);
  cerca(r.coeficiente, 677.34450556172 / 515.91069192996, 1e-12);
  cerca(r.monto, 850000 * 677.34450556172 / 515.91069192996);
  assert.ok(r.variacion > 31 && r.variacion < 32, `variación ${r.variacion}`);
});

test('CER-01 bis: la serie vieja (cortada el 04/10/2024) ya no se toma en silencio para las dos puntas', () => {
  const vieja = CER.slice(0, 3);
  const ini = C.elegirDato(vieja, '2025-01-01', true, false);
  assert.match(ini.error, /todavía no publica el dato del 01\/01\/2025/);
  const fin = C.elegirDato(vieja, '2026-01-01', true, true);
  assert.equal(fin.tardio, true, 'la fecha final usa el último dato, avisando');
  assert.equal(fin.fecha, '2024-10-04');
});

test('CER-02: misma fecha → coeficiente 1, variación 0 y el mismo monto', () => {
  assert.equal(C.validarFechas(f('2025-01-01'), f('2025-01-01')), '');
  const a = C.elegirDato(CER, '2025-01-01', true, false);
  const b = C.elegirDato(CER, '2025-01-01', true, true);
  const r = C.actualizar(850000, a, b);
  assert.equal(r.coeficiente, 1);
  assert.equal(r.variacion, 0);
  assert.equal(r.monto, 850000);
});

test('CER-03: fechas invertidas se rechazan con un mensaje', () => {
  assert.match(C.validarFechas(f('2026-01-01'), f('2025-01-01')), /anterior a la inicial/);
  assert.match(C.validarFechas(null, f('2025-01-01')), /Complete/);
});

test('CER-04: sin datos de la fuente no hay resultado (ni datos viejos)', () => {
  assert.match(C.elegirDato([], '2025-01-01', true, false).error, /no devolvió datos/);
  assert.match(C.actualizar(850000, null, { valor: 1 }).error, /Falta el valor/);
  // un fin de semana o feriado usa el último dato anterior dentro de los 10 días
  const conHueco = [['2025-01-03', 1], ['2025-01-06', 2]];
  assert.equal(C.elegirDato(conHueco, '2025-01-05', true, false).fecha, '2025-01-03');
  assert.match(C.elegirDato([['2024-12-01', 1], ['2025-03-01', 2]], '2025-01-20', true, false).error, /no tiene un dato cercano/);
});

test('ACT-02 / IPC: dos fechas del mismo mes usan el dato de ese mes (coeficiente 1)', () => {
  const IPC = [['2024-12-01', 7694.0075], ['2025-01-01', 7864.1257], ['2025-02-01', 8052.9927]];
  const a = C.elegirDato(IPC, '2025-01-15', false, false);
  const b = C.elegirDato(IPC, '2025-01-31', false, true);
  assert.equal(a.fecha, '2025-01-01');
  assert.equal(b.fecha, '2025-01-01');
  assert.equal(C.actualizar(850000, a, b).coeficiente, 1);
  // meses distintos: cada uno el suyo; la serie mensual no se trata como diaria
  const c = C.elegirDato(IPC, '2025-02-10', false, true);
  cerca(C.actualizar(850000, a, c).coeficiente, 8052.9927 / 7864.1257, 1e-12);
  // mes inicial todavía no publicado: error; mes final no publicado: último, con aviso
  assert.match(C.elegirDato(IPC, '2025-05-10', false, false).error, /todavía no publica el dato de 05\/2025/);
  assert.equal(C.elegirDato(IPC, '2025-05-10', false, true).tardio, true);
});

test('la página pide CER y UVA a la API del Banco Central (no a la serie cortada de datos.gob.ar)', () => {
  assert.match(html, /cer:\{bcra:30,/);
  assert.match(html, /uva:\{bcra:31,/);
  assert.ok(!/94\.2_CD_D_0_0_10/.test(html), 'ya no se usa la serie 94.2_CD_D_0_0_10');
  assert.match(html, /connect-src[^"]*https:\/\/api\.bcra\.gob\.ar/);
  assert.match(html, /IVSCalculos\.elegirDato/);
});

/* ---------- honorarios: Ley 27.423, art. 21 ---------- */
const UMA = 108005;

test('HON-01: la captura ($12.000.000, UMA $108.005) aplica la correlación del art. 21', () => {
  const h = C.honorariosNacion(12000000, UMA);
  cerca(h.enUma, 111.10597, 1e-5);
  assert.equal(h.tramo, 3);
  assert.deepEqual([h.limiteInferior, h.limiteSuperior, h.pMin, h.pMax], [90, 150, 17, 22]);
  assert.equal(h.directoMin, 2040000);     // lo que mostraba la página
  assert.equal(h.directoMax, 2640000);
  assert.equal(h.piso.umbral, 9720450);
  assert.equal(h.piso.excedente, 2279550);
  assert.equal(h.piso.maxAnterior, 2332908);
  cerca(h.min, 2720431.5);
  cerca(h.max, 2834409);
  assert.equal(h.aplicaPiso, true);
  cerca(C.tasaDeJusticia(12000000, 3), 360000);
});

test('HON-02 y HON-03: en 90 UMA justo no hay excedente del tramo nuevo; al cruzar, el mínimo no cae', () => {
  const en90 = C.honorariosNacion(90 * UMA, UMA);
  assert.equal(en90.tramo, 2, '90 UMA es el tramo 46–90');
  assert.equal(en90.limiteSuperior, 90);
  const pasando = C.honorariosNacion(90 * UMA + 1000, UMA);
  assert.equal(pasando.tramo, 3);
  cerca(pasando.piso.excedente, 1000);
  assert.ok(pasando.min >= en90.min, `mínimo ${pasando.min} < ${en90.min}`);
  // sin la regla, el mínimo caía de golpe al 17 % del monto
  assert.ok(pasando.min > pasando.directoMin);
});

test('HON-04 y HON-05: rango coherente dentro del tramo y transición en 150 UMA', () => {
  for (const u of [95, 111.1, 130, 149.9, 150, 150.01, 200, 449, 451, 760]) {
    const h = C.honorariosNacion(u * UMA, UMA);
    assert.ok(h.min <= h.max, `${u} UMA: ${h.min} > ${h.max}`);
    assert.ok(h.min >= h.directoMin && h.max >= h.directoMax);
  }
  const en150 = C.honorariosNacion(150 * UMA, UMA);
  const sobre150 = C.honorariosNacion(150 * UMA + 5000, UMA);
  assert.equal(en150.tramo, 3);
  assert.equal(sobre150.tramo, 4);
  cerca(sobre150.piso.umbral, 150 * UMA);
  cerca(sobre150.piso.excedente, 5000);
  cerca(sobre150.piso.maxAnterior, 150 * UMA * 0.22);
});

test('HON-06: cambiar la UMA cambia la conversión y los montos', () => {
  const a = C.honorariosNacion(12000000, UMA);
  const b = C.honorariosNacion(12000000, 120000);
  assert.notEqual(a.enUma, b.enUma);
  cerca(b.enUma, 100);
  assert.notEqual(a.min, b.min);
});

test('HON-07: el IVA va sólo sobre honorarios, no sobre el monto ni la tasa', () => {
  const h = C.honorariosNacion(12000000, UMA);
  cerca(C.iva(h.min, true), h.min * 0.21);
  assert.equal(C.iva(h.min, false), 0);
  cerca(C.tasaDeJusticia(12000000, 3), 360000, 0);   // la tasa no lleva IVA
});

test('HON-08: entradas vacías, cero o negativas no dan NaN ni un resultado engañoso', () => {
  for (const [m, u] of [[0, UMA], [-5, UMA], [NaN, UMA], [12000000, 0], [12000000, -1], [12000000, NaN]]) {
    const h = C.honorariosNacion(m, u);
    assert.ok(h.error, `${m}/${u} da error`);
  }
});

test('la lectura acumulativa del art. 21 queda como alternativa, sin reemplazar a la literal', () => {
  const h = C.honorariosNacion(12000000, UMA);
  assert.ok(h.alternativa.min > h.min);
  // máximo acumulado en 90 UMA: 15×33 % → 45 (26 %) → 90 (24 %) = 23,55 UMA
  cerca(h.alternativa.maxAnterior / UMA, 23.55, 1e-9);
});

/* ---------- intereses ---------- */
test('INT-01: interés simple anual', () => {
  const r = C.intereses(1500000, [{ desde: f('2025-01-01'), hasta: f('2026-01-01'), tna: 58.5 }]);
  assert.equal(r.dias, 365);
  cerca(r.intereses, 877500);
  cerca(r.total, 2377500);
});

test('INT-02: cambio de tasa sin días duplicados ni capitalización', () => {
  const r = C.intereses(1500000, [
    { desde: f('2025-01-01'), hasta: f('2025-07-01'), tna: 30 },
    { desde: f('2025-07-01'), hasta: f('2026-01-01'), tna: 60 },
  ]);
  assert.deepEqual(r.filas.map((x) => x.dias), [181, 184]);
  assert.equal(r.dias, 365);
  cerca(r.intereses, 676849.32);
  cerca(r.total, 2176849.32);
  assert.deepEqual(r.avisos, []);
});

test('intereses: fecha final anterior, tramos superpuestos o con huecos se avisan', () => {
  assert.match(C.intereses(1500000, [{ desde: f('2026-01-01'), hasta: f('2025-01-01'), tna: 30 }]).error, /anterior a la inicial/);
  const sup = C.intereses(1000, [{ desde: f('2025-01-01'), hasta: f('2025-07-01'), tna: 10 }, { desde: f('2025-06-01'), hasta: f('2025-12-01'), tna: 10 }]);
  assert.ok(sup.avisos.some((a) => /contados dos veces/.test(a)));
  const hueco = C.intereses(1000, [{ desde: f('2025-01-01'), hasta: f('2025-03-01'), tna: 10 }, { desde: f('2025-04-01'), hasta: f('2025-05-01'), tna: 10 }]);
  assert.ok(hueco.avisos.some((a) => /sin intereses/.test(a)));
  assert.ok(C.intereses(0, []).error);
});

/* ---------- liquidación ---------- */
test('liquidación: los rubros se suman una vez y el IVA sólo sobre honorarios', () => {
  const base = { capital: 1000000, intereses: 100000, honorarios: 200000, tasa: 30000, otros: 20000 };
  const con = C.liquidacion({ ...base, iva: true });
  assert.equal(con.iva, 42000);
  assert.equal(con.total, 1392000);
  const sin = C.liquidacion({ ...base, iva: false });
  assert.equal(sin.iva, 0);
  assert.equal(sin.total, 1350000);
  assert.ok(C.liquidacion({ ...base, otros: -1 }).error);
  assert.ok(C.liquidacion({ capital: 0 }).error);
});

/* ---------- despido ---------- */
test('despido: componentes del caso de prueba (no es una liquidación total)', () => {
  const r = C.despidoComponentes(1250000, f('2020-01-01'), f('2024-06-15'), { sinPreaviso: true, integracion: true, prueba: false, sacRubros: true });
  assert.equal(r.computables, 5);
  assert.equal(r.indemnizacion, 6250000);
  assert.equal(r.mesesPreaviso, 1);
  assert.equal(r.preaviso, 1250000);
  assert.equal(r.diasIntegracion, 15);
  cerca(r.integracion, 625000);
  cerca(r.sacPreaviso, 104166.67);
  cerca(r.sacIntegracion, 52083.33);
  assert.ok(C.despidoComponentes(1250000, f('2024-06-15'), f('2020-01-01')).error);
});

/* ---------- incapacidad ---------- */
// Implementación independiente (otra forma de escribir la misma renta), para comparar.
function rentaIndependiente(ingreso, pct, edad, limite, tasaPct, ajusteMendez) {
  const a = ingreso * 13 * (ajusteMendez && edad < 60 ? 60 / edad : 1) * pct / 100;
  let suma = 0;
  for (let k = 1; k <= limite - edad; k++) suma += a / Math.pow(1 + tasaPct / 100, k);
  return suma;
}

test('INC-01: Méndez y Vuoto con los parámetros documentados, contra una implementación independiente', () => {
  const m = C.incapacidad(900000, 18, 34, 'mendez');
  const v = C.incapacidad(900000, 18, 34, 'vuoto');
  assert.deepEqual([m.limite, m.i, m.n], [75, 0.04, 41]);
  assert.deepEqual([v.limite, v.i, v.n], [65, 0.06, 31]);
  cerca(m.capital, rentaIndependiente(900000, 18, 34, 75, 4, true), 0.01);
  cerca(v.capital, rentaIndependiente(900000, 18, 34, 65, 6, false), 0.01);
  assert.notEqual(Math.round(m.capital), Math.round(v.capital), 'no tienen por qué coincidir');
});

test('INC-02: incapacidad 0 % da $ 0', () => {
  assert.equal(C.incapacidad(900000, 0, 34, 'mendez').capital, 0);
});

test('INC-03: entradas límite se rechazan con un mensaje', () => {
  for (const args of [[900000, 18, 0], [900000, 18, NaN], [900000, -1, 34], [900000, 101, 34], [0, 18, 34], [-5, 18, 34], [900000, 18, 34.5]]) {
    const r = C.incapacidad(args[0], args[1], args[2], 'mendez');
    assert.ok(r.error, `${args.join('/')} da error`);
  }
  assert.ok(C.incapacidad(900000, 18, 34, 'propia', { edad: 0, tasa: 4 }).error);
  assert.equal(C.incapacidad(900000, 18, 80, 'mendez').capital, 0, 'superada la edad límite');
});
