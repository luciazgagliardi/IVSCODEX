# 02 · Auditoría funcional de IVS CODEX (versión publicada)

**Objeto:** la aplicación publicada en <https://ivscodex.sigillvm.com/> y su API en `https://iuris-cvehbxasbkbwccas.brazilsouth-01.azurewebsites.net/api`.
**Fecha de las pruebas:** 20 de noviembre de 2026.
**Entornos:** Chromium (Playwright) en escritorio a 1440×900 y en el perfil `iPhone 13` de Playwright (390×664), con `locale es-AR`.
**Carga sobre la API:** 13 búsquedas completas en las 18 bases (dos de ellas simultáneas, en dos pestañas), 2 búsquedas en una sola base, 1 corrida de «Comparar», 4 verificaciones de cita (3 desde la interfaz y 1 directa a la API), 3 llamadas a `/voz`, 1 a `/extraer-archivo` y 1 intento de inicio de sesión con datos falsos. Las caídas se simularon con `page.route`, sin consultar la API real.

> **Versión auditada.** El `frontend/index.html` del repositorio local (rama `claude/laughing-mccarthy-czlbrp`, con cambios sin confirmar) **no coincide** con el publicado: hay unas 120 líneas distintas a partir de la 5284, y `lector-voz.js` publicado (`?v=20261120-voz3`, 388 líneas) es más nuevo que el local (305 líneas). Por eso **todas las referencias `frontend/index.html:N` de este informe remiten a la copia publicada**, descargada en `scratchpad/funcional/prod/index.html` y `prod/lector-voz.js`. Hasta la línea 5284 el número coincide con el del repositorio. Las referencias al backend (`backend/...`) son del repositorio local, porque el código del servidor publicado no puede leerse.
>
> **Evidencias.** Cada afirmación remite a un archivo de `/tmp/claude-0/-home-user-IVSCODEX/d8cd0855-d31b-5889-b360-396bfd4f0b92/scratchpad/funcional/` (abreviado `SP/`): scripts `p1.js`…`p14.js`, resultados `*.json` y capturas en `SP/cap/`.

---

## 1. Resumen ejecutivo

La plataforma **funciona de punta a punta en lo básico**:

- la portada deja entrar en escritorio y en celular;
- las consultas reales devuelven resultados de varias bases;
- la búsqueda por carátula encuentra el fallo correcto («Fiorentino» aparece primero y unificado con su ficha de SAIJ);
- el Lector maneja un documento de 306 000 caracteres;
- el verificador distingue «no la encontramos» de «es falsa»;
- Plazos, Despido, Citar, Norma, Glosario, Herramientas y el recorrido guiado hacen lo que dicen.

Navegar entre secciones **no pierde** la consulta, y las búsquedas sucesivas rápidas **no mezclan** resultados.

Los problemas graves están en **cómo se informan los resultados y los errores**, que es justo lo que un abogado usa para sacar conclusiones:

1. **Falsos ceros.**
   - En la columna de bases (el «riel»), una base que falló muestra **«0»**, igual que una que respondió sin coincidencias (F-01, corregido en la rama, no en producción).
   - Cuando el acervo local devuelve 0 y la consulta oficial falla, el panel dice **«Sin coincidencias… Pruebe con menos palabras»** (F-02).
   - El contador general puede decir **«0 resultados»** con tres bases caídas.
2. **Totales inflados.** El total suma SAIJ nacional, sus seis vistas provinciales y la CSJN «vía SAIJ», y además mezcla totales crudos del sitio oficial: «al menos 266.663 resultados» para *despido con causa* (F-03).
3. **Filtro de años ignorado en Juristeca.** Con el rango 2023–2024, los 50 resultados de la base eran de 2026 (F-04).
4. **Consultas que se pierden.**
   - El navegador corta cada base a los 35 s y la presenta como «Se cortó la comunicación con el servidor».
   - Con dos búsquedas simultáneas, entre 9 y 11 de las 18 bases fallaron (F-05).
   - El límite de 120 peticiones cada 5 minutos por IP se agota con dos o tres búsquedas (F-06, corregido en la rama).
5. **El verificador da por buena una cita con tomo y fecha falsos.** «Halabi… Fallos: 301:999, 24/02/1979» obtuvo **«Coincidencia encontrada»** (F-07). Además, la «Guía de verificación» de la misma pantalla dice que, si la carátula no aparece, el precedente **«se presume inexistente»** (F-08).
6. **El selector «Tasa aplicable» de Intereses es solo visual.** Calcula con la tasa que escribe el usuario, pero el resultado la rotula «tasa activa del Banco de la Nación» (F-10).
7. **Privacidad presentada de forma inexacta.**
   - Se afirma que el Lector trabaja «directamente en su navegador», pero los archivos van al servidor.
   - La lectura en voz alta envía el texto del fallo al servidor y, desde allí, a un servicio de Microsoft que no se menciona en la política de privacidad.
   - El contacto para ejercer los derechos de la Ley 25.326 es `contacto@su-dominio.com` (F-11, F-12).

La **lectura en voz alta** cumple lo pedido en la interfaz:

- hay un único control «Escuchar», con su ícono;
- usa siempre la voz `es-AR-ElenaNeural`;
- no cambia a inglés;
- no depende de voces instaladas en el dispositivo.

En cambio, depende de un servicio no oficial de Microsoft Edge, no tiene alternativa si ese servicio falla y, ante un error del servidor, le dice al usuario que revise su conexión (F-12).

---

## 2. Estado por sección

Estados posibles: **funciona** · **parcial** · **solo visual** · **rota** · **no verificable**.

| Sección / función | Estado | Evidencia |
|---|---|---|
| **Portada:** «Iniciar la consulta» y tarjetas de servicios | funciona | `p1.js`, `SP/cap/01-landing-*.png`. Los enlaces con `data-tab` abren la sección (mensaje `ivs:abrir`, `frontend/index.html:1880`). |
| Portada: «Términos de uso» y «Política de privacidad» | funciona (contenido inexacto, F-11) | `frontend/portada/index.html:244-272` |
| Portada: enlace «contacto@su-dominio.com» | rota (es un marcador de posición) | `frontend/portada/index.html:242` |
| Portada: textos «ocho motores», «once bases», «doce bases», «18 fuentes» | información inconsistente (F-17) | `portada/index.html:222`, `index.html:5017`, `README.md:8`, `SP/funciones3.json` («Comparar las 18 fuentes») |
| **Buscar:** consulta en todas las bases | funciona, con F-01 a F-06 | `SP/busquedas-escr.json`, `SP/cap/03-*.png` |
| Buscar: carátula («Fiorentino, Diego Enrique s/ tenencia…») | funciona | `SP/movil.json`: primera fila correcta, «2 fichas del mismo fallo · también en SAIJ» |
| Buscar: cita de artículo («art. 245 LCT») | parcial: totales confusos («SAIJ 223 · sitio: 181.054»; «CÓR 0 · sitio: 7.535») | `SP/busquedas-escr.json` |
| Buscar: consulta coloquial («me cortaron la luz sin aviso») | parcial: 9 resultados irrelevantes, sin advertencia (F-16) | `SP/cap/03-buscar-me_cortaron_la_luz_sin_aviso-escr.png` |
| Buscar: búsquedas sucesivas rápidas | funciona: sin mezcla de resultados | `SP/concurrencia.json` → `contaminados: {}` |
| Buscar: dos búsquedas simultáneas | parcial: entre 9 y 11 bases con error | `SP/concurrencia.json` → `simultaneas` |
| Buscar: volver después de navegar entre secciones | funciona | `SP/concurrencia.json` → `navegar` (40 filas antes y después) |
| Buscar: recargar la página | parcial: reaparece la portada y se pierden los resultados (F-13) | `SP/concurrencia.json` → `recarga`, `SP/cap/30-tras-recarga-escr.png` |
| Buscar: filtro de años | parcial: Juristeca lo ignora (F-04) | `SP/filtros.json` |
| Buscar: filtros contradictorios (Doctrina + Mendoza) | funciona: «Ninguna base coincide con estos filtros» | `SP/cap/81-filtros-contradictorios-escr.png` |
| Buscar: API caída desde el inicio | parcial: abre Google limitado a sitios de Mendoza (F-18) | `SP/fallas.json` → `caidaInicio.popups` |
| Buscar: «Compartir» la búsqueda | parcial: pierde el modo «frase exacta» (F-14) | `frontend/index.html:4579` |
| **Lector:** texto pegado largo (306 526 caracteres) | funciona: se dibuja en 1,8 s; navegar por coincidencias funciona | `SP/lector.json` |
| Lector: coincidencias en documentos largos | parcial: sólo marca las primeras 1500 (F-15) | `SP/lector.json` → `cnt1` |
| Lector: enlace a un PDF escaneado | funciona: ofrece OCR, con texto técnico (F-19) | `SP/funciones3.json` → `escaneoMovil` |
| Lector: archivo .docx | rota (anunciado, no soportado; F-20) | `/extraer-archivo` → 422 `HTML_SIN_TEXTO` |
| Lector: guardar pasaje | funciona: queda en `localStorage` `jedj:pasajes` | `SP/funciones.json` → `lector_pasaje` |
| Lector: cita del pasaje | parcial: incluye el literal «[tribunal]» | ídem |
| Lector: atribución de normas («Cód. Civ. y Com.», «C. Penal») | rota en producción; corregido en la rama (F-23) | informado por la coordinación; no reinvestigado |
| Lector: «Escuchar» (voz) | parcial: un solo control con ícono, voz es-AR; servicio frágil y privacidad no informada (F-12) | `SP/lector.json` → `voz`, `vozCaida`; `backend/routes/voz.js` |
| Lector: accesibilidad básica | funciona en lo verificado: `lang="es-AR"`, foco visible (contorno dorado de 1 px), `aria-label` y `aria-live` en la voz | `SP/lector.json` → `foco`, `a11y` |
| Lector: contraste | no verificable automáticamente (el fondo es una capa transparente) | `p14.js` |
| **Ramas** | funciona: se dibujan las 28 ramas, sin errores de consola | `SP/secciones.json` |
| **Requisitos** | funciona; en celular, el enlace «ver el texto oficial» mide 16 px de alto | `SP/secciones.json` → `movil.requisitos` |
| **Comparar** | funciona: 18 fuentes en 20 s | `SP/funciones3.json` → `comparar` |
| **Norma** (art. 245 LCT) | funciona: trae el texto desde InfoLeg | `SP/funciones2.json` → `norma` |
| **Fuentes** (catálogo de 125) | funciona | `SP/secciones.json` |
| **Citar** | funciona: arma y copia «CSJN, "Halabi…", sent. del 24/02/2009, Fallos: 332:111.» | `SP/funciones.json` → `citar` |
| **Verificar:** cita real de la CSJN | parcial: «Coincidencia encontrada · confianza media», pero el candidato es de 2007 y la cita es de 2009 (F-07) | `SP/verificar.json` |
| Verificar: cita inventada | funciona: «No la encontramos», con la advertencia de que eso no prueba falsedad | `SP/verificar.json` |
| Verificar: tomo y fecha falsos | rota: «verificada» (F-07) | `SP/verificar-fallos-erroneo.txt` |
| Verificar: cita de la SCBA | parcial: se consultó sólo SAIJ, que falló → «No se pudo verificar» (F-09) | `SP/verificar.json` |
| Verificar: guía de verificación | contradice el límite de la propia pantalla (F-08) | `frontend/index.html:8444,8456` |
| **Glosario** | funciona (búsqueda «dubio»: 2 de 69); en celular, el índice de letras mide 12×15 px | `SP/funciones.json`, `SP/secciones.json` |
| **Plazos** | funciona: 19/11/2026 + 5 días hábiles en Mendoza → 27/11, con el feriado del 23/11 descontado | `SP/funciones.json` → `plazos` |
| **Cálculos: Despido** | funciona: 6 años computables, preaviso de 2 meses, integración de 16 días | `SP/funciones2.json` → `despido` |
| **Cálculos: Intereses**, selector de tasa | solo visual (F-10) | `frontend/index.html:9779,9792`; `SP/funciones2.json` |
| **Herramientas:** unir PDF | funciona: descarga `documento-unido.pdf` de 2 páginas | `SP/funciones.json` → `herramientas_unir` |
| Herramientas: OCR | no verificado (usa el servidor y lo informa) | `frontend/herramientas.js:391-393,459` |
| **Guardados / perfil** | funciona en local; con cuenta sincroniza, pero los fallos de sincronización son silenciosos (F-21) | `frontend/index.html:3642-3656` |
| **Cuenta:** inicio de sesión con datos inválidos | funciona: 401 y mensaje claro | `SP/funciones.json` → `cuenta_login_mal` |
| Cuenta: alta de usuario | no verificado (para no crear datos en producción) | — |
| **«Cómo usar»** y Lexia → «Recorrido completo» | funciona: 23 pasos y cierre | `SP/funciones3.json` → `tour` |
| **Lexia** (asistente) | parcial: interpreta mal rangos de años y preguntas (F-22) | `SP/funciones2.json` → `lexia`, `lexia2` |
| **Paletas** (seis) | funciona: se aplican y quedan en `localStorage` `ivs-tema`; los nombres no coinciden con el README (F-17) | `SP/funciones.json` → `paletas` |
| **Celular:** desbordes horizontales | funciona: `scrollWidth = 390` en las 15 secciones | `SP/secciones.json` |
| Celular: menú «Más» | funciona: la grilla se desplaza por dentro y «Herramientas» es alcanzable | `SP/movil.json` → `menuScroll`, `herrClick` |
| Celular: riel de bases | funciona como tira horizontal desplazable | `SP/cap/50-buscar-movil.png` |
| Consola y red por sección (en reposo) | sin errores en las 15 secciones, en ambos tamaños | `SP/secciones.json` (`errores: []`) |
| Consola y red durante búsquedas | errores de CORS y `ERR_ABORTED` (F-05) | `SP/busquedas-escr.json`, `SP/concurrencia.json` → `logErr` |

---

## 3. Hallazgos

Prioridades: **P0** integridad y estabilidad · **P1** recuperación · **P2** acervo · **P3** inteligencia · **P4** experiencia.

### F-01 · El riel muestra «0» para las bases que fallaron (falso cero) — P0 · **corregido en la rama, pendiente en producción**

- **Dónde:** `frontend/index.html:5499`, en `estadoBase`: `if(im.busco&&im.error) return {c:"",t:'<span class="rf-n">0</span>'};`
- **Por qué ocurre:** el error y el resultado vacío comparten la misma salida visual.
- **Consecuencia:** el abogado lee «TSJ 0» o «SAIJ 0» como que no hay jurisprudencia, cuando la base ni siquiera se consultó.
- **Cómo se reproduce:** `SP/fallas.json` → `todoCaido.riel` (las 18 bases en «0» con la API caída) y `SP/cap/41-api-fallas-parciales-escr.png`. En producción, con fallas reales: «TSJ 0», «DIALNET 0», «TUC 0», «CHA 0» en *daño moral*, todas con error (`SP/busquedas-escr.json`).
- **Solución:** mostrar un estado de error distinto (por ejemplo «sin respuesta», con su ícono) y excluir la base del total.
- **Cómo comprobar el arreglo:** con `page.route` devolviendo 503 para una base, el riel no debe mostrar «0».
- **Estado:** según la coordinación, está corregido en la rama y no en producción.

### F-02 · «Sin coincidencias» cuando el acervo devuelve 0 y el sitio oficial falla (falso cero) — P0

- **Dónde:** `frontend/index.html:7003-7006`. Si `imBusco.porCopia&&esNueva`, la respuesta oficial fallida se «suma» pero no se registra `im.error`. Después, en las líneas 7252 y 7259, el panel dice «Sin coincidencias en … para esta búsqueda. Pruebe con menos palabras.»
- **Consecuencia:** se presenta como búsqueda válida sin resultados una consulta que el sitio oficial no respondió. El acervo es una copia parcial.
- **Cómo se reproduce:** `p6.js` con `scba/local` → `{ok:true,resultados:[]}` y `scba/buscar` → 502. El panel dice «En vivo no disponible / Sin coincidencias… Pruebe con menos palabras» (`SP/fallas.json` → `panel_scba`, `SP/cap/42-panel-scba-falla-escr.png`). En el mismo escenario, la cabecera dice **«0 resultados»** aunque tres bases fallaron (`fallas.c`). En producción aparecieron casos equivalentes: «DIALNET 0 · en vivo no disponible» y «PJRN 0 · en vivo no disponible» (`SP/busquedas-escr.json`, *art. 245 LCT*).
- **Solución:**
  - si la consulta en vivo falla y el acervo devolvió 0, marcar la base como «no verificada» y no como «sin coincidencias»;
  - el contador general debe decir «0 en las bases que respondieron; N bases sin respuesta».
- **Cómo comprobar el arreglo:** repetir `p6.js`; el panel de SCBA debe decir que la base no pudo consultarse.

### F-03 · Totales inflados y sumas de bases que se superponen — P0

- **Dónde:** `frontend/index.html:5687` y `5708` (`tot` suma `cuantosDe` de todas las bases visibles) y `5572-5578` (`cuantosDe` devuelve `totalFuente` del sitio cuando `parcial`).
- **Por qué ocurre:**
  - se suman SAIJ nacional, las vistas SAIJ de Córdoba, Entre Ríos, Neuquén, Tucumán, Chaco y Corrientes, y la CSJN «vía SAIJ». El README advierte que esas vistas «no deben sumarse»;
  - además se suman totales crudos de los sitios, que no respetan el modo «todas las palabras» ni los filtros.
- **Consecuencia:** cifras como «al menos **266.663** resultados» para *despido con causa*, «61.928» para *daño moral* o «SAIJ 42.852» para *daño punitivo* en 2023–2024 (esta última, inverosímil; no se verificó contra SAIJ). El riel muestra además «SAIJ 0 · sitio: 424.956» para la consulta coloquial. Eso da una idea falsa del volumen de jurisprudencia o de su ausencia.
- **Evidencia:** `SP/concurrencia.json` → `simultaneas.a.cuenta`, `SP/busquedas-escr.json`, `SP/filtros.json` y `SP/cap/03-buscar-me_cortaron_la_luz_sin_aviso-escr.png`.
- **Solución:**
  - contar documentos únicos por identificador entre SAIJ, sus vistas provinciales y la CSJN;
  - mostrar el total crudo del sitio sólo como dato separado («el sitio informa N filas»);
  - no sumarlo al total general.
- **Cómo comprobar el arreglo:** con *despido indirecto*, el total general debe ser menor o igual que la suma de los resultados únicos de cada base.

### F-04 · Juristeca ignora el rango de años — P0

- **Dónde:** `backend/lib/indiceJuristeca.js:96-99`. Envía `AnioDesde` y `AnioHasta` al portal y no vuelve a filtrar la respuesta.
- **Consecuencia:** con el filtro «2023–2024», los **50 de 50** resultados de Juristeca eran de 2026 (por ejemplo, «02/10/2026 Lufrano, José y otros c/ Almundo SRL»). Un abogado que filtra por período cita fallos fuera del período sin advertirlo.
- **Evidencia:** `SP/filtros.json` → `fechas.juristeca`, `SP/cap/80-anios-saij-escr.png`. Las demás bases que respondieron respetaron el rango (Mendoza 13 de 13, SCBA 4 de 4, Santa Fe 9 de 9).
- **Solución:** filtrar del lado del servidor por `fecha` (como `paginarFiltrado.js`) para todas las bases y mostrar cuántos resultados se descartaron.
- **Cómo comprobar el arreglo:** con *daño punitivo* y 2023–2024, ningún resultado de Juristeca debe tener un año fuera del rango.

### F-05 · Consultas que se pierden por cortes del cliente y bajo concurrencia — P0

- **Dónde:**
  - `frontend/index.html:6780`: corte a los 35 s en `/buscar`;
  - `frontend/index.html:6642`: corte a los 8,5 s en `/local` rápida, que se descarta sin aviso;
  - `frontend/index.html:7042`: mensaje «Se cortó la comunicación con el servidor.»
- **Consecuencia:**
  - en búsquedas individuales fallaron entre 2 y 7 de las 18 bases por búsqueda;
  - con dos pestañas a la vez fallaron 11 bases en una y 11 en la otra («CSJSF, CAT, CÓR, ER, NQN, TUC, CHA, CTES, PJRN…»);
  - el mensaje atribuye un corte de tiempo del navegador a «la comunicación»;
  - una respuesta 503 del servidor también se informa como «Se cortó la comunicación» (`SP/fallas.json` → `panel_mendoza`);
  - en consola aparecen respuestas sin cabecera CORS para `/indice/corrientes/buscar`, `/indice/entrerrios/buscar` y `/indice/caba/local`. La causa no es verificable desde el cliente; es compatible con errores de la infraestructura de Azure que no pasan por Express.
- **Evidencia:** `SP/busquedas-escr.json` (21 `ERR_ABORTED` en *daño moral*) y `SP/concurrencia.json` (`simultaneas`, `logErr`).
- **Solución:**
  - alinear el corte del cliente con el tope del servidor y devolver resultados parciales con estado;
  - permitir «Reintentar sólo las fallidas»;
  - distinguir «tardó demasiado» de «el servidor respondió con error»;
  - en el servidor, encolar por usuario en lugar de dejar que el navegador aborte.
- **Cómo comprobar el arreglo:** dos pestañas simultáneas no deben dejar bases en error sin un botón de reintento, y el texto debe indicar la causa real.

### F-06 · Límite de 120 peticiones cada 5 minutos que comparten búsqueda, fragmentos y voz — P0 · **corregido en la rama, pendiente en producción**

- **Dónde:**
  - `backend/config.js:186-187`: 120 peticiones cada 5 minutos;
  - `backend/index.js:124-137`: el límite aplica a todo `/api/` salvo `/local`.
- **Evidencia:**
  - una búsqueda completa generó unas 24-32 peticiones `/buscar` y 20 `/fragmentos` (`SP/concurrencia.json` → `reqPorTipo`);
  - `POST /voz` devuelve la cabecera `ratelimit: limit=120, remaining=118` (medición directa), así que la voz consume el mismo cupo.
- **Consecuencia:** según la coordinación, una segunda búsqueda dentro de los 5 minutos recibía 429 y el riel mostraba «0» (ver F-01). En un estudio que comparte IP, el cupo es común a todos sus integrantes.
- **Cómo se reproduce:** dos búsquedas completas seguidas desde la misma IP. No lo reproduje para no forzar el límite.
- **Solución:**
  - excluir `/fragmentos` y `/voz` del cupo de búsqueda o darles cupo propio;
  - limitar por sesión y no sólo por IP;
  - ante un 429, mostrar «límite alcanzado, reintente en N s» en cada base.
- **Cómo comprobar el arreglo:** tres búsquedas en dos minutos sin ningún 429.
- **Estado:** corregido en la rama.

### F-07 · El verificador da «Coincidencia encontrada» aunque el tomo, la página y la fecha contradigan la cita — P0

- **Dónde:** `backend/lib/verificarCita.js:497-524`. El veredicto `verificada` con fuerza `media` se otorga sólo por la carátula; ni el tomo y la página de Fallos ni la fecha restan puntaje cuando no coinciden.
- **Cómo se reproduce:**
  - `POST /verificar-cita` con «CSJN, «Halabi, Ernesto c/ P.E.N. - ley 25.873 - dto. 1563/04 s/ amparo ley 16.986», **Fallos: 301:999, 24/02/1979**» devuelve `veredicto: verificada`, `confianza: media`, con un candidato fechado el **14/08/2007** (`SP/verificar-fallos-erroneo.txt`);
  - con la cita correcta (Fallos 332:111, 24/02/2009) devuelve el mismo candidato de 2007 (`SP/verificar.json`);
  - la interfaz muestra la píldora verde «Coincidencia encontrada» (`SP/cap/10-verificar-real-escr.png`).
- **Consecuencia:** un tomo o una fecha equivocados pasan como verificados, y el abogado puede presentar una cita con datos erróneos.
- **Solución:**
  - comparar el tomo y la página con la colección Fallos (CSJN) y la fecha cuando ambas existan;
  - si contradicen la cita, emitir el veredicto «carátula coincide, datos de cita no coinciden» en color de advertencia y listar las diferencias.
- **Cómo comprobar el arreglo:** la cita con 301:999 y 1979 no debe dar `verificada`.

### F-08 · La «Guía de verificación» afirma que un precedente no hallado «se presume inexistente» — P0

- **Dónde:**
  - `frontend/index.html:8444`: «Verifique la carátula en la base oficial del tribunal emisor; ante su ausencia, el antecedente se presume inexistente»;
  - `frontend/index.html:8456`: «Descarte citas que no registren menciones en doctrina, jurisprudencia posterior ni en el buscador del propio organismo».
- **Por qué es un problema:** contradice el recuadro «Límite de la verificación» de la misma pantalla y el texto del backend («No encontrarla acá no prueba que no exista»).
- **Consecuencia:** induce a concluir la falsedad de un precedente real que no está indexado. Los buscadores oficiales no publican la totalidad de lo que dictan sus tribunales (lo dice el propio sistema).
- **Solución:** reemplazar ambas frases por «ante su ausencia, la cita no puede tenerse por confirmada: consúltela en mesa de entradas o en el expediente».
- **Cómo comprobar el arreglo:** buscar en el HTML «se presume inexistente»; no debe aparecer.

> Nota: el veredicto del verificador cumple lo pedido. Con una cita inventada respondió «No la encontramos» y explicó que eso «no prueba que no exista» (`SP/verificar.json` → `verif_inventada`).

### F-09 · El verificador oculta las fuentes que fallaron y tiene menos cobertura que el buscador — P1

- **Dónde:**
  - `frontend/index.html:8384`: `resultadoCita` sólo lista las fuentes con `f.ok`;
  - `backend/lib/verificarCita.js:497-526`: si al menos una fuente respondió, puede emitir `no_encontrada` y la explicación nombra sólo las fuentes que respondieron.
- **Consecuencia:**
  - un «No la encontramos» puede deberse a que la fuente pertinente estaba caída, sin que la pantalla lo diga. Esto surge de la lectura del código; no lo reproduje;
  - una cita de la SCBA («Ubertalli…») se buscó sólo en SAIJ y no en JUBA, aunque JUBA está integrada en Buscar. Como SAIJ no respondió («fetch failed»), el resultado fue «No se pudo verificar» (`SP/verificar.json` → `verif_scba`);
  - el README promete buscar «en la fuente que corresponde al tribunal» (`README.md:49`).
- **Solución:**
  - listar las fuentes caídas con su error;
  - impedir `no_encontrada` si la fuente propia del tribunal falló;
  - sumar SCBA, Santa Fe, Juristeca y las demás bases de tribunales a `fuentesAConsultar`.
- **Cómo comprobar el arreglo:** con SAIJ simulada caída y Mendoza disponible, una cita de la CSJN no debe dar «No la encontramos».

### F-10 · El selector «Tasa aplicable» de Intereses es solo visual — P0

- **Dónde:** `frontend/index.html:9792` (el selector `intereses.tipo`) y `9779`. El tipo elegido sólo cambia el rótulo `nombreTasa`; la tasa siempre la escribe el usuario en cada tramo.
- **Cómo se reproduce:** cargar capital 1.000.000, el período 01/01/2024–31/12/2024 y la tasa 36 %, y elegir «Activa del Banco de la Nación». El resultado dice «365 días al 36 % anual… con la **tasa activa del Banco de la Nación** que se cargó» (`SP/funciones2.json` → `interesesBNA`, `SP/cap/64-intereses-bna.png`). Sin tasa escrita, el cálculo dice «El tramo 1 está incompleto» (`SP/funciones.json` → `intereses`).
- **Consecuencia:** la liquidación copiada certifica como «tasa activa BNA» un número que la plataforma no obtuvo ni controló. A la vez, el selector sugiere que la tasa se trae sola.
- **Solución:**
  - obtener la serie de la tasa activa (o la pasiva del BCRA, ya usada en «Actualización»: `API_BCRA`, línea 9699) y precargar los tramos;
  - o bien quitar el selector y rotular «tasa indicada por el usuario».
- **Cómo comprobar el arreglo:** al elegir «Activa BNA» sin escribir tasa, el cálculo debe traer los valores con su fuente y su fecha.

### F-11 · Afirmaciones de privacidad inexactas y contacto inexistente — P0

- **Dónde y qué dice:**
  - `frontend/index.html:7842`: «El Lector opera directamente en su navegador»;
  - política de privacidad (`frontend/portada/index.html`, objeto `LEGAL.privacidad`): «El texto que se pega o el archivo que se sube para leerlo en el Lector… se procesan en su navegador».
- **Qué hace realmente:**
  - el archivo se envía a `POST /extraer-archivo` (`frontend/index.html:11276`; el propio comentario dice «se manda tal cual al servidor»);
  - el texto que se escucha se envía a `/api/voz` y, desde allí, a `wss://api.msedgeservices.com` (Microsoft; `backend/routes/voz.js`, `sintetizarVozArgentina`), un tercero que la política no menciona;
  - el contacto para ejercer los derechos de la Ley 25.326 es `contacto@su-dominio.com`, con `href="#"` (`portada/index.html:242`).
- **Consecuencia:** el abogado puede subir o hacer leer escritos con datos sensibles de sus clientes creyendo que no salen de su equipo, y no tiene a quién dirigirse para ejercer sus derechos.
- **Solución:**
  - corregir ambos textos;
  - avisar junto al botón «Elegir archivo» y junto a «Escuchar» que el contenido se envía al servidor y, en el caso de la voz, a Microsoft;
  - poner un contacto real.
- **Cómo comprobar el arreglo:** revisar los textos y que el enlace de contacto sea un `mailto:` válido.

### F-12 · Lectura en voz alta: dependencia frágil y comunicación incompleta — P0

**Qué se verificó:**

- **Un solo control.** Hay un único botón «Escuchar» visible, con su ícono SVG y `aria-label` «Escuchar lectura del fallo». Hay una sola `.lector-voz` y no hay controles duplicados (`SP/lector.json` → `voz`).
- **Prioridad es-AR.** La voz es fija, `es-AR-ElenaNeural`, con `xml:lang="es-AR"`, y se sintetiza en el servidor (`backend/routes/voz.js`, constantes `VOZ` y `LANG`). `GET /voz` devuelve `{"idioma":"es-AR","voz":"es-AR-ElenaNeural","requiereInternet":true}`.
- **Cambio silencioso a inglés:** no puede ocurrir. No se usa `speechSynthesis` y la voz es fija (`prod/lector-voz.js`).
- **Voces del dispositivo:** no depende de ellas. Un `POST /voz` directo devolvió `200 audio/mpeg` (346 752 bytes en 5,4 s).

**Problemas:**

1. **Servicio no oficial.** La síntesis imita a la extensión «Read Aloud» de Microsoft Edge (`TRUSTED_CLIENT_TOKEN`, firma `Sec-MS-GEC`, `origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold`, `backend/routes/voz.js`). No hay contrato ni garantía, y un cambio de Microsoft la rompe sin alternativa: no existe respaldo con `speechSynthesis` es-AR.
2. **El error culpa al usuario.** Ante un error del servidor, la interfaz dice «No se pudo generar la voz argentina. **Revise la conexión**…» (`SP/lector.json` → `vozCaida`, con 502 simulado), aunque la falla sea del servidor.
3. **Limitaciones poco claras.** El aviso dice «el fragmento se envía al servicio de voz», sin nombrar a Microsoft. El README dice que lo lee «desde el navegador» (`README.md:72`).
4. **Demora en documentos largos.** Con 306 000 caracteres (501 tramos), a los 9 s seguía «Preparando el audio, tramo 1 de 501…». Cada tramo consume cupo del límite de F-06.

**Solución:**

- contratar un servicio de síntesis con credenciales propias o, como alternativa declarada, usar `speechSynthesis` con una voz `es-*` (sin pasar a inglés, y avisando si el dispositivo no tiene voces en español);
- distinguir el mensaje «el servicio de voz no respondió» de los problemas de conexión;
- nombrar al proveedor.

**Cómo comprobar el arreglo:** con `/voz` simulado en 502, el mensaje debe indicar la falla del servicio y ofrecer la alternativa.

### F-13 · Recargar o volver a la portada pierde los resultados — P1

- **Dónde:** `frontend/index.html:4590` (`leerDeURL`). Restaura `q` desde la URL, pero no vuelve a ejecutar la búsqueda, y la portada se abre siempre.
- **Cómo se reproduce:** buscar *usucapión* y recargar. Se ve la portada, y al entrar `q` vale «usucapión» con 0 filas (`SP/concurrencia.json` → `recarga`, `SP/cap/30-tras-recarga-escr.png`).
- **Consecuencia:** la recarga accidental en el celular obliga a repetir una búsqueda que tarda entre 40 y 120 s y que consume el cupo de F-06. Abrir un enlace compartido con `?q=` exige pulsar Buscar.
- **Solución:** si la URL trae `q`, saltar la portada y ofrecer «Repetir esta búsqueda», o conservar los resultados en `sessionStorage`.

### F-14 · El enlace compartido pierde el modo «frase exacta» — P1

- **Dónde:** `frontend/index.html:4579`: `if(par[0]==="modo"&&v==="exacta") return; // el modo por defecto tampoco`. Pero el modo por defecto es `"todas"` (`frontend/index.html:3492`).
- **Consecuencia:** quien recibe el enlace corre otra búsqueda, con todas las palabras en cualquier orden, y ve resultados distintos.
- **Cómo se reproduce:** elegir «frase exacta» y mirar la URL: no aparece `m=exacta`. Al abrirla, `estado.modo` queda en `todas`. Esto surge del código; la URL de la búsqueda real con el modo por defecto fue `?q=usucapi%C3%B3n&m=todas` (`SP/concurrencia.json`).
- **Solución:** omitir el parámetro sólo cuando `v==="todas"`.

### F-15 · Duplicados visibles y coincidencias no marcadas en documentos largos — P1

- **Duplicados entre bases.** Sólo se unifican en las búsquedas por nombre (`frontend/index.html:5607`). En *art. 245 LCT* aparecieron «Matheou… c/ Merrill Lynch…» en CSJN y en SAIJ, y «Sánchez Pablo Ignacio vs. Salta Refrescos» en TUC (vista SAIJ) y en SAIJ (`SP/busquedas-escr.json` → `dups`).
- **Filas aparentemente iguales.**
  - TSJ mostró dos filas con la misma carátula y el mismo expediente (18487/2020) que corresponden a resoluciones distintas (7/4/2021 y 8/9/2021), sin nada que las distinga en la fila (salida de `p13.js`);
  - en las vistas SAIJ provinciales se repiten títulos de sumario idénticos («Prescripción adquisitiva» en NQN, TUC y CHA).
- **Lector.** Con 3001 coincidencias sólo se marcan las primeras 1500 («3001 coincidencias (se marcan las primeras 1500)», `SP/lector.json`). La segunda mitad de un fallo extenso queda sin resaltar ni navegar.
- **Solución:**
  - deduplicar por `claveFallo` (fecha más carátula normalizada) entre CSJN, SAIJ y sus vistas, mostrando «también en…»;
  - agregar a la fila el tipo y la fecha de la resolución;
  - en el Lector, marcar por tandas o virtualizar en lugar de cortar en 1500.

### F-16 · Consulta coloquial: resultados irrelevantes presentados como coincidencias — P3

- **Dónde:** el resaltado y la recuperación aceptan palabras sueltas y prefijos. «me» no está en `VACIAS` (`frontend/index.html`, `VACIAS`), así que se resaltan «mes» y «Mesa».
- **Cómo se reproduce:** *me cortaron la luz sin aviso* devuelve 9 resultados. Siete son de la Corte IDH (por ejemplo, «Unión Patriótica Vs. Colombia», con «le **cortaron** la lengua» resaltado) y dos son accidentes de tránsito de Mendoza. No hay ninguna advertencia de baja pertinencia ni reformulación jurídica (corte de suministro, servicio público, defensa del consumidor). Ver `SP/cap/03-buscar-me_cortaron_la_luz_sin_aviso-escr.png`.
- **Solución:**
  - traducir la consulta coloquial con el tesauro a voces jurídicas y proponerlas antes de buscar;
  - avisar cuando las coincidencias son sólo de palabras sueltas.

### F-17 · Cifras y nombres inconsistentes entre README, portada y aplicación — P4

- **Cantidad de bases:**
  - «ocho motores» en la portada (`frontend/portada/index.html:222`);
  - «Las once bases a la vez» en el menú (`frontend/index.html:5017`);
  - «doce bases» en el README (`README.md:8`, `README.md:67`);
  - «Comparar las 18 fuentes» en Comparar;
  - las bases del riel son 18 (`FUENTES_INDICE`).
- **Paletas:** el README dice «Noche, Día, Descanso, Azul, Verde y Bordeaux» (`README.md:63`), y la interfaz ofrece Día, Noche, Gris, Azul, Verde y Marino.
- **Pie de página:** dice «No almacena fallos» (`frontend/index.html:10384`), pero el servidor guarda un acervo SQLite de casi todo SAIJ (`README.md:143`). Este punto toca al acervo (P2) y a la transparencia.
- **Solución:** una sola fuente de verdad para esos números y textos.

### F-18 · Con la API caída, «Buscar» abre Google limitado a sitios de Mendoza — P1

- **Dónde:** `frontend/index.html:5806-5810` (`buscarEnTodas` → `data-act="barrido"`).
- **Cómo se reproduce:** bloquear la API. Aparece «El buscador en vivo no está disponible ahora: se abre la búsqueda con Google» y se abre `google.com/search?q=(site:jus.mendoza.gov.ar OR …)` con 12 sitios mendocinos, que además derivó a la página de verificación de Google («sorry») (`SP/fallas.json` → `caidaInicio.popups`).
- **Consecuencia:** el abogado buscó en todas las bases y recibe sólo Mendoza, a través de un buscador no oficial.
- **Solución:** decir que el servicio no está disponible, ofrecer los enlaces directos a cada buscador oficial y, si se mantiene Google, abarcar todas las jurisdicciones seleccionadas.

### F-19 · Mensajes técnicos o engañosos para el usuario — P4

- **Lector sin servidor:** «Para activarla, levante el servidor con `npm start` y recargue esta página» (`frontend/index.html:7837`; `SP/fallas.json` → `caidaInicio.lector`).
- **PDF escaneado:** «Se le puede aplicar OCR (ver **POST /api/ocr**…)» (`SP/funciones3.json` → `escaneoMovil`).
- **Riel en celular y escritorio:** los códigos de base se truncan cuando hay una nota («S..», «D.», «P..»). En Mendoza la etiqueta «SCJM» se reemplaza por «Mendoza + SAIJ · parcial» (`SP/cap/03-buscar-me_cortaron_la_luz_sin_aviso-escr.png`, `SP/cap/41-api-fallas-parciales-escr.png`).
- **Aviso «Los resultados del acervo permanecen disponibles».** Aparece aun cuando el servidor entero está caído y no hay acervo que consultar (`SP/fallas.json` → `todoCaido.avisos`).
- **Solución:** reescribir esos mensajes para el usuario final y reservar el detalle técnico para la consola.

### F-20 · «Word (.doc/.docx)» anunciado, pero .docx no se lee — P1

- **Dónde:** el texto de `frontend/index.html:7824` dice «PDF o Word (.doc/.docx)», pero `accept` (línea 7831) no incluye .docx y `backend/lib/extraerDoc.js:1-3` sólo lee el .doc binario.
- **Cómo se reproduce:** subir `SP/prueba.docx`. El servidor responde **422** `HTML_SIN_TEXTO` («La página cargó pero no tiene texto aprovechable… ábrala en el navegador»), un mensaje que no corresponde a un archivo Word. En la interfaz, a los 6 s seguía «Leyendo…» (`SP/cap/22-lector-docx-escr.png`).
- **Solución:** extraer .docx (zip con XML, por ejemplo con mammoth) o quitarlo del texto y devolver «formato .docx no admitido; guárdelo como PDF».

### F-21 · La sincronización con la cuenta falla en silencio — P1

- **Dónde:** `frontend/index.html:3642-3656` (`guardarEnCuenta` termina en `["catch"](function(){})`) y `3621-3638` (`traerDatosDeCuenta`).
- **Consecuencia:** si el `PUT /mis-datos` falla (por ejemplo, por un 429 de F-06), el usuario cree tener sus pasajes en la nube y no los tiene. Esto surge de la lectura del código; no lo reproduje con una cuenta real.
- **Qué se guarda y dónde:**
  - **localStorage** del navegador: `jedj:pasajes` (texto literal de los pasajes, verificado en `SP/funciones.json`), `jedj:fav`, `jedj:anillos`, `jedj:requisitos`, `jedj:inhabiles`, `ivs-tema` y `jedj:token`, el token de sesión, que queda expuesto ante un XSS;
  - **servidor**, sólo con sesión: `fav`, `hist` (las últimas 20 búsquedas, que pueden contener datos de clientes), `pasajes` y `anillos`;
  - al cerrar sesión, se vacían `fav` y `pasajes` locales (`frontend/index.html:10728-10732`).
- **Solución:** mostrar «no sincronizado, reintentar»; guardar el token en memoria o en una cookie `HttpOnly`; informar en la política que las búsquedas se guardan en el servidor.

### F-22 · Lexia distorsiona la consulta — P3

- **Dónde:** `frontend/index.html:8694-8698`. Reconoce «entre X y Y», «desde X» y «hasta Y», pero no «de X a Y».
- **Cómo se reproduce:**
  - «quiero buscar fallos de despido en Mendoza de 2020 a 2024» queda como `q="despido de 2020 a 2024"`, sin rango de años: busca los números 2020 y 2024 como palabras;
  - «¿el art. 245 LCT se aplica a empleados públicos?» queda como «Se lo busco: artículo 245»: pierde la ley y la pregunta (`SP/funciones2.json` → `lexia`, `lexia2`).
- **Solución:** agregar el patrón «de AAAA a AAAA» y conservar los términos sustantivos («empleados públicos», «LCT»).

### F-23 · Atribución errónea de normas en el Lector («Cód. Civ. y Com.», «C. Penal») — P0 · **corregido en la rama, pendiente en producción**

- **Estado:** informado por la coordinación como corregido en la rama y no publicado. No lo reinvestigué.
- **Consecuencia:** el panel de normas citadas en el fallo puede asignar un artículo a un código equivocado.
- **Cómo comprobar el arreglo:** pegar un texto con «art. 1741 del Cód. Civ. y Com.» y «art. 80 del C. Penal» y comprobar la atribución en el panel.

### F-24 · Dominio de TSJ CABA caído — P2 · **corregido en la rama, pendiente en producción**

- **Estado:** informado por la coordinación (el dominio del TSJ estaba caído y la rama ya lo resuelve).
- **Evidencia coincidente:** en producción, TSJ figuró como «El buscador oficial no respondió a la consulta en vivo» en *daño moral* y en *despido con causa* (`SP/busquedas-escr.json`, `SP/concurrencia.json`), y la rápida `/indice/caba/local` terminó con error de CORS.
- **Relación con F-01:** con el riel de producción, eso se veía como «TSJ 0».

---

## 4. Respuestas a las preguntas de la consigna

**¿Qué funciona realmente?**

- La entrada desde la portada, en escritorio y en celular.
- La búsqueda simultánea, con resultados reales en la mayoría de las bases.
- La búsqueda por carátula, con unificación CSJN/SAIJ.
- Las búsquedas sucesivas, sin mezcla.
- La persistencia de la consulta al navegar entre secciones.
- El Lector con texto largo y la navegación por coincidencias.
- Guardar pasajes.
- El veredicto prudente ante una cita inexistente.
- Plazos, con feriados.
- Despido.
- Citar.
- Norma (InfoLeg).
- Glosario.
- Comparar.
- Unir PDF.
- El recorrido de 23 pasos.
- Las seis paletas.
- La responsividad: sin desborde horizontal en las 15 secciones a 390 px.
- La voz es-AR, cuando el servicio responde.

**¿Qué es solo visual?**

- El selector «Tasa aplicable» de Intereses (F-10).
- El enlace de contacto de la portada (F-11).
- La promesa de procesar en el navegador el texto y los archivos del Lector (F-11).
- El anuncio de soporte .docx (F-20).

**¿Qué botones no producen acción?**

- `contacto@su-dominio.com` (`href="#"`).
- Los chips «Activa del Banco de la Nación» y «Pasiva promedio del BCRA», que sólo cambian el rótulo.
- Todos los `data-act` del HTML tienen manejador (`SP/acts.txt`, 110 acciones).

**¿Qué consultas se pierden?**

- Las de las bases que superan los 35 s, o las 8,5 s de la consulta rápida al acervo (F-05).
- Bajo concurrencia, entre 9 y 11 bases por búsqueda.
- Las que reciben 429 al repetir dentro de los 5 minutos (F-06, corregido en la rama).
- Todas al recargar (F-13).
- El modo exacto al compartir (F-14).
- Los rangos de años dichos a Lexia (F-22).

**¿Qué resultados se duplican?**

- La CSJN y SAIJ.
- Las vistas SAIJ provinciales y SAIJ nacional.
- Filas idénticas en apariencia del TSJ (mismo expediente, distintas resoluciones).
- Sumarios con el mismo título (F-15).
- En los totales, además, se suman bases superpuestas (F-03).

**¿Qué errores generan falsos ceros?**

- Una base con error en el riel aparece como «0» (F-01).
- El acervo vacío con la consulta oficial caída se presenta como «Sin coincidencias» (F-02).
- El contador «0 resultados» con bases caídas (F-02).

**¿Qué información se presenta incorrectamente?**

- Los totales inflados y los «sitio: N» (F-03).
- Los resultados fuera del rango de años (F-04).
- «Se cortó la comunicación» para cortes de tiempo o respuestas 503 (F-05, F-19).
- La tasa rotulada como BNA (F-10).
- La privacidad del Lector y de la voz (F-11, F-12).
- «No almacena fallos» y las cifras de bases (F-17).
- El literal «[tribunal]» en la cita del pasaje.
- La atribución de códigos en el Lector (F-23, corregido en la rama).

**¿Qué puede inducir a conclusiones jurídicas equivocadas?**

- Los falsos ceros: «no hay jurisprudencia» (F-01, F-02).
- «Coincidencia encontrada» con tomo y fecha falsos (F-07).
- La guía que presume inexistente lo no hallado (F-08).
- Un «No la encontramos» con la fuente pertinente caída (F-09).
- Citar fallos fuera del período filtrado (F-04).
- Una liquidación con la tasa «activa BNA» no verificada (F-10).
- Cifras de volumen jurisprudencial irreales (F-03).
- Resultados coloquiales irrelevantes presentados como coincidencias (F-16).

---

## 5. Lo que no se pudo verificar

- El código del backend publicado: sólo pude leer el del repositorio.
- La causa exacta de los errores de CORS (F-05).
- El 429 de F-06: no lo provoqué a propósito.
- El alta de cuenta y la sincronización real.
- El OCR.
- El contraste de color: el fondo es una capa transparente y la medición automática no es fiable.
- El volumen real de SAIJ para *daño punitivo* 2023–2024.
- La corrección de F-01, F-06, F-23 y F-24 en la rama, que no está publicada.

## 6. Evidencias

- **Scripts:** `SP/comun.js` y `SP/p1.js` … `SP/p14.js`.
- **Resultados:** `busquedas-escr.json`, `verificar.json`, `verificar-fallos-erroneo.txt`, `lector.json`, `concurrencia.json`, `fallas.json`, `secciones.json`, `movil.json`, `funciones.json`, `funciones2.json`, `funciones3.json`, `filtros.json`.
- **Capturas:** `SP/cap/*.png` (01 a 81).
- **Copia del frontend publicado:** `SP/prod/index.html`, `SP/prod/lector-voz.js`.

`SP` = `/tmp/claude-0/-home-user-IVSCODEX/d8cd0855-d31b-5889-b360-396bfd4f0b92/scratchpad/funcional`
