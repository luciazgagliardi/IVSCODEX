/* v6 · Pieza común: el héroe del prisma (idéntico al de la versión 4) y el cierre. */
(function(){
  var S=IVS4;
  var BASES=[["SCJM","--c-mza"],["MZA LEGAL","--c-mzl"],["TSJ","--c-caba"],["CSJN","--c-csjn"],["SAIJ","--c-saij"],["DIALNET","--c-dial"]];
  var CAB='<header class="cab"><span class="marca">I<span class="v">V</span>S<span class="d"></span>CODE<span class="v">X</span></span><nav><a href="#" data-tab="buscar">Consulta</a><a href="#" data-tab="fuentes">Fuentes</a><a href="#" data-tab="verificar">Verificación</a><a href="#" data-tab="cuenta">Cuenta</a></nav><a class="btn" href="#" data-tab="buscar">Iniciar la consulta</a></header>';
  window.IVS6={
    BASES:BASES,
    /* monta la cabecera, el héroe del prisma y devuelve el contenedor <main> donde van las secciones */
    montar:function(nombre){
      document.body.insertAdjacentHTML("afterbegin",CAB+
        '<main id="m6"><section class="hero6" id="hero6"><canvas id="cv6" aria-hidden="true"></canvas>'+
        '<div class="h6t" id="h6t"><h1 class="t">'+S.TITULO+'</h1>'+S.BOTONES+'</div></section></main>');
      /* el prisma queda centrado en el espacio libre: debajo de los botones y encima de «Desplace» */
      var hero=document.getElementById("hero6"),tit=document.getElementById("h6t");
      function libre(W,H){var y1=tit.offsetTop+tit.offsetHeight+Math.max(40,H*.06),y2=H-Math.max(96,H*.11);return [y1,y2];}
      var pr=IVSPrisma(document.getElementById("cv6"),{px:.5,
        cy:function(W,H){var g=libre(W,H);return (g[0]+g[1])/2/H;},
        band:function(W,H){var g=libre(W,H),c=(g[0]+g[1])/2,half=Math.max(40,Math.min(H*.13,(g[1]-g[0])/2-30));return [(c-half)/H,(c+half)/H];},
        out:function(P,w,h){return [[w,P.y]];}});
      if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){pr.medir();});
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
