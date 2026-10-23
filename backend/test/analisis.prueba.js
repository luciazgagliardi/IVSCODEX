/**
 * Pruebas del análisis del fallo (frontend/analisis-fallo.js): magistrados y
 * votos, partes por etapa, montos, normas, precedentes y resultado.
 *
 * El caso de referencia es la sentencia de la SCJM del 08/05/2026 (CUIJ
 * 13-07241584-6/1, «Río Uruguay Coop. de Seguros en j° Campos c/ González»),
 * con los errores que la página mostraba antes de esta corrección:
 *   «Magistrados que aparecen: Julio Ramón, Leandro Lanci, Víctor, Víctor
 *   Hugo Marcerou, Tatiana Zarev, … José.» y «No aparece la palabra
 *   "disidencia" en el texto.»
 * Los demás fallos (test/fallos/LEAME.md) tienen estructuras distintas, para
 * no ajustar las reglas a un solo documento.
 *
 *   node --test test/analisis.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { detectar, IVSAnalisis } = require(join(AQUI, '..', '..', 'frontend', 'analisis-fallo.js'));

function cargar(nombre) {
  const texto = readFileSync(join(AQUI, 'fallos', nombre), 'utf8');
  const d = detectar(texto);
  return { texto, d, a: IVSAnalisis.analizar(texto, { car: d.car, tipo: d.tipo }) };
}
const persona = (a, apellido) => a.personas.find((p) => IVSAnalisis.plano(p.nombre).includes(apellido));
const magistrados = (a) => a.personas.filter((p) => p.esMagistrado).map((p) => p.nombre);
const monto = (a, valor) => a.montos.find((m) => Math.abs(m.valor - valor) < 0.005);

const RU = cargar('scjm-rio-uruguay-2026-05-08.txt');

test('encabezado: tribunal, fecha propia y expediente aunque el texto venga cortado en renglones', () => {
  assert.equal(RU.d.trib, 'Suprema Corte de Justicia de Mendoza');
  // antes daba 04/10/2022: la fecha del accidente
  assert.equal(RU.d.fecha, '08/05/2026');
  // antes daba «especificadas» (de «la causa especificadas»)
  assert.equal(RU.d.exp, '13-07241584-6/1');
  assert.match(RU.d.car, /^RIO URUGUAY COOPERATIVA DE SEGUROS LIMITADA EN J° .* P\/ RECURSO EXTRAORDINARIO PROVINCIAL \(LEY 9423\)$/);
});

test('magistrados: sólo los del tribunal, sin abogados ni peritos, con el nombre completo', () => {
  assert.deepEqual(magistrados(RU.a), ['Norma Llatser', 'José V. Valerio', 'Julio Ramón Gómez']);
  for (const nombre of ['lanci', 'zarev', 'immerso', 'videla', 'marcerou', 'abdo', 'correa']) {
    const p = persona(RU.a, nombre);
    assert.ok(p, `aparece ${nombre}`);
    assert.equal(p.esMagistrado, false, `${nombre} no es magistrado`);
  }
  // ni «Julio Ramón» ni «Víctor» ni «José» sueltos
  for (const p of RU.a.personas) assert.ok(p.nombre.split(' ').length >= 2, `nombre completo: ${p.nombre}`);
  // «Víctor Hugo MARCEROU» y «Víctor H. MARCEROU» son la misma persona; Agustina no
  assert.equal(RU.a.personas.filter((p) => /Marcerou/.test(p.nombre)).length, 3);
});

test('votos, adhesión y licencia según las fórmulas del fallo, con evidencia', () => {
  const llatser = persona(RU.a, 'llatser');
  const gomez = persona(RU.a, 'gomez');
  const valerio = persona(RU.a, 'valerio');
  assert.deepEqual(llatser.participacion, ['voto_principal']);
  assert.equal(llatser.enOrdenDeEstudio, 1);
  assert.equal(llatser.suscripcion, 'suscribe');
  assert.deepEqual(gomez.participacion, ['adhesion']);
  assert.equal(gomez.enOrdenDeEstudio, 3);
  const adh = gomez.hechos.filter((h) => h.tipo === 'adhesion');
  assert.equal(adh.length, 3, 'adhiere en las tres cuestiones');
  assert.ok(adh.every((h) => h.a === llatser.id && /adhiere al voto que antecede/.test(h.evidencia.texto)));
  assert.equal(valerio.enOrdenDeEstudio, 2);
  assert.deepEqual(valerio.participacion, [], 'no votó: sólo figura en el orden de estudio');
  assert.equal(valerio.suscripcion, 'no_suscribe_por_licencia');
  const ns = valerio.hechos.find((h) => h.tipo === 'no_suscribe');
  assert.match(ns.evidencia.texto, /no es suscripta por el Dr\. JOSE V\. VALERIO, por encontrarse en uso de licencia/);
});

test('disidencia: la licencia no es disidencia y la ausencia de la palabra no se toma como prueba', () => {
  assert.equal(RU.a.votacion.estado, 'sin_disidencia_en_estructura');
  assert.ok(RU.a.votacion.detalle.some((x) => /no garantiza la unanimidad/.test(x)));
  assert.ok(RU.a.votacion.detalle.some((x) => /Valerio no suscribe .* licencia: eso no es una disidencia/.test(x)));
  // un texto sin estructura de votos no puede dar «sin disidencia»
  const suelto = IVSAnalisis.analizar('La Cámara confirmó la sentencia apelada. Costas a la vencida.', {});
  assert.equal(suelto.votacion.estado, 'informacion_insuficiente');
});

test('partes: el recurrente actual no reemplaza los roles del proceso de origen', () => {
  const P = RU.a.partes;
  assert.equal(P.instancia.recurrentes[0].nombre, 'Río Uruguay Cooperativa de Seguros Limitada');
  assert.equal(P.instancia.recurrentes[0].tambien, 'citada en garantía en el proceso de origen');
  assert.equal(P.origen.actor[0].nombre, 'Iván Esteban Campos');
  assert.deepEqual(P.origen.demandados.map((x) => x.funcion), ['conductor', 'titular registral']);
  assert.match(P.origen.demandados[0].nombre, /^Tom[aá]s Raúl González$/);
  assert.match(P.origen.demandados[1].nombre, /^Rosana Paola Villar{1,2}eal$/);
  assert.equal(P.origen.citadosEnGarantia[0].nombre, 'Río Uruguay Cooperativa de Seguros Limitada');
  // el recurrido se deduce (contraparte), y lo dice
  assert.equal(P.instancia.recurridos[0].nombre, 'Iván Esteban Campos');
  assert.equal(P.instancia.recurridos[0].certeza, 'inferido');
});

test('montos: reclamado, concedido, fijado y condena total no se confunden', () => {
  const casos = [
    [21330250.98, 'reclamado', 'demanda'],
    [18919950.98, 'reclamado', 'demanda'],
    [45070032, 'concedido', 'primera_instancia'],
    [31829636.63, 'fijado_por_este_tribunal', 'instancia_actual'],
    [38214336, 'condena_total', 'parte_resolutiva (texto modificado)'],
  ];
  for (const [valor, funcion, etapa] of casos) {
    const m = monto(RU.a, valor);
    assert.ok(m, `está ${valor}`);
    assert.equal(m.funcion, funcion, `${valor}: ${m.funcion}`);
    assert.equal(m.etapa, etapa, `${valor}: ${m.etapa}`);
    assert.ok(m.evidencia.texto.length > 20);
  }
  assert.match(monto(RU.a, 18919950.98).concepto, /incapacidad sobreviniente/i);
  assert.match(monto(RU.a, 31829636.63).concepto, /incapacidad sobreviniente/i);
  // «con más los intereses»: la cifra NO incluye intereses
  assert.equal(monto(RU.a, 38214336).intereses, 'aparte');
  assert.notEqual(monto(RU.a, 38214336).intereses, 'incluidos');
  // los honorarios van aparte, con el profesional
  const lanci = RU.a.montos.find((m) => m.valor === 4815006);
  assert.equal(lanci.funcion, 'honorarios_regulados');
  assert.equal(lanci.sujeto, 'Leandro Lanci');
  assert.equal(lanci.principal, false);
});

test('incapacidad: Balthazard reemplaza la suma lineal (73,30 % → 60,31 %)', () => {
  const I = RU.a.incapacidad;
  assert.deepEqual(I.parciales, [43.3, 30]);
  assert.equal(I.capacidadRestante, 56.7);
  assert.equal(I.calculado, 60.31);
  assert.equal(I.corregido, 60.31);
  assert.equal(I.anterior, 73.3);
  assert.equal(I.verificado, true);
});

test('decisión: el resultado global y cada agravio por separado', () => {
  const D = RU.a.decision;
  assert.deepEqual(D.global.verbos, ['admite parcialmente', 'modifica']);
  assert.match(D.global.literal, /^Admitir parcialmente el recurso extraordinario/);
  assert.deepEqual(D.agravios.map((g) => [g.letra, g.estado]), [
    ['a', 'rechazado'],             // elección de la fórmula Méndez
    ['b', 'rechazado'],             // daño psíquico dentro de la incapacidad
    ['c', 'admitido'],              // método Balthazard
    ['d', 'admitido_parcialmente'], // tasa: sólo para las consecuencias no patrimoniales
  ]);
  assert.ok(D.modificaciones.some((m) => /porcentaje de la incapacidad/.test(m.texto)));
  assert.ok(D.modificaciones.some((m) => /tasa de interés del rubro consecuencias no patrimoniales/.test(m.texto)));
});

test('normas: cada artículo con su norma, sin concatenar y sin atribuir por el número solo', () => {
  const g = Object.fromEntries(RU.d.artsPorFuente.map((x) => [x[0], x[1]]));
  assert.deepEqual(g['CCyC (vigente)'].slice().sort(), ['art. 1740', 'art. 1746', 'art. 1748', 'art. 765', 'art. 768']);
  assert.deepEqual(g['Ley de Seguros (LS)'], ['art. 118']);
  assert.deepEqual(g['Constitución provincial'], ['art. 160']);
  assert.ok(g['CPCCyT (Mendoza)'].includes('art. 36 inc. I'));
  assert.ok(g['CPCCyT (Mendoza)'].includes('art. 88 ap. III'));
  assert.deepEqual(g['Ley 9.131 — Aranceles de Abogados y Procuradores de Mendoza'].slice().sort(), ['art. 15', 'art. 16', 'art. 2', 'art. 3', 'art. 31', 'art. 4']);
  assert.equal(g['Sin ley identificada'], undefined, 'no quedan artículos sin norma');
  // las leyes de Mendoza ya no figuran como nacionales
  const cat = Object.fromEntries(RU.d.artsPorFuente.map((x) => [x[0], x[2]]));
  assert.equal(cat['Ley 9.041 — Intereses moratorios (Mendoza)'], 'provincial');
  assert.equal(cat['Ley 23.928'], 'leyes');
  // cada referencia es un elemento propio, sin duplicados dentro de la norma
  for (const [, arts] of RU.d.artsPorFuente) {
    assert.equal(new Set(arts).size, arts.length);
    for (const a of arts) assert.match(a, /^art\. \d+( bis| ter)?( (inc|ap)\. [\wIVX]+)?$/);
  }
  // las de honorarios y costas se distinguen de las que fundan la decisión
  const ctx = (art) => RU.d.citas.filter((c) => c.l === art).map((c) => RU.a.contextoDe(c.pos));
  assert.ok(ctx('art. 31').every((c) => c === 'honorarios'));
  assert.ok(ctx('art. 1746').every((c) => c === 'fundamentos'));
});

test('precedentes: Ontiveros (Fallos 340:1038) además de Barrientos, y los provinciales', () => {
  const P = RU.a.precedentes;
  const ont = P.find((p) => p.publicacion === 'Fallos 340:1038');
  assert.ok(ont, 'detecta Ontiveros');
  assert.equal(ont.tipo, 'csjn');
  assert.match(ont.caratula, /^Ontiveros, Stella Maris/);
  assert.equal(ont.fecha, '10/08/2017');
  const bar = P.find((p) => p.publicacion === 'Fallos 347:1446');
  assert.match(bar.caratula, /^Barrientos/);
  assert.match(bar.funcion, /distinguido/, 'la Corte de Mendoza dice que Barrientos no se aplica');
  const prov = P.filter((p) => p.tipo === 'provincial');
  assert.ok(prov.length >= 8);
  assert.ok(prov.some((p) => p.caratula === 'Lucero' && p.fecha === '21/08/2025'));
  assert.ok(prov.some((p) => /^Bustos/.test(p.caratula || '') && p.publicacion === 'LS631-023'));
  assert.ok(P.some((p) => p.tipo === 'doctrina' && /Baremo general para el fuero civil/.test(p.caratula || '')));
  // un pasaje entre comillas no es un precedente
  assert.ok(!P.some((p) => /^Si la sentencia fijó/.test(p.caratula || '')));
});

/* ---- otras estructuras ---- */

test('SCJM: disidencia parcial y adhesiones plurales («los Dres. … adhieren»)', () => {
  const { a, d } = cargar('scjm-berro-2026-08-12.txt');
  assert.equal(d.fecha, '12/08/2026');
  assert.deepEqual(magistrados(a), ['Julio Ramón Gómez', 'Mario Daniel Adaro', 'José Virgilio Valerio']);
  assert.equal(a.votacion.estado, 'disidencia_identificada');
  const valerio = persona(a, 'valerio');
  assert.ok(valerio.participacion.includes('disidencia_parcial'));
  assert.ok(valerio.participacion.includes('adhesion'), 'en la 2.ª y 3.ª cuestión adhiere');
  assert.equal(persona(a, 'sanchez').rol, 'abogado_o_representante');
  // «arts. 245, 232, 233 y c.c. de la LCT»: «y c.c.» es «y concordantes»
  const g = Object.fromEntries(d.artsPorFuente.map((x) => [x[0], x[1]]));
  assert.equal(g['Código Civil (derogado)'], undefined);
  assert.ok(g['Ley de Contrato de Trabajo (LCT)'].includes('art. 245'));
  assert.deepEqual(a.decision.global.verbos, ['rechaza']);
});

test('TSJ: dos disidencias; la mayoría sin nombre se informa, no se inventa', () => {
  const { a, d } = cargar('tsj-distribuidora-pompeya.txt');
  assert.equal(d.tipo, 'tsj');
  assert.equal(d.fecha, undefined, 'no toma la fecha de ingreso al trabajo como fecha del fallo');
  assert.equal(a.votacion.estado, 'disidencia_identificada');
  assert.deepEqual(a.votos.map((v) => v.tipo), ['disidencia', 'disidencia']);
  assert.ok(a.votacion.detalle.some((x) => /mayoría no lleva el nombre/.test(x)));
});

test('TSJ: votos «por su voto», una disidencia y una adhesión dividida', () => {
  const { a } = cargar('tsj-caja-de-seguros.txt');
  assert.equal(a.votacion.estado, 'disidencia_identificada');
  assert.equal(persona(a, 'ruiz').participacion[0], 'disidencia');
  const ota = persona(a, 'otamendi');
  const adh = ota.hechos.filter((h) => h.tipo === 'adhesion');
  assert.equal(adh.length, 2);
  assert.deepEqual(adh.map((h) => a.personas.find((p) => p.id === h.a).nombre), ['Inés M. Weinberg', 'Alicia E. C. Ruiz']);
  // «Alicia E.C. Ruiz» y «Alicia E. C. Ruiz» son la misma persona
  assert.equal(a.personas.filter((p) => /Ruiz/.test(p.nombre)).length, 1);
});

test('TSJ 2003: adhesiones parciales en primera persona; colegas mencionados no se inventan como votos', () => {
  const { a, d } = cargar('tsj-rozen-2003.txt');
  assert.equal(d.fecha, '02/07/2003');
  assert.equal(a.votacion.estado, 'sin_disidencia_en_estructura');
  assert.ok(a.adhesiones.every((h) => h.alcance === 'parcial'));
  assert.equal(persona(a, 'casas').rol, 'magistrado_mencionado');
  assert.deepEqual(a.decision.global.verbos, ['desestima']);
  const cafaro = a.precedentes.find((p) => /^Cáfaro/.test(p.caratula || ''));
  assert.equal(cafaro.fecha, '13/08/1986', 'año de dos dígitos');
});

test('TSJ: carátula con «CONTRA»/«SOBRE» y artículos del CCAyT', () => {
  const { d } = cargar('tsj-lopez-viviana.txt');
  assert.match(d.car, /LOPEZ, VIVIANA ALCIRA CONTRA GCBA SOBRE RECURSO DIRECTO/);
  const g = Object.fromEntries(d.artsPorFuente.map((x) => [x[0], x[1]]));
  assert.deepEqual(g['CCAyT (CABA)'], ['art. 464', 'art. 465']);
});

test('CSJN (texto sintético con las fórmulas de la Corte): votos y disidencias por encabezado', () => {
  // SINTÉTICO: no es un fallo real. Reproduce las fórmulas de encabezado de
  // la Corte Suprema, que no hay en el corpus de prueba con texto completo.
  const t = 'Buenos Aires, 10 de agosto de 2017. Vistos los autos: «Recurso de hecho deducido por la actora en la causa Pérez, Juan c/ ART S.A. s/ accidente». Considerando: 1°) Que contra la sentencia… Por ello, se hace lugar a la queja. Notifíquese y devuélvase. ' +
    'VOTO DEL SEÑOR PRESIDENTE DOCTOR DON RICARDO LUIS LORENZETTI Considerando: Que… ' +
    'DISIDENCIA DE LA SEÑORA VICEPRESIDENTA DOCTORA DOÑA ELENA I. HIGHTON DE NOLASCO Considerando: Que el recurso es inadmisible (art. 280).';
  const d = detectar(t);
  const a = IVSAnalisis.analizar(t, { car: d.car, tipo: d.tipo });
  assert.equal(d.fecha, '10/08/2017');
  assert.equal(a.votacion.estado, 'disidencia_identificada');
  assert.deepEqual(a.votos.map((v) => [v.tipo, a.personas.find((p) => p.id === v.persona).nombre]), [
    ['voto_propio', 'Ricardo Luis Lorenzetti'],
    ['disidencia', 'Elena I. Highton de Nolasco'],
  ]);
  assert.equal(a.partes.instancia.recurrentes[0].comoEnCaratula, 'la actora');
  assert.equal(a.partes.origen.demandados[0].comoEnCaratula, 'ART S.A.');
});
