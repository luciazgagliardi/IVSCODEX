/* Banco de pruebas: levanta un sitio falso que hace de "base oficial",
   levanta el servidor real y comprueba extraccion, seguridad y errores. */
import http from 'node:http';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const OK = [], MAL = [];
const chk=(n,c,e='')=>{ (c?OK:MAL).push(n); console.log((c?'  OK  ':'FALLA ')+n+(e?' :: '+e:'')); };

/* ---- 1. PDF de verdad, con acentos ---- */
async function hacerPdf(){
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.TimesRoman);
  const p = doc.addPage([595,842]);
  const lineas=[
    'SUPREMA CORTE DE JUSTICIA DE MENDOZA - SALA PRIMERA',
    'Expte.: 13-04785621-9 "GONZALEZ, MARIA c/ TRANSPORTES SA p/ DANOS"',
    'Mendoza, 14 de marzo de 2024.',
    'CONSIDERANDO: que el dano moral no requiere prueba directa,',
    'conforme el art. 1741 del Codigo Civil y Comercial y la ley 24.240.',
    'La Corte Suprema, en Fallos: 334:376, fijo el criterio aplicable.',
    'El dano moral debe cuantificarse por placeres compensatorios.',
  ];
  lineas.forEach((t,i)=>p.drawText(t,{x:50,y:780-i*22,size:11,font:f}));
  return Buffer.from(await doc.save());
}

const PDF = await hacerPdf();
const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fallo de prueba</title></head>
<body><nav>Menu que no deberia aparecer</nav><header>Encabezado basura</header>
<article><h1>GONZALEZ, MARIA c/ TRANSPORTES SA p/ DANOS Y PERJUICIOS</h1>
<p>Mendoza, 14 de marzo de 2024. La Suprema Corte de Justicia de Mendoza resuelve.</p>
<p>El da&ntilde;o moral no requiere prueba directa de su existencia conforme el art. 1741 del Codigo Civil y Comercial.
Se aplica tambien la ley 24.240 de defensa del consumidor y el criterio de Fallos: 334:376 de la Corte Suprema.</p>
<p>Este parrafo existe para que el articulo supere el umbral minimo de caracteres que Readability necesita para
considerar que hay contenido real y no un simple esqueleto de pagina con menus. El da&ntilde;o moral aparece aqui otra vez.</p>
</article><footer>Pie de pagina basura</footer><script>var x=1;</script></body></html>`;

/* HTML en latin1, como muchos sitios judiciales viejos */
const HTML_LATIN = Buffer.from(
  `<html><head><title>Latin</title></head><body><article><p>` +
  `La reparaci\xf3n del da\xf1o moral corresponde seg\xfan el criterio de la C\xe1mara. `.repeat(8) +
  `</p></article></body></html>`, 'latin1');

/* ---- 2. Sitio falso ---- */
const origen = http.createServer((req,res)=>{
  if(req.url==='/fallo.pdf'){ res.writeHead(200,{'content-type':'application/pdf'}); return res.end(PDF); }
  if(req.url==='/fallo.html'){ res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); return res.end(HTML); }
  if(req.url==='/latin.html'){ res.writeHead(200,{'content-type':'text/html; charset=ISO-8859-1'}); return res.end(HTML_LATIN); }
  if(req.url==='/vacio.pdf'){ res.writeHead(200,{'content-type':'application/pdf'}); return res.end(Buffer.from('%PDF-1.4\n%%EOF')); }
  if(req.url==='/redir'){ res.writeHead(302,{location:'/fallo.html'}); return res.end(); }
  if(req.url==='/redir-malo'){ res.writeHead(302,{location:'http://169.254.169.254/latest/meta-data/'}); return res.end(); }
  if(req.url==='/gigante'){ res.writeHead(200,{'content-type':'text/html'}); return res.end(Buffer.alloc(40*1024*1024,'a')); }
  if(req.url==='/imagen'){ res.writeHead(200,{'content-type':'image/png'}); return res.end(Buffer.from([137,80,78,71])); }
  if(req.url==='/error'){ res.writeHead(403); return res.end('prohibido'); }
  res.writeHead(404); res.end('no');
});
await new Promise(r=>origen.listen(9911,'127.0.0.1',r));

/* ---- 3. Servidor real, en modo prueba ---- */
process.env.PERMITIR_RED_PRIVADA='true';
process.env.PERMITIR_CUALQUIER_DOMINIO='true';
process.env.ESPERA_POR_HOST_MS='0';
process.env.CACHE_HORAS='0';
process.env.PORT='9912';
await import('../index.js');
await new Promise(r=>setTimeout(r,700));

const api=async(url,extra={})=>{
  const r=await fetch('http://127.0.0.1:9912/api/extraer',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({url,...extra})});
  return {estado:r.status,cuerpo:await r.json()};
};
const B='http://127.0.0.1:9911';

console.log('\n--- extraccion ---');
let r = await api(B+'/fallo.pdf');
chk('extrae texto de un PDF real', r.cuerpo.ok && /da[nñ]o moral/i.test(r.cuerpo.texto), (r.cuerpo.texto||r.cuerpo.mensaje||'').slice(0,70));
chk('el PDF conserva el orden de las lineas', /SUPREMA CORTE[\s\S]*CONSIDERANDO/.test(r.cuerpo.texto||''));
chk('informa la cantidad de paginas', r.cuerpo.paginas===1, 'paginas='+r.cuerpo.paginas);

r = await api(B+'/fallo.html');
chk('extrae texto de una pagina HTML', r.cuerpo.ok && /daño moral/i.test(r.cuerpo.texto||''));
chk('descarta menus y pies de pagina', !/Menu que no deberia|Pie de pagina basura/.test(r.cuerpo.texto||''), r.cuerpo.metodo);
chk('no arrastra el JavaScript de la pagina', !/var x=1/.test(r.cuerpo.texto||''));
chk('detecta el titulo', !!r.cuerpo.titulo, r.cuerpo.titulo);

r = await api(B+'/latin.html');
chk('arregla los acentos de un sitio en ISO-8859-1', /reparación del daño moral/.test(r.cuerpo.texto||''), (r.cuerpo.texto||'').slice(0,60));

r = await api(B+'/redir');
chk('sigue redirecciones legitimas', r.cuerpo.ok && r.cuerpo.redirecciones===1, 'saltos='+r.cuerpo.redirecciones);

console.log('\n--- seguridad ---');
r = await api('http://169.254.169.254/latest/meta-data/');
chk('bloquea la IP de metadatos de la nube', r.cuerpo.codigo==='RED_PRIVADA'||r.cuerpo.codigo==='RED_INALCANZABLE', r.cuerpo.codigo);
r = await api('file:///etc/passwd');
chk('rechaza el esquema file://', r.cuerpo.codigo==='ESQUEMA_INVALIDO', r.cuerpo.codigo);
r = await api(B+'/redir-malo');
chk('bloquea una redireccion hacia la red interna', r.cuerpo.codigo==='RED_PRIVADA', r.cuerpo.codigo);
r = await api('http://10.0.0.5/interno');
chk('bloquea la red local 10.x', r.cuerpo.codigo==='RED_PRIVADA', r.cuerpo.codigo);
r = await api('http://192.168.1.1/router');
chk('bloquea la red domestica 192.168.x', r.cuerpo.codigo==='RED_PRIVADA', r.cuerpo.codigo);
const { ipEsPrivada, dominioHabilitado } = await import('../lib/descargador.js');
chk('la funcion marca 127.0.0.1 como privada', ipEsPrivada('127.0.0.1')===true);
chk('la funcion marca 169.254.169.254 como privada', ipEsPrivada('169.254.169.254')===true);
chk('la funcion acepta una IP publica', ipEsPrivada('200.5.4.3')===false);
// La lista blanca se prueba en un proceso aparte, con el modo abierto apagado.
const { execFileSync } = await import('node:child_process');
const listaBlanca = JSON.parse(execFileSync(process.execPath, ['-e', `
  import('./lib/descargador.js').then(m=>{
    console.log(JSON.stringify({
      sub:   m.dominioHabilitado('sjconsulta.csjn.gov.ar'),
      exacto:m.dominioHabilitado('csjn.gov.ar'),
      falso1:m.dominioHabilitado('malicioso-csjn.gov.ar.evil.com'),
      falso2:m.dominioHabilitado('evil-csjn.gov.ar'),
      falso3:m.dominioHabilitado('ejemplo.com')
    }));
  });
`], { env:{...process.env, PERMITIR_CUALQUIER_DOMINIO:'false'}, cwd:process.cwd() }).toString());
chk('acepta subdominios de una fuente oficial', listaBlanca.sub===true);
chk('acepta el dominio exacto', listaBlanca.exacto===true);
chk('no se deja enganar por un sufijo falso', listaBlanca.falso1===false);
chk('no se deja enganar por un prefijo pegado', listaBlanca.falso2===false, 'evil-csjn.gov.ar');
chk('rechaza un dominio ajeno', listaBlanca.falso3===false);

console.log('\n--- errores con mensaje util ---');
r = await api(B+'/vacio.pdf');
chk('avisa que el PDF es un escaneo sin texto', r.cuerpo.codigo==='PDF_ESCANEADO'||r.cuerpo.codigo==='PDF_ILEGIBLE', r.cuerpo.codigo);
r = await api(B+'/imagen');
chk('rechaza un tipo que no sabe leer', r.cuerpo.codigo==='TIPO_NO_SOPORTADO', r.cuerpo.codigo);
r = await api(B+'/error');
chk('traduce el 403 del origen', r.cuerpo.codigo==='RESPUESTA_NO_OK', r.cuerpo.codigo);
r = await api(B+'/gigante');
chk('corta la descarga si supera el limite', r.cuerpo.codigo==='DEMASIADO_GRANDE', r.cuerpo.codigo);
r = await api('');
chk('avisa si falta el enlace', r.cuerpo.codigo==='URL_FALTANTE', r.cuerpo.codigo);
r = await api('no soy una url');
chk('avisa si el enlace esta mal escrito', r.cuerpo.codigo==='URL_INVALIDA', r.cuerpo.codigo);
chk('todos los errores traen mensaje en castellano', typeof r.cuerpo.mensaje==='string' && r.cuerpo.mensaje.length>20);

console.log('\n--- rutas auxiliares ---');
let s=await (await fetch('http://127.0.0.1:9912/api/salud')).json();
chk('/api/salud responde', s.ok===true);
let v=await (await fetch('http://127.0.0.1:9912/api/verificar?url=https://www.csjn.gov.ar/x')).json();
chk('/api/verificar acepta una fuente oficial', v.valida===true);
let f=await fetch('http://127.0.0.1:9912/');
chk('sirve el frontend en la raiz', f.status===200 && (await f.text()).includes('Iuris Et De Iure'));
let n=await (await fetch('http://127.0.0.1:9912/api/inexistente')).json();
chk('las rutas inexistentes devuelven JSON', n.ok===false && n.codigo==='RUTA_INEXISTENTE');

console.log(`\nOK ${OK.length} · fallas ${MAL.length}`);
if(MAL.length) console.log('Fallaron:', MAL.join(' | '));
origen.close();
process.exit(MAL.length?1:0);
