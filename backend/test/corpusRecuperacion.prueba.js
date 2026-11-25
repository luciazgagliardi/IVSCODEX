import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { filtrarPorModo } from '../lib/relevancia.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../..');
const corpusPath = path.join(repoRoot, 'docs/ivscodex-2.0/04-corpus-recuperacion-v1.json');

function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

test('el corpus piloto conserva procedencia, fixtures y etiquetas positivas/negativas coherentes', () => {
  assert.ok(fs.existsSync(corpusPath), 'falta el corpus versionado');
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

  assert.equal(corpus.version, '1.1.4');
  assert.equal(corpus.estado, 'piloto_provisional_con_cola_de_fuentes_pendientes_no_apto_para_metricas');
  assert.equal(corpus.documentos.length, corpus.resumen.documentos);
  assert.equal(corpus.casos.length, corpus.resumen.consultas);

  const documentos = new Map();
  for (const documento of corpus.documentos) {
    assert.ok(documento.id, 'todo documento necesita ID estable');
    assert.ok(!documentos.has(documento.id), `ID documental duplicado: ${documento.id}`);
    documentos.set(documento.id, documento);
    assert.match(documento.fecha, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(documento.expediente);
    assert.ok(documento.caratula);
    assert.equal(documento.tipoDocumento, 'sentencia');
    assert.equal(documento.revision, 'pendiente_revision_juridica_humana');

    const fixturePath = path.resolve(repoRoot, documento.fuente.fixturePath);
    assert.ok(
      fixturePath.startsWith(path.join(repoRoot, 'backend/test/fallos') + path.sep),
      `fixture fuera del directorio permitido: ${documento.fuente.fixturePath}`
    );
    assert.ok(fs.existsSync(fixturePath), `falta el fixture: ${documento.fuente.fixturePath}`);

    const texto = normalizar(fs.readFileSync(fixturePath, 'utf8'));
    assert.ok(texto.length > 500, `fixture demasiado corto: ${documento.id}`);
    for (const ancla of documento.anclasTextuales) {
      assert.ok(texto.includes(normalizar(ancla)), `ancla «${ancla}» ausente en ${documento.id}`);
    }

    if (documento.id === 'mza-scjm-rio-uruguay-2026-05-08') {
      const url = new URL(documento.fuente.officialUrl);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'wwwnoti.jus.mendoza.gov.ar');
      assert.equal(url.pathname, '/listas/proveidos/vertexto.php');
      assert.equal(url.searchParams.get('ide'), '12010568712');
    } else if (documento.id === 'caba-tsj-rozen-2003-07-02') {
      const url = new URL(documento.fuente.officialUrl);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'tsjcaba.opac.ar');
      assert.equal(url.pathname, '/pgmedia/Media/PDFs/1.5740_D-05998.%20Fallos%20TSJ%20CABA%202003.pdf');
      assert.equal(documento.fuente.localizadorOficial.expediente, '2183/03');
      assert.deepEqual(documento.fuente.localizadorOficial.paginasImpresas, [418, 419]);
    } else {
      assert.equal(documento.fuente.officialUrl, null);
      assert.match(documento.fuente.estadoUrl, /pendiente/);
    }
  }


  const candidatos = corpus.candidatosPendientesFuente ?? [];
  assert.equal(candidatos.length, corpus.resumen.candidatosPendientesFuente);
  const candidatosIds = new Set();
  for (const candidato of candidatos) {
    assert.ok(candidato.id);
    assert.ok(!documentos.has(candidato.id), `candidato repetido en documentos gold: ${candidato.id}`);
    assert.ok(!candidatosIds.has(candidato.id), `candidato duplicado: ${candidato.id}`);
    candidatosIds.add(candidato.id);
    assert.equal(candidato.fuente.officialUrl, null, 'un localizador de boletín no equivale al texto individual de la sentencia');
    if (candidato.fecha !== null) assert.match(candidato.fecha, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
    if (candidato.id === 'caba-tsj-distribuidora-pompeya') {
      const locator = candidato.fuente.localizadorOficial;
      assert.equal(locator.tipo, 'boletin_oficial_sumario_no_texto_de_sentencia');
      const locatorUrl = new URL(locator.url);
      assert.equal(locatorUrl.protocol, 'https:');
      assert.equal(locatorUrl.hostname, 'www.tsjbaires.gob.ar');
      assert.equal(locatorUrl.pathname, '/repositorio/indicesboletines/2025/2025_11_Boletin_indice.pdf');
      assert.equal(locator.fechaSentencia, '2025-11-05');
      assert.equal(locator.expedientePublicado, 'SAL 44430/25-0');
      assert.equal(locator.paginaImpreso, 6);
      assert.equal(candidato.fecha, '2025-11-05');
      assert.match(candidato.fechaOrigen, /Boletín de Jurisprudencia/);
      assert.match(candidato.fuente.estadoUrl, /fuente_primaria_pendiente/);
    } else {
      assert.equal(candidato.fuente.localizadorOficial, undefined);
    }
    if (candidato.id === 'caba-tsj-federacion-gey') {
      assert.equal(candidato.fecha, null, 'la firma del fixture no valida la fecha judicial');
      assert.equal(candidato.fechaObservadaEnFixture, '09/09/2026 13:29:26');
      assert.match(candidato.fechaOrigen, /no cotejada en fuente primaria/);
    }
    assert.match(candidato.fuente.estadoUrl, /fuente_primaria_pendiente/);
    assert.ok(candidato.bloqueo.length > 30);
    assert.ok(candidato.anclasTextuales.length > 0);
    assert.ok(!/fecha_final_confirmada/.test(candidato.fuente.estadoUrl));

    const fixture = path.resolve(repoRoot, candidato.fuente.fixturePath);
    assert.ok(
      fixture.startsWith(path.join(repoRoot, 'backend/test/fallos') + path.sep),
      `fixture candidato fuera del directorio permitido: ${candidato.fuente.fixturePath}`
    );
    assert.ok(fs.existsSync(fixture), `falta fixture pendiente: ${candidato.fuente.fixturePath}`);
    const texto = normalizar(fs.readFileSync(fixture, 'utf8'));
    for (const ancla of candidato.anclasTextuales) {
      assert.ok(texto.includes(normalizar(ancla)), `ancla pendiente «${ancla}» ausente en ${candidato.id}`);
    }
    assert.ok(
      !corpus.casos.some((caso) =>
        [...caso.positivos, ...caso.negativos].some((etiqueta) => etiqueta.documentoId === candidato.id)
      ),
      'un candidato sin fuente primaria no puede entrar como positivo/negativo gold'
    );
  }

  const referencias = corpus.referenciasOficialesNoGold ?? [];
  assert.equal(referencias.length, corpus.resumen.referenciasOficialesNoGold);
  const referenciaPompeya = referencias.find((r) => r.id === 'caba-tsj-sumario-pompeya-2025-11');
  assert.ok(referenciaPompeya, 'falta la referencia institucional del sumario de Pompeya');
  assert.equal(referenciaPompeya.tipoDocumento, 'sumario_jurisprudencial_oficial');
  assert.equal(referenciaPompeya.esSentencia, false);
  assert.equal(referenciaPompeya.integraGold, false);
  assert.equal(referenciaPompeya.metadatosPublicados.expediente, 'SAL 44430/25-0');
  assert.equal(referenciaPompeya.metadatosPublicados.fechaSentencia, '2025-11-05');
  assert.deepEqual(referenciaPompeya.fuente.paginasDeLaEntrada, [5, 6]);
  assert.deepEqual(referenciaPompeya.fuente.paginasImpresas, [2, 4, 5, 6]);
  const urlSumario = new URL(referenciaPompeya.fuente.url);
  assert.equal(urlSumario.protocol, 'https:');
  assert.equal(urlSumario.hostname, 'www.tsjbaires.gob.ar');
  assert.equal(urlSumario.pathname, '/repositorio/indicesboletines/2025/2025_11_Boletin_indice.pdf');
  assert.equal(referenciaPompeya.politicaDeUso.puedeSatisfacerFiltroSoloSentencias, false);
  assert.equal(referenciaPompeya.politicaDeUso.puedePresentarseComoTextoCompleto, false);
  assert.equal(referenciaPompeya.politicaDeUso.aptoParaMetricasGold, false);
  const portalBuscador = new URL(referenciaPompeya.fuente.portalBuscadorSentencias);
  assert.equal(portalBuscador.protocol, 'https:');
  assert.equal(portalBuscador.hostname, 'www.tsjbaires.gob.ar');
  assert.equal(portalBuscador.pathname, '/servicios/jurisprudencia/buscador-de-sentencias');
  const candidatoPompeya = candidatos.find((c) => c.id === 'caba-tsj-distribuidora-pompeya');
  assert.equal(candidatoPompeya.referenciaOficialNoGoldId, referenciaPompeya.id);
  assert.equal(candidatoPompeya.fuente.officialUrl, null,
    'el enlace a un boletín no sustituye la URL de la sentencia individual');
  assert.ok(!corpus.documentos.some((d) => d.id === referenciaPompeya.id));
  assert.ok(!corpus.casos.some((caso) =>
    [...caso.positivos, ...caso.negativos].some((e) => e.documentoId === referenciaPompeya.id)
  ));

  const casos = new Set();
  let positivos = 0;
  let negativos = 0;
  for (const caso of corpus.casos) {
    assert.ok(caso.id);
    assert.ok(!casos.has(caso.id), `ID de consulta duplicado: ${caso.id}`);
    casos.add(caso.id);
    assert.ok(caso.consulta);
    assert.ok(caso.filtros?.jurisdiccion);
    assert.ok(caso.filtros?.tribunal);
    assert.ok(caso.positivos.length > 0);
    assert.ok(caso.negativos.length > 0);
    assert.equal(caso.aptoParaMetricas, false);
    assert.equal(caso.revision, 'pendiente_revision_juridica_humana');

    const positivosCaso = new Set();
    for (const positivo of caso.positivos) {
      assert.ok(documentos.has(positivo.documentoId), `positivo desconocido: ${positivo.documentoId}`);
      assert.ok(positivo.anclas.length > 0);
      positivosCaso.add(positivo.documentoId);
      positivos++;
    }
    for (const negativo of caso.negativos) {
      assert.ok(documentos.has(negativo.documentoId), `negativo desconocido: ${negativo.documentoId}`);
      assert.ok(!positivosCaso.has(negativo.documentoId), 'un documento no puede ser positivo y negativo en el mismo caso');
      assert.ok(negativo.motivo.length > 30, 'cada exclusión necesita una justificación concreta');
      negativos++;
    }
  }

  assert.equal(positivos, corpus.resumen.etiquetasPositivas);
  assert.equal(negativos, corpus.resumen.etiquetasNegativas);
  assert.equal(corpus.resumen.casosAptosParaMetricas, 0);
  assert.ok(['success', 'en_validacion'].includes(corpus.validacionAutomatizada?.resultado));
  assert.equal(corpus.validacionAutomatizada?.pruebas?.total, 308);
  assert.equal(corpus.validacionAutomatizada?.pruebas?.aprobadas, 308);
  assert.equal(corpus.validacionAutomatizada?.pruebas?.fallidas, 0);
  assert.equal(corpus.pruebaMotorLocal?.motor, 'backend/lib/indice.js::buscarEnIndice + backend/lib/relevancia.js::filtrarPorModo');
  assert.equal(corpus.pruebaMotorLocal?.modo, 'todas');
  assert.equal(corpus.pruebaMotorLocal?.aflojar, false);
  assert.ok(corpus.casos.every((caso) => !caso.aptoParaMetricas));
});


test('el filtro de relevancia recupera positivos y excluye negativos difíciles del corpus real', () => {
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const registros = corpus.documentos.map((documento) => {
    const fixturePath = path.resolve(repoRoot, documento.fuente.fixturePath);
    const textoCompleto = fs.readFileSync(fixturePath, 'utf8');
    // El filtro real consume carátula, sumario, voces y expediente.
    // El texto íntegro del fixture se usa aquí como campo textual de referencia
    // para probar el algoritmo sin red ni dependencia de los portales.
    return {
      id: documento.id,
      jurisdiccion: documento.jurisdiccion,
      tribunal: documento.tribunal,
      tipoDocumento: documento.tipoDocumento,
      fecha: documento.fecha,
      caratula: documento.caratula,
      expediente: documento.expediente,
      sumario: textoCompleto,
      voces: [],
    };
  });

  const porId = new Map(registros.map((registro) => [registro.id, registro]));
  for (const caso of corpus.casos) {
    const salida = filtrarPorModo(registros, {
      q: caso.consulta,
      modo: 'todas',
      aflojar: false,
    });
    const ids = new Set(salida.lista.map((registro) => registro.id));
    assert.equal(ids.size, salida.lista.length, `el filtro duplicó IDs en ${caso.id}`);

    for (const positivo of caso.positivos) {
      assert.ok(
        ids.has(positivo.documentoId),
        `el filtro real omitió el positivo ${positivo.documentoId} en ${caso.id}`
      );
      const documento = porId.get(positivo.documentoId);
      assert.equal(documento.jurisdiccion, caso.filtros.jurisdiccion);
      assert.equal(documento.tribunal, caso.filtros.tribunal);
      assert.ok(caso.filtros.tiposDocumentales.includes(documento.tipoDocumento));
    }

    for (const negativo of caso.negativos) {
      assert.ok(
        !ids.has(negativo.documentoId),
        `el filtro real incorporó el negativo ${negativo.documentoId} en ${caso.id}`
      );
    }
    assert.equal(salida.aflojado, false, 'la prueba estricta no debe relajar silenciosamente la consulta');
  }

  // Control adversarial: Río Uruguay comparte vocabulario genérico con la
  // búsqueda laboral (indemnización, banco, laboral), pero no debe sobrevivir
  // al modo «todas» para una consulta sobre despido discriminatorio en BBVA.
  const laboral = corpus.casos.find((caso) => caso.id === 'REC-MZA-LAB-001');
  const rio = porId.get('mza-scjm-rio-uruguay-2026-05-08');
  const estricto = filtrarPorModo(registros, {
    q: laboral.consulta,
    modo: 'todas',
    aflojar: false,
  }).lista;
  const amplio = filtrarPorModo(registros, {
    q: laboral.consulta,
    modo: 'alguna',
  }).lista;
  assert.ok(!estricto.some((registro) => registro.id === rio.id));
  assert.ok(amplio.some((registro) => registro.id === rio.id),
    'el negativo difícil debe mostrar por qué «alguna» no equivale a pertinencia jurídica');
});


test('buscarEnIndice recupera el corpus en almacenamiento temporal y deduplica por ID', async () => {
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const directorioTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'ivscodex-corpus-'));
  const indiceAnterior = process.env.DIR_INDICE;
  process.env.DIR_INDICE = directorioTemporal;

  try {
    // Importación diferida: config.js toma DIR_INDICE al cargar el módulo.
    // El índice queda aislado en un directorio temporal, nunca en /home/datos.
    const { upsertRegistros, buscarEnIndice } = await import('../lib/indice.js');
    const registros = corpus.documentos.map((documento) => ({
      id: documento.id,
      caratula: documento.caratula,
      expediente: documento.expediente,
      fecha: documento.fecha,
      jurisdiccion: documento.jurisdiccion,
      tribunal: documento.tribunal,
      tipoDocumento: documento.tipoDocumento,
      sumario: fs.readFileSync(path.resolve(repoRoot, documento.fuente.fixturePath), 'utf8'),
      voces: [],
    }));

    assert.equal(await upsertRegistros('ivscodex2_corpus_test', registros), 3);
    assert.equal(await upsertRegistros('ivscodex2_corpus_test', [registros[0], registros[0]]), 3,
      'guardar dos veces el mismo ID no debe aumentar el inventario');

    for (const caso of corpus.casos) {
      const resultados = await buscarEnIndice('ivscodex2_corpus_test', caso.consulta, { modo: 'todas' });
      const ids = new Set(resultados.map((resultado) => resultado.id));
      assert.ok(resultados.every((resultado) => typeof resultado.id === 'string' && resultado.id.length > 0),
        `buscarEnIndice devolvió un registro sin ID en ${caso.id}`);
      assert.equal(ids.size, resultados.length, `IDs duplicados en ${caso.id}`);

      for (const positivo of caso.positivos) {
        assert.ok(ids.has(positivo.documentoId),
          `buscarEnIndice omitió ${positivo.documentoId} en ${caso.id}`);
      }
      for (const negativo of caso.negativos) {
        assert.ok(!ids.has(negativo.documentoId),
          `buscarEnIndice incorporó ${negativo.documentoId} en ${caso.id}`);
      }
    }


    const filtrosTribunal = [
      { id: 'mza_filtro_sc', tribunal: 'SUPREMA CORTE DE JUSTICIA' },
      { id: 'mza_filtro_cc', tribunal: '2ª CÁMARA EN LO CIVIL, COMERCIAL Y MINAS' },
      { id: 'mza_filtro_ct', tribunal: 'CÁMARA DEL TRABAJO' },
      { id: 'mza_filtro_sin_tribunal', tribunal: '' },
    ].map((registro) => ({
      ...registro,
      caratula: `Documento ${registro.id}`,
      expediente: registro.id,
      fecha: '12/03/2024 - Sentencia',
      sumario: 'zebrafiltrounico',
    }));
    // Se usa la clave real «mendoza» para activar exactamente el filtro de SC/CC/CT.
    assert.equal(await upsertRegistros('mendoza', filtrosTribunal), 4);
    for (const [codigo, esperado] of [
      ['SC', 'mza_filtro_sc'],
      ['CC', 'mza_filtro_cc'],
      ['CT', 'mza_filtro_ct'],
    ]) {
      const salidaTribunal = await buscarEnIndice(
        'mendoza',
        'zebrafiltrounico',
        { modo: 'todas', tribunal: codigo }
      );
      assert.deepEqual(
        salidaTribunal.map((registro) => registro.id),
        [esperado],
        `el respaldo JSON debe respetar el filtro ${codigo}`
      );
    }
    const todosLosFueros = await buscarEnIndice(
      'mendoza',
      'zebrafiltrounico',
      { modo: 'todas', tribunal: 'todo' }
    );
    assert.deepEqual(
      new Set(todosLosFueros.map((registro) => registro.id)),
      new Set(['mza_filtro_sc', 'mza_filtro_cc', 'mza_filtro_ct', 'mza_filtro_sin_tribunal'])
    );

    const laboral = corpus.casos.find((caso) => caso.id === 'REC-MZA-LAB-001');
    const algunTermino = await buscarEnIndice('ivscodex2_corpus_test', laboral.consulta, { modo: 'alguna' });
    assert.ok(algunTermino.some((resultado) => resultado.id === 'mza-scjm-rio-uruguay-2026-05-08'),
      'el control adversarial debe seguir detectando el ruido que introduce «alguna»');
  } finally {
    if (indiceAnterior === undefined) delete process.env.DIR_INDICE;
    else process.env.DIR_INDICE = indiceAnterior;
    fs.rmSync(directorioTemporal, { recursive: true, force: true });
  }
});
