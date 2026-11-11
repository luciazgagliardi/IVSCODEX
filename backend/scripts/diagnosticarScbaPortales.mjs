/** Sondeo de interoperabilidad de portales de sentencias públicas de SCBA. */
const hosts=['https://sentencias-corte.scba.gov.ar/','https://sentencias-camara.scba.gov.ar/','https://sentencias.scba.gov.ar/'];
const H={'User-Agent':'IVS-CODEX/1.0 (consulta pública de jurisprudencia)','Accept':'text/html,application/javascript,*/*;q=0.8'};
async function pedir(u){try{const r=await fetch(u,{headers:H,signal:AbortSignal.timeout(17000)});return {status:r.status,url:r.url,type:r.headers.get('content-type'),txt:await r.text()}}catch(e){return{error:String(e.message)}}}
for(const host of hosts){
 const p=await pedir(host);
 const html=p.txt||'';
 const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(x=>new URL(x[1],host).href);
 const forms=[...html.matchAll(/<form[^>]*>/gi)].map(x=>x[0].slice(0,300));
 const endpoints=[...html.matchAll(/(?:fetch\(|ajax|url:|api\/|\.aspx|\.ashx|\.svc|\.php|\.json|\.do\b)[^\n]{0,160}/gi)].map(x=>x[0].slice(0,150)).slice(0,45);
 console.log('SITIO '+JSON.stringify({host,status:p.status,bytes:html.length,error:p.error,scripts,forms,endpoints}));
 for(const script of scripts.filter(x=>new URL(x).hostname===new URL(host).hostname).slice(-8)){
  const s=await pedir(script);
  const body=s.txt||'';
  const matches=[...body.matchAll(/.{0,90}(?:ajax|api\/|\.aspx|\.ashx|\.svc|\.php|[Uu]rl:|DataTable|serverSide).{0,180}/g)].map(x=>x[0]).slice(0,23);
  console.log('SCRIPT '+JSON.stringify({host,src:script,status:s.status,bytes:body.length,matches}));
 }
}
