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

test('el backend distingue IDs nuevos de fallos ya presentes en el corpus completo', () => {
  const acervo = fs.readFileSync(new URL('../lib/acervo.js', import.meta.url), 'utf8');
  assert.match(acervo, /export function idsNuevosRespectoAcervo\(registros\)/);
  assert.match(acervo, /SELECT id FROM fallos WHERE id IN/);
  assert.match(rutas, /idsNuevosAcervo = idsNuevosRespectoAcervo\(resultados\)/);
  assert.match(rutas, /pedirEnVivo \? \{ idsNuevosAcervo \} : \{\}/);
});

test('los buscadores no muestran contadores técnicos del acervo ni cifras crudas del sitio', () => {
  assert.ok(!html.includes('Acervo: <b>'));
  assert.ok(!html.includes('En vivo: '));
  assert.ok(!html.includes('identificadores nuevos'));
  assert.ok(!html.includes('"sitio: "'));
  assert.ok(!html.includes('el sitio informa'));
  assert.ok(!html.includes('el sitio devuelve'));
  assert.ok(!html.includes('revisadas las filas'));
  assert.ok(!html.includes('Servidor en línea'));
});
test('un sumario sólo se usa como pasaje si contiene todos los términos en modo todas', () => {
  assert.ok(html.includes('function sumarioCumpleConsulta(texto)'));
  assert.ok(html.includes('requeridos.every(function(t){ return !!presentes[t.k]; })'));
});
test('la respuesta oficial enriquece fichas del acervo y vuelve a pedir sus pasajes', () => {
  assert.ok(html.includes('function enriquecerResultadoLocal(destino,origen)'));
  assert.ok(html.includes('enriquecerResultadoLocal(existente,r)'));
  assert.ok(!html.includes('if(idsConfirmados&&!idsConfirmados.has(r.id)) return'));
  assert.ok(html.includes('traerFragmentos(slug,im.pedido,0)'));
  assert.ok(html.includes('traerFragmentos(slug,im.pedido,1)'));
});

test('Mendoza recibe carátulas como partes y la pantalla advierte ceros contradictorios', () => {
  assert.match(rutas, /slug === 'mendoza' && typeof cuerpo\.partes === 'string'/);
  assert.match(html, /if\(slug==="mendoza"\) cuerpo\.partes=nom\.consulta/);
  assert.match(html, /ov\.total===0&&im\.total>0/);
});

test('la carga del acervo tiene respuesta preliminar y conteo exacto diferido', () => {
  const consulta = fs.readFileSync(new URL('../lib/acervoConsulta.js', import.meta.url), 'utf8');
  assert.match(consulta, /rapida = false/);
  assert.match(consulta, /if \(rapida && Number\(desde\) === 0\)/);
  assert.match(consulta, /total: null, totalPendiente: true, resultados/);
  assert.match(rutas, /rapida: \(cuerpo\.local === true \|\| cuerpo\.soloLocal === true\)/);
  assert.match(html, /Object\.assign\(\{\},cuerpo,\{rapida:true\}\)/);
  assert.match(html, /imBusco\.totalPendiente=!!d\.totalPendiente/);
});
test('la primera página no se bloquea por el conteo de otra fuente', () => {
  const acervo = fs.readFileSync(new URL('../lib/acervo.js', import.meta.url), 'utf8');
  assert.match(acervo, /const N_HILOS = Math\.max\(2,/);
  assert.match(html, /while\(acervoPantallaActivos<2&&colaAcervoPantalla\.length\)/);
  assert.match(html, /if\(t\.rapida\)/);
});
