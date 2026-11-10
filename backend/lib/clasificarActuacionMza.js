/**
 * Clasifica ACTUACIONES publicadas por el Poder Judicial de Mendoza.
 * Que un trámite mencione "sentencia" no lo convierte en una sentencia.
 * Separa fallos de avisos, vistas, constancias y actos administrativos.
 */
const normalizar = texto => String(texto||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

export function esSentenciaClasificada(descripcion){
  const t=normalizar(descripcion);
  if(!t) return false;
  if(/\b(?:constancia|notificacion|emplazamiento|vista de causa|sin llamamiento|mero tramite|decreto|proveido|auto interlocutorio)\b/.test(t))return false;
  return /^sentencia\b/.test(t) ||
    /^(?:audiencia\b|acta\b|au\.)[\s\S]{0,120}\bsentencia\b/.test(t);
}

export function esTextoJudicialSustantivo(texto){
  const t=normalizar(texto);
  if(t.length<700)return false;
  // Las sentencias monitorias pueden tener una fundamentación y resolutivo
  // muy breves, pero no basta con un simple aviso de notificación.
  return /\b(?:resuelve|fallo|considerando|sentencia definitiva|autos y vistos|vistos)\b/.test(t);
}
