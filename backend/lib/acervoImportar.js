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
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { ESQUEMA, ESQUEMA_V, anioDe } from './acervoConsulta.js';

const { man, dirTandas, nueva } = workerData;
const d = new DatabaseSync(nueva);
d.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;');
d.exec(ESQUEMA);
const ins = d.prepare(`INSERT OR IGNORE INTO fallos(id,fuente,corte,provincia,caratula,tribunal,fecha,anio,expediente,sumario,voces,magistrados,materia,linkFicha,linkFallo,tipo,marca)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const conteos = {};
for (const archivo of man.archivos) {
  const entrada = readline.createInterface({ input: fs.createReadStream(path.join(dirTandas, archivo)).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  d.exec('BEGIN');
  let n = 0;
  for await (const linea of entrada) {
    if (!linea) continue;
    let r; try { r = JSON.parse(linea); } catch { continue; }
    ins.run(r.id, r.fuente, r.corte ? 1 : 0, r.provincia || null, r.caratula || null, r.tribunal || null, r.fecha || null, anioDe(r.fecha),
      r.expediente || null, r.sumario || null, Array.isArray(r.voces) ? r.voces.join(' · ') : (r.voces || null), r.magistrados || null, r.materia || null,
      r.linkFicha || null, r.linkFallo || null, r.tipo || null, `zf${r.fuente}${r.corte ? ' zfcsjn' : ''}`);
    conteos[r.fuente] = (conteos[r.fuente] || 0) + 1;
    if (r.corte) conteos.csjn = (conteos.csjn || 0) + 1;
    if (++n % 20000 === 0) { d.exec('COMMIT'); d.exec('BEGIN'); }
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
parentPort.postMessage({ conteos });
