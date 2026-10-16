/* Pruebas de seguridad: cabeceras, validación de entradas, errores sin detalles,
   sesiones guardadas con huella, bloqueo por cuenta y rutas administrativas. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const OK = [], MAL = [];
const chk=(n,c,e='')=>{ (c?OK:MAL).push(n); console.log((c?'  OK  ':'FALLA ')+n+(e?' :: '+e:'')); };

const DIR_TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'jedj-seg-'));
process.env.DIR_USUARIOS = DIR_TMP;
process.env.PORT = '9914';
process.env.LIMITE_PETICIONES = '5000';
delete process.env.ADMIN_TOKEN;
await import('../index.js');
await new Promise(r=>setTimeout(r,500));

const B = 'http://127.0.0.1:9914/api';
const j = async (ruta, opts={}) => { const r = await fetch(B+ruta, opts); let c=null; try{ c=await r.json(); }catch{} return { estado:r.status, cuerpo:c, cab:r.headers }; };
const post = (ruta, body, extra={}) => j(ruta, { method:'POST', headers:{'content-type':'application/json',...extra}, body: typeof body==='string'?body:JSON.stringify(body) });

console.log('\n--- cabeceras ---');
let r = await j('/salud');
chk("CSP presente con frame-ancestors 'self'", /frame-ancestors 'self'/.test(r.cab.get('content-security-policy')||''));
chk('X-Content-Type-Options nosniff', r.cab.get('x-content-type-options')==='nosniff');
chk('no anuncia Express', !r.cab.get('x-powered-by'));
chk('Referrer-Policy no-referrer', r.cab.get('referrer-policy')==='no-referrer');
chk('/api/salud no revela la versión de Node ni el tiempo activo', !('node' in r.cuerpo) && !('tiempoActivoSeg' in r.cuerpo));

console.log('\n--- entradas ---');
r = await post('/extraer', { url: { $ne: '' } });
chk('/extraer rechaza una url que no es texto', r.estado===400 && r.cuerpo.codigo==='URL_FALTANTE', JSON.stringify(r.cuerpo));
r = await post('/extraer', { url: 'https://www.csjn.gov.ar/'+'a'.repeat(3000) });
chk('/extraer rechaza un enlace de más de 2048 caracteres', r.estado===400 && r.cuerpo.codigo==='URL_INVALIDA');
r = await post('/extraer', '{"url": ');
chk('JSON roto -> 400 sin detalles internos', r.estado===400 && r.cuerpo.codigo==='PEDIDO_INVALIDO' && !/at |node_modules|\.js/.test(JSON.stringify(r.cuerpo)), JSON.stringify(r.cuerpo));
r = await post('/extraer', { url: 'x'.repeat(40000) });
chk('cuerpo mayor que el tope -> 413', r.estado===413 && r.cuerpo.codigo==='CUERPO_DEMASIADO_GRANDE', String(r.estado));
r = await post('/extraer', { url: 'http://127.0.0.1:6379/' });
chk('SSRF: rechaza una dirección interna', r.estado>=400 && r.cuerpo.ok===false);
r = await j('/legislacion/<script>/1');
chk('norma con caracteres raros: error sin eco del HTML', r.estado===400 && !/<script>/.test(JSON.stringify(r.cuerpo)));
r = await post('/indice/mendoza/buscar', { q: { $gt: '' } });
chk('consulta que no es texto: se trata como vacía', r.estado===400, String(r.estado)+' '+(r.cuerpo&&r.cuerpo.codigo));

console.log('\n--- rutas administrativas ---');
r = await j('/cache', { method:'DELETE', headers:{'x-forwarded-for':'8.8.8.8'} });
chk('DELETE /api/cache desde afuera: 403', r.estado===403, String(r.estado));

console.log('\n--- cuentas ---');
r = await post('/auth/registro', { email:'seg@test.com', password:'x'.repeat(129) });
chk('contraseña de más de 128 caracteres: rechazada', r.cuerpo.codigo==='PASSWORD_DEBIL');
r = await post('/auth/registro', { email:'seg@test.com', password:'seg@test.com' });
chk('contraseña igual al correo: rechazada', r.cuerpo.codigo==='PASSWORD_DEBIL');
r = await post('/auth/registro', { email:{ $ne:1 }, password:'contrasenia123' });
chk('correo que no es texto: rechazado', r.estado===400);
r = await post('/auth/registro', { email:'seg@test.com', password:'contrasenia-larga-123' });
chk('registro ok', r.cuerpo.ok===true);
const token = r.cuerpo.token;
chk('la respuesta de auth no se cachea', r.cab.get('cache-control')==='no-store');

const sesiones = await fs.readFile(path.join(DIR_TMP,'sesiones.json'),'utf8');
chk('el token NO está en claro en disco', !sesiones.includes(token));
const usuarios = await fs.readFile(path.join(DIR_TMP,'usuarios.json'),'utf8');
chk('la contraseña NO está en claro en disco', !usuarios.includes('contrasenia-larga-123'));
if (process.platform !== 'win32') {
  const modo = (await fs.stat(path.join(DIR_TMP,'sesiones.json'))).mode & 0o777;
  chk('archivo de sesiones con permiso 0600', modo===0o600, modo.toString(8));
}
r = await j('/auth/yo', { headers:{ authorization:'Bearer '+token } });
chk('la sesión sigue funcionando con la huella', r.cuerpo.ok===true);

for (let i=0;i<6;i++) await post('/auth/login', { email:'seg@test.com', password:'incorrecta-'+i });
r = await post('/auth/login', { email:'seg@test.com', password:'contrasenia-larga-123' });
chk('tras 6 fallos la cuenta se bloquea (aun con la clave correcta)', r.estado===429 && r.cuerpo.codigo==='DEMASIADOS_INTENTOS', String(r.estado));

console.log(`\nOK ${OK.length} · fallas ${MAL.length}`);
await fs.rm(DIR_TMP, { recursive:true, force:true });
process.exit(MAL.length ? 1 : 0);
