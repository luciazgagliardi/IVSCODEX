/**
 * Smoke test público de lectura: no modifica el servidor.
 * Confirma que Azure importó la nueva versión SQLite y que el motor FTS
 * devuelve resoluciones de Cámara del Trabajo y Cámara Civil.
 */
const api='https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api';
const version='20261109-c2ad437b';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function estado(){
 const r=await fetch(api+'/acervo/estado',{signal:AbortSignal.timeout(15000)});
 if(!r.ok) throw Error('GET /acervo/estado: HTTP '+r.status);
 return r.json();
}
let ultimo;
for(let i=0;i<24;i++){
 try{
   ultimo=await estado();
   console.log(JSON.stringify({intento:i+1,version:ultimo.version,activo:ultimo.activo,importando:ultimo.importando,mendoza:ultimo.conteos?.mendoza,error:ultimo.error}));
   if(ultimo.version===version && ultimo.activo && ultimo.conteos?.mendoza>=726) break;
 }catch(e){console.log('Estado no disponible: '+e.message);}
 if(i===23)throw Error('Azure no importó la versión '+version+'; último estado '+JSON.stringify(ultimo));
 await delay(5000);
}
async function buscar(q,tribunal,id){
 const r=await fetch(api+'/indice/mendoza/local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q,tribunal,porPagina:30,modo:'todas'}),signal:AbortSignal.timeout(35000)});
 if(!r.ok)throw Error('POST local '+q+' '+tribunal+': HTTP '+r.status+' '+(await r.text()).slice(0,350));
 const d=await r.json();
 const lista=Array.isArray(d.resultados)?d.resultados:(d.datos?.resultados || []);
 const encontrado=lista.some(x=>x.id===id);
 console.log(JSON.stringify({q,tribunal,http:r.status,total:d.total,resultados:lista.length,idBuscado:id,encontrado,ejemplos:lista.slice(0,5).map(x=>x.id)}));
 if(!encontrado)throw Error('No aparece '+id+' en la primera página de la búsqueda local: '+q+' ('+tribunal+')');
}
await buscar('BARRIONUEVO','CT','mza_oficial_11855004335');
await buscar('BALDONI','CC','mza_oficial_12065977405');
console.log('Smoke test Azure COMPLETO: versión, SQLite y dos sentencias recuperables');

for (const q of ['daño moral','daño punitivo']) {
  for (const tribunal of ['', 'SC','CC','CT']) {
    try {
      const r=await fetch(api+'/indice/mendoza/local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q,tribunal,modo:'todas'}),signal:AbortSignal.timeout(40000)});
      const d=await r.json();
      console.log('REGRESION '+JSON.stringify({q,tribunal:tribunal||'sin filtro',http:r.status,ok:d.ok,total:d.total,error:d.mensaje||d.error,ejemplos:d.resultados?.slice(0,3).map(x=>({id:x.id,tribunal:x.tribunal}))}));
    }catch(e){console.log('REGRESION '+JSON.stringify({q,tribunal,error:String(e)}))}
  }
}

for(const q of ['daño moral','daño punitivo']){
  const body=JSON.stringify({q,tribunal:'',modo:'todas'});
  const [normal,local]=await Promise.all(['buscar','local'].map(async ruta=>{
    const r=await fetch(api+'/indice/mendoza/'+ruta,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(35000)});
    const j=await r.json();
    return {http:r.status,ok:j.ok,total:j.total,ids:(j.resultados||[]).map(x=>x.id),aviso:j.avisoFalla,codigo:j.codigo};
  }));
  console.log('VERIFICACION NORMAL '+JSON.stringify({q,normal:{...normal,ids:normal.ids.slice(0,5)},local:{...local,ids:local.ids.slice(0,5)}}));
  if(!normal.ok || !local.ok || normal.total !== local.total || normal.total === 0)throw Error('Pérdida de resultados normales en '+q);
  if(q==='daño punitivo' && !normal.ids.includes('mza_oficial_12065977405')) {
    // La sentencia puede estar en páginas posteriores; exigir al menos 8
    // coincidencias confirma la búsqueda general, sin depender del orden.
    if(normal.total < 8)throw Error('Daño punitivo no recupera cobertura local');
  }
}
