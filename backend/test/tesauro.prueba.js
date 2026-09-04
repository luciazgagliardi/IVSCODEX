/**
 * El tesauro de sinonimia jurídica vive en el frontend (frontend/index.html),
 * junto al resto del vocabulario, pero su prueba vive acá porque lo que
 * verifica son invariantes que se rompen callados.
 *
 * Qué se verifica y por qué cada cosa importa:
 *
 *  1. Un término no puede estar en DOS anillos. Si "amparo" fuera a la vez
 *     equivalente de "acción de amparo" y de otra cosa, la expansión sería
 *     ambigua y elegiría por orden de aparición, que es decir al azar.
 *
 *  2. Equivalentes y relacionados no se pisan dentro del mismo anillo. Un
 *     término no puede ser a la vez "lo mismo" y "parecido pero distinto":
 *     esa contradicción termina mostrando el mismo chip en los dos grupos,
 *     uno de ellos mintiendo.
 *
 *  3. Todo anillo tiene al menos un equivalente. Un anillo sin equivalentes
 *     no expande nada; está de adorno y confunde al que lo lea después.
 *
 *  4. La rama existe en RAMAS. Un anillo que apunte a una rama inventada no
 *     rompe nada visible hoy, pero deja el enganche muerto para cuando se
 *     use.
 *
 * Se lee el HTML como texto a propósito: el frontend es un archivo suelto
 * sin build ni módulos, y esa autonomía es una garantía del proyecto que no
 * se toca por comodidad de las pruebas.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(AQUI, '..', '..', 'frontend', 'index.html'), 'utf8');

let ok = 0;
let fallas = 0;
const bien = (t, d = '') => { ok++; console.log(`  OK  ${t}${d ? ` :: ${d}` : ''}`); };
const mal = (t, d = '') => { fallas++; console.log(`  MAL ${t}${d ? ` :: ${d}` : ''}`); };

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Los anillos, tal como están escritos en el tesauro. */
function anillos() {
  const m = html.match(/var TESAURO=\[([\s\S]*?)\n\];/);
  if (!m) throw new Error('No se encontró el array TESAURO en index.html');
  const salida = [];
  for (const bloque of m[1].split(/\n\s*\{id:/).filter((b) => b.includes('canonico:'))) {
    const uno = (campo) => (bloque.match(new RegExp(`${campo}:"([^"]+)"`)) || [])[1] || null;
    const lista = (campo) => {
      const cru = (bloque.match(new RegExp(`${campo}:\\[([^\\]]*)\\]`)) || [])[1] || '';
      return (cru.match(/"([^"]+)"/g) || []).map((x) => x.slice(1, -1));
    };
    salida.push({
      id: (bloque.match(/^"([a-z0-9-]+)"/) || [])[1],
      canonico: uno('canonico'),
      rama: uno('rama'),
      equivalentes: lista('equivalentes'),
      relacionados: lista('relacionados'),
    });
  }
  return salida;
}

/** Los ids de rama que existen de verdad. */
function ramas() {
  const m = html.match(/var RAMAS=\[([\s\S]*?)\n\];/);
  return new Set(
    m[1].split(/\n\s*\{id:/).filter(Boolean)
      .map((b) => (b.match(/^"([a-z_]+)"/) || [])[1])
      .filter(Boolean)
  );
}

console.log('\n--- tesauro de sinonimia jurídica ---');

const lista = anillos();
const idsDeRamas = ramas();

if (lista.length >= 15) bien('se leyeron los anillos', `${lista.length}`);
else mal('se leyeron los anillos', `sólo ${lista.length} — ¿cambió el formato de TESAURO?`);

// 1 · ningún término en dos anillos
const donde = new Map();
const repetidos = [];
for (const a of lista) {
  for (const t of [a.canonico, ...a.equivalentes]) {
    const k = norm(t);
    if (donde.has(k) && donde.get(k) !== a.id) repetidos.push(`"${t}" está en «${donde.get(k)}» y en «${a.id}»`);
    else donde.set(k, a.id);
  }
}
if (!repetidos.length) bien('ningún término pertenece a dos anillos', `${donde.size} términos únicos`);
else { mal('hay términos en más de un anillo', `${repetidos.length}`); repetidos.forEach((r) => console.log(`        → ${r}`)); }

// 2 · equivalentes y relacionados no se pisan
const cruzados = lista.filter((a) => {
  const eq = new Set([a.canonico, ...a.equivalentes].map(norm));
  return a.relacionados.some((r) => eq.has(norm(r)));
});
if (!cruzados.length) bien('equivalentes y relacionados no se superponen');
else { mal('un término figura como equivalente y como relacionado'); cruzados.forEach((a) => console.log(`        → ${a.id}`)); }

// 3 · todo anillo expande algo
const vacios = lista.filter((a) => !a.equivalentes.length);
if (!vacios.length) bien('todos los anillos tienen al menos un equivalente');
else { mal('hay anillos que no expanden nada'); vacios.forEach((a) => console.log(`        → ${a.id}`)); }

// 4 · las ramas existen
const ramaMala = lista.filter((a) => a.rama && !idsDeRamas.has(a.rama));
if (!ramaMala.length) bien('todos los anillos apuntan a una rama real');
else { mal('hay anillos con una rama inexistente'); ramaMala.forEach((a) => console.log(`        → ${a.id} → "${a.rama}"`)); }

// 5 · ids únicos y presentes
const ids = lista.map((a) => a.id);
if (ids.every(Boolean) && new Set(ids).size === ids.length) bien('los identificadores son únicos y están todos');
else mal('hay identificadores repetidos o vacíos');

// 6 · está enganchado a la pantalla
if (html.includes('function expandir(')) bien('la expansión está definida');
else mal('la expansión está definida');
if (html.includes('tiraEquivalentes()+')) bien('la tira de equivalentes se dibuja en Buscar');
else mal('la tira de equivalentes se dibuja en Buscar');
if (html.includes('act==="usar-equivalente"')) bien('tocar un equivalente cambia la consulta');
else mal('tocar un equivalente cambia la consulta');

console.log(`\nOK ${ok} · fallas ${fallas}`);
process.exit(fallas ? 1 : 0);
