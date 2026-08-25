/**
 * Lector de citas legales: de un texto pegado a mano a campos estructurados.
 *
 * Existe por un problema muy concreto y muy nuevo: los modelos de lenguaje
 * inventan citas que suenan perfectas —carátula verosímil, tomo y página
 * plausibles, fecha coherente— y ya hubo sanciones a abogados por presentar
 * escritos con jurisprudencia que no existía. Para poder decir algo sobre una
 * cita hay que entenderla primero, y una cita argentina no tiene UN formato:
 * tiene el de cada tribunal, el de cada revista y el que cada quien escribe
 * de apuro. Por eso esto es un montón de expresiones regulares y no un
 * parser formal: no hay gramática que respetar, hay costumbres que reconocer.
 *
 * Lo que sale de acá es material para buscar (lib/verificarCita.js), no una
 * afirmación sobre la cita. Un campo que no se reconoce vuelve en null: NUNCA
 * se completa con lo que "seguramente quiso decir". Adivinar un expediente
 * sería exactamente el mismo pecado que se está tratando de detectar.
 *
 * Casos reales contra los que se probó (ver test/citas.prueba.js):
 *   CSJN, Fallos: 340:1084
 *   TSJ CABA, Expte. 12345/2020
 *   Cám. Nac. Civ., Sala A, "Pérez c/ Gómez s/ daños y perjuicios", 12/03/2019
 *   SCJM, Sala I, expte. 13-04785621-9 "González c/ Transportes SA p/ daños"
 */

import { plegar, palabrasUtiles } from './relevancia.js';

/**
 * Tribunales que sabemos reconocer, y a cuál de los buscadores del catálogo
 * (lib/fuentes.js) le corresponde preguntarle por sus fallos.
 *
 * El orden importa y no es alfabético: gana el primero que coincide, así que
 * lo específico va antes que lo general. "Suprema Corte de Justicia de la
 * Provincia de Buenos Aires" y "Corte Suprema de Justicia de la Nación"
 * comparten casi todas las palabras; si la SCBA no estuviera antes que la
 * CSJN, media provincia terminaría buscándose en la Corte federal.
 *
 * fuente = slug de lib/fuentes.js, o null cuando el tribunal se reconoce pero
 * este proyecto no tiene ningún buscador que lo cubra (el caso de los
 * tribunales internacionales). Ese null es información valiosa: permite
 * responder "no puedo verificarlo" en vez de buscar en el lugar equivocado y
 * responder "no aparece", que suena a que la cita es falsa.
 */
export const TRIBUNALES = [
  {
    clave: 'tsj_caba',
    nombre: 'Tribunal Superior de Justicia de la Ciudad Autónoma de Buenos Aires',
    fuente: 'caba',
    alias: [
      'tsj caba', 'tsjcaba', 'tsj de la ciudad', 'tribunal superior de justicia de la ciudad',
      'ciudad autonoma de buenos aires', 'caba', 'justicia de la ciudad',
      'contencioso administrativo y tributario de la ciudad',
    ],
  },
  {
    clave: 'camara_federal',
    nombre: 'Cámara federal o de casación',
    fuente: 'saij',
    // Va antes que Mendoza a propósito: "Cámara Federal de Mendoza" es
    // justicia federal con asiento en la provincia, no el Poder Judicial
    // provincial, y su jurisprudencia no está en el buscador de la SCJM.
    alias: [
      'camara federal', 'camara nacional de casacion', 'casacion penal', 'cfed',
      'camara de casacion', 'cncp', 'cfcp',
    ],
  },
  {
    clave: 'scjm',
    nombre: 'Poder Judicial de Mendoza',
    fuente: 'mendoza',
    // "mendoza" a secas alcanza porque el buscador de la SCJM cubre tanto la
    // Corte como las Cámaras Civiles y del Trabajo de la provincia (ver
    // tribunalDeMendoza); lo federal ya quedó atrapado en la entrada de
    // arriba, que se evalúa primero.
    alias: [
      'scjm', 'suprema corte de mendoza', 'suprema corte de justicia de mendoza',
      'poder judicial de mendoza', 'mendoza',
    ],
  },
  {
    clave: 'scba',
    nombre: 'Suprema Corte de Justicia de la Provincia de Buenos Aires',
    // Se busca en SAIJ, que carga jurisprudencia de todas las provincias: el
    // buscador propio de la SCBA no está integrado a este proyecto.
    fuente: 'saij',
    alias: [
      'scba', 'suprema corte de buenos aires', 'suprema corte de justicia de buenos aires',
      'suprema corte de justicia de la provincia de buenos aires', 'suprema corte bonaerense',
    ],
  },
  {
    clave: 'csjn',
    nombre: 'Corte Suprema de Justicia de la Nación',
    fuente: 'csjn',
    alias: [
      'csjn', 'corte suprema de justicia de la nacion', 'corte suprema de la nacion',
      'corte suprema', 'cortesuprema', 'csj de la nacion', 'alto tribunal',
    ],
  },
  {
    clave: 'camara_nacional',
    nombre: 'Cámara nacional de apelaciones',
    fuente: 'saij',
    alias: [
      'camara nacional', 'cam nac', 'camnac', 'cnciv', 'cncom', 'cnat', 'cncrim', 'cncc',
      'camara nacional de apelaciones', 'camara civil', 'camara comercial', 'camara del trabajo',
      'camara de apelaciones',
    ],
  },
  {
    clave: 'provincial',
    nombre: 'Superior tribunal o corte provincial',
    fuente: 'saij',
    alias: [
      'superior tribunal de justicia', 'tribunal superior de justicia', 'corte de justicia',
      'stj', 'tsj', 'supremo tribunal',
    ],
  },
  {
    clave: 'internacional',
    nombre: 'Tribunal internacional',
    // Ninguno de los cuatro buscadores del catálogo indexa jurisprudencia
    // internacional: la Corte IDH, el TEDH y la CIJ publican sus fallos en
    // sus propios sitios, que este proyecto enlaza pero no sabe consultar.
    fuente: null,
    alias: [
      'corte idh', 'corte interamericana', 'cidh', 'comision interamericana',
      'tedh', 'tribunal europeo de derechos humanos', 'echr',
      'corte internacional de justicia', 'icj', 'corte penal internacional', 'cpi',
      'tribunal de justicia de la union europea', 'tjue',
    ],
  },
];

/**
 * Palabras que aparecen en CUALQUIER cita y no dicen nada del caso.
 *
 * Se sacan de las palabras clave porque son el ruido perfecto: buscar
 * "sentencia tribunal sala expediente" trae la base entera y hace que
 * cualquier cita parezca encontrada.
 */
const RUIDO_DE_CITA = new Set([
  'expte', 'exptes', 'expediente', 'expedientes', 'exp', 'causa', 'autos', 'legajo', 'cuij',
  'fallos', 'fallo', 'sentencia', 'sent', 'sala', 'camara', 'tribunal', 'corte', 'suprema',
  'superior', 'justicia', 'nacion', 'nacional', 'federal', 'provincia', 'provincial',
  'juzgado', 'considerando', 'voto', 'del', 'tomo', 'pagina', 'pag', 'nro', 'numero',
  'apelaciones', 'civil', 'comercial', 'penal', 'laboral', 'contencioso', 'administrativo',
  'poder', 'judicial', 'dictamen', 'resolucion', 'acordada',
]);

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/**
 * Formas en que se escribe el número de expediente, de la más confiable a la
 * más arriesgada. Gana la primera que coincide.
 *
 * Las dos primeras piden una etiqueta ("Expte.", "causa nº") o un código de
 * fuero adelante, así que casi no se equivocan. Las dos últimas agarran un
 * número suelto y son el último recurso: un "12345/2020" perdido en un texto
 * podría ser cualquier cosa, pero en una cita legal es casi siempre el
 * expediente, y tener uno para comparar vale más que no tener nada — el
 * puntaje de lib/verificarCita.js igual exige que coincida exacto.
 */
const PATRONES_EXPEDIENTE = [
  /\b(?:exptes?|expedientes?|expdte|exp|causa|autos|legajo|cuij)\b\.?\s*(?:n(?:ro|º|°|o)?\.?\s*)?:?\s*((?:[A-Za-z]{1,5}[\s-])?\d[\d.\-/]{2,20}[\dA-Za-z])/i,
  /\b([A-Z]{2,4}\s?\d{2,6}\/(?:19|20)\d{2})\b/,
  /\b(\d{2}-\d{6,10}-\d)\b/,
  /\b(\d{3,7}\/(?:19|20)\d{2})\b/,
];

/** "Fallos: 340:1084" y sus variantes con tomo y página escritos aparte. */
const PATRONES_FALLOS = [
  /\bfallos\b\s*[:;]?\s*(?:t(?:omo)?\.?\s*)?(\d{1,3})\s*[:\-,]\s*(?:p(?:ag(?:ina)?)?\.?\s*)?(\d{1,4})/i,
  /\bfallos\b[^0-9]{0,20}t(?:omo)?\.?\s*(\d{1,3})[^0-9]{1,15}p(?:ag(?:ina)?)?\.?\s*(\d{1,4})/i,
];

const RE_FECHA_NUMERICA = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;
const RE_FECHA_EN_PALABRAS = new RegExp(
  '\\b(\\d{1,2})\\s*(?:de|del|-)\\s*(' + Object.keys(MESES).join('|') + ')\\s*(?:de|del|-)\\s*(\\d{4})\\b',
  'i'
);

/** Separadores de partes y de materia, tal como se escriben en tribunales. */
const RE_CONTRA = /\s+(?:c\/\.?|c\.\/|c\.|contra)\s+/i;
const RE_SOBRE = /\s+(?:s\/\.?|s\.\/|p\/\.?|sobre)\s+/i;

/**
 * Texto entre comillas: en una cita bien escrita, la carátula va ahí adentro.
 *
 * Contempla las comillas rectas, las tipográficas y las angulares porque el
 * texto llega copiado de un Word, de un PDF o de un chat, y cada uno usa las
 * suyas.
 */
const RE_ENTRECOMILLADO = /["“”«»]([^"“”«»]{3,240})["“”«»]|'([^']{6,240})'/;

/** Palabras del encabezado que se pegan al nombre del actor si no hay comillas. */
const RE_ARRASTRE_TRIBUNAL = /^(?:csjn|cs|scjm|scba|tsj|stj|caba|cnciv|cncom|cnat|cncrim|corte|suprema|superior|camara|cam|nac|nacional|federal|sala|tribunal|justicia|juzgado|de|del|la|el|los|las|en|lo|y|fallos|autos|caratulados?|expte|expediente|causa)\b[.,;:]?\s*/i;

/** Deja el texto en una sola línea, sin espacios de más ni saltos raros. */
function normalizar(texto) {
  return String(texto || '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dos versiones plegadas del texto para buscar alias de tribunales.
 *
 * La segunda pega las siglas escritas con puntos o separadas: "C.S.J.N."
 * llega como "c s j n" después de sacarle los puntos, y sin este paso no
 * coincidiría nunca con el alias "csjn". Es la forma en que la mitad de los
 * escritos escriben los tribunales, así que no es un caso de laboratorio.
 */
function pajarDeTribunales(texto) {
  const plano = plegar(texto).replace(/[.]/g, ' ').replace(/\s+/g, ' ').trim();
  const siglas = plano.replace(/\b([a-z])\s(?=[a-z]\b)/g, '$1');
  return plano + ' | ' + siglas;
}

/** Un alias coincide solo si está como palabra entera, no adentro de otra. */
function contieneAlias(pajar, alias) {
  const escapado = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + escapado + '($|[^a-z0-9])').test(pajar);
}

/**
 * A qué tribunal apunta la cita, si es que se puede decir.
 *
 * Es una clasificación best-effort y se devuelve como tal: si ningún alias
 * coincide vuelve null, y quien llama decide qué hacer con eso. Inventar un
 * tribunal probable llevaría a buscar en la fuente equivocada y a concluir
 * "no aparece" por el motivo equivocado.
 */
export function clasificarTribunal(texto) {
  const pajar = pajarDeTribunales(texto);
  for (const t of TRIBUNALES) {
    if (!t.alias.some((a) => contieneAlias(pajar, a))) continue;
    return {
      clave: t.clave,
      nombre: t.nombre,
      fuente: t.fuente,
      // Mendoza es la única fuente que obliga a elegir el tribunal ANTES de
      // buscar (su formulario no tiene un "todos"): una cita de una Cámara
      // buscada en la Suprema Corte da cero aunque el fallo exista. Ver
      // lib/indiceMza.js.
      tribunalEnFuente: t.fuente === 'mendoza' ? tribunalDeMendoza(pajar) : null,
    };
  }
  return null;
}

/** SC (Suprema Corte), CC (Cámaras Civiles) o CT (Cámaras del Trabajo). */
function tribunalDeMendoza(pajar) {
  if (/\bcamara|\bcam\b/.test(pajar)) {
    return /trabajo|laboral/.test(pajar) ? 'CT' : 'CC';
  }
  return 'SC';
}

/** Solo dígitos y letras, en minúscula: "12345/2020" y "12345-2020" son lo mismo. */
export function normalizarExpediente(texto) {
  return plegar(texto).replace(/[^a-z0-9]/g, '');
}

function buscarExpediente(texto) {
  for (const patron of PATRONES_EXPEDIENTE) {
    const m = patron.exec(texto);
    if (!m) continue;
    const crudo = m[1].replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
    // Un "expediente" de tres dígitos no identifica nada: coincidiría con
    // media base y convertiría el criterio más fuerte del verificador en el
    // más ruidoso.
    if (normalizarExpediente(crudo).length < 5) continue;
    return crudo;
  }
  return null;
}

function buscarFallos(texto) {
  for (const patron of PATRONES_FALLOS) {
    const m = patron.exec(texto);
    if (!m) continue;
    const tomo = parseInt(m[1], 10);
    const pagina = parseInt(m[2], 10);
    if (!tomo || !pagina) continue;
    return { tomo, pagina, texto: `Fallos: ${tomo}:${pagina}` };
  }
  return null;
}

function buscarFecha(texto) {
  const enPalabras = RE_FECHA_EN_PALABRAS.exec(texto);
  if (enPalabras) {
    const dia = parseInt(enPalabras[1], 10);
    const mes = MESES[plegar(enPalabras[2])];
    const anio = parseInt(enPalabras[3], 10);
    return armarFecha(dia, mes, anio, enPalabras[0]);
  }
  const numerica = RE_FECHA_NUMERICA.exec(texto);
  if (numerica) {
    const dia = parseInt(numerica[1], 10);
    const mes = parseInt(numerica[2], 10);
    // Un año de dos dígitos se interpreta como 19xx/20xx igual que lo hace
    // cualquier persona leyendo "12/03/19": nadie cita fallos del año 19.
    let anio = parseInt(numerica[3], 10);
    if (anio < 100) anio += anio <= 40 ? 2000 : 1900;
    return armarFecha(dia, mes, anio, numerica[0]);
  }
  return null;
}

function armarFecha(dia, mes, anio, texto) {
  if (!(dia >= 1 && dia <= 31) || !(mes >= 1 && mes <= 12) || !(anio >= 1863 && anio <= 2100)) {
    return null; // 1863 es el primer tomo de Fallos: antes de eso no hay qué citar
  }
  const dd = String(dia).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return { dia, mes, anio, iso: `${anio}-${mm}-${dd}`, texto: normalizar(texto) };
}

/** Le saca al nombre del actor el encabezado del tribunal que se le pegó. */
function limpiarArrastre(texto) {
  let salida = texto.trim();
  // De a una palabra, no de un saque: "Cám. Nac. Civ. Pérez" pierde tres
  // palabras y conserva "Pérez", que es lo único que sirve para comparar.
  for (let i = 0; i < 8; i++) {
    const recortado = salida.replace(RE_ARRASTRE_TRIBUNAL, '');
    if (recortado === salida) break;
    salida = recortado;
  }
  return salida.trim();
}

/**
 * Parte una carátula en actor, demandado y materia.
 *
 * "X c/ Y s/ daños" es la forma canónica, pero también se escribe "X contra
 * Y", "X c. Y" y, en Mendoza, "X c/ Y p/ daños" (p/ = "por"). Una carátula
 * sin "c/" —el "Halabi" a secas con el que se cita media Corte— no es un
 * error: queda como actor solo, que es exactamente lo que dice la cita.
 */
function partirCaratula(texto) {
  const limpio = normalizar(texto).replace(/^[«"“”'\s]+|[»"“”'\s.,;]+$/g, '');
  if (!limpio || !/[a-záéíóúñ]/i.test(limpio)) return null;

  let cuerpo = limpio;
  let materia = '';
  const sobre = RE_SOBRE.exec(cuerpo);
  if (sobre) {
    materia = cuerpo.slice(sobre.index + sobre[0].length).trim();
    cuerpo = cuerpo.slice(0, sobre.index).trim();
  }

  let actor = cuerpo;
  let demandado = '';
  const contra = RE_CONTRA.exec(cuerpo);
  if (contra) {
    actor = cuerpo.slice(0, contra.index).trim();
    demandado = cuerpo.slice(contra.index + contra[0].length).trim();
  }

  actor = limpiarArrastre(actor);
  if (!actor && !demandado) return null;

  return {
    texto: [actor, demandado && `c/ ${demandado}`, materia && `s/ ${materia}`].filter(Boolean).join(' '),
    actor,
    demandado,
    materia,
  };
}

function buscarCaratula(texto) {
  // Primero lo entrecomillado: si alguien se tomó el trabajo de poner
  // comillas, ahí adentro está la carátula y no hace falta adivinar dónde
  // empieza y dónde termina.
  const entre = RE_ENTRECOMILLADO.exec(texto);
  if (entre) {
    const partida = partirCaratula(entre[1] || entre[2] || '');
    if (partida) return partida;
  }

  // Sin comillas: se busca el "c/ … s/ …" en el texto corrido. Las clases
  // niegan la coma y el punto y coma a propósito: son lo que separa la
  // carátula del resto de la cita ("Cám. Nac. Civ., Sala A, Pérez c/ Gómez").
  const suelta = /([^,;"“”«»()]{2,80}?)\s+(?:c\/\.?|c\.\/|contra)\s+([^,;"“”«»()]{2,80}?)(?:\s+(?:s\/\.?|s\.\/|p\/\.?|sobre)\s+([^,;."“”«»()]{2,90}))?(?=[,;.]|$)/i;
  const m = suelta.exec(texto);
  if (m) {
    const partida = partirCaratula(m[0]);
    if (partida) return partida;
  }
  return null;
}

/**
 * Las palabras con las que se puede buscar si no hay ni expediente ni
 * carátula: los apellidos y la materia, sin el vocabulario de cita.
 */
function palabrasClaveDe(texto) {
  const vistas = new Set();
  const salida = [];
  for (const palabra of palabrasUtiles(texto)) {
    if (RUIDO_DE_CITA.has(palabra) || vistas.has(palabra)) continue;
    vistas.add(palabra);
    salida.push(palabra);
    if (salida.length >= 10) break;
  }
  return salida;
}

/**
 * Lee una cita pegada a mano y devuelve lo que se pudo reconocer.
 *
 * @param {string} texto  la cita tal como la pegó la persona
 * @returns {{
 *   texto: string, esCita: boolean, motivo: string|null,
 *   tribunal: object|null, expediente: string|null, fallos: object|null,
 *   caratula: object|null, fecha: object|null, palabrasClave: string[]
 * }}
 *   esCita es false cuando no se reconoció NINGÚN campo propio de una cita.
 *   En ese caso los campos vuelven vacíos y "motivo" explica por qué: es
 *   preferible decir "esto no parece una cita" que devolver campos armados
 *   con lo primero que se encontró.
 */
export function parsearCita(texto) {
  const limpio = normalizar(texto);

  const tribunal = clasificarTribunal(limpio);
  const fallos = buscarFallos(limpio);
  const fecha = buscarFecha(limpio);
  // El expediente se busca sobre el texto SIN la fecha: "12/03/2019" y
  // "12345/2020" se parecen lo suficiente como para que un patrón de número
  // suelto se lleve la fecha creyendo que es el expediente.
  const sinFecha = fecha ? limpio.replace(fecha.texto, ' ') : limpio;
  const expediente = buscarExpediente(sinFecha);
  const caratula = buscarCaratula(limpio);

  const esCita = !!(tribunal || expediente || fallos || caratula);

  return {
    texto: limpio,
    esCita,
    motivo: esCita
      ? null
      : limpio
        ? 'No reconocí ningún dato propio de una cita: ni tribunal, ni expediente, ni tomo y página de Fallos, ni una carátula con la forma "X c/ Y s/ materia".'
        : 'No llegó texto para analizar.',
    tribunal,
    expediente,
    fallos,
    caratula,
    fecha,
    palabrasClave: esCita ? palabrasClaveDe(limpio) : [],
  };
}
