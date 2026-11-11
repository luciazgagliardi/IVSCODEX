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
        muestras:filaDatos.filter(x=>/sentencia/i.test(x.clase||'')).slice(0,5),
        selects:[...doc.window.document.querySelectorAll('select')].slice(0,8).map(sel=>({
          id:sel.id,name:sel.name,opciones:[...sel.options].slice(0,18).map(o=>({v:o.value,t:o.text.trim().slice(0,65)}))
        }))};
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

console.log('FORMULARIO_LISTAS '+JSON.stringify(await consultar('https://www2.jus.mendoza.gov.ar/listas/proveidos/listas.php')));
for (const [nom4, tribunal] of [['01','01.04'],['1','01.04'],['1CT1','1CT1'],['1CT1','01.04'],['99','1CT1']]) {
  const p=new URLSearchParams({nom2:'1',nom3:'04',nom4,tribunal,sd:'18/11/2025',ed:'18/11/2025',numero:'',caratula:'',iduser:''});
  console.log('DIVISION_CT '+JSON.stringify({nom4,tribunal,...await consultar('https://www2.jus.mendoza.gov.ar/listas/proveidos/listas.php?consulta=1',p)}));
  await pausa(800);
}

const buscador='https://wwwjuri.jus.mendoza.gov.ar/bib/jurisprudencia/funciones/consultar.php';
for(const libre of ['daño moral','despido']) {
  const p=new URLSearchParams(armador);p.set('libre',libre);
  try {
    const a=await fetch(buscador,{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:p,signal:AbortSignal.timeout(20000)});
    const t=await a.text();const k=t.indexOf('@@');if(k<0){console.log('BUSCAR '+JSON.stringify({libre,error:'sin_SQL',body:t.slice(0,120)}));continue;}
    const total=Number((t.slice(0,k).match(/(\\d+)\\s*$/)||[])[1]||0),sql=t.slice(k+2);
    const p2=new URLSearchParams({funcion:'buscar',next_p:'1',total:String(total),mostrar:'20',sql});
    const b=await fetch(buscador,{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:p2,signal:AbortSignal.timeout(20000)});
    const html=await b.text();
    console.log('BUSCAR '+JSON.stringify({libre,contador:total,http:b.status,bytes:html.length,
      fichas:(html.match(/class=["'][^"']*ficha/g)||[]).length,
      ids:(html.match(/id=["'][^"']{3,40}/g)||[]).slice(0,8),
      inicial:html.slice(0,260)}));
  }catch(e){console.log('BUSCAR '+JSON.stringify({libre,error:String(e?.message||e)}))}
  await pausa(800);
}
