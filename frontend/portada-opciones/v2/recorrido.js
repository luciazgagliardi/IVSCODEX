/* La parte del recorrido: seis puntos (las seis bases) giran separados, al bajar se juntan en uno y ese
   punto se abre en el campo de búsqueda. El movimiento es el de la portada 1; lo que cambia es cómo se ven.
   Estilos:  punto · sello · hilos · orbitas */
window.IVSRecorrido=function(sec,estilo){
  var B=[["MZA","--c-mza"],["MZA LEGAL","--c-mzl"],["TSJ","--c-caba"],["CSJN","--c-csjn"],["SAIJ","--c-saij"],["DIALNET","--c-dial"]];
  var TEXTO="amparo contra actos de particulares";
  var esc=sec.querySelector(".reco-escena"),centro=sec.querySelector(".reco-centro"),nuc=sec.querySelector(".reco-nucleo"),cap=sec.querySelector(".reco-capsula"),
      ct=cap.querySelector("span"),fin=sec.querySelector(".reco-fin"),guia=sec.querySelector(".reco-guia i"),ps=[].slice.call(sec.querySelectorAll(".reco-pies p"));
  var NS="http://www.w3.org/2000/svg",svg=document.createElementNS(NS,"svg");
  svg.setAttribute("class","reco-svg"); svg.setAttribute("aria-hidden","true"); svg.style.cssText="position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none";
  centro.insertBefore(svg,nuc);
  var orb=[],hil=[];
  B.forEach(function(b,i){
    if(estilo==="orbitas"){ var e=document.createElementNS(NS,"ellipse"); e.setAttribute("fill","none"); e.setAttribute("stroke","rgba(241,238,230,.16)"); e.setAttribute("stroke-width","1"); svg.appendChild(e); orb.push(e); }
    if(estilo==="hilos"){ var l=document.createElementNS(NS,"line"); l.setAttribute("stroke","currentColor"); l.setAttribute("stroke-width","1"); l.style.color="var("+b[1]+")"; svg.appendChild(l); hil.push(l); }
  });
  var nodos=B.map(function(b,i){
    var d=document.createElement("div"); d.className="reco-nodo"; d.style.setProperty("--c","var("+b[1]+")");
    d.innerHTML=estilo==="sello"?"<b>"+b[0]+"</b>":"<b class=\"et\">"+b[0]+"</b>";
    centro.insertBefore(d,nuc); return d;
  });
  var sm=function(x){ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); },lerp=function(a,b,t){ return a+(b-a)*t; };
  var pend=false,quieto=matchMedia("(prefers-reduced-motion:reduce)").matches;
  function marco(){
    pend=false;
    var r=sec.getBoundingClientRect(),total=r.height-innerHeight,p=Math.max(0,Math.min(1,-r.top/total));
    if(r.bottom<-50||r.top>innerHeight+50) return;
    var W=esc.clientWidth,H=esc.clientHeight,R=Math.min(W*.36,H*.33,350);
    var junta=sm((p-.27)/.3),giro=p*3.2-.5;
    nodos.forEach(function(n,i){
      var a=giro+i*Math.PI*2/6,x,y;
      if(estilo==="orbitas"){
        var rx=lerp(R*1.18,5,junta),ry=rx*(.34+.07*i),t=i*Math.PI/6,nx=rx*Math.cos(a*1.0+i),ny=ry*Math.sin(a*1.0+i);
        x=nx*Math.cos(t)-ny*Math.sin(t); y=nx*Math.sin(t)+ny*Math.cos(t);
        var e=orb[i]; e.setAttribute("rx",rx.toFixed(1)); e.setAttribute("ry",ry.toFixed(1)); e.setAttribute("transform","rotate("+(t*180/Math.PI).toFixed(1)+")"); e.style.opacity=1-sm((junta-.15)/.5);
      }else{
        var radio=lerp(R,4,junta),el=lerp(1,.62,junta); x=Math.cos(a)*radio*1.25; y=Math.sin(a)*radio*el;
      }
      n.style.transform="translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px) scale("+lerp(1,.8,junta).toFixed(2)+")";
      n.firstChild.style.opacity=1-sm((junta-.1)/.35);
      if(estilo==="hilos"){ var l=hil[i]; l.setAttribute("x1","0"); l.setAttribute("y1","0"); l.setAttribute("x2",x.toFixed(1)); l.setAttribute("y2",y.toFixed(1)); l.style.opacity=(.5*(1-sm((junta-.3)/.5))).toFixed(2); }
    });
    var cn=sm((p-.52)/.1); nuc.style.opacity=cn*(1-sm((p-.64)/.06)); nuc.style.transform="scale("+cn.toFixed(2)+")";
    var cp=sm((p-.62)/.24),ancho=Math.min(680,W-48);
    cap.style.opacity=cp>.01?1:0; cap.style.width=lerp(14,ancho,cp).toFixed(0)+"px"; cap.style.height=lerp(14,64,cp).toFixed(0)+"px"; cap.style.padding="0 "+lerp(0,26,cp).toFixed(0)+"px";
    var tt=sm((p-.78)/.12); ct.style.opacity=tt>0?1:0; ct.textContent=TEXTO.slice(0,Math.round(TEXTO.length*tt));
    var seg=p<.26?0:p<.56?1:p<.86?2:3;
    ps.forEach(function(el,i){ el.classList.toggle("on",i===seg); });
    fin.classList.toggle("on",p>.9);
    guia.style.transform="scaleY("+p.toFixed(3)+")";
  }
  function pedir(){ if(!pend){ pend=true; requestAnimationFrame(marco); } }
  addEventListener("scroll",pedir,{passive:true}); addEventListener("resize",pedir); marco();
};
