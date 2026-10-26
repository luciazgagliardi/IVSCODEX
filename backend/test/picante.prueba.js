/**
 * Lo que Lexia contesta cuando la insultan, la piropean o la provocan
 * (frontend/lexia-picante.js), y sobre todo que NO se dispare con consultas
 * de verdad: Lexia recibe preguntas jurídicas por el mismo campo.
 *
 *   node --test test/picante.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { IVSPicante } = require('../../frontend/lexia-picante.js');
const r = (x) => IVSPicante.responder(x);

test('contesta a los insultos, piropos y provocaciones', () => {
  for (const x of [
    'lexia hija de puta', 'Lexi HDP!!', 'la concha de tu madre', 'la puta que te parió', 'me cago en tu vieja',
    'sos una boluda', 'lexia pelotuda', 'che gil', 'qué salame', 'pelotuda', 'idiota', 'gila lexia', 'flor de pelotuda',
    'sos una forra', 'qué forra', 'sos una mierda', 'sos una garca', 'que pesada', 'sos una chanta', 'rompebolas',
    'no servís para nada', 'inútil', 'sos re inútil', 'no entendés un carajo',
    'callate', 'cerrá el orto', 'andate a la mierda', 'andá a lavar los platos', 'me tenés las bolas llenas', 'dejá de joder',
    'chupame un huevo', 'chupame la pija', 'comeme los huevos', 'mal cogida', 'sos una puta', 'atorranta',
    'sos lenta', 'tardás una banda', 'sos una vaga', 'ponete las pilas', 'sos una mentirosa', 'me mentiste',
    'te odio', 'me caés como el orto', 'te amo lexia', 'sos una genia', 'casate conmigo', 'estás soltera?', 'mamita',
    'sos fea', 'sos un bagarto', 'cara de culo', 'sos un bot', 'quién sos',
    'ChatGPT es mejor', 'prefiero gemini', 'te voy a demandar', 'te voy a hacer mierda', 'te desinstalo',
    'jajaja', 'jsjsjs', 'la puta madre', 'carajo',
  ]) assert.ok(r(x), `debía contestar: «${x}»`);
  assert.match(r('lexia hija de puta'), /vieja|madre|familia|litis/i);
});

test('no se dispara con consultas de verdad', () => {
  for (const x of [
    'daño moral por incumplimiento contractual', 'remuneración bruta', 'gasto inútil del estado', 'basura electrónica ley',
    'despido', 'hijos putativos', 'disputa entre hijos', 'fallo sobre amo y señor', 'cuál es el plazo para apelar',
    'me ayudás a calcular intereses', 'necesito fallos de la mejor jurisprudencia de mendoza', 'una norma tan vaga',
    'distribución a prorrata', 'daños causados por un animal', 'responsabilidad del vigilante', 'despido de un vigilante',
    'una rata en el producto', 'impone una pesada carga', 'una densa red de normas', 'trabajador que labura en negro',
    'elaboración de un queso', 'el bebé por nacer', 'el deudor desaparece', 'trámite más rápido', 'el actor hace algo',
    'declaración mentirosa del testigo', 'una pava eléctrica defectuosa', 'mala praxis', 'injurias graves', 'violencia de género',
    'tenencia de estupefacientes', 'abuso sexual con acceso carnal', 'cuota alimentaria', 'dale', 'hola', 'gracias',
    'fiorentino', 'art 245 lct', 'que es el daño punitivo', 'quien es el juez', 'tu vida privada en el art 19',
  ]) assert.equal(r(x), '', `no debía contestar: «${x}» → «${r(x)}»`);
});

test('«sos re puta» y «sos re hija de puta» tienen su respuesta', () => {
  for (const x of ['sos re puta', 'Sos re hija de puta!!', 'lexia sos re hija de puta', 'sos una re puta', 'sos re re puta', 'sos re hdp'])
    assert.equal(r(x), 'Lo único que regalo es jurisprudencia. Ojalá su madre pudiera decir lo mismo.', x);
});

test('no repite la misma respuesta dos veces seguidas', () => {
  let antes = r('callate');
  for (let i = 0; i < 20; i++) { const ahora = r('callate'); assert.notEqual(ahora, antes); antes = ahora; }
});
