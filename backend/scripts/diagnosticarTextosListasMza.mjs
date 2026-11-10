/**
 * Sondeo del formato de sentencias públicas para una cosecha masiva:
 * datos agregados, sin publicar nombres ni contenido de expedientes.
 */
import { JSDOM } from 'jsdom';
const base='https://www2.jus.mendoza.gov.ar/listas/proveidos/';
const ids=['12279906530','12279880717','12280382049','12279962199'];
for(const id of ids){
  for(const domain of [base,'https://wwwnoti.jus.mendoza.gov.ar/listas/proveidos/']){
    try{
      const resp=await fetch(domain+'vertexto.php?ide='+id,{signal:AbortSignal.timeout(15000),
        headers:{'User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; investigacion jurisprudencia publica)'}});
      const html=await resp.text(),doc=new JSDOM(html);
      const t=(doc.window.document.body?.textContent||'').replace(/\s+/g,' ').trim();
      const words=['SENTENCIA','RESUELVE','FALLO','VISTOS','RESULTA','CONSIDERANDO','CÁMARA','AUTOS Y VISTOS'];
      console.log('TEXTO_OFICIAL '+JSON.stringify({id,host:new URL(domain).host,http:resp.status,
       bytes:html.length,textLength:t.length,title:doc.window.document.title||'',
       pdf:/\.pdf/i.test(html),marcas:Object.fromEntries(words.map(x=>[x,new RegExp(x,'i').test(t)])),
       etiquetas:doc.window.document.querySelectorAll('p').length}));
      doc.window.close();
      if(resp.ok&&t.length>180)break;
    }catch(e){console.log('TEXTO_OFICIAL '+JSON.stringify({id,host:new URL(domain).host,error:e.message}));}
  }
  await new Promise(ok=>setTimeout(ok,1200));
}
const params=new URLSearchParams({nom2:'1',nom3:'03',nom4:'99',tribunal:'01.03',sd:'11/09/2026',ed:'11/09/2026',numero:'',caratula:'',iduser:''});
const r=await fetch(base+'listas.php?consulta=1',{method:'POST',body:params,
  headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(18000)});
const doc=new JSDOM(await r.text());
const resumen=[];
for(const tr of doc.window.document.querySelectorAll('tr')){
 const btn=tr.querySelector('button[onclick*="vertex("]');
 if(!btn)continue;
 const cells=[...tr.querySelectorAll('td')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
 if(!cells.some(x=>/\bsentencia\b/i.test(x)))continue;
 const positions=cells.map((c,i)=>/\bsentencia\b/i.test(c)?i:null).filter(x=>x!==null);
 const enlaces=[...tr.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(x=>/^https?:\/\//.test(x||''));
 resumen.push({columnas:cells.length,indiceDeSentencia:positions,hayPdf:enlaces.some(x=>x.includes('/pdf?')),
  longitudCeldas:cells.map(x=>x.length)});
}
console.log('ESTRUCTURA_FILAS '+JSON.stringify({candidatas:resumen.length,tipos:resumen.slice(0,10)}));
doc.window.close();
