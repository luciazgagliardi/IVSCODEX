import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('el rótulo usa tipografía regular, color original y vidrio ligero sin alterar su tamaño', () => {
  const panel = html.slice(html.indexOf('function panelIndice(f){'), html.indexOf('function panelIndice(f){') + 1400);
  assert.match(panel, /class="rotulo rotulo-fuente" data-cod=/);
  assert.match(panel, /esc\(f\.cod\)/);
  assert.match(panel, /esc\(f\.nombre\)/);
  const css = html.match(/\.rotulo-fuente::before\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(css, /content:attr\(data-cod\)/);
  assert.match(css, /border:0;outline:0/);
  assert.match(css, /border-radius:999px/);
  assert.match(css, /backdrop-filter:blur\(14px\)/);
  assert.doesNotMatch(css, /border:1px|outline:1px/);
  assert.match(css, /height:36px;padding:0 17px/);
  assert.match(css, /font:400 11px\/1 var\(--sans\);letter-spacing:-\.02em/);
  assert.match(css, /color-mix\(in srgb,var\(--punto,var\(--gold\)\) 8%,transparent\)/);
  assert.match(css, /color-mix\(in srgb,var\(--punto,var\(--gold\)\) 42%,var\(--fg\)\)/);
  assert.match(css, /rgba\(var\(--tx\),\.065\)/);
  assert.match(html, /\.marca2\{[^}]*font:600 16px\/1 var\(--sans\);letter-spacing:-\.02em/);
  assert.match(html, /\.rotulo-fuente::before\{height:32px;padding:0 14px;font-size:10px\}/);
});

test('catálogo y comparación vuelven a mostrar sus pastillas originales, sin contorno', () => {
  const catalogo = html.slice(html.indexOf('function fichaFuente(f){'), html.indexOf('function listaPorAmbito('));
  assert.match(catalogo, /class="cod fuente-vidrio /);
  assert.match(catalogo, /esc\(f\.a\.toUpperCase\(\)\)/);
  const comparacion = html.slice(html.indexOf('function tarjetaComparar(f){'), html.indexOf('function tarjetaComparar(f){') + 480);
  assert.match(comparacion, /class="cod fuente-vidrio /);
  assert.match(comparacion, /esc\(f\.cod\)/);
  assert.match(comparacion, /esc\(f\.nombre\)/);
  const css = html.match(/\.cod\.fuente-vidrio\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(css, /border:0;outline:0/);
  assert.match(css, /backdrop-filter:blur\(14px\)/);
  assert.match(css, /rgba\(var\(--tx\)/);
  assert.match(css, /padding:6px 14px/);
  assert.match(css, /font:400 11px\/1\.1 var\(--sans\);letter-spacing:-\.02em/);
  assert.match(css, /color-mix\(in srgb,var\(--punto,var\(--gold\)\) 8%,transparent\)/);
  assert.match(comparacion, /class="cod fuente-vidrio f-'/);
  assert.match(html, /\.cod\.fuente-vidrio\.mza\{--punto:var\(--f-mendoza\)\}/);
  assert.match(html, /\.cod\.fuente-vidrio\.int\{--punto:var\(--verde\)\}/);
});

test('las 11 bases conservan nombres, siglas, tonos originales y funcionalidades', () => {
  for (const slug of ['mendoza','mendozalegal','caba','csjn','saij',
    'dialnet','scba','juristeca','santafe','rionegro','corteidh']) {
    assert.match(html, new RegExp('slug:"' + slug + '",cod:"[^"]+",clase:"'));
  }
  for (const slug of ['mendoza','mendozalegal','caba','csjn','saij',
    'dialnet','scba','juristeca','santafe','rionegro','corteidh']) {
    assert.match(html, new RegExp('\\.f-' + slug + '\\{--punto:var\\(--f-' + slug + '\\)\\}'));
  }
  assert.match(html, /data-fuente=/);
  assert.match(html, /function panelIndice\(f\)/);
});
