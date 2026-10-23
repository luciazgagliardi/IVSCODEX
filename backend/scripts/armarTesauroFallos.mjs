/**
 * Arma la colección de «fallos cargados» del tesauro: para cada voz de cada
 * rama (las de RAMAS en frontend/index.html) consulta las bases oficiales que
 * traen el texto del sumario y guarda los principales en
 * frontend/datos/tesauro/<rama>.json, que el sitio abre al instante, sin costo
 * y aunque los sitios oficiales estén caídos.
 *
 *   node scripts/armarTesauroFallos.mjs            (todas las ramas)
 *   node scripts/armarTesauroFallos.mjs dan fam    (sólo esas ramas)
 *   ACTUALIZAR=1 node scripts/armarTesauroFallos.mjs   (vuelve a pedir lo ya guardado)
 *
 * Retoma donde quedó: las voces que ya tienen fallos guardados se saltean.
 * Fuentes: sumarios de SAIJ (todo el país), sumarios de la Corte Suprema (vía
 * SAIJ), SCBA (JUBA) y la Suprema Corte de Mendoza. Hasta 2 fallos por fuente
 * y voz, sólo los que traen texto de sumario.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buscarSaij } from '../lib/indiceSaij.js';
import { buscarScba } from '../lib/indiceScba.js';
import { buscarMza } from '../lib/indiceMza.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.resolve(aqui, '../../frontend');
const SALIDA = path.join(FRONT, 'datos', 'tesauro');
const POR_FUENTE = 2;
const TOPE_TEXTO = 700;

const FUENTES = [
  { cod: 'SAIJ', f: 'saij', buscar: (q) => buscarSaij({ q, modo: 'todas', tribunal: 'sumarios', porPagina: 8 }) },
  { cod: 'CSJN', f: 'csjn', buscar: (q) => buscarSaij({ q, modo: 'todas', soloCsjn: true, porPagina: 8 }) },
  { cod: 'SCBA', f: 'scba', buscar: (q) => buscarScba({ q, modo: 'todas', porPagina: 8 }) },
  { cod: 'SCJM', f: 'mendoza', buscar: (q) => buscarMza({ q, modo: 'todas', tribunal: 'SC', porPagina: 8 }) },
];

async function leerRamas() {
  const html = await fs.readFile(path.join(FRONT, 'index.html'), 'utf8');
  const i = html.indexOf('var RAMAS=[');
  const j = html.indexOf('\n];', i);
  if (i < 0 || j < 0) throw new Error('no encontré RAMAS en index.html');
  // eslint-disable-next-line no-new-func
  return Function(`return ${html.slice(i + 'var RAMAS='.length, j + 2)}`)();
}

const conTope = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('tiempo')), ms))]);
const recortar = (t) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > TOPE_TEXTO ? s.slice(0, TOPE_TEXTO).replace(/\s+\S*$/, '') + ' …' : s;
};

async function fallosDe(voz) {
  const porFuente = await Promise.all(
    FUENTES.map(async (fu) => {
      try {
        const r = await conTope(fu.buscar(voz), 60_000);
        return (r.resultados || [])
          .filter((x) => x && String(x.sumario || '').length >= 80)
          .slice(0, POR_FUENTE)
          .map((x) => ({
            f: fu.f,
            cod: fu.cod,
            car: String(x.caratula || '').slice(0, 220),
            trib: String(x.tribunal || '').slice(0, 120),
            fecha: x.fecha || '',
            txt: recortar(x.sumario),
            link: x.linkFallo || x.linkFicha || null,
          }));
      } catch {
        return [];
      }
    })
  );
  const vistos = new Set();
  return porFuente.flat().filter((x) => !vistos.has(x.txt.slice(0, 80)) && vistos.add(x.txt.slice(0, 80)));
}

const ramas = await leerRamas();
const elegidas = process.argv.slice(2);
await fs.mkdir(SALIDA, { recursive: true });
const t0 = Date.now();
for (const rama of ramas) {
  if (elegidas.length && !elegidas.includes(rama.id)) continue;
  const archivo = path.join(SALIDA, `${rama.id}.json`);
  let previo = { voces: {} };
  try { previo = JSON.parse(await fs.readFile(archivo, 'utf8')); } catch { /* primera vez */ }
  const voces = { ...(previo.voces || {}) };
  for (const voz of rama.v) {
    if (!process.env.ACTUALIZAR && voces[voz]?.length) continue;
    voces[voz] = await fallosDe(voz);
    const min = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`[${min} min] ${rama.id} · ${voz}: ${voces[voz].length} fallos`);
    await fs.writeFile(archivo, JSON.stringify({ rama: rama.id, nombre: rama.n, generado: new Date().toISOString().slice(0, 10), voces }));
  }
}
console.log(`listo en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
process.exit(0);
