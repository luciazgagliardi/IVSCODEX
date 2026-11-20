import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const rutas = fs.readFileSync(new URL('../routes/indice.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');

test('el canal oficial no se desvía a la copia cuando hay un circuito abierto', () => {
  assert.match(rutas, /const pedirEnVivo = cuerpo\.pedirEnVivo === true/);
  assert.match(rutas, /if \(!pedirEnVivo && !accesible\(slug\) && acervoCubre\(slug\)\)/);
  assert.match(rutas, /if \(pedirEnVivo\) \{[\s\S]*?codigo: 'FUENTE_OFICIAL_NO_DISPONIBLE'/);
  assert.match(rutas, /enVivo: pedirEnVivo \? !desdeIndiceLocal : undefined/);
});

test('la consulta oficial no añade las demoras de respaldo local ni los 20 segundos de variantes', () => {
  assert.match(rutas, /if \(listaVariantes\.length && primeraPagina && !desdeIndiceLocal && !pedirEnVivo\)/);
  assert.match(rutas, /if \(!pedirEnVivo && slug === 'caba' && total === 0\)/);
});

test('el navegador conserva el acervo y solo muestra en vivo cuando hubo respuesta oficial', () => {
  assert.match(html, /if\(!cuerpo\.local\) cuerpo\.pedirEnVivo=true/);
  assert.match(html, /imBusco\.estadoVivo=\(d&&d\.ok&&!d\.desdeIndiceLocal&&d\.enVivo!==false\)\?"ok":"error"/);
  assert.match(html, /if\(imBusco\.porCopia&&esNueva\)/);
  assert.match(html, /sumarResultadosVivos\(d\)/);
  assert.match(html, /En vivo no disponible/);
  assert.doesNotMatch(html, /Esta respuesta proviene del acervo local/);
});
