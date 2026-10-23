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
  function honorariosNacion(monto,uma){
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
  function despidoComponentes(s,a,b,op){
    op=op||{};
    if(!valido(s)||s<=0) return {error:"Ingrese la mejor remuneración mensual, normal y habitual."};
    if(!a||!b) return {error:"Complete las fechas de ingreso y de egreso."};
    if(b<=a) return {error:"La fecha de egreso tiene que ser posterior a la de ingreso."};
    var ant=antiguedad(a,b),computables=Math.max(1,ant.anios+(ant.masDeTres?1:0));
    var base=s;
    if(op.tope>0&&s>op.tope) base=Math.max(op.tope,s*.67);
    var dm=diasDelMes(b.getUTCFullYear(),b.getUTCMonth()),dia=b.getUTCDate(),r={antiguedad:ant,computables:computables,base:base};
    r.indemnizacion=base*computables;
    r.preaviso=0; r.sacPreaviso=0; r.integracion=0; r.sacIntegracion=0;
    if(op.sinPreaviso){
      var masDeCinco=masMeses(a,60)<b;
      r.preaviso=op.prueba?s/2:(masDeCinco?2*s:s);
      r.mesesPreaviso=op.prueba?0.5:(masDeCinco?2:1);
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

  return {elegirDato:elegirDato,actualizar:actualizar,validarFechas:validarFechas,intereses:intereses,liquidacion:liquidacion,
    ESCALA_27423:ESCALA_27423,honorariosNacion:honorariosNacion,tasaDeJusticia:tasaDeJusticia,iva:iva,
    incapacidad:incapacidad,FORMULAS_INC:FORMULAS_INC,antiguedad:antiguedad,despidoComponentes:despidoComponentes,
    masMeses:masMeses,diasEntre:diasEntre,diasDelMes:diasDelMes,iso:iso};
})();
if(typeof module!=="undefined"&&module.exports) module.exports=IVSCalculos;
