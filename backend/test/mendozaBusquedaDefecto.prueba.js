import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(backend,'../frontend/index.html'),'utf8');
const rutas=fs.readFileSync(path.join(backend,'routes/indice.js'),'utf8');
test('Mendoza ofrece todos los tribunales y los selecciona por defecto',()=>{
  const bloque=html.split('{slug:"mendoza"')[1].split('{slug:"mendozalegal"')[0];
  assert.match(bloque,/tribunales:\s*\[\s*\{v:"",n:"Todos los tribunales"\}/);
  assert.match(html,/tribunal:f\.tribunales\?f\.tribunales\[0\]\.v:null/);
});
test('las búsquedas normales priorizan la copia de Mendoza sin falsear un cero oficial',()=>{
  assert.match(rutas,/slug === 'mendoza' && acervoCubre\(slug\)/);
  assert.match(rutas,/if \(loc && loc\.resultados\.length\)/);
  assert.match(rutas,/resultados verificados en el acervo local/i);
});
