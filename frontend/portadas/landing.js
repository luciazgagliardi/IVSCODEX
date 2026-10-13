/* Compositor de portadas: arma la página a partir de tres elecciones (data-hero, data-seg, data-add).
   PORTADA     1 centro · 2 horizonte · 3 espejo · 4 sello · 5 panorama
   RECORRIDO   1 órbita circular · 2 órbita inclinada con texto a la derecha · 3 órbita casi de canto
   AGREGADO    1 banda con radar · 2 franja con semicírculo · 3 bases sobre el aro */
(function(){
  var d=document.body.dataset,HER=d.hero||"1",SEG=d.seg||"1",ADD=d.add||"1",NUM=d.n||"";
  var TIT='Buscador integrado de repositorios judiciales oficiales y <em>doctrina.</em>';
  var CTA='<a class="btn" href="#">Iniciar la consulta</a><a class="btn sec" href="#">Ver el catálogo de fuentes</a>';
  var COL={mza:"#d9a62a",mzl:"#b58640",tsj:"#d5873f",csjn:"#c95836",saij:"#b03b42",dial:"#a04a68"};
  var NAMES={"1":"centro","2":"horizonte","3":"espejo","4":"sello","5":"panorama"};
  var SEGN={"1":"órbita","2":"órbita inclinada","3":"órbita de canto"},ADDN={"1":"banda","2":"franja","3":"bases en el aro"};

  var cab='<header class="cab"><span class="marca">I<span class="v">V</span>S<span class="d"></span>CODE<span class="v">X</span></span><nav><a href="#">Consulta</a><a href="#">Fuentes</a><a href="#">Verificación</a><a href="#">Cuenta</a></nav><a class="btn" href="#">Iniciar la consulta</a></header>';
  var letras="IVS·CODEX".split("").map(function(c,i){
    if(c==="·") return '<span class="d" style="width:.17em;height:.17em;margin:0 .09em 0 .066em;border-radius:50%;background:linear-gradient(170deg,#f0c75a,#d9a31b 50%,#a77a0c);vertical-align:.24em"></span>';
    var v=(c==="V"||c==="X")?' class="v"':''; return '<span'+v+' style="--k:'+i+'">'+c+'</span>';
  }).join("");

  function hero(){
    if(HER==="1") return '<section class="hero h1"><div class="rad" id="rad-h"></div><div class="t"><h1>'+TIT+'</h1></div><div class="a">'+CTA+'</div></section>';
    if(HER==="2") return '<section class="hero h2"><h1 class="nombre marca-g" aria-label="IVS CODEX">'+letras+'</h1><p class="lema">Buscador integrado de repositorios judiciales oficiales y <em>doctrina.</em></p><div class="acc">'+CTA+'</div><div class="rad hor" id="rad-h"></div></section>';
    if(HER==="3") return '<section class="hero h3"><div class="t"><h1>'+TIT+'</h1><div class="acc">'+CTA+'</div><div class="bs"><span style="--c:'+COL.mza+'"><i></i>MZA</span><span style="--c:'+COL.mzl+'"><i></i>MZA LEGAL</span><span style="--c:'+COL.tsj+'"><i></i>TSJ</span><span style="--c:'+COL.csjn+'"><i></i>CSJN</span><span style="--c:'+COL.saij+'"><i></i>SAIJ</span><span style="--c:'+COL.dial+'"><i></i>DIALNET</span></div></div><div class="rad" id="rad-h"></div></section>';
    if(HER==="4"){
      var ley="IVS · CODEX · IVRISPRVDENTIA · LEGISLATIO · DOCTRINA · ",rT=452;
      return '<section class="hero h4"><div class="sello"><svg viewBox="0 0 1000 1000" aria-hidden="true"><defs><path id="aro-t" d="M500 '+(500-rT)+'a'+rT+' '+rT+' 0 1 1 0 '+(2*rT)+'a'+rT+' '+rT+' 0 1 1 0 '+(-2*rT)+'"/></defs>'+
        '<g class="giro"><text class="sg-texto"><textPath href="#aro-t" textLength="'+(2*Math.PI*rT-12).toFixed(0)+'" lengthAdjust="spacing">'+ley+ley+'</textPath></text></g>'+
        '<circle class="sg-aro" cx="500" cy="500" r="496"/></svg><div class="rad" id="rad-h" style="position:absolute"></div></div>'+
        '<div class="t"><h1>'+TIT+'</h1></div><div class="a">'+CTA+'</div></section>';
    }
    return '<section class="hero h5"><h1>'+TIT+'</h1><div class="acc">'+CTA+'</div><div class="rad hor" id="rad-h"></div></section>';
  }
  function seg(){ return '<section class="seg"><div class="pista" id="pista"></div></section>'; }
  function add(){
    if(ADD==="1") return '<section class="add a1"><div class="at"><p class="ey">El radar</p><h2>Recorre las seis bases y deja a la vista lo que encuentra.</h2><p class="par">Cada fallo se descubre cuando el haz lo cruza: el título, el año, los autos y el tribunal, con el enlace al documento oficial.</p><div class="acc"><a class="btn" href="#">Iniciar la consulta</a></div></div><div class="rad" id="rad-a"></div></section>';
    if(ADD==="2") return '<section class="add a2"><p class="ey">El radar</p><h2>Seis bases, un solo barrido.</h2><div class="rad" id="rad-a"></div></section>';
    return '<section class="add a3"><div class="at"><p class="ey">Las bases</p><h2>Cada base se enciende cuando el haz pasa por ella.</h2><p class="par">Mendoza, Mendoza Legal, el Tribunal Superior de la Ciudad, la Corte Suprema, SAIJ y Dialnet: seis repositorios, una sola consulta.</p><div class="acc"><a class="btn sec" href="#">Ver el catálogo de fuentes</a></div></div><div class="rad" id="rad-a"></div></section>';
  }
  var nota='<div class="nota-muestra">Opción '+NUM+' · portada «'+NAMES[HER]+'» · recorrido «'+SEGN[SEG]+'» · agregado «'+ADDN[ADD]+'» · <a href="index.html">ver todas</a></div>';
  var pie='<footer class="pie-l"><span>Seis bases oficiales · una sola consulta</span><span>IVS EST ARS BONI ET AEQVI</span></footer>';
  document.body.insertAdjacentHTML("afterbegin",'<div class="grano" aria-hidden="true"></div>'+cab+hero()+seg()+add()+pie+nota);

  var movil=innerWidth<=760;
  // portada
  var rh=document.getElementById("rad-h");
  var ho={"1":{r:.46,n:movil?2:4},"2":{cx:.5,cy:1,r:1,n:movil?1:3},"3":{r:.46,n:movil?2:4},"4":{r:.412,n:movil?2:4},"5":{cx:.5,cy:1,r:1,n:movil?1:3}}[HER];
  ho.movil=true; IVSRadar(rh,ho);
  // recorrido
  var so={"1":{tilt:1,capPos:"abajo-izq",cx:.5},"2":{tilt:.55,capPos:"derecha",cx:.36},"3":{tilt:.24,capPos:"arriba",cx:.5,cy:.55}}[SEG];
  IVSRecorrido(document.getElementById("pista"),so);
  // agregado
  var ra=document.getElementById("rad-a");
  var ao;
  if(ADD==="1") ao={r:.46,n:movil?1:3};
  else if(ADD==="2") ao={cx:.5,cy:0,r:1,n:movil?1:3};
  else ao={r:.33,n:0,bases:[["MZA",COL.mza],["MZA LEGAL",COL.mzl],["TSJ",COL.tsj],["CSJN",COL.csjn],["SAIJ",COL.saij],["DIALNET",COL.dial]].map(function(b,i){ return {t:b[0],c:b[1],a:(-60+i*60)*Math.PI/180}; })};
  ao.movil=true; IVSRadar(ra,ao);
})();
