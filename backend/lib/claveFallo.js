/**
 * Cuándo dos resultados son «el mismo».
 *
 * Los tribunales publican un fallo con varios sumarios (Mendoza y la SCBA: un
 * renglón por sumario, con la misma carátula, fecha y enlace), y SAIJ publica el
 * mismo sumario con más de un identificador. Sin esto, la lista repite lo mismo.
 *
 *   - SAIJ y la Corte: los sumarios de un fallo son textos distintos y valen cada
 *     uno, pero un mismo sumario con otro id es el mismo (carátula + fecha + comienzo).
 *   - las demás bases: un resultado por fallo (su enlace; sin enlace, carátula + fecha).
 */
const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const porContenido = (r) => `c|${norm(r.caratula)}|${norm(r.fecha)}|${norm(r.sumario || r.id).slice(0, 80)}`;

export function claveFallo(slug, r) {
  if (!r) return '';
  if (slug === 'saij' || slug === 'csjn') return porContenido(r);
  const enlace = norm(r.linkFallo || r.linkFicha);
  if (enlace) return `l|${enlace}`;
  return r.caratula ? `f|${norm(r.caratula)}|${norm(r.fecha)}` : porContenido(r);
}

/** La lista sin repetidos, en el mismo orden (queda el primero, que es el de mejor lugar). */
export function sinRepetidos(slug, lista) {
  if (!Array.isArray(lista)) return lista;
  const vistos = new Set();
  return lista.filter((r) => { if (!r) return true; const k = claveFallo(slug, r); if (vistos.has(k)) return false; vistos.add(k); return true; });
}
