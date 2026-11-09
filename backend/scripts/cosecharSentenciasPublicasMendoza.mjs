/**
 * Obtiene decisiones públicas de Mendoza desde URLs oficiales previamente verificadas.
 * Sin scraping indiscriminado ni consultas a portales restringidos.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHAS = JSON.parse(await fs.readFile(path.join(BACKEND, 'datos/mendoza-sentencias-oficiales.json'), 'utf8'));
const DIR = path.join(BACKEND, 'acervo-crudo/respaldo');
const SALIDA = path.join(DIR, 'mendoza.json.gz');
const INFORME = path.join(BACKEND, 'reporte-sentencias-oficiales-mendoza.json');
const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));
const limpiar = x => String(x || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n').trim();
const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

async function descargar(ficha) {
  if (!/^\d{8,14}$/.test(String(ficha.ide))) throw new Error('Identificador inválido');
  if (!['www2.jus.mendoza.gov.ar', 'wwwnoti.jus.mendoza.gov.ar'].includes(ficha.host)) throw new Error('Host no permitido');
  const url = 'https://' + ficha.host + '/listas/proveidos/vertexto.php?ide=' + ficha.ide;
  const r = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': 'IVS-CODEX/1.0 (corpus jurídico, acceso público)' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
  const dom = new JSDOM(await r.text());
  for (const e of dom.window.document.querySelectorAll('script,style,nav,footer')) e.remove();
  for (const e of dom.window.document.querySelectorAll('br,p,div,tr')) e.append('\n');
  const texto = limpiar(dom.window.document.body?.textContent || '');
  dom.window.close();
  if (texto.length < 900 || !/PODER JUDICIAL MENDOZA/i.test(texto)) throw new Error(ficha.ide + ': HTML no judicial o incompleto');
  if (!norm(texto).includes(norm(ficha.cuij))) throw new Error(ficha.ide + ': CUIJ no coincide');
  if (ficha.tribunal.includes('TRABAJO') && !/CAMARA.*TRABAJO|CAMARA LABORAL/i.test(norm(texto.slice(0,1400)))) throw new Error(ficha.ide + ': tribunal laboral no coincide');
  if (ficha.tribunal.includes('CIVIL') && !/CIVIL/i.test(norm(texto.slice(0,1400)))) throw new Error(ficha.ide + ': tribunal civil no coincide');
  if (ficha.tribunal.includes('SUPREMA') && !/SUPREMA CORTE/i.test(norm(texto.slice(0,1400)))) throw new Error(ficha.ide + ': corte no coincide');
  if (!/SENTENCIA|RESOLVER EN DEFINITIVA|RESUELVE/i.test(norm(texto))) throw new Error(ficha.ide + ': resolución no acreditada');
  return {
    id: 'mza_oficial_' + ficha.ide, fuente: 'mendoza', provincia: 'Mendoza',
    caratula: ficha.caratula, tribunal: ficha.tribunal, fecha: ficha.fecha,
    expediente: ficha.cuij, materia: 'Resolución judicial publicada oficialmente',
    sumario: 'Extracto literal del texto judicial: ' + texto.slice(0,8000),
    textoCompleto: texto, linkFicha: url, linkFallo: url,
    procedencia: 'Poder Judicial de Mendoza · listas de proveídos',
    tipo: 'fallo'
  };
}
const registros = [], incidencias = [];
for (const ficha of FICHAS) {
  try {
    const r = await descargar(ficha);
    registros.push(r);
    console.log(r.id + ': ' + r.textoCompleto.length + ' caracteres');
  } catch (e) {
    incidencias.push({ ide: ficha.ide, error: String(e.message) });
    console.error(String(e.message));
  }
  await dormir(1200);
}
if (incidencias.length || registros.length !== FICHAS.length)
  throw new Error('Sin publicar: ' + registros.length + '/' + FICHAS.length + '; incidencias=' + JSON.stringify(incidencias));
await fs.mkdir(DIR, { recursive: true });
let previos = [];
try {
  const anteriores = JSON.parse(zlib.gunzipSync(await fs.readFile(SALIDA)).toString('utf8'));
  if (!Array.isArray(anteriores.registros)) throw new Error('Respaldo anterior inválido');
  previos = anteriores.registros;
} catch (e) { if (e.code !== 'ENOENT') throw e; }
const mapa = new Map(previos.map(x => [x.id, x]));
for (const r of registros) mapa.set(r.id, r);
const temporal = SALIDA + '.tmp';
await fs.writeFile(temporal, zlib.gzipSync(JSON.stringify({ fuente:'mendoza', generado:new Date().toISOString(), registros:[...mapa.values()] })));
await fs.rename(temporal, SALIDA);
const informe = {
  fecha:new Date().toISOString(),fuente:'Poder Judicial de Mendoza',
  recibidos:registros.length,previos:previos.length,totalRespaldo:mapa.size,
  documentos:registros.map(x => ({ id:x.id,caratula:x.caratula,fecha:x.fecha,tribunal:x.tribunal,link:x.linkFallo,caracteres:x.textoCompleto.length }))
};
await fs.writeFile(INFORME, JSON.stringify(informe,null,2));
console.log(JSON.stringify(informe,null,2));
