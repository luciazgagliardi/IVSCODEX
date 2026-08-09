/**
 * Errores de la aplicacion.
 *
 * La idea es que cada fallo llegue al frontend con un codigo estable
 * (para que el JS pueda decidir) y un mensaje en castellano que la persona
 * pueda leer y entender que hacer. Nada de "Error 500" a secas.
 */

export class ErrorApp extends Error {
  /**
   * @param {string} codigo   identificador estable, ej. DOMINIO_NO_PERMITIDO
   * @param {string} mensaje  texto para mostrarle a la persona
   * @param {number} http     codigo de estado HTTP
   * @param {object} [extra]  datos adicionales opcionales
   */
  constructor(codigo, mensaje, http = 400, extra = {}) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.codigo = codigo;
    this.http = http;
    this.extra = extra;
  }

  aJSON() {
    return {
      ok: false,
      codigo: this.codigo,
      mensaje: this.message,
      ...this.extra,
    };
  }
}

export const errores = {
  urlFaltante: () =>
    new ErrorApp(
      'URL_FALTANTE',
      'Falta el enlace. Pegá la URL del fallo y volvé a intentar.',
      400
    ),

  urlInvalida: (detalle) =>
    new ErrorApp(
      'URL_INVALIDA',
      `Ese enlace no se entiende como una dirección web${detalle ? ': ' + detalle : ''}. Tiene que empezar con http:// o https://`,
      400
    ),

  esquemaInvalido: (esquema) =>
    new ErrorApp(
      'ESQUEMA_INVALIDO',
      `Solo se pueden descargar enlaces http o https. Recibí "${esquema}".`,
      400
    ),

  dominioNoPermitido: (host) =>
    new ErrorApp(
      'DOMINIO_NO_PERMITIDO',
      `El dominio "${host}" no está en la lista de fuentes habilitadas. Agregalo en server/config.js si es una fuente oficial que querés usar.`,
      403,
      { host }
    ),

  redPrivada: (host, ip) =>
    new ErrorApp(
      'RED_PRIVADA',
      `"${host}" resuelve a una dirección interna (${ip}). El servidor no descarga de la red privada por seguridad.`,
      403
    ),

  demasiadasRedirecciones: (n) =>
    new ErrorApp(
      'DEMASIADAS_REDIRECCIONES',
      `El sitio encadenó más de ${n} redirecciones. Probablemente pide iniciar sesión o usar un formulario.`,
      502
    ),

  tiempoAgotado: (ms) =>
    new ErrorApp(
      'TIEMPO_AGOTADO',
      `El sitio no respondió en ${Math.round(ms / 1000)} segundos. Puede estar caído o lento; probá de nuevo en un rato.`,
      504
    ),

  respuestaNoOk: (estado, host) =>
    new ErrorApp(
      'RESPUESTA_NO_OK',
      `"${host}" respondió ${estado}. Si es 403 o 404, revisá que el enlace sea el del documento y no el del buscador.`,
      502,
      { estadoOrigen: estado }
    ),

  demasiadoGrande: (max) =>
    new ErrorApp(
      'DEMASIADO_GRANDE',
      `El archivo supera el límite de ${Math.round(max / 1024 / 1024)} MB. Descargalo a mano y pegá el texto en el lector.`,
      413
    ),

  tipoNoSoportado: (tipo) =>
    new ErrorApp(
      'TIPO_NO_SOPORTADO',
      `El servidor devolvió "${tipo || 'un tipo desconocido'}". Este extractor trabaja con páginas HTML y con PDF.`,
      415,
      { tipo }
    ),

  pdfEscaneado: (paginas) =>
    new ErrorApp(
      'PDF_ESCANEADO',
      `El PDF tiene ${paginas} página(s) pero no contiene texto: es un escaneo, una imagen. Para leerlo hace falta OCR (mirá la sección "PDFs escaneados" del README).`,
      422,
      { paginas }
    ),

  pdfIlegible: (detalle) =>
    new ErrorApp(
      'PDF_ILEGIBLE',
      `No pude abrir el PDF${detalle ? ': ' + detalle : ''}. Puede estar protegido con contraseña o dañado.`,
      422
    ),

  htmlSinTexto: () =>
    new ErrorApp(
      'HTML_SIN_TEXTO',
      'La página cargó pero no tiene texto aprovechable. Suele pasar cuando el contenido se arma con JavaScript o vive dentro de un frame: en ese caso, abrila en el navegador y pegá el texto a mano.',
      422
    ),

  redInalcanzable: (host, detalle) =>
    new ErrorApp(
      'RED_INALCANZABLE',
      `No pude conectarme con "${host}"${detalle ? ' (' + detalle + ')' : ''}. Revisá tu conexión y que el sitio esté en línea.`,
      502
    ),
};
