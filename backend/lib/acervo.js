/**
 * El ACERVO: la copia propia y grande de las bases (SAIJ casi entero —sus
 * sumarios con texto y las fichas de sus fallos—, más el respaldo de las
 * demás), para que Buscar siga andando aunque un sitio oficial no responda.
 *
 * Son cientos de miles de fallos: no se cargan en memoria como el respaldo
 * (lib/indice.js). Viven en una base SQLite con índice de texto completo
 * (FTS5, sin acentos), en el disco de datos del servidor, y se consulta ahí.
 *
 * De dónde sale: scripts/cosecharSaij.mjs baja SAIJ por tramos y
 * scripts/armarAcervo.mjs lo junta en tandas comprimidas
 * (acervo-datos/<fuente>-NNN.jsonl.gz + manifiesto.json). Esas tandas viajan
 * con el servidor (rama «acervo» del repositorio, ver el flujo de Azure) y,
 * cuando cambia la versión del manifiesto, se importan a la base al arrancar,
 * de fondo: mientras tanto se sigue usando la base anterior o el respaldo.
 *
 * Si este Node no trae SQLite (node:sqlite, desde Node 22.5), el acervo
 * queda apagado y todo sigue como antes.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { DIR_DATOS } from '../config.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const DIR_TANDAS = process.env.DIR_ACERVO_DATOS ? path.resolve(process.env.DIR_ACERVO_DATOS) : path.join(aqui, '..', 'acervo-datos');
const DIR_BASE = process.env.DIR_ACERVO ? path.resolve(process.env.DIR_ACERVO) : path.join(DIR_DATOS, 'acervo');
// lo que el propio servidor cosecha (lib/cosechaCaba.js): un renglón por fallo, y se vuelve a sumar en cada versión nueva
const DIR_COSECHAS = path.join(DIR_BASE, 'cosechas');

let sqlite = null, db = null, estado = { activo: false, version: null, conteos: {}, importando: false, error: null };
async function modulo() {
  if (sqlite !== null) return sqlite;
  try {
    const original = process.emitWarning;
    // node:sqlite avisa que es experimental en cada arranque: no hace falta en el registro
    process.emitWarning = (w, ...r) => (String(w).includes('SQLite') ? undefined : original.call(process, w, ...r));
    sqlite = await import('node:sqlite');
    process.emitWarning = original;
  } catch { sqlite = false; }
  return sqlite;
}

// cambia cuando cambia la estructura de la base: obliga a reimportar aunque las tandas sean las mismas
const ESQUEMA_V = '2';
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS fallos(
  rid INTEGER PRIMARY KEY, id TEXT UNIQUE, fuente TEXT, corte INTEGER DEFAULT 0, provincia TEXT,
  caratula TEXT, tribunal TEXT, fecha TEXT, anio INTEGER, expediente TEXT, sumario TEXT, voces TEXT,
  magistrados TEXT, materia TEXT, linkFicha TEXT, linkFallo TEXT, tipo TEXT, marca TEXT);
CREATE INDEX IF NOT EXISTS fallos_fuente ON fallos(fuente, anio);
CREATE INDEX IF NOT EXISTS fallos_corte ON fallos(corte, anio);
-- «marca»: la base como palabra del índice (zfsaij, zfcsjn…), así el filtro por base lo hace el propio índice
CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(caratula, sumario, voces, marca, content='fallos', content_rowid='rid', tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS meta(clave TEXT PRIMARY KEY, valor TEXT);
`;

function abrir(archivo) {
  const d = new sqlite.DatabaseSync(archivo);
  d.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
  d.exec(ESQUEMA);
  return d;
}
const leerManifiesto = () => { try { return JSON.parse(fs.readFileSync(path.join(DIR_TANDAS, 'manifiesto.json'), 'utf8')); } catch { return null; } };

/** Abre la base que haya y, si las tandas son de otra versión, las importa de fondo. */
export async function prepararAcervo({ esperar = false } = {}) {
  if (!(await modulo())) { estado.error = 'Este Node no trae SQLite (node:sqlite)'; return estado; }
  await fsp.mkdir(DIR_BASE, { recursive: true });
  const actual = path.join(DIR_BASE, 'acervo.db');
  if (!db && fs.existsSync(actual)) {
    try {
      db = abrir(actual);
      const m = db.prepare('SELECT valor FROM meta WHERE clave = ?');
      const deEsquema = m.get('esquema')?.valor === ESQUEMA_V;
      estado = { ...estado, activo: deEsquema, version: deEsquema ? (m.get('version')?.valor || null) : null, conteos: deEsquema ? JSON.parse(m.get('conteos')?.valor || '{}') : {} };
    } catch (e) { estado.error = e.message; db = null; }
  }
  const man = leerManifiesto();
  if (man && man.version !== estado.version && !estado.importando) {
    const tarea = importar(man).catch((e) => { estado.error = `importación: ${e.message}`; estado.importando = false; });
    if (esperar) await tarea;
  }
  return estado;
}

/** Importa las tandas a una base nueva y, al terminar, la pone en lugar de la anterior. */
async function importar(man) {
  estado.importando = true;
  const t0 = Date.now();
  const nueva = path.join(DIR_BASE, `acervo-${man.version}.db.tmp`);
  for (const f of [nueva, `${nueva}-wal`, `${nueva}-shm`]) await fsp.rm(f, { force: true });
  const d = abrir(nueva);
  d.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;');
  const ins = d.prepare(`INSERT OR IGNORE INTO fallos(id,fuente,corte,provincia,caratula,tribunal,fecha,anio,expediente,sumario,voces,magistrados,materia,linkFicha,linkFallo,tipo,marca)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const conteos = {};
  for (const archivo of man.archivos) {
    const entrada = readline.createInterface({ input: fs.createReadStream(path.join(DIR_TANDAS, archivo)).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    d.exec('BEGIN');
    let n = 0;
    for await (const linea of entrada) {
      if (!linea) continue;
      let r; try { r = JSON.parse(linea); } catch { continue; }
      const m = /(\d{4})\s*$/.exec(String(r.fecha || ''));
      ins.run(r.id, r.fuente, r.corte ? 1 : 0, r.provincia || null, r.caratula || null, r.tribunal || null, r.fecha || null, m ? Number(m[1]) : null,
        r.expediente || null, r.sumario || null, Array.isArray(r.voces) ? r.voces.join(' · ') : (r.voces || null), r.magistrados || null, r.materia || null,
        r.linkFicha || null, r.linkFallo || null, r.tipo || null, `zf${r.fuente}${r.corte ? ' zfcsjn' : ''}`);
      conteos[r.fuente] = (conteos[r.fuente] || 0) + 1;
      if (r.corte) conteos.csjn = (conteos.csjn || 0) + 1;
      if (++n % 20000 === 0) { d.exec('COMMIT'); d.exec('BEGIN'); await new Promise((ok) => setImmediate(ok)); }
    }
    d.exec('COMMIT');
  }
  d.exec("INSERT INTO fts(fts) VALUES('rebuild')");
  d.exec("INSERT INTO fts(fts) VALUES('optimize')");
  const meta = d.prepare('INSERT OR REPLACE INTO meta(clave, valor) VALUES(?, ?)');
  meta.run('version', man.version);
  meta.run('esquema', ESQUEMA_V);
  meta.run('conteos', JSON.stringify(conteos));
  d.close();
  // en lugar de la anterior
  const actual = path.join(DIR_BASE, 'acervo.db');
  if (db) { try { db.close(); } catch { /* ya cerrada */ } db = null; }
  for (const f of [`${actual}-wal`, `${actual}-shm`]) await fsp.rm(f, { force: true });
  await fsp.rename(nueva, actual);
  db = abrir(actual);
  estado = { activo: true, version: man.version, conteos, importando: false, error: null, segundos: Math.round((Date.now() - t0) / 1000) };
  await volverASumarCosechas();
  console.log(`[acervo] versión ${man.version}: ${Object.entries(conteos).map(([k, v]) => `${k} ${v}`).join(', ')} (${estado.segundos} s)`);
}

export function estadoAcervo() { return { ...estado }; }

/* ---------- lo cosechado por el servidor ---------- */
const COLUMNAS = 'id,fuente,corte,provincia,caratula,tribunal,fecha,anio,expediente,sumario,voces,magistrados,materia,linkFicha,linkFallo,tipo,marca';
function valores(r) {
  const m = /(\d{4})\s*$/.exec(String(r.fecha || ''));
  return [r.id, r.fuente, r.corte ? 1 : 0, r.provincia || null, r.caratula || null, r.tribunal || null, r.fecha || null, m ? Number(m[1]) : null,
    r.expediente || null, r.sumario || null, Array.isArray(r.voces) ? r.voces.join(' · ') : (r.voces || null), r.magistrados || null, r.materia || null,
    r.linkFicha || null, r.linkFallo || null, r.tipo || null, `zf${r.fuente}${r.corte ? ' zfcsjn' : ''}`];
}
/* Pone (o actualiza) un fallo en la base abierta, con su índice de texto. */
function poner(r) {
  const v = valores(r);
  const ya = db.prepare('SELECT rid, caratula, sumario, voces, marca FROM fallos WHERE id = ?').get(r.id);
  if (ya) {
    db.prepare("INSERT INTO fts(fts, rowid, caratula, sumario, voces, marca) VALUES('delete', ?, ?, ?, ?, ?)").run(ya.rid, ya.caratula, ya.sumario, ya.voces, ya.marca);
    db.prepare(`UPDATE fallos SET (${COLUMNAS}) = (${COLUMNAS.split(',').map(() => '?').join(',')}) WHERE rid = ?`).run(...v, ya.rid);
    db.prepare('INSERT INTO fts(rowid, caratula, sumario, voces, marca) VALUES(?, ?, ?, ?, ?)').run(ya.rid, v[4], v[9], v[10], v[16]);
    return false;
  }
  const rid = db.prepare(`INSERT INTO fallos(${COLUMNAS}) VALUES(${COLUMNAS.split(',').map(() => '?').join(',')})`).run(...v).lastInsertRowid;
  db.prepare('INSERT INTO fts(rowid, caratula, sumario, voces, marca) VALUES(?, ?, ?, ?, ?)').run(rid, v[4], v[9], v[10], v[16]);
  estado.conteos[r.fuente] = (estado.conteos[r.fuente] || 0) + 1;
  return true;
}
/**
 * Suma fallos cosechados por el servidor: quedan en disco (cosechas/<fuente>.jsonl,
 * sobreviven a las versiones nuevas del acervo) y, si la base está abierta, ya se buscan.
 */
export async function agregarAlAcervo(registros) {
  const regs = (registros || []).filter((r) => r?.id && r.fuente);
  if (!regs.length) return 0;
  await fsp.mkdir(DIR_COSECHAS, { recursive: true });
  const porFuente = {};
  for (const r of regs) (porFuente[r.fuente] = porFuente[r.fuente] || []).push(JSON.stringify(r));
  for (const [f, lineas] of Object.entries(porFuente)) await fsp.appendFile(path.join(DIR_COSECHAS, `${f.replace(/[^a-z0-9]/g, '')}.jsonl`), lineas.join('\n') + '\n');
  if (!db || !estado.activo || estado.importando) return 0;
  let nuevos = 0;
  db.exec('BEGIN');
  try { for (const r of regs) if (poner(r)) nuevos++; db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  return nuevos;
}
async function volverASumarCosechas() {
  let archivos = [];
  try { archivos = (await fsp.readdir(DIR_COSECHAS)).filter((a) => a.endsWith('.jsonl')); } catch { return; }
  for (const a of archivos) {
    const entrada = readline.createInterface({ input: fs.createReadStream(path.join(DIR_COSECHAS, a)), crlfDelay: Infinity });
    db.exec('BEGIN');
    for await (const l of entrada) { if (!l) continue; try { poner(JSON.parse(l)); } catch { /* renglón roto */ } }
    db.exec('COMMIT');
  }
}
/** El texto guardado de esos fallos (id → sumario), para los resultados en vivo que llegan sin texto. */
export function textosDe(ids) {
  const lista = [...new Set((ids || []).filter(Boolean))].slice(0, 200);
  if (!db || !estado.activo || !lista.length) return new Map();
  try {
    const filas = db.prepare(`SELECT id, sumario FROM fallos WHERE id IN (${lista.map(() => '?').join(',')}) AND sumario IS NOT NULL AND sumario <> ''`).all(...lista);
    return new Map(filas.map((f) => [f.id, f.sumario]));
  } catch { return new Map(); }
}

/** Los ids que ya están en el acervo, de una base (para no volver a pedir su texto). */
export function idsConTexto(fuente) {
  if (!db || !estado.activo) return new Set();
  return new Set(db.prepare("SELECT id FROM fallos WHERE fuente = ? AND sumario IS NOT NULL AND sumario <> ''").all(fuente).map((x) => x.id));
}
/** ¿El acervo tiene esta base? */
export function acervoTiene(fuente) { return Boolean(db && estado.activo && estado.conteos[fuente]); }

/* La consulta de FTS5: cada palabra por su raíz («indemniz*»), en el modo pedido. */
const VACIAS = new Set('de del la las el los un una unos unas y e o u en al a ante con sin por para que se su sus lo le les es son como mas sobre entre desde hasta segun contra ni no'.split(' '));
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function terminos(s) { return plano(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 2 && !VACIAS.has(w)); }
const raiz = (w) => (w.length > 7 ? w.slice(0, Math.max(5, w.length - 2)) : w);
export function consultaFts(q, modo = 'todas', excluir = '') {
  const ts = terminos(q);
  if (!ts.length) return null;
  let expr;
  if (modo === 'exacta') expr = `"${ts.join(' ')}"`;
  else expr = ts.map((w) => `"${raiz(w)}"*`).join(modo === 'alguna' ? ' OR ' : ' AND ');
  const fuera = terminos(excluir);
  if (fuera.length) expr = `(${expr}) NOT (${fuera.map((w) => `"${raiz(w)}"*`).join(' OR ')})`;
  return expr;
}

/**
 * Busca en el acervo. fuente: 'saij' (todo SAIJ), 'csjn' (la Corte), u otra
 * base del respaldo. Devuelve registros con la forma de los de la búsqueda
 * en vivo, ordenados por relevancia (BM25, la carátula pesa más).
 */
export function buscarEnAcervo(fuente, q, { modo = 'todas', excluir = '', anioDesde = null, anioHasta = null, provincia = '', limite = 400 } = {}) {
  if (!acervoTiene(fuente)) return null;
  const expr = consultaFts(q, modo, excluir);
  if (!expr) return [];
  const donde = ['1 = 1'];
  const args = [`(${expr}) AND marca : zf${String(fuente).replace(/[^a-z0-9]/g, '')}`];
  if (anioDesde) { donde.push('f.anio >= ?'); args.push(Number(anioDesde)); }
  if (anioHasta) { donde.push('f.anio <= ?'); args.push(Number(anioHasta)); }
  if (provincia) { donde.push('f.provincia = ?'); args.push(provincia); }
  args.push(Math.min(2000, Math.max(1, limite)));
  try {
    const filas = db.prepare(`SELECT f.* FROM fts JOIN fallos f ON f.rid = fts.rowid WHERE fts MATCH ? AND ${donde.join(' AND ')}
      ORDER BY bm25(fts, 4.0, 1.0, 2.0, 0.0) LIMIT ?`).all(...args);
    return filas.map((f) => {
      const r = { id: f.id, caratula: f.caratula, tribunal: f.tribunal, fecha: f.fecha, expediente: f.expediente, sumario: f.sumario,
        voces: f.voces ? f.voces.split(' · ') : undefined, magistrados: f.magistrados, materia: f.materia, linkFicha: f.linkFicha, linkFallo: f.linkFallo, tipo: f.tipo, desdeAcervo: true };
      for (const k of Object.keys(r)) if (r[k] == null) delete r[k];
      return r;
    });
  } catch (e) {
    console.warn('[acervo] consulta:', e.message);
    return null;
  }
}
