/* Seis escenas animadas, una por función de la plataforma. Cada una es una pequeña metáfora dibujada en un
   <canvas>, en loop, que arranca de cero cuando entra en pantalla.  IVSEscena(canvas,"consulta").activar(true) */
(function(){
  var CR="241,238,230",CO="217,163,27";
  var BASES=[["MZA","#d9a62a"],["MZA LEGAL","#b58640"],["TSJ","#d5873f"],["CSJN","#c95836"],["SAIJ","#b03b42"],["DIALNET","#a04a68"]];
  function cl(x,a,b){return Math.max(a,Math.min(b,x));}
  function sm(x){x=cl(x,0,1);return x*x*(3-2*x);}
  function lp(a,b,t){return a+(b-a)*t;}
  function rgba(c,a){return "rgba("+c+","+a.toFixed(3)+")";}
  function hexA(h,a){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return "rgba("+r+","+g+","+b+","+a.toFixed(3)+")";}
  function cap(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  var SANS="'Instrument Sans',sans-serif",CAPS="'Cormorant SC',serif",SERIF="'Cormorant',Georgia,serif";
  function F(ctx,wt,px,fam){ctx.font=wt+" "+Math.max(10,px)+"px "+fam;}

  var DRAW={};
  /* 1 · UNA CONSULTA, SEIS BUSCADORES */
  DRAW.consulta=function(ctx,w,h,t,S){
    var T=9.5,u=t%T,fade=1-sm((u-8.2)/1.0),Q="daño moral";
    var cw=Math.min(w*.62,400*S+40),ch=46*S,cx=w/2-cw/2,cy=h*.1;
    ctx.globalAlpha=fade;
    cap(ctx,cx,cy,cw,ch,ch/2);ctx.strokeStyle=rgba(CO,.85);ctx.lineWidth=1.3;ctx.stroke();ctx.fillStyle="rgba(241,238,230,.03)";ctx.fill();
    var n=Math.round(Q.length*sm(u/1.3));F(ctx,400,18*S,SANS);ctx.fillStyle=rgba(CR,.95);ctx.textBaseline="middle";ctx.textAlign="left";
    var tx=cx+22*S;ctx.fillText(Q.slice(0,n),tx,cy+ch/2);
    if(u<2&&Math.floor(u*2)%2===0){var cwid=ctx.measureText(Q.slice(0,n)).width;ctx.fillStyle=rgba(CO,.9);ctx.fillRect(tx+cwid+2,cy+ch*.25,2,ch*.5);}
    var op=['"daño moral"','daño + moral','daño AND moral','daño & moral','daño moral','daño NEAR moral'];
    var cols=3,gw=Math.min(w*.3,176*S+20),gh=58*S,gx=(w-cols*gw-(cols-1)*14*S)/2,gy=h*.46;
    for(var i=0;i<6;i++){
      var c=i%cols,r=(i/cols)|0,x=gx+c*(gw+14*S),y=gy+r*(gh+22*S),ts=1.5+i*.22,p=sm((u-ts)/.9);
      var sx=w/2,sy=cy+ch,ex=x+gw/2,ey=y;
      // hilo del campo al buscador
      var mx=(sx+ex)/2,my=(sy+ey)/2-8;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(mx,my,ex,ey);ctx.strokeStyle=hexA(BASES[i][1],.12+.3*p);ctx.lineWidth=1;ctx.stroke();
      if(u>ts&&u<ts+.9){var q=(u-ts)/.9,xx=(1-q)*(1-q)*sx+2*q*(1-q)*mx+q*q*ex,yy=(1-q)*(1-q)*sy+2*q*(1-q)*my+q*q*ey;
        ctx.fillStyle=hexA(BASES[i][1],.95);ctx.beginPath();ctx.arc(xx,yy,3.2,0,7);ctx.fill();}
      if(p>0){
        ctx.globalAlpha=fade*p;cap(ctx,x,y,gw,gh,gh/2.4);ctx.strokeStyle=hexA(BASES[i][1],.9);ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle=hexA(BASES[i][1],.09);ctx.fill();
        F(ctx,500,11.5*S,CAPS);ctx.fillStyle=hexA(BASES[i][1],1);ctx.textAlign="center";ctx.fillText(BASES[i][0],x+gw/2,y+gh*.34);
        F(ctx,400,12.5*S,SANS);ctx.fillStyle=rgba(CR,.88);ctx.fillText(op[i],x+gw/2,y+gh*.7);ctx.globalAlpha=fade;
      }
    }
    ctx.globalAlpha=1;
  };

  /* 2 · DEL TÉRMINO A SU FAMILIA */
  DRAW.voces=function(ctx,w,h,t,S){
    var T=10.5,u=t%T,fade=1-sm((u-9)/1.1);
    var rx=w/2,ry=h*.9,tx=w/2,ty=h*.6;
    var tips=[[.22,.2,"consecuencias no patrimoniales"],[.5,.07,"daño extrapatrimonial"],[.78,.2,"agravio moral"],[.16,.46,"afección espiritual"],[.84,.46,"sufrimiento"],[.5,.34,"reparación integral"]];
    ctx.globalAlpha=fade;ctx.lineCap="round";
    var g=sm(u/1.1);
    ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx,lp(ry,ty,g));ctx.strokeStyle=rgba(CR,.8);ctx.lineWidth=1.5;ctx.stroke();
    tips.forEach(function(p,i){
      var pr=sm((u-1.0-i*.4)/1.2);if(pr<=0)return;
      var ex=p[0]*w,ey=p[1]*h,cx=lp(tx,ex,.35),cy=lp(ty,ey,.2)-h*.04;
      // punto de la curva a progreso pr (bezier cuadrática, truncada)
      ctx.beginPath();ctx.moveTo(tx,ty);
      for(var k=1;k<=24;k++){var q=pr*k/24,x=(1-q)*(1-q)*tx+2*q*(1-q)*cx+q*q*ex,y=(1-q)*(1-q)*ty+2*q*(1-q)*cy+q*q*ey;ctx.lineTo(x,y);}
      ctx.strokeStyle=rgba(CR,.55);ctx.lineWidth=1.2;ctx.stroke();
      if(pr>.92){var a=sm((pr-.92)/.08);ctx.globalAlpha=fade*a;ctx.fillStyle=rgba(CO,1);ctx.beginPath();ctx.arc(ex,ey,3.4,0,7);ctx.fill();
        F(ctx,400,14*S,SANS);ctx.fillStyle=rgba(CR,.92);ctx.textAlign="center";ctx.textBaseline="bottom";ctx.fillText(p[2],ex,ey-9);ctx.globalAlpha=fade;}
    });
    // raíz: el término
    F(ctx,400,20*S,SANS);ctx.textAlign="center";ctx.textBaseline="top";ctx.fillStyle=rgba(CR,.98);ctx.fillText("daño moral",rx,ry+8);
    ctx.fillStyle=rgba(CO,1);ctx.beginPath();ctx.arc(rx,ry,5,0,7);ctx.fill();
    ctx.globalAlpha=1;
  };

  /* 3 · LO QUE IMPORTA, A LA VISTA */
  DRAW.lector=function(ctx,w,h,t,S){
    var T=10,u=t%T,fade=1-sm((u-8.6)/1.0);
    var L=["Que la reparación del daño moral debe fijarse atendiendo","a las circunstancias del caso y a la entidad del","sufrimiento padecido, sin que pueda resultar meramente","simbólica. Que, valorado el daño moral con prudencia,","corresponde moderar el monto fijado en la instancia","anterior. Que no se configura la cosa juzgada, toda","vez que el daño moral reclamado debe prosperar y","ha de ser cuantificado con arreglo a las pautas fijadas."];
    var HL=[[0,"daño moral"],[3,"daño moral"],[6,"daño moral"]],fs=15*S;
    F(ctx,400,fs,SERIF);var mw=0;L.forEach(function(s){mw=Math.max(mw,ctx.measureText(s).width);});
    var avail=w*.8;if(mw>avail){fs=Math.max(10.5,fs*avail/mw);}
    F(ctx,400,fs,SERIF);var lh=fs*1.7,x0=w*.06,y0=h*.5-(L.length*lh)/2;
    ctx.globalAlpha=fade;ctx.textBaseline="middle";ctx.textAlign="left";
    var count=0;
    L.forEach(function(s,i){
      var y=y0+i*lh+lh/2;ctx.fillStyle=rgba(CR,.62);ctx.fillText(s,x0,y);
    });
    HL.forEach(function(hh,k){
      var ts=1.0+k*2.3,p=sm((u-ts)/.9),s=L[hh[0]],j=s.indexOf(hh[1]),y=y0+hh[0]*lh+lh/2;
      if(p>0){var pre=ctx.measureText(s.slice(0,j)).width,ww=ctx.measureText(hh[1]).width;
        ctx.fillStyle=rgba(CO,.3*p);cap(ctx,x0+pre-3,y-lh*.38,(ww+6)*p,lh*.76,5);ctx.fill();
        ctx.strokeStyle=rgba(CO,.85*p);ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle=rgba("255,240,200",p);ctx.save();ctx.beginPath();ctx.rect(x0+pre-3,y-lh*.5,(ww+6)*p,lh);ctx.clip();ctx.fillText(hh[1],x0+pre,y);ctx.restore();
        if(p>.95)count=k+1;}
    });
    // minimapa a la derecha
    var mx=w*.93,my0=h*.12,my1=h*.88;ctx.strokeStyle=rgba(CR,.2);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mx,my0);ctx.lineTo(mx,my1);ctx.stroke();
    HL.forEach(function(hh,k){var y=lp(my0,my1,hh[0]/(L.length-1)),on=u>1.0+k*2.3+.5;ctx.fillStyle=rgba(on?CO:CR,on?1:.3);cap(ctx,mx-7,y-1.5,14,3,1.5);ctx.fill();});
    F(ctx,500,11*S,SANS);ctx.textAlign="right";ctx.fillStyle=rgba(CO,.95);ctx.fillText(count+(count===1?" coincidencia":" coincidencias"),w*.88,h*.06);
    ctx.globalAlpha=1;
  };

  /* 4 · SE CONTRASTA ANTES DE CITAR */
  DRAW.verifica=function(ctx,w,h,t,S){
    var T=10,u=t%T,fade=1-sm((u-8.6)/1.0),cx=w/2,cy=h*.5,R=Math.min(w*.3,h*.3);
    ctx.globalAlpha=fade;
    var txt="Vizzoti, Carlos Alberto c/ AMSA S.A. — Fallos 327:3677";
    F(ctx,400,14.5*S,SANS);var tw=ctx.measureText(txt).width;if(tw>w*.92)F(ctx,400,14.5*S*w*.92/tw,SANS);tw=ctx.measureText(txt).width;
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=rgba(CR,.92);ctx.fillText(txt,cx,h*.07);
    var ub=sm((u-4.2)/.9);ctx.strokeStyle=rgba(CO,.95);ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(cx-tw/2,h*.07+14*S);ctx.lineTo(cx-tw/2+tw*ub,h*.07+14*S);ctx.stroke();
    // aro exterior e interior se dibujan, después la marca
    function arc(r,p,w2,col){ctx.strokeStyle=col;ctx.lineWidth=w2;ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*p);ctx.stroke();}
    arc(R,sm((u-.4)/1.8),1.4,rgba(CR,.8));arc(R*.8,sm((u-1.2)/1.8),1.1,rgba(CR,.55));
    // texto rotando en el anillo
    var ring="VERIFICADO · IVS CODEX · FIDES · ",rr=R*1.16,ra=sm((u-1.8)/1);
    if(ra>0){F(ctx,500,11.5*S,CAPS);ctx.fillStyle=rgba(CO,.9*ra);var rot=u*.35;
      for(var i=0;i<ring.length;i++){var a=rot+i*Math.PI*2/ring.length-Math.PI/2;ctx.save();ctx.translate(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);ctx.rotate(a+Math.PI/2);ctx.fillText(ring[i],0,0);ctx.restore();}}
    var ck=sm((u-3)/.9);if(ck>0){ctx.strokeStyle=rgba(CO,1);ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";
      var P=[[cx-R*.34,cy+R*.02],[cx-R*.08,cy+R*.28],[cx+R*.38,cy-R*.26]],tot=Math.hypot(P[1][0]-P[0][0],P[1][1]-P[0][1])+Math.hypot(P[2][0]-P[1][0],P[2][1]-P[1][1]),d=tot*ck,s1=Math.hypot(P[1][0]-P[0][0],P[1][1]-P[0][1]);
      ctx.beginPath();ctx.moveTo(P[0][0],P[0][1]);
      if(d<=s1){var q=d/s1;ctx.lineTo(lp(P[0][0],P[1][0],q),lp(P[0][1],P[1][1],q));}else{ctx.lineTo(P[1][0],P[1][1]);var q2=(d-s1)/(tot-s1);ctx.lineTo(lp(P[1][0],P[2][0],q2),lp(P[1][1],P[2][1],q2));}
      ctx.stroke();}
    [["CSJN","#c95836",5.0],["SAIJ","#b03b42",5.4]].forEach(function(b,i){var p=sm((u-b[2])/.6);if(p<=0)return;ctx.globalAlpha=fade*p;
      var x=cx+(i?1:-1)*Math.min(w*.2,120*S),y=h*.93;F(ctx,500,12*S,CAPS);ctx.fillStyle=hexA(b[1],1);ctx.fillText(b[0]+"  ✓",x,y);ctx.globalAlpha=fade;});
    ctx.globalAlpha=1;
  };

  /* 5 · LOS DÍAS Y LOS NÚMEROS */
  DRAW.calculo=function(ctx,w,h,t,S){
    var T=11,u=t%T,fade=1-sm((u-9.6)/1.0),cols=7,rows=5,c=Math.min(w*.108,h*.115),gw=cols*c,x0=(w-gw)/2,y0=h*.14;
    ctx.globalAlpha=fade;ctx.textAlign="center";ctx.textBaseline="middle";
    var dn=["L","M","M","J","V","S","D"];F(ctx,500,11*S,CAPS);ctx.fillStyle=rgba(CR,.5);
    dn.forEach(function(d,i){ctx.fillText(d,x0+i*c+c/2,y0-c*.4);});
    var start=2,N=cols*rows,hab=[];
    for(var i=0;i<N;i++){var day=i-start+1;if(day<1||day>31)continue;var col=i%cols,fer=day===17;if(col<5&&!fer)hab.push(day);}
    var from=hab.indexOf(5),order=hab.slice(from+1),fin=order[9];
    var idx={};order.forEach(function(d,k){idx[d]=k+1;});
    var prog=cl((u-1.0)/5.2,0,1),cnt=Math.floor(prog*10+1e-6),pun=prog*10;
    F(ctx,400,13*S,SANS);
    for(var j=0;j<N;j++){
      var d=j-start+1;if(d<1||d>31)continue;var col=j%cols,row=(j/cols)|0,x=x0+col*c+c/2,y=y0+row*c+c/2,fer=d===17,nh=col>=5||fer;
      var k=idx[d],done=k&&k<=cnt;
      if(done){ctx.fillStyle=rgba(CO,.22+.0);ctx.beginPath();ctx.arc(x,y,c*.4,0,7);ctx.fill();}
      ctx.fillStyle=nh?rgba(CR,.25):rgba(CR,done?1:.8);
      if(d===5){ctx.strokeStyle=rgba(CR,.8);ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,c*.38,0,7);ctx.stroke();}
      ctx.fillText(String(d),x,y);
      if(nh){ctx.strokeStyle=rgba(CR,.28);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-c*.24,y+c*.2);ctx.lineTo(x+c*.24,y-c*.2);ctx.stroke();}
      if(k&&done){F(ctx,500,9.5*S,SANS);ctx.fillStyle=rgba(CO,.95);ctx.fillText(String(k),x+c*.28,y-c*.3);F(ctx,400,13*S,SANS);}
      if(d===fin&&cnt>=10){var p=sm((u-6.4)/.7);ctx.strokeStyle=rgba(CO,1);ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,c*(.42+.3*(1-p)),0,7);ctx.stroke();ctx.fillStyle=rgba(CO,.18*p);ctx.fill();}
    }
    // el contador
    F(ctx,500,15*S,SANS);ctx.textAlign="left";ctx.fillStyle=rgba(CO,1);var ty=y0+rows*c+c*.65;
    ctx.fillText(Math.min(cnt,10)+" días hábiles",x0,ty);
    var m=Math.round(lp(1000000,1348200,sm((u-1.4)/5)));var s="$ "+String(m).replace(/\B(?=(\d{3})+(?!\d))/g,".");
    ctx.textAlign="right";ctx.fillStyle=rgba(CR,.95);ctx.fillText(s,x0+gw,ty);
    F(ctx,400,10.5*S,SANS);ctx.fillStyle=rgba(CR,.45);ctx.fillText("capital + intereses · ejemplo",x0+gw,ty+16*S);
    ctx.globalAlpha=1;
  };

  /* 6 · UN SOLO ARCHIVO, DEL TAMAÑO JUSTO */
  DRAW.pdf=function(ctx,w,h,t,S){
    var T=11,u=t%T,fade=1-sm((u-9.6)/1.0),pw=Math.min(w*.2,h*.26),ph=pw*1.36,cy=h*.36;
    var names=["Escrito","DNI","Prueba"],start=[[-.15,.2],[.5,1.2],[1.15,.2]],ends=[[.22,0],[.5,0],[.78,0]];
    ctx.globalAlpha=fade;
    var mer=sm((u-1.7)/1.2),ent=sm(u/1.4);
    for(var i=0;i<3;i++){
      var sx=start[i][0]*w,sy=start[i][1]*h,ex=ends[i][0]*w,ey=cy;
      var x=lp(lp(sx,ex,ent),w/2+(i-1)*10*S,mer),y=lp(lp(sy,ey,ent),cy+(i-1)*7*S,mer);
      x-=pw/2;y-=ph/2;
      ctx.fillStyle="rgba(24,21,16,.96)";cap(ctx,x,y,pw,ph,5);ctx.fill();
      ctx.strokeStyle=rgba(CR,.7);ctx.lineWidth=1.2;ctx.stroke();
      ctx.strokeStyle=rgba(CR,.22);for(var k=0;k<5;k++){var yy=y+ph*.3+k*ph*.1;ctx.beginPath();ctx.moveTo(x+pw*.14,yy);ctx.lineTo(x+pw*(k===4?.5:.86),yy);ctx.stroke();}
      F(ctx,500,10.5*S,CAPS);ctx.fillStyle=rgba(CO,.95);ctx.textAlign="left";ctx.textBaseline="top";ctx.fillText(names[i].toUpperCase(),x+pw*.12,y+ph*.07);
      var fo=sm((u-3.4-i*.35)/.6);if(fo>0){ctx.globalAlpha=fade*fo;F(ctx,500,11*S,SANS);ctx.textAlign="right";ctx.textBaseline="bottom";ctx.fillStyle=rgba(CO,1);ctx.fillText("Fs. "+(i+1),x+pw*.9,y+ph*.96);ctx.globalAlpha=fade;}
    }
    // la barra de tamaño
    var bx=w*.18,bw=w*.64,by=h*.8,sh=sm((u-5.4)/2.2),lim=.24;
    if(u>4.8){var ba=sm((u-4.8)/.6);ctx.globalAlpha=fade*ba;
      ctx.strokeStyle=rgba(CR,.25);ctx.lineWidth=1;cap(ctx,bx,by,bw,10*S+4,6);ctx.stroke();
      var fillw=bw*lp(1,.17,sh);ctx.fillStyle=rgba(CO,.85);cap(ctx,bx,by,Math.max(8,fillw),10*S+4,6);ctx.fill();
      ctx.strokeStyle=rgba(CR,.8);ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(bx+bw*lim,by-8);ctx.lineTo(bx+bw*lim,by+10*S+12);ctx.stroke();ctx.setLineDash([]);
      F(ctx,400,10.5*S,SANS);ctx.textAlign="center";ctx.textBaseline="top";ctx.fillStyle=rgba(CR,.55);ctx.fillText("límite del sistema",bx+bw*lim,by+10*S+14);
      F(ctx,500,14*S,SANS);ctx.textAlign="left";ctx.fillStyle=rgba(CR,.95);var mb=lp(42,7.8,sh);ctx.fillText(mb.toFixed(1).replace(".",",")+" MB",bx,by-22*S);
      ctx.globalAlpha=fade;}
    ctx.globalAlpha=1;
  };

  var DEFS={consulta:1,voces:1,lector:1,verifica:1,calculo:1,pdf:1};
  window.IVSEscena=function(cv,key){
    var ctx=cv.getContext("2d"),D=Math.min(devicePixelRatio||1,2),W=1,H=1,S=1,t=0,last=0,on=false,raf=0,quieto=matchMedia("(prefers-reduced-motion:reduce)").matches;
    var draw=DRAW[key];
    function medir(){W=cv.clientWidth||300;H=cv.clientHeight||200;cv.width=Math.round(W*D);cv.height=Math.round(H*D);S=Math.max(.62,Math.min(W/560,H/380,1.15));pintar();}
    function pintar(){ctx.setTransform(D,0,0,D,0,0);ctx.clearRect(0,0,W,H);ctx.lineCap="round";ctx.lineJoin="round";draw(ctx,W,H,quieto?3.2:t,S);}
    function tic(now){if(!on){raf=0;return;}var dt=Math.min((now-last)/1000,.05);last=now;t+=dt;pintar();raf=requestAnimationFrame(tic);}
    medir();addEventListener("resize",medir);
    return {activar:function(v){if(v===on)return;on=v;if(v){t=0;last=performance.now();if(!raf&&!quieto)raf=requestAnimationFrame(tic);else if(quieto)pintar();}},medir:medir};
  };
})();
