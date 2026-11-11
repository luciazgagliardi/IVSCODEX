import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ivs-appsec-regresion-'));
process.env.DIR_USUARIOS = temp;
const { leerJson } = await import('../lib/almacen.js');
const { guardarDatos, leerDatos, fusionarDatos } = await import('../lib/datosUsuario.js');

test('un JSON corrupto no se interpreta como una base vacía y no se sobrescribe', async () => {
  const archivo = path.join(temp, 'corrupto.json');
  const contenido = '{"cuentas": [INCOMPLETO';
  await fs.writeFile(archivo, contenido);
  await assert.rejects(leerJson(archivo, {}), /Almacenamiento persistente ilegible/);
  assert.equal(await fs.readFile(archivo, 'utf8'), contenido);
  assert.deepEqual(await leerJson(path.join(temp, 'todavia-no-existe.json'), {}), {});
});

test('datos del usuario ilegibles no se presentan como una cuenta nueva', async () => {
  const uid = crypto.randomUUID();
  const carpeta = path.join(temp, 'datos');
  await fs.mkdir(carpeta, { recursive: true });
  const archivo = path.join(carpeta, uid + '.json');
  await fs.writeFile(archivo, '{mal-json');
  await assert.rejects(leerDatos(uid), /No se pudieron leer los datos/);
  assert.equal(await fs.readFile(archivo, 'utf8'), '{mal-json');
});

test('fusionar la cuenta preserva anillos del servidor y recibe los del navegador', async () => {
  const uid = crypto.randomUUID();
  const anilloServ = { canonico: 'Daño moral', equivalentes: ['daño extrapatrimonial'], relacionados: [] };
  const anilloLocal = { canonico: 'Usucapión', equivalentes: ['prescripción adquisitiva'], relacionados: [] };
  await guardarDatos(uid, { fav: { mendoza: true }, hist: ['daño moral'], pasajes: [], anillos: [anilloServ] });
  const datos = await fusionarDatos(uid, { fav: { scba: true }, hist: ['usucapión'], pasajes: [], anillos: [anilloLocal] });
  assert.deepEqual(new Set(datos.anillos.map(x => x.canonico)), new Set(['Usucapión', 'Daño moral']));
  assert.equal(datos.fav.mendoza, true);
  assert.equal(datos.fav.scba, true);
  assert.equal((await leerDatos(uid)).anillos.length, 2);
});

test('el endpoint público de fragmentos no admite metadatos del cliente para escribir jurisprudencia', async () => {
  const ruta = await fs.readFile(path.join(raiz, 'routes', 'indice.js'), 'utf8');
  assert.doesNotMatch(ruta, /req\.body\?\.registros/);
  assert.doesNotMatch(ruta, /agregarAlAcervo\s*\(/);
  assert.match(ruta, /const doc = await obtenerDocumento\(url\)/);
});

test('tres pipelines de publicación usan worktree limpio y evitan rebase con cosechas temporales', async () => {
  const nombres = [
    'ampliacion-integral.yml',
    'cosecha-mendoza-masiva.yml',
    'publicar-acervo-mendoza.yml'
  ];
  for (const n of nombres) {
    const wf = await fs.readFile(path.join(raiz, '..', '.github', 'workflows', n), 'utf8');
    assert.match(wf, /bash ops\/publicar-version-acervo\.sh/, n);
    assert.doesNotMatch(wf, /git pull --rebase/, n);
  }
  const script = await fs.readFile(path.join(raiz, '..', 'ops', 'publicar-version-acervo.sh'), 'utf8');
  assert.match(script, /git -C "\$ROOT" worktree add --detach/);
  assert.match(script, /git -C "\$ROOT" show origin\/acervo:manifiesto\.json/);
});

test.after(async () => { await fs.rm(temp, { recursive: true, force: true }); });
