/**
 * La lectura en voz alta lee lo que se dice, no lo que está escrito. Estas
 * pruebas fijan cómo se dicen las expresiones que más aparecen en los fallos:
 * carátulas (c/, s/), tratamientos (Sra., Sres.), normas (art., inc., ley
 * 24.240), citas (Fallos: 330:3248), fechas, dinero, romanos y siglas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarParaVoz as n, numeroALetras, romanoANumero } from '../lib/vozJuridica.js';

const dice = (entrada, esperado) => assert.equal(n(entrada), esperado);
const contiene = (entrada, fragmento) =>
  assert.ok(n(entrada).toLowerCase().includes(fragmento.toLowerCase()), `«${n(entrada)}» debería contener «${fragmento}»`);

test('números en palabras', () => {
  assert.equal(numeroALetras(0), 'cero');
  assert.equal(numeroALetras(21), 'veintiuno');
  assert.equal(numeroALetras(100), 'cien');
  assert.equal(numeroALetras(101), 'ciento uno');
  assert.equal(numeroALetras(1109), 'mil ciento nueve');
  assert.equal(numeroALetras(24240), 'veinticuatro mil doscientos cuarenta');
  assert.equal(numeroALetras(1000000), 'un millón');
  assert.equal(numeroALetras(2500000), 'dos millones quinientos mil');
  assert.equal(numeroALetras(21000), 'veintiún mil');
  assert.equal(numeroALetras(201000, { fem: true, forma: 'una' }), 'doscientas una mil');
});

test('romanos', () => {
  assert.equal(romanoANumero('XIV'), 14);
  assert.equal(romanoANumero('MCMXC'), 1990);
  assert.equal(romanoANumero('IIII'), null);
  assert.equal(romanoANumero('VX'), null);
});

test('carátulas: c/ y s/ se dicen «contra» y «sobre»', () => {
  dice('GARCÍA, Juan c/ PÉREZ, Pedro s/ daños y perjuicios',
    'García, Juan contra Pérez, Pedro sobre daños y perjuicios');
  contiene('Gómez c/Banco Nación s/ amparo', 'Gómez contra Banco Nación sobre amparo');
  contiene('Pérez vs. Gómez', 'Pérez contra Gómez');
});

test('tratamientos y honoríficos', () => {
  contiene('Sra. Juez', 'señora Juez'.replace('señora', 'Señora'));
  contiene('el Sr. Pérez y la Sra. Gómez', 'el señor Pérez y la señora Gómez');
  contiene('los Sres. Directores', 'los señores Directores');
  contiene('el Dr. Ruiz y la Dra. Soto', 'el doctor Ruiz y la doctora Soto');
  contiene('Solicito a V.S. se sirva', 'Vuestra Señoría');
  contiene('Su Señoría', 'Su Señoría');
  contiene('S.S. resolvió', 'Su Señoría resolvió');
  contiene('J. A. Pérez c/ Gómez', 'J. A. Pérez contra Gómez');
});

test('normas: artículos, incisos, leyes', () => {
  contiene('art. 14 inc. b) de la ley', 'artículo catorce inciso b');
  contiene('arts. 1109 y 1113', 'artículos mil ciento nueve y mil ciento trece');
  contiene('art. 1º', 'artículo primero');
  contiene('art. 14 bis', 'artículo catorce bis');
  contiene('Ley 24.240', 'Ley veinticuatro mil doscientos cuarenta');
  contiene('Ley N° 11.723', 'Ley número once mil setecientos veintitrés');
  contiene('Dec. 1234/2020', 'decreto mil doscientos treinta y cuatro barra dos mil veinte');
  contiene('el art. 75 inc. 22 de la CN', 'artículo setenta y cinco inciso veintidós de la Constitución Nacional');
});

test('la barra se lee «barra»; y/o y las abreviaturas con barra, no', () => {
  contiene('Expte. N° 12345/2019', 'expediente número doce mil trescientos cuarenta y cinco barra dos mil diecinueve');
  contiene('el actor y/o su letrado', 'el actor y o su letrado');
  contiene('domicilio s/n', 'sin número');
  contiene('el 1/3 de la pena', 'un tercio de la pena');
  contiene('los 2/3 de los votos', 'dos tercios');
});

test('citas de la Corte y de revistas', () => {
  contiene('Fallos: 330:3248', 'Fallos, tomo trescientos treinta, página tres mil doscientos cuarenta y ocho');
  contiene('(Fallos 308:1224)', 'tomo trescientos ocho');
  contiene('LL 2004-B', 'La Ley');
  contiene('cfr. op. cit., p. 25 y ss.', 'confróntese obra citada, página veinticinco y siguientes');
  contiene('v.gr. el caso', 'verbigracia el caso');
  contiene('t. IV', 'tomo cuatro');
});

test('fechas, horas y plazos', () => {
  contiene('12/03/2021', 'doce de marzo de dos mil veintiuno');
  contiene('1/3/2021', 'primero de marzo de dos mil veintiuno');
  contiene('el 1 de marzo de 2020', 'primero de marzo de dos mil veinte');
  contiene('el 21 de enero', 'veintiuno de enero');
  contiene('a las 10:30 hs.', 'diez y treinta horas');
  contiene('a las 8:00 hs', 'ocho horas');
});

test('dinero y porcentajes', () => {
  contiene('$ 1.500,50', 'mil quinientos pesos con cincuenta centavos');
  contiene('$1.000.000', 'un millón de pesos');
  contiene('$ 1', 'un peso');
  contiene('U$S 2.500', 'dos mil quinientos dólares estadounidenses');
  contiene('el 10% de interés', 'diez por ciento');
  contiene('el 3,5%', 'tres coma cinco por ciento');
});

test('uno / un / una según lo que sigue', () => {
  contiene('21 años', 'veintiún años');
  contiene('1 vez', 'una vez');
  contiene('31 sentencias', 'treinta y una sentencias');
  contiene('el punto 1.', 'uno.');
});

test('ordinales', () => {
  contiene('1ª instancia', 'primera instancia');
  contiene('2° párrafo', 'segundo párrafo');
  contiene('3ra. Sala', 'tercera Sala');
  contiene('4to. Juzgado', 'cuarto Juzgado');
  contiene('Juzgado N° 5', 'Juzgado número cinco');
});

test('romanos: capítulos, tomos, salas y numeración de considerandos', () => {
  contiene('Sala II', 'Sala segunda');
  contiene('Capítulo IV', 'Capítulo cuatro');
  contiene('siglo XX', 'siglo veinte');
  contiene('Resolvió: I.- Hacer lugar. II) Costas.', 'Resolvió: uno. Hacer lugar. dos. Costas.');
  contiene('III.- Por ello', 'tres. Por ello');
});

test('siglas', () => {
  contiene('la CSJN dijo', 'la Corte Suprema de Justicia de la Nación dijo');
  contiene('el CCyC y el CPCCN', 'el Código Civil y Comercial y el Código Procesal Civil y Comercial de la Nación');
  contiene('ACME S.A.', 'Acme sociedad anónima');
  contiene('FOO S.R.L.', 'Foo sociedad de responsabilidad limitada');
  contiene('C.S.J.N.', 'Corte Suprema de Justicia de la Nación');
  contiene('en la CABA', 'Ciudad Autónoma de Buenos Aires');
  contiene('el DNI', 'documento nacional de identidad');
  contiene('la ley de la LCT', 'Ley de Contrato de Trabajo');
  contiene('violación de los DD.HH.', 'derechos humanos');
  contiene('la Corte IDH', 'Corte Interamericana de Derechos Humanos');
  contiene('C.N.Civ., Sala A', 'Cámara Nacional de Apelaciones en lo Civil');
  contiene('Cám. Nac. Civ.', 'Cámara Nacional de Apelaciones en lo Civil');
});

test('mayúsculas sostenidas se leen como palabras; las siglas sin vocales, deletreadas', () => {
  dice('PÉREZ', 'Pérez');
  dice('XYZ', 'equis ye zeta');
});

test('puntuación: puntos suspensivos, corchetes, guiones, enlaces', () => {
  contiene('la parte [...] sigue', 'la parte, sigue');
  contiene('ver https://www.saij.gob.ar/x', 'enlace web');
  contiene('«entre comillas»', 'entre comillas');
  assert.equal(n('etc.'), 'etcétera.');
  contiene('manzanas, etc.', 'etcétera.');
});

test('texto vacío o raro no rompe', () => {
  assert.equal(n(''), '');
  assert.equal(n(null), '');
  assert.equal(n('   \n  '), '');
  assert.ok(n('1234567890123456789').length > 0);
  assert.equal(n('Artes y oficios'), 'Artes y oficios');
});

test('un renglón cortado no corta la frase; un párrafo sí', () => {
  dice('el actor re-\nclama daños', 'el actor reclama daños');
  contiene('línea uno\nlínea dos', 'línea uno línea dos');
  contiene('Primer párrafo\n\nSegundo párrafo', 'Primer párrafo. Segundo párrafo');
});
