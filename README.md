# Juris et de jure — extractor de sentencias

Pegás el enlace de un fallo argentino (o internacional) de una base oficial, el servidor lo descarga,
le saca el texto —sirve HTML y PDF— y te lo muestra en la página con tu búsqueda resaltada,
los pasajes recortados con contexto y la cita armada.

**No genera ni resume jurisprudencia.** El texto que ves es el del documento oficial que indicaste.

---

## 1. Estructura de carpetas

```
juris-et-de-jure/
├── package.json              Dependencias y scripts
├── .env.example              Plantilla de configuración (copiala como .env)
├── .gitignore
├── README.md                 Este archivo
│
├── server/
│   ├── index.js              Express: CORS, rate limit, estáticos, arranque
│   ├── config.js             Variables de entorno y lista blanca de dominios
│   │
│   ├── routes/
│   │   └── extraer.js        POST /api/extraer y rutas auxiliares
│   │
│   └── lib/
│       ├── descargador.js    Descarga segura: SSRF, redirecciones, charset
│       ├── extraerHtml.js    Readability + limpieza propia de respaldo
│       ├── extraerPdf.js     pdf.js: líneas, párrafos, detección de escaneos
│       ├── cache.js          Caché en disco con vencimiento
│       └── errores.js        Errores tipados con mensaje en castellano
│
├── public/                   Frontend estático
│   ├── index.html            Formulario, botón y contenedor del texto
│   ├── script.js             Llamada a la API, resaltado, pasajes, cita
│   └── styles.css            Estilos
│
├── test/
│   └── prueba.js             33 pruebas: extracción, seguridad, errores
│
└── cache/                    Se crea sola. Podés borrarla cuando quieras.
```

---

## 2. Guía de ejecución paso a paso

### Requisitos

**Node.js 18.17 o superior.** Verificá con:

```bash
node --version
```

Si no lo tenés, bajalo de [nodejs.org](https://nodejs.org) (la versión LTS).

### Puesta en marcha

```bash
# 1. Entrá a la carpeta del proyecto
cd juris-et-de-jure

# 2. Instalá las librerías (tarda un minuto la primera vez)
npm install

# 3. Copiá la configuración de ejemplo (opcional: anda igual sin esto)
cp .env.example .env        # en Windows: copy .env.example .env

# 4. Levantá el servidor
npm start
```

Vas a ver:

```
  Juris et de jure — servidor de extracción
  ─────────────────────────────────────────
  Interfaz   http://localhost:3000
  API        http://localhost:3000/api/salud
  Dominios   solo la lista blanca de config.js
```

### Abrir la página

Entrá a **http://localhost:3000** en el navegador. El punto verde arriba a la derecha
confirma que el frontend habla con el servidor.

Pegá el enlace de un fallo, escribí qué querés resaltar y tocá **Procesar el enlace**.

### Comandos útiles

```bash
npm run dev             # se reinicia solo al guardar cambios
npm test                # corre las 33 pruebas
npm run limpiar-cache   # vacía la caché
```

Para cortar el servidor: **Ctrl+C**.

---

## 3. La API

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/extraer` | Cuerpo `{ "url": "...", "refrescar": false }`. Devuelve el texto. |
| `GET` | `/api/salud` | Estado del servidor. |
| `GET` | `/api/dominios` | Lista blanca vigente. |
| `GET` | `/api/verificar?url=` | Dice si un enlace es procesable, sin descargarlo. |
| `DELETE` | `/api/cache` | Vacía la caché. |

Prueba rápida desde la terminal:

```bash
curl -X POST http://localhost:3000/api/extraer \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.cij.gov.ar/nota-33352-Bolet-n-de-jurisprudencia-de-la-C-mara-Federal-de-Mendoza.html"}'
```

Respuesta:

```json
{
  "ok": true,
  "tipo": "html",
  "titulo": "…",
  "texto": "…",
  "caracteres": 18432,
  "palabras": 2911,
  "metodo": "readability",
  "desdeCache": false,
  "ms": 1840
}
```

Ante un error siempre llega JSON con `codigo` (estable, para el frontend) y `mensaje`
(en castellano, para vos): `DOMINIO_NO_PERMITIDO`, `PDF_ESCANEADO`, `HTML_SIN_TEXTO`,
`TIEMPO_AGOTADO`, `RESPUESTA_NO_OK`, `DEMASIADO_GRANDE`, `RED_PRIVADA`…

---

## 4. Configuración

Todo se ajusta por variables de entorno en `.env`. Lo más habitual:

| Variable | Default | Para qué |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `CORS_ORIGENES` | localhost 3000 y 5500 | Desde dónde se puede llamar a la API |
| `TIMEOUT_MS` | `25000` | Cuánto esperamos al sitio de origen |
| `MAX_BYTES` | `26214400` (25 MB) | Tope de descarga |
| `CACHE_HORAS` | `24` | Duración de la caché (`0` la desactiva) |
| `ESPERA_POR_HOST_MS` | `1500` | Pausa mínima entre pedidos al mismo sitio |
| `PERMITIR_CUALQUIER_DOMINIO` | `false` | `true` acepta cualquier dominio público |

**Agregar una fuente:** abrí `server/config.js`, sumá el dominio a `DOMINIOS_PERMITIDOS`
y reiniciá. Acepta subdominios: poniendo `csjn.gov.ar` habilitás también `sjconsulta.csjn.gov.ar`.

---

## 5. Seguridad: por qué la lista blanca no es un capricho

Un servidor que descarga "cualquier URL que le manden" es una vulnerabilidad conocida
llamada **SSRF**. Alguien te pasa `http://169.254.169.254/` (la IP de metadatos de AWS,
Azure y Google Cloud) y tu propio servidor le trae las credenciales. O `http://192.168.1.1`
y le mapea tu red.

Por eso, **antes de cada salto de red** el descargador:

1. exige `http` o `https` — nada de `file:`, `ftp:`, `gopher:`
2. exige que el dominio esté en la lista blanca
3. resuelve el DNS y rechaza si apunta a una IP interna
4. sigue las redirecciones **a mano**, repitiendo 1, 2 y 3 en cada salto

El punto 4 es el que se olvida siempre: un dominio público puede redirigir a `127.0.0.1`
y, si dejás que `fetch` siga los redirects solo, no te enterás. Hay una prueba automática
que verifica justamente eso.

Si lo publicás en internet, activá HTTPS y no toques `PERMITIR_RED_PRIVADA`.

---

## 6. Ser buen vecino con los servidores oficiales

Esto no es un scraper masivo: baja **un documento por vez, el que vos pediste**.
Aun así trae tres cosas que conviene no sacar:

- **Pausa entre pedidos al mismo sitio** (`ESPERA_POR_HOST_MS`), para no golpear.
- **Caché de 24 h**, para no pedir dos veces lo mismo.
- **User-Agent identificable.** Cambiá el mail en `.env` por el tuyo: si un organismo
  ve tráfico raro, es mejor que tenga a quién escribirle antes de bloquear a ciegas.

Los sitios oficiales pueden bloquearte si abusás, y están en su derecho. Uso personal,
volumen bajo, y no redistribuyas bases enteras.

---

## 7. Límites conocidos

Hablemos claro de lo que **no** va a funcionar:

**Buscadores que no exponen el fallo en una URL fija.** Varios sistemas judiciales
argentinos muestran resultados por POST o dentro de una sesión. Si pegás la URL del
buscador, vas a extraer el formulario, no la sentencia. Buscá el enlace del documento
(suele estar en "ver fallo", "descargar PDF" o el ícono de impresión).

**Páginas que se arman con JavaScript.** El servidor descarga el HTML pero no ejecuta
scripts. Si el fallo se carga después por AJAX, llega vacío y vas a ver `HTML_SIN_TEXTO`.
Se resuelve con Playwright, a costa de ~300 MB de navegador y bastante más complejidad;
no lo puse porque para la mayoría de las fuentes no hace falta.

**PDFs escaneados.** Mucha justicia provincial publica fotos de papel. No tienen capa de
texto y `pdf.js` no puede inventarla. El sistema lo detecta y te avisa con `PDF_ESCANEADO`
en vez de devolverte una página en blanco.

Para los tres casos, el plan B es el mismo y funciona siempre: abrí el enlace en el
navegador, copiá el texto y pegalo en el lector del archivo autónomo.

### PDFs escaneados: cómo resolverlos

La herramienta libre es `ocrmypdf`:

```bash
# macOS
brew install ocrmypdf

# Ubuntu / Debian
sudo apt install ocrmypdf tesseract-ocr-spa

# Aplicar OCR en español
ocrmypdf -l spa fallo.pdf fallo-con-texto.pdf
```

Después subí el PDF resultante a algún lado accesible, o abrilo y copiá el texto.

---

## 8. Verificar antes de citar

El extractor te ahorra el copiar y pegar, no la verificación. Antes de que una cita
entre en un escrito:

1. Confirmá que la carátula existe en la base oficial del tribunal que la dictó.
2. Cruzá tomo y página con la colección Fallos, o el número de expediente si es provincial.
3. Leé el considerando completo, no solo el pasaje resaltado.
4. Fijate quién votó y si hubo disidencia.
5. Controlá que el criterio siga vigente.
6. Guardá el PDF con la fecha de consulta.

Los datos que la interfaz detecta —carátula, tribunal, fecha, expediente— salen de
patrones de texto, no de una base de datos. Están para ahorrarte tipeo, y hay que
confirmarlos.

---

## 9. Licencia

MIT para el código. El contenido de los fallos pertenece a sus organismos de origen y se
rige por sus condiciones de uso.
