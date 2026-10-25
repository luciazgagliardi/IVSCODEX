/**
 * Servidor de Juris et de jure.
 *
 * Hace tres cosas y nada mas:
 *   1. Sirve el frontend estatico desde /public
 *   2. Expone /api/extraer, que descarga un documento judicial y devuelve su texto
 *   3. Se porta bien: limita peticiones, se identifica y no toca la red interna
 *
 * Arranque:  npm start        (http://localhost:3000)
 * Desarrollo: npm run dev     (se reinicia solo al guardar)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import {
  PUERTO,
  CORS_ORIGENES,
  DIR_PUBLICO,
  PERMITIR_CUALQUIER_DOMINIO,
  LIMITE_PETICIONES,
  LIMITE_VENTANA_MS,
  LIMITE_CITAS,
  LIMITE_CITAS_VENTANA_MS, DIR_DATOS, DATOS_PERSISTEN } from './config.js';
import { router, manejadorErrores } from './routes/extraer.js';
import { router as routerIndice } from './routes/indice.js';
import { router as routerAuth } from './routes/auth.js';
import { router as routerCitas } from './routes/citas.js';

const app = express();

/* ------------------------------------------------------------------ *
 * Middlewares base
 * ------------------------------------------------------------------ */

app.disable('x-powered-by'); // no anunciar que es Express (reconocimiento de la tecnología)

/**
 * Cabeceras de seguridad (helmet) + política de contenido (CSP).
 *
 * - CSP: aunque se colara un script ajeno en un texto, el navegador no lo
 *   ejecuta (script-src) ni manda datos a un servidor que no esté en la lista
 *   (connect-src), no se puede incrustar la página en otro sitio (frame-ancestors 'self',
 *   previene clickjacking) ni cambiar a dónde apuntan los enlaces relativos
 *   (base-uri). La página usa scripts y estilos en línea, por eso
 *   'unsafe-inline'; el resto es lo más cerrado que permite su estructura.
 * - HSTS: el navegador deja de aceptar http:// para este dominio.
 * - nosniff: el navegador no adivina el tipo de un archivo (evita que un
 *   texto subido se interprete como script).
 * - Referrer-Policy: no se filtran las URL internas hacia otros sitios.
 * - CORP cross-origin: el frontend vive en otro dominio (GitHub Pages) y
 *   necesita leer las respuestas de la API.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", 'https://www.saij.gob.ar', 'https://apis.datos.gob.ar'],
        'object-src': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"], // la portada vive en un marco de la misma página; ningún otro sitio puede enmarcarla
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  })
);
// Permisos del navegador que esta aplicación nunca usa.
app.use((_req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

// Detras de un proxy (nginx, Render, Railway) esto hace que el rate limit
// vea la IP real del visitante y no la del proxy.
app.set('trust proxy', 1);

// Cuerpos JSON chicos: solo mandamos una URL.
app.use(express.json({ limit: '32kb', strict: true }));

/**
 * CORS.
 *
 * Si abris el frontend desde el propio servidor (http://localhost:3000) no
 * interviene, porque es el mismo origen. Sirve para cuando lo levantas con
 * Live Server en el 5500 o lo publicas en otro dominio.
 */
app.use(
  cors({
    origin(origen, cb) {
      // Sin cabecera Origin: curl, Postman, o el propio navegador en same-origin.
      if (!origen) return cb(null, true);
      if (CORS_ORIGENES.includes('*') || CORS_ORIGENES.includes(origen)) {
        return cb(null, true);
      }
      // Un origen que no está en la lista no recibe las cabeceras CORS y el
      // navegador bloquea la respuesta: no hace falta (ni conviene) tirar un
      // error 500 por cada visita de un sitio ajeno.
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Nombre-Archivo'],
    maxAge: 86400,
  })
);

/* ------------------------------------------------------------------ *
 * Limite de peticiones
 * ------------------------------------------------------------------ */

const limite = rateLimit({
  windowMs: LIMITE_VENTANA_MS,
  limit: LIMITE_PETICIONES,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    codigo: 'DEMASIADAS_PETICIONES',
    mensaje: 'Se hicieron demasiadas consultas seguidas. Espere unos minutos y continúe: el límite existe para no castigar a los servidores oficiales.',
  },
});
app.use('/api/', limite);

// Login y registro se limitan aparte y más estricto: son el blanco típico
// de la fuerza bruta de contraseñas.
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    codigo: 'DEMASIADAS_PETICIONES',
    mensaje: 'Demasiados intentos. Espere unos minutos y vuelva a probar.',
  },
});
app.use('/api/auth/login', limiteAuth);
app.use('/api/auth/registro', limiteAuth);

// El OCR es carísimo comparado con todo lo demás de esta API (renderiza
// páginas y corre un reconocimiento de imagen a texto, segundos por
// página): un límite aparte y bien chico evita que alguien tumbe el
// servidor mandando PDFs de 20 páginas en bucle.
const limiteOcr = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    codigo: 'DEMASIADAS_PETICIONES',
    mensaje: 'El OCR tiene un límite aparte, más bajo, porque es lo más pesado de esta API. Espere unos minutos.',
  },
});
app.use('/api/ocr', limiteOcr);
app.use('/api/ocr-archivo', limiteOcr);

// Subir un archivo cuesta memoria (hasta MAX_BYTES por pedido) y proceso: un
// límite propio evita que alguien agote el servidor con subidas en bucle.
const limiteArchivos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    codigo: 'DEMASIADAS_PETICIONES',
    mensaje: 'Se subieron demasiados archivos seguidos. Espere unos minutos y vuelva a probar.',
  },
});
app.use('/api/extraer-archivo', limiteArchivos);

// El verificador de citas es liviano para este servidor —parsear un renglón
// de texto— pero cada pedido dispara hasta dos búsquedas de verdad contra
// buscadores oficiales. El límite no protege esta máquina: protege a esos
// sitios, igual que la espera entre pedidos de lib/descargador.js. Ver
// LIMITE_CITAS en config.js para el porqué del número.
const limiteCitas = rateLimit({
  windowMs: LIMITE_CITAS_VENTANA_MS,
  limit: LIMITE_CITAS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    codigo: 'DEMASIADAS_PETICIONES',
    mensaje: 'El verificador de citas tiene un límite aparte: cada consulta le pega a los buscadores oficiales de verdad. Espere unos minutos y continúe.',
  },
});
app.use('/api/verificar-cita', limiteCitas);

// Dos rutas con costo externo propio: la propuesta de sinónimos gasta saldo de
// una API de pago, y el estado de las fuentes dispara una búsqueda real en
// cada sitio oficial. Un límite aparte, bajo, evita el abuso (gasto ajeno y
// carga contra terceros).
const limiteCostoso = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    codigo: 'DEMASIADAS_PETICIONES',
    mensaje: 'Se alcanzó el límite de esta operación. Espere un rato y vuelva a intentar.',
  },
});
app.use('/api/tesauro/proponer', limiteCostoso);
app.use('/api/fuentes/estado', limiteCostoso);
app.use('/api/cache', limiteCostoso);

/* ------------------------------------------------------------------ *
 * Rutas
 * ------------------------------------------------------------------ */

app.use('/api', router);
app.use('/api', routerIndice);
app.use('/api', routerAuth);
app.use('/api', routerCitas);
app.use(express.static(DIR_PUBLICO, { extensions: ['html'], dotfiles: 'ignore', index: 'index.html', maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      ok: false,
      codigo: 'RUTA_INEXISTENTE',
      mensaje: `No existe ${req.method} ${req.path}.`,
    });
  }
  res.status(404).send('Página no encontrada.');
});

app.use(manejadorErrores);

/* ------------------------------------------------------------------ *
 * Arranque
 * ------------------------------------------------------------------ */

import { mudarDatosSiHaceFalta } from './lib/mudarDatos.js';
import { prepararAcervo } from './lib/acervo.js';
import { actualizarCorpus } from './lib/corpusCorteidh.js';
import { listarTodo } from './lib/indiceCorteidh.js';

// Antes de atender a nadie: rescatar lo que haya quedado en el lugar viejo.
// Es de una sola vez y no pisa nada; si falla, se avisa y se sigue.
const mudanza = await mudarDatosSiHaceFalta().catch((e) => ({ mudo: false, detalle: [e.message] }));

// El acervo (lib/acervo.js): la base grande en disco. Si las tandas que vinieron con
// este despliegue son de otra versión, se importan de fondo; mientras tanto, el respaldo.
prepararAcervo().then((e) => { if (e.activo || e.importando) console.log(`  Acervo     ${e.activo ? `versión ${e.version}` : 'sin base todavía'}${e.importando ? ' · importando la versión nueva de fondo' : ''}`); else if (e.error) console.log(`  Acervo     apagado: ${e.error}`); });

const servidor = app.listen(PUERTO, () => {
  console.log('');
  console.log('  Juris et de jure — servidor de extracción');
  console.log('  ─────────────────────────────────────────');
  console.log(`  Interfaz   http://localhost:${PUERTO}`);
  console.log(`  API        http://localhost:${PUERTO}/api/salud`);
  console.log(`  Dominios   ${PERMITIR_CUALQUIER_DOMINIO ? 'MODO ABIERTO (cualquier dominio público)' : 'solo la lista blanca de config.js'}`);
  console.log(`  CORS       ${CORS_ORIGENES.join(', ')}`);
  // Que quede escrito en el log dónde viven las cuentas: si algún día vuelven
  // a guardarse junto al código, un despliegue se las lleva y hay que verlo
  // acá antes de que pase, no después.
  console.log(`  Datos      ${DIR_DATOS}${DATOS_PERSISTEN ? ' (sobreviven a los despliegues)' : ' (junto al código)'}`);
  if (mudanza.mudo) console.log(`  Mudanza    ${mudanza.detalle.join(' · ')}`);
  console.log('');
  console.log('  Ctrl+C para cortar.');
  console.log('');
});

// Índice de texto de la Corte IDH (lib/corpusCorteidh.js): en el servidor
// publicado, donde los datos sobreviven a los despliegues. Arranca un rato
// después de levantar, para no competir con el arranque, y se repite una vez por
// día para sumar las sentencias nuevas. En una máquina local no corre salvo que
// se pida con CORPUS_CORTEIDH=1 (son cientos de PDF).
if (process.env.CORPUS_CORTEIDH === '1' || (DATOS_PERSISTEN && process.env.CORPUS_CORTEIDH !== '0')) {
  const correr = () =>
    actualizarCorpus(listarTodo, { log: (m) => console.log(m) }).catch((e) => console.error('[corteidh] falló la actualización:', e.message));
  setTimeout(correr, 90_000).unref();
  setInterval(correr, 24 * 60 * 60_000).unref();
}

// Apagado ordenado: dejamos que terminen las peticiones en curso.
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log('\n  Cerrando…');
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}

export default app;
