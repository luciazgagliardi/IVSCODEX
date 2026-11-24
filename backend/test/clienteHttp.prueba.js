import test from 'node:test';
import assert from 'node:assert/strict';
import { crearFetchOrigen } from '../lib/descargador.js';

const cliente = (request, validarUrls = []) => crearFetchOrigen({
  request,
  validar: async (url) => {
    validarUrls.push(String(url));
    return new URL(url);
  },
  esperar: async () => {},
  preparar: (url) => url,
  timeoutMs: 500,
});

test('reintenta una respuesta 503 transitoria y conserva el método y el cuerpo', async () => {
  let intentos = 0;
  const solicitudes = [];
  const fetchOrigen = cliente(async (url, opciones) => {
    intentos++;
    solicitudes.push({ url, method: opciones.method, body: opciones.body });
    return intentos === 1
      ? new Response('temporal', { status: 503 })
      : new Response('resultado', { status: 200 });
  });

  const cuerpo = new URLSearchParams({ q: 'daño moral' });
  const respuesta = await fetchOrigen('https://fuente.test/buscar', {
    method: 'POST',
    body: cuerpo,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, { reintentos: 1 });

  assert.equal(respuesta.status, 200);
  assert.equal(await respuesta.text(), 'resultado');
  assert.equal(intentos, 2);
  assert.equal(solicitudes[0].method, 'POST');
  assert.equal(solicitudes[1].method, 'POST');
  assert.equal(solicitudes[1].body, cuerpo);
});

test('no reintenta denegaciones definitivas como HTTP 403', async () => {
  let intentos = 0;
  const fetchOrigen = cliente(async () => {
    intentos++;
    return new Response('denegado', { status: 403 });
  });

  const respuesta = await fetchOrigen('https://fuente.test/buscar', {}, { reintentos: 3 });
  assert.equal(respuesta.status, 403);
  assert.equal(intentos, 1);
});

test('reintenta cortes de conexión transitorios', async () => {
  let intentos = 0;
  const fetchOrigen = cliente(async () => {
    intentos++;
    if (intentos === 1) {
      const e = new Error('socket reset');
      e.code = 'ECONNRESET';
      throw e;
    }
    return new Response('ok', { status: 200 });
  });

  const respuesta = await fetchOrigen('https://fuente.test/buscar', {}, { reintentos: 1 });
  assert.equal(respuesta.status, 200);
  assert.equal(intentos, 2);
});

test('valida cada redirección y transforma POST a GET ante HTTP 302', async () => {
  const destinosValidados = [];
  const solicitudes = [];
  const fetchOrigen = cliente(async (url, opciones) => {
    solicitudes.push({ url: String(url), method: opciones.method, body: opciones.body });
    return solicitudes.length === 1
      ? new Response(null, { status: 302, headers: { location: '/resultado' } })
      : new Response('ok', { status: 200 });
  }, destinosValidados);

  const respuesta = await fetchOrigen('https://fuente.test/buscar', {
    method: 'POST',
    body: 'q=fallos',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  assert.equal(respuesta.status, 200);
  assert.deepEqual(destinosValidados, [
    'https://fuente.test/buscar',
    'https://fuente.test/resultado',
  ]);
  assert.equal(solicitudes[1].method, 'GET');
  assert.equal(solicitudes[1].body, undefined);
});

test('no repite un HTTP 429 cuando el portal pide una espera prolongada', async () => {
  let intentos = 0;
  const fetchOrigen = cliente(async () => {
    intentos++;
    return new Response('rate limited', {
      status: 429,
      headers: { 'retry-after': '30' },
    });
  });

  const respuesta = await fetchOrigen('https://fuente.test/buscar', {}, { reintentos: 3 });
  assert.equal(respuesta.status, 429);
  assert.equal(intentos, 1);
});
