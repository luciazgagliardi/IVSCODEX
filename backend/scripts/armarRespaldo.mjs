/**
 * Arma el RESPALDO de fallos de cada base: para cada voz de cada rama (las de
 * RAMAS en frontend/index.html) consulta la base y guarda lo que devuelve en
 * backend/respaldo/<base>.json.gz. Cuando un buscador oficial no responde,
 * lib/indice.js busca también en ese respaldo (además de lo ya guardado por
 * las búsquedas de los usuarios), así la base sigue dando resultados.
 *
 *   node scripts/armarRespaldo.mjs                 (todas las bases)
 *   node scripts/armarRespaldo.mjs saij scba       (sólo esas)
 *   PAGINAS=3 node scripts/armarRespaldo.mjs       (más páginas por voz)
 *   PAUSA_MS=4000 node scripts/armarRespaldo.mjs dialnet   (más despacio)
 *
 * Retoma donde quedó (respaldo/progreso.json). Va de a una consulta por base
 * y respeta la espera de cortesía de cada sitio (esperarTurno en
 * lib/descargador.js): no es un barrido masivo, son las voces del tesauro.
 * Si una base falla seguido (caída o bloqueo) se la deja para otra corrida.
 * También suma lo que ya estaba en el índice local (backend/indice/).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { FUENTES } from '../lib/fuentes.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(aqui, '..');
// DIR_SALIDA=acervo-crudo/respaldo: una cosecha grande va al acervo (scripts/armarAcervo.mjs), no al repositorio
const SALIDA = process.env.DIR_SALIDA ? path.resolve(RAIZ, process.env.DIR_SALIDA) : path.join(RAIZ, 'respaldo');
// cada ronda lleva su propio avance (RONDA=2 → progreso-2.json), así una ronda más honda no saltea lo ya hecho en otra
const RONDA = process.env.RONDA || '';
const PROGRESO = path.join(SALIDA, RONDA ? `progreso-${RONDA}.json` : 'progreso.json');
const INDICE_LOCAL = path.join(RAIZ, 'indice');
const PAGINAS_JURIS = Number(process.env.PAGINAS || 2);
// Corte IDH ya tiene su corpus completo (lib/corpusCorteidh.js).
const BASES = { saij: PAGINAS_JURIS, csjn: PAGINAS_JURIS, scba: PAGINAS_JURIS, caba: PAGINAS_JURIS, mendoza: PAGINAS_JURIS, dialnet: 1, mendozalegal: 1 };
const FALLAS_SEGUIDAS = 6;
// pausa extra entre consultas a una misma base (ms), para los sitios que piden ir más despacio (Dialnet: 503)
const PAUSA_MS = Number(process.env.PAUSA_MS || 0);
const TOPE_SUMARIO = 2500;

async function leerRamas() {
  const html = await fs.readFile(path.join(RAIZ, '..', 'frontend', 'index.html'), 'utf8');
  const i = html.indexOf('var RAMAS=[');
  const j = html.indexOf('\n];', i);
  // eslint-disable-next-line no-new-func
  return Function(`return ${html.slice(i + 'var RAMAS='.length, j + 2)}`)();
}
async function terminosAmplios() {
  const html = await fs.readFile(path.join(RAIZ, '..', 'frontend', 'index.html'), 'utf8');
  const arr = (nombre) => {
    const i = html.indexOf(`var ${nombre}=[`), j = html.indexOf('\n];', i);
    // eslint-disable-next-line no-new-func
    return i < 0 ? [] : Function('TEXTO_OFICIAL', `return ${html.slice(i + nombre.length + 5, j + 2)}`)(new Proxy({}, { get: () => '' }));
  };
  const t = [];
  for (const a of arr('TESAURO')) t.push(a.canonico, ...(a.equivalentes || []), ...(a.relacionados || []));
  for (const r of arr('REQUISITOS')) t.push(r.q || r.n);
  return t.filter(Boolean).map((x) => String(x).toLowerCase());
}
const leerJson = async (f, def) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return def; } };
const conTope = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('tiempo')), ms))]);

/** Lo que se guarda de cada resultado: lo que hace falta para mostrarlo y buscarlo. */
function aRegistro(r) {
  const out = {};
  for (const k of ['id', 'caratula', 'tribunal', 'fecha', 'expediente', 'sumario', 'voces', 'magistrados', 'materia', 'linkFicha', 'linkFallo', 'tipo']) {
    if (r[k] != null && r[k] !== '') out[k] = r[k];
  }
  if (typeof out.sumario === 'string' && out.sumario.length > TOPE_SUMARIO) out.sumario = out.sumario.slice(0, TOPE_SUMARIO).replace(/\s+\S*$/, '') + ' …';
  return out;
}

async function cargarRespaldo(slug) {
  try {
    const crudo = zlib.gunzipSync(await fs.readFile(path.join(SALIDA, `${slug}.json.gz`)));
    const d = JSON.parse(crudo);
    return new Map((d.registros || []).map((r) => [r.id, r]));
  } catch { return new Map(); }
}
const CONTEOS = await leerJson(path.join(SALIDA, 'conteos.json'), {});
async function guardarRespaldo(slug, mapa) {
  const cuerpo = JSON.stringify({ fuente: slug, generado: new Date().toISOString().slice(0, 10), registros: [...mapa.values()] });
  await fs.writeFile(path.join(SALIDA, `${slug}.json.gz`), zlib.gzipSync(cuerpo, { level: 9 }));
  // cuántos hay de cada base, para /estado sin abrir el respaldo. Las bases corren
  // en paralelo: un solo objeto en memoria, así ninguna pisa el conteo de otra
  CONTEOS[slug] = mapa.size;
  await fs.writeFile(path.join(SALIDA, 'conteos.json'), JSON.stringify(CONTEOS));
}

async function armarBase(slug, paginas, voces, progreso) {
  const fuente = FUENTES.find((f) => f.slug === slug);
  if (!fuente) return;
  const mapa = await cargarRespaldo(slug);
  // lo que ya está en el índice local entra también
  const local = await leerJson(path.join(INDICE_LOCAL, `${slug}.json`), { registros: {} });
  for (const r of Object.values(local.registros || {})) if (r?.id && !mapa.has(r.id)) mapa.set(r.id, aRegistro(r));
  const hechas = new Set(progreso[slug] || []);
  let fallas = 0, pausas = 0, nuevas = 0, t0 = Date.now();
  for (const voz of voces) {
    if (hechas.has(voz)) continue;
    let desde = null, ok = true;
    for (let p = 1; p <= paginas; p++) {
      try {
        const r = await conTope(fuente.buscar({ q: voz, modo: 'todas', pagina: p, porPagina: 20, ...(desde !== null ? { desde } : {}) }), 90_000);
        for (const x of r.resultados || []) if (x?.id && !mapa.has(x.id)) { mapa.set(x.id, aRegistro(x)); nuevas++; }
        fallas = 0;
        if (typeof r.siguienteDesde !== 'number') break;
        desde = r.siguienteDesde;
      } catch (e) {
        ok = false; fallas++;
        console.log(`  [${slug}] «${voz}» p${p}: ${String(e.message).slice(0, 90)}`);
        break;
      }
    }
    if (ok) hechas.add(voz);
    if (PAUSA_MS) await new Promise((r) => setTimeout(r, PAUSA_MS));
    progreso[slug] = [...hechas];
    if (hechas.size % 10 === 0 || !ok) {
      await guardarRespaldo(slug, mapa);
      await fs.writeFile(PROGRESO, JSON.stringify(progreso));
    }
    if (fallas >= FALLAS_SEGUIDAS) {
      // un corte de la conexión propia (o del sitio) por un rato: se espera y se sigue, hasta cinco veces
      if (pausas < 5) { pausas++; fallas = 0; console.log(`[${slug}] ${FALLAS_SEGUIDAS} fallas seguidas: espero 2 min (${pausas}/5).`); await new Promise((r) => setTimeout(r, 120_000)); continue; }
      console.log(`[${slug}] sigue fallando: la dejo para otra corrida.`); break;
    }
  }
  await guardarRespaldo(slug, mapa);
  await fs.writeFile(PROGRESO, JSON.stringify(progreso));
  console.log(`[${slug}] listo: ${mapa.size} fallos (${nuevas} nuevos), ${hechas.size}/${voces.length} voces, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

await fs.mkdir(SALIDA, { recursive: true });
const ramas = await leerRamas();
let voces = [...new Set(ramas.flatMap((r) => r.v))];
// TERMINOS=amplio suma las expresiones del tesauro (canónicas, equivalentes y cercanas) y los trámites de Requisitos
if (process.env.TERMINOS === 'amplio') voces = [...new Set(voces.concat(await terminosAmplios()))];
console.log(`${voces.length} términos, hasta ${PAGINAS_JURIS} páginas en jurisprudencia`);
const elegidas = process.argv.slice(2);
const progreso = await leerJson(PROGRESO, {});
// las bases en paralelo (cada una contra su propio sitio); dentro de cada una, de a una consulta
await Promise.all(Object.entries(BASES).filter(([s]) => !elegidas.length || elegidas.includes(s)).map(([s, p]) => armarBase(s, p, voces, progreso)));
console.log('fin');
process.exit(0);
