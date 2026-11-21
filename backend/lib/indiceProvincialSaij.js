/**
 * Vistas territoriales sobre documentación judicial que SAIJ publica en
 * abierto. No son conectores a los portales de cada Poder Judicial:
 * conservan explícitamente la procedencia SAIJ y aplican su faceta oficial
 * Jurisdicción/Local/<provincia> en cada pedido.
 *
 * Los documentos se guardan una sola vez, bajo su UUID original de SAIJ.
 */
import { buscarSaij } from './indiceSaij.js';

export const VISTAS_PROVINCIALES_SAIJ = Object.freeze({
  buenosaires: 'Buenos Aires',
  caba_saij: 'Ciudad Autónoma de Buenos Aires',
  catamarca_saij: 'Catamarca',
  chaco: 'Chaco',
  chubut: 'Chubut',
  cordoba: 'Córdoba',
  corrientes: 'Corrientes',
  entrerrios: 'Entre Ríos',
  formosa: 'Formosa',
  jujuy_saij: 'Jujuy',
  lapampa: 'La Pampa',
  larioja: 'La Rioja',
  mendoza_saij: 'Mendoza',
  misiones: 'Misiones',
  neuquen: 'Neuquén',
  rionegro_saij: 'Río Negro',
  salta: 'Salta',
  sanjuan: 'San Juan',
  sanluis: 'San Luis',
  santacruz: 'Santa Cruz',
  santafe_saij: 'Santa Fe',
  santiagodelestero: 'Santiago del Estero',
  tierradelfuego: 'Tierra del Fuego',
  tucuman: 'Tucumán',
});

export function provinciaSaijDe(slug) {
  return VISTAS_PROVINCIALES_SAIJ[String(slug || '')] || null;
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
