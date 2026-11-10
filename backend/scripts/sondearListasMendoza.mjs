/**
 * Un solo sondeo de metadatos de la lista judicial PUBLICA de Mendoza.
 * No descarga ni guarda nombres de partes o expedientes; identifica el
 * formulario para una eventual cosecha sólo de sentencias publicadas.
 */
const url='https://www2.jus.mendoza.gov.ar/listas/proveidos/listas.php';
try {
 const r=await fetch(url,{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; IVS-CODEX; consulta de acceso publico)'},signal:AbortSignal.timeout(20000)});
 const html=await r.text();
 const forms=[...html.matchAll(/<form\b([^>]*)>/gi)].map(m=>m[1].slice(0,350));
 const selects=[...html.matchAll(/<select\b([^>]*)>/gi)].map(m=>m[1].slice(0,250));
 const inputs=[...html.matchAll(/<input\b([^>]*)>/gi)].map(m=>m[1].slice(0,250)).filter(x=>/name=/i.test(x)).slice(0,50);
 const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)/gi)].map(m=>m[1]).slice(0,30);
 console.log(JSON.stringify({http:r.status,bytes:html.length,forms,selects,inputs,scripts,hasOfficialLinks:/vertexto\.php\?ide=/i.test(html),hasListas:/Consultar Lista|Listas de Tribunales/i.test(html)},null,2));
 if(!r.ok)process.exitCode=2;
}catch(e){console.error(String(e));process.exitCode=2}
