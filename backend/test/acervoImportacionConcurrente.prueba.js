import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { rutaTemporalImportacion, rutaCopiaLectura, rutaCopiaTemporal } from '../lib/acervoArchivos.js';

test('las rutas de SQLite no colisionan entre procesos ni importaciones',()=>{
 const a=rutaTemporalImportacion('/tmp','version-1',100);
 const b=rutaTemporalImportacion('/tmp','version-1',100);
 const c=rutaTemporalImportacion('/tmp','version-1',101);
 assert.notEqual(a,b);assert.notEqual(a,c);
 assert.notEqual(rutaCopiaLectura('/tmp','v',101),rutaCopiaLectura('/tmp','v',102));
 assert.notEqual(rutaCopiaTemporal('/tmp','v',101),rutaCopiaTemporal('/tmp','v',101));
});

test('dos importadores de la misma versión generan SQLite independientes sin borrar el otro',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ivs-import-race-'));
 try{
  const fila={id:'mza_test_1',fuente:'mendoza',caratula:'Sentencia de control',tribunal:'CAMARA CIVIL',fecha:'07/09/2026',sumario:'Daño moral y fundamentos jurídicos completos'};
  fs.writeFileSync(path.join(dir,'mendoza-001.jsonl.gz'),zlib.gzipSync(JSON.stringify(fila)+'\n'));
  const man={version:'version-prueba-concurrente',archivos:['mendoza-001.jsonl.gz']};
  const nombres=[rutaTemporalImportacion(dir,man.version),rutaTemporalImportacion(dir,man.version)];
  async function crear(nueva){
   return new Promise((ok,mal)=>{
    const w=new Worker(new URL('../lib/acervoImportar.js',import.meta.url),{workerData:{man,dirTandas:dir,nueva}});
    let respuesta=null;
    w.on('message',v=>{respuesta=v;});
    w.on('error',mal);
    w.on('exit',c=>c===0&&respuesta?ok(respuesta):mal(Error('Importador falló: '+c)));
   });
  }
  const [uno,dos]=await Promise.all(nombres.map(crear));
  assert.equal(uno.conteos.mendoza,1);
  assert.equal(dos.conteos.mendoza,1);
  for(const nombre of nombres){
   assert.ok(fs.statSync(nombre).size>4096);
   const db=new DatabaseSync(nombre,{readOnly:true});
   assert.equal(db.prepare("SELECT valor FROM meta WHERE clave='version'").get().valor,man.version);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM fallos').get().n,1);
   assert.ok(db.prepare("SELECT COUNT(*) n FROM fts WHERE fts MATCH 'moral'").get().n>0);
   db.close();
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
