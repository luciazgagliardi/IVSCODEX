/* ============================================================
   Herramientas para preparar PDF antes de presentarlos.

   Todo se hace en el navegador de quien lo usa: los archivos no se envían a
   ningún servidor (la única excepción es el OCR, que necesita el servidor de
   la plataforma y no guarda el archivo). Es lo que corresponde para
   documentos de un expediente: no salen de la computadora.

   Bibliotecas, cargadas recién cuando se usan (ver vendor/):
     - pdf-lib  (MIT)         unir, dividir, foliar, armar PDF desde imágenes
     - pdf.js   (Apache-2.0)  dibujar las páginas para reducir el tamaño
   ============================================================ */
(function(){
  "use strict";

  // La aplicación expone lo que hace falta en window.IVS (ver el final de index.html).
  function esc(s){ return window.IVS.esc(s); }
  function flash(m){ window.IVS.flash(m); }
  function copiar(t){ window.IVS.copiar(t); }
  function api(){ return window.IVS.estado().api; }

  var HERR={ ocupado:"", msg:{}, unir:[], dividir:{file:null,paginas:0,partes:[]}, foliar:{file:null,paginas:0},
             comprimir:{file:null,paginas:0,res:null}, ocr:{file:null,texto:"",nombre:""}, ultimo:{} };
  window.HERR=HERR;

  var LIM_MB=150, LIM_PAGINAS=500;

  /* ---------- utilidades ---------- */
  function kb(n){ return n>=1048576?(n/1048576).toFixed(2).replace(".",",")+" MB":Math.max(1,Math.round(n/1024))+" KB"; }
  function limpiarNombre(s){ return String(s||"archivo").replace(/\.[^.]+$/,"").replace(/[^\w\- áéíóúüñÁÉÍÓÚÜÑ]/g,"").trim().slice(0,60)||"archivo"; }
  function esPdf(f){ return /\.pdf$/i.test(f.name)||f.type==="application/pdf"; }
  function esImg(f){ return /\.(jpe?g|png)$/i.test(f.name)||/^image\/(jpeg|png)$/.test(f.type); }
  function leer(f){ return f.arrayBuffer().then(function(b){ return new Uint8Array(b); }); }
  function descargar(bytes,nombre,tipo){
    var blob=new Blob([bytes],{type:tipo||"application/pdf"});
    var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
  }
  function aviso(tool,texto,mal){ HERR.msg[tool]={t:texto,mal:!!mal}; }
  function progreso(tool,texto){ var e=document.getElementById("her-estado-"+tool); if(e){ e.textContent=texto; e.className="her-estado"; } }
  function redibujar(){ window.IVS.render(); }
  function pausa(){ return new Promise(function(r){ setTimeout(r,0); }); }

  var cargaPdfLib=null;
  function pdfLib(){
    if(window.PDFLib) return Promise.resolve(window.PDFLib);
    if(!cargaPdfLib) cargaPdfLib=new Promise(function(ok,mal){
      var s=document.createElement("script"); s.src="./vendor/pdf-lib.min.js";
      s.onload=function(){ ok(window.PDFLib); }; s.onerror=function(){ cargaPdfLib=null; mal(new Error("No se pudo cargar el módulo de PDF.")); };
      document.head.appendChild(s);
    });
    return cargaPdfLib;
  }
  var cargaPdfJs=null;
  function pdfJs(){
    if(!cargaPdfJs) cargaPdfJs=import("./vendor/pdf.min.mjs").then(function(m){
      m.GlobalWorkerOptions.workerSrc=new URL("./vendor/pdf.worker.min.mjs",location.href).href; return m;
    })["catch"](function(e){ cargaPdfJs=null; throw e; });
    return cargaPdfJs;
  }

  /* ZIP sin compresión (los PDF ya vienen comprimidos): para bajar varias partes de una vez. */
  var CRC=null;
  function crc32(b){
    if(!CRC){ CRC=new Uint32Array(256); for(var n=0;n<256;n++){ var c=n; for(var k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; CRC[n]=c>>>0; } }
    var c2=0xFFFFFFFF; for(var i=0;i<b.length;i++) c2=CRC[(c2^b[i])&255]^(c2>>>8); return (c2^0xFFFFFFFF)>>>0;
  }
  function zip(archivos){
    var enc=new TextEncoder(),partes=[],central=[],pos=0,hoy=new Date();
    var hora=(hoy.getHours()<<11)|(hoy.getMinutes()<<5)|(hoy.getSeconds()>>1),fecha=((hoy.getFullYear()-1980)<<9)|((hoy.getMonth()+1)<<5)|hoy.getDate();
    archivos.forEach(function(a){
      var nom=enc.encode(a.nombre),crc=crc32(a.bytes),lh=new DataView(new ArrayBuffer(30));
      lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true);
      lh.setUint16(10,hora,true); lh.setUint16(12,fecha,true); lh.setUint32(14,crc,true);
      lh.setUint32(18,a.bytes.length,true); lh.setUint32(22,a.bytes.length,true); lh.setUint16(26,nom.length,true); lh.setUint16(28,0,true);
      var ch=new DataView(new ArrayBuffer(46));
      ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint16(10,0,true);
      ch.setUint16(12,hora,true); ch.setUint16(14,fecha,true); ch.setUint32(16,crc,true);
      ch.setUint32(20,a.bytes.length,true); ch.setUint32(24,a.bytes.length,true); ch.setUint16(28,nom.length,true); ch.setUint32(42,pos,true);
      partes.push(new Uint8Array(lh.buffer),nom,a.bytes);
      central.push(new Uint8Array(ch.buffer),nom);
      pos+=30+nom.length+a.bytes.length;
    });
    var tam=0; central.forEach(function(c){ tam+=c.length; });
    var fin=new DataView(new ArrayBuffer(22));
    fin.setUint32(0,0x06054b50,true); fin.setUint16(8,archivos.length,true); fin.setUint16(10,archivos.length,true);
    fin.setUint32(12,tam,true); fin.setUint32(16,pos,true);
    return new Blob(partes.concat(central,[new Uint8Array(fin.buffer)]),{type:"application/zip"});
  }

  /* "1-3, 5, 8-10" -> [[1,2,3],[5],[8,9,10]]; tira un Error con el motivo si algo no cierra. */
  function leerRangos(texto,total){
    var grupos=String(texto||"").split(/[;,]+/).map(function(s){ return s.trim(); }).filter(Boolean);
    if(!grupos.length) throw new Error("Escriba al menos un rango, por ejemplo 1-3, 4-6.");
    return grupos.map(function(g){
      var m=/^(\d+)\s*(?:-|–|a)\s*(\d+)$/.exec(g)||/^(\d+)$/.exec(g);
      if(!m) throw new Error("No se entiende «"+g+"». Use números y guiones, por ejemplo 1-3, 5, 8-10.");
      var a=+m[1],b=m[2]?+m[2]:a;
      if(a<1||b<a||b>total) throw new Error("El rango «"+g+"» no es válido: el documento tiene "+total+" páginas.");
      var r=[]; for(var i=a;i<=b;i++) r.push(i); return r;
    });
  }

  function contarPaginas(f){
    return Promise.all([pdfLib(),leer(f)]).then(function(x){
      return x[0].PDFDocument.load(x[1],{ignoreEncryption:true,updateMetadata:false}).then(function(d){ return d.getPageCount(); });
    });
  }

  /* ---------- 1. unir ---------- */
  function unirIr(){
    if(HERR.unir.length<1) return;
    HERR.ocupado="unir"; aviso("unir","",false); redibujar();
    var L,doc,t0=Date.now();
    pdfLib().then(function(lib){ L=lib; return L.PDFDocument.create(); }).then(function(d){
      doc=d; var i=0;
      function sig(){
        if(i>=HERR.unir.length) return;
        var f=HERR.unir[i].file; progreso("unir","Procesando "+(i+1)+" de "+HERR.unir.length+": "+f.name);
        i++;
        return leer(f).then(function(b){
          if(esPdf(f)) return L.PDFDocument.load(b,{ignoreEncryption:true}).then(function(o){
            return doc.copyPages(o,o.getPageIndices()).then(function(ps){ ps.forEach(function(p){ doc.addPage(p); }); });
          });
          var emb=/png$/i.test(f.name)||f.type==="image/png"?doc.embedPng(b):doc.embedJpg(b);
          return emb.then(function(img){
            var A4=[595.28,841.89],hor=img.width>img.height,W=hor?A4[1]:A4[0],H=hor?A4[0]:A4[1],m=18;
            var k=Math.min((W-2*m)/img.width,(H-2*m)/img.height),w=img.width*k,h=img.height*k;
            var pg=doc.addPage([W,H]); pg.drawImage(img,{x:(W-w)/2,y:(H-h)/2,width:w,height:h});
          });
        }).then(pausa).then(sig);
      }
      return sig();
    }).then(function(){ return doc.save({useObjectStreams:true}); }).then(function(bytes){
      HERR.ultimo.unir={bytes:bytes,nombre:"documento-unido.pdf"};
      descargar(bytes,"documento-unido.pdf");
      aviso("unir","Listo: "+doc.getPageCount()+" páginas, "+kb(bytes.length)+". Se descargó «documento-unido.pdf».");
    })["catch"](function(e){
      aviso("unir","No se pudo unir los archivos: "+(e&&e.message?e.message:"un archivo está dañado o protegido")+".",true);
    }).then(function(){ HERR.ocupado=""; redibujar(); });
  }

  /* ---------- 2. dividir ---------- */
  function dividirIr(){
    var D=HERR.dividir; if(!D.file) return;
    var modo=(document.querySelector('input[name="her-div-modo"]:checked')||{}).value||"rangos";
    var rangosTxt=(document.getElementById("her-div-rangos")||{}).value||"";
    var maxMb=parseFloat(String((document.getElementById("her-div-mb")||{}).value||"").replace(",","."));
    HERR.ocupado="dividir"; D.partes=[]; aviso("dividir","",false); D.modo=modo; D.rangos=rangosTxt; D.mb=isNaN(maxMb)?"":(document.getElementById("her-div-mb")||{}).value; redibujar();
    var L,origen,base=limpiarNombre(D.file.name);
    Promise.all([pdfLib(),leer(D.file)]).then(function(x){ L=x[0]; return L.PDFDocument.load(x[1],{ignoreEncryption:true}); }).then(function(o){
      origen=o; var total=o.getPageCount(),grupos;
      function construir(paginas){
        return L.PDFDocument.create().then(function(d){ return d.copyPages(origen,paginas.map(function(p){return p-1;})).then(function(ps){ ps.forEach(function(p){ d.addPage(p); }); return d.save({useObjectStreams:true}); }); });
      }
      if(modo==="rangos"){ grupos=leerRangos(rangosTxt,total); return Promise.resolve(grupos).then(function(g){ return {grupos:g,construir:construir}; }); }
      if(!(maxMb>0)) throw new Error("Indique el tamaño máximo por parte, en MB (por ejemplo 5).");
      var limite=maxMb*1048576*0.92,tam=[],i=0;
      function medir(){
        if(i>=total) return;
        var n=i+1; i++; progreso("dividir","Midiendo la página "+n+" de "+total);
        return construir([n]).then(function(b){ tam.push(b.length); }).then(pausa).then(medir);
      }
      return medir().then(function(){
        var g=[],act=[],suma=0;
        for(var p=1;p<=total;p++){
          if(act.length&&suma+tam[p-1]>limite){ g.push(act); act=[]; suma=0; }
          act.push(p); suma+=tam[p-1];
        }
        if(act.length) g.push(act);
        return {grupos:g,construir:construir};
      });
    }).then(function(plan){
      var k=0;
      function sig(){
        if(k>=plan.grupos.length) return;
        var g=plan.grupos[k],n=k+1; k++;
        progreso("dividir","Armando la parte "+n+" de "+plan.grupos.length);
        return plan.construir(g).then(function(b){
          var rot=g.length>1?"p"+g[0]+"-"+g[g.length-1]:"p"+g[0];
          D.partes.push({nombre:base+"-parte"+n+"-"+rot+".pdf",bytes:b,paginas:g.length});
        }).then(pausa).then(sig);
      }
      return sig();
    }).then(function(){
      var gran=D.partes.filter(function(p){ return modo!=="rangos"&&maxMb>0&&p.bytes.length>maxMb*1048576&&p.paginas===1; }).length;
      aviso("dividir","Se armaron "+D.partes.length+" parte(s)."+(gran?" Atención: "+gran+" página(s) pesan por sí solas más que el máximo pedido; pruebe «Reducir el tamaño».":""));
    })["catch"](function(e){
      aviso("dividir","No se pudo dividir: "+(e&&e.message?e.message:"el archivo está dañado o protegido")+".",true);
    }).then(function(){ HERR.ocupado=""; redibujar(); });
  }

  /* ---------- 3. foliar ---------- */
  // Pasa un punto de la página tal como se VE (con la rotación aplicada) a las
  // coordenadas del PDF sin rotar.
  function aPdf(r,W,H,vx,vy){
    if(r===90)  return {x:W-vy,y:vx};
    if(r===180) return {x:W-vx,y:H-vy};
    if(r===270) return {x:vy,y:H-vx};
    return {x:vx,y:vy};
  }
  function foliarIr(){
    var F=HERR.foliar; if(!F.file) return;
    var pre=(document.getElementById("her-fol-pre")||{}).value, ini=parseInt((document.getElementById("her-fol-ini")||{}).value,10),
        pos=(document.getElementById("her-fol-pos")||{}).value||"abajo-derecha",
        total=!!(document.getElementById("her-fol-total")||{}).checked,
        tam=parseFloat((document.getElementById("her-fol-tam")||{}).value)||11;
    if(pre==null) pre="Fs. ";
    if(isNaN(ini)||ini<0) ini=1;
    F.pre=pre; F.ini=ini; F.pos=pos; F.total=total; F.tam=tam;
    HERR.ocupado="foliar"; aviso("foliar","",false); redibujar();
    var L,n0;
    Promise.all([pdfLib(),leer(F.file)]).then(function(x){ L=x[0]; return L.PDFDocument.load(x[1],{ignoreEncryption:true}); }).then(function(doc){
      return doc.embedFont(L.StandardFonts.HelveticaBold).then(function(font){
        var pags=doc.getPages(),N=pags.length; n0=N;
        pags.forEach(function(p,i){
          var mb=p.getMediaBox(),W=mb.width,H=mb.height,r=((p.getRotation().angle%360)+360)%360;
          var vw=(r===90||r===270)?H:W,vh=(r===90||r===270)?W:H;
          var txt=pre+(ini+i)+(total?" de "+(ini+N-1):"");
          var tw=font.widthOfTextAtSize(txt,tam),th=tam,m=24,pad=3;
          var vx=pos.indexOf("derecha")>-1?vw-m-tw:(pos.indexOf("centro")>-1?(vw-tw)/2:m);
          var vy=pos.indexOf("arriba")===0?vh-m-th:m;
          var a=aPdf(r,mb.width,mb.height,vx,vy),b=aPdf(r,mb.width,mb.height,vx-pad,vy-pad);
          // caja blanca detrás para que se lea sobre cualquier fondo
          var cx=aPdf(r,mb.width,mb.height,vx-pad,vy-pad),cy=aPdf(r,mb.width,mb.height,vx+tw+pad,vy+th+pad);
          p.drawRectangle({x:Math.min(cx.x,cy.x)+mb.x,y:Math.min(cx.y,cy.y)+mb.y,width:Math.abs(cy.x-cx.x),height:Math.abs(cy.y-cx.y),color:L.rgb(1,1,1),opacity:.9});
          p.drawText(txt,{x:a.x+mb.x,y:a.y+mb.y,size:tam,font:font,color:L.rgb(0,0,0),rotate:L.degrees(r)});
        });
        return doc.save({useObjectStreams:true});
      });
    }).then(function(bytes){
      var nom=limpiarNombre(F.file.name)+"-foliado.pdf";
      HERR.ultimo.foliar={bytes:bytes,nombre:nom};
      descargar(bytes,nom);
      aviso("foliar","Listo: "+n0+" páginas numeradas desde "+(pre+ini)+". Se descargó «"+nom+"».");
    })["catch"](function(e){
      aviso("foliar","No se pudo foliar: "+(e&&e.message?e.message:"el archivo está dañado o protegido")+".",true);
    }).then(function(){ HERR.ocupado=""; redibujar(); });
  }

  /* ---------- 4. reducir el tamaño ---------- */
  var CALIDADES={ alta:{dpi:150,q:.72,nombre:"Alta (letra chica y firmas nítidas)"}, media:{dpi:110,q:.6,nombre:"Media (la mayoría de los escritos)"}, baja:{dpi:80,q:.5,nombre:"Baja (lo más liviano)"} };
  function comprimirIr(){
    var C=HERR.comprimir; if(!C.file) return;
    var cal=(document.querySelector('input[name="her-com-cal"]:checked')||{}).value||"media";
    var modo=(document.querySelector('input[name="her-com-modo"]:checked')||{}).value||"imagenes";
    C.cal=cal; C.modo=modo; C.res=null;
    HERR.ocupado="comprimir"; aviso("comprimir","",false); redibujar();
    var original=C.file.size,L;
    pdfLib().then(function(lib){ L=lib; return leer(C.file); }).then(function(datos){
      if(modo==="estructura"){
        return L.PDFDocument.load(datos,{ignoreEncryption:true}).then(function(d){
          d.setTitle(""); d.setAuthor(""); d.setSubject(""); d.setKeywords([]); d.setProducer("IVS CODEX"); d.setCreator("IVS CODEX");
          return d.save({useObjectStreams:true});
        });
      }
      var Q=CALIDADES[cal]||CALIDADES.media;
      return pdfJs().then(function(pjs){
        return pjs.getDocument({data:datos.slice(),isEvalSupported:false}).promise.then(function(pdf){
          var n=pdf.numPages; if(n>LIM_PAGINAS) throw new Error("El documento tiene "+n+" páginas; el máximo para esta herramienta es "+LIM_PAGINAS+".");
          return L.PDFDocument.create().then(function(out){
            var i=1;
            function sig(){
              if(i>n) return out.save({useObjectStreams:true});
              var num=i++; progreso("comprimir","Reduciendo la página "+num+" de "+n);
              return pdf.getPage(num).then(function(pg){
                var base=pg.getViewport({scale:1}),vp=pg.getViewport({scale:Q.dpi/72});
                var cv=document.createElement("canvas"); cv.width=Math.ceil(vp.width); cv.height=Math.ceil(vp.height);
                var cx=cv.getContext("2d"); cx.fillStyle="#fff"; cx.fillRect(0,0,cv.width,cv.height);
                return pg.render({canvasContext:cx,viewport:vp}).promise.then(function(){
                  return new Promise(function(ok){ cv.toBlob(ok,"image/jpeg",Q.q); });
                }).then(function(blob){ return blob.arrayBuffer(); }).then(function(buf){
                  return out.embedJpg(new Uint8Array(buf)).then(function(img){
                    var p=out.addPage([base.width,base.height]); p.drawImage(img,{x:0,y:0,width:base.width,height:base.height});
                    cv.width=cv.height=0; // libera la memoria del lienzo
                  });
                });
              }).then(pausa).then(sig);
            }
            return sig();
          });
        });
      });
    }).then(function(bytes){
      var nom=limpiarNombre(C.file.name)+"-reducido.pdf",ahorro=Math.round(100-bytes.length*100/original);
      C.res={bytes:bytes,nombre:nom,antes:original,despues:bytes.length};
      if(bytes.length>=original){
        aviso("comprimir","El resultado pesa "+kb(bytes.length)+", igual o más que el original ("+kb(original)+"). Este archivo ya está optimizado; pruebe con calidad más baja.",true);
      }else{
        descargar(bytes,nom);
        aviso("comprimir","Listo: de "+kb(original)+" a "+kb(bytes.length)+" ("+ahorro+" % menos). Se descargó «"+nom+"».");
      }
    })["catch"](function(e){
      aviso("comprimir","No se pudo reducir el archivo: "+(e&&e.message?e.message:"está dañado o protegido")+".",true);
    }).then(function(){ HERR.ocupado=""; redibujar(); });
  }

  /* ---------- 5. reconocimiento de texto (OCR) ---------- */
  function ocrIr(){
    var O=HERR.ocr; if(!O.file) return;
    if(!api()){ aviso("ocr","El servidor de la plataforma no está disponible en este momento; el reconocimiento de texto necesita conectarse.",true); redibujar(); return; }
    HERR.ocupado="ocr"; O.texto=""; aviso("ocr","",false); redibujar();
    progreso("ocr","Reconociendo el texto… puede tardar uno o dos minutos.");
    fetch(api()+"/ocr-archivo",{method:"POST",headers:{"Content-Type":"application/pdf","X-Nombre-Archivo":encodeURIComponent(O.file.name).slice(0,180)},body:O.file})
      .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
      .then(function(x){
        if(!x.ok||!x.d||x.d.ok===false) throw new Error((x.d&&x.d.mensaje)||"el servidor no pudo procesar el archivo");
        O.texto=x.d.texto||""; O.nombre=limpiarNombre(O.file.name)+"-texto.txt";
        aviso("ocr","Listo: "+(x.d.caracteres||O.texto.length).toLocaleString("es-AR")+" caracteres reconocidos en "+(x.d.paginasProcesadas||x.d.paginas||"?")+" página(s)."+
          (x.d.paginas&&x.d.paginasProcesadas&&x.d.paginasProcesadas<x.d.paginas?" El servidor procesa como máximo "+x.d.paginasProcesadas+" páginas por pedido: divida el archivo para el resto.":""));
      })["catch"](function(e){
        aviso("ocr","No se pudo reconocer el texto: "+(e&&e.message?e.message:"error de conexión")+".",true);
      }).then(function(){ HERR.ocupado=""; redibujar(); });
  }

  /* ---------- selección de archivos ---------- */
  function alElegir(ev){
    var t=ev.target; if(!t||t.type!=="file") return;
    var fs=[].slice.call(t.files||[]); if(!fs.length) return;
    var excede=fs.filter(function(f){ return f.size>LIM_MB*1048576; });
    if(excede.length){ flash("«"+excede[0].name+"» supera los "+LIM_MB+" MB."); t.value=""; return; }
    if(t.id==="her-unir-in"){
      var ok=fs.filter(function(f){ return esPdf(f)||esImg(f); }),no=fs.length-ok.length;
      ok.forEach(function(f){ HERR.unir.push({file:f}); });
      aviso("unir",no?no+" archivo(s) ignorados: solo se aceptan PDF, JPG y PNG. Para Word, guárdelo antes como PDF.":"",!!no);
      redibujar();
    }else if(t.id==="her-div-in"||t.id==="her-fol-in"||t.id==="her-com-in"||t.id==="her-ocr-in"){
      var f=fs[0],clave=t.id==="her-div-in"?"dividir":t.id==="her-fol-in"?"foliar":t.id==="her-com-in"?"comprimir":"ocr";
      if(!esPdf(f)){ aviso(clave,"Elija un archivo PDF.",true); redibujar(); return; }
      HERR[clave].file=f; if(clave==="dividir") HERR.dividir.partes=[]; if(clave==="comprimir") HERR.comprimir.res=null; if(clave==="ocr") HERR.ocr.texto="";
      aviso(clave,"",false);
      if(clave!=="ocr"){
        contarPaginas(f).then(function(n){ HERR[clave].paginas=n; redibujar(); })["catch"](function(){
          HERR[clave].file=null; aviso(clave,"No se pudo abrir «"+f.name+"»: está dañado o protegido con contraseña.",true); redibujar();
        });
      } else redibujar();
    }
  }

  function alClic(ev){
    var b=ev.target.closest&&ev.target.closest("[data-her]"); if(!b) return;
    var acc=b.getAttribute("data-her"),i=parseInt(b.getAttribute("data-i"),10);
    if(HERR.ocupado&&acc!=="x") return;
    if(acc==="unir-go") unirIr();
    else if(acc==="unir-sube"&&i>0){ var u=HERR.unir; var t=u[i]; u[i]=u[i-1]; u[i-1]=t; redibujar(); }
    else if(acc==="unir-baja"&&i<HERR.unir.length-1){ var u2=HERR.unir; var t2=u2[i]; u2[i]=u2[i+1]; u2[i+1]=t2; redibujar(); }
    else if(acc==="unir-quita"){ HERR.unir.splice(i,1); aviso("unir","",false); redibujar(); }
    else if(acc==="unir-vaciar"){ HERR.unir=[]; aviso("unir","",false); redibujar(); }
    else if(acc==="unir-otra"&&HERR.ultimo.unir) descargar(HERR.ultimo.unir.bytes,HERR.ultimo.unir.nombre);
    else if(acc==="dividir-go") dividirIr();
    else if(acc==="dividir-una"&&HERR.dividir.partes[i]) descargar(HERR.dividir.partes[i].bytes,HERR.dividir.partes[i].nombre);
    else if(acc==="dividir-zip"&&HERR.dividir.partes.length){
      var z=zip(HERR.dividir.partes.map(function(p){ return {nombre:p.nombre,bytes:p.bytes}; }));
      descargar(z,limpiarNombre(HERR.dividir.file.name)+"-partes.zip","application/zip");
    }
    else if(acc==="foliar-go") foliarIr();
    else if(acc==="foliar-otra"&&HERR.ultimo.foliar) descargar(HERR.ultimo.foliar.bytes,HERR.ultimo.foliar.nombre);
    else if(acc==="comprimir-go") comprimirIr();
    else if(acc==="comprimir-otra"&&HERR.comprimir.res) descargar(HERR.comprimir.res.bytes,HERR.comprimir.res.nombre);
    else if(acc==="ocr-go") ocrIr();
    else if(acc==="ocr-txt"&&HERR.ocr.texto) descargar(new TextEncoder().encode(HERR.ocr.texto),HERR.ocr.nombre,"text/plain;charset=utf-8");
    else if(acc==="ocr-copiar"&&HERR.ocr.texto) copiar(HERR.ocr.texto);
    else if(acc==="ocr-lector"&&HERR.ocr.texto) window.IVS.abrirLector(HERR.ocr.texto);
  }

  document.addEventListener("change",alElegir);
  document.addEventListener("click",alClic);

  /* ---------- la vista ---------- */
  function msg(tool){
    var m=HERR.msg[tool],ocup=HERR.ocupado===tool;
    return '<p class="her-estado'+(m&&m.mal?' mal':'')+'" id="her-estado-'+tool+'" role="status">'+
      (ocup?'Procesando…':(m&&m.t?esc(m.t):''))+'</p>';
  }
  function zona(id,texto,multiple,accept){
    return '<label class="her-zona" for="'+id+'"><span class="her-zona__t">'+texto+'</span>'+
      '<input type="file" id="'+id+'"'+(multiple?' multiple':'')+' accept="'+accept+'"></label>';
  }
  function tarjeta(n,titulo,desc,cuerpo){
    return '<section class="her"><header class="her-cab"><span class="her-n" aria-hidden="true">'+n+'</span>'+
      '<div><h2>'+titulo+'</h2><p>'+desc+'</p></div></header>'+cuerpo+'</section>';
  }
  function boton(acc,texto,sec,i,deshab){
    return '<button type="button" class="btn'+(sec?' sec':'')+'" data-her="'+acc+'"'+(i!=null?' data-i="'+i+'"':'')+(deshab?' disabled':'')+'>'+texto+'</button>';
  }

  window.vistaHerramientas=function(){
    var o=HERR.ocupado,dis=!!o,U=HERR.unir,D=HERR.dividir,F=HERR.foliar,C=HERR.comprimir,O=HERR.ocr,h="";

    h+='<div class="aviso"><span class="av-tit">Sus archivos no salen de su computadora</span>'+
       'Unir, dividir, foliar y reducir se hacen dentro de su navegador: los documentos no se envían a ningún servidor. '+
       'La única herramienta que usa el servidor de la plataforma es el reconocimiento de texto (OCR), y no guarda el archivo.</div>';

    // 1. Unir
    h+=tarjeta(1,"Unir archivos","Junta PDF, fotos (JPG, PNG), partidas y DNI en un único PDF correlativo, en el orden en que los ponga.",
      zona("her-unir-in","<b>Elegir archivos</b> · PDF, JPG o PNG (varios a la vez)",true,".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png")+
      (U.length?'<ol class="her-lista">'+U.map(function(x,i){
        return '<li><span class="her-nom">'+esc(x.file.name)+'</span><span class="her-peso">'+kb(x.file.size)+'</span>'+
          '<span class="her-ctl"><button type="button" class="mini" data-her="unir-sube" data-i="'+i+'" aria-label="Subir"'+(i===0||dis?' disabled':'')+'>↑</button>'+
          '<button type="button" class="mini" data-her="unir-baja" data-i="'+i+'" aria-label="Bajar"'+(i===U.length-1||dis?' disabled':'')+'>↓</button>'+
          '<button type="button" class="mini" data-her="unir-quita" data-i="'+i+'" aria-label="Quitar"'+(dis?' disabled':'')+'>Quitar</button></span></li>';
      }).join("")+'</ol>':'<p class="vacio">Todavía no hay archivos. Elíjalos arriba; se unen en el orden de la lista.</p>')+
      '<div class="her-acc">'+boton("unir-go","Unir y descargar",false,null,dis||U.length<1)+
        (U.length?boton("unir-vaciar","Vaciar la lista",true,null,dis):"")+
        (HERR.ultimo.unir?boton("unir-otra","Volver a descargar",true,null,dis):"")+'</div>'+msg("unir"));

    // 2. Dividir
    var modoDiv=D.modo||"rangos";
    h+=tarjeta(2,"Dividir un PDF","Parte un documento pesado en archivos más chicos: por rangos de páginas o por un tamaño máximo.",
      zona("her-div-in",D.file?'<b>'+esc(D.file.name)+'</b> · '+D.paginas+' páginas · '+kb(D.file.size)+' (cambiar)':"<b>Elegir un PDF</b>",false,".pdf,application/pdf")+
      (D.file?'<div class="her-opc">'+
        '<label class="her-radio"><input type="radio" name="her-div-modo" value="rangos"'+(modoDiv==="rangos"?' checked':'')+'> Por rangos de páginas</label>'+
        '<label class="campo her-campo"><span>Cada grupo es un archivo (ej.: 1-3, 4-6, 7)</span><input type="text" id="her-div-rangos" value="'+esc(D.rangos||"")+'" placeholder="1-'+Math.min(D.paginas,5)+'" autocomplete="off"></label>'+
        '<label class="her-radio"><input type="radio" name="her-div-modo" value="tamano"'+(modoDiv==="tamano"?' checked':'')+'> Por tamaño máximo de cada parte</label>'+
        '<label class="campo her-campo"><span>Máximo por parte, en MB</span><input type="text" id="her-div-mb" inputmode="decimal" value="'+esc(D.mb||"")+'" placeholder="5" autocomplete="off"></label>'+
      '</div>':'')+
      '<div class="her-acc">'+boton("dividir-go","Dividir",false,null,dis||!D.file)+'</div>'+msg("dividir")+
      (D.partes.length?'<ul class="her-lista">'+D.partes.map(function(p,i){
        return '<li><span class="her-nom">'+esc(p.nombre)+'</span><span class="her-peso">'+p.paginas+' pág. · '+kb(p.bytes.length)+'</span>'+
          '<span class="her-ctl"><button type="button" class="mini" data-her="dividir-una" data-i="'+i+'">Descargar</button></span></li>';
      }).join("")+'</ul><div class="her-acc">'+boton("dividir-zip","Descargar todas (.zip)",true)+'</div>':''));

    // 3. Foliar
    h+=tarjeta(3,"Numerador de fojas","Agrega un número correlativo en cada página (Fs. 1, Fs. 2…) para presentar la prueba documental foliada.",
      zona("her-fol-in",F.file?'<b>'+esc(F.file.name)+'</b> · '+F.paginas+' páginas (cambiar)':"<b>Elegir un PDF</b>",false,".pdf,application/pdf")+
      (F.file?'<div class="her-opc her-opc--fila">'+
        '<label class="campo her-campo"><span>Texto antes del número</span><input type="text" id="her-fol-pre" value="'+esc(F.pre==null?"Fs. ":F.pre)+'" maxlength="12" autocomplete="off"></label>'+
        '<label class="campo her-campo"><span>Empezar en</span><input type="text" id="her-fol-ini" inputmode="numeric" value="'+esc(F.ini==null?1:F.ini)+'" autocomplete="off"></label>'+
        '<label class="campo her-campo"><span>Tamaño (puntos)</span><input type="text" id="her-fol-tam" inputmode="numeric" value="'+esc(F.tam||11)+'" autocomplete="off"></label>'+
        '<label class="campo her-campo"><span>Posición</span><select id="her-fol-pos">'+
          [["abajo-derecha","Abajo, a la derecha"],["abajo-centro","Abajo, al centro"],["arriba-derecha","Arriba, a la derecha"],["arriba-centro","Arriba, al centro"]].map(function(p){
            return '<option value="'+p[0]+'"'+((F.pos||"abajo-derecha")===p[0]?' selected':'')+'>'+p[1]+'</option>'; }).join("")+'</select></label>'+
        '<label class="her-radio"><input type="checkbox" id="her-fol-total"'+(F.total?' checked':'')+'> Agregar «de N» (Fs. 3 de 40)</label>'+
      '</div>':'')+
      '<div class="her-acc">'+boton("foliar-go","Foliar y descargar",false,null,dis||!F.file)+
        (HERR.ultimo.foliar?boton("foliar-otra","Volver a descargar",true,null,dis):"")+'</div>'+msg("foliar"));

    // 4. Reducir
    var cal=C.cal||"media",modoCom=C.modo||"imagenes";
    h+=tarjeta(4,"Reducir el tamaño","Para entrar en el límite de megabytes de cada sistema judicial. Muestra cuánto pesaba y cuánto pesa ahora.",
      zona("her-com-in",C.file?'<b>'+esc(C.file.name)+'</b> · '+C.paginas+' páginas · '+kb(C.file.size)+' (cambiar)':"<b>Elegir un PDF</b>",false,".pdf,application/pdf")+
      (C.file?'<div class="her-opc">'+
        '<label class="her-radio"><input type="radio" name="her-com-modo" value="imagenes"'+(modoCom==="imagenes"?' checked':'')+'> Reducir las imágenes de cada página <em>(el texto deja de ser seleccionable)</em></label>'+
        '<div class="her-sub">'+Object.keys(CALIDADES).map(function(k){
          return '<label class="her-radio"><input type="radio" name="her-com-cal" value="'+k+'"'+(cal===k?' checked':'')+'> '+esc(CALIDADES[k].nombre)+'</label>'; }).join("")+'</div>'+
        '<label class="her-radio"><input type="radio" name="her-com-modo" value="estructura"'+(modoCom==="estructura"?' checked':'')+'> Solo optimizar la estructura <em>(sin pérdida; ahorra poco)</em></label>'+
      '</div>':'')+
      '<div class="her-acc">'+boton("comprimir-go","Reducir y descargar",false,null,dis||!C.file)+
        (C.res&&C.res.despues<C.res.antes?boton("comprimir-otra","Volver a descargar",true,null,dis):"")+'</div>'+msg("comprimir")+
      '<p class="her-nota">Importante: «Reducir las imágenes» convierte cada página en una imagen. Es lo indicado para escaneos; en un PDF con texto, hágalo solo si no necesita buscar ni copiar dentro del archivo.</p>');

    // 5. OCR
    h+=tarjeta(5,"Reconocer el texto (OCR)","Convierte un PDF escaneado, que es solo imagen, en texto que se puede buscar y copiar.",
      zona("her-ocr-in",O.file?'<b>'+esc(O.file.name)+'</b> · '+kb(O.file.size)+' (cambiar)':"<b>Elegir un PDF escaneado</b>",false,".pdf,application/pdf")+
      '<div class="her-acc">'+boton("ocr-go","Reconocer el texto",false,null,dis||!O.file)+'</div>'+msg("ocr")+
      (O.texto?'<textarea class="her-texto" readonly rows="9" aria-label="Texto reconocido">'+esc(O.texto.slice(0,20000))+'</textarea>'+
        '<div class="her-acc">'+boton("ocr-txt","Descargar .txt",true)+boton("ocr-copiar","Copiar",true)+boton("ocr-lector","Abrir en el Lector",true)+'</div>':'')+
      '<p class="her-nota">Este es el único paso que usa el servidor de la plataforma: el archivo viaja de forma cifrada, se procesa en memoria y no se guarda. Procesa unas pocas páginas por pedido; para un expediente largo, divídalo antes.</p>');

    // 6. PDF/A
    h+=tarjeta(6,"Conversión a PDF/A","Algunos sistemas piden el formato archivístico PDF/A.",
      '<p class="her-nota her-nota--solo">Todavía no disponible. Un PDF/A válido exige incrustar tipografías y perfiles de color con un conversor especializado, y no se puede hacer con garantías dentro del navegador. '+
      'Mientras tanto: desde Word elija «Guardar como PDF» y, en «Opciones», marque «Cumplir con PDF/A». Las fotos (JPG, PNG) ya se pueden pasar a PDF con «Unir archivos».</p>');

    return h;
  };
})();
