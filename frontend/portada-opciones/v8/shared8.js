/* v8 · Se conserva el prisma como comienzo; todo lo demás (cabecera, secciones, cierre) es propio de cada propuesta. */
(function(){
  var S=IVS4;
  window.IVS8={
    CAB:'<header class="cab" id="cab"><span class="marca">I<span class="v">V</span>S<span class="d"></span>CODE<span class="v">X</span></span><nav><a href="#">Consulta</a><a href="#">Fuentes</a><a href="#">Verificación</a><a href="#">Cuenta</a></nav><a class="btn" href="#">Iniciar la consulta</a></header><a class="idx6" href="index.html">← Las tres propuestas</a>',
    BASES:[["MZA","Poder Judicial de Mendoza","--c-mza"],["MZA LEGAL","Mendoza Legal","--c-mzl"],["TSJ","Tribunal Superior de la Ciudad","--c-caba"],["CSJN","Corte Suprema de Justicia de la Nación","--c-csjn"],["SAIJ","Sistema Argentino de Información Jurídica","--c-saij"],["DIALNET","Dialnet · doctrina","--c-dial"]],
    PRINC:[["FONS","La fuente","Todo resultado remite al documento del organismo que lo dictó. Lo que se lee nunca es una versión propia."],["ORDO","El orden","Los resultados de las seis bases se presentan juntos, con la misma forma y la procedencia a la vista."],["FIDES","La fe","Una cita se contrasta con la base oficial antes de presentarse. Ante su ausencia, el antecedente se presume inexistente."]],
    ADV:"La ausencia de coincidencias no demuestra la falsedad del fallo, ya que puede responder a faltas de indexación o carátulas alternativas; asimismo, la confirmación de existencia del expediente no garantiza la veracidad del criterio atribuido, cuya verosimilitud sólo se comprueba mediante la lectura directa de los considerandos.",
    montar:function(){
      document.body.insertAdjacentHTML("afterbegin",'<div class="grano" aria-hidden="true"></div>'+this.CAB+'<main id="m8"><section class="hero6" id="hero6"><canvas id="cv6" aria-hidden="true"></canvas><div class="h6t"><h1 class="t">'+S.TITULO+'</h1></div><div class="h6b">'+S.BOTONES+'</div><p class="h6hint">Desplace<i></i></p></section></main>');
      IVSPrisma(document.getElementById("cv6"),{px:.54,cy:.5,band:[.38,.62],out:function(P,w,h){return [[w,P.y]];}});
      return document.getElementById("m8");
    },
    clamp:S.clamp,sm:S.sm,
    /* ejecuta f(p) con p en 0..1 mientras el elemento cruza la pantalla (a=fracción de pantalla donde empieza, b=donde termina) */
    scroll:function(el,f,a,b){a=a==null?.9:a;b=b==null?.25:b;var pend=false;function t(){pend=false;var r=el.getBoundingClientRect(),h=innerHeight;f(IVS4.clamp((h*a-r.top)/(r.height+h*(a-b)),0,1),r);}
      function q(){if(!pend){pend=true;requestAnimationFrame(t);}}addEventListener("scroll",q,{passive:true});addEventListener("resize",q);t();},
    /* revela palabra a palabra con el scroll (respeta los <b> internos) */
    scrub:function(els,a,b){[].forEach.call(els,function(el){var ws=[];
      (function wrap(n){[].slice.call(n.childNodes).forEach(function(c){if(c.nodeType===3){var f=document.createDocumentFragment();c.textContent.split(/(\s+)/).forEach(function(w){if(!w)return;if(/^\s+$/.test(w)){f.appendChild(document.createTextNode(w));}else{var s=document.createElement("span");s.className="w";s.textContent=w;f.appendChild(s);ws.push(s);}});n.replaceChild(f,c);}else if(c.nodeType===1&&!c.classList.contains("nowrap"))wrap(c);});})(el);
      var last=-1;IVS8.scroll(el,function(p){var k=Math.round(p*ws.length*1.04);if(k===last)return;last=k;ws.forEach(function(w,i){w.classList.toggle("on",i<k);});},a==null?.82:a,b==null?.4:b);});}
  };
})();
