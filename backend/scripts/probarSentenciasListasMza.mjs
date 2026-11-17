import { JSDOM } from 'jsdom';
const url='https://www2.jus.mendoza.gov.ar/listas/proveidos/listas.php?consulta=1';
const pares=[['CC','03'],['CT','04']];
for(const [fuero,codigo] of pares) {
 const p=new URLSearchParams({nom2:'1',nom3:codigo,nom4:'99',tribunal:'01.'+codigo,
 sd:'11/09/2026',ed:'11/09/2026',numero:'',caratula:'',iduser:''});
 const r=await fetch(url,{method:'POST',body:p,headers:{'User-Agent':'IVS-CODEX jurisprudence research','Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(20000)});
 const dom=new JSDOM(await r.text());const filas=[...dom.window.document.querySelectorAll('tr')];
 const candidatos=[];let conTexto=0;
 for(const tr of filas) {
  const b=tr.querySelector('button[onclick*="vertex("]');
  if(!b)continue;
  conTexto++;
  const tds=[...tr.querySelectorAll('td')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
  const id=/vertex\((\d+)\)/.exec(b.getAttribute('onclick')||'')?.[1];
  const finales=tds.slice(-3).map(x=>x.slice(0,150));
  if(tds.some(x=>/\bsentencia\b|resuelve|fallo definitivo|resolucion final/i.test(x))) {
   candidatos.push({id,tribunal:tds.slice(0,3).map(x=>x.slice(0,20)),ultimos:finales});
  }
 }
 console.log('MENDOZA_LISTA '+JSON.stringify({fuero,status:r.status,filas:filas.length,conTexto,candidatos:candidatos.length,muestras:candidatos.slice(0,6)}));
 dom.window.close();await new Promise(ok=>setTimeout(ok,1800));
}
