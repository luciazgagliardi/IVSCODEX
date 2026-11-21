import { buscarIndiceHybrid } from './indiceHybridJurisprudencia.js';

export const API_SANTA_CRUZ = 'https://api.tsj-sc.inteligencialegal.com.ar';

export async function buscarSantaCruz({ q, tribunal = 'objetos', searchIn, modo = 'todas' }) {
  return buscarIndiceHybrid({
    fuente: 'santacruz',
    apiBase: API_SANTA_CRUZ,
    q,
    searchIn: searchIn || tribunal || 'objetos',
    modo,
  });
}
