/* ============================================================
   IVS CODEX · análisis del fallo abierto en el Lector.

   Vive en un archivo aparte (antes estaba dentro de index.html) para que
   las pruebas automáticas puedan correrlo en Node: ver
   backend/test/analisis.prueba.js. Se carga ANTES del script principal de
   index.html y deja en el ámbito global lo que ese script usa: detectar(),
   las tablas de normas (LEYES_BASE, CATEGORIA_FUENTE…) e IVSAnalisis.

   Todo corre en el navegador de quien lee: el fallo no se manda a ningún
   lado y no hay ningún modelo de lenguaje detrás. Son reglas sobre el
   texto, y cada resultado guarda el fragmento que lo justifica.
   ============================================================ */
/* Detección de datos de la sentencia. Es heurística: se ofrece
   como propuesta para confirmar, nunca como dato cerrado. */
var MESES={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,
           septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};

/* Los tribunales fechan la sentencia en letras ("a los quince días del mes
   de julio del año dos mil veintiséis"), nunca en números: sin esto, la
   fecha propia del fallo no se detecta y el analizador termina agarrando
   la fecha de otro fallo citado más abajo en el texto. */
function sinTildes(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); }

var UNIDADES_0_9={cero:0,un:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9};
var ESPECIALES_10_29={
  diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,
  dieciocho:18,diecinueve:19,veinte:20,veintiun:21,veintiuno:21,veintidos:22,
  veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,
  veintiocho:28,veintinueve:29
};
var DECENAS={treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90};

/** "quince" -> 15, "treinta y uno" -> 31, "cuarenta y dos" -> 42. Nulo si no reconoce. */
function numeroPalabras(frag){
  var s=sinTildes(frag).replace(/\s+/g," ").trim();
  var junto=s.replace(/\s/g,"");
  if(ESPECIALES_10_29.hasOwnProperty(junto)) return ESPECIALES_10_29[junto];
  if(UNIDADES_0_9.hasOwnProperty(s)) return UNIDADES_0_9[s];
  if(DECENAS.hasOwnProperty(s)) return DECENAS[s];
  var partes=s.split(" y ");
  if(partes.length===2&&DECENAS.hasOwnProperty(partes[0])&&UNIDADES_0_9.hasOwnProperty(partes[1])){
    return DECENAS[partes[0]]+UNIDADES_0_9[partes[1]];
  }
  return null;
}
/** "dos mil veintiséis" -> 2026, "mil novecientos noventa y ocho" -> 1998. */
function anioPalabras(frag){
  var s=sinTildes(frag).replace(/\s+/g," ").trim();
  var m=s.match(/^(mil novecientos|dos mil)\s*(.*)$/);
  if(!m) return null;
  var base=m[1]==="dos mil"?2000:1900;
  if(!m[2]) return base;
  var resto=numeroPalabras(m[2]);
  return resto===null?null:base+resto;
}
/** Busca la fórmula clásica de apertura ("a los N días del mes de MES de AÑO")
    y devuelve la fecha ya armada, o null si no la encuentra. */
function fechaDeFormulaApertura(ventana){
  // «a los quince días», pero también «a ocho días» (SCJM) y «a 12 días del
  // mes de agosto del 2026»: el artículo es optativo y el día o el año
  // pueden venir en números.
  var re=/a\s+(?:los?\s+)?([a-záéíóúñ]+|\d{1,2})\s+d[ií]as?\s+(?:del?\s+mes\s+de\s+|de\s+)([a-záéíóúñ]+)\s+de(?:l)?\s+(?:año\s+)?(\d{4}|[a-záéíóúñ\s]+?)(?:[,.;\n]|$)/i;
  var m=ventana.match(re);
  if(!m) return null;
  if(/^\d+$/.test(m[1])||/^\d+$/.test(m[3])){
    var dn=/^\d+$/.test(m[1])?+m[1]:numeroPalabras(m[1]),an=/^\d+$/.test(m[3])?+m[3]:anioPalabras(m[3]),mn=MESES[sinTildes(m[2])];
    if(dn==null||!mn||an==null) return null;
    return ("0"+dn).slice(-2)+"/"+("0"+mn).slice(-2)+"/"+an;
  }
  var dia=numeroPalabras(m[1]),mes=MESES[sinTildes(m[2])],anio=anioPalabras(m[3]);
  if(dia==null||!mes||anio==null) return null;
  return ("0"+dia).slice(-2)+"/"+("0"+mes).slice(-2)+"/"+anio;
}

/* Jerarquía normativa: cada fuente detectada cae en una categoría fija,
   de mayor a menor jerarquía, para que el lector se lea de arriba abajo
   igual que se razona un caso. */
var CATEGORIA_FUENTE={
  "Constitución Nacional":"cn",
  "CADH":"tratados","PIDCP":"tratados","PIDESC":"tratados",
  "Protocolo Facultativo del PIDCP":"tratados",
  "Declaración Americana de los Derechos y Deberes del Hombre":"tratados",
  "Declaración Universal de Derechos Humanos":"tratados",
  "Convención para la Prevención y la Sanción del Delito de Genocidio":"tratados",
  "Convención sobre la Eliminación de Todas las Formas de Discriminación Racial":"tratados",
  "Convención contra la Tortura":"tratados",
  "Convención sobre los Derechos del Niño":"tratados",
  "Convención Interamericana sobre Desaparición Forzada de Personas":"tratados",
  "Convención sobre la Imprescriptibilidad de los Crímenes de Guerra y de Lesa Humanidad":"tratados",
  "Convención de Belém do Pará":"tratados","CEDAW":"tratados",
  "CCyC (vigente)":"fondo","Código Civil (derogado)":"fondo","Código de Comercio (derogado)":"fondo",
  "Código Penal":"fondo","Ley de Contrato de Trabajo (LCT)":"fondo","Ley de Defensa del Consumidor (LDC)":"fondo","Ley de Seguros (LS)":"fondo",
  "Ley General de Sociedades (LGS)":"fondo","Ley de Riesgos del Trabajo (LRT)":"fondo","Ley de Concursos y Quiebras (LCQ)":"fondo",
  "Ley de Procedimientos Administrativos (LPA)":"leyes","Constitución provincial":"provincial",
  "CPCCN":"provincial","CPCCyT (Mendoza)":"provincial","CCAyT (CABA)":"provincial","CPC":"provincial","Código Procesal Penal":"provincial","Ley Arancelaria (LA)":"provincial"
};
function categoriaDeFuente(label,esProvincial){
  if(CATEGORIA_FUENTE.hasOwnProperty(label)) return CATEGORIA_FUENTE[label];
  if(/^(Decreto|Ordenanza|Resoluci[oó]n)\b/i.test(label)) return "local";
  if(/^Ley\s/.test(label)) return esProvincial?"provincial":"leyes";
  return "otras";
}

/* Base de leyes verificada contra fuente oficial (Boletín Oficial,
   argentina.gob.ar/normativa, SAIJ, jusmendoza.gob.ar), nacional y de
   Mendoza. Es un punto de partida — no pretende cubrir todo el
   ordenamiento, sino las normas que más se citan en las ramas que ya
   están mapeadas en RAMAS. Se amplía con el uso, a medida que aparecen
   leyes nuevas en fallos reales. Clave = número de ley sin puntos. */
var LEYES_BASE={
  "11179":{nombre:"Código Penal",cat:"fondo",vigente:true},
  "20744":{nombre:"Ley de Contrato de Trabajo (LCT)",cat:"fondo",vigente:true},
  "24240":{nombre:"Ley de Defensa del Consumidor (LDC)",cat:"fondo",vigente:true},
  "17418":{nombre:"Ley de Seguros",cat:"fondo",vigente:true},
  "24557":{nombre:"Ley de Riesgos del Trabajo",cat:"fondo",vigente:true},
  "19550":{nombre:"Ley General de Sociedades",cat:"fondo",vigente:true},
  "24522":{nombre:"Ley de Concursos y Quiebras",cat:"fondo",vigente:true},
  "26485":{nombre:"Ley de Protección Integral a las Mujeres",cat:"fondo",vigente:true},
  "26994":{nombre:"Ley aprobatoria del Código Civil y Comercial",cat:"fondo",vigente:true},
  "17454":{nombre:"Código Procesal Civil y Comercial de la Nación (CPCCN)",cat:"provincial",vigente:true},
  "9001":{nombre:"Código Procesal Civil, Comercial y Tributario de Mendoza",cat:"provincial",vigente:true},
  "9177":{nombre:"Modificatoria del Código Procesal Civil, Comercial y Tributario de Mendoza",cat:"provincial",vigente:true},
  "6730":{nombre:"Código Procesal Penal de Mendoza",cat:"provincial",vigente:true},
  "9608":{nombre:"Reforma 2025 al Código Procesal Penal de Mendoza",cat:"provincial",vigente:true},
  "9003":{nombre:"Ley de Procedimiento Administrativo de Mendoza",cat:"provincial",vigente:true},
  "3909":{nombre:"Ley de Procedimiento Administrativo de Mendoza (anterior a la ley 9.003)",cat:"provincial",vigente:false},
  "4362":{nombre:"Código Fiscal de Mendoza",cat:"provincial",vigente:true},
  "322":{nombre:"Organización del Departamento General de Irrigación",cat:"provincial",vigente:true},

  /* Sumadas contra la Base SAIJ de Normativa Provincial (Ministerio de
     Justicia, datos.gob.ar) y, para lo nacional, fuentes oficiales
     (argentina.gob.ar/normativa, InfoLeg). Ver conversación del 10/8/2026. */
  "26657":{nombre:"Ley de Salud Mental",cat:"fondo",vigente:true},
  "25871":{nombre:"Ley de Migraciones",cat:"fondo",vigente:true},
  "26618":{nombre:"Ley de Matrimonio Igualitario",cat:"fondo",vigente:true},
  "26061":{nombre:"Ley de Protección Integral de los Derechos de Niñas, Niños y Adolescentes",cat:"fondo",vigente:true},
  "25326":{nombre:"Ley de Protección de Datos Personales",cat:"fondo",vigente:true},
  "24660":{nombre:"Ley de Ejecución de la Pena Privativa de la Libertad",cat:"fondo",vigente:true},
  "26743":{nombre:"Ley de Identidad de Género",cat:"fondo",vigente:true},
  "27610":{nombre:"Ley de Acceso a la Interrupción Voluntaria del Embarazo (IVE)",cat:"fondo",vigente:true},

  "552":{nombre:"Ley Orgánica de Tribunales de Mendoza",cat:"provincial",vigente:true},
  "8008":{nombre:"Ley Orgánica del Ministerio Público de Mendoza",cat:"provincial",vigente:true},
  "9577":{nombre:"Ley Orgánica de la Dirección de Personas Jurídicas y Registro Público de Mendoza",cat:"provincial",vigente:true},
  "9292":{nombre:"Ley Orgánica del Tribunal de Cuentas de Mendoza",cat:"provincial",vigente:true},
  "1079":{nombre:"Ley Orgánica de Municipalidades de Mendoza",cat:"provincial",vigente:true},
  "2144":{nombre:"Código Procesal Laboral de Mendoza",cat:"provincial",vigente:true},
  "3918":{nombre:"Código Procesal Administrativo de Mendoza",cat:"provincial",vigente:true},
  "9120":{nombre:"Código Procesal de Familia y Violencia Familiar de Mendoza",cat:"provincial",vigente:true},
  "9099":{nombre:"Código de Contravenciones de la Provincia de Mendoza",cat:"provincial",vigente:true},
  "8465":{nombre:"Código de Ejecución de la Pena Privativa de la Libertad de Mendoza",cat:"provincial",vigente:true},
  "6913":{nombre:"Código de Procedimientos Mineros de Mendoza",cat:"provincial",vigente:true},
  "9361":{nombre:"Código Tributario Municipal Armonizado de Mendoza",cat:"provincial",vigente:true},
  "1920":{nombre:"Uso del Agua Pública para Agricultura (Mendoza)",cat:"provincial",vigente:true},
  "5961":{nombre:"Ley de Preservación del Ambiente de Mendoza",cat:"provincial",vigente:true},
  "8051":{nombre:"Ley de Ordenamiento Territorial y Usos del Suelo de Mendoza",cat:"provincial",vigente:true},
  "9659":{nombre:"Ley de Gestión Integral de Residuos Sólidos Urbanos de Mendoza",cat:"provincial",vigente:true},
  "6672":{nombre:"Ley de Violencia Familiar de Mendoza",cat:"provincial",vigente:true},
  "9100":{nombre:"Ley de Paridad de Género en Materia Electoral de Mendoza",cat:"provincial",vigente:true},
  "9314":{nombre:"Ley de Defensa del Consumidor de Mendoza",cat:"provincial",vigente:true},
  "1447":{nombre:"Ley General de Expropiaciones de Mendoza",cat:"provincial",vigente:true},
  "9070":{nombre:"Ley de Acceso a la Información Pública de Mendoza",cat:"provincial",vigente:true},
  "560":{nombre:"Estatuto del Empleado Público de Mendoza",cat:"provincial",vigente:true},
  "2551":{nombre:"Ley Electoral de la Provincia de Mendoza",cat:"provincial",vigente:true},
  "9131":{nombre:"Aranceles de Abogados y Procuradores de Mendoza",cat:"provincial",vigente:true},
  /* Leyes de Mendoza sobre intereses y el recurso extraordinario provincial,
     tal como las describe la propia SCJM (fallo del 08/05/2026, expte.
     13-07241584-6/1): la 4.087 fue derogada por la 9.041, y la 9.516 (B.O.
     08/04/2024) rige desde su entrada en vigencia. */
  "9041":{nombre:"Intereses moratorios (Mendoza)",cat:"provincial",vigente:true},
  "9516":{nombre:"Intereses moratorios (Mendoza, 2024)",cat:"provincial",vigente:true},
  "4087":{nombre:"Intereses (Mendoza, derogada por la Ley 9.041)",cat:"provincial",vigente:false},
  "9423":{nombre:"Recurso extraordinario provincial (Mendoza)",cat:"provincial",vigente:true}
};
/* Las leyes que tienen nombre propio: citadas por número van al mismo grupo
   que cuando se las nombra con palabras o por la sigla. */
var LEY_A_NORMA={
  "24240":"Ley de Defensa del Consumidor (LDC)","20744":"Ley de Contrato de Trabajo (LCT)",
  "17418":"Ley de Seguros (LS)","11179":"Código Penal","17454":"CPCCN","9001":"CPCCyT (Mendoza)",
  "19550":"Ley General de Sociedades (LGS)","24557":"Ley de Riesgos del Trabajo (LRT)",
  "24522":"Ley de Concursos y Quiebras (LCQ)","19549":"Ley de Procedimientos Administrativos (LPA)"
};
/* Cuántos artículos tiene cada norma: un «art. 1741» suelto no puede ser
   de la Constitución, aunque el fallo viniera hablando de ella. */
var MAX_ART={
  "CCyC (vigente)":2671,"Código Civil (derogado)":4051,"Constitución Nacional":129,"Código Penal":317,
  "Ley de Contrato de Trabajo (LCT)":277,"Ley de Defensa del Consumidor (LDC)":66,"CPCCN":784,
  "Ley General de Sociedades (LGS)":395,"Ley de Riesgos del Trabajo (LRT)":51,
  "Ley de Concursos y Quiebras (LCQ)":293,"Ley de Seguros (LS)":163,"Ley de Procedimientos Administrativos (LPA)":32
};
/* Las normas cuyo texto trae el servidor (InfoLeg): ver NORMAS en
   backend/lib/legislacion.js. */
var NORMA_A_CLAVE={
  "CCyC (vigente)":"ccyc","Constitución Nacional":"cn","Ley de Contrato de Trabajo (LCT)":"lct",
  "Ley de Concursos y Quiebras (LCQ)":"lcq","Ley de Procedimientos Administrativos (LPA)":"lpa",
  "Ley de Defensa del Consumidor (LDC)":"ldc","Código Penal":"cp","CPCCN":"cpccn",
  "Ley General de Sociedades (LGS)":"lgs","Ley de Riesgos del Trabajo (LRT)":"lrt","Ley 16.986":"amparo"
};
function soloDigitos(s){ return String(s).replace(/\./g,"").replace(/^0+(?=\d)/,""); }
function detectar(texto){
  // Los saltos de línea del documento original (el HTML de la SCJM corta
  // cada renglón) partían la carátula, el tribunal y la fecha: «SUPREMA\nCORTE»
  // no coincidía con «suprema corte.{0,40}mendoza». El encabezado se lee con
  // los espacios normalizados; los artículos (más abajo) siguen sobre el
  // texto tal cual, para que sus posiciones sirvan para ubicarlos.
  var t=texto.slice(0,12000).replace(/[\s\u00a0]+/g," "),d={},m;
  // La identidad propia del fallo (caratula, fecha, tomo/pagina) vive casi
  // siempre en el encabezado. Buscarla primero ahi evita el error mas comun:
  // agarrar el dato de OTRO fallo citado mas abajo, en vez del que se esta
  // analizando. Si no aparece cerca del encabezado, se busca en todo el
  // texto como respaldo (salvo el tomo/pagina, ver mas abajo por que no).
  var apertura=t.slice(0,1200);

  // La carátula: primero la que va entre comillas (completa, aunque tenga
  // puntos como «S.A.» o «EXPTE. Nº»); si no, la del encabezado. También
  // se aceptan «contra»/«sobre» en lugar de «c/»/«s/» (TSJ).
  var reCarComillas=/[“"«]\s*([A-ZÁÉÍÓÚÑ][^”"»]{4,260}?\s+(?:c\/|contra)\s+[^”"»]{2,320}?\s+(?:s\/|p\/|sobre)\s*[^”"»]{2,260}?)\s*[”"»]/i;
  var reCarSuelta=/([A-ZÁÉÍÓÚÑ](?:(?!\.\s)[^"“”]){4,160}?\s+(?:c\/|contra)\s+(?:(?!\.\s)[^"“”]){2,160}?\s+(?:s\/|p\/|sobre)\s+(?:(?!\.\s)[^"“”]){2,120}?)\s*(?:\.(?:\s|$)|\*\d|$)/i;
  // la carátula suelta del encabezado no es la de un precedente que se cita
  var mSuelta=apertura.match(reCarSuelta);
  if(mSuelta&&/\b(?:in\s+re|resuelto|conforme|causa|precedente|cfr|v\.\s?gr)\b/i.test(mSuelta[1])) mSuelta=null;
  m=apertura.match(reCarComillas)||mSuelta||t.match(reCarComillas);
  if(m) d.car=m[1].replace(/\s+/g," ").trim();

  // El tribunal se busca primero en el encabezado: un fallo de la SCJM que
  // cita a la Corte Suprema en la página 2 sigue siendo de la SCJM.
  var TRIBUNALES=[
    [/suprema\s+corte\s+de\s+justicia.{0,60}mendoza|\bS\.?C\.?J\.?M\b/i,"Suprema Corte de Justicia de Mendoza","scjm"],
    [/suprema\s+corte\s+de\s+justicia.{0,60}buenos\s+aires|\bSCBA\b/i,"Suprema Corte de Justicia de la Provincia de Buenos Aires","scba"],
    // el TSJ porteño: su nombre, «Expte. n° TSJ…», la fórmula «Vistos: los autos indicados en el epígrafe»,
    // el pie de página del año de la Constitución de la Ciudad o el sello «TSJ|EXP:» de la firma digital
    [/tribunal\s+superior\s+de\s+justicia(?:.{0,60}ciudad\s+aut[oó]noma)?|\bExpte\.?\s*n[°º]?\s*(?:TSJ|QTS)\b|Vist[oa]s?:?\s*(?:los\s+autos|las\s+actuaciones|el\s+expediente)\s+indicad[oa]s?\s+en\s+el\s+ep[ií]grafe|Aniversario\s+de\s+la\s+sanci[oó]n\s+de\s+la\s+Constituci[oó]n\s+de\s+la\s+Ciudad|TSJ\|EXP:/i,"Tribunal Superior de Justicia de la Ciudad Autónoma de Buenos Aires","tsj"],
    [/corte\s+suprema\s+de\s+justicia\s+de\s+la\s+naci/i,"Corte Suprema de Justicia de la Nación","csjn"],
    [/corte\s+interamericana/i,"Corte Interamericana de Derechos Humanos","cidh"],
    [/tribunal\s+europeo|european\s+court\s+of\s+human\s+rights/i,"Tribunal Europeo de Derechos Humanos","tedh"]
  ];
  [apertura,t].some(function(v){
    return TRIBUNALES.some(function(x){ if(x[0].test(v)){ d.trib=x[1]; d.tipo=x[2]; return true; } return false; });
  });
  if(!d.tipo){
    m=t.match(/((?:Excma\.?\s+)?(?:C[áa]mara|Juzgado|Tribunal)[^\n.;]{5,90})/i);
    if(m){ d.trib=m[1].replace(/\s+/g," ").trim(); d.tipo="cam"; }
  }

  // El "Fallos: tomo:pagina" es la forma en que la CSJN identifica sus
  // propios fallos - ningun otro tribunal publica en esa coleccion. Si el
  // documento no es de la CSJN, cualquier "Fallos: X:Y" que aparezca es casi
  // seguro una cita a un fallo distinto citado como precedente: mejor no
  // mostrar nada que mostrar el tomo de otra sentencia como si fuera esta.
  if(d.tipo==="csjn"||!d.tipo){
    m=apertura.match(/Fallos:?\s*(\d{2,3})\s*:\s*(\d{1,4})/i);
    if(m){ d.tomo=m[1]; d.pag=m[2]; }
  }

  // «la causa especificadas» se tomaba como número de expediente: ahora el
  // número tiene que tener dígitos, y el CUIJ (identificador único) manda.
  m=apertura.match(/\bCUIJ:?\s*(\d[\d\-\/]{6,30}\d)/i)
    ||t.match(/\b(?:expte\.?|expediente|causa)\s*(?:n\.?\s*[°ºo]\.?\s*|nro\.?\s*)?:?\s*((?:[A-Z]{2,4}\s)?\d[\w\-\/\.]{3,28})/i);
  if(m) d.exp=m[1].replace(/[.,;]$/,"");

  var fechaFormula=fechaDeFormulaApertura(apertura);
  if(fechaFormula){
    d.fecha=fechaFormula;
  }else{
    // Sin fórmula de apertura: la fecha del cierre («SENTENCIA: Mendoza, 08 de
    // mayo de 2026», «Buenos Aires, 2 de julio de 2003») y si no, una del
    // encabezado. Antes se tomaba la primera fecha de todo el texto, que en
    // una sentencia suele ser la del hecho (en el fallo de Río Uruguay, la
    // del accidente: 04/10/2022).
    var cierre=texto.slice(-4000).replace(/[\s\u00a0]+/g," "),mc,ult=null;
    var reCierre=/(?:SENTENCIA\s*:?|[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚ][a-záéíóúñ]+){0,3}|MENDOZA|BUENOS AIRES),\s*(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de(?:l)?\s+(\d{4})/g;
    while((mc=reCierre.exec(cierre))) if(MESES[sinTildes(mc[2])]) ult=mc;
    var reLugarFecha=/(?:[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚ][a-záéíóúñ]+){0,3}|MENDOZA|BUENOS AIRES|Fecha:?|fecha:?),\s*(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de(?:l)?\s+(\d{4})/;
    m=apertura.match(reLugarFecha)||ult;
    if(m&&!MESES[sinTildes(m[2])]) m=ult;
    if(m&&MESES[sinTildes(m[2])]){
      d.fecha=("0"+m[1]).slice(-2)+"/"+("0"+MESES[sinTildes(m[2])]).slice(-2)+"/"+m[3];
    }else{
      // una fecha numérica suelta del encabezado suele ser de otra cosa (el
      // ingreso al trabajo, el hecho): sólo vale si dice que es la fecha
      // la firma digital (TSJ: «FIRMADO DIGITALMENTE 09/09/2026 13:29») fecha la resolución
      m=apertura.match(/\bFecha(?:\s+de\s+(?:la\s+)?sentencia\s*:?|\s*:)\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/i)
        ||texto.slice(-3000).match(/FIRMADO\s+DIGITALMENTE\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
      if(m) d.fecha=("0"+m[1]).slice(-2)+"/"+("0"+m[2]).slice(-2)+"/"+m[3];
    }
  }
  m=t.match(/Sala\s+([IVXLC]+|\d+|[ÚU]nica|Primera|Segunda|Tercera|Cuarta)\b/i);
  if(m) d.sala="Sala "+m[1];
  /* Los procesales van primero: «C.P.C.C.» contiene «C.C.» y «código
     procesal civil y comercial de la Nación» contiene «civil y comercial».
     Cuando dos nombres empiezan (o terminan) en el mismo lugar, gana el que
     está antes en esta lista. */
  var CODIGOS=[
    [/c[oó]digo\s+procesal\s+civil\s+y\s+comercial\s+de\s+la\s+naci[oó]n|c[oó]d\.?\s*proc\.?\s*civ\.?\s*y\s*com\.?\s*(?:de\s+la\s+)?naci[oó]n|\bcpccn\b|\bc\.\s*p\.\s*c\.\s*c\.\s*n\.?/i,"CPCCN"],
    [/c[oó]digo\s+procesal\s+civil,?\s+comercial\s+y\s+tributario|\bcpcc?y?tm?\b|\bc\.\s*p\.\s*c\.\s*c\.\s*(?:y\s*)?t\.?(?:\s*m\.?)?/i,"CPCCyT (Mendoza)"],
    [/c[oó]digo\s+procesal\s+civil(?:\s+y\s+comercial)?\b|c[oó]d\.?\s*proc\.?\s*civ\.?|\bcpcc?\b|\bc\.\s*p\.\s*c\.(?:\s*c\.)?/i,"CPC"],
    [/c[oó]digo\s+contencioso\s+administrativo\s+y\s+tributario|\bcc?ayt\b/i,"CCAyT (CABA)"],
    [/c[oó]digo\s+procesal\s+penal\b|\bcppn?\b|\bc\.\s*p\.\s*p\.(?:\s*n\.)?/i,"Código Procesal Penal"],
    [/c[oó]digo\s+civil\s+y\s+comercial(?:\s+de\s+la\s+naci[oó]n)?|c[oó]d\.?\s*civ\.?\s*y\s*com\.?|\bccycn?\b|\bcccn\b|\bc\.\s*c\.\s*c\.\s*n\.?|\bc\.\s*c\.\s*y\s*c\.?(?:\s*n\.?)?/i,"CCyC (vigente)"],
    [/c[oó]digo\s+civil\b(?!\s+y\s+comercial)|c[oó]d\.?\s*civ(?:il)?\.?(?!\s*y\s*com)|\bc\.\s*c\.(?!\s*y)/i,"Código Civil (derogado)"],
    [/\bCC\b/,"Código Civil (derogado)"],
    [/c[oó]digo\s+penal\b|\bcp\b/i,"Código Penal"],
    [/c[oó]digo\s+de\s+comercio\b|c[oó]d\.?\s*com\.?(?!\s*y)\b/i,"Código de Comercio (derogado)"],
    [/constituci[oó]n\s+(?:de\s+la\s+)?naci[oó]n(?:al)?(?:\s+argentina)?|const(?:\.|ituci[oó]n)\s*nac(?:\.|ional)|carta\s+magna|\bcn\b|\bc\.\s*n\.(?!\s*(?:a\.|civ|com|trab|fed|cont|crim|pen|apel|cas|elec|seg|t\.))/i,"Constitución Nacional"],
    [/constituci[oó]n\s+(?:provincial|de\s+la\s+provincia(?:\s+de\s+[a-záéíóú]+(?:\s+[a-záéíóú]+)?)?|de\s+(?:mendoza|buenos\s+aires|c[oó]rdoba|santa\s+fe)|de\s+la\s+ciudad(?:\s+aut[oó]noma)?(?:\s+de\s+buenos\s+aires)?)|\bccaba\b/i,"Constitución provincial"],
    [/ley\s+de\s+contrato\s+de\s+trabajo|\blct\b|\bl\.\s*c\.\s*t\./i,"Ley de Contrato de Trabajo (LCT)"],
    [/ley\s+de\s+defensa\s+(?:del|al)\s+consumidor|\bldc\b|\bl\.\s*d\.\s*c\./i,"Ley de Defensa del Consumidor (LDC)"],
    [/ley\s+de\s+riesgos\s+del\s+trabajo|\blrt\b|\bl\.\s*r\.\s*t\./i,"Ley de Riesgos del Trabajo (LRT)"],
    [/ley\s+(?:general\s+)?de\s+sociedades(?:\s+comerciales)?|\blgs\b|\blsc\b/i,"Ley General de Sociedades (LGS)"],
    [/ley\s+de\s+concursos(?:\s+y\s+quiebras)?|\blcq\b|\bl\.\s*c\.\s*q\./i,"Ley de Concursos y Quiebras (LCQ)"],
    [/ley\s+nacional\s+de\s+procedimientos?\s+administrativos?|\blnpa\b/i,"Ley de Procedimientos Administrativos (LPA)"],
    [/\b[Ll]ey\s+de\s+[Ss]eguros\b|\bLS\b|\bL\.\s*S\./,"Ley de Seguros (LS)"],
    [/\b[Ll]ey\s+[Aa]rancelaria\b|\bL\.\s*A\.(?=[\s,;)]|$)/,"Ley Arancelaria (LA)"],
    [/convenci[oó]n\s+americana\s+sobre\s+derechos\s+humanos|pacto\s+de\s+san\s+jos[ée]\s+de\s+costa\s+rica|\bcadh\b/i,"CADH"],
    [/pacto\s+internacional\s+de\s+derechos\s+civiles\s+y\s+pol[ií]ticos|\bpidcp\b/i,"PIDCP"],
    [/pacto\s+internacional\s+de\s+derechos\s+econ[oó]micos,?\s+sociales\s+y\s+culturales|\bpidesc\b/i,"PIDESC"],
    [/convenci[oó]n\s+sobre\s+los\s+derechos\s+del\s+ni[ñn]o|\bcdn\b/i,"Convención sobre los Derechos del Niño"],
    [/convenci[oó]n\s+interamericana\s+para\s+prevenir,?\s+sancionar\s+y\s+erradicar\s+la\s+violencia\s+contra\s+la\s+mujer|convenci[oó]n\s+de\s+bel[ée]m\s+do\s+par[áa]/i,"Convención de Belém do Pará"],
    [/convenci[oó]n\s+sobre\s+la\s+eliminaci[oó]n\s+de\s+todas\s+las\s+formas\s+de\s+discriminaci[oó]n\s+contra\s+la\s+mujer|\bcedaw\b/i,"CEDAW"],
    [/declaraci[oó]n\s+universal\s+de\s+derechos\s+humanos|\bdudh\b/i,"Declaración Universal de Derechos Humanos"],
    [/declaraci[oó]n\s+americana\s+de\s+los\s+derechos\s+y\s+deberes\s+del\s+hombre/i,"Declaración Americana de los Derechos y Deberes del Hombre"],
    [/protocolo\s+facultativo\s+del\s+pacto\s+internacional\s+de\s+derechos\s+civiles\s+y\s+pol[ií]ticos/i,"Protocolo Facultativo del PIDCP"],
    [/convenci[oó]n\s+(?:para\s+la\s+prevenci[oó]n\s+y\s+la?\s+sanci[oó]n\s+del\s+delito\s+de\s+genocidio|contra\s+el\s+genocidio)/i,"Convención para la Prevención y la Sanción del Delito de Genocidio"],
    [/convenci[oó]n\s+internacional\s+sobre\s+la\s+eliminaci[oó]n\s+de\s+todas\s+las\s+formas\s+de\s+discriminaci[oó]n\s+racial|\bcerd\b/i,"Convención sobre la Eliminación de Todas las Formas de Discriminación Racial"],
    [/convenci[oó]n\s+contra\s+la\s+tortura(\s+y\s+otros\s+tratos)?/i,"Convención contra la Tortura"],
    [/convenci[oó]n\s+interamericana\s+sobre\s+desaparici[oó]n\s+forzada\s+de\s+personas/i,"Convención Interamericana sobre Desaparición Forzada de Personas"],
    [/convenci[oó]n\s+sobre\s+la\s+imprescriptibilidad\s+de\s+los\s+cr[ií]menes\s+de\s+guerra\s+y\s+de\s+lesa\s+humanidad/i,"Convención sobre la Imprescriptibilidad de los Crímenes de Guerra y de Lesa Humanidad"]
  ];
  CODIGOS.forEach(function(c){ c[2]=new RegExp(c[0].source,c[0].flags.replace("g","")+"g"); });
  function formatLeyNum(s){
    var n=soloDigitos(s);
    return n.length>3?n.replace(/\B(?=(\d{3})+(?!\d))/g,"."):n;
  }
  function capitalizar(s){ return s.charAt(0).toUpperCase()+s.slice(1).toLowerCase(); }
  /* Una ley citada por número: si es un código o una ley con nombre propio,
     va al mismo grupo que cuando se la nombra con palabras («ley 24.240» y
     «LDC» son la misma norma). */
  function etiquetaDeLey(n){
    var k=soloDigitos(n);
    if(LEY_A_NORMA[k]) return LEY_A_NORMA[k];
    var b=LEYES_BASE[k];
    return b?"Ley "+formatLeyNum(n)+" — "+b.nombre+(b.vigente===false?" (derogada)":""):"Ley "+formatLeyNum(n);
  }
  /* En un fallo de un tribunal provincial, una ley de número bajo (menos de
     11.000) que no está en LEYES_BASE es casi siempre provincial: las leyes
     nacionales vigentes que se citan llevan cinco dígitos. Antes las leyes
     9.041 y 9.516 de Mendoza aparecían como «Leyes nacionales». */
  var docProvincial=/^(scjm|scba|tsj)$/.test(d.tipo||"");
  function categoriaDeLey(etiqueta,n,esProv){
    if(CATEGORIA_FUENTE.hasOwnProperty(etiqueta)) return CATEGORIA_FUENTE[etiqueta];
    var b=LEYES_BASE[soloDigitos(n)];
    if(b) return b.cat;
    if(esProv||(docProvincial&&parseInt(soloDigitos(n),10)<11000)) return "provincial";
    return "leyes";
  }
  var reLeyEn=/\bley\s*(provincial\s+|nacional\s+|federal\s+)?(?:n[°ºo.]?\s*|nro\.?\s*)?(\d[\d\.]{1,7}\d)/i;
  var reDecEn=/\b(decreto|ordenanza|resoluci[oó]n)\s*(?:reglamentario\s+)?(?:n[°ºo.]?\s*|nro\.?\s*)?(\d[\d\.]{0,6}(?:\/\d{2,4})?)/i;
  /* Entre el número del artículo y el nombre de la norma sólo puede haber
     palabras de enlace («del», «segundo párrafo», «inc. 3», «in fine»...).
     Si aparece cualquier otra cosa, el nombre ya habla de otra frase. */
  var CONECTOR=/^(?:del?|la|el|los|las|lo|en|su|sus|y|e|o|que|segund[oa]|primer[oa]?|tercer[oa]?|cuart[oa]|[uú]ltim[oa]|p[áa]rrafos?|partes?|incs?|incisos?|aps?|apartados?|in|fine|cc|ss|sgtes|siguientes|concs?|concordantes|ambos|todos|nuevo|actual|vigente|texto|t|seg[uú]n|conf|cfr|ref|n|nro|bis|ter|establece|dispone|prev[ée]|prescribe|regula|contempla|consagra|se[ñn]ala|reza|ley|nacional|provincial)$/i;
  function soloConectores(s){
    var pal=s.replace(/[\s,;:()\[\]\-–—.°º"“”']+/g," ").trim();
    if(!pal) return true;
    return pal.split(" ").every(function(w){ return CONECTOR.test(w)||/^\d{1,3}$/.test(w)||/^[ivxl]+$/i.test(w)||/^[a-zñ]\)?$/i.test(w); });
  }
  var reMismo=/^[\s,;(]*(?:(?:del?|de\s+la|de\s+dich[oa]|de\s+es[ea])\s+)?(?:(?:mism[oa]|citad[oa]|referid[oa]|aludid[oa]|precitad[oa]|mencionad[oa]|dich[oa]|aquel|es[ea])\s+(?:c[oó]digo|cuerpo\s+(?:legal|normativo)|ordenamiento|ley|norma|texto\s+legal|r[ée]gimen|estatuto)|(?:c[oó]digo|ley|norma|cuerpo\s+legal)\s+(?:citad[oa]|referid[oa]|mencionad[oa]|precitad[oa]|aludid[oa]))|^[\s,(]*(?:[íi]d\.|[íi]dem|ib[íi]d\.?)/i;
  /* El nombre de norma que empieza más cerca, siempre que antes de él haya
     sólo palabras de enlace. */
  function normaAdelante(v){
    var mejor=null;
    var m=v.match(reLeyEn);
    if(m&&soloConectores(v.slice(0,m.index))) mejor={i:m.index,f:etiquetaDeLey(m[2]),prov:!!(m[1]&&/provincial/i.test(m[1])),n:m[2]};
    m=v.match(reDecEn);
    if(m&&(!mejor||m.index<mejor.i)&&soloConectores(v.slice(0,m.index))) mejor={i:m.index,f:capitalizar(m[1])+" "+m[2],prov:false};
    for(var i=0;i<CODIGOS.length;i++){
      var re=CODIGOS[i][2]; re.lastIndex=0;
      var mm=re.exec(v);
      if(mm&&CODIGOS[i][1]==="Código Civil (derogado)"&&/^c\.\s*c\.?$/i.test(mm[0].trim())&&/(?:^|[\s,])y\s*$/.test(v.slice(0,mm.index))) continue;
      if(mm&&(!mejor||mm.index<mejor.i)&&soloConectores(v.slice(0,mm.index))) mejor={i:mm.index,f:CODIGOS[i][1],prov:false};
    }
    return mejor;
  }
  /* El nombre de norma que termina justo antes del artículo («la Ley
     24.240, en su art. 40», «CCyC: art. 1741»). */
  function normaAtras(v){
    var mejor=null,dist,m,re;
    re=new RegExp(reLeyEn.source,"gi");
    while((m=re.exec(v))){
      dist=v.slice(m.index+m[0].length);
      if(dist.length<=30&&soloConectores(dist)&&(!mejor||dist.length<mejor.d)) mejor={d:dist.length,f:etiquetaDeLey(m[2]),prov:!!(m[1]&&/provincial/i.test(m[1])),n:m[2]};
    }
    for(var i=0;i<CODIGOS.length;i++){
      re=CODIGOS[i][2]; re.lastIndex=0; var ult=null;
      while((m=re.exec(v))){ ult=m; if(m[0]==="") re.lastIndex++; }
      if(ult){
        dist=v.slice(ult.index+ult[0].length);
        if(dist.length<=30&&soloConectores(dist)&&(!mejor||dist.length<mejor.d)) mejor={d:dist.length,f:CODIGOS[i][1],prov:false};
      }
    }
    return mejor;
  }
  /* Todas las veces que el fallo nombra una norma, con o sin artículo: sirven
     para saber de qué venía hablando cuando un artículo aparece solo
     («...la Ley de Defensa del Consumidor. (...) Por eso, el art. 40...»). */
  var menciones=[];
  (function(){
    var m,re=new RegExp(reLeyEn.source,"gi");
    while((m=re.exec(texto))) menciones.push({i:m.index,fin:m.index+m[0].length,f:etiquetaDeLey(m[2]),prov:!!(m[1]&&/provincial/i.test(m[1])),n:m[2]});
    CODIGOS.forEach(function(c){
      var r=c[2]; r.lastIndex=0;
      while((m=r.exec(texto))){ menciones.push({i:m.index,fin:m.index+m[0].length,f:c[1],prov:false}); if(m[0]==="") r.lastIndex++; }
    });
    menciones.sort(function(a,b){ return a.i-b.i; });
  })();
  function mencionAntes(pos){
    var u=null;
    for(var i=0;i<menciones.length&&menciones[i].fin<=pos;i++) u=menciones[i];
    return u;
  }
  function plausible(f,base){
    var max=MAX_ART[f],n=parseInt(base,10);
    return !max||(n>=1&&n<=max);
  }

  var NUM_ART="\\d{1,4}(?:\\.\\d{3})?";
  // El inciso o apartado puede ser un número, una letra o un romano («art. 36
  // inc. I del CPCCyT», «art. 88 ap. III»).
  var INC="(?:\\s*,?\\s*(inc(?:iso)?s?\\.?|ap(?:artado)?\\.?)\\s*(\\d{1,3}|[IVXL]{1,5}\\b|[a-zñ](?![a-zñ]))\\s*\\)?(?:\\s*[°º])?)?";
  var ITEM=NUM_ART+"(?:\\s*[°º])?(?:\\s*(?:bis|ter|qu[áa]ter)\\b)?"+INC.replace("(inc(?:iso)?s?\\.?|ap(?:artado)?\\.?)","(?:inc(?:iso)?s?\\.?|ap(?:artado)?\\.?)").replace("(\\d{1,3}|[IVXL]{1,5}\\b|[a-zñ](?![a-zñ]))","(?:\\d{1,3}|[IVXL]{1,5}\\b|[a-zñ](?![a-zñ]))");
  var reArt=new RegExp("\\bart(?:[íi]culos?|s?\\.?)\\s*(?:n[°ºo]\\.?\\s*|nro\\.?\\s*)?("+ITEM+"(?:\\s*(?:,|;|y|e|a)(?:\\s+(?:el|los|del|art(?:[íi]culo|s?\\.)))?\\s*"+ITEM+")*)","gi"),
    reItem=new RegExp("("+NUM_ART+")(?:\\s*[°º])?(?:\\s*(bis|ter|qu[áa]ter)\\b)?"+INC,"gi"),mArt;
  var citas=[],pendientes=[],ultima=null;
  function asignar(c,f,prov,porContexto){
    c.f=f; c.prov=prov; c.ctx=!!porContexto;
    if(!porContexto) ultima={f:f,prov:prov,fin:c.fin};
  }
  while((mArt=reArt.exec(texto))){
    var ini=mArt.index,fin=ini+mArt[0].length,mi,items=[];
    reItem.lastIndex=0;
    while((mi=reItem.exec(mArt[1]))){
      var base=mi[1].replace(/\.(\d{3})/,"$1")+(mi[2]?" "+mi[2].toLowerCase().replace("á","a"):"");
      var palInc=mi[3]&&/^ap/i.test(mi[3])?" ap. ":" inc. ",valInc=mi[4];
      items.push({base:base,l:"art. "+base+(valInc?palInc+(/^[ivxl]+$/i.test(valInc)&&valInc.length>1||/^[IVXL]$/.test(valInc)?valInc.toUpperCase():valInc.toLowerCase()):""),pos:ini,fin:fin});
    }
    if(!items.length) continue;
    // Lo que sigue al artículo, hasta el próximo «art.» o el fin de la oración.
    var ad=texto.slice(fin,fin+110),corte=ad.search(/\b[Aa][Rr][Tt](?:[íiÍI][Cc][Uu][Ll][Oo]|[Ss]?\.)|\.\s+[A-ZÁÉÍÓÚÑ¿(]/);
    if(corte>=0) ad=ad.slice(0,corte+1);
    var at=texto.slice(Math.max(0,ini-90),ini);
    var hallada=normaAdelante(ad);
    if(!hallada&&ultima&&reMismo.test(texto.slice(fin,fin+60)))hallada={f:ultima.f,prov:ultima.prov};
    if(!hallada) hallada=normaAtras(at);
    if(hallada){
      // Los artículos sueltos que venían justo antes («arts. 1716 y el 1741
      // del CCyC») son de la misma norma.
      pendientes=pendientes.filter(function(p){
        if(ini-p.fin<=30&&!/\.\s/.test(texto.slice(p.fin,ini))&&soloConectores(texto.slice(p.fin,ini))){ asignar(p,hallada.f,hallada.prov,false); return false; }
        return true;
      });
      items.forEach(function(c){ citas.push(c); asignar(c,hallada.f,hallada.prov,false); });
    }else{
      items.forEach(function(c){
        c.antes=ultima&&{f:ultima.f,prov:ultima.prov,fin:ultima.fin};
        c.mencion=mencionAntes(ini);
        citas.push(c); pendientes.push(c);
      });
    }
  }
  /* Los que quedaron sin norma al lado: la de la que el fallo venía hablando
     (el último artículo atribuido o la última norma nombrada, la más
     cercana), si está a pocas líneas y el número existe en esa norma. */
  var porNorma={};
  citas.forEach(function(c){ if(c.f) porNorma[c.f]=(porNorma[c.f]||0)+1; });
  var dominante=null,totalAtrib=0;
  Object.keys(porNorma).forEach(function(k){ totalAtrib+=porNorma[k]; if(!dominante||porNorma[k]>porNorma[dominante]) dominante=k; });
  if(dominante&&!(porNorma[dominante]>=3&&porNorma[dominante]>=totalAtrib*0.6)) dominante=null;
  pendientes.forEach(function(c){
    if(/^14 bis$/.test(c.base)||/^75 inc\. 22$/.test(c.l.slice(5))){ asignar(c,"Constitución Nacional",false,true); return; }
    var cand=[c.antes,c.mencion].filter(function(x){ return x&&c.pos-x.fin<=450&&plausible(x.f,c.base); })
      .sort(function(a,b){ return b.fin-a.fin; })[0];
    if(cand){ asignar(c,cand.f,cand.prov,true); return; }
    if(dominante&&plausible(dominante,c.base)){ asignar(c,dominante,false,true); return; }
    c.f="Sin ley identificada"; c.prov=false; c.ctx=false;
  });

  var grupos={},ordenGrupos=[],catDeGrupo={};
  citas.forEach(function(c){
    if(!grupos[c.f]){
      grupos[c.f]=[]; ordenGrupos.push(c.f);
      catDeGrupo[c.f]=CATEGORIA_FUENTE.hasOwnProperty(c.f)?CATEGORIA_FUENTE[c.f]:
        (/^Ley\s/.test(c.f)?categoriaDeLey(c.f,(c.f.match(/[\d.]+/)||[""])[0],c.prov):categoriaDeFuente(c.f,c.prov));
    }
    if(grupos[c.f].indexOf(c.l)===-1) grupos[c.f].push(c.l);
  });
  if(grupos["Sin ley identificada"]){
    grupos["Sin ley identificada"]=grupos["Sin ley identificada"].filter(function(a){
      for(var k in grupos){ if(k!=="Sin ley identificada"&&grupos[k].indexOf(a)!==-1) return false; }
      return true;
    });
    if(!grupos["Sin ley identificada"].length){
      ordenGrupos=ordenGrupos.filter(function(k){ return k!=="Sin ley identificada"; });
      delete grupos["Sin ley identificada"];
    }
  }
  /* Qué artículos se dedujeron por el contexto y no por tener la norma al
     lado: se marcan distinto, para que nadie tome una deducción por cita. */
  var deducidos={};
  citas.forEach(function(c){ var k=c.f+"|"+c.l; if(c.ctx){ if(!(k in deducidos)) deducidos[k]=true; } else deducidos[k]=false; });
  d.deducidos={};
  Object.keys(deducidos).forEach(function(k){ if(deducidos[k]) d.deducidos[k]=true; });
  d.citas=citas.map(function(c){ return {f:c.f,l:c.l,base:c.base,pos:c.pos,fin:c.fin,ctx:c.ctx}; });
  /* Segunda pasada: toda ley nombrada en el texto, tenga o no un artículo
     puntual cerca (esta regex no exige "art." al lado, solo "ley N"). Antes
     las que no tenían artículo se listaban aparte, como una etiqueta suelta
     al mismo nivel visual que un número de artículo — confuso, porque una
     ley entera y un artículo puntual no son lo mismo. Ahora entran al mismo
     agrupador que las demás: siempre título de ley + sus artículos (aunque
     la lista de artículos quede vacía), nunca una etiqueta sin más. */
  var leyes={},reLey=/\bley(?:es)?\s*(?:provincial(?:es)?\s+|nacional(?:es)?\s+|federal(?:es)?\s+)?(?:n[°ºo.]?\s*)?((?:\d[\d\.]{2,7}(?:\s*(?:,|y|e)\s*(?:n[°ºo.]?\s*)?)?)+)/gi,mLey;
  while((mLey=reLey.exec(texto))){
    var esProv=/provincial/i.test(mLey[0]);
    var numsLey=mLey[1].match(/\d[\d\.]{2,7}/g)||[];
    numsLey.forEach(function(n){
      var etiqueta=etiquetaDeLey(n);
      if(!leyes.hasOwnProperty(etiqueta)) leyes[etiqueta]=categoriaDeLey(etiqueta,n,esProv);
    });
  }
  Object.keys(leyes).forEach(function(k){
    if(grupos[k]) return; // ya tiene su propio grupo con artículos detectados
    grupos[k]=[]; ordenGrupos.push(k); catDeGrupo[k]=leyes[k];
  });
  d.artsPorFuente=ordenGrupos.map(function(k){ return [k,grupos[k],catDeGrupo[k]]; });
  d.arts=[].concat.apply([],ordenGrupos.map(function(k){ return grupos[k]; }));
  var cit={},cs2=texto.match(/Fallos:?\s*\d{2,3}\s*:\s*\d{1,4}/gi)||[];
  cs2.forEach(function(a){ cit[a.replace(/\s+/g," ")]=1; });
  d.citados=Object.keys(cit);
  return d;
}

/* ============================================================
   Análisis estructurado del fallo — reglas deterministas, sin IA.
   ============================================================
   Separa lo que el fallo DICE (extracción) de lo que se concluye por reglas
   (clasificación). Cada dato guarda:
     evidencia: el fragmento literal del que salió (texto, ini, fin)
     regla:     qué regla lo produjo (para depurar por qué se clasificó así)
     certeza:   "confirmado" (la fórmula del fallo lo dice), "probable"
                (contexto fuerte, sin fórmula) o "no_confirmado".
   Cuando no hay evidencia suficiente el dato queda como desconocido: nada
   se completa para llenar la pantalla.

   Las posiciones (ini/fin) son sobre el texto recibido, el mismo que usa
   detectar(), así las normas y las secciones se pueden cruzar. */
var IVSAnalisis=(function(){
  "use strict";
  var MAY="A-ZÁÉÍÓÚÑÜ",MIN="a-záéíóúñü";
  var TOKEN="(?:["+MAY+"]["+MIN+"]+(?:-["+MAY+"]["+MIN+"]+)?|["+MAY+"]{2,}(?:-["+MAY+"]{2,})?|(?:["+MAY+"]\\.){1,3})";
  var PART="(?:de|del|de\\s+la|de\\s+los|De|DE|DEL|De\\s+la|DE\\s+LA)";
  var reNombre=new RegExp(TOKEN+"(?:\\s+(?:"+PART+"\\s+)?"+TOKEN+"){0,5}","y");
  /* Palabras que cortan un nombre: lo que viene después ya no es el nombre
     («NORMA LLATSER DIJO», «JULIO RAMON GOMEZ Ministro»). */
  var CORTE={dijo:1,dijeron:1,adhiere:1,adhieren:1,adhiero:1,voto:1,vota:1,en:1,por:1,ministro:1,ministra:1,
    ministros:1,juez:1,jueza:1,presidente:1,presidenta:1,vicepresidente:1,vicepresidenta:1,vocal:1,conjuez:1,sobre:1,
    cuestion:1,a:1,al:1,el:1,la:1,los:1,las:1,que:1,con:1,segun:1,conforme:1,mat:1,notifiquese:1,constancia:1,
    sentencia:1,resuelve:1,asi:1,se:1,su:1,sus:1,senor:1,senora:1,doctor:1,doctora:1,don:1,dona:1,secretario:1,
    secretaria:1,fiscal:1,procurador:1,mendoza:1,considerando:1,considerandos:1,vistos:1,visto:1,resulta:1,fundamentos:1,autos:1,notifiquese:1,y:1,e:1,o:1,i:1,ii:1,iii:1,iv:1,v:1,vi:1,ley:1,art:1,arts:1};
  function plano(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); }
  function limpio(s){ return String(s||"").replace(/[\s ]+/g," ").trim(); }
  function tieneTilde(s){ return /[áéíóúñü]/i.test(s); }
  function evid(texto,ini,fin,antes,despues){
    var a=Math.max(0,ini-(antes==null?80:antes)),b=Math.min(texto.length,fin+(despues==null?80:despues));
    // no cortar palabras a la mitad
    while(a>0&&/\S/.test(texto.charAt(a-1))&&ini-a<antes+30) a--;
    while(b<texto.length&&/\S/.test(texto.charAt(b))&&b-fin<despues+30) b++;
    return {texto:(a>0?"… ":"")+limpio(texto.slice(a,b))+(b<texto.length?" …":""),ini:ini,fin:fin};
  }
  /* El tramo de la oración que contiene pos (hasta «. » + mayúscula, «; » o
     el arranque de un punto numerado). */
  /* Un punto después de «Dr», «Sr», «art», «mat», «fs» o una inicial no
     termina la oración: «Se presenta el Sr. Iván Esteban Campos e interpone
     demanda…» es una sola. */
  var ABREV={dr:1,dra:1,dres:1,dras:1,sr:1,sra:1,sres:1,sras:1,srta:1,lic:1,ing:1,art:1,arts:1,inc:1,incs:1,ap:1,
    mat:1,fs:1,n:1,nro:1,nº:1,excma:1,excmo:1,expte:1,cfr:1,conf:1,cit:1,cod:1,cód:1,ley:1,dec:1,res:1,cap:1,pag:1,
    pág:1,p:1,pp:1,vol:1,ed:1,sa:1,srl:1,ltda:1,coop:1,cia:1,prov:1,dpto:1,av:1,ib:1,id:1,op:1,etc:1,ss:1,ccyc:1,
    cccn:1,cpccyt:1,cn:1,lct:1,ls:1,la:1,ll:1,ed:1,fallos:1,j:1,inc:1,us:1,tr:1,vs:1,v:1};
  function esCorte(texto,i){
    // i: posición del signo de puntuación
    var c=texto.charAt(i);
    if(c===";"||c===":") return true;
    var antes=texto.slice(Math.max(0,i-12),i),w=(/([A-Za-zÁÉÍÓÚáéíóúÑñº]+)$/.exec(antes)||[])[1];
    if(!w) return true;
    if(w.length===1) return false;            // inicial: «José V. Valerio»
    return !ABREV[plano(w)];
  }
  function oracion(texto,pos,conPuntoYComa){
    var re=conPuntoYComa===false?/[.]["”’»)]*\s+["“‘«(]*(?=[A-ZÁÉÍÓÚÑ0-9¿])|\n\s*\n/g:/[.;:]["”’»)]*\s+["“‘«(]*(?=[A-ZÁÉÍÓÚÑ0-9¿])|\n\s*\n/g,m,ini=0,fin=texto.length;
    var desde=Math.max(0,pos-900),tramo=texto.slice(desde,pos);
    while((m=re.exec(tramo))) if(m[0].charAt(0)==="\n"||esCorte(texto,desde+m.index)) ini=desde+m.index+m[0].length;
    re=conPuntoYComa===false?/[.]["”’»)]*\s+["“‘«(]*(?=[A-ZÁÉÍÓÚÑ0-9¿])|\n\s*\n/g:/[.;]["”’»)]*\s+["“‘«(]*(?=[A-ZÁÉÍÓÚÑ0-9¿])|\n\s*\n/g;
    var resto=texto.slice(pos,pos+1200);
    fin=Math.min(texto.length,pos+1200);
    while((m=re.exec(resto))) if(m[0].charAt(0)==="\n"||esCorte(texto,pos+m.index)){ fin=pos+m.index+1; break; }
    return {ini:ini,fin:fin,texto:texto.slice(ini,fin)};
  }
  /* Desde dónde rige la última «regulación de honorarios» antes de pos, si
     sigue vigente (no la cortó el fin de una oración ni otro punto de la
     resolutiva). Los profesionales de una regulación van separados por «;». */
  function regulacionVigente(texto,pos){
    var desde=Math.max(0,pos-1400),tramo=texto.slice(desde,pos),re=/regul\w*\s+(?:los\s+)?honorarios/gi,m,ult=-1;
    while((m=re.exec(tramo))) ult=m.index;
    if(ult<0) return -1;
    var entre=texto.slice(desde+ult,pos),rc=/[.]["”’»)]*\s+["“‘«(]*(?=[A-ZÁÉÍÓÚÑ0-9¿])/g,mc;
    while((mc=rc.exec(entre))) if(esCorte(texto,desde+ult+mc.index)) return -1;
    return desde+ult;
  }

  /* ---------- nombres ---------- */
  function nombreEn(texto,pos){
    reNombre.lastIndex=pos;
    var m=reNombre.exec(texto);
    if(!m) return null;
    var crudo=m[0],partes=crudo.split(/\s+/),buenas=[],largo=0,i;
    for(i=0;i<partes.length;i++){
      var w=plano(partes[i]).replace(/\.$/,"");
      var inicial=/^[A-ZÁÉÍÓÚÑÜ]\.$/.test(partes[i])||/^([A-ZÁÉÍÓÚÑÜ]\.){2,}$/.test(partes[i]);
      if(!inicial&&CORTE[w]&&!(buenas.length&&/^(de|del|la|los)$/.test(w)&&i<partes.length-1)) break;
      buenas.push(partes[i]);
    }
    while(buenas.length&&/^(de|del|la|los|y)$/i.test(buenas[buenas.length-1])) buenas.pop();
    if(!buenas.length) return null;
    // al menos una palabra de dos letras o más que no sea inicial
    if(!buenas.some(function(w){ return /^[A-ZÁÉÍÓÚÑÜ][A-Za-záéíóúñüÁÉÍÓÚÑÜ\-]{1,}$/.test(w); })) return null;
    var nom=buenas.join(" ");
    // la posición final real, sobre el texto
    var j=0,k=0;
    for(i=0;i<buenas.length;i++){ k=crudo.indexOf(buenas[i],j); j=k+buenas[i].length; }
    return {nombre:limpio(nom),ini:pos,fin:pos+j};
  }
  /* «Dres. MARIO DANIEL ADARO y JOSÉ V. VALERIO», «Víctor H. MARCEROU,
     Osvaldo MARCEROU, y Tatiana ZAREV». */
  function listaDeNombres(texto,pos){
    var out=[],n=nombreEn(texto,pos);
    while(n&&out.length<8){
      out.push(n);
      var sig=/^\s*(?:,\s*y\s+|,\s*e\s+|\s+y\s+|\s+e\s+|,\s*)(?:(?:el|la)\s+)?(?:(?:Dr|Dra|DR|DRA)\.?\s+)?/.exec(texto.slice(n.fin,n.fin+20));
      if(!sig) break;
      var otro=nombreEn(texto,n.fin+sig[0].length);
      if(!otro) break;
      n=otro;
    }
    return out;
  }
  function tokensNombre(n){
    return limpio(n).split(" ").map(function(w){ return plano(w).replace(/\./g,""); })
      .filter(function(w){ return w&&!/^(de|del|la|los)$/.test(w); });
  }
  /* ¿Son la misma persona? Mismo apellido (última palabra) y nombres
     compatibles: iguales, o uno es la inicial del otro, o uno no trae nombre. */
  function mismaPersona(a,b){
    var ta=tokensNombre(a),tb=tokensNombre(b);
    if(!ta.length||!tb.length) return false;
    if(ta[ta.length-1]!==tb[tb.length-1]) return false;
    var na=ta.slice(0,-1),nb=tb.slice(0,-1);
    if(!na.length||!nb.length) return true;
    var n=Math.min(na.length,nb.length);
    for(var i=0;i<n;i++){
      var x=na[i],y=nb[i];
      if(x===y) continue;
      if((x.length===1&&y.charAt(0)===x)||(y.length===1&&x.charAt(0)===y)) continue;
      // «José V. Valerio» y «José Virgilio Valerio»: alcanza con el primero igual
      if(i>0&&x.charAt(0)===y.charAt(0)) continue;
      return false;
    }
    return true;
  }
  function capitalizar(w){
    if(/^(de|del|la|los|y)$/i.test(w)) return w.toLowerCase();
    if(/^([A-ZÁÉÍÓÚÑÜ]\.)+$/.test(w)) return w;
    return w.split("-").map(function(p){ return p.charAt(0).toUpperCase()+p.slice(1).toLowerCase(); }).join("-");
  }
  /* El nombre que se muestra: la variante más completa, palabra por palabra
     la que tiene tildes («JULIO RAMON GOMEZ» + «JULIO RAMÓN GÓMEZ» →
     «Julio Ramón Gómez»). Las mayúsculas sostenidas pasan a nombre propio. */
  function nombreVisible(variantes){
    var base=variantes.slice().sort(function(a,b){ return tokensNombre(b).length-tokensNombre(a).length||(tieneTilde(b)?1:0)-(tieneTilde(a)?1:0); })[0];
    var pal=limpio(base).split(" ");
    return pal.map(function(w){
      var pw=plano(w);
      var mejor=w;
      variantes.forEach(function(v){ limpio(v).split(" ").forEach(function(x){ if(plano(x)===pw&&tieneTilde(x)&&!tieneTilde(mejor)) mejor=x; }); });
      return capitalizar(mejor);
    }).join(" ");
  }

  /* ---------- secciones ---------- */
  function secciones(texto){
    var s={},m;
    // la parte resolutiva: la última fórmula en mayúsculas manda
    var reRes=/S\s?E\s?N\s?T\s?E\s?N\s?C\s?I\s?A\s*:|R\s?E\s?S\s?U\s?E\s?L\s?V\s?E\s*:|\bRESUELVE\b|\bFALLA\s*:|el Tribunal Superior de Justicia\s+resuelve\s*:|(?:la Corte|el Tribunal)[^.]{0,80}?\bresuelve\s*:|\bSe resuelve\s*:|\bRESUELVO\b/g,ult=-1;
    var desde=Math.floor(texto.length*.35);
    reRes.lastIndex=desde;
    while((m=reRes.exec(texto))) if(ult<0||m[0]===m[0].toUpperCase()||ult<m.index-6000) ult=m.index;
    s.resolutiva=ult>=0?{ini:ult,fin:texto.length}:null;
    // firmas: lo que sigue al último «Notifíquese/Regístrese» del final
    var reNot=/NOTIF[IÍ]QUESE|Notif[ií]quese|REG[IÍ]STRESE|Reg[ií]strese|C[OÓ]PIESE|Mandar que se registre/g,un=-1;
    reNot.lastIndex=Math.floor(texto.length*.6);
    while((m=reNot.exec(texto))) un=m.index+m[0].length;
    s.firmas=un>=0?{ini:un,fin:texto.length}:null;
    // los votos: desde el primer encabezado de voto hasta la resolutiva
    s.votos=[];
    return s;
  }
  function dentro(r,pos){ return !!r&&pos>=r.ini&&pos<r.fin; }

  /* ---------- magistrados y votos ---------- */
  var ORD="primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|s[ée]ptim[oa]";
  var reTitulo=/\b(?:(?:(?:se[ñn]or(?:a|es|as)?)\s+)?(juez|jueza|jueces|juezas|ministr[oa]s?|vocal(?:es)?|conjuez|presidente|presidenta|vicepresidente|vicepresidenta|camarista)\s+(?:(?:doctor(?:a|es|as)?|dr(?:a|es|as)?)\.?\s+)?(?:don\s+|do[ñn]a\s+)?|(doctor(?:a|es|as)?|dr(?:a|es|as)?|lic(?:enciad[oa])?|ing)\.?\s+(?:don\s+|do[ñn]a\s+)?)/gi;

  function analizarPersonas(texto,sec){
    var personas=[],hechos=[];
    function persona(nombre){
      for(var i=0;i<personas.length;i++) if(personas[i].variantes.some(function(v){ return mismaPersona(v,nombre); })){
        if(personas[i].variantes.indexOf(nombre)===-1) personas[i].variantes.push(nombre);
        return personas[i];
      }
      var p={id:"p"+(personas.length+1),variantes:[nombre],hechos:[]};
      personas.push(p); return p;
    }
    function hecho(p,h){ p.hechos.push(h); hechos.push(h); h.persona=p.id; return h; }
    var usados=[]; // tramos ya interpretados por una regla estructural
    function usado(ini,fin){ usados.push([ini,fin]); }
    function yaUsado(pos){ return usados.some(function(u){ return pos>=u[0]&&pos<u[1]; }); }

    // 1. orden de estudio / votación
    var m,re=/orden\s+de\s+(?:estudio|votaci[oó]n)[^:]{0,220}:\s*/gi;
    while((m=re.exec(texto))){
      var ini=m.index+m[0].length,fin=-1,rf=/\.\s+(?=[A-ZÁÉÍÓÚ])|ANTECEDENTES|RESULTA|\n\s*\n/g,mf,zona0=texto.slice(ini,ini+500);
      while((mf=rf.exec(zona0))){ if(mf[0].charAt(0)!=="."||esCorte(texto,ini+mf.index)){ fin=mf.index; break; } }
      var lista=texto.slice(ini,ini+(fin<0?400:fin));
      var reItem=new RegExp("(?:"+ORD+")\\s*:\\s*(?:(?:el|la)\\s+)?(?:(?:Dr|Dra|DR|DRA|Doctor|Doctora)\\.?\\s+)?","gi"),mi,n=0;
      while((mi=reItem.exec(lista))){
        var nn=nombreEn(texto,ini+mi.index+mi[0].length); if(!nn) continue;
        n++;
        var p=persona(nn.nombre);
        hecho(p,{tipo:"orden_de_estudio",orden:n,evidencia:evid(texto,nn.ini,nn.fin,60,20),regla:"orden-de-estudio",certeza:"confirmado"});
        usado(nn.ini,nn.fin);
      }
    }
    // 2. encabezados de voto
    var votos=[];
    function registrarVoto(nn,cuestion,mod,posTit){
      var p=persona(nn.nombre),tipo="voto",reglas="encabezado-de-voto";
      var mp=plano(mod||"");
      if(/disidencia\s+parcial/.test(mp)) tipo="disidencia_parcial";
      else if(/disidencia/.test(mp)) tipo="disidencia";
      else if(/por su voto|segun su voto|voto propio|por sus fundamentos/.test(mp)) tipo="voto_propio";
      else if(/concurr/.test(mp)) tipo="voto_concurrente";
      var v={persona:p.id,cuestion:cuestion,tipo:tipo,ini:posTit,evidencia:evid(texto,posTit,nn.fin+(mod?mod.length:0),10,60),regla:reglas,certeza:"confirmado"};
      votos.push(v);
      hecho(p,{tipo:tipo,cuestion:cuestion,evidencia:v.evidencia,regla:reglas,certeza:"confirmado"});
      usado(nn.ini,nn.fin);
      return v;
    }
    //   SCJM: «A LA PRIMERA CUESTION LA DRA. NORMA LLATSER DIJO:»,
    //         «SOBRE LA PRIMERA CUESTION EL DR. JOSE VALERIO, en disidencia parcial, dijo:»
    re=/\b(?:A|SOBRE)\s+LA\s+([A-ZÁÉÍÓÚa-záéíóú]+)\s+CUESTI[OÓ]N[,:]?\s+(?:(?:EL|LA)\s+)?(?:SE[ÑN]OR(?:A)?\s+)?(?:MINISTR[OA]\s+)?(?:(?:DR|DRA|Dr|Dra|DOCTOR|DOCTORA)\.?\s+)?/g;
    while((m=re.exec(texto))){
      var n2=nombreEn(texto,m.index+m[0].length); if(!n2) continue;
      var tras=/^\s*,?\s*((?:en\s+disidencia(?:\s+(?:parcial|total))?|por\s+su\s+voto|seg[uú]n\s+su\s+voto)\s*,?)?\s*(?:dijo|DIJO|expres[oó]|manifest[oó])/i.exec(texto.slice(n2.fin,n2.fin+80));
      if(!tras) continue;
      registrarVoto(n2,plano(m[1]),tras[1]||"",m.index);
    }
    //   TSJ / cámaras: «La jueza Alicia E. C. Ruiz, en disidencia, dijo:»
    re=/(?:^|[.:;]\s+|\n\s*|Fundamentos:\s*)(?:El|La)\s+(?:juez|jueza|vocal|ministr[oa]|camarista|doctor|doctora|Dr\.|Dra\.)\s+(?:doctor(?:a)?\s+|Dr\.\s+|Dra\.\s+)?/g;
    while((m=re.exec(texto))){
      var st=m.index+m[0].length,n3=nombreEn(texto,st); if(!n3) continue;
      var tr3=/^\s*,?\s*((?:en\s+disidencia(?:\s+(?:parcial|total))?|por\s+su\s+voto|seg[uú]n\s+su\s+voto)\s*,?)?\s*dijo\s*:/i.exec(texto.slice(n3.fin,n3.fin+80));
      if(!tr3) continue;
      registrarVoto(n3,"unica",tr3[1]||"",m.index+m[0].search(/\S/));
    }
    //   CSJN: «VOTO DEL SEÑOR MINISTRO DOCTOR DON HORACIO ROSATTI», «DISIDENCIA PARCIAL DE LA SEÑORA VICEPRESIDENTA…»
    re=/\b(VOTO|DISIDENCIA(?:\s+PARCIAL)?)\s+DE(?:L|\s+LA|\s+LOS)\s+(?:SE[ÑN]OR(?:A|ES)?\s+)?(?:VICE)?(?:PRESIDENT[EA]|MINISTR[OA]S?|JUEZ|JUEZA|CONJUEZ)\s+(?:DOCTOR(?:A|ES)?\s+)?(?:DON\s+|DOÑA\s+)?/g;
    while((m=re.exec(texto))){
      var n4=nombreEn(texto,m.index+m[0].length); if(!n4) continue;
      registrarVoto(n4,"unica",/DISIDENCIA\s+PARCIAL/.test(m[1])?"en disidencia parcial":/DISIDENCIA/.test(m[1])?"en disidencia":"por su voto",m.index);
    }
    votos.sort(function(a,b){ return a.ini-b.ini; });
    // el primer voto de cada cuestión es el del preopinante (voto principal)
    var vistasCuestion={};
    votos.forEach(function(v){
      if(vistasCuestion[v.cuestion]) return;
      vistasCuestion[v.cuestion]=v;
      if(v.tipo==="voto"&&v.cuestion!=="unica"){ v.tipo="voto_principal"; v.regla="preopinante-de-la-cuestion"; }
    });
    votos.forEach(function(v){
      personas.forEach(function(p){ p.hechos.forEach(function(h){ if(h.evidencia===v.evidencia) h.tipo=v.tipo; }); });
    });
    function votoVigenteEn(pos){
      var u=null; votos.forEach(function(v){ if(v.ini<=pos) u=v; }); return u;
    }
    function principalDe(cuestion,pos){
      var u=null; votos.forEach(function(v){ if(v.cuestion===cuestion&&v.ini<=pos&&/^(voto_principal|voto)$/.test(v.tipo)&&!u) u=v; }); return u;
    }

    // 3. adhesiones en tercera persona: «el Dr. JULIO RAMÓN GÓMEZ, adhiere al voto que antecede»
    var adhesiones=[];
    re=/\b(?:el|la|los|las)\s+(?:(?:Dr|Dra|Dres|Dras|DR|DRA|DRES)\.?|doctor(?:a|es|as)?|juez|jueza|jueces|ministr[oa]s?)\s+/gi;
    while((m=re.exec(texto))){
      var ns=listaDeNombres(texto,m.index+m[0].length); if(!ns.length) continue;
      var finN=ns[ns.length-1].fin,ad=/^\s*,?\s*(?:tambi[eé]n\s+)?(adhier[ea]n?|adhiri[oó]|adhirieron)\b([^.]{0,140})/i.exec(texto.slice(finN,finN+180));
      if(!ad) continue;
      var vv=votoVigenteEn(m.index),cu=vv?vv.cuestion:"unica";
      var obj=ad[2]||"",parcial=/\b(?:apartados?|puntos?|en lo restante|en cuanto|parcialmente|considerandos?\s+\d)/i.test(obj);
      var a=principalDe(cu,m.index);
      ns.forEach(function(nn){
        var p=persona(nn.nombre);
        var h={tipo:"adhesion",cuestion:cu,a:a?a.persona:null,alcance:parcial?"parcial":"total",evidencia:evid(texto,m.index,finN+ad[0].length,0,0),regla:"adhesion-tercera-persona",certeza:"confirmado"};
        hecho(p,h); adhesiones.push(h); usado(nn.ini,nn.fin);
      });
    }
    // 4. adhesiones en primera persona dentro de un voto: «adhiero al voto de la jueza Inés M. Weinberg»
    re=/\badhiero\b([^.]{0,40}?)(?:al\s+voto|a\s+los\s+fundamentos|a\s+la\s+soluci[oó]n|a\s+los\s+(?:apartados|puntos))[^.]{0,200}/gi;
    while((m=re.exec(texto))){
      var vot=votoVigenteEn(m.index); if(!vot) continue;
      var frase=m[0],dest=null;
      var mt=/(?:de\s+(?:la|el|los|mis)\s+)?(?:colegas?\s+)?(?:jueza|juez|Dra\.|Dr\.|Dres\.|doctora|doctor|ministr[oa])\s+/i.exec(frase);
      if(mt){ var nd=nombreEn(texto,m.index+mt.index+mt[0].length); if(nd){ dest=persona(nd.nombre); usado(nd.ini,nd.fin); } }
      var antes=texto.slice(Math.max(vot.ini,m.index-160),m.index);
      var parc=/apartados?|puntos?|en lo restante|respecto de|en cuanto|primer p[aá]rrafo/i.test(frase+" "+antes.slice(-80));
      var pv=personas.filter(function(x){ return x.id===vot.persona; })[0];
      var h2={tipo:"adhesion",cuestion:vot.cuestion,a:dest?dest.id:null,alcance:parc?"parcial":"total",evidencia:evid(texto,m.index,m.index+frase.length,40,0),regla:"adhesion-primera-persona",certeza:"confirmado"};
      hecho(pv,h2); adhesiones.push(h2);
    }
    // 5. quienes no suscriben, y por qué
    var noSuscriben=[];
    re=/no\s+(?:es\s+)?(?:suscript[ao]|suscribe[n]?|firma[n]?|lo\s+suscribe)\b/gi;
    while((m=re.exec(texto))){
      var or=oracion(texto,m.index),seg=or.texto,mt2,reT=new RegExp(reTitulo.source,"gi"),motivo=null;
      var pm=plano(seg);
      if(/licencia/.test(pm)) motivo="licencia"; else if(/vacan/.test(pm)) motivo="vacancia";
      else if(/excus/.test(pm)) motivo="excusacion"; else if(/recus/.test(pm)) motivo="recusacion";
      else if(/ausen/.test(pm)) motivo="ausencia"; else if(/comision/.test(pm)) motivo="comision";
      // el motivo tal como lo dice el fallo («en los términos de la acordada n° 40/14»)
      var mt3=/(?:por\s+(?:encontrarse|hallarse|estar)\s+|en\s+los\s+t[eé]rminos\s+del?\s+|conforme\s+(?:a\s+)?(?:lo\s+dispuesto\s+en\s+)?)([^.;]{3,120})/i.exec(seg),motivoTexto=mt3?limpio(mt3[0]):null;
      while((mt2=reT.exec(seg))){
        var nm=nombreEn(texto,or.ini+mt2.index+mt2[0].length); if(!nm) continue;
        var pn=persona(nm.nombre);
        var h3={tipo:"no_suscribe",motivo:motivo||(motivoTexto?"otro":"no_indicado"),motivoTexto:motivoTexto,evidencia:evid(texto,or.ini,or.fin,0,0),regla:"constancia-de-no-suscripcion",certeza:motivo?"confirmado":"probable"};
        hecho(pn,h3); noSuscriben.push(h3); usado(nm.ini,nm.fin);
      }
      usado(or.ini,or.fin);
    }
    // 6. firmas: después del «Notifíquese» final, nombre + cargo
    var firmas=[];
    // firma digital: «LOZANO, LUIS\nFRANCISCO\nJUEZ/A»
    (function(){
      var desde=Math.max(0,texto.length-4000),zona=texto.slice(desde),mf,reFD=/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ'’ ]{1,40}),\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ.\s]{0,60}?)\s+(JUEZ\/A|JUEZA|JUEZ|MINISTR[OA](?:\/A)?|VOCAL|PRESIDENT[EA](?:\/A)?|CONJUEZ(?:\/A)?|SECRETARI[OA](?:\/A)?)\b/g;
      while((mf=reFD.exec(zona))){
        var nom=limpio(mf[2])+" "+limpio(mf[1]),ini2=desde+mf.index;
        var pf=persona(nom.split(" ").map(capitalizar).join(" ")),esSec=/SECRETARI/.test(mf[3]);
        var h5={tipo:esSec?"firma_secretario":"firma",cargo:capitalizar(mf[3].replace(/\/A$/,"")),evidencia:evid(texto,ini2,ini2+mf[0].length,0,0),regla:"firma-digital",certeza:"confirmado"};
        hecho(pf,h5); if(!esSec) firmas.push(h5); usado(ini2,ini2+mf[0].length);
      }
    })();
    if(sec.firmas){
      var zona=texto.slice(sec.firmas.ini,sec.firmas.fin),reF=/(?:(?:DR|DRA|Dr|Dra|DOCTOR|DOCTORA)\.?\s+)?/g;
      var reCargo=/^\s*,?\s*(Ministr[oa]|MINISTR[OA]|Juez|Jueza|JUEZ\/A|JUEZ|JUEZA|Presidente|Presidenta|PRESIDENTE|PRESIDENTA|Vicepresidente|Vicepresidenta|Vocal|VOCAL|Conjuez|CONJUEZ|Secretari[oa]|SECRETARI[OA]|Camarista)\b/;
      var i2=0;
      while(i2<zona.length){
        var pos=sec.firmas.ini+i2;
        if(yaUsado(pos)){ i2++; continue; }
        var pre=/^(?:DR|DRA|Dr|Dra|DOCTOR|DOCTORA)\.?\s+/.exec(zona.slice(i2,i2+10));
        var nf=nombreEn(texto,pos+(pre?pre[0].length:0));
        if(nf){
          var cg=reCargo.exec(texto.slice(nf.fin,nf.fin+20));
          if(cg){
            var pf=persona(nf.nombre),esSec=/secretari/i.test(cg[1]);
            var h4={tipo:esSec?"firma_secretario":"firma",cargo:capitalizar(cg[1]),evidencia:evid(texto,pos,nf.fin+cg[0].length,0,0),regla:"firma-con-cargo",certeza:"confirmado"};
            hecho(pf,h4); if(!esSec) firmas.push(h4); usado(nf.ini,nf.fin);
            i2=nf.fin+cg[0].length-sec.firmas.ini; continue;
          }
          i2=nf.fin-sec.firmas.ini+1; continue;
        }
        i2++;
      }
    }

    // 7. el resto de las personas con título: rol por el contexto
    var reT2=new RegExp(reTitulo.source,"gi");
    while((m=reT2.exec(texto))){
      var plural=/(?:es|as|res|ras)\.?\s*$/i.test(m[0].replace(/\s+(?:don|doña)\s+$/i,"").trim().split(/\s+/).pop()||"");
      var nms=plural?listaDeNombres(texto,m.index+m[0].length):[nombreEn(texto,m.index+m[0].length)].filter(Boolean);
      nms.forEach(function(nn){
        if(yaUsado(nn.ini)) return;
        var or2=oracion(texto,m.index),antes2=texto.slice(or2.ini,m.index),cerca=antes2.slice(-70),pa=plano(antes2),pc=plano(cerca);
        var rol="persona_mencionada",regla="sin-contexto",certeza="no_confirmado",extra={};
        var iReg=regulacionVigente(texto,m.index);
        if(iReg>=0||/honorarios\s+(?:profesionales\s+)?(?:de|del|a)\s+(?:los|las|la|el)?\s*$/.test(pc)){
          var desdeReg=iReg>=0?plano(texto.slice(iReg,m.index)):pc;
          if(/perit/.test(desdeReg)){ rol="perito"; regla="regulacion-de-honorarios-de-peritos"; certeza="confirmado"; }
          else { rol="profesional_con_honorarios"; regla="regulacion-de-honorarios"; certeza="probable"; }
          var et=plano(iReg>=0?texto.slice(iReg,Math.min(texto.length,m.index+400)):or2.texto);
          extra.etapa=/tramite de apelacion|alzada/.test(et)?"alzada":/recurso extraordinario|esta instancia|instancia extraordinaria/.test(et)?"instancia_extraordinaria":/prospera la demanda|primera instancia/.test(et)?"primera_instancia":null;
        }
        else if(/perit[oa]s?(?:\s+[a-z]+){0,3}\s*$/.test(pc)){ rol="perito"; regla="perito-antes-del-nombre"; certeza="confirmado"; }
        else if(/(?:apoderad[oa]|letrad[oa]|patrocinante|patrocinad[oa]\s+por|abogad[oa]|representad[oa]\s+por|representante|mandatari[oa])(?:\s+[a-z]+){0,4}\s*$/.test(pc)){ rol="abogado_o_representante"; regla="cargo-de-representacion"; certeza="confirmado"; }
        else if(/(?:procurador(?:a)?\s+general|fiscal(?:\s+general)?(?:\s+adjunt[oa])?|defensor(?:a)?(?:\s+oficial|\s+general)?|asesor(?:a)?\s+de\s+menores)(?:\s+[a-z]+){0,3}\s*$/.test(pc)){ rol="ministerio_publico"; regla="ministerio-publico"; certeza="confirmado"; }
        else if(/(?:colegas?|preopinante|ministros?\s+del\s+tribunal)(?:\s+[a-z.]+){0,2}\s*$/.test(pc)){ rol="magistrado_mencionado"; regla="colega-de-tribunal"; certeza="probable"; }
        else if(m[1]){ rol="juez_mencionado"; regla="cargo-judicial-mencionado"; certeza="probable"; }
        var p2=persona(nn.nombre);
        hecho(p2,Object.assign({tipo:rol,evidencia:evid(texto,m.index,nn.fin,60,40),regla:regla,certeza:certeza},extra));
      });
    }

    // resumen por persona
    var MAG={orden_de_estudio:1,voto:1,voto_principal:1,voto_propio:1,voto_concurrente:1,disidencia:1,disidencia_parcial:1,adhesion:1,firma:1,no_suscribe:1};
    personas.forEach(function(p){
      p.nombre=nombreVisible(p.variantes);
      p.esMagistrado=p.hechos.some(function(h){ return MAG[h.tipo]; });
      p.participacion=p.hechos.filter(function(h){ return /^(voto|voto_principal|voto_propio|voto_concurrente|disidencia|disidencia_parcial|adhesion)$/.test(h.tipo); })
        .map(function(h){ return h.tipo; }).filter(function(t,i,a){ return a.indexOf(t)===i; });
      p.enOrdenDeEstudio=p.hechos.filter(function(h){ return h.tipo==="orden_de_estudio"; }).map(function(h){ return h.orden; })[0]||null;
      var ns=p.hechos.filter(function(h){ return h.tipo==="no_suscribe"; })[0];
      p.suscripcion=ns?"no_suscribe"+(ns.motivo!=="no_indicado"&&ns.motivo!=="otro"?"_por_"+ns.motivo:""):(p.hechos.some(function(h){ return h.tipo==="firma"; })?"suscribe":"no_determinado");
      p.motivoNoSuscribe=ns?ns.motivoTexto||null:null;
      var roles=p.hechos.map(function(h){ return h.tipo; }).filter(function(t){ return !MAG[t]; });
      p.rol=p.esMagistrado?"magistrado":(roles.indexOf("perito")>=0?"perito":roles.indexOf("abogado_o_representante")>=0?"abogado_o_representante":
        roles.indexOf("ministerio_publico")>=0?"ministerio_publico":roles.indexOf("profesional_con_honorarios")>=0?"profesional_con_honorarios":
        roles.indexOf("magistrado_mencionado")>=0?"magistrado_mencionado":roles.indexOf("juez_mencionado")>=0?"juez_mencionado":
        roles.indexOf("firma_secretario")>=0?"secretario":"persona_mencionada");
    });
    return {personas:personas,votos:votos,adhesiones:adhesiones,noSuscriben:noSuscriben,firmas:firmas};
  }

  /* ---------- votación: el estado de la disidencia ---------- */
  function estadoVotacion(texto,pers,sec){
    var mags=pers.personas.filter(function(p){ return p.esMagistrado; });
    var dis=pers.votos.filter(function(v){ return /disidencia/.test(v.tipo); });
    var conc=pers.votos.filter(function(v){ return v.tipo==="voto_concurrente"; });
    var res=sec.resolutiva?texto.slice(sec.resolutiva.ini,Math.min(texto.length,sec.resolutiva.ini+2500)):"";
    var antesRes=sec.resolutiva?texto.slice(Math.max(0,sec.resolutiva.ini-400),sec.resolutiva.ini):"";
    var mMay=/por\s+mayor[ií]a/i.exec(antesRes+" "+res),mUna=/por\s+unanimidad|un[aá]nimemente/i.exec(texto);
    var out={estado:"informacion_insuficiente",detalle:[],evidencia:[]};
    function nom(id){ var p=pers.personas.filter(function(x){ return x.id===id; })[0]; return p?p.nombre:"(no identificado)"; }
    if(dis.length){
      out.estado="disidencia_identificada";
      dis.forEach(function(v){ out.detalle.push(nom(v.persona)+(v.tipo==="disidencia_parcial"?": disidencia parcial":": disidencia")+(v.cuestion!=="unica"?" ("+v.cuestion+" cuestión)":"")); out.evidencia.push(v.evidencia); });
    }else if(conc.length){
      out.estado="voto_concurrente_identificado";
      conc.forEach(function(v){ out.detalle.push(nom(v.persona)+": voto concurrente"); out.evidencia.push(v.evidencia); });
    }else if(pers.votos.length){
      if(mMay){
        out.estado="informacion_insuficiente";
        out.detalle.push("La resolución se dicta «por mayoría», pero no identifiqué qué voto disiente.");
        out.evidencia.push(evid(texto,(sec.resolutiva?Math.max(0,sec.resolutiva.ini-400):0)+mMay.index,(sec.resolutiva?Math.max(0,sec.resolutiva.ini-400):0)+mMay.index+mMay[0].length,120,80));
      }else{
        out.estado="sin_disidencia_en_estructura";
        out.detalle.push("Revisé los encabezados de voto, las adhesiones y las firmas: no hay votos en disidencia. Esto no garantiza la unanimidad.");
      }
    }else if(mUna){
      out.estado="sin_disidencia_en_estructura";
      out.detalle.push("El texto dice que se resolvió por unanimidad.");
      out.evidencia.push(evid(texto,mUna.index,mUna.index+mUna[0].length,120,80));
    }else{
      out.detalle.push("No encontré la estructura de votación (encabezados de voto, adhesiones o firmas).");
    }
    if(dis.length&&!pers.votos.some(function(v){ return !/disidencia/.test(v.tipo); })){
      // la mayoría sin autor («Fundamentos: …»): la firman los que firman y no disienten
      var disidentes=dis.map(function(v){ return v.persona; });
      var mayoria=mags.filter(function(p){ return p.suscripcion==="suscribe"&&disidentes.indexOf(p.id)<0; });
      if(mayoria.length){
        out.detalle.push("El voto de la mayoría no lleva autor en el texto; lo integran quienes firman la sentencia sin disidencia: "+mayoria.map(function(p){ return p.nombre; }).join(", ")+" (deducido de las firmas).");
        mayoria.forEach(function(p){ p.hechos.push({tipo:"voto_mayoria",evidencia:(p.hechos.filter(function(h){ return h.tipo==="firma"; })[0]||{}).evidencia,regla:"firmantes-sin-disidencia",certeza:"probable"}); if(p.participacion.indexOf("voto_mayoria")<0) p.participacion.push("voto_mayoria"); });
      }
      else out.detalle.push("El voto de la mayoría no lleva el nombre de quienes lo firman en el texto revisado: no pude identificarlos.");
    }
    var propios=pers.votos.filter(function(v){ return v.tipo==="voto_propio"; });
    if(propios.length) out.detalle.push("Votos con fundamentos propios: "+propios.map(function(v){ return nom(v.persona); }).join(", ")+".");
    var grupos={},ordenG=[];
    pers.adhesiones.forEach(function(a){
      var k=a.persona+"|"+(a.a||"")+"|"+a.alcance;
      if(!grupos[k]){ grupos[k]={a:a,c:[]}; ordenG.push(k); }
      if(a.cuestion&&a.cuestion!=="unica") grupos[k].c.push(a.cuestion);
    });
    ordenG.forEach(function(k){
      var a=grupos[k].a,c=grupos[k].c;
      out.detalle.push(nom(a.persona)+" adhiere"+(a.alcance==="parcial"?" parcialmente":"")+(a.a?" al voto de "+nom(a.a):" al voto que antecede")+(c.length?" ("+(c.length>1?c.slice(0,-1).join(", ")+" y "+c[c.length-1]:c[0])+" cuestión)":"")+".");
    });
    pers.noSuscriben.forEach(function(n){
      out.detalle.push(nom(n.persona)+" no suscribe la resolución"+(n.motivo==="otro"?" ("+n.motivoTexto+")":n.motivo!=="no_indicado"?" por "+n.motivo.replace("_"," "):" (el fallo no dice por qué)")+": eso no es una disidencia.");
      out.evidencia.push(n.evidencia);
    });
    out.magistrados=mags.length;
    return out;
  }

  /* ---------- partes por etapa ---------- */
  function mismaEntidad(a,b){
    var ta=tokensNombre(a).filter(function(w){ return w.length>2&&!/^(sa|srl|ltda|limitada|coop|cooperativa|seguros|cia|compania|sociedad|anonima)$/.test(w); });
    var tb=tokensNombre(b).filter(function(w){ return w.length>2; });
    if(ta.length<1) return false;
    return ta.slice(0,2).every(function(w){ return tb.indexOf(w)>=0; });
  }
  /* El nombre como aparece escrito en el cuerpo («CAMPOS IVAN ESTEBAN» →
     «Iván Esteban Campos»): las mismas palabras, en cualquier orden. */
  function nombreEnCuerpo(texto,crudo){
    var tk=tokensNombre(crudo); if(tk.length<2||tk.length>6) return null;
    var re=new RegExp("["+MAY+"]["+MIN+"A-ZÁÉÍÓÚÑÜ]+(?:\\s+(?:de\\s+|del\\s+)?["+MAY+"]["+MIN+"A-ZÁÉÍÓÚÑÜ.]+){"+(tk.length-1)+"}","g"),m,mejor=null;
    function casi(a,b){ // misma palabra o una letra de diferencia («Villarreal»/«Villareal»)
      if(a===b) return true;
      if(a.length<6||Math.abs(a.length-b.length)>1) return false;
      var i=0; while(i<a.length&&a[i]===b[i]) i++;
      return a.slice(i+1)===b.slice(i+1)||a.slice(i+1)===b.slice(i)||a.slice(i)===b.slice(i+1);
    }
    while((m=re.exec(texto))){
      var t2=tokensNombre(m[0]);
      if(t2.length!==tk.length) continue;
      var libres=tk.slice();
      if(!t2.every(function(w){ for(var j=0;j<libres.length;j++) if(casi(libres[j],w)){ libres.splice(j,1); return true; } return false; })) continue;
      var sc=(/[a-záéíóúñ]/.test(m[0])?2:0)+(tieneTilde(m[0])?1:0);
      if(!mejor||sc>mejor.sc) mejor={sc:sc,nombre:m[0],ini:m.index};
      if(sc>=3) break;
    }
    return mejor;
  }
  function presentarParte(texto,crudo){
    crudo=limpio(crudo).replace(/^(?:DIGITAL\s*[–-]\s*)/i,"");
    var e=nombreEnCuerpo(texto,crudo);
    if(e&&/[a-záéíóúñ]/.test(e.nombre)) return {nombre:e.nombre,comoEnCaratula:crudo,evidencia:evid(texto,e.ini,e.ini+e.nombre.length,60,60),regla:"nombre-en-el-cuerpo"};
    // persona física sin coincidencia: APELLIDO NOMBRES → Nombres Apellido (deducido)
    var pal=crudo.split(" ");
    var esEmpresa=/\b(S\.?A\.?|S\.?R\.?L\.?|LTDA|LIMITADA|COOP|COOPERATIVA|SEGUROS|BANCO|ASOCIACI[OÓ]N|GOBIERNO|GCBA|MUNICIPALIDAD|PROVINCIA|ESTADO|EMPRESA|ART|ARGENTINA|FISCO|DIRECCI[OÓ]N)\b/i.test(crudo);
    var cuerpo=nombreEnCuerpoOrden(texto,crudo);
    if(cuerpo) return {nombre:cuerpo.nombre,comoEnCaratula:crudo,evidencia:evid(texto,cuerpo.ini,cuerpo.ini+cuerpo.nombre.length,60,60),regla:"nombre-en-el-cuerpo"};
    var nombre=(!esEmpresa&&pal.length>=2&&pal.length<=4&&crudo===crudo.toUpperCase())?pal.slice(1).concat(pal[0]).map(capitalizar).join(" "):pal.map(capitalizar).join(" ");
    return {nombre:nombre,comoEnCaratula:crudo,evidencia:null,regla:esEmpresa?"caratula":"caratula-apellido-primero",certezaNombre:esEmpresa?"confirmado":"orden_deducido"};
  }
  // empresas y nombres en el mismo orden, en minúsculas en el cuerpo
  function nombreEnCuerpoOrden(texto,crudo){
    var w=limpio(crudo).split(" ").slice(0,4).map(function(x){ return plano(x).replace(/[^a-z0-9]/g,""); }).filter(Boolean);
    if(w.length<2) return null;
    var pt=plano(texto),re=new RegExp("\\b"+w.join("[^a-z0-9]+")+"(?:[^a-z0-9]+[a-z]+){0,3}","g"),m;
    while((m=re.exec(pt))){
      var orig=texto.substr(m.index,m[0].length);
      // recortar a las palabras de la carátula
      var n=limpio(crudo).split(" ").length,pal=limpio(orig).split(" ").slice(0,n).join(" ");
      if(/[a-záéíóúñ]/.test(pal)) return {nombre:pal,ini:m.index};
    }
    return null;
  }
  function analizarPartes(texto,car){
    var out={caratula:car||null,instancia:null,origen:null,notas:[]};
    if(!car) { out.notas.push("No se identificó la carátula."); return out; }
    var c=limpio(car).replace(/^["“]|["”]$/g,""),m,origen=c,recurrente=null,tipoRecurso=null;
    // SCJM: «X EN J° 13-07241584-6 (010305-57613) A C/ B P/ objeto P/ RECURSO EXTRAORDINARIO PROVINCIAL»
    m=/^(.+?)\s+EN\s+(?:J[°º.]?|JUICIO|AUTOS|J\s)\s*(?:N[°º.]?\s*)?[\d\-\/.]*\s*(?:\(+\s*[\d\-\/.]+\s*\)+)?\s*(.+)$/i.exec(c);
    if(m&&/C\/|c\//.test(m[2])){ recurrente=m[1]; origen=m[2]; }
    else{
      // TSJ: «X s/ QUEJA POR RECURSO … en Y c/ Z s/ objeto»
      m=/^(.+?)\s+s\/\s*((?:queja|recurso|incidente)[^]*?)\s+en:?\s+["“]?(.+)$/i.exec(c);
      if(m){ recurrente=m[1]; tipoRecurso=limpio(m[2]); origen=m[3]; }
      else{
        // CSJN: «Recurso de hecho deducido por la actora en la causa A c/ B s/ objeto»
        m=/^recurso\s+(?:de\s+hecho|extraordinario)\s+deducido\s+por\s+(.+?)\s+en\s+(?:la\s+causa|los\s+autos)\s+(.+)$/i.exec(c);
        if(m){ recurrente=m[1]; tipoRecurso="recurso de hecho"; origen=m[2]; }
      }
    }
    var mo=/^(.+?)\s+C\/\.?\s+(.+?)\s+(?:S\/|P\/)\s*(.+)$/i.exec(origen);
    if(mo){
      var objeto=mo[3],mr=/\s+(?:P\/|S\/)\s*(RECURSO[^]*)$/i.exec(objeto);
      if(mr){ tipoRecurso=tipoRecurso||limpio(mr[1]); objeto=objeto.slice(0,mr.index); }
      var actores=mo[1].split(/\s+Y\s+(?!OTR)|\s*,\s*/i).filter(function(x){ return x.trim().length>2; });
      var dems=mo[2].split(/\s+Y\s+(?!OTR)|\s*,\s*/i).filter(function(x){ return x.trim().length>2; });
      var otros=/\bY\s+OTR[OA]S?\b/i.test(mo[2]);
      out.origen={
        actor:actores.map(function(a){ return Object.assign(presentarParte(texto,a),{rol:"actor",etapa:"origen"}); }),
        demandados:dems.map(function(a){ return Object.assign(presentarParte(texto,a.replace(/\s+Y\s+OTR[OA]S?\b.*/i,"")),{rol:"demandado",etapa:"origen"}); }),
        citadosEnGarantia:[],
        objeto:capitalizar(limpio(objeto).toLowerCase()).replace(/^./,function(x){ return x.toUpperCase(); }),
        otros:otros
      };
      out.origen.objeto=limpio(objeto).charAt(0)+limpio(objeto).slice(1).toLowerCase();
    }
    // función de cada demandado en el cuerpo («como conductor guardián», «titular registral»)
    if(out.origen){
      out.origen.demandados.forEach(function(dm){
        var tk=tokensNombre(dm.nombre),ap=tk[tk.length-1];
        var re2=new RegExp(ap.replace(/[^a-z]/g,"")+"[^.;]{0,90}?(?:como|por ser(?: el| la)?|en (?:su )?car[aá]cter de)\\s+(?:el\\s+|la\\s+)?(conductor(?:a)?(?:\\s+guardi[aá]n)?|titular\\s+registral|propietari[oa]|guardi[aá]n|empleador(?:a)?|aseguradora)","i"),mm=re2.exec(plano(texto));
        if(mm){ dm.funcion=limpio(mm[1]).replace(/guardian/,"guardián"); dm.evidenciaFuncion=evid(texto,mm.index,mm.index+mm[0].length,20,20); }
      });
    }
    var actuales=[];
    if(recurrente){
      var r=presentarParte(texto,recurrente);
      r.rol="recurrente"; r.etapa="instancia_actual"; r.tipoRecurso=tipoRecurso;
      actuales.push(r);
      // ¿la recurrente es también parte del origen? (citada en garantía, demandada, actora)
      var pt=plano(texto),tk2=tokensNombre(r.comoEnCaratula).slice(0,2).join("[^a-z]+");
      var reCit=new RegExp("citad[ao]\\s+en\\s+garantia[^.;]{0,40}?"+tk2+"|"+tk2+"[^.;]{0,80}?citad[ao]\\s+en\\s+garantia","i"),mc=reCit.exec(pt);
      if(mc&&out.origen){
        out.origen.citadosEnGarantia.push({nombre:r.nombre,comoEnCaratula:r.comoEnCaratula,rol:"citado_en_garantia",etapa:"origen",evidencia:evid(texto,mc.index,mc.index+mc[0].length,30,30),regla:"citada-en-garantia-en-el-cuerpo"});
        r.tambien="citada en garantía en el proceso de origen";
      }else if(out.origen){
        if(out.origen.actor.some(function(a){ return mismaEntidad(a.comoEnCaratula,r.comoEnCaratula)||mismaPersona(a.nombre,r.nombre); })) r.tambien="actor en el proceso de origen";
        else if(out.origen.demandados.some(function(a){ return mismaEntidad(a.comoEnCaratula,r.comoEnCaratula)||mismaPersona(a.nombre,r.nombre); })) r.tambien="demandado en el proceso de origen";
      }
      var recurrido=null;
      if(out.origen&&r.tambien&&!/actor/.test(r.tambien)&&out.origen.actor.length) recurrido=out.origen.actor.map(function(a){ return {nombre:a.nombre,rol:"recurrido",etapa:"instancia_actual",regla:"contraparte-de-la-recurrente",certeza:"inferido"}; });
      else if(out.origen&&r.tambien&&/actor/.test(r.tambien)) recurrido=out.origen.demandados.map(function(a){ return {nombre:a.nombre,rol:"recurrido",etapa:"instancia_actual",regla:"contraparte-de-la-recurrente",certeza:"inferido"}; });
      out.instancia={recurrentes:actuales,recurridos:recurrido||[],tipoRecurso:tipoRecurso};
      if(!recurrido) out.notas.push("No se pudo establecer con certeza quién es la parte recurrida.");
    }
    return out;
  }

  /* ---------- montos ---------- */
  var reMonto=/(US\$|U\$S|USD|\$)\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?![\d.,]*\d)/g;
  function valorDe(s){ return parseFloat(String(s).replace(/\./g,"").replace(",",".")); }
  var CONCEPTOS=[
    ["incapacidad sobreviniente",/incapacidad(?:\s+(?:parcial\s+y\s+permanente\s+)?sobrevin\w+|\s+parcial)?/],
    ["consecuencias no patrimoniales / daño moral",/consecuencias\s+no\s+patrimoniales|dano\s+moral|extrapatrimonial/],
    ["tratamiento psicoterapéutico",/tratamiento\s+psico\w*/],
    ["gastos médicos",/gastos\s+medicos|gastos\s+de\s+farmacia/],
    ["daños al vehículo",/danos?\s+(?:a|en)\s+(?:la\s+motocicleta|el\s+(?:vehiculo|automotor|rodado))|dano\s+material|reparacion\s+del\s+(?:vehiculo|automotor)/],
    ["lucro cesante",/lucro\s+cesante/],
    ["privación de uso",/privacion\s+de(?:l)?\s+uso/],
    ["honorarios",/honorarios/],
    ["tasa de justicia",/tasa\s+de\s+justicia/],
    ["salario mínimo, vital y móvil",/salario\s+minimo|smvm|s\.m\.v\.m/],
    ["indemnización por despido",/indemnizacion\s+por\s+(?:despido|antiguedad)|art\.\s*245/]
  ];
  function conceptoDe(t){
    var mejor=null,pos=-1;
    CONCEPTOS.forEach(function(c){ var re=new RegExp(c[1].source,"g"),m; while((m=re.exec(t))) if(m.index>=pos){ pos=m.index; mejor=c[0]; } });
    return mejor;
  }
  function analizarMontos(texto,sec,pers){
    var out=[],m,primerVoto=pers.votos.length?pers.votos[0].ini:Math.floor(texto.length*.2);
    // el relato de la causa: en la SCJM va DENTRO del primer voto, hasta «SOLUCIÓN AL CASO»
    var iSolucion=texto.search(/SOLUCI[OÓ]N AL CASO|AN[AÁ]LISIS DE LA CAUSA|LA CUESTI[OÓ]N A RESOLVER|\bCONSIDERANDO\b/);
    var finRelato=iSolucion>0?iSolucion:primerVoto;
    reMonto.lastIndex=0;
    while((m=reMonto.exec(texto))){
      var ini=m.index,fin=ini+m[0].length,or=oracion(texto,ini,false);
      var antes=texto.slice(Math.max(or.ini,ini-300),ini),despues=texto.slice(fin,Math.min(or.fin+1,fin+160));
      // lo que sigue hasta la próxima cifra: ahí se dice si van «con más los intereses»
      var hastaOtra=despues.search(/\$\s?\d/);
      var propio=hastaOtra>=0?despues.slice(0,hastaOtra):despues;
      var pa=plano(antes),pd=plano(despues),po=plano(or.texto);
      var item={original:limpio(m[0]),valor:valorDe(m[2]),moneda:/US|USD/.test(m[1])?"USD":"ARS",ini:ini,fin:fin,
        concepto:null,funcion:"mencionado",etapa:null,sujeto:null,intereses:"no_indicado",
        seccion:dentro(sec.resolutiva,ini)?"parte_resolutiva":(ini<finRelato?"antecedentes":"fundamentos"),
        evidencia:evid(texto,ini,fin,180,120),regla:"sin-regla",certeza:"no_confirmado"};
      // la etiqueta del rubro inmediatamente antes («a) Incapacidad sobreviniente: $…»)
      var et=/(?:^|[;,(]\s*|\s)[a-h]\)\s*([^:;$()]{3,60}):\s*$/i.exec(antes);
      var enConcepto=/^\s*,?\s*en\s+concepto\s+de\s+([^,.;$]{3,70}?)(?=\s+(?:teniendo|conforme|seg[uú]n|con\s+m[aá]s|que|en\s+raz[oó]n|por)\b|[,.;]|$)/i.exec(despues);
      item.concepto=et?limpio(et[1]):(enConcepto?limpio(enConcepto[1]):conceptoDe(pa.slice(-160)));
      var pp=plano(propio);
      if(/^[^$]{0,90}?(?:con\s+mas\s+(?:sus\s+|los\s+)?intereses|mas\s+(?:sus\s+|los\s+)?intereses)/.test(pp)) item.intereses="aparte";
      if(/^[^$]{0,60}?(?:incluidos?\s+(?:los\s+)?intereses|intereses\s+incluidos)/.test(pp)) item.intereses="incluidos";
      var regAbs=regulacionVigente(texto,ini),reg=regAbs>=0?regAbs-Math.max(or.ini,ini-300):-1;
      function asignar(f,e,r,c){ item.funcion=f; if(e) item.etapa=e; item.regla=r; item.certeza=c||"probable"; }
      if(regAbs>=0&&ini-regAbs<1400){
        var tramo=texto.slice(regAbs,ini);
        var reT=new RegExp(reTitulo.source,"gi"),mt,ult=null; while((mt=reT.exec(tramo))) ult=mt;
        if(ult){ var ns2=listaDeNombres(texto,regAbs+ult.index+ult[0].length); if(ns2.length) item.sujeto=ns2.map(function(x){ return nombreVisible([x.nombre]); }).join(", "); }
        if(/de\s+manera\s+conjunta|en\s+conjunto/.test(plano(tramo.slice(-260)))) item.sujeto=(item.sujeto||"")+" (en conjunto)";
        var pt2=plano(tramo)+" "+pd.slice(0,160);
        asignar("honorarios_regulados",/tramite de apelacion|alzada/.test(pt2)?"alzada":/recurso extraordinario|esta instancia|instancia extraordinaria/.test(pt2)?"instancia_extraordinaria":/prospera la demanda|primera instancia/.test(pt2)?"primera_instancia":null,"regulacion-de-honorarios","confirmado");
        item.concepto="honorarios"+(/perit/.test(plano(tramo))?" de peritos":"");
      }
      else if(/transferir|boleta|deposit/.test(pa.slice(-120))) asignar("deposito_o_transferencia",null,"deposito");
      else if(/salario\s+minimo|smvm|s\.m\.v\.m/.test(pa.slice(-90))){ asignar("parametro_de_calculo",null,"salario-de-referencia","confirmado"); item.concepto="salario mínimo, vital y móvil"; }
      else if(/alegatos/.test(pa.slice(-160))&&/solicita|eleve|reclam/.test(pa.slice(-160))){
        if(/^\s*,?\s*(?:y\s+)?(?:el\s+(?:juez|a\s+quo)\s+)?otorga\s+dicha\s+suma/.test(pd)){ asignar("concedido","primera_instancia","pedido-en-alegatos-y-otorgado","confirmado"); item.nota="pedido en los alegatos y otorgado en primera instancia"; }
        else asignar("reclamado","alegatos","reclamo-en-alegatos","confirmado");
        if(!item.concepto) item.concepto=conceptoDe(plano(texto.slice(Math.max(0,ini-420),ini)));
      }
      else if(/suma\s+cercana|se\s+los\s+obliga|\bpretende\b|\balega\b|\bsostiene\b|\bafirma\b|se\s+agravia|aumento\s+la\s+poliza/.test(pa.slice(-160))) asignar("argumento_de_parte",null,"argumento-de-parte");
      else if(dentro(sec.resolutiva,ini)&&/a\s+pagar|abonar|condena|condenando/.test(po)){ asignar("condena_total",/quedara redactada|redactada de la siguiente/.test(plano(texto.slice(sec.resolutiva.ini,ini)))?"parte_resolutiva (texto modificado)":"parte_resolutiva","condena-en-la-resolutiva","confirmado"); if(!item.concepto||/capital/.test(item.concepto)) item.concepto="condena total (capital)"; }
      else if(ini<finRelato&&/reclam|interpone\s+demanda|por\s+la\s+suma\s+de|estim[oa]\s+el\s+rubro/.test(po)&&!/la sentencia|hace lugar|condena/.test(pa.slice(-120))){
        asignar("reclamado","demanda","reclamo-en-antecedentes","confirmado");
        if(!et&&/interpone\s+demanda|por\s+la\s+suma\s+de/.test(pa.slice(-200))) item.concepto="total reclamado";
      }
      else if(/la\s+sentencia\s+(?:de\s+primera\s+instancia\s+)?hace\s+lugar|los\s+condena\s+a\s+abonar|condena\s+a\s+abonar|otorga\s+dicha\s+suma|el\s+(?:a\s+quo|juez)[^.]{0,60}otorg/.test(pa.slice(-220))) { asignar("concedido","primera_instancia","condena-de-primera-instancia","confirmado"); if(!item.concepto) item.concepto="condena total"; }
      else if(/(?:sentencia|resolucion)\s+que\s+confirma[^.]{0,160}(?:al\s+pago\s+de|la\s+suma\s+de)/.test(pa.slice(-260))) asignar("concedido_y_confirmado","alzada","condena-confirmada-por-la-alzada","probable");
      else if(ini>=primerVoto&&!dentro(sec.resolutiva,ini)&&/corresponde\s+fijar|se\s+fija|fijar\s+(?:la\s+indemnizacion|el\s+rubro)|fij[oa]\s+(?:la\s+indemnizacion|el\s+monto)|establec\w+\s+la\s+indemnizacion/.test(pa.slice(-260))) asignar("fijado_por_este_tribunal","instancia_actual","monto-fijado-en-el-voto","confirmado");
      if(item.funcion==="mencionado"&&/solicita|reclam/.test(pa.slice(-100))) asignar("reclamado",null,"reclamo-mencionado","probable");
      out.push(item);
    }
    // relevancia: lo jurídicamente principal primero
    var ORDEN={reclamado:1,concedido:2,concedido_y_confirmado:3,fijado_por_este_tribunal:4,condena_total:5,honorarios_regulados:7,parametro_de_calculo:8,argumento_de_parte:9,deposito_o_transferencia:9,mencionado:10};
    out.forEach(function(x){ x.principal=ORDEN[x.funcion]<=5; });
    return out;
  }

  /* ---------- incapacidad: método de Balthazard ---------- */
  function analizarIncapacidad(texto){
    var p=plano(texto),re=/balthazar|capacidad\s+restante|capacidad\s+residual/g,m,mRes=null,mAnt=null,mPar=null,pz="",primera=null;
    // el cálculo puede estar lejos de la primera mención (que suele ser el
    // dictamen o el agravio): se prueba cerca de cada una
    while((m=re.exec(p))){
      if(!primera) primera=m;
      pz=p.slice(Math.max(0,m.index-1500),Math.min(p.length,m.index+5000));
      mRes=/(?:da como resultado|como resultado|arroja|incapacidad\s+(?:total|combinada|final)\s+(?:del?|es)?)[^%]{0,30}?(\d{1,2},\d{1,2})\s*%/.exec(pz);
      if(mRes) break;
    }
    if(!primera) return null;
    m=primera;
    mAnt=/no\s+sobre\s+el\s+(\d{1,2}(?:,\d{1,2})?)\s*%/.exec(pz)||/sum\w+\s+linealmente[^%]{0,160}?(\d{1,2}(?:,\d{1,2})?)\s*%/.exec(pz);
    mPar=/restarle\s+el\s+(\d{1,2}(?:,\d{1,2})?)[\s\S]{0,400}?calcularse\s+el\s+(\d{1,2}(?:,\d{1,2})?)\s*%/.exec(pz);
    var out={metodo:"Balthazard (capacidad restante)",evidencia:evid(texto,m.index,m.index+20,200,300),regla:"metodo-balthazard"};
    function n(s){ return parseFloat(String(s).replace(",",".")); }
    if(mPar){
      var a=n(mPar[1]),b=n(mPar[2]),restante=100-a,comb=a+restante*b/100;
      out.parciales=[a,b]; out.capacidadRestante=+restante.toFixed(2); out.calculado=+comb.toFixed(2);
      out.sumaLineal=+(a+b).toFixed(2);
    }
    if(mRes){ out.corregido=n(mRes[1]); var ab=texto.search(new RegExp(mRes[1].replace(",","\\,")+"\\s*%")); if(ab>=0) out.evidenciaResultado=evid(texto,ab,ab+mRes[1].length+1,220,160); }
    if(mAnt) out.anterior=n(mAnt[1]);
    if(out.calculado!=null&&out.corregido!=null) out.verificado=Math.abs(out.calculado-out.corregido)<0.02;
    return out;
  }

  /* ---------- decisión, agravios y modificaciones ---------- */
  var VERBOS=[["admite parcialmente",/admitir\s+parcialmente|hacer\s+lugar\s+parcialmente|admite\s+parcialmente|hace\s+lugar\s+parcialmente/],
    ["rechaza",/\brechaz(?:ar|a)\b/],["desestima",/desestim(?:ar|a)/],["hace lugar",/hacer\s+lugar|hace\s+lugar|admitir\s+(?:el|la|los)|admite\s+(?:el|la)/],
    ["revoca",/\brevoc(?:ar|a)\b/],["confirma",/\bconfirm(?:ar|a)\b/],["modifica",/\bmodific(?:ar|a)\b/],["deja sin efecto",/dejar\s+sin\s+efecto|deja\s+sin\s+efecto/],
    ["declara inadmisible",/declarar\s+inadmisible|declara\s+inadmisible/],["declara mal concedido",/mal\s+concedido/]];
  function analizarDecision(texto,sec,pers){
    var out={global:null,agravios:[],modificaciones:[],notas:[]};
    if(sec.resolutiva){
      var r=texto.slice(sec.resolutiva.ini,Math.min(texto.length,sec.resolutiva.ini+1800));
      var mi=/(?:\b(?:I|1)\s*[°º]?\s*[-.)–]+\s*|RESUELVE\s*:?\s*|resuelve\s*:\s*)([^]*?)(?=(?:\s|[“”"])(?:II|2)\s*[°º]?\s*[-.)–]|$)/.exec(r);
      var primer=mi?limpio(mi[1]):limpio(r.slice(0,500));
      var corto=primer.split(/,\s*caratulad|,\s*dictada\s+con\s+fecha|\s+la\s+que\s+quedar[aá]\s+redactada|:\s*[“"]/i)[0].slice(0,320);
      var pc=plano(corto),verbos=[];
      VERBOS.forEach(function(v){ if(v[1].test(pc)&&!(v[0]==="hace lugar"&&verbos.indexOf("admite parcialmente")>=0)) verbos.push(v[0]); });
      var objeto=/(recurso\s+(?:extraordinario(?:\s+provincial)?|de\s+inconstitucionalidad|de\s+apelaci[oó]n|de\s+casaci[oó]n|de\s+hecho)|queja|demanda)/i.exec(corto);
      out.global={literal:corto,verbos:verbos,objeto:objeto?objeto[1]:null,evidencia:evid(texto,sec.resolutiva.ini+(mi?mi.index:0),sec.resolutiva.ini+(mi?mi.index:0)+corto.length,0,0),regla:"primer-punto-de-la-resolutiva",certeza:"confirmado"};
    }else out.notas.push("No encontré la parte resolutiva con sus fórmulas habituales.");
    // agravios: los apartados con letra del voto principal («a.- …», «b) …») y su conclusión
    var vp=pers.votos.filter(function(v){ return v.tipo==="voto_principal"||v.tipo==="voto"; })[0];
    var desde=vp?vp.ini:Math.floor(texto.length*.2);
    var iSol=texto.slice(desde).search(/SOLUCI[OÓ]N AL CASO|AN[AÁ]LISIS DE LA CAUSA|CONSIDERANDO/);
    if(iSol>=0) desde+=iSol;
    var siguiente=pers.votos.filter(function(v){ return v.ini>desde; })[0];
    var hasta=siguiente?siguiente.ini:(sec.resolutiva?sec.resolutiva.ini:texto.length);
    var cuerpo=texto.slice(desde,hasta),reA=/(?:^|\s)([a-h])\s?(?:\.-|\)|\.\s?-|-)\s*([A-ZÁÉÍÓÚ][^.]{3,140}\.)/g,ma,aps=[];
    while((ma=reA.exec(cuerpo))) aps.push({letra:ma[1],titulo:limpio(ma[2]),ini:desde+ma.index+ma[0].search(/[a-h]/)});
    // nos quedamos con la serie consecutiva más larga a, b, c…
    var serie=[],mejor=[];
    aps.forEach(function(a){
      if(a.letra==="a"){ if(serie.length>mejor.length) mejor=serie; serie=[a]; }
      else if(serie.length&&a.letra.charCodeAt(0)===serie[serie.length-1].letra.charCodeAt(0)+1) serie.push(a);
    });
    if(serie.length>mejor.length) mejor=serie;
    var fin=texto.slice(desde,hasta).search(/\b[A-D]\)\s*Conclusi[oó]n|Conclusi[oó]n\.|ASÍ VOTO|Así voto/);
    var finCuerpo=fin>=0?desde+fin:hasta;
    var SI=/(?:corresponde|cabe)\s+(?:la\s+)?admisi[oó]n\s+del\s+agravio|le\s+asiste\s+raz[oó]n|debe\s+prosperar|corresponde\s+hacer\s+lugar|corresponde\s+admitir|asiste\s+raz[oó]n\s+(?:a\s+la\s+)?recurrente|el\s+agravio\s+(?:debe\s+ser\s+)?(?:admitido|prospera)/i;
    var NO=/no\s+advierto[^.]{0,40}error|no\s+resulta\s+(?:en\s+este\s+aspecto\s+)?(?:equivocad|arbitrari)|(?:se\s+)?rechace\s+el\s+agravio|rechazo\s+del\s+agravio|no\s+le\s+asiste\s+raz[oó]n|el\s+agravio\s+(?:tambi[eé]n\s+)?se\s+rechaza|corresponde\s+(?:su\s+)?rechaz(?:o|ar)|no\s+advierto\s+arbitrariedad|no\s+puede\s+prosperar|no\s+prospera|debe\s+ser\s+desestimad/i;
    var NOTRAT=/abstract[oa]|inoficios[oa]|no\s+corresponde\s+(?:ingresar|tratar|analizar)|resulta\s+innecesario\s+(?:tratar|analizar)/i;
    var PARC=/no\s+ocurre\s+lo\s+mismo|distinto\s+es\s+el\s+caso|en\s+cambio,|sin\s+embargo,?\s+(?:respecto|en\s+cuanto)/i;
    mejor.forEach(function(a,i){
      var f=i+1<mejor.length?mejor[i+1].ini:finCuerpo,t=texto.slice(a.ini,f);
      var ultimoSi=-1,ultimoNo=-1,mm,re1=new RegExp(SI.source,"gi"),re2=new RegExp(NO.source,"gi");
      while((mm=re1.exec(t))) ultimoSi=mm.index; while((mm=re2.exec(t))) ultimoNo=mm.index;
      // la última fórmula de contraste («No ocurre lo mismo respecto de…») después de un rechazo: admitido en parte
      var parc=null,rp=new RegExp(PARC.source,"gi"),mp; while((mp=rp.exec(t))) parc=mp;
      var estado="no_determinado",ev=null,cola=t.slice(-900);
      if(NOTRAT.test(cola)&&ultimoSi<0&&ultimoNo<0){ estado="no_tratado_en_el_fondo"; }
      else if(parc&&(ultimoNo>=0||ultimoSi>=0)&&parc.index>Math.max(ultimoNo,ultimoSi)){ estado="admitido_parcialmente"; ev=evid(texto,a.ini+parc.index,a.ini+parc.index+parc[0].length,40,260); }
      else if(ultimoSi>ultimoNo){ estado="admitido"; ev=evid(texto,a.ini+ultimoSi,a.ini+ultimoSi+40,160,120); }
      else if(ultimoNo>=0){ estado="rechazado"; ev=evid(texto,a.ini+ultimoNo,a.ini+ultimoNo+40,160,120); }
      out.agravios.push({letra:a.letra,titulo:a.titulo.replace(/\.$/,""),estado:estado,ini:a.ini,fin:f,evidencia:ev||evid(texto,a.ini,a.ini+a.titulo.length,0,200),regla:"apartado-del-voto-principal",certeza:estado==="no_determinado"?"no_confirmado":"probable"});
    });
    // qué se modifica: «revocar la sentencia, en cuanto a X y respecto a Y» / «en lo atinente a …»
    var reMod=/(?:revocar|modificar|dejar\s+sin\s+efecto)\s+(?:la\s+(?:sentencia|resoluci[oó]n)[^,]{0,80},?\s*)?(?:en\s+cuanto\s+(?:al?|a\s+la)|en\s+lo\s+(?:atinente|relativo|que\s+respecta)\s+a(?:l)?|respecto\s+(?:a|de)(?:l)?)\s*([^.]{10,400})/gi,mm2;
    while((mm2=reMod.exec(texto))){
      if(dentro(sec.resolutiva,mm2.index)) continue;
      var partes=mm2[1].split(/\s+y\s+respecto\s+(?:a|de)(?:l)?\s+|\s*;\s*|,\s+as[ií]\s+como\s+|\s+y\s+en\s+cuanto\s+a(?:l)?\s+/i);
      partes.forEach(function(x){ x=limpio(x).replace(/\.$/,""); if(x.length>8&&!out.modificaciones.some(function(y){ return y.texto===x; })) out.modificaciones.push({texto:x,evidencia:evid(texto,mm2.index,mm2.index+mm2[0].length,40,0),regla:"revocar-en-cuanto-a"}); });
    }
    var mc=/en\s+lo\s+atinente\s+a(?:l)?\s+([^.]{10,300}),\s+as[ií]\s+como\s+([^.]{10,300})\./i.exec(texto);
    if(mc&&!out.modificaciones.length) [mc[1],mc[2]].forEach(function(x){ x=limpio(x); if(!out.modificaciones.some(function(y){ return plano(y.texto).slice(0,30)===plano(x).slice(0,30); })) out.modificaciones.push({texto:x,evidencia:evid(texto,mc.index,mc.index+mc[0].length,0,0),regla:"conclusion-del-voto"}); });
    return out;
  }

  /* ---------- precedentes y doctrina ----------
     Se trabaja por UNIDADES DE CITA, no por un formato único:
       · cada paréntesis (y, adentro, cada tramo separado por «;»);
       · lo que lo antecede inmediatamente («la CSJN en “Barrientos” (Fallos…)»,
         «en la causa “Parra” (sentencia del 13/3/18)»);
       · las citas en línea con palabra de aviso («precedente», «causa»,
         «in re», «plenario», «lo resuelto en», «criterio sentado en»…) o con
         fecha, expediente o registro pegados a la carátula.
     En cada unidad se buscan los anclajes: colección «Fallos» de la Corte,
     registros de la SCJM (LS/LA tomo-página), publicaciones (LL, ED, JA, TR
     LALEY), expediente o CUIJ, fecha de la sentencia (en números o en
     letras), tribunal; y la carátula: entre comillas (aunque falte la de
     apertura), sin comillas («X c/ Y s/ Z», «X en j° Y», «PÉREZ JUAN
     19/08/2025», «Corte… – Ontiveros, Stella Maris c. … –») o nombrada en
     el texto («el precedente Barrientos»). Un nombre propio suelto, sin
     ningún anclaje, no es un precedente. */
  var Q_AB="“\"«",Q_CI="”\"»";
  var MESES_P={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
  function fechaEn(s){
    var m=/(\d{1,2})\s?[\/.\-]\s?(\d{1,2})\s?[\/.\-]\s?(\d{4}|\d{2})(?!\d)/.exec(s),t=/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de|del)\s+(\d{4})/i.exec(s);
    var usar=null;
    if(m&&(!t||m.index<=t.index)){ var a=m[3].length===2?(+m[3]>40?"19"+m[3]:"20"+m[3]):m[3]; if(+m[2]>=1&&+m[2]<=12&&+m[1]>=1&&+m[1]<=31) usar=("0"+m[1]).slice(-2)+"/"+("0"+m[2]).slice(-2)+"/"+a; }
    else if(t&&MESES_P[plano(t[2])]) usar=("0"+t[1]).slice(-2)+"/"+("0"+MESES_P[plano(t[2])]).slice(-2)+"/"+t[3];
    return usar;
  }
  var RE_FALLOS=/Fallos\s*(?:Corte)?\s*:?\s*(\d{2,3})\s*:\s*(\d{1,5})((?:\s*(?:[;,]\s*(?:y\s+)?|y\s+)\d{2,3}\s*:\s*\d{1,5})*)/gi;
  var RE_REG=/\b(L\.?\s?[SA])\.?\s?(\d{2,3})\s?[-–]\s?(\d{1,4})\b((?:\s*[;,\/]\s*(?:L\.?\s?[SA]\.?\s?)?\d{2,3}\s?[-–]\s?\d{1,4}\b)*)/g;
  var RE_PUB=/\b(?:L\.?\s?L\.?|E\.?\s?D\.?|J\.?\s?A\.?|D\.?\s?J\.?)\s?(?:\d{4}\s?[-–]\s?[A-F]{1,3}\s?[-–]\s?\d{1,5}|\d{2,3}\s?[-–]\s?\d{1,5})|TR\s+LALEY\s+AR\/JUR\/\d+\/\d{4}|Constituci[oó]n\s+y\s+Justicia\s+\[Fallos\s+del\s+TSJ\][^;)]{0,60}/gi;
  var RE_EXP=/\b(?:Expte\.?|expte\.?|EXPTE\.?|expediente|Expediente|CUIJ|causa\s+n[°º]|autos\s+n[°º]|Ac\.|Acuerdo)\s*\.?\s*(?:n\.?\s*[°º]?\s*|nro\.?\s*)?:?\s*((?:TSJ|QTS)?\s?\d[\d\-\/.]{2,}\d)/g;
  function tribunalEn(s,tipoDoc){
    var p=plano(s);
    if(/\bcsjn\b|c\.\s?s\.\s?j\.\s?n|corte\s+suprema(?!\s+de\s+justicia\s+de\s+(?:mendoza|la\s+provincia))|\bfallos\s*(?:corte)?\s*:?\s*\d{2,3}\s*:/.test(p)) return {tipo:"csjn",tribunal:"Corte Suprema de Justicia de la Nación"};
    var cam=/\b(c\.?\s?n\.?\s?a\.?\s?t\.?|c\.?\s?n\.?\s?a\.?\s?c\.?|c\.?\s?n\.?\s?civ\.?|cncom\.?|cnfed\.?|camara\s+nacional[^,;)]{0,60}|plenario|camara\s+(?:de\s+apelaciones|civil|comercial|del\s+trabajo|federal|en\s+lo)[^,;)]{0,60})/.exec(p);
    if(cam) return {tipo:"otro_tribunal",tribunal:limpio(s.substr(cam.index,cam[0].length)).replace(/^./,function(x){ return x.toUpperCase(); })};
    if(/\bscba\b|s\.\s?c\.\s?b\.\s?a|suprema\s+corte\s+de\s+(?:justicia\s+de\s+)?(?:la\s+provincia\s+de\s+)?buenos\s+aires/.test(p)) return {tipo:"provincial",tribunal:"Suprema Corte de Justicia de la Provincia de Buenos Aires"};
    if(/\btsj\b|tribunal\s+superior\s+de\s+justicia|fallos\s+del\s+tsj/.test(p)) return {tipo:"provincial",tribunal:"Tribunal Superior de Justicia de la Ciudad Autónoma de Buenos Aires"};
    if(/s\.?\s?c\.?\s?j\.?\s?(?:m\b|mza)|\bscjm\b|suprema\s+corte\s+de\s+(?:justicia\s+de\s+)?mendoza|\bex\s+sala\b|\bl\.?\s?[sa]\.?\s?\d{2,3}\s?[-–]\s?\d/.test(p)) return {tipo:"provincial",tribunal:"Suprema Corte de Justicia de Mendoza"};
    return null;
  }
  var PROPIO={scjm:"Suprema Corte de Justicia de Mendoza",tsj:"Tribunal Superior de Justicia de la Ciudad Autónoma de Buenos Aires",scba:"Suprema Corte de Justicia de la Provincia de Buenos Aires",csjn:"Corte Suprema de Justicia de la Nación"};
  function tribunalPropioEn(s,tipoDoc){
    if(!PROPIO[tipoDoc]) return null;
    return /este\s+tribunal|esta\s+corte|esta\s+sala|este\s+(?:cuerpo|estrado|superior\s+tribunal)|me\s+remito|como\s+se\s+record[oó]|precedentes?\s+de\s+esta|jurisprudencia\s+de\s+este|ha\s+resuelto\s+(?:la\s+)?ex\s+sala|nuestro\s+tribunal/i.test(s)?{tipo:tipoDoc==="csjn"?"csjn":"provincial",tribunal:PROPIO[tipoDoc]}:null;
  }
  /* ¿Parece una carátula y no un pasaje citado entre comillas? */
  function esCaratula(c){
    c=limpio(c).replace(/^[\s,;:–-]+|[\s,;:–-]+$/g,"").replace(/\s*(?:\.{2,}|…)$/,"");
    if(c.length<2||c.length>330) return false;
    if(!/^[A-ZÁÉÍÓÚÑ]/.test(c)) return false;
    if(/\s(?:c\/?\.?|s\/|v\.|vs\.?|en\s+j\s?[°º:.]?|c\.)\s/i.test(" "+c+" ")) return true;
    var pal=c.split(" ");
    if(pal.length<=6&&!/[.:;]$/.test(c)&&pal.filter(function(w){ return /^[A-ZÁÉÍÓÚÑ]/.test(w); }).length>=Math.ceil(pal.length/2)) return true;
    return /^[A-ZÁÉÍÓÚÑ][^,]{1,40},\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(c)&&pal.length<=10;
  }
  function limpiarCaratula(c){ return limpio(c).replace(/^[\s,;:–\-]+|[\s,;:–\-]+$/g,"").replace(/^(?:DIGITAL\s*[–-]\s*)/i,""); }
  /* Las carátulas de un tramo: entre comillas (también con la de apertura
     ausente), o sin comillas. */
  function caratulasEn(s){
    var out=[],m;
    function agregar(c,i,f){ if(esCaratula(c)&&!out.some(function(o){ return i<o.f&&f>o.i; })) out.push({c:limpiarCaratula(c),i:i,f:f}); }
    // comilla de cierre sin apertura al principio del tramo: «Expte.: X – Triunfo en j° Uribe...”»,
    // «CSJN, Pellicori", "Sisnero" y "Varela"» (comillas rectas desparejas)
    var primeraAb=s.search(/[“«]/),primeraCi=s.search(/[”»]/),rectas=(s.match(/"/g)||[]).length,desde=0;
    var cierreSuelto=primeraCi>=0&&(primeraAb<0||primeraCi<primeraAb)?primeraCi:(rectas%2===1&&/[A-Za-zÁÉÍÓÚáéíóúñÑ.]"/.test(s)?s.search(/[A-Za-zÁÉÍÓÚáéíóúñÑ.]"/)+1:-1);
    if(cierreSuelto>=0){
      var previo=s.slice(0,cierreSuelto),corte=Math.max(previo.lastIndexOf("–"),previo.lastIndexOf(" - "),previo.lastIndexOf("("),previo.lastIndexOf(","),previo.lastIndexOf(":"));
      // «Expte.: 13-… – Triunfo en j° Uribe...”»: desde el último separador que no esté dentro del nombre
      var cand=previo.slice(corte+1).replace(/^\s*-\s*/,"");
      if(!esCaratula(cand)){ cand=previo.replace(/^.*\b(?:Expte|expte|CUIJ)[^–-]*[–-]\s*/,"").replace(/^\s*\(?\s*/,""); }
      agregar(cand,previo.indexOf(cand),cierreSuelto+1);
      desde=cierreSuelto+1;
    }
    var re=/[“"«]\s*([^”"»“«]{1,330}?)\s*[”"»]/g; re.lastIndex=desde;
    while((m=re.exec(s))) agregar(m[1],m.index,m.index+m[0].length);
    if(out.length) return out.sort(function(x,y){ return x.i-y.i; });
    // sin comillas
    m=/Naci[oó]n\s*[-–]\s*([^-–(•]{3,180}?)\s*[-–•]/.exec(s);
    if(m) return [{c:limpio(m[1]),i:m.index,f:m.index+m[0].length}];
    var sueltas=caratulasSueltas(s);
    if(sueltas.length) return sueltas;
    m=/([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{1,60}?\s+en\s+j\s?[°º:.]?\s*[A-ZÁÉÍÓÚÑ][^;(),“”"]{1,80}?)(?=\s*(?:[,;)]|\(|\s+(?:del?|sentencia)\b|$))/.exec(s);
    if(m) return [{c:limpio(m[1]),i:m.index,f:m.index+m[0].length}];
    var reMay=/\b((?:[A-ZÁÉÍÓÚÑ]{3,}|[A-ZÁÉÍÓÚÑ]\.)(?:\s+(?:[A-ZÁÉÍÓÚÑ]{2,}|DE|DEL|Y)){1,6})\s*,?\s*(?:del?\s+)?\d{1,2}\s?[\/.\-]\s?\d{1,2}\s?[\/.\-]\s?\d{2,4}/g;
    while((m=reMay.exec(s))) if(!/\b(?:CSJN|SCJM|SCBA|TSJ|LEY|FALLOS|SALA|CNAT|CNAC|EXPTE|CUIJ|LS|LA|ART)\b/.test(m[1])) out.push({c:capitalizarFrase(m[1]),i:m.index,f:m.index+m[1].length});
    return out;
  }
  /* «Pérez, Juan c/ López, Ana s/ daños», «Arostegui, Pablo Martín c/ Omega
     ART S.A.»: la parte actora es la serie de palabras con mayúscula pegada a
     «c/» (una palabra en minúscula la corta), la demandada llega hasta el
     «s/» o hasta el paréntesis, la coma de la fecha o el fin de la oración. */
  var RE_CAR_SUELTA=/((?:[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü.'’\-]*,?\s+(?:(?:de|del|la|las|los|y|e)\s+)?){1,8}?)c\/\.?\s+([^;()“”"«»]{2,160}?)(?:\s+s\/\s*([^;()“”"«»]{2,140}?))?(?=\s*(?:[;()]|,\s*(?:\d|sent|resol|expte|Expte|fallo|del?\s|JA|ED|LL|L\.L)|\s+del?\s+\d|\.\s|$))/g;
  function sinCortePrefijo(c){
    return c.replace(/^(?:[^,]*\b(?:C\.?\s?N\.?|CNCiv|CNAT|CNAC|CNCom|CSJN|SCJM|SCBA|TSJ|C[aá]mara|Sala\s+[A-Z0-9IVX]+|Juzgado)\b[^,]*,\s*)+/,"");
  }
  function caratulasSueltas(s){
    var out=[],m; RE_CAR_SUELTA.lastIndex=0;
    while((m=RE_CAR_SUELTA.exec(s))){
      var izq=sinCortePrefijo(limpio(m[1]).replace(/,$/,""));
      if(!izq||/^(?:Fallos|LS|LA|CSJN|SCJM|Ley)\b/.test(izq)) continue;
      var c=izq+" c/ "+limpio(m[2])+(m[3]?" s/ "+limpio(m[3]):"");
      var ini=m.index+m[0].indexOf(izq.split(" ")[0]);
      out.push({c:c,i:ini,f:m.index+m[0].length});
    }
    return out;
  }
  function capitalizarFrase(s){ return limpio(s).split(" ").map(capitalizar).join(" "); }
  function sigTokens(s){ return plano(s).split(/[^a-z0-9]+/).filter(function(w){ return w.length>2&&!/^(los|las|del|por|sobre|contra|otros?|recurso|extraordinario|provincial|queja|inconstitucionalidad|denegado|sa|srl|ltda|ley|danos|derivados|accidentes?|transito|perjuicios)$/.test(w); }); }
  /* ¿Es el propio expediente (o su origen), y no un precedente? */
  function esPropia(c,car){
    if(!car||!c) return false;
    var a=sigTokens(car),b=sigTokens(c).slice(0,2);
    return b.length>=2&&b.every(function(w){ return a.indexOf(w)>=0; });
  }
  function analizarPrecedentes(texto,tipoDoc,car){
    var out=[],m;
    var inicioCuerpo=Math.min(texto.length,Math.max(0,texto.search(/ANTECEDENTES|Vistos:|VISTOS:|Resulta:|RESULTA:/)));
    if(inicioCuerpo<=0) inicioCuerpo=Math.min(500,texto.length);
    function funcionDe(i,nombre){
      var a=plano(texto.slice(Math.max(0,i-700),i+40));
      var d=/no\s+corresponde[^.]{0,80}traer\s+a\s+colacion|no\s+nos\s+encontramos\s+ante\s+igual|no\s+resulta\s+aplicable|distinto\s+supuesto|no\s+es\s+aplicable\s+(?:al\s+caso|aqui)|se\s+distingue\s+de|la\s+camara\s+distinguio/.exec(a);
      if(!d) return "citado";
      var n=plano(nombre||"").split(/[^a-z]+/).filter(function(w){ return w.length>3; })[0];
      return (!n||a.indexOf(n,d.index)>=0||a.length-d.index<320)?"distinguido (el tribunal dice que no se aplica)":"citado";
    }
    function nuevo(p){ p.publicaciones=p.publicaciones||[]; out.push(p); return p; }
    /* una unidad: el texto de la cita y lo que la antecede */
    function anclas(s){
      var r={fallos:[],regs:[],pubs:[],exps:[],fecha:fechaEn(s)},mm;
      RE_FALLOS.lastIndex=0;
      while((mm=RE_FALLOS.exec(s))){
        r.fallos.push(mm[1]+":"+mm[2]);
        (mm[3]||"").split(/[;,]|\by\b/).forEach(function(x){ var q=/(\d{2,3})\s*:\s*(\d{1,5})/.exec(x); if(q) r.fallos.push(q[1]+":"+q[2]); });
      }
      RE_REG.lastIndex=0;
      while((mm=RE_REG.exec(s))){
        var sig=mm[1].replace(/[.\s]/g,"").toUpperCase();
        r.regs.push(sig+" "+mm[2]+"-"+mm[3]);
        (mm[4]||"").split(/[;,\/]/).forEach(function(x){ var q=/(?:(L\.?\s?[SA])\.?\s?)?(\d{2,3})\s?[-–]\s?(\d{1,4})/.exec(x); if(q) r.regs.push((q[1]?q[1].replace(/[.\s]/g,"").toUpperCase():sig)+" "+q[2]+"-"+q[3]); });
      }
      RE_PUB.lastIndex=0; while((mm=RE_PUB.exec(s))) r.pubs.push(limpio(mm[0]).replace(/\s?([-–])\s?/g,"$1"));
      RE_EXP.lastIndex=0; while((mm=RE_EXP.exec(s))) r.exps.push(limpio(mm[1]));
      return r;
    }
    function unidad(ini,fin,previo,iniPrevio,contexto){
      var s=texto.slice(ini,fin),pre=previo||"",todo=anclas(s);
      var cars=caratulasEn(s).filter(function(x){ return !esPropia(x.c,car); }),deAntes=false;
      if(!cars.length&&pre){
        // la carátula justo antes del paréntesis: «la CSJN en “Barrientos” (Fallos: 347:1446)»
        // la más cercana al paréntesis: en «Fallos: 327:3753 («Aquino») y en la causa Arostegui… c/ Omega ART S.A. (Fallos 331:570)»
        // el segundo paréntesis es de Arostegui, no de Aquino
        var cp=caratulasEn(pre).concat(caratulasSueltas(pre+" (")).filter(function(x){ return pre.length-x.f<60&&!esPropia(x.c,car); })
          .sort(function(x,y){ return x.f-y.f; });
        if(cp.length){ cars=[{c:cp[cp.length-1].c,i:-(pre.length-cp[cp.length-1].i),f:0}]; deAntes=true; }
        else{
          var mu=/(?:precedente|causa|caso|in\s+re:?|fallo)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+(?:y\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){0,2})\s*$/.exec(pre);
          if(mu){ cars=[{c:mu[1],i:-mu[0].length,f:0}]; deAntes=true; }
        }
      }
      var tr=tribunalEn(s,tipoDoc)||tribunalEn(pre.slice(-160),tipoDoc)||(contexto?tribunalEn(contexto,tipoDoc):null);
      var hayAncla=todo.fallos.length||todo.regs.length||todo.pubs.length||todo.exps.length||todo.fecha||tr;
      if(!hayAncla) return [];
      // los tramos de cada cita: de una carátula a la siguiente
      var partes=[];
      if(cars.length&&!deAntes){
        cars.forEach(function(x,k){ var a2=k?x.i:0,b2=k+1<cars.length?cars[k+1].i:s.length; partes.push({c:x.c,a:a2,b:b2,ini:ini+x.i}); });
      }else if(cars.length){
        partes.push({c:cars[0].c,a:0,b:s.length,ini:iniPrevio+(pre.length+cars[0].i)});
      }else if(todo.fallos.length>1&&!todo.regs.length){
        // «Fallos 334:1821; 332:2159; 330:563»: cada uno es un fallo distinto
        return todo.fallos.map(function(f){ return completar({caratula:null,fecha:null,expediente:null,publicaciones:["Fallos "+f]},ini,fin,false); });
      }else if(todo.fallos.length||todo.regs.length||todo.pubs.length){
        partes.push({c:null,a:0,b:s.length,ini:ini});
      }else return [];
      function completar(r,desde,hasta,deAntes2){
        var fallosR=r.publicaciones.some(function(x){ return /^Fallos/.test(x); });
        if(tr){ r.tipo=tr.tipo; r.tribunal=tr.tribunal; }
        else if(fallosR){ r.tipo="csjn"; r.tribunal=PROPIO.csjn; }
        else{
          var pr=tribunalPropioEn(texto.slice(Math.max(0,ini-700),fin),tipoDoc);
          if(pr){ r.tipo=pr.tipo; r.tribunal=pr.tribunal; r.certeza="probable"; r.regla="tribunal-propio-por-contexto"; }
          else if(r.caratula&&(r.fecha||r.expediente)&&PROPIO[tipoDoc]){ r.tipo=tipoDoc==="csjn"?"csjn":"provincial"; r.tribunal=PROPIO[tipoDoc]+" (no lo dice: se deduce)"; r.certeza="no_confirmado"; r.regla="sin-tribunal-expreso"; }
          else if(r.caratula&&!r.fecha&&!r.expediente&&!r.publicaciones.length){ r.tipo="otra_decision"; r.tribunal=null; }
          else { r.tipo="no_clasificable"; r.tribunal=null; }
        }
        r.certeza=r.certeza||(r.tipo==="no_clasificable"||r.tipo==="otra_decision"?"no_confirmado":"confirmado");
        r.regla=r.regla||(fallosR?"coleccion-fallos":r.publicaciones.some(function(x){ return /^L[SA] /.test(x); })?"registro-ls-la":deAntes2?"caratula-antes-de-la-cita":"unidad-de-cita");
        r.evidencia=evid(texto,Math.max(0,desde),hasta,deAntes2?0:40,20);
        r.funcion=funcionDe(Math.max(0,desde),r.caratula);
        return r;
      }
      return partes.map(function(pt){
        var sub=s.slice(pt.a,pt.b),an=partes.length>1?anclas(sub):todo;
        var r={caratula:pt.c,fecha:an.fecha,expediente:an.exps[0]||null,publicaciones:an.fallos.map(function(f){ return "Fallos "+f; }).concat(an.regs,an.pubs)};
        return completar(r,pt.ini,partes.length>1?ini+pt.b:fin,deAntes);
      });
    }
    /* 1. paréntesis (los de afuera) y sus tramos separados por «;» */
    var cubiertos=[];
    for(var i=inicioCuerpo;i<texto.length;i++){
      if(texto.charAt(i)!=="(") continue;
      var prof=0,j=i,enCom=false;
      for(;j<texto.length&&j-i<900;j++){
        var ch=texto.charAt(j);
        if(ch==="(") prof++;
        else if(ch===")"){ prof--; if(!prof) break; }
      }
      if(prof) continue;
      var interior=texto.slice(i+1,j);
      if(interior.length<3){ i=j; continue; }
      // doctrina: autor + obra + editorial, sin marcas de jurisprudencia
      var autorAl=/^\s*(?:conf\.|cfr\.|ver|v\.)?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?),\s*(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+|[A-ZÁÉÍÓÚÑ]\.)(?:\s+(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+|[A-ZÁÉÍÓÚÑ]\.))*\s*,/.exec(interior);
      var sinMarcasJuris=!/\bc\/|\bs\/|Fallos\s*:?\s*\d|\bExpte|\bCUIJ|\bL\.?\s?S\.?\s?\d|\b(?:CSJN|SCJM|SCBA|TSJ|CNAT|CNAC)\b/.test(interior);
      var pareceObra=/Ed\.|Editorial|Abeledo|Rubinzal|Astrea|Hammurabi|Revista|Tratado|\bpág\.|\bp\.\s?\d|Baremo/.test(interior)||(autorAl&&(/[“"«][^”"»]{3,}[”"»]/.test(interior)||RE_PUB.test(interior)||/\b(?:19|20)\d{2}\b/.test(interior)));
      RE_PUB.lastIndex=0;
      if(pareceObra&&sinMarcasJuris){
        var au=autorAl?{1:autorAl[1]}:/^\s*([A-ZÁÉÍÓÚÑ][^,“"«(]{2,60})/.exec(interior),ti=/[“"«]([^”"»]{3,220})[”"»]/.exec(interior);
        if(!ti&&autorAl){ var resto=interior.slice(autorAl[0].length).split(",")[0]; if(resto&&resto.trim().length>2) ti={1:resto}; }
        // «(Llambias, Tratado de Derecho Civil, Obligaciones, Abeledo Perrot…)»: el título es el segundo campo
        if(!ti&&!autorAl){ var campos=interior.split(","); if(campos.length>2&&/^\s*[A-ZÁÉÍÓÚÑ][^\d]{3,120}$/.test(campos[1])) ti={1:campos[1]}; }
        nuevo({tipo:"doctrina",caratula:ti?limpio(ti[1]):null,autor:au?limpio(au[1]):null,tribunal:null,fecha:null,expediente:null,
          evidencia:evid(texto,i,j+1,0,0),regla:"cita-de-obra",certeza:"probable",funcion:"citado"});
        cubiertos.push([i,j]); i=j; continue;
      }
      // tramos por «;» fuera de comillas
      var tramos=[],k0=0,dentroC=false;
      for(var k=0;k<interior.length;k++){
        var c2=interior.charAt(k);
        if(Q_AB.indexOf(c2)>=0&&c2!=="\"") dentroC=true; else if(Q_CI.indexOf(c2)>=0&&c2!=="\"") dentroC=false; else if(c2==="\"") dentroC=!dentroC;
        if(c2===";"&&!dentroC){ tramos.push([k0,k]); k0=k+1; }
      }
      tramos.push([k0,interior.length]);
      var previo=texto.slice(Math.max(0,i-200),i),cortes=previo.search(/[.;]\s+(?=[A-ZÁÉÍÓÚÑ])(?![\s\S]*[.;]\s+[A-ZÁÉÍÓÚÑ])/);
      if(cortes>=0&&!/(?:Dr|Sr|art|arts|inc|fs|n|nro|cfr|conf)$/i.test(previo.slice(0,cortes))) previo=previo.slice(cortes+1);
      var anterior=null;
      tramos.forEach(function(tm,idx){
        var a=i+1+tm[0],b=i+1+tm[1],seg=texto.slice(a,b);
        // números de registro sueltos que siguen a una carátula o a otro registro
        if(anterior&&/^\s*(?:L\.?\s?[SA]\.?\s?)?\d{2,3}\s?[-–]\s?\d{1,4}\s*$/.test(seg)){
          var q=/(?:(L\.?\s?[SA])\.?\s?)?(\d{2,3})\s?[-–]\s?(\d{1,4})/.exec(seg);
          var ultimo=anterior.publicaciones.filter(function(x){ return /^L[SA] /.test(x); }).pop();
          anterior.publicaciones.push((q[1]?q[1].replace(/[.\s]/g,"").toUpperCase():(ultimo?ultimo.slice(0,2):"LS"))+" "+q[2]+"-"+q[3]);
          return;
        }
        var fs2=/^\s*(\d{2,3})\s*:\s*(\d{1,5})\s*$/.exec(seg);
        if(fs2&&anterior&&anterior.publicaciones.some(function(x){ return /^Fallos/.test(x); })){
          anterior=nuevo({tipo:"csjn",caratula:null,tribunal:PROPIO.csjn,fecha:null,expediente:null,publicaciones:["Fallos "+fs2[1]+":"+fs2[2]],
            evidencia:evid(texto,a,b,0,0),regla:"coleccion-fallos",certeza:"confirmado",funcion:"citado"});
          return;
        }
        var us=unidad(a,b,idx===0?previo:"",i-previo.length,tramos.length>1?interior:null);
        // un tramo sin carátula que sólo trae registro/publicación, pegado a la cita anterior, se suma a ella
        if(us.length===1&&!us[0].caratula&&anterior&&!us[0].expediente){ anterior.publicaciones=anterior.publicaciones.concat(us[0].publicaciones); if(!anterior.fecha) anterior.fecha=us[0].fecha; return; }
        us.forEach(function(u){ anterior=nuevo(u); });
      });
      // «(“Cinquemani...” del 20.03.2018) (LS 350-101)»: el paréntesis siguiente sólo con registro
      cubiertos.push([i,j]); i=j;
    }
    // unir paréntesis consecutivos de una misma cita
    for(var x=out.length-1;x>0;x--){
      var A=out[x-1],B=out[x];
      if(!B.caratula&&A.caratula&&B.tipo!=="doctrina"&&A.tipo!=="doctrina"&&B.evidencia.ini-A.evidencia.fin<12&&!B.expediente){
        A.publicaciones=A.publicaciones.concat(B.publicaciones); out.splice(x,1);
      }
    }
    /* 2. citas en línea, fuera de los paréntesis */
    function cubierto(p){ return cubiertos.some(function(c){ return p>=c[0]&&p<=c[1]; }); }
    var reLinea=/(?:precedentes?|causa|caso|in\s+re\s*:?|plenario|fallo\s+plenario[^“"«]{0,40}|lo\s+resuelto\s+(?:por\s+este\s+Tribunal\s+)?en|criterio\s+sentado\s+en|doctrina\s+de|expediente|autos)\s*(?:n[°º]\s*\d+\s*)?(?:de\s+la\s+[^“"«]{3,70}?,?\s*)?[“"«]\s*([^”"»“«]{1,330}?)\s*[”"»]|[“"«]\s*([^”"»“«]{1,330}?)\s*[”"»]\s*(?=,?\s*(?:[-–]\s*)?(?:del?\s+\d|sentencia\s+de|resoluci[oó]n\s+del|expte|Expte|de\s+fecha|\(\s*(?:sentencia|Fallos|LS|L\.S|expte)))/g;
    while((m=reLinea.exec(texto))){
      if(m.index<inicioCuerpo||cubierto(m.index)) continue;
      var nombre=m[1]||m[2];
      if(!esCaratula(nombre)||esPropia(nombre,car)) continue;
      if(/caratulad[oa]s?\s*:?\s*$/i.test(texto.slice(Math.max(0,m.index-30),m.index))) continue;
      var cola=texto.slice(m.index+m[0].length,m.index+m[0].length+220);
      var colaCorta=cola.split(/[.;](?=\s+[A-ZÁÉÍÓÚÑ(“"«¿])/)[0];
      // fecha y expediente: sólo los pegados a la carátula (coma, «del…», o el paréntesis que sigue)
      var pegadoF=/^\s*(?:\([^)]{0,120}\)|[,–-]?\s*(?:del?\s+|de\s+fecha\s+|sentencia\s+del?\s+|resoluci[oó]n\s+del\s+)?[^;()“"«]{0,110})/.exec(colaCorta);
      var s2=m[0]+colaCorta,fe=fechaEn(pegadoF?pegadoF[0]:""),exs=[],me;
      RE_EXP.lastIndex=0; while((me=RE_EXP.exec(pegadoF?pegadoF[0]:""))) exs.push(limpio(me[1]));
      var pegado=/^\s*[,(]\s*[^;.]{0,60}/.exec(colaCorta),antes2=texto.slice(Math.max(0,m.index-120),m.index);
      antes2=antes2.slice(Math.max(0,antes2.search(/[.;]\s+[A-ZÁÉÍÓÚÑ](?![\s\S]*[.;]\s+[A-ZÁÉÍÓÚÑ])/)));
      var tr2=tribunalEn(antes2+" "+(pegado?pegado[0]:""),tipoDoc);
      var nm=limpiarCaratula(nombre),r2={caratula:nm,fecha:fe,expediente:exs[0]||null,publicaciones:[]};
      if(tr2){ r2.tipo=tr2.tipo; r2.tribunal=tr2.tribunal; r2.certeza="confirmado"; }
      else{
        var pr2=tribunalPropioEn(texto.slice(Math.max(0,m.index-400),m.index+m[0].length),tipoDoc);
        if(pr2){ r2.tipo=pr2.tipo; r2.tribunal=pr2.tribunal; r2.certeza="probable"; }
        else if(fe||exs.length){ r2.tipo=PROPIO[tipoDoc]?(tipoDoc==="csjn"?"csjn":"provincial"):"no_clasificable"; r2.tribunal=PROPIO[tipoDoc]?PROPIO[tipoDoc]+" (no lo dice: se deduce)":null; r2.certeza="no_confirmado"; }
        else { r2.tipo="otra_decision"; r2.tribunal=null; r2.certeza="no_confirmado"; }
      }
      r2.regla="cita-en-linea"; r2.evidencia=evid(texto,m.index,m.index+m[0].length,40,80); r2.funcion=funcionDe(m.index,nm);
      nuevo(r2);
    }
    // «el precedente Barrientos de la CSJN», sin comillas
    var reNom=/\b(?:el\s+precedente|la\s+causa|el\s+caso|in\s+re)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+(?:y\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){0,2})(?=\s+(?:de\s+(?:la\s+)?(?:CSJN|Corte|este\s+Tribunal|esta\s+Corte)|del\s+\d|\(|,))/g;
    while((m=reNom.exec(texto))){
      if(m.index<inicioCuerpo||cubierto(m.index)) continue;
      var tr3=tribunalEn(texto.slice(m.index,m.index+m[0].length+40),tipoDoc)||tribunalPropioEn(texto.slice(Math.max(0,m.index-300),m.index+80),tipoDoc);
      nuevo({caratula:m[1],tipo:tr3?tr3.tipo:"otra_decision",tribunal:tr3?tr3.tribunal:null,fecha:fechaEn(texto.slice(m.index,m.index+m[0].length+30)),expediente:null,publicaciones:[],
        evidencia:evid(texto,m.index,m.index+m[0].length,40,60),regla:"precedente-nombrado-sin-comillas",certeza:tr3?"probable":"no_confirmado",funcion:funcionDe(m.index,m[1])});
    }
    // «in re Pérez, Juan c/ López, Ana s/ daños», «y en GÓMEZ MARÍA ELENA 05/06/2020», fuera de paréntesis
    var reAviso=/(?:\bin\s+re\s*:?|\bcausas?\b|\bautos\b|\bcaso\b|\bprecedentes?\b|\blo\s+resuelto\s+(?:por\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+)?en\b|\b(?:y\s+)?en\b|\bcfr\.?|\bconf\.?)\s+(?=[A-ZÁÉÍÓÚÑ])/g;
    while((m=reAviso.exec(texto))){
      var p0=m.index+m[0].length;
      if(p0<inicioCuerpo||cubierto(p0)) continue;
      var tramo=texto.slice(p0,p0+340),fuerte=!/^(?:y\s+)?en\s+$/i.test(m[0]);
      var cs=fuerte?caratulasSueltas(tramo).filter(function(x){ return x.i<3; }):[];
      var mayus=/^((?:[A-ZÁÉÍÓÚÑ]{3,})(?:\s+(?:[A-ZÁÉÍÓÚÑ]{2,}|DE|DEL|Y)){1,6})\s*,?\s*(?:del?\s+)?(\d{1,2}\s?[\/.\-]\s?\d{1,2}\s?[\/.\-]\s?\d{2,4})/.exec(tramo);
      var nombreS=null,finS=0;
      if(cs.length&&!esPropia(cs[0].c,car)){ nombreS=cs[0].c; finS=cs[0].f; }
      else if(mayus&&!/\b(?:CSJN|SCJM|SCBA|TSJ|LEY|FALLOS|SALA|CNAT|CNAC|EXPTE|CUIJ|ART|DR|DRA|MENDOZA)\b/.test(mayus[1])){ nombreS=capitalizarFrase(mayus[1]); finS=mayus[0].length; }
      if(!nombreS) continue;
      var colaS=texto.slice(p0+finS,p0+finS+160),an=anclas(texto.slice(p0,p0+finS)+(/^\s*\(/.test(colaS)?colaS.slice(0,colaS.indexOf(")")+1):colaS.split(/[.;](?=\s)/)[0].slice(0,80)));
      // el tribunal: lo que antecede en la misma oración y, después, sólo un paréntesis o una coma pegados
      var antesS=texto.slice(Math.max(0,m.index-140),p0);
      antesS=antesS.slice(Math.max(0,antesS.search(/[.;]\s+[A-ZÁÉÍÓÚÑ](?![\s\S]*[.;]\s+[A-ZÁÉÍÓÚÑ])/)));
      var pegadoS=/^\s*(?:\([^)]{0,80}\)|,[^,.;]{0,50})/.exec(colaS);
      var trS=tribunalEn(antesS+" "+texto.slice(p0,p0+finS)+" "+(pegadoS?pegadoS[0]:""),tipoDoc)||tribunalPropioEn(texto.slice(Math.max(0,m.index-300),p0+finS),tipoDoc);
      if(!trS&&!an.fecha&&!an.fallos.length&&!an.regs.length&&!an.exps.length&&!/precedente|in\s+re|causa/.test(m[0])) continue;
      nuevo({caratula:nombreS,tipo:trS?trS.tipo:(an.fallos.length?"csjn":"otra_decision"),tribunal:trS?trS.tribunal:(an.fallos.length?PROPIO.csjn:null),fecha:an.fecha,expediente:an.exps[0]||null,
        publicaciones:an.fallos.map(function(f){ return "Fallos "+f; }).concat(an.regs,an.pubs),evidencia:evid(texto,p0,p0+finS,40,60),
        regla:"caratula-sin-comillas",certeza:trS?"probable":"no_confirmado",funcion:funcionDe(p0,nombreS)});
    }
    // «Fallos: 327:3753 («Aquino»)» o «el precedente de Fallos: 324:1528», fuera de paréntesis
    RE_FALLOS.lastIndex=0;
    while((m=RE_FALLOS.exec(texto))){
      if(m.index<inicioCuerpo||cubierto(m.index)) continue;
      var lista=[m[1]+":"+m[2]];
      (m[3]||"").split(/[;,]|\by\b/).forEach(function(x){ var q=/(\d{2,3})\s*:\s*(\d{1,5})/.exec(x); if(q) lista.push(q[1]+":"+q[2]); });
      var sigue=/^\s*\(\s*[“"«]\s*([^”"»]{2,120}?)\s*[”"»]\s*\)/.exec(texto.slice(m.index+m[0].length,m.index+m[0].length+140));
      lista.forEach(function(f,k){
        nuevo({caratula:k===0&&sigue&&esCaratula(sigue[1])?limpiarCaratula(sigue[1]):null,tipo:"csjn",tribunal:PROPIO.csjn,fecha:null,expediente:null,publicaciones:["Fallos "+f],
          evidencia:evid(texto,m.index,m.index+m[0].length,60,40),regla:"coleccion-fallos",certeza:"confirmado",funcion:funcionDe(m.index,null)});
      });
    }
    /* 3. unir las menciones de un mismo precedente («Barrientos» y «Barrientos,
       Gabriel Alexandra...»; «Medina» y «MEDINA»; los mismos Fallos) */
    function clave(c){ return plano(c||"").replace(/\.{2,}|…/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim(); }
    function mismo(a,b){
      if(a.tipo==="doctrina"||b.tipo==="doctrina") return a.tipo===b.tipo&&a.evidencia.ini===b.evidencia.ini;
      var pa=a.publicaciones.filter(function(x){ return /^Fallos/.test(x); }),pb=b.publicaciones.filter(function(x){ return /^Fallos/.test(x); });
      if(pa.length&&pb.length&&pa.some(function(x){ return pb.indexOf(x)>=0; })) return true;
      if(pa.length&&pb.length) return false;
      if(!a.caratula||!b.caratula) return false;
      var ka=clave(a.caratula),kb=clave(b.caratula);
      if(!ka||!kb) return false;
      var corta=ka.length<=kb.length?ka:kb,larga=ka.length<=kb.length?kb:ka;
      if(larga.indexOf(corta)===0&&(larga.length===corta.length||/^[ ,]/.test(larga.charAt(corta.length)))) return !(a.fecha&&b.fecha&&a.fecha!==b.fecha);
      return false;
    }
    var unidos=[];
    out.forEach(function(p){
      var q=unidos.filter(function(u){ return mismo(u,p); })[0];
      if(!q){ unidos.push(p); return; }
      if(p.caratula&&(!q.caratula||p.caratula.length>q.caratula.length)) q.caratula=p.caratula;
      ["fecha","expediente","autor"].forEach(function(k){ if(!q[k]&&p[k]) q[k]=p[k]; });
      p.publicaciones.forEach(function(x){ if(q.publicaciones.indexOf(x)<0) q.publicaciones.push(x); });
      if(/distinguido/.test(p.funcion)) q.funcion=p.funcion;
      var rango={csjn:5,provincial:4,otro_tribunal:4,otra_decision:1,no_clasificable:0};
      var qDebil=q.certeza!=="confirmado"||q.tipo==="otra_decision"||q.tipo==="no_clasificable";
      if(qDebil&&((p.certeza==="confirmado"&&p.tipo!=="otra_decision")||(rango[p.tipo]||0)>(rango[q.tipo]||0))){ q.tipo=p.tipo; q.tribunal=p.tribunal; q.certeza=p.certeza; }
      (q.otrasMenciones=q.otrasMenciones||[]).push(p.evidencia);
    });
    unidos.forEach(function(p){ p.publicacion=p.publicaciones.length?p.publicaciones.join("; "):null; });
    unidos.sort(function(a,b){ return a.evidencia.ini-b.evidencia.ini; });
    return unidos;
  }

  /* ---------- contexto de cada norma citada ---------- */
  function contextoDe(texto,sec,pos){
    var or=oracion(texto,pos),po=plano(or.texto);
    if(/regul\w*\s+(?:los\s+)?honorarios|honorarios\s+profesionales|\bley\s+9\.?131\b|arancel/.test(po)) return "honorarios";
    if(/costas/.test(po)&&/impon|orden\s+causado|vencid/.test(po)) return "costas";
    if(dentro(sec.resolutiva,pos)) return "resolutiva";
    return "fundamentos";
  }

  var ultimo={texto:null,car:null,res:null};
  function analizar(texto,opciones){
    opciones=opciones||{};
    texto=String(texto||"");
    if(ultimo.texto===texto&&ultimo.car===(opciones.car||null)) return ultimo.res;
    var sec=secciones(texto);
    var pers=analizarPersonas(texto,sec);
    var res={
      secciones:sec,
      personas:pers.personas,votos:pers.votos,adhesiones:pers.adhesiones,noSuscriben:pers.noSuscriben,firmas:pers.firmas,
      votacion:estadoVotacion(texto,pers,sec),
      partes:analizarPartes(texto,opciones.car||null),
      montos:analizarMontos(texto,sec,pers),
      incapacidad:analizarIncapacidad(texto),
      decision:analizarDecision(texto,sec,pers),
      precedentes:analizarPrecedentes(texto,opciones.tipo||null,opciones.car||null),
      contextoDe:function(pos){ return contextoDe(texto,sec,pos); }
    };
    ultimo={texto:texto,car:opciones.car||null,res:res};
    return res;
  }
  return {analizar:analizar,mismaPersona:mismaPersona,nombreVisible:nombreVisible,plano:plano,limpio:limpio};
})();

/* ============================================================
   IVSLexia — el razonamiento de Lexia sobre el fallo abierto.
   ============================================================
   Determinista, sin IA externa: entiende la pregunta (qué se pide y sobre
   quién o qué: un magistrado, un artículo, un agravio, una instancia),
   la descompone si pide varias cosas («¿quién ganó y cuánto?») y busca la
   respuesta en el lugar del fallo donde corresponde (el voto de ese juez,
   el apartado de ese agravio, la parte resolutiva). Cuando no hay una regla
   puntual, ordena las ORACIONES del fallo por BM25 con el peso de la
   sección en la que están. Todo devuelve el pasaje con su posición. */
var IVSLexia=(function(){
  var plano=IVSAnalisis.plano,limpio=IVSAnalisis.limpio;
  var VACIAS={};
  ("de del la las el los lo un una unos unas y o u e a al en con sin por para que se su sus le les es son fue fueron ser sido era este esta estos estas ese esa esos esas aquel "+
   "como cual cuales cuando donde quien quienes cuanto cuanta cuantos cuantas porque pero mas muy ya no si sobre entre hasta desde hacia segun tambien "+
   "me mi te tu nos hay hubo habia tiene tienen tuvo dijo dice dicen decia fallo sentencia caso autos tema algo puede podes podria "+
   "explicame decime contame quiero saber pregunta respecto acerca parte partes esto eso ello aqui alli ahi asi tal tan otro otra otros otras").split(" ").forEach(function(w){ VACIAS[w]=1; });

  /* Intenciones, por prioridad. Cada una toma su tramo de la pregunta: dos
     intenciones que reclaman las mismas palabras no se suman («cuánto cobró
     el perito» es honorarios, no además montos). */
  var INTENCIONES=[
    ["resumen",/explic|resum|sintesis|de que (se )?trata|que (paso|dice el fallo|dice este fallo)|contame|cuenta(me)? el fallo|en pocas palabras|de que va|analiz|que es este fallo|que resolvio y por que/],
    ["instancia",/primera instancia|juez(a)? de (grado|primera)|jueza? de origen|a quo|aquo|sentencia (recurrida|apelada|impugnada|de grado|de primera|de camara|anterior)|tribunal (de grado|inferior|anterior)|(dijo|resolvio|decidio|sostuvo|considero|entendio|hizo|fallo|opino|condeno|rechazo) (el|la) (camara|alzada|juez|jueza|juzgado|sentenciante|tribunal de grado)|(la|el) (camara|alzada|juzgado) (dijo|resolvio|decidio|sostuvo|considero|entendio|hizo|fallo|condeno|rechazo|confirmo|revoco)|instancias? anterior/],
    ["votos",/disiden|unanim|voto|votaron|jueces|jueza|juez|magistrad|ministr|quien(es)? firm|quien(es)? (lo )?(fallaron|resolvieron|dictaron)|integr|mayoria|coincid/],
    ["honorarios",/honorario|regul(o|aron|acion)|cuanto (cobr|se le pag)|perito/],
    ["costas",/costas|quien (paga|carga con|soporta) (los )?(gastos|el juicio|el proceso)|gastos del (juicio|proceso)/],
    ["intereses",/interes|\btasa|desde cuando corren|actualiza|indexa|desvaloriz|repotenci/],
    ["incapacidad",/incapacidad|balthazar|capacidad restante|porcentaje/],
    ["porque",/por ?que|fundament|razon|motivo|argument|en que se (bas|fund|apoy)|como (lo )?justific|criterio/],
    ["agravios",/agravi|que (se )?(planteo|cuestiono|pidio|reclamo) (el|la) (recurrente|apelante|actor|actora|demandad[oa])|que se cuestiona|que (se )?recurri/],
    ["decision",/resolv|decidi|gano|perdio|fallo final|parte dispositiva|resultado|hizo lugar|hace lugar|rechaz|confirm|revoc|que dispuso|como termino|prosper|admiti/],
    ["montos",/cuanto|monto|indemniz|suma|pesos|\$|dinero|plata|importe|condena(ron)? a pagar|capital/],
    ["precedentes",/precedente|jurisprudencia|fallos cita|que fallos|antecedente|doctrina/],
    ["normas",/norma|articulo|\bart\b|leyes|\bley\b|codigo|que se aplic/],
    ["partes",/partes|actor|actora|demandad|quien demand|contra quien|quienes son|recurrente|recurrido|aseguradora|citad[ao] en garantia/],
    ["fecha",/fecha|cuando|que dia|que ano/],
    ["tribunal",/tribunal|que corte|que camara|quien lo dicto|quien dicto|que juzgado|\bsala\b/]
  ];
  function intenciones(p){
    var q=plano(p).replace(/[¿?¡!.,;:()«»“”"]/g," ").replace(/\s+/g," "),tomados=[],out=[];
    INTENCIONES.forEach(function(it){
      var re=new RegExp(it[1].source,"g"),m;
      while((m=re.exec(q))){
        var a=m.index,b=a+Math.max(1,m[0].length);
        if(!tomados.some(function(t){ return a<t[1]&&b>t[0]; })){ tomados.push([a,b]); if(out.indexOf(it[0])<0) out.push(it[0]); }
        if(!m[0].length) re.lastIndex++;
      }
    });
    // el orden de la respuesta: el de la pregunta
    return out.map(function(n){ var t=tomados[out.indexOf(n)]; return {n:n,a:t?t[0]:0}; }).sort(function(x,y){ return x.a-y.a; }).map(function(x){ return x.n; });
  }

  /* ---------- oraciones y secciones ---------- */
  var ABREV=/(?:^|[\s(])(?:arts?|incs?|fs|fjs|dr|dra|dres|dras|sr|sra|sres|sras|nro|nros|n|cfr|conf|cf|cit|ss|sgtes|p|pag|pags|ap|apart|cap|ib|ibid|op|vid|v|etc|cc|t|vol|ed|ll|ja|ed|exp|expte|mat|lic|ing|esc|ptos?|pto|tit|sec|cpo|ref|n[°º]|nros?[°º]?|bs)$/i;
  var cacheOr={texto:null,res:null};
  /* Dónde empiezan los fundamentos: el primer voto, o antes, el rótulo
     «Fundamentos:» / «CONSIDERANDO» (en el TSJ el voto de la mayoría va sin
     encabezado propio, y antes está el relato de las instancias anteriores). */
  function inicioFundamentos(texto,A){
    var v0=A&&A.votos&&A.votos.length?A.votos[0].ini:Math.floor(texto.length*.15);
    var m=/(?:^|\n|\.\s)\s*(Fundamentos\s*:|FUNDAMENTOS\s*:|CONSIDERANDO\s*:?|Considerando\s*:)/.exec(texto.slice(0,v0));
    return m?m.index+m[0].indexOf(m[1]):v0;
  }
  function oraciones(texto,A){
    if(cacheOr.texto===texto) return cacheOr.res;
    var out=[],re=/[.;!?]["”’»)]*(?=\s+["“‘«(¿]*[A-ZÁÉÍÓÚÑ0-9])|\n\s*\n/g,m,ini=0;
    var f0=inicioFundamentos(texto,A);
    function zona(pos){
      var s=A&&A.secciones;
      if(s&&s.firmas&&pos>=s.firmas.ini) return "firmas";
      if(s&&s.resolutiva&&pos>=s.resolutiva.ini) return "resolutiva";
      return pos<f0?"encabezado":"fundamentos";
    }
    function push(a,b){
      var t=texto.slice(a,b),l=t.replace(/\s+/g," ").trim();
      if(l.length<3) return;
      var a2=a+(t.length-t.replace(/^\s+/,"").length);
      out.push({t:l,ini:a2,fin:b,zona:zona(a2)});
    }
    while((m=re.exec(texto))){
      var fin=m.index+m[0].length;
      if(m[0].charAt(0)!=="\n"){
        var antes=texto.slice(Math.max(ini,m.index-12),m.index);
        // abreviaturas («art.», «fs.», «Dr.») e iniciales («Julio B. J. Maier») no cierran la oración
        if(m[0].charAt(0)==="."&&(ABREV.test(antes)||/(?:^|[\s.])[A-ZÁÉÍÓÚÑ]$/.test(antes))) continue;
        if(fin-ini<25&&m[0].charAt(0)!==";") continue;
        // dentro de un paréntesis abierto (una cita de doctrina o de un fallo) la oración sigue
        var seg=texto.slice(ini,m.index);
        if(seg.length<900&&(seg.match(/\(/g)||[]).length>(seg.match(/\)/g)||[]).length) continue;
      }
      push(ini,fin); ini=fin;
    }
    push(ini,texto.length);
    // una oración muy larga se parte en sus «;»
    var res=[];
    out.forEach(function(o){
      if(o.t.length<=700){ res.push(o); return; }
      var cuerpo=texto.slice(o.ini,o.fin),r2=/;\s+/g,mm,a=0;
      while((mm=r2.exec(cuerpo))) if(mm.index-a>200){ res.push({t:limpio(cuerpo.slice(a,mm.index+1)),ini:o.ini+a,fin:o.ini+mm.index+1,zona:o.zona}); a=mm.index+mm[0].length; }
      res.push({t:limpio(cuerpo.slice(a)),ini:o.ini+a,fin:o.fin,zona:o.zona});
    });
    res.forEach(function(o,i){ o.i=i; });
    cacheOr={texto:texto,res:res};
    return res;
  }

  /* ---------- términos y sinónimos ---------- */
  function raiz(w){
    w=w.replace(/(aciones|iciones|amientos|imientos)$/,"ac").replace(/(es|s)$/,"");
    return w.length>6?w.slice(0,6):w;
  }
  function terminos(s){
    return plano(s).split(/[^a-z0-9ñ]+/).filter(function(w){ return w.length>=3&&!VACIAS[w]&&!/^\d{1,2}$/.test(w); });
  }
  // equivalencias del lenguaje de los fallos (la pregunta suele usar la palabra común)
  var SINONIMOS=[
    ["dano moral","consecuencias no patrimoniales","dano extrapatrimonial","agravio moral"],
    ["despido","distracto","extincion del contrato","desvinculacion"],
    ["indemnizacion","resarcimiento","reparacion"],
    ["intereses","tasa","interes moratorio"],
    ["costas","gastos causidicos"],
    ["incapacidad","invalidez","minusvalia","secuelas"],
    ["lucro cesante","perdida de ganancias"],
    ["seguro","aseguradora","citada en garantia","poliza","asegurador"],
    ["accidente","siniestro","hecho danoso","evento danoso"],
    ["arbitrariedad","arbitraria","arbitrario","absurdo"],
    ["prescripcion","prescripto","prescripta"],
    ["apelacion","alzada","camara"],
    ["juez de grado","a quo","primera instancia","sentenciante"],
    ["actualizacion","indexacion","repotenciacion","desvalorizacion","uva","ripte","cer"],
    ["multa","sancion","agravamiento indemnizatorio"],
    ["caso constitucional","cuestion federal","garantia constitucional"]
  ];
  function expandir(p){
    var q=" "+plano(p).replace(/[^a-z0-9ñ ]+/g," ").replace(/\s+/g," ")+" ",extra=[];
    SINONIMOS.forEach(function(g){ if(g.some(function(x){ return q.indexOf(" "+x+" ")>=0||q.indexOf(" "+x.split(" ")[0]+" ")>=0&&x.indexOf(" ")<0; })) g.forEach(function(x){ extra.push(x); }); });
    return extra;
  }

  /* ---------- BM25 por oración, con el peso de la sección ---------- */
  var PESO_ZONA={encabezado:.85,fundamentos:1,resolutiva:1.15,firmas:.15};
  function rankear(texto,A,pregunta,opciones){
    opciones=opciones||{};
    var ors=oraciones(texto,A).filter(function(o){ return (!opciones.rangos||opciones.rangos.some(function(r){ return o.ini>=r[0]&&o.ini<r[1]; }))&&(!opciones.excluir||!opciones.excluir.test(plano(o.t))); });
    if(!ors.length) return [];
    var base=terminos(pregunta).map(raiz),sin=[],frases=[];
    expandir(pregunta).forEach(function(x){ var ts=terminos(x).map(raiz); if(ts.length>1) frases.push(ts.join(" ")); terminos(x).forEach(function(w){ var r=raiz(w); if(base.indexOf(r)<0&&sin.indexOf(r)<0) sin.push(r); }); });
    (opciones.extra||[]).forEach(function(w){ var r=raiz(plano(w)); if(base.indexOf(r)<0&&sin.indexOf(r)<0) sin.push(r); });
    var q=[];base.forEach(function(r){ if(q.indexOf(r)<0) q.push(r); });
    if(!q.length&&!sin.length) return [];
    var docs=ors.map(function(o){ return terminos(o.t).map(raiz); }),N=docs.length;
    var avg=docs.reduce(function(a,d){ return a+d.length; },0)/N||1,df={};
    q.concat(sin).forEach(function(r){ df[r]=docs.filter(function(d){ return d.indexOf(r)>=0; }).length; });
    // pares de palabras seguidas de la pregunta («daño moral», «tasa activa»): valen más juntas
    var pares=[];for(var i=0;i+1<base.length;i++) pares.push(base[i]+" "+base[i+1]);
    var res=ors.map(function(o,k){
      var d=docs[k],s=0,dist=0,tf={};
      d.forEach(function(r){ tf[r]=(tf[r]||0)+1; });
      function suma(r,peso){
        if(!tf[r]||!df[r]) return;
        var idf=Math.log(1+(N-df[r]+.5)/(df[r]+.5));
        s+=peso*idf*(tf[r]*2.2)/(tf[r]+1.2*(.25+.75*d.length/avg)); dist++;
      }
      q.forEach(function(r){ suma(r,1); });
      sin.forEach(function(r){ suma(r,.8); });
      var j=" "+d.join(" ")+" ";
      pares.forEach(function(pp){ if(j.indexOf(" "+pp+" ")>=0) s*=1.35; });
      // la expresión equivalente entera («consecuencias no patrimoniales» por «daño moral») cuenta como la de la pregunta
      frases.forEach(function(f){ if(j.indexOf(" "+f+" ")>=0){ s*=1.35; dist++; } });
      // cubrir más términos distintos de la pregunta pesa más que repetir uno
      s*=1+.35*Math.max(0,dist-1);
      s*=PESO_ZONA[o.zona]||1;
      if(opciones.preferir&&opciones.preferir.test(plano(o.t))) s*=1.5;
      // transcripciones largas de normas o de otros fallos entre comillas: algo menos
      if(/^["“«]/.test(o.t)) s*=.85;
      if(DESCRIPCION.test(plano(o.t))) s*=.85;
      return {o:o,s:s};
    }).filter(function(x){ return x.s>0; }).sort(function(a,b){ return b.s-a.s; });
    var el=[],n=opciones.n||3;
    for(var k2=0;k2<res.length&&el.length<n;k2++){
      if(el.every(function(x){ return Math.abs(x.o.i-res[k2].o.i)>1; })) el.push(res[k2]);
    }
    return el.map(function(x){ return pasaje(texto,A,x.o,x.s); });
  }
  /* La oración, y la siguiente si la primera es muy corta para entenderse sola. */
  function pasaje(texto,A,o,s){
    var ors=oraciones(texto,A),fin=o.fin,t=o.t;
    // corta para entenderse sola, o termina en «:» (lo que sigue es lo que anuncia)
    if((t.length<160||/:$/.test(t))&&ors[o.i+1]&&ors[o.i+1].zona===o.zona){ fin=ors[o.i+1].fin; t=t+" "+ors[o.i+1].t; }
    return {t:t,ini:o.ini,fin:fin,zona:o.zona,puntaje:s==null?null:+s.toFixed(3)};
  }

  /* ---------- entidades de la pregunta ---------- */
  function tokensPersona(n){ return plano(n).replace(/\./g," ").split(/\s+/).filter(function(w){ return w.length>=3&&!/^(del|las|los|don|dona)$/.test(w); }); }
  function personasEn(p,A){
    var q=" "+plano(p).replace(/[^a-z0-9ñ ]+/g," ").replace(/\s+/g," ")+" ",out=[];
    (A.personas||[]).forEach(function(x){
      var ts=tokensPersona(x.nombre),ap=ts[ts.length-1];
      // el apellido (o cualquiera de los nombres si son de más de 4 letras) como palabra entera
      if(ap&&q.indexOf(" "+ap+" ")>=0||ts.slice(0,-1).some(function(w){ return w.length>4&&q.indexOf(" "+w+" ")>=0&&!VACIAS[w]; })) out.push(x);
    });
    // si nombra a un magistrado, los homónimos que no integran el tribunal no cuentan
    var mags=out.filter(function(x){ return x.esMagistrado; });
    return mags.length?mags:out;
  }
  var NORMAS_ALIAS=[
    [/\b(ccyc|ccycn|codigo civil y comercial|cccn)\b/,/ccyc|civil y comercial/],
    [/\b(codigo civil|cc)\b/,/codigo civil \(derogado\)|codigo civil$/],
    [/\b(lct|contrato de trabajo|20\.?744)\b/,/contrato de trabajo|lct/],
    [/\b(cn|constitucion nacional)\b/,/constitucion nacional/],
    [/\bconstitucion (provincial|de mendoza|de la ciudad)\b/,/constitucion provincial|ccaba/],
    [/\b(ldc|defensa del consumidor|24\.?240)\b/,/consumidor|24\.240/],
    [/\b(cpccn|codigo procesal civil y comercial de la nacion)\b/,/cpccn/],
    [/\b(cpccyt|cpcct|codigo procesal)\b/,/procesal/],
    [/\b(cp|codigo penal)\b/,/codigo penal/],
    [/\b(ls|ley de seguros|17\.?418)\b/,/seguros/],
    [/\b(lrt|riesgos del trabajo|24\.?557)\b/,/riesgos del trabajo|24\.557/],
    [/\b(cayt|ccayt|contencioso administrativo)\b/,/ccayt|cayt/]
  ];
  function articulosEn(p){
    var q=plano(p),re=/\b(?:art(?:iculo)?s?\.?|arts?\b)\s*(\d{1,4}(?:\s*bis)?)(?:\s*(?:,|y|e)\s*(\d{1,4}))*/g,m,out=[];
    while((m=re.exec(q))){
      var nums=m[0].match(/\d{1,4}(?:\s*bis)?/g),resto=q.slice(m.index+m[0].length,m.index+m[0].length+60),norma=null;
      var ley=/^\s*(?:de la |del |de )?ley\s*(?:n[°º.]?\s*)?(\d{1,2}\.?\d{3}|\d{3,5})/.exec(resto);
      if(ley) norma={ley:ley[1].replace(/\./g,"")};
      else NORMAS_ALIAS.some(function(a){ if(a[0].test(resto.slice(0,45))){ norma={re:a[1]}; return true; } return false; });
      nums.forEach(function(n){ out.push({num:n.replace(/\s+/g," "),norma:norma}); });
    }
    return out;
  }
  function citasDelArticulo(d,art){
    var reN=new RegExp("^art\\. "+art.num.replace(" ","\\s*")+"(?![0-9])");
    return (d.citas||[]).filter(function(c){
      if(!reN.test(plano(c.l))) return false;
      if(!art.norma) return true;
      var f=plano(c.f);
      if(art.norma.ley) return f.replace(/\./g,"").indexOf(art.norma.ley)>=0;
      return art.norma.re.test(f);
    });
  }
  var ORDINALES={primer:"a",primero:"a",segundo:"b",tercer:"c",tercero:"c",cuarto:"d",quinto:"e",sexto:"f"};
  var GENERICAS=/^(agravi|recurs|sentenc|aplica|referid|rechazo|inclusi|cuesti|tema|punto|planteo|admiti|rechaz|porque|motivo|razon|fundam|resolv|decidi)/;
  function agravioEn(p,A){
    var ag=(A.decision&&A.decision.agravios)||[];
    if(!ag.length) return null;
    var q=plano(p),m=/agravio\s+([a-h])\b|\b([a-h])\)\s/.exec(q)||null;
    if(m) return ag.filter(function(a){ return a.letra===(m[1]||m[2]); })[0]||null;
    var mo=/\b(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto)\s+agravio/.exec(q);
    if(mo) return ag.filter(function(a){ return a.letra===ORDINALES[mo[1]]; })[0]||null;
    // por el tema, sólo si la pregunta es sobre un agravio («¿por qué se rechazó lo del daño moral?»);
    // «¿qué tasa se aplicó?» pregunta por la tasa, no por el agravio
    if(!/agravi|por ?que|fundament|razon|motivo|planteo|cuestion|queja|admiti|rechaz|prosper|recurrente|apelante/.test(q)) return null;
    var qs=terminos(p).map(raiz).filter(function(r){ return !GENERICAS.test(r); });
    expandir(p).forEach(function(x){ terminos(x).forEach(function(w){ var r=raiz(w); if(qs.indexOf(r)<0&&!GENERICAS.test(r)) qs.push(r); }); });
    var mejor=null,ms=0;
    ag.forEach(function(a){
      var ts=terminos(a.titulo).map(raiz),s=qs.filter(function(r){ return ts.indexOf(r)>=0; }).length;
      if(s>ms){ ms=s; mejor=a; }
    });
    return ms>0?mejor:null;
  }
  function instanciaEn(p){
    var q=plano(p),pr=/primera instancia|juez(a)? de (grado|primera)|juzgado|de origen|sentencia de grado/.test(q),ca=/camara|alzada|apelacion|sala\b/.test(q);
    // las dos, o «el a quo» (la inmediata anterior): todas
    return pr&&!ca?"primera":ca&&!pr?"camara":"anterior";
  }

  /* ---------- rangos: el voto de cada juez, el apartado de cada agravio ---------- */
  function rangoVoto(A,texto,v){
    var sig=(A.votos||[]).filter(function(x){ return x.ini>v.ini; })[0];
    var fin=sig?sig.ini:(A.secciones&&A.secciones.resolutiva?A.secciones.resolutiva.ini:texto.length);
    var k=texto.slice(v.ini,fin).search(/\bAS[IÍ] VOTO\b|\bAs[ií] voto\b/);
    if(k>0) fin=v.ini+k+9;
    // el último voto llega hasta la fórmula que abre la resolutiva («Por ello, … resuelve:»), no la incluye
    var r=texto.slice(v.ini,fin).search(/(?:Por ello|Por lo expuesto|En consecuencia)[^.]{0,260}?\bresuelve\s*:/i);
    if(r>0) fin=v.ini+r;
    return [v.ini,fin];
  }
  function votosDe(A,texto,p){
    return (A.votos||[]).filter(function(v){ return v.persona===p.id; }).map(function(v){ return {voto:v,rango:rangoVoto(A,texto,v)}; });
  }
  function rangoPrincipal(A,texto){
    // el voto de la mayoría sin encabezado (TSJ): de «Fundamentos:» al primer voto con nombre
    var f0=inicioFundamentos(texto,A),v0=A.votos&&A.votos.length?A.votos[0].ini:null;
    if(v0!=null&&v0-f0>800&&!/voto_principal|voto_mayoria/.test(A.votos[0].tipo)) return [f0,v0];
    var vp=(A.votos||[]).filter(function(v){ return /voto_principal|voto_propio|^voto$|voto_mayoria/.test(v.tipo); })[0]||(A.votos||[])[0];
    if(vp) return rangoVoto(A,texto,vp);
    return [Math.floor(texto.length*.15),A.secciones&&A.secciones.resolutiva?A.secciones.resolutiva.ini:texto.length];
  }

  /* ---------- por qué: las razones, no la descripción ---------- */
  var RAZON=/\b(porque|toda vez que|ya que|dado que|puesto que|en tanto|habida cuenta|atento a|atento que|en virtud de|pues\b|por cuanto|en consecuencia|por ello|por lo tanto|de alli que|de ahi que|de modo que|lo que (impone|determina|conduce|lleva)|corresponde|cabe|no se advierte|no advierto|entiendo que|considero que|estimo que|surge que|resulta|se observa|no logra|no demuestra|no acredit|carece de|omiti[oó]|razonabl|arbitrari)/;
  // lo que dice una parte (no el tribunal): «La recurrente sostiene…», «4. Afirma que…», «Señala que…»
  var DESCRIPCION=/^(?:(?:\d+|[ivx]+|[a-h])\s*[.)\-]+\s*)?(?:(?:el|la|los|las) (?:recurrente|apelante|actora?|demandad[oa]|quejos[oa]|compania|aseguradora|citada|parte|accionante|presentante)[^.;]{0,40}? )?(?:se agravia|se queja|sostiene|alega|afirma|argumenta|agrega|cuestiona|denuncia|plantea|considera que|entiende que|senala|expresa|manifiesta|refiere|indica|aduce|invoca|reclama|solicita|pide|critica|insiste|esgrime)\b/;
  var CONCLUYE=/\b(en definitiva|por ello|asi las cosas|en consecuencia|por lo expuesto|por las razones expuestas|entiendo que|considero que|estimo que|corresponde|cabe concluir|se impone|se deduce|de ello se sigue|por lo que|lo que lleva)\b/;
  function entreComillas(t){
    var dentro=0,re=/[“"«]([^”"»]{20,})[”"»]/g,m;
    while((m=re.exec(t))) dentro+=m[1].length;
    var ab=t.search(/[“«]/);
    // comilla que abre y no cierra en la oración: la cita sigue hasta el final
    if(ab>=0&&!/[”»]/.test(t.slice(ab))) dentro+=t.length-ab;
    return dentro/(t.length||1);
  }
  function porQue(texto,A,opciones){
    opciones=opciones||{};
    var rango=opciones.agravio?[opciones.agravio.ini,opciones.agravio.fin]:(opciones.rango||rangoPrincipal(A,texto));
    var ors=oraciones(texto,A).filter(function(o){ return o.ini>=rango[0]&&o.ini<rango[1]&&o.t.length>40; });
    if(!ors.length) return [];
    var tema=opciones.pregunta?rankear(texto,A,opciones.pregunta,{rangos:[rango],n:40}):[],porTema={};
    tema.forEach(function(x){ porTema[x.ini]=x.puntaje; });
    var largo=rango[1]-rango[0];
    var res=ors.map(function(o){
      var pl=plano(o.t),s=0,mm=pl.match(new RegExp(RAZON.source,"g"));
      if(mm) s+=1+.4*(mm.length-1);
      if(DESCRIPCION.test(pl)) s*=.3;
      if(CONCLUYE.test(pl)) s*=1.4;
      // las razones del tribunal suelen estar hacia el cierre del apartado
      s*=.7+.6*((o.ini-rango[0])/(largo||1));
      if(porTema[o.ini]) s*=1+Math.min(2,porTema[o.ini]/3);
      if(/^["“«]/.test(o.t)) s*=.6;
      // una oración que es casi toda una cita textual (de otro fallo o de la ley) explica menos que la conclusión propia
      if(entreComillas(o.t)>.5) s*=.55;
      return {o:o,s:s};
    }).filter(function(x){ return x.s>.5; }).sort(function(a,b){ return b.s-a.s; });
    var el=[];
    for(var k=0;k<res.length&&el.length<(opciones.n||3);k++) if(el.every(function(x){ return Math.abs(x.o.i-res[k].o.i)>1; })) el.push(res[k]);
    return el.sort(function(a,b){ return a.o.ini-b.o.ini; }).map(function(x){ return pasaje(texto,A,x.o,x.s); });
  }

  /* ---------- etapa de lo que dice una oración ---------- */
  function etapaDe(texto,A,o){
    var pl=plano(o.t);
    if(o.zona==="resolutiva"&&/^[“"]/.test(o.t)) return "texto_modificado";
    // lo que este tribunal dispone ahora («se imponen», «corresponde imponer», «deberá cargar»)
    if(/\b(se imponen|se impondran|imponer(?:le|les)?|corresponde imponer|debera cargar|deberan cargar|voto por|propongo)\b/.test(pl)&&o.zona!=="encabezado") return "esta_instancia";
    if(o.zona!=="resolutiva"){
      // lo que cuenta el fallo de las sentencias anteriores
      if(/la sentencia (cuestionada|recurrida|apelada|impugnada|de primera instancia|de grado|de origen|de camara)|la sentencia hace lugar|\b(hizo lugar|rechazo|condeno|impuso|impusieron|dispuso|fijo|aplico|establecio|confirmo|revoco|modifico|redujo|elevo|otorgo|reconocio|desestimo)\b/.test(pl)&&!/\b(se imponen|imponer|corresponde imponer|propongo|voto por|se impondran)\b/.test(pl)){
        if(/primera instancia|de grado|la jueza|el juez|el juzgado|de origen/.test(pl)) return "primera";
        if(/la camara|la sala|la alzada|tramite de apelacion/.test(pl)) return "camara";
        return "anterior";
      }
    }
    if(/instancia extraordinaria|recurso extraordinario|esta (corte|instancia|sede)|este tribunal|la queja/.test(pl)&&!/impuso|impusieron|dispuso/.test(pl)) return "esta_instancia";
    if(/ambas instancias/.test(pl)) return "ambas_instancias";
    if(/tramite de apelacion|la alzada|la camara|por la sala|segunda instancia/.test(pl)) return "camara";
    if(/primera instancia|de grado|la jueza|el juez|el juzgado|a quo|de origen/.test(pl)) return "primera";
    if(o.zona==="resolutiva"){
      // la resolutiva que transcribe la sentencia modificada (entre comillas) habla de la instancia anterior
      var antes=texto.slice(Math.max(A.secciones.resolutiva.ini,o.ini-1500),o.ini),ab=(antes.match(/[“"]/g)||[]).length,ci=(antes.match(/[”]/g)||[]).length;
      if(ab>ci) return "texto_modificado";
      return "esta_instancia";
    }
    if(/\b(impuso|impusieron|dispuso|fijo|aplico|establecio|condeno)\b/.test(pl)) return "anterior";
    // antes del primer voto, en los fallos del TSJ, va el relato de lo que pasó en las instancias anteriores
    if(o.zona==="encabezado"&&!/\b(se imponen|imponer|corresponde)\b/.test(pl)) return "anterior";
    return "esta_instancia";
  }

  /* ---------- costas ---------- */
  function costas(texto,A){
    var out=[];
    oraciones(texto,A).forEach(function(o){
      var pl=plano(o.t);
      if(!/\bcostas\b/.test(pl)||o.zona==="firmas") return;
      if(/^(tercera?|cuarta?) cuestion|pronunciamiento sobre costas\.?$|^costas\.?$/.test(pl)||/cuestion:? costas|sobre costas\./.test(pl)&&pl.length<120) return;
      var regla=null,m;
      if(/sin costas|sin imposicion de costas/.test(pl)) regla="sin costas";
      else if(/(orden causado|por su orden|por el orden causado)/.test(pl)) regla="en el orden causado (cada parte carga con las suyas)";
      else if((m=/costas[^.;]{0,120}?\b(?:a cargo de|a|al)\s+((?:la|el|los|las)\s+[^,.;(]{3,90}?)(?=\s+(?:por|en lo que|vencid|de conformidad|conforme|\(|y regula)|[,.;(]|$)/.exec(pl))){
        // con las mayúsculas del original («Distribuidora Pompeya SRL»)
        var ia=m.index+m[0].lastIndexOf(m[1]),orig=o.t.length===pl.length?o.t.slice(ia,ia+m[1].length):m[1];
        regla="a cargo de "+orig.trim().replace(/^(La|El|Los|Las)\b/,function(x){ return x.toLowerCase(); });
      }
      else if((m=/costas[^.;]{0,120}?\b(al|a la)\s+(recurrente|demandad[oa]|actora?|actor|apelante|vencid[oa]|citada en garantia)\b/.exec(pl))) regla="a cargo de"+(m[1]==="al"?"l ":" la ")+m[2];
      else if((m=/(?:impon\w*|cargo de)\s+(?:a\s+la\s+|a\s+el\s+|al\s+|la\s+|el\s+)(recurrente|demandad[oa]|actora?|actor|vencid[oa]|apelante|citada)/.exec(pl))) regla="a cargo de"+(/^(demandado|actor|apelante|recurrente|vencido)$/.test(m[1])&&/\bal\s/.test(m[0])?"l ":" la ")+m[1];
      var razon=/(por resultar vencid\w*|en lo que resulta vencid\w*|vencid\w* en lo principal|principio objetivo de la derrota|razon probable[^.;]*|buena fe[^.;]*|en atencion a[^.;]*|atento[^.;]*|dada la naturaleza[^.;]*|por la novedad[^.;]*|por haber podido creerse con derecho[^.;]*)/.exec(pl);
      if(!regla&&!razon) return;
      var rz=razon?razon[1].replace(/\s*\((?:art|cfr|conf)[^)]*$/,"").replace(/\s*\(\s*["“].*$/,""):null;
      if(rz&&rz.length>160) rz=rz.slice(0,160).replace(/\s+\S*$/,"")+" …";
      // de qué instancia son las costas (no es lo mismo que quién las impone)
      var mi=/costas\s+(?:procesales\s+)?(?:de|del|por|en)\s+(?:la\s+|el\s+|lo\s+)?(?:tramite\s+de\s+(?:la\s+)?|actuado\s+en\s+)?(alzada|apelacion|segunda instancia|primera instancia|origen|instancia extraordinaria|recurso extraordinario|esta instancia|ambas instancias)/.exec(pl);
      var de=mi?{alzada:"camara",apelacion:"camara","segunda instancia":"camara","primera instancia":"primera",origen:"primera","instancia extraordinaria":"esta_instancia","recurso extraordinario":"esta_instancia","esta instancia":"esta_instancia","ambas instancias":"ambas_instancias"}[mi[1]]:null;
      out.push({oracion:o,regla:regla,razon:rz,de:de,etapa:etapaDe(texto,A,o),zona:o.zona,ini:o.ini,fin:o.fin,t:o.t});
    });
    // primero lo que decide este tribunal (resolutiva), después lo que propone el voto, después lo de instancias anteriores
    var ord={resolutiva:0,fundamentos:1,encabezado:2};
    function propia(x){ return x.etapa==="esta_instancia"&&(!x.de||x.de==="esta_instancia")?0:x.etapa==="esta_instancia"?1:2; }
    out.sort(function(a,b){ return propia(a)-propia(b)||ord[a.zona]-ord[b.zona]||a.ini-b.ini; });
    return out;
  }

  /* ---------- intereses y actualización ---------- */
  var TASAS=[
    [/tasa activa[^.;,]{0,90}/,"tasa activa"],[/tasa pasiva[^.;,]{0,90}/,"tasa pasiva"],[/tasa (?:de interes )?uva[^.;,]{0,40}|\buva\b/,"UVA"],
    [/tasa pura[^.;,]{0,40}/,"tasa pura"],[/\b(?:6|8) ?% anual/,"tasa pura anual"],[/\bley\s*(?:n[°º.]?\s*)?(?:9\.?041|4\.?087|7\.?198)\b/,"ley provincial de intereses"],
    [/\bripte\b/,"RIPTE"],[/\bcer\b|coeficiente de estabilizacion/,"CER"],[/indice de precios al consumidor|\bipc\b/,"IPC"],[/acta\s*(?:n[°º.]?\s*)?(?:2601|2630|2658|2764|2783)/,"acta de la CNAT"],
    [/plazo fijo/,"plazo fijo"],[/doctrina legal[^.;]{0,60}/,"doctrina legal"]
  ];
  function intereses(texto,A){
    var out=[];
    oraciones(texto,A).forEach(function(o){
      var pl=plano(o.t);
      if(!/\bintereses?\b|\btasa\b|actualiza|indexa|desvaloriz/.test(pl)||o.zona==="firmas") return;
      if(/^\s*tasado|tasad[oa] por la ley/.test(pl)&&!/interes/.test(pl)) return;
      var tasas=[];TASAS.forEach(function(t){ var m=t[0].exec(pl); if(m&&tasas.indexOf(t[1])<0) tasas.push(t[1]); });
      var desde=/\bdesde\s+(?:la fecha (?:del|de la|de)\s+|el\s+|la\s+)?([^,.;]{3,70}?)(?=\s+(?:y\s+)?hasta|[,.;]|$)/.exec(pl);
      var hasta=/hasta\s+(?:el|la|su)\s+([^,.;]{3,60}?)(?=[,.;]|$)/.exec(pl);
      var incl=/incluidos? (?:los )?intereses|intereses incluidos/.test(pl),aparte=/con mas (?:sus |los )?intereses/.test(pl);
      if(!tasas.length&&!desde&&!incl&&!aparte&&!/interes(es)? (moratorio|compensatorio|legal|punitorio)/.test(pl)) return;
      var x={oracion:o,t:o.t,ini:o.ini,fin:o.fin,zona:o.zona,tasas:tasas,desde:desde?desde[1].trim():null,hasta:hasta?hasta[1].trim():null,incluidos:incl,aparte:aparte,etapa:etapaDe(texto,A,o)};
      // lo que decide este tribunal pesa más que lo que pidió una parte o fijó otra instancia
      x.s=tasas.length+(desde?.5:0)+(o.zona==="resolutiva"?2:0)+(x.etapa==="esta_instancia"?1:0)+(enAgravio(o.ini)?1:0)+(CONCLUYE.test(pl)?.7:0);
      // lo que pide o sostiene una parte no es lo que se decide
      if(DESCRIPCION.test(pl)){ x.s*=.3; x.etapa="parte"; }
      out.push(x);
    });
    function enAgravio(pos){ return ((A.decision&&A.decision.agravios)||[]).some(function(a){ return /interes|tasa/.test(plano(a.titulo))&&pos>=a.ini&&pos<a.fin; }); }
    out.sort(function(a,b){ return b.s-a.s||a.ini-b.ini; });
    return out;
  }

  /* ---------- lo que decidieron las instancias anteriores ---------- */
  var SUJ_PRIMERA=/\b(la jueza|el juez|la juez|el juzgado|la sentencia de (primera instancia|grado|origen)|el a[ -]?quo|la a[ -]?quo|el iudex|el inferior|el sentenciante|la sentenciante|el tribunal de (grado|origen)|el fallo de primera instancia|primera instancia|la magistrada de grado|el magistrado de grado)\b/;
  var SUJ_CAMARA=/\b(la (?:\w+ )?camara|la sala|la alzada|el tribunal de alzada|la sentencia (de (?:la )?camara|de alzada|recurrida|impugnada|cuestionada)|el tribunal de apelacion|la decision recurrida|la resolucion recurrida)\b/;
  var VERBO_DEC=/\b(resolvio|decidio|condeno|rechazo|hizo lugar|admitio|confirmo|revoco|modifico|redujo|elevo|fijo|establecio|sostuvo|considero|entendio|estimo|declaro|desestimo|aplico|impuso|denego|nego|argumento|razono|concluyo|otorgo|reconocio|cuantifico|realizo|sumo|actualizo|valoro|tuvo en cuenta|afirma|considera|analiza|senala|cuantifica|expresa|entiende|sostiene|rechaza|confirma|hace lugar|concluye|valora|pondera|dice|convalido|convalida)\b/;
  function instancias(texto,A,cual){
    var lim=A.secciones&&A.secciones.resolutiva?A.secciones.resolutiva.ini:texto.length,out=[];
    oraciones(texto,A).forEach(function(o){
      if(o.ini>=lim||o.zona==="firmas") return;
      var pl=plano(o.t),mP=SUJ_PRIMERA.exec(pl),mC=SUJ_CAMARA.exec(pl),esP=!!mP,esC=!!mC;
      if(!(esP||esC)) return;
      // el verbo tiene que venir después del sujeto y cerca: «La Sala V … revocó»
      var desdeS=Math.min(mP?mP.index:1e9,mC?mC.index:1e9),vb=VERBO_DEC.exec(pl.slice(desdeS));
      if(!vb||vb.index>160) return;
      if(DESCRIPCION.test(pl)) return;
      // «Se equivoca al afirmar que el Juez…»: es lo que sostiene una parte sobre esa sentencia
      if(/(afirmar|sostener|sostiene|alega|arguido|senala|denuncia|aduce|pretende) que\s*$/.test(pl.slice(Math.max(0,desdeS-40),desdeS).trim()+" ")) return;
      var inst=esP&&!/la camara|la sala|la alzada/.test(pl)?"primera":"camara";
      // «el a quo» es la instancia inmediata anterior: en un fallo de corte, la cámara
      if(/\ba[ -]?quo\b|\binferior\b|\biudex\b|el sentenciante/.test(pl)&&!/primera instancia|de grado|la camara|la alzada/.test(pl)) inst="anterior";
      var ps=pasaje(texto,A,o);
      out.push({t:ps.t,ini:o.ini,fin:ps.fin,zona:o.zona,instancia:inst,s:(VERBO_DEC.exec(pl)?1:0)+(/^(la|el) /.test(pl)?.5:0)});
    });
    var f=out.filter(function(x){ return cual==="anterior"||x.instancia===cual||x.instancia==="anterior"; });
    if(!f.length) f=out;
    // en el orden en que lo cuenta el fallo (los antecedentes van primero)
    return f.slice(0,6);
  }

  /* ---------- la pregunta entera ---------- */
  function entender(p,A,d){
    var its=intenciones(p),ps=personasEn(p,A),arts=articulosEn(p),ag=agravioEn(p,A);
    var q=plano(p);
    var e={pregunta:p,intenciones:its,personas:ps,articulos:arts,agravio:ag,
      porque:its.indexOf("porque")>=0,
      instancia:its.indexOf("instancia")>=0?instanciaEn(p):null};
    // «¿qué votó X?»: la persona manda; «votos» queda sólo si pregunta por el tribunal entero
    if(ps.length) e.intenciones=its.filter(function(n){ return n!=="votos"&&n!=="partes"; });
    if(arts.length) e.intenciones=e.intenciones.filter(function(n){ return n!=="normas"; });
    if(ag&&!e.porque) e.intenciones=e.intenciones.filter(function(n){ return n!=="agravios"&&n!=="decision"; });
    // «¿por qué se rechazó?»: es el por qué de la decisión, no la decisión otra vez
    if(e.porque) e.intenciones=e.intenciones.filter(function(n){ return n!=="decision"&&n!=="agravios"; });
    // lo que queda de la pregunta sin las palabras de intención ni las entidades: el tema
    var tema=terminos(p).filter(function(w){ return !ps.some(function(x){ return tokensPersona(x.nombre).indexOf(w)>=0; })&&!/^(voto|voto|votaron|opino|dijo|sostuvo|considero|piensa|penso|juez|jueza|ministr|doctor|dra|art|articulo|articulos|porque|fundamento|fundamentos|razon|razones|motivo|motivos|agravio|resolvio|decidio|rechazo|rechazaron|admitio|hizo|lugar|cita|citan|dice)/.test(w)&&!/^\d+$/.test(w); });
    e.tema=tema.join(" ");
    var ents=ps.map(function(x){ return "p:"+x.id; }).concat(arts.map(function(a){ return "a:"+a.num; })).concat(ag?["g:"+ag.letra]:[]);
    e.clave=(ents.length||!e.intenciones.length||(e.tema&&e.intenciones.length===1&&/porque|instancia/.test(e.intenciones[0])))?(e.intenciones.join("+")+"|"+ents.join(",")+"|"+tema.join(" ")):e.intenciones.join("+");
    return e;
  }

  return {intenciones:intenciones,entender:entender,oraciones:oraciones,rankear:rankear,porQue:porQue,costas:costas,intereses:intereses,
    instancias:instancias,personasEn:personasEn,articulosEn:articulosEn,citasDelArticulo:citasDelArticulo,agravioEn:agravioEn,votosDe:votosDe,rangoVoto:rangoVoto,rangoPrincipal:rangoPrincipal,etapaDe:etapaDe};
})();

if(typeof module!=="undefined"&&module.exports){
  module.exports={detectar:detectar,IVSAnalisis:IVSAnalisis,IVSLexia:IVSLexia,LEYES_BASE:LEYES_BASE,CATEGORIA_FUENTE:CATEGORIA_FUENTE,NORMA_A_CLAVE:NORMA_A_CLAVE};
}
