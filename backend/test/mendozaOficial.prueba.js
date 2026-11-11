import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('el respaldo incluye decisiones oficiales recientes de Suprema Corte, cámaras y primera instancia', () => {
 const archivo=path.join(backend,'respaldo/mendoza-oficial.json.gz');
 const datos=JSON.parse(zlib.gunzipSync(fs.readFileSync(archivo)).toString('utf8'));
 assert.ok(datos.registros.length>=31);
 const ids=new Set();
 for(const r of datos.registros) {
  assert.match(r.id,/^mza_oficial_\d+$/);
  assert.ok(!ids.has(r.id));ids.add(r.id);
  assert.equal(r.fuente,'mendoza');
  assert.ok(r.textoCompleto.length>1000);
  assert.ok(r.sumario.startsWith('Extracto literal'));
  assert.match(r.linkFallo,/^https:\/\/(?:www2|wwwnoti)\.jus\.mendoza\.gov\.ar\/listas\/proveidos\/vertexto\.php\?ide=\d+$/);
 }
 assert.ok(datos.registros.filter(r=>/SUPREMA/.test(r.tribunal)).length>=13);
 const baldoni=datos.registros.find(r=>r.id==='mza_oficial_12065977405');
 assert.ok(baldoni,'falta la sentencia civil sobre consumo');
 assert.match(baldoni.tribunal,/CIVIL/);
 assert.match(baldoni.textoCompleto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),/dano punitivo/);
 assert.ok(datos.registros.filter(r=>/TRABAJO/.test(r.tribunal)).length>=12);
 assert.ok(datos.registros.filter(r=>/CIVIL/.test(r.tribunal)).length>=5);
});
