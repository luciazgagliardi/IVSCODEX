/**
 * Prioriza que el buscador tenga una versión SQLite activa antes de ejecutar
 * cosechas largas de PDFs en el mismo servidor pequeño de Azure.
 */
export function puedeIniciarCosechas(estado) {
  return Boolean(estado?.activo && !estado?.importando && !estado?.error);
}
