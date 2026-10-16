/* Cálculos copiados tal cual de la plataforma (index.html): mismas fórmulas, mismos feriados, mismos plazos. */
function sinTildes(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); }
function num(v){
  var s=String(v==null?"":v).trim().replace(/[\s$]/g,"");
  if(!s) return NaN;
  if(s.indexOf(",")!==-1) s=s.replace(/\./g,"").replace(",",".");
  else if((s.match(/\./g)||[]).length>1||/^\d{1,3}\.\d{3}$/.test(s)) s=s.replace(/\./g,"");
  var n=parseFloat(s);
  return isFinite(n)?n:NaN;
}
function pesos(n){ return isFinite(n)?"$ "+n.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"; }
function fechaDe(s){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||"")); return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])):null; }
function isoDe(d){ return d.toISOString().slice(0,10); }
function masDias(d,n){ return new Date(d.getTime()+n*864e5); }
function diasEntre(a,b){ return Math.round((b-a)/864e5); }
function diasDelMes(a,m){ return new Date(Date.UTC(a,m+1,0)).getUTCDate(); }
function fechaLarga(d){ return d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}); }
function fechaCorta(d){ return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}); }
function hoyUTC(){ var h=new Date(); return new Date(Date.UTC(h.getFullYear(),h.getMonth(),h.getDate())); }
/* Suma meses o años "de fecha a fecha" (art. 6 CCyC): si en el mes del
   vencimiento no existe el día equivalente, vence el último día del mes. */
function masMeses(d,meses){
  var a=d.getUTCFullYear(),m=d.getUTCMonth()+meses,dia=d.getUTCDate();
  var aa=a+Math.floor(m/12),mm=((m%12)+12)%12;
  return new Date(Date.UTC(aa,mm,Math.min(dia,diasDelMes(aa,mm))));
}
function pascua(a){
  var b=a%19,c=Math.floor(a/100),d=a%100,e=Math.floor(c/4),f=c%4,g=Math.floor((c+8)/25),h=Math.floor((c-g+1)/3),
      i=(19*b+c-e-h+15)%30,k=Math.floor(d/4),l=d%4,m=(32+2*f+2*k-i-l)%7,n=Math.floor((b+11*i+22*m)/451),
      mes=Math.floor((i+m-7*n+114)/31),dia=((i+m-7*n+114)%31)+1;
  return new Date(Date.UTC(a,mes-1,dia));
}
/* Trasladables (art. 6, Ley 27.399): si caen martes o miércoles pasan al
   lunes anterior; si caen jueves o viernes, al lunes siguiente. */
function trasladar(d){
  var w=d.getUTCDay();
  if(w===2||w===3) return masDias(d,-(w-1));
  if(w===4||w===5) return masDias(d,8-w);
  return d;
}
var FERIADOS_CACHE={};
function feriados(anio,juris){
  var clave=anio+"|"+juris;
  if(FERIADOS_CACHE[clave]) return FERIADOS_CACHE[clave];
  var f={};
  function fijo(m,d,n){ f[isoDe(new Date(Date.UTC(anio,m-1,d)))]=n; }
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
  f[isoDe(masDias(p,-48))]="Carnaval";
  f[isoDe(masDias(p,-47))]="Carnaval";
  f[isoDe(masDias(p,-2))]="Viernes Santo";
  [[6,17,"Paso a la Inmortalidad del General Martín Miguel de Güemes"],
   [8,17,"Paso a la Inmortalidad del General José de San Martín"],
   [10,12,"Día del Respeto a la Diversidad Cultural"],
   [11,20,"Día de la Soberanía Nacional"]].forEach(function(t){
    f[isoDe(trasladar(new Date(Date.UTC(anio,t[0]-1,t[1]))))]=t[2];
  });
  if(juris==="mendoza") fijo(7,25,"Santiago Apóstol, patrono de Mendoza (feriado provincial)");
  FERIADOS_CACHE[clave]=f;
  return f;
}
function antiguedad(a,b){
  var anios=0; while(masMeses(a,12*(anios+1))<=b) anios++;
  var desdeAniv=masMeses(a,12*anios),meses=0; while(masMeses(desdeAniv,meses+1)<=b) meses++;
  return {anios:anios,meses:meses,masDeTres:masMeses(desdeAniv,3)<b};
}
function diasVacaciones(anios){ return anios<5?14:anios<10?21:anios<20?28:35; }
var ACCIONES=[
  ["generico","Plazo genérico",60,"art. 2560 CCyC","Excepto que esté previsto uno diferente en la legislación local."],
  ["danos","Resarcimiento de daños derivados de la responsabilidad civil",36,"art. 2561 CCyC",""],
  ["laboral","Créditos de la relación individual de trabajo",24,"art. 256 LCT",""],
  ["accidente","Daños por accidentes y enfermedades del trabajo (acción de derecho común)",24,"art. 2562, inc. b, CCyC",""],
  ["transporte","Daños derivados del contrato de transporte de personas o cosas",24,"art. 2562, inc. d, CCyC",""],
  ["nulidad","Nulidad relativa y revisión de actos jurídicos",24,"art. 2562, inc. a, CCyC",""],
  ["periodicas","Lo que se devenga por años o plazos periódicos más cortos",24,"art. 2562, inc. c, CCyC","Salvo que se trate del reintegro de un capital en cuotas."],
  ["vicios","Vicios redhibitorios",12,"art. 2564, inc. a, CCyC",""],
  ["posesorias","Acciones posesorias",12,"art. 2564, inc. b, CCyC",""],
  ["sexuales","Daños por agresiones sexuales infligidas a personas incapaces",120,"art. 2561 CCyC","El cómputo comienza a partir del cese de la incapacidad."],
  ["lesa","Acciones civiles derivadas de delitos de lesa humanidad",0,"art. 2561 CCyC","Son imprescriptibles."]
];
var GLOSARIO=[
  ["A quo","Desde el cual","El tribunal de cuya resolución se recurre; también el día desde el que se cuenta un plazo (dies a quo)."],
  ["Ad quem","Hacia el cual","El tribunal ante el que se recurre; también el día en que vence un plazo (dies ad quem)."],
  ["Ab initio","Desde el principio","Desde el comienzo de un acto o de una relación jurídica."],
  ["Ad hoc","Para esto","Designado o creado para un fin determinado: un perito o un juez ad hoc."],
  ["Ad litem","Para el pleito","Con efectos limitados al proceso: curador o tutor ad litem."],
  ["Ad probationem","Para la prueba","Forma exigida solo para probar el acto, no para su validez."],
  ["Ad solemnitatem","Para la solemnidad","Forma exigida para la validez misma del acto."],
  ["Actori incumbit probatio","Al actor le incumbe la prueba","Regla de la carga de la prueba: quien afirma un hecho debe probarlo."],
  ["Amicus curiae","Amigo del tribunal","Tercero ajeno al pleito que aporta opinión fundada en causas de interés público."],
  ["Animus domini","Intención de dueño","Elemento subjetivo de la posesión, relevante en la usucapión."],
  ["Bona fide","De buena fe","Con la convicción de obrar conforme a derecho."],
  ["Contra legem","Contra la ley","Interpretación o costumbre opuesta al texto legal."],
  ["Culpa in eligendo","Culpa en la elección","Responsabilidad por haber elegido mal a quien causó el daño."],
  ["Culpa in vigilando","Culpa en la vigilancia","Responsabilidad por no haber vigilado debidamente a quien causó el daño."],
  ["De cuius","De quien","La persona fallecida cuya sucesión se trata (causante)."],
  ["De facto","De hecho","Situación que existe en los hechos, aunque no esté reconocida por el derecho."],
  ["De iure","De derecho","Situación reconocida por el ordenamiento jurídico."],
  ["Dura lex, sed lex","La ley es dura, pero es la ley","La ley debe cumplirse aunque su aplicación resulte severa."],
  ["Erga omnes","Frente a todos","Efecto que alcanza a todas las personas, no solo a las partes."],
  ["Ex nunc","Desde ahora","Efectos que se producen desde el momento del acto, sin retroactividad."],
  ["Ex tunc","Desde entonces","Efectos retroactivos al momento en que se originó la situación."],
  ["Ex officio","De oficio","Actuación del tribunal sin pedido de parte."],
  ["Exequatur","Ejecútese","Procedimiento para reconocer y ejecutar una sentencia extranjera."],
  ["Extra petita","Fuera de lo pedido","Vicio de la sentencia que resuelve sobre lo que no fue pedido."],
  ["Fumus boni iuris","Humo de buen derecho","Verosimilitud del derecho, requisito de las medidas cautelares."],
  ["Habeas corpus","Que tengas el cuerpo","Acción que protege la libertad física frente a detenciones ilegítimas."],
  ["Habeas data","Que tengas los datos","Acción para conocer, rectificar o suprimir datos personales."],
  ["In dubio pro reo","En la duda, a favor del reo","Ante la duda, se resuelve a favor del imputado."],
  ["In dubio pro operario","En la duda, a favor del trabajador","Regla de interpretación del derecho del trabajo (art. 9 LCT)."],
  ["In fine","Al final","Remite a la última parte de un artículo o párrafo."],
  ["In itinere","En el trayecto","Accidente ocurrido en el trayecto entre el domicilio y el lugar de trabajo."],
  ["In limine","En el umbral","Rechazo de una pretensión sin darle trámite."],
  ["Inaudita parte","Sin oír a la parte","Medida que se dicta sin escuchar previamente a la otra parte, como las cautelares."],
  ["Inter partes","Entre las partes","Efecto limitado a quienes intervinieron en el acto o en el proceso."],
  ["Ipso iure","Por el mismo derecho","Efecto que se produce de pleno derecho, sin necesidad de declaración."],
  ["Iura novit curia","El tribunal conoce el derecho","El juez aplica el derecho correcto aunque las partes lo invoquen mal."],
  ["Iure et de iure","De derecho y por derecho","Presunción que no admite prueba en contrario."],
  ["Iuris tantum","Solo de derecho","Presunción que admite prueba en contrario."],
  ["Ius variandi","Derecho de variar","Facultad del empleador de modificar las condiciones de trabajo dentro de los límites del art. 66 LCT."],
  ["Lato sensu","En sentido amplio","Interpretación extensiva de un término."],
  ["Lex posterior derogat priori","La ley posterior deroga a la anterior","Criterio para resolver conflictos entre normas de igual jerarquía."],
  ["Lex specialis derogat generali","La ley especial deroga a la general","Prevalece la norma que regula el caso de modo específico."],
  ["Lex superior derogat inferiori","La ley superior deroga a la inferior","Principio de jerarquía normativa."],
  ["Locus regit actum","El lugar rige el acto","La forma de los actos se rige por la ley del lugar donde se celebran."],
  ["Mutatis mutandis","Cambiando lo que debe cambiarse","Aplicación analógica con las adaptaciones necesarias."],
  ["Nemo auditur propriam turpitudinem allegans","Nadie es oído alegando su propia torpeza","Nadie puede invocar en su favor su propio obrar ilícito."],
  ["Nemo iudex in causa sua","Nadie es juez en su propia causa","Fundamento de la imparcialidad y de la recusación."],
  ["Non bis in idem","No dos veces por lo mismo","Prohibición de juzgar o sancionar dos veces por el mismo hecho."],
  ["Nulla poena sine lege","No hay pena sin ley","Principio de legalidad penal (art. 18 CN)."],
  ["Obiter dictum","Dicho de paso","Consideración de la sentencia que no es necesaria para la decisión y no tiene fuerza de precedente."],
  ["Onus probandi","Carga de la prueba","Deber de probar los hechos que se afirman."],
  ["Pacta sunt servanda","Los pactos deben cumplirse","Fuerza obligatoria de los contratos (art. 959 CCyC)."],
  ["Per saltum","Por salto","Recurso que omite una instancia intermedia."],
  ["Periculum in mora","Peligro en la demora","Riesgo de que el derecho se frustre si no se adopta una medida urgente; requisito cautelar."],
  ["Prima facie","A primera vista","Apreciación inicial, sujeta a lo que resulte de la prueba."],
  ["Pro homine","A favor de la persona","Se aplica la norma o la interpretación más protectora de los derechos humanos."],
  ["Quantum","Cuánto","Monto de una indemnización o de una condena."],
  ["Ratio decidendi","Razón de decidir","Fundamento esencial de la sentencia, que tiene valor de precedente."],
  ["Rebus sic stantibus","Estando así las cosas","Los contratos se cumplen mientras no cambien radicalmente las circunstancias (imprevisión, art. 1091 CCyC)."],
  ["Reformatio in peius","Reforma en perjuicio","Prohibición de empeorar la situación de quien recurre por su solo recurso."],
  ["Res iudicata","Cosa juzgada","Autoridad de la sentencia firme, que no puede volver a discutirse."],
  ["Res inter alios acta","Cosa hecha entre otros","Lo pactado entre terceros no perjudica ni aprovecha a quien no intervino."],
  ["Sine qua non","Sin la cual no","Condición indispensable."],
  ["Solve et repete","Paga y luego reclama","Exigencia de pagar el tributo antes de discutirlo judicialmente."],
  ["Stricto sensu","En sentido estricto","Interpretación restrictiva de un término."],
  ["Sub iudice","Bajo juicio","Cuestión pendiente de resolución judicial."],
  ["Ultra petita","Más allá de lo pedido","Vicio de la sentencia que concede más de lo solicitado."],
  ["Vacatio legis","Vacancia de la ley","Período entre la publicación de una ley y su entrada en vigencia (art. 5 CCyC)."],
  ["Venire contra factum proprium","Ir contra el acto propio","Nadie puede contradecir su propia conducta anterior, jurídicamente relevante."]
];