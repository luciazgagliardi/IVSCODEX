/**
 * Cosecha verificable de sentencias públicas mendocinas: listas oficiales por
 * día y fuero -> PDF de la actuación -> extracción de texto completo (FTS).
 *
 * No importa decretos, providencias ni expedientes activos como "fallos".
 * Los ítems sin PDF público, texto válido o campos esenciales se descartan.
 *
 * FECHAS=2026-09-07,2026-09-08 FUEROS=CC,CT MAX_DOCS=250 node scripts/cosecharListasMendoza.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { extraerPdf } from '../lib/extraerPdf.js';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const LISTAS='https://www2.jus.mendoza.gov.ar/listas/proveidos/';
const DESTINO=path.join(raiz,'respaldo','mendoza-listas.json.gz');
const REPORTE=path.join(raiz,'reporte-mendoza-listas.json');
const FUEROS={
 CC:{codigo:'03',etiqueta:'Cámara Civil de Mendoza',regex:/^1CC[1-9]\d*$/i},
 CT:{codigo:'04',etiqueta:'Cámara del Trabajo de Mendoza',regex:/^1CT[1-9]\d*$/i},
};
const FECHAS=(process.env.FECHAS||'2026-09-07,2026-09-08,2026-09-09,2026-09-10,2026-09-11').split(',').map(x=>x.trim()).filter(Boolean);
const FER=(process.env.FUEROS||'CC,CT').split(',').map(x=>x.trim()).filter(x=>x in FUEROS);
const MAX_DOCS=Math.min(900,Math.max(1,Number(process.env.MAX_DOCS||270)));
const PAUSA=Math.max(1000,Number(process.env.PAUSA_MS||1350));
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const fechaAr=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('Fecha inválida '+d);const [a,m,dia]=d.split('-');return dia+'/'+m+'/'+a;};
const mapa=new Map();
try {
 const guardado=JSON.parse(zlib.gunzipSync(await fs.readFile(DESTINO)).toString('utf8'));
 if(!Array.isArray(guardado.registros))throw Error('Respaldo de Mendoza sin registros[]');
 for(const r of guardado.registros){
  if(!/^mza_oficial_\d+$/.test(r?.id||''))throw Error('ID incorrecto en respaldo previo: '+r?.id);
  mapa.set(r.id,r);
 }
}catch(e){if(e.code!=='ENOENT')throw e;}
const informe={generado:new Date().toISOString(),anteriores:mapa.size,nuevos:0,
 procesados:0,candidatos:0,comprobados:0,descartados:{},errores:[],jornadas:[],limite:MAX_DOCS,datosRecuperables:0};
const rechazar=(razon)=>{informe.descartados[razon]=(informe.descartados[razon]||0)+1;};
const esPublicoPdf=u=>{
 try{const p=new URL(u);return p.protocol==='https:'&&p.hostname==='iol.jus.mendoza.gov.ar'&&p.pathname==='/iol-api/api/public/expedientes/actuaciones/pdf'&&p.searchParams.has('actId')&&p.searchParams.has('org')&&p.searchParams.has('expId');}
 catch{return false;}
};
export function extraerCandidatos(html,fuero,fecha){
 const doc=new JSDOM(html);
 const encontrados=new Map();
 try{
  for(const fila of doc.window.document.querySelectorAll('tr')){
   const boton=fila.querySelector('button[onclick*="vertex("]');
   if(!boton)continue;
   const id=/vertex\((\d{8,14})\)/.exec(boton.getAttribute('onclick')||'')?.[1];
   const td=[...fila.querySelectorAll('td')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
   if(td.length<7||!id||!FUEROS[fuero].regex.test(td[1]||''))continue;
   // La clase del proveído, NO el texto libre de la carátula.
   const clase=td[5]||'';
   if(!/\bSENTENCIA\b/i.test(clase)||/\b(?:DECRETO|PROVEIDO|PROVEÍDO|AUTO INTERLOCUTORIO)\b/i.test(clase))continue;
   const href=[...fila.querySelectorAll('a[href]')].map(a=>a.href).find(esPublicoPdf);
   if(!href)continue;
   const caratula=(td[4]||'').trim();
   const expediente=(td[2]||'').trim();
   if(!caratula||caratula.length<8||!expediente)continue;
   encontrados.set(id,{
    id:'mza_oficial_'+id,fuente:'mendoza',
    tribunal:FUEROS[fuero].etiqueta+' · '+td[1],
    fecha:/\b\d{2}\/\d{2}\/\d{4}\b/.exec(td[3]||'')?.[0]||fecha,
    expediente,caratula:caratula.slice(0,700),materia:clase.slice(0,150),
    voces:['sentencia',fuero==='CC'?'cámara civil':'cámara del trabajo'],
    tipo:'sentencia',linkFicha:LISTAS+'vertexto.php?ide='+id,linkFallo:href,
    procedencia:'Listas oficiales del Poder Judicial de Mendoza',
   });
  }
 }finally{doc.window.close();}
 return [...encontrados.values()];
}
async function traer(url,{post}={}){
 const r=await fetch(url,{method:post?'POST':'GET',
  body:post?post.toString():undefined,signal:AbortSignal.timeout(25000),
  headers:{'Content-Type':'application/x-www-form-urlencoded',
   'User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; consulta de sentencias publicas)','Accept':'text/html,application/pdf;q=0.9,*/*;q=0.5'}});
 if(!r.ok)throw Error('HTTP '+r.status);
 return r;
}
async function guardar(){
 await fs.mkdir(path.dirname(DESTINO),{recursive:true});
 const tmp=DESTINO+'.tmp';
 await fs.writeFile(tmp,zlib.gzipSync(JSON.stringify({
  fuente:'mendoza',origen:'Listas públicas PJ Mendoza',generado:new Date().toISOString(),
  registros:[...mapa.values()],
 }),{level:8}));
 await fs.rename(tmp,DESTINO);
 informe.nuevos=mapa.size-informe.anteriores;
 await fs.writeFile(REPORTE,JSON.stringify(informe,null,2));
}
let detener=false;
for(const dia of FECHAS){
 const fecha=fechaAr(dia);
 for(const fuero of FER){
  const estado={fecha,fuero,candidatos:0,agregados:0,estatus:'pendiente'};
  try{
   const fields=new URLSearchParams({nom2:'1',nom3:FUEROS[fuero].codigo,nom4:'99',
    tribunal:'01.'+FUEROS[fuero].codigo,sd:fecha,ed:fecha,numero:'',caratula:'',iduser:''});
   const html=await (await traer(LISTAS+'listas.php?consulta=1',{post:fields})).text();
   const candidatos=extraerCandidatos(html,fuero,fecha);
   estado.candidatos=candidatos.length;informe.candidatos+=candidatos.length;
   if(candidatos.length===0 && html.length<100000)estado.estatus='sin_entradas_verificables';
   for(const ficha of candidatos){
    if(mapa.size-informe.anteriores>=MAX_DOCS){detener=true;break;}
    if(mapa.has(ficha.id)){rechazar('ya_guardada');continue;}
    informe.procesados++;
    await dormir(PAUSA);
    try{
     const respuesta=await traer(ficha.linkFallo);
     const mime=respuesta.headers.get('content-type')||'';
     const largo=Number(respuesta.headers.get('content-length')||0);
     if(largo>8_000_000){rechazar('pdf_demasiado_grande');continue;}
     const pdf=Buffer.from(await respuesta.arrayBuffer());
     if(pdf.length>8_000_000||pdf.toString('ascii',0,5)!=='%PDF-'){rechazar('no_pdf_publico');continue;}
     const v=await extraerPdf(pdf);
     let texto=v.texto.replace(/\s+/g,' ').trim();
     // Prevenir fichas reducidas a carátula o a una providencia sin fundamentos.
     if(texto.length<700){rechazar('texto_insuficiente');continue;}
     if(!/\b(?:RESUELVE|FALLO|CONSIDERANDO|SENTENCIA DEFINITIVA|AUTOS Y VISTOS|VISTOS)\b/i.test(texto)){
      rechazar('sin_estructura_judicial');continue;
     }
     if(texto.length>130000)texto=texto.slice(0,130000);
     mapa.set(ficha.id,{...ficha,sumario:texto,extensionTexto:v.paginas});
     estado.agregados++;
     informe.comprobados++;
    }catch(e){
     rechazar('descarga_o_extraccion_fallida');
     if(informe.errores.length<30)informe.errores.push({id:ficha.id,codigo:String(e?.message||e).slice(0,120)});
    }
   }
   if(estado.estatus==='pendiente')estado.estatus=detener?'limite_documentos':'consultada';
  }catch(e){estado.estatus='error_fuente';informe.errores.push({fuero,fecha,error:String(e.message).slice(0,120)});}
  informe.jornadas.push(estado);
  await guardar();
  console.log('JORNADA '+JSON.stringify({...estado,totalUnicos:mapa.size,descartados:informe.descartados}));
  if(detener)break;
  await dormir(PAUSA);
 }
 if(detener)break;
}
await guardar();
console.log('MENDOZA_RESUMEN '+JSON.stringify({
 anteriores:informe.anteriores,nuevos:informe.nuevos,unicos:mapa.size,
 candidatos:informe.candidatos,comprobados:informe.comprobados,descartados:informe.descartados,
 jornadas:informe.jornadas.map(x=>({fecha:x.fecha,fuero:x.fuero,agregados:x.agregados,estatus:x.estatus})),
}));
if(informe.nuevos<15)throw Error('Cosecha Mendoza insuficiente ('+informe.nuevos+'); no publicar');
