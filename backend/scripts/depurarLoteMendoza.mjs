/**
 * Recupera un artefacto de cosecha anterior y lo revalida contra las reglas
 * vigentes, sin volver a descargar documentos ni modificar el origen judicial.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { esSentenciaClasificada, esTextoJudicialSustantivo } from '../lib/clasificarActuacionMza.js';

const archivo='respaldo/mendoza-listas.json.gz';
const reporteArchivo='reporte-mendoza-listas.json';
const lote=JSON.parse(zlib.gunzipSync(fs.readFileSync(archivo)).toString('utf8'));
const reporte=JSON.parse(fs.readFileSync(reporteArchivo,'utf8'));
if(lote.fuente!=='mendoza'||!Array.isArray(lote.registros))throw Error('Archivo original no es un respaldo de Mendoza');
const anterior=lote.registros.length;
const IDs=new Set(),validos=[],rechazos={};
function excluir(motivo){rechazos[motivo]=(rechazos[motivo]||0)+1}
for(const r of lote.registros){
  if(!r?.id||!/^mza_oficial_\d+$/.test(r.id)||IDs.has(r.id)){excluir('id_invalido_o_duplicado');continue;}
  IDs.add(r.id);
  if(!esSentenciaClasificada(r.materia)){excluir('tramite_no_sentencia');continue;}
  if(!esTextoJudicialSustantivo(r.sumario)){excluir('texto_insuficiente');continue;}
  if(!/^https:\/\/iol\.jus\.mendoza\.gov\.ar\/iol-api\/api\/public\/expedientes\/actuaciones\/pdf\?/.test(r.linkFallo||'')){excluir('pdf_no_oficial');continue;}
  if(!r.caratula||!r.expediente||!r.tribunal||!r.fecha){excluir('metadatos_incompletos');continue;}
  r.huellaTexto=crypto.createHash('sha256').update(r.sumario,'utf8').digest('hex');
  validos.push(r);
}
if(validos.length<15)throw Error('La depuración dejó pocos documentos verificables: '+validos.length);
if(anterior!==validos.length+Object.values(rechazos).reduce((a,n)=>a+n,0))throw Error('Inconsistencia de conteos');
lote.registros=validos;
lote.depuradoEn=new Date().toISOString();
lote.metodoValidacion='clasificarActuacionMza v2';
reporte.anteriores=0;
reporte.nuevos=validos.length;
reporte.comprobados=validos.length;
reporte.depuradosDelLoteAnterior=anterior-validos.length;
reporte.depuracion=rechazos;
for(const jornada of reporte.jornadas||[]){
 jornada.agregados=validos.filter(r=>r.fecha===jornada.fecha&&(jornada.fuero==='CC'?r.tribunal.includes('Cámara Civil'):r.tribunal.includes('Cámara del Trabajo'))).length;
}
const temp=archivo+'.tmp';
fs.writeFileSync(temp,zlib.gzipSync(JSON.stringify(lote),{level:8}));
fs.renameSync(temp,archivo);
fs.writeFileSync(reporteArchivo,JSON.stringify(reporte,null,2));
console.log(JSON.stringify({candidatasOriginales:anterior,verificadas:validos.length,excluidas:rechazos,porFuero:Object.fromEntries(['CC','CT'].map(f=>[f,validos.filter(r=>f==='CC'?r.tribunal.includes('Cámara Civil'):r.tribunal.includes('Cámara del Trabajo')).length]))}));
