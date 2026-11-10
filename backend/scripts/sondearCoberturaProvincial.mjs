/**
 * Sondeo de cobertura por fuente, sin mutar el acervo.
 * Una sola página por tribunal/fuente, con espera entre orígenes.
 */
import fs from 'node:fs/promises';
import { FUENTES } from '../lib/fuentes.js';
const pruebas = [
  ['santafe', 'despido', {}],
  ['rionegro', 'despido', { tribunal: 'STJ' }],
  ['rionegro', 'despido', { tribunal: 'CJ' }],
  ['juristeca', 'despido', {}],
  ['scba', 'daño moral', {}],
  ['mendozalegal', 'daño moral', {}],
];
const resultados = [];
for(const [fuente,q,extra] of pruebas) {
  const buscar = FUENTES.find(x=>x.slug===fuente)?.buscar;
  const inicio=Date.now();
  try {
    if (!buscar) throw Error('Fuente no configurada');
    const x=await buscar({q,modo:'todas',pagina:1,porPagina:10,desde:0,...extra});
    resultados.push({
      fuente,q,...extra,ok:true,ms:Date.now()-inicio,
      totalFuente:x.totalFuente??null,total:x.total??null,cursor:x.siguienteDesde??null,
      recibidos:x.resultados?.length??0,
      ids:(x.resultados||[]).slice(0,3).map(r=>r.id),
      conEnlace:(x.resultados||[]).filter(r=>r.linkFicha||r.linkFallo).length,
    });
  } catch(e) {
    resultados.push({fuente,q,...extra,ok:false,ms:Date.now()-inicio,error:String(e.message).slice(0,250)});
  }
  console.log(JSON.stringify(resultados.at(-1)));
  await new Promise(r=>setTimeout(r,1500));
}
const reporte={generado:new Date().toISOString(),resultados};
await fs.writeFile('diagnostico-fuentes.json',JSON.stringify(reporte,null,2));
if(!resultados.some(x=>x.ok&&x.recibidos>0))process.exitCode=2;
