import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(aqui, '../../frontend/index.html'), 'utf8');

function bloqueArray(nombre) {
  const inicio = html.indexOf(`var ${nombre}=[`);
  assert.notEqual(inicio, -1, `existe var ${nombre}`);
  const fin = html.indexOf('\n];', inicio);
  assert.notEqual(fin, -1, `${nombre} termina correctamente`);
  return html.slice(inicio, fin);
}

test('el catálogo manual conserva identificadores únicos y cobertura por ramas válidas', () => {
  const catalogo = bloqueArray('F');
  const ids = [...catalogo.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 125, `se esperaban al menos 125 fuentes; hay ${ids.length}`);
  assert.equal(new Set(ids).size, ids.length, 'no hay identificadores duplicados');

  const ramas = bloqueArray('RAMAS');
  const validas = new Set([...ramas.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]));
  const desconocidas = new Set();
  for (const match of catalogo.matchAll(/\br:"([^"]+)"/g)) {
    if (match[1] === '*') continue;
    for (const rama of match[1].split(',')) if (!validas.has(rama)) desconocidas.add(rama);
  }
  assert.deepEqual([...desconocidas], [], 'toda etiqueta de materia debe usar un id real de RAMAS');
});

test('todos los bloques JavaScript inline de la interfaz compilan', () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter((match) => !/\bsrc\s*=/.test(match[1]) && match[2].trim());
  assert.ok(scripts.length >= 5, 'se encontraron los scripts inline de la aplicación');
  for (const [i, match] of scripts.entries()) {
    assert.doesNotThrow(
      () => new vm.Script(match[2], { filename: 'frontend/index.html#script-' + i }),
      'el bloque inline ' + i + ' debe compilar',
    );
  }
});
test('la interfaz permite ordenar por línea jurídica y no confunde un error con cero fallos', () => {
  assert.ok(html.includes('Por línea jurídica'), 'existe la vista agrupada por línea de investigación');
  assert.ok(!html.includes('Este error no equivale a una búsqueda válida con cero resultados'), 'no se muestran avisos técnicos de fuentes al abogado');
  assert.ok(!html.includes('Un error de acceso o de red no significa que no existan fallos'), 'la interfaz no presenta explicaciones sobre fallas de conexión');
  assert.ok(html.includes('if(im.busco&&im.error)'), 'el estado interno conserva la diferencia entre falla y consulta sin resultados');
  assert.ok(html.includes('return (im.busco&&!im.error&&im.resultados)'), 'una fuente fallida no se transforma en una lista vacía válida');
  const inicioIndice = html.indexOf('var FUENTES_INDICE=[');
  const finIndice = html.indexOf(String.fromCharCode(10) + '];', inicioIndice);
  assert.ok(inicioIndice >= 0 && finIndice > inicioIndice, 'el array de fuentes de búsqueda está bien delimitado');
  const indice = html.slice(inicioIndice, finIndice);
  const slugs = [...indice.matchAll(/slug:"([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(slugs).size, slugs.length, 'no se reutilizan slugs para fuentes directas y vistas SAIJ');
  for (const slug of ['chubut', 'tfn', 'santacruz', 'hudoc', 'chubut_saij', 'santacruz_saij']) {
    assert.ok(slugs.includes(slug), 'buscador ausente: ' + slug);
  }
});

test('los portales directos provinciales y especializados están registrados', () => {
  const obligatorios = [
    'apps1cloud.juschubut.gov.ar',
    'jurisprudencia.juscorrientes.gov.ar',
    'jurbuscador.jusentrerios.gov.ar',
    'www.jusformosa.gob.ar',
    'jurisprudencia.justiciajujuy.gov.ar',
    'www.justiciasalta.gov.ar',
    'jurisprudencia.jussantacruz.gob.ar',
    'jurisprudencia.justucuman.gov.ar',
    'sentencias-corte.scba.gov.ar',
    'juriscivil.jusneuquen.gov.ar',
    'jurispenal.jusneuquen.gov.ar',
    'busquedadictamenes.ptn.gob.ar',
    'www.argentina.gob.ar/tribunalfiscal/jurisprudencia',
    'www.argentina.gob.ar/defensadelacompetencia/buscadores',
  ];
  for (const url of obligatorios) assert.ok(catalogoIncluye(url), `falta ${url}`);
});

function catalogoIncluye(fragmento) {
  return html.includes(fragmento);
}
