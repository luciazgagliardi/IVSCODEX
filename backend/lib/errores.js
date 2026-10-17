/**
 * Errores de la aplicacion.
 *
 * La idea es que cada fallo llegue al frontend con un codigo estable
 * (para que el JS pueda decidir) y un mensaje en castellano que la persona
 * pueda leer y entender que hacer. Nada de "Error 500" a secas.
 */

/**
 * Todo lo que llega de afuera (una URL, un nombre de archivo, el mensaje de
 * un error de red) y se repite dentro de un mensaje pasa por acá: sin
 * caracteres de control, sin comillas ni signos de marcado, y con tope de
 * largo. Evita que un pedido arme un mensaje a medida (HTML, saltos de
 * línea, textos enormes) que después se muestre en pantalla.
 */
const lim = (valor, max = 80) =>
  String(valor ?? '')
    .replace(/[\u0000-\u001f\u007f<>"'`]/g, '')
    .slice(0, max);

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
      'Falta el enlace. Pegue la URL del fallo y vuelva a intentar.',
      400
    ),

  urlInvalida: (detalle) =>
    new ErrorApp(
      'URL_INVALIDA',
      `Ese enlace no se entiende como una dirección web${detalle ? ': ' + lim(detalle, 160) : ''}. Tiene que empezar con http:// o https://`,
      400
    ),

  esquemaInvalido: (esquema) =>
    new ErrorApp(
      'ESQUEMA_INVALIDO',
      `Solo se pueden descargar enlaces http o https. Recibí "${lim(esquema, 20)}".`,
      400
    ),

  dominioNoPermitido: (host) =>
    new ErrorApp(
      'DOMINIO_NO_PERMITIDO',
      `El dominio "${lim(host, 100)}" no está en la lista de fuentes habilitadas.`,
      403,
      { host }
    ),

  redPrivada: (host, ip) =>
    new ErrorApp(
      'RED_PRIVADA',
      `"${lim(host, 100)}" resuelve a una dirección interna. El servidor no descarga de la red privada por seguridad.`,
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
      `El sitio no respondió en ${Math.round(ms / 1000)} segundos. Puede estar caído o lento; pruebe de nuevo en un rato.`,
      504
    ),

  respuestaNoOk: (estado, host, hostOriginal) => {
    // Cuando hubo una redireccion a otro host, el consejo de "revisa el
    // enlace" es equivocado: el enlace estaba bien, el que no contesta es el
    // sitio al que TE MANDARON. Le pasa a los PDF del TSJ de CABA, que
    // redirigen a www-test.tsjbaires.gov.ar y ese host le da 403 al servidor
    // (desde un navegador comun baja sin problema).
    const redirigido = hostOriginal && hostOriginal !== host;
    const detalle = redirigido
      ? `El enlace de "${hostOriginal}" redirige a "${host}", y ese sitio le respondió ${estado} a este servidor. No es un problema del enlace: desde su navegador probablemente abra bien. Ábralo y suba el archivo aquí.`
      : `"${host}" respondió ${estado}. Si es 403 o 404, revise que el enlace sea el del documento y no el del buscador.`;
    return new ErrorApp('RESPUESTA_NO_OK', detalle, 502, { estadoOrigen: estado, host, redirigido: !!redirigido });
  },

  demasiadoGrande: (max) =>
    new ErrorApp(
      'DEMASIADO_GRANDE',
      `El archivo supera el límite de ${Math.round(max / 1024 / 1024)} MB. Descárguelo a mano y pegue el texto en el Lector.`,
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
      `El PDF tiene ${paginas} página(s) pero no contiene texto: es un escaneo, una imagen. Se le puede aplicar OCR (ver POST /api/ocr, o el botón "Aplicar OCR" en el Lector) para reconocer el texto a partir de la imagen.`,
      422,
      { paginas }
    ),

  ocrDeshabilitado: () =>
    new ErrorApp(
      'OCR_DESHABILITADO',
      'El OCR está apagado en este servidor. Pase el PDF por ocrmypdf a mano (ver el README) o pegue el texto en el Lector.',
      503
    ),

  ocrSoloPdf: (tipo) =>
    new ErrorApp(
      'OCR_SOLO_PDF',
      `El OCR solo sabe leer PDF; esto era "${tipo || 'de otro tipo'}".`,
      415
    ),

  ocrSinTexto: () =>
    new ErrorApp(
      'OCR_SIN_TEXTO',
      'El OCR no pudo reconocer texto en ninguna página. Puede ser una foto de muy mala calidad, estar en blanco, o tener una orientación o rotación rara.',
      422
    ),

  ocrTiempoAgotado: (ms) =>
    new ErrorApp(
      'OCR_TIEMPO_AGOTADO',
      `El OCR no terminó en ${Math.round(ms / 1000)} segundos y se lo dio por perdido. Puede ser un documento muy largo o un servidor con poca CPU en este momento; pruebe con menos páginas o de nuevo más tarde.`,
      504
    ),

  pdfIlegible: (detalle) =>
    new ErrorApp(
      'PDF_ILEGIBLE',
      `No se pudo abrir el PDF${detalle ? ': ' + lim(detalle, 160) : ''}. Puede estar protegido con contraseña o dañado.`,
      422
    ),

  htmlSinTexto: () =>
    new ErrorApp(
      'HTML_SIN_TEXTO',
      'La página cargó pero no tiene texto aprovechable. Suele pasar cuando el contenido se arma con JavaScript o vive dentro de un frame: en ese caso, ábrala en el navegador y pegue el texto a mano.',
      422
    ),

  archivoVacio: () =>
    new ErrorApp(
      'ARCHIVO_VACIO',
      'No llegó ningún archivo. Elija un PDF o un .doc y vuelva a intentar.',
      400
    ),

  archivoNoSoportado: (nombre) =>
    new ErrorApp(
      'ARCHIVO_NO_SOPORTADO',
      `No se puede leer ${nombre ? `"${lim(nombre, 80)}"` : 'ese archivo'}: se leen PDF y .doc de Word. Si es un .docx, ábralo y guárdelo como PDF, o copie el texto y péguelo a mano.`,
      415
    ),

  docIlegible: (detalle) =>
    new ErrorApp(
      'DOC_ILEGIBLE',
      `No se pudo leer el documento .doc${detalle ? ': ' + lim(detalle, 160) : ''}. Puede estar dañado o vacío.`,
      422
    ),

  redInalcanzable: (host, detalle) =>
    new ErrorApp(
      'RED_INALCANZABLE',
      `No se pudo conectar con "${host}"${detalle ? ' (' + lim(detalle, 120) + ')' : ''}. Revise su conexión y que el sitio esté en línea.`,
      502
    ),

  consultaVacia: () =>
    new ErrorApp(
      'CONSULTA_VACIA',
      'Escriba algo para buscar antes de consultar el índice.',
      400
    ),

  citaVacia: () =>
    new ErrorApp(
      'CITA_VACIA',
      'Pegue el texto de la cita que desea verificar (por ejemplo: CSJN, "Halabi", Fallos: 332:111).',
      400
    ),

  // Una cita entra en un renglón o dos. Si llega un escrito entero es que se
  // pegó lo que no era: se corta acá y no en el parser, para no gastar
  // expresiones regulares —y menos una búsqueda contra un sitio oficial— en
  // procesar veinte páginas de texto.
  citaDemasiadoLarga: (max) =>
    new ErrorApp(
      'CITA_DEMASIADO_LARGA',
      `Eso supera los ${max} caracteres: es un escrito, no una cita. Pegue solo la cita que desea verificar, de a una por vez.`,
      413
    ),

  indiceMzaFalla: (detalle) =>
    new ErrorApp(
      'INDICE_MZA_FALLA',
      `El buscador de la SCJM no respondió como se esperaba${detalle ? ': ' + lim(detalle, 160) : ''}. Puede estar caído o haber cambiado de formato; pruebe de nuevo en un rato.`,
      502
    ),

  indiceFuenteFalla: (fuente, detalle) =>
    new ErrorApp(
      'INDICE_FUENTE_FALLA',
      `El buscador de "${fuente}" no respondió como se esperaba${detalle ? ': ' + lim(detalle, 160) : ''}. Puede estar caído, lento o haber cambiado de formato; pruebe de nuevo en un rato.`,
      502,
      { fuente }
    ),

  normaDesconocida: (clave) =>
    new ErrorApp(
      'NORMA_DESCONOCIDA',
      `No tengo cargada la norma "${lim(clave, 40)}". Por ahora se pueden consultar el Código Civil y Comercial, la Constitución, la LCT, la Ley de Concursos, la de Procedimientos Administrativos y la de Amparo.`,
      400
    ),

  articuloInvalido: (num) =>
    new ErrorApp(
      'ARTICULO_INVALIDO',
      `"${lim(num, 20)}" no parece un número de artículo. Escriba sólo el número (por ejemplo 1741, o "76 bis").`,
      400
    ),

  articuloNoEncontrado: (num, norma) =>
    new ErrorApp(
      'ARTICULO_NO_ENCONTRADO',
      `No se encontró el artículo ${lim(num, 20)} en ${lim(norma, 80)}. Puede que no exista, que esté derogado, o que ese número corresponda a otra norma.`,
      404
    ),

  emailFaltante: () =>
    new ErrorApp('EMAIL_FALTANTE', 'Falta el correo electrónico.', 400),

  emailInvalido: () =>
    new ErrorApp('EMAIL_INVALIDO', 'Ese correo electrónico no parece válido.', 400),

  passwordDebil: () =>
    new ErrorApp(
      'PASSWORD_DEBIL',
      'La contraseña debe tener entre 8 y 128 caracteres y no puede ser igual al correo.',
      400
    ),

  emailYaRegistrado: () =>
    new ErrorApp(
      'EMAIL_YA_REGISTRADO',
      'Ya existe una cuenta con ese correo. Inicie sesión en vez de registrarse de nuevo.',
      409
    ),

  credencialesInvalidas: () =>
    new ErrorApp(
      'CREDENCIALES_INVALIDAS',
      'El correo o la contraseña no coinciden.',
      401
    ),

  demasiadosIntentos: () =>
    new ErrorApp(
      'DEMASIADOS_INTENTOS',
      'Demasiados intentos con esa cuenta. Espere unos minutos y vuelva a probar.',
      429
    ),

  cuerpoDemasiado: () =>
    new ErrorApp('CUERPO_DEMASIADO_GRANDE', 'El pedido es más grande de lo permitido.', 413),

  cuerpoInvalido: () =>
    new ErrorApp('PEDIDO_INVALIDO', 'El pedido no tiene un formato válido.', 400),

  prohibido: () =>
    new ErrorApp('PROHIBIDO', 'Esta operación no está permitida.', 403),

  noAutenticado: () =>
    new ErrorApp(
      'NO_AUTENTICADO',
      'Inicie sesión para hacer esto.',
      401
    ),

  /* --- Propuestas del tesauro (lib/proponerAnillo.js) --- */

  modeloNoConfigurado: () =>
    new ErrorApp(
      'MODELO_NO_CONFIGURADO',
      'Las propuestas de terminos equivalentes necesitan una clave de API configurada en el servidor. Todo lo demas del buscador funciona igual.',
      503
    ),

  modeloSeNego: () =>
    new ErrorApp(
      'MODELO_SE_NEGO',
      'El asistente no quiso responder a esa consulta. Proba con el termino juridico solo, sin el caso alrededor.',
      422
    ),

  modeloRespuestaIlegible: () =>
    new ErrorApp(
      'MODELO_RESPUESTA_ILEGIBLE',
      'La propuesta volvio en un formato que no se pudo leer. Proba de nuevo.',
      502
    ),

  modeloClaveInvalida: () =>
    new ErrorApp(
      'MODELO_CLAVE_INVALIDA',
      'El servidor tiene una clave de API cargada, pero Anthropic la rechazo. Revisa que este bien copiada (entera, sin espacios) y que la cuenta tenga credito.',
      502
    ),

  modeloFalla: (detalle) =>
    new ErrorApp(
      'MODELO_FALLA',
      'No se pudo pedir la propuesta' + (detalle ? ': ' + detalle : '.') + ' Todo lo demas del buscador funciona igual.',
      502
    ),
};
