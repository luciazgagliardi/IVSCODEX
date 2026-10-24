/* ============================================================
   IVSNombre — buscar un fallo por su nombre.
   ============================================================
   «CSJN 1984 FIORENTINO S/TENENCIA ILEGITIMA DE ESTUPEFACIENTES» no es un
   tema: es la carátula de un fallo, con el tribunal y el año. Buscado como
   tema no aparece, porque se le pide al fallo que contenga «CSJN» y «1984»
   en el texto. Este módulo reconoce una consulta así y la separa en:
     · el tribunal (CSJN, SCBA, SCJM, TSJ, Corte IDH…) → en qué base buscar;
     · el año, la fecha o la cita de Fallos → para ordenar y confirmar;
     · las partes («Fiorentino») → lo que se busca en la carátula;
     · el objeto («tenencia ilegítima de estupefacientes») → para confirmar.
   Después ordena lo que devuelve cada base por cuánto se parece su carátula
   a la buscada. Determinista y sin servidor: corre en el navegador y en
   node (backend/test/nombre.prueba.js). */
var IVSNombre=(function(){
  function plano(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); }
  var TRIBUNALES=[
    {re:/\b(?:csjn|c\.\s?s\.\s?j\.\s?n\.?|corte suprema de justicia de la nacion|corte suprema nacional|corte suprema|corte nacional)(?![a-z])/,cod:"csjn",nombre:"Corte Suprema de Justicia de la Nación",bases:["csjn"]},
    {re:/\b(?:scba|s\.\s?c\.\s?b\.\s?a\.?|suprema corte de (?:justicia de )?(?:la provincia de )?buenos aires|suprema corte bonaerense|juba)(?![a-z])/,cod:"scba",nombre:"Suprema Corte de Buenos Aires",bases:["scba"]},
    {re:/\b(?:scjm|scj\s?mza|s\.\s?c\.\s?j\.\s?m\.?|suprema corte de (?:justicia de )?mendoza|suprema corte mendocina)(?![a-z])/,cod:"scjm",nombre:"Suprema Corte de Mendoza",bases:["mendoza","mendozalegal"]},
    {re:/\b(?:tsj|t\.\s?s\.\s?j\.?|tribunal superior de justicia(?: de la ciudad(?: autonoma)?(?: de buenos aires)?)?)(?![a-z])/,cod:"tsj",nombre:"Tribunal Superior de Justicia de la Ciudad",bases:["caba"]},
    {re:/\b(?:corte ?idh|corte interamericana(?: de derechos humanos)?)(?![a-z])/,cod:"corteidh",nombre:"Corte Interamericana de Derechos Humanos",bases:["corteidh"]},
    {re:/\b(?:cnciv|cncom|cnat|cntrab|cncaf|cnfed|cncrim|cnfcc|cfcp|camara nacional(?: de apelaciones)?(?: en lo [a-z ]+)?|camara federal(?: de [a-z ]+)?)(?![a-z])/,cod:"camara",nombre:"Cámara nacional o federal",bases:["saij"]}
  ];
  // nexos de una carátula: separan partes y objeto
  var NEXOS=/\s(?:s\s*\/|s\/|c\s*\/|c\/|c\.|v\.|vs\.?|contra|en\s+j\s*[°º.]?|en\s+autos|caratulados?|sobre)\s/;
  var RE_NEXO_G=/(?:^|\s)(s\s*\/|c\s*\/|c\.(?=\s)|v\.(?=\s)|vs\.?(?=\s)|contra(?=\s)|en\s+j\s*[°º.]?(?=\s)|sobre(?=\s))/g;
  var VACIAS={de:1,del:1,la:1,las:1,el:1,los:1,y:1,e:1,o:1,en:1,a:1,al:1,por:1,para:1,con:1,sin:1,su:1,sus:1,un:1,una:1,
    otro:1,otros:1,otra:1,otras:1,sa:1,srl:1,sau:1,saic:1,sociedad:1,anonima:1,ltda:1,in:1,re:1,causa:1,autos:1,caso:1,fallo:1,fallos:1,expte:1,expediente:1};
  function palabras(s){ return plano(s).replace(/[^a-z0-9ñ ]+/g," ").split(/\s+/).filter(function(w){ return w.length>=3&&!VACIAS[w]&&!/^\d+$/.test(w); }); }

  /* null si la consulta no parece el nombre de un fallo.
     opciones.esTema(texto): true si el resto es un tema conocido («daño moral»),
     para no leer «CSJN 2020 daño moral» como una carátula. */
  function interpretar(q,opciones){
    opciones=opciones||{};
    var orig=String(q||"").replace(/[«»“”"]/g," ").replace(/\s+/g," ").trim();
    if(orig.length<4) return null;
    var p=" "+plano(orig)+" ",trib=null,anio=null,fecha=null,fallos=null;
    TRIBUNALES.some(function(t){ var m=t.re.exec(p); if(m){ trib=t; p=p.slice(0,m.index)+" "+p.slice(m.index+m[0].length); return true; } return false; });
    var mf=/\bfallos\s*:?\s*(\d{1,3})\s*:\s*(\d{1,5})\b|\b(\d{2,3})\s*:\s*(\d{1,5})\b/.exec(p);
    if(mf){ fallos=(mf[1]||mf[3])+":"+(mf[2]||mf[4]); p=p.slice(0,mf.index)+" "+p.slice(mf.index+mf[0].length); if(!trib) trib=TRIBUNALES[0]; }
    var md=/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})\b/.exec(p);
    if(md){ fecha=("0"+md[1]).slice(-2)+"/"+("0"+md[2]).slice(-2)+"/"+md[3]; anio=+md[3]; p=p.slice(0,md.index)+" "+p.slice(md.index+md[0].length); }
    else{ var ma=/(?:^|[\s(,])((?:18[6-9]|19\d|20[0-4])\d)(?=[\s),.]|$)/.exec(p); if(ma){ anio=+ma[1]; p=p.slice(0,ma.index)+" "+p.slice(ma.index+ma[0].length); } }
    p=p.replace(/\s+/g," ").trim();
    if(!p) return null;
    var conNexo=NEXOS.test(" "+p+" ");
    var resto=palabras(p);
    if(!resto.length) return null;
    // ¿nombre o tema? con nexo de carátula («s/», «c/», «en j°») es nombre; sin nexo,
    // sólo si viene con tribunal o con año y lo que queda no es un tema conocido
    if(!conNexo){
      if(!(trib||fallos)||!(anio||fallos||fecha)) return null;
      if(resto.length>6) return null;
      if(opciones.esTema&&opciones.esTema(p)) return null;
    }
    // partes: lo que está antes del primer nexo; objeto: lo que sigue a «s/» o «sobre»
    var partes=p,objeto="",contra="";
    var nexos=[],m;RE_NEXO_G.lastIndex=0;
    while((m=RE_NEXO_G.exec(" "+p+" "))) nexos.push({i:m.index,len:m[0].length,t:m[1].replace(/\s+/g,"")});
    if(nexos.length){
      var q2=" "+p+" ";
      partes=q2.slice(0,nexos[0].i);
      for(var k=0;k<nexos.length;k++){
        var tramo=q2.slice(nexos[k].i+nexos[k].len,k+1<nexos.length?nexos[k+1].i:q2.length);
        if(/^(s\/|sobre)$/.test(nexos[k].t)) objeto+=" "+tramo;
        else if(/^(c\/|c\.|v\.|vs\.?|contra)$/.test(nexos[k].t)) contra+=" "+tramo;
        // «X en j° Y c/ Z»: lo de adentro del juicio también es parte
        else contra+=" "+tramo;
      }
    }
    var wPartes=palabras(partes),wContra=palabras(contra),wObjeto=palabras(objeto);
    if(!wPartes.length&&wContra.length){ wPartes=wContra; wContra=[]; }
    if(!wPartes.length) return null;
    // lo que se le pide a la base: las partes (el apellido es lo que la carátula seguro tiene)
    var consulta=wPartes.slice(0,4).join(" ");
    return {
      tribunal:trib?trib.cod:null,nombreTribunal:trib?trib.nombre:null,bases:trib?trib.bases.slice():null,
      anio:anio,fecha:fecha,fallos:fallos,
      partes:wPartes,contra:wContra,objeto:wObjeto,
      consulta:consulta,
      // para resaltar y mostrar
      palabras:wPartes.concat(wContra,wObjeto),
      texto:orig
    };
  }

  /* De 0 a 1: cuánto se parece un resultado al fallo buscado. */
  function raizDe(w){ return w.length>6?w.slice(0,6):w; }
  function contiene(car,w){ return new RegExp("(?:^|[^a-z0-9])"+raizDe(w).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).test(car); }
  function fraccion(car,ws){ if(!ws.length) return null; var n=0; ws.forEach(function(w){ if(contiene(car,w)) n++; }); return n/ws.length; }
  function anioDe(r){ var m=/(\d{4})\s*$/.exec(String(r.fecha||"").trim())||/\b((?:18|19|20)\d\d)\b/.exec(String(r.fecha||"")); return m?+m[1]:null; }
  function parecido(r,n){
    var car=plano([r.caratula,r.tema].filter(Boolean).join(" ")),todo=plano([r.caratula,r.tema,r.sumario,r.expediente].filter(Boolean).join(" "));
    var fp=fraccion(car,n.partes),fc=fraccion(car,n.contra),fo=fraccion(car,n.objeto);
    // las partes pueden estar sólo en el texto (sumarios que no traen la carátula): valen menos
    if(!fp){ var ft=fraccion(todo,n.partes); fp=ft?ft*.5:0; }
    var s=.6*fp,peso=.6;
    if(fc!==null){ s+=.15*fc; peso+=.15; }
    if(fo!==null){ s+=.25*fo; peso+=.25; }
    s=s/peso;
    // la parte buscada como actora no es la misma causa que esa parte como demandada
    // («Bazterrica s/ tenencia» no es «Plá c/ Clínica Bazterrica»)
    var ic=car.search(/\s(?:c\s*\/|c\.|v\.|vs\.?|contra)\s/);
    if(ic>0&&n.partes.length&&n.partes.every(function(w){ return !contiene(car.slice(0,ic),w); })&&!(n.contra.length&&n.contra.some(function(w){ return contiene(car.slice(0,ic),w); }))) s*=.75;
    var a=anioDe(r);
    if(n.anio&&a){ s+=a===n.anio?.15:(Math.abs(a-n.anio)===1?0:-.2); }
    if(n.fecha&&String(r.fecha||"").indexOf(n.fecha)>=0) s+=.1;
    if(n.fallos&&todo.indexOf(n.fallos)>=0) s+=.2;
    if(n.tribunal==="csjn"&&/corte suprema/.test(plano(r.tribunal))) s+=.05;
    return Math.max(0,Math.min(1,+s.toFixed(3)));
  }
  /* Ordena por parecido, marca los que coinciden y junta las fichas repetidas
     del mismo fallo (SAIJ suele tener dos: «Fiorentino, Diego Enrique s/…» y
     «DIEGO ENRIQUE FIORENTINO s/…»). */
  function ordenar(lista,n){
    var xs=(lista||[]).filter(Boolean).map(function(r,i){
      r.parecido=parecido(r,n);
      // con año buscado, coincidir es también coincidir en el año
      var a=anioDe(r);
      r.coincideNombre=r.parecido>=.6&&!(n.anio&&a&&Math.abs(a-n.anio)>1);
      return {r:r,i:i};
    });
    xs.sort(function(a,b){ return b.r.parecido-a.r.parecido||a.i-b.i; });
    var out=[];
    xs.forEach(function(x){
      var r=x.r;
      if(r.coincideNombre){
        var igual=out.filter(function(y){ return y.coincideNombre&&y.fecha&&y.fecha===r.fecha&&n.partes.every(function(w){ return contiene(plano(y.caratula),w)===contiene(plano(r.caratula),w); }); })[0];
        if(igual){
          if(!igual.sumario&&r.sumario) igual.sumario=r.sumario;
          (igual.otrasFichas=igual.otrasFichas||[]).push({caratula:r.caratula,linkFicha:r.linkFicha});
          return;
        }
      }
      out.push(r);
    });
    return out;
  }
  return {interpretar:interpretar,parecido:parecido,ordenar:ordenar,plano:plano};
})();

if(typeof module!=="undefined"&&module.exports) module.exports={IVSNombre:IVSNombre};
