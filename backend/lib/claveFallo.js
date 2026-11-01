/**
 * Cuándo dos resultados son «el mismo»: cuando son del mismo FALLO.
 *
 * Los tribunales publican un fallo con varios sumarios (Mendoza y la SCBA: un
 * renglón por sumario; SAIJ: una ficha por sumario, con la carátula del fallo),
 * y SAIJ además publica el mismo sumario con más de un identificador. Sin esto
 * la lista repite una y otra vez lo mismo, con otro pasaje cada vez.
 *
 *   - con enlace propio del fallo (Mendoza, SCBA…): el enlace;
 *   - SAIJ, o sin enlace: carátula + fecha + tribunal;
 *   - sin carátula: el comienzo del texto.
 * De cada fallo queda el primero de la lista, que es el de mejor coincidencia.
 */
const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const porContenido = (r) => `c|${norm(r.caratula)}|${norm(r.fecha)}|${norm(r.sumario || r.id).slice(0, 80)}`;

export function claveFallo(slug, r) {
  if (!r) return '';
  const enlace = slug === 'saij' || slug === 'csjn' ? '' : norm(r.linkFallo || r.linkFicha);
  if (enlace) return `l|${enlace}`;
  return norm(r.caratula) ? `f|${norm(r.caratula)}|${norm(r.fecha)}|${norm(r.tribunal)}` : porContenido(r);
}

/** La lista sin repetidos, en el mismo orden (queda el primero, que es el de mejor lugar). */
export function sinRepetidos(slug, lista) {
  if (!Array.isArray(lista)) return lista;
  const vistos = new Set();
  return lista.filter((r) => { if (!r) return true; const k = claveFallo(slug, r); if (vistos.has(k)) return false; vistos.add(k); return true; });
}
