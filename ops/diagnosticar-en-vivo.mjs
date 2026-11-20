/**
 * Diagnóstico no invasivo de los buscadores oficiales. Cada llamada exige
 * pedirEnVivo=true y NO debe confundirse con la respuesta del acervo.
 * Se ejecuta por GitHub Actions contra la API pública de Azure.
 */
const api = 'https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api';
const pruebas = [
  { slug: 'mendoza', q: 'ROSALES STELLA', partes: 'ROSALES STELLA', tribunal: 'CC' },
  { slug: 'mendoza', q: 'daño moral', tribunal: 'SC' },
  { slug: 'mendoza', q: 'daño moral', tribunal: 'CC' },
  { slug: 'mendoza', q: 'despido', tribunal: 'CT' },
  { slug: 'mendoza', q: 'alimentos', tribunal: 'CF' },
  { slug: 'mendoza', q: 'daño moral' },
  { slug: 'caba', q: 'amparo' },
  { slug: 'saij', q: 'amparo', tribunal: 'sumarios' },
];
const prueba = async ({slug, ...filtros}) => {
  const t0 = Date.now();
  try {
    const respuesta = await fetch(`${api}/indice/${slug}/buscar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...filtros, modo: 'todas', pedirEnVivo: true }),
      signal: AbortSignal.timeout(35000),
    });
    const d = await respuesta.json();
    return {
      fuente: slug, tribunal: filtros.tribunal || 'TODOS', consulta: filtros.q, http: respuesta.status, ok: Boolean(d.ok),
      enVivo: d.enVivo === true && d.desdeIndiceLocal !== true,
      desdeIndiceLocal: d.desdeIndiceLocal === true,
      total: d.total ?? null, documentos: (d.resultados || []).length,
      codigo: d.codigo || null, avisoFalla: d.avisoFalla || null, ms: Date.now() - t0,
    };
  } catch (error) {
    return { fuente: slug, tribunal: filtros.tribunal || 'TODOS', consulta: filtros.q, ok: false, enVivo: false,
      codigo: error.name || 'RED', detalle: String(error.message).slice(0,120), ms: Date.now() - t0 };
  }
};
const resultados = await Promise.all(pruebas.map(prueba));
for (const r of resultados) console.log('BUSQUEDA_VIVA ' + JSON.stringify(r));
console.log('RESUMEN_VIVO ' + JSON.stringify({
  consultadas: resultados.length,
  confirmadas: resultados.filter((r) => r.enVivo).map((r) => r.fuente),
  noDisponibles: resultados.filter((r) => !r.enVivo).map((r) => r.fuente),
}));
// El diagnóstico debe informar fallos externos, no modificar producción.
