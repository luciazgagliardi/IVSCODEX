import { buscarIndiceHybrid } from './indiceHybridJurisprudencia.js';

export const API_TFN = 'https://api.jurisprudencia-tfn.ar';

export async function buscarTfn({ q, tribunal = 'objetos', searchIn, modo = 'todas' }) {
  return buscarIndiceHybrid({
    fuente: 'tfn',
    apiBase: API_TFN,
    q,
    searchIn: searchIn || tribunal || 'objetos',
    modo,
  });
}
