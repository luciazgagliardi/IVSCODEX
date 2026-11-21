/**
 * Sonda de las 19 fuentes automáticas publicadas y del acervo local.
 * No escribe datos. Cada consulta exige pedirEnVivo=true; un cero válido
 * queda separado de un error del origen o de una respuesta servida por la copia.
 * Ejecutar después del despliegue de Azure.
 */
const api = 'https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api';

const pruebas = [
  { slug: 'mendoza', q: 'daño moral', modo: 'todas' },
  { slug: 'caba', q: 'amparo', modo: 'todas', sensible: true },
  { slug: 'saij', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'csjn', q: 'amparo', tribunal: 'fallos', modo: 'todas' },
  { slug: 'dialnet', q: 'derecho laboral', modo: 'todas', externa: true },
  { slug: 'mendozalegal', q: 'responsabilidad civil', modo: 'todas' },
  { slug: 'corteidh', q: 'derecho a la vida', modo: 'todas', externa: true },
  { slug: 'rionegro', q: 'despido', tribunal: 'STJ', modo: 'todas', externa: true },
  { slug: 'juristeca', q: 'despido', modo: 'todas' },
  { slug: 'santafe', q: 'despido', modo: 'todas', externa: true },
  { slug: 'jujuy', q: 'daño moral', modo: 'todas' },
  { slug: 'scba', q: 'daño moral', modo: 'todas' },
  { slug: 'cordoba', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'entrerrios', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'neuquen', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'tucuman', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'chaco', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'corrientes', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'buenosaires', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'caba_saij', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'catamarca_saij', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'chubut', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'formosa', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'jujuy_saij', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'lapampa', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'larioja', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'mendoza_saij', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'misiones', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'rionegro_saij', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'salta', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'sanjuan', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'sanluis', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'santacruz', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'santafe_saij', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'santiagodelestero', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'tierradelfuego', q: 'amparo', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'catamarca', q: 'sentencia', modo: 'todas', local: true },
];

async function comprobarRegistroApi() {
  const inicio = Date.now();
  try {
    const respuesta = await fetch(api + '/fuentes/catalogo', { signal: AbortSignal.timeout(15000) });
    const d = await respuesta.json();
    const slugs = Array.isArray(d.fuentes) ? d.fuentes.map((f) => f.slug) : [];
    const esperados = [...new Set(pruebas.map((p) => p.slug))];
    const faltantes = esperados.filter((slug) => !slugs.includes(slug));
    let estadoRuta = null;
    try {
      const r = await fetch(api + '/indice/buenosaires/estado', { signal: AbortSignal.timeout(10000) });
      estadoRuta = r.status;
    } catch (e) { estadoRuta = e.name || 'error'; }
    const resultado = {
      http: respuesta.status, ok: respuesta.ok && faltantes.length === 0 && estadoRuta === 200,
      totalFuentesApi: slugs.length, totalEsperadas: esperados.length,
      nuevasFacetasRegistradas: esperados.filter((s) => /_saij$|^(buenosaires|chubut|formosa|lapampa|larioja|misiones|salta|sanjuan|sanluis|santacruz|santiagodelestero|tierradelfuego)$/.test(s) && slugs.includes(s)),
      faltantes, rutaEstadoBuenosAires: estadoRuta, ms: Date.now() - inicio,
    };
    console.log('PREFLIGHT_API ' + JSON.stringify(resultado));
    return resultado;
  } catch (e) {
    const resultado = { ok: false, error: e.name || 'ERROR', detalle: String(e.message).slice(0, 180), ms: Date.now() - inicio };
    console.log('PREFLIGHT_API ' + JSON.stringify(resultado));
    return resultado;
  }
}

async function unaPrueba(caso) {
  const inicio = Date.now();
  const ruta = caso.local ? '/indice/' + caso.slug + '/local' : '/indice/' + caso.slug + '/buscar';
  const cuerpo = caso.local
    ? { q: caso.q, modo: caso.modo, rapida: true }
    : { ...caso, pedirEnVivo: true };
  try {
    const respuesta = await fetch(api + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(55000),
    });
    let d;
    try { d = await respuesta.json(); }
    catch (error) {
      return { fuente: caso.slug, consulta: caso.q, http: respuesta.status, ok: false,
        estado: 'respuesta_no_json', detalle: String(error.message).slice(0, 160), ms: Date.now() - inicio,
        externa: Boolean(caso.externa), sensible: Boolean(caso.sensible) };
    }
    const enVivo = !caso.local && d.enVivo === true && d.desdeIndiceLocal !== true;
    const copiaLocal = caso.local && d.desdeIndiceLocal === true;
    const ok = Boolean(d.ok) && (caso.local ? copiaLocal : enVivo);
    const totalPendiente = Boolean(d.totalPendiente);
    const total = totalPendiente || d.total == null
      ? null : (Number.isFinite(Number(d.total)) ? Number(d.total) : null);
    const documentos = Array.isArray(d.resultados) ? d.resultados.length : 0;
    const inconsistente = !totalPendiente && total === 0 && documentos > 0;
    const consultaOk = ok && !inconsistente;
    return {
      fuente: caso.slug, consulta: caso.q, tribunal: caso.tribunal || 'TODOS',
      http: respuesta.status, ok: consultaOk, enVivo, copiaLocal,
      estado: !d.ok ? 'error_aplicacion' : inconsistente ? 'total_inconsistente'
        : totalPendiente ? 'conteo_pendiente'
          : caso.local ? (copiaLocal ? 'acervo_local' : 'respuesta_no_local')
            : enVivo ? (total === 0 ? 'cero_valido' : 'vivo') : 'no_confirmado_en_vivo',
      total, totalPendiente, documentos,
      codigo: d.codigo || null, mensaje: d.mensaje || d.error || null,
      avisoFalla: d.avisoFalla || null, detalle: d.detalle || null,
      ms: Date.now() - inicio,
      externa: Boolean(caso.externa), sensible: Boolean(caso.sensible),
    };
  } catch (error) {
    return { fuente: caso.slug, consulta: caso.q, tribunal: caso.tribunal || 'TODOS',
      ok: false, estado: 'error_transporte', codigo: error.name || 'RED',
      detalle: String(error.message).slice(0, 180), ms: Date.now() - inicio,
      externa: Boolean(caso.externa), sensible: Boolean(caso.sensible) };
  }
}

// Dos pedidos simultáneos como máximo: respeta la cortesía de los portales y
// deja que las búsquedas de una fuente terminen antes de saturar sus servidores.
const resultados = new Array(pruebas.length);
let siguiente = 0;
async function trabajador() {
  while (true) {
    const i = siguiente++;
    if (i >= pruebas.length) return;
    resultados[i] = await unaPrueba(pruebas[i]);
    console.log('BUSQUEDA_VIVA ' + JSON.stringify(resultados[i]));
  }
}
const preflight = await comprobarRegistroApi();
if (!preflight.ok) process.exitCode = 1;
await Promise.all([trabajador(), trabajador()]);
const fallasCriticas = resultados.filter((r) => !r.ok && !r.externa && !r.sensible);
const noDisponibles = resultados.filter((r) => !r.ok);
const ceros = resultados.filter((r) => r.estado === 'cero_valido');
const restriccionesConocidas = noDisponibles.filter((r) => r.externa || r.sensible);
console.log('RESUMEN_VIVO ' + JSON.stringify({
  fuentesConsultadas: resultados.length,
  consultasConfirmadas: resultados.filter((r) => r.ok).length,
  disponibles: resultados.filter((r) => r.ok).map((r) => r.fuente),
  noDisponibles: noDisponibles.map((r) => ({ fuente: r.fuente, estado: r.estado, codigo: r.codigo, detalle: r.detalle })),
  restriccionesConocidas: restriccionesConocidas.map((r) => ({ fuente: r.fuente, estado: r.estado, codigo: r.codigo, detalle: r.detalle })),
  cerosValidos: ceros.map((r) => r.fuente),
  fallasCriticas: fallasCriticas.map((r) => r.fuente),
}));
if (fallasCriticas.length) {
  console.error('Una o más fuentes que deben responder devolvieron un error o no confirmaron consulta oficial.');
  process.exitCode = 1;
}
