/**
 * Valida la cosecha reciente provincial sin modificar la rama acervo.
 * Compara UUID de SAIJ contra tandas ya publicadas.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const raiz=path.resolve(process.env.DIR_ACERVO_BASE || path.join(backend,'acervo-base'));
const crudo=path.join(backend,'acervo-crudo');
const publicado=new Set();
const man=JSON.parse(fs.readFileSync(path.join(raiz,'manifiesto.json'),'utf8'));
for(const nombre of man.archivos.filter(x=>/^saij-\\d+\\.jsonl\\.gz$/.test(x))) {
 const flujo=readline.createInterface({input:fs.createReadStream(path.join(raiz,nombre)).pipe(zlib.createGunzip()),crlfDelay:Infinity});
 for await(const linea of flujo) if(linea) publicado.add(JSON.parse(linea).id);
}
const informe={fecha:new Date().toISOString(),versionBase:man.version,publicadosSaij:publicado.size,tipos:{},nuevosTotal:0};
for(const tipo of ['fallos','sumarios']){
 const dir=path.join(crudo,`saij-${tipo}-mendoza`);
 if(!fs.existsSync(dir)) throw Error(`No hay cosecha provincial de ${tipo}`);
 const archivos=fs.readdirSync(dir).filter(x=>x.endsWith('.jsonl.gz'));
 if(!archivos.length) throw Error(`No se generaron tandas de ${tipo}`);
 const ids=new Set(),nuevos=[];
 for(const archivo of archivos) {
  const datos=zlib.gunzipSync(fs.readFileSync(path.join(dir,archivo))).toString('utf8');
  for(const linea of datos.split('\\n')) if(linea.trim()) {
   const x=JSON.parse(linea);
   if(!x.id) throw Error(`Documento ${tipo} sin UUID en ${archivo}`);
   if(x.pr && x.pr.toLowerCase()!=='mendoza') throw Error(`Provincia ajena: ${x.pr}`);
   ids.add(x.id);
   if(!publicado.has(`saij_${x.id}`)) nuevos.push(x.id);
  }
 }
 informe.tipos[tipo]={archivos:archivos.length,unicos:ids.size,nuevos:new Set(nuevos).size,ejemplosNuevos:[...new Set(nuevos)].slice(0,10)};
 informe.nuevosTotal+=informe.tipos[tipo].nuevos;
}
const destino=path.join(backend,'reporte-cosecha-mendoza.json');
fs.writeFileSync(destino,JSON.stringify(informe,null,2));
console.log(JSON.stringify(informe,null,2));
