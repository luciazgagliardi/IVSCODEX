/**
 * Smoke test de lectura: exige importación real del corpus depurado en Azure.
 * No modifica el servidor y no guarda datos de las partes judiciales.
 */
const API='https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api';
const PAUSA=ms=>new Promise(r=>setTimeout(r,ms));
async function estado(){
 const r=await fetch(API+'/acervo/estado',{signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Estado del acervo HTTP '+r.status);
 return r.json();
}
let listo=false,ultima=null;
for(let i=0;i<50;i++){
 try{
  ultima=await estado();
  console.log('ESTADO '+JSON.stringify({intento:i+1,version:ultima.version,activo:ultima.activo,mendoza:ultima.conteos?.mendoza,juristeca:ultima.conteos?.juristeca,importando:ultima.importando}));
  if(ultima.activo===true && ultima.conteos?.mendoza>=820 && ultima.conteos?.juristeca>=7470){listo=true;break;}
 }catch(e){console.log('ESTADO_ERROR '+String(e.message))}
 await PAUSA(7000);
}
if(!listo)throw Error('Azure aún no sirve el corpus ampliado: '+JSON.stringify(ultima));

async function buscar(q,tribunal,esperado,variantes=[]){
 for(let intento=1;intento<=2;intento++){
  try{
   const r=await fetch(API+'/indice/mendoza/buscar',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({q,tribunal,modo:'todas',porPagina:30,variantes}),
    signal:AbortSignal.timeout(50000),
   });
   const d=await r.json();
   if(!r.ok||!d.ok)throw Error('Búsqueda HTTP '+r.status+' '+(d.codigo||''));
   const ids=(d.resultados||[]).map(x=>x.id);
   console.log('BUSQUEDA '+JSON.stringify({q,tribunal,total:d.total,coincidencias:ids.length,contieneId:esperado?ids.includes(esperado):null}));
   if(!d.total)throw Error('Resultado vacío: '+q);
   if(esperado && !ids.includes(esperado))throw Error('Sentencia '+esperado+' no se recupera: '+q);
   return d.total;
  }catch(e){if(intento===2)throw e;await PAUSA(3000);}
 }
}
await buscar('CORNEJO LAURA','CC','mza_oficial_12262907892');
await buscar('BRUNO ESTRADA','CT','mza_oficial_12263142386');
const moral=await buscar('daño moral','',null,['daño extrapatrimonial','consecuencias no patrimoniales','agravio moral','daño inmaterial']);
const punitivo=await buscar('daño punitivo','',null,['multa civil','sanción pecuniaria disuasiva']);
if(moral<381 || punitivo<18)throw Error('Regresión en conceptos jurídicos: moral '+moral+', punitivo '+punitivo);
console.log('SMOKE_OK: corpus Mendoza 820+, Juristeca 7470+, sentencias CC/CT recuperables y daños sin regresión');
