/**
 * Vocabulario jurídico: reconoce conceptos dentro de una consulta y devuelve
 * sus relaciones según su política de uso.
 *
 * Datos: backend/datos/vocabulario/inventario.json, generado por
 * ops/vocabulario/construir-inventario.mjs a partir del Tesauro SAIJ de
 * Derecho Argentino (CC-BY 4.0), el tesauro del Poder Judicial de Mendoza,
 * los anillos curados de IVS CODEX y relaciones fundadas en normas.
 *
 * Qué NO hace: no decide que dos términos sean lo mismo. Solo suma a la
 * búsqueda (politica "expandir") las relaciones verificadas: identidad
 * léxica, anillos medidos en vivo y cambios de denominación con norma
 * expresa. Todo lo demás vuelve rotulado como sugerencia, con su fuente y su
 * evidencia, para que la abogada decida.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../datos/vocabulario/inventario.json');
const MAX_PALABRAS_TERMINO = 10;
const MAX_POR_GRUPO = 12;

export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[()[\]{}"'«»“”.,;:¿?¡!]/g, ' ').replace(/[-–—/]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Forma singular aproximada de cada palabra (solo número gramatical). */
export function singular(n) {
  return n.split(' ').map((w) => (w.length > 4 && /[^aeiou]es$/.test(w) && !w.endsWith('ces') ? w.slice(0, -2)
    : w.length > 4 && w.endsWith('ces') ? w.slice(0, -3) + 'z'
      : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)).join(' ');
}

/** Palabras de la consulta tal como se escribieron, alineadas con su forma normalizada. */
function palabrasDe(consulta) {
  const original = String(consulta || '').slice(0, 300).replace(/[()[\]{}"'«»“”.,;:¿?¡!]/g, ' ').replace(/[-–—/]/g, ' ')
    .split(/\s+/).filter(Boolean);
  const pares = original.map((w) => ({ w, n: normalizar(w) })).filter((x) => x.n);
  return { originales: pares.map((x) => x.w), normalizadas: pares.map((x) => x.n) };
}

const singularIgual = (a, b) => singular(normalizar(a)) === singular(normalizar(b));

let cache = null;

/** Carga e indexa el inventario una sola vez (perezosamente). */
export function cargar(ruta = RUTA) {
  if (cache && cache.ruta === ruta) return cache;
  const inv = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const def = inv.esquema.porDefecto || {};
  const completar = (r) => ({ ...(def[r.tipo] || {}), ...r });
  const entradas = new Map(); // id -> entrada
  const indice = new Map(); // termino normalizado -> [{id, via}]
  const indexar = (t, id, via) => {
    const n = normalizar(t);
    if (!n || n.split(' ').length > MAX_PALABRAS_TERMINO) return;
    for (const clave of new Set([n, '~' + singular(n)])) {
      const l = indice.get(clave) || [];
      if (!l.some((x) => x.id === id)) l.push({ id, via });
      indice.set(clave, l);
    }
  };

  for (const c of inv.conceptos) {
    entradas.set(c.id, { ...c, relaciones: c.relaciones.map(completar), origen: 'saij' });
    indexar(c.canonico, c.id, 'descriptor');
    if (c.vozScjm) indexar(c.vozScjm, c.id, 'voz_scjm');
    for (const r of c.relaciones) {
      if (/^(equivalencia_ortografica|variacion_morfologica|sigla|denominacion_extendida|descriptor_no_preferido|variante_oculta)$/.test(r.tipo)) {
        indexar(r.termino, c.id, r.tipo);
      }
    }
  }
  for (const a of inv.anillos) {
    entradas.set(a.id, { ...a, origen: 'ivs_codex' });
    indexar(a.canonico, a.id, 'descriptor');
    for (const r of a.relaciones) if (r.tipo === 'equivalencia_conceptual') indexar(r.termino, a.id, 'equivalencia_conceptual');
  }
  // Las relaciones normativas se cuelgan de un nodo propio por concepto.
  const porConcepto = new Map();
  for (const h of inv.historicas) {
    const id = `norma:${normalizar(h.concepto)}`;
    const e = porConcepto.get(id) || { id, canonico: h.concepto, rama: h.rama, origen: 'normativa', relaciones: [] };
    e.relaciones.push(h);
    porConcepto.set(id, e);
  }
  for (const e of porConcepto.values()) {
    entradas.set(e.id, e);
    indexar(e.canonico, e.id, 'descriptor');
    for (const r of e.relaciones) {
      // El término histórico lleva al concepto vigente solo si son la misma
      // institución; un contrapuesto o una figura que se confunde NO deben
      // reconocerse como el concepto de al lado.
      if (r.tipo === 'equivalencia_historica' || r.tipo === 'expresion_coloquial') indexar(r.termino, e.id, r.tipo);
    }
  }
  const vocesScjm = new Map();
  for (const v of inv.vocesSoloScjm) { vocesScjm.set(normalizar(v), v); vocesScjm.set('~' + singular(normalizar(v)), v); }
  cache = { ruta, inv, entradas, indice, vocesScjm };
  return cache;
}

/**
 * Busca los tramos más largos de la consulta que coinciden con un término
 * del vocabulario, sin superponerlos (de izquierda a derecha, el más largo
 * primero).
 */
function tramos(palabras, indice, vocesScjm) {
  const out = [];
  let i = 0;
  while (i < palabras.length) {
    let hallado = null;
    for (let n = Math.min(MAX_PALABRAS_TERMINO, palabras.length - i); n >= 1; n--) {
      const t = palabras.slice(i, i + n).join(' ');
      // Una sola palabra muy corta o genérica no alcanza para afirmar un concepto.
      if (n === 1 && t.length < 4) continue;
      const s = '~' + singular(t);
      if (indice.has(t)) { hallado = { desde: i, hasta: i + n, termino: t, ids: indice.get(t) }; break; }
      if (indice.has(s)) { hallado = { desde: i, hasta: i + n, termino: t, ids: indice.get(s) }; break; }
      if (vocesScjm.has(t) || vocesScjm.has(s)) { hallado = { desde: i, hasta: i + n, termino: t, vozScjm: vocesScjm.get(t) || vocesScjm.get(s) }; break; }
    }
    if (hallado) { out.push(hallado); i = hallado.hasta; } else i++;
  }
  return out;
}

const GRUPOS = {
  equivalencia_conceptual: 'equivalentes', equivalencia_historica: 'historicas', equivalencia_ortografica: 'equivalentes',
  variacion_morfologica: 'equivalentes', sigla: 'siglas', denominacion_extendida: 'denominaciones', descriptor_no_preferido: 'denominaciones',
  variante_oculta: 'denominaciones', concepto_mas_amplio: 'masAmplios', concepto_mas_especifico: 'masEspecificos',
  concepto_relacionado: 'relacionados', concepto_contrapuesto: 'contrapuestos', figura_que_se_confunde: 'seConfundeCon', expresion_coloquial: 'coloquiales',
};

function describir(e, via, termino) {
  const grupos = {};
  const expandir = [];
  const relaciones = e.relaciones || [];
  // Para un nodo normativo, la relación se lee en las dos direcciones: si se
  // escribió el término viejo, el vigente es el que hay que sumar.
  for (const r of relaciones) {
    let t = r.termino;
    if (e.origen === 'normativa' && normalizar(r.termino) === termino) t = e.canonico;
    if (normalizar(t) === termino) continue;
    const item = { termino: t, tipo: r.tipo, estado: r.estado, fuente: r.fuente, evidencia: r.evidencia,
      ...(r.norma ? { norma: r.norma } : {}), ...(r.alcance ? { alcance: r.alcance } : {}), ...(r.vigenciaTermino ? { vigenciaTermino: r.vigenciaTermino } : {}) };
    if (r.politica === 'expandir' && r.estado === 'verificada') expandir.push(item);
    const g = GRUPOS[r.tipo] || 'otras';
    (grupos[g] ||= []).length < MAX_POR_GRUPO && grupos[g].push(item);
  }
  // Si se entró por otra forma, el canónico también cuenta: se expande si la
  // forma por la que se entró es una equivalencia verificada, y se sugiere
  // como descriptor oficial si es un término no preferido sin revisar.
  if (e.origen !== 'normativa' && normalizar(e.canonico) !== termino && !singularIgual(e.canonico, termino)) {
    const verificada = /^(equivalencia_conceptual|equivalencia_ortografica|variacion_morfologica)$/.test(via);
    const item = { termino: e.canonico, tipo: verificada ? via : 'descriptor_preferido', estado: verificada ? 'verificada' : 'verificada_en_fuente',
      fuente: e.origen, evidencia: verificada ? 'Forma canónica del anillo por el que se reconoció la consulta.' : 'Descriptor preferido del tesauro oficial para el término escrito.' };
    if (verificada) expandir.unshift(item);
    (grupos[verificada ? 'equivalentes' : 'descriptorOficial'] ||= []).unshift(item);
  }
  return {
    id: e.id, canonico: e.canonico, origen: e.origen, rama: e.rama || null,
    ...(e.especialidad ? { especialidad: e.especialidad } : {}), ...(e.subrama ? { subrama: e.subrama } : {}),
    ...(e.saij ? { saij: e.saij } : {}), ...(e.vozScjm ? { vozScjm: e.vozScjm } : {}),
    ...(e.normas ? { normas: e.normas } : {}), ...(e.nota ? { nota: e.nota } : {}), ...(e.desde ? { desde: e.desde } : {}),
    reconocidoPor: via, expandir, grupos,
  };
}

/**
 * Analiza una consulta: qué conceptos contiene, qué variantes verificadas
 * merecen sumarse y qué líneas de investigación conviene ofrecer.
 */
export function analizar(consulta, { maxVariantes = 4 } = {}) {
  const { entradas, indice, vocesScjm } = cargar();
  const { originales, normalizadas: palabras } = palabrasDe(consulta);
  const conceptos = [];
  const descriptoresScjm = [];
  const orden = { ivs: 0, norma: 1, saij: 2 };
  const prioridad = (id) => orden[id.slice(0, id.indexOf(':'))] ?? 3;
  for (const t of tramos(palabras, indice, vocesScjm)) {
    if (t.vozScjm) { descriptoresScjm.push({ termino: t.vozScjm, tramo: [t.desde, t.hasta] }); continue; }
    // Una entrada por concepto canónico: el anillo curado, la norma y el
    // tesauro oficial que nombran lo mismo se fusionan, conservando de dónde
    // viene cada relación. Conceptos distintos para el mismo tramo quedan
    // separados (no se fusiona lo que no es lo mismo).
    const porCanonico = new Map();
    for (const { id, via } of [...t.ids].sort((a, b) => prioridad(a.id) - prioridad(b.id))) {
      const e = entradas.get(id); if (!e) continue;
      const d = describir(e, via, t.termino);
      const k = normalizar(d.canonico);
      const prev = porCanonico.get(k);
      if (!prev) { porCanonico.set(k, { ...d, origenes: [d.origen], tramo: [t.desde, t.hasta], termino: originales.slice(t.desde, t.hasta).join(' ') }); continue; }
      prev.origenes.push(d.origen);
      for (const campo of ['saij', 'vozScjm', 'especialidad', 'subrama', 'normas', 'nota', 'desde']) if (prev[campo] === undefined && d[campo] !== undefined) prev[campo] = d[campo];
      prev.rama ||= d.rama;
      const ya = new Set(prev.expandir.map((x) => normalizar(x.termino)));
      for (const x of d.expandir) if (!ya.has(normalizar(x.termino))) prev.expandir.push(x);
      for (const [g, items] of Object.entries(d.grupos)) {
        const lista = (prev.grupos[g] ||= []);
        const vistos = new Set(lista.map((x) => normalizar(x.termino)));
        for (const x of items) if (!vistos.has(normalizar(x.termino)) && lista.length < MAX_POR_GRUPO) lista.push(x);
      }
    }
    conceptos.push(...porCanonico.values());
  }

  // Variantes de la consulta: se reemplaza el tramo reconocido por cada
  // forma verificada y se conserva el resto tal como se escribió.
  const variantes = [];
  const yaEsta = new Set([palabras.join(' ')]);
  for (const c of conceptos) {
    for (const x of c.expandir) {
      const partes = [...originales.slice(0, c.tramo[0]), x.termino, ...originales.slice(c.tramo[1])];
      const clave = normalizar(partes.join(' '));
      if (yaEsta.has(clave)) continue; yaEsta.add(clave);
      variantes.push({ consulta: partes.join(' '), reemplaza: c.termino, por: x.termino, tipo: x.tipo, fuente: x.fuente });
    }
  }
  return {
    consulta: String(consulta || '').slice(0, 300),
    conceptos,
    descriptoresScjm,
    variantes: variantes.slice(0, maxVariantes),
    variantesOmitidas: Math.max(0, variantes.length - maxVariantes),
    aviso: 'Las variantes se suman solo cuando la equivalencia está verificada. Las demás relaciones son líneas de investigación: un concepto relacionado no es un sinónimo.',
  };
}

/** Datos de procedencia para mostrar y atribuir (CC-BY exige atribución). */
export function procedencia() {
  const { inv } = cargar();
  return { version: inv.version, fuentes: inv.fuentes, estadisticas: inv.estadisticas, esquema: { tipos: inv.esquema.tipos, estados: inv.esquema.estados, politicas: inv.esquema.politicas } };
}
