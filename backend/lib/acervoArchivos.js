/**
 * Rutas de SQLite por proceso/ejecución. Dos instancias de Azure nunca deben
 * borrar el mismo archivo temporal mientras compilan el acervo.
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const limpia = version => String(version||'sin-version').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);

export function rutaTemporalImportacion(dir,version,pid=process.pid,identificador=randomUUID()) {
  return path.join(dir,'acervo-'+limpia(version)+'-'+pid+'-'+identificador+'.db.tmp');
}
export function rutaCopiaLectura(dir,version,pid=process.pid) {
  return path.join(dir,'acervo-'+limpia(version)+'-'+pid+'.db');
}
export function rutaCopiaTemporal(dir,version,pid=process.pid,identificador=randomUUID()) {
  return path.join(dir,'acervo-'+limpia(version)+'-'+pid+'-'+identificador+'.db.tmp');
}
