/**
 * Cosecha acumulativa, paginada y prudente de fallos de Juristeca.
 *
 * El buscador oficial devuelve 50 fichas por página y un cursor basado en
 * el ID de la última. No se declara agotamiento por alcanzar un límite local.
 * Guarda los registros con su URL original y un informe de cobertura.
 *
 * MAX_PAGINAS=12 PAUSA_MS=1500 node scripts/cosecharJuristeca.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buscarJuristeca } from '../lib/indiceJuristeca.js';

const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const archivo=path.join(backend,'respaldo','juristeca.json.gz');
const informeArchivo=path.join(backend,'reporte-juristeca.json');
const MAX_PAGINAS=Math.min(80,Math.max(1,Number(process.env.MAX_PAGINAS||12)));
const PAUSA_MS=Math.max(1100,Number(process.env.PAUSA_MS||1750));
const consultas=(process.env.CONSULTAS||'daños,sentencia,contrato,consumidor,penal,familia,alimentos,laboral,despido,recurso,administrativo,amparo').split(',').map(q=>q.trim()).filter(Boolean);
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const resultado={fecha:new Date().toISOString(),consultas:[],anteriores:0,unicos:0,nuevos:0,errores:[],descartados:{},ejemplosDescartados:[],limitePaginas:MAX_PAGINAS};
const mapa=new Map();
try {
 const previo=JSON.parse(zlib.gunzipSync(await fs.readFile(archivo)).toString('utf8'));
 if(!Array.isArray(previo.registros))throw Error('Respaldo Juristeca sin registros[]');
 for(const r of previo.registros) {
  if(!r.id)throw Error('Respaldo Juristeca previo contiene ficha sin ID');
  mapa.set(r.id,r);
 }
} catch(e){if(e.code!=='ENOENT')throw e;}
resultado.anteriores=mapa.size;

async function guardar(){
 await fs.mkdir(path.dirname(archivo),{recursive:true});
 const temp=archivo+'.tmp';
 await fs.writeFile(temp,zlib.gzipSync(JSON.stringify({
  fuente:'juristeca',generado:new Date().toISOString(),registros:[...mapa.values()]
 }),{level:8}));
 await fs.rename(temp,archivo);
 resultado.unicos=mapa.size;
 resultado.nuevos=mapa.size-resultado.anteriores;
 await fs.writeFile(informeArchivo,JSON.stringify(resultado,null,2));
}
let fatal=false;
for(const q of consultas) {
 const t={q,totalFuente:null,paginas:0,fichasRecibidas:0,nuevos:0,estado:'pendiente'};
 let desde=null,pagina=1;
 const vistos=new Set();
 for(;pagina<=MAX_PAGINAS;pagina++){
  let r,fallo=null;
  for(let intento=1;intento<=3;intento++){
   try{r=await buscarJuristeca({q,modo:'todas',pagina,desde,porPagina:50});break;}
   catch(e){fallo=e;await dormir(PAUSA_MS*intento);}
  }
  if(!r){
   t.estado='error_fuente';
   t.error=String(fallo?.message||fallo);
   fatal=true;break;
  }
  if(t.totalFuente===null)t.totalFuente=r.totalFuente??r.total??null;
  const fichas=r.resultados||[];
  if(!Array.isArray(fichas)||((t.totalFuente||0)>0&&!fichas.length)){
   t.estado='respuesta_incompleta';
   fatal=true;break;
  }
  const anterior=mapa.size;
  for(const x of fichas){
   const motivo=!x?.id||!/^juristeca_\d+$/.test(x.id)?'id_invalido'
    :!/^https:\/\/juristeca\.jusbaires\.gob\.ar\/fallos\/[^?#]+\.pdf$/i.test(x.linkFallo||'')?'pdf_no_verificable'
    :!x.caratula||x.caratula==='(sin carátula)'?'sin_caratula'
    :!x.tribunal||x.tribunal.length<5?'sin_tribunal'
    :!/(?:19|20)\d{2}/.test(x.fecha||'')?'sin_fecha'
    :null;
   if(motivo){
    resultado.descartados[motivo]=(resultado.descartados[motivo]||0)+1;
    if(resultado.ejemplosDescartados.length<20)resultado.ejemplosDescartados.push({id:x?.id,motivo});
    continue;
   }
   // Mantener el mejor metadato si alguna consulta devolvió campos adicionales.
   const previo=mapa.get(x.id);
   mapa.set(x.id,previo?{...previo,...Object.fromEntries(Object.entries(x).filter(([,v])=>v!==null&&v!==undefined&&v!==''))}:{...x});
  }
  if(fatal)break;
  t.fichasRecibidas+=fichas.length;
  t.paginas++;
  t.nuevos+=mapa.size-anterior;
  const siguiente=r.siguienteDesde;
  console.log(JSON.stringify({q,pagina,recibidos:fichas.length,totalFuente:t.totalFuente,unicos:mapa.size,cursor:siguiente}));
  if(siguiente===null||siguiente===undefined){
   t.estado='agotada';break;
  }
  const clave=String(siguiente);
  if( vistos.has(clave) || clave===String(desde) ){
   t.estado='cursor_repetido';fatal=true;break;
  }
  vistos.add(clave);
  desde=siguiente;
  await dormir(PAUSA_MS);
 }
 if(t.estado==='pendiente')t.estado='limite_de_paginas';
 resultado.consultas.push(t);
 await guardar();
 console.log('CONSULTA '+JSON.stringify(t));
 if(fatal)break;
}
await guardar();
console.log('RESUMEN '+JSON.stringify({
 anteriores:resultado.anteriores,nuevos:resultado.nuevos,unicos:resultado.unicos,
 paginas:resultado.consultas.reduce((a,x)=>a+x.paginas,0),
 consultas:resultado.consultas.map(x=>({q:x.q,estado:x.estado,nuevos:x.nuevos,totalFuente:x.totalFuente})),
}));
if(fatal||!resultado.nuevos)process.exitCode=2;
