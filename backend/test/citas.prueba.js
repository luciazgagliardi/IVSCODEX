/**
 * Pruebas del verificador de citas (lib/citas.js y lib/verificarCita.js).
 *
 * Dos mitades, las dos sin salir a internet:
 *
 *   1. El lector de citas, que es puro texto: se le pegan citas escritas
 *      como se escriben de verdad —con comillas y sin, con "Expte." y con
 *      "causa nº", con la fecha en números y en palabras— y se controla que
 *      saque los campos correctos y que NO invente los que no están.
 *   2. La verificación, con la búsqueda inyectada (opción "buscar"). Pegarle
 *      a los sitios oficiales desde una prueba automática sería maleducado y
 *      además haría fallar el banco cada vez que un organismo se cae, que es
 *      seguido. Los registros falsos tienen la misma forma que los que
 *      devuelven los clientes de lib/indice*.js.
 *
 * Lo que más importa de todo esto es lo último que se prueba: que un
 * veredicto negativo nunca afirme que la cita es falsa.
 */

import test from 'node:test';
import express from 'express';
import { parsearCita, clasificarTribunal, normalizarExpediente } from '../lib/citas.js';
import { verificarCita } from '../lib/verificarCita.js';
import { router as routerCitas } from '../routes/citas.js';
import { manejadorErrores } from '../routes/extraer.js';

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

/** Un resultado con la forma que arman los clientes de cada fuente. */
function reg(extra) {
  return {
    id: extra.id || 'x1',
    caratula: '',
    sumario: '',
    voces: [],
    expediente: '',
    fecha: '',
    tribunal: '',
    linkFallo: 'https://ejemplo.gob.ar/fallo.pdf',
    linkFicha: null,
    ...extra,
  };
}

/** Una búsqueda de mentira que siempre devuelve la misma lista. */
function buscadorFalso(resultados, espia) {
  return async (slug, args) => {
    if (espia) espia.push({ slug, ...args });
    return { total: resultados.length, resultados };
  };
}

test('lector de citas: qué reconoce y qué no', () => {
  console.log('\n--- colección Fallos de la CSJN ---');

  const csjn = parsearCita('CSJN, Fallos: 340:1084');
  chk('lee tomo y página', csjn.fallos?.tomo === 340 && csjn.fallos?.pagina === 1084, JSON.stringify(csjn.fallos));
  chk('reconoce a la Corte Suprema', csjn.tribunal?.clave === 'csjn', csjn.tribunal?.clave);
  chk('la manda al buscador de la CSJN', csjn.tribunal?.fuente === 'csjn');
  chk(
    'entiende la sigla escrita con puntos',
    parsearCita('C.S.J.N., "Halabi", Fallos: 332:111').tribunal?.clave === 'csjn'
  );
  chk(
    'tolera "Fallos 340:1084" sin dos puntos después de Fallos',
    parsearCita('Fallos 340:1084').fallos?.pagina === 1084
  );
  chk(
    'tolera tomo y página escritos aparte',
    parsearCita('CSJN, Fallos, t. 340, p. 1084').fallos?.tomo === 340,
    JSON.stringify(parsearCita('CSJN, Fallos, t. 340, p. 1084').fallos)
  );

  console.log('\n--- número de expediente ---');

  chk('lee "Expte. 12345/2020"', parsearCita('TSJ CABA, Expte. 12345/2020').expediente === '12345/2020');
  chk('lee "EXP 1234-2020"', parsearCita('EXP 1234-2020').expediente === '1234-2020');
  chk('lee "causa nº 5678/2019"', parsearCita('SCBA, causa nº 5678/2019').expediente === '5678/2019');
  chk(
    'lee el CUIJ de Mendoza suelto',
    parsearCita('SCJM, 13-04785621-9, sentencia').expediente === '13-04785621-9',
    parsearCita('SCJM, 13-04785621-9, sentencia').expediente
  );
  chk(
    'lee el código de fuero pegado al número',
    parsearCita('Cám. Nac. Civ., CIV 12345/2020').expediente === 'CIV 12345/2020',
    parsearCita('Cám. Nac. Civ., CIV 12345/2020').expediente
  );
  // La fecha se parece demasiado a un expediente: si se la lleva, el
  // verificador después compara "12/03/2019" contra números de causa y no
  // encuentra nunca nada.
  chk(
    'no confunde la fecha con el expediente',
    parsearCita('Cám. Nac. Civ., "Pérez c/ Gómez s/ daños", 12/03/2019').expediente === null,
    parsearCita('Cám. Nac. Civ., "Pérez c/ Gómez s/ daños", 12/03/2019').expediente
  );
  chk('descarta un número demasiado corto para identificar algo', parsearCita('Expte. 12').expediente === null);
  chk(
    'compara expedientes sin importar los separadores',
    normalizarExpediente('13-04785621-9') === normalizarExpediente('13/04785621/9')
  );

  console.log('\n--- carátula ---');

  const car = parsearCita('Cám. Nac. Civ., Sala A, "Pérez c/ Gómez s/ daños y perjuicios", 12/03/2019');
  chk('separa actor, demandado y materia', car.caratula?.actor === 'Pérez' && car.caratula?.demandado === 'Gómez', JSON.stringify(car.caratula));
  chk('guarda la materia', car.caratula?.materia === 'daños y perjuicios', car.caratula?.materia);
  const mza = parsearCita('SCJM, expte. 13-04785621-9 "González, María c/ Transportes SA p/ daños"');
  chk('entiende el "p/" que usa Mendoza en vez de "s/"', mza.caratula?.materia === 'daños', mza.caratula?.materia);
  const sinComillas = parsearCita('CNCiv., Sala F, Rodríguez c/ Banco Nación s/ ejecución, 4/8/2021');
  chk(
    'encuentra la carátula aunque no esté entre comillas',
    sinComillas.caratula?.actor === 'Rodríguez' && sinComillas.caratula?.demandado === 'Banco Nación',
    JSON.stringify(sinComillas.caratula)
  );
  // Sin esto, el actor queda como "Sala F Rodríguez" y ningún buscador lo
  // encuentra: el nombre del tribunal se pega adelante del apellido.
  chk(
    'le saca al actor el encabezado del tribunal',
    !/sala|cnciv/i.test(sinComillas.caratula?.actor || ''),
    sinComillas.caratula?.actor
  );
  chk(
    'una carátula sin "c/" queda como actor solo, no se descarta',
    parsearCita('CSJN, "Halabi", 24/02/2009').caratula?.actor === 'Halabi'
  );

  console.log('\n--- fecha ---');

  chk('lee la fecha en números', parsearCita('sent. del 12/03/2019').fecha?.iso === '2019-03-12');
  chk('lee la fecha con guiones', parsearCita('sent. del 3-5-2019').fecha?.iso === '2019-05-03');
  chk(
    'lee la fecha en palabras',
    parsearCita('sentencia del 24 de febrero de 2009').fecha?.iso === '2009-02-24',
    parsearCita('sentencia del 24 de febrero de 2009').fecha?.iso
  );
  chk('acepta "setiembre" además de "septiembre"', parsearCita('7 de setiembre de 2015').fecha?.mes === 9);
  chk('descarta una fecha imposible', parsearCita('CSJN, 45/13/2019, Fallos: 340:1').fecha === null);

  console.log('\n--- a qué tribunal apunta ---');

  chk('TSJ CABA', clasificarTribunal('TSJ CABA, Expte. 1/2020')?.fuente === 'caba');
  chk('SCJM va al buscador de Mendoza', clasificarTribunal('SCJM, Sala I')?.fuente === 'mendoza');
  chk(
    'una Cámara de Mendoza busca en las Cámaras, no en la Corte',
    clasificarTribunal('Cámara Civil de Mendoza')?.tribunalEnFuente === 'CC',
    clasificarTribunal('Cámara Civil de Mendoza')?.tribunalEnFuente
  );
  chk(
    'una Cámara del Trabajo de Mendoza va al fuero laboral',
    clasificarTribunal('Cámara del Trabajo de Mendoza')?.tribunalEnFuente === 'CT'
  );
  // "Cámara Federal de Mendoza" es justicia federal con asiento en la
  // provincia: su jurisprudencia no está en el buscador de la SCJM.
  chk(
    'una Cámara Federal no se confunde con la justicia provincial',
    clasificarTribunal('Cámara Federal de Mendoza')?.clave === 'camara_federal',
    clasificarTribunal('Cámara Federal de Mendoza')?.clave
  );
  // "Suprema Corte" a secas la tienen las dos: si la SCBA no se evaluara
  // antes, media provincia de Buenos Aires se buscaría en la Corte federal.
  chk('la SCBA no se confunde con la CSJN', clasificarTribunal('SCBA, causa 1/2019')?.clave === 'scba');
  chk('las cámaras nacionales van a SAIJ', clasificarTribunal('Cám. Nac. Civ., Sala A')?.fuente === 'saij');
  chk(
    'un tribunal internacional se reconoce pero no tiene dónde buscarse',
    clasificarTribunal('Corte IDH, Caso Fontevecchia')?.fuente === null
  );
  chk('un tribunal que no se reconoce vuelve null, no adivinado', clasificarTribunal('Juzgado de Paz de Tunuyán') === null);

  console.log('\n--- lo que no es una cita ---');

  const nada = parsearCita('hola, ¿cómo andás? esto no es una cita');
  chk('avisa que no es una cita', nada.esCita === false);
  chk('explica por qué', typeof nada.motivo === 'string' && nada.motivo.length > 20);
  chk(
    'no inventa ningún campo',
    !nada.tribunal && !nada.expediente && !nada.fallos && !nada.caratula && nada.palabrasClave.length === 0
  );
  chk('el texto vacío tampoco es una cita', parsearCita('').esCita === false);
  chk('un texto con un solo dato ya cuenta como cita', parsearCita('Expte. 12345/2020').esCita === true);

  console.log(`\nOK ${ok} · fallas ${fallas}`);
  if (fallas) throw new Error(`${fallas} prueba(s) fallaron`);
});

test('verificación de citas contra las fuentes (con la búsqueda simulada)', async () => {
  const antes = fallas;

  const elFallo = reg({
    caratula: 'PEREZ, JUAN CARLOS c/ GOMEZ, LUIS p/ DAÑOS Y PERJUICIOS',
    expediente: 'CIV 12345/2020',
    fecha: '12/03/2019',
    sumario: 'El daño moral no requiere prueba directa. Fallos: 340:1084.',
    voces: ['daño moral'],
  });
  const ajeno = reg({ id: 'x2', caratula: 'LOPEZ c/ ESTADO NACIONAL s/ amparo', expediente: '999/1999', fecha: '01/01/2000' });

  console.log('\n--- coincidencia fuerte: se verifica ---');

  let r = await verificarCita('Cám. Nac. Civ., "Pérez c/ Gómez s/ daños", Expte. CIV 12345/2020', {
    buscar: buscadorFalso([ajeno, elFallo]),
  });
  chk('el expediente exacto alcanza para verificar', r.veredicto === 'verificada', r.veredicto);
  chk('con confianza alta si además coincide la carátula', r.confianza === 'alta', r.confianza);
  chk('devuelve el enlace al documento', r.candidatos[0].link === elFallo.linkFallo);
  chk('dice por qué coincidió', r.candidatos[0].porQue.some((p) => /expediente/.test(p)), JSON.stringify(r.candidatos[0].porQue));
  chk('el fallo correcto queda primero, no el ajeno', r.candidatos[0].caratula === elFallo.caratula);
  chk(
    'aun verificada, pide abrir el documento: que exista no prueba que diga eso',
    /abrí el documento/i.test(r.explicacion),
    r.explicacion
  );

  r = await verificarCita('CSJN, Fallos: 340:1084', { buscar: buscadorFalso([elFallo]) });
  chk('el tomo y página exactos también verifican', r.veredicto === 'verificada', r.veredicto);
  chk(
    'una coincidencia numérica sola no da confianza alta',
    r.confianza === 'media',
    r.confianza
  );

  console.log('\n--- coincidencia por carátula: se verifica, con reservas ---');

  r = await verificarCita('Cám. Nac. Civ., "Pérez c/ Gómez s/ daños y perjuicios", 12/03/2019', {
    buscar: buscadorFalso([ajeno, elFallo]),
  });
  chk('las dos partes de la carátula verifican', r.veredicto === 'verificada', r.veredicto);
  chk('pero nunca con confianza alta sin identificador exacto', r.confianza === 'media', r.confianza);
  chk('y lo dice en la explicación', /sin un identificador exacto/i.test(r.explicacion));

  console.log('\n--- nada convincente: no_encontrada, con cautela ---');

  r = await verificarCita('CSJN, "Rodríguez Fantasma c/ Estado Nacional s/ inventado", Fallos: 399:9999', {
    buscar: buscadorFalso([ajeno]),
  });
  chk('no la da por verificada', r.veredicto === 'no_encontrada', r.veredicto);
  chk('no la da por falsa: no aparece esa palabra', !/\bfalsa\b|\bfalso\b|\binventada\b|\bno existe\b/i.test(r.explicacion), r.explicacion);
  chk('aclara que puede no estar indexada', /no est[áa] indexada|puede no estar indexada/i.test(r.explicacion));
  chk('deja a la vista el alcance de lo que consultó', typeof r.alcance === 'string' && r.alcance.includes('SAIJ'));
  chk('informa qué buscó y dónde', typeof r.consulta === 'string' && r.consulta.length > 0, r.consulta);

  // Encontrado probando contra SAIJ en vivo: un apellido común compartido
  // ("Fernández") más un demandado casi universal ("Estado Nacional") no
  // deberían alcanzar para verificar una carátula inventada — el resto del
  // nombre (Roble, Cayetano) no aparece por ningún lado en el fallo real.
  const homonimoParcial = reg({
    id: 'x4',
    caratula: 'FERNANDEZ, ROQUE BENJAMIN c/ ESTADO NACIONAL (A.N.A) s/ NULIDAD DE RESOLUCION',
    fecha: '06/10/1983',
  });
  r = await verificarCita(
    'CSJN, "Fernández Roble, Cayetano c/ Estado Nacional s/ nulidad de acto administrativo", Fallos: 345:987, 3/6/2018',
    { buscar: buscadorFalso([homonimoParcial]) }
  );
  chk(
    'un apellido compartido con un demandado genérico no verifica al homónimo',
    r.veredicto === 'no_encontrada',
    r.veredicto + ' :: ' + JSON.stringify(r.candidatos[0]?.porQue)
  );

  // Encontrado probando contra CABA en vivo, con nombre y apellido (el caso
  // más común): con dos palabras, "más de la mitad" tiene que exigir las
  // dos. Si solo se exige "la mitad" (que para dos palabras es una nada más)
  // "Fernandez, Roberto" verifica contra cualquier Fernández real que además
  // tenga a GCBA de demandado, que en CABA es casi cualquiera.
  const otroFernandez = reg({
    id: 'x5',
    caratula: 'FERNANDEZ, MARIA LAURA c/ GCBA s/ AMPARO',
    fecha: '10/05/2010',
  });
  r = await verificarCita('TSJ CABA, "Fernandez, Roberto c/ GCBA s/ amparo", Expte. 999999, 1/1/2001', {
    buscar: buscadorFalso([otroFernandez]),
  });
  chk(
    'con nombre y apellido, coincidir solo el apellido (uno de dos) no alcanza',
    r.veredicto === 'no_encontrada',
    r.veredicto + ' :: ' + JSON.stringify(r.candidatos[0]?.porQue)
  );

  const soloRuido = reg({ id: 'x3', caratula: 'GARCIA c/ MUNICIPALIDAD s/ daños', sumario: 'daño moral' });
  r = await verificarCita('CSJN, "Rodríguez c/ Estado s/ daños", Fallos: 399:9999', {
    buscar: buscadorFalso([soloRuido]),
  });
  chk(
    'una coincidencia de palabras sueltas no verifica nada',
    r.veredicto === 'no_encontrada',
    r.veredicto + ' :: ' + JSON.stringify(r.candidatos[0]?.porQue)
  );
  chk('pero igual lista el parecido como pista', r.candidatos.length === 1 && r.candidatos[0].fuerza === 'debil');

  console.log('\n--- no_verificable: cuando no se pudo ni buscar ---');

  r = await verificarCita('hola, ¿cómo andás?', { buscar: buscadorFalso([elFallo]) });
  chk('un texto que no es cita no se verifica', r.veredicto === 'no_verificable', r.veredicto);
  chk('y no se consultó ninguna fuente', r.fuentesConsultadas.length === 0);

  r = await verificarCita('Corte IDH, Caso Fontevecchia y D’Amico vs. Argentina, 29/11/2011', {
    buscar: buscadorFalso([elFallo]),
  });
  chk('un tribunal internacional no se verifica: no hay dónde buscar', r.veredicto === 'no_verificable', r.veredicto);
  chk('y se dice claramente que no se buscó', /no se buscó/i.test(r.explicacion), r.explicacion);

  r = await verificarCita('TSJ CABA, Expte. 12345/2020', {
    buscar: async () => { throw new Error('respuesta 502'); },
  });
  chk(
    'si la fuente está caída NO se responde "no encontrada"',
    r.veredicto === 'no_verificable',
    r.veredicto
  );
  chk('y se dice cuál falló', /502/.test(r.explicacion), r.explicacion);

  console.log('\n--- a qué fuente le pregunta ---');

  let espia = [];
  await verificarCita('TSJ CABA, "Pérez c/ Gómez s/ daños"', { buscar: buscadorFalso([], espia) });
  chk('una cita del TSJ CABA se busca en CABA y en ningún otro lado', espia.length === 1 && espia[0].slug === 'caba', JSON.stringify(espia));

  espia = [];
  await verificarCita('SCJM, Cámara del Trabajo, "Pérez c/ Gómez p/ despido"', { buscar: buscadorFalso([], espia) });
  chk('a Mendoza se le manda además el fuero, que su buscador exige', espia[0]?.slug === 'mendoza' && espia[0]?.tribunal === 'CT', JSON.stringify(espia));
  // Encontrado probando contra Mendoza en vivo: su campo de texto libre no
  // encuentra nombres de partes ni con una sola palabra más (ver la nota en
  // lib/indiceMza.js), así que una carátula tiene que viajar por su campo
  // "partes" —que arma otra SQL, por columna de actor/demandado— y no por
  // "q" a secas.
  chk('y la carátula viaja por el campo "partes" de Mendoza, no por "q" a secas', typeof espia[0]?.partes === 'string' && espia[0].partes.length > 0, JSON.stringify(espia));

  espia = [];
  await verificarCita('CSJN, Fallos: 340:1084', { buscar: buscadorFalso([], espia) });
  chk(
    'una consulta que NO viene de la carátula (tomo y página) no manda "partes"',
    espia[0]?.partes === undefined,
    JSON.stringify(espia)
  );

  espia = [];
  await verificarCita('"Pérez c/ Gómez s/ daños", 12/03/2019', { buscar: buscadorFalso([], espia) });
  chk('sin tribunal reconocido tira una red ancha pero corta (2 fuentes)', espia.length === 2, JSON.stringify(espia.map((e) => e.slug)));

  espia = [];
  await verificarCita('"Pérez c/ Gómez s/ daños y perjuicios"', { buscar: buscadorFalso([], espia) });
  chk(
    'la consulta viaja con los acentos: sin ellos el sitio de CABA da cero',
    /Pérez/.test(espia[0]?.q || ''),
    espia[0]?.q
  );

  console.log(`\nOK ${ok} · fallas ${fallas}`);
  if (fallas > antes) throw new Error(`${fallas - antes} prueba(s) fallaron`);
});

/**
 * La ruta, montada sola.
 *
 * Se arma un express mínimo con el router y el manejador de errores en vez
 * de levantar index.js entero: así la prueba no arranca el servidor de
 * verdad (que se quedaría escuchando y colgaría el banco de pruebas) y, más
 * importante, todos los casos de acá terminan ANTES de salir a la red — no
 * se le manda ni un pedido a ningún sitio oficial por correr los tests.
 */
test('la ruta /api/verificar-cita responde como corresponde', async () => {
  const antes = fallas;

  const app = express();
  app.use(express.json());
  app.use('/api', routerCitas);
  app.use(manejadorErrores);
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  const pedir = async (ruta, cuerpo) => {
    const r = await fetch(base + ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, cuerpo: await r.json() };
  };

  try {
    console.log('\n--- la ruta ---');

    let r = await pedir('/verificar-cita', {});
    chk('sin texto avisa con un código estable', r.cuerpo.codigo === 'CITA_VACIA', r.cuerpo.codigo);
    chk('y con un mensaje en castellano', typeof r.cuerpo.mensaje === 'string' && r.cuerpo.mensaje.length > 20);
    chk('con el estado HTTP correcto', r.estado === 400, String(r.estado));

    r = await pedir('/verificar-cita', { texto: 'x'.repeat(2000) });
    chk('un escrito entero se rechaza en vez de procesarse', r.cuerpo.codigo === 'CITA_DEMASIADO_LARGA', r.cuerpo.codigo);

    // Ninguno de estos dos sale a la red: uno no es cita y el otro es de un
    // tribunal que no está en el catálogo.
    r = await pedir('/verificar-cita', { texto: 'esto no es una cita de nada' });
    chk('un texto cualquiera vuelve 200 con veredicto, no como error', r.estado === 200 && r.cuerpo.veredicto === 'no_verificable', r.estado + ' ' + r.cuerpo.veredicto);
    chk('y trae siempre el alcance de lo que se puede consultar', typeof r.cuerpo.alcance === 'string' && r.cuerpo.alcance.length > 10);
    chk('y la advertencia fija', /no prueba que no exista/i.test(r.cuerpo.advertencia || ''), r.cuerpo.advertencia);

    r = await pedir('/verificar-cita', { texto: 'Corte IDH, Caso Fontevecchia vs. Argentina, 29/11/2011' });
    chk('un tribunal internacional se responde sin buscar', r.cuerpo.veredicto === 'no_verificable', r.cuerpo.veredicto);

    r = await pedir('/leer-cita', { texto: 'CSJN, "Halabi", Fallos: 332:111, 24/02/2009' });
    chk('/leer-cita devuelve los campos sin salir a la red', r.cuerpo.ok && r.cuerpo.campos.fallos.tomo === 332, JSON.stringify(r.cuerpo.campos?.fallos));
  } finally {
    servidor.close();
  }

  console.log(`\nOK ${ok} · fallas ${fallas}`);
  if (fallas > antes) throw new Error(`${fallas - antes} prueba(s) fallaron`);
});
