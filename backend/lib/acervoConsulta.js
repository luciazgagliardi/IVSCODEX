/**
 * Las consultas de texto al acervo (lib/acervo.js), sin estado propio: las usa
 * la base abierta del servidor y también el hilo aparte que contesta las
 * páginas de la copia local (lib/acervoHilo.js), para que una búsqueda amplia
 * —«recurso» en SAIJ son 155.000 coincidencias— no frene al servidor entero.
 */

/* La consulta de FTS5: cada palabra por su raíz («indemniz*»), en el modo pedido. */
const VACIAS = new Set('de del la las el los un una unos unas y e o u en al a ante con sin por para que se su sus lo le les es son como mas sobre entre desde hasta segun contra ni no'.split(' '));
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function terminos(s) { return plano(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 2 && !VACIAS.has(w)); }
const raiz = (w) => (w.length > 7 ? w.slice(0, Math.max(5, w.length - 2)) : w);
/*
 * Nombres de magistrados. Buscar «aida kemelmajer» tiene que traer los fallos
 * que firmó, aunque la ficha diga sólo «Kemelmajer Romano Bohm»: si cada
 * palabra buscada es un apellido que figura entre los magistrados (o un nombre
 * de pila), también vale el apellido en el campo de los magistrados.
 * «derecho romano» no: «derecho» no es un apellido de nadie.
 */
const NOMBRES_DE_PILA = new Set(('aida ada adela adriana alberto alejandra alejandro alicia ana andrea angel angela antonio armando beatriz carlos carmen carolina cecilia claudia cristina daniel daniela david diana diego eduardo elena elsa enrique ernesto estela eugenia eva federico fernanda fernando francisco gabriel gabriela graciela guillermo gustavo hector horacio hugo ines irma isabel jaime javier jorge jose josefina juan julia julio laura leonardo lidia lorena lucia luis manuel marcela marcelo marcos maria mariana mario marta martin miguel monica nelly norma oscar pablo patricia pedro rafael raul ricardo roberto rodolfo rosa ruben sandra santiago sergio silvia susana teresa tomas valeria veronica victor').split(' '));
const NO_SON_APELLIDOS = new Set(['autor', 'autores', 'dres', 'dras', 'doctor', 'doctora', 'juez', 'jueza', 'ministro', 'ministra', 'conjuez', 'presidente', 'vocal', 'firmado']);
/** Los apellidos de los magistrados de una base abierta (se calculan una vez por base). */
const apellidosDe = new WeakMap();
export function apellidos(db) {
  if (apellidosDe.has(db)) return apellidosDe.get(db);
  const set = new Set();
  try {
    for (const { magistrados } of db.prepare("SELECT DISTINCT magistrados FROM fallos WHERE magistrados IS NOT NULL AND magistrados <> ''").iterate())
      for (const w of plano(magistrados).split(/[^a-z0-9ñ]+/)) if (w.length >= 3 && !VACIAS.has(w) && !NO_SON_APELLIDOS.has(w)) set.add(w);
  } catch { /* base sin esa columna */ }
  apellidosDe.set(db, set);
  return set;
}
export function consultaFts(q, modo = 'todas', excluir = '', apellidosConocidos = null) {
  const ts = terminos(q);
  if (!ts.length) return null;
  let expr;
  if (modo === 'exacta') expr = `"${ts.join(' ')}"`;
  else expr = ts.map((w) => `"${raiz(w)}"*`).join(modo === 'alguna' ? ' OR ' : ' AND ');
  if (apellidosConocidos && ts.length <= 5) {
    const deApellido = ts.filter((w) => apellidosConocidos.has(w) && !NOMBRES_DE_PILA.has(w));
    if (deApellido.length && ts.every((w) => apellidosConocidos.has(w) || NOMBRES_DE_PILA.has(w)))
      expr = `(${expr}) OR (magistrados : (${deApellido.map((w) => `"${w}"`).join(' OR ')}))`;
  }
  const fuera = terminos(excluir);
  if (fuera.length) expr = `(${expr}) NOT (${fuera.map((w) => `"${raiz(w)}"*`).join(' OR ')})`;
  return expr;
}

/*
 * Qué parte del acervo responde por cada base del buscador. Las provinciales
 * suman lo que SAIJ publica de su provincia (los tribunales locales que SAIJ
 * recoge); la Corte es lo de SAIJ marcado como de la Corte.
 */
export const PROVINCIA_DE_BASE = { mendoza: 'Mendoza', scba: 'Buenos Aires', caba: 'Ciudad Autónoma de Buenos Aires', santafe: 'Santa Fe', rionegro: 'Río Negro' };
/* El selector de tribunal de Mendoza (SC, CC, CT), por el nombre del tribunal que trae cada ficha. */
const TRIBUNAL_DE = { mendoza: { SC: '%SUPREMA%', CC: '%CIVIL%', CT: '%TRABAJO%' } };

/**
 * Una página de resultados de una base, con el total EXACTO de coincidencias
 * (no una muestra) y el cursor de la siguiente: la posición en la lista
 * ordenada por relevancia. El orden es estable (relevancia y, a igualdad, el
 * número de fila), así que pasar de página no repite ni saltea nada. Donde se
 * juntan dos orígenes (Mendoza y lo de SAIJ de Mendoza), los duplicados exactos
 * —la misma carátula, fecha y texto— cuentan una sola vez.
 */
export function paginaEn(db, base, q, { modo = 'todas', excluir = '', anioDesde = null, anioHasta = null, provincia = '', tribunal = '', desde = 0, porPagina = 20 } = {}) {
  const expr = consultaFts(q, modo, excluir, apellidos(db));
  if (!expr) return { total: 0, resultados: [], siguienteDesde: null };
  const prov = PROVINCIA_DE_BASE[base];
  const junta = Boolean(prov && base !== 'saij');
  const marcas = base === 'csjn' ? ['csjn'] : [base, ...(junta ? ['saij'] : [])];
  const args = [`(${expr}) AND (${marcas.map((m) => `marca : zf${m}`).join(' OR ')})`];
  const donde = [];
  if (base === 'csjn') donde.push("(f.corte = 1 OR f.fuente = 'csjn')");
  else if (junta) { donde.push("(f.fuente = ? OR (f.fuente = 'saij' AND f.provincia = ?))"); args.push(base, prov); }
  else { donde.push('f.fuente = ?'); args.push(base); }
  if (anioDesde) { donde.push('f.anio >= ?'); args.push(Number(anioDesde)); }
  if (anioHasta) { donde.push('f.anio <= ?'); args.push(Number(anioHasta)); }
  if (provincia) { donde.push('f.provincia = ?'); args.push(provincia); }
  const trib = TRIBUNAL_DE[base]?.[tribunal];
  if (trib) { donde.push("(f.fuente <> ? OR upper(coalesce(f.tribunal, '')) LIKE ?)"); args.push(base, trib); }
  // MATERIALIZED: bm25() sólo vale dentro de la consulta al índice, y así SQLite no la «aplana» hacia afuera.
  // Si se juntan dos orígenes, una fila por clave: la de mejor relevancia (SQLite devuelve con min() la fila de ese mínimo).
  // Una sola base no repite fichas (el id es único): no hace falta agrupar, que es lo caro en las consultas amplias.
  const coinciden = `SELECT f.rid AS rid, bm25(fts, 4.0, 1.0, 2.0, 0.0, 1.0) AS rel${junta
    ? ", coalesce(lower(trim(f.caratula)), '') || '|' || coalesce(f.fecha, '') || '|' || substr(coalesce(f.sumario, f.id), 1, 80) AS clave" : ''}
    FROM fts JOIN fallos f ON f.rid = fts.rowid WHERE fts MATCH ? AND ${donde.join(' AND ')}`;
  const unicos = junta
    ? `WITH m AS MATERIALIZED (${coinciden}), u AS (SELECT rid, min(rel) AS rel FROM m GROUP BY clave)`
    : `WITH u AS MATERIALIZED (${coinciden})`;
  const pos = Math.max(0, Number(desde) || 0), n = Math.min(100, Math.max(1, Number(porPagina) || 20));
  // el total sale de la misma pasada (count() OVER), sin recorrer el índice dos veces
  const filas = db.prepare(`${unicos} SELECT f.*, count(*) OVER () AS total_ FROM u JOIN fallos f ON f.rid = u.rid ORDER BY u.rel, u.rid LIMIT ? OFFSET ?`).all(...args, n, pos);
  const total = filas.length ? filas[0].total_ : db.prepare(`${unicos} SELECT count(*) AS n FROM u`).get(...args).n;
  const resultados = filas.map((f) => {
    const r = { id: f.id, caratula: f.caratula, tribunal: f.tribunal, fecha: f.fecha, expediente: f.expediente, sumario: f.sumario,
      voces: f.voces ? f.voces.split(' · ') : undefined, magistrados: f.magistrados, materia: f.materia, linkFicha: f.linkFicha, linkFallo: f.linkFallo, tipo: f.tipo, desdeAcervo: true };
    for (const k of Object.keys(r)) if (r[k] == null) delete r[k];
    return r;
  });
  return { total, resultados, siguienteDesde: pos + filas.length < total ? pos + filas.length : null };
}
