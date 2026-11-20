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
      const lineas=texto.split(/\r?\n/);
      const señalados=lineas.map((linea,i)=>/funcion=armarSql|funcion=buscar|let tribunal|let tribu|parametros.*tribu|url:|sql:|post|data:|next_p|buscar\(/i.test(linea)?i:-1).filter(i=>i>=0);
      const ver=new Set();
      for(const i of señalados) for(let k=Math.max(0,i-2);k<=Math.min(lineas.length-1,i+3);k++)ver.add(k);
      console.log('CODIGO_SOLICITUD_OFICIAL '+JSON.stringify([...ver].sort((a,b)=>a-b).slice(0,105).map(i=>
        (i+1)+': '+lineas[i].trim().slice(0,220))));
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


const POST='https://wwwjuri.jus.mendoza.gov.ar/bib/jurisprudencia/funciones/consultar.php';
for(const caso of [{tribunal:'CC',q:'daño moral'},{tribunal:'CT',q:'despido'}]){
  try{
    const form=new URLSearchParams({funcion:'armarSql',mostrar:'20',tesauro:'',
      libre:caso.q,materia:'0',tribunal:caso.tribunal,expediente:'',partes:'',
      preopinante:'',cota:'0',fecha:'',ubica:'0',libro:'',fojas:'',
      norma:'0',numero:'',articulo:'',tribu:caso.tribunal,competencia:''});
    const cab={'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept':'text/html, */*;q=0.8'};
    const r1=await fetch(POST,{method:'POST',headers:cab,body:form,signal:AbortSignal.timeout(12000)});
    const texto=await r1.text(),corte=texto.indexOf('@@');
    console.log('FASE_OFICIAL '+JSON.stringify({tribunal:caso.tribunal,fase:'armarSql',
      http:r1.status,bytes:texto.length,separador:corte>=0}));
    if(!r1.ok||corte<0) continue;
    const total=Number(texto.slice(0,corte).match(/(\d+)\s*$/)?.[1]||0);
    if(!total)continue;
    const fichas=new URLSearchParams({funcion:'buscar',next_p:'1',total:String(total),
      mostrar:'10',sql:texto.slice(corte+2)});
    const r2=await fetch(POST,{method:'POST',headers:cab,body:fichas,
      signal:AbortSignal.timeout(12000)});
    const fichasHtml=await r2.text();
    console.log('FASE_OFICIAL '+JSON.stringify({tribunal:caso.tribunal,fase:'buscar',
      http:r2.status,bytes:fichasHtml.length,fichas:(fichasHtml.match(/class=["'][^"']*ficha/g)||[]).length,
      longitudSql:fichas.get('sql')?.length||0}));
  }catch(e){console.log('FASE_OFICIAL '+JSON.stringify({tribunal:caso.tribunal,error:e.name+' '+e.message}));}
}
