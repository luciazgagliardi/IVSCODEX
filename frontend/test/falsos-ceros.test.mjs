/**
 * Una fuente que no respondió no tiene «0 resultados».
 * Se ejecuta la función real de la página (estadoBase), no un patrón de texto.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function extraer(nombre) {
  const ini = html.indexOf(`function ${nombre}(`);
  assert.ok(ini >= 0, `no está ${nombre}`);
  let i = html.indexOf('{', ini), prof = 0;
  for (; i < html.length; i++) { if (html[i] === '{') prof++; else if (html[i] === '}' && --prof === 0) break; }
  return html.slice(ini, i + 1);
}

function entorno(indices) {
  const ctx = { estado: { indices }, esc: (s) => String(s), cuantosDe: (_f, im) => im.total ?? 0 };
  vm.runInNewContext(extraer('estadoBase'), ctx);
  return ctx;
}

test('una base con error muestra «sin respuesta», nunca 0', () => {
  const ctx = entorno({ tsj: { busco: true, error: 'El buscador oficial no respondió a la consulta en vivo.' } });
  const r = ctx.estadoBase({ slug: 'tsj' });
  assert.doesNotMatch(r.t, />0</);
  assert.match(r.t, /sin respuesta/);
  assert.match(r.c, /con-error/);
});

test('el límite de consultas se nombra como tal', () => {
  const ctx = entorno({ scba: { busco: true, error: 'Se alcanzó el límite de consultas seguidas a esta fuente oficial.' } });
  assert.match(ctx.estadoBase({ slug: 'scba' }).t, /límite de consultas/);
});

test('un cero real sigue mostrándose como cero', () => {
  const ctx = entorno({ cat: { busco: true, error: null, total: 0, resultados: [] } });
  assert.match(ctx.estadoBase({ slug: 'cat' }).t, />0</);
});

test('copia local en 0 + sitio oficial caído: error, no «sin coincidencias»', () => {
  // Respuesta viva fallida durante una búsqueda que empezó por la copia.
  assert.match(html, /if\(imBusco\.estadoVivo==="error"&&!imBusco\.resultados\.length\)\{\s*imBusco\.error=FALLA_SIN_COPIA;/);
  // Excepción de red durante la misma situación.
  assert.match(html, /if\(imBusco\.porCopia&&!imBusco\.resultados\.length\)\{[^}]*imBusco\.error=FALLA_SIN_COPIA;/);
  // El panel distingue la falla antes de decir «Sin coincidencias».
  const i = html.indexOf('if(!im.resultados.length&&im.estadoVivo==="error")');
  const j = html.indexOf("Sin coincidencias en '+esc(f.nombre)+\n");
  assert.ok(i > 0 && (j < 0 || i < html.indexOf('Pruebe con menos palabras')));
  assert.match(html, /no puede afirmarse que no haya resultados/);
});

test('el contador general dice cuántas bases no respondieron', () => {
  assert.match(html, /en las bases que respondieron · <b>'\+basesSinRespuesta\(vis\)\+'<\/b> sin respuesta/);
});

test('privacidad: los textos dicen lo que la plataforma hace (F-11)', async () => {
  const portada = await readFile(new URL('../portada/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /El Lector opera directamente en su navegador/);
  assert.match(html, /se envían al servidor de la plataforma para extraer el texto: se leen en memoria y no se guardan/);
  assert.match(html, /servicio de síntesis de voz de Microsoft/);
  assert.doesNotMatch(portada, /el archivo que se sube para leerlo en el Lector, y el análisis que realiza Lexia sobre el fallo abierto, se procesan en su navegador/);
  assert.match(portada, /servicio de síntesis de voz de Microsoft/);
});

test('intereses: la tasa elegida no se presenta como obtenida por la plataforma (F-10)', () => {
  assert.match(html, /La plataforma no obtiene ni controla el valor de la tasa/);
  assert.match(html, /valor no obtenido ni verificado por la plataforma/);
});

test('el total general no suma las vistas de SAIJ cuando SAIJ respondió (F-03)', () => {
  const ctx = {
    estado: { indices: { saij: { busco: true, total: 100 }, cordoba: { busco: true, total: 30 }, csjn: { busco: true, total: 10 }, mendoza: { busco: true, total: 5 } } },
    cuantosDe: (_f, im) => im.total,
  };
  for (const n of ['saijRespondio', 'totalGeneral']) vm.runInNewContext(extraer(n), ctx);
  vm.runInNewContext(html.match(/var VISTAS_DE_SAIJ=\{[^}]*\};/)[0], ctx);
  const vis = ['saij', 'cordoba', 'csjn', 'mendoza'].map((slug) => ({ slug }));
  assert.equal(ctx.totalGeneral(vis), 105);
  ctx.estado.indices.saij = { busco: true, error: 'sin respuesta' };
  assert.equal(ctx.totalGeneral(vis), 45, 'si SAIJ falló, las vistas son la única fuente de esos fallos');
});

test('un error HTTP no se informa como corte de conexión, y hay reintento de las fallidas (F-05)', async () => {
  const ctx = {};
  vm.runInNewContext(extraer('leerRespuesta'), ctx);
  const html503 = { status: 503, headers: { get: () => 'text/html' }, json: () => Promise.reject(new Error('x')) };
  const d = await ctx.leerRespuesta(html503);
  assert.equal(d.ok, false);
  assert.match(d.mensaje, /HTTP 503/);
  assert.match(d.mensaje, /no fue un corte de su conexión/);
  assert.match(html, /var TOPE_ORIGEN_NAVEGADOR=135000/);
  assert.match(html, /function cancelarOrigenPantalla\(slug\)/);
  assert.match(html, /function pedirOrigenConReintento\(t,control\)/);
  assert.match(html, /intento<2/);
  assert.match(html, /cancelarOrigenPantalla\(slug\)/);
  assert.match(html, /if\(act==="reintentar-fallidas"\)/);
});

test('una vista previa local vacía no borra resultados oficiales que llegaron primero', () => {
  const inicio = html.indexOf('var mostrarLocal=function(d){');
  const fin = html.indexOf('// la copia local va por', inicio);
  assert.ok(inicio >= 0 && fin > inicio, 'está el flujo de vista previa');
  const bloque = html.slice(inicio, fin);
  const guarda = bloque.indexOf('if(!d.resultados.length&&imBusco.resultados.length)return;');
  const reemplazo = bloque.indexOf('aplicarPaginaIndice(slug,fCfg,imBusco,d,1,false);');
  assert.ok(guarda >= 0 && reemplazo > guarda,
    'la respuesta local vacía debe descartarse antes de reemplazar la lista visible');
});


test('una coincidencia oficial que existe en el corpus pero no está en la muestra local no se descarta', () => {
  const ctx = {
    estado: { q: 'contaminación del suelo', modo: 'exacta' },
    claveFallo: (_slug, r) => r.id,
    enriquecerResultadoLocal: () => false,
    urlFragmento: () => null,
    sumarioCoincide: () => true,
    traerFragmentos: () => {},
    render: () => {},
  };
  vm.runInNewContext(extraer('anexarResultadosOficiales'), ctx);
  const local = { id: 'local-primero', caratula: 'Registro de la muestra rápida' };
  const oficial = { id: 'oficial-en-acervo-fuera-de-muestra', caratula: 'Contaminación del suelo' };
  const im = {
    porCopia: true, pagina: 1, pedido: 1, fragmentos: {}, fragEnCurso: {},
    paginas: { 1: { resultados: [local] } }, resultados: [local],
  };
  ctx.anexarResultadosOficiales('saij', im, {
    ok: true, desdeIndiceLocal: false,
    // El resultado ya existe en algún lugar del acervo, pero no en la página
    // rápida visible. No puede eliminarse por ese solo motivo.
    idsNuevosAcervo: [], resultados: [oficial],
  });
  assert.deepEqual(Array.from(im.resultados, x => x.id), [
    'local-primero', 'oficial-en-acervo-fuera-de-muestra',
  ]);
});

test('el panel de una fuente conserva resultados locales mientras sigue cargando la consulta oficial', () => {
  assert.match(html, /if\(im\.cargando&&!im\.busco&&!im\.resultados\.length\)/);
  assert.doesNotMatch(html, /if\(im\.cargando\) return out\+'<\/div>'/);
});

test('las fichas recibidas no se convierten en «sin coincidencias» si falla la verificación del pasaje', () => {
  assert.match(html, /La fuente devolvió '\+im\.resultados\.length\+/);
  assert.match(html, /Se conservan las fichas para inspeccionar sus datos y abrir la fuente oficial/i);
  assert.match(html, /fichas pendientes de comprobación/);
});

test('las sugerencias del intérprete no desaparecen por existir un anillo del tesauro', () => {
  const ctx = {
    estado: {
      tab: 'buscar', q: 'responsabilidad civil',
      sugeridas: [{ voz: 'responsabilidad objetiva' }, { voz: 'daño emergente' }],
      sugeridaRama: '',
    },
    expandir: () => ({ variantes: [{ t: 'responsabilidad objetiva' }] }),
    sinTildes: s => String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase(),
    comoTitulo: s => s,
    esc: s => String(s),
  };
  vm.runInNewContext(extraer('tiraSugerencias'), ctx);
  const salida = ctx.tiraSugerencias();
  assert.match(salida, /daño emergente/);
  assert.doesNotMatch(salida, /responsabilidad objetiva/);
});


test('una fuente con total preliminar positivo y página vacía no se presenta como cero', () => {
  const panel = extraer('panelIndice');
  const aviso = panel.indexOf('Number(im.totalFuente)>0||Number(im.total)>0');
  const cero = panel.indexOf('Sin coincidencias en');
  assert.ok(aviso >= 0 && cero > aviso,
    'primero debe distinguir una respuesta preliminar positiva; sólo después puede afirmar cero real');
  assert.match(panel, /No se puede afirmar que no haya resultados/);
  assert.match(panel, /data-act="buscar-indice"/);
  assert.match(panel, /Reintentar la consulta/);
});
