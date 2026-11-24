# IVS CODEX 2.0 — Visión de producto y alcance funcional

**Estado:** documento fundacional de arquitectura y producto.  
**Versión:** 0.1.  
**Rama:** `architecture/ivscodex-2-scope`.  
**Base técnica auditada:** `main` en `1ef4de0221f4c4d8aca8227926cc00994f91013a`.  
**Principio rector:** máxima cobertura jurídica útil, procedencia verificable y costo operativo mínimo.

---

## 1. Ambición del producto

IVS Codex debe aspirar a ser una plataforma integral de investigación y trabajo jurídico, no solamente un buscador de jurisprudencia ni un agregador de enlaces.

La experiencia deseada es que un profesional pueda llegar con una pregunta, un problema fáctico, una cita incompleta, un artículo, un expediente, un tema o una necesidad práctica y que IVS Codex lo ayude a localizar las fuentes jurídicas relevantes, comprender cómo se relacionan y acceder a los documentos verificables.

La ambición es cubrir **todas las ramas, especialidades, jurisdicciones y tipos de fuentes que sean jurídicamente pertinentes**, e incorporar nuevas áreas sin rediseñar el sistema cada vez.

Esto no autoriza a prometer una exhaustividad imposible. Siempre habrá documentos no publicados, fuentes restringidas, colecciones incompletas y cambios en los portales. IVS Codex debe aspirar a reducir sistemáticamente esas zonas ciegas y declarar con precisión qué cubre, qué no cubre y hasta qué fecha.

## 2. Qué debe poder resolver un abogado

La plataforma debe evolucionar hacia un espacio de investigación con módulos conectados:

1. **Jurisprudencia:** búsqueda de sentencias, resoluciones, acordadas, autos, dictámenes jurisdiccionales, sumarios y textos completos.
2. **Legislación y normativa:** constituciones, códigos, leyes, decretos, resoluciones, disposiciones, ordenanzas, reglamentos y normas técnicas; texto vigente, histórico, modificaciones, derogaciones y fechas de vigencia.
3. **Doctrina y producción académica:** libros, artículos, revistas, tesis, comentarios y bibliografía, siempre diferenciando autoría, tipo de publicación, disponibilidad de texto completo y autoridad.
4. **Criterios administrativos:** dictámenes, resoluciones de organismos, criterios fiscales, regulatorios, laborales, previsionales, tributarios, aduaneros y de contratación pública.
5. **Derecho internacional y comparado:** tratados, instrumentos, jurisprudencia de tribunales internacionales y regionales, decisiones extranjeras comparables y mecanismos de incorporación al derecho argentino.
6. **Investigación de precedentes:** citas, precedentes relacionados, líneas temporales, cambios de criterio, confirmaciones, revocaciones, distinciones y contradicciones, separando extracción textual de interpretación jurídica revisada.
7. **Práctica profesional:** plazos, feriados, recesos, tasas, honorarios, intereses, índices, formularios, requisitos, trámites, organismos y enlaces oficiales, con jurisdicción y fecha de vigencia.
8. **Seguimiento:** alertas sobre nuevas decisiones, modificaciones normativas, nuevos dictámenes y novedades por tema, tribunal, organismo, expediente o jurisdicción.
9. **Trabajo con documentos:** lectura, extracción, citas, comparación de versiones, anotaciones y preparación de referencias para escritos e informes, sin atribuirle al sistema conclusiones jurídicas no verificadas.

Cada módulo debe poder funcionar por separado y compartir una misma capa de identidad documental, procedencia, búsqueda y permisos.

## 3. Cobertura jurídica: taxonomía extensible y sin ramas huérfanas

La clasificación de IVS Codex no puede limitarse a las ramas tradicionales de una facultad ni a las voces que un solo tesauro haya publicado. Debe poder representar especialidades, subespecialidades, instituciones, hechos, procedimientos, sujetos, objetos, remedios y fuentes normativas.

El siguiente mapa es una **taxonomía inicial de cobertura**, no una lista cerrada. Las áreas pueden cruzarse y un concepto puede pertenecer a más de una rama, subrama o especialidad.

### 3.1 Derecho público y organización estatal
- Constitucional y convencional.
- Derechos humanos y garantías.
- Administrativo general y especial.
- Empleo público y función pública.
- Responsabilidad del Estado.
- Contrataciones públicas, concesiones y servicios públicos.
- Procedimiento administrativo y contencioso administrativo.
- Derecho tributario, fiscal y aduanero.
- Finanzas públicas, presupuesto y derecho municipal.
- Electoral, partidos políticos y sistemas de representación.
- Seguridad, defensa, inteligencia y régimen disciplinario.
- Regulación económica y entes reguladores.

### 3.2 Derecho privado patrimonial
- Civil general y parte general.
- Obligaciones, contratos y responsabilidad civil.
- Daños, reparación, prevención y cuantificación.
- Derechos reales, propiedad, posesión y registración.
- Sucesiones y planificación patrimonial.
- Familia, matrimonio, uniones convivenciales, filiación y responsabilidad parental.
- Consumidor y usuario.
- Seguros y responsabilidad aseguradora.
- Comercial, sociedades, gobierno corporativo y títulos valores.
- Concursos, quiebras e insolvencia.
- Bancario, financiero, mercado de capitales, pagos y fintech.
- Propiedad intelectual, industrial, marcas, patentes y derechos de autor.
- Datos personales, privacidad, identidad digital y ciberseguridad.
- Transporte, logística y responsabilidad por cargas.

### 3.3 Derecho laboral y protección social
- Laboral individual.
- Laboral colectivo, asociaciones sindicales y negociación colectiva.
- Riesgos del trabajo, accidentes y enfermedades profesionales.
- Seguridad e higiene y salud ocupacional.
- Seguridad social, jubilaciones, pensiones y asignaciones.
- Empleo público y regímenes especiales.
- Trabajo agrario, construcción, casas particulares y actividades reguladas.
- Discriminación, igualdad y tutela antirrepresalia.

### 3.4 Derecho penal y sancionador
- Penal general y especial.
- Procesal penal federal, nacional y provincial.
- Ejecución penal y penitenciario.
- Contravencional y de faltas.
- Penal económico, tributario, aduanero y societario.
- Delitos informáticos y evidencia digital.
- Responsabilidad penal de personas jurídicas.
- Régimen sancionador administrativo.
- Justicia penal juvenil y medidas de protección.

### 3.5 Derecho procesal y resolución de conflictos
- Procesal civil y comercial.
- Procesal laboral.
- Procesal administrativo.
- Procesal tributario y aduanero.
- Procesal constitucional y amparo.
- Procesal de familia.
- Procesal penal.
- Ejecución de sentencias, medidas cautelares y procesos colectivos.
- Mediación, conciliación, arbitraje y métodos adecuados de resolución de conflictos.
- Cooperación judicial, exhortos y reconocimiento de decisiones extranjeras.

### 3.6 Derechos y sectores especializados
- Niñez, adolescencia y capacidad.
- Género, diversidad, violencia y protección integral.
- Salud, bioética, discapacidad y salud mental.
- Educación, universidades y ciencia.
- Ambiente, cambio climático y derecho animal.
- Aguas, minería, hidrocarburos y energía.
- Agricultura, ganadería, vitivinicultura y economías regionales.
- Urbanismo, vivienda, construcción y propiedad horizontal.
- Cultura, patrimonio, deporte, turismo y espectáculos.
- Telecomunicaciones, medios, plataformas e Internet.
- Aeronáutico, navegación y marítimo.
- Migraciones, nacionalidad, refugio y extranjería.
- Derecho internacional público y privado.
- Derecho comparado y sistemas jurídicos extranjeros.
- Profesiones reguladas, ética y responsabilidad profesional.
- Notarial, registral, inmobiliario y documentación pública.

La taxonomía debe incorporar nuevas ramas cuando aparezcan fuentes, normas, prácticas o problemas que no estén representados. No debe forzar conceptos a una rama incorrecta para completar un cuadro.

## 4. Modelo de vocabulario y “todas las voces”

La cobertura terminológica es una capacidad central del producto, no un adorno ni un conjunto de sinónimos.

La línea de base documentada en la auditoría existente informa:
- 15.116 descriptores preferidos del Tesauro SAIJ.
- 28.501 voces del tesauro de jurisprudencia de Mendoza.
- 32.707 expresiones distintas reconocibles al combinar descriptores, términos no preferidos, siglas y voces.
- 39.223 relaciones tipadas.
- 266 relaciones con verificación semántica suficiente para expansión automática.
- 14.436 voces de Mendoza sin correspondencia en SAIJ.

Estas cifras son una línea de base, no una declaración de cobertura completa. El inventario necesita corregir asignaciones de rama, completar especialidades, revisar relaciones y sumar lenguaje común.

### 4.1 Cada concepto debe tener identidad propia

Cada concepto canónico debe poder almacenar:
- Identificador estable.
- Denominación preferida.
- Definición o nota de alcance cuando exista fuente confiable.
- Ramas, subramas y etiquetas transversales.
- Jurisdicción y ámbito institucional.
- Variantes léxicas, ortográficas y morfológicas.
- Siglas, abreviaturas y denominaciones extendidas.
- Denominaciones históricas y cambios terminológicos.
- Expresiones coloquiales o descripciones de hechos.
- Normas relacionadas, con artículo y período de vigencia.
- Fuentes que utilizan o definen la voz.
- Evidencia, fecha de incorporación, versión y estado de revisión.

### 4.2 Relaciones: nunca confundir similitud con equivalencia

Las relaciones deben estar tipadas y tener evidencia:
- Equivalencia conceptual verificada.
- Equivalencia histórica o cambio de denominación.
- Equivalencia ortográfica o morfológica.
- Sigla y denominación extendida.
- Descriptor preferido y no preferido.
- Concepto amplio y concepto específico.
- Concepto relacionado.
- Concepto contrapuesto.
- Figuras que suelen confundirse.
- Expresión coloquial o descripción fáctica.

La búsqueda automática solo debe expandirse con equivalencias verificadas. Los conceptos relacionados y las expresiones ambiguas deben mostrarse como sugerencias de investigación, no como sinónimos. Las relaciones jurídicas interpretativas requieren revisión humana.

### 4.3 Lenguaje cotidiano y problemas reales

El usuario no siempre conoce el nombre jurídico de lo que busca. Debe poder escribir, por ejemplo:
- “mi empleador me tuvo en negro y no me pagó”;
- “me chocaron y la aseguradora no quiere cubrir”;
- “mi vecino construyó sobre mi terreno”;
- “me quieren desalojar”;
- “me llegó una multa que considero injusta”;
- “me suspendieron una prestación”;
- “compré algo y no me lo quieren cambiar”.

El sistema debe reconocer hechos, sujetos, objetos, daños, relaciones, posibles instituciones y jurisdicciones, y ofrecer caminos de búsqueda. No debe presentar una calificación jurídica automática como conclusión definitiva ni asumir hechos no aportados.

Las expresiones coloquiales deben construirse a partir de fuentes legítimas —consultas frecuentes, glosarios institucionales, formularios, categorías oficiales y revisión jurídica— y validarse con conjuntos de consultas reales.

### 4.4 Cobertura medible

El inventario debe medir, por rama y subrama:
- cantidad de conceptos canónicos;
- variantes y expresiones reconocibles;
- conceptos con fuentes y evidencia;
- relaciones verificadas, sugeridas y controvertidas;
- conceptos sin rama o con asignación dudosa;
- cobertura jurisdiccional;
- consultas de referencia que se reconocen y recuperan;
- consultas reales que no se reconocen.

No se debe premiar el tamaño bruto del tesauro. La métrica prioritaria es la recuperación pertinente sin expansiones jurídicamente indebidas.

## 5. Cobertura documental y jerarquía de autoridad

Cada resultado debe identificarse por tipo documental y por autoridad. Como mínimo:
- sentencia o resolución de tribunal;
- sumario oficial;
- ficha o registro bibliográfico;
- texto completo;
- dictamen administrativo;
- norma vigente;
- norma histórica o modificatoria;
- doctrina o comentario;
- tratado o documento internacional;
- formulario, trámite o información institucional.

La plataforma debe identificar la fuente original, el organismo, jurisdicción, tribunal o dependencia, fecha, número de expediente o norma, tipo de documento, URL de origen, fecha de captura, última verificación, versión y canal de obtención.

Un resumen, una ficha SAIJ, una cita doctrinaria y el texto de una sentencia no son intercambiables. La interfaz debe evitar que se confundan.

Cuando una fuente alternativa aporte un documento, debe quedar identificado como tal. No se atribuirá al portal original una recuperación que provino de otro canal.

## 6. Experiencia de búsqueda

La búsqueda debe poder partir de:
- un término jurídico;
- una pregunta en lenguaje cotidiano;
- una descripción de hechos;
- un artículo, ley, código o tratado;
- una cita jurisprudencial completa o incompleta;
- una carátula, expediente, CUIJ, tribunal o magistrado;
- una materia, fuero, jurisdicción o etapa procesal;
- una fecha o período;
- una norma histórica o vigente.

Debe ofrecer filtros estructurados y explicables: tipo de fuente, autoridad, jurisdicción, fuero, tribunal, instancia, fecha, vigencia, tipo documental y disponibilidad del texto completo.

La búsqueda semántica puede complementar la recuperación léxica, nunca sustituirla ni inventar correspondencias. Los resultados deben ser explicables: el usuario debe poder saber qué términos coincidieron, qué filtro se aplicó y por qué se sugirió una relación.

## 7. Principios de arquitectura que preservan la ambición

1. **Fuente de verdad documental independiente del índice.** Los registros originales, normalizados y versionados deben sobrevivir a cambios de motor de búsqueda.
2. **Ingestión separada de consulta.** La cosecha, descarga, OCR, normalización e indexación no pueden degradar el servicio que atiende a usuarios.
3. **Conectores desacoplados.** Cada fuente tiene capacidades, límites, mecanismos de acceso, formatos, cursores y estado propios.
4. **Contrato de resultado explícito.** Distinguir conexión directa, proxy autorizado, fuente alternativa, acervo local, restricción remota, fallo de transporte, cambio de formato y cero auténtico.
5. **Procedencia por documento y por recuperación.** Registrar canal, fuente original, fecha y evidencia de obtención.
6. **Índices reconstruibles.** El motor de búsqueda es una proyección del acervo y no el único lugar donde existe el contenido.
7. **Sin falsos ceros.** La ausencia de resultado solo puede declararse con evidencia de que la consulta se ejecutó correctamente.
8. **Concurrencia controlada por dominio.** Evitar duplicar solicitudes, respetar límites y aislar la caída de una fuente.
9. **Seguridad y acceso legítimo.** Respetar términos, autenticación, robots y restricciones de los organismos. No diseñar evasión de controles.
10. **Escalado por evidencia.** No incorporar servicios pagos o sistemas distribuidos antes de que mediciones reales lo justifiquen.
11. **Costo mínimo en la etapa inicial.** Priorizar herramientas abiertas, infraestructura gratuita o ya disponible y operaciones automatizadas.
12. **Migración reversible.** Mantener la plataforma actual operativa hasta que la alternativa demuestre paridad.

## 8. Restricción económica

El objetivo es que la operación inicial sea prácticamente gratuita para su fundadora, sin ocultar costos inevitables ni depender de servicios comerciales esenciales.

La plataforma debe:
- funcionar sin APIs pagas para la búsqueda convencional;
- permitir reconstruir índices con herramientas abiertas;
- minimizar almacenamiento duplicado y tráfico;
- separar procesos pesados de la API interactiva;
- usar límites gratuitos solo después de verificar sus condiciones vigentes;
- tener alertas de consumo y límites de gasto;
- tener una ruta de salida de cada proveedor;
- financiar la expansión mediante ingresos cuando exista demanda.

Cada recomendación de infraestructura debe documentar costo inicial, mensual, variable, límites gratuitos, riesgo de cambio del proveedor y alternativa de migración.

## 9. Criterios de éxito

No se considerará terminado un módulo por compilar o por responder HTTP 200. Debe superar pruebas funcionales contra documentos de referencia.

Criterios transversales:
- ningún error de acceso, timeout o lectura se muestra como cero auténtico;
- el 100 % de los resultados identifica su fuente y canal de recuperación;
- las expansiones automáticas tienen evidencia y alta confianza;
- los conceptos relacionados no se presentan como sinónimos;
- las normas muestran vigencia y período aplicable;
- la paginación no duplica ni pierde resultados;
- el fallo de una fuente no bloquea las demás;
- los índices se reconstruyen desde datos versionados;
- se mide recuperación por rama, jurisdicción y tipo documental;
- se ejecutan pruebas con consultas reales y concurrencia antes de aceptar cambios.

Los porcentajes de precisión, exhaustividad, latencia y disponibilidad deben publicarse solo cuando exista una metodología y un conjunto de referencia válidos.

## 10. Etapas de construcción

### Etapa 0 — Preservar y medir
Respaldo verificable de datos y estado actual; reconciliar versión de producción; corregir falsos ceros; generar línea base repetible.

### Etapa 1 — Cimientos de datos
Fuente de verdad versionada; identificadores canónicos; manifiestos, hashes, publicación atómica e índices reconstruibles; sacar el acervo del ciclo de vida de Git.

### Etapa 2 — Consulta confiable
Contrato de resultado único; orquestador; deduplicación; paginación; políticas por dominio; reducir solicitudes redundantes del frontend.

### Etapa 3 — Cobertura documental
Conectores oficiales, alternativas declaradas, ingestión incremental, texto completo cuando esté permitido y control de cobertura por fuente.

### Etapa 4 — Mapa jurídico completo
Normalizar el inventario terminológico, corregir ramas, incorporar áreas huérfanas, lenguaje cotidiano, voces históricas y relaciones revisadas.

### Etapa 5 — Inteligencia de investigación
Red de normas y precedentes, historial de criterios, alertas, seguimiento y herramientas de investigación profesional.

### Etapa 6 — Escala comercial
Pruebas de carga, separación de servicios solo cuando se justifique, alta disponibilidad, controles de costos y funcionalidades multiusuario.

## 11. Regla de producto

La meta es que el abogado no tenga que saber de antemano qué base contiene el documento, cómo se llama jurídicamente el problema ni qué organismo lo publicó.

IVS Codex debe ayudar a formular la investigación, localizar las fuentes adecuadas, recuperar material relevante, mostrar la autoridad y procedencia, y permitir verificarlo.

La cobertura debe ampliarse de forma continua, pero nunca confundirse volumen con exhaustividad ni inteligencia con una conclusión jurídica no comprobada.

**La ambición es construir una infraestructura de investigación jurídica amplia, confiable, extensible y económicamente sostenible.**
