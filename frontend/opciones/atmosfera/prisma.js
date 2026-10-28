/* El prisma de la portada (el mismo dibujo de ../../portada/shared.js) detrás del contenido de cada opción.
   o.host  contenedor donde se dibuja: el lienzo ocupa todo su tamaño
   o.eje   elemento cuyo centro es el prisma, o una función(rectDelHost) que devuelve ese elemento o {x,y} relativo al host
   o.z     capa del lienzo (-1: detrás del contenido del host)
   o.half  media altura, en px, del abanico de entradas */
(function(){
  window.prismaEn=function(o){
    if(!window.IVSPrisma) return null;
    var host=typeof o.host==="string"?document.querySelector(o.host):o.host; if(!host) return null;
    var z=o.z==null?-1:o.z, cv=document.createElement("canvas");
    cv.setAttribute("aria-hidden","true");
    cv.style.cssText="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:"+z;
    if(getComputedStyle(host).position==="static") host.style.position="relative";
    host.insertBefore(cv,host.firstChild);
    function pos(){
      var h=host.getBoundingClientRect(), e=typeof o.eje==="function"?o.eje(h):o.eje;
      if(typeof e==="string") e=document.querySelector(e);
      if(!e) return {x:h.width/2,y:h.height/2};
      if(e.nodeType!==1) return e;
      var r=e.getBoundingClientRect(); return {x:r.left+r.width/2-h.left,y:r.top+r.height/2-h.top};
    }
    var pr=IVSPrisma(cv,{
      px:function(W){ return pos().x/W; },
      cy:function(W,H){ return pos().y/H; },
      band:function(W,H){ var c=pos().y/H, m=Math.max(40,Math.min(H*.13,o.half||150))/H; return [c-m,c+m]; },
      sinHaces:function(W){ return W<=760; }
    });
    var tri=cv.nextSibling; if(tri&&tri.style) tri.style.zIndex=z;
    function medir(){ pr.medir(); }
    if(window.ResizeObserver) new ResizeObserver(medir).observe(host);
    addEventListener("load",medir);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(medir);
    return pr;
  };
})();
