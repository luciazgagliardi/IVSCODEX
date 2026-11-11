/** Utilidades puras para cosechas con paginación verificable. */
export function siguienteCursor(actual, respuesta) {
  const valor = respuesta?.siguienteDesde;
  if (valor == null) return { agotada: true };
  if ((typeof valor !== 'string' && typeof valor !== 'number') ||
      !String(valor).trim() || String(valor) === String(actual))
    throw new Error('Cursor inválido o repetido');
  if (typeof valor === 'number' &&
      (!Number.isSafeInteger(valor) || valor < 0 ||
        (typeof actual === 'number' && valor <= actual)))
    throw new Error('Cursor numérico no progresivo');
  return { agotada: false, desde: valor };
}

/** Un registro anterior no pierde texto o metadatos por una ficha más corta. */
export function combinarRegistro(anterior, nuevo) {
  if (!anterior) return nuevo;
  const combinados = { ...anterior };
  for (const [k, v] of Object.entries(nuevo)) {
    if (v == null || v === '') continue;
    if (combinados[k] == null || combinados[k] === '' ||
        (typeof v === 'string' && v.length > String(combinados[k]).length))
      combinados[k] = v;
  }
  return combinados;
}
