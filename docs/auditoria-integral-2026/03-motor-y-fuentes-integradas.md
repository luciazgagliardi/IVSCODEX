# 03 · Motor de búsqueda y fuentes integradas

Auditoría integral 2026 de IVS CODEX · recuperación de información jurídica · 20 y 21/11/2026

**Alcance.** Pipeline de búsqueda de punta a punta (pantalla «Buscar» → rutas `/api/indice/<fuente>/…` → adaptadores → acervo FTS5 → respuesta), cada fuente que el backend consulta automáticamente (`backend/lib/fuentes.js`), el verificador de citas y una línea de base medida de recuperación.

**Referencias de código.** Todas las líneas citadas corresponden al commit `70c041d` de la rama de trabajo. Entre el inicio de la auditoría (`70d8305`) y ese commit no cambiaron `routes/indice.js`, `relevancia.js`, `acervoConsulta.js`, `verificarCita.js`, `claveFallo.js` ni `indiceSaij.js`; sí cambiaron `fuentes.js` y `fuentesInfo.js` (alta de Jujuy), `indiceCaba.js` (HTTPS) y el frontend (vocabulario, Jujuy).

**Evidencia.** Dos clases, siempre señaladas: (a) *código*, con archivo y línea; (b) *medido*, respuesta HTTP real. Las mediciones «antes» son contra la API publicada (`https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api`, acervo `20261115-e2e49416`) el 20/11/2026 entre 18:30 y 19:21 UTC. Las mediciones «después» son contra un servidor local con el código de la rama (`PORT=3121`, sin acervo cargado: ver §5.7). Los scripts de sonda puntual (`sonda.mjs`, `local.mjs`, `variantes.mjs`, `articulo*.mjs`, `prueba-exp.mjs`, `fts-frase.mjs`) quedaron en el directorio de trabajo de la auditoría; el de la línea de base está en el repositorio.

**Entregables.**
- Este informe.
- `ops/medir-recuperacion.mjs` — batería reproducible.
- `docs/auditoria-integral-2026/datos/linea-base-recuperacion.json` — «antes» (producción).
- `docs/auditoria-integral-2026/datos/linea-base-recuperacion-rama.json` — «después» (rama, servidor local).

**Lo que este informe no afirma.** No hay juicios de relevancia revisados por abogados: no se informa precisión ni exhaustividad (recall). La §6 propone cómo construir el conjunto de referencia.

## Resumen

Lo más grave, por prioridad:

- **P0 · M-01.** La copia local de las bases provinciales mezcla sumarios de SAIJ y los rotula como documentos del Poder Judicial provincial: en `caba`, 12 de 20 fichas de «daño moral» son sumarios SAIJ de juzgados y cámaras presentados como «Sentencias judiciales» del «Tribunal Superior de Justicia».
- **P0 · M-02.** El verificador de citas da «Coincidencia encontrada» cuando el número de expediente citado aparece como subcadena de otro número (expte. 34/2020 ⇢ «ley 134/2020»).
- **P0 · M-03.** «Fallos que aplican el artículo» no sabe de qué ley es el artículo: art. 52 de la Ley 24.240 → 47 fichas, 27 rotuladas «cita el número», ninguna menciona la ley de defensa del consumidor (las inspeccionadas son del art. 52 del Código Penal). Nada distingue mencionar de interpretar.
- **P1 · M-04, M-05, M-06.** La sintaxis habitual produce falsos ceros o lo contrario de lo pedido: comillas (Mendoza 323 → 6), signo menos (`-punitivo` pasa a ser obligatorio: 4 de 4 fichas lo contienen), `OR` leído como Y, y la frase exacta del acervo borra las preposiciones («daño a la persona» → 0 en 764.428 documentos SAIJ).
- **P1 · M-07.** Las variantes del tesauro y del vocabulario nuevo nunca llegan a los sitios oficiales: la pantalla siempre manda `pedirEnVivo` y la ruta las ignora en ese caso (medido: 0 contra 9 fichas aportadas).
- **P1 · M-08, M-09.** Los modos «alguna»/«exacta» significan cosas distintas según la fuente y los totales mezclan magnitudes (contador del sitio menos duplicados de página, sumas de contadores de cuatro fueros más fichas de SAIJ, conteo del OR de SAIJ como cifra principal).
- **P0 · M-19 y P1 · M-20 (medidos en la rama).** Catamarca sin acervo contesta «0 resultados» en vez de error (42 de 42 ceros en el servidor local); Jujuy, la fuente nueva, da cero en toda consulta con preposición («régimen de visitas» 0, «régimen visitas» 1.333).
- **Línea de base «antes» (producción, 13 fuentes × 42 consultas, 24 min):** 546 casillas, 423 medidas: 322 con resultados, 26 ceros, 75 errores (55 «fuente oficial no disponible», 15 tiempo agotado del cliente, 5 HTTP 502); 71 omitidas por caída reiterada (Río Negro 31, Dialnet 28, Corte IDH 8, CABA 4) y 52 sin medir por presupuesto de tiempo. Río Negro falló el 100 % (403 al servidor publicado), Dialnet el 93 %, CABA el 44 %. En los cinco pares de variantes (43 comparaciones fuente×par medibles con resultados), la primera página de una forma comparte casi nada con la de la otra: Jaccard mediano 0,031; 31 de 43 por debajo de 0,1 y 17 sin ningún documento en común. De 837 fichas traídas por la segunda forma, 723 (86 %) no estaban en la primera página de la primera. Buscar una sola denominación deja afuera la mayor parte de lo que trae la otra.
- **«Después» (rama en servidor local, 14 fuentes, 14 min):** CABA reparada (40/42 con resultados contra 18/32); la interpretación de la consulta no cambió (las ocho sondas de sintaxis dan idéntico); la comparación de disponibilidad no es limpia (otra red, sin acervo; §5.7).
## 1. El pipeline de búsqueda, de punta a punta

### 1.1 Recorrido de una búsqueda nueva desde la pantalla «Buscar»

1. **Pantalla** (`frontend/index.html`:6906-7070, `buscarEnFuente`). Por cada base visible arma `cuerpo = {q, modo, pagina:1}` y agrega, si corresponde, `excluir`, `anioDesde/anioHasta`, `tribunal`, `provincia` (sólo SAIJ), `articulo/norma` (desde la solapa Norma) y `variantes` (equivalentes del tesauro, si está activado «Buscar también estas formas»). Si la consulta parece un nombre de fallo (`nombreBuscado`, `frontend/nombre-fallo.js`), cambia `q` por las palabras del nombre, fuerza `modo:"todas"`, manda `partes` a Mendoza y `tribunal:"fallos"` a SAIJ/CSJN. Luego hace **dos pedidos por base**:
   - `POST /api/indice/<base>/local` con `rapida:true` (hasta 20 fichas del acervo FTS5) y después `soloConteo:true` (total exacto del acervo);
   - `POST /api/indice/<base>/buscar` con `pedirEnVivo:true` (sitio oficial), encolado de a pocos (`consultarOrigenPantalla`).
   La respuesta en vivo se **anexa** a la página 1 de la copia sólo con los ids que el servidor confirma como nuevos (`idsNuevosAcervo`) y que no repiten `claveFallo` (`anexarResultadosOficiales`, :6791-6817). Si SAIJ/CSJN fallan en el servidor, el navegador consulta SAIJ directamente (`saijEnVivo`).
2. **Ruta** (`backend/routes/indice.js:372-646`, una por fuente de `lib/fuentes.js`). Normaliza `q` (trim, 500 caracteres), valida año, modo (`exacta|todas|alguna`), tribunal (`[A-Za-z0-9_-]{1,30}`) y provincia (≤60). Puertas:
   - `articulo` con forma `\d{1,4}( bis|ter|quater)?` → `buscarPorArticulo` (§M-03);
   - `local`/`soloLocal` → `paginaLocal` (acervo; respaldo en el índice JSON de búsquedas guardadas);
   - Mendoza sin `pedirEnVivo` y con acervo → contesta la copia;
   - sitio marcado inaccesible (30 min tras un fallo) y sin `pedirEnVivo` → copia + sondeo de fondo;
   - en vivo: `buscar(parametrosVivo)`; Mendoza sin tribunal → `buscarMendozaTodos` (SC, CC, CT, CF en paralelo, más SAIJ-Mendoza si algún fuero rechaza con 403 o Familia da cero).
   - Con `pedirEnVivo` y error → `{ok:false, codigo:'FUENTE_OFICIAL_NO_DISPONIBLE'}` (no cae a la copia). Sin `pedirEnVivo` y error → copia con `avisoFalla`; si la copia tampoco tiene nada, error tipado.
   - Variantes en vivo: sólo sin `pedirEnVivo` (M-07). Pasajes desde el acervo para fichas sin sumario. Persistencia (`upsertRegistros`, `sumarVivos`). Deduplicación por fallo (`sinRepetidos`) y `total − repetidos` (M-09, M-12). Anotación de procedencia (`respuestaConFuente`).
3. **Adaptadores** (`backend/lib/indice*.js`): traducen `q`/`modo` al formulario de cada sitio; los que no saben un modo lo filtran localmente con `paginarFiltrado` + `relevancia.filtrarPorModo` sobre carátula, sumario, voces y expediente (nunca sobre el texto íntegro), y avanzan por cursores de fila (`siguienteDesde`).
4. **Acervo** (`backend/lib/acervo*.js`): SQLite FTS5 (`unicode61 remove_diacritics 2`, columnas carátula ×4, sumario ×1, voces ×2, magistrados ×1), raíz por truncamiento (`raiz`: palabras de >7 letras pierden dos), Y/O/frase según el modo, variantes como OR de expresiones, BM25, una fila por «fallo» (`clave` por enlace o carátula+fecha+tribunal), total exacto por `count(DISTINCT clave)`. Las bases provinciales suman SAIJ de su provincia (M-01).

### 1.2 Interpretación de la consulta

No hay un analizador de consulta: el texto viaja tal cual a cada adaptador, y cada uno lo interpreta a su manera. Lo que hace cada pieza con lo que se escribe:

| Escrito por el usuario | Filtro local (`relevancia.js`) | Acervo FTS5 (`acervoConsulta.js`) | Sitio oficial |
|---|---|---|---|
| `daño moral` (modo todas) | todas las raíces de 6 letras, números enteros | `"dano"* AND "moral"*` | según motor (tabla de fuentes) |
| `"daño moral"` (comillas) | en «todas», comillas ignoradas; en «exacta», **la frase incluye las comillas** (M-04) | comillas ignoradas | Mendoza y JUBA: rompen la búsqueda; Santa Fe: se quitan; SAIJ: ignora operadores |
| `daño moral -punitivo` | `punitivo` pasa a ser **requerido** (M-05) | `AND "puniti"*` (M-05) | el `-` viaja como texto |
| `usucapión OR prescripción adquisitiva` | «or» se descarta por corto; exige las otras tres palabras (M-05) | idem (Y) | idem |
| frase exacta con preposiciones | conserva las vacías | **las borra** → falso cero (M-06) | — |
| `art 1741` en el campo de texto | raíces `1741` + `art` | `"art"* AND "1741"*` | texto libre |
| artículo desde la solapa Norma | ruta especial `buscarPorArticulo` (M-03) | — | número, número pelado, rúbrica |
| nombre de un fallo / carátula | `nombreBuscado` → palabras del nombre, modo todas | magistrados por apellido | Mendoza: campo `partes`; SAIJ: fichas de fallos |
| expediente (`12345/2019`) | sin tratamiento propio: números como términos | idem | texto libre (no verificado por fuente) |

El campo «Excluir» sí funciona (s06 de la línea de base: 20 fichas sin «punitiv»), pero el signo menos dentro de la consulta hace lo contrario.

### 1.3 Expansión

- **Tesauro de fábrica** (`TESAURO`, :4782-4957): 40 anillos `canonico/equivalentes/relacionados`; sólo canónico y equivalentes se mandan como `variantes` (máx. 4, `equivalentesDe`). Los relacionados se ofrecen aparte, rotulados.
- **Voces del catálogo** (`variantesDe`, :5414-5436): chips con voces de `RAMAS` que comparten una raíz de 6 letras; no se envían solas.
- **Anillos de usuario** (`estado.anillos`, persistidos por `lib/datosUsuario.js`): tienen prioridad sobre los de fábrica (`anilloDe`); el servidor sólo valida forma y tope (300 anillos, 12 términos por lado).
- **Propuestas por IA** (`/api/tesauro/proponer`, `lib/proponerAnillo.js`): sólo propuestas, requieren sesión y aprobación.
- **Vocabulario (nuevo en la rama):** `lib/vocabulario.js` y `GET /api/vocabulario/analizar` reconocen conceptos dentro de la consulta (Tesauro SAIJ, voces de la SCJM, anillos, cambios de denominación por norma) y, para consultas sin anillo, `equivalentesDe` (`frontend/index.html`:5360-5371) manda sus variantes verificadas. No se auditó la calidad del vocabulario (lo cubre otro informe); usa el mismo canal `variantes`, así que hereda M-07.
- **Dónde se aplica:** acervo (OR de expresiones) y, sólo sin `pedirEnVivo`, el sitio en vivo (hasta 10 fichas por variante, 20 s de tope). Como la pantalla siempre manda `pedirEnVivo`, **en vivo nunca** (M-07).

### 1.4 Adaptación a cada motor: ¿se manda una cadena OR a motores que no la entienden?

La aplicación no construye cadenas booleanas para la API (la función `cadena()` con `OR`/`-` sólo alimenta el respaldo por Google, :3809-3818). Lo que llega a los motores es el texto del usuario; si el usuario escribe `OR` o `-`, llega literal (M-05). Las variantes se mandan como consultas separadas, nunca concatenadas con OR. En el acervo sí se arma una expresión FTS5 con `OR` entre variantes, que FTS5 entiende.

### 1.5 Fusión, deduplicación y orden

- **Dentro de una fuente:** `sinRepetidos` (clave por enlace del fallo; en SAIJ/CSJN por carátula+fecha+tribunal) deja el primero en el orden del sitio (M-12). No hay re-ranking propio en vivo: el orden es el del sitio (SAIJ y Dialnet por relevancia del motor, CABA y Corte IDH por fecha, Mendoza por fecha descendente). En el acervo, BM25.
- **Copia + vivo:** la página 1 de la copia más los ids nuevos del vivo, al final. Las páginas siguientes son de la copia (o del vivo con «Cargar más del sitio»).
- **Entre fuentes:** **no hay fusión**: cada base es una columna con su propio total. El mismo documento SAIJ puede aparecer en las columnas SAIJ, CSJN, provincia y la base provincial (la línea de base mide cuántas veces, §5.4). No hay un total global.

### 1.6 Totales

`total` y `totalFuente` cambian de significado según la fuente y el camino: contador del sitio (CABA, Juristeca, Río Negro y Santa Fe sin filtros, Mendoza en «todas»), cantidad verificada en las filas revisadas (SAIJ siempre; Mendoza, Dialnet y SCBA con filtro local), conteo exacto del acervo (`/local` con `soloConteo`), suma de contadores (Mendoza todos los tribunales) o número calculado (Corte IDH). Los casos que mezclan magnitudes están en M-09.

### 1.7 Falla de la fuente frente a cero resultados

Bien resuelto en lo esencial: con `pedirEnVivo` un error de origen responde `ok:false, codigo:'FUENTE_OFICIAL_NO_DISPONIBLE'` y nunca un cero; Mendoza y CABA lanzan error cuando el sitio informa coincidencias pero no entrega fichas (`indiceMza.js:252-253`, `indiceCaba.js:350-355`); `buscarPorArticulo` lanza error si todas las formas fallaron (`routes/indice.js:194-197`); Mendoza por tribunales separa `tribunalesSinRespuesta`. Lo que queda: el motivo del error se pierde en la respuesta en vivo (siempre el mismo mensaje genérico; el código real —403, tiempo agotado, base caída— sólo va al log del servidor), Corte IDH oculta la falla del sitio (M-15) y Catamarca se presenta como vivo (M-10). Los ceros que sí son falsos vienen de la interpretación de la consulta (M-04, M-05, M-06), no del manejo de errores.
## 2. Fuentes integradas automáticamente

Son las 19 entradas de `FUENTES` en `backend/lib/fuentes.js` (con Jujuy, agregada en la rama). El catálogo manual de la solapa «Fuentes» (≈100 enlaces) no se consulta por programa y queda fuera. «Integración»: **vivo** = el servidor consulta el sitio en cada búsqueda; **acervo** = copia SQLite FTS5 (`/api/acervo/estado`, conteos del 20/11); **sólo acervo** = no hay consulta en vivo. «Estado medido» = resultado de la línea de base en producción (§5) y de `/api/fuentes/estado` (20/11, 18:40 UTC).

| Fuente (slug) | Integración | Motor / protocolo | Qué entiende el sitio | Tipo documental real | Metadatos por ficha | Límites conocidos | Estado medido (producción) |
|---|---|---|---|---|---|---|---|
| Poder Judicial de Mendoza (`mendoza`) | vivo + acervo (18.611; incluye SAIJ-Mendoza en la vista local) | formulario NEO (`indiceMza.js`), protocolo sin SQL desde hoy | sólo «todas»; comillas rompen (6 contra 323); sin OR | sumarios (una fila por sumario) con carátula del fallo | carátula, tribunal, fecha+tipo de resolución, voces, sumario, enlace | un tribunal por pedido: sin tribunal se consultan SC, CC, CT y CF + SAIJ; CC/CT con 403 histórico → SAIJ | 28/31 con resultados; `origenEnVivo: "mixto"` en todas; p50 17 s |
| TSJ CABA (`caba`) | vivo + acervo (10.931; incluye SAIJ-CABA en la local) | ASP clásico, windows-1252 (`indiceCaba.js`; en la rama, HTTPS) | los tres modos y exclusión en el sitio | sentencias del TSJ (PDF que se descarga) | expediente, carátula, secretaría, fecha, «tesauro asociados»; **sin sumario** | secretaría no filtrable en el sitio; base caída intermitente | 18/32 con resultados; 13 «fuente no disponible»; p50 22 s |
| SAIJ (`saij`) | vivo + acervo (764.428) | JSON `/busqueda` con facetas (`indiceSaij.js`) | sólo OR; ignora operadores; filtro de modo de este lado | según faceta: **sumarios** (defecto), fichas de fallo, legislación, doctrina, dictámenes | título por descriptores, texto del sumario, fecha, `tribunal` = «Nacional/Local» en sumarios; sin `tipo` por ficha | revisa 300-800 filas del OR; el contador del sitio es el del OR | 37/40; p50 7,6 s |
| CSJN vía SAIJ (`csjn`) | vivo + acervo (61.797) | SAIJ, faceta Federal + número «A…» | idem SAIJ | **sumarios** en Buscar; fichas de fallo en el verificador | carátula del fallo (pedida aparte), «Sumario A…» | atribución a la Corte por heurística del número | 29/33; p50 11 s |
| Dialnet (`dialnet`) | vivo + acervo (3.542) | Solr dismax, HTML (`indiceDialnet.js`) | lógica propia; «exacta» y «excluir» de este lado | **doctrina** (artículos, libros, tesis) | título, autores, revista, año | no confirma jurisprudencia | 1/14 (12 «no disponible»); 28 omitidas |
| Mendoza Legal (`mendozalegal`) | vivo + acervo (180) | WordPress REST | Y (search de WP) | **selección editorial** de fallos comentados | título, extracto, fecha | ~180 artículos | 24/42 con resultados, 14 ceros, 4 errores |
| Corte IDH (`corteidh`) | vivo + corpus propio de texto (`corpusCorteidh.js`); no en acervo | AJAX del sitio (frase) + índice propio | sólo frase; «todas» = intersección de las 2 palabras más raras | sentencias, OC, resoluciones, supervisiones | título, tipo, fecha, PDF | máx. 4 palabras; falla del sitio silenciosa (M-15) | 21/30; 7 tiempos agotados (60 s); p90 60 s |
| Poder Judicial de Río Negro (`rionegro`) | vivo; no en acervo | Yii GET «Protocolo web» | los tres modos en el sitio | sentencias con PDF | carátula, sentencia, organismo, fragmentos del sitio | por defecto sólo STJ (M-11) | **0/11**: 403 al servidor publicado |
| Juristeca (`juristeca`) | vivo + acervo (26.028) | GET `/baj/`, cursor por ID | semántica del sitio no documentada; `modo` ignorado (M-08) | sentencias de cámaras de CABA (PDF) | fuero, instancia, carátula, causa, fecha, sala, temas; **sin sumario** | devuelve hasta 50 por página | 34/39; p50 5,5 s |
| Corte Suprema de Santa Fe (`santafe`) | vivo (por proxy); no en acervo | POST `funciones_ajax.php`, `palabra_tsquery` | exacta con comillas; «todas»: **no verificado** (ver M-08) | sumarios + sentencia HTML | materia, voces, título, texto, carátula, fecha | — | 34/38; p50 8 s |
| Poder Judicial de Catamarca (`catamarca`) | **sólo acervo** (3.784) | cosecha de listados HTML | FTS5 local | sentencias y sumarios | carátula, tribunal, fecha | se rotula «en vivo» (M-10) | 31/35 |
| SCBA · JUBA (`scba`) | vivo + acervo (16.039; incluye SAIJ-Buenos Aires en la local) | ASP.NET WebForms con VIEWSTATE | Y; comillas dan cero | **sumarios** con enlace al fallo | texto, voces, tribunal, causa, fecha, carátula, magistrados; «normas citadas» publicadas pero **descartadas** | sesión por consulta | 29/38; p50 7 s |
| Córdoba, Entre Ríos, Neuquén, Tucumán, Chaco, Corrientes (vía SAIJ) | vivo (faceta `Jurisdicción/Local/<provincia>`) + acervo SAIJ | SAIJ | idem SAIJ | sumarios SAIJ | idem SAIJ; tribunal = nombre de la provincia | no es el portal provincial (bien rotulado) | Córdoba: 36/40; 64 cuasi duplicados (mismo título y fecha, distinto id) |
| Poder Judicial de Jujuy (`jujuy`, sólo en la rama) | vivo; no en acervo | API JSON pública del portal | todas / cualquiera / frase en el sitio | sumarios y sentencias | órgano, tipo, expediente, fecha, sumario, tesauros; **sin carátula** (se arma «Tipo · Expte.») | excluye Familia, Menores y Penal (aviso del portal) | no está en producción; medido sólo en la rama (§5.7): 22/42 con resultados, 20 ceros por palabras vacías (M-20) |
## 3. Hallazgos

Cada hallazgo indica dónde (archivo:línea en `70c041d`), por qué ocurre, la consecuencia jurídica, cómo se reproduce, la solución, cómo verificarla y la prioridad (P0 integridad/estabilidad, P1 recuperación, P2 acervo, P3 inteligencia, P4 experiencia).

| ID | Prioridad | Hallazgo |
|---|---|---|
| M-01 | P0 | Fichas de SAIJ presentadas como documentos del Poder Judicial provincial (atribución) |
| M-02 | P0 | El verificador de citas da «verificada» por números de expediente que sólo coinciden como subcadena |
| M-03 | P0 + P1 | «Buscar fallos que aplican el artículo» no sabe de qué ley es el artículo y confunde número con cita |
| M-04 | P1 | Las comillas que escribe el usuario se mandan literales y producen falsos ceros |
| M-05 | P1 | El signo menos convierte la exclusión en término obligatorio; «OR» se lee como Y |
| M-06 | P1 | Frase exacta en el acervo: las palabras vacías se borran de la frase y FTS5 devuelve cero |
| M-07 | P1 | Las formas equivalentes del tesauro nunca se consultan en los sitios oficiales |
| M-08 | P1 | Los modos «alguna» y «exacta» no significan lo mismo en todas las fuentes, sin aviso |
| M-09 | P1 | Totales que mezclan magnitudes distintas |
| M-10 | P1 | Catamarca (copia local) se informa como consulta «en vivo»; `/fuentes/estado` la da por «accesible» sin consultarla |
| M-11 | P1 | Río Negro consulta sólo el Superior Tribunal salvo que se elija otra cosa |
| M-12 | P1 | La deduplicación «un resultado por fallo» oculta sumarios distintos sin dejar rastro |
| M-13 | P1 | SAIJ en vivo: sin tipo documental por ficha, «tribunal» = nivel de jurisdicción, Corte atribuida por heurística |
| M-14 | P1 | Rótulos de la interfaz que contradicen el tipo y alcance real de la fuente |
| M-15 | P1 | Corte IDH: si el sitio falla, la respuesta parece completa |
| M-16 | P4 (P1 en Corte IDH) | Consultas que se recortan en silencio |
| M-17 | P3 | Tesauro de fábrica: «equivalentes» que no son equivalentes |
| M-18 | P4 | Verificador: «No la encontramos» se pinta en rojo |
| M-19 | P0 | Catamarca sin acervo responde «cero resultados» en vez de error |
| M-20 | P1 | Jujuy (nueva, sólo en la rama): las palabras vacías se mandan al sitio y anulan la búsqueda |

### M-01 · Fichas de SAIJ presentadas como documentos del Poder Judicial provincial (atribución)

- **Dónde:** `backend/lib/acervoConsulta.js:126-138` (las bases provinciales «juntan» SAIJ: `marcas = [base, 'saij']`, `f.fuente = 'saij' AND f.provincia = ?`); `acervoConsulta.js:206-210` (la ficha devuelta no incluye `f.fuente`); `backend/lib/fuentesInfo.js:219-230` (`anotarProcedencia` completa `procedencia`, `nivelAutoridad`, `tipoDocumento` y `jurisdiccion` con los de la base pedida cuando la ficha no los trae); `backend/routes/indice.js:430` y `:471` (respuestas de la copia local pasan por `respuestaConFuente`).
- **Por qué ocurre:** la vista local de `mendoza`, `caba`, `scba`, `santafe`, `rionegro`, `catamarca` y de las seis provincias SAIJ suma los sumarios y fallos de SAIJ de esa provincia, pero la fila sale sin su fuente real; `anotarProcedencia` rellena con la ficha de la base consultada.
- **Medido:** `POST /api/indice/mendoza/local {q:"daño moral"}` → 15 de 20 fichas con id `saij_…`, todas con `procedencia: "Poder Judicial de Mendoza"`, `nivelAutoridad: "Órgano judicial oficial"`, `tipo: "sumario"`. En `caba`: 12/20 `saij_…` rotuladas `procedencia: "Tribunal Superior de Justicia de la Ciudad…"`, `nivelAutoridad: "Tribunal Superior de Justicia"`, `tipoDocumento: "Sentencias judiciales"` aunque el tribunal de la ficha es «JUZGADO EN LO CONTENCIOSO ADMINISTRATIVO Y TRIBUTARIO Nro 6» o «CAMARA DE APEL. CONT. ADM.» y el tipo es `sumario`. En `scba` (`q: "usucapión"`): 17/20 `saij_…` rotuladas «Suprema Corte … · JUBA». La pantalla muestra primero esta copia local (`frontend/index.html`:7012-7040), así que es lo primero que ve el usuario.
- **Consecuencia jurídica:** se atribuye a un órgano (TSJ, SCJM, SCBA) y a un tipo documental (sentencia) lo que es un sumario de SAIJ de un juzgado o cámara. Quien cita «TSJ CABA» un sumario de primera instancia comete un error de jerarquía del precedente; la verificación posterior en el portal del TSJ no lo encontrará.
- **Cómo se reproduce:** `node local.mjs caba '{"q":"daño moral","modo":"todas"}'` (script de sonda: `POST /api/indice/caba/local`) y mirar `id`, `tribunal`, `procedencia`, `tipoDocumento`.
- **Solución:** devolver `f.fuente` (y `f.provincia`) en `paginaEn` y `buscarEnAcervo`; en `anotarProcedencia`, si `fuenteSlug`/`fuente` de la ficha es `saij` (o el id empieza con `saij_`), usar `informacionFuente('saij', {tribunal: tipo, provincia})` en vez de la ficha de la base; `tipoDocumento` debe salir de `f.tipo` (`sumario`/`fallo`), nunca de la base.
- **Cómo verificar:** prueba unitaria sobre `anotarProcedencia` con una ficha `saij_` en `caba`; en producción, `jq '[.resultados[] | select(.id|startswith("saij_")) | .procedencia] | unique'` debe dar sólo procedencias SAIJ.
- **Prioridad:** P0 (integridad).

### M-02 · El verificador de citas da «verificada» por números de expediente que sólo coinciden como subcadena

- **Dónde:** `backend/lib/verificarCita.js:201-219` (`coincideExpediente`): `new RegExp(grupos.join('[^0-9a-z]{0,3}'))` sin límites de dígito, y la regla «el más corto contenido en el más largo» desde 8 caracteres; `:246-250` suma 60 puntos y marca `exacto`; `:339-341` `exacto ⇒ fuerza 'fuerte'`; `:491-505` `fuerte ⇒ veredicto 'verificada'` (confianza «media» si no corrobora partes ni fecha).
- **Medido (local, sin red):** cita `CSJN, "Pérez c/ Gómez", expte. 34/2020` contra una ficha cuyo sumario dice «ley 134/2020» → `fuerza: 'fuerte'`, motivo «coincide el número de expediente (34/2020)». Cita `… Expte. N° 1234/2019` contra una ficha con expediente `EXP 11234/20195` → `fuerte`. Script: `prueba-exp.mjs` (scratchpad).
- **Consecuencia jurídica:** una cita inventada (o con un dígito cambiado) puede salir «Coincidencia encontrada» contra otra causa. Es exactamente el error que el verificador existe para evitar; el texto pide abrir el documento, pero el rótulo verde induce confianza.
- **Solución:** exigir frontera de dígito (`(?<!\d)` … `(?!\d)`) en cada grupo y en la regla de contención; no buscar el expediente en el sumario sino sólo en el campo `expediente` (o en carátula con prefijo «expte»); exigir que el año del expediente coincida como grupo completo; con sólo expediente y sin partes/fecha, veredicto «coincidencia parcial», no «verificada».
- **Cómo verificar:** agregar a `test/` los dos casos de arriba esperando `fuerza !== 'fuerte'`.
- **Prioridad:** P0.

### M-03 · «Buscar fallos que aplican el artículo» no sabe de qué ley es el artículo y confunde número con cita

- **Dónde:** `backend/routes/indice.js:130-216` (`buscarPorArticulo`): forma 1 = `consultaDeArticulo(slug, art)`; forma 2 = el número pelado; ambas marcan `citaElNumero: true` (`:167`, `:174`, `:180`); la `norma` sólo se usa para obtener la rúbrica (`:139-145`). `backend/lib/fuentes.js:70-88` (`COMO_SE_CITA`). Para Mendoza no se pasa tribunal (`:165` sólo si vino), así que `buscarMza` usa el valor por defecto `SC` (`backend/lib/indiceMza.js:230`).
- **Por qué ocurre:** el número del artículo se busca solo, sin la ley, sobre texto libre; «art 52» de la Ley 24.240 es indistinguible de «art 52» del Código Penal. En Mendoza (modo «todas» sin filtro local) el sitio decide qué es coincidencia y la ruta igualmente rotula `citaElNumero`.
- **Medido:**
  - `POST /api/indice/saij/buscar {articulo:"52", norma:"ldc"}` → 47 fichas, 27 con `citaElNumero: true`, **0** mencionan «24.240», «consumidor» o «consumo». Ejemplos: «aplicar la accesoria … del artículo 52 de C.P.». La rúbrica obtenida («Acciones Judiciales») sumó 20 fichas más, todas ajenas.
  - `{articulo:"1741", norma:"ccyc"}` en SAIJ: la forma «artículo 1741» dio **0** (la tabla de `fuentes.js:50-56` dice «20+»); todo vino por «1741» pelado (20) y la rúbrica (3). En Mendoza: 36 fichas, 22 con `citaElNumero`, sólo 7 contienen «art(ículo) 1741» en carátula+sumario; aparecen sumarios de seguros o desalojo sin relación visible con el 1741.
- **Consecuencia jurídica:** la pantalla ofrece «fallos que citan el art. N» que en realidad mencionan otro cuerpo normativo, o un número suelto. Además, aun cuando la ficha sí menciona el artículo correcto, nada distingue **mencionar** de **interpretar o aplicar**: `citaElNumero` sólo significa «el número aparece». Un abogado que construye una línea jurisprudencial sobre un artículo recibe ruido presentado como precedente.
- **Cómo se reproduce:** `node articulo2.mjs saij '{"articulo":"52","norma":"ldc"}' '24\.?240|consumidor|consumo|52 bis'`.
- **Solución:** (1) componer la consulta con número **y** norma (sigla, número de ley y nombre: «art. 52 … 24.240», «LDC 52», «ley de defensa del consumidor») y filtrar del lado del servidor exigiendo co-ocurrencia número+norma en una ventana corta; (2) eliminar la forma «número pelado» o rotularla «menciona el número, ley no confirmada»; (3) tres estados por ficha: `cita_norma_y_articulo`, `menciona_numero`, `trata_el_tema` (rúbrica); (4) aprovechar campos estructurados donde existen (JUBA publica «normas citadas», hoy descartadas por `indiceScba.js`); (5) re-medir `COMO_SE_CITA` y no fijarlo en un comentario; (6) Mendoza por artículo debe consultar todos los tribunales (como `buscarMendozaTodos`), no sólo SC. «Interpreta» sólo puede afirmarse con lectura humana o un clasificador evaluado contra un conjunto de referencia (ver §6).
- **Cómo verificar:** con el conjunto de referencia, precisión de `citaElNumero` ≥ 0,9 para art. 52 LDC, art. 245 LCT, art. 1741 CCyC, art. 14 bis CN.
- **Prioridad:** P0 (integridad: el rótulo afirma algo falso) y P1.

### M-04 · Las comillas que escribe el usuario se mandan literales y producen falsos ceros

- **Dónde:** `frontend/index.html`:6953 (`cuerpo={q:qi,…}` sin normalizar); `backend/routes/indice.js:378` (sólo `trim` y largo); `backend/lib/relevancia.js:227-236` (en «exacta» la frase incluye las comillas: `plegar(q)` no quita puntuación); `backend/lib/indiceMza.js:236-239` (el comentario reconoce que Mendoza «rompe» con comillas, pero se le mandan igual).
- **Medido:**
  - Mendoza (SC, en vivo): `daño moral` → total 317 (fuente 323); `"daño moral"` → **5** (fuente 6).
  - SAIJ, modo exacta: `daño moral` → página llena (20) tras revisar 100 filas; `"daño moral"` → **8** tras revisar 800 filas y 68 s: sólo pasan los sumarios que tienen la expresión literalmente entre comillas.
  - SCBA: `"daño moral"` → `FUENTE_OFICIAL_NO_DISPONIBLE` (sin comillas: 2.744). El código documenta que JUBA da cero con comillas (`indiceScba.js:14-15`).
- **Consecuencia jurídica:** quien escribe la frase entre comillas —el hábito de cualquier buscador— recibe casi nada y lo interpreta como ausencia de jurisprudencia.
- **Solución:** un único analizador de consulta en el servidor (antes de `buscarPorArticulo`/`buscar`) que reconozca `"…"` → modo exacta sobre ese tramo (y lo quite de la cadena que va al sitio), `-palabra` → `excluir`, `OR`/`O` → modo alguna, y devuelva en la respuesta la interpretación aplicada (`consultaInterpretada`) para mostrarla.
- **Cómo verificar:** las sondas s01–s04 de `ops/medir-recuperacion.mjs` deben dar el mismo conjunto con y sin comillas.
- **Prioridad:** P1.

### M-05 · El signo menos convierte la exclusión en término obligatorio; «OR» se lee como Y

- **Dónde:** `backend/lib/relevancia.js:76-86` (`palabrasUtiles` parte por cualquier no alfanumérico: `-punitivo` → `punitivo` requerido); `backend/lib/acervoConsulta.js:46` y `:74` (igual en FTS5: `"puniti"*` con AND); la cadena con operadores sólo se arma para Google (`frontend/index.html`:3809-3818), no para la API.
- **Medido:** SAIJ `daño moral -punitivo` (todas) → 18 fichas; las 5 inspeccionadas contienen «punitiv». Córdoba vía SAIJ (sonda s05) → 4 fichas, contra 20 con el campo `excluir` (s06). FTS5 local con el esquema real: `daño moral -punitivo` → expresión `"dano"* AND "moral"* AND "puniti"*` (script `fts-frase.mjs`). `usucapión OR prescripción adquisitiva` en Tucumán (s07) → 3 fichas: exige las tres palabras.
- **Consecuencia jurídica:** la exclusión hace exactamente lo contrario de lo pedido (sólo trae lo que se quería excluir); el «O» reduce en vez de ampliar.
- **Solución:** la misma que M-04.
- **Prioridad:** P1.

### M-06 · Frase exacta en el acervo: las palabras vacías se borran de la frase y FTS5 devuelve cero

- **Dónde:** `backend/lib/acervoConsulta.js:46` (`terminos` descarta VACIAS) y `:73` (`expr = "${ts.join(' ')}"`).
- **Por qué:** «daño a la persona» se convierte en la frase FTS `"dano persona"`, que exige tokens contiguos; en el texto hay «a la» en el medio.
- **Medido:** acervo SAIJ (764.422 documentos) `daño a la persona` exacta → **0**; Mendoza `régimen de visitas` exacta → 2 (todas: 35). Reproducción local con el esquema real: `"regimen visitas"` → 0 coincidencias sobre un texto que dice «régimen de visitas».
- **Consecuencia:** falso cero en la vista que la pantalla muestra primero, justamente para las expresiones técnicas con preposición («régimen de comunicación», «abuso de derecho», «cosa juzgada írrita» no, pero sí «daño a la persona», «derecho a la salud»).
- **Solución:** en exacta conservar todas las palabras (FTS5 no tiene stopwords propias) o usar `NEAR(...)` con distancia; verificar luego con `relevancia.filtrarPorModo` que ya conserva las vacías.
- **Cómo verificar:** prueba con el esquema en memoria (`fts-frase.mjs`) y `POST /api/indice/saij/local {q:"daño a la persona", modo:"exacta"}` > 0.
- **Prioridad:** P1.

### M-07 · Las formas equivalentes del tesauro nunca se consultan en los sitios oficiales

- **Dónde:** `frontend/index.html`:6984-6987 (agrega `cuerpo.variantes`) y :6995 (`if(!cuerpo.local) cuerpo.pedirEnVivo=true`: toda búsqueda nueva va con `pedirEnVivo`); `backend/routes/indice.js:563` (`… && !pedirEnVivo`: con `pedirEnVivo` las variantes se ignoran).
- **Medido:** Tucumán vía SAIJ, `usucapión` con `variantes:["prescripción adquisitiva","usucapión veinteañal"]`: con `pedirEnVivo:true` (lo que manda la pantalla) → 10 fichas, 0 marcadas con variante; sin `pedirEnVivo` → 19 fichas, 9 aportadas por las variantes.
- **Consecuencia:** el botón «Buscar también estas formas» sólo amplía la copia local (FTS). En Corte IDH, Río Negro y Santa Fe —sin acervo (`/api/acervo/estado`: no figuran en `conteos`)— no amplía nada, y en las demás la parte en vivo (lo más reciente) queda sin las denominaciones nuevas del CCyC, que es justamente el caso de uso («tenencia» → «cuidado personal», 2015). El vocabulario nuevo (`lib/vocabulario.js`, `/api/vocabulario/analizar`; en el frontend, `equivalentesDe`, `frontend/index.html`:5360-5371) agrega variantes para consultas sin anillo por el mismo canal y hereda el problema: la sonda s08 da 0 también en la rama.
- **Solución:** con `pedirEnVivo`, correr las variantes en vivo en segundo plano y devolverlas en una segunda respuesta (o en `/buscar` con `soloVariantes:true`), marcadas con `variante`; nunca sumarlas a `total` (ver M-09).
- **Cómo verificar:** sonda s08 de `ops/medir-recuperacion.mjs` con `conVariante > 0`.
- **Prioridad:** P1.

### M-08 · Los modos «alguna» y «exacta» no significan lo mismo en todas las fuentes, sin aviso

- **Dónde y medición:**
  - Mendoza (`indiceMza.js:243`), Mendoza Legal (`indiceMendozaLegal.js:335`), SCBA (`indiceScba.js:203-205`) y Dialnet (`indiceDialnet.js:203`): «alguna» no dispara filtro ni cambia el pedido; el sitio hace Y (Mendoza, WordPress, JUBA) o su propia lógica (Dialnet), así que «cualquiera de las palabras» devuelve lo mismo que «todas».
  - Juristeca (`indiceJuristeca.js:92-112`): ignora `modo` por completo (el comentario dice que la frase «se filtra de este lado», pero el código sólo aplica `excluir`).
  - Corte IDH (`indiceCorteidh.js:216-224`): «todas» intersecta sólo las dos palabras más raras; las demás no se exigen.
  - Santa Fe (`indiceSantaFe.js:99-102`): el comentario dice que el sitio busca todas las palabras; la línea de base muestra totales incompatibles con un Y (ver §5: «consecuencias no patrimoniales» informa 5.106 sumarios contra 350 de «daño moral»).
- **Consecuencia:** la misma consulta en el mismo modo devuelve conjuntos con semántica distinta según la columna; comparar columnas o confiar en «cualquiera» para ampliar lleva a conclusiones erróneas sobre la existencia de jurisprudencia.
- **Solución:** tabla de capacidades por motor (`capacidades: {todas, alguna, exacta, excluir}` con valores `sitio|local|no`) en `fuentes.js`; si el motor no puede, o se emula (consultas por palabra y unión) o se responde `modoAplicado` distinto del pedido y la pantalla lo dice.
- **Prioridad:** P1.

### M-09 · Totales que mezclan magnitudes distintas

- **Dónde y medición:**
  1. `routes/indice.js:613-617`: `total = total − repetidos de la página`. Con la fuente informando 323 filas (Mendoza) y 6 repetidos en la primera página, la API responde `total: 317`; SCBA 2.744 → 2.734. No es ni el contador del sitio ni la cantidad de fallos.
  2. `routes/indice.js:588-591`: las fichas de variantes se suman al `total` del sitio (medido: Tucumán 10 → 19).
  3. `routes/indice.js:303-319` y `:339`: «todos los tribunales» de Mendoza suma contadores de SC, CC, CT y CF y, cuando entra SAIJ, la cantidad de fichas de una tanda (medido en la línea de base: «daño moral» → `total: 1.078`, 63 fichas en una página).
  4. `indiceCorteidh.js:293` y `:348`: `totalFuente` es un número calculado por IVS (unión texto propio + sitio, o largo de la intersección), no un contador del sitio.
  5. `indiceJuristeca.js:105-109`: con `excluir`, `total` sigue siendo el del sitio aunque se descarten fichas.
  6. `frontend/index.html`:5684: cuando la respuesta es parcial, la columna muestra `totalFuente` como cifra principal; en SAIJ ese número es el conteo del OR (el propio backend lo llama «techo grosero», `indiceSaij.js:672-680`): «daño moral» → 44.588.
- **Consecuencia:** cifras como «1.078 resultados» o «44.588» se leen como tamaño de la jurisprudencia sobre el tema; se usan en escritos («existe abundante jurisprudencia»). Los avisos de parcialidad existen pero el número principal es engañoso.
- **Solución:** separar siempre `contadorSitio` (con `semantica: 'OR'|'Y'|'frase'|'desconocida'`), `verificados` (lo filtrado) y `fichasMostradas`; no restar duplicados de página a un contador del sitio; no sumar variantes ni SAIJ a contadores; la pantalla muestra «N verificados de M revisados · el sitio informa X (OR)».
- **Prioridad:** P1.

### M-10 · Catamarca (copia local) se informa como consulta «en vivo»; `/fuentes/estado` la da por «accesible» sin consultarla

- **Dónde:** `backend/lib/indiceCatamarca.js:112-126` devuelve `desdeIndiceLocal: true`; `routes/indice.js:499-501` no desestructura `desdeIndiceLocal` de `resViva`, y `:635-636` responde `desdeIndiceLocal: false`, `enVivo: true`. `routes/indice.js:843-849`: el estado de fuentes llama a `buscar` y Catamarca nunca sale a la red.
- **Medido:** `POST /api/indice/catamarca/buscar {q:"daño moral", pedirEnVivo:true}` → `enVivo: true, desdeIndiceLocal: false, totalFuente: null`, `fuenteInfo.modalidad: "cosecha_local"`; `/api/fuentes/estado` → `catamarca: alcanzable true, estado "accesible"`.
- **Consecuencia:** se presenta como actual una copia cuya fecha de corte no se informa; un fallo reciente puede faltar sin advertencia.
- **Solución:** propagar `desdeIndiceLocal` (y `actualizadoEn` de la cosecha) desde el adaptador; en `/fuentes/estado`, `estado: 'copia_local'` con la fecha de la última tanda.
- **Prioridad:** P1.

### M-11 · Río Negro consulta sólo el Superior Tribunal salvo que se elija otra cosa

- **Dónde:** `backend/lib/indiceRioNegro.js:100-103` (`tribunal = 'STJ'` por defecto); `backend/lib/fuentes.js:157-160`; el selector del frontend no tiene «todos» (`frontend/index.html`:3446-3449).
- **Por qué importa:** el propio comentario del adaptador mide «despido»: 1.205 fallos del STJ contra 8.544 de cámaras y juzgados. Sin elegir «CJ», el 88 % del material de esa consulta queda fuera y el total mostrado es el del STJ.
- **Estado actual medido:** el sitio responde 403 al servidor publicado (`/api/fuentes/estado`: «respuesta 403»; todas las consultas de la línea de base fallaron). No se pudo medir el efecto en vivo; el defecto es de código.
- **Solución:** sin tribunal, consultar STJ y CJ (como `buscarMendozaTodos`) con cursores separados; rotular el total como suma de dos contadores.
- **Prioridad:** P1.

### M-12 · La deduplicación «un resultado por fallo» oculta sumarios distintos sin dejar rastro

- **Dónde:** `backend/lib/claveFallo.js:17-28`; `routes/indice.js:613-617`; el cursor `siguienteDesde` avanza por filas del sitio, así que los sumarios colapsados no vuelven a aparecer.
- **Medido:** Mendoza «daño moral» (SC): 20 filas → 14 fichas; SCBA «daño moral»: 20 → 10. En SAIJ la clave es carátula+fecha+tribunal, pero la «carátula» de un sumario SAIJ es su título armado con descriptores (`indiceSaij.js:206-209`) y el «tribunal» suele ser sólo «Nacional»/«Local»: dos sumarios de fallos distintos con el mismo título y fecha colapsan.
- **Consecuencia:** cada sumario es una doctrina distinta del mismo fallo (p. ej., uno sobre cuantificación del daño moral y otro sobre legitimación). Mostrar uno solo —el de «mejor coincidencia» según el orden del sitio— pierde holdings pertinentes sin que el usuario lo sepa.
- **Solución:** agrupar, no descartar: `{fallo, sumarios:[…]}` con contador «+5 sumarios de este fallo»; para SAIJ usar el identificador del fallo relacionado (cuando exista) en vez del título.
- **Prioridad:** P1.

### M-13 · SAIJ en vivo: sin tipo documental por ficha, «tribunal» = nivel de jurisdicción, Corte atribuida por heurística

- **Dónde:** `backend/lib/indiceSaij.js:188-231` (`aRegistro` no devuelve `tipo`; `tribunal` = `tribunal · provincia · jurisdicción` y en sumarios suele quedar «Nacional» o «Local»); `:106-107` y `:526-529` (un sumario federal cuyo número empieza con «A» se rotula «Corte Suprema de Justicia de la Nación»).
- **Medido:** SAIJ «daño moral» exacta → fichas con `tribunal: "Nacional"` y `"Local"`; el tipo sólo puede inferirse del filtro pedido (`fuenteInfo.tipo: "Sumarios jurisprudenciales"`).
- **Consecuencia:** el usuario no ve qué tribunal dictó el sumario; la atribución a la CSJN depende de una regla empírica medida sobre 180 sumarios (`indiceSaij.js:84-87`) que no está verificada por ficha.
- **Solución:** devolver `tipo` (`sumario`/`fallo`/`legislacion`/`doctrina`/`dictamen`) por ficha; para sumarios, completar tribunal desde la ficha del fallo relacionado (ya se hace para la Corte con `caratulasDeLaCorte`); marcar `atribucion: 'heuristica_numero_A'` mientras no se confirme.
- **Prioridad:** P1.

### M-14 · Rótulos de la interfaz que contradicen el tipo y alcance real de la fuente

- **Dónde:** `frontend/index.html`:3380 (Mendoza: «Fallos, autos y resoluciones integrales … en todas las instancias y fueros»; `fuentesInfo.js:21` dice lo contrario: «No garantiza cobertura integral de todos los fueros ni de primera instancia»); :3396 (CSJN: «Los fallos de la Corte, con carátula, fecha…», pero `buscar` de `csjn` devuelve **sumarios**, `indiceSaij.js:592-594`).
- **Consecuencia:** el usuario cree consultar sentencias íntegras de todos los fueros cuando consulta sumarios o un subconjunto.
- **Solución:** generar las notas del frontend desde `/api/fuentes/catalogo` (una sola fuente de verdad).
- **Prioridad:** P1.

### M-15 · Corte IDH: si el sitio falla, la respuesta parece completa

- **Dónde:** `backend/lib/indiceCorteidh.js:285-293` (`catch` silencioso: «quedan los del texto»; `totalParcial` no se enciende).
- **Consecuencia:** los documentos que sólo encuentra el buscador del sitio (nombres de caso, palabras clave) faltan sin aviso.
- **Solución:** `totalParcial: true` y `avisoFalla` cuando la parte del sitio no respondió.
- **Prioridad:** P1.

### M-16 · Consultas que se recortan en silencio

- **Dónde:** `routes/indice.js:378` (500 caracteres), `:556-558` (máx. 4 variantes de ≤100 caracteres), `indiceCorteidh.js:33,160-165` (máx. 4 palabras: la quinta en adelante se descarta), `indiceSaij.js:556-568` (en «todas»/«exacta» se le pide al sitio sólo la palabra más larga si mide ≥10 letras; lo que no esté entre las primeras 500-800 filas de ese OR no se revisa).
- **Consecuencia:** consultas largas o con muchas variantes devuelven resultados de una consulta distinta de la escrita.
- **Solución:** devolver `consultaAplicada` y `recortes` en la respuesta y mostrarlos.
- **Prioridad:** P4 (P1 en Corte IDH, donde cambia el conjunto).

### M-17 · Tesauro de fábrica: «equivalentes» que no son equivalentes

- **Dónde:** `frontend/index.html`:4782-4957 (`TESAURO`). Casos: «riesgo de la cosa» ≡ «responsabilidad objetiva» (género, no sinónimo); «cuidado personal» ≡ «cuidado personal compartido» (especie); «prisión preventiva» ≡ «prisión preventiva peligro de fuga» (especie); «accidente de tránsito» ≡ «accidente de tránsito automotor»; «prescripción adquisitiva» ≡ «prescripción veinteañal» (la expresión también designa plazos de prescripción no adquisitiva en el Código derogado); «estímulo educativo» ≡ «artículo 140 ley 24.660» (un artículo no es una denominación: trae fallos que lo mencionan); «servidumbre minera» clasificada en la rama `agua`.
- **Por qué importa:** en el acervo los equivalentes se combinan con OR (`acervoConsulta.js:120-125`) y la pantalla los describe como «el mismo concepto con otro nombre».
- **Solución:** reclasificar como `relacionados` o `masAmplio/masEspecifico` (el vocabulario en curso ya tiene esos tipos) y medir cada anillo con el conjunto de referencia.
- **Prioridad:** P3.

### M-18 · Verificador: «No la encontramos» se pinta en rojo

- **Dónde:** `frontend/index.html`:8368-8372 (`no_encontrada: {clase:"no"}`, color `--rojo`).
- **Consecuencia:** el backend nunca declara falsa una cita (ver §4), pero el color comunica «falsa».
- **Solución:** clase neutra (gris/ámbar) y texto «Sin coincidencias en las fuentes consultadas».
- **Prioridad:** P4.

### M-19 · Catamarca sin acervo responde «cero resultados» en vez de error

- **Dónde:** `backend/lib/indiceCatamarca.js:112-126`: si `acervoCubre('catamarca')` es falso (acervo no cargado, importación en curso o primeros minutos tras un reinicio), cae a `buscarEnIndice`, que devuelve `[]`, y la función responde `{total: 0, …}` con `ok:true`.
- **Medido:** en el servidor local de la rama, sin acervo, las 42 consultas de la batería dieron `estado: cero` (`total: 0`, `enVivo: true`), incluida «daño moral», que en producción trae 40.
- **Consecuencia jurídica:** falso cero clásico: la columna dice que la Justicia de Catamarca no tiene nada sobre el tema.
- **Solución:** si la copia no está disponible, lanzar `errores.indiceFuenteFalla('catamarca', 'copia local no disponible')`; informar la fecha de la última tanda cuando sí lo está (junto con M-10).
- **Cómo verificar:** arrancar el servidor con `DIR_DATOS` vacío y `POST /api/indice/catamarca/buscar` debe dar `ok:false`.
- **Prioridad:** P0 (falso cero).

### M-20 · Jujuy (nueva, sólo en la rama): las palabras vacías se mandan al sitio y anulan la búsqueda

- **Dónde:** `backend/lib/indiceJujuy.js:50-54` (`cuerpoConsulta`: en «todas» manda cada palabra, incluidas «de», «los», «a», «no», con `filtroPalabras: 2`).
- **Medido (servidor local de la rama):** 20 de 42 consultas dieron cero, todas con palabras vacías; «régimen de visitas» → 0, «régimen visitas» → 1.333; «tenencia de los hijos» → 0, «tenencia hijos» → 1.990.
- **Consecuencia jurídica:** falso cero en buena parte de las expresiones técnicas del derecho argentino, que casi siempre llevan preposición.
- **Solución:** en «todas» y «alguna», quitar `VACIAS` (`relevancia.js:68-73`) antes de armar `palabras`; en «exacta», mandar la frase entera como un solo elemento (ya se hace) y verificar con una prueba que «régimen de visitas» exacta dé > 0.
- **Cómo verificar:** agregar el caso a `test/jujuy.prueba.js` con `fetch` simulado y re-correr la batería: los ceros de Jujuy deben quedar en consultas sin coincidencias reales.
- **Prioridad:** P1 (bloqueante para publicar la fuente).
## 4. Verificación de citas

**Confirmado: el backend nunca declara falsa una cita por no encontrarla.** `lib/verificarCita.js` no tiene ningún estado «falsa»/«inexistente»; el caso negativo es `no_encontrada`, cuyo texto siempre agrega la cautela fija `CAUTELA` (`verificarCita.js:64-65`: «No encontrarla acá no prueba que no exista…») y dice qué se buscó y dónde (`:517-531`). La ruta responde 200 también en ese caso (`routes/citas.js:11-14`). Las fuentes de doctrina y selección editorial (Dialnet, Mendoza Legal) y la Corte IDH no se usan para confirmar (`:66-121`, `fuentesAConsultar`).

Estados posibles (`veredicto` + `confianza`):

| Veredicto | Confianza | Cuándo (código) |
|---|---|---|
| `no_verificable` | baja | el texto no parece una cita (`campos.esCita` falso, `:401-404`) |
| `no_verificable` | alta | tribunal reconocido sin buscador integrado (internacionales): no se busca nada (`:406-416`) |
| `no_verificable` | media | no hay carátula, expediente ni palabras para armar la consulta (`:418-427`) |
| `no_verificable` | alta | ninguna fuente respondió (`:477-487`): la falla no se convierte en «no encontrada» |
| `verificada` | alta | coincidencia «fuerte» (expediente o Fallos tomo:página) corroborada por parte o fecha (`:491-505`) |
| `verificada` | media | coincidencia «fuerte» sin corroborar, **o** «media»: actor + (fecha exacta o materia) sin identificador (`:491-515`) |
| `no_encontrada` | media | sin coincidencia convincente y la cita traía expediente, Fallos o carátula (`:517-531`) |
| `no_encontrada` | baja | idem, sin esos datos |

Si una fuente falla y otra responde, el veredicto se apoya sólo en la que respondió y `fuentesConsultadas[].error` lo registra; la explicación nombra sólo las fuentes que contestaron (`:489`).

Observaciones: (a) la coincidencia por expediente admite subcadenas y puede dar `verificada` contra otra causa (M-02, P0); (b) `verificada · media` con sólo carátula+materia es un rótulo optimista: el texto pide abrir el documento, pero el estado se llama igual que una confirmación por identificador; conviene un estado propio `coincidencia_probable`; (c) el verificador consulta como máximo dos fuentes y sólo la primera página (20 fichas) por fuente (`:37-41`), lo que vuelve frecuente `no_encontrada` para citas reales con carátula escrita distinto —por eso la cautela es imprescindible—; (d) en Mendoza consulta un único tribunal elegido por la cita (limitación 3 documentada en `:552-554`); (e) en pantalla `no_encontrada` se pinta en rojo (M-18).
## 5. Línea de base de recuperación

### 5.1 Método

- **Script:** `ops/medir-recuperacion.mjs` (copia idéntica en el directorio de trabajo de la auditoría). Reproducción: `NODE_USE_ENV_PROXY=1 node ops/medir-recuperacion.mjs [--api URL] [--salida ruta.json] [--fuentes a,b] [--max-minutos 23] [--ritmo 20]`.
- **Pedido:** el mismo de una búsqueda nueva desde la pantalla: `POST /api/indice/<fuente>/buscar {q, modo:"todas", pagina:1, pedirEnVivo:true}`. Sin variantes: cada forma de un par se consulta aparte para medir lo que aporta.
- **Batería:** 42 consultas técnicas de 22 ramas (daños, consumidor, laboral, riesgos del trabajo, familia, administrativo, penal, procesal penal, tributario, ambiental, aguas, minería, concursos, seguros, previsional, reales, sucesiones, constitucional/DDHH, internacional privado, género, niñez, propiedad intelectual, datos personales), con cinco pares de variantes: «daño moral»/«consecuencias no patrimoniales», «usucapión»/«prescripción adquisitiva», «tenencia de los hijos»/«cuidado personal», «régimen de visitas»/«régimen de comunicación», «suspensión del juicio a prueba»/«probation». Más ocho sondas de sintaxis (comillas, signo menos, campo excluir, `OR`, variantes con `pedirEnVivo`).
- **Fuentes:** 13 en producción (las 12 propias + Córdoba como representante de las seis vistas provinciales de SAIJ, que comparten motor y código); 14 en la rama (+ Jujuy).
- **Cortesía:** una consulta a la vez por fuente y ≥ 1,5 s entre consultas de la misma fuente; ritmo global ≤ 20 pedidos/min en producción (límite del servidor: 120 / 5 min, cabecera `RateLimit`), presupuesto de 23 min, tiempo de espera del cliente 60 s; tras tres errores seguidos una fuente sólo se vuelve a probar en una de cada cinco consultas (las demás quedan como `omitida_por_caida`, nunca como cero).
- **Métricas por fuente y consulta:** estado (`con_resultados`, `cero`, `error_fuente`, `error_http`, `error_cliente`, `omitida_por_caida`, `no_medida_presupuesto`), `total` y `totalFuente` informados, fichas devueltas, ids únicos, duplicados por id, cuasi duplicados (misma carátula y fecha con distinto id), fichas sin sumario, fichas con id SAIJ, coincidencia léxica (todas las raíces de la consulta en carátula+sumario+voces), latencia, ids (para solapamientos).
- **Advertencias de lectura:** (1) es una foto de un día y una hora: la disponibilidad de los sitios oficiales cambia; (2) el solapamiento entre variantes es de **primera página**: un Jaccard bajo indica que el orden y el conjunto inicial difieren, no que los universos sean disjuntos; (3) la coincidencia léxica no es pertinencia jurídica y no se puede calcular para CABA, Juristeca y Corte IDH (casi sin sumario en la respuesta).

### 5.2 Resultado general (producción, 20/11/2026, 18:55-19:21 UTC, 1.461 s)

546 casillas (13 × 42): **423 medidas** — 322 con resultados, 26 ceros, 75 errores (55 `FUENTE_OFICIAL_NO_DISPONIBLE`, 15 tiempo agotado del cliente a 60 s, 5 HTTP 502 del servidor) —, 71 omitidas por caída reiterada y 52 no medidas por presupuesto (las fuentes lentas no llegaron al final de la batería). Ningún error se presentó como cero: los 26 ceros son respuestas `ok:true` (14 de Mendoza Legal, con ~180 artículos; el resto en consultas de nicho: «servidumbre minera», «concesión de uso de agua», «legítima hereditaria», «pronto pago laboral»).

### 5.3 Tabla resumen por fuente (producción)

| Fuente | Medidas / plan. | Con res. | Ceros | Errores (código) | Omit. caída | Sin medir (tiempo) | Total informado (mediana) | Total fuente (mediana) | Fichas/resp. | Ids únicos | Dup. id | Cuasi dup. | Con id SAIJ | Con todas las raíces | Lat. p50 / p90 (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mendoza | 31/42 | 28 | 1 | 2 (1 cliente_tiempo_agotado, 1 ECONNRESET) | 0 | 11 | 79 | — | 26,2 | 741 | 0 | 3 | 110 | 670/760 | 17.3 / 40.6 |
| caba | 32/42 | 18 | 0 | 14 (13 FUENTE_OFICIAL_NO_DISPONIBLE, 1 cliente_tiempo_agotado) | 4 | 6 | 106 | 106 | 18 | 293 | 0 | 0 | 0 | 47/324 | 21.6 / 47.4 |
| saij | 40/42 | 37 | 0 | 3 (1 FUENTE_OFICIAL_NO_DISPONIBLE, 1 http_502, 1 cliente_tiempo_agotado) | 0 | 2 | 19 | 17.143 | 16,3 | 592 | 0 | 0 | 0 | 566/603 | 7.6 / 34.8 |
| csjn | 33/42 | 29 | 0 | 4 (3 FUENTE_OFICIAL_NO_DISPONIBLE, 1 cliente_tiempo_agotado) | 0 | 9 | 11 | 3.341 | 9,2 | 267 | 0 | 0 | 0 | 235/268 | 11.2 / 44.2 |
| dialnet | 14/42 | 1 | 0 | 13 (12 FUENTE_OFICIAL_NO_DISPONIBLE, 1 http_502) | 28 | 0 | 462 | 462 | 3 | 3 | 0 | 0 | 0 | 1/3 | 2.3 / 12.8 |
| mendozalegal | 42/42 | 24 | 14 | 4 (3 http_502, 1 FUENTE_OFICIAL_NO_DISPONIBLE) | 0 | 0 | 1 | 1 | 3 | 83 | 0 | 0 | 0 | 104/115 | 3.0 / 17.2 |
| corteidh | 30/42 | 21 | 0 | 9 (7 cliente_tiempo_agotado, 2 FUENTE_OFICIAL_NO_DISPONIBLE) | 8 | 4 | 123 | 123 | 16,6 | 112 | 0 | 0 | 0 | 73/349 | 12.0 / 60.0 |
| rionegro | 11/42 | 0 | 0 | 11 (11 FUENTE_OFICIAL_NO_DISPONIBLE) | 31 | 0 | — | — | — | 0 | 0 | 0 | 0 | 0/0 | 2.5 / 10.0 |
| juristeca | 39/42 | 34 | 4 | 1 (1 FUENTE_OFICIAL_NO_DISPONIBLE) | 0 | 3 | 94 | 94 | 35,7 | 1.076 | 0 | 11 | 0 | 368/1356 | 5.5 / 30.7 |
| santafe | 38/42 | 34 | 1 | 3 (2 FUENTE_OFICIAL_NO_DISPONIBLE, 1 cliente_tiempo_agotado) | 0 | 4 | 40 | 45 | 17,7 | 602 | 0 | 4 | 0 | 547/621 | 8.3 / 30.6 |
| catamarca | 35/42 | 31 | 3 | 1 (1 cliente_tiempo_agotado) | 0 | 7 | 4 | — | 9 | 219 | 0 | 6 | 0 | 306/306 | 10.4 / 47.7 |
| scba | 38/42 | 29 | 2 | 7 (6 FUENTE_OFICIAL_NO_DISPONIBLE, 1 cliente_tiempo_agotado) | 0 | 4 | 114 | 120 | 12,6 | 383 | 0 | 0 | 0 | 385/391 | 7.3 / 35.6 |
| cordoba | 40/42 | 36 | 1 | 3 (3 FUENTE_OFICIAL_NO_DISPONIBLE) | 0 | 2 | 14 | 481 | 13,1 | 455 | 0 | 64 | 484 | 462/484 | 8.3 / 29.6 |


Lectura: «Total informado» es la mediana de `total`; «Total fuente», la de `totalFuente` (contador del sitio cuando existe; en SAIJ/Córdoba/CSJN es el del OR). «Con todas las raíces» = fichas con todas las raíces de la consulta en carátula+sumario+voces / fichas devueltas. En Córdoba, «Con id SAIJ» es esperable (es una vista de SAIJ). En Mendoza, 110 fichas con id SAIJ vienen de la vía alternativa SAIJ para cámaras y Familia, y están rotuladas como SAIJ.

Observaciones que salen de la tabla:

- **Disponibilidad:** Río Negro 0 % (403), Dialnet 7 %, CABA 56 %, Corte IDH 70 % (siete tiempos agotados a 60 s). SAIJ, Córdoba, Santa Fe, Juristeca y Catamarca ≥ 87 %.
- **Totales mezclados (M-09):** Mendoza informó `total: 1.078` para «daño moral» con 63 fichas en una sola página y `origenEnVivo: "mixto"` en las 28 respuestas con resultados (siempre entró SAIJ porque Familia da cero en NEO); `totalFuente` es `null` en todas.
- **Semántica de Santa Fe:** «consecuencias no patrimoniales» → `total: 5.102` y **0 de 26** fichas con las tres raíces, contra 340 y 20/20 para «daño moral»: el sitio no exigió todas las palabras en esa consulta (M-08). En el resto de las consultas de Santa Fe la coincidencia léxica es alta (547/621 en total), por lo que la causa exacta (¿la palabra «no» en `tsquery`?) no está verificada.
- **Cuasi duplicados:** 64 en Córdoba y ninguno en SAIJ nacional para las mismas consultas: es compatible con lo que documenta el propio código (SAIJ publica el mismo sumario con más de un id, `acervoConsulta.js:128`), pero la causa de que la vista provincial no los colapse en vivo y la nacional sí no se aisló en esta auditoría. 11 en Juristeca, 6 en Catamarca, 4 en Santa Fe, 3 en Mendoza.
- **Catamarca:** 34 de 34 respuestas `enVivo: true` con `modalidad: "cosecha_local"` (M-10).
- **Duplicados por id dentro de una respuesta:** 0 en todas las fuentes (la deduplicación por id funciona; el problema es el inverso, M-12).

### 5.4 Solapamiento entre fuentes

Mismo id en dos fuentes, sobre todas las consultas: SAIJ ∩ CSJN = 55 ids (de 592 y 267), SAIJ ∩ Córdoba = 16. En 19 de las 42 consultas el usuario vería al menos un mismo documento en dos columnas (máximo: «movilidad jubilatoria», 9 ids en SAIJ+CSJN y SAIJ+Córdoba). No hay fusión entre columnas que lo advierta (§1.5). No se detectaron ids compartidos entre fuentes de distinto origen (lo esperable: cada fuente usa su propio prefijo de id), así que el solapamiento real entre, p. ej., un fallo de la SCBA en JUBA y el mismo fallo en SAIJ **no es medible por id**; requeriría normalizar expediente+fecha+tribunal (ver §6).

### 5.5 Pares de variantes (producción, primera página)

| Par (A / B) | Fuentes medibles | Jaccard mediano (1.ª página) | Sin documentos en común | Fichas nuevas que aporta B | Fichas nuevas que aporta A | Detalle por fuente (fichas A–B, comunes) |
|---|---|---|---|---|---|---|
| daño moral / consecuencias no patrimoniales | 8 de 13 | 0,000 | 6 | 152 de 158 | 215 de 221 | mendoza 63–33 (3); saij 20–2 (0); csjn 14–4 (0); juristeca 50–50 (3); santafe 20–26 (0); catamarca 20–20 (0); scba 14–14 (0); cordoba 20–9 (0) |
| usucapión / prescripción adquisitiva | 6 de 13 | 0,086 | 1 | 80 de 96 | 67 de 83 | saij 19–3 (0); mendozalegal 1–2 (1); corteidh 3–5 (1); juristeca 38–50 (7); santafe 20–16 (6); catamarca 2–20 (1) |
| tenencia de los hijos / cuidado personal | 8 de 13 | 0,000 | 5 | 171 de 185 | 95 de 109 | mendoza 33–32 (0); saij 16–19 (2); corteidh 20–20 (3); juristeca 2–50 (0); santafe 4–15 (0); catamarca 2–17 (0); scba 18–18 (0); cordoba 14–14 (9) |
| régimen de visitas / régimen de comunicación | 11 de 13 | 0,069 | 2 | 184 de 221 | 129 de 166 | mendoza 28–30 (1); caba 17–20 (1); saij 16–20 (5); csjn 1–2 (0); mendozalegal 1–1 (1); corteidh 20–20 (4); juristeca 50–50 (19); santafe 5–26 (2); catamarca 1–18 (0); scba 17–17 (1); cordoba 10–17 (3) |
| suspensión del juicio a prueba / probation | 10 de 13 | 0,050 | 3 | 136 de 177 | 156 de 197 | mendoza 15–22 (0); caba 20–20 (5); saij 19–17 (3); csjn 9–2 (1); corteidh 20–1 (1); juristeca 50–50 (28); santafe 14–15 (0); catamarca 20–19 (1); scba 10–17 (0); cordoba 20–14 (2) |

En las 43 comparaciones medibles (fuente × par con resultados en ambas formas), Jaccard mediano **0,031**; 31 por debajo de 0,1 y 17 sin ningún documento en común. De 837 fichas traídas por la forma B, 723 (86 %) no estaban en la primera página de la forma A. Con el reparo de la §5.1 (primera página), la conclusión práctica es firme: la denominación posterior al CCyC y la anterior recuperan conjuntos iniciales casi disjuntos en todas las fuentes, y hoy la expansión no llega al sitio en vivo (M-07). Ojo: en Corte IDH «cuidado personal» trae 20 fichas con sólo 2 que contienen ambas raíces (búsqueda por frase sobre su corpus): el solapamiento allí mide ruido, no denominaciones.

### 5.6 Sondas de sintaxis (producción)

| Sonda | Fuente | Pedido | Fichas | Total | Observación |
|---|---|---|---|---|---|
| s01 | Mendoza SC | `daño moral` | 14 | 317 (fuente 323) | — |
| s02 | Mendoza SC | `"daño moral"` | 5 | 5 (fuente 6) | comillas: −98 % (M-04) |
| s03 | SAIJ | `daño moral`, exacta | 20 | 20 (revisadas 100) | — |
| s04 | SAIJ | `"daño moral"`, exacta | 8 | 8 (revisadas 800) | sólo pasan textos con la frase entre comillas (M-04) |
| s05 | Córdoba | `daño moral -punitivo` | 4 | 4 | **4/4 contienen «punitiv»** (M-05) |
| s06 | Córdoba | `daño moral` + excluir `punitivo` | 20 | 20 | 0/20 contienen «punitiv»: el campo funciona |
| s07 | Tucumán | `usucapión OR prescripción adquisitiva` | 3 | 3 (revisadas 233) | «OR» se lee como Y (M-05) |
| s08 | Tucumán | `usucapión` + 1 variante, `pedirEnVivo` | 10 | 10 | 0 fichas de la variante (M-07) |

### 5.7 «Después»: la misma batería contra la rama (servidor local)

`docs/auditoria-integral-2026/datos/linea-base-recuperacion-rama.json` — 21/11/2026, 00:05-00:19 UTC, 834 s, 14 fuentes (+ Jujuy) × 42 consultas. Servidor: `cd backend && PORT=3121 NODE_USE_ENV_PROXY=1 node index.js` con `DIR_DATOS` apuntando a un directorio temporal (para no escribir en el repositorio). Ritmo global 40/min (los límites de la rama son por IP y por fuente: 60 búsquedas / 5 min).

**No es una comparación limpia, y hay que leerla así:**
- **Sin acervo.** El servidor local no tiene la base SQLite (`/api/acervo/estado`: `activo: false`). Todo lo que dependa de la copia local no es comparable; en particular **Catamarca (sólo acervo) devolvió 42 ceros con `ok:true`** (ver M-19).
- **Otra red.** El servidor corre en el entorno de la auditoría, no en Azure Brasil: Corte IDH, Santa Fe (requiere el proxy configurado en producción), Río Negro y Dialnet respondieron error en el 100 % de las consultas probadas (11 cada una, 31 omitidas), y en cambio SAIJ, CSJN, SCBA y Mendoza contestaron mucho más rápido. Las diferencias de disponibilidad y latencia reflejan la red, no el código.
- **Lo que sí es comparable:** la semántica de consulta (idéntica: `routes/indice.js`, `relevancia.js`, adaptadores sin cambios salvo CABA y Jujuy), las sondas de sintaxis y los pares de variantes en las fuentes que respondieron en ambas corridas.

Resultado general: 588 casillas, 464 medidas — 331 con resultados, 86 ceros (42 de Catamarca, 20 de Jujuy, 15 de Mendoza Legal), 47 errores (todos `FUENTE_OFICIAL_NO_DISPONIBLE`), 124 omitidas por caída reiterada, 0 sin medir por tiempo.

| Fuente | Medidas / plan. | Con res. | Ceros | Errores (código) | Omit. caída | Sin medir (tiempo) | Total informado (mediana) | Total fuente (mediana) | Fichas/resp. | Ids únicos | Dup. id | Cuasi dup. | Con id SAIJ | Con todas las raíces | Lat. p50 / p90 (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mendoza | 42/42 | 41 | 1 | 0 | 0 | 0 | 77 | — | 27,2 | 1.105 | 0 | 3 | 153 | 1021/1143 | 7.3 / 12.2 |
| caba | 42/42 | 40 | 1 | 1 (1 FUENTE_OFICIAL_NO_DISPONIBLE) | 0 | 0 | 93 | 93 | 17,8 | 643 | 0 | 0 | 0 | 85/731 | 9.6 / 15.9 |
| saij | 42/42 | 41 | 0 | 1 (1 FUENTE_OFICIAL_NO_DISPONIBLE) | 0 | 0 | 19 | 17.143 | 15,8 | 640 | 0 | 0 | 0 | 612/649 | 4.5 / 17.6 |
| csjn | 42/42 | 42 | 0 | 0 | 0 | 0 | 5 | 4.155 | 7,9 | 332 | 0 | 0 | 0 | 299/333 | 8.0 / 19.6 |
| dialnet | 11/42 | 0 | 0 | 11 (11 FUENTE_OFICIAL_NO_DISPONIBLE) | 31 | 0 | — | — | — | 0 | 0 | 0 | 0 | 0/0 | 2.3 / 2.5 |
| mendozalegal | 42/42 | 26 | 15 | 1 (1 FUENTE_OFICIAL_NO_DISPONIBLE) | 0 | 0 | 1 | 1 | 3 | 83 | 0 | 0 | 0 | 110/121 | 1.0 / 1.5 |
| corteidh | 11/42 | 0 | 0 | 11 (11 FUENTE_OFICIAL_NO_DISPONIBLE) | 31 | 0 | — | — | — | 0 | 0 | 0 | 0 | 0/0 | 0.3 / 0.4 |
| rionegro | 11/42 | 0 | 0 | 11 (11 FUENTE_OFICIAL_NO_DISPONIBLE) | 31 | 0 | — | — | — | 0 | 0 | 0 | 0 | 0/0 | 0.2 / 0.5 |
| juristeca | 42/42 | 38 | 4 | 0 | 0 | 0 | 89 | 89 | 35 | 1.182 | 0 | 11 | 0 | 320/1469 | 1.3 / 1.8 |
| santafe | 11/42 | 0 | 0 | 11 (11 FUENTE_OFICIAL_NO_DISPONIBLE) | 31 | 0 | — | — | — | 0 | 0 | 0 | 0 | 0/0 | 10.3 / 10.4 |
| catamarca | 42/42 | 0 | 42 | 0 | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 | 0 | 0/0 | 0.0 / 0.0 |
| scba | 42/42 | 40 | 2 | 0 | 0 | 0 | 114 | 120 | 13,4 | 550 | 0 | 0 | 0 | 549/564 | 2.5 / 3.4 |
| cordoba | 42/42 | 41 | 1 | 0 | 0 | 0 | 14 | 526 | 12,5 | 489 | 0 | 67 | 524 | 502/524 | 2.9 / 13.3 |
| jujuy | 42/42 | 22 | 20 | 0 | 0 | 0 | 5 | 5 | 10,1 | 370 | 0 | 1 | 0 | 51/425 | 2.1 / 5.4 |


Diferencias atribuibles al código de la rama:
- **TSJ CABA reparado:** 40 de 42 con resultados (producción: 18 de 32, con 13 «fuente no disponible»); p50 9,6 s contra 21,6 s.
- **Jujuy (nueva):** responde, pero **20 de 42 consultas dan cero**, y son exactamente las que tienen palabras vacías («tenencia de los hijos», «régimen de visitas», «suspensión del juicio a prueba», «relación de consumo», «consecuencias no patrimoniales»…). Verificado aparte: «régimen de visitas» → 0; «régimen visitas» → 1.333 (M-20).
- **Sin cambios en la interpretación de la consulta:** las ocho sondas de sintaxis dan lo mismo que en producción (s02: 5; s04: 8; s05: 4 de 4 con «punitiv»; s07: 3; s08: 0 fichas de la variante). M-04, M-05 y M-07 siguen abiertos en la rama, también con el vocabulario nuevo, que usa el mismo canal `variantes`.
- **Pares de variantes:** 40 comparaciones medibles, Jaccard mediano 0,028, 29 por debajo de 0,1, 18 sin documentos en común; 631 de 744 fichas de la forma B (85 %) nuevas respecto de la A. Mismo cuadro que en producción.

| Par (A / B) | Fuentes medibles | Jaccard mediano (1.ª página) | Sin documentos en común | Fichas nuevas que aporta B | Fichas nuevas que aporta A | Detalle por fuente (fichas A–B, comunes) |
|---|---|---|---|---|---|---|
| daño moral / consecuencias no patrimoniales | 9 de 14 | 0,000 | 6 | 126 de 133 | 227 de 234 | mendoza 63–33 (3); caba 20–20 (0); saij 20–2 (0); csjn 14–4 (0); mendozalegal 13–1 (1); juristeca 50–50 (3); scba 14–14 (0); cordoba 20–9 (0); jujuy 20–0 (0) |
| usucapión / prescripción adquisitiva | 8 de 14 | 0,047 | 2 | 124 de 151 | 134 de 161 | mendoza 25–20 (2); caba 15–20 (4); saij 19–3 (0); csjn 11–2 (0); juristeca 38–50 (7); scba 13–17 (1); cordoba 20–19 (6); jujuy 20–20 (7) |
| tenencia de los hijos / cuidado personal | 7 de 14 | 0,000 | 6 | 132 de 141 | 63 de 72 | mendoza 33–32 (0); csjn 5–3 (0); mendozalegal 0–4 (0); juristeca 2–50 (0); scba 18–18 (0); cordoba 14–14 (9); jujuy 0–20 (0) |
| régimen de visitas / régimen de comunicación | 8 de 14 | 0,030 | 1 | 126 de 157 | 109 de 140 | mendoza 28–30 (1); caba 17–20 (1); saij 16–20 (5); csjn 1–2 (0); mendozalegal 1–1 (1); juristeca 50–50 (19); scba 17–17 (1); cordoba 10–17 (3) |
| suspensión del juicio a prueba / probation | 8 de 14 | 0,063 | 3 | 123 de 162 | 104 de 143 | mendoza 15–22 (0); caba 20–20 (5); saij 19–17 (3); csjn 9–2 (1); juristeca 50–50 (28); scba 10–17 (0); cordoba 20–14 (2); jujuy 0–20 (0) |
## 6. Precisión y exhaustividad: cómo construir el conjunto de referencia

Hoy no existen juicios de relevancia revisados, así que cualquier cifra de precisión o recall sería inventada. Propuesta para tenerlos:

**Unidad de anotación:** el *documento normalizado* (no la ficha de una fuente), para poder contar el mismo fallo visto por JUBA, SAIJ y el acervo una sola vez. Clave: `tribunal_normalizado + expediente_normalizado + fecha`, con la lista de ids de fuente que lo representan.

**Campos por necesidad de información** (`necesidades.jsonl`): `id`, `rama`, `consulta_tecnica`, `variantes_admitidas[]`, `descripcion` (qué busca el abogado, en dos líneas: p. ej. «criterios de cuantificación del daño moral por muerte de un hijo»), `jurisdicciones_objetivo[]`, `periodo`, `tipo_buscado` (sumario/sentencia/doctrina/dictamen), `articulo` y `norma` cuando la necesidad es «fallos que aplican el art. N de la ley L».

**Campos por juicio** (`juicios.jsonl`): `necesidad`, `documento` (clave normalizada), `ids_fuente[]`, `relevancia` (0 no pertinente · 1 menciona el tema · 2 trata el tema · 3 decide sobre el tema / doctrina aplicable), para necesidades por artículo además `relacion_con_articulo` (`no_lo_menciona` · `menciona_otra_ley` · `menciona` · `interpreta` · `aplica_como_fundamento`), `tipo_documental_real`, `tribunal_real` (para auditar atribución), `anotador`, `fecha`, `nota`.

**Cómo anotar:**
1. Empezar con 30 necesidades (las 42 consultas de la batería sirven de semilla, más 6-8 por artículo: art. 52 LDC, 245 LCT, 1741 CCyC, 14 bis CN, 43 CN, 1757 CCyC).
2. *Pooling*: unir las primeras 20 fichas de cada fuente y de cada variante (con y sin expansión) y anotar ese pozo; así se puede estimar recall relativo de cada configuración contra la unión.
3. Doble anotación ciega por dos abogados en el 20 % del pozo; medir acuerdo (kappa de Cohen ponderado) y resolver desacuerdos con un tercero. Sin acuerdo ≥ 0,6 la escala o la descripción de la necesidad se reescriben.
4. Métricas: P@10 y nDCG@10 por fuente; recall relativo al pozo; para artículos, precisión de la etiqueta `citaElNumero` frente a `relacion_con_articulo ≥ menciona` y de la ley correcta; para atribución, porcentaje de fichas con `tribunal_real`/`tipo_documental_real` distinto del rotulado.
5. Congelar el conjunto con fecha y re-correr `ops/medir-recuperacion.mjs` (agregando una opción `--juicios`) en cada cambio del motor; los ids de fuente cambian poco, pero conviene guardar también la clave normalizada.

## 7. Lo que no se pudo verificar

- **Causa de los HTTP 502** observados en producción (dos ventanas de ~1-2 min a las 18:52 y 18:54 UTC, y 5 respuestas 502 durante la batería). No se tuvo acceso a los registros del servidor; no se atribuye causa.
- **Semántica exacta** de los motores de Juristeca (`cuerpo[]`, `Texto[0]`) y Santa Fe (`palabra_tsquery`) para varias palabras; sólo se observan sus efectos (M-08).
- **Río Negro en vivo**: 403 al servidor publicado durante toda la auditoría; el efecto de M-11 no pudo medirse desde producción.
- **Orden de los resultados de Mendoza**: no se verificó si es por fecha o por otro criterio.
- **Disminución de conteos del acervo** entre dos lecturas del 20/11 (Mendoza 18.670 → 18.611, CABA 10.932 → 10.931): observado en `/api/acervo/estado`; la causa (deduplicación, reimportación) no se investigó.
- **Precisión/recall**: no hay juicios de relevancia (§6).
- **Expedientes en el buscador:** no hay un tratamiento específico de números de expediente en «Buscar»; cómo los interpreta cada sitio no se midió.
