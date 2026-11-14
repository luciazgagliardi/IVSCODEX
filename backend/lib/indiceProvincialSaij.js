/**
 * Vistas territoriales sobre documentación judicial que SAIJ publica en
 * abierto. No son conectores a los portales de cada Poder Judicial:
 * conservan explícitamente la procedencia SAIJ y aplican su faceta oficial
 * Jurisdicción/Local/<provincia> en cada pedido.
 *
 * Los documentos se guardan una sola vez, bajo su UUID original de SAIJ.
 */
import { buscarSaij } from './indiceSaij.js';

export const PROVINCIAS_PRIORIZADAS = Object.freeze({
  cordoba: 'Córdoba',
  entrerrios: 'Entre Ríos',
  neuquen: 'Neuquén',
  tucuman: 'Tucumán',
  chaco: 'Chaco',
  corrientes: 'Corrientes',
});

export function provinciaSaijDe(slug) {
  return PROVINCIAS_PRIORIZADAS[String(slug || '')] || null;
}

export async function buscarProvinciaSaij(slug, opciones = {}) {
  const provincia = provinciaSaijDe(slug);
  if (!provincia) throw new Error('Jurisdicción provincial no configurada');
  // Ignorar provincia y tipo del cliente: el índice provincial debe quedarse
  // estrictamente dentro de la faceta local correspondiente, sin legislación
  // ni doctrina presentadas como fallos.
  const salida = await buscarSaij({ ...opciones, soloCsjn: false,
    provincia, tribunal: 'sumarios' });
  // Los registros de SAIJ no siempre incluyen la provincia en el propio
  // resumen: añadir sólo el metadato confirmado por la faceta consultada.
  return { ...salida, resultados: (salida.resultados || []).map(r =>
    r && { ...r, provincia, procedencia: 'SAIJ' }) };
}
