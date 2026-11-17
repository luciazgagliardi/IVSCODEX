/**
 * Medición reproducible sobre el acervo PUBLICADO, sin modificarlo.
 * Construye un índice temporal únicamente con documentos mendocinos:
 * fuente propia + SAIJ con provincia Mendoza, y compara búsquedas FTS.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { ESQUEMA, paginaEn, anioDe } from '../lib/acervoConsulta.js';

const base=path.resolve(process.env.DIR_ACERVO_BASE || 'acervo-base');
const man=JSON.parse(fs.readFileSync(path.join(base,'manifiesto.json'),'utf8'));
const db=new DatabaseSync(':memory:');
db.exec(ESQUEMA);
const ins=db.prepare('INSERT OR IGNORE INTO fallos(id,fuente,corte,provincia,caratula,tribunal,fecha,anio,expediente,sumario,voces,magistrados,materia,linkFicha,linkFallo,tipo,marca) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
let total=0;const porFuente={mendoza:0,saijMendoza:0};
db.exec('BEGIN');
for(const a of man.archivos.filter(x=>/^(mendoza|saij)-\d+\.jsonl\.gz$/.test(x))){
 const stream=readline.createInterface({input:fs.createReadStream(path.join(base,a)).pipe(zlib.createGunzip()),crlfDelay:Infinity});
 for await(const linea of stream) {
  if(!linea.trim())continue;
  const r=JSON.parse(linea);
  if(!(r.fuente==='mendoza'||(r.fuente==='saij'&&r.provincia==='Mendoza')))continue;
  ins.run(r.id,r.fuente,r.corte?1:0,r.provincia||null,r.caratula||null,r.tribunal||null,r.fecha||null,anioDe(r.fecha),
    r.expediente||null,r.sumario||null,Array.isArray(r.voces)?r.voces.join(' · '):(r.voces||null),r.magistrados||null,r.materia||null,
    r.linkFicha||null,r.linkFallo||null,r.tipo||null,'zf'+r.fuente+(r.corte?' zfcsjn':''));
  total++;
  if(r.fuente==='mendoza')porFuente.mendoza++;else porFuente.saijMendoza++;
 }
}
db.exec('COMMIT');
db.exec("INSERT INTO fts(fts) VALUES('rebuild')");
function medir(q,variantes) {
  const comienzo=Date.now();
  const primer=paginaEn(db,'mendoza',q,{porPagina:20});
  const ampliada=paginaEn(db,'mendoza',q,{porPagina:20,variantes});
  return {q,primario:primer.total,conEquivalentes:ampliada.total,diferencia:ampliada.total-primer.total,ms:Date.now()-comienzo,
    principales:ampliada.resultados.slice(0,5).map(x=>x.id)};
}
const pruebas=[
 medir('daño moral',['daño extrapatrimonial','consecuencias no patrimoniales','agravio moral','daño inmaterial']),
 medir('daño punitivo',['multa civil','sanción pecuniaria disuasiva']),
];
const informe={version:man.version,registrosRevisados:total,porFuente,pruebas};
console.log(JSON.stringify(informe,null,2));
fs.writeFileSync('reporte-cobertura-mendoza.json',JSON.stringify(informe,null,2));
db.close();
if(pruebas.some(p=>p.diferencia<0))throw Error('Regresión: faltan resultados');
if(pruebas[0].diferencia===0)throw Error('No se recuperaron resultados adicionales para daño moral; revisar antes de publicar');
