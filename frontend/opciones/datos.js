/* ------------------------------------------------------------------ *
   Rumbos para IVS CODEX — lo que comparten las cuatro maquetas:
   - los datos del sitio real (las seis bases integradas, las 28 ramas,
     un tramo del tesauro) y la cadena de la consulta armada igual que en
     index.html (función cadena());
   - unos resultados DE EJEMPLO, inventados, para poder mostrar cómo se ve
     una respuesta: no son fallos reales ni deben citarse;
   - los gestos de sigillvm.com: el sello dibujado, el puntero de luz,
     la aparición al entrar en pantalla y el sello de progreso.
 * ------------------------------------------------------------------ */
(function(){
"use strict";
var IC=window.IC={};
document.documentElement.classList.add("js");
/* dentro de las miniaturas de index.html (se abren con #mini): sin puntero
   ni botones flotantes */
IC.mini=location.hash==="#mini";
if(IC.mini) document.documentElement.classList.add("mini");

/* ---------- datos del sitio ---------- */
IC.BASES=[
  {slug:"mendoza",cod:"SCJM",nombre:"Poder Judicial de Mendoza",corto:"Suprema Corte de Mendoza",amb:"Mendoza",
   nota:"Fallos, autos y resoluciones de la Suprema Corte y de los tribunales provinciales, en todas las instancias y fueros."},
  {slug:"mendozalegal",cod:"MZA LEGAL",nombre:"Mendoza Legal",corto:"Mendoza Legal",amb:"Mendoza",
   nota:"Jurisprudencia provincial seleccionada, con sumarios procesales y doctrina de aplicación local."},
  {slug:"caba",cod:"TSJ",nombre:"Tribunal Superior de Justicia de la Ciudad de Buenos Aires",corto:"TSJ de la Ciudad",amb:"Otras provincias",
   nota:"Sentencias del máximo tribunal porteño: contencioso-administrativo, tributario, penal, contravencional y electoral."},
  {slug:"csjn",cod:"CSJN",nombre:"Corte Suprema de Justicia de la Nación",corto:"Corte Suprema",amb:"Nacional y federal",
   nota:"Los fallos de la Corte con carátula, fecha y enlace al documento, a través de SAIJ."},
  {slug:"saij",cod:"SAIJ",nombre:"SAIJ · Ministerio de Justicia de la Nación",corto:"SAIJ",amb:"Nacional y federal",
   nota:"Jurisprudencia, legislación y doctrina de fueros federales, nacionales y provinciales de todo el país."},
  {slug:"dialnet",cod:"DIALNET",nombre:"Dialnet · doctrina jurídica en español",corto:"Dialnet",amb:"Doctrina y editoriales",
   nota:"Repositorio académico de la Universidad de La Rioja: artículos de doctrina y revistas especializadas en español."}
];
IC.AMBITOS=["Mendoza","Nacional y federal","Otras provincias","Internacional","Doctrina y editoriales"];
IC.MODOS=[["exacta","Frase exacta"],["todas","Todas las palabras"],["alguna","Alguna palabra"]];
IC.RAMAS=["Obligaciones y contratos","Daños y responsabilidad civil","Derechos reales","Familia","Sucesiones",
  "Derecho del consumidor","Comercial y societario","Concursos y quiebras","Seguros","Laboral individual",
  "Colectivo del trabajo","Riesgos del trabajo","Previsional y seguridad social","Penal — general y especial",
  "Procesal penal y garantías","Ejecución penal","Administrativo","Tributario","Constitucional y amparo",
  "Derechos humanos","Ambiental","Aguas, minería y territorio","Procesal civil (Mendoza)","Internacional privado",
  "Propiedad intelectual y datos","Género y violencia","Niñez y adolescencia","Electoral y partidos"];
/* Un tramo real del tesauro de sinonimia de index.html. */
IC.TESAURO={
  "daño moral":["daño extrapatrimonial","consecuencias no patrimoniales","agravio moral"],
  "prescripción adquisitiva":["usucapión","usucapión veinteañal","prescripción veinteañal"],
  "arbitrariedad de sentencia":["sentencia arbitraria","doctrina de la arbitrariedad"],
  "indemnización por despido":["indemnización por antigüedad","indemnización art. 245"],
  "trabajo no registrado":["empleo no registrado","relación laboral no registrada"],
  "mala praxis médica":["responsabilidad médica","praxis médica"],
  "cuota alimentaria":["obligación alimentaria","prestación alimentaria"],
  "daño punitivo":["multa civil","sanción pecuniaria disuasiva"],
  "régimen de comunicación":["régimen de visitas","derecho de comunicación"],
  "despido indirecto":["autodespido"],
  "pérdida de chance":["pérdida de oportunidad","chance frustrada"],
  "accidente de tránsito":["siniestro vial","accidente de tránsito automotor"]
};
/* Voces del vocabulario, para el índice alfabético. */
IC.VOCES=["accidente de tránsito","accidente in itinere","acción reivindicatoria","adopción plena","agotamiento de la vía administrativa",
  "alimentos provisorios","amparo de salud","arbitrariedad de sentencia","atribución del hogar","autonomía progresiva",
  "beneficio de litigar sin gastos","boleto de compraventa","buena fe contractual","cadena de custodia","caducidad de instancia",
  "cláusulas abusivas","colación","compensación económica","concurso real e ideal","consecuencias no patrimoniales","cuidado personal compartido",
  "cuota alimentaria","daño moral","daño punitivo","declaratoria de herederos","deber de información","desalojo por falta de pago",
  "despido discriminatorio","despido indirecto","determinación de oficio","dolo eventual","doble conforme","empleo público estabilidad",
  "enfermedad profesional","estado de necesidad","excepción de incompetencia","expensas comunes","fórmula Acciarri","garantía legal",
  "hábeas corpus correctivo","impugnación de asamblea","in dubio pro consumidor","in dubio pro reo","incapacidad sobreviniente",
  "incumplimiento contractual","indemnización por despido","injuria laboral","interés superior del niño","intereses moratorios",
  "juicio abreviado","juicio por jurados","legítima defensa","legítima hereditaria","libertad condicional","mala praxis médica",
  "medida cautelar contra el Estado","medianería","mora automática","nulidad del acto administrativo","pacto comisorio",
  "pérdida de chance","plazo razonable del proceso","prescripción adquisitiva","prisión preventiva","propiedad horizontal",
  "pronto pago laboral","quiebra","reajuste de haberes","régimen de comunicación","relación de causalidad","relación de consumo",
  "responsabilidad del Estado","riesgo de la cosa","seña","servidumbre de paso","silencio de la administración",
  "solidaridad art. 30","suspensión del juicio a prueba","teoría de la imprevisión","testamento ológrafo","trabajo no registrado",
  "trato digno","tutela sindical","unión convivencial","usucapión","valor vida","verificación de créditos","violencia de género"];

/* ---------- resultados de ejemplo (inventados) ---------- */
IC.EJEMPLO={
  mendoza:{total:48,items:[
    {car:"Fernández, María Laura c/ Banco Andino S.A. p/ daños y perjuicios",trib:"Suprema Corte · Sala Primera",fecha:"14/03/2024",expte:"13-04512873-6",
     pasaje:"Corresponde reconocer el daño moral derivado del incumplimiento contractual cuando la conducta del deudor excede la mera frustración del negocio y alcanza la esfera íntima del acreedor."},
    {car:"Sosa, Juan Carlos c/ Constructora del Valle S.R.L. p/ resolución contractual",trib:"Suprema Corte · Sala Segunda",fecha:"02/11/2023",expte:"13-03988120-1",
     pasaje:"El daño moral en materia contractual se aprecia con criterio restrictivo, pero no puede negarse cuando el incumplimiento recae sobre la vivienda familiar."}]},
  mendozalegal:{total:7,items:[
    {car:"Quiroga, Ana Beatriz c/ Obra Social Provincial p/ amparo",trib:"Cámara Civil · Primera",fecha:"21/06/2022",expte:"55.871",
     pasaje:"La negativa injustificada de cobertura genera consecuencias no patrimoniales que deben indemnizarse aun sin prueba directa del padecimiento."}]},
  caba:{total:12,items:[
    {car:"Gómez, Rodolfo Néstor c/ GCBA s/ daños y perjuicios",trib:"TSJ · Contencioso Administrativo y Tributario",fecha:"09/08/2023",expte:"QTS 18.442/2022",
     pasaje:"La indemnización de las consecuencias no patrimoniales debe fijarse atendiendo a las satisfacciones sustitutivas y compensatorias que pueda procurar la suma reconocida."}]},
  csjn:{total:9,items:[
    {car:"Rinaldi, Estela c/ Transportes del Oeste S.A. s/ accidente",trib:"Corte Suprema",fecha:"17/05/2022",expte:"CIV 2210/2019",
     pasaje:"La reparación del daño moral debe ser integral y comprender todas las consecuencias no patrimoniales del hecho, sin sujeción a tarifas."}]},
  saij:{total:31,items:[
    {car:"Daño moral — cuantificación — satisfacciones sustitutivas",trib:"Sumario · Cámara Nacional Civil",fecha:"03/04/2023",expte:"Sumario A0087321",
     pasaje:"El monto del resarcimiento por daño moral debe atender a las satisfacciones sustitutivas y compensatorias que pueda procurar la suma reconocida (art. 1741 CCyC)."}]},
  dialnet:{total:14,items:[
    {car:"La cuantificación del daño moral tras el Código Civil y Comercial",trib:"Artículo · Revista de Responsabilidad Civil",fecha:"2021",expte:"M. Pereyra",
     pasaje:"El nuevo régimen desplaza la discusión hacia los criterios de cuantificación y obliga a explicitar la satisfacción que el monto pretende procurar."}]}
};

/* ---------- la consulta, igual que cadena() en index.html ---------- */
IC.palabras=function(s){ return String(s||"").trim().split(/\s+/).filter(Boolean); };
IC.cadena=function(q,modo,excluir){
  q=String(q||"").trim(); if(!q) return "";
  var out;
  if(modo==="exacta") out='"'+q.replace(/"/g,"")+'"';
  else if(modo==="alguna") out=IC.palabras(q).join(" OR ");
  else out=IC.palabras(q).join(" ");
  IC.palabras(excluir).forEach(function(w){ out+=" -"+w.replace(/"/g,""); });
  return out;
};
IC.equivalentes=function(q){
  var k=String(q||"").trim().toLowerCase();
  if(IC.TESAURO[k]) return IC.TESAURO[k];
  for(var c in IC.TESAURO){ if(IC.TESAURO[c].indexOf(k)!==-1) return [c].concat(IC.TESAURO[c].filter(function(x){return x!==k;})); }
  return [];
};
IC.esc=function(s){ return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); };
/* Marca en el texto las palabras de la consulta y sus equivalentes. */
IC.resaltar=function(texto,q){
  var t=IC.esc(texto), terms=[String(q||"").trim()].concat(IC.equivalentes(q)).filter(function(x){return x.length>2;});
  terms.forEach(function(w){
    var re=new RegExp("("+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");
    t=t.replace(re,"<mark>$1</mark>");
  });
  return t;
};

/* ---------- el sello ---------- */
/* Un PRNG con semilla: el sello sale siempre igual. */
function azar(s){ return function(){ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }
/* Los renglones de un códice, recortados por un círculo de radio R
   centrado en (c,c), con el punto del logo al final del último párrafo. */
IC.renglones=function(c,R,paso,semilla){
  var rnd=azar(semilla||7),y=c-R+paso*1.2,i=0,par=5+Math.floor(rnd()*4),sangria=false,out=[],ult=null;
  while(y<c+R-paso*.8){
    var h=Math.sqrt(Math.max(R*R-(y-c)*(y-c),0)),x0=c-h+4,x1=c+h-4;
    if(x1-x0<60){ y+=paso; continue; }
    var ini=x0+(sangria?paso*1.5:0),fin=x1; par--;
    if(par===0) fin=ini+(x1-ini)*(.35+rnd()*.35);
    var segs=[],x=ini;
    while(x<fin-12){
      var r=rnd(),w=r<.33?10+rnd()*24:(r<.66?28+rnd()*42:50+rnd()*46),e=Math.min(x+w,fin);
      if(e-x>5) segs.push([x,e]);
      x=e+6.5+rnd()*3;
    }
    if(segs.length){
      out.push('<path style="--i:'+i+'" pathLength="1" d="'+segs.map(function(s){return "M"+s[0].toFixed(1)+" "+y.toFixed(1)+"H"+s[1].toFixed(1);}).join("")+'"/>');
      ult=[segs[segs.length-1][1],y]; i++;
    }
    sangria=false;
    if(par===0){ par=5+Math.floor(rnd()*5); sangria=true; y+=paso*1.6; } else y+=paso;
  }
  return {paths:out.join(""),fin:ult};
};
/* El sello completo: aro con leyenda que gira, aro interior y la página.
   o.leyenda: el texto del aro; o.lineas: con renglones o no. */
IC.sello=function(svg,o){
  o=o||{};
  var c=500,ley=o.leyenda||"IVS · CODEX · IVRISPRVDENTIA · LEGISLATIO · DOCTRINA · ",
      rT=452,circ=2*Math.PI*rT,html="";
  html+='<defs><path id="sg-p-'+(o.id||"a")+'" d="M'+c+' '+(c-rT)+'a'+rT+' '+rT+' 0 1 1 0 '+(2*rT)+'a'+rT+' '+rT+' 0 1 1 0 '+(-2*rT)+'"/></defs>';
  html+='<circle class="sg-aro" cx="500" cy="500" r="496" stroke-width="1" opacity=".5"/>';
  if(o.texto!==false) html+='<g class="gira"><text class="sg-texto" font-size="33" letter-spacing="9" opacity=".75"><textPath href="#sg-p-'+(o.id||"a")+'" textLength="'+(circ-12).toFixed(0)+'" lengthAdjust="spacing">'+ley+ley+'</textPath></text></g>';
  html+='<circle class="sg-aro" cx="500" cy="500" r="412" stroke-width="1" opacity=".5"/>';
  if(o.lineas!==false){
    var r=IC.renglones(c,372,o.paso||19,o.semilla||7);
    html+='<g class="sg-renglones" stroke-width="'+(o.grosor||1.6)+'" opacity="'+(o.opacidad||.5)+'">'+r.paths+'</g>';
    if(r.fin) html+='<circle class="sg-punto" cx="'+(r.fin[0]+15).toFixed(1)+'" cy="'+r.fin[1].toFixed(1)+'" r="7.5"/>';
  }
  svg.setAttribute("viewBox","0 0 1000 1000");
  svg.classList.add("sello");
  svg.innerHTML=html;
};

/* ---------- el puntero de luz ---------- */
IC.cursor=function(){
  if(IC.mini) return;
  if(!matchMedia("(pointer:fine)").matches||matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  var c=document.createElement("div");
  c.className="cursor";c.setAttribute("aria-hidden","true");
  c.innerHTML='<div class="cursor__light"></div><div class="cursor__ring"></div><div class="cursor__dot"></div>';
  document.body.appendChild(c);document.documentElement.classList.add("has-cursor");
  var d=c.querySelector(".cursor__dot"),r=c.querySelector(".cursor__ring"),l=c.querySelector(".cursor__light");
  var x=-100,y=-100,rx=x,ry=y,lx=x,ly=y;
  addEventListener("mousemove",function(e){
    x=e.clientX;y=e.clientY;c.classList.add("is-on");
    var t=e.target;
    c.classList.toggle("is-text",!!(t.closest&&t.closest("input,textarea,[contenteditable]")));
    c.classList.toggle("is-link",!!(t.closest&&t.closest("a,button,label,[data-link],select")));
  },{passive:true});
  addEventListener("mousedown",function(){c.classList.add("is-down");});
  addEventListener("mouseup",function(){c.classList.remove("is-down");});
  document.addEventListener("mouseleave",function(){c.classList.remove("is-on");});
  (function tic(){
    rx+=(x-rx)*.2;ry+=(y-ry)*.2;lx+=(x-lx)*.08;ly+=(y-ly)*.08;
    d.style.transform="translate("+x+"px,"+y+"px)";
    r.style.transform="translate("+rx+"px,"+ry+"px)";
    l.style.transform="translate("+lx+"px,"+ly+"px)";
    requestAnimationFrame(tic);
  })();
};

/* ---------- aparecer al entrar en pantalla ---------- */
IC.revelar=function(raiz){
  var els=(raiz||document).querySelectorAll("[data-reveal]:not(.is-in)");
  if(!("IntersectionObserver" in window)){ els.forEach(function(e){e.classList.add("is-in");}); return; }
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("is-in"); io.unobserve(e.target); } });
  },{rootMargin:"0px 0px -8% 0px"});
  els.forEach(function(e){io.observe(e);});
};

/* ---------- el sello de progreso en la esquina ---------- */
IC.progreso=function(){
  var b=document.createElement("button");
  b.className="toplink";b.setAttribute("aria-label","Volver arriba");
  b.innerHTML='<svg viewBox="0 0 52 52"><circle class="toplink__track" cx="26" cy="26" r="24"/><circle class="toplink__bar" cx="26" cy="26" r="24" pathLength="1"/><circle class="toplink__dot" cx="26" cy="26" r="3"/></svg>';
  b.onclick=function(){ scrollTo({top:0,behavior:"smooth"}); };
  document.body.appendChild(b);
  function f(){
    var h=document.documentElement.scrollHeight-innerHeight,p=h>0?scrollY/h:0;
    b.style.setProperty("--p",String(1-p));
    b.classList.toggle("is-on",scrollY>innerHeight*.6);
  }
  addEventListener("scroll",f,{passive:true});f();
};

/* ---------- volver al índice de rumbos ---------- */
IC.volver=function(letra){
  var a=document.createElement("a");
  a.className="volver";a.href="./index.html";
  a.innerHTML='<b>'+letra+'</b> Volver a los rumbos';
  document.body.appendChild(a);
};
})();

/* ---------- datos de ejemplo para las opciones: un conjunto más grande, generado
   con semilla para que salga siempre igual. NO son fallos reales. ---------- */
(function(){
  var rnd=(function(s){return function(){s=(s*16807)%2147483647;return (s-1)/2147483646;};})(20261007);
  var AP=["Fernández","Sosa","Gómez","Quiroga","Rinaldi","Ortiz","Morales","Benítez","Aguirre","Paredes","Molina","Cabrera","Herrera","Suárez","Navarro","Ledesma","Barrios","Funes","Videla","Godoy"];
  var NO=["María Laura","Juan Carlos","Ana Beatriz","Rodolfo Néstor","Estela","Luis Alberto","Carolina","Marcelo","Silvia","Pablo"];
  var EM=["Banco Andino S.A.","Constructora del Valle S.R.L.","Obra Social Provincial","Transportes del Oeste S.A.","Seguros Cuyo S.A.","Municipalidad de Godoy Cruz","Provincia de Mendoza","Telefonía del Plata S.A.","Clínica San Martín S.A.","Aguas del Sur S.A."];
  var OBJ=["daños y perjuicios","amparo","despido","cobro de pesos","resolución contractual","accidente de tránsito","incumplimiento de contrato","nulidad de acto administrativo"];
  var TRIB={mendoza:["Suprema Corte · Sala Primera","Suprema Corte · Sala Segunda","Suprema Corte · Sala Tercera"],mendozalegal:["Cámara Civil · Primera","Cámara del Trabajo · Segunda","Cámara Civil · Cuarta"],
    caba:["TSJ · Contencioso Administrativo y Tributario","TSJ · Asuntos Originarios"],csjn:["Corte Suprema"],saij:["Sumario · Cámara Nacional Civil","Sumario · Cámara Nacional del Trabajo"],dialnet:["Artículo · Revista de Responsabilidad Civil","Artículo · La Ley"]};
  var PAS=["Corresponde reconocer el daño moral cuando la conducta del deudor excede la mera frustración del negocio y alcanza la esfera íntima del acreedor.",
    "La reparación debe ser integral y comprender todas las consecuencias no patrimoniales del hecho, atendiendo a las satisfacciones sustitutivas y compensatorias.",
    "El daño moral en materia contractual se aprecia con criterio restrictivo, pero no puede negarse cuando el incumplimiento recae sobre la vivienda familiar.",
    "La negativa injustificada de cobertura genera consecuencias no patrimoniales que deben indemnizarse aun sin prueba directa del padecimiento.",
    "El monto debe fijarse ponderando las satisfacciones sustitutivas y compensatorias que pueden procurar las sumas reconocidas (art. 1741 CCyC)."];
  var pesos={mendoza:9,mendozalegal:4,caba:4,csjn:3,saij:8,dialnet:5};
  var out=[];
  Object.keys(pesos).forEach(function(b){
    for(var i=0;i<pesos[b]*2;i++){
      var y=2008+Math.floor(Math.pow(rnd(),.62)*19),m=1+Math.floor(rnd()*12),d=1+Math.floor(rnd()*27);
      var t=TRIB[b],tr=t[Math.floor(rnd()*t.length)];
      out.push({base:b,anio:y,fecha:(d<10?"0":"")+d+"/"+(m<10?"0":"")+m+"/"+y,
        car:AP[Math.floor(rnd()*AP.length)]+", "+NO[Math.floor(rnd()*NO.length)]+" c/ "+EM[Math.floor(rnd()*EM.length)]+" p/ "+OBJ[Math.floor(rnd()*OBJ.length)],
        trib:tr,expte:(b==="csjn"?"CIV ":"13-0")+(1000000+Math.floor(rnd()*8999999))+(b==="csjn"?"/"+y:"-"+Math.floor(rnd()*9)+"/1"),
        pasaje:PAS[Math.floor(rnd()*PAS.length)],rel:Math.round(40+rnd()*60)});
    }
  });
  IC.TODOS=out.sort(function(a,b){return b.anio-a.anio||b.rel-a.rel;});
})();
