/**
 * Configuracion central del servidor.
 *
 * Todo lo que puede cambiar entre tu maquina y un servidor real vive aca.
 * Los valores se leen de variables de entorno y, si no existen, se usa un
 * default sensato para desarrollo local.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Raiz del proyecto (una carpeta arriba de /backend, donde vive frontend/). */
export const RAIZ = path.resolve(aqui, '..');

/** Carpeta de archivos estaticos que sirve el backend (hermana de /backend). */
export const DIR_PUBLICO = path.join(RAIZ, 'frontend');

/** Carpeta donde se guarda el cache en disco (propia de este backend). */
export const DIR_CACHE = process.env.DIR_CACHE
  ? path.resolve(process.env.DIR_CACHE)
  : path.join(aqui, 'cache');

/**
 * Carpeta donde vive el indice propio (la "copia guardada" de lo que se fue
 * buscando en los indexadores, ej. lib/indiceMza.js). A diferencia de
 * DIR_CACHE, esto no vence: es la base incremental del robot.
 */
export const DIR_INDICE = process.env.DIR_INDICE
  ? path.resolve(process.env.DIR_INDICE)
  : path.join(aqui, 'indice');

/**
 * Carpeta donde Tesseract guarda el modelo del idioma que descarga la
 * primera vez que se usa el OCR (unos 3-4 MB). Sin esto, la libreria lo
 * tira suelto en el directorio desde donde se arranca el proceso — ni
 * organizado ni obviamente en un lugar escribible en todos los hostings.
 */
export const DIR_OCR_CACHE = process.env.DIR_OCR_CACHE
  ? path.resolve(process.env.DIR_OCR_CACHE)
  : path.join(aqui, 'ocr-cache');

/** Carpeta donde viven las cuentas de usuario y sus sesiones. Nunca al repo. */
export const DIR_USUARIOS = process.env.DIR_USUARIOS
  ? path.resolve(process.env.DIR_USUARIOS)
  : path.join(aqui, 'usuarios');

/** Puerto del servidor HTTP. */
export const PUERTO = Number(process.env.PORT || 3000);

/**
 * Origenes permitidos para CORS.
 *
 * Si abris index.html desde el propio servidor (http://localhost:3000) no
 * hace falta CORS porque es el mismo origen. Esta lista existe para cuando
 * abris el frontend desde otro puerto, por ejemplo Live Server de VS Code
 * en el 5500, o desde un dominio distinto.
 *
 * Se define con CORS_ORIGENES separando por comas. El valor "*" habilita
 * cualquier origen: comodo para probar, desaconsejado si lo publicas.
 */
export const CORS_ORIGENES = (
  process.env.CORS_ORIGENES ||
  'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Milisegundos maximos que esperamos a que el sitio de origen responda. */
export const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 25000);

/** API key del proxy usado por el buscador del TSJ CABA. */
export const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';

/**
 * Si es false, apaga el OCR de PDFs escaneados (ver lib/ocr.js) sin tocar
 * código: sirve para un plan de hosting chico donde renderizar páginas y
 * correr Tesseract sale muy caro en CPU/memoria.
 */
export const OCR_HABILITADO =
  String(process.env.OCR_HABILITADO ?? 'true').toLowerCase() !== 'false';

/**
 * Cuantas paginas como mucho se procesan con OCR en un mismo pedido. Un
 * escaneo de una sentencia puntual son pocas paginas; un expediente entero
 * de cientos de hojas tardaria minutos y no es el caso de uso de este boton.
 */
export const OCR_MAX_PAGINAS = Number(process.env.OCR_MAX_PAGINAS || 20);

/** Tamano maximo de descarga en bytes. Por defecto 25 MB. */
export const MAX_BYTES = Number(process.env.MAX_BYTES || 25 * 1024 * 1024);

/** Cantidad maxima de redirecciones que seguimos a mano. */
export const MAX_REDIRECCIONES = Number(process.env.MAX_REDIRECCIONES || 5);

/** Horas que dura una entrada del cache antes de volver a pedir el documento. */
export const CACHE_HORAS = Number(process.env.CACHE_HORAS || 24);

/** Milisegundos minimos entre dos pedidos al mismo host de origen. */
export const ESPERA_POR_HOST_MS = Number(process.env.ESPERA_POR_HOST_MS || 1500);

/**
 * Cuantas peticiones acepta la API por navegador y cada cuanto se reinicia
 * la cuenta. El limite existe para no castigar a los servidores oficiales.
 *
 * Es configurable porque el numero razonable depende del uso: una persona
 * buscando a mano no llega ni cerca de 40, pero una pagina de resultados que
 * completa los pasajes de a tandas gasta varias por busqueda, y una prueba
 * automatica contra el servidor local necesita muchisimas mas.
 */
export const LIMITE_PETICIONES = Number(process.env.LIMITE_PETICIONES || 120);
export const LIMITE_VENTANA_MS = Number(process.env.LIMITE_VENTANA_MS || 5 * 60 * 1000);

/**
 * User-Agent con el que nos presentamos.
 *
 * Identificarse es buena practica y buena educacion: si un organismo ve
 * trafico raro, tiene a quien escribirle en vez de bloquear a ciegas.
 * Cambia el mail por el tuyo antes de usarlo fuera de tu maquina.
 */
export const USER_AGENT =
  process.env.USER_AGENT ||
  'JurisEtDeJure/1.0 (extractor personal de sentencias; contacto: cambiar@tu-mail.com)';

/**
 * Si es true, el proxy acepta cualquier dominio publico en vez de limitarse
 * a la lista de abajo. Las protecciones contra IPs privadas siguen activas
 * igual: eso no se puede apagar.
 */
export const PERMITIR_CUALQUIER_DOMINIO =
  String(process.env.PERMITIR_CUALQUIER_DOMINIO || 'false').toLowerCase() === 'true';

/**
 * Solo para las pruebas automaticas: habilita descargar de 127.0.0.1.
 * Nunca lo pongas en true en un servidor de verdad.
 */
export const PERMITIR_RED_PRIVADA =
  String(process.env.PERMITIR_RED_PRIVADA || 'false').toLowerCase() === 'true';

/**
 * Dominios de los que aceptamos descargar.
 *
 * Se compara contra el host final, ya resueltas las redirecciones, y acepta
 * subdominios: "csjn.gov.ar" habilita tambien "sjconsulta.csjn.gov.ar".
 *
 * Son las mismas fuentes oficiales del catalogo de Juris et de jure.
 */
export const DOMINIOS_PERMITIDOS = [
  // Mendoza
  'jus.mendoza.gov.ar',
  'jusmendoza.gob.ar',
  'mpfmza.jus.mendoza.gov.ar',
  'mpfmza.gob.ar',
  'boletinoficial.mendoza.gov.ar',
  'boe.mendoza.gov.ar',
  'legislaturamendoza.gov.ar',
  'senadomendoza.gob.ar',
  'mendoza.gov.ar',
  'mendoza.gob.ar',
  'tribunaldecuentas.mendoza.gov.ar',
  'irrigacion.gov.ar',
  'colabogmza.com.ar',
  'jusdeleste.com.ar',
  'magistradosmza.com.ar',
  'mendozalegal.com',
  'uncuyo.edu.ar',
  'bdigital.uncu.edu.ar',

  // Nacional y federal
  'csjn.gov.ar',
  'csjn.gob.ar',
  'pjn.gov.ar',
  'cij.gov.ar',
  'saij.gob.ar',
  'infoleg.gob.ar',
  'boletinoficial.gob.ar',
  'argentina.gob.ar',
  'mpf.gob.ar',
  'mpd.gov.ar',
  'consejomagistratura.gov.ar',
  'justicia.ar',
  'electoral.gob.ar',
  'trabajo.gob.ar',

  // Provincias
  'scba.gov.ar',
  'justiciacordoba.gob.ar',
  'justiciasantafe.gov.ar',
  'jussanjuan.gov.ar',
  'justiciasanluis.gov.ar',
  'jusneuquen.gov.ar',
  'jusrionegro.gov.ar',
  'jussantiago.gov.ar',
  'jusbaires.gob.ar',
  'tsjbaires.gov.ar',

  // Internacional
  'corteidh.or.cr',
  'oas.org',
  'echr.coe.int',
  'coe.int',
  'ohchr.org',
  'icj-cij.org',
  'icc-cpi.int',
  'legal-tools.org',
  'curia.europa.eu',
  'europa.eu',
  'refworld.org',
  'tprmercosur.org',
  'worldlii.org',
  'poderjudicial.es',
  'tribunalconstitucional.es',
  'corteconstitucional.gov.co',
  'scjn.gob.mx',
  'stf.jus.br',
  'stj.jus.br',
  'pjud.cl',
  'poderjudicial.gub.uy',
  'tc.gob.pe',
  'supremecourt.gov',
  'courtlistener.com',
  'uncitral.un.org',
  'un.org',

  // Doctrina de acceso libre
  'pensamientopenal.com.ar',
  'diariojudicial.com',
  'scielo.org.ar',
  'dialnet.unirioja.es',
  'sedici.unlp.edu.ar',
];
