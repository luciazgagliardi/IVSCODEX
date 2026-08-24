/**
 * Pruebas del filtro de relevancia (lib/relevancia.js).
 *
 * Es lo que hace que los modos "frase exacta", "todas las palabras" y
 * "alguna palabra" signifiquen algo cuando el buscador oficial no los
 * soporta: Mendoza solo sabe "todas", SAIJ solo sabe "alguna". Se prueba
 * sin salir a internet, con registros armados a mano que tienen la misma
 * forma que los que devuelven los clientes.
 */

import test from 'node:test';
import { raicesDe, palabrasUtiles, filtrarPorModo } from '../lib/relevancia.js';

let ok = 0;
let fallas = 0;
function chk(nombre, condicion, extra) {
  if (condicion) {
    ok++;
    console.log(`  OK  ${nombre}`);
  } else {
    fallas++;
    console.log(`  NO  ${nombre}${extra ? ' :: ' + extra : ''}`);
  }
}

/** Un registro con la forma que arman los clientes de cada fuente. */
function reg(caratula, sumario, voces = []) {
  return { caratula, sumario, voces };
}

test('filtro de relevancia por modo', () => {
  console.log('\n--- palabras y raices de la consulta ---');

  chk(
    'descarta los conectores',
    palabrasUtiles('archivo de la desidia').join(',') === 'archivo,desidia',
    palabrasUtiles('archivo de la desidia').join(',')
  );
  // La ñ se pliega a n igual que las tildes, y a propósito: así "daño" y
  // "dano" encuentran lo mismo, se escriba como se escriba de los dos lados.
  chk('pliega tildes y ñ', palabrasUtiles('daño moral').join(',') === 'dano,moral', palabrasUtiles('daño moral').join(','));
  chk(
    'escrito sin ñ encuentra lo mismo que con ñ',
    filtrarPorModo([reg('X', 'el daño moral sufrido')], { q: 'dano moral', modo: 'todas' }).lista.length === 1
  );
  chk('descarta palabras de menos de 3 letras', palabrasUtiles('a de la el').length === 0);
  chk(
    'pone primero la palabra mas especifica, no la mas corta',
    raicesDe('teoría de la imprevisión')[0] === 'imprev',
    JSON.stringify(raicesDe('teoría de la imprevisión'))
  );
  chk('recorta a la raiz para tolerar la flexion', raicesDe('recobrar')[0] === 'recobr');

  console.log('\n--- modo "frase exacta" ---');

  const conFrase = reg('Un fallo', 'se configuró un archivo desidia por el paso del tiempo');
  const separadas = reg('Otro fallo', 'el archivo del expediente y, por otra parte, la desidia del actor');
  const exacta = filtrarPorModo([conFrase, separadas], { q: 'archivo desidia', modo: 'exacta' }).lista;
  chk('deja el que tiene la frase entera', exacta.includes(conFrase));
  chk(
    'descarta el que tiene las palabras sueltas',
    !exacta.includes(separadas),
    'colo un resultado donde las palabras estaban separadas'
  );

  const conSaltos = reg('Tercero', 'hubo un archivo\n  desidia manifiesta');
  chk(
    'la frase sigue valiendo con saltos de linea o doble espacio en el medio',
    filtrarPorModo([conSaltos], { q: 'archivo desidia', modo: 'exacta' }).lista.length === 1
  );
  chk(
    'la frase no distingue mayusculas ni tildes',
    filtrarPorModo([reg('X', 'el DAÑO MORAL sufrido')], { q: 'daño moral', modo: 'exacta' }).lista.length === 1
  );

  console.log('\n--- modo "todas las palabras" ---');

  const ruido = [
    reg('Dementes no declarados', 'la nulidad de los actos celebrados por los dementes no interdictos'),
    reg('Incapacidad', 'el demente interdicto o de facto, según el art. 473'),
  ];
  const bueno = reg('Interdicto de recobrar', 'los requisitos del interdicto de recobrar exigen acreditar la posesión');
  const todas = filtrarPorModo([...ruido, bueno], { q: 'interdicto de recobrar', modo: 'todas' }).lista;
  chk('deja el que tiene todas las palabras', todas.includes(bueno));
  chk('descarta los que solo comparten una', todas.length === 1, `quedaron ${todas.length}`);

  // Si NINGUNO las tiene todas, se afloja a la palabra que distingue el tema,
  // porque devolver cero habiendo doctrina es peor que traer de mas.
  const soloClave = [
    reg('Imprevisión', 'la excesiva onerosidad sobreviniente permite revisar el contrato por imprevisión'),
    reg('Nada que ver', 'un tema completamente distinto'),
  ];
  const relajado = filtrarPorModo(soloClave, { q: 'teoría de la imprevisión', modo: 'todas' });
  const aflojado = relajado.lista;
  chk('afloja a la palabra especifica antes que devolver cero', aflojado.length === 1, `quedaron ${aflojado.length}`);
  chk('avisa que aflojo, para no hacerlo pasar por coincidencia completa', relajado.aflojado === true);
  chk(
    'con aflojar:false devuelve cero en vez de bajar el liston',
    filtrarPorModo(soloClave, { q: 'teoría de la imprevisión', modo: 'todas', aflojar: false }).lista.length === 0
  );
  chk(
    'no afloja si ya habia coincidencias completas',
    filtrarPorModo([...ruido, bueno], { q: 'interdicto de recobrar', modo: 'todas' }).lista.length === 1
  );

  console.log('\n--- modo "alguna palabra" ---');

  const alguna = filtrarPorModo([...ruido, bueno], { q: 'interdicto recobrar', modo: 'alguna' }).lista;
  chk('deja los que tienen al menos una', alguna.length === 3, `quedaron ${alguna.length}`);
  chk(
    'igual descarta los que no tienen ninguna',
    filtrarPorModo([reg('Ajeno', 'nada que ver con el tema')], { q: 'interdicto recobrar', modo: 'alguna' }).lista.length === 0
  );

  console.log('\n--- palabras excluidas ---');

  const conLaboral = reg('Despido', 'daño moral derivado de un despido sin causa');
  const sinLaboral = reg('Choque', 'daño moral por un accidente de tránsito');
  const excluido = filtrarPorModo([conLaboral, sinLaboral], { q: 'daño moral', modo: 'todas', excluir: 'despido' }).lista;
  chk('saca los que contienen la palabra excluida', !excluido.includes(conLaboral));
  chk('deja los demas', excluido.includes(sinLaboral));

  console.log('\n--- casos borde ---');

  chk('sin palabras aprovechables no filtra nada', filtrarPorModo(ruido, { q: 'de la', modo: 'todas' }).lista.length === 2);
  chk('una lista vacia devuelve vacio', filtrarPorModo([], { q: 'daño moral', modo: 'exacta' }).lista.length === 0);
  chk(
    'busca tambien en las voces, no solo en el sumario',
    filtrarPorModo([reg('Un fallo', 'el texto no la nombra', ['pacto comisorio'])], {
      q: 'pacto comisorio',
      modo: 'todas',
    }).lista.length === 1
  );

  console.log(`\nOK ${ok} · fallas ${fallas}`);
  if (fallas) throw new Error(`${fallas} prueba(s) fallaron`);
});
