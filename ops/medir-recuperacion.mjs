#!/usr/bin/env node
/**
 * Línea de base de recuperación de IVS CODEX (auditoría integral 2026).
 *
 * Qué mide, por fuente y por consulta, contra la API publicada (o la que se
 * indique con --api): total informado, total de la fuente, fichas devueltas,
 * ids únicos, duplicados por id dentro de la respuesta, cuasi duplicados
 * (misma carátula y fecha con distinto id), errores (y su código), latencia,
 * solapamiento de ids entre fuentes y aporte de cada variante de un par
 * («usucapión» / «prescripción adquisitiva», etc.).
 *
 * Qué NO mide: precisión ni exhaustividad (recall). No hay juicios de
 * relevancia revisados por abogados; la «coincidencia léxica» que se informa
 * (todas las raíces de la consulta en carátula + sumario + voces) es sólo un
 * indicador de ruido superficial, no de pertinencia jurídica.
 *
 * Cómo pide: igual que la pantalla de Buscar en una búsqueda nueva
 * (frontend/index.html, buscarEnFuente): POST /api/indice/<fuente>/buscar con
 * { q, modo: 'todas', pagina: 1, pedirEnVivo: true }. Sin variantes: cada
 * forma del par se consulta por separado para medir lo que aporta.
 *
 * Cortesía: una consulta cada ≥ 1,5 s por fuente, un ritmo global por debajo
 * del límite del servidor (120 pedidos / 5 min, cabecera RateLimit), un
 * presupuesto total de minutos (por defecto 22) y, si una fuente falla tres
 * veces seguidas, sólo se la vuelve a probar una de cada cinco consultas
 * (las demás quedan registradas como «omitida_por_caida», no como cero).
 *
 * Uso:
 *   NODE_USE_ENV_PROXY=1 node ops/medir-recuperacion.mjs \
 *     [--api https://…/api] [--salida ruta.json] [--max-minutos 22] \
 *     [--fuentes mendoza,saij,…] [--consultas 10] [--sin-sintaxis]
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));

const API = String(args.api || 'https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api').replace(/\/$/, '');
const SALIDA = args.salida || 'docs/auditoria-integral-2026/datos/linea-base-recuperacion.json';
const MAX_MINUTOS = Number(args['max-minutos'] || 22);
const TIMEOUT_MS = Number(args.timeout || 60_000);
const ESPACIO_POR_FUENTE_MS = 1_500;
const PEDIDOS_POR_MINUTO = Number(args.ritmo || 22); // < 120/5 min = 24/min
const ESPACIO_GLOBAL_MS = Math.ceil(60_000 / PEDIDOS_POR_MINUTO);
const FALLAS_PARA_ESPACIAR = 3;
const REPROBAR_CADA = 5;

/* ---------- batería ---------- */

// Fuentes integradas que se consultan automáticamente (backend/lib/fuentes.js).
// De las seis vistas provinciales de SAIJ se mide una (Córdoba) para no
// multiplicar el mismo motor; el resto comparte faceta, motor y código.
const FUENTES_POR_DEFECTO = ['mendoza', 'caba', 'saij', 'csjn', 'dialnet', 'mendozalegal', 'corteidh',
  'rionegro', 'juristeca', 'santafe', 'catamarca', 'scba', 'cordoba'];
const FUENTES = args.fuentes ? String(args.fuentes).split(',').map((s) => s.trim()).filter(Boolean) : FUENTES_POR_DEFECTO;

// rama: la del árbol RAMAS del frontend cuando existe; par: grupo de variantes.
const CONSULTAS_TODAS = [
  { id: 'q01', q: 'daño moral', rama: 'daños', par: 'A' },
  { id: 'q02', q: 'consecuencias no patrimoniales', rama: 'daños', par: 'A' },
  { id: 'q03', q: 'usucapión', rama: 'reales', par: 'B' },
  { id: 'q04', q: 'prescripción adquisitiva', rama: 'reales', par: 'B' },
  { id: 'q05', q: 'tenencia de los hijos', rama: 'familia', par: 'C' },
  { id: 'q06', q: 'cuidado personal', rama: 'familia', par: 'C' },
  { id: 'q07', q: 'régimen de visitas', rama: 'familia', par: 'D' },
  { id: 'q08', q: 'régimen de comunicación', rama: 'familia', par: 'D' },
  { id: 'q09', q: 'suspensión del juicio a prueba', rama: 'procesal penal', par: 'E' },
  { id: 'q10', q: 'probation', rama: 'procesal penal', par: 'E' },
  { id: 'q11', q: 'daño punitivo', rama: 'consumidor' },
  { id: 'q12', q: 'relación de consumo', rama: 'consumidor' },
  { id: 'q13', q: 'mala praxis médica', rama: 'daños' },
  { id: 'q14', q: 'despido discriminatorio', rama: 'laboral' },
  { id: 'q15', q: 'accidente in itinere', rama: 'riesgos del trabajo' },
  { id: 'q16', q: 'cuota alimentaria', rama: 'familia' },
  { id: 'q17', q: 'compensación económica', rama: 'familia' },
  { id: 'q18', q: 'silencio de la administración', rama: 'administrativo' },
  { id: 'q19', q: 'estabilidad del empleado público', rama: 'administrativo' },
  { id: 'q20', q: 'prisión preventiva', rama: 'penal' },
  { id: 'q21', q: 'dolo eventual', rama: 'penal' },
  { id: 'q22', q: 'determinación de oficio', rama: 'tributario' },
  { id: 'q23', q: 'convenio multilateral', rama: 'tributario' },
  { id: 'q24', q: 'daño ambiental colectivo', rama: 'ambiental' },
  { id: 'q25', q: 'concesión de uso de agua', rama: 'aguas' },
  { id: 'q26', q: 'servidumbre minera', rama: 'minería' },
  { id: 'q27', q: 'verificación de créditos', rama: 'concursos' },
  { id: 'q28', q: 'pronto pago laboral', rama: 'concursos' },
  { id: 'q29', q: 'exclusión de cobertura', rama: 'seguros' },
  { id: 'q30', q: 'citación en garantía', rama: 'seguros' },
  { id: 'q31', q: 'movilidad jubilatoria', rama: 'previsional' },
  { id: 'q32', q: 'declaratoria de herederos', rama: 'sucesiones' },
  { id: 'q33', q: 'legítima hereditaria', rama: 'sucesiones' },
  { id: 'q34', q: 'control de convencionalidad', rama: 'constitucional / DDHH' },
  { id: 'q35', q: 'acción de amparo', rama: 'constitucional' },
  { id: 'q36', q: 'restitución internacional de menores', rama: 'internacional privado' },
  { id: 'q37', q: 'perspectiva de género', rama: 'género' },
  { id: 'q38', q: 'violencia económica', rama: 'género' },
  { id: 'q39', q: 'interés superior del niño', rama: 'niñez' },
  { id: 'q40', q: 'derecho de autor', rama: 'propiedad intelectual' },
  { id: 'q41', q: 'hábeas data', rama: 'datos personales' },
  { id: 'q42', q: 'derecho al olvido', rama: 'datos personales' },
];
const CONSULTAS = args.consultas ? CONSULTAS_TODAS.slice(0, Number(args.consultas)) : CONSULTAS_TODAS;

// Sondas de sintaxis: la misma consulta escrita de dos maneras, en fuentes con
// motores distintos. Sirven para ver si la interpretación es coherente.
const SINTAXIS = [
  { id: 's01', fuente: 'mendoza', cuerpo: { q: 'daño moral', modo: 'todas', tribunal: 'SC' }, contra: 's02', prueba: 'comillas' },
  { id: 's02', fuente: 'mendoza', cuerpo: { q: '"daño moral"', modo: 'todas', tribunal: 'SC' }, prueba: 'comillas' },
  { id: 's03', fuente: 'saij', cuerpo: { q: 'daño moral', modo: 'exacta' }, contra: 's04', prueba: 'comillas en frase exacta' },
  { id: 's04', fuente: 'saij', cuerpo: { q: '"daño moral"', modo: 'exacta' }, prueba: 'comillas en frase exacta' },
  { id: 's05', fuente: 'cordoba', cuerpo: { q: 'daño moral -punitivo', modo: 'todas' }, prueba: 'signo menos', exigeAusente: 'punitiv' },
  { id: 's06', fuente: 'cordoba', cuerpo: { q: 'daño moral', modo: 'todas', excluir: 'punitivo' }, prueba: 'campo excluir', exigeAusente: 'punitiv' },
  { id: 's07', fuente: 'tucuman', cuerpo: { q: 'usucapión OR prescripción adquisitiva', modo: 'todas' }, prueba: 'OR literal' },
  { id: 's08', fuente: 'tucuman', cuerpo: { q: 'usucapión', modo: 'todas', variantes: ['prescripción adquisitiva'] }, prueba: 'variantes con pedirEnVivo' },
];

/* ---------- utilidades ---------- */

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const plegar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const VACIAS = new Set('de del la las el los un una unos unas y e o u en al a ante con sin por para que se su sus lo le les es son como mas sobre entre desde hasta segun contra ni no'.split(' '));
const raices = (q) => plegar(q).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3 && !VACIAS.has(w)).map((w) => w.slice(0, 6));
const textoDe = (r) => plegar([r.caratula, r.sumario, (r.voces || []).join(' ')].filter(Boolean).join(' '));
const mediana = (xs) => { const v = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
const percentil = (xs, p) => { const v = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)] : null; };
const suma = (xs) => xs.reduce((a, b) => a + (Number(b) || 0), 0);

const inicio = Date.now();
const fin = inicio + MAX_MINUTOS * 60_000;
let ultimoGlobal = 0;
let rate = { limite: null, quedan: null, reinicioS: null };
let colaGlobal = Promise.resolve();

/** Turno global: separa los arranques de pedido y respeta la cabecera RateLimit. */
function turnoGlobal() {
  const t = colaGlobal.then(async () => {
    if (rate.quedan !== null && rate.quedan <= 3 && rate.reinicioS) {
      await esperar((rate.reinicioS + 2) * 1000);
      rate.quedan = null;
    }
    const falta = ultimoGlobal + ESPACIO_GLOBAL_MS - Date.now();
    if (falta > 0) await esperar(falta);
    ultimoGlobal = Date.now();
  });
  colaGlobal = t.catch(() => {});
  return t;
}

function leerRateLimit(resp) {
  const h = resp.headers.get('ratelimit') || '';
  const m = (k) => { const x = new RegExp(`${k}=(\\d+)`).exec(h); return x ? Number(x[1]) : null; };
  if (h) rate = { limite: m('limit'), quedan: m('remaining'), reinicioS: m('reset') };
}

async function pedir(fuente, cuerpo) {
  await turnoGlobal();
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const resp = await fetch(`${API}/indice/${fuente}/buscar`, {
      method: 'POST', signal: control.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ivs-codex-auditoria/1.0' },
      body: JSON.stringify(cuerpo),
    });
    leerRateLimit(resp);
    const texto = await resp.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* 502 de Azure, HTML, etc. */ }
    return { http: resp.status, ms: Date.now() - t0, json, crudo: json ? null : texto.slice(0, 200) };
  } catch (e) {
    return { http: null, ms: Date.now() - t0, json: null, error: e?.name === 'AbortError' ? 'cliente_tiempo_agotado' : String(e?.cause?.code || e?.message || e) };
  } finally {
    clearTimeout(reloj);
  }
}

/** Resume una respuesta: sin textos, con ids (para solapamientos). */
function resumir(fuente, consulta, r) {
  const j = r.json || {};
  const lista = Array.isArray(j.resultados) ? j.resultados.filter(Boolean) : [];
  const ids = lista.map((x) => x.id).filter(Boolean);
  const unicos = [...new Set(ids)];
  const claves = lista.map((x) => `${plegar(x.caratula).replace(/\s+/g, ' ').trim()}|${String(x.fecha || '').trim()}`);
  const vistos = new Map();
  let cuasi = 0;
  claves.forEach((k, i) => { if (!k.startsWith('|') && k !== '|' && vistos.has(k) && vistos.get(k) !== ids[i]) cuasi++; else vistos.set(k, ids[i]); });
  const rs = raices(consulta.q);
  const lexico = lista.filter((x) => rs.every((w) => textoDe(x).includes(w))).length;
  const porTipo = {};
  for (const x of lista) { const k = x.tipo || x.tipoDocumento || 'sin_tipo'; porTipo[k] = (porTipo[k] || 0) + 1; }
  let estado;
  if (r.error) estado = 'error_cliente';
  else if (r.http === 429 || j.codigo === 'DEMASIADAS_PETICIONES') estado = 'limitado';
  else if (!r.json) estado = 'error_http';
  else if (j.ok === false) estado = 'error_fuente';
  else if (!lista.length) estado = 'cero';
  else estado = 'con_resultados';
  return {
    fuente, consulta: consulta.id, q: consulta.q, estado,
    http: r.http, ms: r.ms, codigo: j.codigo || r.error || (r.json ? null : `http_${r.http}`), mensaje: j.mensaje || r.crudo || null,
    total: j.total ?? null, totalFuente: j.totalFuente ?? null, totalParcial: j.totalParcial ?? null,
    revisados: j.revisados ?? null, aflojado: j.aflojado ?? null, enVivo: j.enVivo ?? null,
    desdeIndiceLocal: j.desdeIndiceLocal ?? null, origenEnVivo: j.origenEnVivo ?? null, avisoFalla: j.avisoFalla ?? null,
    siguienteDesde: j.siguienteDesde ?? null,
    tribunalesConsultados: j.tribunalesConsultados ?? null, tribunalesSinRespuesta: j.tribunalesSinRespuesta ?? null,
    fichas: lista.length, idsUnicos: unicos.length, duplicadosPorId: ids.length - unicos.length,
    cuasiDuplicados: cuasi, sinSumario: lista.filter((x) => !x.sumario).length,
    idsDeSaijEnOtraFuente: ['saij', 'csjn'].includes(fuente) ? 0 : ids.filter((id) => /^saij_/.test(id)).length,
    coincidenciaLexicaTodas: lexico, porTipo,
    tipoDocumentoFuente: j.fuenteInfo?.tipo ?? null, modalidad: j.fuenteInfo?.modalidad ?? null,
    ids: unicos,
  };
}

/* ---------- ejecución ---------- */

async function medirFuente(fuente, registros) {
  let fallasSeguidas = 0, ultimo = 0, saltadas = 0;
  for (const consulta of CONSULTAS) {
    if (Date.now() > fin) { registros.push({ fuente, consulta: consulta.id, q: consulta.q, estado: 'no_medida_presupuesto', ids: [] }); continue; }
    if (fallasSeguidas >= FALLAS_PARA_ESPACIAR && (saltadas++ % REPROBAR_CADA) !== 0) {
      registros.push({ fuente, consulta: consulta.id, q: consulta.q, estado: 'omitida_por_caida', ids: [] });
      continue;
    }
    const falta = ultimo + ESPACIO_POR_FUENTE_MS - Date.now();
    if (falta > 0) await esperar(falta);
    ultimo = Date.now();
    let r = await pedir(fuente, { q: consulta.q, modo: 'todas', pagina: 1, pedirEnVivo: true });
    if (r.http === 429) { await esperar(((rate.reinicioS || 60) + 2) * 1000); r = await pedir(fuente, { q: consulta.q, modo: 'todas', pagina: 1, pedirEnVivo: true }); }
    const res = resumir(fuente, consulta, r);
    registros.push(res);
    fallasSeguidas = res.estado.startsWith('error') ? fallasSeguidas + 1 : 0;
    if (!res.estado.startsWith('error')) saltadas = 0;
    process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${fuente.padEnd(12)} ${consulta.id} ${res.estado.padEnd(15)} n=${String(res.fichas ?? '').padEnd(3)} total=${res.total ?? '-'} fuente=${res.totalFuente ?? '-'} ${res.ms ?? ''}ms ${res.codigo || ''}\n`);
  }
}

async function sondasSintaxis() {
  const salida = [];
  for (const s of SINTAXIS) {
    if (!FUENTES.includes(s.fuente) && !['tucuman'].includes(s.fuente)) continue;
    const r = await pedir(s.fuente, { ...s.cuerpo, pagina: 1, pedirEnVivo: true });
    const j = r.json || {};
    const lista = Array.isArray(j.resultados) ? j.resultados.filter(Boolean) : [];
    salida.push({
      id: s.id, fuente: s.fuente, prueba: s.prueba, cuerpo: s.cuerpo, http: r.http, ms: r.ms, ok: j.ok ?? null, codigo: j.codigo || r.error || null,
      total: j.total ?? null, totalFuente: j.totalFuente ?? null, revisados: j.revisados ?? null, fichas: lista.length,
      conVariante: lista.filter((x) => x.variante).length,
      ...(s.exigeAusente ? { fichasQueContienenLoExcluido: lista.filter((x) => textoDe(x).includes(s.exigeAusente)).length } : {}),
    });
    process.stderr.write(`sintaxis ${s.id} ${s.fuente} ${s.prueba}: n=${lista.length} total=${j.total ?? '-'} ${j.codigo || ''}\n`);
    await esperar(ESPACIO_POR_FUENTE_MS);
  }
  return salida;
}

function agregar(registros) {
  const porFuente = {};
  for (const f of FUENTES) {
    const rs = registros.filter((r) => r.fuente === f);
    const medidas = rs.filter((r) => !['no_medida_presupuesto', 'omitida_por_caida'].includes(r.estado));
    const okr = medidas.filter((r) => ['con_resultados', 'cero'].includes(r.estado));
    const errores = {};
    for (const r of medidas.filter((r) => r.estado.startsWith('error') || r.estado === 'limitado')) errores[r.codigo || r.estado] = (errores[r.codigo || r.estado] || 0) + 1;
    porFuente[f] = {
      consultasPlanificadas: rs.length,
      medidas: medidas.length,
      conResultados: medidas.filter((r) => r.estado === 'con_resultados').length,
      ceros: medidas.filter((r) => r.estado === 'cero').length,
      errores: suma(Object.values(errores)), erroresPorCodigo: errores,
      omitidasPorCaida: rs.filter((r) => r.estado === 'omitida_por_caida').length,
      noMedidasPorPresupuesto: rs.filter((r) => r.estado === 'no_medida_presupuesto').length,
      totalInformadoMediana: mediana(okr.map((r) => r.total)),
      totalFuenteMediana: mediana(okr.map((r) => r.totalFuente)),
      respuestasConTotalParcial: okr.filter((r) => r.totalParcial).length,
      respuestasAflojadas: okr.filter((r) => r.aflojado).length,
      respuestasMarcadasEnVivoPeroDesdeCopia: okr.filter((r) => r.enVivo === true && r.modalidad === 'cosecha_local').length,
      fichasDevueltas: suma(okr.map((r) => r.fichas)),
      fichasMedia: okr.length ? +(suma(okr.map((r) => r.fichas)) / okr.length).toFixed(1) : null,
      idsUnicos: new Set(okr.flatMap((r) => r.ids)).size,
      duplicadosPorIdEnRespuesta: suma(okr.map((r) => r.duplicadosPorId)),
      cuasiDuplicadosEnRespuesta: suma(okr.map((r) => r.cuasiDuplicados)),
      fichasSinSumario: suma(okr.map((r) => r.sinSumario)),
      fichasConIdSaij: suma(okr.map((r) => r.idsDeSaijEnOtraFuente || 0)),
      fichasConTodasLasRaices: suma(okr.map((r) => r.coincidenciaLexicaTodas)),
      latenciaMsP50: mediana(medidas.map((r) => r.ms)),
      latenciaMsP90: percentil(medidas.map((r) => r.ms), 0.9),
      // total > totalFuente sólo puede ocurrir si se sumó algo que la fuente no contó
      respuestasConTotalMayorQueFuente: okr.filter((r) => typeof r.total === 'number' && typeof r.totalFuente === 'number' && r.total > r.totalFuente).length,
    };
  }

  // Solapamiento de ids entre fuentes (mismo id = mismo documento de origen).
  const idsPorFuente = Object.fromEntries(FUENTES.map((f) => [f, new Set(registros.filter((r) => r.fuente === f).flatMap((r) => r.ids || []))]));
  const entreFuentes = [];
  for (let i = 0; i < FUENTES.length; i++) for (let k = i + 1; k < FUENTES.length; k++) {
    const a = idsPorFuente[FUENTES[i]], b = idsPorFuente[FUENTES[k]];
    let comun = 0; for (const x of a) if (b.has(x)) comun++;
    if (comun) entreFuentes.push({ a: FUENTES[i], b: FUENTES[k], idsComunes: comun, idsA: a.size, idsB: b.size });
  }
  // Mismo documento repetido en dos fuentes dentro de la MISMA consulta (lo que vería el usuario en dos columnas).
  const repetidosMismaConsulta = [];
  for (const c of CONSULTAS) {
    const rs = registros.filter((r) => r.consulta === c.id && r.ids?.length);
    const conteo = new Map();
    for (const r of rs) for (const id of r.ids) conteo.set(id, [...(conteo.get(id) || []), r.fuente]);
    const rep = [...conteo.entries()].filter(([, fs]) => fs.length > 1);
    if (rep.length) repetidosMismaConsulta.push({ consulta: c.id, q: c.q, idsEnVariasFuentes: rep.length, combinaciones: [...new Set(rep.map(([, fs]) => fs.join('+')))] });
  }

  // Pares de variantes: ids que aporta cada forma sobre la otra, por fuente.
  const pares = [];
  const grupos = [...new Set(CONSULTAS.filter((c) => c.par).map((c) => c.par))];
  for (const g of grupos) {
    const [ca, cb] = CONSULTAS.filter((c) => c.par === g);
    if (!ca || !cb) continue;
    for (const f of FUENTES) {
      const ra = registros.find((r) => r.fuente === f && r.consulta === ca.id);
      const rb = registros.find((r) => r.fuente === f && r.consulta === cb.id);
      const valida = (r) => r && ['con_resultados', 'cero'].includes(r.estado);
      if (!valida(ra) || !valida(rb)) { pares.push({ par: g, a: ca.q, b: cb.q, fuente: f, medible: false, estadoA: ra?.estado ?? null, estadoB: rb?.estado ?? null }); continue; }
      const A = new Set(ra.ids), B = new Set(rb.ids);
      let comun = 0; for (const x of A) if (B.has(x)) comun++;
      pares.push({ par: g, a: ca.q, b: cb.q, fuente: f, medible: true,
        totalA: ra.total, totalB: rb.total, totalFuenteA: ra.totalFuente, totalFuenteB: rb.totalFuente,
        fichasA: A.size, fichasB: B.size, comunesPrimeraPagina: comun,
        nuevosQueAportaB: B.size - comun, nuevosQueAportaA: A.size - comun,
        jaccard: A.size + B.size - comun ? +(comun / (A.size + B.size - comun)).toFixed(3) : null });
    }
  }
  return { porFuente, entreFuentes, repetidosMismaConsulta, pares };
}

async function main() {
  const estadoAcervo = await fetch(`${API}/acervo/estado`).then((r) => r.json()).catch(() => null);
  const registros = [];
  const sintaxis = args['sin-sintaxis'] ? [] : await sondasSintaxis();
  await Promise.all(FUENTES.map((f) => medirFuente(f, registros)));
  const agregados = agregar(registros);
  const salida = {
    meta: {
      generado: new Date().toISOString(),
      api: API,
      duracionS: Math.round((Date.now() - inicio) / 1000),
      versionAcervo: estadoAcervo?.version ?? null,
      conteosAcervo: estadoAcervo?.conteos ?? null,
      cuerpoDePedido: { modo: 'todas', pagina: 1, pedirEnVivo: true },
      cortesia: { espacioPorFuenteMs: ESPACIO_POR_FUENTE_MS, pedidosPorMinutoGlobal: PEDIDOS_POR_MINUTO, maxMinutos: MAX_MINUTOS, timeoutMs: TIMEOUT_MS },
      fuentes: FUENTES,
      consultas: CONSULTAS,
      advertencia: 'Sin juicios de relevancia revisados: no se informa precisión ni recall. «fichasConTodasLasRaices» es coincidencia léxica superficial (raíces de 6 letras en carátula, sumario y voces), no pertinencia jurídica. Los totales son los que informa cada respuesta: «total» (lo que IVS CODEX dice haber verificado o recibido) y «totalFuente» (contador del sitio de origen, cuando existe). Una medición en un día y hora dados: las fuentes oficiales varían en disponibilidad.',
      ultimoRateLimit: rate,
    },
    sintaxis,
    agregados,
    registros,
  };
  await mkdir(path.dirname(SALIDA), { recursive: true });
  await writeFile(SALIDA, JSON.stringify(salida, null, 1));
  process.stderr.write(`\nlisto: ${SALIDA} (${salida.meta.duracionS} s, ${registros.length} registros)\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
