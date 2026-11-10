/**
 * Un solo sondeo de metadatos de la lista judicial PUBLICA de Mendoza.
 * No descarga ni guarda nombres de partes o expedientes; identifica el
 * formulario para una eventual cosecha sólo de sentencias publicadas.
 */
const url='https://www2.jus.mendoza.gov.ar/listas/proveidos/listas.php';
try {
 const r=await fetch(url,{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; consulta de acceso publico)'},signal:AbortSignal.timeout(20000)});
 const html=await r.text();
 const forms=[...html.matchAll(/<form\b([^>]*)>/gi)].map(m=>m[1].slice(0,350));
 const selects=[...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)].map(m=>({atributos:m[1].slice(0,250),opciones:[...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].slice(0,12).map(x=>({valor:/value=["']([^"']*)/.exec(x[1])?.[1],texto:x[2].replace(/<[^>]+>/g,' ').trim().slice(0,80)}))}));
 const inputs=[...html.matchAll(/<input\b([^>]*)>/gi)].map(m=>m[1].slice(0,250)).filter(x=>/name=/i.test(x)).slice(0,50);
 const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)/gi)].map(m=>m[1]).slice(0,30);
 console.log(JSON.stringify({http:r.status,bytes:html.length,forms,selects,inputs,scripts,hasOfficialLinks:/vertexto\.php\?ide=/i.test(html),hasListas:/Consultar Lista|Listas de Tribunales/i.test(html)},null,2));
 if(!r.ok)process.exitCode=2;
}catch(e){console.error(String(e));process.exitCode=2}


const muestras=[];
for(const fecha of ['09/11/2026','09-11-2026']){
 try{
  const params=new URLSearchParams({nom2:'01',nom3:'',nom4:'',tribunal:'',sd:fecha,ed:fecha,numero:'',caratula:'',iduser:''});
  const resp=await fetch(url+'?consulta=1',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; consulta de acceso publico)'},body:params.toString(),signal:AbortSignal.timeout(20000)});
  const html=await resp.text();
  muestras.push({fecha,http:resp.status,bytes:html.length,cantidadLinks:(html.match(/vertexto\.php\?ide=/g)||[]).length,
   cantidadSentencias:(html.match(/\bSENTENCIA\b/gi)||[]).length,
   reconoceLista:/Lista del|Total:|No hay datos/i.test(html),
   encabezado:html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,155)});
 }catch(e){muestras.push({fecha,error:String(e.message)})}
 await new Promise(ok=>setTimeout(ok,1500));
}
console.log('PRUEBAS_FECHA '+JSON.stringify(muestras));
