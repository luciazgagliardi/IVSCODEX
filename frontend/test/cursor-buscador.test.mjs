import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('el cursor de la barra de Buscar solo se ve al editar', () => {
  assert.match(html, /#q\{caret-color:transparent\}/);
  assert.match(html, /#q:focus\{caret-color:var\(--fg\)\}/);
  assert.match(html, /class="cq"><input type="text" id="q"/);
});

test('al enfocar una búsqueda vacía el ejemplo desaparece y queda la barra vertical', () => {
  assert.match(html, /#q:focus::placeholder\{color:transparent\}/);
  assert.match(html, /#q:focus\{caret-color:var\(--fg\)\}/);
  assert.match(html, /id="q" value="'\+esc\(estado\.q\)\+'" placeholder="daño moral por incumplimiento contractual"/);
});

test('un clic fuera de Buscar desactiva el cursor sin tocar la búsqueda', () => {
  assert.match(html, /document\.addEventListener\("pointerdown",function\(ev\)\{/);
  assert.match(html, /document\.activeElement===q/);
  assert.match(html, /!ev\.target\.closest\("\.cq"\)/);
  assert.match(html, /q\.blur\(\)/);
  assert.match(html, /function buscarEnTodas\(\)/);
});
