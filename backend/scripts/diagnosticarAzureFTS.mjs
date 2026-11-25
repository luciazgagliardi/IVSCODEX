const api='https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api';
const variantes={
 'daño moral':['daño extrapatrimonial','consecuencias no patrimoniales','agravio moral','daño inmaterial'],
 'daño punitivo':['multa civil','sanción pecuniaria disuasiva'],
};
async function leerEstado(){
 const r=await fetch(api+'/acervo/estado',{signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Estado HTTP '+r.status);
 const s=await r.json();
 return {version:s.version,activo:s.activo,importando:s.importando,error:s.error,errorCopia:s.errorCopia,errorHilo:s.errorHilo,lectura:s.lectura,conteos:s.conteos};
}
console.log('AZURE_ESTADO_INICIO '+JSON.stringify(await leerEstado()));
for(const [q,v] of Object.entries(variantes)){
 for(const ruta of ['local','buscar']){
  const t=Date.now();
  try{
   const r=await fetch(api+'/indice/mendoza/'+ruta,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q,modo:'todas',tribunal:'',variantes:v,porPagina:10}),signal:AbortSignal.timeout(60000)});
   const d=await r.json();
   console.log('AZURE_BUSQUEDA '+JSON.stringify({ruta,q,http:r.status,ms:Date.now()-t,ok:d.ok,total:d.total,totalFuente:d.totalFuente,desdeIndiceLocal:d.desdeIndiceLocal,avisoFalla:d.avisoFalla,codigo:d.codigo,primeros:(d.resultados||[]).slice(0,3).map(x=>({id:x.id,fuente:x.fuente,desdeAcervo:x.desdeAcervo}))}));
  }catch(e){console.log('AZURE_ERROR '+JSON.stringify({ruta,q,error:String(e.message),ms:Date.now()-t}));}
 }
}
console.log('AZURE_ESTADO_FINAL '+JSON.stringify(await leerEstado()));
