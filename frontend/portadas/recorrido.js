/* El recorrido: seis puntos (las seis bases) giran, se juntan en uno, y ese punto se abre en el campo de búsqueda.
   Se maneja con el scroll. Dibujado en canvas, con estela, resplandor y un hilo que une a las bases mientras se juntan.
   IVSRecorrido(pista, {tilt, cx, captions, texto}) — `pista` es un contenedor alto; adentro se arma una escena fija. */
(function(){
  var BASES=[["MZA","#d9a62a"],["MZA LEGAL","#b58640"],["TSJ","#d5873f"],["CSJN","#c95836"],["SAIJ","#b03b42"],["DIALNET","#a04a68"]];
  var RES=[["Siri, Ángel","Fallos 239:459 · 1957","CSJN","#c95836"],["Halabi, Ernesto","Fallos 332:111 · 2009","SAIJ","#b03b42"],["El amparo contra actos de particulares","Doctrina · Dialnet","DIALNET","#a04a68"]];
  var css=document.createElement("style");
  css.textContent=".rec-esc{position:sticky;top:0;height:100svh;overflow:hidden}"+
    ".rec-esc canvas{position:absolute;inset:0;width:100%;height:100%}"+
    ".rec-l{position:absolute;left:0;top:0;font:500 12px/1 var(--caps,'Cormorant SC',serif);letter-spacing:.16em;color:var(--fg,#f1eee6);white-space:nowrap;will-change:transform,opacity;pointer-events:none}"+
    ".rec-cap{position:absolute;z-index:3}"+
    ".rec-cap p{position:absolute;left:0;bottom:0;margin:0;font:400 clamp(24px,3.6vw,52px)/1.06 var(--sans,'Instrument Sans',sans-serif);letter-spacing:-.03em;opacity:0;transform:translateY(14px);transition:opacity .55s var(--ease,ease),transform .55s var(--ease,ease)}"+
    ".rec-cap p.on{opacity:1;transform:none}.rec-cap em{font-style:normal;color:var(--gold,#d9a31b)}"+
    ".rec-capsula{position:absolute;z-index:4;height:14px;width:14px;transform:translate(-50%,-50%);border:1px solid var(--gold,#d9a31b);border-radius:999px;background:rgba(16,14,11,.92);display:flex;align-items:center;overflow:hidden;opacity:0}"+
    ".rec-capsula span{font:400 clamp(16px,1.9vw,23px)/1 var(--sans,'Instrument Sans',sans-serif);white-space:nowrap;letter-spacing:-.01em;padding-left:26px}"+
    ".rec-capsula span::after{content:'';display:inline-block;width:2px;height:1.05em;margin-left:3px;background:var(--gold,#d9a31b);vertical-align:-.15em;animation:rec-p 1s steps(1) infinite}"+
    "@keyframes rec-p{50%{opacity:0}}"+
    ".rec-res{position:absolute;z-index:3;list-style:none;margin:0;padding:0;width:min(680px,calc(100vw - 48px));transform:translateX(-50%)}"+
    ".rec-res li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 18px;padding:11px 4px;border-bottom:1px solid var(--line,rgba(241,238,230,.15));opacity:0;transform:translateY(10px);transition:opacity .5s var(--ease,ease),transform .5s var(--ease,ease)}"+
    ".rec-res.on li{opacity:1;transform:none}.rec-res li:nth-child(2){transition-delay:.12s}.rec-res li:nth-child(3){transition-delay:.24s}"+
    ".rec-res b{font:400 clamp(16px,1.6vw,21px)/1.2 var(--caps,'Cormorant SC',serif);letter-spacing:.03em;font-weight:400}"+
    ".rec-res small{grid-column:1;font-size:12.5px;color:var(--mute,rgba(241,238,230,.62))}"+
    ".rec-res i{grid-column:2;grid-row:1/3;align-self:center;font:500 11.5px/1 var(--caps,'Cormorant SC',serif);letter-spacing:.14em;font-style:normal;display:inline-flex;align-items:center;gap:7px}"+
    ".rec-res i::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--c)}"+
    ".rec-guia{position:absolute;right:var(--pad,24px);bottom:34px;width:1px;height:84px;background:var(--line,rgba(241,238,230,.15));z-index:3}.rec-guia i{display:block;width:100%;height:100%;background:var(--gold,#d9a31b);transform-origin:top;transform:scaleY(0)}"+
    ".rec-sc{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim,rgba(241,238,230,.36));transition:opacity .4s;z-index:3}";
  document.head.appendChild(css);

  var sm=function(x){ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); }, lerp=function(a,b,t){ return a+(b-a)*t; };

  window.IVSRecorrido=function(pista,opt){
    opt=opt||{};
    var tilt=opt.tilt==null?1:opt.tilt, CX=opt.cx==null?.5:opt.cx, CY=opt.cy==null?.46:opt.cy, TEXTO=opt.texto||"amparo contra actos de particulares";
    var CAPS=opt.captions||["Seis repositorios <em>oficiales.</em>","Cada uno con su buscador y su lógica.","Una sola consulta los <em>recorre.</em>","Los resultados llegan juntos, con su <em>origen.</em>"];
    var capPos=opt.capPos||"abajo-izq";
    pista.innerHTML='<div class="rec-esc"><canvas></canvas><div class="rec-cap"></div><div class="rec-capsula"><span></span></div><ul class="rec-res"></ul><div class="rec-guia"><i></i></div><div class="rec-sc">Desplace para recorrer</div></div>';
    var esc=pista.firstChild,cv=esc.querySelector("canvas"),ctx=cv.getContext("2d"),capEl=esc.querySelector(".rec-cap"),cap=esc.querySelector(".rec-capsula"),
        ct=cap.querySelector("span"),res=esc.querySelector(".rec-res"),guia=esc.querySelector(".rec-guia i"),sc=esc.querySelector(".rec-sc");
    var labs=BASES.map(function(b){ var d=document.createElement("div"); d.className="rec-l"; d.textContent=b[0]; esc.insertBefore(d,capEl); return d; });
    capEl.innerHTML=CAPS.map(function(c,i){ return '<p'+(i===0?' class="on"':'')+'>'+c+'</p>'; }).join("");
    var ps=[].slice.call(capEl.children);
    res.innerHTML=RES.map(function(r){ return '<li style="--c:'+r[3]+'"><b>'+r[0]+'</b><small>'+r[1]+'</small><i>'+r[2]+'</i></li>'; }).join("");
    var W=1,H=1,DPR=Math.min(window.devicePixelRatio||1,2),pend=false,mov=false;
    function medir(){
      var r=esc.getBoundingClientRect(); W=r.width; H=r.height; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR);
      mov=W<640;
      var pad=Math.max(18,Math.min(48,W*.032));
      if(capPos==="derecha"&&!mov){ capEl.style.cssText="right:"+pad+"px;top:50%;width:min(30ch,32vw);height:0"; ps.forEach(function(p){ p.style.top="0"; p.style.bottom="auto"; p.style.transform=""; p.style.textAlign="left"; }); }
      else if(capPos==="arriba"&&!mov){ capEl.style.cssText="left:"+pad+"px;top:96px;width:min(30ch,70vw);height:0"; ps.forEach(function(p){ p.style.top="0"; p.style.bottom="auto"; }); }
      else { capEl.style.cssText="left:"+pad+"px;bottom:clamp(28px,6vh,60px);right:"+pad+"px;height:0"; ps.forEach(function(p){ p.style.top="auto"; p.style.bottom="0"; p.style.maxWidth="18ch"; }); }
    }
    function marco(){
      pend=false;
      var r=pista.getBoundingClientRect(),total=Math.max(r.height-innerHeight,1),p=Math.max(0,Math.min(1,-r.top/total));
      var cx=W*(mov?.5:CX),cy=H*(mov?.38:CY),Rr=Math.min(W*(mov?.38:.3),H*.3,320);
      var junta=sm((p-.2)/.34),radio=Rr*(1-junta)+2,giro=p*5.4-.5+junta*1.4;
      ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,H);
      // guía: la órbita completa, que se desvanece al juntarse
      ctx.lineWidth=1; ctx.strokeStyle="rgba(241,238,230,"+(.12*(1-junta)).toFixed(3)+")";
      ctx.beginPath(); ctx.ellipse(cx,cy,Rr*1.25,Rr*tilt,0,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle="rgba(241,238,230,"+(.06*(1-junta)).toFixed(3)+")";
      ctx.beginPath(); ctx.ellipse(cx,cy,Rr*.62*1.25,Rr*.62*tilt,0,0,Math.PI*2); ctx.stroke();
      var pts=BASES.map(function(b,i){
        var a=giro+i*Math.PI*2/6,x=cx+Math.cos(a)*radio*1.25,y=cy+Math.sin(a)*radio*tilt,depth=(Math.sin(a)+1)/2;
        return {a:a,x:x,y:y,depth:depth,c:b[1]};
      });
      // el hilo que une a las bases (se encoge junto con ellas)
      ctx.strokeStyle="rgba(217,163,27,"+(.34*(1-junta)).toFixed(3)+")"; ctx.lineWidth=1;
      ctx.beginPath(); pts.forEach(function(q,i){ if(i) ctx.lineTo(q.x,q.y); else ctx.moveTo(q.x,q.y); }); ctx.closePath(); ctx.stroke();
      // estela, resplandor y punto de cada base
      pts.slice().sort(function(a,b){ return a.depth-b.depth; }).forEach(function(q){
        var sz=(tilt<1?.7+.6*q.depth:1)*(1-.3*junta);
        for(var k=14;k>=1;k--){
          var aa=q.a-k*.055*(1+junta*.6),xx=cx+Math.cos(aa)*radio*1.25,yy=cy+Math.sin(aa)*radio*tilt;
          ctx.globalAlpha=.34*(1-k/15)*(1-junta*.5); ctx.fillStyle=q.c; ctx.beginPath(); ctx.arc(xx,yy,Math.max(.6,6*sz*(1-k/16)),0,Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha=1;
        var g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,26*sz); g.addColorStop(0,q.c+"88"); g.addColorStop(1,q.c+"00");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(q.x,q.y,26*sz,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=q.c; ctx.beginPath(); ctx.arc(q.x,q.y,7*sz,0,Math.PI*2); ctx.fill();
      });
      // etiquetas
      pts.forEach(function(q,i){
        var o=Math.max(0,1-junta*2.2)*(.78+.22*q.depth);
        labs[i].style.opacity=o.toFixed(2);
        labs[i].style.transform="translate("+(q.x-6).toFixed(1)+"px,"+(q.y-30).toFixed(1)+"px)";
      });
      // el punto en el que se funden: un destello y un anillo que se expande
      var cn=sm((p-.5)/.12),fade=1-sm((p-.64)/.06);
      if(cn>0){
        var rad=lerp(0,34,cn)*fade+2,g2=ctx.createRadialGradient(cx,cy,0,cx,cy,rad+22); g2.addColorStop(0,"rgba(255,226,140,.9)"); g2.addColorStop(.35,"rgba(217,163,27,.55)"); g2.addColorStop(1,"rgba(217,163,27,0)");
        ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(cx,cy,rad+22,0,Math.PI*2); ctx.fill();
        var sh=sm((p-.54)/.16); ctx.strokeStyle="rgba(217,163,27,"+(.55*(1-sh)).toFixed(3)+")"; ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.arc(cx,cy,8+Math.min(W,H)*.2*sh,0,Math.PI*2); ctx.stroke();
      }
      // la cápsula de búsqueda y los resultados
      var cp=sm((p-.62)/.22),ancho=Math.min(660,W-48);
      cap.style.left=cx+"px"; cap.style.top=cy+"px";
      cap.style.opacity=cp>.01?1:0; cap.style.width=lerp(14,ancho,cp).toFixed(0)+"px"; cap.style.height=lerp(14,60,cp).toFixed(0)+"px";
      var tt=sm((p-.78)/.1); ct.style.opacity=tt>0?1:0; ct.textContent=TEXTO.slice(0,Math.round(TEXTO.length*tt));
      res.style.left=cx+"px"; res.style.top=(cy+46)+"px"; res.classList.toggle("on",p>.9);
      var seg=p<.2?0:p<.5?1:p<.78?2:3; ps.forEach(function(el,i){ el.classList.toggle("on",i===seg); });
      guia.style.transform="scaleY("+p.toFixed(3)+")"; sc.style.opacity=p<.03?1:0;
    }
    function pedir(){ if(!pend){ pend=true; requestAnimationFrame(marco); } }
    medir(); marco();
    addEventListener("scroll",pedir,{passive:true});
    addEventListener("resize",function(){ medir(); pedir(); });
  };
})();
