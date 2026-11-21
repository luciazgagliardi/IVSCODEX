/**
 * Exclusión mutua entre procesos/instancias al sustituir el SQLite compartido
 * del acervo. El bloqueo vive en DIR_BASE (/home en Azure), no en memoria:
 * varias instancias de App Service pueden arrancar y compilar el mismo corpus
 * al mismo tiempo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Adquiere un lock de archivo exclusivo. Devuelve una función idempotente
 * para liberarlo. Un heartbeat evita considerar obsoleto un armado largo.
 */
export async function adquirirCandado(archivo, {
  version = '',
  esperaMs = 35 * 60_000,
  obsoletoMs = 45 * 60_000,
  intervaloMs = 1500,
} = {}) {
  await fs.mkdir(path.dirname(archivo), { recursive: true });
  const token = randomUUID();
  const inicio = Date.now();

  while (true) {
    try {
      const handle = await fs.open(archivo, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ token, version, pid: process.pid, creado: Date.now() }));
      await handle.sync();
      await handle.close();

      const latido = setInterval(() => {
        const ahora = new Date();
        fs.utimes(archivo, ahora, ahora).catch(() => {});
      }, 30_000);
      latido.unref?.();

      let liberado = false;
      return async () => {
        if (liberado) return;
        liberado = true;
        clearInterval(latido);
        try {
          const actual = JSON.parse(await fs.readFile(archivo, 'utf8'));
          if (actual.token === token) await fs.rm(archivo, { force: true });
        } catch { /* otro proceso pudo recuperar un lock obsoleto */ }
      };
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e;

      const stat = await fs.stat(archivo).catch(() => null);
      if (!stat) continue;
      if (Date.now() - stat.mtimeMs > obsoletoMs) {
        // Sólo se recupera un lock sin heartbeat durante 45 minutos.
        // La creación wx hace que, tras quitarlo, sólo un proceso lo gane.
        await fs.rm(archivo, { force: true }).catch(() => {});
        continue;
      }
      if (Date.now() - inicio >= esperaMs)
        throw new Error(`tiempo agotado esperando el bloqueo de importación del acervo (${version})`);
      await pausa(intervaloMs);
    }
  }
}
