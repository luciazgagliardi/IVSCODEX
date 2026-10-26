/**
 * El hilo aparte que contesta las páginas de la copia local (ver
 * buscarPagina en lib/acervo.js). Abre la misma base sólo para leer: SQLite en
 * modo WAL deja leer acá mientras el servidor escribe lo que traen las
 * búsquedas en vivo. Cuando la base se reemplaza por una versión nueva, la
 * vuelve a abrir.
 */
import { parentPort } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { paginaEn } from './acervoConsulta.js';

let db = null, abierta = null;
parentPort.on('message', ({ id, archivo, version, base, q, opciones, copiaPropia }) => {
  try {
    if (!db || abierta !== version) {
      try { db?.close(); } catch { /* ya cerrada */ }
      // Sólo lectura. Abrirla de otro modo es aceptable únicamente en la copia de lectura del disco local
      // (copiaPropia), que nadie más usa: una segunda conexión con escritura sobre la base del disco de red
      // del servidor la dañó («database disk image is malformed»).
      try { db = new DatabaseSync(archivo, { readOnly: true }); db.prepare('SELECT 1 FROM fallos LIMIT 1').get(); }
      catch (e) {
        if (!copiaPropia) throw e;
        db = new DatabaseSync(archivo); db.exec('PRAGMA query_only = 1');
      }
      abierta = version;
    }
    parentPort.postMessage({ id, r: paginaEn(db, base, q, opciones) });
  } catch (e) {
    parentPort.postMessage({ id, error: e.message });
  }
});
