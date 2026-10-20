/* Pruebas de cuentas de usuario: registro, login, sesión y logout. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const OK = [], MAL = [];
const chk=(n,c,e='')=>{ (c?OK:MAL).push(n); console.log((c?'  OK  ':'FALLA ')+n+(e?' :: '+e:'')); };

const DIR_TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'jedj-usuarios-'));
process.env.DIR_USUARIOS = DIR_TMP;
process.env.PORT = '9913';
await import('../index.js');
await new Promise(r=>setTimeout(r,500));

const B = 'http://127.0.0.1:9913/api/auth';
const post = async (ruta, body, token) => {
  const r = await fetch(B+ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token?{authorization:'Bearer '+token}:{}) },
    body: JSON.stringify(body||{}),
  });
  return { estado: r.status, cuerpo: await r.json() };
};
const yo = async (token) => {
  const r = await fetch(B+'/yo', { headers: token?{authorization:'Bearer '+token}:{} });
  return { estado: r.status, cuerpo: await r.json() };
};

console.log('\n--- registro ---');
let r = await post('/registro', { email:'lucia@test.com', password:'contrasenia123' });
chk('registro exitoso devuelve token y usuario', r.cuerpo.ok && !!r.cuerpo.token && r.cuerpo.usuario.email==='lucia@test.com', JSON.stringify(r.cuerpo));
chk('nunca devuelve el hash de la contraseña', !('passwordHash' in r.cuerpo.usuario));
const token = r.cuerpo.token;

r = await post('/registro', { email:'LUCIA@test.com', password:'contrasenia123' });
chk('el email es case-insensitive: rechaza duplicado', r.cuerpo.codigo==='EMAIL_YA_REGISTRADO', r.cuerpo.codigo);

r = await post('/registro', { email:'no-es-un-email', password:'contrasenia123' });
chk('rechaza un email con formato invalido', r.cuerpo.codigo==='EMAIL_INVALIDO', r.cuerpo.codigo);

r = await post('/registro', { email:'otro@test.com', password:'corta' });
chk('rechaza una contraseña de menos de 8 caracteres', r.cuerpo.codigo==='PASSWORD_DEBIL', r.cuerpo.codigo);

console.log('\n--- login ---');
r = await post('/login', { email:'lucia@test.com', password:'mala' });
chk('rechaza la contraseña incorrecta', r.cuerpo.codigo==='CREDENCIALES_INVALIDAS', r.cuerpo.codigo);

r = await post('/login', { email:'no-existe@test.com', password:'contrasenia123' });
chk('rechaza un email que no existe con el mismo mensaje', r.cuerpo.codigo==='CREDENCIALES_INVALIDAS', r.cuerpo.codigo);

r = await post('/login', { email:'lucia@test.com', password:'contrasenia123' });
chk('login exitoso devuelve un token', r.cuerpo.ok && !!r.cuerpo.token);
const token2 = r.cuerpo.token;
chk('cada login genera un token distinto', token2 !== token);

console.log('\n--- sesión ---');
r = await yo(token);
chk('«yo» con token válido devuelve el usuario', r.cuerpo.ok && r.cuerpo.usuario.email==='lucia@test.com');
r = await yo(token2);
chk('el token del login también sirve (dos sesiones activas a la vez)', r.cuerpo.ok);
r = await yo();
chk('«yo» sin token devuelve NO_AUTENTICADO', r.estado===401 && r.cuerpo.codigo==='NO_AUTENTICADO');
r = await yo('token-inventado');
chk('«yo» con un token que no existe devuelve NO_AUTENTICADO', r.estado===401 && r.cuerpo.codigo==='NO_AUTENTICADO');

console.log('\n--- logout ---');
r = await post('/logout', {}, token);
chk('logout responde ok', r.cuerpo.ok===true);
r = await yo(token);
chk('el token cerrado deja de servir', r.estado===401);
r = await yo(token2);
chk('la otra sesión sigue viva (logout no cierra todas)', r.cuerpo.ok===true);

console.log('\n--- lo que la cuenta guarda ---');

const misDatos = async (token, metodo, body, sufijo='') => {
  const r = await fetch('http://127.0.0.1:9913/api/mis-datos'+sufijo, {
    method: metodo,
    headers: { 'content-type':'application/json', ...(token?{authorization:'Bearer '+token}:{}) },
    ...(body?{ body: JSON.stringify(body) }:{}),
  });
  return { estado: r.status, cuerpo: await r.json() };
};

// token2 sigue vivo: es el que se usa de acá en adelante.
r = await misDatos(token2, 'GET');
chk('una cuenta nueva arranca sin nada guardado',
    r.cuerpo.ok && Object.keys(r.cuerpo.fav).length===0 && r.cuerpo.hist.length===0 && r.cuerpo.pasajes.length===0, JSON.stringify(r.cuerpo));

const pasajeUno = { t:'cita completa «daño moral» (consultado el hoy)', r:'"daño moral"', url:'https://wwwjuri.jus.mendoza.gov.ar/fallo/1', q:'daño moral', modo:'exacta' };
r = await misDatos(token2, 'PUT', { fav:{ scjm:true, saij:true, apagada:false }, hist:['daño moral','pacto comisorio','daño moral'], pasajes:[pasajeUno] });
chk('guarda las fuentes marcadas', r.cuerpo.fav.scjm===true && r.cuerpo.fav.saij===true, JSON.stringify(r.cuerpo.fav));
chk('no guarda las marcas apagadas', !('apagada' in r.cuerpo.fav), JSON.stringify(r.cuerpo.fav));
chk('no repite una búsqueda en el historial', r.cuerpo.hist.length===2, JSON.stringify(r.cuerpo.hist));
chk('guarda el pasaje con su url, q y modo', r.cuerpo.pasajes.length===1 && r.cuerpo.pasajes[0].url===pasajeUno.url && r.cuerpo.pasajes[0].modo==='exacta', JSON.stringify(r.cuerpo.pasajes));

r = await misDatos(token2, 'GET');
chk('lo guardado sigue ahí al volver a entrar (otro dispositivo)',
    r.cuerpo.fav.scjm===true && r.cuerpo.hist[0]==='daño moral' && r.cuerpo.pasajes.length===1, JSON.stringify(r.cuerpo));

r = await misDatos(token2, 'PUT', { fav:{ scjm:true }, hist:[], pasajes:[{ t:'una cita pegada a mano, sin url', r:'', url:'javascript:alert(1)', q:'', modo:'x' }] });
chk('una url que no es http/https no se guarda', r.cuerpo.pasajes[0].url==='', JSON.stringify(r.cuerpo.pasajes));
chk('un modo desconocido cae a "todas"', r.cuerpo.pasajes[0].modo==='todas', JSON.stringify(r.cuerpo.pasajes));

r = await misDatos(token2, 'PUT', { fav:{ scjm:true, saij:true }, hist:['daño moral','pacto comisorio'], pasajes:[pasajeUno] });
r = await misDatos(token2, 'POST', { fav:{ caba:true }, hist:['usucapión'], pasajes:[{ t:'otra cita distinta', r:'', url:'', q:'', modo:'todas' }] }, '/fusionar');
chk('al entrar desde otro navegador suma lo local sin pisar lo de la cuenta',
    r.cuerpo.fav.scjm===true && r.cuerpo.fav.caba===true, JSON.stringify(r.cuerpo.fav));
chk('el historial local queda primero por ser lo más reciente',
    r.cuerpo.hist[0]==='usucapión' && r.cuerpo.hist.includes('daño moral'), JSON.stringify(r.cuerpo.hist));
chk('los pasajes de los dos lados se suman, no se pisan',
    r.cuerpo.pasajes.length===2, JSON.stringify(r.cuerpo.pasajes));

r = await misDatos(null, 'GET');
chk('sin sesión no se puede leer lo guardado', r.estado===401 && r.cuerpo.codigo==='NO_AUTENTICADO');
r = await misDatos(null, 'PUT', { fav:{ x:true }, hist:[] });
chk('sin sesión no se puede escribir', r.estado===401);

// Los datos son por usuario: la cuenta de al lado no ve nada de esto.
r = await post('/registro', { email:'otra@test.com', password:'contrasenia123' });
r = await misDatos(r.cuerpo.token, 'GET');
chk('otra cuenta no ve lo guardado por la primera',
    Object.keys(r.cuerpo.fav).length===0 && r.cuerpo.hist.length===0 && r.cuerpo.pasajes.length===0, JSON.stringify(r.cuerpo));

// Topes: un cliente con un error no puede llenar el disco.
const muchas = {}; for (let i=0;i<800;i++) muchas['f'+i]=true;
const largo = []; for (let i=0;i<200;i++) largo.push('busqueda '+i);
const muchosPasajes = []; for (let i=0;i<200;i++) muchosPasajes.push({ t:'pasaje '+i, r:'', url:'', q:'', modo:'todas' });
r = await misDatos(token2, 'PUT', { fav: muchas, hist: largo, pasajes: muchosPasajes });
chk('pone un tope a cuántas fuentes se guardan', Object.keys(r.cuerpo.fav).length<=500, String(Object.keys(r.cuerpo.fav).length));
chk('pone un tope al historial', r.cuerpo.hist.length<=50, String(r.cuerpo.hist.length));
chk('pone un tope a los pasajes', r.cuerpo.pasajes.length<=60, String(r.cuerpo.pasajes.length));

r = await misDatos(token2, 'PUT', { fav:{}, hist:[], pasajes:[{ t:'   ', r:'', url:'', q:'', modo:'todas' }] });
chk('un pasaje sin texto no se guarda', r.cuerpo.pasajes.length===0, JSON.stringify(r.cuerpo.pasajes));

console.log('\n--- anillos propios del tesauro ---');
{
  const guardar = (anillos) => misDatos(token2, 'PUT', { fav:{}, hist:[], pasajes:[], anillos });

  // La regla que sostiene el tesauro, aplicada tambien del lado del servidor:
  // un termino no puede ser a la vez "lo mismo" y "parecido pero distinto".
  let g = await guardar([{
    canonico: 'lucro cesante',
    equivalentes: ['ganancias dejadas de percibir', 'lucro cesante'],
    relacionados: ['ganancias dejadas de percibir', 'daño emergente'],
  }]);
  const a = (g.cuerpo.anillos || [])[0] || {};
  chk('el canonico no se repite entre los equivalentes',
    JSON.stringify(a.equivalentes)===JSON.stringify(['ganancias dejadas de percibir']), JSON.stringify(a.equivalentes));
  chk('un termino no queda como equivalente y como cercano a la vez',
    JSON.stringify(a.relacionados)===JSON.stringify(['daño emergente']), JSON.stringify(a.relacionados));

  g = await guardar([{ canonico:'algo', equivalentes:[] }]);
  chk('un anillo sin equivalentes no se guarda: no expandiria nada',
    (g.cuerpo.anillos||[]).length===0);

  g = await guardar([
    { canonico:'usucapión', equivalentes:['prescripción adquisitiva'] },
    { canonico:'Usucapión', equivalentes:['otra cosa'] },
  ]);
  chk('un canonico repetido no entra dos veces: la expansion seria ambigua',
    g.cuerpo.anillos.length===1, String(g.cuerpo.anillos.length));

  g = await guardar([{ canonico:'x', equivalentes:['y'], desde:3000 }]);
  chk('un año imposible se descarta', g.cuerpo.anillos[0].desde===null, String(g.cuerpo.anillos[0].desde));

  g = await guardar(Array.from({length:400},(_,k)=>({ canonico:'c'+k, equivalentes:['e'+k] })));
  chk('hay tope de cuantos anillos se guardan', g.cuerpo.anillos.length===300, String(g.cuerpo.anillos.length));

  await guardar([]); // se deja limpio para no ensuciar las pruebas de abajo
}

console.log('\n--- perfil ---');
{
  const rp = await post('/registro', { email:'colega@test.com', password:'contrasenia123', nombre:'  Ana   María  ', especialidad:'Derecho laboral', actualizaciones:true });
  chk('el registro guarda nombre (sin espacios de más), especialidad y novedades', rp.cuerpo.usuario.nombre==='Ana María' && rp.cuerpo.usuario.especialidad==='Derecho laboral' && rp.cuerpo.usuario.actualizaciones===true, JSON.stringify(rp.cuerpo.usuario));
  const sin = await post('/registro', { email:'sin@test.com', password:'contrasenia123', actualizaciones:'si' });
  chk('sin datos de perfil el registro anda y novedades queda en falso', sin.cuerpo.ok && sin.cuerpo.usuario.nombre==='' && sin.cuerpo.usuario.actualizaciones===false, JSON.stringify(sin.cuerpo.usuario));
  const put = await fetch(B+'/perfil', { method:'PUT', headers:{'content-type':'application/json', authorization:'Bearer '+rp.cuerpo.token}, body: JSON.stringify({ nombre:'x'.repeat(200), especialidad:{a:1}, actualizaciones:false }) });
  const pj = await put.json();
  chk('el perfil se edita y se acota el largo', pj.ok && pj.usuario.nombre.length===60 && pj.usuario.especialidad==='' && pj.usuario.actualizaciones===false, JSON.stringify(pj.usuario));
  const y2 = await yo(rp.cuerpo.token);
  chk('«quién soy» devuelve el perfil guardado', y2.cuerpo.usuario.nombre.length===60);
  const noAut = await fetch(B+'/perfil', { method:'PUT', headers:{'content-type':'application/json'}, body:'{}' });
  chk('editar el perfil exige sesión', noAut.status===401, String(noAut.status));
}

console.log(`\nOK ${OK.length} · fallas ${MAL.length}`);
if(MAL.length) 


console.log('Fallaron:', MAL.join(' | '));
await fs.rm(DIR_TMP, { recursive:true, force:true });
process.exit(MAL.length?1:0);
