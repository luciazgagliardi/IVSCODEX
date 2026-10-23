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

test('precedentes: Ontiveros (Fallos 340:1038) además de Barrientos, con sus datos y su función', () => {
  const P = RU.a.precedentes;
  const ont = P.find((p) => (p.publicacion || '').includes('Fallos 340:1038'));
  assert.ok(ont, 'detecta Ontiveros');
  assert.equal(ont.tipo, 'csjn');
  assert.match(ont.caratula, /^Ontiveros, Stella Maris/);
  assert.equal(ont.fecha, '10/08/2017');
  const bar = P.find((p) => (p.publicacion || '').includes('Fallos 347:1446'));
  assert.match(bar.caratula, /^Barrientos/);
  assert.match(bar.funcion, /distinguido/, 'la Corte de Mendoza dice que Barrientos no se aplica');
  assert.ok(P.some((p) => p.caratula === 'Cabrera Isaac Damian' && p.fecha === '19/08/2025'), 'cita sin comillas');
  assert.ok(P.some((p) => /^Triunfo en j° Uribe/.test(p.caratula || '') && p.expediente === '13-00708149-3/1' && /LS 564-187/.test(p.publicacion)), 'cita sin comilla de apertura');
  assert.ok(!P.some((p) => /^Si la sentencia fijó|en más o en menos/.test(p.caratula || '')), 'un pasaje entre comillas no es un precedente');
  assert.ok(!P.some((p) => /CAMPOS/.test(p.caratula || '')), 'el propio expediente de origen no es un precedente');
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

/* ---- precedentes: TODAS las citas de cada fallo, y ninguna de más ----
   Listas armadas leyendo cada fallo de punta a punta. Cada entrada es
   [tipo, comienzo de la carátula (o publicación si no tiene), fecha]. */
const CITAS = {
  'scjm-rio-uruguay-2026-05-08.txt': [
    ['provincial', 'LL 145-398', ''], ['provincial', 'LS 418-235', ''], ['provincial', 'LA 84-83', ''], ['provincial', 'LS 281-483', ''],
    ['provincial', 'Lucero', '21/08/2025'], ['provincial', 'Triunfo en j° Uribe', '31/07/2018'], ['provincial', 'La Mercantil Andina', '23/11/2023'],
    ['provincial', 'Allende, María Alejandra', '22/09/2022'], ['provincial', 'Arriga, Sandra', '08/02/2019'], ['csjn', 'Ontiveros, Stella Maris', '10/08/2017'],
    ['provincial', 'LS 579-204', ''], ['provincial', 'Bustos, Enrique', '07/06/2021'], ['provincial', 'Cabrera Isaac Damian', '19/08/2025'],
    ['doctrina', 'Baremo general', ''], ['doctrina', '', ''], ['doctrina', 'Intereses: cuando', ''],
    ['provincial', 'Lezama', '09/12/2024'], ['provincial', 'LS 265-78', ''], ['provincial', 'Aseguradora Federal Argentina', '01/04/2014'],
    ['no_clasificable', 'L.L 1991-D-462', ''], ['provincial', 'LS 282-133', ''], ['provincial', 'Cinquemani', '20/03/2018'],
    ['provincial', 'Sosa', '25/09/2023'], ['csjn', 'Barrientos, Gabriel Alexandra', '15/10/2024'], ['provincial', 'Chogris', ''], ['provincial', 'MEDINA', ''],
  ],
  'scjm-berro-2026-08-12.txt': [
    ['provincial', 'Reynals Castillo', '10/05/2022'], ['provincial', 'Chialvo', '25/08/2025'], ['provincial', 'Nabors Internacional Argentina SRL', '07/07/2021'],
    ['csjn', 'Pellicori', ''], ['csjn', 'Sisnero', ''], ['csjn', 'Varela', ''], ['provincial', 'Velardez', '01/02/2021'], ['provincial', 'Parra', '13/03/2018'],
    ['provincial', 'Acarti en j: García', '11/05/2016'], ['provincial', 'LS 522-068', ''], ['provincial', 'Agroveterinaria en j: Ortega', '24/08/2016'],
    ['csjn', 'Carinadu SA', '02/03/2016'],
  ],
  'tsj-distribuidora-pompeya.txt': [
    ['csjn', 'Gómez, Ricardo c/ Consorcio', ''], ['provincial', 'Federación de Box', '25/08/1999'], ['otro_tribunal', 'Couto de Capa', '05/06/2009'],
  ],
  'tsj-caja-de-seguros.txt': [
    ['provincial', 'PARANA S.A. DE SEGUROS', '03/12/2025'], ['csjn', 'Barrientos', ''], ['provincial', 'Empresa Distribuidora Sur', '01/07/2020'],
    ['provincial', 'GCBA s/ queja', '28/09/2022'],
  ],
  'tsj-rozen-2003.txt': [
    ['provincial', 'Carrefour Argentina', '23/02/2000'], ['otra_decision', 'Nicolosi', ''], ['provincial', 'Federación Argentina de Box', '25/08/1999'],
    ['otro_tribunal', 'Cáfaro', '13/08/1986'],
  ],
  'tsj-lopez-viviana.txt': [
    ['provincial', 'GCBA s/ queja', '15/03/2023'], ['provincial', 'GCBA s/ queja', '29/03/2023'], ['csjn', 'Fallos 334:1821', ''], ['csjn', 'Fallos 332:2159', ''],
    ['csjn', 'Fallos 330:563', ''], ['provincial', 'Guglielmone, María Dolores', '22/03/2000'], ['provincial', 'Fantuzzi, José Roberto', '09/04/2001'],
  ],
};
for (const [archivo, esperadas] of Object.entries(CITAS)) {
  test(`precedentes completos: ${archivo}`, () => {
    const { a } = cargar(archivo);
    const halladas = a.precedentes.map((p) => [p.tipo, p.caratula || p.publicacion || '', p.fecha || '']);
    assert.equal(halladas.length, esperadas.length, `cantidad: ${JSON.stringify(halladas)}`);
    esperadas.forEach(([tipo, inicio, fecha], i) => {
      assert.equal(halladas[i][0], tipo, `${i}: ${halladas[i][1]}`);
      assert.ok(halladas[i][1].startsWith(inicio), `${i}: «${halladas[i][1]}» empieza con «${inicio}»`);
      assert.equal(halladas[i][2], fecha, `${i}: fecha de ${halladas[i][1]}`);
    });
    for (const p of a.precedentes) assert.ok(p.evidencia && p.evidencia.texto.length > 5 && p.regla, 'cada cita trae su fragmento y su regla');
  });
}

test('precedentes: otras formas de citar (texto armado con formas reales de distintos tribunales)', () => {
  // SINTÉTICO: no es un fallo; reúne formas de cita que no están en el corpus.
  const t = 'SUPREMA CORTE DE JUSTICIA - PODER JUDICIAL MENDOZA. ANTECEDENTES: bla bla.\n' +
    'Conforme lo resuelto por esta Sala in re Pérez, Juan c/ López, Ana s/ daños (12/03/2019), y en GÓMEZ MARÍA ELENA 05/06/2020, corresponde rechazar el agravio. ' +
    'La CSJN, en Fallos: 327:3753 («Aquino») y en la causa Arostegui, Pablo Martín c/ Omega ART S.A. (Fallos 331:570), sostuvo la reparación integral. ' +
    'Asimismo, la Cámara Nacional de Apelaciones en lo Civil, Sala A, en “Rodríguez c/ Transportes del Sur” (ED 180-345) aplicó el mismo criterio ' +
    '(C.N.Civ., Sala F, Martínez, Ana c/ Gómez, Luis s/ daños y perjuicios, 10/10/2010, JA 2011-II-123). Ver también SCBA, “Fernández”, sentencia del 3 de mayo de 2015. ' +
    'La reparación debe ser integral (CSJN, «Vizzoti, Carlos A. c/ AMSA S.A.», Fallos: 327:3677, 14/09/2004). Ver Fallos 308:1118 y 318:1593. ' +
    'En igual sentido (SCJM, Sala I, 12/04/2018, autos n° 13-01234567-8/1, “Rojas c/ Pérez”). Antes (cfr. TSJ, in re “López”, expte. n° 1234/02, sentencia del 1/2/2003). ' +
    'Es doctrina de esta Corte in re “Aguirre” (L.S. 400-123). (SCBA, Ac. 87.654, “Sosa c/ Banco Nación”, 5-5-2010). ' +
    'La doctrina coincide (Pizarro, Ramón D., Daño moral, Hammurabi, 2004, p. 120) y (conf. Kemelmajer de Carlucci, Aída, “Responsabilidad por daños”, LL 1999-A-100). ' +
    'El perito informó un “daño severo” y la actora pidió “justicia”.';
  const d = detectar(t);
  const a = IVSAnalisis.analizar(t, { car: d.car, tipo: d.tipo });
  const vistas = a.precedentes.map((p) => [p.tipo, p.caratula || p.publicacion, p.fecha || '']);
  assert.deepEqual(vistas, [
    ['provincial', 'Pérez, Juan c/ López, Ana s/ daños', '12/03/2019'],
    ['provincial', 'Gómez María Elena', '05/06/2020'],
    ['csjn', 'Aquino', ''],
    ['csjn', 'Arostegui, Pablo Martín c/ Omega ART S.A', ''],
    ['otro_tribunal', 'Rodríguez c/ Transportes del Sur', ''],
    ['otro_tribunal', 'Martínez, Ana c/ Gómez, Luis s/ daños y perjuicios', '10/10/2010'],
    ['provincial', 'Fernández', '03/05/2015'],
    ['csjn', 'Vizzoti, Carlos A. c/ AMSA S.A.', '14/09/2004'],
    ['csjn', 'Fallos 308:1118', ''],
    ['csjn', 'Fallos 318:1593', ''],
    ['provincial', 'Rojas c/ Pérez', '12/04/2018'],
    ['provincial', 'López', '01/02/2003'],
    ['provincial', 'Aguirre', ''],
    ['provincial', 'Sosa c/ Banco Nación', '05/05/2010'],
    ['doctrina', 'Daño moral', ''],
    ['doctrina', 'Responsabilidad por daños', ''],
  ]);
  const P = Object.fromEntries(a.precedentes.map((p) => [p.caratula || p.publicacion, p]));
  assert.equal(P.Aquino.publicacion, 'Fallos 327:3753');
  assert.equal(P['Arostegui, Pablo Martín c/ Omega ART S.A'].publicacion, 'Fallos 331:570');
  assert.match(P['Martínez, Ana c/ Gómez, Luis s/ daños y perjuicios'].tribunal, /C\.N\.Civ/);
  assert.equal(P['Rojas c/ Pérez'].expediente, '13-01234567-8/1');
  assert.equal(P.López.tribunal, 'Tribunal Superior de Justicia de la Ciudad Autónoma de Buenos Aires');
  assert.equal(P['Sosa c/ Banco Nación'].tribunal, 'Suprema Corte de Justicia de la Provincia de Buenos Aires');
});

test('TSJ con firma digital: «APELLIDO, NOMBRES / JUEZ/A», fecha de la firma, licencia y mayoría deducida de las firmas', () => {
  const { a, d } = cargar('tsj-federacion-patronal-firma-digital.txt');
  assert.equal(d.tipo, 'tsj');
  assert.equal(d.fecha, '09/09/2026');
  assert.deepEqual(magistrados(a).sort(), ['Alicia E. C. Ruiz', 'Inés M. Weinberg', 'Luis Francisco Lozano', 'Marcela de Langhe', 'Santiago Otamendi']);
  assert.equal(persona(a, 'otamendi').suscripcion, 'no_suscribe_por_licencia');
  assert.deepEqual(persona(a, 'langhe').participacion, ['disidencia']);
  assert.equal(a.votacion.estado, 'disidencia_identificada');
  assert.ok(persona(a, 'lozano').participacion.includes('voto_mayoria'));
  assert.ok(!persona(a, 'otamendi').participacion.includes('voto_mayoria'), 'quien no firma no integra la mayoría');
  assert.ok(a.votacion.detalle.some((x) => /deducido de las firmas/.test(x)));
});
