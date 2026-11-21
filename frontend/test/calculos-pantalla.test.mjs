/* Pantallas de Cálculos y Plazos: ejecuta las funciones reales de
   frontend/index.html (sección 7) y de la portada (frontend/portada/index.html)
   en un contexto vm, sin DOM, con los casos de
   docs/auditoria-integral-2026/04-calculos-y-plazos.md (C-01 a C-07, C-10, C-12). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const raiz = new URL('../', import.meta.url);
const leer = (p) => readFileSync(new URL(p, raiz), 'utf8');
const IVSCalculos = require(new URL('calculos.js', raiz).pathname);

function plataforma() {
  const html = leer('index.html');
  const ini = html.indexOf('var CALC={'), fin = html.indexOf('/* ================= GLOSARIO DE LATÍN JURÍDICO');
  assert.ok(ini > 0 && fin > ini, 'sección 7 de index.html');
  const codigo = html.slice(ini, fin).replace(/document\.addEventListener\("input"[\s\S]*?\n\}\);\n/, '');
  const ctx = { console, IVSCalculos, store: { get() {}, set() {} }, esc: (s) => String(s), estado: { tab: 'plazos' },
    fetch: () => Promise.reject(new Error('sin red')), flash() {}, document: { getElementById() { return null; } } };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  return ctx;
}

function portada() {
  const html = leer('portada/index.html');
  assert.match(html, /<script src="\.\.\/calculos\.js\?v=[^"]+"><\/script><script src="calculos\.js/, 'la portada carga el calculos.js de la plataforma');
  const ini = html.indexOf('var P={'), fin = html.indexOf('function pintarPanel(){');
  const valores = {};
  const nodos = {};
  const $ = (id) => (nodos[id] ||= { value: valores[id], checked: valores[id], innerHTML: '' });
  const ctx = { console, IVSCalculos, $, st: { tab: 'des', modo: 'habiles', juris: 'nacion' }, hoy: new Date('2026-11-20T00:00:00Z'),
    esc: (s) => String(s), fila: (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`, nota: (t) => t,
    campo: () => '', fecha: () => '', chips: () => '', fh: (d) => d.toISOString().slice(0, 10) };
  vm.createContext(ctx);
  vm.runInContext(leer('portada/calculos.js'), ctx);
  vm.runInContext(html.slice(ini, fin), ctx);
  return { ctx, nodos, poner(v) { Object.assign(valores, v); for (const k in nodos) delete nodos[k]; } };
}

test('plataforma · C-01/C-04: plazos de Nación y Mendoza con la función real de la pantalla', () => {
  const X = plataforma();
  X.CALC.procesales = { notif: '2026-11-05', dias: '3', tipo: 'habiles', juris: 'nacion' };
  let r = X.calcProcesales();
  assert.equal(r.total, 'miércoles, 11 de noviembre de 2026');
  assert.match(r.sub, /jueves, 12 de noviembre de 2026/);
  X.CALC.procesales = { notif: '2026-03-20', dias: '3', tipo: 'habiles', juris: 'mendoza' };
  r = X.calcProcesales();
  assert.equal(r.total, 'viernes, 27 de marzo de 2026');
  assert.match(r.sub, /sin plazo de gracia/);
  assert.match(r.base, /Ley 9001/);
  assert.doesNotMatch(r.base, /CPCCN/);
  X.CALC.procesales = { notif: '2026-07-08', dias: '5', tipo: 'habiles', juris: 'mendoza' };
  assert.equal(X.calcProcesales().total, 'viernes, 31 de julio de 2026');
  X.CALC.procesales = { notif: '2026-12-28', dias: '5', tipo: 'habiles', juris: 'mendoza' };
  r = X.calcProcesales();
  assert.equal(r.total, 'martes, 2 de febrero de 2027 (provisorio)');
  assert.ok(r.avisos.some((a) => /Resultado provisorio/.test(a)));
  assert.ok(r.filas.some((f) => /04\/01\/2027 al 29\/01\/2027/.test(f[0])), 'la feria va en una sola fila');
});

test('plataforma · C-03: un inhábil cargado para Mendoza no se descuenta en Nación', () => {
  const X = plataforma();
  X.CALC.inhabiles = [{ desde: '2026-11-10', hasta: '2026-11-10', motivo: 'Asueto', juris: 'mendoza' }];
  X.CALC.procesales = { notif: '2026-11-05', dias: '3', tipo: 'habiles', juris: 'nacion' };
  assert.equal(X.calcProcesales().total, 'miércoles, 11 de noviembre de 2026');
  X.CALC.procesales.juris = 'mendoza';
  assert.equal(X.calcProcesales().total, 'jueves, 12 de noviembre de 2026');
  X.CALC.cal = { anio: 2026, mes: 6, juris: 'nacion' };
  assert.match(X.vistaCalendario(), /no verificado, confirme la acordada/);
});

test('plataforma · C-05: despido en período de prueba', () => {
  const X = plataforma();
  X.CALC.despido = { sueldo: '1.000.000', ingreso: '2026-06-01', egreso: '2026-09-15', tope: '', prueba: true, sinPreaviso: true, integracion: true, sacRubros: true };
  const r = X.calcDespido();
  assert.equal(r.total.replace(/\s/g, ' '), '$ 887.083,88');
  assert.ok(!r.filas.some((f) => /art\. 245|Preaviso/.test(f[0])));
  assert.match(r.avisos[0], /Ley 27\.802/);
});

test('plataforma · C-06 y C-07: honorarios', () => {
  const X = plataforma();
  X.CALC.honorarios = { juris: 'mendoza', monto: '40.000.000', uma: '', procesoNacion: 'conocimiento', jus: '784.337,29', rol: 'ganador', proceso: 'ordinario', merito: '', procurador: false, iva: false, tasaPct: '' };
  assert.equal(X.calcHonorarios().total.replace(/\s/g, ' '), '$ 6.274.698,32 a $ 8.157.107,82');
  X.CALC.honorarios = { juris: 'nacion', monto: '1.000.000', uma: '108.005', procesoNacion: 'conocimiento', jus: '', rol: 'ganador', proceso: 'ordinario', merito: '', procurador: false, iva: false, tasaPct: '3' };
  assert.equal(X.calcHonorarios().total.replace(/\s/g, ' '), '$ 1.080.050,00');
  X.CALC.honorarios.procesoNacion = 'otro';
  assert.equal(X.calcHonorarios().total.replace(/\s/g, ' '), '$ 220.000,00 a $ 330.000,00');
});

test('portada · C-12: el despido da el mismo total que la plataforma', () => {
  const X = plataforma();
  X.CALC.despido = { sueldo: '1.250.000', ingreso: '2020-03-10', egreso: '2026-11-20', tope: '', prueba: false, sinPreaviso: true, integracion: true, sacRubros: true };
  const app = X.calcDespido().total;
  const Pt = portada();
  Pt.poner({ ds: '1.250.000', di: '2020-03-10', de: '2026-11-20', dp: true, dg: true, dpr: false });
  Pt.ctx.P.des.c();
  const sal = Pt.nodos.out.innerHTML;
  assert.match(sal, /14\.238\.515,28/);
  assert.equal(app.replace(/\s/g, ' '), '$ 14.238.515,28');
  Pt.poner({ ds: '1.000.000', di: '2026-06-01', de: '2026-09-15', dp: true, dg: true, dpr: true });
  Pt.ctx.P.des.c();
  assert.match(Pt.nodos.out.innerHTML, /887\.083,88/);
});

test('portada · C-01 a C-04: los plazos usan el mismo cómputo', () => {
  const Pt = portada();
  Pt.ctx.st.juris = 'nacion';
  Pt.poner({ pn: '2026-11-05', pd: '3' });
  Pt.ctx.P.pla.c();
  assert.match(Pt.nodos.out.innerHTML, /miércoles, 11 de noviembre de 2026/);
  Pt.ctx.st.juris = 'mendoza';
  Pt.poner({ pn: '2026-07-08', pd: '5' });
  Pt.ctx.P.pla.c();
  assert.match(Pt.nodos.out.innerHTML, /viernes, 31 de julio de 2026/);
  assert.match(Pt.nodos.out.innerHTML, /sin plazo de gracia/);
  assert.equal(Pt.ctx.motivo(new Date('2026-11-09T00:00:00Z')), IVSCalculos.diaInhabil(new Date('2026-11-09T00:00:00Z'), 'mendoza').motivo);
});

test('C-08: el aviso del despido cita la ley que corresponde según la fecha de egreso', async () => {
  const { readFile } = await import('node:fs/promises');
  const vm = await import('node:vm');
  const h = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const ini = h.indexOf('function avisoRegimenDespido(');
  let i = h.indexOf('{', ini), prof = 0;
  for (; i < h.length; i++) { if (h[i] === '{') prof++; else if (h[i] === '}' && --prof === 0) break; }
  const ctx = {}; vm.runInNewContext(h.slice(ini, i + 1), ctx);
  const ahora = ctx.avisoRegimenDespido(new Date('2026-11-20T00:00:00Z'));
  assert.match(ahora, /art\. 245 LCT \(texto Ley 27\.802/);
  assert.doesNotMatch(ahora, /Según la reforma de la Ley 27\.742 \(2024\), la base del art\. 245/);
  assert.match(ctx.avisoRegimenDespido(new Date('2024-03-01T00:00:00Z')), /Ley 25\.323 si se cumplen sus recaudos/);
  assert.match(ctx.avisoRegimenDespido(new Date('2025-05-01T00:00:00Z')), /arts\. 99 y 100/);
});
