/**
 * Las consultas de texto al acervo (lib/acervo.js), sin estado propio: las usa
 * la base abierta del servidor y también el hilo aparte que contesta las
 * páginas de la copia local (lib/acervoHilo.js), para que una búsqueda amplia
 * —«recurso» en SAIJ son 155.000 coincidencias— no frene al servidor entero.
 */


// cambia cuando cambia la estructura de la base: obliga a reimportar aunque las tandas sean las mismas
export const ESQUEMA_V = '3'; // 3: los magistrados (y los autores de Dialnet) también en el índice de texto
export const ESQUEMA = `
CREATE TABLE IF NOT EXISTS fallos(
  rid INTEGER PRIMARY KEY, id TEXT UNIQUE, fuente TEXT, corte INTEGER DEFAULT 0, provincia TEXT,
  caratula TEXT, tribunal TEXT, fecha TEXT, anio INTEGER, expediente TEXT, sumario TEXT, voces TEXT,
  magistrados TEXT, materia TEXT, linkFicha TEXT, linkFallo TEXT, tipo TEXT, marca TEXT);
CREATE INDEX IF NOT EXISTS fallos_fuente ON fallos(fuente, anio);
CREATE INDEX IF NOT EXISTS fallos_corte ON fallos(corte, anio);
-- «marca»: la base como palabra del índice (zfsaij, zfcsjn…), así el filtro por base lo hace el propio índice
CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(caratula, sumario, voces, marca, magistrados, content='fallos', content_rowid='rid', tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS meta(clave TEXT PRIMARY KEY, valor TEXT);
`;

/** El año de una fecha: «27/07/2026 - Sentencia», «2026-07-27», «julio de 2026». */
export function anioDe(fecha) {
  const t = String(fecha || '');
  const dmy = /\b\d{1,2}[/.-]\d{1,2}[/.-]((?:18|19|20)\d{2})\b/.exec(t) || /\b((?:18|19|20)\d{2})-\d{2}-\d{2}\b/.exec(t);
  if (dmy) return Number(dmy[1]);
  const sueltos = t.match(/\b(?:18|19|20)\d{2}\b/g);
  return sueltos ? Number(sueltos[sueltos.length - 1]) : null;
}

/** ¿El índice de esta base ya tiene la columna de magistrados (esquema 3)? Una base anterior sigue sirviendo mientras se arma la nueva. */
const conMagistrados = new WeakMap();
export function ftsConMagistrados(db) {
  if (!conMagistrados.has(db)) {
    let si = true;
    try { db.prepare('SELECT magistrados FROM fts LIMIT 0').all(); } catch { si = false; }
    conMagistrados.set(db, si);
  }
  return conMagistrados.get(db);
}

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
export const PROVINCIA_DE_BASE = {
  mendoza: 'Mendoza', scba: 'Buenos Aires', caba: 'Ciudad Autónoma de Buenos Aires',
  santafe: 'Santa Fe', rionegro: 'Río Negro', catamarca: 'Catamarca',
  cordoba: 'Córdoba', entrerrios: 'Entre Ríos', neuquen: 'Neuquén',
  tucuman: 'Tucumán', chaco: 'Chaco', corrientes: 'Corrientes',
  buenosaires: 'Buenos Aires', caba_saij: 'Ciudad Autónoma de Buenos Aires',
  catamarca_saij: 'Catamarca', chubut_saij: 'Chubut', formosa: 'Formosa',
  jujuy_saij: 'Jujuy', lapampa: 'La Pampa', larioja: 'La Rioja',
  mendoza_saij: 'Mendoza', misiones: 'Misiones', rionegro_saij: 'Río Negro',
  salta: 'Salta', sanjuan: 'San Juan', sanluis: 'San Luis',
  santacruz_saij: 'Santa Cruz', santafe_saij: 'Santa Fe',
  santiagodelestero: 'Santiago del Estero', tierradelfuego: 'Tierra del Fuego'
};
/* El selector de tribunal de Mendoza (SC, CC, CT), por el nombre del tribunal que trae cada ficha. */
const TRIBUNAL_DE = { mendoza: { SC: '%SUPREMA%', CC: '%CIVIL%', CT: '%TRABAJO%' } };
/* Los «tipos» de SAIJ (sumarios, fallos, doctrina…): lo que el acervo guarda de SAIJ es sólo jurisprudencia, en sumarios y fallos. */
const TIPO_SAIJ = { sumarios: ['sumario'], fallos: ['fallo'], todo: ['sumario', 'fallo'] };

/**
 * Una página de resultados de una base, con el total EXACTO de coincidencias
 * (no una muestra) y el cursor de la siguiente: la posición en la lista
 * ordenada por relevancia. El orden es estable (relevancia y, a igualdad, el
 * número de fila), así que pasar de página no repite ni saltea nada. Donde se
 * juntan dos orígenes (Mendoza y lo de SAIJ de Mendoza), los duplicados exactos
 * —la misma carátula, fecha y texto— cuentan una sola vez.
 */
export function paginaEn(db, base, q, { modo = 'todas', excluir = '', anioDesde = null, anioHasta = null, provincia = '', tribunal = '', variantes = [], desde = 0, porPagina = 20, rapida = false, soloConteo = false } = {}) {
  const mag = ftsConMagistrados(db);
  // Calcular todos los apellidos obliga a recorrer la tabla completa (cientos
  // de miles de filas). No hacerlo en cada primera búsqueda temática de cada
  // hilo: sólo se necesita para expandir consultas con un nombre de pila.
  // La búsqueda normal sigue incluyendo magistrados en FTS5.
  const ts = terminos(q);
  const tieneNombreDePila = ts.length <= 5 && ts.some((w) => NOMBRES_DE_PILA.has(w));
  const principal = consultaFts(q, modo, excluir, mag && tieneNombreDePila ? apellidos(db) : null);
  if (!principal) return { total: 0, resultados: [], siguienteDesde: null };

  // La búsqueda local debe conservar las mismas formas equivalentes que la
  // consulta en vivo, cualquiera sea la fuente. Si se omiten, una caída del
  // origen reduce la cobertura justo cuando entra en juego el acervo.
  // Un único MATCH combinado mantiene total, ranking, deduplicación y cursor
  // coherentes; concatenar páginas de búsquedas distintas rompería todo eso.
  const equivalentes = Array.isArray(variantes)
    ? [...new Set(variantes.filter((v) => typeof v === 'string' && v.trim().length <= 100 && v.trim())
      .map((v) => v.trim()).filter((v) => v.toLowerCase() !== String(q).trim().toLowerCase()))].slice(0, 4)
    : [];
  const expresiones = [principal, ...equivalentes.map((v) => consultaFts(v, modo, excluir, null)).filter(Boolean)];
  const expr = expresiones.length === 1 ? principal : expresiones.map((x) => `(${x})`).join(' OR ');
  const prov = PROVINCIA_DE_BASE[base];
  const junta = Boolean(prov && base !== 'saij');
  // SAIJ publica el mismo sumario con más de un id, y Mendoza o la SCBA un renglón por sumario de cada fallo: se cuenta una sola vez
  // el filtro de tipo (sumarios / fallos / doctrina…) de SAIJ: la copia no tiene doctrina, legislación ni dictámenes, y no debe contestar con otra cosa
  if ((base === 'saij' || base === 'csjn') && !tribunal) tribunal = 'todo'; // fallos primero; sumarios de respaldo
  const tiposSaij = (base === 'saij' || base === 'csjn') && tribunal ? TIPO_SAIJ[tribunal] || (tribunal in { doctrina: 1, legislacion: 1, dictamenes: 1 } ? [] : null) : null;
  if (tiposSaij && !tiposSaij.length) return { total: 0, resultados: [], siguienteDesde: null };
  const marcas = base === 'csjn' ? ['csjn'] : [base, ...(junta ? ['saij'] : [])];
  const priorizaFallos = (base === 'saij' || base === 'csjn' || junta) && (!tribunal || tribunal === 'todo');
  const args = [`(${expr}) AND (${marcas.map((m) => `marca : zf${m}`).join(' OR ')})`];
  const donde = [];
  if (base === 'csjn') donde.push("(f.corte = 1 OR f.fuente = 'csjn')");
  else if (junta) { donde.push("(f.fuente = ? OR (f.fuente = 'saij' AND f.provincia = ?))"); args.push(base, prov); }
  else { donde.push('f.fuente = ?'); args.push(base); }
  if (anioDesde) { donde.push('f.anio >= ?'); args.push(Number(anioDesde)); }
  if (anioHasta) { donde.push('f.anio <= ?'); args.push(Number(anioHasta)); }
  if (provincia) { donde.push('f.provincia = ?'); args.push(provincia); }
  if (tiposSaij) {
    if (tribunal === 'todo') {
      // Las filas antiguas sin tipo siguen consultables mientras se renueva el acervo.
      donde.push(`(f.tipo IN (${tiposSaij.map(() => '?').join(',')}) OR f.tipo IS NULL)`);
      args.push(...tiposSaij);
    } else {
      donde.push(`f.tipo IN (${tiposSaij.map(() => '?').join(',')})`);
      args.push(...tiposSaij);
    }
  }
  const trib = TRIBUNAL_DE[base]?.[tribunal];
  // Aplicar el tribunal a TODO el conjunto, también a los fallos mendocinos de SAIJ.
  // Sin esta condición, SAIJ eludía el filtro SC/CC/CT y contaminaba los resultados.
  // Un tribunal no informado no permite atribuir el fallo a un fuero específico.
  if (trib) { donde.push("upper(coalesce(f.tribunal, '')) LIKE ?"); args.push(trib); }
  const contenido = "coalesce(lower(trim(f.caratula)), '') || '|' || coalesce(f.fecha, '') || '|' || substr(coalesce(f.sumario, f.id), 1, 80)";
  const porFallo = "lower(trim(f.caratula)) || '|' || coalesce(f.fecha, '') || '|' || coalesce(lower(trim(f.tribunal)), '')";
  const clave = `CASE WHEN f.fuente <> 'saij' AND coalesce(nullif(trim(f.linkFallo), ''), nullif(trim(f.linkFicha), '')) IS NOT NULL THEN coalesce(nullif(trim(f.linkFallo), ''), trim(f.linkFicha))
    WHEN coalesce(trim(f.caratula), '') <> '' THEN ${porFallo} ELSE ${contenido} END`;
  // El total exacto de fallos únicos no necesita calcular BM25, ordenar
  // todos los resultados ni devolver sus textos. Es la segunda fase de
  // búsqueda: se cuenta sobre TODO el acervo, nunca sobre 20 fichas.
  if (soloConteo) {
    const r = db.prepare(`SELECT count(DISTINCT ${clave}) AS n
      FROM fts JOIN fallos f ON f.rid = fts.rowid
      WHERE fts MATCH ? AND ${donde.join(' AND ')}`).get(...args);
    return { total: Number(r?.n || 0), resultados: [],
      totalPendiente: false, soloConteo: true, siguienteDesde: null };
  }

  // Dos fases: la vista rápida muestra fallos reales sin el costoso
  // count(*) OVER() + GROUP BY + orden global. El total EXACTO se calcula
  // luego, en otra petición. Nunca anunciar el tamaño de la muestra como total.
  if (rapida && Number(desde) === 0) {
    const n = Math.min(100, Math.max(1, Number(porPagina) || 20));
    // Se explora un pequeño lote por FTS5. LIMIT evita recorrer cientos de
    // miles de coincidencias sólo para mostrar las primeras fichas.
    const pesoTipo = priorizaFallos ? "CASE WHEN f.tipo = 'sumario' THEN 1 ELSE 0 END," : '';
    const candidatos = db.prepare(`SELECT f.*, ${clave} AS claveRapida
      FROM fts JOIN fallos f ON f.rid = fts.rowid
      WHERE fts MATCH ? AND ${donde.join(' AND ')}
      ORDER BY ${pesoTipo} bm25(fts, 4.0, 1.0, 2.0, 0.0${mag ? ', 1.0' : ''}), f.rid
      LIMIT ?`).all(...args, Math.max(120, n * 6));
    const vistos = new Set(), filas = [];
    for (const f of candidatos) {
      if (vistos.has(f.claveRapida)) continue;
      vistos.add(f.claveRapida);
      filas.push(f);
      if (filas.length >= n) break;
    }
    const resultados = filas.map((f) => {
      const r = { id: f.id, caratula: f.caratula, tribunal: f.tribunal, fecha: f.fecha,
        expediente: f.expediente, sumario: f.sumario,
        voces: f.voces ? f.voces.split(' · ') : undefined,
        magistrados: f.magistrados, materia: f.materia,
        linkFicha: f.linkFicha, linkFallo: f.linkFallo, tipo: f.tipo,
        ...(priorizaFallos && f.tipo === 'sumario' ? { esSumarioRespaldo: true } : {}),
        ...(f.tipo === 'fallo' && f.sumario ? { tipoExtracto: 'Sumario asociado; no es el texto íntegro del fallo' } : {}),
        desdeAcervo: true };
      for (const k of Object.keys(r)) if (r[k] == null) delete r[k];
      return r;
    });
    return { total: null, totalPendiente: true, resultados, siguienteDesde: null };
  }

  // MATERIALIZED: bm25() sólo vale dentro de la consulta al índice, y así SQLite no la «aplana» hacia afuera.
  // Una fila por clave: la de mejor relevancia (SQLite devuelve con min() la fila de ese mínimo).
  // la clave de «el mismo resultado» (lib/claveFallo.js): un resultado por fallo. Un fallo con varios sumarios es UN resultado
  // (se muestra el de mejor coincidencia); el enlace manda donde cada fallo tiene el suyo, y en SAIJ (cuyos enlaces son uno por sumario) la carátula, la fecha y el tribunal.

  const coinciden = `SELECT f.rid AS rid, f.tipo AS tipo, bm25(fts, 4.0, 1.0, 2.0, 0.0${mag ? ', 1.0' : ''}) AS rel, ${clave} AS clave
    FROM fts JOIN fallos f ON f.rid = fts.rowid WHERE fts MATCH ? AND ${donde.join(' AND ')}`;
  const unicos = priorizaFallos
    ? `WITH m AS MATERIALIZED (${coinciden}), ordenados AS (
        SELECT rid, rel, tipo, clave,
          row_number() OVER (PARTITION BY clave
            ORDER BY CASE WHEN tipo = 'sumario' THEN 1 ELSE 0 END, rel, rid) AS rn
        FROM m
      ), u AS (
        SELECT rid, rel, CASE WHEN tipo = 'sumario' THEN 1 ELSE 0 END AS prioridad
        FROM ordenados WHERE rn = 1
      )`
    : `WITH m AS MATERIALIZED (${coinciden}), u AS (
        SELECT rid, min(rel) AS rel, 0 AS prioridad FROM m GROUP BY clave
      )`;
  const pos = Math.max(0, Number(desde) || 0), n = Math.min(100, Math.max(1, Number(porPagina) || 20));
  // el total sale de la misma pasada (count() OVER), sin recorrer el índice dos veces
  const filas = db.prepare(`${unicos} SELECT f.*, count(*) OVER () AS total_ FROM u JOIN fallos f ON f.rid = u.rid ORDER BY u.prioridad, u.rel, u.rid LIMIT ? OFFSET ?`).all(...args, n, pos);
  const total = filas.length ? filas[0].total_ : db.prepare(`${unicos} SELECT count(*) AS n FROM u`).get(...args).n;
  const resultados = filas.map((f) => {
    const r = { id: f.id, caratula: f.caratula, tribunal: f.tribunal, fecha: f.fecha, expediente: f.expediente, sumario: f.sumario,
      voces: f.voces ? f.voces.split(' · ') : undefined, magistrados: f.magistrados, materia: f.materia, linkFicha: f.linkFicha, linkFallo: f.linkFallo, tipo: f.tipo,
      ...(priorizaFallos && f.tipo === 'sumario' ? { esSumarioRespaldo: true } : {}),
      ...(f.tipo === 'fallo' && f.sumario ? { tipoExtracto: 'Sumario asociado; no es el texto íntegro del fallo' } : {}),
      desdeAcervo: true };
    for (const k of Object.keys(r)) if (r[k] == null) delete r[k];
    return r;
  });
  return { total, resultados, siguienteDesde: pos + filas.length < total ? pos + filas.length : null };
}
