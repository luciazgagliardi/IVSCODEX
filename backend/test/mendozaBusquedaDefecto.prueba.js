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
test('Mendoza mantiene /buscar desde el acervo y admite consulta oficial concurrente explícita',()=>{
  assert.match(html,/fetch\(estado\.api\+"\/indice\/"\+slug\+"\/local"/);
  assert.match(html,/var promesaBusco=Promise\.resolve\(\)\.then/);
  assert.match(html,/if\(imBusco\.porCopia&&esNueva\)/);
  assert.match(html,/sumarResultadosVivos\(d\)/);
  assert.match(html,/if\(!cuerpo\.local\) cuerpo\.pedirEnVivo=true/);
  assert.match(rutas,/if \(slug === 'mendoza' && acervoCubre\(slug\) && cuerpo\.pedirEnVivo !== true/);
  assert.match(rutas,/if \(!accesible\(slug\) && acervoCubre\(slug\)\)/);
  assert.match(rutas,/totalParcial:\s*respaldoParcial/);
  assert.match(rutas,/origenAcervo:\s*respaldoParcial\s*\?\s*'indice_parcial'\s*:\s*'sqlite_fts'/);
});
