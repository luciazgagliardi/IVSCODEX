/**
 * Pruebas del razonamiento de Lexia (IVSLexia en frontend/analisis-fallo.js):
 * qué pide la pregunta, sobre quién o qué, y de qué parte del fallo sale la
 * respuesta. Usa los fallos de test/fallos/.
 *
 *   node --test test/lexia.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { detectar, IVSAnalisis, IVSLexia } = require(join(AQUI, '..', '..', 'frontend', 'analisis-fallo.js'));

function cargar(nombre) {
  const texto = readFileSync(join(AQUI, 'fallos', nombre), 'utf8');
  const d = detectar(texto);
  return { texto, d, a: IVSAnalisis.analizar(texto, { car: d.car, tipo: d.tipo }) };
}
const RU = cargar('scjm-rio-uruguay-2026-05-08.txt');
const BE = cargar('scjm-berro-2026-08-12.txt');
const DP = cargar('tsj-distribuidora-pompeya.txt');
const CS = cargar('tsj-caja-de-seguros.txt');
const LV = cargar('tsj-lopez-viviana.txt');
const plano = IVSAnalisis.plano;

test('una pregunta con varias cosas se responde por partes, en el orden en que se pregunta', () => {
  assert.deepEqual(IVSLexia.intenciones('¿Quién ganó y cuánto?'), ['decision', 'montos']);
  assert.deepEqual(IVSLexia.intenciones('¿Qué se resolvió y por qué?'), ['decision', 'porque']);
  assert.deepEqual(IVSLexia.intenciones('¿Cuánto le indemnizaron y quién paga las costas?'), ['montos', 'costas']);
  // dos intenciones no se reparten las mismas palabras: «cuánto cobró el perito» es honorarios, no además montos
  assert.deepEqual(IVSLexia.intenciones('¿Cuánto cobró el perito?'), ['honorarios']);
  assert.deepEqual(IVSLexia.intenciones('¿Qué dijo la Cámara?'), ['instancia']);
  assert.deepEqual(IVSLexia.intenciones('¿Qué resolvió la jueza de primera instancia?'), ['instancia']);
  assert.deepEqual(IVSLexia.intenciones('¿Qué tasa de interés se aplicó?'), ['intereses']);
  assert.deepEqual(IVSLexia.intenciones('Explicame el fallo'), ['resumen']);
});

test('reconoce a un magistrado por el apellido y busca en su propio voto', () => {
  const e = IVSLexia.entender('¿Qué votó Valerio?', BE.a, BE.d);
  assert.deepEqual(e.personas.map((p) => p.nombre), ['José Virgilio Valerio']);
  // la persona manda: no se agrega la lista entera de votos
  assert.equal(e.intenciones.includes('votos'), false);
  const vs = IVSLexia.votosDe(BE.a, BE.texto, e.personas[0]);
  assert.equal(vs.length, 1);
  assert.equal(vs[0].voto.tipo, 'disidencia_parcial');
  const enVoto = IVSLexia.rankear(BE.texto, BE.a, 'multa', { rangos: [vs[0].rango], n: 2 });
  assert.ok(enVoto.length, 'encuentra «multa» dentro de su voto');
  for (const x of enVoto) assert.ok(x.ini >= vs[0].rango[0] && x.ini < vs[0].rango[1], 'el pasaje está dentro de su voto');
  // en Río Uruguay, Valerio no firmó por licencia: no hay voto propio que mostrar
  const e2 = IVSLexia.entender('¿Qué opinó Valerio?', RU.a, RU.d);
  assert.equal(IVSLexia.votosDe(RU.a, RU.texto, e2.personas[0]).length, 0);
  assert.equal(e2.personas[0].suscripcion, 'no_suscribe_por_licencia');
});

test('un artículo con su norma: sólo las citas de esa norma, con su oración', () => {
  const e = IVSLexia.entender('¿Qué dice el art. 1746 del CCyC?', RU.a, RU.d);
  assert.deepEqual(e.articulos.map((a) => a.num), ['1746']);
  const cs = IVSLexia.citasDelArticulo(RU.d, e.articulos[0]);
  assert.equal(cs.length, 2);
  assert.ok(cs.every((c) => /CCyC/.test(c.f)));
  // el art. 2 de la Ley 25.323 en Berro, nombrando la ley por su número
  const e2 = IVSLexia.entender('¿Dónde aplica el artículo 2 de la ley 25.323?', BE.a, BE.d);
  assert.ok(IVSLexia.citasDelArticulo(BE.d, e2.articulos[0]).length >= 3);
  assert.equal(IVSLexia.citasDelArticulo(BE.d, { num: '2', norma: { ley: '24240' } }).length, 0, 'de otra ley, nada');
});

test('el porqué de un agravio sale de su apartado y prefiere la conclusión propia a la cita textual', () => {
  const e = IVSLexia.entender('¿Por qué se admitió en parte el agravio de la tasa de interés?', RU.a, RU.d);
  assert.equal(e.agravio.letra, 'd');
  assert.equal(e.porque, true);
  const ps = IVSLexia.porQue(RU.texto, RU.a, { agravio: e.agravio, pregunta: e.tema, n: 3 });
  assert.equal(ps.length, 3);
  for (const x of ps) assert.ok(x.ini >= e.agravio.ini && x.ini < e.agravio.fin, 'dentro del apartado d)');
  assert.ok(ps.some((x) => /se deduce que, a la inversa|Por eso respecto al rubro consecuencias no patrimoniales/.test(x.t)), 'trae la conclusión del voto');
  assert.ok(!ps.some((x) => /^Se agravia la recurrente/.test(x.t)), 'no confunde lo que dice la recurrente con la razón');
  // «¿qué tasa se aplicó?» pregunta por la tasa, no por el agravio
  assert.equal(IVSLexia.entender('¿Qué tasa de interés se aplicó?', RU.a, RU.d).agravio, null);
  // por el tema: «lo del daño moral» es el agravio de las consecuencias no patrimoniales
  assert.equal(IVSLexia.entender('¿Por qué rechazaron lo del daño moral?', RU.a, RU.d).agravio.letra, 'b');
  assert.equal(IVSLexia.entender('¿Qué pasó con el segundo agravio?', RU.a, RU.d).agravio.letra, 'b');
});

test('costas: las de esta instancia separadas de las de instancias anteriores, con su razón', () => {
  const c = IVSLexia.costas(RU.texto, RU.a);
  assert.equal(c[0].etapa, 'esta_instancia');
  assert.equal(c[0].regla, 'a cargo del recurrente');
  assert.match(c[0].t, /instancia extraordinaria/);
  // lo transcripto de la sentencia que se modifica no es lo que impone este tribunal
  assert.ok(c.some((x) => x.etapa === 'texto_modificado' && /demandada y citada en garantia/.test(plano(x.regla || ''))));
  const b = IVSLexia.costas(BE.texto, BE.a);
  assert.equal(b[0].regla, 'en el orden causado (cada parte carga con las suyas)');
  assert.equal(b[0].zona, 'resolutiva');
  assert.ok(b.some((x) => x.etapa === 'esta_instancia' && /razon probable y buena fe/.test(x.razon || '')), 'la razón del voto');
  // lo que impuso la sentencia de grado queda como de otra etapa
  assert.ok(b.filter((x) => /a cargo de la demandada/.test(x.regla || '')).every((x) => x.etapa !== 'esta_instancia'));
  const p = IVSLexia.costas(DP.texto, DP.a);
  assert.equal(p[0].etapa, 'esta_instancia');
  assert.ok(p.some((x) => x.etapa !== 'esta_instancia' && /parte actora/.test(x.regla || '') && /vencida/.test(x.razon || '')));
  // «Las costas se imponen por su orden en atención a que la causa se devuelve…»
  const l = IVSLexia.costas(LV.texto, LV.a).filter((x) => x.etapa === 'esta_instancia');
  assert.ok(l.some((x) => /orden causado/.test(x.regla) && /en atencion a/.test(x.razon || '')));
});

test('intereses: la tasa, desde cuándo, y lo que pidió una parte pesa menos que lo que se decide', () => {
  const i = IVSLexia.intereses(RU.texto, RU.a);
  assert.ok(i.length >= 3);
  assert.ok(!/^Se agravia|^Solicita/.test(i[0].t), `la primera no es un pedido de parte: ${i[0].t.slice(0, 60)}`);
  assert.ok(i.slice(0, 3).some((x) => x.tasas.includes('tasa activa')));
  const c = IVSLexia.intereses(CS.texto, CS.a);
  assert.ok(c.some((x) => x.tasas.includes('tasa activa')));
  assert.ok(c.some((x) => x.tasas.includes('tasa pura')));
});

test('lo que dijeron las instancias anteriores, sin lo que dicen las partes sobre ellas', () => {
  const x = IVSLexia.instancias(DP.texto, DP.a, 'primera');
  assert.ok(x.some((o) => /La jueza de primera instancia rechazó la demanda/.test(o.t)));
  const c = IVSLexia.instancias(DP.texto, DP.a, 'camara');
  assert.ok(c.some((o) => /La Sala V de la Cámara Nacional de Apelaciones del Trabajo revocó/.test(o.t)));
  const r = IVSLexia.instancias(RU.texto, RU.a, 'camara');
  assert.ok(r.some((o) => /Quinta Cámara de Apelaciones de la Primera Circunscripción rechazó el recurso/.test(o.t)));
  for (const o of r) assert.ok(!/^Se equivoca al afirmar/.test(o.t));
});

test('oraciones: no corta en abreviaturas, iniciales ni dentro de una cita entre paréntesis', () => {
  const ors = IVSLexia.oraciones(RU.texto, RU.a);
  assert.ok(ors.some((o) => /^\(Llambias, Tratado de Derecho Civil.*pág\. 167\)\.$/.test(o.t)));
  assert.ok(!ors.some((o) => /^(As\.|167\)|pág\.)/.test(o.t)));
  const rz = cargar('tsj-rozen-2003.txt');
  assert.ok(!IVSLexia.oraciones(rz.texto, rz.a).some((o) => /^J\. Maier/.test(o.t)));
  // cada oración sabe en qué parte del fallo está
  assert.ok(ors.some((o) => o.zona === 'resolutiva' && /Admitir parcialmente el recurso extraordinario/.test(o.t)));
});

test('búsqueda libre: oraciones por BM25, con sinónimos del lenguaje de los fallos', () => {
  // «daño moral» encuentra «consecuencias no patrimoniales»
  const r = IVSLexia.rankear(RU.texto, RU.a, 'daño moral', { n: 5 });
  assert.ok(r.some((x) => /consecuencias no patrimoniales/i.test(x.t)));
  // las dos palabras juntas pesan más que sueltas
  const r2 = IVSLexia.rankear(DP.texto, DP.a, 'liquidación final', { n: 1 });
  assert.match(plano(r2[0].t), /liquidacion final/);
  assert.deepEqual(IVSLexia.rankear(RU.texto, RU.a, '¿qué?'), []);
});

test('la clave de la respuesta: misma pregunta con otras palabras, misma respuesta; otra persona, otra', () => {
  const k = (q, X = BE) => IVSLexia.entender(q, X.a, X.d).clave;
  assert.equal(k('¿Hubo disidencia?'), k('¿Algún voto en disidencia?'));
  assert.notEqual(k('¿Qué votó Valerio?'), k('¿Qué votó Gómez?'));
  assert.notEqual(k('¿Qué dice el art. 2?'), k('¿Qué dice el art. 245?'));
});
