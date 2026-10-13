/* El radar de IVS CODEX, versión modificada.
   Respecto de la portada actual:
   - el haz es una luz: un sector con degradado cónico que se atenúa hacia atrás y hacia afuera
     (ya no son líneas una detrás de otra), con un filo dorado en el borde que avanza;
   - el aro exterior lleva una escala de rumbo (marcas cada 5°, N · E · S · O);
   - cada fallo se «descubre» con un pequeño anillo dorado en el punto donde el haz lo toca;
   - las letras de cada fallo se encienden bajo el haz, una a una, y se apagan despacio;
   - los fallos pueden aparecer en cualquier parte de la superficie, no solo dentro del círculo.
   Uso: IVSRadar(host, {cx, cy, r, full, evitar}) */
(function(){
  var FALLOS=[
    ["Siri, Ángel","1957","Siri, Ángel s/ interpone recurso de hábeas corpus","239:459"],
    ["Kot, Samuel","1958","Kot, Samuel S.R.L. s/ recurso de hábeas corpus","241:291"],
    ["Ercolano","1922","Ercolano, Agustín c/ Lanteri de Renshaw, Julieta s/ consignación","136:161"],
    ["Avico","1934","Avico, Oscar c/ de la Pesa, Saúl G. s/ consignación de intereses","172:21"],
    ["Elortondo","1888","Municipalidad de la Capital c/ Elortondo, Isabel A. de","33:162"],
    ["Ponzetti de Balbín","1984","Ponzetti de Balbín, Indalia c/ Editorial Atlántida S.A. s/ daños y perjuicios","306:1892"],
    ["Bazterrica","1986","Bazterrica, Gustavo Mario s/ tenencia de estupefacientes","308:1392"],
    ["Sejean","1986","Sejean, Juan Bautista c/ Zaks de Sejean, Ana María s/ inconstitucionalidad del art. 64 de la ley 2393","308:2268"],
    ["Ekmekdjian","1992","Ekmekdjian, Miguel Ángel c/ Sofovich, Gerardo y otros s/ recurso de hecho","315:1492"],
    ["Giroldi","1995","Giroldi, Horacio David y otro s/ recurso de casación","318:514"],
    ["Fayt","1999","Fayt, Carlos Santiago c/ Estado Nacional s/ proceso de conocimiento","322:1616"],
    ["Vizzoti","2004","Vizzoti, Carlos Alberto c/ AMSA S.A. s/ despido","327:3677"],
    ["Aquino","2004","Aquino, Isacio c/ Cargo Servicios Industriales S.A. s/ accidentes ley 9688","327:3753"],
    ["Simón","2005","Simón, Julio Héctor y otros s/ privación ilegítima de la libertad, etc.","328:2056"],
    ["Verbitsky","2005","Verbitsky, Horacio s/ hábeas corpus","328:1146"],
    ["Mendoza · Riachuelo","2008","Mendoza, Beatriz Silvia y otros c/ Estado Nacional y otros s/ daños y perjuicios","331:1622"],
    ["Halabi","2009","Halabi, Ernesto c/ P.E.N. – ley 25.873 – dto. 1563/04 s/ amparo ley 16.986","332:111"],
    ["Arriola","2009","Arriola, Sebastián y otros s/ causa n.º 9080","332:1963"]
  ];
  var css=document.createElement("style");
  css.textContent=".rr-f{position:absolute;width:max-content;max-width:400px;pointer-events:none}"+
    ".rr-t{display:flex;align-items:baseline;gap:18px;white-space:nowrap}"+
    ".rr-n{font:400 calc(26px*var(--e,1))/1.1 var(--caps,'Cormorant SC',serif);letter-spacing:.04em;color:var(--fg,#f1eee6)}"+
    ".rr-d{font:400 calc(19px*var(--e,1))/1.1 var(--sans,'Instrument Sans',sans-serif);color:var(--gold,#d9a31b)}"+
    ".rr-a{margin:10px 0 0;font:400 calc(12.5px*var(--e,1))/1.35 var(--sans,'Instrument Sans',sans-serif);color:var(--mute,rgba(241,238,230,.62))}"+
    ".rr-c{margin:7px 0 0;font:500 calc(12.5px*var(--e,1))/1.2 var(--caps,'Cormorant SC',serif);letter-spacing:.06em;color:var(--gold,#d9a31b)}"+
    ".rr-k{opacity:0}";
  document.head.appendChild(css);

  window.IVSRadar=function(host,opt){
    opt=opt||{};
    var P2=Math.PI*2,VEL=.4,FADE=4.6,ATK=.05,NS=opt.n||4,CR="241,238,230",CO="217,163,27";
    var cv=document.createElement("canvas"),cap=document.createElement("div"),ctx=cv.getContext("2d");
    cv.style.cssText="position:absolute;inset:0;width:100%;height:100%";
    cap.style.cssText="position:absolute;inset:0;overflow:hidden;pointer-events:none";
    host.appendChild(cv); host.appendChild(cap);
    var W=1,H=1,K=1,cx=0,cy=0,R=1,RV=1,DPR=Math.min(window.devicePixelRatio||1,1.5),TH=0,E=1;
    var huecos=[],slots=[],cola=[],B=[],pings=[],recientes=[];
    var off=document.createElement("canvas"),octx=off.getContext("2d");
    var quieto=window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches;

    function medir(){
      var r=host.getBoundingClientRect(); W=Math.max(r.width,1); H=Math.max(r.height,1);
      cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); K=DPR; off.width=cv.width; off.height=cv.height;
      cx=W*(opt.cx==null?.5:opt.cx); cy=H*(opt.cy==null?.5:opt.cy);
      var m=Math.min(W,H);
      RV=m*(opt.r||.46);                                             // radio del aro exterior visible
      R=opt.full?Math.hypot(Math.max(cx,W-cx),Math.max(cy,H-cy)):RV; // hasta dónde llega el haz
      E=Math.max(.72,Math.min(1.15,m/760)); cap.style.setProperty("--e",E.toFixed(2));
      B=[]; for(var i=0;i<(opt.full?60:34);i++){ var a=Math.random()*P2,rr=Math.sqrt(Math.random())*(R*.92); B.push({x:cx+rr*Math.cos(a),y:cy+rr*Math.sin(a),f:a}); }
    }
    function infl(x,y){
      var f=0,Rr=70*E;
      for(var i=0;i<huecos.length;i++){ var h=huecos[i]; if(h.p<.01) continue;
        var qx=Math.max(h.x,Math.min(x,h.x+h.w)),qy=Math.max(h.y,Math.min(y,h.y+h.h)),d=Math.hypot(x-qx,y-qy),q=Math.max(0,1-d/Rr); q=q*q*(3-2*q)*h.p; if(q>f) f=q; }
      return f;
    }
    function lin(x1,y1,x2,y2,a,col,w){ if(a<.01) return; ctx.strokeStyle="rgba("+(col||CR)+","+a.toFixed(3)+")"; ctx.lineWidth=(w||1.1)*K; ctx.beginPath(); ctx.moveTo(x1*K,y1*K); ctx.lineTo(x2*K,y2*K); ctx.stroke(); }
    function dibujar(t){
      // anillos: tres dentro del aro, y los que haga falta si el haz llega más lejos
      var paso=RV/3,n=Math.ceil(R/paso);
      ctx.lineWidth=1*K;
      for(var k=1;k<=n;k++){ var r=k*paso; ctx.strokeStyle="rgba("+CR+","+(k===3?.34:Math.max(.05,.16-k*.012)).toFixed(3)+")"; ctx.beginPath(); ctx.arc(cx*K,cy*K,r*K,0,P2); ctx.stroke(); }
      // escala de rumbo sobre el aro exterior
      for(var g=0;g<360;g+=5){ var a=g*Math.PI/180,ln=g%30===0?11:(g%10===0?7:4),c=Math.cos(a),s=Math.sin(a);
        lin(cx+(RV-ln)*c,cy+(RV-ln)*s,cx+RV*c,cy+RV*s,g%90===0?.9:(g%30===0?.5:.26),g%90===0?CO:CR,1); }
      // el haz: una luz con degradado que se atenúa hacia atrás (cónico) y hacia afuera (radial)
      haz(R);
      B.forEach(function(b){ var d=(((TH-b.f)%P2)+P2)%P2,lit=Math.max(0,1-d/3.8); if(lit<.02) return; var q=infl(b.x,b.y);
        ctx.fillStyle="rgba("+CO+","+(.85*lit*(1-q)).toFixed(3)+")"; ctx.beginPath(); ctx.arc(b.x*K,b.y*K,(1.8+2*lit)*K,0,P2); ctx.fill(); });
      pings=pings.filter(function(p){ return t-p.t<1.8; });
      pings.forEach(function(p){ var u=(t-p.t)/1.8; ctx.strokeStyle="rgba("+CO+","+(.85*(1-u)).toFixed(3)+")"; ctx.lineWidth=1.3*K;
        ctx.beginPath(); ctx.arc(p.x*K,p.y*K,(5+46*(1-Math.pow(1-u,3)))*E*K,0,P2); ctx.stroke(); });
    }
    /* El haz como luz. Se dibuja aparte (octx) para poder atenuarlo con la distancia al centro sin tocar lo demás. */
    function haz(R){
      var TR=1.35,cX=cx*K,cY=cy*K,a0=TH-TR,f=TR/P2;
      if(octx.createConicGradient){
        octx.setTransform(1,0,0,1,0,0); octx.globalCompositeOperation="source-over"; octx.clearRect(0,0,off.width,off.height);
        var g=octx.createConicGradient(a0,cX,cY),N=14;
        for(var i=0;i<=N;i++){ var u=i/N; g.addColorStop(f*u,"rgba(248,222,140,"+(0.46*Math.pow(u,2.6)).toFixed(3)+")"); }
        g.addColorStop(Math.min(f+.0006,1),"rgba(248,222,140,0)");
        octx.fillStyle=g; octx.beginPath(); octx.moveTo(cX,cY); octx.arc(cX,cY,R*K,a0,TH); octx.closePath(); octx.fill();
        octx.globalCompositeOperation="destination-in";
        var rg=octx.createRadialGradient(cX,cY,0,cX,cY,R*K);
        rg.addColorStop(0,"rgba(0,0,0,1)"); rg.addColorStop(.55,"rgba(0,0,0,.8)"); rg.addColorStop(1,"rgba(0,0,0,0)");
        octx.fillStyle=rg; octx.fillRect(0,0,off.width,off.height);
        ctx.save(); ctx.globalCompositeOperation="lighter"; ctx.drawImage(off,0,0); ctx.restore();
      }
      // el filo: un hilo dorado que se desvanece hacia afuera, con un resplandor ancho y muy tenue
      var ex=(cx+R*Math.cos(TH))*K,ey=(cy+R*Math.sin(TH))*K;
      [[7,.10],[1.5,.95]].forEach(function(l){
        var lg=ctx.createLinearGradient(cX,cY,ex,ey);
        lg.addColorStop(0,"rgba(255,238,176,"+l[1]+")"); lg.addColorStop(.5,"rgba(224,172,36,"+(l[1]*.75).toFixed(2)+")"); lg.addColorStop(1,"rgba(217,163,27,0)");
        ctx.strokeStyle=lg; ctx.lineWidth=l[0]*K; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(cX,cY); ctx.lineTo(ex,ey); ctx.stroke();
      });
      var gl=ctx.createRadialGradient(cX,cY,0,cX,cY,34*E*K);
      gl.addColorStop(0,"rgba(255,226,140,.55)"); gl.addColorStop(1,"rgba(217,163,27,0)");
      ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(cX,cY,34*E*K,0,P2); ctx.fill();
    }
    function sp(s){ return '<span style="white-space:nowrap">'+s+'</span>'; }
    function esc(c){ return c==="&"?"&amp;":c==="<"?"&lt;":c; }
    function letras(txt){ return txt.split(" ").map(function(w){ return sp(w.split("").map(function(c){ return '<span class="rr-k">'+esc(c)+'</span>'; }).join("")); }).join(" "); }
    function armar(sl){
      if(!cola.length) cola=FALLOS.slice().sort(function(){ return Math.random()-.5; });
      var f=cola.shift();
      sl.div.style.maxWidth=Math.round((230+Math.random()*150)*E)+"px";
      sl.div.innerHTML='<div class="rr-t"><span class="rr-n">'+letras(f[0])+'</span><span class="rr-d">'+letras(f[1])+'</span></div><p class="rr-a">'+letras(f[2])+'</p><p class="rr-c">'+letras("Corte Suprema de Justicia de la Nación · Fallos "+f[3])+'</p>';
      sl.div.style.visibility="hidden"; sl.div.style.left="0"; sl.div.style.top="0";
      var w=sl.div.offsetWidth,h=sl.div.offsetHeight,r0=sl.div.getBoundingClientRect();
      sl.ks=[].slice.call(sl.div.querySelectorAll(".rr-k")).map(function(k){ var r=k.getBoundingClientRect(); return {el:k,lx:r.left+r.width/2-r0.left,ly:r.top+r.height/2-r0.top,o:0,phi:0}; });
      sl.w=w; sl.h=h; sl.armado=false; sl.visto=false; sl.t=0; sl.tgt=null; sl.ping=false;
    }
    function libre(x,y,w,h){
      var corn=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]];
      if(opt.full){
        var p=14; if(x<p||y<p||x+w>W-p||y+h>H-p) return false;
      }else{
        for(var i=0;i<4;i++) if(Math.hypot(corn[i][0]-cx,corn[i][1]-cy)>RV*.9) return false;
      }
      if(Math.hypot(x+w/2-cx,y+h/2-cy)<Math.max(w,h)*.55+RV*.14) return false;   // lejos del origen del haz, donde gira muy rápido
      var ev=opt.evitar?opt.evitar():[]; var hr=host.getBoundingClientRect();
      for(var j=0;j<ev.length;j++){ var e=ev[j],ex=e.left-hr.left,ey=e.top-hr.top;
        if(!(x>ex+e.width+16||x+w<ex-16||y>ey+e.height+16||y+h<ey-16)) return false; }
      for(var q=0;q<slots.length;q++){ var o=slots[q]; if(!o.armado) continue; if(!(x>o.x+o.w+34||x+w<o.x-34||y>o.y+o.h+34||y+h<o.y-34)) return false; }
      return true;
    }
    function ubicar(sl,t){
      var w=sl.w,h=sl.h,x=0,y=0,ok=false,n=0;
      var T=sl.tgt; if(!T||t-T.t>4) T=sl.tgt={a:Math.random()*P2,r:Math.sqrt(Math.random())*(opt.full?Math.min(W,H)*.6:RV*.8),t:t};
      while(!ok&&n++<200){
        var aa=T.a+(Math.random()-.5)*.6,rr=Math.max(0,T.r+(Math.random()-.5)*Math.min(W,H)*.18);
        x=cx+rr*Math.cos(aa)-w/2+(Math.random()-.5)*40; y=cy+rr*Math.sin(aa)-h/2+(Math.random()-.5)*40;
        if(opt.full&&n>60){ x=14+Math.random()*(W-w-28); y=14+Math.random()*(H-h-28); }
        ok=libre(x,y,w,h);
        if(ok&&n<150&&recientes.some(function(r){ return Math.hypot(r[0]-(x+w/2),r[1]-(y+h/2))<Math.min(W,H)*.2; })) ok=false;
        for(var q=0;q<sl.ks.length&&ok;q++){ var k=sl.ks[q],ph=Math.atan2(y+k.ly-cy,x+k.lx-cx),d=(((TH-ph)%P2)+P2)%P2; if(d<FADE+.15) ok=false; }
      }
      if(!ok) return false;
      recientes.push([x+w/2,y+h/2]); if(recientes.length>4) recientes.shift();
      sl.x=x; sl.y=y; sl.div.style.left=x+"px"; sl.div.style.top=y+"px"; sl.div.style.visibility="";
      sl.ks.forEach(function(k){ k.phi=Math.atan2(y+k.ly-cy,x+k.lx-cx); });
      sl.hu.x=x-14; sl.hu.y=y-12; sl.hu.w=w+28; sl.hu.h=h+24; sl.hu.p=0; sl.armado=true; return true;
    }
    function actualizar(t){
      slots.forEach(function(sl){
        if(!sl.ks){ armar(sl); return; }
        if(!sl.armado){ if(t-sl.t>.25){ sl.t=t; if(ubicar(sl,t)) sl.tgt=null; } return; }
        var mx=0;
        for(var q=0;q<sl.ks.length;q++){
          var k=sl.ks[q],d=(((TH-k.phi)%P2)+P2)%P2,lit=0;
          if(d<=FADE){ lit=d<ATK?d/ATK:1-(d-ATK)/(FADE-ATK); lit=lit>.5?1-Math.pow(1-lit,1.7)*.88:lit; }
          lit=Math.round(lit*30)/30; if(lit>mx) mx=lit;
          if(lit!==k.o){ k.o=lit; k.el.style.opacity=lit; }
        }
        if(mx>0&&!sl.ping){ sl.ping=true; sl.visto=true; var k0=sl.ks[0]; pings.push({x:sl.x+k0.lx,y:sl.y+k0.ly,t:t}); }
        sl.hu.p=mx*.85;
        if(sl.visto&&mx===0){ sl.hu.p=0; sl.armado=false; armar(sl); }
      });
    }
    medir();
    if(window.ResizeObserver) new ResizeObserver(function(){ medir(); slots.forEach(function(s){ s.armado=false; if(s.ks) armar(s); }); }).observe(host);
    var enMarcha=false,t0=performance.now(),tp=t0,fuentes=false;
    (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){ fuentes=true; });
    if(!quieto&&(window.innerWidth>=640||opt.movil)) for(var i=0;i<NS;i++){ var dv=document.createElement("div"); dv.className="rr-f"; dv.style.visibility="hidden"; cap.appendChild(dv);
      var hu={x:0,y:0,w:0,h:0,p:0}; huecos.push(hu); slots.push({div:dv,hu:hu,w:0,armado:false,t:0}); }
    function tic(now){
      requestAnimationFrame(tic);
      var r=host.getBoundingClientRect();
      if(document.hidden||r.bottom<0||r.top>innerHeight){ tp=now; return; }
      var dt=Math.min((now-tp)/1000,.05); tp=now; if(!quieto) TH+=dt*VEL; var t=TH/VEL;
      ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height);
      if(!opt.full){ ctx.save(); ctx.beginPath(); ctx.arc(cx*K,cy*K,(RV+14)*K,0,P2); ctx.clip(); }
      dibujar(t);
      if(!opt.full) ctx.restore();
      if(fuentes) actualizar(t);
    }
    if(quieto){ TH=2.2; dibujar(0); } else requestAnimationFrame(tic);
  };
})();
