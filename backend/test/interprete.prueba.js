/**
 * El intérprete de consultas vive en el frontend (frontend/index.html), pero
 * su prueba vive acá, con el resto, porque lo que verifica es un invariante
 * que se rompe callado.
 *
 * El invariante: TODA voz que el intérprete sugiere tiene que existir ya en
 * RAMAS. La lista de voces la escribió una abogada y es la autoridad
 * terminológica del proyecto; los PUENTES sólo traducen lo coloquial ("me
 * echaron") a lo que ya está escrito ahí ("indemnización art. 245").
 *
 * Por qué hace falta la prueba: si alguien edita una voz en RAMAS —le corrige
 * una tilde, la renombra, la borra— los puentes que apuntaban a la versión
 * vieja no dan error. Simplemente dejan de sugerir, y nadie se entera hasta
 * que un abogado escribe "me chocaron" y no le aparece nada. Un puente roto
 * no se ve; esta prueba lo hace ver.
 *
 * Se lee el HTML como texto a propósito: el frontend es un archivo suelto sin
 * build ni módulos, y esa autonomía es una garantía del proyecto que no se
 * toca por comodidad de las pruebas.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(AQUI, '..', '..', 'frontend', 'index.html');
const html = readFileSync(INDEX, 'utf8');

let ok = 0;
let fallas = 0;
const bien = (t, d = '') => { ok++; console.log(`  OK  ${t}${d ? ` :: ${d}` : ''}`); };
const mal = (t, d = '') => { fallas++; console.log(`  MAL ${t}${d ? ` :: ${d}` : ''}`); };

/** Las voces del fuero, tal como están escritas en RAMAS. */
function vocesDeRamas() {
  const m = html.match(/var RAMAS=\[([\s\S]*?)\n\];/);
  if (!m) throw new Error('No se encontró el array RAMAS en index.html');
  const ramas = [];
  for (const bloque of m[1].split(/\n\s*\{id:/).filter(Boolean)) {
    const id = (bloque.match(/^"([a-z_]+)"/) || [])[1];
    const listaV = (bloque.match(/v:\[([\s\S]*?)\]\}/) || [])[1] || '';
    const voces = (listaV.match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1));
    if (id && voces.length) ramas.push({ id, voces });
  }
  return ramas;
}

/** Los puentes coloquial → voz, tal como están escritos en el intérprete. */
function puentes() {
  const m = html.match(/var PUENTES = \[([\s\S]*?)\n\];/);
  if (!m) throw new Error('No se encontró el array PUENTES en index.html');
  const salida = [];
  const re = /\{\s*dice:\s*\[[^\]]*\](?:,\s*junto:\s*\[[^\]]*\])?,\s*(?:voz|rama):\s*"([^"]+)"\s*\}/g;
  // Se capturan por separado para poder decir cuál de los dos campos era.
  const reCampo = /(?:voz|rama):\s*"([^"]+)"\s*\}/g;
  const reTipo = /(voz|rama):\s*"[^"]+"\s*\}/g;
  let a; let b;
  while ((a = reCampo.exec(m[1])) && (b = reTipo.exec(m[1]))) {
    salida.push({ tipo: b[1], valor: a[1] });
  }
  return salida;
}

console.log('\n--- intérprete de consultas: puentes contra RAMAS ---');

const ramas = vocesDeRamas();
const todasLasVoces = new Set(ramas.flatMap((r) => r.voces));
const idsDeRamas = new Set(ramas.map((r) => r.id));
const puentesLeidos = puentes();

if (ramas.length >= 20) bien('se leyeron las ramas', `${ramas.length} ramas, ${todasLasVoces.size} voces`);
else mal('se leyeron las ramas', `sólo ${ramas.length} — ¿cambió el formato de RAMAS?`);

if (puentesLeidos.length >= 50) bien('se leyeron los puentes', `${puentesLeidos.length}`);
else mal('se leyeron los puentes', `sólo ${puentesLeidos.length} — ¿cambió el formato de PUENTES?`);

const rotos = puentesLeidos.filter((p) =>
  p.tipo === 'voz' ? !todasLasVoces.has(p.valor) : !idsDeRamas.has(p.valor));

if (rotos.length === 0) {
  bien('todos los puentes apuntan a algo que existe', `${puentesLeidos.length} verificados`);
} else {
  mal('hay puentes rotos', `${rotos.length} de ${puentesLeidos.length}`);
  for (const r of rotos) console.log(`        → ${r.tipo} "${r.valor}" no existe`);
}

// El intérprete no sirve de nada si no está enganchado a la pantalla.
if (html.includes('function interpretarConsulta(')) bien('el intérprete está definido');
else mal('el intérprete está definido');

if (html.includes('tiraSugerencias()+')) bien('la tira de voces se dibuja en Buscar');
else mal('la tira de voces se dibuja en Buscar');

if (html.includes('act==="usar-voz"')) bien('tocar una voz cambia la consulta');
else mal('tocar una voz cambia la consulta');

console.log(`\nOK ${ok} · fallas ${fallas}`);
process.exit(fallas ? 1 : 0);
