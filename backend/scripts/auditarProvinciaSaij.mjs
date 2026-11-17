/**
 * Auditoría de documentos SAIJ con tribunal mendocino explícito y campo
 * provincia vacío; no modifica ninguna ficha ni atribuye fuero por carátula.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
const dir=path.resolve(process.env.DIR_ACERVO_BASE || 'acervo-base');
const m=JSON.parse(fs.readFileSync(path.join(dir,'manifiesto.json'),'utf8'));
const informe={version:m.version,saijTotales:0,saijProvinciaMendoza:0,
 posiblesSinProvincia:0,posiblesConOtraProvincia:0,muestras:[],tribunales:{},porAnio:{},nulas:0,otrosSinMendoza:0};
const patron=/\bMENDOZA\b/i;
for(const nombre of m.archivos.filter(x=>/^saij-\d+\.jsonl\.gz$/.test(x))){
 const input=readline.createInterface({input:fs.createReadStream(path.join(dir,nombre)).pipe(zlib.createGunzip()),crlfDelay:Infinity});
 for await(const line of input){
  if(!line.trim())continue;
  const r=JSON.parse(line);
  if(r.fuente!=='saij')continue;
  informe.saijTotales++;
  if(r.provincia==='Mendoza'){informe.saijProvinciaMendoza++;continue;}
  if(!r.provincia)informe.nulas++;
  if(!patron.test(r.tribunal||'')){if(!r.provincia)informe.otrosSinMendoza++;continue;}
  if(r.provincia)informe.posiblesConOtraProvincia++;
  else informe.posiblesSinProvincia++;
  const t=String(r.tribunal||'').slice(0,130);
  informe.tribunales[t]=(informe.tribunales[t]||0)+1;
  const a=/\b(?:19|20)\d{2}\b/.exec(r.fecha||'')?.[0]||'indeterminado';
  informe.porAnio[a]=(informe.porAnio[a]||0)+1;
  if(informe.muestras.length<40)informe.muestras.push({id:r.id,tribunal:t,provincia:r.provincia||'',fecha:r.fecha,caratula:String(r.caratula||'').slice(0,110)});
 }
}
console.log(JSON.stringify(informe,null,2));
fs.writeFileSync('auditoria-saij-mendoza.json',JSON.stringify(informe,null,2));
