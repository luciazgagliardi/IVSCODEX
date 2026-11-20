/**
 * Preparación del texto para la lectura en voz alta.
 *
 * Un sintetizador de voz lee lo que está escrito, y lo escrito en un fallo no
 * es lo que se dice: «c/», «s/», «Sra.», «art. 14 inc. b)», «24.240»,
 * «Fallos: 330:3248», «CCyC», «12/03/2021», «S.A.», «$ 1.500,50»… Leídos tal
 * cual salen deletreados, con puntos que cortan la frase o con números
 * partidos. Esta función lleva el texto a como lo diría una persona en voz
 * alta, en castellano rioplatense, antes de mandarlo a la voz.
 *
 * Es una función pura, sin red ni estado: se prueba con
 * test/vozJuridica.prueba.js y se usa desde routes/voz.js.
 */

/* ------------------------------------------------------------------ *
 * Números
 * ------------------------------------------------------------------ */

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
];

/** «uno» según lo que sigue: «un», «una» o «uno». */
function conForma(palabra, forma) {
  if (forma === 'un') return palabra === 'uno' ? 'un' : palabra === 'veintiuno' ? 'veintiún' : palabra;
  if (forma === 'una') return palabra === 'uno' ? 'una' : palabra === 'veintiuno' ? 'veintiuna' : palabra;
  return palabra;
}

/** 1..999 */
function menorMil(n, forma, fem) {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes = [];
  if (c) {
    let cent = CENTENAS[c];
    if (fem && c !== 1) cent = cent.replace(/os$/, 'as');
    partes.push(cent);
  }
  if (r) {
    if (r < 30) partes.push(conForma(UNIDADES[r], forma));
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u ? DECENAS[d] + ' y ' + conForma(UNIDADES[u], forma) : DECENAS[d]);
    }
  }
  return partes.join(' ');
}

/** 1..999.999 */
function hastaMilMil(n, forma, fem) {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes = [];
  if (miles === 1) partes.push('mil');
  else if (miles > 1) partes.push(menorMil(miles, fem ? 'una' : 'un', fem) + ' mil');
  if (resto) partes.push(menorMil(resto, forma, fem));
  return partes.join(' ');
}

/**
 * Entero → palabras. `forma`: 'o' (uno), 'un' (un caso) o 'una' (una vez).
 * Hasta 999.999.999.999; por encima de eso, dígito por dígito.
 */
export function numeroALetras(n, { forma = 'o', fem = false } = {}) {
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n === 0) return 'cero';
  if (n >= 1e12) return String(n).split('').map((d) => UNIDADES[+d] || 'cero').join(' ');
  const millones = Math.floor(n / 1e6);
  const resto = n % 1e6;
  const partes = [];
  if (millones === 1) partes.push('un millón');
  else if (millones > 1) partes.push(hastaMilMil(millones, 'un', false) + ' millones');
  if (resto) partes.push(hastaMilMil(resto, forma, fem));
  return partes.join(' ');
}

const ORDINALES = [
  '', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo',
  'octavo', 'noveno', 'décimo', 'undécimo', 'duodécimo',
];

function ordinal(n, fem) {
  if (n >= 1 && n <= 12) {
    const o = ORDINALES[n];
    return fem ? o.replace(/o$/, 'a') : o;
  }
  return numeroALetras(n, { forma: fem ? 'una' : 'un', fem });
}

/** Lee dígitos sueltos: «007» → «cero cero siete». */
function digitos(texto) {
  return texto.split('').map((d) => (d === '0' ? 'cero' : UNIDADES[+d])).join(' ');
}

/** Número escrito a la argentina («1.500,50», «24.240», «3,5») → { entero, decimales }. */
function interpretarNumero(s) {
  let entero;
  let dec = '';
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    const [e, d] = s.split(',');
    entero = e.replace(/\./g, '');
    dec = d || '';
  } else if (/^\d+,\d+$/.test(s)) {
    [entero, dec] = s.split(',');
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    [entero, dec] = s.split('.');
  } else {
    entero = s.replace(/[.,]/g, '');
  }
  return { entero, dec };
}

function leerNumeroSuelto(s, siguiente) {
  const { entero, dec } = interpretarNumero(s);
  if (entero.length > 12 || (entero.length > 1 && entero.startsWith('0') && !dec)) return digitos(entero);
  const n = Number(entero);
  let forma = 'o';
  if (!dec && n % 10 === 1 && n % 100 !== 11 && siguiente) forma = generoDe(siguiente);
  let salida = numeroALetras(n, { forma, fem: forma === 'una' });
  if (dec) {
    const ceros = dec.match(/^0*/)[0].length;
    const resto = dec.slice(ceros);
    const cola = ceros ? digitos('0'.repeat(ceros)) + (resto ? ' ' + numeroALetras(Number(resto)) : '') : numeroALetras(Number(dec));
    salida += ' coma ' + cola;
  }
  return salida;
}

const MASCULINAS_EN_A = new Set([
  'día', 'días', 'mapa', 'mapas', 'tema', 'temas', 'problema', 'problemas', 'sistema', 'sistemas',
  'programa', 'programas', 'idioma', 'idiomas', 'poema', 'poemas', 'planeta', 'planetas',
  'diploma', 'diplomas', 'clima', 'climas', 'lema', 'lemas', 'dilema', 'dilemas', 'esquema', 'esquemas',
  'trauma', 'traumas', 'síntoma', 'síntomas', 'telegrama', 'telegramas', 'monograma', 'cuyo',
]);

function generoDe(palabra) {
  const w = palabra.toLowerCase();
  if (MASCULINAS_EN_A.has(w)) return 'un';
  if (/(a|as|ión|iones|dad|dades|tud|tudes|ez|umbre|umbres)$/.test(w)) return 'una';
  return 'un';
}

/* ------------------------------------------------------------------ *
 * Romanos
 * ------------------------------------------------------------------ */

const ROMANO = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const VALORES_ROMANOS = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function romanoANumero(s) {
  if (!s || !ROMANO.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALORES_ROMANOS[s[i]];
    const sig = VALORES_ROMANOS[s[i + 1]] || 0;
    total += v < sig ? -v : v;
  }
  return total || null;
}

/* ------------------------------------------------------------------ *
 * Letras y siglas
 * ------------------------------------------------------------------ */

const LETRAS = {
  A: 'a', B: 'be', C: 'ce', D: 'de', E: 'e', F: 'efe', G: 'ge', H: 'hache', I: 'i', J: 'jota',
  K: 'ka', L: 'ele', M: 'eme', N: 'ene', Ñ: 'eñe', O: 'o', P: 'pe', Q: 'cu', R: 'erre', S: 'ese',
  T: 'te', U: 'u', V: 'uve', W: 'doble uve', X: 'equis', Y: 'ye', Z: 'zeta',
};

function deletrear(sigla) {
  return sigla.toUpperCase().split('').map((l) => LETRAS[l] || l).join(' ');
}

/** Siglas que se dicen con todas sus palabras. Clave: letras en mayúscula, sin puntos. */
const SIGLAS = {
  // sociedades
  SA: 'sociedad anónima', SAU: 'sociedad anónima unipersonal', SAS: 'sociedad por acciones simplificada',
  SRL: 'sociedad de responsabilidad limitada', SCA: 'sociedad en comandita por acciones',
  SCS: 'sociedad en comandita simple', SH: 'sociedad de hecho', SAIC: 'sociedad anónima industrial y comercial',
  SACI: 'sociedad anónima comercial e industrial', SACIF: 'sociedad anónima comercial, industrial y financiera',
  UTE: 'unión transitoria', ONG: 'organización no gubernamental',
  // tribunales y organismos
  CSJN: 'Corte Suprema de Justicia de la Nación', CSJ: 'Corte Suprema de Justicia',
  SCBA: 'Suprema Corte de Justicia de la provincia de Buenos Aires',
  SCJM: 'Suprema Corte de Justicia de Mendoza', SCJBA: 'Suprema Corte de Justicia de la provincia de Buenos Aires',
  TSJ: 'Tribunal Superior de Justicia', STJ: 'Superior Tribunal de Justicia',
  CIDH: 'Comisión Interamericana de Derechos Humanos', TEDH: 'Tribunal Europeo de Derechos Humanos',
  TJUE: 'Tribunal de Justicia de la Unión Europea', CIJ: 'Corte Internacional de Justicia',
  CNAT: 'Cámara Nacional de Apelaciones del Trabajo', CNCIV: 'Cámara Nacional de Apelaciones en lo Civil',
  CNCOM: 'Cámara Nacional de Apelaciones en lo Comercial', CNTRAB: 'Cámara Nacional de Apelaciones del Trabajo',
  CNFED: 'Cámara Nacional de Apelaciones en lo Civil y Comercial Federal',
  CNCCF: 'Cámara Nacional de Apelaciones en lo Civil y Comercial Federal',
  CNCAF: 'Cámara Nacional de Apelaciones en lo Contencioso Administrativo Federal',
  CAF: 'Cámara en lo Contencioso Administrativo Federal', CNE: 'Cámara Nacional Electoral',
  CNCP: 'Cámara Nacional de Casación Penal', CFCP: 'Cámara Federal de Casación Penal',
  CNCCC: 'Cámara Nacional de Apelaciones en lo Criminal y Correccional',
  CNCRIMCORR: 'Cámara Nacional de Apelaciones en lo Criminal y Correccional',
  TOF: 'Tribunal Oral Federal', TOC: 'Tribunal Oral en lo Criminal', PJN: 'Poder Judicial de la Nación',
  MPF: 'Ministerio Público Fiscal', MPD: 'Ministerio Público de la Defensa', PGN: 'Procuración General de la Nación',
  PTN: 'Procuración del Tesoro de la Nación', IGJ: 'Inspección General de Justicia',
  CPACF: 'Colegio Público de la Abogacía de la Capital Federal',
  AFIP: 'Administración Federal de Ingresos Públicos', ARCA: 'Agencia de Recaudación y Control Aduanero',
  ANSES: 'Administración Nacional de la Seguridad Social', PAMI: 'Pami',
  INSSJP: 'Instituto Nacional de Servicios Sociales para Jubilados y Pensionados',
  BCRA: 'Banco Central de la República Argentina', CNV: 'Comisión Nacional de Valores',
  UIF: 'Unidad de Información Financiera', INDEC: 'Indec', SRT: 'Superintendencia de Riesgos del Trabajo',
  ART: 'aseguradora de riesgos del trabajo', ENACOM: 'Enacom', ENRE: 'Enre', ENARGAS: 'Enargas',
  ONU: 'Organización de las Naciones Unidas', OEA: 'Organización de los Estados Americanos',
  OMC: 'Organización Mundial del Comercio', OMS: 'Organización Mundial de la Salud',
  UE: 'Unión Europea', EEUU: 'Estados Unidos', EUA: 'Estados Unidos de América',
  CABA: 'Ciudad Autónoma de Buenos Aires', GCBA: 'Gobierno de la Ciudad de Buenos Aires',
  PBA: 'provincia de Buenos Aires', AMBA: 'Área Metropolitana de Buenos Aires',
  // códigos y normas
  CCYC: 'Código Civil y Comercial', CCYCN: 'Código Civil y Comercial de la Nación',
  CCCN: 'Código Civil y Comercial de la Nación', CCIVCOM: 'Código Civil y Comercial',
  CCOM: 'Código de Comercio', CP: 'Código Penal', CPN: 'Código Penal de la Nación',
  CPP: 'Código Procesal Penal', CPPN: 'Código Procesal Penal de la Nación',
  CPCC: 'Código Procesal Civil y Comercial', CPCCN: 'Código Procesal Civil y Comercial de la Nación',
  CPCCBA: 'Código Procesal Civil y Comercial de la provincia de Buenos Aires',
  CPCYC: 'Código Procesal Civil y Comercial', CPCCYT: 'Código Procesal Civil, Comercial y Tributario', CPT: 'Código Procesal del Trabajo',
  CN: 'Constitución Nacional', CADH: 'Convención Americana sobre Derechos Humanos',
  PIDCP: 'Pacto Internacional de Derechos Civiles y Políticos',
  PIDESC: 'Pacto Internacional de Derechos Económicos, Sociales y Culturales',
  DUDH: 'Declaración Universal de Derechos Humanos', CDN: 'Convención sobre los Derechos del Niño',
  LCT: 'Ley de Contrato de Trabajo', LRT: 'Ley de Riesgos del Trabajo', LGS: 'Ley General de Sociedades',
  LCQ: 'Ley de Concursos y Quiebras', LDC: 'Ley de Defensa del Consumidor',
  LPA: 'Ley de Procedimientos Administrativos', DNU: 'decreto de necesidad y urgencia',
  DDHH: 'derechos humanos', NNYA: 'niños, niñas y adolescentes', NNA: 'niños, niñas y adolescentes',
  // personas y trámites
  DNI: 'documento nacional de identidad', CUIT: 'clave única de identificación tributaria',
  CUIL: 'código único de identificación laboral', CBU: 'clave bancaria uniforme',
  IVA: 'impuesto al valor agregado', IPC: 'índice de precios al consumidor',
  SMVM: 'salario mínimo, vital y móvil', TNA: 'tasa nominal anual', TEA: 'tasa efectiva anual',
  RIPTE: 'Ripte', UVA: 'U V A', ADN: 'a de ene',
  // publicaciones
  LL: 'La Ley', ED: 'El Derecho', JA: 'Jurisprudencia Argentina', DJ: 'Doctrina Judicial',
  LLBA: 'La Ley Buenos Aires', LLC: 'La Ley Córdoba', LLO: 'La Ley Online', JPBA: 'Jurisprudencia de la provincia de Buenos Aires',
};

/** Mayúsculas que son palabras comunes, no siglas: se leen en minúscula. */
const PALABRAS_CORTAS = new Set([
  'A', 'AL', 'ANA', 'AÑO', 'CON', 'DAR', 'DE', 'DEL', 'DOS', 'E', 'EL', 'EN', 'ES', 'EVA', 'FUE',
  'HA', 'HAY', 'HE', 'LA', 'LAS', 'LE', 'LEO', 'LES', 'LEY', 'LO', 'LOS', 'LUZ', 'MAL', 'ME', 'MI',
  'MIS', 'NI', 'NO', 'O', 'PAZ', 'POR', 'QUE', 'REY', 'SE', 'SER', 'SI', 'SÍ', 'SIN', 'SOL', 'SON',
  'SU', 'SUS', 'TE', 'TU', 'TUS', 'U', 'UN', 'UNA', 'VER', 'VÍA', 'VIA', 'Y', 'YA', 'ASÍ', 'MÁS', 'MAS',
]);

/* ------------------------------------------------------------------ *
 * Abreviaturas
 * ------------------------------------------------------------------ */

const NO_LETRA_ANTES = '(?<![\\p{L}\\p{N}])';
const NUMERO_DESPUES = '(?=\\s*(?:\\d|N[º°o]\\b|[IVXLC]+\\b))';

function mayusculaInicial(origen, reemplazo, desde, texto) {
  const antes = texto.slice(0, desde);
  const inicioDeOracion = !antes.trim() || /[.!?:]\s*$/.test(antes);
  return /^\p{Lu}/u.test(origen) && inicioDeOracion
    ? reemplazo.charAt(0).toUpperCase() + reemplazo.slice(1)
    : reemplazo;
}

/**
 * Cada regla: [patrón, reemplazo, opciones]. Opciones: `punto` exige el punto
 * final (si no, es opcional), `conNumero` sólo aplica ante un número,
 * `conservaPunto` no se come el punto (etc.), `exacto` respeta mayúsculas.
 */
const ABREVIATURAS = [
  // tratamientos
  ['Sr', 'señor'], ['Sra', 'señora'], ['Srta', 'señorita'], ['Sres', 'señores'], ['Sras', 'señoras'],
  ['Dr', 'doctor'], ['Dra', 'doctora'], ['Dres', 'doctores'], ['Dras', 'doctoras'],
  ['Ing', 'ingeniero', { punto: true }], ['Lic', 'licenciado', { punto: true }], ['Arq', 'arquitecto', { punto: true }],
  ['Esc', 'escribano', { punto: true }], ['Prof', 'profesor', { punto: true }], ['Profa', 'profesora', { punto: true }],
  ['Excmo', 'excelentísimo', { punto: true }], ['Excma', 'excelentísima', { punto: true }],
  ['Ilmo', 'ilustrísimo', { punto: true }], ['Ilma', 'ilustrísima', { punto: true }],
  ['Dn', 'don', { punto: true }], ['Dña', 'doña', { punto: true }], ['Gral', 'general', { punto: true }],
  ['Pdte', 'presidente', { punto: true }], ['Pte', 'presidente', { punto: true }],
  // proceso
  ['Expte', 'expediente'], ['Expdte', 'expediente'], ['Exp', 'expediente', { punto: true }],
  ['Fdo', 'firmado', { punto: true }], ['Fs', 'fojas', { conNumero: true }], ['fol', 'folio', { punto: true }],
  ['vta', 'vuelta', { punto: true }], ['Cám', 'cámara', { punto: true }], ['Cam', 'cámara', { punto: true }],
  ['Nac', 'nacional', { punto: true }], ['Fed', 'federal', { punto: true }], ['Civ', 'civil', { punto: true }],
  ['Com', 'comercial', { punto: true }], ['Crim', 'criminal', { punto: true }], ['Corr', 'correccional', { punto: true }],
  ['Trab', 'trabajo', { punto: true }], ['Cont', 'contencioso', { punto: true }], ['Adm', 'administrativo', { punto: true }],
  ['Fam', 'familia', { punto: true }], ['Pen', 'penal', { punto: true }], ['Lab', 'laboral', { punto: true }],
  ['Inst', 'instancia', { punto: true }], ['Nom', 'nominación', { punto: true }], ['Circ', 'circunscripción', { punto: true }],
  ['Sec', 'secretaría', { punto: true, conNumero: true }], ['Juzg', 'juzgado', { punto: true }],
  ['Trib', 'tribunal', { punto: true }], ['Sup', 'superior', { punto: true }], ['Pcia', 'provincia', { punto: true }],
  ['Prov', 'provincia', { punto: true }], ['Pcial', 'provincial', { punto: true }],
  ['Dpto', 'departamento', { punto: true }], ['Av', 'avenida', { punto: true }], ['Arg', 'Argentina', { punto: true }],
  ['Const', 'constitución', { punto: true }], ['Cód', 'código', { punto: true }], ['Proc', 'procesal', { punto: true }],
  ['Rec', 'recurso', { punto: true }], ['Ext', 'extraordinario', { punto: true }], ['Inconst', 'inconstitucionalidad', { punto: true }],
  ['Casac', 'casación', { punto: true }], ['Apel', 'apelación', { punto: true }], ['Ejec', 'ejecutivo', { punto: true }],
  // normas
  ['Art', 'artículo'], ['Arts', 'artículos'], ['Inc', 'inciso'], ['Incs', 'incisos'],
  ['Apart', 'apartado', { punto: true }], ['Párr', 'párrafo', { punto: true }], ['Tít', 'título', { punto: true }],
  ['Secc', 'sección', { punto: true }], ['Cap', 'capítulo', { punto: true, conNumero: true }],
  ['Consid', 'considerando', { punto: true }], ['Cons', 'considerando', { punto: true, conNumero: true }],
  ['Res', 'resolución', { punto: true, conNumero: true }], ['Disp', 'disposición', { punto: true, conNumero: true }],
  ['Dec', 'decreto', { punto: true, conNumero: true }], ['Dto', 'decreto', { punto: true, conNumero: true }],
  ['Ord', 'ordenanza', { punto: true, conNumero: true }], ['Ac', 'acordada', { punto: true, conNumero: true }],
  ['L', 'ley', { punto: true, conNumero: true, exacto: true }],
  ['Pto', 'punto', { punto: true, conNumero: true }], ['Ptos', 'puntos', { punto: true, conNumero: true }],
  // citas y bibliografía
  ['Cfr', 'confróntese', { punto: true }], ['Cf', 'confróntese', { punto: true }], ['Conf', 'conforme', { punto: true }],
  ['v\\.\\s?gr', 'verbigracia', { punto: true }], ['vgr', 'verbigracia', { punto: true }],
  ['p\\.\\s?ej', 'por ejemplo', { punto: true }], ['Ej', 'ejemplo', { punto: true }],
  ['e\\.\\s?g', 'por ejemplo', { punto: true }], ['i\\.\\s?e', 'es decir', { punto: true }],
  ['etc', 'etcétera', { conservaPunto: true }], ['op\\.\\s?cit', 'obra citada', { punto: true }],
  ['ob\\.\\s?cit', 'obra citada', { punto: true }], ['loc\\.\\s?cit', 'lugar citado', { punto: true }],
  ['cit', 'citado', { punto: true }], ['Ib', 'ibídem', { punto: true }], ['Ibíd', 'ibídem', { punto: true }],
  ['Ibid', 'ibídem', { punto: true }], ['id', 'ídem', { punto: true, exacto: true }],
  ['cc\\.\\s?y\\s?ss', 'concordantes y siguientes', { punto: true }],
  ['y\\s+ss', 'y siguientes', { punto: true }], ['ss', 'siguientes', { punto: true, exacto: true }],
  ['sigs', 'siguientes', { punto: true }], ['sgtes', 'siguientes', { punto: true }], ['sigtes', 'siguientes', { punto: true }],
  ['cc', 'concordantes', { punto: true, exacto: true }], ['conc', 'concordantes', { punto: true }],
  ['Pág', 'página', { punto: true }], ['Págs', 'páginas', { punto: true }], ['pp', 'páginas', { punto: true, conNumero: true }],
  ['p', 'página', { punto: true, conNumero: true, exacto: true }],
  ['Vol', 'volumen', { punto: true }], ['ed', 'edición', { punto: true, exacto: true }],
  ['T', 'tomo', { punto: true, conNumero: true, exacto: true }], ['t', 'tomo', { punto: true, conNumero: true, exacto: true }],
  ['Ts', 'tomos', { punto: true, conNumero: true }], ['Ref', 'referencia', { punto: true }],
  ['Aprox', 'aproximadamente', { punto: true }], ['Atte', 'atentamente', { punto: true }],
  ['Bs\\.\\s?As', 'Buenos Aires', { punto: true }], ['Cap\\.\\s?Fed', 'Capital Federal', { punto: true }],
  ['hs', 'horas', { punto: false, exacto: true }],
];

const REGLAS_ABREVIATURAS = ABREVIATURAS.map(([pat, rep, op = {}]) => {
  const punto = op.punto ? '\\.' : '\\.?';
  const fin = op.conservaPunto ? '' : '';
  const cola = op.conNumero ? NUMERO_DESPUES : '(?![\\p{L}\\p{N}])';
  // sin punto opcional, «Sr» aislado nunca debe comerse la palabra que sigue
  const patron = `${NO_LETRA_ANTES}(${pat})${op.conservaPunto ? '(?=\\.)' : punto}${fin}${cola}`;
  return {
    re: new RegExp(patron, op.exacto ? 'gu' : 'giu'),
    rep,
    conNumero: !!op.conNumero,
  };
});

const FUEROS = { Civ: 'Civil', Com: 'Comercial', Trab: 'del Trabajo', Crim: 'Criminal y Correccional', Fed: 'Civil y Comercial Federal' };

function aplicarAbreviaturas(t) {
  t = t.replace(/(?<![\p{L}\p{N}])Cám(?:ara)?\.?\s*Nac(?:ional)?\.?\s*(?:de\s+Apel(?:aciones)?\.?\s*)?(?:en\s+lo\s+)?(Civ|Com|Trab|Crim|Fed)\.?/giu,
    (m, f) => {
      const fuero = FUEROS[f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()];
      return 'Cámara Nacional de Apelaciones ' + (fuero.startsWith('del') ? fuero : 'en lo ' + fuero);
    });
  for (const regla of REGLAS_ABREVIATURAS) {
    t = t.replace(regla.re, (m, ...r) => mayusculaInicial(m, regla.rep, r[r.length - 2], r[r.length - 1]));
  }
  return t;
}

/* ------------------------------------------------------------------ *
 * Etapas
 * ------------------------------------------------------------------ */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

function limpiezaBasica(t) {
  return t
    .normalize('NFC')
    .replace(/­/g, '')
    .replace(/[    ]/g, ' ')
    .replace(/\r\n?/g, '\n')
    // palabra cortada por guion a fin de renglón
    .replace(/(\p{L})-\n\s*(\p{Ll})/gu, '$1$2')
    // el renglón que no cierra con puntuación sigue en el siguiente; el párrafo, no
    .replace(/([^\n.!?:;,])\n(?!\n)/g, '$1 ')
    .replace(/\n{2,}/g, '\n\n')
    .replace(/([^.!?:;\n])\n\n/g, '$1.\n\n')
    .replace(/\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function quitarEnlaces(t) {
  return t
    .replace(/\bhttps?:\/\/[^\s)]+/gi, 'enlace web')
    .replace(/\bwww\.[^\s)]+/gi, 'enlace web')
    .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, 'dirección de correo');
}

function fechasYHoras(t) {
  // 12/03/2021, 12-03-21
  t = t.replace(/(?<![\d/.-])(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?![\d/-])/g, (m, d, mes, a) => {
    const dia = +d;
    const mm = +mes;
    if (dia < 1 || dia > 31 || mm < 1 || mm > 12) return m;
    let anio = +a;
    if (a.length === 2) anio += anio < 30 ? 2000 : 1900;
    return `${dia === 1 ? 'primero' : numeroALetras(dia)} de ${MESES[mm - 1]} de ${numeroALetras(anio)}`;
  });
  // 1 de marzo, 21 de marzo
  t = t.replace(
    new RegExp(`(?<![\\p{L}\\p{N}.,])(\\d{1,2})(?=\\s+de\\s+(?:${MESES.join('|')})\\b)`, 'giu'),
    (m, d) => (+d === 1 ? 'primero' : numeroALetras(+d)),
  );
  // 10:30 hs, 8:00 horas
  t = t.replace(/(?<![\d:])(\d{1,2}):(\d{2})(?!\d)\s*(hs?\.?|horas)?/gi, (m, h, mi, u) => {
    if (+h > 24 || +mi > 59) return m;
    let s = numeroALetras(+h);
    if (+mi) s += ' y ' + numeroALetras(+mi);
    return u ? s + ' horas' : s;
  });
  return t;
}

function citasDeFallos(t) {
  // Fallos: 330:3248  →  Fallos, tomo 330, página 3248
  return t.replace(/\b(Fallos)\s*:?\s*(\d{1,3})\s*:\s*(\d{1,3}(?:\.\d{3})?)/g,
    (m, f, tomo, pag) => `${f}, tomo ${tomo}, página ${pag}`);
}

function cuit(t) {
  return t.replace(/(?<![\d-])(\d{2})-(\d{8})-(\d)(?![\d-])/g, (m, a, b, c) => {
    const pares = b.match(/\d{2}/g).map((p) => numeroALetras(+p)).join(' ');
    return `${numeroALetras(+a)}, ${pares}, ${numeroALetras(+c)}`;
  });
}

function barrasEspeciales(t) {
  const L = '(?![\\p{L}])';
  return t
    .replace(new RegExp(NO_LETRA_ANTES + 'y\\s?\\/\\s?o' + L, 'giu'), 'y o')
    .replace(new RegExp(NO_LETRA_ANTES + 'c\\/u' + L, 'giu'), 'cada uno')
    .replace(new RegExp(NO_LETRA_ANTES + 's\\/n' + L, 'giu'), 'sin número')
    .replace(new RegExp(NO_LETRA_ANTES + 's\\/f' + L, 'giu'), 'sin fecha')
    .replace(new RegExp(NO_LETRA_ANTES + 'a\\/c' + L, 'giu'), 'a cargo')
    .replace(new RegExp(NO_LETRA_ANTES + 'km\\/h' + L, 'giu'), 'kilómetros por hora')
    // carátulas: «Pérez c/ Gómez s/ daños»
    .replace(/(?<![\p{L}\p{N}])c\s?\/\s?(?=[\p{L}\p{N}"“«¿(])/giu, (m) => (/^C/.test(m) ? 'Contra ' : 'contra '))
    .replace(/(?<![\p{L}\p{N}])s\s?\/\s?(?=[\p{L}\p{N}"“«¿(])/giu, (m) => (/^S/.test(m) ? 'Sobre ' : 'sobre '))
    .replace(/(?<![\p{L}\p{N}])p\s?\/\s?(?=[\p{L}\p{N}"“«¿(])/gu, 'por ')
    .replace(/(?<![\p{L}\p{N}])e\s?\/\s?(?=[\p{L}\p{N}"“«¿(])/gu, 'entre ')
    .replace(/(?<![\p{L}\p{N}])vs?\.?(?=\s+[\p{Lu}\d])/gu, (m) => (/^V/.test(m) ? 'Contra' : 'contra'));
}

const FRACCIONES = { 2: 'medio', 3: 'tercio', 4: 'cuarto', 5: 'quinto', 6: 'sexto', 7: 'séptimo', 8: 'octavo', 9: 'noveno', 10: 'décimo' };

function fracciones(t) {
  return t.replace(/(?<![\d/.])(\d{1,2})\s?\/\s?(\d{1,2})(?![\d/])(?=\s+(?:partes?\s+)?(?:de|del)\b)/g, (m, a, b) => {
    const n = +a;
    const d = +b;
    if (!FRACCIONES[d] || n < 1 || n >= d) return m;
    const nombre = n === 1 ? FRACCIONES[d] : (d === 2 ? 'medios' : FRACCIONES[d] + 's');
    return numeroALetras(n, { forma: 'un' }) + ' ' + nombre;
  });
}

function dineroYPorcentaje(t) {
  const monto = (s, singular, plural, deMiles) => {
    const { entero, dec } = interpretarNumero(s);
    const n = Number(entero);
    if (!Number.isFinite(n)) return s;
    const centavos = dec ? Number((dec + '0').slice(0, 2)) : 0;
    let salida = numeroALetras(n, { forma: 'un' }) + (n >= 1e6 && n % 1e6 === 0 ? ' de ' : ' ') + (n === 1 ? singular : plural);
    if (centavos) salida += ' con ' + numeroALetras(centavos, { forma: 'un' }) + (centavos === 1 ? ' centavo' : ' centavos');
    return salida;
  };
  t = t.replace(/(?<![\p{L}\p{N}])(?:U\$S|u\$s|US\$|U\$D|USD|u\$d)\s*(\d[\d.,]*\d|\d)/gu,
    (m, s) => monto(s, 'dólar estadounidense', 'dólares estadounidenses'));
  t = t.replace(/(?<![\p{L}\p{N}])(?:AR\$|ARS)\s*(\d[\d.,]*\d|\d)/gu, (m, s) => monto(s, 'peso', 'pesos'));
  t = t.replace(/\$\s*(\d[\d.,]*\d|\d)/g, (m, s) => monto(s, 'peso', 'pesos'));
  t = t.replace(/(\d[\d.,]*\d|\d)\s*%/g, (m, s) => leerNumeroSuelto(s, null) + ' por ciento');
  return t;
}

function ordinalesYNumeros(t) {
  // 5°C
  t = t.replace(/(\d+)\s?°\s?C\b/g, (m, n) => `${numeroALetras(+n)} grados`);
  // 1°, 2ª, 3.º
  t = t.replace(/(?<![\p{L}\p{N}])(\d+)\s?\.?\s?([ºª°])(?![\p{L}])/gu, (m, n, s) => ordinal(+n, s === 'ª'));
  // 1ro, 2da, 3er
  t = t.replace(/(?<![\p{L}\p{N}])(\d+)(ro|er|do|to|mo|vo|no|ra|da|ta|ma|va|na)(?![\p{L}])(?:\.(?=\s+\p{Lu}))?/gu, (m, n, suf) => {
    const fem = /a$/.test(suf);
    const o = ordinal(+n, fem);
    return suf === 'er' ? o.replace(/ero$/, 'er') : o;
  });
  // el resto: miles con punto, decimales con coma, enteros
  t = t.replace(/(?<![\p{L}\p{N}])(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(?![\p{L}\p{N}])(?:(\s+)([\p{L}]+))?/gu,
    (m, num, esp, sig) => leerNumeroSuelto(num, sig) + (sig ? esp + sig : ''));
  return t;
}

const CLAVES_ROMANO = '(?:tomo|tomos|capítulo|título|libro|sección|parte|anexo|siglo|apartado|artículo|punto|considerando|inciso|volumen|cuerpo|fojas)';

function romanos(t) {
  // «Sala II», «tomo IV», «siglo XX»
  t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])(sala)\\s+([IVXLCDM]{1,6})(?![\\p{L}\\p{N}])`, 'giu'), (m, k, r) => {
    const n = r === r.toUpperCase() ? romanoANumero(r) : null;
    return n ? `${k} ${ordinal(n, true)}` : m;
  });
  t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])(${CLAVES_ROMANO})\\s+([IVXLCDM]{1,8})(?![\\p{L}\\p{N}.])`, 'giu'), (m, k, r) => {
    const n = r === r.toUpperCase() ? romanoANumero(r) : null;
    return n ? `${k} ${numeroALetras(n)}` : m;
  });
  // «III.- Por ello…», «IV) …» al comienzo de un renglón o de un párrafo
  t = t.replace(/(^|[.!?:;]\s)([IVXLC]{1,5})\s*(?:\.\s?-|\.-|-|\)|\.)\s(?=\p{Lu})/gu, (m, pre, r) => {
    const n = romanoANumero(r);
    return n ? `${pre}${numeroALetras(n)}. ` : m;
  });
  return t;
}

function deletreosYSiglas(t) {
  // V.E., S.S., S.E., V.S.
  t = t.replace(/(?<![\p{L}\p{N}])V\.\s?E\.?(?![\p{L}])/gu, 'Vuestra Excelencia')
    .replace(/(?<![\p{L}\p{N}])S\.\s?S\.?(?![\p{L}])/gu, 'Su Señoría')
    .replace(/(?<![\p{L}\p{N}])S\.\s?E\.?(?![\p{L}])/gu, 'Su Excelencia')
    .replace(/(?<![\p{L}\p{N}])V\.\s?S\.?(?![\p{L}])/gu, 'Vuestra Señoría');
  // siglas con minúsculas: CCyC, CCyCN, NNyA
  t = t.replace(/(?<![\p{L}\p{N}])(?:CCyCN|CCyC|CCivCom|NNyA|CPCyC|CPCCN|CPCCyT|CPCCyT)(?![\p{L}])/gu, (m) => SIGLAS[m.toUpperCase()] || m);
  // Corte IDH
  t = t.replace(/(?<![\p{L}\p{N}])Corte\s?IDH(?![\p{L}])/gu, 'Corte Interamericana de Derechos Humanos')
    .replace(/(?<![\p{L}\p{N}])(?:CNCiv|CNCom|CNTrab|CNCrimCorr|CNFed)(?![\p{L}])/g, (m) => SIGLAS[m.toUpperCase()] || m);
  // C.N.Civ., C.N.Com.
  t = t.replace(/(?<![\p{L}\p{N}])C\.\s?N\.\s?Civ\.?/gu, SIGLAS.CNCIV)
    .replace(/(?<![\p{L}\p{N}])C\.\s?N\.\s?Com\.?/gu, SIGLAS.CNCOM)
    .replace(/(?<![\p{L}\p{N}])C\.\s?N\.\s?A\.\s?T\.?/gu, SIGLAS.CNAT);
  // S.A., S.R.L., C.S.J.N., E.E.U.U., DD.HH. → SA, SRL, CSJN, EEUU, DDHH.
  // Con espacios («S. A.») sólo si el resultado es una sigla conocida: «J. A. Pérez» es un nombre.
  t = t.replace(/(?<![\p{L}\p{N}])((?:\p{Lu}{1,2}\.){2,}|(?:\p{Lu}{1,2}\.\s?)+\p{Lu}{1,2}\.?)(?![\p{L}])/gu, (m) => {
    const junta = m.replace(/[.\s]/g, '');
    return /\s/.test(m.trim()) && (!SIGLAS[junta] || ['LL', 'ED', 'JA', 'DJ'].includes(junta)) ? m : junta;
  });

  // palabras completas en mayúsculas
  return t.replace(/(?<![\p{L}\p{N}])([\p{Lu}]{2,}|[\p{Lu}][\p{Lu}'’-]*[\p{Lu}])(?![\p{L}\p{N}])/gu, (m) => {
    if (/^[IVXLCDM]+$/.test(m) && romanoANumero(m) && m.length > 1) return m; // un romano suelto, que lo resuelva otro
    const clave = m.replace(/['’-]/g, '');
    if (SIGLAS[clave]) return SIGLAS[clave];
    if (PALABRAS_CORTAS.has(clave)) return clave.toLowerCase();
    if (!/[AEIOUÁÉÍÓÚÜ]/.test(clave)) return deletrear(clave);
    return clave.charAt(0) + clave.slice(1).toLowerCase();
  });
}

function puntuacionFinal(t) {
  return t
    // barra restante
    .replace(/\s?\/\s?/g, ' barra ')
    // puntos suspensivos y cortes entre corchetes
    .replace(/[(\[]\s*(?:\.{3}|…)\s*[)\]]/g, ', ')
    .replace(/\.{3,}|…/g, ', ')
    .replace(/[«»“”"‘’]/g, '')
    .replace(/[*_#~|<>]/g, ' ')
    .replace(/§/g, ' parágrafo ')
    .replace(/&/g, ' y ')
    .replace(/@/g, ' arroba ')
    .replace(/\s[–—]\s/g, ', ')
    .replace(/(\p{L})\s?[–—]\s?(\p{L})/gu, '$1, $2')
    // «a)», «b)» de los incisos: se lee la letra
    .replace(/(?<![\p{L}\p{N}])([a-z])\)/gu, '$1,')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=\p{L})/gu, '$1 ')
    .replace(/,\s*,+/g, ', ')
    .replace(/\.\s*\.+/g, '.')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ *
 * Entrada principal
 * ------------------------------------------------------------------ */

/**
 * Lleva el texto de un fallo (o una carátula) a como se diría en voz alta.
 * @param {string} entrada
 * @returns {string}
 */
export function normalizarParaVoz(entrada) {
  let t = limpiezaBasica(String(entrada ?? ''));
  if (!t) return '';
  t = quitarEnlaces(t);
  // «N°», «Nro.», «Núm.» → número
  t = t.replace(/(?<![\p{L}\p{N}])[Nn](?:\.\s?)?[º°o](?![\p{L}])\.?\s*(?=\d)/gu, () => 'número ')
    .replace(/(?<![\p{L}\p{N}])(?:Nro|nro|Núm|núm|Num|num)\.?\s*(?=\d)/gu, () => 'número ');
  t = fechasYHoras(t);
  t = citasDeFallos(t);
  t = cuit(t);
  t = barrasEspeciales(t);
  t = fracciones(t);
  t = aplicarAbreviaturas(t);
  t = deletreosYSiglas(romanos(t));
  t = dineroYPorcentaje(t);
  t = ordinalesYNumeros(t);
  t = puntuacionFinal(t);
  return t;
}
