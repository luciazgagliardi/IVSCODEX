import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VISTAS_PROVINCIALES_SAIJ, provinciaSaijDe } from '../lib/indiceProvincialSaij.js';
import { PROVINCIAS_SAIJ } from '../lib/indiceSaij.js';
import { PROVINCIA_DE_BASE } from '../lib/acervoConsulta.js';
import { FUENTES, consultaDeArticulo } from '../lib/fuentes.js';

const vistas = Object.entries(VISTAS_PROVINCIALES_SAIJ);

test('las 24 jurisdicciones tienen vistas SAIJ válidas, sin slugs duplicados', () => {
  assert.equal(vistas.length, 24);
  const slugs = new Set(FUENTES.map(x => x.slug));
  assert.equal(slugs.size, FUENTES.length, 'ninguna fuente se registra dos veces');
  for (const [slug, provincia] of vistas) {
    assert.ok(PROVINCIAS_SAIJ.includes(provincia), provincia);
    assert.equal(provinciaSaijDe(slug), provincia);
    assert.equal(PROVINCIA_DE_BASE[slug], provincia);
    const f = FUENTES.find(x => x.slug === slug);
    assert.ok(f, slug);
    assert.match(f.nombre, /vía SAIJ/i);
    assert.equal(f.tribunalPorDefecto, 'sumarios');
    assert.equal(typeof f.buscar, 'function');
    assert.equal(consultaDeArticulo(slug, 1741), 'artículo 1741');
  }
  assert.equal(provinciaSaijDe('../cualquier-cosa'), null);
  assert.equal(provinciaSaijDe('chubut'), null, 'Chubut directo usa su propio slug');
  assert.equal(provinciaSaijDe('santacruz'), null, 'Santa Cruz directa usa su propio slug');
  assert.equal(provinciaSaijDe('chubut_saij'), 'Chubut');
  assert.equal(provinciaSaijDe('santacruz_saij'), 'Santa Cruz');
  assert.ok(FUENTES.some(x => x.slug === 'chubut' && /Eureka/.test(x.nombre)));
  assert.ok(FUENTES.some(x => x.slug === 'santacruz' && /Santa Cruz/.test(x.nombre)));
});


test('el diagnóstico en vivo prueba cada fuente registrada una sola vez, incluidas las vistas SAIJ de Chubut y Santa Cruz', () => {
  const diagnostico = fs.readFileSync(new URL('../../ops/diagnosticar-en-vivo.mjs', import.meta.url), 'utf8');
  const bloque = diagnostico.match(/const pruebas = \\[([\\s\\S]*?)\\n\\];/);
  assert.ok(bloque, 'el diagnóstico declara su matriz de pruebas');
  const slugs = [...bloque[1].matchAll(/\\{\\s*slug:\\s*'([^']+)'/g)].map(m => m[1]);
  const esperados = FUENTES.map(f => f.slug).sort();
  assert.equal(slugs.length, esperados.length, 'cada fuente tiene una consulta de humo');
  assert.equal(new Set(slugs).size, slugs.length, 'no se prueba dos veces una fuente por un slug equivocado');
  assert.deepEqual([...slugs].sort(), esperados);
  assert.ok(slugs.includes('chubut_saij'));
  assert.ok(slugs.includes('santacruz_saij'));
  assert.ok(!slugs.includes('chubut_saij') || slugs.includes('chubut'));
  assert.ok(!slugs.includes('santacruz_saij') || slugs.includes('santacruz'));
});

test('el texto y la metadata provincial no se reemplazan por fichas más cortas al fusionar', () => {
  const armar = fs.readFileSync(new URL('../scripts/armarAcervo.mjs', import.meta.url), 'utf8');
  assert.match(armar, /const combinado = \{ \.\.\.ya \}/);
  assert.match(armar, /previo == null \|\| previo === ''/);
  assert.match(armar, /clave === 'sumario'/);
  assert.match(armar, /clave === 'voces'/);
});

test('cosechas SAIJ en las 24 jurisdicciones con progreso y artefactos independientes', () => {
  const script = fs.readFileSync(new URL('../scripts/cosecharSaij.mjs', import.meta.url), 'utf8');
  const workflow = fs.readFileSync(new URL('../../.github/workflows/ampliacion-integral.yml', import.meta.url), 'utf8');
  assert.match(script, /progreso-saij\$\{sufijo\}\.json/);
  assert.match(workflow, /saij_provincial:/);
  assert.match(workflow, /max-parallel: 2/);
  assert.match(workflow, /max-parallel: 4/);
  assert.match(workflow, /needs: \[pruebas, fuentes, saij, saij_provincial, corteidh\]/);
  for (const [slug] of vistas) {
    const cosechaSlug = slug === 'chubut_saij' ? 'chubut' : slug === 'santacruz_saij' ? 'santacruz' : slug;
    assert.match(workflow, new RegExp('slug: ' + cosechaSlug + ','));
  }
  assert.match(workflow, /fuente-saij-\$\{\{ matrix\.slug \}\}/);
});

test('buscador expone las 24 vistas territoriales SAIJ y las distingue de los sitios directos', () => {
  const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');
  for (const [slug, provincia] of vistas) {
    assert.ok(html.includes('slug:"' + slug + '"'), slug);
    assert.ok(html.includes('SAIJ'), slug);
    assert.ok(html.includes('"' + slug + '"'), slug);
    assert.ok(html.includes(provincia), slug);
  }
  const acervo = fs.readFileSync(new URL('../lib/acervo.js', import.meta.url), 'utf8');
  assert.match(acervo, /const origen = territorial \? 'saij' : fuente/);
  assert.match(acervo, /UPDATE fallos SET provincia/);
});
