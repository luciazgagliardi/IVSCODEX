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
    .filter((p) => p.length >= 3 && !VACIAS.has(p));
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
    .sort((a, b) => b.length - a.length)
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

/** Cuantas de las raices aparecen en el resultado. */
function cuantas(pajar, raices) {
  return raices.filter((r) => pajar.includes(r)).length;
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
 * @param {{q: string, modo?: string, excluir?: string, aflojar?: boolean}} consulta
 *   modo: "exacta" | "todas" | "alguna" (por defecto "todas")
 *   aflojar: si false, "todas" exige todas las palabras y no cede (lo usa
 *   quien va a seguir buscando en la pagina siguiente antes de rendirse).
 */
export function filtrarPorModo(registros, { q, modo = 'todas', excluir = '', aflojar = true }) {
  const raices = raicesDe(q);
  const raicesFuera = raicesDe(excluir);

  // Lo excluido se saca siempre, cualquiera sea el modo.
  const vivos = raicesFuera.length
    ? registros.filter((r) => cuantas(pajarDe(r), raicesFuera) === 0)
    : registros.slice();

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
