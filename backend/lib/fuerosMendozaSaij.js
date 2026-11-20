/**
 * Consulta oficial alternativa de jurisprudencia mendocina a través de SAIJ.
 *
 * El buscador NEO del Poder Judicial de Mendoza responde 403 en el segundo
 * paso de CC y CT (el paso que trae las fichas). No se intenta eludir ese
 * control. SAIJ permite consultar sus propios fallos con jurisdicción
 * Mendoza y contiene atribución expresa del tribunal emisor.
 *
 * El total devuelto es ÚNICAMENTE el número de fichas verificadas de ese
 * fuero en el tramo recuperado, nunca el total del portal ni el número de
 * sentencias de todo el fuero. La continuación usa el cursor de SAIJ.
 */
import { buscarSaij } from './indiceSaij.js';

export const FUEROS_MENDOZA_ALTERNATIVOS = ['CC','CT','CF'];

const limpio = (s) => String(s||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g,' ').trim();

export function fueroDeRegistroMendoza(r) {
  const tribunal=limpio(r?.tribunal);
  if (!tribunal) return null;
  if (/SUPREMA CORTE|SUPERIOR TRIBUNAL|CORTE SUPREMA/.test(tribunal)) return 'SC';
  if (/(?:CAMARA|TRIBUNAL)(?:[^]*?)(?:FAMILIA)/.test(tribunal)) return 'CF';
  if (/(?:CAMARA|TRIBUNAL)(?:[^]*?)(?:TRABAJO|LABORAL)/.test(tribunal)) return 'CT';
  if (/(?:CAMARA|APELACIONES)(?:[^]*?)(?:CIVIL|COMERCIAL|MINAS|TRIBUTARI)/.test(tribunal)) return 'CC';
  return null; // jurisdicción sin atribución exacta: no fingir un fuero
}

export function filtrarFueroMendoza(registros, tribunal) {
  const permitidos = tribunal ? new Set([tribunal]) : new Set(FUEROS_MENDOZA_ALTERNATIVOS);
  return (registros||[]).filter(r => permitidos.has(fueroDeRegistroMendoza(r)));
}

/**
 * Segunda vía pública cuando el NEO oficial no entrega las fichas.
 * La faceta Jurisdicción/Local/Mendoza se aplica ANTES de recuperar fichas;
 * asignar provincia evita perder esas altas al sumarlas al acervo propio.
 */
export async function buscarFuerosMendozaSaij({
  q, modo='todas', excluir='', tribunal='', desde=0,
  anioDesde=null, anioHasta=null,
}) {
  const muestra = await buscarSaij({
    q, modo, excluir,
    tribunal:'fallos',
    provincia:'Mendoza',
    desde: Number.isFinite(Number(desde)) ? Math.max(0, Number(desde)) : 0,
    pagina:1, porPagina:40, anioDesde, anioHasta,
  });
  const resultados = filtrarFueroMendoza(muestra.resultados,tribunal)
    .map(r=>({...r,provincia:'Mendoza',fuenteSlug:'saij',procedencia:'SAIJ · Ministerio de Justicia'}));
  return {
    resultados,
    total: resultados.length,
    totalFuente: null,
    totalParcial: true,
    siguienteDesde: muestra.siguienteDesde,
    revisados: muestra.revisados||0,
    origenEnVivo:'saij',
    portalJudicialMendozaDisponible:false,
    universoRevisado:muestra.revisados||0,
  };
}
