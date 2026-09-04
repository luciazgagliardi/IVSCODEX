/**
 * Pruebas de la capa que propone anillos para el tesauro.
 *
 * Ninguna toca la red ni necesita la clave: se le inyecta un cliente falso
 * que devuelve lo que cada caso quiere probar. Eso permite ejercitar los
 * caminos que en producción son caros o imposibles de provocar a mano —una
 * negativa del modelo, una respuesta que no es JSON, un modelo que se
 * contradice— sin gastar un centavo.
 *
 * Lo que se protege acá es la frontera: todo lo que vuelve del modelo es
 * texto de afuera y se trata como tal. Si algo raro llega a la pantalla de
 * una abogada, el bug estuvo en esta capa.
 */

import { leerJSON, normalizar, proponerAnillo, hayModelo } from '../lib/proponerAnillo.js';

let ok = 0;
let fallas = 0;
const bien = (t, d = '') => { ok++; console.log(`  OK  ${t}${d ? ` :: ${d}` : ''}`); };
const mal = (t, d = '') => { fallas++; console.log(`  MAL ${t}${d ? ` :: ${d}` : ''}`); };
const es = (t, a, b) => (JSON.stringify(a) === JSON.stringify(b) ? bien(t) : mal(t, `esperaba ${JSON.stringify(b)}, vino ${JSON.stringify(a)}`));

/** Un cliente falso que contesta lo que le digan. */
const clienteQueDice = (texto, stop_reason = 'end_turn') => ({
  messages: { create: async () => ({ stop_reason, content: [{ type: 'text', text: texto }] }) },
});

console.log('\n--- leer el JSON que vuelve del modelo ---');

es('lee un objeto pelado', leerJSON('{"a":1}'), { a: 1 });
es('lo encuentra envuelto en prosa',
  leerJSON('Claro, acá va:\n{"a":1}\n¿Te sirve?'), { a: 1 });
es('lo encuentra dentro de un bloque de código',
  leerJSON('```json\n{"a":2}\n```'), { a: 2 });
es('devuelve null si no hay JSON', leerJSON('no encontré nada'), null);
es('devuelve null si el JSON está roto', leerJSON('{"a":}'), null);
es('tolera vacío', leerJSON(''), null);

console.log('\n--- normalizar la propuesta ---');

const RAMAS = ['dan', 'lab', 'fam'];

{
  const p = normalizar({
    canonico: 'lucro cesante',
    equivalentes: ['ganancia dejada de percibir', '  ', 'lucro cesante'],
    relacionados: ['pérdida de chance'],
    rama: 'dan', desde: null, nota: 'x', confianza: 0.8,
  }, 'lucro cesante', RAMAS);

  es('saca los vacíos y el término consultado de los equivalentes',
    p.equivalentes, ['ganancia dejada de percibir']);
  es('conserva los relacionados', p.relacionados, ['pérdida de chance']);
  es('acepta una rama válida', p.rama, 'dan');
}

{
  // El caso que más importa: el modelo pone el mismo término en los dos
  // lados. Manda el lado prudente — no puede ser "lo mismo" y "parecido".
  const p = normalizar({
    equivalentes: ['daño extrapatrimonial'],
    relacionados: ['daño extrapatrimonial', 'daño psicológico'],
    confianza: 0.9,
  }, 'daño moral', RAMAS);
  es('un término repetido en los dos lados queda sólo como equivalente',
    [p.equivalentes, p.relacionados], [['daño extrapatrimonial'], ['daño psicológico']]);
}

{
  const p = normalizar({ rama: 'inventada', confianza: 5 }, 'x', RAMAS);
  es('descarta una rama que no existe', p.rama, null);
  es('recorta la confianza al rango 0-1', p.confianza, 1);
}

{
  const p = normalizar({ confianza: 'no es un número' }, 'x', RAMAS);
  es('una confianza ilegible es 0, no NaN', p.confianza, 0);
}

{
  const p = normalizar({}, 'usucapión', RAMAS);
  es('sin canónico, usa el término consultado', p.canonico, 'usucapión');
  es('sin listas, quedan vacías', [p.equivalentes, p.relacionados], [[], []]);
  es('sin nota, queda en null', p.nota, null);
}

{
  const muchos = Array.from({ length: 30 }, (_, i) => `t${i}`);
  const p = normalizar({ equivalentes: muchos }, 'x', RAMAS);
  es('pone un tope a cuántos equivalentes acepta', p.equivalentes.length, 8);
}

console.log('\n--- el camino completo, con un cliente falso ---');

{
  const p = await proponerAnillo('lucro cesante', {
    ramas: RAMAS,
    cliente: clienteQueDice('{"canonico":"lucro cesante","equivalentes":["ganancia dejada de percibir"],"relacionados":[],"rama":"dan","desde":null,"nota":null,"confianza":0.85}'),
  });
  es('devuelve la propuesta normalizada', p.equivalentes, ['ganancia dejada de percibir']);
  es('conserva el término consultado', p.termino, 'lucro cesante');
}

{
  // Una negativa del modelo llega con HTTP 200: si no se mira stop_reason,
  // se lee un contenido vacío como si fuera una respuesta buena.
  let codigo = null;
  try {
    await proponerAnillo('algo', { ramas: RAMAS, cliente: clienteQueDice('', 'refusal') });
  } catch (e) { codigo = e.codigo; }
  es('una negativa del modelo se detecta y no pasa como respuesta vacía',
    codigo, 'MODELO_SE_NEGO');
}

{
  let codigo = null;
  try {
    await proponerAnillo('algo', { ramas: RAMAS, cliente: clienteQueDice('no pienso darte JSON') });
  } catch (e) { codigo = e.codigo; }
  es('una respuesta que no es JSON da un error claro', codigo, 'MODELO_RESPUESTA_ILEGIBLE');
}

{
  let codigo = null;
  try { await proponerAnillo('  ', { cliente: clienteQueDice('{}') }); }
  catch (e) { codigo = e.codigo; }
  es('un término vacío se rechaza antes de gastar una llamada', codigo, 'CONSULTA_VACIA');
}

console.log('\n--- sin clave configurada ---');

es('hayModelo() dice que no', hayModelo(), false);
{
  let codigo = null;
  try { await proponerAnillo('lucro cesante'); } catch (e) { codigo = e.codigo; }
  es('pedir una propuesta sin clave avisa, no explota', codigo, 'MODELO_NO_CONFIGURADO');
}

console.log(`\nOK ${ok} · fallas ${fallas}`);
process.exit(fallas ? 1 : 0);
