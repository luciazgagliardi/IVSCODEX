# Juris et de jure — extractor de sentencias

Pegás el enlace de un fallo argentino (o internacional) de una base oficial, el servidor lo descarga,
le saca el texto —sirve HTML y PDF— y te lo muestra en la página con tu búsqueda resaltada,
los pasajes recortados con contexto y la cita armada.

**No genera ni resume jurisprudencia.** El texto que ves es el del documento oficial que indicaste.

El proyecto tiene dos mitades independientes, pensadas para desplegarse por separado:

- **`frontend/`** — estático, sin build. Se puede abrir directo o publicar en GitHub Pages.
- **`backend/`** — Express, con su propio `package.json`. Se despliega aparte (Render, Railway, Fly, tu
  propio servidor, lo que sea) y expone la API que el frontend usa para traer un fallo por enlace.

El frontend funciona igual sin el backend: lo único que se pierde es el botón "traer el fallo por
enlace" del Lector. Todo lo demás —pegar el texto a mano, resaltar, armar citas, el catálogo de
fuentes— es 100% archivo estático y anda sin ningún servidor.

---

## 1. Estructura de carpetas

```
juris-et-de-jure/
├── README.md                 Este archivo
├── .gitignore
│
├── frontend/                  Estático — esto es lo que se publica en GitHub Pages
│   ├── index.html             Página principal: buscador + Lector de fallos
│   ├── clasico.html           Versión original del extractor (formulario simple)
│   ├── catalogo.html          Catálogo de ~100 fuentes oficiales, standalone (no usa la API)
│   ├── script.js               Lógica de clasico.html: llamada a la API, resaltado, cita
│   ├── styles.css              Estilos de clasico.html
│   └── emblemaaa.png           Emblema/favicon
│
├── backend/                    Express — se despliega aparte de frontend/
│   ├── package.json            Manifiesto propio (dependencias, scripts)
│   ├── .env.example            Plantilla de configuración (copiala como backend/.env)
│   ├── index.js                CORS, rate limit, estáticos (sirve frontend/ en desarrollo), arranque
│   ├── config.js               Variables de entorno y lista blanca de dominios
│   │
│   ├── routes/
│   │   ├── extraer.js          POST /api/extraer y rutas auxiliares
│   │   ├── indice.js           Búsquedas en vivo contra los buscadores oficiales
│   │   └── citas.js            POST /api/verificar-cita y /api/leer-cita
│   │
│   ├── lib/
│   │   ├── descargador.js      Descarga segura: SSRF, redirecciones, charset
│   │   ├── extraerHtml.js      Readability + limpieza propia de respaldo
│   │   ├── extraerPdf.js       pdf.js: líneas, párrafos, detección de escaneos
│   │   ├── fuentes.js          Catálogo de los buscadores oficiales integrados
│   │   ├── citas.js            Lee una cita pegada y saca sus campos
│   │   ├── verificarCita.js    Busca esa cita en las fuentes y da un veredicto
│   │   ├── cache.js            Caché en disco con vencimiento
│   │   └── errores.js          Errores tipados con mensaje en castellano
│   │
│   ├── test/
│   │   └── prueba.js           33 pruebas: extracción, seguridad, errores
│   │
│   └── cache/                  Se crea sola. Podés borrarla cuando quieras.
```

---

## 2. Puesta en marcha

### Frontend — no necesita nada instalado

Es HTML/CSS/JS puro. Para probarlo:

- **Directo:** abrí `frontend/index.html` con doble clic, o arrastralo a una pestaña del navegador.
- **Publicado con GitHub Pages:** el repo ya trae `.github/workflows/pages.yml`, que publica el
  contenido de `frontend/` solo (GitHub Pages, en su modo simple, no deja elegir una subcarpeta como
  fuente — por eso el workflow). Activalo una sola vez: en el repo, Settings → Pages → "Build and
  deployment" → Source: **GitHub Actions**. De ahí en más, cada push a `main` que toque `frontend/`
  publica solo. No hace falta build ni backend para que funcione la búsqueda, el Lector con texto
  pegado a mano, ni el catálogo.

Si además querés que el botón "traer el fallo por enlace" funcione una vez publicado (sin backend en el
mismo origen), mirá la sección 3.

### Backend — Node 18.17 o superior

```bash
node --version   # confirmá que sea 18.17+; si no, bajalo de nodejs.org (LTS)

cd backend
npm install                   # tarda un minuto la primera vez
cp .env.example .env          # opcional: anda igual sin esto — en Windows: copy .env.example .env
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

En desarrollo, el backend también sirve `frontend/` en la raíz (`http://localhost:3000`) — es la forma
más simple de probar todo junto sin publicar nada. El punto verde arriba a la derecha de la página
confirma que el frontend encontró la API.

### Comandos útiles (desde `backend/`)

```bash
npm run dev             # se reinicia solo al guardar cambios
npm test                # corre las 33 pruebas
npm run limpiar-cache   # vacía backend/cache
```

Para cortar el servidor: **Ctrl+C**.

---

## 3. Conectar un frontend publicado con un backend desplegado

Cuando `frontend/` y `backend/` viven en dominios distintos (por ejemplo, frontend en GitHub Pages y
backend en Render), dos cosas tienen que coincidir:

1. **El frontend tiene que saber la URL del backend.** `frontend/index.html`
   (función `detectarServidor()`) y `frontend/script.js` (constante `API`) ya prueban, en este orden:
   mismo origen (`/api`) → `http://localhost:3000/api` (desarrollo) → un placeholder
   (`https://TU-BACKEND-DESPLEGADO.example.com/api`). Reemplazá ese placeholder por la URL real de tu
   backend una vez desplegado, en los dos archivos.
2. **El backend tiene que aceptar ese origen.** Sumá la URL de tu frontend publicado (por ejemplo
   `https://tu-usuario.github.io`) a `CORS_ORIGENES` en `backend/.env`, separada por coma del resto.

Sin el paso 2, el navegador va a bloquear la respuesta aunque la URL esté bien apuntada — es la protección
CORS del propio navegador, no algo que dependa de este código.

---

## 4. La API

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/extraer` | Cuerpo `{ "url": "...", "refrescar": false }`. Devuelve el texto. |
| `POST` | `/api/verificar-cita` | Cuerpo `{ "texto": "CSJN, Fallos: 340:1084" }`. Busca esa cita en las fuentes y devuelve un veredicto (ver sección 9). |
| `POST` | `/api/leer-cita` | Igual, pero solo parsea: no sale a la red. Sirve para ver qué entendió el lector de citas. |
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

## 5. Configuración

Todo se ajusta por variables de entorno en `backend/.env`. Lo más habitual:

| Variable | Default | Para qué |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `CORS_ORIGENES` | localhost 3000 y 5500 | Desde dónde se puede llamar a la API (ver sección 3) |
| `TIMEOUT_MS` | `25000` | Cuánto esperamos al sitio de origen |
| `MAX_BYTES` | `26214400` (25 MB) | Tope de descarga |
| `CACHE_HORAS` | `24` | Duración de la caché (`0` la desactiva) |
| `DIR_CACHE` | `backend/cache` | Dónde se guarda la caché en disco |
| `ESPERA_POR_HOST_MS` | `1500` | Pausa mínima entre pedidos al mismo sitio |
| `PERMITIR_CUALQUIER_DOMINIO` | `false` | `true` acepta cualquier dominio público |
| `PERMITIR_RED_PRIVADA` | `false` | Solo para los tests automáticos — nunca en producción |
| `LIMITE_CITAS` | `30` | Verificaciones de cita por navegador y ventana (ver sección 9) |
| `LIMITE_CITAS_VENTANA_MS` | `900000` (15 min) | Cada cuánto se reinicia esa cuenta |

**Agregar una fuente:** abrí `backend/config.js`, sumá el dominio a `DOMINIOS_PERMITIDOS`
y reiniciá. Acepta subdominios: poniendo `csjn.gov.ar` habilitás también `sjconsulta.csjn.gov.ar`.

---

## 6. Seguridad: por qué la lista blanca no es un capricho

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

## 7. Ser buen vecino con los servidores oficiales

Esto no es un scraper masivo: baja **un documento por vez, el que vos pediste**.
Aun así trae tres cosas que conviene no sacar:

- **Pausa entre pedidos al mismo sitio** (`ESPERA_POR_HOST_MS`), para no golpear.
- **Caché de 24 h**, para no pedir dos veces lo mismo.
- **User-Agent identificable.** Cambiá el mail en `.env` por el tuyo: si un organismo
  ve tráfico raro, es mejor que tenga a quién escribirle antes de bloquear a ciegas.

Los sitios oficiales pueden bloquearte si abusás, y están en su derecho. Uso personal,
volumen bajo, y no redistribuyas bases enteras.

---

## 8. Límites conocidos

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
en vez de devolverte una página en blanco — pero en este caso hay una salida integrada:
seguí leyendo.

Para los otros dos, el plan B es el mismo y funciona siempre: abrí el enlace en el
navegador, copiá el texto y pegalo en el Lector del frontend (funciona sin backend).

### PDFs escaneados: OCR

Cuando el Lector avisa `PDF_ESCANEADO`, aparece un botón **"Aplicar OCR"** que hace todo
esto por vos: descarga el PDF, renderiza cada página como imagen y le corre
[Tesseract](https://github.com/naptha/tesseract.js) en español para reconocer el texto.
Tarda bastante más que una descarga normal —varios segundos por página, no
milisegundos— así que es un botón aparte y no algo automático. El resultado queda
cacheado igual que cualquier otro documento (ver `lib/cache.js`), así que solo se paga
el costo una vez por URL.

Detalles técnicos, por si hace falta tocar `lib/ocr.js`:

- El render de página a imagen usa [`@hyzyla/pdfium`](https://github.com/hyzyla/pdfium)
  (el motor de PDF de Chrome, compilado a WebAssembly), no `pdf.js` + un canvas nativo.
  Se probó `pdf.js` + `@napi-rs/canvas` primero y hace un **segfault real** —tira abajo
  el proceso entero, no es un error atajable— con PDFs reales; `node-canvas` (la
  alternativa clásica) ni siquiera compila sin Cairo/Pango instalados en el sistema.
  PDFium es WASM puro: cero binarios nativos, cero dependencia del sistema operativo,
  portable a cualquier hosting sin instalar nada aparte.
- `OCR_MAX_PAGINAS` (default 6) y `OCR_TIMEOUT_MS` (default 180000, 180s) limitan
  cuánto puede tardar un pedido. El default es bajo a propósito: medido en vivo
  contra el plan de Azure publicado, 6 páginas tardaron **170 segundos** (~28s por
  página) — esa CPU compartida es unas 11 veces más lenta que una notebook común
  para este trabajo. Con ese ritmo, 20 páginas tardarían ~9 minutos, bastante más de
  lo que Azure App Service deja abierta una conexión inactiva (~230s): la plataforma
  cortaría la conexión en silencio antes de que este código llegue a contestar. Si
  tu hosting tiene más CPU (o corrés esto en tu máquina), subí `OCR_MAX_PAGINAS`
  con confianza.
- `OCR_HABILITADO=false` apaga la función entera sin tocar código, para un plan de
  hosting chico donde renderizar páginas y correr Tesseract sale caro en CPU/memoria.

Si preferís hacerlo vos mismo por fuera (mejor calidad, sin límite de páginas), la
herramienta libre es `ocrmypdf`:

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

## 9. Verificar antes de citar

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

### El verificador de citas

El paso 1 de esa lista está automatizado. En la solapa **Verificar** hay un cuadro
donde pegás la cita como la tengas —`CSJN, Fallos: 340:1084`, `TSJ CABA, Expte.
12345/2020`, `Cám. Nac. Civ., Sala A, "Pérez c/ Gómez s/ daños y perjuicios",
12/03/2019`— y el servidor intenta encontrarla en las fuentes oficiales que sabe
consultar. Nació por el problema de las **citas alucinadas**: un modelo de lenguaje
produce citas con la forma exacta de una verdadera —tribunal que existe, carátula
creíble, tomo y página en el rango correcto— y no hay manera de distinguirlas
leyéndolas. La única manera es ir a la fuente.

Qué hace, en orden:

1. **Lee la cita** (`lib/citas.js`): tribunal, número de expediente, tomo y página de
   *Fallos*, carátula partida en actor / demandado / materia, fecha, y las palabras
   que sirven para buscar. Es un montón de expresiones regulares y no un parser
   formal, porque una cita argentina no tiene un formato: tiene el de cada tribunal,
   el de cada revista y el que cada quien escribe de apuro. **Un campo que no se
   reconoce vuelve vacío**: nunca se completa con lo que "seguramente quiso decir".
2. **Elige a quién preguntarle** (`lib/fuentes.js`): si reconoció el tribunal, va a su
   buscador y a ninguno más. Si no lo reconoció, tira una red ancha pero corta —SAIJ,
   la única base con alcance nacional que hay integrada, más la faceta de la Corte—.
   Nunca consulta más de dos fuentes por pedido: cada consulta es un pedido real al
   servidor de un organismo (ver la sección 7).
3. **Busca y puntúa**: cada resultado se compara con la cita. El expediente exacto y
   el `tomo:página` exacto valen solos lo que todo el resto junto, porque son
   identificadores: o coinciden o no. Los apellidos de las partes valen la mitad, se
   comparan sin tildes ni mayúsculas (`lib/relevancia.js`) y no alcanzan por sí solos:
   hay apellidos repetidos hasta el hartazgo.
4. **Devuelve un veredicto**, con confianza (alta / media / baja), la explicación en
   castellano de por qué llegó ahí, y los candidatos con su enlace a la fuente oficial.

Los tres veredictos posibles, que están redactados con cuidado:

| Veredicto | Qué significa |
|---|---|
| `verificada` | Apareció un fallo que coincide por un identificador exacto, o por la carátula entera. Igual pide abrir el documento: que el fallo exista no significa que diga lo que la cita le atribuye. |
| `no_encontrada` | Se buscó y no apareció nada convincente. **Nunca dice que la cita sea falsa.** Puede no estar indexada, estar cargada con otra carátula, o no ser real — las tres siguen abiertas. |
| `no_verificable` | No se pudo ni intentar: el texto no tiene forma de cita, el tribunal es uno que ninguna fuente integrada cubre (los internacionales), o los buscadores oficiales no respondieron. Ojo con este último caso: **una fuente caída nunca se informa como "no encontrada"**. |

Prueba rápida desde la terminal:

```bash
curl -X POST http://localhost:3000/api/verificar-cita \
  -H "Content-Type: application/json" \
  -d '{"texto":"CSJN, \"Halabi, Ernesto c/ P.E.N. s/ amparo ley 16.986\", Fallos: 332:111, sentencia del 24 de febrero de 2009"}'
```

Los límites honestos, que son varios y conviene tenerlos a mano:

- **No existe un índice de la colección *Fallos* por tomo y página.** Ninguna de las
  cuatro fuentes integradas expone ese dato como campo buscable, y el buscador propio
  de la Corte —el único que sí lo tiene— está detrás de un reCAPTCHA, o sea que pide
  expresamente que del otro lado haya una persona (ver `lib/indiceSaij.js`). Un
  `Fallos: 340:1084` se puede **confirmar** si el fallo aparece por carátula y el texto
  trae ese número, pero **no se puede buscar por tomo y página**. Una cita que trae
  solo eso termina casi siempre en `no_encontrada`, y por eso ese veredicto no afirma
  nunca que algo no exista.
- **El alcance es el catálogo de cuatro buscadores**, no "la jurisprudencia argentina".
  Mendoza, TSJ CABA, SAIJ y la Corte vía SAIJ. La interfaz lo dice en pantalla, fijo,
  arriba y abajo del resultado.
- **Mendoza obliga a elegir el tribunal antes de buscar** y no tiene un "todos": se
  elige uno leyendo la cita (Corte / Cámaras Civiles / Cámaras del Trabajo) y si se
  eligió mal, no aparece.
- **El buscador de Mendoza tiene dos campos de texto que no son intercambiables**,
  descubierto probando en vivo: su campo de texto libre no encuentra nada apenas le
  pedís dos palabras a la vez —ni "Ariana Lucia", dos nombres pegados uno al lado del
  otro en un fallo real que sabíamos que existía—, mientras que el campo dedicado a
  nombres de partes sí arma la búsqueda correcta (cada palabra exigida por separado en
  actor/demandado). `lib/indiceMza.js` ya usa el campo correcto cuando el verificador
  busca por carátula; el Buscador general sigue mandando texto libre como siempre,
  porque ahí un campo de conceptos ("responsabilidad del estado") sí es lo que
  corresponde.
- **Se mira la primera página de resultados.** Un fallo real cuya carátula esté escrita
  distinto —abreviada, con el segundo nombre, con la razón social completa— puede
  quedar afuera.
- `LIMITE_CITAS` (default 30 cada 15 minutos) es un límite aparte del general, igual
  que el del OCR. No protege a este servidor —verificar una cita es barato acá—:
  protege a los sitios oficiales, que son los que hacen el trabajo pesado.

Las pruebas están en `test/citas.prueba.js` y corren sin salir a internet: la búsqueda
se inyecta simulada. La última de todas es la que más importa — que un veredicto
negativo nunca use la palabra "falsa".

---

## 10. Licencia

MIT para el código. El contenido de los fallos pertenece a sus organismos de origen y se
rige por sus condiciones de uso.
