import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FUENTES, fuentePorSlug, consultaDeArticulo } from '../lib/fuentes.js';
import { informacionFuente, catalogoFuentesIntegradas } from '../lib/fuentesInfo.js';
import { buscarChubut } from '../lib/indiceChubut.js';
import { buscarTfn } from '../lib/indiceTfn.js';
import { buscarSantaCruz } from '../lib/indiceSantaCruz.js';
import { buscarHudoc } from '../lib/indiceHudoc.js';

const conFetch = async (fn, ejecutar) => {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  try { return await ejecutar(); }
  finally { globalThis.fetch = original; }
};

const respuesta = (datos, status = 200, headers = {}) =>
  new Response(typeof datos === 'string' ? datos : JSON.stringify(datos), {
    status, headers: { 'Content-Type': 'application/json', ...headers },
  });

test('las cuatro fuentes nuevas están registradas como rutas independientes', () => {
  for (const slug of ['chubut', 'tfn', 'santacruz', 'hudoc']) {
    assert.ok(fuentePorSlug(slug), 'falta ' + slug + ' en el registro del backend');
    assert.ok(FUENTES.some((x) => x.slug === slug && typeof x.buscar === 'function'));
    assert.ok(informacionFuente(slug), 'falta metadata de ' + slug);
    assert.ok(catalogoFuentesIntegradas().some((x) => x.slug === slug));
  }
  assert.equal(consultaDeArticulo('tfn', '8'), 'artículo 8');
  assert.equal(consultaDeArticulo('chubut', '8'), 'art. 8');
});

test('Chubut inicia acceso anónimo, conserva sesión y pagina en el JSON oficial', async () => {
  const llamadas = [];
  await conFetch(async (url, opciones = {}) => {
    const u = new URL(url);
    llamadas.push({ url: u, opciones });
    if (u.pathname.endsWith('/RegistrarAccesoAnonimo')) {
      return new Response('Acceso anónimo habilitado', {
        status: 200, headers: { 'Set-Cookie': 'EurekaSession=anon-123; Path=/; HttpOnly' },
      });
    }
    assert.equal(u.pathname, '/eureka/Sumarios/BuscarPorCriterios');
    const page = Number(u.searchParams.get('PageIndex'));
    return respuesta({
      idBusqueda: 'busqueda-77',
      pageCount: 2,
      totalFilas: 41,
      rows: [{
        id: 64706 + page,
        cell: {
          numero: '12345', anio: '2024', organismo: 'Cámara Civil',
          competencia: 'Civil', protocolo: 'S-12', fechaFirma: '18/11/2026',
          sumario: 'Responsabilidad civil y reparación integral del daño.',
          caratula: 'Pérez c/ Provincia del Chubut',
        },
      }],
    });
  }, async () => {
    const primera = await buscarChubut({ q: 'responsabilidad civil', tribunal: 'sumarios', pagina: 1, porPagina: 20 });
    assert.equal(primera.total, 41);
    assert.equal(primera.resultados[0].id, 'chubut_sumario_64707');
    assert.match(primera.resultados[0].sumario, /reparación integral/);
    assert.equal(primera.siguienteDesde, 2);

    const segunda = await buscarChubut({ q: 'responsabilidad civil', tribunal: 'sumarios', desde: 2, pagina: 2, porPagina: 20 });
    assert.equal(segunda.pagina, 2);
    assert.equal(segunda.resultados[0].id, 'chubut_sumario_64708');
  });
  assert.equal(llamadas.filter(x => x.url.pathname.endsWith('/RegistrarAccesoAnonimo')).length, 1);
  assert.equal(llamadas.filter(x => x.url.pathname.endsWith('/BuscarPorCriterios')).length, 2);
  assert.equal(llamadas[1].url.searchParams.get('PageIndex'), '1');
  assert.equal(llamadas[2].url.searchParams.get('PageIndex'), '2');
  assert.equal(llamadas[1].url.searchParams.get('Tipo'), '');
  assert.match(llamadas[2].opciones.headers.Cookie || '', /EurekaSession=anon-123/);
});

test('Chubut busca sentencias primero y sólo completa con sumarios al agotar fallos', async () => {
  const llamadas = [];
  await conFetch(async (url, opciones = {}) => {
    const u = new URL(url);
    llamadas.push({ url: u, opciones });
    if (u.pathname.endsWith('/RegistrarAccesoAnonimo')) {
      return new Response('Acceso anónimo habilitado', {
        status: 200, headers: { 'Set-Cookie': 'EurekaSession=fallos-first; Path=/; HttpOnly' },
      });
    }
    if (u.pathname.endsWith('/Sentencias/BuscarPorCriterios')) {
      return respuesta({
        idBusqueda: 'sentencias-1', pageCount: 1, totalFilas: 1,
        rows: [{ idSentencia: 88001, cell: {
          numero: '12345', anio: '2024', organismo: 'Cámara Civil',
          competencia: 'Civil', fechaFirma: '18/11/2026',
          texto: 'Sentencia completa sobre responsabilidad civil.',
          caratula: 'Pérez c/ Provincia del Chubut',
        } }],
      });
    }
    assert.ok(u.pathname.endsWith('/Sumarios/BuscarPorCriterios'));
    const page = Number(u.searchParams.get('PageIndex'));
    if (page === 1) return respuesta({
      idBusqueda: 'sumarios-1', pageCount: 2, totalFilas: 21,
      rows: [
        { idSumario: 88002, cell: {
          numero: '12345', anio: '2024', organismo: 'Cámara Civil',
          competencia: 'Civil', fechaFirma: '18/11/2026',
          sumario: 'Sumario duplicado de la sentencia ya recuperada.',
          caratula: 'Pérez c/ Provincia del Chubut',
        } },
        { idSumario: 88003, cell: {
          numero: '7654', anio: '2025', organismo: 'Cámara Laboral',
          competencia: 'Trabajo', fechaFirma: '19/11/2026',
          sumario: 'Sumario de respaldo sobre responsabilidad laboral.',
          caratula: 'Gómez c/ Empresa s/ despido',
        } },
      ],
    });
    return respuesta({
      idBusqueda: 'sumarios-1', pageCount: 2, totalFilas: 21,
      rows: [{ idSumario: 88004, cell: {
        numero: '9999', anio: '2023', organismo: 'Cámara Penal',
        competencia: 'Penal', fechaFirma: '20/11/2026',
        sumario: 'Otro sumario disponible en página dos.',
        caratula: 'Fiscal c/ Rojas',
      } }],
    });
  }, async () => {
    const primera = await buscarChubut({ q: 'responsabilidad ambiental', porPagina: 20 });
    assert.equal(primera.resultados[0].id, 'chubut_sentencia_88001');
    assert.equal(primera.resultados[0].tipo, 'fallo');
    assert.equal(primera.resultados[1].id, 'chubut_sumario_88003');
    assert.equal(primera.resultados[1].tipo, 'sumario');
    assert.equal(primera.resultados[1].esSumarioRespaldo, true);
    assert.equal(primera.cantidadFallos, 1);
    assert.equal(primera.cantidadSumarios, 1);
    assert.equal(primera.tipoConsulta, 'fallos_con_sumarios_de_respaldo');
    assert.equal(primera.siguienteDesde, 1_000_002);

    const segunda = await buscarChubut({
      q: 'responsabilidad ambiental', desde: primera.siguienteDesde,
      pagina: 1, porPagina: 20,
    });
    assert.equal(segunda.resultados[0].id, 'chubut_sumario_88004');
    assert.equal(segunda.resultados[0].esSumarioRespaldo, true);
    assert.equal(segunda.siguienteDesde, null);
  });

  assert.ok(llamadas.some((x) => x.url.pathname.endsWith('/Sentencias/BuscarPorCriterios')));
  assert.ok(llamadas.some((x) => x.url.pathname.endsWith('/Sumarios/BuscarPorCriterios')));
  assert.equal(llamadas.filter((x) => x.url.pathname.endsWith('/RegistrarAccesoAnonimo')).length, 2);
  const pathOrden = llamadas.filter((x) => /BuscarPorCriterios/.test(x.url.pathname)).map((x) => x.url.pathname);
  assert.ok(pathOrden[0].endsWith('/Sentencias/BuscarPorCriterios'));
  assert.ok(pathOrden[1].endsWith('/Sumarios/BuscarPorCriterios'));
  assert.equal(llamadas.at(-1).url.searchParams.get('PageIndex'), '2');
});

test('TFN llama al contrato estricto del API y rotula texto asistido por IA', async () => {
  let pedido;
  await conFetch(async (url, opciones) => {
    pedido = { url: String(url), opciones, body: JSON.parse(opciones.body) };
    return respuesta({
      total: 120,
      results: [{
        fallo_id: 'IF-2024-53712803-APN-VOCII#TFN',
        matched_texto: 'Deducción de intereses en ganancias',
        objeto_texto: 'Impuesto a las ganancias. Deducción de intereses.',
        doctrinas: ['Intereses deducibles', 'Prueba contable'],
        sumarios: ['El organismo analiza la deducción tributaria.'],
        texto_completo: 'Texto completo de la resolución del Tribunal Fiscal.',
        has_pdf: true,
        metadata: { sala: 'Sala B', fecha: '2024-04-22', expediente: 'IF-2024-53712803' },
      }],
    });
  }, async () => {
    const d = await buscarTfn({ q: 'deducción de intereses', tribunal: 'doctrinas' });
    assert.equal(d.total, 120);
    assert.equal(d.resultados.length, 1);
    assert.equal(d.resultados[0].id, 'tfn_IF-2024-53712803-APN-VOCII_TFN');
    assert.equal(d.resultados[0].metadatosAsistidos, true);
    assert.match(d.resultados[0].sumario, /Texto completo/);
    assert.equal(d.resultados[0].linkFallo, undefined, 'no inventa una URL de PDF a partir de has_pdf');
  });
  assert.match(pedido.url, /api\.jurisprudencia-tfn\.ar\/hybridSearch$/);
  assert.deepEqual(pedido.body, { query: 'deducción de intereses', search_in: 'doctrinas' });
  assert.deepEqual(Object.keys(pedido.body).sort(), ['query', 'search_in']);
});

test('Santa Cruz separa objetos judiciales de doctrinas asistidas', async () => {
  let pedido;
  await conFetch(async (url, opciones) => {
    pedido = { url: String(url), body: JSON.parse(opciones.body) };
    return respuesta({
      total: 62,
      results: [{
        fallo_id: 'TSJI-20260417-001',
        objeto_texto: 'Amparo por derecho a la salud.',
        texto_completo: 'El tribunal analiza el derecho a la salud.',
        metadata: { caratula: 'Gómez s/ amparo', fecha: '2026-04-17', sala: 'STJ' },
        doctrinas: [],
        sumarios: [],
      }],
    });
  }, async () => {
    const d = await buscarSantaCruz({ q: 'amparo', tribunal: 'objetos' });
    assert.equal(d.resultados[0].id, 'santacruz_TSJI-20260417-001');
    assert.equal(d.resultados[0].metadatosAsistidos, true);
    assert.match(d.resultados[0].caratula, /Gómez/);
  });
  assert.match(pedido.url, /api\.tsj-sc\.inteligencialegal\.com\.ar\/hybridSearch$/);
  assert.deepEqual(pedido.body, { query: 'amparo', search_in: 'objetos' });
});

test('HUDOC devuelve total y cursor oficial, con URL de ficha estable', async () => {
  let pedido;
  await conFetch(async url => {
    pedido = new URL(url);
    return respuesta({
      resultcount: 10296,
      results: [
        { columns: { itemid: '001-253882', docname: 'CASE OF MAZZARELLA v. ITALY', kpdate: '2026-11-19', appno: '12345/21', doctypebranch: 'Grand Chamber', languageisocode: 'ENG' } },
        { columns: { itemid: '001-253881', docname: 'CASE OF SAMPLE v. ITALY', kpdate: '2026-11-18', appno: '56789/20', doctypebranch: 'Chamber', languageisocode: 'FRE' } },
      ],
    });
  }, async () => {
    const d = await buscarHudoc({ q: 'freedom of expression', pagina: 2, desde: 20, porPagina: 20 });
    assert.equal(d.total, 10296);
    assert.equal(d.siguienteDesde, 22);
    assert.equal(d.resultados[0].id, 'hudoc_001-253882');
    assert.equal(d.resultados[0].fecha, '2026-11-19');
    assert.equal(d.resultados[0].linkFicha, 'https://hudoc.echr.coe.int/eng?i=001-253882');
    assert.equal(d.resultados[0].sumario, '', 'el título no se presenta como pasaje');
    assert.equal(d.resultados[0].coincidenciaFuente, true);
    assert.equal(d.resultados[0].textoCompletoDisponible, false);
  });
  assert.equal(pedido.searchParams.get('start'), '20');
  assert.equal(pedido.searchParams.get('length'), '20');
  assert.match(pedido.searchParams.get('query'), /contentsitename:ECHR/);
  assert.match(pedido.searchParams.get('query'), /freedom of expression/);
});

test('un total nulo de API híbrida nunca se presenta como cero confirmado', async () => {
  await conFetch(async () => respuesta({
    total: null,
    results: [{
      fallo_id: 'SC-TEST-001',
      objeto_texto: 'Amparo y salud.',
      metadata: { caratula: 'Caso de prueba' },
    }],
  }), async () => {
    const d = await buscarSantaCruz({ q: 'amparo', tribunal: 'objetos' });
    assert.equal(d.total, 1);
    assert.equal(d.totalParcial, true);
    assert.equal(d.resultados.length, 1);
    assert.equal(d.resultados[0].metadatosAsistidos, true);
  });
});

test('extractos temáticos asistidos por IA no se presentan como texto de la sentencia', async () => {
  await conFetch(async () => respuesta({
    total: 1,
    results: [{
      fallo_id: 'SC-IA-TEST-002',
      matched_texto: 'Coincidencia semántica propuesta por el buscador.',
      objeto_texto: 'Objeto asistido por IA.',
      doctrinas: ['Responsabilidad civil'],
      sumarios: ['Resumen temático asistido por IA.'],
      metadata: { caratula: 'Caso de control de extracto asistido' },
    }],
  }), async () => {
    const d = await buscarSantaCruz({ q: 'responsabilidad civil', tribunal: 'doctrinas' });
    const r = d.resultados[0];
    assert.equal(r.sumario, '');
    assert.equal(r.coincidenciaFuente, true);
    assert.equal(r.metadatosAsistidos, true);
    assert.match(r.tipoDocumento, /asistido por IA/);
    assert.ok(r.extractoAsistido);
  });
  assert.match(fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8'),
    /if\(r\.coincidenciaFuente===true\) return true/);
});

test('los IDs de los nuevos adaptadores cumplen el validador que usa la cosecha', () => {
  const ids = ['chubut_sentencia_106287', 'tfn_IF-2024-53712803-APN-VOCII_TFN',
    'santacruz_TSJI-20260417-001', 'hudoc_001-253882'];
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{3,160}$/);
});

test('el constructor FTS recibe las cuatro fuentes nuevas', async () => {
  const archivo = fs.readFileSync(new URL('../scripts/armarAcervo.mjs', import.meta.url), 'utf8');
  for (const slug of ['chubut', 'tfn', 'santacruz', 'hudoc']) assert.match(archivo, new RegExp("'" + slug + "'"));
});
