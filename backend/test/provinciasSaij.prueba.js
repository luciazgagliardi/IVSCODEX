import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PROVINCIAS_PRIORIZADAS, provinciaSaijDe } from '../lib/indiceProvincialSaij.js';
import { PROVINCIAS_SAIJ } from '../lib/indiceSaij.js';
import { PROVINCIA_DE_BASE } from '../lib/acervoConsulta.js';
import { FUENTES, consultaDeArticulo } from '../lib/fuentes.js';

const vistas = Object.entries(PROVINCIAS_PRIORIZADAS);

test('las seis vistas son facetas provinciales válidas de SAIJ, no fuentes sin origen', () => {
  assert.equal(vistas.length, 6);
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
});

test('el texto y la metadata provincial no se reemplazan por fichas más cortas al fusionar', () => {
  const armar = fs.readFileSync(new URL('../scripts/armarAcervo.mjs', import.meta.url), 'utf8');
  assert.match(armar, /const combinado = \{ \.\.\.ya \}/);
  assert.match(armar, /previo == null \|\| previo === ''/);
  assert.match(armar, /clave === 'sumario'/);
  assert.match(armar, /clave === 'voces'/);
});

test('cosechas SAIJ provinciales con progreso y artefactos independientes', () => {
  const script = fs.readFileSync(new URL('../scripts/cosecharSaij.mjs', import.meta.url), 'utf8');
  const workflow = fs.readFileSync(new URL('../../.github/workflows/ampliacion-integral.yml', import.meta.url), 'utf8');
  assert.match(script, /progreso-saij\$\{sufijo\}\.json/);
  assert.match(workflow, /saij_provincial:/);
  assert.match(workflow, /max-parallel: 2/);
  assert.match(workflow, /needs: \[pruebas, fuentes, saij, saij_provincial\]/);
  for (const [slug] of vistas) assert.match(workflow, new RegExp('slug: ' + slug + ','));
  assert.match(workflow, /fuente-saij-\$\{\{ matrix\.slug \}\}/);
});

test('buscador expone vistas regionales y no las confunde con sitios propios', () => {
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
