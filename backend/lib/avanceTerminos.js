/**
 * Avance reanudable de la ventana de términos de una fuente.
 * Sólo se salta un término cuando todas sus variantes llegaron a su fin real.
 */
export function avanzarIndiceTerminos({ palabras, indiceInicial = 0, ventana = [], variantes = [{}], tareas = {} }) {
  if (!Array.isArray(palabras) || palabras.length === 0) return { indice: 0, completados: 0, pendientes: 0 };
  const inicio = ((Number(indiceInicial) || 0) % palabras.length + palabras.length) % palabras.length;
  const vars = Array.isArray(variantes) && variantes.length ? variantes : [{}];
  let completados = 0;
  for (const q of ventana) {
    const todasLasVariantesCompletas = vars.every((variante) =>
      tareas?.[JSON.stringify([q, variante])]?.completas === true);
    if (!todasLasVariantesCompletas) break;
    completados++;
  }
  return { indice: (inicio + completados) % palabras.length, completados,
    pendientes: Math.max(0, ventana.length - completados) };
}
