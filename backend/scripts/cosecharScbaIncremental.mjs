/**
 * Cosecha incremental de sumarios judiciales JUBA/SCBA.
 * Consulta por temas, pagina siguiendo la sesión del formulario oficial.
 * Mantiene todo respaldo previo, deduplica por ID y no publica errores.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buscarScba } from '../lib/indiceScba.js';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const archivo=path.join(raiz,'respaldo','scba.json.gz');
const informe=path.join(raiz,'reporte-scba.json');
const consultas=(process.env.CONSULTAS||'daño moral,daño punitivo,responsabilidad civil,accidente de tránsito,despido,alimentos,amparo,contrato,consumidor,intereses').split(',').map(x=>x.trim()).filter(Boolean);
const MAX_PAGINAS=Math.min(120,Math.max(1,Number(process.env.MAX_PAGINAS||25)));
const PAUSA_MS=Math.max(1700,Number(process.env.PAUSA_MS||2000));
const dormir=ms=>new Promise(ok=>setTimeout(ok,ms));
const mapa=new Map();
try {
 const previo=JSON.parse(zlib.gunzipSync(await fs.readFile(archivo)).toString('utf8'));
 if(!Array.isArray(previo.registros))throw Error('Respaldo SCBA previo inválido');
 for(const r of previo.registros)if(r.id)mapa.set(r.id,r);
} catch(e){if(e.code!=='ENOENT')throw e;}
const estado={fecha:new Date().toISOString(),anteriores:mapa.size,consultas:[],unicos:mapa.size,nuevos:0};
async function guardar(){
 await fs.mkdir(path.dirname(archivo),{recursive:true});
 const temp=archivo+'.tmp';
 await fs.writeFile(temp,zlib.gzipSync(JSON.stringify({fuente:'scba',generado:new Date().toISOString(),registros:[...mapa.values()]}),{level:8}));
 await fs.rename(temp,archivo);
 estado.unicos=mapa.size;estado.nuevos=mapa.size-estado.anteriores;
 await fs.writeFile(informe,JSON.stringify(estado,null,2));
}
let error=null;
for(const q of consultas){
 let desde=0;const dato={q,totalFuente:null,paginas:0,recibidos:0,nuevos:0,estado:'pendiente'};
 for(let pagina=1;pagina<=MAX_PAGINAS;pagina++){
  let r,ultimoError;
  for(let intento=1;intento<=3;intento++) {
   try{r=await buscarScba({q,modo:'todas',desde,porPagina:20});break;}
   catch(e){ultimoError=e;await dormir(PAUSA_MS*intento);}
  }
  if(!r){dato.estado='error_fuente';dato.error=String(ultimoError?.message||ultimoError);error=dato.error;break;}
  dato.totalFuente ??= r.totalFuente ?? r.total ?? null;
  if(!Array.isArray(r.resultados)||((dato.totalFuente||0)>0&&!r.resultados.length)) {
   dato.estado='pagina_sin_fichas';error=q+' no entregó fichas pese a '+dato.totalFuente;break;
  }
  const anterior=mapa.size;
  for(const x of r.resultados){
   if(!x?.id || !/^scba_[A-Z]\d{6,8}$/.test(x.id) || !/^https:\/\/juba\.scba\.gov\.ar\/VerTextoCompleto\.aspx\?idFallo=\d+$/i.test(x.linkFallo||'')){
    dato.estado='ficha_sin_enlace';error=q+' ficha sin ID o enlace oficial';break;
   }
   const antiguo=mapa.get(x.id);
   const ficha={...x,fuente:'scba',procedencia:'JUBA/SCBA - fallo oficial'};
   mapa.set(x.id,antiguo?{...antiguo,...Object.fromEntries(Object.entries(ficha).filter(([,v])=>v!==null&&v!==undefined&&v!==''))}:ficha);
  }
  if(error)break;
  dato.paginas++;dato.recibidos+=r.resultados.length;dato.nuevos+=mapa.size-anterior;
  console.log(JSON.stringify({q,pagina,totalFuente:dato.totalFuente,recibidos:r.resultados.length,nuevos:dato.nuevos,acumulados:mapa.size}));
  if(r.siguienteDesde===null||r.siguienteDesde===undefined){dato.estado='agotado';break;}
  const siguiente=Number(r.siguienteDesde);
  if(!Number.isSafeInteger(siguiente)||siguiente<=desde){dato.estado='cursor_invalido';error='SCBA no avanza cursor';break;}
  desde=siguiente;
  await dormir(PAUSA_MS);
 }
 if(dato.estado==='pendiente')dato.estado='limite_de_paginas';
 estado.consultas.push(dato);
 await guardar();
 console.log('CONSULTA '+JSON.stringify(dato));
 if(error)break;
}
await guardar();
console.log('RESUMEN '+JSON.stringify({unicos:estado.unicos,nuevos:estado.nuevos,
 consultas:estado.consultas.map(q=>({q:q.q,estado:q.estado,nuevos:q.nuevos,total:q.totalFuente}))}));
if(error||!estado.nuevos)throw Error(error||'Cosecha SCBA sin datos nuevos');
