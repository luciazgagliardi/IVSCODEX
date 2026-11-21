/** Utilidades puras para cosechas con paginación verificable. */
export function siguienteCursor(actual, respuesta, { cursorDescendente = false, cursorNoMonotono = false } = {}) {
  const valor = respuesta?.siguienteDesde;
  if (valor == null) return { agotada: true };
  if ((typeof valor !== 'string' && typeof valor !== 'number') ||
      !String(valor).trim() || String(valor) === String(actual))
    throw new Error('Cursor inválido o repetido');
  if (typeof valor === 'number' &&
      (!Number.isSafeInteger(valor) || valor < 0 ||
        (!cursorNoMonotono && typeof actual === 'number' && actual !== 0 && (cursorDescendente ? valor >= actual : valor <= actual))))
    throw new Error('Cursor numérico no progresivo');
  return { agotada: false, desde: valor };
}

/**
 * Registra cursores opacos de portales que ordenan por relevancia/fecha y no
 * garantizan monotonicidad del identificador. Evita bucles A → B → A sin
 * suponer que el ID numérico debe subir o bajar.
 */
export function registrarCursor(historial, valor, maximo = 2000) {
  const clave = String(valor ?? '').trim();
  if (!clave) throw new Error('Cursor vacío');
  const vistos = Array.isArray(historial) ? historial.map(String) : [];
  if (vistos.includes(clave)) throw new Error('Cursor repetido en la secuencia');
  const limite = Number.isSafeInteger(maximo) && maximo > 0 ? maximo : 2000;
  return [...vistos, clave].slice(-limite);
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

/** Acepta identificadores realmente usados por los tribunales y repositorios. */
export function idDocumentalValido(id) {
  return /^[A-Za-z0-9_-]{3,160}$/.test(String(id ?? ''));
}
