import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('todos los rótulos muestran el nombre completo sin la pastilla con sigla', () => {
  assert.match(html, /class="rotulo rotulo-fuente" style="margin-top:0"/);
  assert.doesNotMatch(html, /\.rotulo-fuente::before\s*\{/);
  assert.doesNotMatch(html, /data-cod=/);
  assert.match(html, /class="rotulo rotulo-fuente".*esc\(f\.nombre\)/);
});

test('el catálogo y la comparación también empiezan por el título', () => {
  const ficha = html.slice(html.indexOf('function fichaFuente(f){'), html.indexOf('function listaPorAmbito('));
  assert.match(ficha, /<span class="f-nom">/);
  assert.doesNotMatch(ficha, /<span class="cod /);
  const comp = html.slice(html.indexOf('function tarjetaComparar(f){'), html.indexOf('function tarjetaComparar(f){') + 360);
  assert.match(comp, /var cab='<h4>'\+esc\(f\.nombre\)\+'<\/h4>'/);
  assert.doesNotMatch(comp, /<span class="cod /);
});

test('todas las fuentes oficiales mantienen su nombre y su identidad funcional', () => {
  for (const slug of [
    'mendoza', 'mendozalegal', 'caba', 'csjn', 'saij',
    'dialnet', 'scba', 'juristeca', 'santafe', 'rionegro', 'corteidh'
  ]) {
    assert.match(html, new RegExp('slug:"' + slug + '",cod:"[^"]+",clase:"'));
  }
  assert.match(html, /data-fuente=/);
  assert.match(html, /function panelIndice\(f\)/);
});
