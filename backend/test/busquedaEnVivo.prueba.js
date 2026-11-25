import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const rutas = fs.readFileSync(new URL('../routes/indice.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');
const saij = fs.readFileSync(new URL('../lib/indiceSaij.js', import.meta.url), 'utf8');

test('el cliente vivo cancela solicitudes viejas de la misma fuente y no las deja bloquear la cola', () => {
  assert.match(html, /var TOPE_ORIGEN_NAVEGADOR=135000/);
  assert.match(html, /function cancelarOrigenPantalla\(slug\)/);
  assert.match(html, /origenPantallaControles\[slug\]/);
  assert.match(html, /t\.resolver\(null\)/);
  assert.match(html, /var MAX_ORIGEN_SIMULTANEOS=4/);
  assert.match(html, /function pedirOrigenConReintento\(t,control\)/);
  assert.match(html, /intento<2/);
  assert.match(html, /d&&d\.ok===false&&d\.reintentable===true/);
  assert.match(html, /\[502,503,504,520,522,524\]/);
  assert.match(html, /function consultarOrigenPantalla\(slug,cuerpo,vigente\)[\s\S]*?cancelarOrigenPantalla\(slug\)/);
  assert.doesNotMatch(html, /La consulta oficial superó su plazo de 135 segundos/);
});
test('el servidor devuelve el error de origen y permite reintentar sólo lo transitorio', () => {
  assert.match(rutas, /const estadoOrigen = Number\(e\?\.extra\?\.estadoOrigen\)/);
  assert.match(rutas, /\[401, 403, 404, 410, 429\]\.includes\(estadoOrigen\)/);
  assert.match(rutas, /const reintentable = !denegacionDefinitiva/);
  assert.match(rutas, /codigo, mensaje, reintentable/);
});

test('el canal oficial no se desvía a la copia cuando hay un circuito abierto', () => {
  assert.match(rutas, /const pedirEnVivo = cuerpo\.pedirEnVivo === true/);
  assert.match(rutas, /if \(!pedirEnVivo && !accesible\(slug\) && acervoCubre\(slug\)\)/);
  assert.match(rutas, /if \(pedirEnVivo\) \{[\s\S]*?codigo, mensaje, reintentable/);
  assert.match(rutas, /enVivo: pedirEnVivo \? !desdeIndiceLocal : undefined/);
});

test('la consulta oficial no añade las demoras de respaldo local ni los 20 segundos de variantes', () => {
  assert.match(rutas, /if \(listaVariantes\.length && primeraPagina && !desdeIndiceLocal && !pedirEnVivo\)/);
  assert.match(rutas, /if \(!pedirEnVivo && slug === 'caba' && total === 0\)/);
});

test('una respuesta oficial parcial no se presenta como cero confirmado, aunque el acervo haya llegado primero', () => {
  assert.ok(html.includes('imBusco.parcial=imBusco.parcial||!!d.totalParcial'));
  assert.ok(html.includes('if(!im.resultados.length&&(im.estadoVivo==="error"||im.parcial)) return out'));
});

test('el navegador conserva el acervo y solo muestra en vivo cuando hubo respuesta oficial', () => {
  assert.match(html, /if\(!cuerpo\.local\) cuerpo\.pedirEnVivo=true/);
  assert.match(html, /imBusco\.estadoVivo=\(d&&d\.ok&&!d\.desdeIndiceLocal&&d\.enVivo!==false\)\?"ok":"error"/);
  assert.match(html, /if\(imBusco\.porCopia&&esNueva\)/);
  assert.match(html, /sumarResultadosVivos\(d\)/);
  assert.doesNotMatch(html, /aria-label="Fuente sin respuesta"/);
  assert.doesNotMatch(html, /Esta respuesta proviene del acervo local/);
});

test('el backend distingue IDs nuevos de fallos ya presentes en el corpus completo', () => {
  const acervo = fs.readFileSync(new URL('../lib/acervo.js', import.meta.url), 'utf8');
  assert.match(acervo, /export function idsNuevosRespectoAcervo\(registros\)/);
  assert.match(acervo, /SELECT id FROM fallos WHERE id IN/);
  assert.match(rutas, /idsNuevosAcervo = idsNuevosRespectoAcervo\(resultados\)/);
  assert.match(rutas, /pedirEnVivo \? \{ idsNuevosAcervo \} : \{\}/);
});

test('ninguna sección explica fallas de fuentes ni anuncia el uso o la antigüedad del acervo', () => {
  for (const texto of [
    'Consulta en vivo no disponible en',
    'Los resultados del acervo permanecen disponibles',
    'Fuente sin respuesta',
    'La fuente oficial no devolvió coincidencias; los resultados visibles provienen del acervo guardado',
    'La copia local no tiene coincidencias y el sitio oficial no respondió',
    'actualizado hasta',
    'fecha de actualización del acervo',
    'No se pudo traer este documento.',
    'No se pudo consultar esta fuente. El error no equivale a cero jurisprudencia.'
  ]) assert.ok(!html.toLowerCase().includes(texto.toLowerCase()), 'No debería mostrarse: '+texto);
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
  assert.ok(html.includes('function sumarioCumpleConsulta(texto,consulta)'));
  assert.ok(html.includes('IVSPasajes.coincidencias(texto,[t],{modo:"todas",tope:1})'));
});
test('el servidor consulta primero los sumarios SAIJ cuando exige frase o todas las palabras', () => {
  assert.match(saij, /TANDAS_POR_MODO = \{ exacta: 12, todas: 10, alguna: 3 \}/);
  assert.match(saij, /CURSOR_FALLOS_RESALDO = 2_000_000_000/);
  assert.match(saij, /opciones\.modo === 'exacta' \|\| opciones\.modo === 'todas'/);
  assert.match(saij, /tribunal: 'sumarios'/);
  assert.match(saij, /tipoConsulta: 'sumarios_frase_exacta'/);
  assert.match(saij, /CURSOR_FALLOS_RESALDO \+ Number\(fallos\.siguienteDesde\)/);
});
test('el fallback de navegador prioriza el texto de SAIJ para consultas estrictas y conserva el cursor de fallos', () => {
  assert.ok(html.includes('async function buscarSaijNavegadorSimple(cuerpo,slug)'));
  assert.ok(html.includes('var SAIJ_CURSOR_SUMARIOS_RESALDO=1000000000'));
  assert.ok(html.includes('var SAIJ_CURSOR_FALLOS_RESALDO=2000000000'));
  assert.ok(html.includes('var tribunal=cuerpo.tribunal||"todo"'));
  assert.ok(html.includes('if(cuerpo.modo==="exacta"||cuerpo.modo==="todas")'));
  assert.ok(html.includes('tribunal:"sumarios"'));
  assert.ok(html.includes('tribunal:"fallos"'));
  assert.ok(html.includes('tipoConsulta:"sumarios_de_consulta_estricta"'));
  assert.ok(html.includes('esSumarioRespaldo:true'));
  assert.ok(html.includes('tipo:esSumario?"sumario":"fallo"'));
});
test('la respuesta oficial enriquece fichas ya visibles y no descarta fallos que faltan en la muestra local', () => {
  assert.ok(html.includes('function enriquecerResultadoLocal(destino,origen)'));
  assert.ok(html.includes('enriquecerResultadoLocal(existente,r)'));
  const enriquecer = html.indexOf('enriquecerResultadoLocal(existente,r)');
  const deduplicar = html.indexOf('if(vistos[clave]) return', enriquecer);
  assert.ok(enriquecer > 0 && deduplicar > enriquecer,
    'primero completa una ficha ya visible y después elimina sólo duplicados reales de la lista');
  assert.ok(html.includes('paginaUno.resultados=existentes.concat(nuevos)'));
  assert.doesNotMatch(html, /if\(idsConfirmados&&!idsConfirmados\.has\(r\.id\)\) return/,
    'la presencia en otra parte del acervo no significa que el fallo ya esté visible');
  assert.ok(html.includes('traerFragmentos(slug,im.pedido,0)'));
  assert.ok(html.includes('traerFragmentos(slug,im.pedido,1)'));
});

test('Mendoza recibe carátulas como partes sin exponer incidencias internas', () => {
  assert.match(rutas, /slug === 'mendoza' && typeof cuerpo\.partes === 'string'/);
  assert.match(html, /if\(slug==="mendoza"\) cuerpo\.partes=nom\.consulta/);
  assert.doesNotMatch(html, /La fuente oficial no devolvió coincidencias; los resultados visibles provienen del acervo guardado/);
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
