/* v6 · Pieza común: el héroe del prisma (idéntico al de la versión 4) y el cierre. */
(function(){
  var S=IVS4;
  var BASES=[["SCJM","--c-mza"],["MZA LEGAL","--c-mzl"],["TSJ","--c-caba"],["CSJN","--c-csjn"],["SAIJ","--c-saij"],["DIALNET","--c-dial"]];
  var CAB='<header class="cab"><span class="marca">I<span class="v">V</span>S<span class="d"></span>CODE<span class="v">X</span></span><nav><a href="#" data-tab="buscar">Consulta</a><a href="#" data-tab="fuentes">Fuentes</a><a href="#" data-tab="verificar">Verificación</a><a href="#" data-tab="cuenta">Cuenta</a></nav><div class="acts"><a class="btn sec" href="#" data-tab="fuentes">Ver el catálogo de fuentes</a><a class="btn" href="#" data-tab="buscar">Iniciar la consulta</a></div></header>';
  window.IVS6={
    BASES:BASES,
    /* monta la cabecera, el héroe del prisma y devuelve el contenedor <main> donde van las secciones */
    montar:function(nombre){
      document.body.insertAdjacentHTML("afterbegin",CAB+
        '<main id="m6"><section class="hero6" id="hero6"><canvas id="cv6" aria-hidden="true"></canvas>'+
        '<div class="h6t" id="h6t"><h1 class="t">'+S.TITULO+'</h1></div>'+
        '<div class="h6d" id="h6d" aria-hidden="true">Desplace<i></i></div></section></main>');
      /* el prisma va en el centro de la pantalla; «Desplace», centrado debajo, a la misma distancia del gráfico y de «Laboratorivm» */
      var d=document.getElementById("h6d"),mp=function(){return Math.min(80,Math.max(44,innerWidth*.06));};
      function banda(W,H){return Math.max(40,Math.min(H*.115,H*.5-110));}
      function colocar(){var H=document.getElementById("hero6").offsetHeight,W=innerWidth,fondo=H*.5+banda(W,H);
        d.style.top=((fondo+H+mp())/2-d.offsetHeight/2)+"px";}
      var pr=IVSPrisma(document.getElementById("cv6"),{px:.5,cy:.5,rotulo:"UNA CONSULTA",
        band:function(W,H){var h=banda(W,H);return [.5-h/H,.5+h/H];},
        out:function(P,w,h){return [[w,P.y]];}});
      colocar();addEventListener("resize",colocar);
      if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){pr.medir();colocar();});
      return document.getElementById("m6");
    },
    /* el cierre común: las seis bases, la advertencia y la llamada a la acción */
    cierre:function(host){
      var s=document.createElement("section");s.className="cierre";
      s.innerHTML='<div class="bs">'+BASES.map(function(b){return '<span style="--c:var('+b[1]+')"><i></i>'+b[0]+'</span>';}).join("")+'</div>'+
        '<p class="adv">Verifique siempre <em>en la fuente</em> antes de citar.</p>'+
        '<p class="sub">La ausencia de coincidencias no demuestra la falsedad del fallo, ya que puede responder a faltas de indexación o carátulas alternativas; asimismo, la confirmación de existencia del expediente no garantiza la veracidad del criterio atribuido.</p>'+
        S.BOTONES+'<div class="marcaf marca-g" aria-label="IVS CODEX">I<span class="v">V</span>S<span class="d"></span>CODE<span class="v">X</span></div>';
      host.appendChild(s);return s;
    },
    PRINC:[["FONS","La fuente","Todo resultado remite al documento del organismo que lo dictó. Lo que se lee nunca es una versión propia."],
           ["ORDO","El orden","Los resultados de las seis bases se presentan juntos, con la misma forma y la procedencia a la vista."],
           ["FIDES","La fe","Una cita se contrasta con la base oficial antes de presentarse. Ante su ausencia, el antecedente se presume inexistente."]]
  };
})();
