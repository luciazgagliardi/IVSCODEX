/** Sondeo público no intrusivo de rutas de jurisprudencia y listas históricas Mendoza. */
import { JSDOM } from 'jsdom';
const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
const headers = { 'User-Agent':'IVS-CODEX/1.0 (investigacion de interoperabilidad publica)',Accept:'text/html, */*;q=0.7' };
async function consultar(url, p) {
  try {
    const res = await fetch(url, {method:p?'POST':'GET',headers:p?{...headers,'Content-Type':'application/x-www-form-urlencoded'}:headers,
      body:p?.toString(),signal:AbortSignal.timeout(20000)});
    const txt=await res.text();
    let muestra;
    if(url.includes('/listas/proveidos/')) {
      const doc=new JSDOM(txt);
      const filaDatos=[...doc.window.document.querySelectorAll('tr')]
        .filter(tr=>tr.querySelector('button[onclick*="vertex("]'))
        .map(tr=>{
          const td=[...tr.querySelectorAll('td')].map(x=>x.textContent.replace(/\\s+/g,' ').trim());
          const urls=[...tr.querySelectorAll('a[href]')].map(a=>a.href);
          return {td:td.length,codigo:td[1],clase:td[5],fecha:td[3],
            pdf:urls.some(u=>u.includes('iol-api/api/public/expedientes/actuaciones/pdf'))};
        });
      muestra={totalFilasConVertex:filaDatos.length,coincidenciasSentencia:filaDatos.filter(x=>/sentencia/i.test(x.clase||'')).length,
        codigos:[...new Set(filaDatos.map(x=>x.codigo))].slice(0,14),
        muestras:filaDatos.filter(x=>/sentencia/i.test(x.clase||'')).slice(0,5)};
      doc.window.close();
    }
    return {http:res.status,bytes:txt.length,tieneSeparadorSQL:txt.includes('@@'),
      fichas:(txt.match(/class=["'][^"']*ficha/g)||[]).length,
      filas:(txt.match(/<tr\b/gi)||[]).length,
      vertex:(txt.match(/vertex\(/g)||[]).length,
      sentencias:(txt.match(/\bsentencia\b/gi)||[]).length,
      hrefPdf:(txt.match(/iol-api\/api\/public\/expedientes\/actuaciones\/pdf/g)||[]).length,
      enlaces:(txt.match(/(?:href|src)=["']([^"']+)/gi)||[]).slice(0,15).map(x=>x.slice(0,90)),
      totalSQL:(txt.match(/(\d+)\s*@@/)||[])[1]||null,
      muestra,
    };
  }catch(e){return {error:String(e.message||e).slice(0,180)};}
}
const armador = new URLSearchParams({funcion:'armarSql',mostrar:'20',tesauro:'',libre:'daño moral',materia:'0',
  tribunal:'SC',expediente:'',partes:'',preopinante:'',cota:'0',fecha:'',ubica:'0',libro:'',
  fojas:'',norma:'0',numero:'',articulo:'',tribu:'SC',competencia:''});
for(const url of [
  'https://wwwjuri.jus.mendoza.gov.ar/bib/jurisprudencia/funciones/consultar.php',
  'https://wwwjuri.jus.mendoza.gov.ar/jurisprudencia/consultar/funciones/consultar.php',
  'https://wwwjuri.jus.mendoza.gov.ar/jurisprudencia/funciones/consultar.php',
  'https://wwwjuri.jus.mendoza.gov.ar/jurisprudencia/consultar.php',
]){console.log('CONSULTA '+JSON.stringify({url,...await consultar(url,armador)}));await pausa(800);}
for(const d of ['18/11/2025','10/11/2026']){
  for(const fuero of ['03','04']){
    const p=new URLSearchParams({nom2:'1',nom3:fuero,nom4:'99',tribunal:'01.'+fuero,
      sd:d,ed:d,numero:'',caratula:'',iduser:''});
    console.log('LISTA '+JSON.stringify({fecha:d,fuero,...await consultar('https://www2.jus.mendoza.gov.ar/listas/proveidos/listas.php?consulta=1',p)}));
    await pausa(800);
  }
}
console.log('PORTAL '+JSON.stringify(await consultar('https://wwwjuri.jus.mendoza.gov.ar/jurisprudencia/consultar/index.php')));
