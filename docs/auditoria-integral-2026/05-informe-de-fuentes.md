# 05 · Informe de fuentes: verificación, evaluación y hoja de ruta

**Fecha de corte:** 20 de noviembre de 2026
**Alcance:** las fuentes prioritarias que IVS CODEX todavía no integra y una nueva verificación de las que ya integra (`backend/lib/fuentes.js`, `fuentesInfo.js`, `indice*.js`).
**Datos estructurados:** [`datos/fuentes-evaluadas.json`](datos/fuentes-evaluadas.json): 46 fichas con evidencia, clasificación y diez puntajes por fuente.
**Antecedente:** `docs/auditoria-busqueda-juridica-2026.md` (17/11/2026). Este informe no repite su inventario de las 125 fuentes del catálogo manual. Corrige o confirma sus afirmaciones técnicas donde hoy hay evidencia nueva.

---

## 0. Método y límites de la verificación

- Cada afirmación técnica sale de una petición real hecha el 20/11/2026: `curl` sobre HTTPS y los **adaptadores propios ejecutados en vivo** con `NODE_USE_ENV_PROXY=1` (script `probar-integradas.mjs`, consulta «daño moral»). Para cada fuente el JSON registra URL, método, código HTTP y observación.
- Las peticiones se hicieron en el modo en que el sitio se ofrece al público. No se sortearon captchas, desafíos de Cloudflare, logins ni prohibiciones de `robots.txt`. Cuando la automatización no es legítima o no es fiable, la fuente queda como **«solo catálogo manual»**.
- **Límites del entorno de auditoría** (importan para leer los «no verificado»):
  1. La salida a Internet es por EE.UU. (los encabezados `cf-ray` y CloudFront indican IAD y EWR). Varios portales provinciales cortan el túnel TLS o devuelven 403 a una IP extranjera. **Eso no prueba que estén caídos** ni que bloqueen a la IP de producción.
  2. Sólo se alcanza HTTPS. El proxy responde 405 a HTTP plano, así que no se probaron sitios que sólo hablan `http://`.
  3. Tampoco se alcanzan puertos no estándar, como los buscadores de Salta en los puertos 8091 y 9091.
- La escala de puntajes va de 1 (muy bajo) a 5 (muy alto) en diez criterios: autoridad, integridad, cobertura, actualización, calidad documental, precisión de metadatos, facilidad de búsqueda, estabilidad, utilidad marginal y viabilidad técnica. Es una evaluación cualitativa, cada nota con su justificación en el JSON.

---

## 1. Dictamen ejecutivo

1. **Hay una fuente integrada rota y la causa está identificada.** El adaptador del TSJ de CABA apunta a `http://jurisprudencia.tsjbaires.gob.ar`, que ya **no resuelve en DNS** (ENOTFOUND). El mismo formulario ASP responde en `https://jurisprudencia.tsjbaires.gov.ar/jurisprudencia/resultadoBusqueda.asp`: un POST en windows-1252 con `textoLibreAlgunas=daño moral` devolvió **955 resultados**, el primero del 12/11/2026. Basta con cambiar el host y el esquema.
2. **Dos fuentes integradas quedan bloqueadas desde fuera de Argentina:**
   - **Corte IDH**: Cloudflare responde 403 con `cf-mitigated: challenge`, y su `robots.txt` bloquea a ClaudeBot, GPTBot y otros agentes de IA, con `Content-Signal: ai-train=no`.
   - **Río Negro**: CloudFront devuelve 403 «Request blocked».

   Dialnet y Santa Fe no se pudieron alcanzar en esta corrida. En los cuatro casos hay que reverificar desde la IP de producción, y la Corte IDH debe apoyarse en su corpus local.
3. **Dos conflictos con `robots.txt` en fuentes ya integradas:**
   - SAIJ prohíbe `/descarga-archivo`, que `lib/textoSaij.js` usa para bajar el PDF.
   - Juristeca prohíbe `/fallos/` para todo agente y `/` para ClaudeBot, y el descargador baja los PDF de `/fallos/`.

   Para un pedido puntual que inicia el usuario la cuestión es discutible. Para una cosecha masiva al acervo, no corresponde.
4. **Cuatro fuentes nuevas se pueden integrar ya**, con API JSON verificada y sin captcha ni login:
   - **Jujuy**: 380.418 documentos con texto íntegro.
   - **Chubut · Eureka!**: acceso anónimo oficial, JSON y PDF.
   - **Tribunal Fiscal de la Nación**: 30.685 resoluciones con texto completo.
   - **Procuración del Tesoro**: dictámenes con texto completo en la respuesta.
5. **Los grandes portales nacionales de jurisprudencia siguen cerrados a la automatización:**
   - La **Secretaría de Jurisprudencia de la CSJN** usa reCAPTCHA Enterprise en sumarios, fallos, novedades y destacados.
   - El nuevo **buscador federal y nacional** usa un captcha `cap-widget`, y el `robots.txt` de csjn.gov.ar prohíbe la portada, los PDF y `showFile`.

   Hay una excepción valiosa: los **tomos completos de la colección «Fallos»** se descargan en PDF sin captcha (`/sj/verTomo?tomoId=N`).
6. **Datos abiertos**:
   - **datos.jus.gob.ar no tiene ningún dataset de sentencias**: `package_search?q=jurisprudencia` da 0, sobre 63 datasets.
   - El **Tesauro SAIJ** (CC-BY 4.0) **ya está incorporado**: el hash sha256 `eda195df…` coincide con `backend/datos/vocabulario/inventario.json`.
   - Lo nuevo que vale la pena es la **Base Infoleg de normativa nacional** (ZIP, actualizada el 02/11/2026) y la **Base SAIJ de normativa provincial** (CSV), ambas CC-BY 4.0.

---

## 2. Nueva verificación de las fuentes integradas

| Fuente | Resultado del adaptador (20/11/2026) | Estado | Acción |
|---|---|---|---|
| Mendoza | 323 resultados; fallo del 12/08/2026 | Funciona | Mantener |
| **TSJ CABA** | `getaddrinfo ENOTFOUND jurisprudencia.tsjbaires.gob.ar` | **Rota** | Cambiar a `https://jurisprudencia.tsjbaires.gov.ar` (verificado: 955 resultados) |
| SAIJ | 20 resultados | Funciona | Revisar el uso de `/descarga-archivo` (prohibido por robots) |
| CSJN vía SAIJ | 20 fichas | Funciona | Mantener como ruta secundaria |
| Dialnet | ECONNRESET (túnel cerrado, 2 intentos) | No verificable aquí | Reverificar desde producción |
| Mendoza Legal | 13 resultados; robots sin restricciones | Funciona | Mantener |
| **Corte IDH** | 403 `cf-mitigated: challenge` | **Bloqueada aquí** | Corpus local y aviso; no automatizar el desafío |
| **Río Negro** | 403 CloudFront «Request blocked» | **Bloqueada aquí** | Reverificar desde la IP de producción |
| Juristeca | 1.382 resultados | Funciona | No cosechar `/fallos/` (robots) |
| Santa Fe | ECONNRESET (también bdj.justiciasantafe.gov.ar) | No verificable aquí | Ya depende de ScraperAPI (`proxyOrigen.js`); vigilar |
| Catamarca | Origen 200; acervo local vacío en este entorno | Funciona (cosecha) | Mantener |
| Vistas provinciales SAIJ (6) | 20 resultados cada una | Funcionan | Mantener |
| SCBA · JUBA | 2.744 resultados; fallo del 15/10/2026 | Funciona | Mantener |

### Afirmaciones de la auditoría del 17/11 que cambian

- **Corrientes:** se confirma el bloqueo. El 403 de entonces hoy es una página «Security Check Required», tanto en el portal nuevo como en `juscorrientes.gov.ar/jurisprudencia/`. Queda en catálogo manual.
- **Entre Ríos:** se confirma el control de verificación. Es un captcha de imagen SIU-Toba (`img#ef_antispam-captcha`). Queda en catálogo manual.
- **Chubut:** la auditoría anterior proponía «investigar el formulario anónimo». Hoy está **verificado y es viable** (ver §3.1).
- **Salta y Tucumán**, que eran «candidatos prioritarios»: **no se pudieron verificar**. Salta usa puertos 8091 y 9091; Tucumán devuelve 403 de Apache a IP extranjera. No hay que desarrollar adaptadores sin probarlos antes desde Argentina.
- **Federal y nacional:** el buscador nuevo exige captcha y el `robots.txt` lo excluye. Sólo es viable en catálogo manual.
- **SCBA, listado de sentencias:** usa reCAPTCHA v3. Catálogo manual, porque JUBA ya cubre el núcleo.
- **Córdoba:** su buscador oficial actual es **Jurisemia**, una SPA con Cloudflare Turnstile. Catálogo manual; Córdoba sigue vía SAIJ.

---

## 3. Fuentes nuevas: fichas verificadas

Cada ficha resume lo esencial. El detalle completo, con naturaleza, autoridad, materias, instancias, tipos, antigüedad, actualización, metadatos, automatización, acceso, límites, utilidad marginal y puntajes, está en el JSON.

### 3.1. Chubut · Eureka! (P0)

- **Organismo y naturaleza:** Superior Tribunal de Justicia de Chubut, órgano judicial oficial. Abarca todas las materias y las instancias STJ, cámaras y juzgados.
- **Volumen** según los contadores de la portada: 241.473 sentencias, de las cuales 85.350 están anonimizadas y son públicas; 69.692 sumarios; 29.363 acordadas y resoluciones.
- **Acceso:** la portada ofrece acceso **anónimo explícito** («no requiere ingresar clave»). El login sólo hace falta para los fallos sin anonimizar, que no deben usarse. No tiene captcha ni `robots.txt` (404 de ELB).
- **Método verificado:**
  1. `GET /eureka/Home/RegistrarAccesoAnonimo` para obtener la cookie de sesión.
  2. `GET https://apps1cloud.juschubut.gov.ar/eureka/Sentencias/BuscarPorCriterios?Texto=daño moral&Organismos=&Competencias=&Anios=&Tipo=&Numero=&EsFraseExacta=&EsBusquedaAmplia=&EsNuevaBusqueda=&IdBusqueda=&EsBusquedaAvanzada=&PageIndex=1` devuelve `{"pageCount":50,"totalFilas":4155,"maxFilas":1000,"rows":[{"id":106287,"cell":{"numero":893,"anio":"2026","organismo":"C.Apelaciones C.Rivadavia– Sala 1","competencia":"Laboral - C. Apelaciones","protocolo":"Interlocutoria","fechaFirma":"18/11/2026"}}…]}`. Ojo: con `Tipo=Fallos` devuelve 0, así que hay que dejarlo vacío.
  3. Sumarios: `GET /eureka/Sumarios/BuscarPorCriterios?Texto=…&PageIndex=1` devolvió 1.371 filas, con materia, descriptores y extracto. `POST /eureka/Sumarios/TextoSumario` con `idSumario=64706` devuelve el texto completo.
  4. Documento: `GET /eureka/Sentencias/BajarDocumento?idSentencia=106287` devolvió 200 `application/pdf` de 59 KB.
- **Límites:** cada consulta tiene un tope de 1.000 filas (`maxFilas`), por lo que conviene acotar por año u organismo. No se encontraron términos de uso escritos. No se inspeccionó el PDF para confirmar que sea la versión anonimizada.
- **Valor:** muy alto. Es una provincia hoy ausente, con gran volumen, sumarios con descriptores y PDF oficial.

### 3.2. Jujuy · Sistema de Jurisprudencia (P0)

- **Organismo y cobertura:** Poder Judicial de Jujuy. Incluye STJ, tribunales del trabajo y primera instancia. El propio portal advierte que no incluye cámaras y juzgados penales, familia ni menores, y esa zona ciega debe mostrarse al usuario.
- **API REST** de una SPA Angular, `/endpoints/jurisprudencia/`, sin autenticación ni captcha. No tiene `robots.txt`: la ruta devuelve la SPA.
- **Método verificado:**
  - `POST /endpoints/jurisprudencia/search/documentos?offset=1&limit=2` con el cuerpo `{"palabras":["daño moral"],"filtroPalabras":1}` devuelve `{"response":[{"id_documento":535558,"fecha":"2026-11-12…","tipo_documento":"SENTENCIAS","organo":"Suprema Corte de Justicia (S.T.J.) - Sala I-Vocalía 1","tesauros":"['DAÑOS Y PERJUICIOS',…,'DAÑO MORAL',…]"}…],"results":7947}`. El offset empieza en 1: `offset=0` da error 400.
  - Con `["daño","moral"]` y `filtroPalabras:2` devuelve 9.065 resultados. Sin filtros, el índice total es de 380.418 documentos.
  - Texto: `GET /endpoints/jurisprudencia/documentos/documento-sentencia/535814` devuelve JSON con el **HTML íntegro** de la sentencia, fechada el 19/11/2026.
  - Otros filtros que el frontend envía: `fechaDesde`, `fechaHasta`, `id_organo`, `tesauros`, `id_tipo_documento`, `numero_expediente`, `anio`.
- **No verificado:** la semántica exacta de `filtroPalabras` y los términos de uso.

### 3.3. Tribunal Fiscal de la Nación (P0)

- **Organismo y naturaleza:** tribunal administrativo con funciones jurisdiccionales, dentro del Ministerio de Economía. Competencia impositiva en las salas A–D y aduanera en las salas E–G. Incluye además fallos de la CNCAF.
- **Buscador oficial:** `https://jurisprudenciatfn.mecon.gob.ar/`, asistido por IA. El backend es `https://api.jurisprudencia-tfn.ar`, operado por un tercero con el mismo stack que Santa Cruz.
- `GET /searchStats` devuelve `{"resoluciones_totales":30685,"fallos_tfn":15604,"fallos_cncaf":8055,"doctrinas_identificadas":120159,"fallos_con_pdf":26938}`.
- `POST /hybridSearch` con `{"query":"deducción de intereses ganancias","search_in":"doctrinas"}` devuelve 200 con 25 resultados. Cada uno trae `fallo_id` (por ejemplo `IF-2024-53712803-APN-VOCII#TFN`), `matched_texto`, `objeto_texto`, `metadata` (carátula, registro, tribunal), `doctrinas`, `sumarios`, `texto_completo` y `has_pdf`.
- El esquema es estricto: `search_in` sólo acepta `objetos` o `doctrinas`, y los campos extra (`page`, `page_size`) se rechazan con 422.
- **Complemento barato:** la página «Últimas sentencias» se alimenta de una planilla pública. `https://docs.google.com/spreadsheets/d/1ujG9KKl7KmFTcU8lgRw_61M-khSPLP1Gk-ACmOLTp8Q/gviz/tq?tqx=out:csv` devuelve 1.877 filas: fecha, sala, expediente, carátula, voces y enlace.
- **Advertencias:**
  - Las «doctrinas» y el «objeto» son **extracciones asistidas por IA**. Deben rotularse como tales y no presentarse como sumario oficial.
  - No se identificó el mecanismo de paginación ni el endpoint del PDF.
- **Valor:** muy alto. No hay ninguna fuente tributaria integrada.

### 3.4. Procuración del Tesoro de la Nación (P0)

- **Organismo y autoridad:** la PTN es un órgano asesor. Sus dictámenes son doctrina administrativa obligatoria para el Cuerpo de Abogados del Estado, no para los jueces.
- El frontend (`env-config.js`) declara `REACT_APP_API_URL=https://api.ptn.gob.ar` y una clave de reCAPTCHA. Esa clave **sólo** se usa para descargar el archivo (`/confirmToken`); la búsqueda no la pide.
- `POST https://api.ptn.gob.ar/search?historico=false&solo_historico=false` con una consulta `match` sobre `attachments.attachment.content` («estabilidad empleo público») devolvió `total 243`. Cada resultado trae número GDE, tomo, página, fecha, organismo, expediente, voces y el **texto completo** del dictamen.
- **Método:** reproducir exactamente la consulta del frontend, con `size` de 20 como máximo y excluyendo `attachments` salvo para extraer pasajes. Enlazar al buscador oficial para el PDF, que exige captcha.
- **Advertencia técnica y de conducta:** la API acepta DSL Elasticsearch arbitrario. Una consulta mal formada devolvió un error interno del clúster. IVS CODEX no debe enviar consultas distintas de las del frontend, y conviene avisar a la PTN de esta exposición.

### 3.5. Santa Cruz · buscador inteligente (P1)

- Es el portal oficial `jurisprudencia.jussantacruz.gob.ar`. La API la opera InteligenciaLegal en `https://api.tsj-sc.inteligencialegal.com.ar`.
- `GET /searchStats` devuelve 2.769 fallos, 2.734 sumarios y 13.324 «doctrinas» identificadas.
- `POST /hybridSearch` con `{"query":"daño moral","search_in":"doctrinas"}` devolvió 25 resultados, con `texto_completo` y `has_pdf`.
- Se integra con el mismo adaptador que el TFN, cambiando la URL base. El corpus es chico y los metadatos de IA deben rotularse.

### 3.6. Secretaría de Jurisprudencia de la CSJN (manual + dataset de tomos)

- `sjservicios.csjn.gov.ar/sj/` redirige a `https://sj.csjn.gov.ar/homeSJ/`, que dice «Actualizado al 19/11/2026». Ofrece sumarios desde 1863, todos los fallos desde 1994, búsqueda por tomo y página, destacados, acuerdos e índice de REX.
- **Búsqueda: no automatizable.**
  - `sjconsulta/consultaSumarios`, `fallos`, `novedades` y `fallosDestacados` cargan `recaptcha/enterprise.js` y ejecutan `grecaptcha.enterprise.execute()`.
  - El paginado de novedades (`paginarNovedades.html?indice=0`) responde 403 con la página de bloqueo del WAF.
- **Dataset viable:** `https://sjservicios.csjn.gov.ar/sj/tomosFallos.do?method=iniciar` lista los tomos 1 a 349. `GET /sj/verTomo?tomoId=447` devolvió 200 `application/pdf` (`LibroVol349-1.pdf`, unos 5,2 MB).
  - No hay captcha y el host no tiene `robots.txt`.
  - Permite construir un acervo verificable de citas «Fallos T:P»: extraer el texto y segmentarlo por la numeración de páginas.
  - Sin verificar: el rango completo de `tomoId` (en la página se observaron valores de 357 a 447) y la existencia de términos de uso escritos.

### 3.7. Tribunales federales y nacionales (solo catálogo manual)

- `https://www.csjn.gov.ar/tribunales-federales-nacionales/inicio.html` muestra las sentencias del día: 20 fechadas el 20/11/2026, de juzgados federales de la seguridad social, del trabajo, de la Cámara Federal de Casación Penal y de tribunales orales. Cada una trae tribunal, expediente y carátula en base64, y su PDF.
- El buscador de esa página exige un token de `cap-widget`, un captcha de prueba de trabajo.
- El **`robots.txt` de csjn.gov.ar prohíbe** `inicio.html`, `/d/` (los PDF), `/scp/include/` (`showFile`) y `/adj/fallos/`. No se debe cosechar ni el feed ni los PDF.
- El buscador histórico `buscador-de-fallos.html` acepta POST sin captcha (`acc=search&tags=…`), pero sólo devolvió fallos de 2013–2014 y nada para 2025–2026. Además, su descarga pasa por `scp/include/showFile.php`, que también está prohibida.
- `scw.pjn.gov.ar` es consulta de causas, no jurisprudencia, y tiene `captcha.pjn.gov.ar`. `juris.pjn.gov.ar` no respondió.
- **Recomendación:** pedir un convenio o dataset a la CSJN. Es la mayor ampliación posible de cobertura (primera instancia nacional y federal), pero hoy no hay una vía automática legítima.

### 3.8. Fuentes administrativas servidas como planillas públicas (P1)

Varios «buscadores» de argentina.gob.ar son tablas `ponchoTable` alimentadas por una planilla de Google cuyo `idSpread` figura en el HTML. Se descargan con `https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:csv`:

| Página oficial | Filas | Contenido |
|---|---:|---|
| TFN · Últimas sentencias | 1.877 | fecha, sala, expediente, carátula, voces, enlace |
| CNDC · Buscador de jurisprudencia | 206 | carpeta, etiqueta, trámite, solución, organismo, fecha, sumario |
| SRT · Jurisprudencia | 9 | fecha, tribunal, autos, tema, PDF |

- El `robots.txt` de argentina.gob.ar fija `Crawl-delay: 10` y `Disallow: /*.pdf$`. Conviene **enlazar** los PDF, no descargarlos en masa.
- La planilla de sanciones de Defensa del Consumidor no es una planilla sino JSON (`renai.produccion.gob.ar/api/sanciones`), y desde este entorno respondió `connect_unreachable`: no verificado.
- La URL de COPREC del catálogo devuelve **404**: hay que actualizarla.

### 3.9. Datos abiertos (datos.jus.gob.ar)

La API CKAN v3 funciona: `package_list` devuelve 63 datasets.

| Dataset | Licencia | Actualización | Uso propuesto |
|---|---|---|---|
| Tesauro SAIJ (RDF/SKOS, 7,8 MB; 15.117 conceptos, 6.581 altLabel, 2.287 related) | CC-BY-4.0 | Archivo de 27/10/2020 | **Ya integrado**; controlar el hash periódicamente |
| Base Infoleg Normativa Nacional (ZIP) y complementarias de normas modificadas y modificatorias | CC-BY-4.0 | 02/11/2026 | **P0 dataset**: resolver y verificar citas normativas en fallos y dictámenes |
| Base SAIJ de Normativa Provincial (CSV) | CC-BY-4.0 | 02/11/2026 | P1: citas de leyes provinciales |
| Causas penales y no penales, mediaciones, magistrados | CC-BY-4.0 | 2026 | Estadística; no sirve para búsqueda |

No existe un dataset de sentencias: `q=jurisprudencia`, `q=fallos` y `q=sumarios` dan 0 cada una. Los **datos abiertos de la CSJN** (`datos.csjn.gov.ar`, 309 datasets) tampoco tienen sentencias: `q=sentencias`, `q=fallos` y `q=jurisprudencia` dan 0.

### 3.10. Internacionales

**HUDOC (TEDH), P1: API JSON verificada.**
- La consulta `GET https://hudoc.echr.coe.int/app/query/results?query=contentsitename:ECHR AND ("freedom of expression")&select=itemid,docname,kpdate,appno&sort=kpdate Descending&start=0&length=2` devuelve `{"resultcount":10296,"results":[{"columns":{"itemid":"001-253882","docname":"CASE OF MAZZARELLA v. ITALY","kpdate":"2026-11-19"…}}]}`.
- La ficha de cada caso está en `/eng?i={itemid}`.
- No tiene `robots.txt` real. Las condiciones de reutilización no se verificaron.

**TJUE / EUR-Lex / CELLAR, P2.**
- El SPARQL público (`publications.europa.eu/webapi/rdf/sparql`) devolvió sentencias con `cdm:resource_legal_id_celex` y fecha (por ejemplo `62025TJ0773`, del 07/10/2026).
- El texto en español está en `eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:62014CJ0362` (200).
- El webservice SOAP de EUR-Lex exige registro con EU Login.
- InfoCuria: `robots.txt` con `Allow: /`. EUR-Lex: `Crawl-delay: 10`.

**Corte Constitucional de Colombia, P2 dataset.**
- `datos.gov.co/resource/v2k4-2t8s.json`, con licencia CC BY-SA 4.0, tiene 29.551 sentencias; la última es del 30/10/2026.
- El texto completo está en `/relatoria/{año}/{sentencia}.htm` (verificado con T-001-24), y el `robots.txt` lo permite.

**Solo catálogo manual:**
- **OHCHR JURIS**: Blazor Server, no hay una API HTTP reproducible.
- **CIDH, NORMLEX/OIT, UNCTAD, italaw**: Cloudflare.
- **PJUD Chile**: reCAPTCHA v3.
- **SCJN México y STF Brasil**: 403.
- **TC Perú**: redirige a la portada.
- **ICSID**: no se identificó una API.
- **CLOUT / CISG-Pace**: el `robots.txt` de Pace prohíbe `/search/`.

### 3.11. Doctrina y repositorios

- **OAI-PMH verificado** en:
  - SEDICI (`sedici.unlp.edu.ar/oai/request`, Identify y ListRecords).
  - RDU-UNC (`rdu.unc.edu.ar/server/oai/request`).
  - CONICET Digital (`ri.conicet.gov.ar/server/oai/request`).
- Clasificación: P2 dataset, con cosecha incremental limitada a las colecciones de Derecho. Falta identificar los sets de esas colecciones.
- **Colegios profesionales:** no se verificó ninguna base jurisprudencial abierta. La página de jurisprudencia del CPACF da 404 y el sitio del Colegio de Abogados de la Ciudad no responde.

---

## 4. Tabla de puntajes

Escala de 1 a 5. La columna Σ suma los diez criterios (máximo 50). Las justificaciones están en el JSON.

| Fuente | Aut | Int | Cob | Act | Doc | Meta | Busq | Estab | Marg | Viab | Σ | Clasificación |
|---|---|---|---|---|---|---|---|---|---|---|---:|---|
| HUDOC | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 4 | 3 | 5 | 46 | P1 |
| Chubut · Eureka! | 5 | 4 | 5 | 5 | 4 | 4 | 4 | 4 | 5 | 5 | 45 | **P0** |
| Jujuy | 5 | 4 | 4 | 5 | 5 | 4 | 4 | 4 | 5 | 5 | 45 | **P0** |
| Colombia CC (datos.gov.co) | 5 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 3 | 5 | 45 | P2 dataset |
| datos.jus.gob.ar (Infoleg) | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 4 | 5 | 44 | **P0 dataset** |
| TJUE/CELLAR | 5 | 5 | 5 | 5 | 5 | 5 | 3 | 5 | 2 | 4 | 44 | P2 |
| CSJN Secretaría de Jurisprudencia | 5 | 5 | 5 | 5 | 5 | 5 | 2 | 4 | 5 | 2 | 43 | Manual + dataset de tomos |
| Tribunal Fiscal de la Nación | 4 | 4 | 4 | 5 | 4 | 3 | 5 | 3 | 5 | 4 | 41 | **P0** |
| Procuración del Tesoro | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 5 | 4 | 39 | **P0** |
| TSJ CABA (reparación) | 5 | 3 | 3 | 5 | 4 | 4 | 4 | 2 | 4 | 4 | 38 | **Reparar** |
| SEDICI/RDU/CONICET | 3 | 3 | 3 | 4 | 3 | 4 | 4 | 5 | 3 | 5 | 37 | P2 dataset |
| Federal/nacional (CSJN) | 4 | 3 | 5 | 5 | 4 | 3 | 3 | 3 | 5 | 1 | 36 | Manual |
| Entre Ríos | 5 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 1 | 36 | Manual |
| Corrientes | 5 | 3 | 4 | 5 | 4 | 4 | 3 | 3 | 4 | 1 | 36 | Manual |
| Santa Cruz | 4 | 3 | 2 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 35 | P1 |
| CNDC (planilla) | 4 | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 4 | 4 | 35 | P1 dataset |
| Córdoba · Jurisemia | 5 | 3 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 1 | 35 | Manual |

---

## 5. Hoja de ruta priorizada

### Fase 0: reparar lo integrado (días)

1. **CABA:** en `indiceCaba.js`, cambiar `HOST = 'jurisprudencia.tsjbaires.gov.ar'` y `URL_BUSQUEDA = 'https://…/jurisprudencia/resultadoBusqueda.asp'`, y conservar la codificación windows-1252. Verificado: 955 resultados.
2. **Robots:**
   - Dejar de usar `saij.gob.ar/descarga-archivo` en procesos de cosecha. Para el usuario, enlazar la ficha.
   - No descargar `juristeca…/fallos/*.pdf` en masa.
   - Documentar en `fuentesInfo.js` el criterio «a pedido del usuario» frente a «cosecha».
3. **Corte IDH, Río Negro, Dialnet y Santa Fe:** reverificar desde la IP de producción. Si persiste el desafío de Cloudflare, la Corte IDH debe responder desde el corpus local, con la fecha de corte visible. No usar un navegador automatizado para resolver el desafío.

### Fase 1: integraciones P0 (orden recomendado)

| # | Fuente | Endpoint | Parámetros clave | Respuesta |
|---|---|---|---|---|
| 1 | **Jujuy** | `POST https://jurisprudencia.justiciajujuy.gov.ar/endpoints/jurisprudencia/search/documentos?offset=1&limit=20` | JSON `{palabras:[…], filtroPalabras, fechaDesde, fechaHasta, id_organo}` | `{response:[…], results}`; texto en `GET …/documentos/documento-sentencia/{id}` |
| 2 | **Chubut** | `GET https://apps1cloud.juschubut.gov.ar/eureka/Sentencias/BuscarPorCriterios` (más `/Sumarios/BuscarPorCriterios`) | `Texto`, `PageIndex`, `Tipo` vacío; antes, `RegistrarAccesoAnonimo` | `{pageCount,totalFilas,maxFilas,rows:[{id,cell}]}`; PDF en `/Sentencias/BajarDocumento?idSentencia=` |
| 3 | **TFN** | `POST https://api.jurisprudencia-tfn.ar/hybridSearch` | `{query, search_in:'objetos'\|'doctrinas'}` | `{results:[{fallo_id, metadata, texto_completo, doctrinas, has_pdf}], total}` |
| 4 | **PTN** | `POST https://api.ptn.gob.ar/search?historico=false&solo_historico=false` | Consulta `match` sobre `attachments.attachment.content`, igual a la del frontend | Hits ES con número, tomo, página, fecha, organismo, voces y texto |
| 5 | **Infoleg (dataset)** | Descarga del ZIP vía `package_show?id=base-de-datos-legislativos-infoleg` | Mensual | Normas nacionales para FTS5 y verificación de citas |

**Requisitos comunes a la Fase 1:**
- Cada fuente debe tener su ficha en `fuentesInfo.js`, con rótulos de autoridad. Los dictámenes de la PTN se rotulan como «doctrina administrativa». En el TFN, las doctrinas y objetos son «extracción asistida por IA».
- Cada fuente debe tener su propio límite de tasa y caché.
- Cada adaptador debe distinguir «0 resultados» de «la fuente falló» en el contador de cobertura.

### Fase 2: P1

- **Santa Cruz:** reaprovechar el adaptador del TFN con otra URL base.
- **HUDOC:** API `app/query/results`.
- **Planillas públicas** (TFN últimas sentencias, CNDC): ingesta CSV diaria al acervo, con enlace a la ficha oficial.
- **Normativa provincial SAIJ** (CSV).

### Fase 3: P2 y datasets de alto valor por costo

- **Tomos de «Fallos» de la CSJN:** descarga única, con espera prudente, de unos 349 PDF. Extraer el texto y segmentarlo por tomo y página. Habilita la verificación de citas «Fallos 3xx:yyy» contra la fuente oficial. Costo: almacenamiento y OCR selectivo. Valor: máximo.
- **Corte Constitucional de Colombia:** SODA más relatoría (CC BY-SA 4.0).
- **CELLAR SPARQL:** sentencias del TJUE en español, a pedido.
- **OAI-PMH** de SEDICI, RDU y CONICET, limitado a Derecho.

### Solo catálogo manual (no automatizar)

**Argentina:**
- CSJN, Secretaría de Jurisprudencia: búsqueda con reCAPTCHA Enterprise.
- Tribunales federales y nacionales: cap-widget y `robots.txt`.
- SCBA, listado de sentencias: reCAPTCHA v3.
- Córdoba · Jurisemia: Turnstile.
- Entre Ríos: captcha de imagen.
- Corrientes: «Security Check».
- CNV: captcha.
- Normativa de argentina.gob.ar: captcha de Drupal; usar el dataset de Infoleg en su lugar.
- SRT: 9 registros.

**Internacional:** OHCHR JURIS, CIDH, NORMLEX, UNCTAD, italaw, PJUD Chile, SCJN México, STF Brasil, ICSID y CISG-Pace.

**Pendientes de reverificar desde IP argentina antes de decidir:** Tucumán, Salta, Neuquén (civil y penal), Chaco, Formosa, La Rioja, Tierra del Fuego, San Juan (418), San Luis (403 CloudFront), Santiago del Estero (sólo HTTP), el buscador general de la CNDC (403) y la API de sanciones de Consumo.

### Gestión institucional recomendada

Pedir por nota formal un convenio o un dataset a tres organismos: la **CSJN** (fallos federales y nacionales, y sumarios), la **Corte IDH** (exportación periódica) y **Entre Ríos/Corrientes**. En los tres casos la barrera es un control antiautomatización deliberado, y la vía legítima es institucional.

---

## 6. Correcciones al catálogo manual detectadas

- La URL de COPREC (`argentina.gob.ar/produccion/defensadelconsumidor/coprec`) da **404**.
- El sitio del ENRE redirige a `argentina.gob.ar/enre`, que hoy se presenta como «ENReGE».
- La Secretaría de Jurisprudencia de la CSJN tiene portada nueva en `sj.csjn.gov.ar`.
- El acceso del TSJ de CABA se mudó al dominio `.gov.ar`.
- Faltan en el catálogo, y conviene agregarlos:
  - El buscador del TFN (`jurisprudenciatfn.mecon.gob.ar`).
  - El de Jurisemia de Córdoba.
  - Las planillas de jurisprudencia de la SRT y la CNDC.
  - datos.jus.gob.ar.
  - InfoCuria y NORMLEX, con sus URL actuales (cero apariciones en `frontend/index.html` y `catalogo.html`).

---

## 7. Lo que NO se verificó

- Los términos de uso escritos de Chubut, Jujuy, TFN y PTN. No se localizaron en las páginas probadas; antes de entrar en producción, conviene pedir confirmación por correo.
- La paginación de la API del TFN y de Santa Cruz.
- Si los PDF de Eureka! que se sirven a usuarios anónimos son siempre las versiones anonimizadas.
- El estado de los portales inalcanzables desde este entorno (§5).
- Las condiciones de reutilización de HUDOC.

---

*Las evidencias crudas de esta corrida (cuerpos de respuesta y bitácora `log.txt` con 146 sondeos) quedaron en el scratchpad de la sesión, que es temporal. Las URL, métodos y códigos esenciales están transcritos en el JSON.*
