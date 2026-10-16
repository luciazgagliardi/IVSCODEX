/* v6 · Pieza común: el héroe del prisma (idéntico al de la versión 4) y el cierre. */
(function(){
  var S=IVS4;
  var BASES=[["MZA","--c-mza"],["MZA LEGAL","--c-mzl"],["TSJ","--c-caba"],["CSJN","--c-csjn"],["SAIJ","--c-saij"],["DIALNET","--c-dial"]];
  var CAB='<header class="cab"><span class="marca">I<span class="v">V</span>S<span class="d"></span>CODE<span class="v">X</span></span><nav><a href="#">Consulta</a><a href="#">Fuentes</a><a href="#">Verificación</a><a href="#">Cuenta</a></nav><a class="btn" href="#">Iniciar la consulta</a></header>';
  window.IVS6={
    BASES:BASES,
    /* monta la cabecera, el héroe del prisma y devuelve el contenedor <main> donde van las secciones */
    montar:function(nombre){
      document.body.insertAdjacentHTML("afterbegin",'<div class="grano" aria-hidden="true"></div>'+CAB+
        '<a class="idx6" href="index.html">← Las cinco opciones</a>'+
        '<main id="m6"><section class="hero6" id="hero6"><canvas id="cv6" aria-hidden="true"></canvas>'+
        '<div class="h6t"><h1 class="t">'+S.TITULO+'</h1></div><div class="h6b">'+S.BOTONES+'</div>'+
        '<p class="h6hint">Desplace<i></i></p></section></main>');
      IVSPrisma(document.getElementById("cv6"),{px:.54,cy:.5,band:[.38,.62],out:function(P,w,h){return [[w,P.y]];}});
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
