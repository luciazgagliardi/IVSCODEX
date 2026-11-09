/**
 * Sondeo acotado del buscador judicial mendocino: sin barrido masivo ni publicación.
 * Uso: node scripts/sondearMendoza.mjs
 */
import { buscarMza } from '../lib/indiceMza.js';

const consultas = [
  ['SC','acción de amparo'], ['SC','responsabilidad del Estado'],
  ['CC','daño punitivo'], ['CC','punitivo'], ['CC','daño moral'], ['CC','desvalorización venal'],
  ['CT','despido indirecto'], ['CT','horas extras'], ['CT','incapacidad laboral'],
];
const salida={generado:new Date().toISOString(),pruebas:[]};
for(const [tribunal,q] of consultas){
  const inicio=Date.now();
  try {
    const r=await buscarMza({q,tribunal,modo:'todas',pagina:1,porPagina:3});
    salida.pruebas.push({tribunal,q,totalFuente:r.totalFuente??r.total,recibidos:r.resultados?.length??0,
      ejemplos:(r.resultados||[]).map(x=>({id:x.id,caratula:x.caratula,tribunal:x.tribunal,fecha:x.fecha,link:x.linkFallo||x.linkFicha||null})),ms:Date.now()-inicio});
  } catch(e){salida.pruebas.push({tribunal,q,error:String(e.message),ms:Date.now()-inicio});}
}
console.log(JSON.stringify(salida,null,2));
// Un contador positivo sin fichas es un defecto, nunca un resultado cero válido.
if(salida.pruebas.some(x=>x.error || (x.totalFuente > 0 && x.recibidos === 0))) process.exitCode=2;
