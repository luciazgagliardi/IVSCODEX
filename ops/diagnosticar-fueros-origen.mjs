/**
 * Diagnóstico acotado del formulario de jurisprudencia mendocino.
 * Se ejecuta desde GitHub Actions y usa el mismo cliente que IVS CODEX.
 * No escribe datos ni publica documentos.
 */
import { buscarMza } from '../backend/lib/indiceMza.js';

const base='https://wwwjuri.jus.mendoza.gov.ar/bib/jurisprudencia/consultar.php';
try {
  const html=await (await fetch(base,{signal:AbortSignal.timeout(15000)})).text();
  const scripts=[...html.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
    .map(x=>x[1]);
  console.log('FORMULARIO '+JSON.stringify({bytes:html.length,scripts:scripts.slice(0,24)}));
  for(const code of ['SC','CC','CT','CF']){
    const partes=[...html.matchAll(new RegExp('.{0,95}'+code+'.{0,130}','gi'))]
      .map(m=>m[0].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,200)).slice(0,7);
    console.log('PARAMETROS_VISTA '+JSON.stringify({tribunal:code,contextos:partes}));
  }
  const js=scripts.find(x=>/consultar|jurisprudencia/i.test(x));
  if(js){
    const url=new URL(js,base);
    if(url.hostname==='wwwjuri.jus.mendoza.gov.ar'){
      const texto=await (await fetch(url,{signal:AbortSignal.timeout(15000)})).text();
      const contextos=['SC','CC','CT','CF','armarSql','tribu'].flatMap(code=>
        [...texto.matchAll(new RegExp('.{0,110}'+code+'.{0,140}','gi'))]
          .slice(0,4).map(x=>x[0].slice(0,250)));
      console.log('SCRIPT_OFICIAL '+JSON.stringify({src:url.pathname,bytes:texto.length,contextos:contextos.slice(0,20)}));
    }
  }
}catch(e){console.log('FORMULARIO_ERROR '+e.name+' '+String(e.message).slice(0,200));}

for(const caso of [
  {tribunal:'SC',q:'daño moral'},
  {tribunal:'CC',q:'daño moral'},
  {tribunal:'CT',q:'despido'},
  {tribunal:'CF',q:'alimentos'}
]){
  const t0=Date.now();
  try {
    const d=await buscarMza({...caso,modo:'todas',porPagina:10});
    console.log('FUERO_ORIGEN '+JSON.stringify({tribunal:caso.tribunal,q:caso.q,total:d.total,
      totalFuente:d.totalFuente,fichas:d.resultados?.length,
      muestraTribunal:d.resultados?.[0]?.tribunal||null,ms:Date.now()-t0}));
  }catch(e){
    console.log('FUERO_ORIGEN '+JSON.stringify({tribunal:caso.tribunal,q:caso.q,ok:false,
      codigo:e.codigo||e.code||e.name,detalle:String(e.message).slice(0,220),ms:Date.now()-t0}));
  }
}
