/**
 * Cosecha GRANDE de las bases provinciales y de doctrina para el acervo
 * (ver lib/acervo.js y scripts/armarAcervo.mjs): en vez de buscar de a un
 * término, se les pide una consulta tan general que casi todo fallo la
 * cumple («de», «recurso», «sentencia»…) y se pagina hasta el final: cada
 * buscador devuelve el total completo y deja ir de a cien con un cursor.
 * Medido en vivo: Mendoza «de» 34.832 resultados, Santa Fe «recurso» 33.895,
 * SCBA «sentencia» 23.554, Juristeca «daños» 7.472.
 *
 * Usa los mismos clientes que la búsqueda en vivo (lib/fuentes.js), así que
 * lo que baja ya tiene la forma que el acervo espera. Un fallo que aparece en
 * varias consultas (o varias veces) entra una sola vez, por su id.
 *
 * Cortesía: una consulta por vez por sitio, PAUSA_MS entre una y otra (2 s por
 * defecto); si el sitio corta, espera y reintenta, y a la octava vez seguida
 * deja el avance guardado y termina. El avance se guarda: se puede cortar y
 * retomar. Para varios sitios a la vez, un proceso por base.
 *
 *   node scripts/cosecharBases.mjs mendoza
 *   node scripts/cosecharBases.mjs santafe scba juristeca   (de a una, en orden)
 *   TOPE=2000 node scripts/cosecharBases.mjs dialnet        (a lo sumo 2000 por consulta)
 *
 * Queda en acervo-crudo/respaldo/<base>.json.gz, que suma scripts/armarAcervo.mjs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { FUENTES } from '../lib/fuentes.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(aqui, '..', 'acervo-crudo', 'respaldo');
const PAUSA_MS = Number(process.env.PAUSA_MS || 2000);

/* Qué pedirle a cada base. `consultas`: las consultas generales (una vez agotada una, sigue la próxima, que trae lo que la
   anterior no alcanzó); `porPagina`: cuántos por pedido; `extra`: lo que el cliente de esa base además necesita (Mendoza:
   el tribunal, que es una consulta aparte por cada uno); `tope`: cuántos como máximo por consulta (Dialnet corta hacia los 10.000). */
const BASES = {
  mendoza: { porPagina: 50, consultas: ['de', 'sentencia', 'responsabilidad', 'daño', 'despido', 'recurso'], variantes: [{ tribunal: 'SC' }, { tribunal: 'CC' }, { tribunal: 'CT' }] },
  santafe: { porPagina: 30, consultas: ['recurso', 'sentencia', 'daños', 'c/', 'contrato', 'trabajo', 'penal', 'familia'] },
  scba: { porPagina: 20, salto: 10, consultas: ['sentencia', 'recurso', 'daños', 'alimentos', 'contrato', 'trabajo', 'penal'] },
  juristeca: { porPagina: 50, cursorOpaco: true, consultas: ['daños', 'contrato', 'sentencia', 'laboral', 'penal', 'familia', 'alimentos', 'sociedades', 'consumidor'] },
  dialnet: { porPagina: 20, tope: 9000, consultas: ['daños', 'recurso', 'sentencia', 'contrato', 'responsabilidad civil', 'derecho penal', 'derecho laboral', 'derecho de familia', 'proceso civil', 'derecho comercial', 'derecho constitucional', 'derecho administrativo', 'derechos humanos', 'sucesiones', 'consumidor', 'prueba'] },
  mendozalegal: { porPagina: 50, consultas: ['de', 'recurso', 'daños'] },
  rionegro: { porPagina: 20, consultas: ['sentencia', 'recurso', 'daños', 'despido'], variantes: [{ tribunal: 'STJ' }] },
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hoy = () => new Date().toISOString().slice(0, 10);
const leerJson = async (f, def) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return def; } };

async function cargar(base) {
  let contenido;
  try { contenido = await fs.readFile(path.join(DIR, `${base}.json.gz`)); }
  catch (e) { if (e.code === 'ENOENT') return new Map(); throw e; }
  const datos = JSON.parse(zlib.gunzipSync(contenido));
  if (!Array.isArray(datos.registros)) throw new Error(`Respaldo inválido de ${base}: falta registros[]`);
  return new Map(datos.registros.filter((r) => r?.id).map((r) => [r.id, r]));
}
async function guardar(base, mapa) {
  await fs.mkdir(DIR, { recursive: true });
  const destino = path.join(DIR, `${base}.json.gz`);
  await fs.writeFile(`${destino}.tmp`, zlib.gzipSync(JSON.stringify({ fuente: base, generado: hoy(), registros: [...mapa.values()] })));
  await fs.rename(`${destino}.tmp`, destino);
}

async function cosechar(base) {
  const cfg = BASES[base], buscar = FUENTES.find((f) => f.slug === base)?.buscar;
  if (!cfg || !buscar) { console.log(`${base}: no es una base que se cosecha así`); return; }
  const archivoProgreso = path.join(DIR, `progreso-bases-${base}.json`);
  const progreso = await leerJson(archivoProgreso, { hechas: {}, actual: null });
  const mapa = await cargar(base);
  const tope = Number(process.env.TOPE || cfg.tope || Infinity);
  const variantes = cfg.variantes || [{}];
  console.log(`\n=== ${base}: ${mapa.size} ya guardados ===`);
  let ultimo = 0;

  for (const variante of variantes) for (const q of cfg.consultas) {
    const clave = `${q}|${JSON.stringify(variante)}`;
    // Los estados antiguos son números sin prueba de agotamiento; hay que verificarlos de nuevo.
    const finalizada = progreso.hechas[clave];
    if (finalizada && typeof finalizada === 'object' && ['agotado', 'total_alcanzado'].includes(finalizada.motivo)) continue;
    let desde = progreso.actual?.clave === clave ? progreso.actual.desde : 0, total = null, paginas = 0, nuevos = 0, vacias = 0;
    let motivo = null;
    for (;;) {
      let r;
      for (let intento = 1; ; intento++) {
        const falta = ultimo + PAUSA_MS - Date.now();
        if (falta > 0) await dormir(falta);
        ultimo = Date.now();
        try { r = await buscar({ q, modo: 'todas', desde, pagina: paginas + 2, porPagina: cfg.porPagina, ...variante }); break; }
        catch (e) {
          if (intento >= 8) { await guardar(base, mapa); await fs.writeFile(archivoProgreso, JSON.stringify(progreso)); throw new Error(`${base} no responde (${String(e.message).slice(0, 100)}); avance guardado`); }
          const min = Math.min(10, intento * 2);
          console.log(`  ${new Date().toTimeString().slice(0, 8)} ${base} corte (${String(e.message).slice(0, 80)}): espero ${min} min`);
          await dormir(min * 60_000);
        }
      }
      total = r.totalFuente ?? r.total ?? total;
      for (const x of r.resultados || []) if (x?.id && !mapa.has(x.id)) { mapa.set(x.id, Object.fromEntries(Object.entries(x).filter(([, v]) => v != null))); nuevos++; }
      paginas++;
      // sin resultados no es el final (el filtro del cliente puede descartar una página entera, y el cursor de algunos
      // sitios no avanza si una fila no se pudo leer): se sigue de largo, y sólo un buen rato sin nada corta la consulta
      vacias = (r.resultados || []).length ? 0 : vacias + 1;
      const sig = typeof r.siguienteDesde === 'number' && r.siguienteDesde > desde ? r.siguienteDesde : (r.siguienteDesde === null ? null : desde + (cfg.salto || cfg.porPagina));
      if (sig === null) { motivo = 'agotado'; break; }
      if (vacias > 40) { motivo = 'paginas_vacias'; break; }
      if (sig >= tope) { motivo = 'tope'; break; }
      if (typeof total === 'number' && total > 0 && cfg.corteTotal !== false && sig >= total && !cfg.cursorOpaco) { motivo = 'total_alcanzado'; break; }
      desde = sig;
      progreso.actual = { clave, desde };
      if (paginas % 20 === 0) {
        await guardar(base, mapa); await fs.writeFile(archivoProgreso, JSON.stringify(progreso));
        console.log(`  ${new Date().toTimeString().slice(0, 8)} ${base} «${q}» ${JSON.stringify(variante)}: ${desde}/${total ?? '?'} · ${mapa.size} guardados (+${nuevos})`);
      }
    }
    const completa = motivo === 'agotado' || motivo === 'total_alcanzado';
    if (completa) { progreso.hechas[clave] = { nuevos, totalFuente: total, paginas, motivo }; progreso.actual = null; }
    else { progreso.actual = { clave, desde, motivo, totalFuente: total, paginas }; }
    await guardar(base, mapa); await fs.writeFile(archivoProgreso, JSON.stringify(progreso));
    console.log(`  ${base} «${q}» ${JSON.stringify(variante)} ${completa ? 'completa' : 'interrumpida'} (${motivo}): ${total ?? '?'} en el sitio, +${nuevos} nuevos → ${mapa.size}`);
    if (!completa) throw new Error(`${base} «${q}» ${JSON.stringify(variante)} interrumpida (${motivo}); reanudar antes de publicar`);
  }
  console.log(`=== ${base}: terminado, ${mapa.size} en total ===`);
}

const bases = process.argv.slice(2);
if (!bases.length) { console.log('uso: node scripts/cosecharBases.mjs <base>…   (' + Object.keys(BASES).join(', ') + ')'); process.exit(1); }
for (const b of bases) await cosechar(b);
process.exit(0);
