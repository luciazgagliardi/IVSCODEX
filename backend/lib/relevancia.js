/**
 * Decidir si un resultado corresponde de verdad a lo que se busco, segun el
 * modo elegido (frase exacta / todas las palabras / algunas palabras).
 *
 * Vive aparte porque los tres buscadores oficiales tienen capacidades muy
 * distintas y ninguno cubre las tres. Probado a mano contra cada sitio:
 *
 *   - CABA: es el unico completo. Su formulario tiene un campo por modo
 *     (textoLibreFrase / textoLibreTodas / textoLibreAlgunas) mas uno de
 *     exclusion, y los tres responden distinto y bien: "daño moral" da 356
 *     como frase, 438 con todas las palabras y 1000 con algunas.
 *   - Mendoza: SOLO sabe "todas las palabras". Las comillas no hacen frase,
 *     rompen la consulta ("pacto comisorio" sin comillas trae decenas de
 *     fallos; entre comillas, cero). El OR lo ignora: "daño OR moral" da
 *     exactamente lo mismo que "daño moral".
 *   - SAIJ: al reves, SOLO sabe "algunas palabras". Busca siempre con OR y
 *     descarta los operadores que se le manden.
 *
 * Asi que lo que el sitio no sepa hacer se hace aca, sobre los resultados ya
 * traidos. Es un filtro sobre el sumario, la caratula y las voces —lo unico
 * que devuelve la busqueda—, no sobre el fallo completo: puede dejar afuera
 * un fallo donde la frase aparezca solo en el cuerpo. Se avisa en pantalla.
 */

/**
 * Sin tildes y en minusculas, para comparar sin sorpresas.
 *
 * Ademas repara mojibake: texto guardado en el indice local de antes de que
 * lib/indiceCaba.js mandara y recibiera en windows-1252 como corresponde,
 * donde un caracter como "ñ" quedo grabado como "Ã±" (cada byte UTF-8
 * reinterpretado como si fuera un caracter Latin-1 aparte). Sin esto, una
 * consulta con acentos no encuentra esos registros viejos aunque la palabra
 * este ahi —"con esta palabra sí busca bien y con esta no", que es
 * exactamente lo que parece un bug al azar pero es siempre el mismo texto
 * corrupto.
 */
export function plegar(s) {
  const texto = String(s || '');
  // Las comillas tipograficas de windows-1252 (0x91/0x92) a veces llegan ya
  // como su codepoint Unicode correspondiente en vez de como el byte crudo;
  // sin este paso, reinterpretarlas como Latin-1 mas abajo tomaria solo el
  // byte bajo del codepoint y corromperia la cadena en vez de repararla.
  const bytes = [...texto].map((caracter) => {
    const codigo = caracter.charCodeAt(0);
    if (codigo === 0x2018) return String.fromCharCode(0x91);
    if (codigo === 0x2019) return String.fromCharCode(0x92);
    return caracter;
  }).join('');
  // "Ã" o "Â" seguido de un byte de continuacion es la firma de UTF-8
  // reinterpretado como Latin-1: recuperar los bytes originales y volver a
  // decodificarlos como UTF-8 reconstruye el caracter de verdad.
  const reparado = /(?:Ã|Â|â)[\x80-\xBF]/.test(bytes)
    ? Buffer.from(bytes, 'latin1').toString('utf8')
    : texto;
  return reparado
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Conectores y muletillas que aparecen en cualquier texto juridico.
 *
 * Sirven para dos cosas: no exigirlos al filtrar (pedir que estE "de" no
 * descarta nada) y no resaltarlos en pantalla, que era lo que ensuciaba los
 * pasajes — se marcaba cada "de" del fallo como si fuera parte de lo buscado.
 */
export const VACIAS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas',
  'y', 'e', 'o', 'u', 'en', 'al', 'a', 'ante', 'con', 'sin', 'por', 'para',
  'que', 'se', 'su', 'sus', 'lo', 'le', 'les', 'es', 'son', 'como', 'mas',
  'sobre', 'entre', 'desde', 'hasta', 'segun', 'contra', 'ni', 'no',
]);

/** Las palabras que de verdad definen la busqueda. */
export function palabrasUtiles(q) {
  return plegar(q)
    .split(/[^a-z0-9ñ]+/)
    // Los NÚMEROS entran siempre, midan lo que midan. El corte de tres
    // letras existe para descartar ruido ("de", "el", "un"), pero aplicado a
    // cifras rompía la búsqueda por artículo justo en los más citados: "art
    // 13" perdía el 13 y quedaba pidiendo sólo "art", y "13" a secas se
    // quedaba sin ninguna raíz, con lo cual el filtro dejaba pasar TODO.
    // Igual con "art 14 bis", "art 19 CN", "art 3 CCyC".
    .filter((p) => (/^\d+$/.test(p) || p.length >= 3) && !VACIAS.has(p));
}

/**
 * Las mismas palabras recortadas a la raiz, de mas especifica a mas generica.
 *
 * El recorte a 6 letras tolera la flexion del castellano sin traerse un
 * stemmer entero ("recobrar" y "recobro" comparten "recobr"). El orden es
 * por el largo de la palabra ENTERA: recortadas todas miden igual, y comparar
 * por el recorte hacia que en "teoria de la imprevision" ganara "teoria".
 */
export function raicesDe(q) {
  return palabrasUtiles(q)
    // Los números primero: son lo más específico que puede traer una
    // consulta. Importa porque cuando no hay coincidencia completa se
    // afloja quedándose con la PRIMERA raíz, y ordenando sólo por largo
    // ganaba "art" (3 letras) sobre "13" (2), o sea que buscar el artículo
    // 13 terminaba devolviendo cualquier fallo que dijera "artículo".
    .sort((a, b) => {
      const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
      if (na !== nb) return na ? -1 : 1;
      return b.length - a.length;
    })
    .map((p) => p.slice(0, 6));
}

/** Todo el texto buscable de un resultado, ya plegado. */
function pajarDe(registro) {
  return plegar(
    [registro.caratula, registro.sumario, (registro.voces || []).join(' '), registro.expediente]
      .filter(Boolean)
      .join(' ')
  );
}

/**
 * ¿Aparece esta raíz en el texto?
 *
 * Las palabras se buscan como subcadena, que es lo que hace tolerable la
 * flexión del castellano ("recobr" encuentra "recobrar" y "recobro").
 *
 * Los NÚMEROS no: tienen que aparecer enteros. Buscando el artículo 13, un
 * "2013" o un "130" no son coincidencias — y con subcadena lo serían, en un
 * texto judicial lleno de años, montos y números de expediente. Con dos
 * cifras eso es casi todos los fallos.
 */
function apareceRaiz(pajar, raiz) {
  if (!/^\d+$/.test(raiz)) return pajar.includes(raiz);
  return new RegExp(`(?<![0-9])${raiz}(?![0-9])`).test(pajar);
}

/** Cuantas de las raices aparecen en el resultado. */
function cuantas(pajar, raices) {
  return raices.filter((r) => apareceRaiz(pajar, r)).length;
}

/**
 * El año de una fecha, venga en el formato que venga.
 *
 * Hace falta porque las seis fuentes la escriben distinto, medido sobre lo
 * ya guardado en backend/indice/:
 *
 *   CABA          "29/4/2026"                 (dia y mes sin cero adelante)
 *   CSJN / SAIJ   "04/04/1995"
 *   Mendoza       "03/08/2026 - Sentencia"    (con el tipo de fallo pegado)
 *   Mendoza Legal "11/06/2026", a veces "06/2026", a veces vacia
 *   Dialnet       "2008"                      (solo el año: es doctrina)
 *
 * Se busca el primer numero de cuatro cifras que empiece con 19 o 20. Los
 * separadores hacen de frontera, asi que en "19/03/2020" no se confunde el
 * dia con el año: para que "19" matcheara harian falta dos digitos mas
 * pegados, y lo que sigue es una barra.
 *
 * Devuelve null cuando no hay nada reconocible — el registro no dice cuando
 * fue, no es que sea del año cero.
 */
export function anioDe(texto) {
  const m = /\b(?:19|20)\d{2}\b/.exec(String(texto || ''));
  return m ? parseInt(m[0], 10) : null;
}

/**
 * ¿Este registro cae dentro del rango de años pedido?
 *
 * Un registro SIN fecha reconocible queda AFUERA cuando hay rango puesto.
 * Es una decision con costo y conviene tenerla a la vista: se pierde algo
 * que quiza servia. Pero al reves es peor — quien filtra "de 2015 en
 * adelante" esta diciendo que lo viejo no le sirve, y colar registros de
 * fecha desconocida en esa lista es exactamente el ruido que el filtro
 * venia a sacar. Sin rango puesto no se descarta nada, claro.
 */
function entraEnRango(registro, desde, hasta) {
  if (!desde && !hasta) return true;
  const anio = anioDe(registro && registro.fecha);
  if (anio === null) return false;
  if (desde && anio < desde) return false;
  if (hasta && anio > hasta) return false;
  return true;
}

/**
 * Filtra una lista de resultados segun el modo pedido.
 *
 * Devuelve { lista, aflojado }. "aflojado" avisa que no hubo ningun resultado
 * con todas las palabras y que lo que se devuelve coincide solo con la mas
 * especifica: el frontend lo dice en pantalla en vez de hacerlo pasar por una
 * coincidencia completa.
 *
 * @param {object[]} registros
 * @param {{q: string, modo?: string, excluir?: string, aflojar?: boolean,
 *          anioDesde?: number, anioHasta?: number}} consulta
 *   modo: "exacta" | "todas" | "alguna" (por defecto "todas")
 *   aflojar: si false, "todas" exige todas las palabras y no cede (lo usa
 *   quien va a seguir buscando en la pagina siguiente antes de rendirse).
 *   anioDesde/anioHasta: rango de años. Se filtra ACA y no en cada sitio
 *   porque de las seis fuentes ninguna acepta un rango de años de forma
 *   confiable por su formulario, y hacerlo en un solo lugar garantiza que
 *   "de 2015 a 2020" signifique lo mismo en las seis.
 */
export function filtrarPorModo(registros, { q, modo = 'todas', excluir = '', aflojar = true, anioDesde = null, anioHasta = null }) {
  const raices = raicesDe(q);
  const raicesFuera = raicesDe(excluir);

  // El rango de años es una condicion dura: se aplica antes que nada y no
  // se afloja nunca, ni siquiera cuando abajo se baja el liston de las
  // palabras. Pedir "desde 2015" y recibir un fallo de 1998 porque no habia
  // otra cosa seria peor que no recibir nada.
  const enFecha = (anioDesde || anioHasta)
    ? registros.filter((r) => entraEnRango(r, anioDesde, anioHasta))
    : registros;

  // Lo excluido se saca siempre, cualquiera sea el modo.
  const vivos = raicesFuera.length
    ? enFecha.filter((r) => cuantas(pajarDe(r), raicesFuera) === 0)
    : enFecha.slice();

  if (!raices.length) return { lista: vivos, aflojado: false };

  if (modo === 'alguna') {
    return { lista: vivos.filter((r) => cuantas(pajarDe(r), raices) > 0), aflojado: false };
  }

  if (modo === 'exacta') {
    // La frase entera, con los espacios normalizados para que no la corten
    // los saltos de linea ni el doble espacio del texto original.
    const frase = plegar(q).replace(/\s+/g, ' ').trim();
    if (!frase) return { lista: vivos, aflojado: false };
    return {
      lista: vivos.filter((r) => pajarDe(r).replace(/\s+/g, ' ').includes(frase)),
      aflojado: false,
    };
  }

  // "todas": los que tienen todas las palabras.
  const completos = vivos.filter((r) => cuantas(pajarDe(r), raices) === raices.length);
  if (completos.length || raices.length === 1 || !aflojar) {
    return { lista: completos, aflojado: false };
  }

  // Ninguno las tiene todas. Antes de devolver cero se prueba con la palabra
  // mas especifica —"teoria de la imprevision" no aparece nunca literal, pero
  // "imprevision" si—, avisando que se aflojo. Sin ese aviso el resultado
  // enganaba: en "daño punitivo" devolvia causas penales sobre "requerimiento
  // de pena", que solo comparten la palabra "punitivo".
  return { lista: vivos.filter((r) => pajarDe(r).includes(raices[0])), aflojado: true };
}
