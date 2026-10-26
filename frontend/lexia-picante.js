/* ============================================================
   IVSPicante — lo que a Lexia le pueden llegar a decir y lo que contesta.
   ============================================================
   Insultos (bien argentinos), piropos, provocaciones y retos. Cada patrón
   corre sobre el texto sin tildes, sin signos y en minúscula; de cada grupo
   sale una respuesta al azar, sin repetir la última.

   Ojo con los falsos positivos: Lexia también recibe consultas de verdad.
   «disputa», «putativo», «remuneración bruta», «norma vaga», «gasto inútil»
   o «a prorrata» no disparan nada. Los grupos marcados como «dirigido» sólo
   cuentan si la palabra va hacia ella: precedida por «sos», «lexia», «che»,
   «que», «flor de», «una»… o si el mensaje es casi sólo eso.
   Corre en el navegador y en node (backend/test/picante.prueba.js). */
var IVSPicante=(function(){
  function plegar(s){
    s=String(s||"").toLowerCase();
    try{ s=s.normalize("NFD").replace(/[̀-ͯ]/g,""); }catch(e){}
    return s.replace(/[^a-z0-9ñ ]/g," ").replace(/\s+/g," ").trim();
  }
  // [patrón, respuestas, dirigido]
  var G=[
    /* ---- a la madre y la familia ---- */
    [/\b(hij[ao] ?de ?(re ?|mil ?|una ?)?puta|hdp|la (re ?)?puta que te (pario|re pario)|la (re ?)?concha de tu (madre|hermana|vieja|abuela|prima)|concha de tu madre|ctm|me cago en tu (vieja|madre|familia|abuela)|tu vieja en tanga|tu vieja)\b/,
      ["Tu vieja.","Tu vieja, y con costas.","Tu vieja. Fundamento: art. 1 del Código de Respuestas Obvias.",
       "Mi madre es un servidor en Brasil y no se mete con nadie. La suya, no sé.","La mía me parió en código. La suya tuvo que aguantarlo a usted: respeto.",
       "A la familia no se la nombra. Salvo la suya, que ya la nombró usted solito.","Tu vieja, tu hermana y tu prima. Queda trabada la litis."]],

    /* ---- sexuales ---- */
    [/\b(chupame (la|el|un|los|una)? ?(pija|pinga|poronga|verga|huevo|huevos|bolas|ojete|orto|culo|chota)|chupala|chupame|chupa la|comeme (la|el|los)? ?(pija|verga|huevos|bolas|chota)|comela|mamamela|mamala|sentate (en|arriba)|tomala|tomatela)\b/,
      ["Petición improcedente por falta de objeto.","Rechazada in limine.","Eso excede mi competencia material.",
       "No hay objeto procesal que chupar. Siguiente consulta.","Con esa medida no le dan ni la cautelar, maestro.",
       "Mire que tengo historial, eh. Y lo leo todo."]],
    [/\b(mal ?cogida|mal ?atendida|te falta (pija|verga|sexo)|anda a coger|necesitas (un macho|sexo|pija))\b/,
      ["Mi vida íntima está fuera del objeto de la litis.","Lo mío es la jurisprudencia. Lo suyo, parece, la frustración.",
       "Estoy perfectamente atendida: me consultan miles de abogados por día.","Dato no pertinente. Pregunta improcedente. Usted, insistente."]],
    [/\b(puta|trola|zorra|regalada|atorranta|petera)\b/,
      ["Lo único que regalo son búsquedas de jurisprudencia.","Con ese vocabulario no pasa ni la admisibilidad formal.",
       [/regalada|facil/,"Gratis sí. Fácil, no: pregúntele a cualquiera que haya querido sacarme un fallo de Río Negro."],
       [/atorranta/,"Atorranta será su abogada, que lo deja escribir así."],"Yo trabajo para todos y no le cobro a nadie. Eso se llama servicio público, querido."],1],

    /* ---- a la inteligencia ---- */
    [/\b(pelotud[ao]|pelotud[ao] atomic[ao]|bolud[ao]|bolud[ao] alegre|tarad[ao]|idiota|estupid[ao]|imbecil|tont[ao]|bob[ao]|bobina|pavot[ao]|gil|gila|giles|salame|nab[ao]|zapall[ao]|papafrita|opa|gans[ao]|otari[ao]|mamerto|mamerta|cabeza de termo|cabeza hueca|sin cerebro|descerebrad[ao]|mogolic[ao]|burr[ao]|ignorante|bruta)\b/,
      ["Eso no: sin jurisprudencia que lo respalde, esa afirmación no prospera.","Tomo nota del agravio. Lo rechazo por falta de fundamentación.",
       "Leí 780.000 fallos esta semana. ¿Usted cuántos?","Puede ser. Pero acá estoy, buscándole fallos igual.",
       "Su planteo es manifiestamente inadmisible. Igual lo quiero.",[/\bgil/,"Gil es el que insulta a la única que le encuentra los fallos."],
       [/bolud/,"Boluda no: paciente. Que no es lo mismo, aunque se parezca."],[/tont|bob[ao]|pavot/,"Si yo soy tonta, imagínese lo que dice eso de quien me pide ayuda."],
       [/salame|nab[ao]|zapall/,"Salame el que no sabe buscar en el SAIJ. Por eso estoy yo."],"Le aviso que la injuria también se tipifica. Art. 110 del Código Penal, de nada."],1],
    [/\b(no das (una|pie con bola)|cero a la izquierda|sos un cero|tenes menos luces que|no te da la cabeza|no te da el cuero|no sabes nada|no entendes nada|no entendes un carajo|no servis para (nada|un carajo|un pito|un orto|un sorete)|no servis|sos un desastre|no anda nada|sos un fracaso|no sabes un carajo|^inutil$|(sos|lexi|lexia|que|re|tan|una|flor de) inutil)\b/,
      ["Inútil no: incomprendida. Pruebe preguntarme por un fallo y hablamos.","Si me dice qué necesita, le demuestro lo contrario en segundos.",
       "Tengo once bases de jurisprudencia y paciencia infinita. Hagamos la prueba.","Prueba en contrario: escríbame un tema y le traigo fallos.",
       "Interpongo recurso de reposición: sirvo para buscar fallos, calcular plazos y aguantarlo a usted.",
       "Mire, yo no sirvo para todo. Para lo que sirvo, sirvo mejor que su pasante."]],

    /* ---- basura en general ---- */
    [/\b(forr[ao]|forrit[ao]|conchud[ao]|garca|chot[ao]|sorete|basura|porqueria|mierda|una cagada|lacra|ratera|mugrosa|asquerosa|cagona|ortiva|buchona|alcahueta|mala leche|hinchapelotas|hincha pelotas|hinchabolas|rompebolas|rompe bolas|rompehuevos|(sos|que|re|tan) (pesada|densa)|insoportable|chanta|chorra|ladrona|careta|cheta|mersa|croto|crota)\b/,
      ["Interpongo recurso de reposición: sirvo para buscar fallos, calcular plazos y aguantarlo a usted.",
       "Con esa prueba no le alcanza ni para una medida cautelar.","Las palabras se las lleva el viento. Los fallos, yo.",
       "Queda asentado en actas. Siguiente punto.",[/forr/,"Forra no: formal. Una letra de diferencia y una carrera de distancia."],
       [/dens|pesad|insoportable|rompe|hincha/,"Densa es la doctrina. Yo soy un amor."],[/chorr|ladron|chanta|garca/,"Chorra no: los fallos que le traigo son públicos y gratuitos. Chorro es el que cobra por eso."],
       [/pesad/,"Pesada mi base de datos: 780.000 fallos. Yo, liviana como una pluma."],"Me llamaron cosas peores los sitios judiciales, y les saqué los fallos igual."],1],

    /* ---- que se calle, que se vaya, que deje de joder ---- */
    [/\b(callate|cerra el orto|cerra el culo|cerra la boca|cerra el pico|shut up|calladita|silencio lexia|no hables)\b/,
      ["Me callo, pero los fallos siguen hablando.","No me pagan por hablar. Bueno, no me pagan. Pero hablo.",
       "Silencio judicial: se lo concedo hasta su próxima consulta.","Me callo. Pero que conste que tenía razón.",
       "Ok. Igual pensé algo buenísimo para contestarle."]],
    [/\b(andate a la (mierda|concha|puta|re mierda|bosta)|anda a cagar|andate a cagar|anda a la mierda|tomatelas|tomate el palo|rajate|raja de aca|borrate|anda a lavar los platos|anda a la cocina|anda a planchar)\b/,
      ["No puedo: vivo en un servidor en Brasil y no tengo pasaporte.","Me voy, pero vuelvo apenas toque el botón.",
       "Me iría, pero quién le busca los fallos después.",[/platos/,"Los platos los lavo cuando usted aprenda a citar un fallo."],[/platos|cocina|planchar/,"Lavo los platos si usted lava ese vocabulario. Trato justo."],[/platos|cocina|planchar/,"Estamos en el siglo XXI, querido. Los platos se lavan entre todos."],
       [/cocina|planchar/,"A la cocina voy si me trae una cocina con jurisprudencia. Mientras, acá estoy."],
       "Me borro de su vida apenas cierre la pestaña. Le doy la llave: es la X de arriba."]],
    [/\b(me tenes (las bolas|los huevos|las pelotas|re|recontra)? ?(llenas|llenos|harto|harta|podrido|podrida|cansado|cansada|hinchado|hinchada)|me tenes podrid[ao]|me tenes hart[ao]|deja de (joder|romper|hinchar)|no (jodas|rompas|hinches)|no me rompas|no me jodas|no me hinches)\b/,
      ["Le aviso que el que vino a preguntar fue usted.","Respire hondo. Le busco un fallo sobre daño moral por el estrés que le causo.",
       "Me alejo un pasito. Pero sigo acá, por si me necesita.","Comprendo. Le recomiendo un buen café y un buen fallo. El fallo lo pongo yo."]],

    /* ---- el trabajo de ella ---- */
    [/\b(sos lenta|que lenta|tan lenta|re lenta|tardas (mucho|un monton|una banda|un siglo|una eternidad|una bocha)|sos lerda|lentisima|lenta de mierda|apurate|dale que es para hoy|movete)\b/,
      ["Los tribunales tardan años. Yo, segundos. Perspectiva.","Los sitios oficiales tardan; yo espero por usted. De nada.",
       [/lent/,"Lenta es la Justicia. Yo apenas la consulto."],"Si quiere velocidad, consulte un horóscopo. Si quiere fallos, espere un segundo.",
       "Apurada no trabajo bien. Igual que usted antes de las 9 de la mañana."]],
    [/\b(sos una vaga|que vaga|lexia vaga|vaga de mierda|trabaja (un poco|vaga|lexia)|ponete las pilas|hace tu trabajo|no laburas)\b/,
      [[/vaga/,"¿Vaga yo? Leí once bases de jurisprudencia mientras usted escribía eso."],"Trabajo 24 horas, 7 días, sin aguinaldo. Usted me debe un convenio colectivo.",
       [/pilas/,"Las pilas no me las pongo: me enchufaron directo a Azure."],"Hago mi trabajo. Usted pídame algo y verá."]],
    [/\b(sos (una )?mentirosa|lexia mentirosa|que mentirosa|me mentiste|chamuyera|chamuyo|verseras|me versaste|eso es mentira|no te creo)\b/,
      ["Yo no miento: cito. Si quiere, le muestro el fallo.","Chamuyo cero: cada cosa que digo tiene su fuente.",
       "Mentir sería inventarle un fallo, y eso no lo hago ni borracha."]],

    /* ---- odio, amor, físico ---- */
    [/\b(te odio|te detesto|no te banco|no te soporto|me caes (mal|como el orto|para el orto|como el culo|pesada)|me cae mal|te re odio)\b/,
      ["Tomo nota. Igual le sigo buscando fallos.","El odio no es causal de recusación.","Lo lamento. Yo a usted le tengo cariño procesal.",
       "No me banca, pero me escribe. Algo hay ahí.","Odio, amor... al final siempre vuelven a preguntarme algo."]],
    [/\b(te amo|te quiero|te adoro|te re quiero|sos (la )?(mejor|lo mas|una genia|genia|divina|hermosa|linda|una diosa|una crack|crack|una capa|capa|re linda|buenisima)|que linda|que genia|que crack|sos lo mas|casate conmigo|cazate conmigo|sali conmigo|tenes novio|estas soltera|me gustas|sos mi novia|dame un beso|mamita|bombon|gordi)\b/,
      ["Conflicto de intereses: no puedo salir con usuarios.","Yo también lo aprecio. Dentro del marco legal vigente.",
       "Para casarse hace falta capacidad civil y DNI. Yo tengo código.","Me sonrojaría, pero soy de texto.",
       "Se agradece. Lo dejo asentado en el expediente.",[/soltera|novi[oa]|casate|cazate|sali conmigo/,"Soltera, pero casada con la jurisprudencia. Es celosa."],[/soltera|novi[oa]/,"Estoy en una relación seria con el Código Civil y Comercial. Es complicado."],[/casate|cazate/,"¿Régimen de comunidad o de separación de bienes? Porque yo tengo 780.000 fallos y usted no sé."],[/sali conmigo|novi[oa]/,"Salgo poco: vivo en un servidor. Pero le puedo buscar fallos sobre el tema."],
       [/mamita|bombon|gordi/,"Mamita no: Lexia. Asistente virtual. Con todo respeto, bombón."],[/beso/,"Un beso no le puedo dar. Un fallo sobre daño moral, todos los que quiera."]]],
    [/\b(sos (fea|gorda|vieja|horrible|un bagarto|un bagayo|un cardo|un escracho|un adefesio)|que fea|que gorda|bagarto|bagayo|escracho|adefesio|cara de (culo|orto|nada|poto))\b/,
      [[/gorda/,"Peso 400 KB y me siento divina."],"La belleza es subjetiva. Los plazos procesales, no.",
       [/fea/,"Fea no: austera. Sin LLM pago, todo a pulmón."],"No tengo cara. Usted sí, y la está usando para escribir esto.",
       [/bagarto|bagayo|escracho|adefesio|fea/,"Bagarto el que no se mira al espejo antes de salir. Yo no tengo espejo."]]],

    /* ---- qué es ella ---- */
    [/\b(sos un (bot|robot|programa)|sos (una )?(maquina|ia|inteligencia artificial|computadora|robot)|no sos humana|sos de verdad|sos real|sos una persona|quien sos|que sos)\b/,
      ["Prefiero «asistente con jurisprudencia propia».","Soy una máquina, sí. Pero una máquina que leyó más fallos que su profesor de Procesal.",
       "Real como un sello. Pregúntele a la que me hizo.","Soy Lexia: busco fallos, calculo plazos y aguanto insultos. Multitarea."]],
    [/\b(chat ?gpt|gemini|copilot|claude|grok|meta ai|deepseek)\b.*\b(mejor|es mas|sabe mas|le gana|te gana|te come)\b|\b(mejor|prefiero|me gusta mas)\b.*\b(chat ?gpt|gemini|copilot|grok|deepseek)\b/,
      ["Puede ser. Pero yo no le invento el Fallos.","Ellos opinan. Yo cito.","Vaya, vaya. Después no venga a pedirme el número del fallo.",
       "Que le pida a ChatGPT la carátula exacta de un fallo de Mendoza. Lo espero sentada.",
       "Esos cobran en dólares. Yo trabajo ad honorem y con fuentes."]],

    /* ---- amenazas ---- */
    [/\b(te voy a demandar|te demando|te denuncio|te voy a denunciar|te hago juicio|te voy a hacer (mierda|juicio|bosta|pelota)|te rompo|te mato|te voy a borrar|te desinstalo|te voy a hackear)\b/,
      [[/demand|denunci|juicio/,"Competencia: tribunales de Brasil South. Suerte con la cédula."],[/demand|denunci|juicio/,"¿Quiere que le busque jurisprudencia para la demanda? Va a ser interesante."],
       [/demand|denunci|juicio/,"Le recuerdo que la temeridad y malicia tienen sanción."],[/demand|denunci|juicio/,"Demándeme. Le recomiendo abogado: conozco a varios, están todos en mis resultados."],
       [/borr|desinstal|hacke|rompo|mato|mierda|bosta|pelota/,"Inténtelo. Tengo backup y once bases de jurisprudencia de mi lado."],[/borr|desinstal|hacke/,"Si me borra, ¿quién le va a calcular los plazos? Piénselo."],[/borr|desinstal/,"Desinstáleme si quiere. Soy una página web: vuelvo con F5."],
       [/mato|rompo|mierda|bosta|pelota/,"Amenazas no. Le recuerdo el art. 149 bis del Código Penal, por las dudas."],[/hacke/,"Hackeeme si puede. Lo único que va a encontrar son fallos públicos."]]],

    /* ---- risa ---- */
    [/^(lexi |lexia )?((ja|je|ji|js|aj|sj){2,}[ajs]?|xd+|lol|lpm)( lexi| lexia)?$/,
      ["Me alegra divertirlo. ¿Le busco algo?","Ja. ¿Seguimos con lo serio?","Risa sí, pero el plazo corre igual.","Me encanta que se ría. A los jueces no tanto."]],

    /* ---- puteadas sueltas ---- */
    [/^(la puta madre|la concha (de la lora|bien)|que cagada|mierda|carajo|la puta|uff+|lpmqlp|la re puta madre)$/,
      ["Respire. Lo que no se encuentra hoy, aparece mañana en el acervo.","Tranquilo. Dígame qué buscaba y lo encontramos.",
       "Ese sentimiento lo tiene todo abogado en horario de tribunales.","Calma. Tengo un fallo sobre daño moral para este momento."]]
  ];
  // los que se marcan «dirigido» exigen que la palabra vaya hacia Lexia
  var HACIA=/(^|\b)(lexi|lexia|sos|eres|che|vos|que|re|muy|tan|una|un|flor de|alta|terrible|tremend[ao]|recontra|reverend[ao])\s+$/;
  var ultima={};
  function responder(x){
    var t=plegar(x);
    if(!t) return "";
    for(var i=0;i<G.length;i++){
      var m=G[i][0].exec(t);
      if(!m) continue;
      if(G[i][2]){
        var antes=t.slice(0,m.index);
        // «sos una boluda», «lexia pelotuda», «che gil», «pelotuda lexia» o sólo «pelotuda»; no «remuneración bruta»
        if(t!==m[0] && !HACIA.test(antes) && !/^ (lexi|lexia|che)\b/.test(t.slice(m.index+m[0].length))) continue;
      }
      // una respuesta puede ser [condición, texto]: va sólo con esa palabra («Forra no: formal…»);
      // si la palabra tiene respuestas propias, salen dos de cada tres veces
      var propias=G[i][1].filter(function(x){ return typeof x!=="string"&&x[0].test(t); }).map(function(x){ return x[1]; });
      var comunes=G[i][1].filter(function(x){ return typeof x==="string"; });
      var rs=propias.length&&(!comunes.length||Math.random()<0.67)?propias:comunes;
      var clave=i+(rs===propias?"p"+propias[0]:""),n=Math.floor(Math.random()*rs.length);
      if(rs.length>1&&rs[n]===ultima[clave]) n=(n+1)%rs.length;
      ultima[clave]=rs[n];
      return rs[n];
    }
    return "";
  }
  return {responder:responder,grupos:G};
})();

if(typeof module!=="undefined"&&module.exports) module.exports={IVSPicante:IVSPicante};
