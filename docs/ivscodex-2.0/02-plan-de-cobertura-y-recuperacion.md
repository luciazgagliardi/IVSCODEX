# IVS CODEX 2.0 — Plan de cobertura jurídica, terminología y recuperación

**Estado:** plan de trabajo derivado de la auditoría del repositorio.  
**Rama:** `architecture/ivscodex-2-scope`.  
**Base:** `main` auditado en `1ef4de0221f4c4d8aca8227926cc00994f91013a`.  
**Regla:** no ampliar volumen sin medir recuperación, autoridad, procedencia y pertinencia.

## 1. Línea de base encontrada

La auditoría terminológica existente documenta:

- 15.116 descriptores preferidos del Tesauro SAIJ.
- 28.501 voces del tesauro de jurisprudencia de Mendoza.
- 32.707 expresiones distintas reconocibles, al combinar descriptores, no preferidos, siglas y voces.
- 39.223 relaciones tipadas.
- 266 relaciones con verificación semántica suficiente para expansión automática.
- 14.436 voces de Mendoza sin correspondencia en SAIJ.
- 2.754 conceptos SAIJ (18 %) sin rama asignada.
- 28 ramas actuales en el buscador, con cobertura muy desigual.

La auditoría de ramas también registra una batería de 280 consultas, 371 preguntas de diagnóstico formuladas por un consejo interdisciplinario simulado y una evaluación manual de ejemplos. **No se debe presentar ese consejo simulado como revisión de 60 profesionales reales.** Sus resultados sirven para descubrir huecos y formular pruebas; la validación jurídica definitiva requerirá especialistas humanos.

### 1.1 La brecha principal no es solamente de cantidad

Según las mediciones documentadas:
- consultas con terminología técnica: 26/28 reconocidas;
- consultas basadas en descriptores judiciales: 26/28;
- consultas coloquiales: 1/28;
- consultas formuladas desde hechos: 1/28;
- consultas por artículo: 7/28;
- preguntas del diagnóstico interdisciplinario reconocidas en su totalidad: 168/371 (45 %).

La prioridad es mejorar el reconocimiento de consultas reales, no agregar sinónimos indiscriminadamente.

### 1.2 Ramas que necesitan corrección o expansión

La auditoría señala como débiles por combinación de cobertura, reconocimiento y recuperación:
- aguas, minería y territorio;
- género y violencia;
- seguros;
- propiedad intelectual y datos;
- electoral;
- ambiental;
- consumidor;
- niñez y adolescencia.

También detecta ramas con muy pocos conceptos o conceptos mal asignados: ejecución penal, derecho internacional privado, procesal civil, niñez y adolescencia y género, entre otras.

### 1.3 Especialidades que faltan o están absorbidas incorrectamente

La taxonomía debe evaluar explícitamente ramas o subramas para:

- salud, salud mental, bioética y discapacidad;
- educación, cultura, ciencia y deporte;
- actividad agropecuaria, vitivinicultura, industria y economías regionales;
- transporte terrestre, marítimo, navegación y aeronáutico;
- comunicaciones, medios y telecomunicaciones;
- energía, hidrocarburos, electricidad y renovables;
- competencia y lealtad comercial;
- bancario, sistema financiero, mercado de capitales, fintech y activos virtuales;
- derecho digital, informática, plataformas, inteligencia artificial, biometría y delitos informáticos;
- migraciones, refugio y nacionalidad;
- personas mayores;
- justicia restaurativa y criminología;
- compliance y responsabilidad penal empresaria;
- biotecnología, genética y neuroderechos;
- inversión extranjera y regímenes de promoción;
- bienestar animal y litigio climático;
- economía del cuidado;
- derecho municipal, notarial y registral;
- arbitraje, mediación y otros métodos adecuados de resolución de conflictos.

La lista es inicial y se amplía a partir de consultas, legislación, fuentes y cambios sociales. Ningún concepto debe asignarse a una rama incorrecta solo para completar una estructura.

## 2. El modelo de cobertura debe ser multidimensional

No usar una única categoría de “materia” para representar todo. Cada documento y cada concepto deberían poder describirse, según corresponda, mediante dimensiones independientes:

1. **Rama y subrama jurídica:** civil, penal, laboral, administrativo, tributario, etc.
2. **Especialidad:** consumidor, seguros, fintech, salud mental, minería, propiedad intelectual, etc.
3. **Institución jurídica:** responsabilidad objetiva, cuidado personal, legítima defensa, prescripción, etc.
4. **Hechos o problema práctico:** despido, accidente, falta de cobertura, filtración, clausura, sanción, incumplimiento.
5. **Sujeto o rol:** trabajador, consumidor, empleador, proveedor, Estado, niño, persona mayor, aseguradora.
6. **Objeto o bien jurídico:** vivienda, datos, salud, ambiente, salario, propiedad, prestación.
7. **Pretensión, remedio o defensa:** indemnización, nulidad, amparo, cautelar, restitución, cumplimiento.
8. **Vía y etapa procesal:** competencia, instancia, trámite, recurso, ejecución, medidas cautelares.
9. **Jurisdicción y territorio:** Nación, provincia, municipio, justicia federal, ordinaria, organismos internacionales.
10. **Tiempo y vigencia:** fecha del hecho, período normativo, fecha del fallo, norma vigente al momento relevante.

Una decisión puede pertenecer a varias especialidades, mencionar varias normas y resolver más de una pretensión. El modelo no debe obligarla a una sola rama.

## 3. Prioridades de corrección del vocabulario

### P0 — Evitar asociaciones jurídicas incorrectas

Antes de aumentar el tesauro:
- corregir los conceptos asignados a ramas equivocadas;
- identificar ambigüedades de una misma voz;
- impedir expansiones indebidas por términos genéricos;
- separar equivalencias reales de términos más amplios, específicos o relacionados;
- revisar las 19 relaciones SAIJ marcadas como potencialmente engañosas;
- corregir los ejemplos impertinentes del tesauro;
- reparar el reconocimiento de singular/plural y expresiones compuestas;
- garantizar que una palabra común no dispare una institución jurídica distinta sin contexto.

Ejemplos que la auditoría marca para pruebas de regresión: “tenencia” en contexto familiar versus penal o de animales; “régimen de visitas carcelarias”; “daño punitivo” versus “daño moral”; “compensación económica” versus “indemnización”; “garantía legal” versus “fianza”; “accidente de trabajo” y sus variantes.

No promover propuestas pendientes a equivalencias automáticas sin prueba y revisión.

### P1 — Completar las ramas y sus subespecialidades

- asignar los 2.754 conceptos sin rama o dejarlos explícitamente pendientes si la evidencia no alcanza;
- permitir múltiples etiquetas de rama cuando el concepto cruza disciplinas;
- separar bloques hoy mezclados, por ejemplo bancario/financiero, digital, aduanero, energía, migratorio, discapacidad, municipal, métodos alternativos y ejecución penal;
- desarrollar ramas faltantes a partir de vocabularios y fuentes oficiales;
- preservar trazabilidad del origen del término y de la decisión de clasificación.

### P2 — Incorporar lenguaje cotidiano y consultas basadas en hechos

Crear una capa de expresiones de búsqueda que conecte la forma en que la gente describe un problema con posibles conceptos jurídicos.

Fuentes candidatas ya identificadas en los pendientes:
- categorías y motivos de reclamo de datasets oficiales de defensa del consumidor;
- glosarios institucionales (por ejemplo, organismos laborales, previsionales y regulatorios);
- formularios, guías y preguntas frecuentes oficiales;
- expresiones recogidas y anonimizadas en pruebas de usabilidad, con consentimiento y sin conservar datos personales innecesarios.

Cada expresión se etiqueta como `expresion_coloquial`, con política inicial `sugerir`. La sugerencia debe mostrar varias posibles vías cuando los hechos sean ambiguos. No convertir una descripción incompleta en una calificación jurídica cerrada.

### P3 — Mejorar búsquedas por norma y artículo

El sistema debe distinguir:
- mención literal de una norma y artículo;
- aplicación de una norma;
- interpretación de una norma;
- norma reformadora y norma reformada;
- versión vigente al momento del hecho;
- texto actual y texto histórico;
- artículo repetido en distintos cuerpos normativos.

Una coincidencia numérica (“art. 52”) no basta para atribuir la cita a una ley determinada. La consulta por artículo debe usar identificadores normativos canónicos y evidencia textual.

### P4 — Crear ejemplos jurídicos confiables

Los ejemplos de cada voz deben provenir de documentos cuya pertinencia se pueda demostrar. El filtro debe verificar la voz o concepto en la metadata y, cuando corresponda, en el texto. Un ejemplo debe indicar:
- documento y fuente;
- tribunal u organismo;
- fecha;
- voz o relación que lo vincula;
- pasaje que prueba la pertinencia.

Eliminar o revisar ejemplos homónimos o tangenciales. No presentar un sumario de concursos como ejemplo de prisión preventiva, ni un encabezado genérico como prueba de una institución jurídica.

## 4. Batería de evaluación: medir si IVS Codex entiende lo que se le pide

La batería existente de 280 casos debe convertirse en un conjunto versionado, ampliado y mantenido. Cada rama tendrá consultas de distintas clases:

- nombre técnico de la institución;
- sinónimo o variante lingüística;
- sigla y abreviatura;
- término histórico;
- descripción coloquial;
- relato breve de hechos;
- norma y artículo;
- cita de fallo;
- carátula o expediente;
- combinación de materia, jurisdicción y período;
- consulta ambigua que debe pedir precisión o sugerir caminos distintos;
- consulta que debe NO expandirse a una institución parecida.

Cada caso debe incluir la intención, jurisdicción, conceptos esperados, fuentes relevantes, resultados de referencia, términos que no deben agregarse y justificación. Los resultados esperados se anotan sobre documentos verificables; no se inventa una lista ideal de fallos.

### Criterios de aceptación del vocabulario

- cero expansiones indebidas en el conjunto de regresión;
- ninguna equivalencia automática sin evidencia;
- alta tasa de reconocimiento en consultas técnicas, coloquiales y fácticas;
- ambigüedades relevantes visibles, no ocultas por una elección arbitraria;
- ejemplos pertinentes y con trazabilidad;
- cobertura medida por rama, especialidad, jurisdicción y tipo de consulta.

Los umbrales numéricos de reconocimiento deben fijarse después de construir una línea de base limpia y revisar manualmente el conjunto de referencia.

## 5. Fuentes: cobertura amplia sin mezclar autoridad

El mapa de fuentes debe tener dimensiones independientes:
- jurisdicción;
- organismo;
- tipo de documento;
- materia;
- período disponible;
- nivel de autoridad;
- texto completo o metadata;
- acceso directo, API oficial, descarga autorizada, proxy autorizado, fuente alternativa o catálogo manual;
- condiciones de uso;
- frecuencia y última fecha verificada;
- estado técnico y calidad de extracción.

Las vistas SAIJ por provincia no se cuentan como conectores independientes a los poderes judiciales provinciales. SAIJ es una fuente agregadora valiosa, pero no sustituye la publicación original. Los materiales doctrinarios, las publicaciones editoriales, los dictámenes administrativos y las sentencias deben permanecer diferenciados.

Prioridad de adquisición:
1. fuentes primarias oficiales y sus documentos íntegros, cuando la publicación y el acceso lo permitan;
2. agregadores oficiales para descubrimiento y cobertura complementaria;
3. repositorios académicos y doctrinarios para investigación secundaria;
4. catálogos manuales para fuentes sin canal técnico confiable.

Si una fuente no ofrece acceso automatizado permitido o estable, debe mantenerse el enlace al portal y una vía manual o autorizada, no forzar una extracción frágil.

## 6. Roadmap de cobertura

| Etapa | Entregable | Definición de terminado |
|---|---|---|
| 1 | Auditoría y corrección del inventario actual | ramas corregidas, conceptos huérfanos identificados, relaciones peligrosas controladas |
| 2 | Taxonomía multidimensional | ramas/subramas/especialidades y dimensiones independientes, versionadas |
| 3 | Vocabulario técnico e histórico | voces y variantes trazables, políticas de expansión verificadas |
| 4 | Lenguaje común y hechos | corpus de consultas coloquiales/fácticas con revisión y pruebas |
| 5 | Cobertura normativa | normas, versiones, vigencia, reformas y relaciones con artículos |
| 6 | Ejemplos y red jurídica | ejemplos probados; relaciones textuales automáticas y relaciones interpretativas humanas |
| 7 | Cobertura de fuentes | matriz por fuente/autoridad/tipo de documento/fecha/canal |
| 8 | Evaluación continua | regresión por rama, relevancia, omisiones y monitoreo de cambios |

## 7. Decisiones que se mantienen fuera de alcance por ahora

- No generar miles de equivalencias con IA y activarlas automáticamente.
- No inferir que dos figuras son equivalentes porque aparecen juntas en un tesauro.
- No prometer cobertura universal de documentos que los organismos no publican o restringen.
- No sustituir jurisprudencia por doctrina ni dictámenes administrativos por sentencias.
- No usar volumen bruto de registros como métrica principal.
- No incorporar un motor comercial o una API paga para resolver un problema que todavía no fue medido.
- No modificar el acervo productivo ni desplegar una migración de índice antes del respaldo y las pruebas de paridad.

## 8. Resultado esperado

Un abogado debe poder empezar desde el lenguaje que conoce —técnico o cotidiano— y obtener caminos de investigación jurídicamente pertinentes, con documentos, normas, fuentes, jurisdicción, fechas, autoridad y límites claramente identificados.

El objetivo de “todas las voces” se interpreta como un compromiso continuo y medible de cobertura: ninguna rama se abandona, ningún campo jurídico se excluye por no estar en el tesauro inicial y toda nueva especialidad puede incorporarse sin rehacer el motor.
