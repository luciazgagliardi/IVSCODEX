/* Piezas comunes: las seis ofertas con sus dibujos, el prisma (canvas) y el libro (3D). */
(function(){
  var NS="http://www.w3.org/2000/svg";
  var OFERTAS=[
    {k:"buscar",lat:"QVAESTIO",t:"Consulta",d:"Se arma con los operadores de cada buscador oficial y se envía a las siete bases a la vez.",c:"--c-mza"},
    {k:"lector",lat:"LECTIO",t:"Lector",d:"El fallo con su búsqueda destacada, los pasajes recortados y la cita preparada para copiar.",c:"--c-mzl"},
    {k:"ramas",lat:"MATERIAE",t:"Ramas y voces",d:"Los descriptores técnicos con que indexan los buscadores judiciales, ordenados por rama del derecho.",c:"--c-caba"},
    {k:"calculos",lat:"CALCVLVS",t:"Cálculos y plazos",d:"Intereses, índices, despido, incapacidad, honorarios, plazos procesales y calendario judicial.",c:"--c-csjn"},
    {k:"verificar",lat:"PROBATIO",t:"Verificación",d:"Contrasta una cita jurisprudencial con los repositorios oficiales antes de presentarla.",c:"--c-saij"},
    {k:"herramientas",lat:"INSTRVMENTA",t:"Herramientas",d:"Unir, dividir, foliar y reducir PDF dentro del navegador: los archivos no salen de su computadora.",c:"--c-dial"}
  ];
  /* dibujos de línea, simétricos o geométricos, con un solo punto dorado */
  function dibujo(tab){
    var k=0,h="",i,x,y,a;
    function l(d){ return '<path class="dl" style="--i:'+(k++)+'" pathLength="1" d="'+d+'"/>'; }
    function c(x,y,r){ return '<circle class="dl" style="--i:'+(k++)+'" pathLength="1" cx="'+x+'" cy="'+y+'" r="'+r+'"/>'; }
    function p(x,y,r){ return '<circle class="dd" cx="'+x+'" cy="'+y+'" r="'+(r||4)+'"/>'; }
    switch(tab){
    case "buscar":   // la consulta sale a las siete bases, en abanico
      for(i=0;i<7;i++){ a=(-62.5+i*125/6)*Math.PI/180; x=(120+100*Math.sin(a)).toFixed(1); y=(142-100*Math.cos(a)).toFixed(1);
        h+=c(x,y,7)+l("M120 142L"+(120+86*Math.sin(a)).toFixed(1)+" "+(142-86*Math.cos(a)).toFixed(1)); }
      h+=p(120,142,5); break;
    case "comparar": // cinco barras en pirámide
      h+=l("M30 146H210");
      [[48,34],[84,66],[120,100],[156,66],[192,34]].forEach(function(b){ h+=l("M"+b[0]+" 146V"+(146-b[1])); });
      h+=p(120,32,4.5); break;
    case "ramas":    // una voz: un círculo y tres arcos que salen de él
      h+=c(87,80,12)+l("M109.8 54.7A34 34 0 0 1 109.8 105.3")+l("M124.5 38.4A56 56 0 0 1 124.5 121.6")+l("M139.2 22A78 78 0 0 1 139.2 138")+p(87,80,4); break;
    case "requisitos": // la lista de control: tres filas, espejadas
      h+=l("M56 24H184V144H56Z");
      [52,84,116].forEach(function(yy){ h+=c(84,yy,8)+l("M104 "+yy+"H136")+c(156,yy,8); });
      h+=p(120,24,4.5); break;
    case "norma":    // el templo
      h+=l("M64 30H176")+l("M72 40H168")+l("M84 40V128")+l("M102 40V128")+l("M120 40V128")+l("M138 40V128")+l("M156 40V128")+l("M72 128H168")+l("M60 140H180");
      h+=p(120,18,4.5); break;
    case "lector":   // el libro abierto
      h+=l("M120 36Q86 26 40 32V132Q86 126 120 136")+l("M120 36Q154 26 200 32V132Q154 126 120 136")+l("M120 36V136");
      for(i=0;i<5;i++){ y=52+i*16; h+=l("M52 "+(y-2)+"Q84 "+(y-8)+" 110 "+(y-1))+l("M188 "+(y-2)+"Q156 "+(y-8)+" 130 "+(y-1)); }
      h+=p(120,20,4.5); break;
    case "citas":    // las comillas, abriendo y cerrando
      h+=l("M72 52L54 70L72 88")+l("M90 52L72 70L90 88")+l("M168 52L186 70L168 88")+l("M150 52L168 70L150 88");
      h+=l("M84 118H156")+l("M100 134H140");
      h+=p(120,70,5); break;
    case "verificar": // el sello con su tilde
      h+=c(120,84,58)+c(120,84,44)+l("M98 86L114 102L144 68");
      h+=p(120,22,4.5); break;
    case "fuentes":  // la señal: arcos concéntricos que salen de un punto
      [30,58,86].forEach(function(r){
        a=56*Math.PI/180;
        h+=l("M"+(120-r*Math.sin(a)).toFixed(1)+" "+(138-r*Math.cos(a)).toFixed(1)+"A"+r+" "+r+" 0 0 1 "+(120+r*Math.sin(a)).toFixed(1)+" "+(138-r*Math.cos(a)).toFixed(1));
      });
      h+=l("M120 138V152")+p(120,138,5.5); break;
    case "guardados": // fichas apiladas
      h+=l("M50 144V104H190V144Z")+l("M64 104V80H176V104")+l("M78 80V56H162V80")+l("M104 124H136")+l("M112 92H128");
      h+=p(120,68,4.5); break;
    case "cuenta":   // la cerradura
      h+=c(120,84,56)+c(120,72,13)+l("M112 84L106 118H134L128 84");
      h+=p(120,72,3.5); break;
    case "calculos": // el ábaco: tres hileras de tres cuentas, centradas
      h+=l("M44 34H196V138H44Z"); [58,86,114].forEach(function(y){ h+=l("M44 "+y+"H76")+l("M92 "+y+"H112")+l("M128 "+y+"H148")+l("M164 "+y+"H196")+c(84,y,8)+c(120,y,8)+c(156,y,8); }); h+=p(120,20,5); break;
    case "plazos":   // el calendario y el día que vence
      h+=l("M40 34H200V140H40Z")+l("M40 54H200")+l("M76 26V42")+l("M164 26V42");
      for(y=0;y<4;y++) for(x=0;x<7;x++){ if(!(x===3&&y===2)) h+='<circle class="dp" cx="'+(57+x*21)+'" cy="'+(72+y*18)+'" r="1.8"/>'; }
      h+=c(120,108,8)+p(120,108,3.5); break;
    case "herramientas": // páginas que se juntan en un solo cuerpo
      h+=l("M70 40H170V132H70Z")+l("M82 28H182V40")+l("M94 16H194V28")+l("M90 64H150")+l("M90 84H150")+l("M90 104H128");
      h+=p(170,40,4); break;
    case "glosario": // la V romana del logo
      h+=l("M62 34H92")+l("M148 34H178")+l("M77 34L120 134")+l("M120 134L163 34")+l("M40 146H200");
      h+=p(120,62,5.5); break;
    }
    return '<svg class="dib" viewBox="0 0 240 160" aria-hidden="true">'+h+'</svg>';
  }
  var TITULO='Buscador integrado de repositorios judiciales oficiales y <em>doctrina.</em>';
  var BOTONES='<div class="acc"><a class="btn" href="#" data-tab="buscar">Iniciar la consulta</a><a class="btn sec" href="#" data-tab="fuentes">Ver el catálogo de fuentes</a></div>';
  window.IVS4={OFERTAS:OFERTAS,dibujo:dibujo,TITULO:TITULO,BOTONES:BOTONES,sm:function(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);},
    lerp:function(a,b,t){return a+(b-a)*t;},clamp:function(x,a,b){return Math.max(a,Math.min(b,x));}};

  /* ---------- PRISMA ----------
     o.px  posición horizontal del prisma (fracción del ancho)   o.cy  altura del eje (fracción del alto)
     o.band  [alto,bajo] de las entradas (fracciones)       o.out(P,W,H) -> puntos del haz de salida */
  window.IVSPrisma=function(cv,o){
    o=o||{};var ctx=cv.getContext("2d"),W=1,H=1,D=Math.min(devicePixelRatio||1,2),P={x:0,y:0},P0={x:0,y:0},Y=[],puls=[],last=0,tm=0,out=[],cum=[],total=0,
      ox=0,oy=0,ang=0,tmx=0,tmy=0,mpx=0,mpy=0,vivo=0,vel=0,lmx=0,lmy=0;   /* interacción con el puntero (o.mouse) */
    var cs=getComputedStyle(document.documentElement),quieto=matchMedia("(prefers-reduced-motion:reduce)").matches;
    /* las entradas del prisma son las bases consultadas (no las ofertas del libro, que son otras seis cosas) */
    var BASES_PRISMA=[["SCJM","--c-mza"],["MZA LEGAL","--c-mzl"],["TSJ","--c-caba"],["CSJN","--c-csjn"],["SAIJ","--c-saij"],["DIALNET","--c-dial"],["CORTE IDH","--c-idh"]];
    var B=BASES_PRISMA.map(function(f,i){var n=f[0],h=cs.getPropertyValue(f[1]).trim();
      return {n:n,c:[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)],next:i*.5};});
    var ORO=[217,163,27],CLARO=[255,226,150];
    function medir(){
      W=cv.clientWidth;H=cv.clientHeight;cv.width=W*D;cv.height=H*D;
      var m=W<700,band=typeof o.band==="function"?o.band(W,H):(o.band||[.34,.66]);
      P0.x=W*(typeof o.px==="function"?o.px(W):(o.px||.54));P0.y=H*(typeof o.cy==="function"?o.cy(W,H):(o.cy||.5));
      Y=B.map(function(_,i){return H*(band[0]+i*(band[1]-band[0])/(B.length-1));});
      mpx=P0.x;mpy=P0.y;calc();
    }
    /* posición del prisma y del haz de salida; con el puntero, el prisma se desplaza y se inclina, y el haz apunta hacia el cursor */
    function calc(){
      P.x=P0.x+ox;P.y=P0.y+oy;
      var ty=o.mouse?Math.max(-H*.22,Math.min(H*.22,(mpy-P.y)*.32)):0;
      out=[[P.x,P.y]].concat(o.mouse?[[W,P.y+ty]]:(o.out?o.out(P,W,H):[[W,P.y]]));cum=[0];total=0;
      for(var i=1;i<out.length;i++){total+=Math.hypot(out[i][0]-out[i-1][0],out[i][1]-out[i-1][1]);cum.push(total);}
    }
    if(o.mouse){
      addEventListener("pointermove",function(e){
        var r=cv.getBoundingClientRect();if(e.clientY<r.top-40||e.clientY>r.bottom+40)return;
        mpx=e.clientX-r.left;mpy=e.clientY-r.top;tmx=Math.max(-1,Math.min(1,(mpx/W-.5)*2));tmy=Math.max(-1,Math.min(1,(mpy/H-.5)*2));
        vel=Math.min(1,vel+Math.hypot(mpx-lmx,mpy-lmy)/90);lmx=mpx;lmy=mpy;vivo=1;
      },{passive:true});
    }
    function en(s){ // punto a distancia s a lo largo del haz de salida
      for(var i=1;i<out.length;i++){ if(s<=cum[i]){var u=(s-cum[i-1])/Math.max(1e-6,cum[i]-cum[i-1]);return [out[i-1][0]+(out[i][0]-out[i-1][0])*u,out[i-1][1]+(out[i][1]-out[i-1][1])*u];} }
      return out[out.length-1];
    }
    function bez(i,t){var A=[0,Y[i]],C=[P.x*.55,Y[i]],u=1-t;return [u*u*A[0]+2*u*t*C[0]+t*t*P.x,u*u*A[1]+2*u*t*C[1]+t*t*P.y];}
    function rgba(c,a){return "rgba("+c[0]+","+c[1]+","+c[2]+","+a.toFixed(3)+")";}
    function frame(now){
      var dt=Math.min((now-last)/1000,.05);last=now;tm+=dt;
      if(o.mouse){var k=1-Math.exp(-dt*5);ox+=(tmx*W*.04-ox)*k;oy+=(tmy*H*.07-oy)*k;ang+=(tmx*.09-ang)*k;vel*=Math.exp(-dt*2.2);vivo=Math.max(0,vivo-dt*.35);calc();}
      ctx.setTransform(D,0,0,D,0,0);ctx.clearRect(0,0,W,H);
      ctx.globalCompositeOperation="lighter";ctx.lineCap="round";ctx.lineJoin="round";
      B.forEach(function(b,i){
        var g=ctx.createLinearGradient(0,0,P.x,0);g.addColorStop(0,rgba(b.c,0));g.addColorStop(.25,rgba(b.c,.5));g.addColorStop(1,rgba(b.c,.85));
        ctx.beginPath();ctx.moveTo(0,Y[i]);ctx.quadraticCurveTo(P.x*.55,Y[i],P.x,P.y);
        ctx.strokeStyle=g;ctx.lineWidth=1.3;ctx.stroke();ctx.strokeStyle=rgba(b.c,.07);ctx.lineWidth=9;ctx.stroke();
        if(!quieto){b.next-=dt;if(b.next<=0){b.next=2.2+Math.random()*2.6;if(puls.length<3)puls.push({i:i,t:0,v:.2+Math.random()*.08,out:false,s:0});}}
      });
      ctx.beginPath();out.forEach(function(q,i){if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);});
      ctx.strokeStyle=rgba(ORO,.8);ctx.lineWidth=2.4;ctx.stroke();ctx.strokeStyle=rgba(ORO,.09);ctx.lineWidth=20;ctx.stroke();
      puls=puls.filter(function(p){
        if(!p.out){p.t+=p.v*dt;if(p.t>=1){p.out=true;p.s=0;}}else{p.s+=150*dt;if(p.s>=total)return false;}
        var c=p.out?ORO:B[p.i].c;
        for(var k=0;k<9;k++){
          var xy,al=(1-k/9)*(p.out?.9:.8);
          if(!p.out){var tt=p.t-k*.014;if(tt<0)break;xy=bez(p.i,tt);}else{var ss=p.s-k*7;if(ss<0)break;xy=en(ss);}
          ctx.beginPath();ctx.arc(xy[0],xy[1],k===0?2.4:1.6,0,7);ctx.fillStyle=rgba(p.out?CLARO:c,al);ctx.fill();
          if(k===0){ctx.beginPath();ctx.arc(xy[0],xy[1],8,0,7);ctx.fillStyle=rgba(c,.14);ctx.fill();}
        }
        return true;
      });
      ctx.globalCompositeOperation="source-over";
      var s=Math.min(W,H)*.1;ctx.save();ctx.translate(P.x,P.y);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(-s*.87,s*.5);ctx.lineTo(s*.87,s*.5);ctx.closePath();
      ctx.fillStyle="rgba(241,238,230,.035)";ctx.fill();ctx.strokeStyle="rgba(241,238,230,.6)";ctx.lineWidth=1;ctx.stroke();ctx.restore();
      if(o.mouse&&vivo>0){var gc=ctx.createRadialGradient(mpx,mpy,0,mpx,mpy,170);gc.addColorStop(0,"rgba(255,226,150,"+(.13*Math.min(1,vivo*1.6)).toFixed(3)+")");gc.addColorStop(1,"rgba(217,163,27,0)");ctx.globalCompositeOperation="lighter";ctx.fillStyle=gc;ctx.beginPath();ctx.arc(mpx,mpy,170,0,7);ctx.fill();ctx.globalCompositeOperation="source-over";}
      var gl=ctx.createRadialGradient(P.x,P.y,0,P.x,P.y,s*1.3);gl.addColorStop(0,"rgba(255,226,150,.5)");gl.addColorStop(1,"rgba(217,163,27,0)");
      ctx.globalCompositeOperation="lighter";ctx.fillStyle=gl;ctx.beginPath();ctx.arc(P.x,P.y,s*1.3,0,7);ctx.fill();ctx.globalCompositeOperation="source-over";
      ctx.font="500 11.5px 'Cormorant SC',serif";ctx.textBaseline="middle";ctx.textAlign="left";
      B.forEach(function(b,i){ctx.fillStyle=rgba(b.c,.95);ctx.fillText(b.n.split("").join(String.fromCharCode(8202)),W<700?14:32,Y[i]-12);});
      if(o.rotulo){ctx.textAlign="right";ctx.fillStyle=rgba(ORO,.95);ctx.fillText(o.rotulo.split("").join(String.fromCharCode(8202)),W-(W<700?14:32),P.y-12);ctx.textAlign="left";}
      if(!quieto)requestAnimationFrame(frame);
    }
    medir();addEventListener("resize",medir);
    requestAnimationFrame(function(t){last=t;frame(t);});
    return {P:function(){return {x:P.x,y:P.y,W:W,H:H};},medir:medir};
  };

  /* ---------- LIBRO ---------- */
  window.IVSLibro=function(host){
    var lam=OFERTAS.map(function(f){return '<figure>'+dibujo(f.k)+'<figcaption>'+f.t+'</figcaption></figure>';}).join("");
    var ind=OFERTAS.map(function(f){return '<li><b>'+f.lat+' · '+f.t+'</b>'+f.d+'</li>';}).join("");
    var P={
      pref:'<h2>Prefacio</h2><h3>'+TITULO+'</h3><div class="campo">amparo contra actos de particulares</div>'+BOTONES,
      lam:'<h2>Láminas</h2><h3>Lo que ofrece, <em>en seis dibujos.</em></h3><div class="lb-lam">'+lam+'</div>',
      prin:'<h2>Principios</h2><h3>Tres condiciones que ningún resultado <em>puede dejar de cumplir.</em></h3><ul><li><b>FONS · La fuente</b>Todo resultado remite al documento del organismo que lo dictó.</li><li><b>ORDO · El orden</b>Los resultados se presentan juntos, con su procedencia a la vista.</li><li><b>FIDES · La fe</b>Una cita se contrasta con la base oficial antes de presentarse.</li></ul>',
      ind:'<h2>Índice</h2><h3>Seis cosas, <em>un solo libro.</em></h3><ul>'+ind+'</ul>',
      tapa:'<span class="nom">IVS·CODEX</span><span class="lema">IVS EST ARS BONI ET AEQVI</span><i></i>'
    };
    // celular: un libro de una página, que va pasando de a una (el de dos páginas no entra)
    if(window.innerWidth<=760){
      var orden=[["tapa","lb-tapa"],["ind","lb-papel der lb-pg"],["lam","lb-papel der lb-pg"],["prin","lb-papel der lb-pg"],["pref","lb-papel der lb-pg"]];
      host.innerHTML='<div class="lbm">'+orden.map(function(o){return '<div class="lb-cara '+o[1]+'">'+P[o[0]]+'</div>';}).join("")+'</div>';
      var cs=[].slice.call(host.querySelectorAll(".lb-cara")),cur=-1;
      function set(a,b){
        var u=a+b,i=u<.12?0:u<.7?1:u<1.3?2:u<1.7?3:4;
        if(i===cur) return; cur=i; cs.forEach(function(c,k){c.classList.toggle("on",k===i);});
        if(i===2) cs[2].classList.add("on");
      }
      set(0,0);
      return {set:set,el:host.firstChild};
    }
    host.innerHTML='<div class="lb" id="lbX">'+
      '<div class="lb-cara lb-papel der lb-pg">'+P.pref+'</div>'+
      '<div class="lb-hoja" data-h="B"><div class="lb-cara lb-papel der lb-pg">'+P.lam+'</div>'+
        '<div class="lb-cara lb-dorso lb-papel izq lb-pg">'+P.prin+'</div></div>'+
      '<div class="lb-hoja" data-h="A"><div class="lb-cara lb-tapa">'+P.tapa+'</div>'+
        '<div class="lb-cara lb-dorso lb-papel izq lb-pg">'+P.ind+'</div></div>'+
    '</div>';
    var lb=host.firstChild,hA=lb.querySelector('[data-h="A"]'),hB=lb.querySelector('[data-h="B"]');
    function set(a,b){
      hA.style.transform="translateZ("+(3*(1-a)).toFixed(2)+"px) rotateY("+(-180*a).toFixed(2)+"deg)";
      hB.style.transform="translateZ("+(2-.6*b).toFixed(2)+"px) rotateY("+(-180*b).toFixed(2)+"deg)";
      lb.style.setProperty("--o",a.toFixed(3));
    }
    set(0,0);
    return {set:set,el:lb};
  };
})();
