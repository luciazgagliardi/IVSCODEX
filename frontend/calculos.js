/* ============================================================
   IVS CODEX · núcleo de las calculadoras (sin pantalla).

   Funciones puras: reciben números y fechas ya leídos del formulario y
   devuelven el resultado con su desglose, o {error} con un mensaje para
   mostrar. index.html las usa para dibujar; backend/test/calculos.prueba.js
   las prueba en Node con los casos del documento de auditoría.

   Las fechas son Date en UTC (ver fechaDe en index.html): un plazo no puede
   correrse un día por el horario de verano ni por la zona horaria.
   ============================================================ */
var IVSCalculos=(function(){
  "use strict";
  var DIA=864e5;
  function diasEntre(a,b){ return Math.round((b-a)/DIA); }
  function diasDelMes(a,m){ return new Date(Date.UTC(a,m+1,0)).getUTCDate(); }
  function masMeses(d,meses){
    var a=d.getUTCFullYear(),m=d.getUTCMonth()+meses,dia=d.getUTCDate();
    var aa=a+Math.floor(m/12),mm=((m%12)+12)%12;
    return new Date(Date.UTC(aa,mm,Math.min(dia,diasDelMes(aa,mm))));
  }
  function iso(d){ return d.toISOString().slice(0,10); }
  function valido(n){ return typeof n==="number"&&isFinite(n); }

  /* ---------- series de índices ----------
     Regla de selección (documentada en la pantalla):
       · serie diaria (CER, UVA): el dato publicado para ese día o, si ese día
         no hay dato, el último anterior dentro de los 10 días previos;
       · serie mensual (IPC, RIPTE): el dato del mes de la fecha.
     Si la fecha es posterior al último dato publicado:
       · para la fecha FINAL se usa el último dato publicado y se avisa
         (tardio: true), porque la serie sale con retraso;
       · para la fecha INICIAL no hay dato que usar: error.
     Nunca se reemplaza una fecha por un dato viejo sin decirlo. */
  function elegirDato(filas,fechaIso,diaria,esFinal){
    var datos=(filas||[]).filter(function(x){ return x&&x[0]&&valido(x[1]); }).sort(function(a,b){ return a[0]<b[0]?-1:a[0]>b[0]?1:0; });
    if(!datos.length) return {error:"La serie oficial no devolvió datos para esa fecha."};
    var ultimo=datos[datos.length-1];
    if(diaria){
      var hasta=null;
      for(var i=0;i<datos.length;i++) if(datos[i][0]<=fechaIso) hasta=datos[i];
      if(fechaIso>ultimo[0]){
        if(esFinal) return {fecha:ultimo[0],valor:ultimo[1],tardio:true};
        return {error:"La serie oficial todavía no publica el dato del "+fechaIso.split("-").reverse().join("/")+" (el último es del "+ultimo[0].split("-").reverse().join("/")+")."};
      }
      if(hasta&&diasEntre(new Date(hasta[0]+"T00:00:00Z"),new Date(fechaIso+"T00:00:00Z"))<=10) return {fecha:hasta[0],valor:hasta[1],tardio:false};
      return {error:"La serie oficial no tiene un dato cercano al "+fechaIso.split("-").reverse().join("/")+"."};
    }
    var mes=fechaIso.slice(0,7),delMes=datos.filter(function(x){ return x[0].slice(0,7)===mes; })[0];
    if(delMes) return {fecha:delMes[0],valor:delMes[1],tardio:false};
    if(mes>ultimo[0].slice(0,7)){
      if(esFinal) return {fecha:ultimo[0],valor:ultimo[1],tardio:true};
      return {error:"La serie oficial todavía no publica el dato de "+mes.split("-").reverse().join("/")+" (el último es de "+ultimo[0].slice(0,7).split("-").reverse().join("/")+")."};
    }
    return {error:"La serie oficial no tiene el dato de "+mes.split("-").reverse().join("/")+"."};
  }
  /* coeficiente = índice final / índice inicial; la variación y el monto se
     calculan sin redondear: el redondeo es sólo para mostrar. */
  function actualizar(monto,inicial,final){
    if(!(monto>0)) return {error:"Ingrese un monto mayor que cero."};
    if(!inicial||!final||!(inicial.valor>0)||!(final.valor>0)) return {error:"Falta el valor del índice en alguna de las dos fechas."};
    var coef=final.valor/inicial.valor;
    return {coeficiente:coef,variacion:(coef-1)*100,monto:monto*coef};
  }
  function validarFechas(desde,hasta){
    if(!desde||!hasta) return "Complete las dos fechas.";
    if(hasta<desde) return "La fecha final es anterior a la inicial: corríjala (no se calcula una actualización hacia atrás).";
    return "";
  }

  /* ---------- intereses: tasa por tramos, interés simple ---------- */
  function intereses(capital,tramos,divisor){
    divisor=divisor||365;
    if(!(capital>0)) return {error:"Ingrese un capital mayor que cero."};
    var filas=[],total=0,dias=0,avisos=[],previo=null;
    tramos.forEach(function(t,i){
      var a=t.desde,b=t.hasta,tna=t.tna;
      if(!a||!b||!valido(tna)) { avisos.push("El tramo "+(i+1)+" está incompleto: no se calculó."); return; }
      if(tna<0){ avisos.push("El tramo "+(i+1)+" tiene una tasa negativa: no se calculó."); return; }
      if(b<a){ avisos.push("En el tramo "+(i+1)+" la fecha final es anterior a la inicial: no se calculó."); return; }
      if(previo){
        if(a<previo) avisos.push("El tramo "+(i+1)+" empieza antes de que termine el anterior: hay días contados dos veces.");
        else if(a>previo) avisos.push("Entre el tramo "+i+" y el "+(i+1)+" quedan "+diasEntre(previo,a)+" días sin intereses.");
      }
      var d=diasEntre(a,b),interes=capital*tna/100*d/divisor;
      total+=interes; dias+=d; previo=b;
      filas.push({tramo:i+1,desde:a,hasta:b,dias:d,tna:tna,interes:interes});
    });
    if(!filas.length) return {error:avisos[0]||"Complete al menos un tramo con fechas y tasa.",avisos:avisos};
    return {capital:capital,intereses:total,total:capital+total,dias:dias,filas:filas,avisos:avisos};
  }

  /* ---------- liquidación: cada rubro una vez; IVA sólo sobre honorarios ---------- */
  function liquidacion(r){
    var cap=r.capital,it=r.intereses||0,h=r.honorarios||0,t=r.tasa||0,o=r.otros||0;
    if(!(cap>0)) return {error:"Ingrese el capital de condena."};
    if([it,h,t,o].some(function(x){ return !valido(x)||x<0; })) return {error:"Los importes no pueden ser negativos."};
    var iva=r.iva?h*0.21:0;
    return {capital:cap,intereses:it,subtotal:cap+it,honorarios:h,iva:iva,tasa:t,otros:o,total:cap+it+h+iva+t+o};
  }

  /* ---------- honorarios: Ley 27.423, art. 21 ----------
     Escala verificada contra el texto actualizado (argentina.gob.ar,
     ley-27423-305057/actualizacion, consultado el 23/10/2026):
       hasta 15 UMA 22–33 %; 16–45 UMA 20–26 %; 46–90 UMA 18–24 %;
       91–150 UMA 17–22 %; 151–450 UMA 15–20 %; 451–750 UMA 13–17 %;
       751 UMA en adelante 12–15 %.
     Último párrafo: «En ningún caso los honorarios podrán ser inferiores al
     máximo del grado inmediato anterior de la escala, con más el incremento
     por aplicación al excedente de la alícuota que corresponde al grado
     siguiente.»
     Lectura que se aplica (literal): máximo del grado anterior = su
     alícuota máxima sobre su límite superior; excedente = lo que el monto
     supera ese límite; alícuota del grado siguiente = la del grado del monto
     (la mínima para el piso del mínimo, la máxima para el del máximo).
     Hay otra lectura posible —tomar como «máximo del grado anterior» el
     honorario máximo que resulta de aplicar la misma regla en ese grado, lo
     que vuelve la escala acumulativa—: se calcula aparte y se muestra como
     pendiente de verificación jurídica, sin reemplazar a la primera. */
  var ESCALA_27423=[[15,22,33],[45,20,26],[90,18,24],[150,17,22],[450,15,20],[750,13,17],[Infinity,12,15]];
  function tramoDe(enUma){ for(var i=0;i<ESCALA_27423.length;i++) if(enUma<=ESCALA_27423[i][0]) return i; return ESCALA_27423.length-1; }
  /* Art. 58, Ley 27.423: mínimos de los juicios susceptibles de apreciación
     pecuniaria «que no estuviesen previstos en otros artículos»:
     a) procesos de conocimiento, 10 UMA; b) ejecutivos, 6 UMA; c) mediación,
     2 UMA. Con proceso "otro" (o sin indicarlo) no se aplica ningún mínimo y
     la pantalla lo dice. */
  var MINIMOS_ART58={conocimiento:[10,"a) procesos de conocimiento"],ejecutivo:[6,"b) procesos ejecutivos"],mediacion:[2,"c) procesos de mediación"]};
  function honorariosNacion(monto,uma,proceso){
    var out=honorariosNacionEscala(monto,uma);
    if(out.error) return out;
    var m58=MINIMOS_ART58[proceso];
    if(m58){
      var piso58=m58[0]*uma;
      out.minimo58={proceso:proceso,inciso:m58[1],uma:m58[0],monto:piso58};
      out.aplicaMinimo58=out.min<piso58;
      if(out.min<piso58) out.min=piso58;
      if(out.max<out.min) out.max=out.min;
    }
    return out;
  }
  function honorariosNacionEscala(monto,uma){
    if(!valido(monto)||monto<=0) return {error:"Ingrese un monto del proceso mayor que cero."};
    if(!valido(uma)||uma<=0) return {error:"Ingrese el valor vigente de la UMA (lo publica la Corte Suprema): tiene que ser mayor que cero."};
    var enUma=monto/uma,k=tramoDe(enUma),t=ESCALA_27423[k];
    var directoMin=monto*t[1]/100,directoMax=monto*t[2]/100,out={enUma:enUma,tramo:k,limiteInferior:k?ESCALA_27423[k-1][0]:0,
      limiteSuperior:t[0],pMin:t[1],pMax:t[2],directoMin:directoMin,directoMax:directoMax,min:directoMin,max:directoMax,piso:null,alternativa:null};
    if(k>0){
      var ant=ESCALA_27423[k-1],umbral=ant[0]*uma,maxAnterior=umbral*ant[2]/100,exc=monto-umbral;
      var pisoMin=maxAnterior+exc*t[1]/100,pisoMax=maxAnterior+exc*t[2]/100;
      out.piso={umbralUma:ant[0],umbral:umbral,pMaxAnterior:ant[2],maxAnterior:maxAnterior,excedente:exc,pisoMin:pisoMin,pisoMax:pisoMax};
      out.min=Math.max(directoMin,pisoMin);
      out.max=Math.max(directoMax,pisoMax);
      out.aplicaPiso=pisoMin>directoMin;
      // lectura acumulativa (pendiente de verificación jurídica)
      var maxAcum=0,lim=0;
      for(var j=0;j<k;j++){
        var e=ESCALA_27423[j],directo=e[0]*uma*e[2]/100,conPiso=maxAcum+(e[0]-lim)*uma*e[2]/100;
        maxAcum=j?Math.max(directo,conPiso):directo; lim=e[0];
      }
      out.alternativa={maxAnterior:maxAcum,min:Math.max(directoMin,maxAcum+exc*t[1]/100),max:Math.max(directoMax,maxAcum+exc*t[2]/100)};
    }
    if(out.min>out.max) out.max=out.min; // nunca un rango imposible
    return out;
  }
  function tasaDeJusticia(monto,pct){ return valido(monto)&&monto>0&&valido(pct)&&pct>0?monto*pct/100:0; }
  function iva(h,activo){ return activo?h*0.21:0; }

  /* ---------- incapacidad sobreviniente: renta capitalizada ----------
     C = A × (1 − (1 + i)^−n) / i
       A = ingreso mensual × 13 × incapacidad (Méndez: × 60/edad si la
           víctima tiene menos de 60 años); n = edad límite − edad;
       i = tasa (Vuoto: 65 años y 6 %; Méndez: 75 años y 4 %). */
  var FORMULAS_INC={vuoto:{edad:65,tasa:6},mendez:{edad:75,tasa:4}};
  function incapacidad(ingreso,porcentaje,edad,formula,propia){
    if(!valido(ingreso)||ingreso<=0) return {error:"Ingrese un ingreso mensual mayor que cero."};
    if(!valido(porcentaje)||porcentaje<0||porcentaje>100) return {error:"La incapacidad tiene que estar entre 0 y 100 %."};
    if(!valido(edad)||edad<=0||edad>=120||Math.round(edad)!==edad) return {error:"Ingrese la edad en años enteros (mayor que cero)."};
    var F=FORMULAS_INC[formula]||propia||{};
    var limite=F.edad,tasa=F.tasa/100;
    if(!valido(limite)||limite<=0||!valido(tasa)||tasa<=0) return {error:"Ingrese una edad límite y una tasa de descuento mayores que cero."};
    var n=limite-edad,anual=ingreso*13,ajuste=(formula==="mendez"&&edad<60)?60/edad:1;
    var A=anual*ajuste*porcentaje/100;
    if(n<=0) return {capital:0,A:A,n:0,i:tasa,anual:anual,ajuste:ajuste,limite:limite,nota:"La edad alcanza o supera la edad límite de la fórmula ("+limite+" años)."};
    var C=A*(1-Math.pow(1+tasa,-n))/tasa;
    return {capital:C,A:A,n:n,i:tasa,anual:anual,ajuste:ajuste,limite:limite};
  }

  /* ---------- despido: componentes de la LCT ---------- */
  function antiguedad(a,b){
    var anios=0; while(masMeses(a,12*(anios+1))<=b) anios++;
    var desdeAniv=masMeses(a,12*anios),meses=0; while(masMeses(desdeAniv,meses+1)<=b) meses++;
    return {anios:anios,meses:meses,masDeTres:masMeses(desdeAniv,3)<b};
  }
  /* Período de prueba (art. 92 bis LCT): la extinción no genera la
     indemnización del art. 245, que procede «luego de transcurrido el período
     de prueba» (art. 245, texto del art. 51 de la Ley 27.802). Preaviso: desde
     el 06/03/2026 (publicación de la Ley 27.802, art. 217) «no se requerirá»
     (art. 231 inc. b, texto del art. 48); antes, 15 días (art. 231 anterior). */
  var VIGENCIA_27802="2026-03-06";
  /* Antigüedad: el día del egreso se cuenta como trabajado (igual que en la
     remuneración de los días del mes, art. 103), así que la fracción «mayor de
     tres meses» (art. 245) y la antigüedad «superior» a cinco años (art. 231)
     se miden hasta el final de ese día. */
  function despidoComponentes(s,a,b,op){
    op=op||{};
    if(!valido(s)||s<=0) return {error:"Ingrese la mejor remuneración mensual, normal y habitual."};
    if(!a||!b) return {error:"Complete las fechas de ingreso y de egreso."};
    if(b<=a) return {error:"La fecha de egreso tiene que ser posterior a la de ingreso."};
    var finEgreso=new Date(b.getTime()+DIA);
    var ant=antiguedad(a,finEgreso),computables=Math.max(1,ant.anios+(ant.masDeTres?1:0));
    var base=s;
    if(op.tope>0&&s>op.tope) base=Math.max(op.tope,s*.67);
    var dm=diasDelMes(b.getUTCFullYear(),b.getUTCMonth()),dia=b.getUTCDate(),r={antiguedad:ant,computables:computables,base:base};
    r.indemnizacion=op.prueba?0:base*computables;
    r.preaviso=0; r.sacPreaviso=0; r.integracion=0; r.sacIntegracion=0;
    if(op.prueba){
      var conReforma=iso(b)>=VIGENCIA_27802;
      r.prueba={reforma27802:conReforma,aviso:"Despido durante el período de prueba: no corresponde la indemnización por antigüedad (art. 92 bis LCT y art. 245, texto de la Ley 27.802: procede «luego de transcurrido el período de prueba»)."+
        (conReforma?" Tampoco corresponde preaviso: desde el 06/03/2026 el art. 231 inc. b (texto de la Ley 27.802) dispone que en el período de prueba «no se requerirá la obligación de preaviso».":
          " Como el egreso es anterior al 06/03/2026 (Ley 27.802), corresponde el preaviso de 15 días del art. 231 entonces vigente.")};
    }
    if(op.sinPreaviso){
      var masDeCinco=masMeses(a,60)<finEgreso;
      r.preaviso=op.prueba?(r.prueba.reforma27802?0:s/2):(masDeCinco?2*s:s);
      r.mesesPreaviso=op.prueba?(r.prueba.reforma27802?0:0.5):(masDeCinco?2:1);
      if(op.sacRubros) r.sacPreaviso=r.preaviso/12;
    }
    if(op.sinPreaviso&&op.integracion&&!op.prueba&&dia<dm){
      r.diasIntegracion=dm-dia;
      r.integracion=s/dm*(dm-dia);
      if(op.sacRubros) r.sacIntegracion=r.integracion/12;
    }
    r.diasTrabajados=dia; r.diasDelMes=dm;
    return r;
  }
  function diasVacaciones(anios){ return anios<5?14:anios<10?21:anios<20?28:35; }
  /* Liquidación final completa: la usan la plataforma y la portada, para que
     las dos den el mismo total con las mismas entradas. */
  function liquidacionDespido(s,a,b,op){
    op=op||{};
    var K=despidoComponentes(s,a,b,op);
    if(K.error) return K;
    var rubros=[];
    function rubro(n,ley,v){ if(v>0) rubros.push([n,ley,v]); }
    var c=K.computables;
    rubro("Indemnización por antigüedad ("+c+(c===1?" año":" años")+")","art. 245 LCT",K.indemnizacion);
    if(K.preaviso) rubro("Preaviso omitido ("+(op.prueba?"15 días, período de prueba":(K.mesesPreaviso===2?"2 meses":"1 mes"))+")","arts. 231 y 232 LCT",K.preaviso);
    if(K.sacPreaviso) rubro("SAC sobre el preaviso","art. 121 LCT",K.sacPreaviso);
    if(K.integracion) rubro("Integración del mes de despido ("+K.diasIntegracion+" días)","art. 233 LCT",K.integracion);
    if(K.sacIntegracion) rubro("SAC sobre la integración","art. 121 LCT",K.sacIntegracion);
    var dm=K.diasDelMes,dia=K.diasTrabajados,y=b.getUTCFullYear(),m=b.getUTCMonth();
    rubro("Remuneración de los días trabajados del mes ("+dia+")","art. 103 LCT",s/dm*dia);
    var iniSem=new Date(Date.UTC(y,m<6?0:6,1)),ini=iniSem<a?a:iniSem;
    var finSem=new Date(Date.UTC(y,m<6?5:11,m<6?30:31)),diasSem=diasEntre(iniSem,finSem)+1;
    rubro("SAC proporcional del semestre","art. 123 LCT",s/2*(diasEntre(ini,b)+1)/diasSem);
    var iniAnio=new Date(Date.UTC(y,0,1)); if(iniAnio<a) iniAnio=a;
    var vacDias=diasVacaciones(antiguedad(a,new Date(Date.UTC(y,11,31))).anios)*(diasEntre(iniAnio,b)+1)/365;
    var vac=s/25*vacDias;
    rubro("Vacaciones no gozadas proporcionales ("+vacDias.toLocaleString("es-AR",{maximumFractionDigits:1})+" días)","arts. 150, 155 y 156 LCT",vac);
    if(op.sacRubros) rubro("SAC sobre las vacaciones","art. 121 LCT",vac/12);
    return {componentes:K,rubros:rubros,vacDias:vacDias,total:rubros.reduce(function(x,r){ return x+r[2]; },0)};
  }

  /* ---------- honorarios: Ley 9131 de Mendoza, art. 2 ----------
     Texto (B.O. Mendoza 28/11/2018): «se regulará como mínimo en la cantidad
     que resulte de aplicar la siguiente escala: Juicios de hasta 20 JUS… el
     20 %. Más de 20 JUS hasta 50 JUS… el 16 %. Más de 50 JUS en adelante… el
     12 %. Si el mérito… lo justificara… podrá ser aumentada hasta un treinta
     por ciento (30 %). Si al aplicar la escala resultase un honorario de monto
     inferior al determinado por el máximo del grado precedente, se regulará
     ese máximo.»
     Lectura que se aplica (literal): el juicio se ubica en un grado por su
     monto total y el porcentaje del grado recae sobre todo el monto; el piso es
     el máximo del grado precedente (20 % de 20 JUS = 4 JUS; 16 % de 50 JUS =
     8 JUS). Es un MÍNIMO: el máximo es ese mínimo + 30 % por mérito. La lectura
     por tramos acumulativos (cada porcentaje sobre la porción de su tramo) se
     calcula aparte y se muestra solo como alternativa. Después se aplican, en
     este orden, los arts. 3 (parte perdedora, 70 %), 7 (monitorio sin
     oposición, −25 %), 8 (sucesión, −30 %) y 31 (procurador, 50 % en primera
     instancia). */
  var ESCALA_9131=[[20,20],[50,16],[Infinity,12]];
  function honorariosMendoza(monto,jus,op){
    op=op||{};
    if(!valido(monto)||monto<=0) return {error:"Ingrese un monto del proceso mayor que cero."};
    if(!valido(jus)||jus<=0) return {error:"Cargue el valor vigente del JUS (mayor que cero): lo fija la Suprema Corte de Mendoza por acordada y la ley no lo contiene."};
    var enJus=monto/jus,k=enJus<=20?0:enJus<=50?1:2,pct=ESCALA_9131[k][1];
    var directo=monto*pct/100;
    var pisoJus=k===0?0:k===1?20*0.20:50*0.16,piso=pisoJus*jus;
    var minimo=Math.max(directo,piso);
    var merito=valido(op.merito)?Math.min(Math.max(op.merito,0),30):0;
    var factores=[];
    if(op.rol==="perdedor") factores.push([0.7,"Abogado de la parte perdedora (art. 3): 70 % de lo que corresponde al de la ganadora"]);
    if(op.proceso==="monitorio") factores.push([0.75,"Proceso monitorio sin oposición (art. 7): reducción del 25 %"]);
    if(op.proceso==="sucesion") factores.push([0.7,"Sucesión (art. 8): reducción del 30 %"]);
    if(op.procurador) factores.push([0.5,"Procurador, primera instancia (art. 31): 50 % del honorario del abogado"]);
    var f=factores.reduce(function(x,y){ return x*y[0]; },1);
    var acum=0,desde=0;
    ESCALA_9131.forEach(function(t){ var porcion=Math.max(0,Math.min(enJus,t[0])-desde); acum+=porcion*jus*t[1]/100; desde=t[0]; });
    return {enJus:enJus,grado:k,pct:pct,directo:directo,pisoJus:pisoJus,piso:piso,aplicaPiso:piso>directo,
      minimoEscala:minimo,maximoEscala:minimo*1.3,factores:factores,factor:f,
      min:minimo*f,max:minimo*1.3*f,merito:merito,conMerito:merito>0?minimo*(1+merito/100)*f:null,
      alternativa:{bruto:acum,min:acum*f,max:acum*1.3*f}};
  }

  /* ---------- feriados, ferias y días inhábiles ----------
     Tres fuentes, y cada día inhábil dice de cuál sale:
       1. La regla fija de la Ley 27.399 (art. 1: inamovibles, trasladables y
          Jueves Santo como no laborable; art. 6: traslados).
       2. CALENDARIO: lo que se fija año por año (decretos, no laborables
          turísticos del art. 7, ferias por acordada), con su norma y su URL.
       3. Los días que carga el usuario, cada uno con su jurisdicción.
     Cómo cuenta cada tipo:
       · feriado: inhábil en las jurisdicciones que indica;
       · no_laborable (Jueves Santo y turísticos): en Mendoza es inhábil por
         ley (art. 60 ap. II, Ley 9001: «feriados y no laborables, declarados
         por ley o decreto»); en Nación y CABA se avisa, porque depende de
         que la Corte lo declare inhábil;
       · feria: inhábil en su jurisdicción;
       · religioso (arts. 2 y 3 Ley 27.399, optativos): solo aviso.
     COBERTURA dice qué años tienen cargado lo que se fija año por año; si un
     plazo cruza un año o una feria sin datos, el resultado sale como
     PROVISORIO y lo dice. */
  var URL_27399="https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto";
  var URL_CAL2026="https://www.argentina.gob.ar/sites/default/files/holidays-2026-es.json";
  var URL_9001="https://www.argentina.gob.ar/normativa/provincial/ley-9001-123456789-0abc-defg-100-9000mvorpyel/actualizacion";
  var URL_RES164="https://www.argentina.gob.ar/normativa/nacional/421799/texto";
  var JURIS_TODAS=["nacion","caba","mendoza"];
  var CALENDARIO=[
    {desde:"2026-03-23",tipo:"no_laborable",motivo:"Día no laborable con fines turísticos",norma:"Resolución JGM 164/2025 (art. 7, Ley 27.399)",url:URL_RES164,verificado:true},
    {desde:"2026-07-10",tipo:"no_laborable",motivo:"Día no laborable con fines turísticos",norma:"Resolución JGM 164/2025 (art. 7, Ley 27.399)",url:URL_RES164,verificado:true},
    {desde:"2026-12-07",tipo:"no_laborable",motivo:"Día no laborable con fines turísticos",norma:"Resolución JGM 164/2025 (art. 7, Ley 27.399)",url:URL_RES164,verificado:true},
    {desde:"2026-11-09",tipo:"feriado",juris:JURIS_TODAS,motivo:"Visita de Su Santidad el Papa León XIV (feriado nacional)",norma:"Decreto 1103/2026, art. 2",url:URL_CAL2026,verificado:true,
      nota:"Fecha confirmada en el calendario oficial de argentina.gob.ar; el número del decreto, en publicaciones especializadas."},
    {desde:"2026-11-10",tipo:"feriado",juris:["caba"],avisoEn:["nacion"],motivo:"Visita del Papa León XIV (feriado en la Ciudad de Buenos Aires)",norma:"Decreto 1103/2026",url:URL_CAL2026,verificado:true,
      aviso:"es feriado en la Ciudad de Buenos Aires: si el tribunal nacional tiene sede en la Ciudad, verifique si la Corte Suprema lo declaró inhábil (no se descontó)."},
    {desde:"2026-07-13",hasta:"2026-07-24",tipo:"feria",juris:["mendoza"],motivo:"Receso judicial de julio",norma:"Acordada SCJM 32.674 (06/07/2026) y art. 60 ap. II, Ley 9001",
      url:"https://www.elsol.com.ar/wp-content/uploads/2026/07/pedido_320370_07072026.pdf",verificado:true},
    {desde:"2026-07-20",hasta:"2026-07-31",tipo:"feria",juris:["nacion"],motivo:"Feria judicial de invierno",norma:"Acordada CSJN 11/2026",
      url:"https://aldiaargentina.microjuris.com/2026/06/05/legislacion-csjn-se-establece-la-feria-judicial-de-invierno-desde-el-20-hasta-el-31-de-julio-de-2026/",verificado:false},
    // no laborables optativos (arts. 2 y 3, Ley 27.399; 24/4: Ley 26.199): solo aviso
    {desde:"2026-03-20",tipo:"religioso",motivo:"Fiesta de la Ruptura del Ayuno (Id al-Fitr), no laborable para quienes profesan la religión islámica",norma:"Ley 27.399, art. 3",url:URL_CAL2026,verificado:true},
    {desde:"2026-04-02",hasta:"2026-04-03",tipo:"religioso",motivo:"Primeros días de la Pascua Judía, no laborables para quienes profesan la religión judía",norma:"Ley 27.399, art. 2",url:URL_CAL2026,verificado:true},
    {desde:"2026-04-08",hasta:"2026-04-09",tipo:"religioso",motivo:"Últimos días de la Pascua Judía, no laborables para quienes profesan la religión judía",norma:"Ley 27.399, art. 2",url:URL_CAL2026,verificado:true},
    {desde:"2026-04-24",tipo:"religioso",motivo:"Día de acción por la tolerancia y el respeto entre los pueblos, no laborable para quienes pertenecen a la colectividad armenia",norma:"Ley 26.199",url:URL_CAL2026,verificado:true},
    {desde:"2026-05-27",tipo:"religioso",motivo:"Fiesta del Sacrificio (Id al-Adha), no laborable para quienes profesan la religión islámica",norma:"Ley 27.399, art. 3",url:URL_CAL2026,verificado:true},
    {desde:"2026-06-17",tipo:"religioso",motivo:"Año Nuevo Islámico, no laborable para quienes profesan la religión islámica",norma:"Ley 27.399, art. 3",url:URL_CAL2026,verificado:true},
    {desde:"2026-09-12",hasta:"2026-09-13",tipo:"religioso",motivo:"Año Nuevo Judío, no laborable para quienes profesan la religión judía",norma:"Ley 27.399, art. 2",url:URL_CAL2026,verificado:true},
    {desde:"2026-09-21",tipo:"religioso",motivo:"Día del Perdón, no laborable para quienes profesan la religión judía",norma:"Ley 27.399, art. 2",url:URL_CAL2026,verificado:true}
  ];
  // años con los días por decreto, turísticos y ferias de julio cargados
  var COBERTURA={nacion:{2026:true},caba:{2026:true},mendoza:{2026:true}};
  var FERIA_ENERO={
    mendoza:{motivo:"Feria judicial de enero (todo el mes)",norma:"Art. 60 ap. II, Ley 9001 (CPCCyT de Mendoza)",url:URL_9001,verificado:true},
    nacion:{motivo:"Feria judicial de enero (todo el mes)",norma:"Reglamento para la Justicia Nacional (feria de enero)",url:"",verificado:false}
  };
  var NOMBRE_JURIS={nacion:"Nación",caba:"Ciudad de Buenos Aires",mendoza:"Mendoza"};

  function masDias(d,n){ return new Date(d.getTime()+n*DIA); }
  function pascua(a){
    var b=a%19,c=Math.floor(a/100),d=a%100,e=Math.floor(c/4),f=c%4,g=Math.floor((c+8)/25),h=Math.floor((c-g+1)/3),
        i=(19*b+c-e-h+15)%30,k=Math.floor(d/4),l=d%4,m=(32+2*f+2*k-i-l)%7,n=Math.floor((b+11*i+22*m)/451),
        mes=Math.floor((i+m-7*n+114)/31),dia=((i+m-7*n+114)%31)+1;
    return new Date(Date.UTC(a,mes-1,dia));
  }
  // Art. 6, Ley 27.399: martes y miércoles pasan al lunes anterior; jueves y viernes, al lunes siguiente.
  function trasladar(d){
    var w=d.getUTCDay();
    if(w===2||w===3) return masDias(d,-(w-1));
    if(w===4||w===5) return masDias(d,8-w);
    return d;
  }
  var CACHE_LEY={};
  /* Feriados de la Ley 27.399 (más el 25 de julio en Mendoza) y los feriados
     de CALENDARIO de esa jurisdicción: {iso: motivo}. */
  function feriadosLey(anio){
    if(CACHE_LEY[anio]) return CACHE_LEY[anio];
    var f={};
    function fijo(m,d,n){ f[iso(new Date(Date.UTC(anio,m-1,d)))]=n; }
    fijo(1,1,"Año Nuevo");
    fijo(3,24,"Día Nacional de la Memoria por la Verdad y la Justicia");
    fijo(4,2,"Día del Veterano y de los Caídos en la Guerra de Malvinas");
    fijo(5,1,"Día del Trabajador");
    fijo(5,25,"Día de la Revolución de Mayo");
    fijo(6,20,"Paso a la Inmortalidad del General Manuel Belgrano");
    fijo(7,9,"Día de la Independencia");
    fijo(12,8,"Inmaculada Concepción de María");
    fijo(12,25,"Navidad");
    var p=pascua(anio);
    f[iso(masDias(p,-48))]="Carnaval";
    f[iso(masDias(p,-47))]="Carnaval";
    f[iso(masDias(p,-2))]="Viernes Santo";
    [[6,17,"Paso a la Inmortalidad del General Martín Miguel de Güemes"],
     [8,17,"Paso a la Inmortalidad del General José de San Martín"],
     [10,12,"Día del Respeto a la Diversidad Cultural"],
     [11,20,"Día de la Soberanía Nacional"]].forEach(function(t){
      f[iso(trasladar(new Date(Date.UTC(anio,t[0]-1,t[1]))))]=t[2];
    });
    CACHE_LEY[anio]=f;
    return f;
  }
  function feriados(anio,juris){
    var f={},ley=feriadosLey(anio);
    Object.keys(ley).forEach(function(k){ f[k]=ley[k]; });
    if(juris==="mendoza") f[anio+"-07-25"]="Santiago Apóstol, patrono de Mendoza (feriado provincial)";
    CALENDARIO.forEach(function(e){
      if(e.tipo!=="feriado"||e.juris.indexOf(juris)===-1) return;
      for(var x=e.desde;x<=(e.hasta||e.desde);x=iso(masDias(new Date(x+"T00:00:00Z"),1))) if(x.slice(0,4)===String(anio)) f[x]=e.motivo;
    });
    return f;
  }
  function entradasDe(isoDia){ return CALENDARIO.filter(function(e){ return isoDia>=e.desde&&isoDia<=(e.hasta||e.desde); }); }
  /* Situación de un día: {motivo} si es inhábil (con tipo, norma, url y si el
     dato está verificado) y {avisos} con lo que no se descuenta pero importa. */
  function diaInhabil(d,juris,extras){
    var w=d.getUTCDay(),x=iso(d),r={motivo:"",tipo:"",norma:"",url:"",verificado:true,avisos:[]};
    if(w===0||w===6){ r.motivo="Fin de semana"; r.tipo="fin"; return r; }
    var ley=feriadosLey(d.getUTCFullYear());
    if(ley[x]){ r.motivo=ley[x]; r.tipo="feriado"; r.norma="Ley 27.399"; r.url=URL_27399; return r; }
    if(juris==="mendoza"&&x.slice(5)==="07-25"){ r.motivo="Santiago Apóstol, patrono de Mendoza (feriado provincial)"; r.tipo="feriado"; r.norma="Feriado provincial de Mendoza"; return r; }
    if(d.getUTCMonth()===0&&FERIA_ENERO[juris]){ var fe=FERIA_ENERO[juris]; r.motivo=fe.motivo; r.tipo="feria"; r.norma=fe.norma; r.url=fe.url; r.verificado=fe.verificado; return r; }
    var p=pascua(d.getUTCFullYear()),entradas=entradasDe(x);
    if(x===iso(masDias(p,-3))) entradas=entradas.concat([{tipo:"no_laborable",motivo:"Jueves Santo",norma:"Ley 27.399, art. 1 (día no laborable)",url:URL_27399,verificado:true}]);
    for(var i=0;i<entradas.length;i++){
      var e=entradas[i],cuenta=false;
      if(e.tipo==="feriado"||e.tipo==="feria") cuenta=e.juris.indexOf(juris)!==-1;
      else if(e.tipo==="no_laborable") cuenta=juris==="mendoza";
      if(cuenta){
        r.motivo=e.motivo+(e.tipo==="no_laborable"?" (inhábil por el art. 60 ap. II, Ley 9001)":""); r.tipo=e.tipo; r.norma=e.norma; r.url=e.url; r.verificado=e.verificado!==false;
        return r;
      }
      if(e.tipo==="religioso") r.avisos.push(e.motivo+" ("+e.norma+"): se contó como hábil; no es feriado para todos.");
      else if(e.tipo==="no_laborable") r.avisos.push(e.motivo+" ("+e.norma+"): se contó como hábil; verifique si la Corte Suprema o el tribunal lo declaró inhábil por acordada.");
      else if(e.avisoEn&&e.avisoEn.indexOf(juris)!==-1) r.avisos.push(e.motivo+": "+e.aviso);
    }
    var ex=extras||[];
    for(var j=0;j<ex.length;j++){
      var y=ex[j];
      if(x>=y.desde&&x<=(y.hasta||y.desde)&&(!y.juris||y.juris===juris)){
        r.motivo=(y.motivo||"Día inhábil")+(y.juris?"":" (cargado sin jurisdicción)"); r.tipo="usuario"; r.norma="Cargado en el calendario";
        return r;
      }
    }
    return r;
  }
  function siguienteHabil(d,juris,extras){ var x=masDias(d,1),n=0; while(diaInhabil(x,juris,extras).motivo&&n++<400) x=masDias(x,1); return x; }
  /* Lo que falta cargar para el período [a, b]: años sin los días por
     decreto y ferias sin datos. Si falta algo, el resultado es provisorio. */
  function faltantes(a,b,juris,extras){
    var out=[],ex=(extras||[]).filter(function(y){ return y.juris===juris; });
    function cargadoPorUsuario(d1,d2){ return ex.some(function(y){ return y.desde<=d2&&(y.hasta||y.desde)>=d1; }); }
    for(var y=a.getUTCFullYear();y<=b.getUTCFullYear();y++){
      var ini=iso(a),fin=iso(b);
      if(!COBERTURA[juris]||!COBERTURA[juris][y]) out.push("No están cargados los feriados por decreto, los no laborables ni las ferias de "+y+" para "+NOMBRE_JURIS[juris]+": confirme el calendario oficial y las acordadas y cárguelos en el calendario.");
      else{
        var j1=y+"-07-10",j2=y+"-07-31";
        var tieneJulio=CALENDARIO.some(function(e){ return e.tipo==="feria"&&e.juris.indexOf(juris)!==-1&&e.desde.slice(0,4)===String(y); });
        if(ini<=j2&&fin>=j1&&!tieneJulio&&!cargadoPorUsuario(j1,j2)) out.push("No está cargada la feria de julio de "+y+" para "+NOMBRE_JURIS[juris]+": confirme la acordada y cárguela en el calendario.");
      }
      var e1=y+"-01-01",e2=y+"-01-31";
      if(!FERIA_ENERO[juris]&&ini<=e2&&fin>=e1&&!cargadoPorUsuario(e1,e2)) out.push("No está cargada la feria de enero de "+y+" para "+NOMBRE_JURIS[juris]+": confirme la acordada y cárguela en el calendario.");
    }
    return out;
  }
  var BASES_PLAZO={
    nacion:"Arts. 156 y 124 del CPCCN: el plazo corre desde el día siguiente al de la notificación, se computan solo los días hábiles y el escrito puede presentarse dentro de las dos primeras horas del despacho del día hábil siguiente al del vencimiento.",
    caba:"En la justicia nacional con sede en la Ciudad rigen los arts. 156 y 124 del CPCCN (plazo de gracia: dos primeras horas del día hábil siguiente). En la justicia local de la Ciudad, verifique el código procesal aplicable.",
    mendoza:"Arts. 60, 61 y 63 de la Ley 9001 (CPCCyT de Mendoza): son inhábiles los sábados, domingos, feriados y no laborables declarados por ley o decreto, todo enero y el receso de julio (art. 60 ap. II); el plazo corre desde el día hábil siguiente a la notificación y vence a las 24 del último día (art. 63). No rige el plazo de gracia para los escritos electrónicos (art. 61 ap. III; Acordada SCJM 31.699, B.O. 18/10/2024)."
  };
  /* Vencimiento de un plazo procesal. p = {notif: Date, dias: n, tipo:
     "habiles"|"corridos", juris, extras: inhábiles cargados por el usuario}. */
  function computarPlazo(p){
    var d=p.notif,n=p.dias,juris=p.juris||"nacion",ex=p.extras||[];
    if(!d||!(n>0)||Math.round(n)!==n) return {error:"Indique la fecha de notificación y el plazo en días enteros."};
    if(!BASES_PLAZO[juris]) return {error:"Jurisdicción desconocida."};
    var saltados=[],avisos=[],noVerificados=[],vence,x,r;
    function anotar(dia,info){
      if(info.verificado===false&&noVerificados.indexOf(info.norma)===-1) noVerificados.push(info.norma);
    }
    if(p.tipo==="corridos"){
      vence=masDias(d,n);
      r=diaInhabil(vence,juris,ex);
      if(r.motivo) avisos.push("El vencimiento cae en un día inhábil ("+r.motivo.toLowerCase()+"): verifique si la norma del plazo lo traslada al día hábil siguiente.");
    }else{
      x=d; var cont=0,vueltas=0;
      while(cont<n&&vueltas++<5000){
        x=masDias(x,1); r=diaInhabil(x,juris,ex);
        if(r.motivo){ if(r.tipo!=="fin"){ saltados.push({fecha:x,motivo:r.motivo,norma:r.norma,url:r.url,verificado:r.verificado}); anotar(x,r); } continue; }
        r.avisos.forEach(function(a){ avisos.push("El "+iso(x).split("-").reverse().join("/")+": "+a); });
        cont++;
      }
      vence=x;
    }
    var gracia=juris==="mendoza"?null:siguienteHabil(vence,juris,ex);
    var falta=faltantes(d,gracia||vence,juris,ex);
    noVerificados.forEach(function(nm){ avisos.push("Dato no verificado en fuente oficial ("+nm+"): confirme la acordada antes de confiar en el vencimiento."); });
    if(juris==="mendoza") avisos.push("Mendoza: no hay plazo de gracia para los escritos electrónicos (art. 61 ap. III, Ley 9001; Acordada SCJM 31.699): el escrito vence a las 24 del día del vencimiento. La Acordada lo mantiene solo para la prescripción de la acción o la caducidad de instancia que vencen en día inhábil sin sistema habilitado (hasta las 9:30 del día hábil siguiente).");
    return {vence:vence,gracia:gracia,saltados:saltados,avisos:avisos,provisorio:falta.length>0,faltantes:falta,base:BASES_PLAZO[juris],tipo:p.tipo==="corridos"?"corridos":"habiles",dias:n,notif:d,juris:juris};
  }

  return {elegirDato:elegirDato,actualizar:actualizar,validarFechas:validarFechas,intereses:intereses,liquidacion:liquidacion,
    ESCALA_27423:ESCALA_27423,MINIMOS_ART58:MINIMOS_ART58,honorariosNacion:honorariosNacion,tasaDeJusticia:tasaDeJusticia,iva:iva,
    ESCALA_9131:ESCALA_9131,honorariosMendoza:honorariosMendoza,
    incapacidad:incapacidad,FORMULAS_INC:FORMULAS_INC,antiguedad:antiguedad,despidoComponentes:despidoComponentes,
    VIGENCIA_27802:VIGENCIA_27802,diasVacaciones:diasVacaciones,liquidacionDespido:liquidacionDespido,
    CALENDARIO:CALENDARIO,COBERTURA:COBERTURA,FERIA_ENERO:FERIA_ENERO,pascua:pascua,feriados:feriados,diaInhabil:diaInhabil,
    siguienteHabil:siguienteHabil,faltantes:faltantes,computarPlazo:computarPlazo,BASES_PLAZO:BASES_PLAZO,
    masMeses:masMeses,masDias:masDias,diasEntre:diasEntre,diasDelMes:diasDelMes,iso:iso};
})();
if(typeof module!=="undefined"&&module.exports) module.exports=IVSCalculos;
