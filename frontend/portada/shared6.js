/* v6 · Pieza común: el héroe del prisma (idéntico al de la versión 4) y el cierre. */
(function(){
  var S=IVS4;
  var BASES=[["SCJM","--c-mza"],["MZA LEGAL","--c-mzl"],["TSJ","--c-caba"],["SCBA","--c-scba"],["CSJN","--c-csjn"],["SAIJ","--c-saij"],["DIALNET","--c-dial"],["CORTE IDH","--c-idh"]];
  var CAB='<header class="cab"><span class="lock"><span class="marca2"><b>IVS</b><i class="m-pt"></i><span>CODEX</span></span></span><div class="acts"><span class="tema-seg" role="group" aria-label="Colores del sitio"><button type="button" class="tema-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Colores del sitio" title="Colores"></button><span class="tema-pop" role="menu"><button type="button" class="tema-op" style="--i:0" role="menuitemradio" data-tema-op="oscuro" aria-label="Noche" aria-pressed="false"><svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M16.2 12.3A6.7 6.7 0 0 1 7.7 3.8a6.7 6.7 0 1 0 8.5 8.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><em>Noche</em></button><button type="button" class="tema-op" style="--i:1" role="menuitemradio" data-tema-op="claro" aria-label="Día" aria-pressed="false"><svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><em>Día</em></button><button type="button" class="tema-op" style="--i:2" role="menuitemradio" data-tema-op="descanso" aria-label="Descanso" aria-pressed="false"><i class="sw" style="--a:#2e231b;--b:#d4a04a"></i><em>Descanso</em></button><button type="button" class="tema-op" style="--i:3" role="menuitemradio" data-tema-op="azul" aria-label="Azul" aria-pressed="false"><i class="sw" style="--a:#161c27;--b:#d4a94a"></i><em>Azul</em></button><button type="button" class="tema-op" style="--i:4" role="menuitemradio" data-tema-op="verde" aria-label="Verde" aria-pressed="false"><i class="sw" style="--a:#14211d;--b:#cfae6a"></i><em>Verde</em></button><button type="button" class="tema-op" style="--i:5" role="menuitemradio" data-tema-op="bordo" aria-label="Bordeaux" aria-pressed="false"><i class="sw" style="--a:#34101b;--b:#dcb26c"></i><em>Bordeaux</em></button></span></span><a class="btn sec" href="#" data-tab="fuentes">Ver el catálogo de fuentes</a><a class="btn" href="#" data-tab="buscar">Iniciar la consulta</a></div></header>';
  window.IVS6={
    BASES:BASES,
    /* monta la cabecera, el héroe del prisma y devuelve el contenedor <main> donde van las secciones */
    montar:function(nombre){
      document.body.insertAdjacentHTML("afterbegin",'<div class="luces" aria-hidden="true"><i></i><i></i><i></i></div><div class="grano" aria-hidden="true"></div>'+CAB+
        '<main id="m6"><section class="hero6" id="hero6"><canvas id="cv6" aria-hidden="true"></canvas>'+
        '<div class="h6t" id="h6t"><h1 class="t t-sw"><span class="sw a">'+S.TITULO+'</span><span class="sw b" aria-hidden="true">Más de 800.000 <em>fallos y sumarios.</em></span><span class="sw c" aria-hidden="true"><em>11 bases oficiales.</em></span><span class="sw d" aria-hidden="true">Mendoza, la Nación y <em>todo el país.</em></span></h1></div>'+
        '<div class="h6d" id="h6d" aria-hidden="true">Desplace<i></i></div></section></main>');
      /* el prisma va en el centro de la pantalla; «Desplace», centrado debajo, a la misma distancia del gráfico y de «Laboratorivm» */
      var d=document.getElementById("h6d"),mp=function(){return Math.min(120,Math.max(60,innerWidth*.09));};
      function banda(W,H){return Math.max(40,Math.min(H*.13,H*.5-110));}
      function colocar(){var H=document.getElementById("hero6").offsetHeight,W=innerWidth,fondo=H*.5+banda(W,H),sube=H*.27;   /* la sección siguiente sube un 27 % para acortar el espacio */
        d.style.top=((fondo+H+mp()-sube)/2-d.offsetHeight/2)+"px";}
      /* celular: sin las líneas amarilla y celeste del costado izquierdo, y el prisma a la misma distancia del título y de «Desplace»
         (se mide el triángulo entero, que sube s sobre el centro y baja s/2 por debajo) */
      var cel=function(W){return W<=760;},t6=document.getElementById("h6t");
      function cyCel(W,H){
        if(!cel(W)) return .5;
        var s=Math.min(W,H)*.1,arriba=t6.offsetTop+t6.offsetHeight,abajo=d.offsetTop;
        return Math.max(.2,Math.min(.7,((arriba+abajo)/2+s*.25)/H));
      }
      var pr=IVSPrisma(document.getElementById("cv6"),{px:.5,cy:cyCel,sobrio:true,sinHaces:cel,
        band:function(W,H){var h=banda(W,H),c=cyCel(W,H);return [c-h/H,c+h/H];},   /* las entradas se reparten alrededor del prisma, no del centro de la pantalla */
        out:function(P,w,h){return [[w,P.y]];}});
      colocar();pr.medir();addEventListener("resize",function(){colocar();pr.medir();});
      /* el fondo (claro u oscuro) es el mismo que el de la aplicación: se guarda en «ivs-tema» */
      var ops=[].slice.call(document.querySelectorAll(".tema-op"));
      var btn=document.querySelector(".tema-btn"),pop=document.querySelector(".tema-pop");
      function abre(si){ if(!pop||!btn) return; if(si){ var sr=btn.parentNode.getBoundingClientRect(),w=pop.offsetWidth; pop.style.left=""; pop.style.right=""; pop.style.transformOrigin=""; if(sr.right-w<8){ var o=sr.left+w-(innerWidth-8); pop.style.left=(o>0?-o:0)+"px"; pop.style.right="auto"; pop.style.transformOrigin="top left"; } pop.classList.add("abre"); } else { pop.classList.remove("abre"); } btn.setAttribute("aria-expanded",String(!!si)); }
      function icono(t){ var o=ops.filter(function(x){ return x.getAttribute("data-tema-op")===t; })[0]; if(!o||!btn) return; var i=o.querySelector("svg,.sw"); btn.innerHTML=i?i.outerHTML:""; btn.title="Colores: "+o.getAttribute("aria-label"); }
      if(btn){
        btn.addEventListener("click",function(e){ e.stopPropagation(); abre(!pop.classList.contains("abre")); });
        document.addEventListener("click",function(e){ if(pop&&pop.classList.contains("abre")&&!pop.contains(e.target)) abre(false); });
        document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&pop&&pop.classList.contains("abre")){ abre(false); btn.focus(); } });
      }
      var TEMAS={claro:1,azul:1,verde:1,bordo:1,descanso:1};
      function pon(t){
        if(!TEMAS[t]) t="oscuro";
        var r=document.documentElement;
        if(t!=="oscuro") r.setAttribute("data-tema",t); else r.removeAttribute("data-tema");
        ops.forEach(function(op){ op.setAttribute("aria-pressed",String(op.getAttribute("data-tema-op")===t)); });
        icono(t);
      }
      pon(document.documentElement.getAttribute("data-tema"));
      ops.forEach(function(op){ op.addEventListener("click",function(){ var t=op.getAttribute("data-tema-op"); pon(t); try{ localStorage.setItem("ivs-tema",t); }catch(e){} abre(false); }); });
      addEventListener("storage",function(e){ if(e.key==="ivs-tema") pon(e.newValue); });
      window.IVS6.ponTema=pon;
      if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){colocar();pr.medir();});
      addEventListener("load",function(){colocar();pr.medir();});
      return document.getElementById("m6");
    },
    /* el cierre común: las ocho bases, la advertencia y la llamada a la acción */
    cierre:function(host){
      var s=document.createElement("section");s.className="cierre";
      s.innerHTML='<div class="bs">'+BASES.map(function(b){return '<span style="--c:var('+b[1]+')"><i></i>'+b[0]+'</span>';}).join("")+'</div>'+
        '<p class="adv">Verifique siempre <em>en la fuente</em> antes de citar.</p>'+
        '<p class="sub">La ausencia de coincidencias no prueba falsedad, asimismo, la confirmación de existencia del expediente no garantiza la veracidad del criterio atribuido. Verifique siempre los considerandos.</p>'+
        S.BOTONES+'<div class="marcaf marca-g" aria-label="IVS CODEX">I<span class="v">V</span>S<span class="d"></span>CODE<span class="v">X</span></div>';
      host.appendChild(s);return s;
    },
    PRINC:[["FONS","La fuente","Todo resultado remite al documento del organismo que lo dictó. Lo que se lee nunca es una versión propia."],
           ["ORDO","El orden","Los resultados de las once bases se presentan juntos, con la misma forma y la procedencia a la vista."],
           ["FIDES","La fe","Una cita se contrasta con la base oficial antes de presentarse. Ante su ausencia, el antecedente se presume inexistente."]]
  };
})();
