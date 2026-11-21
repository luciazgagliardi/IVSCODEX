# 06 — Ramas y especialistas: mapa de cobertura jurídica del vocabulario

Auditoría integral 2026 · IVS CODEX · 20/11/2026

Consejo interdisciplinario simulado de 60 especialistas (40 áreas tradicionales y 20 especialidades emergentes) que revisó las 28 ramas del buscador, el inventario terminológico recién construido (`backend/datos/vocabulario/inventario.json`) y el analizador (`backend/lib/vocabulario.js`). No se modificó ningún archivo del repositorio salvo los entregables de esta carpeta.

**Datos completos (JSON):**

- `datos/preguntas-especialistas.json` — 371 preguntas, con lo que devolvió `analizar()` y el diagnóstico de cada una.
- `datos/anillos-propuestos.json` — 32 equivalencias medidas en vivo, 38 propuestas sin medir, 36 relaciones tipadas y 22 siglas. Todas en estado «propuesta».
- `datos/consultas-referencia.json` — batería de regresión: 280 casos, 10 formas por rama, con la línea base de hoy.
- `datos/correcciones-inventario.json` — ramas mal asignadas, bloques mal asignados, relaciones SAIJ engañosas, anillos curados que hay que revisar, defectos del analizador y ejemplos del tesauro que no corresponden a su voz.

**Convenciones.** «SAIJ» es el Tesauro SAIJ de Derecho Argentino (CC-BY 4.0) tal como está en el inventario. «Voz SCJM» es una voz del tesauro de jurisprudencia del Poder Judicial de Mendoza (`voces-scjm.txt`). Lo que dice una fuente se cita con su id (`saij:NNNN`) o con la voz en mayúsculas. Lo que es razonamiento del consejo está redactado como propuesta. Lo que no se pudo comprobar dice **(no verificado)**. Ninguna carátula, fecha ni fallo de este informe es inventado: los que aparecen salen de los ejemplos del repositorio o de las respuestas de la API.

---

## 1. Resumen ejecutivo

1. **El inventario tiene volumen pero está mal repartido.** De 15.116 conceptos SAIJ, 2.754 (18%) no tienen rama, y cuatro ramas de RAMAS casi no tienen vocabulario propio: **nna (10 conceptos), gen (17), ejec (26) y dipr (31)**. No es que SAIJ no tenga esos temas: la regla de rama los manda a otro lado (la violencia familiar a ddhh, la adopción y la adoptabilidad a fam, el penal juvenil a pen, la restitución internacional a nna y no a dipr).
2. **Las ramas más débiles** (índice combinado de cobertura de voces, regresión y preguntas): **agua, gen, seg, pi, elec, amb, cons y nna**. Siete de esas ramas (agua, gen, pi, elec, nna, dipr y proc_civ) **no tienen un solo ejemplo** en `frontend/datos/tesauro/`: 68 voces vacías, más «caso Badaro» en prev.
3. **El analizador entiende la forma técnica, no la pregunta real.** En la batería de regresión cumple 26 de 28 consultas técnicas y 26 de 28 descriptores judiciales, pero **1 de 28 coloquiales, 1 de 28 fácticas y 7 de 28 por artículo**. Entre las 371 preguntas del consejo se reconocieron completas 168 (45%). Se reconocieron 1 de 14 formuladas desde los hechos y 2 de 22 coloquiales.
4. **Hay defectos de código que tapan vocabulario existente.** `singular()` recorta «-es» aunque el singular termine en «-e»: «accidente de trabajo» no reconoce la voz ACCIDENTES DE TRABAJO, y lo mismo pasa con «nombre de dominio» y «consumidor hipervulnerable». La medición dio 3.689 resultados en Mendoza para la forma singular. Las palabras sueltas genéricas se reconocen como conceptos de otra rama: «acción» y «daños» terminan en penal, «auto» en resoluciones judiciales, «garantía» en fianza, «internación» en ejecución penal y «salvataje» en navegación.
5. **Hay una expansión indebida activa.** «tenencia» se indexa sola como equivalencia histórica de «cuidado personal», con política «expandir». Por eso «tenencia ilegítima», «posesión y tenencia» o «tenencia responsable de perros» suman «cuidado personal» a la búsqueda. Lo mismo pasa con «régimen de visitas carcelarias», que se expande a «régimen de comunicación».
6. **SAIJ trae relaciones que inducen a error.** Detectamos 19, y las más graves son estas. «daño punitivo» cuelga de «multa civil», dentro de las sanciones conminatorias (astreintes). «régimen de comunicación» figura como término no preferido de «plan de parentalidad». «compensación económica» cuelga de «indemnización» y tiene «resarcimiento» como sinónimo. «cláusulas abusivas» queda como no preferido de «cláusulas leoninas». El comentario de `relaciones-historicas.json` dice que SAIJ pone el daño punitivo bajo el daño moral, y **en el inventario actual no es así**.
7. **De 32 equivalencias medidas en la API de producción, 15 quedaron validadas, 8 validadas con reservas y 9 rechazadas o inconclusas.** Las siglas «ART» y «DGI» son falsas como equivalentes: «ART» devolvió 11.256 resultados porque coincide con «art.», y «DGI» trae solo la Dirección General Impositiva. «pago previo» y «defensa propia» traen material impertinente en el modo de búsqueda por defecto. «sustracción internacional de menores» sobra: 17 de 19 resultados se superponen con los de la otra forma.
8. **Hay ejemplos del tesauro que no corresponden a su voz.** De 1.682 ejemplos, el filtro léxico marcó 173 y la lectura uno por uno clasificó 86 como impertinentes y 58 como tangenciales. El caso que se pidió documentar, «prisión preventiva peligro de fuga», trae dos sumarios de concursos. El peor caso es «debida diligencia reforzada», que trae nulidades de notificaciones. La causa dominante es la homonimia de una sola palabra.

---

## 2. Método

| Paso | Qué se hizo | Herramienta / fuente |
|---|---|---|
| Cobertura | Por rama: conceptos del inventario (`rama`), cuántos tienen `vozScjm`, subramas SAIJ (ancestro de nivel 1) con su id, y si cada voz de `RAMAS` es descriptor o término SAIJ, voz SCJM o al menos reconocida por `analizar()`. | `inventario.json`, `frontend/index.html` (`var RAMAS`) |
| Preguntas | 60 especialistas, entre 3 y 9 preguntas cada uno (371 en total), formuladas desde lo técnico, los hechos, lo coloquial, la pretensión, la defensa, la vía procesal y el artículo. Cada una se pasó por `analizar()` y cada concepto esperado se buscó también en el inventario. | `analizar()` |
| Diagnóstico | Concepto ausente del inventario, presente pero no reconocido por la formulación, presente con otra forma, o reconocimiento erróneo/ambiguo. Los erróneos se marcaron leyendo cada salida. | revisión manual |
| Inventario | Barrido por palabras clave de otra rama dentro de cada rama; lectura de la jerarquía (`broader`) y de los no preferidos de unos 70 conceptos críticos. | `inventario.json` |
| Medición | 32 pares de formas, buscadas cada una por separado en `mendoza` (acervo local de 18.611 documentos) y/o `saij` (en vivo). Se registró el total, el solapamiento de ids en la primera página (20) y una pertinencia heurística sobre los sumarios. Después se leyeron las muestras. Hubo 90 consultas, de a una cada 2,6 s. | API de producción |
| Ejemplos | 1.682 ejemplos de 309 voces en `frontend/datos/tesauro/*.json`: un filtro léxico y luego lectura manual de los sospechosos. | revisión manual |

**Límites.** El criterio de «reconocido» es léxico y algo permisivo. La pertinencia heurística falla con sentencias de texto completo (el extracto es el encabezado) y con palabras que aparecen en otros sentidos («desestimación del recurso»), por eso cada veredicto se corrigió a mano. El total de SAIJ que informa la API es el de la página, no el del sitio. Mendoza busca por defecto en modo «todas las palabras», lo que infla los totales de las frases de varias palabras.

---

## 3. Mapa de cobertura por rama

El índice es el promedio de cuatro cosas: la proporción de voces de RAMAS que son descriptores SAIJ, el cumplimiento en la batería de regresión, el reconocimiento de las preguntas del consejo y el volumen de conceptos en escala logarítmica. Cuanto más bajo, más débil. La tabla está ordenada de la rama más débil a la más fuerte.

| Rama | Conceptos SAIJ | Con voz SCJM | Voces RAMAS | Voces = descriptor SAIJ | Voces = voz SCJM | Voces reconocidas por `analizar()` | Preguntas: esperados reconocidos | Regresión (línea base) | Ejemplos (voces vacías) | Ejemplos impertinentes | Índice |
|---|---|---|---|---|---|---|---|---|---|---|---|
| agua — Aguas, minería y territorio | 210 | 201 (96%) | 10 | 3 | 4 | 9 | 3/8 | 4/10 | 3 (9) | 0 | 0,46 |
| gen — Género y violencia | 17 | 12 (71%) | 10 | 3 | 3 | 8 | 6/9 | 6/10 | 0 (10) | 0 | 0,50 |
| seg — Seguros | 104 | 103 (99%) | 10 | 3 | 3 | 9 | 4/10 | 7/10 | 74 (0) | 5 | 0,52 |
| pi — Propiedad intelectual y datos | 200 | 172 (86%) | 10 | 5 | 5 | 9 | 5/10 | 3/10 | 0 (10) | 0 | 0,52 |
| elec — Electoral y partidos | 172 | 167 (97%) | 7 | 3 | 3 | 6 | 5/9 | 4/10 | 0 (7) | 0 | 0,53 |
| amb — Ambiental | 254 | 238 (94%) | 10 | 3 | 3 | 6 | 6/11 | 5/10 | 55 (0) | 8 | 0,54 |
| cons — Consumidor | 60 | 51 (85%) | 13 | 9 | 8 | 13 | 6/12 | 4/10 | 95 (0) | 3 | 0,55 |
| nna — Niñez y adolescencia | 10 | 10 (100%) | 10 | 6 | 6 | 8 | 6/8 | 6/10 | 0 (10) | 0 | 0,57 |
| proc_pen — Procesal penal | 262 | 252 (96%) | 12 | 5 | 7 | 11 | 6/11 | 6/10 | 86 (0) | 3 | 0,59 |
| ejec — Ejecución penal | 26 | 26 (100%) | 9 | 7 | 6 | 8 | 6/10 | 5/10 | 63 (0) | 1 | 0,59 |
| ddhh — Derechos humanos | 630 | 453 (72%) | 10 | 4 | 4 | 8 | 5/7 | 3/10 | 62 (0) | 10 | 0,59 |
| dipr — Internacional privado | 31 | 28 (90%) | 10 | 7 | 7 | 9 | 6/8 | 4/10 | 0 (10) | 0 | 0,59 |
| sind — Colectivo del trabajo | 92 | 92 (100%) | 9 | 6 | 6 | 8 | 5/8 | 5/10 | 61 (0) | 6 | 0,61 |
| dan — Daños | 414 | 403 (97%) | 15 | 9 | 9 | 14 | 4/13 | 7/10 | 111 (0) | 4 | 0,62 |
| com — Comercial y societario | 1149 | 1099 (96%) | 11 | 7 | 6 | 10 | 4/9 | 4/10 | 79 (0) | 8 | 0,62 |
| art — Riesgos del trabajo | 71 | 67 (94%) | 10 | 7 | 7 | 10 | 6/11 | 6/10 | 73 (0) | 3 | 0,62 |
| cyq — Concursos y quiebras | 191 | 191 (100%) | 11 | 8 | 8 | 10 | 7/11 | 4/10 | 75 (0) | 3 | 0,63 |
| fam — Familia | 255 | 239 (94%) | 14 | 9 | 9 | 12 | 8/17 | 7/10 | 101 (0) | 2 | 0,65 |
| prev — Previsional | 299 | 288 (96%) | 10 | 4 | 4 | 7 | 6/9 | 8/10 | 47 (1) | 1 | 0,67 |
| lab — Laboral individual | 918 | 872 (95%) | 13 | 6 | 6 | 12 | 12/21 | 7/10 | 88 (0) | 3 | 0,68 |
| trib — Tributario | 681 | 658 (97%) | 10 | 6 | 6 | 10 | 12/19 | 6/10 | 67 (0) | 6 | 0,69 |
| suc — Sucesiones | 120 | 119 (99%) | 10 | 8 | 8 | 10 | 6/9 | 7/10 | 77 (0) | 4 | 0,72 |
| pen — Penal | 1200 | 1156 (96%) | 14 | 10 | 10 | 14 | 11/17 | 6/10 | 107 (0) | 5 | 0,74 |
| rea — Derechos reales | 346 | 339 (98%) | 13 | 9 | 8 | 13 | 8/12 | 8/10 | 95 (0) | 2 | 0,75 |
| civ — Obligaciones y contratos | 1324 | 1259 (95%) | 15 | 13 | 13 | 15 | 5/9 | 6/10 | 111 (0) | 4 | 0,76 |
| const — Constitucional y amparo | 568 | 521 (92%) | 11 | 8 | 8 | 10 | 9/13 | 7/10 | 76 (0) | 3 | 0,76 |
| proc_civ — Procesal civil | 1624 | 1585 (98%) | 12 | 8 | 9 | 12 | 7/9 | 6/10 | 0 (12) | 0 | 0,76 |
| adm — Administrativo | 1134 | 974 (86%) | 10 | 8 | 9 | 10 | 9/11 | 5/10 | 76 (0) | 2 | 0,78 |

«Voces reconocidas por `analizar()`» es generoso: cuenta una voz aunque se reconozca solo una palabra (por ejemplo, «garantía legal» se reconoce como «fianza»). La columna «Voces = descriptor SAIJ» es la medida estricta.

**Voces de RAMAS que no son descriptor SAIJ ni voz SCJM**, con lo que hace hoy el analizador (lista completa en el apartado de cada rama):

- **Sin ningún reconocimiento:** «fórmula Acciarri», «atribución del hogar», «impedimento de contacto», «abuso de mayoría», «privilegio concursal», «declaración del riesgo», «jornada extraordinaria», «delegado de personal», «caso Badaro», «haber mínimo», «retroactividad previsional», «exclusión probatoria», «régimen de progresividad», «legitimación colectiva», «protección judicial art. 25 CADH», «debida diligencia reforzada», «recomposición del ambiente», «legitimación amplia ambiental», «in dubio pro natura», «gestión de residuos», «licencia ambiental minera», «foro de necesidad», «responsabilidad de buscadores», «ley 26.485», «reparación con enfoque de género», «adoptabilidad», «penal juvenil», «impugnación de candidatura».
- **Reconocidas por una palabra equivocada:** «garantía legal» se reconoce como fianza. «multa registral» y «multa por defraudación fiscal» como multa-pena. «exclusión de tutela» como tutela de familia. «derecho a la verdad» y «derecho de riego» como «Derecho» (teoría general). «violencia digital» como violencia vicio de la voluntad. «nombre de dominio» se parte en nombre y dominio. «garantías judiciales art. 8 CADH» se reconoce como fianza. «presupuestos mínimos» como presupuesto público. «franquicia transporte público» como «Transporte».

---

## 4. Especialidades sin rama

| Especialidad (SAIJ) | Id SAIJ | Conceptos | Subramas principales (id) | Rama propuesta |
|---|---|---|---|---|
| Cultura y educación | 5228 | 561 | cultura (2895) 228, educación (2311) 170, ciencia y tecnología (4739) 103, deportes (336) 54 | **educ**, **cult**, **dep**, ciencia/biotec |
| Salud pública | 646 | 468 | enfermedades (1320), política sanitaria (3680), asistencia sanitaria (3084), medicamentos (3688), bioética (4007), trasplante de órganos (74), salud mental (3138) | **salud** |
| Actividades económicas | 779 | 463 | actividad agropecuaria (776) 195, actividad industrial (804) 194, turismo (855), pesca (854) | **agro** (vitivinícola, alimentario), industria |
| Defensa y seguridad | 1060 | 345 | derecho militar (8727), seguridad pública (6704), armas (2800) | defensa y seguridad |
| Transporte | 6577 | 329 | contrato de transporte (2151) 211, vehículos (3424), seguridad vial (3164) | **transp** |
| Derecho de la navegación | 2135 | 170 | buques (2904), seguridad de la navegación (280), puertos (843) | **transp** (marítimo y portuario) |
| Comunicaciones | 790 | 167 | servicios de comunicación audiovisual (3479), servicio postal (4706), prensa (6330) | **telecom** y medios |
| Derecho aeronáutico | 272 | 140 | aeronaves (4), derecho espacial (3216), circulación aérea (2211), accidente de aviación (109) | **transp** (aeronáutico) |
| Bienestar social | 3142 | 101 | emergencias sociales (3981), vivienda (1491), planes sociales (3982) | social y vivienda |
| Derecho canónico | 4744 | 7 | — | **relig** |

**Especialidades que hoy viven dentro de otra rama y piden rama propia** (detalle en `correcciones-inventario.json`, «bloquesMalAsignados»):

| Bloque SAIJ | Rama actual | Conceptos | Propuesta |
|---|---|---|---|
| Derecho bancario (9365) + sistema financiero (7916) | com | ~290 | **fin**: bancario, bursátil, fintech, activos virtuales |
| Derecho informático (7343) | pi | 89 | **digital**: datos, IA, plataformas, delitos informáticos, firma digital |
| Derecho Aduanero (2531) | trib | 171 | **adu** (o subrama visible de trib) |
| lealtad comercial (8702) | cons | 49 | partir entre cons y **comp** (competencia, Ley 27.442); el dumping, a adu |
| recursos energéticos (1265) y gas | agua | 65 | **energ** (electricidad, gas, nuclear, renovables) |
| migraciones (6334) | adm | 47 | **migr** |
| derechos humanos de las personas con discapacidad (21031) | ddhh | 40 | **disc** |
| Municipalidad (1979) | adm | 83 | **muni** (o subrama de adm y const) |
| métodos alternativos de solución de conflictos (9565) + proceso arbitral (9566) | proc_civ | 36 | **masc** (arbitraje y mediación) |
| derecho penal disciplinario (9545) | pen | 21 | **fpub** (función pública y régimen disciplinario) |
| régimen penitenciario (3130) | pen | 32 | **ejec** (hoy ejec solo recibe «procesos de ejecución») |

**Especialidades emergentes poco cubiertas (hallazgo del consejo).** Ninguna tiene más que un puñado de conceptos en el inventario, y en todos los casos las preguntas del consejo quedaron mayormente sin reconocer:

- **economía de plataformas y trabajo digital:** 0 de 5 preguntas reconocidas.
- **activos virtuales:** 0 de 5. El Tesauro SAIJ es de 2020 y no tiene «criptomonedas» ni «activos virtuales».
- **personas mayores:** 0 de 4. SAIJ tiene «adultos mayores» y «personas mayores», pero la Convención Interamericana (Ley 27.360) no se reconoce.
- **justicia restaurativa:** 1 de 5.
- **compliance y responsabilidad penal de las personas jurídicas:** 1 de 5. «Programa de integridad» está ausente.
- **criminología:** 1 de 5.
- **biotecnología y edición genética:** 1 de 5.
- **inversiones internacionales y RIGI:** 1 de 5.
- **migratorio:** 0 de 5.
- **transporte aeronáutico y marítimo:** 0 de 6.
- **bienestar animal:** 1 de 3. «Maltrato animal» está ausente, aunque existe la voz SCJM ANIMALES.
- **litigio climático:** «cambio climático» existe en el inventario, pero «litigio climático» no lo activa.
- **neuroderechos y datos biométricos:** «datos biométricos» está ausente.
- **economía del cuidado:** no hay ningún concepto.

---

## 5. Informe por rama

Cada ficha sigue el mismo orden: descripción, subramas SAIJ (id y cantidad de conceptos), conceptos clave (id SAIJ y si tienen voz SCJM, «M»), equivalentes y su estado, relacionados, contrapuestos y figuras que se confunden, normativa, tribunales y organismos, fuentes, consultas de prueba y vacíos. Las consultas de prueba completas están en `consultas-referencia.json`.

### civ — Obligaciones y contratos
- **Descripción.** Teoría general de las obligaciones, contratos en general y en particular (civiles), hechos y actos jurídicos, persona humana y prescripción.
- **Subramas SAIJ.** derechos personales (9590) 666; persona humana (5806) 263; hechos y actos jurídicos (1085) 187; fuentes del derecho (7848) 75; personas jurídicas (14400) 66; ejercicio de los derechos (20098) 25; prescripción (4230) 16.
- **Conceptos clave.** contratos (5431, M); obligaciones (4806, M); pago (436, M); obligaciones de dar sumas de dinero (1187, M); derechos personalísimos (9266, M); seña; pacto comisorio; intereses usurarios; excepción de incumplimiento contractual.
- **Equivalentes.** «excesiva onerosidad sobreviniente» → teoría de la imprevisión (no preferido SAIJ, propuesta). «locación de obra» → contrato de obra (histórica, verificada). Medidas: «prescripción extintiva» → prescripción liberatoria (validada); «arras» → seña (validada); «deuda de valor» → obligación de valor (validada); «cláusula resolutoria expresa» → pacto comisorio (validada con reservas: sin «expresa» incluye la implícita).
- **Relacionados.** resolución contractual, mora automática, intereses moratorios.
- **Contrapuestos y confusiones.** nulidad absoluta/relativa (CCyC 386-388). Pacto comisorio frente a cláusula resolutoria implícita (arts. 1086/1087). Obligación de valor frente a obligación de dar dinero (765/772). Imprevisión frente a caso fortuito (1091/1730). Prescripción frente a caducidad (2567).
- **Normativa.** CCyC arts. 724-956 (obligaciones), 957-1091 (contratos en general), 1059-1060 (señal), 768 (moratorios), 771 (reducción de intereses), 886 (mora automática), 2554-2572 (prescripción y caducidad).
- **Tribunales y organismos.** Fuero civil de Mendoza (las respuestas de la API muestran «Cámaras de Apelaciones en lo Civil» y la histórica «Cámara de Apelaciones Civil, Comercial, Minas, Paz y Tributario»); SCJM. No hay organismo administrativo específico.
- **Fuentes.** SCJM (acervo), SAIJ, CSJN, JUBA (SCBA).
- **Consultas de prueba.** «excesiva onerosidad sobreviniente», «el inquilino no paga y no se va», «art. 1086 CCyC cláusula resolutoria expresa».
- **Vacíos.** «locación de inmueble» y «desalojo falta de pago» no son descriptores. «teoría de la imprevisión» y «compensación económica» quedaron asignadas a dan. «precios de transferencia» está en civ y es tributario. «abuso de posición dominante» está solo en civ.

### dan — Daños y responsabilidad civil
- **Descripción.** Responsabilidad contractual y extracontractual, factores de atribución, causalidad, eximentes, rubros y cuantificación, responsabilidades especiales (profesional, médica, del Estado en su faz civil).
- **Subramas SAIJ.** Todo cuelga de derechos personales (9590) > responsabilidad civil (285): 414 conceptos, 29 de ellos notariales (mal asignados).
- **Conceptos clave.** responsabilidad civil (285, M); daños y perjuicios (8365, M); indemnización (1290, M); daño moral (8333, M); incapacidad sobreviniente (14005, M); valor vida (14117, M); daño psíquico (8331, M); accidente de tránsito (284, M); culpa de la víctima (8103, M); eximentes de responsabilidad (4756, M); mala praxis (15422, M); responsabilidad médica (2171, M).
- **Equivalentes.** Anillo curado de daño moral (daño extrapatrimonial, consecuencias no patrimoniales, agravio moral, daño inmaterial). «daño psicológico» → daño psíquico (no preferido SAIJ; **validada**: 19 resultados nuevos en Mendoza y 20 en SAIJ).
- **Relacionados.** daño psíquico, que NO es daño moral (bien en el anillo). Pérdida de chance. Gastos de tratamiento.
- **Contrapuestos y confusiones.** El daño punitivo no es rubro resarcitorio, y SAIJ lo cuelga de multa civil > sanciones conminatorias. Riesgo de la cosa frente a responsabilidad objetiva: el anillo los trata como equivalentes y la responsabilidad objetiva es el género. «daños» (civil) frente al delito de daño (CP art. 183): hoy el analizador confunde los dos.
- **Normativa.** CCyC arts. 1708-1780: 1710-1711 (prevención), 1716, 1721-1725 (factores), 1726-1727 (causalidad), 1729-1733 (eximentes), 1737-1741 (daño), 1745-1746 (fallecimiento e incapacidad), 1757-1758 (cosas y actividades riesgosas), 1768 (profesionales liberales), 1769 (tránsito). Ley 24.240 art. 52 bis.
- **Tribunales.** Fuero civil y SCJM. Para responsabilidad del Estado, acción procesal administrativa (adm).
- **Consultas de prueba.** «cuánto me tienen que pagar por el choque», «un colectivo atropelló a un peatón en la senda».
- **Vacíos.** «fórmula Acciarri» no existe en ninguna fuente (y no tiene por qué: es doctrina). «hecho del damnificado», la denominación del CCyC, solo es voz SCJM. «choque», «motociclista» y «secuelas» se reconocen solo como voces SCJM sueltas: el relato fáctico no llega a «accidente de tránsito». «perro mordió» no llega a «daños causados por animales» (art. 1759), que sí está en el inventario.

### rea — Derechos reales
- **Descripción.** Dominio, condominio, propiedad horizontal, conjuntos inmobiliarios, servidumbres, derechos reales de garantía, posesión y tenencia, acciones reales y posesorias, registro.
- **Subramas SAIJ.** derechos reales (554) 240; bienes (2253) 68; inscripción registral (2355) 38.
- **Conceptos clave.** dominio (1676, M); propiedad horizontal (23, M); condominio (1529, M); posesión (241, M); hipoteca (4451, M); consorcio de propietarios (1532, M); prescripción adquisitiva (anillo); tenencia simple (749).
- **Equivalentes.** El anillo usucapión ↔ prescripción adquisitiva (curado y medido). «barrios cerrados» → conjuntos inmobiliarios (histórica, sugerir).
- **Contrapuestos.** Posesión frente a tenencia (CCyC 1909-1910). Usucapión breve frente a larga (1898/1899). **«tenencia» hoy se expande a cuidado personal (fam).**
- **Normativa.** CCyC arts. 1882-2276, en particular 1897-1899, 2037-2072 (propiedad horizontal), 2073-2086 (conjuntos inmobiliarios), 2238-2246 (acciones posesorias), 2247-2276 (acciones reales). Ley 14.159 art. 24. Ley 17.801.
- **Organismos.** Registro de la Propiedad Inmueble; Dirección de Catastro (no verificado el nombre actual en Mendoza).
- **Consultas de prueba.** «vivo hace 25 años en la casa y quiero escriturar», «el vecino corrió el alambrado».
- **Vacíos.** «ruina de obra» (CCyC 1273-1274) está ausente. «posesión y tenencia» se expande mal. «boleto y oponibilidad» solo activa la voz SCJM OPONIBILIDAD. El bloque notarial está en dan.

### fam — Familia
- **Descripción.** Matrimonio y divorcio, régimen patrimonial, uniones convivenciales, filiación (por naturaleza, TRHA, adopción), responsabilidad parental, alimentos, capacidad y apoyos.
- **Subramas SAIJ.** relaciones de familia (1636) 255.
- **Conceptos clave.** matrimonio (3503, M); responsabilidad parental (20105, M); divorcio (2707, M); alimentos (2093, M); filiación (539, M); adopción (1634, M); unión convivencial; cuidado personal compartido (10424, M); plan de parentalidad (9407); restricción a la capacidad; gestación por sustitución (11090, M).
- **Equivalentes.** Relaciones históricas con norma: tenencia → cuidado personal; régimen de visitas → régimen de comunicación; patria potestad → responsabilidad parental; sociedad conyugal → comunidad de ganancias; concubinato → unión convivencial (sugerir); insania → restricción a la capacidad (sugerir).
- **Contrapuestos y confusiones.** El plan de parentalidad no es el régimen de comunicación (SAIJ los confunde). La compensación económica no es alimentos ni indemnización (SAIJ la manda a dan). El cuidado personal es el género y el compartido la especie (SAIJ y el anillo invierten la relación).
- **Normativa.** CCyC arts. 401-445 (matrimonio y divorcio), 441-442 (compensación), 463-504 (comunidad), 509-528 (uniones), 537-554 (alimentos entre parientes), 555-557 (comunicación), 558-593 (filiación), 594-637 (adopción), 638-704 (responsabilidad parental), 706-723 (procesos de familia), 31-50 (capacidad).
- **Tribunales y organismos.** Juzgados de familia de Mendoza (denominación vigente no verificada); Registro Civil.
- **Consultas de prueba.** «mi ex no me deja ver a los chicos», «la madre se mudó a otra provincia con el nene sin avisar».
- **Vacíos.** «atribución del hogar» y «impedimento de contacto» no se reconocen. Este último solo existe como delito: «impedimento de contacto del menor con el padre no conviviente» (pen, Ley 24.270). «impugnación de la filiación» está ausente. «internación involuntaria» está ausente y cae en ejec. Ninguna pregunta coloquial («mi ex no me pasa la cuota de los chicos») activa nada.

### suc — Sucesiones
- **Descripción.** Sucesión intestada y testamentaria, legítima, colación, partición, indignidad, cesión de herencia.
- **Subramas SAIJ.** sucesiones (9372) 120.
- **Conceptos clave.** herencia (609, M); sucesión testamentaria (2032, M); herederos (5668, M); legados (618, M); indivisión hereditaria (1512, M); declaratoria de herederos; colación; legítima (399); partición (15337, que SAIJ deja en **fam**).
- **Equivalentes.** Anillos curados (declaratoria ↔ sucesión ab intestato; legítima ↔ porción legítima). Histórica: herederos forzosos → legitimarios.
- **Contrapuestos.** Indignidad frente a desheredación (el CCyC no regula la desheredación; si SAIJ conserva el descriptor, no verificado). Colación frente a acción de reducción.
- **Normativa.** CCyC arts. 2277-2531: 2281 (indignidad), 2302-2309 (cesión), 2336 (competencia), 2363-2423 (partición), 2385-2396 (colación), 2444-2461 (legítima), 2448 (mejora a heredero con discapacidad), 2477 (testamento ológrafo).
- **Consultas de prueba.** «murió mi papá y no dejó testamento», «mamá le donó la casa a mi hermano antes de morir».
- **Vacíos.** «mejora a favor de heredero con discapacidad» está ausente. «mejora» sola lleva a «mejoras» (rea). «partición» está en fam.

### cons — Derecho del consumidor
- **Descripción.** Relación y contrato de consumo, información, trato digno, prácticas y cláusulas abusivas, garantía legal, daño punitivo, servicios públicos domiciliarios, crédito al consumo, sobreendeudamiento.
- **Subramas SAIJ.** lealtad comercial (8702) 50, una subrama mezclada con competencia y comercio exterior; derechos personales (9590) 10.
- **Conceptos clave.** defensa del consumidor (2737, M); relación de consumo (6898, M); contratos de consumo (7313, M); información al consumidor (8708, M); publicidad engañosa (14195, M); consumidores hipervulnerables (21911); in dubio pro consumidor (8707, M); trato digno (en civ).
- **Equivalentes.** Anillo curado: daño punitivo ↔ multa civil ↔ sanción pecuniaria disuasiva. Este anillo y SAIJ discrepan: SAIJ no los trata como sinónimos e incluye «multa civil» bajo astreintes.
- **Contrapuestos y confusiones.** Contrato de consumo frente a contrato paritario. Cláusulas abusivas frente a leoninas (SAIJ las subordina). Garantía legal frente a fianza (hoy «garantía» lleva a fianza).
- **Normativa.** CN art. 42; Ley 24.240 arts. 1-4, 8 bis, 10 bis, 11-18, 36-37, 40, 52 bis, 53; CCyC arts. 1092-1122; Ley 26.682 (prepagas).
- **Organismos.** Dirección de Defensa del Consumidor de Mendoza (aparece en una carátula de los ejemplos: «Dirección de Fiscalización, Control y Defensa del Consumidor»); Secretaría de Comercio de la Nación.
- **Consultas de prueba.** «la empresa de celular me cobra servicios que no pedí», «compré una heladera que vino fallada y no me la cambian».
- **Vacíos.** «medicina prepaga» no tiene rama (Salud pública). «servicio de telefonía», «sobreendeudamiento» y «comercio electrónico» no se reconocen desde el lenguaje común. La mitad de la subrama SAIJ es de competencia.

### com — Comercial y societario
- **Descripción.** Sociedades, títulos de crédito, contratos comerciales y bancarios, fideicomiso, mercado de capitales (hoy mezclado con finanzas públicas).
- **Subramas SAIJ.** sociedades comerciales (1516) 246; contratos comerciales (5961) 152; sistema financiero (7916) 145; política económica (10011) 139; títulos de crédito (348) 127; operaciones financieras (4351) 104; entidades financieras (3700) 42; presupuesto (2673) 26, mal asignado.
- **Conceptos clave.** sociedad anónima (562, M); sociedades por acciones (19300, M); inoponibilidad de la personalidad jurídica; responsabilidad de administradores (anillo); cheque (680, M); pagaré; sociedad por acciones simplificada; contratos bancarios (7032, M).
- **Equivalentes.** Anillo curado de responsabilidad de directores y gerentes. Histórica: sociedad de hecho → Sección IV (sugerir). Medida: «desestimación de la personalidad jurídica» → inoponibilidad (validada con reservas: en SAIJ, sin frase exacta, trae «desestimación del recurso»).
- **Contrapuestos.** Acción social frente a acción individual de responsabilidad (LGS 276/279).
- **Normativa.** LGS (Ley 19.550) arts. 21-26, 54, 59, 91, 248, 251, 274-279; Decreto-ley 5965/63; Ley 24.452; CCyC arts. 1666-1707 (fideicomiso).
- **Organismos.** Dirección de Personas Jurídicas de Mendoza (no verificado el nombre actual); IGJ; CNV.
- **Consultas de prueba.** «los socios vaciaron la empresa para no pagar».
- **Vacíos.** «abuso de mayoría» está ausente. «pagaré de consumo» y «ejecución de cheque» solo llegan al título. Presupuesto y política económica sobran en la rama.

### cyq — Concursos y quiebras
- **Descripción.** Concurso preventivo, APE, verificación, pronto pago, quiebra, ineficacia, extensión, privilegios.
- **Subramas SAIJ.** concursos (6435) 191.
- **Conceptos clave.** quiebra (4317, M); concurso preventivo (718, M); verificación de créditos (3350, M); acuerdo preventivo (1234, M); síndico del concurso (8481, M); pronto pago; período de sospecha; verificación tardía; confusión patrimonial.
- **Equivalentes.** «cramdown» → salvataje de la empresa (no preferido SAIJ). La medición en Mendoza fue inconclusa: 0 y 7 resultados.
- **Confusiones.** **«salvataje» sin contexto lleva a «asistencia y salvamento» (navegación).** El salvataje de entidades deportivas (Ley 25.284) es otro régimen.
- **Normativa.** LCQ (Ley 24.522) arts. 11, 14, 16, 21, 32-37, 48, 52, 69-76, 77, 116-124, 160-161, 239-250.
- **Consultas de prueba.** «la empresa quebró y me debe la indemnización», «el fallido vendió un inmueble a su cuñado un mes antes».
- **Vacíos.** «privilegio concursal», «extensión de quiebra» (solo se reconoce «quiebra») e «ineficacia concursal» no se reconocen con esa forma.

### seg — Seguros
- **Descripción.** Contrato de seguro, cargas del asegurado, reticencia, exclusiones, franquicia, citación en garantía, seguros de personas.
- **Subramas SAIJ.** seguros (1876) 104.
- **Conceptos clave.** asegurador (2960, M); póliza (3583, M); siniestro (9148, M); citación en garantía (5330, M); seguro de responsabilidad civil (5331, M); reticencia; silencio del asegurador; exclusión de cobertura.
- **Equivalentes.** Anillo curado: exclusión de cobertura ↔ no seguro ↔ riesgo excluido.
- **Contrapuestos.** Exclusión de cobertura (delimitación del riesgo) frente a caducidad por incumplimiento de cargas. **Franquicia (seguros) frente a franquicia aduanera y contrato de franquicia**: los ejemplos de la voz traen franquicias aduaneras.
- **Normativa.** Ley 17.418 arts. 5 (reticencia), 46 (denuncia), 56 (pronunciamiento), 58 (prescripción), 70 y 114 (dolo o culpa grave), 109-120 (seguro de responsabilidad civil, art. 118 citación en garantía).
- **Organismos.** Superintendencia de Seguros de la Nación.
- **Consultas de prueba.** «el seguro no me paga porque dice que manejaba borracho».
- **Vacíos.** «pronunciamiento del asegurador» (SAIJ dice «silencio del asegurador») y «oponibilidad de la franquicia» están ausentes. «declaración del riesgo» no se reconoce. «franquicia» sola no existe en el ramo.

### lab — Laboral individual
- **Descripción.** Contrato de trabajo, registración, remuneración, jornada, extinción e indemnizaciones, fraude, solidaridad, procedimiento laboral.
- **Subramas SAIJ.** contrato de trabajo (7004) 553; actividades laborales (858) 292; política laboral (7846) 16; cómputo de servicios (2286) 12; conciliación laboral (2742) 9; procedimiento laboral (3287) 9.
- **Conceptos clave.** remuneración (3046, M); despido (2230, M); despido sin causa (9961); relación de dependencia (7209, M); empleador (9646, M); extinción del contrato de trabajo (7179, M); fraude laboral; sueldo anual complementario; teletrabajo (18511, M).
- **Equivalentes.** Anillos curados (indemnización por antigüedad, trabajo no registrado, autodespido). Medidas: **«despido incausado» → despido sin causa (validada)**; «trabajo en negro» → trabajo no registrado (validada con reservas: homonimia con el apellido «Del Negro»); «aguinaldo» → SAC (no preferido SAIJ; aporta poco).
- **Contrapuestos.** Despido directo frente a indirecto (LCT 242/246). Contrato de trabajo frente a contrato de servicios (LCT 23).
- **Normativa.** LCT (Ley 20.744) arts. 14, 21-23, 30, 52, 55, 66, 80, 102 bis, 103, 121-123, 177-178, 231-233, 242, 245-247. Ley 24.013 y Ley 25.323: las multas derogadas por la Ley 27.742 requieren verificar el alcance temporal (no verificado artículo por artículo).
- **Tribunales y organismos.** Cámaras del Trabajo de Mendoza (aparecen en las respuestas de la API); SCJM; Subsecretaría de Trabajo provincial; SECLO (Nación).
- **Consultas de prueba.** «me echaron y estaba en negro», «le redujeron el horario y el sueldo sin acuerdo».
- **Vacíos.** «trabajo en plataformas» y «desconexión digital» están ausentes. «me echaron» no activa nada. «multa registral» se reconoce como multa-pena. «jornada extraordinaria» no existe (SAIJ dice «horas extra», no verificado).

### sind — Colectivo del trabajo
- **Descripción.** Asociaciones sindicales, tutela, negociación colectiva, conflictos y huelga.
- **Subramas SAIJ.** derecho colectivo del trabajo (3194) 92.
- **Conceptos clave.** asociaciones sindicales (1794, M); convenios colectivos de trabajo (2551, M); huelga (8534, M); tutela sindical (442, M); encuadramiento sindical; libertad sindical.
- **Equivalentes.** Anillo curado: tutela sindical ↔ garantía sindical.
- **Confusiones.** Práctica desleal (Ley 23.551 art. 53) frente a competencia desleal: los ejemplos de la voz traen casos de competencia. Exclusión de tutela frente a tutela de familia.
- **Normativa.** Ley 23.551 arts. 47-53; Ley 14.250; Ley 23.546.
- **Consultas de prueba.** «me quieren echar y soy delegado».
- **Vacíos.** «cuota solidaria» y «descuento de días de paro» están ausentes. «delegado de personal» no se reconoce.

### art — Riesgos del trabajo
- **Descripción.** Accidentes y enfermedades laborales, comisiones médicas, prestaciones, acción civil.
- **Subramas SAIJ.** accidentes de trabajo (318) 71.
- **Conceptos clave.** riesgos del trabajo (334, M); accidentes de trabajo (318, M); accidente in itinere (317, M); enfermedad profesional (328, M); incapacidad laboral (6786, M); comisiones médicas; ingreso base mensual; RIPTE.
- **Equivalentes.** Anillos curados (in itinere, enfermedad profesional). Medida: **«infortunio laboral» (validada; 347 resultados, 20 nuevos)**, mejor anclado a «riesgos del trabajo».
- **Confusiones.** Accidente in itinere frente a accidente de tránsito. **«ART» como sigla es falsa sin contexto** (11.256 resultados).
- **Normativa.** Ley 24.557 arts. 6, 12, 26, 39, 46; Ley 26.773 art. 4; Ley 27.348.
- **Organismos.** Superintendencia de Riesgos del Trabajo y comisiones médicas.
- **Consultas de prueba.** «me caí de la escalera en el trabajo y la ART no me cubre».
- **Vacíos.** **«accidente de trabajo» en singular no se reconoce** (defecto de `singular()`). «opción civil» está ausente.

### prev — Previsional y seguridad social
- **Descripción.** Jubilaciones, pensiones, movilidad, reajustes, regímenes especiales, obras sociales, asignaciones.
- **Subramas SAIJ.** sistema previsional (3827) 125; recursos de la seguridad social (2624) 75; Sistema único de la seguridad social (12984) 49; derecho de los beneficios (1788) 47.
- **Conceptos clave.** jubilaciones (3831, M); beneficios previsionales (1282, M); obras sociales (1778, M); asignaciones familiares (3028, M); pensiones (2380); régimen de capitalización (1818, M); moratoria previsional.
- **Equivalentes.** El anillo curado trata «reajuste de haberes» como equivalente de movilidad. Es relacionado (pretensión frente a derecho).
- **Confusiones.** Pensión contributiva frente a no contributiva. «moratoria» se reconoce como plan de pagos (civ).
- **Normativa.** Ley 24.241 (arts. 19, 47-53); Ley 26.417; Ley 27.609; DNU 274/2024 (movilidad, no verificado el número); Ley 26.425.
- **Tribunales y organismos.** Justicia Federal de la Seguridad Social; ANSES.
- **Vacíos.** «caso Badaro» no tiene ejemplos ni concepto. «haber mínimo», «retroactividad previsional» y «redeterminación del haber inicial» están ausentes.

### pen — Penal (parte general y especial)
- **Descripción.** Teoría del delito, pena, delitos de la parte especial, leyes especiales (estupefacientes, régimen penal tributario y aduanero), contravenciones.
- **Subramas SAIJ.** delitos contra la propiedad (2580) 133; delitos contra la Administración Pública (183) 81; pena (1293) 81; derecho contravencional (376) 75; delitos contra las personas (29) 69; delitos contra la integridad sexual (200) 68; teoría del delito (340) 59; régimen penal tributario (8989) 44.
- **Conceptos clave.** culpabilidad (8118, M); inimputabilidad (773, M); robo calificado (18890, M); femicidio (12745, M); homicidio culposo; dolo eventual; legítima defensa; tenencia de estupefacientes para consumo personal; lavado de activos (11336, M, con subrama anterior a la Ley 26.683).
- **Equivalentes.** Medidas: **«homicidio imprudente» → homicidio culposo (validada)**; «defensa propia» (rechazada como expansión libre: 10% pertinente). Histórica: violación → abuso sexual con acceso carnal (sugerir).
- **Contrapuestos.** Dolo eventual frente a culpa consciente. Reincidencia frente a reiterancia. Femicidio frente a homicidio agravado por el vínculo.
- **Normativa.** CP arts. 34 incs. 6-7, 35, 41, 50, 54-55, 76 bis, 79, 80 incs. 1 y 11, 84, 84 bis, 119, 131, 153 bis, 164, 166, 172-173, 183, 303; Ley 23.737 arts. 5 y 14; Ley 27.401.
- **Tribunales.** Fuero penal de Mendoza (organización vigente no verificada); SCJM; justicia federal para estupefacientes según la desfederalización (no verificado para Mendoza).
- **Consultas de prueba.** «le disparó al ladrón que entró a su casa», «lo encontraron con varias bochitas de cocaína».
- **Vacíos.** Ninguna consulta fáctica activa la figura. «lo agarraron con un porro» no reconoce nada. «grooming» está en civ. «daños» sueltos se confunden con el delito de daño.

### proc_pen — Procesal penal y garantías
- **Descripción.** Coerción, nulidades, prueba, juicio (común, abreviado, por jurados), recursos, plazo razonable.
- **Subramas SAIJ.** proceso penal (359) 262. Hay 53 conceptos penales más en proc_civ.
- **Conceptos clave.** instrucción (2484, M); situación del imputado (2656, M); prisión preventiva (2195); flagrancia; querellante particular; juicio abreviado; alternativas a la prisión preventiva (2194, M).
- **Equivalentes.** Anillos curados (probation; prisión preventiva ↔ detención preventiva). Medidas: **«procedimiento abreviado» (validada)**; «duración razonable del proceso» → plazo razonable (validada con reservas).
- **Contrapuestos.** Prisión preventiva frente a excarcelación. Juicio abreviado frente a suspensión del juicio a prueba. **La equivalencia histórica «recurso de casación → recurso extraordinario provincial» se aplica también en penal, donde no corresponde.**
- **Normativa.** CN art. 18; CADH arts. 7.5, 8.1 y 8.2.h; CPPN art. 431 bis; CPPF (Ley 27.063); CPP de Mendoza (Ley 6730; artículos no verificados).
- **Consultas de prueba.** «la policía entró a la casa sin orden», «lo dejaron preso hasta el juicio».
- **Vacíos.** «exclusión probatoria» y «peligro de entorpecimiento» están ausentes. «cadena de custodia», «doble conforme» y «plazo razonable» existen solo como voces SCJM. «instrucciones» al jurado lleva a «instrucción». Es la rama con peor reconocimiento de preguntas: 1 de 8 completas.

### ejec — Ejecución penal
- **Descripción.** Progresividad, salidas, libertades, domiciliaria, estímulo educativo, disciplina, condiciones de detención.
- **Subramas SAIJ.** procesos de ejecución (9567) 26. El régimen penitenciario (3130, 32 conceptos) quedó en pen.
- **Conceptos clave.** ejecución de la pena (10909, M); progresividad del régimen penitenciario (10913, M); libertad condicional (10911, M); salidas transitorias (16943, M); medidas de seguridad (5134, M); internación (14557, M); estímulo educativo (anillo).
- **Equivalentes.** Medida: **«detención domiciliaria» → prisión domiciliaria (validada; no preferido SAIJ)**.
- **Confusiones.** Las visitas a internos no son el régimen de comunicación familiar, pero hoy se expanden. La internación como medida de seguridad no es la internación por salud mental. El estímulo educativo no reduce la pena: adelanta plazos.
- **Normativa.** CP arts. 10, 13-17; Ley 24.660 arts. 12-17, 32-33, 54, 140, 158-167; Ley 23.098 art. 3 inc. 2.
- **Tribunales y organismos.** Juzgados de ejecución penal; Procuración Penitenciaria de la Nación; Servicio Penitenciario provincial.
- **Vacíos.** «régimen de progresividad» no se reconoce (SAIJ dice «progresividad del régimen penitenciario»). «personas privadas de la libertad» y «sanciones disciplinarias» están en pen.

### adm — Administrativo
- **Descripción.** Acto y procedimiento administrativo, contratos, empleo público, responsabilidad del Estado, dominio público, poder de policía, proceso administrativo.
- **Subramas SAIJ.** Administración Pública (1502) 328; contratos administrativos (1484) 280; acto administrativo (942) 111; procedimiento administrativo (1169) 108; Municipalidad (1979) 84; dominio del Estado (3930) 75; migraciones (6334) 48.
- **Conceptos clave.** empleo público (1570, M); acto administrativo (942, M); contrato de obra pública (5111, M); licitación pública (10571, M); amparo por mora; responsabilidad del Estado (9336); servicio público (1764, M).
- **Equivalentes.** Anillo curado de silencio administrativo. Medida: **«contencioso administrativo» → acción procesal administrativa (validada para Mendoza; trae sumarios del antiguo «recurso contencioso administrativo»)**.
- **Contrapuestos.** Revocación frente a nulidad del acto. Amparo por mora frente a acción de amparo.
- **Normativa.** Ley 19.549 arts. 7, 10, 14, 17-18, 23-25, 28 (modificada por la Ley 27.742); Ley 26.944; Ley 13.064; Decreto 1023/2001; Ley 25.164; Ley 27.275; en Mendoza, Ley 9003 (procedimiento administrativo) y Ley 3918 (proceso administrativo) (no verificada la vigencia de cada una).
- **Tribunales y organismos.** SCJM (competencia originaria en la acción procesal administrativa, no verificado el artículo); Fiscalía de Estado; Tribunal de Cuentas.
- **Vacíos.** El bloque de presupuesto público está en com. Migraciones y municipal piden rama. «me dieron de baja del contrato en el municipio» no activa empleo público.

### trib — Tributario
- **Descripción.** Obligación tributaria, determinación, procedimiento, prescripción, repetición, ejecución fiscal, impuestos nacionales, provinciales y municipales, aduanero.
- **Subramas SAIJ.** derecho tributario (2547) 450; Derecho Aduanero (2531) 172; sistemas informativos (5346) 31; AFIP (1594) 25.
- **Conceptos clave.** tributos (2012, M); impuestos (2069, M); obligación tributaria (5057, M); tasas (2206, M); determinación de oficio; prescripción tributaria; solve et repete; impuesto de sellos; Impuesto sobre los ingresos brutos.
- **Equivalentes.** Histórica: AFIP → ARCA (Decreto 953/2024). Medidas: **«apremio» → ejecución fiscal (validada; restringir a lo tributario)**; «pago previo» → solve et repete (**rechazada**: trae «requerimiento previo de pago» y «plan de ahorro previo»).
- **Contrapuestos.** Tasa frente a impuesto. Omisión (Ley 11.683 art. 45) frente a defraudación (art. 46). **La defraudación fiscal no es la defraudación del CP art. 173**: los ejemplos de la voz traen estafas.
- **Normativa.** CN art. 75 inc. 2; Ley 11.683 arts. 2, 6-8, 16-19, 45-46, 56, 81, 92; Ley 23.548; Convenio Multilateral; Código Fiscal de Mendoza (no verificado).
- **Organismos.** ARCA; Administración Tributaria Mendoza (ATM); Tribunal Fiscal de la Nación; Comisión Arbitral.
- **Vacíos.** «convenio multilateral», «realidad económica» y «precios de transferencia» están asignados a com y civ. «multa por omisión» y «responsables solidarios» están ausentes. «multa» sola se lee como pena.

### const — Constitucional y amparo
- **Descripción.** Control de constitucionalidad, amparo y garantías, derechos fundamentales, organización del poder.
- **Subramas SAIJ.** poderes del Estado (584) 184; derechos y garantías constitucionales (384) 117; Estado (9379) 117; jerarquía de las leyes (8662) 60; control de constitucionalidad (6840) 12.
- **Conceptos clave.** acción de amparo (380, M); amparo colectivo (389, M); habeas data (9745, M); habeas corpus (6519, M); juicio político (9784, M); tribunal de enjuiciamiento (11462, M); derecho de réplica (7538, M); ombudsman (12440, M).
- **Equivalentes.** Anillos curados (amparo; arbitrariedad de sentencia ↔ sentencia arbitraria). Propuestas sin medir: Defensor del Pueblo ↔ ombudsman (invertir el preferido); derecho de rectificación o respuesta ↔ derecho de réplica (CADH art. 14); jurado de enjuiciamiento (CN art. 115).
- **Contrapuestos.** Control de constitucionalidad frente a control de convencionalidad. Amparo frente a amparo por mora.
- **Normativa.** CN arts. 14-20, 28, 31, 33, 41-43, 75 inc. 22, 99 inc. 3, 114-117, 123; Ley 16.986; Ley 26.854; Constitución de Mendoza.
- **Vacíos.** «cuestiones políticas no justiciables» no está como tal (sí «cuestión política»). «legitimación colectiva» no se reconoce. «derecho a la salud» quedó asignado a civ.

### ddhh — Derechos humanos y derecho internacional público
- **Descripción.** Sistema interamericano y universal, control de convencionalidad, lesa humanidad, reparación, grupos vulnerables, DIPúblico.
- **Subramas SAIJ.** derecho internacional público (5722) 405, que incluye comercio exterior, aduanas e inversiones; derechos humanos de las personas con discapacidad (21031) 41; grupos vulnerables (9710) 33; organismos de derechos humanos (3190) 29; discriminación (9704) 21.
- **Conceptos clave.** control de convencionalidad (anillo); crímenes de lesa humanidad (M); desaparecidos (3362, M); pueblos originarios (9711); personas con discapacidad (231, M); violencia familiar (17870, que debería estar en gen/fam).
- **Equivalentes.** Medida: **«crímenes contra la humanidad» (validada en SAIJ: 13 nuevos)**.
- **Problema de rotulación.** «desaparecidos» cuelga de «delitos cometidos durante actividades antisubversivas» (8873). El delito es la desaparición forzada de personas (CP art. 142 ter; Ley 24.556).
- **Normativa.** CN art. 75 incs. 22-23; CADH arts. 1-2, 8, 25, 63-64; Estatuto de Roma (Ley 25.390); Ley 24.584.
- **Organismos.** Corte IDH, CIDH, comités de Naciones Unidas.
- **Vacíos.** «protección judicial art. 25 CADH», «debida diligencia reforzada» y «principio pro persona» no se reconocen. «garantías judiciales» lleva a fianza. 10 ejemplos impertinentes, el peor número de todas las ramas.

### amb — Ambiental
- **Descripción.** Daño ambiental colectivo, principios, evaluación de impacto, participación, presupuestos mínimos, residuos, bosques, glaciares, clima.
- **Subramas SAIJ.** protección de la flora y fauna silvestre (4006) 117; protección del medio ambiente (6755) 62; bosques 27; política ambiental 16; protección del clima mundial (4388) 3.
- **Conceptos clave.** daño ambiental (322, M); contaminación ambiental (6913, M); principio precautorio; glaciares (2217, M); desechos peligrosos (1894, M); productos transgénicos (9810, M); cambio climático (4387, M).
- **Equivalentes.** Medida: «principio de precaución» (validada con reservas: modo frase).
- **Confusiones.** Evaluación frente a estudio de impacto ambiental: la medición confirma que se confunden (solapamiento 10/20). «presupuestos mínimos» se reconoce como presupuesto público.
- **Normativa.** CN art. 41; Ley 25.675 arts. 4, 11-13, 27-33; Ley 26.639; Ley 24.051; Ley 26.331; Ley 27.520; Ley 27.566 (Escazú); Mendoza: Ley 5961 y Ley 7722.
- **Organismos.** Autoridad ambiental provincial (denominación vigente no verificada).
- **Vacíos.** «recomposición del ambiente», «legitimación amplia ambiental», «in dubio pro natura» y «gestión de residuos» no se reconocen. «litigio climático» y «agroquímicos» no se reconocen (sí «productos agroquímicos»). Hay 8 ejemplos impertinentes.

### agua — Aguas, minería y territorio
- **Descripción.** Derecho de aguas (concesiones, riego, subterráneas), minería, hidrocarburos y, hoy, toda la energía.
- **Subramas SAIJ.** recursos minerales (15764) 89; recursos energéticos (1265) 88; recursos hídricos (1275) 33.
- **Conceptos clave.** minería (4505, M); hidrocarburos (7321, M); energía eléctrica (4942, M); aprovechamiento de aguas (2697, M); canon de riego; aguas subterráneas; servidumbre minera; DEPARTAMENTO GENERAL DE IRRIGACION y DERECHO DE AGUA (solo como voces SCJM).
- **Equivalentes.** Medida: **«DGI» rechazada** (devuelve la Dirección General Impositiva). Sin medir: «derecho de agua» ↔ concesión de agua.
- **Normativa.** CN art. 124; CCyC arts. 235-236 y 239; Constitución de Mendoza, sección del Departamento General de Irrigación (arts. 186-194, no verificado); Ley de Aguas de 1884; Código de Minería; Ley 17.319; Ley 7722.
- **Tribunales y organismos.** Departamento General de Irrigación (Superintendencia, Honorable Tribunal Administrativo; no verificado) y luego SCJM; Dirección de Minería; EPAS.
- **Vacíos.** **Es la rama más débil.** «concesión de uso de agua», «derecho de riego» e «inherencia del agua a la tierra» están ausentes. «inspección de cauce» falla por el defecto de `singular()` («cauces» → «cauz»). Tiene 3 ejemplos para 10 voces. Energía y nuclear inflan la rama.

### proc_civ — Procesal civil (Mendoza)
- **Descripción.** Proceso por audiencias (CPCCyT, Ley 9001), prueba, cautelares, recursos, costas, honorarios, caducidad.
- **Subramas SAIJ.** etapas del proceso (2051) 311; organización de la justicia (3005) 188; actos y diligencias (753) 165; recursos (1318) 152; jurisdicción y competencia (6007) 128; medidas cautelares (1554) 81; procesos de ejecución (9567) 73.
- **Conceptos clave.** prueba (676, M); medios de prueba (2122, M); sentencia (2284, M); ejecución de sentencia (229, M); caducidad de instancia (M); beneficio de litigar sin gastos (3809, M); medidas autosatisfactivas; recurso extraordinario provincial.
- **Equivalentes.** Medidas: **«perención de instancia» (validada: sin solapamiento en ninguna de las dos fuentes)**; «costas por su orden» y «cargas probatorias dinámicas» (aportan poco: alto solapamiento); «medida cautelar innominada» (rechazada en este acervo: trae «incidentes innominados»).
- **Normativa.** CPCCyT Mendoza (Ley 9001); CPCCN arts. 68, 232, 310-318.
- **Vacíos.** 12 voces sin ejemplos. «audiencia inicial» solo es voz SCJM. 53 conceptos penales (careo, sobreseimiento, querella) y la mediación penal están asignados acá.

### dipr — Internacional privado
- **Descripción.** Jurisdicción internacional, ley aplicable, reconocimiento y ejecución, cooperación, restitución internacional.
- **Subramas SAIJ.** derecho internacional privado (3570) 31.
- **Conceptos clave.** jurisdicción internacional (3571, M); derecho extranjero (2553, M); contratos internacionales (7348, M); norma indirecta (16097, M); exequátur (en proc_civ); restitución internacional de menores (en nna).
- **Equivalentes.** Medidas: «sustracción internacional de menores» (**sobra**: 17/19 solapados); «confundibilidad» (pi).
- **Mal asignados.** Corte Penal Internacional, su estatuto y opinión consultiva están en dipr y son ddhh. El arbitraje internacional está en ddhh.
- **Normativa.** CCyC arts. 2594-2671 (2595, 2602, 2642); Ley 23.857; Ley 27.449.
- **Vacíos.** «foro de necesidad» está ausente. 10 voces sin ejemplos.

### pi — Propiedad intelectual y datos
- **Descripción.** Marcas, patentes, modelos, derecho de autor, nombres de dominio y, hoy, todo el derecho informático.
- **Subramas SAIJ.** propiedad industrial (9374) 77; tecnología de la información (3672) 75; propiedad intelectual (9371) 33.
- **Conceptos clave.** marcas (7310, M); patentes (4011, M); derechos de autor (3495, M); registro de marca (4262, M); marcas confundibles; nombres de dominio; datos personales (3682); inteligencia artificial (14507, M).
- **Equivalentes.** Medida: **«confundibilidad marcaria» (validada en SAIJ: 19 nuevos)**.
- **Normativa.** Ley 22.362; Ley 24.481; Ley 11.723; Ley 25.326; Ley 26.388.
- **Organismos.** INPI, DNDA, AAIP.
- **Vacíos.** «nombre de dominio» no se reconoce (defecto de `singular()`). «responsabilidad de buscadores», «decisiones automatizadas» y «datos biométricos» están ausentes. 10 voces sin ejemplos. Pide separar la rama **digital**.

### gen — Género y violencia
- **Descripción.** Ley 26.485, tipos y modalidades de violencia, medidas de protección, perspectiva de género en la prueba y en la reparación.
- **Subramas SAIJ.** protección de la mujer (9709) 11; derechos de la mujer (8169) 6. Solo 17 conceptos.
- **Conceptos clave.** violencia de género (666, M); perspectiva de género (21639, M); violencia económica (21915); violencia obstétrica (21327, M); acoso sexual (665, M); violencia familiar (en ddhh); PROHIBICION DE ACERCAMIENTO y MEDIDAS DE PROTECCION (voces SCJM).
- **Equivalentes.** Anillo curado de violencia económica. Medida: **«violencia contra la mujer» → violencia de género (validada; no preferido SAIJ)**, con el alcance de la Ley 26.485.
- **Confusiones.** «violencia» suelta lleva a «violencia como vicio de la voluntad» (voz SCJM). La paridad de género (elec) está subordinada a «igualdad de género».
- **Normativa.** Ley 26.485 arts. 4-6 y 26; Convención de Belém do Pará (Ley 24.632); CP art. 80 inc. 11; Ley 27.736 (violencia digital, no verificado el inciso).
- **Vacíos.** «violencia digital» y «reparación con enfoque de género» están ausentes. «ley 26.485» no se reconoce por número. 10 voces sin ejemplos. Ninguna pregunta coloquial activa nada.

### nna — Niñez y adolescencia
- **Descripción.** Interés superior, escucha, abogado del niño, medidas de protección, adoptabilidad, penal juvenil.
- **Subramas SAIJ.** derechos de las niñas, niños y adolescentes (5932) 10.
- **Conceptos clave.** interés superior del niño (9666, M); derecho de NNyA a ser oídos (9509, M); restitución y sustracción internacional (7533, 9669); estado de adoptabilidad (1647, en fam); abogado del niño (82, en proc_civ); régimen penal de la minoridad (9554, en pen).
- **Equivalentes.** Anillo curado de autonomía progresiva. Histórica propuesta: patronato → protección integral (cambio de paradigma: sugerir, no expandir).
- **Normativa.** CDN; Ley 26.061 arts. 3, 24, 27, 33-41, 76; CCyC arts. 26, 607-610 y 707; Ley 22.278.
- **Vacíos.** **Rama casi vacía.** Su vocabulario está repartido entre fam, pen, proc_civ y ddhh. 10 voces sin ejemplos.

### elec — Electoral y partidos
- **Descripción.** Partidos, candidaturas, listas, financiamiento, sistema y boleta, justicia electoral.
- **Subramas SAIJ.** derechos políticos (9378) 172.
- **Conceptos clave.** derecho electoral (4648, M); partidos políticos (1782, M); elecciones (990, M); sistema electoral (9517, M); candidatos (4473, M); reelección; boleta única de sufragio (anillo); cupo femenino (8168, en gen).
- **Equivalentes.** Medida: «cupo femenino» ↔ «paridad de género», **inconclusa**: el acervo de Mendoza no cubre el fuero electoral, con 4 y 1 resultados.
- **Normativa.** CN arts. 37-38; Ley 19.945; Ley 23.298; Ley 26.215; Ley 27.412; Ley 26.571.
- **Tribunales.** Juzgados federales con competencia electoral; Cámara Nacional Electoral; Junta Electoral provincial (no verificado).
- **Vacíos.** «impugnación de candidatura» y «financiamiento de campañas» no se reconocen. 7 voces sin ejemplos. Hacen falta fuentes con jurisprudencia electoral (la CNE no está entre las fuentes).

### Fichas breves de especialidades emergentes

| Especialidad | Lo que hay en el inventario | Lo que falta (medido con las preguntas) | Normas ancla |
|---|---|---|---|
| **salud** (sin rama) | 468 conceptos SAIJ (medicina prepaga 5565, consentimiento informado, directivas anticipadas, muerte digna, trasplante, cannabis medicinal) | internación involuntaria, IVE, aumento de cuota por edad, negativa a tratamiento | Leyes 26.529, 26.657, 26.682, 26.742, 26.862, 27.447, 27.610 |
| **transp** | 639 conceptos entre Transporte, aeronáutico y navegación | pérdida de equipaje (solo «del equipaje»), drones como VANT, abordaje | Código Aeronáutico (Ley 17.285); Ley 20.094; Convenio de Montreal 1999; CCyC arts. 1280-1318 |
| **digital** | Derecho informático (89) | trabajo en plataformas, desconexión digital, buscadores, decisiones automatizadas, datos biométricos, difusión de imágenes íntimas | Leyes 25.326, 26.388, 25.506, 27.555 |
| **fin** | ~290 en com | activos virtuales, PSAV, proveedores de servicios de pago, información privilegiada, contratos inteligentes | Leyes 21.526, 26.831, 25.065; Ley 27.739 (no verificado el alcance) |
| **comp** | 6 conceptos en cons | acuerdos colusorios, daños por conductas anticompetitivas | Ley 27.442 |
| **telecom** | 167 en Comunicaciones | espectro radioeléctrico, licencias TIC | Leyes 27.078 y 26.522 |
| **agro** (vitivinícola) | 195 en actividad agropecuaria (contratos de elaboración de vinos, aparcería, emergencia agropecuaria) | rotulado de alimentos; la vitivinicultura sin rama | Leyes 13.246, 14.878, 25.163, 18.284 |
| **energ** | 88 + gas en agua | fractura hidráulica | Leyes 17.319, 24.065, 24.076, 24.804, 27.191 |
| **adu** | 172 en trib | clasificación arancelaria | Código Aduanero (Ley 22.415) |
| **migr** | 48 en adm | reunificación familiar, retención | Ley 25.871 arts. 10, 20, 70 |
| **dep** | 54 en deportes | derechos federativos | Leyes 20.655, 23.184, 25.284 |
| **cult** | 228 en cultura | patrimonio arquitectónico | Leyes 25.743 y 12.665 |
| **educ** | 170 en educación | responsabilidad de los establecimientos educativos (CCyC 1767) | Leyes 26.206, 24.521, 26.892 |
| **indig** | pueblos originarios (9711) | consulta previa | CN 75 inc. 17; Convenio 169 (Ley 24.071); Ley 26.160 |
| **disc** | 41 en ddhh | ajustes razonables, barreras arquitectónicas | Leyes 22.431, 24.901, 26.378 |
| **muni** | Municipalidad (83, en adm) | — (bien cubierta) | CN art. 123; Ley 1079 de Mendoza |
| **fpub** (disciplinario y ética) | 21 en derecho penal disciplinario; ética de la función pública | — | Leyes 25.164, 25.188, 27.275 |
| **jrest** | mediación penal (en proc_civ), conciliación | justicia restaurativa | CP art. 59 inc. 6; CPPF art. 22 |
| **crim** | criminología (5240) | informe criminológico | Ley 24.660 |
| **compliance** | — | programa de integridad, colaboración eficaz | Ley 27.401; Ley 27.304 |
| **biotec** | productos transgénicos, biotecnología (4017) | derecho del obtentor, edición genética, embriones crioconservados | Leyes 26.270 y 20.247 |
| **inv** | CIADI y TBI (en ddhh y com) | trato justo y equitativo, RIGI, ejecución de laudo | Ley 24.353; Ley 27.742 (RIGI) |
| **masc** | 36 en proc_civ | mediación prejudicial | CCyC arts. 1649-1665; Ley 26.589; Ley 27.449 |
| **relig** | libertad de cultos, objeción de conciencia, Derecho canónico (7) | negativa a transfusión por motivos religiosos | CN arts. 2, 14, 19 |
| **resprof** | responsabilidad profesional (15423), del abogado y del escribano | responsabilidad del contador | CCyC art. 1768 |
| **vejez** | adultos mayores | — | Ley 27.360 |
| **animal** | voz SCJM ANIMALES | maltrato animal | Ley 14.346 |

---

## 6. Mapa medido de vacíos de vocabulario

371 preguntas de 60 especialistas, con 517 conceptos esperados:

| Estado del concepto esperado | Cantidad |
|---|---|
| reconocido | 285 (55%) |
| presente en el inventario, no reconocido por la formulación | 126 (24%) |
| presente solo con otra forma (flexión, orden) | 32 (6%) |
| ausente del inventario | 74 (14%) |

| Diagnóstico por pregunta | Cantidad |
|---|---|
| reconocida completa | 168 |
| presente pero no reconocida por la formulación | 82 |
| ausente del inventario | 60 |
| reconocimiento erróneo o ambiguo (revisado a mano) | 34 |
| presente con otra forma | 27 |

**Por intención de la pregunta** (reconocidas completas sobre total): técnica 151/304; vía procesal 7/16; artículo 5/9; pretensión 1/4; defensa 1/2; **hechos 1/14; coloquial 2/22**.

**Especialistas con menor reconocimiento:** activos digitales 0/5; migratorio 0/5; transporte 0/6; plataformas 0/5; personas mayores 0/4; procesal penal 1/8; capacidad y salud mental 1/5; propiedad intelectual 1/6; biotecnología 1/5; inversiones 1/5; justicia restaurativa 1/5; criminología 1/5; compliance 1/5.

**Conceptos ausentes del inventario** (74, la lista completa está en el JSON). Lo más grave para el uso diario:

- **lab y sind:** trabajo en plataformas, cuota solidaria, descuento de días de paro.
- **art:** opción civil.
- **proc_pen:** exclusión probatoria, peligro de entorpecimiento.
- **trib:** multa por omisión, responsables solidarios.
- **seg:** pronunciamiento del asegurador, oponibilidad de la franquicia.
- **fam:** impugnación de la filiación, internación involuntaria, revisión de la sentencia de capacidad.
- **suc:** mejora a heredero con discapacidad.
- **rea:** ruina de obra.
- **dipr:** foro de necesidad.
- **agua:** concesión de uso de agua, derecho de riego, inherencia.
- **salud:** interrupción voluntaria del embarazo.
- **prev:** redeterminación del haber inicial.
- **gen:** violencia digital.
- **indig:** consulta previa.
- **disc:** ajustes razonables.
- **compliance:** programa de integridad.
- **jrest:** justicia restaurativa.
- **fin:** activos virtuales.

**Presentes pero no reconocidos por cómo se pregunta.** Es el vacío más grande y el más barato de cerrar:

- «me echaron sin causa y estaba en negro» no activa nada, aunque existen «despido sin causa» y la voz SCJM TRABAJO EN NEGRO.
- «le pegó un tiro al ladrón» no llega a legítima defensa.
- «mi ex no me pasa la cuota de los chicos» no llega a cuota alimentaria.
- «el inquilino dejó de pagar» solo se reconoce como «locatario».
- «me usurparon el terreno» solo reconoce «terrenos».
- «la madre no me deja ver a mi hijo» solo activa la voz SCJM HIJOS.

**Reconocimientos erróneos o ambiguos** (34). Patrón: una palabra suelta que en el inventario es descriptor de otra rama. Ejemplos medidos:

- «salvataje» se reconoce como asistencia y salvamento (navegación).
- «internación» se reconoce como medida de seguridad (ejec).
- «falta» se reconoce como faltas (pen).
- «acción» se reconoce como teoría del delito (pen).
- «daños» se reconoce como el delito de daño.
- «multa» se reconoce como pena.
- «fiscal» se reconoce como fiscales (Ministerio Público).
- «auto» se reconoce como autos (resoluciones).
- «garantía» se reconoce como fianza.
- «tenencia» se reconoce como cuidado personal, y además se expande.
- «violencia» se reconoce como vicio de la voluntad.
- «moratoria» se reconoce como plan de pagos.
- «recurso de casación» (penal) se reconoce como recurso extraordinario provincial.
- «expropiación indirecta» se reconoce como expropiación irregular.
- «paridad de género» se reconoce como igualdad de género.

---

## 7. Defectos del analizador (`backend/lib/vocabulario.js`)

1. **`singular()` y plurales en «-es».** «accidentes» → «accident», «nombres» → «nombr», «hipervulnerables» → «hipervulnerabl», «partes» → «part», y la regla «-ces → z» da «cauces» → «cauz». Hay que generar las dos formas candidatas (quitar «s» y quitar «es») al indexar y al buscar. `raiz()` del constructor tiene la misma lógica.
2. **Términos de una palabra genéricos.** Hacen falta una lista de ambiguos y una regla que los acepte solo con confirmación de rama por otro concepto de la consulta, o devolverlos como «ambiguos».
3. **Siglas.** Los tramos de menos de 4 letras se descartan (ART, LCT, LCQ, IVA, DGI, SAC). Se propone una tabla curada de 22 siglas con su desambiguación (en `anillos-propuestos.json`).
4. **Expansión histórica sin contexto.** «tenencia» y «régimen de visitas» se expanden en contextos ajenos. «recurso de casación» se aplica también en penal.
5. **Artículos.** «art. 245 LCT», «art. 1086 CCyC» y «art. 52 bis ley 24.240» no resuelven al concepto. Se propone una tabla norma+artículo → concepto, extendiendo el campo `normas` de los anillos.

---

## 8. Problemas del inventario

El detalle está en `correcciones-inventario.json`.

- **52 conceptos con rama propuesta distinta**:
  - convenio multilateral y realidad económica: de com a trib.
  - precios de transferencia: de civ a trib.
  - grooming: de civ a pen.
  - mediación penal y allanamiento sin orden: de proc_civ a proc_pen.
  - abogado del niño: de proc_civ a nna.
  - compensación económica: de dan a fam.
  - teoría de la imprevisión: de dan a civ.
  - defensa de la competencia, concentración económica y competencia desleal: de cons a comp.
  - dumping: de cons a adu.
  - Corte Penal Internacional y opinión consultiva: de dipr a ddhh.
  - arbitraje internacional: de ddhh a dipr y masc.
  - violencia familiar: de ddhh a gen y fam.
  - régimen penal de la minoridad: de pen a nna.
  - medicina prepaga y vitivinicultura: de sin rama a salud y agro.
- **10 bloques mal asignados (~800 conceptos)**:
  - 53 conceptos procesales penales en proc_civ.
  - 29 notariales en dan.
  - 14 de presupuesto público en com.
  - 65 de energía en agua.
  - 15 de comercio exterior, arbitraje e inversiones en ddhh.
  - la subrama lealtad comercial, que mezcla consumo, competencia y aduana.
  - derecho informático, bancario, aduanero y migraciones, que piden rama propia.
- **19 relaciones SAIJ engañosas.** Además de las del resumen: «fianza» con el no preferido «garantía»; «asistencia y salvamento» con «salvataje»; «plan de pagos» con «moratoria»; «trámites judiciales» con «procedimiento» y «trámite»; «acuerdo de partes» con «acuerdo» y «convenio»; «habeas data» con «protección de datos personales»; «daño psíquico» bajo «daño material» (controvertida); «desaparecidos» bajo «delitos cometidos durante actividades antisubversivas».
- **8 relaciones curadas a revisar.** En los anillos de `var TESAURO`: «prisión preventiva peligro de fuga» (es especie), «responsabilidad objetiva» (es género), «reajuste de haberes» (es relacionado), «cuidado personal compartido» (es especie). En `relaciones-historicas.json`: la «tenencia» suelta, la casación penal y el alcance mal descripto del daño punitivo. En los anillos: «régimen de visitas» en contexto carcelario.

---

## 9. Propuestas de anillos y relaciones validadas empíricamente

Hubo 90 consultas a la API de producción. Cada forma se buscó por separado en la fuente indicada. «Nuevos» cuenta los resultados de la primera página de la forma B que no están en la primera página de la forma A. La pertinencia se leyó a mano.

| Canónico (A) | Propuesta (B) | Fuente | Total A / B | Solapamiento | Nuevos | Veredicto |
|---|---|---|---|---|---|---|
| despido sin causa | despido incausado | mendoza / saij | 785 / 80 · pág. | 1/20 · 3/20 | 19 · 17 | **validada** |
| caducidad de instancia | perención de instancia | mendoza / saij | 794 / 109 · pág. | 0/20 · 0/19 | 20 · 19 | **validada** |
| daño psíquico | daño psicológico | mendoza / saij | 609 / 608 · pág. | 1/20 · 0/20 | 19 · 20 | **validada** |
| violencia de género | violencia contra la mujer | mendoza / saij | 257 / 184 · pág. | 1/20 · 1/19 | 19 · 18 | **validada** |
| homicidio culposo | homicidio imprudente | mendoza / saij | 118 / 28 · pág. | 4/20 · 1/20 | 16 · 19 | **validada** |
| ejecución fiscal | apremio | mendoza | 681 / 188 | 1/20 | 19 | **validada** (solo tributario) |
| acción procesal administrativa | contencioso administrativo | mendoza | 1898 / 429 | 0/20 | 20 | **validada** (Mendoza) |
| juicio abreviado | procedimiento abreviado | mendoza / saij | 89 / 53 · pág. | 4/20 · 0/3 | 16 · 3 | **validada** |
| confusión de marcas | confundibilidad marcaria | saij | pág. | 0/19 | 19 | **validada** |
| prisión domiciliaria | detención domiciliaria | saij / mendoza | pág. · 5 / 3 | 7/19 · 1/3 | 12 · 2 | **validada** |
| accidentes de trabajo | infortunio laboral | mendoza | 3689 / 347 | 0/20 | 20 | **validada** (anclar a riesgos del trabajo) |
| prescripción liberatoria | prescripción extintiva | mendoza | 119 / 66 | 0/20 | 20 | **validada** |
| seña | arras | mendoza | 2576 / 100 | 0/20 | 20 | **validada** |
| obligación de valor | deuda de valor | mendoza | 1694 / 674 | 5/20 | 15 | **validada** |
| crímenes de lesa humanidad | crímenes contra la humanidad | saij | pág. | 7/20 | 13 | **validada** (SAIJ) |
| trabajo no registrado | trabajo en negro | mendoza / saij | 566 / 69 · pág. | 0/20 · 1/18 | 20 · 17 | validada con reservas (frase) |
| pacto comisorio | cláusula resolutoria (expresa) | mendoza | 50 / 33 | 0/20 | 20 | con reservas (incluye la implícita) |
| inoponibilidad de la personalidad jurídica | desestimación de la personalidad jurídica | mendoza / saij | 16 / 27 · pág. | 2/20 · 0/17 | 18 · 17 | con reservas (en SAIJ, impertinente sin frase) |
| plazo razonable | duración razonable del proceso | mendoza | 1050 / 160 | 4/20 | 16 | con reservas |
| principio precautorio | principio de precaución | mendoza | 96 / 195 | 0/20 | 20 | con reservas (ruido) |
| sueldo anual complementario | aguinaldo | mendoza | 238 / 41 | 1/20 | 19 | con reservas |
| costas en el orden causado | costas por su orden | mendoza | 4727 / 1474 | 13/20 | 7 | con reservas (aporta poco) |
| carga dinámica de la prueba | cargas probatorias dinámicas | mendoza / saij | 401 / 233 · pág. | 14/20 · 0/3 | 6 · 3 | con reservas (es morfológica) |
| restitución internacional de menores | sustracción internacional de menores | saij | pág. | 17/19 | 2 | **sobra** |
| legítima defensa | defensa propia | mendoza | 966 / 1068 | 1/20 | 19 | **rechazada** como expansión libre (10% pertinente) |
| solve et repete | pago previo | mendoza | 10 / 1157 | 0/20 | 20 | **rechazada** (impertinente) |
| medida cautelar genérica | medida cautelar innominada | mendoza | 54 / 5 | 0/5 | 5 | **rechazada** en este acervo |
| Departamento General de Irrigación | DGI | mendoza | 152 / 40 | 0/20 | 20 | **rechazada** (es la DGI impositiva) |
| aseguradora de riesgos del trabajo | ART | mendoza | 822 / 11256 | 0/20 | 20 | **rechazada** («art.») |
| evaluación de impacto ambiental | estudio de impacto ambiental | mendoza | 29 / 51 | 10/20 | 10 | figura que se confunde (confirmada) |
| salvataje | cramdown | mendoza | 7 / 0 | — | — | inconclusa (sin material) |
| paridad de género | cupo femenino | mendoza | 4 / 1 | — | — | inconclusa (sin fuero electoral) |

«pág.» indica que el total informado por SAIJ en vivo es el de la página, no el del sitio.

**Lectura.**

- Las equivalencias validadas tienen tres rasgos en común: las dos formas son voces SCJM o términos SAIJ, el solapamiento es casi nulo y la pertinencia es alta. El buscador pierde la mitad del material si no las une.
- Las rechazadas fallan por el modo de búsqueda por defecto: «todas las palabras» convierte frases cortas y genéricas («defensa propia», «pago previo») en coincidencias de palabras sueltas. Para esas, la vía correcta es el **filtro por voz SCJM o la frase exacta**, no la expansión de texto libre.

**Propuestas sin medir** (38, con norma y evidencia documental). Los nuevos conceptos más urgentes son trabajo en plataformas, foro de necesidad, internación involuntaria, IVE, violencia digital, consulta previa, ajustes razonables, justicia restaurativa y programa de integridad. Las equivalencias con evidencia SAIJ son:

- derecho de rectificación o respuesta ↔ derecho de réplica (CADH 14);
- jurado de enjuiciamiento ↔ tribunal de enjuiciamiento (CN 115);
- Defensor del Pueblo ↔ ombudsman;
- bullying ↔ acoso escolar;
- OGM ↔ productos transgénicos;
- pueblos indígenas ↔ pueblos originarios, sin extenderla a «comunidad indígena» como persona jurídica.

**Relaciones tipadas** (36). Son figuras que se confunden, contrapuestos y homonimias, y todas van con política «no_expandir» o «sugerir».

---

## 10. Ejemplos del tesauro que no corresponden a su voz

`frontend/datos/tesauro/*.json` tiene 309 voces y 1.682 ejemplos.

- **Voces sin ejemplos:** 69. Son todas las de agua (salvo una), dipr, elec, gen, nna, pi y proc_civ, más «caso Badaro».
- **Sospechosos del filtro léxico:** 173. Leídos uno por uno, son **86 impertinentes, 58 tangenciales y 29 pertinentes** (falsos positivos del filtro).
- **Impertinentes por rama:** ddhh 10, amb 8, com 8, sind 6, trib 6, pen 5, seg 5, civ 4, dan 4, suc 4, art 3, cons 3, const 3, cyq 3, lab 3, proc_pen 3, adm 2, fam 2, rea 2, ejec 1, prev 1.

Casos ilustrativos (todos en el JSON, con link y extracto):

- **proc_pen / «prisión preventiva peligro de fuga»**: ejemplos 0 y 1, sumarios SAIJ de concursos (efectos de la apertura, actos prohibidos).
- **ddhh / «debida diligencia reforzada»**: cuatro de cinco ejemplos son nulidades de notificaciones y diligencias procesales.
- **seg / «franquicia transporte público»**: franquicias aduaneras para personas con discapacidad, contrabando de automotores, exenciones de ingresos brutos.
- **trib / «multa por defraudación fiscal»**: estafas y defraudaciones del Código Penal.
- **sind / «práctica desleal»**: Cencosud ante la CNDC (competencia) y un caso de la AFSCA.
- **com / «acción social de responsabilidad»**: cuatro fallos sobre riesgo o vicio de la cosa (art. 1113 CC).
- **suc / «declaratoria de herederos»**: dos sobre beneficio de litigar sin gastos.
- **amb / «legitimación amplia ambiental»**: cuatro sobre legitimación genérica (querella de accionistas, excepciones).
- **art / «reagravación»**: reformatio in peius en una causa por sustracción de caudales.
- **civ / «novación»**: una no renovación de contrato municipal y una licencia de arma vencida.

**Causas observadas.**

- **Homonimia de una sola palabra:** diligencia, franquicia, defraudación, desleal, jurado (el apellido «Soto Jurado»), agravar, renovar, legitimación, exclusión, salvataje.
- **La misma ficha repetida en varias voces:** «Bustos c/ Gobierno de Mendoza» aparece en tres, «Corrado c/ Bameris» en tres y «Olivan» en dos.

Se recomienda regenerar los ejemplos exigiendo que el sumario contenga la frase de la voz o su voz SCJM, y no aceptar coincidencias de una sola palabra.

---

## 11. Perspectivas de los especialistas (síntesis)

- **Constitucional.** Arbitrariedad y gravedad institucional se reconocen como proc_civ. Para el usuario es lo mismo, pero el rótulo de rama confunde. Falta «cuestiones políticas no justiciables».
- **Daños.** El vocabulario técnico es completo (97% con voz SCJM). El problema es el relato: «choque entre moto y colectivo» o «el perro mordió al nene» no llegan a ningún concepto.
- **Obligaciones y contratos.** Las equivalencias de cambio de código (cláusula resolutoria expresa, arras, deuda de valor) están medidas y aportan.
- **Comercial.** Hay que separar fin y quitar el presupuesto público. Falta «abuso de mayoría».
- **Concursal.** La homonimia del salvataje es peligrosa. Las voces concursales están al 100% en SCJM.
- **Laboral individual.** Es la rama con más coloquialismos sin cubrir («me echaron», «en negro», «me bajaron el sueldo»). «despido incausado» es la equivalencia mejor validada de toda la medición.
- **Laboral colectivo.** Faltan la cuota solidaria y los descuentos por paro, y los ejemplos de «práctica desleal» son de competencia.
- **Riesgos del trabajo.** El defecto del singular deja afuera «accidente de trabajo», que es la consulta más frecuente imaginable. La sigla ART no sirve sin contexto.
- **Penal.** Bien cubierto en lo técnico, nulo en lo fáctico. El lavado de activos cuelga de una subrama derogada.
- **Penal económico e informático.** Bien cubierto, con 6 de 7 preguntas reconocidas. El grooming está en civ.
- **Procesal civil.** «perención» existe en SAIJ pero no se expande: es la corrección más rentable. Además, 53 conceptos penales están en la rama.
- **Procesal penal.** Es el peor reconocimiento (1/8). Faltan la regla de exclusión y el peligro de entorpecimiento, y la casación penal se confunde con el REP.
- **Procesal laboral.** Bien reconocido (4/5).
- **Administrativo.** Es la rama mejor cubierta. Para Mendoza hay que unir «acción procesal administrativa» y «contencioso administrativo» (validado).
- **Tributario.** Hay ramas mal asignadas (convenio multilateral, realidad económica). «pago previo» como sinónimo es falso, y la «defraudación» de los ejemplos es la del CP.
- **Financiero y activos digitales.** El Tesauro SAIJ es de 2020: no hay nada de activos virtuales, PSAV ni billeteras (BILLETERA VIRTUAL existe solo como voz SCJM).
- **Competencia.** Está mezclada con consumo dentro de «lealtad comercial».
- **Seguros.** Faltan «pronunciamiento del asegurador» y «oponibilidad de la franquicia», y los ejemplos de franquicia son aduaneros.
- **Consumidor.** La palabra «garantía» lleva a fianza, la prepaga no tiene rama y el daño punitivo está en tres lugares.
- **Familia, capacidad y salud mental.** El plan de parentalidad está confundido con el régimen de comunicación. «internación» lleva a ejecución penal y falta la internación involuntaria.
- **Niñez.** La rama está vacía de vocabulario propio. Todo está en fam, pen, proc_civ y ddhh.
- **Sucesiones.** Bien cubierta. Falta la mejora del art. 2448 y la partición está en fam.
- **Propiedad intelectual.** El singular de «nombres de dominio» falla. «confundibilidad» está validada. Hay que separar digital.
- **Datos personales e IA.** Faltan decisiones automatizadas, biometría y responsabilidad de buscadores, aunque esta última es voz de RAMAS.
- **Ambiental.** Los principios y la recomposición existen como descriptores pero no con las formas de RAMAS. Hay 8 ejemplos impertinentes.
- **Minería, energía e hidrocarburos.** Bien cubiertos, pero dentro de la rama de aguas.
- **Aguas e irrigación.** Es la rama más débil, y la más mendocina. Faltan concesión, derecho de riego e inherencia, y la sigla DGI es falsa.
- **Agrario y vitivinícola.** Mejor de lo esperado (5/7), pero sin rama.
- **Construcción, inmobiliario y notarial.** Lo notarial está en daños. Falta la ruina de obra.
- **DDHH.** La rotulación de «desaparecidos» y los 10 ejemplos impertinentes. «crímenes contra la humanidad» está validada en SAIJ.
- **Internacional privado.** Falta el foro de necesidad, la restitución está en nna y la CPI en dipr.
- **Aduanero.** Cubierto dentro de trib. Falta la clasificación arancelaria.
- **Migratorio.** 0/5.
- **Salud y bioética.** Bien en bioética. Faltan la IVE y el aumento de la prepaga por edad.
- **Previsional.** «moratoria» lleva a plan de pagos y el caso Badaro no tiene ejemplos.
- **Transporte.** 0/6 en lenguaje natural, aunque SAIJ tiene 639 conceptos.
- **Deporte y medios.** Buena cobertura de libertad de expresión. Faltan los derechos federativos.
- **Electoral, parlamentario y municipal.** «paridad» está subordinada a «igualdad de género». No hay fuente con jurisprudencia electoral.
- **Penitenciario.** Las visitas carcelarias se expanden a régimen de comunicación. «detención domiciliaria» está validada.
- **Educación.** Falta la responsabilidad del art. 1767.
- **Libertad religiosa.** Cubierta lo básico.
- **Arbitraje y mediación.** Falta la mediación prejudicial.
- **Biotecnología.** Hay vacíos graves.
- **Responsabilidad profesional.** Cubierta lo básico. Falta el contador.
- **Inversiones.** «expropiación indirecta» está mal equiparada.
- **Género.** 17 conceptos y 10 voces sin ejemplos. «violencia contra la mujer» está validada.
- **Emergentes** (telecom, indígenas, discapacidad, función pública, justicia restaurativa, criminología, compliance, plataformas, vejez, cultura y animales). Ver la tabla del apartado 5.

---

## 12. Batería de regresión

`datos/consultas-referencia.json`: 28 ramas × 10 formas = 280 casos. Cada caso tiene el concepto esperado y, en los contrapuestos, una lista `noDebeExpandirA`.

La línea base del 20/11/2026 cumple **156 de 280** casos:

| Forma | Cumple |
|---|---|
| técnica | 26/28 |
| equivalente | 22/28 |
| variante ortográfica | 23/28 |
| coloquial | 1/28 |
| descriptor judicial (voz SCJM) | 26/28 |
| histórica | 14/28 |
| normativa (artículo) | 7/28 |
| fáctica | 1/28 |
| procesal | 17/28 |
| contrapuesta | 19/28 |

**Expansión indebida activa:** «régimen de visitas carcelarias» se expande a «régimen de comunicación».

Se sugiere correr la batería en cada regeneración del inventario y exigir que no baje ninguna forma y que no aparezca ninguna expansión indebida. Los casos de «accidente de trabajo» y «nombre de dominio» documentan el defecto de `singular()`.

---

## 13. Qué no se verificó

- Números de artículo marcados «(no verificado)» en este informe y en los JSON. Entre ellos: el art. 145 del CPCCyT de Mendoza (tomado de `relaciones-historicas.json`), los arts. 186-194 de la Constitución de Mendoza, el art. 12 de la Ley 26.682, el art. 24 de la Ley 24.241, el inciso de la Ley 27.736 y el inciso del art. 3 de la Ley 22.362.
- La denominación vigente de algunos organismos y tribunales provinciales.
- El alcance temporal de las derogaciones de la Ley 27.742 en materia de multas laborales.
- Si SAIJ conserva «desheredación» y otros descriptores históricos.
- Los totales de SAIJ en vivo, porque la API informa los de la página.
