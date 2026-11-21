/**
 * Sonda de las 23 fuentes automáticas publicadas y del acervo local.
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
  { slug: 'catamarca', q: 'sentencia', modo: 'todas', local: true },
  { slug: 'chubut', q: 'daño moral', tribunal: 'sumarios', modo: 'todas' },
  { slug: 'tfn', q: 'impuesto a las ganancias', tribunal: 'objetos', modo: 'todas' },
  { slug: 'santacruz', q: 'amparo', tribunal: 'objetos', modo: 'todas' },
  { slug: 'hudoc', q: 'freedom of expression', modo: 'todas' },
];

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
await Promise.all([trabajador(), trabajador()]);
const fallasCriticas = resultados.filter((r) => !r.ok && !r.externa && !r.sensible);
const noDisponibles = resultados.filter((r) => !r.ok);
const ceros = resultados.filter((r) => r.estado === 'cero_valido');
console.log('RESUMEN_VIVO ' + JSON.stringify({
  fuentes: resultados.length,
  disponibles: resultados.filter((r) => r.ok).map((r) => r.fuente),
  noDisponibles: noDisponibles.map((r) => ({ fuente: r.fuente, estado: r.estado, codigo: r.codigo, detalle: r.detalle })),
  cerosValidos: ceros.map((r) => r.fuente),
  fallasCriticas: fallasCriticas.map((r) => r.fuente),
}));
if (fallasCriticas.length) {
  console.error('Una o más fuentes que deben responder devolvieron un error o no confirmaron consulta oficial.');
  process.exitCode = 1;
}
