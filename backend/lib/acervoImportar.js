/**
 * Arma una base nueva del acervo con las tandas (ver importar en lib/acervo.js),
 * en un hilo aparte: insertar ochocientos mil fallos y armar su índice de texto
 * tarda minutos, y hecho en el hilo del servidor lo dejaba sin atender a nadie.
 * Mientras tanto el servidor sigue contestando con la base anterior.
 */
import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { ESQUEMA, ESQUEMA_V, anioDe } from './acervoConsulta.js';

const { man, dirTandas, nueva } = workerData;

async function sha256Archivo(archivo) {
  const hash = crypto.createHash('sha256');
  for await (const bloque of fs.createReadStream(archivo)) hash.update(bloque);
  return hash.digest('hex');
}

if (!man || !Array.isArray(man.archivos) || !man.archivos.length)
  throw new Error('Manifiesto inválido: no contiene una lista de tandas');
if (new Set(man.archivos).size !== man.archivos.length)
  throw new Error('Manifiesto inválido: contiene tandas duplicadas');
if (man.integridad && (
  man.integridad.algoritmo !== 'sha256' ||
  !man.integridad.archivos || typeof man.integridad.archivos !== 'object'
)) throw new Error('Manifiesto inválido: esquema de integridad desconocido');

let d;
try {
  d = new DatabaseSync(nueva);
} catch (e) {
  throw new Error(`SQLite no puede crear la base temporal ${nueva}: ${e.message}`, { cause: e });
}
d.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;');
d.exec(ESQUEMA);
const ins = d.prepare(`INSERT OR IGNORE INTO fallos(id,fuente,corte,provincia,caratula,tribunal,fecha,anio,expediente,sumario,voces,magistrados,materia,linkFicha,linkFallo,tipo,marca)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const conteos = {};
for (const archivo of man.archivos) {
  // Los manifiestos antiguos siguen siendo válidos. Los nuevos traen SHA-256
  // de cada archivo comprimido y se verifican antes de abrirlo.
  if (path.basename(archivo) !== archivo || !/^[a-z]+-[0-9]+[.]jsonl[.]gz$/.test(archivo))
    throw new Error(`Nombre de tanda inválido en manifiesto: ${archivo}`);
  const ruta = path.join(dirTandas, archivo);
  if (man.integridad) {
    const esperado = man.integridad.archivos[archivo];
    if (!/^[a-f0-9]{64}$/i.test(esperado || ''))
      throw new Error(`Manifiesto sin SHA-256 válido para ${archivo}`);
    const real = await sha256Archivo(ruta);
    if (real !== esperado.toLowerCase())
      throw new Error(`SHA-256 incorrecto para ${archivo}: la tanda está dañada o no corresponde al manifiesto`);
  }

  const entrada = readline.createInterface({ input: fs.createReadStream(ruta).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  d.exec('BEGIN');
  let n = 0, lineaN = 0;
  try {
    for await (const linea of entrada) {
      lineaN++;
      if (!linea.trim()) continue;
      let r;
      try { r = JSON.parse(linea); }
      catch (e) { throw new Error(`JSON inválido en ${archivo}, línea ${lineaN}: ${e.message}`); }
      if (!r || typeof r !== 'object' || Array.isArray(r) ||
          typeof r.id !== 'string' || !r.id.trim() ||
          typeof r.fuente !== 'string' || !r.fuente.trim())
        throw new Error(`Registro sin id o fuente válidos en ${archivo}, línea ${lineaN}`);

      const insercion = ins.run(r.id, r.fuente, r.corte ? 1 : 0, r.provincia || null, r.caratula || null, r.tribunal || null, r.fecha || null, anioDe(r.fecha),
        r.expediente || null, r.sumario || null, Array.isArray(r.voces) ? r.voces.join(' · ') : (r.voces || null), r.magistrados || null, r.materia || null,
        r.linkFicha || null, r.linkFallo || null, r.tipo || null, `zf${r.fuente}${r.corte ? ' zfcsjn' : ''}`);
      if (Number(insercion.changes) !== 1)
        throw new Error(`Documento duplicado (id ${r.id}) en ${archivo}, línea ${lineaN}`);
      conteos[r.fuente] = (conteos[r.fuente] || 0) + 1;
      if (r.corte) conteos.csjn = (conteos.csjn || 0) + 1;
      if (++n % 20000 === 0) { d.exec('COMMIT'); d.exec('BEGIN'); }
    }
    d.exec('COMMIT');
  } catch (e) {
    try { entrada.close(); } catch { /* ya cerrada */ }
    try { d.exec('ROLLBACK'); } catch { /* la transacción pudo estar confirmada */ }
    throw e;
  }
}

// Un manifiesto con conteos es un contrato: publicar menos o más registros
// que los anunciados es un error de integridad, nunca una importación válida.
if (man.conteos && typeof man.conteos === 'object') {
  for (const [fuente, esperado] of Object.entries(man.conteos)) {
    if (!Number.isSafeInteger(esperado) || esperado < 0)
      throw new Error(`Conteo inválido en manifiesto para ${fuente}`);
    const real = conteos[fuente] || 0;
    if (real !== esperado)
      throw new Error(`Conteo de ${fuente} no coincide: manifiesto=${esperado}, importado=${real}`);
  }
  for (const [fuente, real] of Object.entries(conteos)) {
    if (!Object.hasOwn(man.conteos, fuente))
      throw new Error(`La tanda contiene una fuente ausente del manifiesto: ${fuente} (${real})`);
  }
}
d.exec("INSERT INTO fts(fts) VALUES('rebuild')");
// No publicar nunca una base que SQLite o el índice externo FTS5 consideren
// dañados. La comprobación FTS compara también el índice con la tabla fallos.
const integridad = d.prepare('PRAGMA quick_check').all();
if (integridad.length !== 1 || integridad[0].quick_check !== 'ok')
  throw new Error('SQLite importado no superó PRAGMA quick_check');
d.prepare("INSERT INTO fts(fts, rank) VALUES('integrity-check', 1)").run();
// Optimizar FTS5 es una compactación opcional, no un requisito para buscar.
// Hacerla en cada arranque duplicaba trabajo de disco justo en el cuello de
// botella de Azure (/home sobre almacenamiento de red). Los tests garantizan
// que rebuild ya deja el índice funcional.
if (process.env.ACERVO_OPTIMIZAR_FTS === '1')
  d.exec("INSERT INTO fts(fts) VALUES('optimize')");
const meta = d.prepare('INSERT OR REPLACE INTO meta(clave, valor) VALUES(?, ?)');
meta.run('version', man.version);
meta.run('esquema', ESQUEMA_V);
meta.run('conteos', JSON.stringify(conteos));
d.close();
parentPort.postMessage({ conteos });
