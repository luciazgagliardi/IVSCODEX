/* Piezas comunes: las seis ofertas con sus dibujos, el prisma (canvas) y el libro (3D). */
(function(){
  var NS="http://www.w3.org/2000/svg";
  var OFERTAS=[
    {k:"consulta",lat:"QVAESTIO",t:"Una consulta, seis buscadores.",n:"Consulta",d:"La consulta se arma con los operadores de cada buscador oficial y se envía a las seis bases a la vez.",c:"--c-mza"},
    {k:"voces",lat:"MATERIAE",t:"Del término a su familia.",n:"Ramas y voces",d:"Los buscadores indexan por descriptores técnicos: cada voz se despliega en sus equivalentes, ordenados por rama del derecho.",c:"--c-mzl"},
    {k:"lector",lat:"LECTIO",t:"Lo que importa, a la vista.",n:"Lector",d:"El fallo se lee con la búsqueda destacada, un mapa de coincidencias y la cita preparada para copiar.",c:"--c-caba"},
    {k:"verifica",lat:"PROBATIO",t:"Se contrasta antes de citar.",n:"Verificación",d:"Cada cita se confronta con los repositorios oficiales. La ausencia de resultados no prueba la falsedad, y la plataforma lo advierte.",c:"--c-csjn"},
    {k:"calculo",lat:"CALCVLVS",t:"Los días y los números.",n:"Cálculos y plazos",d:"Plazos procesales con feriados y ferias, intereses, índices, despido, incapacidad y honorarios.",c:"--c-saij"},
    {k:"pdf",lat:"INSTRVMENTA",t:"Un solo archivo, del tamaño justo.",n:"Herramientas",d:"Unir, dividir, foliar y reducir PDF dentro del navegador: los archivos no salen de su computadora.",c:"--c-dial"}
  ];
  var TITULO='Buscador integrado de repositorios judiciales oficiales y <em>doctrina.</em>';
  var BOTONES='<div class="acc"><a class="btn" href="#">Iniciar la consulta</a><a class="btn sec" href="#">Ver el catálogo de fuentes</a></div>';
  window.IVS4={OFERTAS:OFERTAS,TITULO:TITULO,BOTONES:BOTONES,sm:function(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);},
    lerp:function(a,b,t){return a+(b-a)*t;},clamp:function(x,a,b){return Math.max(a,Math.min(b,x));}};

  /* ---------- PRISMA ----------
     o.px  posición horizontal del prisma (fracción del ancho)   o.cy  altura del eje (fracción del alto)
     o.band  [alto,bajo] de las seis entradas (fracciones)       o.out(P,W,H) -> puntos del haz de salida */
  window.IVSPrisma=function(cv,o){
    o=o||{};var ctx=cv.getContext("2d"),W=1,H=1,D=Math.min(devicePixelRatio||1,2),P={x:0,y:0},Y=[],puls=[],last=0,tm=0,out=[],cum=[],total=0;
    var cs=getComputedStyle(document.documentElement),quieto=matchMedia("(prefers-reduced-motion:reduce)").matches;
    var B=OFERTAS.map(function(f,i){var n=["MZA","MZA LEGAL","TSJ","CSJN","SAIJ","DIALNET"][i],h=cs.getPropertyValue(f.c).trim();
      return {n:n,c:[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)],next:i*.5};});
    var ORO=[217,163,27],CLARO=[255,226,150];
    function medir(){
      W=cv.clientWidth;H=cv.clientHeight;cv.width=W*D;cv.height=H*D;
      var m=W<700,band=o.band||[.34,.66];
      P.x=W*(typeof o.px==="function"?o.px(W):(o.px||.54));P.y=H*(o.cy||.5);
      Y=B.map(function(_,i){return H*(band[0]+i*(band[1]-band[0])/5);});
      out=[[P.x,P.y]].concat(o.out?o.out(P,W,H):[[W,P.y]]);cum=[0];total=0;
      for(var i=1;i<out.length;i++){total+=Math.hypot(out[i][0]-out[i-1][0],out[i][1]-out[i-1][1]);cum.push(total);}
    }
    function en(s){ // punto a distancia s a lo largo del haz de salida
      for(var i=1;i<out.length;i++){ if(s<=cum[i]){var u=(s-cum[i-1])/Math.max(1e-6,cum[i]-cum[i-1]);return [out[i-1][0]+(out[i][0]-out[i-1][0])*u,out[i-1][1]+(out[i][1]-out[i-1][1])*u];} }
      return out[out.length-1];
    }
    function bez(i,t){var A=[0,Y[i]],C=[P.x*.55,Y[i]],u=1-t;return [u*u*A[0]+2*u*t*C[0]+t*t*P.x,u*u*A[1]+2*u*t*C[1]+t*t*P.y];}
    function rgba(c,a){return "rgba("+c[0]+","+c[1]+","+c[2]+","+a.toFixed(3)+")";}
    function frame(now){
      var dt=Math.min((now-last)/1000,.05);last=now;tm+=dt;
      ctx.setTransform(D,0,0,D,0,0);ctx.clearRect(0,0,W,H);
      ctx.globalCompositeOperation="lighter";ctx.lineCap="round";ctx.lineJoin="round";
      B.forEach(function(b,i){
        var g=ctx.createLinearGradient(0,0,P.x,0);g.addColorStop(0,rgba(b.c,0));g.addColorStop(.25,rgba(b.c,.5));g.addColorStop(1,rgba(b.c,.85));
        ctx.beginPath();ctx.moveTo(0,Y[i]);ctx.quadraticCurveTo(P.x*.55,Y[i],P.x,P.y);
        ctx.strokeStyle=g;ctx.lineWidth=1.3;ctx.stroke();ctx.strokeStyle=rgba(b.c,.07);ctx.lineWidth=9;ctx.stroke();
        if(!quieto){b.next-=dt;if(b.next<=0){b.next=1.1+Math.random()*1.4;puls.push({i:i,t:0,v:.2+Math.random()*.1,out:false,s:0});}}
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
      var s=Math.min(W,H)*.1;ctx.beginPath();ctx.moveTo(P.x,P.y-s);ctx.lineTo(P.x-s*.87,P.y+s*.5);ctx.lineTo(P.x+s*.87,P.y+s*.5);ctx.closePath();
      ctx.fillStyle="rgba(241,238,230,.035)";ctx.fill();ctx.strokeStyle="rgba(241,238,230,.6)";ctx.lineWidth=1;ctx.stroke();
      var gl=ctx.createRadialGradient(P.x,P.y,0,P.x,P.y,s*1.3);gl.addColorStop(0,"rgba(255,226,150,.5)");gl.addColorStop(1,"rgba(217,163,27,0)");
      ctx.globalCompositeOperation="lighter";ctx.fillStyle=gl;ctx.beginPath();ctx.arc(P.x,P.y,s*1.3,0,7);ctx.fill();ctx.globalCompositeOperation="source-over";
      ctx.font="500 11.5px 'Cormorant SC',serif";ctx.textBaseline="middle";ctx.textAlign="left";
      B.forEach(function(b,i){ctx.fillStyle=rgba(b.c,.95);ctx.fillText(b.n.split("").join(String.fromCharCode(8202)),W<700?14:32,Y[i]-12);});
      if(!quieto)requestAnimationFrame(frame);
    }
    medir();addEventListener("resize",medir);
    requestAnimationFrame(function(t){last=t;frame(t);});
    return {P:function(){return {x:P.x,y:P.y,W:W,H:H};},medir:medir};
  };

  /* ---------- LIBRO ---------- */
  window.IVSLibro=function(host){
    var ind=OFERTAS.map(function(f){return '<li><b>'+f.lat+' · '+f.n+'</b>'+f.d+'</li>';}).join("");
    var P={
      pref:'<h2>Prefacio</h2><h3>'+TITULO+'</h3><div class="campo">amparo contra actos de particulares</div>'+BOTONES,
      prin:'<h2>Principios</h2><h3>Tres condiciones que ningún resultado <em>puede dejar de cumplir.</em></h3><ul><li><b>FONS · La fuente</b>Todo resultado remite al documento del organismo que lo dictó.</li><li><b>ORDO · El orden</b>Los resultados se presentan juntos, con su procedencia a la vista.</li><li><b>FIDES · La fe</b>Una cita se contrasta con la base oficial antes de presentarse.</li></ul>',
      cierre:'<h2>Advertencia</h2><h3>Verifique siempre en la <em>fuente</em> antes de citar.</h3><p>La ausencia de coincidencias no demuestra la falsedad del fallo: puede responder a faltas de indexación o a carátulas alternativas.</p>',
      ind:'<h2>Índice</h2><h3>Seis cosas, <em>un solo libro.</em></h3><ul>'+ind+'</ul>',
      tapa:'<span class="nom">IVS·CODEX</span><span class="lema">IVS EST ARS BONI ET AEQVI</span><i></i>'
    };
    if(window.innerWidth<=760){
      var orden=[["tapa","lb-tapa"],["ind","lb-papel der lb-pg"],["pref","lb-papel der lb-pg"],["prin","lb-papel der lb-pg"],["cierre","lb-papel der lb-pg"]];
      host.innerHTML='<div class="lbm">'+orden.map(function(o){return '<div class="lb-cara '+o[1]+'">'+P[o[0]]+'</div>';}).join("")+'</div>';
      var cs=[].slice.call(host.querySelectorAll(".lb-cara")),cur=-1;
      function setM(a,b){var u=a+b,i=u<.12?0:u<.7?1:u<1.3?2:u<1.7?3:4;if(i===cur)return;cur=i;cs.forEach(function(c,k){c.classList.toggle("on",k===i);});}
      setM(0,0);return {set:setM,el:host.firstChild};
    }
    host.innerHTML='<div class="lb" id="lbX">'+
      '<div class="lb-cara lb-papel der lb-pg">'+P.cierre+'</div>'+
      '<div class="lb-hoja" data-h="B"><div class="lb-cara lb-papel der lb-pg">'+P.pref+'</div>'+
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
    set(0,0);return {set:set,el:lb};
  };
})();
