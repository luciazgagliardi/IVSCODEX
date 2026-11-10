import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
test('Mendoza: cada sentencia publicada tiene PDF oficial y texto judicial indexable',()=>{
 const lote=JSON.parse(zlib.gunzipSync(fs.readFileSync('respaldo/mendoza-listas.json.gz')).toString('utf8'));
 const reporte=JSON.parse(fs.readFileSync('reporte-mendoza-listas.json','utf8'));
 assert.equal(lote.fuente,'mendoza');
 assert.ok(lote.registros.length>=15,'menos de 15 resoluciones completas recuperadas');
 assert.equal(lote.registros.length,reporte.anteriores+reporte.nuevos);
 const ids=new Set();
 for(const r of lote.registros){
  assert.match(r.id,/^mza_oficial_\d+$/);
  assert.equal(r.fuente,'mendoza');
  assert.ok(!ids.has(r.id),'sentencia repetida '+r.id);ids.add(r.id);
  assert.ok(r.caratula&&r.caratula.length>=8);
  assert.ok(r.tribunal&&/Cámara (?:Civil|del Trabajo) de Mendoza/.test(r.tribunal));
  assert.match(r.fecha,/\b\d{2}\/\d{2}\/20\d{2}\b/);
  assert.ok(r.expediente&&r.expediente.length>=4);
  assert.match(r.linkFicha,/^https:\/\/www2\.jus\.mendoza\.gov\.ar\/listas\/proveidos\/vertexto\.php\?ide=\d+$/);
  assert.match(r.linkFallo,/^https:\/\/iol\.jus\.mendoza\.gov\.ar\/iol-api\/api\/public\/expedientes\/actuaciones\/pdf\?/);
  assert.ok(r.sumario&&r.sumario.length>=700,'texto de sentencia insuficiente: '+r.id);
  assert.ok(/\b(?:RESUELVE|FALLO|CONSIDERANDO|SENTENCIA DEFINITIVA|AUTOS Y VISTOS|VISTOS)\b/i.test(r.sumario));
 }
 assert.ok(reporte.jornadas.some(x=>x.agregados>0));
});
