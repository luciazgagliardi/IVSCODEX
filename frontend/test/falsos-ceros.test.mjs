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

test('copia local en 0 + sitio oficial caído: error, no «sin coincidencias»', () => {
  // Respuesta viva fallida durante una búsqueda que empezó por la copia.
  assert.match(html, /if\(imBusco\.estadoVivo==="error"&&!imBusco\.resultados\.length\)\{\s*imBusco\.error=FALLA_SIN_COPIA;/);
  // Excepción de red durante la misma situación.
  assert.match(html, /if\(imBusco\.porCopia&&!imBusco\.resultados\.length\)\{[^}]*imBusco\.error=FALLA_SIN_COPIA;/);
  // El panel distingue la falla antes de decir «Sin coincidencias».
  const i = html.indexOf('if(!im.resultados.length&&im.estadoVivo==="error")');
  const j = html.indexOf("Sin coincidencias en '+esc(f.nombre)+\n");
  assert.ok(i > 0 && (j < 0 || i < html.indexOf('Pruebe con menos palabras')));
  assert.match(html, /no puede afirmarse que no haya resultados/);
});

test('el contador general dice cuántas bases no respondieron', () => {
  assert.match(html, /en las bases que respondieron · <b>'\+basesSinRespuesta\(vis\)\+'<\/b> sin respuesta/);
});

test('privacidad: los textos dicen lo que la plataforma hace (F-11)', async () => {
  const portada = await readFile(new URL('../portada/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /El Lector opera directamente en su navegador/);
  assert.match(html, /se envían al servidor de la plataforma para extraer el texto: se leen en memoria y no se guardan/);
  assert.match(html, /servicio de síntesis de voz de Microsoft/);
  assert.doesNotMatch(portada, /el archivo que se sube para leerlo en el Lector, y el análisis que realiza Lexia sobre el fallo abierto, se procesan en su navegador/);
  assert.match(portada, /servicio de síntesis de voz de Microsoft/);
});

test('intereses: la tasa elegida no se presenta como obtenida por la plataforma (F-10)', () => {
  assert.match(html, /La plataforma no obtiene ni controla el valor de la tasa/);
  assert.match(html, /valor no obtenido ni verificado por la plataforma/);
});
