/** Mantiene únicamente la cookie de sesión recibida del propio servicio judicial. */
export function cookieDeSesion(headers, anterior = '') {
  const recibida = String(headers?.get?.('set-cookie') || '').split(';', 1)[0].trim();
  return /^[A-Za-z_][A-Za-z0-9_-]*=[A-Za-z0-9._~-]+$/.test(recibida) ? recibida : anterior;
}
