import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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

  assert.equal(corpus.version, '1.1.3');
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
  assert.equal(corpus.validacionAutomatizada?.resultado, 'success');
  assert.equal(corpus.validacionAutomatizada?.pruebas?.total, 307);
  assert.equal(corpus.validacionAutomatizada?.pruebas?.aprobadas, 307);
  assert.equal(corpus.validacionAutomatizada?.pruebas?.fallidas, 0);
  assert.equal(corpus.pruebaMotorLocal?.motor, 'backend/lib/relevancia.js::filtrarPorModo');
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
