import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
const file=path.resolve('respaldo/juristeca.json.gz');
test('Juristeca: ID único, carátula, fuero, fecha y PDF original verificable',()=>{
 const lote=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
 assert.equal(lote.fuente,'juristeca');
 assert.ok(lote.registros.length>=100,'la cosecha debe sumar al menos 100 fichas');
 const ids=new Set();
 for(const r of lote.registros){
  assert.match(r.id,/^juristeca_\d+$/);
  assert.ok(!ids.has(r.id),'ID duplicado '+r.id);ids.add(r.id);
  assert.ok(r.caratula&&r.caratula!=='(sin carátula)','carátula incompleta');
  assert.ok(r.tribunal&&r.tribunal.length>4,'fuero desconocido');
  assert.match(r.linkFallo,/^https:\/\/juristeca\.jusbaires\.gob\.ar\/fallos\/[^?#]+\.pdf$/i);
  assert.equal(r.linkFallo,r.linkFicha);
 }
 const reporte=JSON.parse(fs.readFileSync('reporte-juristeca.json','utf8'));
 assert.equal(reporte.unicos,ids.size);
 assert.ok(reporte.consultas.some(q=>q.fichasRecibidas>0));
});
