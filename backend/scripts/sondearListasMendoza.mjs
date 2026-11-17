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
 const extraer=palabra=>{const i=html.indexOf(palabra);return i<0?null:html.slice(Math.max(0,i-200),i+900).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,900);};
 const pistas={nom2:extraer('id="nom2"'),sd:extraer('id="sd"'),cambioNom2:extraer('function cambio_nom2'),cambioFecha:extraer('function cambio_fecha2'),consultar:extraer('Consultar Lista')};
 console.log(JSON.stringify({http:r.status,bytes:html.length,forms,selects,inputs,scripts,hasOfficialLinks:/vertexto\.php\?ide=/i.test(html),hasListas:/Consultar Lista|Listas de Tribunales/i.test(html),pistas},null,2));
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


try {
 const raw=await (await fetch(url,{signal:AbortSignal.timeout(15000)})).text();
 const cerca=palabra=>{const i=raw.indexOf(palabra);return i<0?null:raw.slice(Math.max(0,i-150),i+1400)};
 const menus=[...raw.matchAll(/(?:var\s+)?(menu_[a-zA-Z0-9_]+)\s*=\s*(\[[^;]{0,1800}\])/g)]
  .slice(0,12).map(m=>({nombre:m[1],valores:m[2].slice(0,260)}));
 console.log('FORMULARIO_JS '+JSON.stringify({inicio:cerca('function inicializar()'),codigos:cerca('cod_1='),menus},null,2));
}catch(e){console.log('FORMULARIO_JS_ERROR '+String(e.message))}

try {
 const raw=await (await fetch(url,{signal:AbortSignal.timeout(15000)})).text();
 const men=raw.indexOf('menu_0');
 const cod=raw.indexOf('var codori=');
 console.log('ARBOL_TRIBUNALES '+JSON.stringify({menuPrimer:men>=0?raw.slice(Math.max(0,men-120),men+1300):'',codOriginal:cod>=0?raw.slice(cod,cod+300):''}));
}catch(e){console.log('ARBOL_TRIBUNALES '+String(e.message))}

try {
 const raw=await (await fetch(url,{signal:AbortSignal.timeout(15000)})).text();
 const ver=t=>{const i=raw.indexOf(t);return i<0?'':raw.slice(i,i+1300)};
 console.log('CODIGOS_CAMARAS '+JSON.stringify({civil:ver('menu_0103'),laboral:ver('menu_0104'),cambioTribunal:ver('function cambio_nom4'),personal:ver('function cambio_personal')}).slice(0,4900));
}catch(e){console.log('CODIGOS_ERROR '+String(e.message))}


for (const [etiqueta,nom3,tribunal] of [['civil','03','01.03'],['laboral','04','01.04']]) {
 try {
  const campos=new URLSearchParams({
   nom2:'1',nom3,nom4:'99',tribunal,sd:'09/11/2026',ed:'09/11/2026',
   numero:'',caratula:'',iduser:'',
  });
  const respuesta=await fetch(url+'?consulta=1',{
   method:'POST',body:campos.toString(),headers:{
    'Content-Type':'application/x-www-form-urlencoded',
    'User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; investigación de jurisprudencia publicada)',
   },signal:AbortSignal.timeout(20000),
  });
  const html=await respuesta.text();
  const enlaces=[...html.matchAll(/(?:href=["'][^"']*)?vertexto\.php\?ide=(\d+)/gi)].map(x=>x[1]);
  console.log('SONDEO_TRIBUNAL '+JSON.stringify({
   etiqueta,http:respuesta.status,htmlCaracteres:html.length,
   enlacesUnicos:new Set(enlaces).size,aparicionesSentencia:(html.match(/\bSENTENCIA\b/gi)||[]).length,
   tablas:(html.match(/<tr\b/gi)||[]).length,
   pareceFormulario:/id="nom2"/.test(html),pareceListado:/dataTables|lista de tribunales/i.test(html),
  }));
 } catch(e){console.log('SONDEO_TRIBUNAL '+JSON.stringify({etiqueta,error:String(e.message)}));}
 await new Promise(ok=>setTimeout(ok,2000));
}

for(const fecha of ['11/09/2026','09/10/2026']){
 try{
  const body=new URLSearchParams({nom2:'1',nom3:'03',nom4:'99',tribunal:'01.03',
   sd:fecha,ed:fecha,numero:'',caratula:'',iduser:''});
  const respuesta=await fetch(url+'?consulta=1',{method:'POST',body:body.toString(),
   headers:{'Content-Type':'application/x-www-form-urlencoded',
    'User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; acceso publico judicial)'},
   signal:AbortSignal.timeout(20000)});
  const html=await respuesta.text();
  console.log('FECHA_HISTORICA '+JSON.stringify({fecha,status:respuesta.status,
   enlaces:(html.match(/vertexto\.php\?ide=\d+/g)||[]).length,
   htmlChars:html.length,filas:(html.match(/<tr\b/gi)||[]).length,
   sinDatos:/No hay datos con las opciones/i.test(html),
   fechaEncontrada:html.includes(fecha)}));
 }catch(e){console.log('FECHA_HISTORICA '+JSON.stringify({fecha,error:String(e.message)}))}
 await new Promise(ok=>setTimeout(ok,2000));
}

try{
 const body=new URLSearchParams({nom2:'1',nom3:'03',nom4:'99',tribunal:'01.03',sd:'11/09/2026',ed:'11/09/2026',numero:'',caratula:'',iduser:''});
 const r=await fetch(url+'?consulta=1',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; jurisprudencia abierta)'},body:body.toString(),signal:AbortSignal.timeout(20000)});
 const html=await r.text();
 const attrs=[...html.matchAll(/<button\b([^>]*)>/gi)].slice(0,5).map(x=>x[1]);
 const inputs=[...html.matchAll(/<a\b([^>]*)>/gi)].slice(0,9).map(x=>x[1].slice(0,220));
 const v=html.indexOf('vertexto.php'),v2=html.indexOf('ver_texto'),v3=html.indexOf('onclick=');
 const funcs=[...html.matchAll(/function\s+([a-z_]*(?:texto|ver|abrir|mostrar|html)[a-z_]*)\s*\([^)]*\)/gi)].slice(0,20).map(x=>x[0]);
 console.log('HTML_RESOLUCION '+JSON.stringify({buttons:attrs,links:inputs,funcs,
  vertexto:v<0?'no':html.slice(Math.max(0,v-350),v+260),
  verTexto:v2<0?'no':html.slice(Math.max(0,v2-180),v2+190),
  onclick:v3<0?'no':html.slice(Math.max(0,v3-60),v3+180),
  textoHTML:(html.match(/>HTML</gi)||[]).length,
  scripts:[...html.matchAll(/<script[^>]*src=["']([^"']+)/gi)].map(x=>x[1]).slice(0,18),
 }));
}catch(e){console.log('HTML_RESOLUCION_ERROR '+String(e.message))}
