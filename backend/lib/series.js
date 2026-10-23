/**
 * Series oficiales que el navegador no puede pedir solo.
 *
 * RIPTE: la API de Series de Tiempo de datos.gob.ar devuelve la serie
 * 158.1_REPTE_0_0_5 vacía (comprobado el 23/10/2026), aunque su catálogo la
 * declara al día. El archivo CSV oficial de esa misma distribución sí trae
 * los datos, pero se sirve sin encabezados CORS: desde el navegador no se
 * puede leer. El servidor lo baja, lo guarda doce horas y lo devuelve como
 * filas [fecha, valor] —la misma forma que la API—, sin tocar los valores.
 */

import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { errores } from './errores.js';

const ARCHIVOS = {
  ripte: 'https://infra.datos.gob.ar/catalog/sspm/dataset/158/distribution/158.1/download/remuneracion-imponible-promedio-trabajadores-estables-ripte-total-pais-pesos-serie-mensual.csv',
};
const VIGENCIA_MS = 12 * 60 * 60 * 1000;
const memoria = new Map();

/** "indice_tiempo,ripte\n1994-07-01,874.87\n…" → [["1994-07-01", 874.87], …] */
export function leerCsvSerie(csv) {
  return String(csv || '')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(','))
    .filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c[0]) && c[1] !== '' && isFinite(Number(c[1])))
    .map((c) => [c[0], Number(c[1])]);
}

export async function serieOficial(clave) {
  const url = ARCHIVOS[clave];
  if (!url) throw errores.normaDesconocida(clave);
  const guardada = memoria.get(clave);
  if (guardada && Date.now() - guardada.en < VIGENCIA_MS) return guardada;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: control.signal });
    if (!resp.ok) throw new Error(`respuesta ${resp.status}`);
    const datos = leerCsvSerie(await resp.text());
    if (!datos.length) throw new Error('el archivo no trae datos');
    const salida = { datos, en: Date.now(), fuente: url };
    memoria.set(clave, salida);
    return salida;
  } catch (e) {
    // si había una copia, se devuelve avisando que es de antes
    if (guardada) return { ...guardada, desactualizada: true };
    throw errores.indiceFuenteFalla('series', e?.name === 'AbortError' ? 'tiempo agotado' : e?.message);
  } finally {
    clearTimeout(reloj);
  }
}
