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
parentPort.on('message', ({ id, archivo, version, base, q, opciones }) => {
  try {
    if (!db || abierta !== version) {
      try { db?.close(); } catch { /* ya cerrada */ }
      // sólo lectura; si el disco no deja abrirla así (el índice compartido de WAL en un disco de red), común y sin escribir
      try { db = new DatabaseSync(archivo, { readOnly: true }); db.prepare('SELECT 1 FROM fallos LIMIT 1').get(); }
      catch { db = new DatabaseSync(archivo); db.exec('PRAGMA query_only = 1'); }
      abierta = version;
    }
    parentPort.postMessage({ id, r: paginaEn(db, base, q, opciones) });
  } catch (e) {
    parentPort.postMessage({ id, error: e.message });
  }
});
