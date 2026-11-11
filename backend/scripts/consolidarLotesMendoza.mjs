/**
 * Consolida cosechas mensuales verificadas, sin contar dos veces un fallo
 * ni sacrificar sentencias del respaldo anterior.
 *
 * Entrada: acervo-crudo/descargas/mendoza-mes-AAAA-MM/lote.json.gz
 * Base: respaldo/mendoza-listas.json.gz + acervo-base/_fuentes/mendoza-listas-masiva.json.gz
 * Salida: respaldo/mendoza-listas.json.gz + reporte-mendoza-masiva.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { esSentenciaClasificada, esTextoJudicialSustantivo } from '../lib/clasificarActuacionMza.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const descargas = path.join(raiz, 'acervo-crudo', 'descargas');
const salida = path.join(raiz, 'respaldo', 'mendoza-listas.json.gz');
const historico = path.join(raiz, 'acervo-base', '_fuentes', 'mendoza-listas-masiva.json.gz');
const reporte = path.join(raiz, 'reporte-mendoza-masiva.json');

function verificar(r, ubicacion) {
  if (!/^mza_oficial_\d{8,14}$/.test(String(r?.id || '')) || r.fuente !== 'mendoza')
    throw new Error('Identificador o jurisdicción incorrectos en ' + ubicacion);
  if (!r.tribunal || !r.expediente || !r.caratula || !/\d{2}\/\d{2}\/20\d{2}/.test(r.fecha || ''))
    throw new Error('Metadatos judiciales incompletos: ' + r.id);
  if (!esSentenciaClasificada(r.materia) || !esTextoJudicialSustantivo(r.sumario))
    throw new Error('Actuación sin estructura de sentencia: ' + r.id);
  let u;
  try { u = new URL(r.linkFallo); } catch { throw new Error('Enlace inválido: ' + r.id); }
  if (u.protocol !== 'https:' || u.hostname !== 'iol.jus.mendoza.gov.ar' ||
      u.pathname !== '/iol-api/api/public/expedientes/actuaciones/pdf' ||
      !u.searchParams.has('actId') || !u.searchParams.has('expId') || !u.searchParams.has('org'))
    throw new Error('No es un PDF judicial público: ' + r.id);
}
async function leer(archivo, obligatorio) {
  let bytes;
  try { bytes = await fs.readFile(archivo); } catch (e) {
    if (e.code === 'ENOENT' && !obligatorio) return [];
    throw e;
  }
  const data = JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
  if (!Array.isArray(data.registros)) throw new Error('Lote sin registros: ' + archivo);
  if (data.registros.length > 15000) throw new Error('Lote desproporcionado: ' + archivo);
  for (const r of data.registros) verificar(r, archivo);
  return data.registros;
}

const mapa = new Map();
function integrar(registros) {
  let nuevos = 0;
  for (const r of registros) {
    const anterior = mapa.get(r.id);
    if (!anterior) nuevos++;
    if (!anterior || (r.sumario || '').length > (anterior.sumario || '').length) mapa.set(r.id, r);
  }
  return nuevos;
}

integrar(await leer(salida, true));
integrar(await leer(historico, false));
const anteriores = mapa.size;
const carpetas = (await fs.readdir(descargas, { withFileTypes: true }))
  .filter(x => x.isDirectory() && /^mendoza-mes-20\d{2}-(?:0[1-9]|1[0-2])$/.test(x.name))
  .map(x => x.name).sort();
if (!carpetas.length) throw new Error('No hay artefactos de cosecha mensual que consolidar');
const lotes = [];
for (const nombre of carpetas) {
  const regs = await leer(path.join(descargas, nombre, 'lote.json.gz'), true);
  const nuevos = integrar(regs);
  lotes.push({ mes: nombre.slice(-7), extraidos: regs.length, incorporadosAlRespaldo: nuevos });
}
const todos = [...mapa.values()];
const resultado = {
  fecha: new Date().toISOString(),
  fuente: 'Listas oficiales Poder Judicial Mendoza',
  mesesRecibidos: carpetas.length,
  registrosAntes: anteriores,
  registrosDespues: todos.length,
  registrosAdicionales: todos.length - anteriores,
  lotes
};
await fs.mkdir(path.dirname(salida), { recursive: true });
const temporal = salida + '.tmp';
await fs.writeFile(temporal, zlib.gzipSync(JSON.stringify({
  fuente: 'mendoza',
  procedencia: 'Listas públicas de proveídos con PDF oficial y texto judicial verificado',
  generado: resultado.fecha,
  registros: todos
}), { level: 8 }));
await fs.rename(temporal, salida);
await fs.writeFile(reporte, JSON.stringify(resultado, null, 2));
console.log('MENDOZA_MASIVA ' + JSON.stringify(resultado));
