/**
 * Lo que el servidor hace sin una acción puntual del usuario respeta el
 * robots.txt de los sitios oficiales (lib/robots.js).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excluidaParaAutomatizacion } from '../lib/robots.js';
import { obtenerDocumento } from '../lib/documento.js';

test('rutas excluidas por robots.txt de Juristeca y SAIJ', () => {
  assert.ok(excluidaParaAutomatizacion('https://juristeca.jusbaires.gob.ar/fallos/2026/10/abc.pdf'));
  assert.ok(excluidaParaAutomatizacion('https://www.saij.gob.ar/descarga-archivo?guid=x&name=fallo.pdf'));
  assert.ok(!excluidaParaAutomatizacion('https://juristeca.jusbaires.gob.ar/baj/?accion=fallos'));
  assert.ok(!excluidaParaAutomatizacion('https://wwwjuri.jus.mendoza.gov.ar/jur/sumfal/sf.php?fallo=1'));
  assert.ok(!excluidaParaAutomatizacion('no es una url'));
});

test('la lectura automática no descarga una ruta excluida (sin tocar la red)', async () => {
  const original = globalThis.fetch;
  let pedidos = 0;
  globalThis.fetch = async () => { pedidos++; throw new Error('no debería pedirse'); };
  try {
    await assert.rejects(
      obtenerDocumento('https://juristeca.jusbaires.gob.ar/fallos/2099/01/inexistente-prueba.pdf', { automatico: true }),
      (e) => e.codigo === 'EXCLUIDA_POR_ROBOTS' && /Lector/.test(e.message),
    );
    assert.equal(pedidos, 0);
  } finally { globalThis.fetch = original; }
});
