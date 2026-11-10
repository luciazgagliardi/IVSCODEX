/**
 * Prueba de punta a punta sin credenciales ni escrituras. Comprueba que Azure
 * publica la misma versión que la rama acervo de GitHub y recupera sentencias
 * recién incorporadas con FTS íntegro (no desde el respaldo parcial).
 */
const api='https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api';
const manifestUrl='https://raw.githubusercontent.com/luciazgagliardi/IVSCODEX/acervo/manifiesto.json';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,init={}){
  const respuesta=await fetch(url,{...init,signal:AbortSignal.timeout(init.timeout||50000)});
  const cuerpo=await respuesta.json();
  if(!respuesta.ok)throw Error('HTTP '+respuesta.status+': '+url+' '+JSON.stringify(cuerpo).slice(0,200));
  return cuerpo;
}
const manifest=await json(manifestUrl+'?ci='+Date.now(),{timeout:15000});
for(const [fuente,minimo] of Object.entries({mendoza:920,scba:9138,juristeca:7470,saij:764034})){
  if((manifest.conteos?.[fuente]||0)<minimo)throw Error('El manifiesto aún no incluye '+fuente+' '+minimo);
}
console.log('MANIFIESTO '+JSON.stringify({version:manifest.version,conteos:manifest.conteos}));
let estado=null;
for(let intento=1;intento<=70;intento++){
  try{
    estado=await json(api+'/acervo/estado',{timeout:18000});
    const listo=estado.activo && !estado.importando && estado.version===manifest.version &&
      Object.entries(manifest.conteos).every(([f,n])=>(estado.conteos?.[f]||0)>=n);
    console.log('PREPARACION '+JSON.stringify({intento,version:estado.version,activo:estado.activo,importando:estado.importando,error:estado.error,listo}));
    if(listo)break;
  }catch(e){console.log('PREPARACION_ERROR '+String(e.message));}
  await delay(9000);
}
if(!estado?.activo||estado?.importando||estado.version!==manifest.version)
  throw Error('Azure no está sirviendo el acervo oficial más reciente');
for(const [fuente,n] of Object.entries(manifest.conteos)){
  if((estado.conteos?.[fuente]||0)<n)throw Error('Regresión en Azure: '+fuente);
}
const pruebas=[
 {q:'daño moral',tribunal:'',variantes:['daño extrapatrimonial','consecuencias no patrimoniales','agravio moral','daño inmaterial'],minimo:397},
 {q:'daño punitivo',tribunal:'',variantes:['multa civil','sanción pecuniaria disuasiva'],minimo:21},
 {q:'ROSALES STELLA',tribunal:'CC',id:'mza_oficial_12299855003',minimo:1},
 {q:'ARIAS MARTINEZ',tribunal:'CT',id:'mza_oficial_12300199902',minimo:1},
];
for(const p of pruebas){
  let d=null,error=null;
  for(let intento=0;intento<2;intento++){
    try{
      d=await json(api+'/indice/mendoza/buscar',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({q:p.q,tribunal:p.tribunal,variantes:p.variantes||[],modo:'todas',porPagina:40}),
        timeout:55000});
      if(!d.ok)throw Error('API ok=false '+(d.codigo||''));
      if(d.total<p.minimo)throw Error('Menos coincidencias que el corpus: '+d.total+' < '+p.minimo);
      if(p.id && !(d.resultados||[]).some(x=>x.id===p.id))throw Error('No se recuperó el fallo oficial '+p.id);
      error=null;break;
    }catch(e){error=e;await delay(2500);}
  }
  console.log('RECUPERACION '+JSON.stringify({q:p.q,tribunal:p.tribunal,total:d?.total,minimo:p.minimo,fallo:p.id||null,correcto:!error}));
  if(error)throw error;
}
estado=await json(api+'/acervo/estado',{timeout:20000});
console.log('LECTURA '+JSON.stringify({version:estado.version,lectura:estado.lectura,errorHilo:estado.errorHilo,errorCopia:estado.errorCopia}));
if(!estado.lectura?.modo)throw Error('Los resultados podrían venir del respaldo parcial: FTS no confirma lectura');
if(estado.errorHilo)throw Error('Error del lector SQLite: '+estado.errorHilo);
console.log('SMOKE_COMPLETO_OK '+JSON.stringify({version:manifest.version,mendoza:manifest.conteos.mendoza,scba:manifest.conteos.scba,juristeca:manifest.conteos.juristeca}));
