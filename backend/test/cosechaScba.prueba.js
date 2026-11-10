import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
test('SCBA/JUBA: preservar sumarios trazables y no repetir ID',()=>{
 const lote=JSON.parse(zlib.gunzipSync(fs.readFileSync('respaldo/scba.json.gz')).toString('utf8'));
 assert.equal(lote.fuente,'scba');
 const verificadas=lote.registros.filter(r=>r.procedencia==='JUBA/SCBA - fallo oficial');
 assert.ok(verificadas.length>=100,'menos de 100 fichas oficiales verificadas');
 const ids=new Set();
 for(const r of lote.registros){
  assert.match(r.id,/^scba_[A-Z]\d{6,8}$/);
  assert.ok(!ids.has(r.id));ids.add(r.id);
  if(r.procedencia==='JUBA/SCBA - fallo oficial') {
    assert.ok(r.sumario&&r.sumario.length>30);
    assert.match(r.linkFallo,/^https:\/\/juba\.scba\.gov\.ar\/VerTextoCompleto\.aspx\?idFallo=\d+$/i);
  }
 }
 const informe=JSON.parse(fs.readFileSync('reporte-scba.json','utf8'));
 assert.equal(informe.unicos,ids.size);
});
