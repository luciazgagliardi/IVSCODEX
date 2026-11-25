# IVS Codex 2.0 — Matriz de aceptación de consultas y recuperación

**Estado:** matriz inicial de aceptación; pendiente de ejecución sobre un entorno aislado de IVS Codex 2.0.  
**Rama de trabajo:** \`development/ivscodex-2.0-live-engine\`.  
**Documento rector:** \`docs/ivscodex-2.0/01-vision-y-alcance.md\`.  
**Alcance:** comprobar la calidad de recuperación jurídica, la integridad de los resultados y la separación de fuentes. La suite unitaria del backend es un control técnico auxiliar, no equivale a aprobar el producto.

## 1. Qué cuenta como aceptación

Una consulta se considera aceptada sólo si se puede demostrar, con evidencia reproducible, que:

1. El sistema ejecutó los canales previstos o dejó constancia interna de cuáles no pudo completar.
2. No confundió una falla, una respuesta parcial o una restricción de acceso con cero coincidencias.
3. Los documentos devueltos pertenecen a la jurisdicción, materia y período pedidos, o la diferencia está justificada.
4. Cada documento conserva fuente original, organismo, jurisdicción, tipo documental, fecha, identificador y URL de origen cuando esos datos están disponibles.
5. No se mezclan sentencias, sumarios, doctrina, decisiones administrativas ni material internacional como si tuvieran la misma autoridad.
6. La paginación no repite ni saltea documentos y el cursor permite continuar la misma búsqueda.
7. Repetir la consulta con los mismos parámetros produce un conjunto estable, salvo cambios documentados en el portal.
8. Un fallo de un conector no bloquea la consulta a los demás conectores.

Un HTTP 200, una lista no vacía o una suite de mocks aprobada no bastan por sí solos.

## 2. Separación de líneas de prueba

| Línea | Qué demuestra | Qué no demuestra |
|---|---|---|
| Pruebas unitarias y de contrato | Reglas del cliente HTTP, cursores, normalización, deduplicación, tratamiento de errores y regresiones reproducibles | Que el portal externo esté disponible o que su contenido sea exhaustivo |
| Pruebas de integración aisladas | Que API, conectores, acervo e interfaz cooperan en un despliegue de prueba | Disponibilidad permanente de portales fuera del control del sistema |
| Pruebas de recuperación jurídica | Que las consultas encuentran documentos de referencia pertinentes y no agregan documentos que debían excluirse | Exhaustividad universal de documentos no publicados o restringidos |
| Pruebas de concurrencia | Que múltiples consultas no se pisan, no exceden límites internos y no corrompen cursores | Capacidad ilimitada de los organismos externos |
| Diagnóstico de producción | Estado observado desde la infraestructura productiva en un momento concreto | Garantía futura de disponibilidad |

La ejecución registrada de 297 pruebas aprobadas en la rama técnica sirve como línea de base de código. No debe rotularse como aceptación integral de IVS Codex 2.0.

## 3. Matriz funcional transversal

| ID | Dimensión | Caso de prueba | Evidencia que debe conservarse | Condición de aprobación |
|---|---|---|---|---|
| Q-01 | Consulta técnica | Nombre jurídico preciso, con y sin acentos | Consulta, parámetros, IDs y documentos esperados | Recupera los documentos de referencia y no expande a figuras distintas |
| Q-02 | Lenguaje común | Expresión cotidiana que describe hechos | Consulta original, interpretación sugerida y resultados | Sugiere caminos jurídicos sin presentar una calificación automática como definitiva |
| Q-03 | Consulta fáctica | Relato breve de hechos, sujetos y pretensión | Hechos anotados, jurisdicción esperada y resultados | Recupera instituciones pertinentes sin asumir hechos no aportados |
| Q-04 | Consulta normativa | Norma y artículo, incluyendo versión temporal | Identificador normativo, texto aplicable y documentos | Distingue número de artículo, cuerpo normativo, vigencia y aplicación |
| Q-05 | Cita jurisprudencial | Carátula, expediente, tribunal o cita incompleta | Datos aportados y ficha documental coincidente | No verifica una cita por mera similitud de fecha, tomo o número |
| Q-06 | Jurisdicción | Misma materia en Nación y en dos provincias | Filtros y jurisdicción de cada documento | No cruza territorios por defecto ni atribuye la fuente agregadora al tribunal original |
| Q-07 | Tipo documental | Fallo, sumario, doctrina y decisión administrativa | Tipo documental y autoridad | No presenta un resumen o doctrina como texto de sentencia |
| Q-08 | Frase exacta | Expresión compuesta con conectores | Consulta, modo y pasaje que coincide | Respeta orden y presencia de todos los términos |
| Q-09 | Todas / alguna | Consulta de varios términos | Términos coincidentes y documentos | Cumple la semántica declarada de cada modo |
| Q-10 | Exclusión | Consulta con términos que deben excluirse | Filtro y resultados eliminados | Ningún resultado contradice el filtro |
| Q-11 | Período | Rango de años y límites exactos | Fechas de documentos y filtros | No incluye fallos fuera del rango |
| Q-12 | Cero auténtico | Consulta ejecutada correctamente sin documentos | Respuesta completa del origen y filtros aplicados | Sólo entonces puede declararse ausencia de coincidencias |
| Q-13 | Falla / parcial | Timeout, DNS, HTTP 403/5xx, respuesta malformada o un subcanal fallido | Estado interno, fuente afectada y resultado parcial | Nunca se transforma en cero confirmado |
| Q-14 | Paginación | Al menos tres páginas de una búsqueda estable | Cursor por página, IDs y orden | No hay duplicados ni saltos |
| Q-15 | Concurrencia | Consultas simultáneas de distintos usuarios y términos | Tiempos, cursores y trazas correlacionadas | No hay contaminación entre búsquedas ni saturación provocada por el propio orquestador |
| Q-16 | Cancelación | Nueva consulta antes de terminar la anterior | ID de búsqueda y cancelaciones | La respuesta vieja no reemplaza la nueva ni ocupa indefinidamente la cola |
| Q-17 | Procedencia | Resultado directo, agregado, proxy autorizado y acervo | Canal de recuperación y fuente original | La atribución del documento no cambia según el canal por el que se obtuvo |
| Q-18 | Estabilidad | Repetición idéntica y comparación entre páginas | IDs, metadatos, orden y fecha de prueba | Diferencias explicadas por actualización del origen, no por pérdida de cursor |

## 4. Matriz por conector registrado

Cada conector debe completar las mismas pruebas de consulta, cero auténtico, paginación, procedencia y concurrencia, con adaptaciones a su contrato. Las vistas provinciales de SAIJ se evalúan como filtros territoriales del agregador, no como conexiones directas a los poderes judiciales provinciales.

| Conector | Naturaleza que debe conservarse | Prueba particular obligatoria |
|---|---|---|
| Mendoza | Portal del Poder Judicial provincial; Suprema Corte y cámaras civiles/laborales como circuitos separados | SC, CC y CT por separado; comparación entre búsqueda temática y campo de partes |
| CABA / TSJ | Fuente judicial primaria | Sesión/POST, respuesta de desafío, alternativa autorizada y conservación de filtros |
| SAIJ | Agregador oficial nacional | Fallos frente a sumarios, facetas, cursor y consultas estrictas |
| CSJN vía SAIJ | Vista de SAIJ filtrada por Corte Suprema, no conector independiente al portal protegido de la Corte | Identificación de la faceta y prevención de doble conteo con SAIJ |
| Dialnet | Repositorio académico/doctrinario | Separar artículo, autor, resumen y sentencia; no usarlo como prueba primaria de existencia de expediente |
| Mendoza Legal | Selección editorial de jurisprudencia | Identificar su carácter editorial y no equipararlo a un repositorio exhaustivo oficial |
| Corte IDH | Tribunal internacional regional | Tipo de decisión, fecha, identificador y texto oficial |
| Río Negro | Buscador judicial provincial y protocolo | Circuito de acceso/proxy autorizado, paginación y descarga de ficha |
| Juristeca | Repositorio de cámaras de CABA | Fecha, enlace al PDF y política de lectura/cosecha aplicable |
| Santa Fe | Corte provincial, sumarios y texto disponible | Correspondencia entre sumario, ficha y texto de sentencia |
| Jujuy | Sistema de jurisprudencia provincial | Paginación, filtros, estructura JSON y ámbitos jurisdiccionales incluidos/excluidos |
| Catamarca | Captura de publicaciones oficiales con consulta sobre acervo | Separar cosecha de consulta; identificar período y cobertura real capturada |
| Chubut / Eureka | Sistema judicial provincial | Acceso anónimo, cookies, redirecciones, renovación de sesión, JSON y paginación |
| TFN | Tribunal administrativo nacional | Separar objeto/fallo, texto oficial, sumario y doctrinas asistidas por IA |
| Santa Cruz | Tribunal Superior provincial | Distinguir objeto judicial, texto disponible y extracto asistido |
| HUDOC | Jurisprudencia del Tribunal Europeo de Derechos Humanos | Identificador HUDOC, idioma, tipo de documento y carácter extranjero |
| SCBA / JUBA | Suprema Corte y cámaras de la Provincia de Buenos Aires | Cookie/sesión, filtros, paginación y enlace al fallo completo |
| Vistas provinciales de SAIJ | Agregación territorial de SAIJ | Etiquetar procedencia SAIJ; no atribuir una ficha directamente al poder judicial provincial |

**Fuentes previstas pero no integradas como conectores en esta matriz inicial:** Procuración del Tesoro e InfoLEG. Su incorporación requiere verificar acceso, condiciones de uso, autoridad, cobertura y contrato documental.

## 5. Construcción del conjunto de referencia jurídico

La batería de 280 consultas de vocabulario existente se conserva como una línea de evaluación terminológica. No es todavía un conjunto suficiente de recuperación documental.

Cada caso nuevo debe incluir:

- \`id\` estable y versión del conjunto;
- consulta exacta y clase de consulta;
- rama, especialidad y jurisdicción;
- período y filtros;
- concepto o conceptos esperados;
- documentos positivos de referencia con identificador y URL oficial;
- documentos que deben excluirse y motivo;
- tipo documental y nivel de autoridad requerido;
- consulta equivalente o variante que debe recuperar el mismo documento;
- criterio de deduplicación;
- fecha de verificación y persona que revisó el caso.

No se debe completar un caso con una carátula inventada, una ficha sin enlace verificable o un resultado cuya pertinencia se deduzca sólo de que comparte palabras.

### Fuentes de casos

1. Los 280 casos de \`docs/auditoria-integral-2026/datos/consultas-referencia.json\`, conservando su objetivo de vocabulario.
2. Las preguntas de diagnóstico de \`docs/auditoria-integral-2026/datos/preguntas-especialistas.json\`, tratadas como perspectivas simuladas y no como validación de profesionales reales.
3. Nuevas consultas por rama y especialidad, anotadas a partir de documentos oficiales verificables.
4. Casos adversariales: homónimos, conceptos contrapuestos, mismo artículo en normas distintas, misma carátula en jurisdicciones distintas y términos que el motor no debe expandir.

## 6. Criterios de aceptación por etapa

### A. Puerta técnica
- suite automatizada aprobada;
- sintaxis validada;
- transporte seguro predeterminado;
- timeout vigente hasta el final de lectura del cuerpo;
- reintentos limitados y sólo para fallas transitorias;
- sin credenciales en logs ni en URLs expuestas.

### B. Puerta de integridad de consulta
- cero fallas transformadas en cero;
- cero respuestas parciales presentadas como completas;
- cursores estables;
- deduplicación reproducible;
- cancelación de consultas obsoletas;
- una fuente fallida no interrumpe a las demás.

### C. Puerta jurídica
- documentos positivos y negativos anotados;
- autoridad y tipo documental preservados;
- filtros de jurisdicción y tiempo respetados;
- equivalencias verificadas;
- precisión y exhaustividad medidas sólo sobre el conjunto anotado y con metodología publicada.

### D. Puerta de integración
- repetir la batería sobre el entorno aislado;
- probar distintos usuarios, términos y fuentes en paralelo;
- conservar trazas por ID de consulta;
- contrastar cada resultado con el portal o documento oficial;
- registrar fecha, entorno, versión de código, versión de acervo y configuración no secreta.

## 7. Estado de ejecución

| Control | Estado |
|---|---|
| Suite automatizada de backend | 297/297 aprobadas en el commit \`e73992ca4551743dd7e46727a69c04e127999679\`; línea de base técnica, no aceptación de producto |
| Prueba de timeout durante lectura del cuerpo | Aprobada en esa misma ejecución |
| Auditoría completa de orquestación | En curso |
| Conjunto de recuperación documental con positivos y negativos revisados | Pendiente de construir |
| Ejecución de matriz contra entorno aislado 2.0 | Pendiente |
| Diagnóstico de portales en vivo desde entorno aislado | Pendiente |
| Diagnóstico de producción | No ejecutado |
| Despliegue o modificación de datos productivos | No ejecutado |

No se deben convertir estados pendientes en resultados aprobados ni extrapolar una captura puntual a disponibilidad permanente.

## 8. Evidencia mínima a archivar por ejecución

Cada corrida de aceptación debe conservar un JSON/JSONL con:

- \`run_id\`, fecha UTC y entorno;
- commit de código y versión/hash del acervo;
- identificador del caso y consulta;
- filtros enviados;
- conectores previstos, consultados y fallidos;
- tiempos por conector;
- total declarado, cantidad devuelta y cursor siguiente;
- IDs documentales, tipo y procedencia;
- positivos encontrados y negativos incorrectamente recuperados;
- causa interna normalizada de fallas;
- resultado de cada condición de aceptación.

No almacenar claves, cookies, tokens, datos de sesión ni información personal innecesaria.
