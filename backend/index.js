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
import rateLimit from 'express-rate-limit';

import {
  PUERTO,
  CORS_ORIGENES,
  DIR_PUBLICO,
  PERMITIR_CUALQUIER_DOMINIO,
  LIMITE_PETICIONES,
  LIMITE_VENTANA_MS,
} from './config.js';
import { router, manejadorErrores } from './routes/extraer.js';
import { router as routerIndice } from './routes/indice.js';
import { router as routerAuth } from './routes/auth.js';

const app = express();

/* ------------------------------------------------------------------ *
 * Middlewares base
 * ------------------------------------------------------------------ */

app.disable('x-powered-by');

// Detras de un proxy (nginx, Render, Railway) esto hace que el rate limit
// vea la IP real del visitante y no la del proxy.
app.set('trust proxy', 1);

// Cuerpos JSON chicos: solo mandamos una URL.
app.use(express.json({ limit: '32kb' }));

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
      cb(new Error(`Origen no permitido por CORS: ${origen}`));
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
    mensaje: 'Frenaste demasiado seguido. Esperá unos minutos y seguí: el límite existe para no castigar a los servidores oficiales.',
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
    mensaje: 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
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
    mensaje: 'El OCR tiene un límite aparte, más bajo, porque es lo más pesado de esta API. Esperá unos minutos.',
  },
});
app.use('/api/ocr', limiteOcr);

/* ------------------------------------------------------------------ *
 * Rutas
 * ------------------------------------------------------------------ */

app.use('/api', router);
app.use('/api', routerIndice);
app.use('/api', routerAuth);
app.use(express.static(DIR_PUBLICO, { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

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

const servidor = app.listen(PUERTO, () => {
  console.log('');
  console.log('  Juris et de jure — servidor de extracción');
  console.log('  ─────────────────────────────────────────');
  console.log(`  Interfaz   http://localhost:${PUERTO}`);
  console.log(`  API        http://localhost:${PUERTO}/api/salud`);
  console.log(`  Dominios   ${PERMITIR_CUALQUIER_DOMINIO ? 'MODO ABIERTO (cualquier dominio público)' : 'solo la lista blanca de config.js'}`);
  console.log(`  CORS       ${CORS_ORIGENES.join(', ')}`);
  console.log('');
  console.log('  Ctrl+C para cortar.');
  console.log('');
});

// Apagado ordenado: dejamos que terminen las peticiones en curso.
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log('\n  Cerrando…');
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}

export default app;
