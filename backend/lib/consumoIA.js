/** Presupuesto diario para operaciones de IA pagadas.
 * Una cuota de solicitudes es una barrera adicional; el gasto real debe
 * supervisarse también desde el proveedor y con alertas financieras.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { DIR_USUARIOS } from '../config.js';
import { enCola, leerJson, escribirJsonAtomico } from './almacen.js';
import { ErrorApp } from './errores.js';

const ARCHIVO = path.join(DIR_USUARIOS, 'consumo-ia.json');
const numero = (v, porDefecto, maximo) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, maximo) : porDefecto;
};
const LIMITE_DIARIO = numero(process.env.IA_SOLICITUDES_DIARIAS, 60, 10000);
const LIMITE_USUARIO = Math.min(LIMITE_DIARIO, numero(process.env.IA_SOLICITUDES_POR_USUARIO, 8, 500));

/** Reservar antes de la llamada: errores del proveedor también cuentan como intentos. */
export async function reservarConsultaIA(usuarioId) {
  if (typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId)) {
    throw new ErrorApp('NO_AUTENTICADO', 'Se necesita una sesión válida.', 401);
  }
  await fs.mkdir(DIR_USUARIOS, { recursive: true, mode: 0o700 });
  return enCola(ARCHIVO, async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const previo = await leerJson(ARCHIVO, {});
    const dato = previo.dia === hoy
      ? { dia: hoy, total: Number(previo.total) || 0, porUsuario: previo.porUsuario || {} }
      : { dia: hoy, total: 0, porUsuario: {} };
    const propios = Number(dato.porUsuario[usuarioId]) || 0;
    if (dato.total >= LIMITE_DIARIO || propios >= LIMITE_USUARIO) {
      throw new ErrorApp('CUOTA_IA_AGOTADA', 'Se alcanzó el límite diario de propuestas automáticas.', 429);
    }
    dato.total++;
    dato.porUsuario[usuarioId] = propios + 1;
    await escribirJsonAtomico(ARCHIVO, dato);
    return { utilizados: dato.porUsuario[usuarioId], maximos: LIMITE_USUARIO };
  });
}
