/**
 * Una fuente que no respondió no tiene «0 resultados».
 * Se ejecuta la función real de la página (estadoBase), no un patrón de texto.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function extraer(nombre) {
  const ini = html.indexOf(`function ${nombre}(`);
  assert.ok(ini >= 0, `no está ${nombre}`);
  let i = html.indexOf('{', ini), prof = 0;
  for (; i < html.length; i++) { if (html[i] === '{') prof++; else if (html[i] === '}' && --prof === 0) break; }
  return html.slice(ini, i + 1);
}

function entorno(indices) {
  const ctx = { estado: { indices }, esc: (s) => String(s), cuantosDe: (_f, im) => im.total ?? 0 };
  vm.runInNewContext(extraer('estadoBase'), ctx);
  return ctx;
}

test('una base con error muestra «sin respuesta», nunca 0', () => {
  const ctx = entorno({ tsj: { busco: true, error: 'El buscador oficial no respondió a la consulta en vivo.' } });
  const r = ctx.estadoBase({ slug: 'tsj' });
  assert.doesNotMatch(r.t, />0</);
  assert.match(r.t, /sin respuesta/);
  assert.match(r.c, /con-error/);
});

test('el límite de consultas se nombra como tal', () => {
  const ctx = entorno({ scba: { busco: true, error: 'Se alcanzó el límite de consultas seguidas a esta fuente oficial.' } });
  assert.match(ctx.estadoBase({ slug: 'scba' }).t, /límite de consultas/);
});

test('un cero real sigue mostrándose como cero', () => {
  const ctx = entorno({ cat: { busco: true, error: null, total: 0, resultados: [] } });
  assert.match(ctx.estadoBase({ slug: 'cat' }).t, />0</);
});
