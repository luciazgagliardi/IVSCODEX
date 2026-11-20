/** Medición externa de tiempo hasta las primeras fichas y total exacto.
 * No se inventan números: las cifras se obtienen del backend publicado.
 */
const api = 'https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api';
const pruebas=[
  {slug:'mendoza',q:'daño moral'},
  {slug:'saij',q:'despido'},
  {slug:'caba',q:'amparo'},
  {slug:'csjn',q:'amparo'},
];
const medir=async({slug,q})=>{
  const inicio=Date.now();
  try{
    const r=await fetch(api+'/indice/'+slug+'/local',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({q,modo:'todas',rapida:true}),
      signal:AbortSignal.timeout(15000)
    });
    const d=await r.json();
    const dato={fuente:slug,q,ms:Date.now()-inicio,http:r.status,ok:d.ok,
      fichas:d.resultados?.length||0,totalPendiente:d.totalPendiente,
      origen:d.origenAcervo||null,error:d.codigo||null};
    console.log('LATENCIA_PRIMERA_PAGINA '+JSON.stringify(dato));
    return dato;
  }catch(e){
    const dato={fuente:slug,q,ms:Date.now()-inicio,ok:false,error:e.name||e.message};
    console.log('LATENCIA_PRIMERA_PAGINA '+JSON.stringify(dato));
    return dato;
  }
};
const resultados=await Promise.all(pruebas.map(medir));
console.log('RESUMEN_LATENCIA '+JSON.stringify({
  fuentes:resultados.length,
  respondieron:resultados.filter(x=>x.ok&&x.fichas>0).length,
  medianaMs:[...resultados.map(x=>x.ms)].sort((a,b)=>a-b)[1]||null,
  lentas:resultados.filter(x=>x.ms>4000).map(x=>x.fuente)
}));
// Diagnóstico: una fuente sin conexión no debe invalidar las mediciones
// de las otras. Las pruebas unitarias comprueban estructura y paginación.


const conteos=await Promise.all([
  {slug:'mendoza',q:'daño moral'},
  {slug:'saij',q:'despido'}
].map(async({slug,q})=>{
  const inicio=Date.now();
  try{
    const r=await fetch(api+'/indice/'+slug+'/local',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({q,modo:'todas',soloConteo:true}),
      signal:AbortSignal.timeout(55000)
    });
    const d=await r.json();
    const dato={fuente:slug,q,ms:Date.now()-inicio,http:r.status,
      ok:d.ok,soloConteo:d.soloConteo===true,total:d.total??null,error:d.codigo||null};
    console.log('LATENCIA_TOTAL_EXACTO '+JSON.stringify(dato));
    return dato;
  }catch(e){
    const dato={fuente:slug,q,ms:Date.now()-inicio,ok:false,error:e.name||e.message};
    console.log('LATENCIA_TOTAL_EXACTO '+JSON.stringify(dato));
    return dato;
  }
}));
console.log('RESUMEN_CONTEO '+JSON.stringify({respondieron:conteos.filter(x=>x.ok&&x.soloConteo).length,
  lentos:conteos.filter(x=>x.ms>10000).map(x=>x.fuente)}));
