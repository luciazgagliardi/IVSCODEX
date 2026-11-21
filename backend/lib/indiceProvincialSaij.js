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
  chubut_saij: 'Chubut',
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
  santacruz_saij: 'Santa Cruz',
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
  // Mantener la faceta territorial, pero usar el mismo orden documental que
  // la búsqueda nacional: fallos primero y sumarios sólo como respaldo.
  // Se permite elegir explícitamente «fallos» o «sumarios» para investigar
  // un tipo documental aislado.
  const pedido = ['fallos', 'sumarios', 'todo'].includes(opciones.tribunal)
    ? opciones.tribunal : 'todo';
  const salida = await buscarSaij({ ...opciones, soloCsjn: false,
    provincia, tribunal: pedido });
  // Los registros de SAIJ no siempre incluyen la provincia en el propio
  // resumen: añadir sólo el metadato confirmado por la faceta consultada.
  return { ...salida, resultados: (salida.resultados || []).map(r =>
    r && { ...r, provincia, procedencia: 'SAIJ' }) };
}
