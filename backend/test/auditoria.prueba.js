/* Pruebas de la auditoría de seguridad: SSRF (IPv4/IPv6, conexión fijada), /salud mínima,
   contraseñas comunes, límite de subidas y cabeceras de seguridad. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const OK = [], MAL = [];
const chk = (n, c, e = '') => { (c ? OK : MAL).push(n); console.log((c ? '  OK  ' : 'FALLA ') + n + (e ? ' :: ' + e : '')); };

const DIR_TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'jedj-auditoria-'));
process.env.DIR_USUARIOS = DIR_TMP;
process.env.PORT = '9917';
process.env.PERMITIR_CUALQUIER_DOMINIO = 'true'; // para llegar a la capa de red y probar SOLO ella
process.env.NODE_ENV = 'production';             // /salud completo no se entrega a cualquiera
await import('../index.js');
const { ipEsPrivada, validarURL } = await import('../lib/descargador.js');
await new Promise((r) => setTimeout(r, 500));
const B = 'http://127.0.0.1:9917/api';

console.log('\n--- direcciones internas (IPv4 e IPv6) ---');
const casos = {
  '127.0.0.1': true, '10.1.2.3': true, '172.16.0.1': true, '192.168.1.1': true, '169.254.169.254': true,
  '100.64.0.1': true, '0.0.0.0': true, '224.0.0.1': true, '8.8.8.8': false, '93.184.216.34': false,
  '::1': true, '::': true, '::ffff:127.0.0.1': true, '::ffff:7f00:1': true, '::ffff:a9fe:a9fe': true,
  '::127.0.0.1': true, '64:ff9b::7f00:1': true, '2002:7f00:1::': true, 'fe80::1': true, 'fec0::1': true,
  'fd00::1': true, 'ff02::1': true, '2606:4700:4700::1111': false, '::ffff:808:808': false, 'no-es-ip': true,
};
for (const [ip, esperado] of Object.entries(casos)) chk(`ipEsPrivada(${ip}) = ${esperado}`, ipEsPrivada(ip) === esperado);

console.log('\n--- descarga: se rechaza antes de tocar la red ---');
const rechaza = async (url) => { try { await validarURL(url); return null; } catch (e) { return e.codigo; } };
for (const u of ['http://127.0.0.1/', 'http://[::1]/', 'http://[::ffff:7f00:1]/', 'http://169.254.169.254/latest/meta-data/',
  'http://10.0.0.5:8080/', 'http://2130706433/', 'http://0x7f.1/', 'http://localhost/', 'http://[fe80::1]/']) {
  const c = await rechaza(u);
  chk(`validarURL(${u}) rechazada`, c === 'RED_PRIVADA' || c === 'URL_INVALIDA', String(c));
}
chk('esquema file: rechazado', (await rechaza('file:///etc/passwd')) === 'ESQUEMA_INVALIDO');
chk('esquema gopher: rechazado', (await rechaza('gopher://127.0.0.1:6379/_x')) === 'ESQUEMA_INVALIDO');

console.log('\n--- /api/salud ---');
let r = await fetch(B + '/salud'); let j = await r.json();
chk('responde ok', j.ok === true);
chk('no entrega memoria, claves ni configuración', !('memoriaMB' in j) && !('releConfigurado' in j) && !('dominiosPermitidos' in j) && !('corpusCorteidh' in j), Object.keys(j).join(','));

console.log('\n--- contraseñas comunes ---');
const reg = async (email, password) => (await (await fetch(B + '/auth/registro', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json());
for (const [n, p] of [['1', '12345678'], ['2', 'Password123'], ['3', 'argentina'], ['luciatest', 'lucia.test']]) {
  const x = await reg(`${n.length > 2 ? n : 'audit' + n}@test.com`, p);
  chk(`rechaza «${p}»`, x.codigo === 'PASSWORD_DEBIL', x.codigo);
}
const bueno = await reg('audit9@test.com', 'una-frase-larga-y-rara-2026');
chk('acepta una contraseña robusta', bueno.ok === true, bueno.codigo);

console.log('\n--- perfil sin HTML ---');
const conHtml = await (await fetch(B + '/auth/registro', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'audit10@test.com', password: 'otra-frase-larga-y-rara-2026', nombre: '<img src=x onerror=alert(1)>Ana', especialidad: 'Civil<script>x</script>' }) })).json();
chk('el nombre no conserva signos de marcado', conHtml.ok && !/[<>]/.test(conHtml.usuario.nombre) && !/[<>]/.test(conHtml.usuario.especialidad), conHtml.usuario && conHtml.usuario.nombre);

console.log('\n--- cabeceras de seguridad ---');
r = await fetch(B + '/salud');
chk('CSP presente', /default-src 'self'/.test(r.headers.get('content-security-policy') || ''));
chk('sin X-Powered-By', !r.headers.get('x-powered-by'));
chk('nosniff', r.headers.get('x-content-type-options') === 'nosniff');
chk('frame-ancestors restringido', /frame-ancestors 'self'/.test(r.headers.get('content-security-policy') || ''));

console.log('\n--- límite de subidas de archivos ---');
let ultimo = 0;
for (let i = 0; i < 22; i++) {
  const x = await fetch(B + '/extraer-archivo', { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from('x') });
  ultimo = x.status;
  if (x.status === 429) break;
}
chk('a la subida 21 responde 429', ultimo === 429, String(ultimo));

console.log(`\nOK ${OK.length} · fallas ${MAL.length}`);
if (MAL.length) console.log('Fallaron:', MAL.join(' | '));
await fs.rm(DIR_TMP, { recursive: true, force: true });
process.exit(MAL.length ? 1 : 0);
