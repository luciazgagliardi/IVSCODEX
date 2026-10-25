/* ============================================================
   IVSPasajes — dónde coincide lo buscado y qué pasaje mostrar.
   ============================================================
   Una sola forma de encontrar la coincidencia para la lista de resultados,
   el Lector y el servidor (los pasajes que se sacan de cada documento):
     · sin acentos ni mayúsculas («indemnización» = «INDEMNIZACION»);
     · por la raíz de cada palabra: «despido» marca «despidos», «moral»
       marca «morales», «indemnización» marca «indemnizar» e «indemnizado»
       (los buscadores oficiales encuentran por esas formas, y si el Lector
       sólo marca la palabra exacta, la coincidencia no se ve);
     · la frase exacta, con cualquier espacio o salto de línea en el medio;
     · sin conectores («de», «la», «que»): marcarlos no señala nada.
   El pasaje es el tramo del texto con más palabras DISTINTAS de la búsqueda,
   no el principio del documento ni el texto entero.
   Corre en el navegador y en node (backend/routes/indice.js y las pruebas). */
var IVSPasajes=(function(){
  var VACIAS={};
  ("de del la las el los un una unos unas y e o u en al a ante con sin por para que se su sus lo le les es son como mas sobre entre desde hasta segun contra ni no and or not site").split(" ").forEach(function(w){ VACIAS[w]=1; });
  var LETRA=/[a-z0-9ñ]/;
  function plegarUno(c){ try{ return c.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase(); }catch(e){ return c.toLowerCase(); } }
  /* El texto plegado y, por cada letra, su posición en el original. */
  function plegar(t){
    t=String(t||"");
    var s="",map=[],i,j,n;
    for(i=0;i<t.length;i++){ n=plegarUno(t.charAt(i)); for(j=0;j<n.length;j++){ s+=n.charAt(j); map.push(i); } }
    map.push(t.length);
    return {s:s,map:map};
  }
  /* La raíz de una palabra plegada: sin las terminaciones de plural, género o derivación. */
  function raiz(w){
    if(w.length<=4) return w;
    var r=w.replace(/(aciones|iciones|amientos|imientos|amiento|imiento|mente|ciones|cion|iones|ion|es|as|os|s|a|o|e)$/,"");
    return r.length>=4?r:w.slice(0,Math.max(4,w.length-1));
  }
  /* Lo que se busca: en «exacta», la frase; si no, cada palabra útil por su raíz. */
  function terminos(q,modo){
    var limpia=plegar(String(q||"").replace(/["'()«»“”]/g," ")).s.replace(/\s+/g," ").trim();
    if(!limpia) return [];
    var ws=limpia.split(" ").filter(function(w){ return w.length>=2&&!VACIAS[w]; });
    if(modo==="exacta"&&limpia.indexOf(" ")>=0) return [{frase:limpia.split(" "),k:0}];
    if(!ws.length) ws=limpia.split(" ");
    var vistos={},out=[];
    ws.forEach(function(w){ var r=raiz(w); if(!vistos[r]){ vistos[r]=1; out.push({raiz:r,palabra:w,k:out.length}); } });
    return out;
  }
  /* Las coincidencias en el texto: [{a,b,k}] con a y b en el texto ORIGINAL, ya unidas. */
  function coincidencias(texto,q,opciones){
    opciones=opciones||{};
    var ts=Array.isArray(q)?q:terminos(q,opciones.modo);
    if(!texto||!ts.length) return [];
    var P=opciones.plegado||plegar(texto),s=P.s,bruto=[],tope=opciones.tope||6000;
    ts.forEach(function(t){
      if(t.frase){
        var re=new RegExp(t.frase.map(function(w){ return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }).join("[^a-z0-9ñ]+"),"g"),m;
        while((m=re.exec(s))&&bruto.length<tope){
          var a=m.index,b=a+m[0].length;
          if((a===0||!LETRA.test(s.charAt(a-1)))&&(b>=s.length||!LETRA.test(s.charAt(b)))) bruto.push({a:P.map[a],b:P.map[b],k:t.k});
          re.lastIndex=a+1;
        }
        return;
      }
      var r=t.raiz,desde=0,idx;
      while(bruto.length<tope&&(idx=s.indexOf(r,desde))>=0){
        desde=idx+1;
        if(idx>0&&LETRA.test(s.charAt(idx-1))&&!opciones.parcial) continue;
        // la palabra entera, hasta seis letras más que la raíz
        // una palabra corta o sin terminación quitada admite sólo el plural; una raíz, la derivación
        var fin=idx+r.length,extra=0,max=r===t.palabra?(r.length<=4?2:3):7;
        while(fin<s.length&&LETRA.test(s.charAt(fin))&&extra<max){ fin++; extra++; }
        if(fin<s.length&&LETRA.test(s.charAt(fin))&&!opciones.parcial) continue;
        bruto.push({a:P.map[idx],b:P.map[fin],k:t.k});
      }
    });
    bruto.sort(function(x,y){ return x.a-y.a||x.b-y.b; });
    var out=[];
    bruto.forEach(function(c){
      var u=out[out.length-1];
      if(u&&c.a<=u.b){ if(c.b>u.b) u.b=c.b; }
      else out.push({a:c.a,b:c.b,k:c.k});
    });
    return out;
  }
  /* El mejor tramo de «largo» caracteres: el que tiene más términos distintos, después más coincidencias. */
  function mejorTramo(texto,cs,largo,desde){
    desde=desde||0;
    var cands=cs.filter(function(c){ return c.a>=desde; });
    if(!cands.length) cands=cs;
    var mejor=null,ms=-1;
    for(var i=0;i<cands.length;i++){
      var ini=Math.max(0,cands[i].a-Math.floor(largo*0.3)),fin=ini+largo,vistos={},n=0;
      for(var j=i;j<cands.length&&cands[j].a<fin;j++){ vistos[cands[j].k]=1; n++; }
      var sc=Object.keys(vistos).length*1000+n;
      if(sc>ms){ ms=sc; mejor={ini:ini,fin:Math.min(texto.length,fin)}; }
    }
    return mejor;
  }
  /**
   * El pasaje para mostrar: {texto, marcas:[{a,b}] relativas al pasaje, hay}.
   * opciones: modo, largo (420), desde (dónde empieza el cuerpo, para no
   * preferir la carátula), exigir (sin coincidencia → texto vacío).
   */
  function pasaje(texto,q,opciones){
    opciones=opciones||{};
    texto=String(texto||"");
    var largo=opciones.largo||420,cs=coincidencias(texto,q,opciones);
    if(!cs.length){
      if(opciones.exigir) return {texto:"",marcas:[],hay:false};
      var d0=Math.min(opciones.desde||0,Math.max(0,texto.length-largo));
      var t0=texto.slice(d0,d0+largo);
      return {texto:(d0>0?"… ":"")+limpiar(t0)+(d0+largo<texto.length?" …":""),marcas:[],hay:false};
    }
    var tr=texto.length<=largo?{ini:0,fin:texto.length}:mejorTramo(texto,cs,largo,opciones.desde);
    var ini=tr.ini,fin=tr.fin;
    // sin cortar palabras
    if(ini>0){ var e1=texto.indexOf(" ",ini); if(e1>=0&&e1<ini+30) ini=e1+1; }
    if(fin<texto.length){ var e2=texto.lastIndexOf(" ",fin); if(e2>ini+largo*0.6) fin=e2; }
    var dentro=cs.filter(function(c){ return c.a>=ini&&c.b<=fin; });
    // se arma con los espacios colapsados, corriendo las marcas
    var out="",marcas=[],pos=ini,pre=ini>0?"… ":"";
    dentro.forEach(function(c){ out+=limpiar(texto.slice(pos,c.a)); var a=out.length; out+=texto.slice(c.a,c.b).replace(/\s+/g," "); marcas.push({a:a+pre.length,b:out.length+pre.length}); pos=c.b; });
    out+=limpiar(texto.slice(pos,fin));
    return {texto:pre+out+(fin<texto.length?" …":""),marcas:marcas,hay:true};
  }
  function limpiar(s){ return String(s).replace(/\s+/g," "); }
  /* El pasaje en HTML, con <mark>. esc: la función de escape de la página. */
  function html(texto,q,opciones,esc){
    var p=pasaje(texto,q,opciones),h="",pos=0;
    p.marcas.forEach(function(m){ h+=esc(p.texto.slice(pos,m.a))+"<mark>"+esc(p.texto.slice(m.a,m.b))+"</mark>"; pos=m.b; });
    return h+esc(p.texto.slice(pos));
  }
  return {plegar:plegar,raiz:raiz,terminos:terminos,coincidencias:coincidencias,pasaje:pasaje,html:html};
})();

if(typeof module!=="undefined"&&module.exports) module.exports={IVSPasajes:IVSPasajes};
