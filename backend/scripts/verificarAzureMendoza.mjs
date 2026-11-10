/** Prueba liviana y de sólo lectura del buscador real de Mendoza. */
const api='https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api';
const r=await fetch(api+'/acervo/estado',{signal:AbortSignal.timeout(20000)});
if(!r.ok)throw Error('Acervo estado HTTP '+r.status);
const e=await r.json();
console.log('ESTADO '+JSON.stringify({activo:e.activo,version:e.version,mendoza:e.conteos?.mendoza,importando:e.importando}));
if(!e.activo||e.conteos?.mendoza<726)throw Error('El acervo de Mendoza no está activo o está incompleto');
const esperar=ms=>new Promise(ok=>setTimeout(ok,ms));
async function buscar(q,variantes){
 for(let intento=1;intento<=2;intento++){
  try {
   const r=await fetch(api+'/indice/mendoza/buscar',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({q,modo:'todas',tribunal:'',variantes}),
    signal:AbortSignal.timeout(60000)});
   const d=await r.json();
   if(!r.ok||!d.ok)throw Error('HTTP '+r.status+' '+(d.codigo||'')+' '+(d.mensaje||''));
   return {total:d.total,ids:(d.resultados||[]).slice(0,3).map(x=>x.id)};
  }catch(ex){if(intento===2)throw ex;await esperar(2500);}
 }
}
const pruebas=[
 {q:'daño moral',variantes:['daño extrapatrimonial','consecuencias no patrimoniales','agravio moral','daño inmaterial'],min:376},
 {q:'daño punitivo',variantes:['multa civil','sanción pecuniaria disuasiva'],min:17},
];
for(const x of pruebas) {
 const ampliada=await buscar(x.q,x.variantes);
 console.log('RECUPERACION '+JSON.stringify({q:x.q,...ampliada,variantes:x.variantes}));
 if(ampliada.total<x.min)throw Error(x.q+': el buscador real no alcanzó el mínimo validado ('+x.min+')');
 await esperar(1500);
}
console.log('El buscador normal de Azure recupera los conceptos equivalentes');
