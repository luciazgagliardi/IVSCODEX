# Auditoría jurídica y técnica de búsqueda

**Fecha de corte:** 17 de noviembre de 2026  
**Alcance:** fuentes, arquitectura de consulta, recuperación local, expansión semántica, cobertura jurisdiccional y plan de mejora de IVS · CODEX.

## 1. Dictamen ejecutivo

IVS · CODEX ya tiene una base técnica seria: consultas simultáneas, adaptadores por fuente, un acervo SQLite/FTS5, un tesauro de equivalencias, paginación, deduplicación, extracción de pasajes y verificación de citas. El problema principal no es la ausencia de un buscador, sino la diferencia entre lo que el producto promete buscar, lo que las fuentes realmente publican y lo que el acervo local puede recuperar cuando una fuente falla.

La auditoría identificó y corrigió en esta rama dos pérdidas concretas:

1. La expansión del tesauro en el acervo local estaba restringida a Mendoza, aunque la búsqueda en vivo ya admitía equivalentes para otras fuentes. Cuando el origen no respondía, una consulta formulada con una denominación alternativa podía perder documentos que el buscador en vivo sí habría encontrado.
2. Los conceptos relacionados se mostraban separados de los equivalentes, pero ambos ejecutaban la misma acción de búsqueda y el mensaje afirmaba que eran “lo mismo”. Eso confundía una pista de investigación con una equivalencia jurídica.

Se añadieron pruebas de regresión para ambos comportamientos. Estos cambios están en la rama **audit/expansion-local-corpus-2026**, no en main. No se afirma que la suite completa haya pasado: no se ejecutó npm test ni se hizo un despliegue de prueba en esta auditoría.

**Conclusión:** la mejora decisiva no consiste en sumar miles de resultados a ciegas. Consiste en recuperar más documentos pertinentes, explicar por qué aparecen, distinguir la autoridad de cada fuente y poder medir las omisiones.

## 2. Qué se auditó y qué no se debe confundir

El proyecto reúne doce fuentes documentales principales. Además, incorpora seis vistas provinciales que consultan facetas de SAIJ. Estas seis vistas no son seis conexiones independientes a los poderes judiciales provinciales.

El catálogo de la interfaz contiene 125 enlaces a organismos y buscadores, luego de la segunda expansión documentada en la sección 5.1. Ese catálogo es útil para abrir fuentes manualmente, pero no significa que esos 125 enlaces sean integraciones automáticas ni que se consulten en cada búsqueda.

La lista de fuentes de búsqueda tampoco equivale a cobertura total del sistema judicial argentino. Un agregador nacional puede reunir decisiones de distintas jurisdicciones, pero no garantiza que cada fallo esté publicado, actualizado, indexado con el texto completo o atribuido correctamente al tribunal. Los portales de consulta de causas, por su parte, sirven para seguir expedientes y no necesariamente contienen una base pública de sentencias.

No existe una forma técnicamente honesta de garantizar que “no se escape nada”: hay decisiones no publicadas, registros incompletos, sistemas con acceso restringido, documentos escaneados, repositorios privados y cambios de cobertura. El objetivo verificable es reducir omisiones, señalar las zonas ciegas y mostrar cuándo una respuesta es parcial.

## 3. Hallazgos de arquitectura

### 3.1. Aciertos que conviene conservar

- **Adaptadores por fuente.** Cada motor recibe la forma de consulta que entiende. Esto es correcto: no todos procesan frases, operadores, artículos, acentos ni filtros del mismo modo.
- **SAIJ como fuente transversal.** Su base oficial declara más de 900.000 documentos de fuentes oficiales, con legislación, jurisprudencia nacional y provincial, doctrina, dictámenes y normas de organismos. Es un pilar útil, pero no debe presentarse como sustituto de la ficha original de cada tribunal.
- **Acervo local.** SQLite/FTS5 permite seguir recuperando documentos cuando un portal no responde y mantiene un orden de relevancia.
- **Cita y procedencia.** El proyecto conserva enlaces a los documentos y distingue la búsqueda de una cita de la búsqueda exploratoria por tema.
- **Tesauro con equivalentes y relacionados.** La estructura ya contempla que una misma institución jurídica cambia de nombre y que otros conceptos pueden ser útiles sin significar lo mismo.
- **Prudencia ante las fuentes.** El verificador no utiliza doctrina ni una revista seleccionada como prueba de que un expediente existe. Esa separación es correcta.

### 3.2. Defectos y riesgos detectados

| Hallazgo | Efecto | Prioridad |
|---|---|---|
| El acervo local sólo expandía sinónimos para Mendoza | Menor recuperación ante fallas de fuentes en el resto del sistema | Corregido en esta rama |
| Conceptos relacionados ejecutaban la acción de un sinónimo | Riesgo de inducir al usuario a tratar instituciones distintas como equivalentes | Corregido en esta rama |
| La cobertura de seis vistas provinciales se basa en facetas SAIJ | La vista territorial no equivale a una integración directa del poder judicial local | Alta |
| El portal renovado de Jurisprudencia de la CSJN no figuraba en la ruta de consulta | Riesgo de depender exclusivamente de la ficha secundaria de SAIJ | Alta |
| La búsqueda federal y nacional incorporó decisiones de primera instancia conforme Acordada 10/2025 | Oportunidad de cobertura que requiere conexión directa y no sólo búsquedas en agregadores | Alta |
| Las cosechas de fuentes distintas usan términos semilla y topes de páginas | Un acervo grande puede seguir siendo sesgado por las consultas que lo alimentaron | Alta |
| Algunos resultados son sumarios, fichas, resúmenes, doctrina o texto completo | Si se mezclan sin tipificar, el usuario puede atribuir a una sentencia lo que sólo dice un sumario o un comentarista | Alta |
| La cantidad de resultados no es una medida de exhaustividad | Los conteos pueden aparentar una cobertura que sólo corresponde a una muestra o a un índice parcial | Alta |

### 3.3. Una búsqueda de artículo no es una búsqueda temática

El código ya reconoce que los motores entienden de forma distinta las citas normativas. Para el artículo 1741, las pruebas documentadas muestran resultados diferentes según se use “art 1741”, “artículo 1741” o la sigla del código. Por eso debe mantenerse la adaptación por fuente y ampliar la batería de pruebas a normas provinciales, leyes especiales y artículos con bis, ter y quater.

También deben separarse al menos cuatro preguntas:

1. ¿Qué sentencias citan expresamente este artículo?
2. ¿Qué sentencias aplican la institución aunque no citen el artículo?
3. ¿Qué decisiones interpretan una norma anterior o una regulación equivalente?
4. ¿Qué sentencias distinguen, limitan, abandonan o contradicen ese criterio?

Una sentencia que trata el mismo tema no debe etiquetarse como una que cita o aplica una norma concreta sin evidencia textual.

## 4. Inventario y utilidad de las fuentes existentes

La puntuación es una **estimación cualitativa de utilidad para investigación**, no una medición estadística de precisión o exhaustividad. Separa utilidad, autoridad y alcance. Una calificación alta no significa que el repositorio esté completo.

| Fuente | Utilidad estimada | Mejor uso | Límite y advertencia |
|---|---:|---|---|
| SAIJ | 5/5 | Descubrimiento transversal de jurisprudencia, legislación, doctrina y dictámenes nacionales y provinciales | Motor amplio con ruido por OR; muchos fallos son fichas ligadas a sumarios; verificar siempre el documento de origen |
| Poder Judicial de Mendoza | 4/5 | Jurisprudencia local, especialmente Suprema Corte, cámaras civiles y del trabajo | La integración conocida no cubre todo el universo de tribunales; familia y primera instancia requieren auditoría aparte |
| CSJN vía SAIJ | 4/5 | Descubrimiento de sumarios y fichas atribuidas a la Corte | Es una ruta secundaria; la consulta directa oficial debe tener prioridad cuando sea técnicamente viable |
| SCBA / JUBA | 4/5 | Sumarios provinciales y localización de fallos bonaerenses | No representa por sí sola todas las instancias y fueros de la Provincia |
| CABA / TSJ | 3/5 | Jurisprudencia del Tribunal Superior de Justicia de la Ciudad | Cobertura institucional más estrecha que el conjunto de juzgados y cámaras de la Ciudad |
| Corte IDH | 4/5 | Sentencias, opiniones consultivas y resoluciones sobre responsabilidad estatal y derechos humanos | Jurisprudencia internacional regional; no confundir su fuerza con la de una sentencia nacional |
| Río Negro | 3/5 | Jurisprudencia del STJ y decisiones accesibles en el protocolo web | Revisar el alcance de cada tipo de tribunal y la completitud histórica de la cosecha |
| Santa Fe | 3/5 | Jurisprudencia de la Corte provincial y sumarios relacionados | No equivale a cobertura integral de cámaras y primera instancia |
| Juristeca | 3/5 | Fallos de cámaras de la Ciudad con documento descargable | Colección acotada al ámbito que publica el Consejo de la Magistratura |
| Catamarca | 2/5 | Descubrimiento de sentencias y sumarios públicos de la Corte provincial | La extracción desde páginas públicas es parcial y debe mostrar fecha de última cosecha |
| Dialnet | 3/5 | Doctrina académica, artículos, libros y tesis para encontrar autores, debates y bibliografía | No es fuente primaria de jurisprudencia; a menudo ofrece metadatos o resúmenes, no texto íntegro |
| Mendoza Legal | 2/5 | Selección editorial de fallos y comentarios útiles para descubrir criterios relevantes | No es exhaustiva ni neutral como universo de búsqueda; no sirve para concluir que un fallo no existe |

### Vistas provinciales SAIJ

Las vistas adicionales actuales corresponden a Córdoba, Entre Ríos, Neuquén, Tucumán, Chaco y Corrientes. Su valor es facilitar la búsqueda territorial dentro de los documentos publicados por SAIJ. No son conectores independientes a esos poderes judiciales y no deben contarse como seis bases originales separadas.

SAIJ informa que trabaja con las 24 jurisdicciones locales. La expansión del producto debería permitir explorar esa faceta para todas las provincias, pero sin prometer que cada una tenga igual volumen, actualización o texto completo.

## 5. Fuentes nuevas identificadas: orden de integración

La investigación oficial encontró oportunidades que merecen prioridad. Se recomienda primero probar manualmente la búsqueda, registrar términos, filtros, enlaces y resultados, y sólo después implementar un adaptador. No se debe sortear CAPTCHA, autenticación ni controles técnicos de los portales.

### P0 — Integraciones de alto impacto

**A. Secretaría de Jurisprudencia de la CSJN: fuente directa**

Portal renovado: https://sjservicios.csjn.gov.ar/sj/

Al 12 de noviembre de 2026 el portal anunciaba sumarios de 1863–2026, todos los fallos de 1994–2026, búsqueda por tomo y página, fallos destacados por materia y acuerdos. La integración actual vía SAIJ debe conservarse como respaldo y vía de descubrimiento, pero se debe probar el portal directo para mejorar autoridad del enlace, metadatos, sumarios y búsqueda de citas.

**B. Tribunales Federales y Nacionales: primera instancia**

La CSJN informó el 5 de septiembre de 2025 que el buscador de fallos federales y nacionales incorporó sentencias de juzgados de primera instancia, además de cámaras y tribunales orales, en consonancia con la Acordada 10/2025. Es una ampliación sustancial para civil, comercial, laboral, penal, contencioso administrativo y otros fueros nacionales y federales.

Acceso institucional: https://www.csjn.gob.ar/novedades/detalle/10964

La integración debe registrar jurisdicción, fuero, instancia, tribunal, fecha, expediente, tipo de decisión y enlace oficial. Los resultados de primera instancia no deben confundirse con doctrina de la Corte.

**C. Corrientes: nuevo repositorio judicial directo**

Portal: https://jurisprudencia.juscorrientes.gov.ar/

Justicia.ar informó el 28 de agosto de 2026 que el nuevo sistema reúne 48.358 fallos del Superior Tribunal de Justicia, de 2004 a agosto de 2026, clasificados en nueve materias: civil y comercial, amparo, administrativo, laboral, penal, electoral, conflicto de poderes, superintendencia y habeas data. El portal indica que en una segunda etapa incorporará todas las cámaras.

Esta integración debe desplazar la dependencia exclusiva de la vista provincial SAIJ para el material que publique el STJ de Corrientes. Mantener SAIJ como fuente complementaria permitirá comparar coberturas y detectar documentos faltantes. Durante esta auditoría, la consulta automatizada del dominio del nuevo portal devolvió HTTP 403; eso no demuestra que el sitio no sea utilizable desde un navegador, pero sí impide dar por probada una API o un método de extracción. La viabilidad técnica debe verificarse respetando sus controles de acceso.

### P1 — Fuentes administrativas y especializadas

**D. Tribunal Fiscal de la Nación**

Portal oficial: https://www.argentina.gob.ar/tribunalfiscal/jurisprudencia  
Buscador asistido: https://jurisprudenciatfn.mecon.gob.ar/

La página oficial ofrece últimas sentencias, buscador de jurisprudencia VUCE, boletín, sumarios y buscador asistido por IA. Advierte expresamente que la carga de sentencias sigue en curso y que algunos fallos deben solicitarse por correo. Es una fuente prioritaria para tributario, aduanero, procedimiento fiscal, sanciones y litigios con la administración. La interfaz asistida por IA debe servir como vía de descubrimiento; la cita final debe llevar a la sentencia o sumario verificable.

**E. Procuración del Tesoro de la Nación**

Buscador: https://busquedadictamenes.ptn.gob.ar/

El buscador permite localizar dictámenes por texto completo, expresiones, voces, fecha, organismo, tomo y página. La propia PTN explica que sus dictámenes constituyen jurisprudencia administrativa obligatoria para los servicios jurídicos del Cuerpo de Abogados del Estado. Esto es especialmente relevante en empleo público, contratos administrativos, responsabilidad del Estado, procedimiento, empleo estatal, bienes públicos, regulación y litigios estatales. La incorporación de dictámenes históricos escaneados desde 1943 amplía el corpus, pero la propia PTN advierte que campos como fecha exacta, voces y organismo todavía tienen datos incompletos o pendientes de extracción manual.

Advertencia jurídica: esa obligatoriedad institucional no convierte al dictamen en precedente judicial vinculante para los tribunales ni para todos los litigantes privados. La plataforma debe etiquetarlo como doctrina administrativa de PTN.

**F. Comisión Nacional de Defensa de la Competencia**

Buscadores oficiales: https://www.argentina.gob.ar/defensadelacompetencia/buscadores

Incluye buscador general de dictámenes y resoluciones, jurisprudencia temática, multas por notificación tardía, multas por conductas anticompetitivas y soluciones conductuales o estructurales. Es una fuente valiosa para competencia, regulación económica, fusiones, abuso de posición dominante, sanciones, medidas correctivas y relaciones entre derecho administrativo y económico.

### P2 — Fuentes comparadas e internacionales

**G. OIT / NORMLEX**

https://www.ilo.org/dyn/normlex/

La compilación del Comité de Libertad Sindical permite navegar por materia, buscar párrafos, casos, países y palabras. La OIT indica que reúne conclusiones en más de 3.200 casos a lo largo de más de 65 años. Es útil para libertad sindical, negociación colectiva, huelga y garantías laborales. Debe mostrarse como interpretación del órgano internacional pertinente, no como sentencia de un tribunal argentino.

**H. OHCHR JURIS**

https://juris.ohchr.org/

Repositorio central de decisiones de los ocho órganos de tratados de Naciones Unidas en comunicaciones individuales. Añade una línea de investigación para derechos humanos, igualdad, debido proceso, libertad de expresión, tortura, desaparición, derechos económicos y sociales y recursos internacionales.

**I. Tribunal Europeo de Derechos Humanos / HUDOC**

https://hudoc.echr.coe.int/

Permite explorar sentencias, decisiones, casos comunicados, opiniones consultivas y resúmenes jurídicos. Su tesauro de palabras clave es un modelo especialmente útil: agrupa documentos con contenido jurídico similar y permite descubrir relaciones no literales. Tiene límites de publicación declarados por el propio Tribunal, por lo que no debe describirse como universal.

**J. Tribunal de Justicia de la Unión Europea / InfoCuria**

https://infocuria.curia.europa.eu/

La nueva plataforma ofrece texto completo y metadatos, búsqueda aproximada, operadores booleanos, filtros, resaltado, clasificación del asunto y referencias a actos y decisiones citados, en las 24 lenguas oficiales de la Unión Europea. Es una fuente comparada, útil para consumo, datos, competencia, privacidad, plataformas, regulación y derecho económico. No reemplaza normas argentinas ni debe presentarse como autoridad vinculante nacional.

### K. Directorio oficial para descubrir nuevas fuentes

https://www.justicia.ar/herramientas/sentencias

Justicia.ar reúne enlaces a jurisprudencia de la CSJN, la justicia federal y nacional y los poderes judiciales provinciales y de la Ciudad. Debe convertirse en el registro de referencia para detectar altas, bajas y cambios de portales. Su directorio de consulta pública de causas debe mantenerse separado: el seguimiento de un expediente no equivale a la publicación del fallo.

## 5.1. Segunda expansión del catálogo provincial y federal

La revisión directa del directorio de sentencias de Justicia.ar reveló que una parte importante de los buscadores provinciales no figuraba en el catálogo de IvsCodex. Se añadieron **18 accesos oficiales al catálogo manual** y un acceso directo al buscador federal/nacional. El catálogo pasó de 106 a **125 fuentes**.

Esto mejora el descubrimiento y evita que el usuario confunda una vista de SAIJ con una consulta del Poder Judicial local. No convierte automáticamente esos portales en fuentes consultadas por cada búsqueda: para eso hace falta implementar y probar un adaptador específico.

| Portal oficial | Alcance observado | Valor para IvsCodex | Estado técnico de la auditoría |
|---|---|---|---|
| **Chubut — Eureka!** (https://apps1cloud.juschubut.gov.ar/eureka) | Fallos anonimizados, sumarios y acordadas/resoluciones. En la consulta del 17/11/2026 mostraba aproximadamente 241.000 sentencias, 85.000 anonimizadas, 69.000 sumarios y 29.000 acordadas/resoluciones. Estos contadores son dinámicos y pueden cambiar entre consultas. | Muy alto: volumen documental grande, varias instancias, doctrina y normativa administrativa. | Hay vista anónima pública; los documentos restringidos exigen credenciales. El buscador ofrece rutas distintas para fallos y sumarios. Investigar el formulario anónimo y sus límites sin tocar vistas restringidas. |
| **Corrientes — STJ** (https://jurisprudencia.juscorrientes.gov.ar/) | 48.358 fallos del STJ, de 2004 a agosto de 2026, en nueve materias. El propio Poder Judicial anunció que las cámaras se incorporarán en una segunda etapa. | Muy alto: material reciente, clasificación por fuero y sumarios estructurados revisados por el área de jurisprudencia. | Portal oficial nuevo; el dominio devolvió 403 a la consulta automatizada de esta auditoría. No se ha confirmado una API pública ni un método de cosecha permitido. |
| **Entre Ríos — Buscador de Jurisprudencia** (https://jurbuscador.jusentrerios.gov.ar/) | Alrededor de 14.000 sentencias completas y más de 32.000 sumarios, principalmente desde 2014; incluye STJ, cámaras civiles/comerciales, laborales, contencioso-administrativas y casación penal, además de tribunales de juicio. | Muy alto: diversidad de fueros e instancias, sumarios con voces y texto completo. | Buscador público, pero la interfaz observada incluye un campo de verificación. No automatizar sorteando ese control. Debe evaluarse una API oficial, convenio o cosecha autorizada. |
| **Formosa** (https://www.jusformosa.gob.ar/decisiones-judiciales/jurisprudencia) | Buscador de sumarios, fallos e interlocutorios; fallos novedosos y cuantificación de daños. El sitio publica además acuerdos y resoluciones. | Alto: civil, laboral, penal y criterios de cuantificación. | El portal oficial es indexable y está enlazado por Justicia.ar; el buscador requiere una prueba de interacción y paginación antes de desarrollar adaptador. |
| **Jujuy** (https://jurisprudencia.justiciajujuy.gov.ar/public/buscador?index=0) | Sentencias, fallos relevantes y acordadas, con filtros por órgano, fecha, expediente, voz y texto. | Alto: búsqueda por voz y frase exacta, con posibilidad de identificar fallos relevantes y perspectiva de género. | El propio portal advierte que no incluye cámaras y juzgados penales, tribunales de familia ni juzgados de menores. Esa exclusión debe mostrarse como zona ciega, no ocultarse. |
| **La Rioja** (https://tesauro.justicialarioja.gob.ar/tb_exped_list.php) | Portal de jurisprudencia enlazado desde el directorio oficial. | Medio-alto: jurisdicción hoy subrepresentada en el acervo automático. | Respondió 502 durante el sondeo; acceso manual y automatización pendientes de nueva prueba. |
| **Salta — Secretaría de Jurisprudencia** (https://www.justiciasalta.gov.ar/es/jurisprudencia-inicio) | Fallos completos y doctrina judicial desde 2001; Corte, cámaras civiles/comerciales y laborales, tribunales de impugnación y de juicio; novedades y boletines. | Muy alto: cobertura por fuero y material completo, con novedades y compilaciones temáticas. | Portal y buscador institucional visibles; candidato prioritario para un adaptador. |
| **Santa Cruz — TSJ** (https://jurisprudencia.jussantacruz.gob.ar/) | Buscador inteligente público enlazado desde el portal del Tribunal Superior. | Alto: amplía jurisprudencia patagónica con conexión directa al órgano judicial. | Se verificó el enlace oficial y la portada, pero no se validaron cobertura, API ni paginación. |
| **Tierra del Fuego** (https://juris.justierradelfuego.gov.ar/) | Portal oficial de jurisprudencia listado por Justicia.ar. | Alto como fuente territorial hoy ausente del buscador automático. | El portal sufrió timeout en el sondeo; mantener como enlace manual hasta que se pueda probar. |
| **Tucumán — Jurisprudencia y Legislación** (https://jurisprudencia.justucuman.gov.ar/) | Oficina de Jurisprudencia y Legislación que releva diariamente resoluciones definitivas e interlocutorias de la Corte, cámaras y tribunales de impugnación de todos los fueros y centros judiciales. | Muy alto: actualizaciones frecuentes y cobertura provincial amplia. | Portal institucional comprobado; candidato prioritario para un adaptador, pendiente de inspección de formulario y condiciones de acceso. |
| **Chaco** (https://www.justiciachaco.gov.ar/busquedas/Busqueda_Jurisprudencia/buscador/) | Buscador oficial enlazado desde Justicia.ar. | Alto como fuente provincial directa. | El portal respondió con timeout al sondeo externo. No tratar un fallo de red como resultado cero. |
| **SCBA — listado de sentencias** (https://sentencias-corte.scba.gov.ar/) | Buscador oficial de sentencias definitivas e interlocutorias de la Suprema Corte, con filtros por organismo, registro, fechas y texto. | Alto como complemento a JUBA: agrega otra vía para encontrar sentencias del máximo tribunal. | Página de consulta visible; no se probó el flujo de envío del formulario ni la extracción de documentos. No sustituye JUBA ni sus sumarios de cámaras. |
| **Neuquén — Civil, comercial, laboral, minería, familia y administrativo** (https://juriscivil.jusneuquen.gov.ar/) | Buscador oficial especializado por materias. | Alto: especialmente importante para minería, familia y laboral. | El portal está enlazado por Justicia.ar, pero devolvió timeout en el sondeo. |
| **Neuquén — Penal** (https://jurispenal.jusneuquen.gov.ar/) | Buscador oficial separado para jurisprudencia penal. | Alto: evita que la consulta penal dependa de una vista general de SAIJ. | El portal está enlazado por Justicia.ar, pero devolvió timeout en el sondeo. |

### Nuevas fuentes nacionales y especializadas en el catálogo

- **Tribunales federales y nacionales:** el directorio oficial de Justicia.ar enlaza el acceso institucional de la CSJN a fallos, sorteos y otras decisiones del Poder Judicial de la Nación: https://www.csjn.gov.ar/tribunales-federales-nacionales/inicio.html. Debe ser prioridad para ampliar la búsqueda más allá de la CSJN y SAIJ, en especial por la cobertura de cámaras y primera instancia.
- **Tribunal Fiscal de la Nación:** el portal reúne últimas sentencias, VUCE, boletín, sumarios y un buscador asistido por IA. Su propia página advierte que la carga de sentencias sigue en curso: https://www.argentina.gob.ar/tribunalfiscal/jurisprudencia.
- **Procuración del Tesoro:** el buscador de dictámenes es una fuente esencial de jurisprudencia administrativa: https://busquedadictamenes.ptn.gob.ar/. Los dictámenes son obligatorios para los servicios jurídicos que integran el Cuerpo de Abogados del Estado, no para todos los jueces ni litigantes.
- **CNDC:** la página oficial reúne buscador general de dictámenes y resoluciones, jurisprudencia temática, multas y remedios: https://www.argentina.gob.ar/defensadelacompetencia/buscadores.

### Qué significa este crecimiento

La sección Fuentes ahora tiene **125 enlaces**; siguen existiendo sólo doce conexiones documentales principales y seis vistas provinciales SAIJ en la búsqueda automática. La nueva lista aumenta las rutas verificables al material de cada jurisdicción, pero el producto debe seguir distinguiendo:

1. **Conector automático activo:** IvsCodex ejecuta y registra esa búsqueda.
2. **Cosecha local:** IvsCodex consulta su propio corpus, cuya cobertura y fecha de actualización deben mostrarse.
3. **Fuente oficial manual:** el usuario abre el buscador del organismo y realiza allí la consulta.
4. **Fuente no disponible o parcialmente accesible:** el portal está caído, bloqueado o sujeto a verificación; un error no equivale a cero jurisprudencia.

La siguiente fase técnica de mayor rendimiento es integrar primero Chubut, Salta y Tucumán, siempre que sus interfaces permitan consultas públicas reproducibles; luego Entre Ríos si existe un modo autorizado de resolver su control de verificación; y después Corrientes, Jujuy, SCBA directo y Formosa. La prioridad se basa en volumen, cobertura material, actualidad y posibilidad de obtener documentos oficiales, no sólo en la cantidad de enlaces.

## 6. Método de búsqueda jurídica recomendado

La búsqueda debe comportarse como un equipo de investigación con varias líneas paralelas y roles especializados. No hace falta inventar “abogados IA” que afirmen haber leído todo: hace falta que cada línea haga una pregunta distinta, devuelva evidencia y explique su método.

### 6.1. Líneas paralelas de investigación

1. **Normativa:** texto vigente, texto histórico, reformas, reglamentación, normas provinciales y régimen transitorio.
2. **Jurisprudencia superior:** tribunal máximo, plenario, doctrina legal, precedentes de seguimiento obligatorio según jurisdicción.
3. **Jurisprudencia de mérito:** cámaras, primera instancia, decisiones interlocutorias y medidas cautelares.
4. **Doctrina:** artículos, libros, comentarios, tesis, citas bibliográficas y posiciones en debate.
5. **Administrativa y regulatoria:** dictámenes, resoluciones, organismos de control, sanciones y procedimientos especiales.
6. **Constitucional y derechos humanos:** Constitución, tratados, Corte IDH, órganos de tratados ONU y estándares internacionales.
7. **Comparada e interdisciplinaria:** soluciones de otros países, derecho económico, tecnología, medicina legal, ambiente, datos, competencia y regulación.
8. **Procedimental:** competencia, legitimación, carga de la prueba, caducidad, prescripción, recursos, estándar de revisión, costas y ejecución.

Cada línea debe poder ampliar el mismo problema con vocabulario, fuente y estrategia distintos; todas deben converger en un informe único con enlaces y pasajes verificables.

### 6.2. Secuencia de expansión para cada consulta

- **Hechos:** extraer sujetos, conducta, daño, contexto, fecha, sector regulado y etapa procesal.
- **Instituciones jurídicas:** identificar las instituciones que aparecen, incluso si el usuario no conoce su nombre técnico.
- **Vocabulario:** probar sinónimos, denominaciones históricas, fórmulas de los tribunales, abreviaturas, variantes ortográficas y conceptos equivalentes en cada jurisdicción.
- **Normas:** recuperar artículos citados, artículos aplicados sin cita, normas complementarias, normas anteriores y disposiciones reglamentarias.
- **Conexiones:** abrir conceptos relacionados en una búsqueda separada. Ejemplos: responsabilidad civil y protección de datos; consumo y servicios financieros; ambiente y propiedad; prueba digital y debido proceso; salud laboral y discriminación; competencia y contratos; libertad sindical y servicios esenciales.
- **Procedimiento:** buscar por tipo de acción, recurso, medida cautelar, legitimación, carga probatoria y etapa de revisión.
- **Citas y red de precedentes:** rastrear fallos citados, fallos que citan al resultado, doctrina invocada y decisiones que distinguen o limitan el criterio.
- **Control temporal:** verificar vigencia normativa, fecha de la sentencia, reformas posteriores y decisiones más recientes que alteren o distingan el criterio.

### 6.3. Jerarquía conceptual que debe conservarse

- **Equivalente:** otra forma de nombrar sustancialmente la misma institución. Puede expandirse automáticamente, mostrando cuál forma recuperó el resultado.
- **Relacionado:** concepto cercano que abre una hipótesis o línea de investigación distinta. Debe ejecutarse por separado y explicar la relación. Nunca debe presentarse como sinónimo.
- **Norma relacionada:** disposición complementaria, reglamentaria, anterior o de otro régimen que puede ser útil. No implica que la sentencia la haya aplicado.
- **Cita expresa:** referencia textual verificable al artículo, caso o autor.
- **Aplicación material:** razonamiento que utiliza la institución sin necesariamente citar el artículo.
- **Distinción o abandono:** precedente que limita, distingue, revoca o deja de seguir un criterio anterior.

## 7. Informe de utilidad de resultados y fuentes

El informe de búsqueda no debe terminar en una cifra de resultados. Para cada fuente y consulta debería mostrar:

- Resultados recuperados, únicos y duplicados eliminados.
- Cuántos se encontraron por la consulta original, por cada equivalente y por cada línea relacionada.
- Cuántos incluyen texto completo, sumario, ficha, metadatos o sólo referencia externa.
- Cuántos incluyen pasaje resaltado y enlace oficial comprobable.
- Fecha más reciente y más antigua de los documentos recuperados.
- Cobertura conocida de tribunales, instancias y materias.
- Estado de la consulta: en vivo, copia local completa para el corpus conocido, copia parcial, error o fuente no consultada.
- Rendimiento marginal de cada fuente: qué documentos nuevos aportó que no aparecieron en las demás.
- Calidad de atribución: tribunal, sala, instancia, fecha, expediente, tipo de documento y procedencia.

### Medición real de expansión en el acervo de Mendoza

El workflow de GitHub Actions `Medir recuperación jurisprudencial Mendoza` ejecutó `compararCoberturaMendoza.mjs` sobre la versión del corpus `20261115-e2e49416`, con **38.572 registros revisados**. La comparación tomó la consulta primaria y la misma consulta con los equivalentes del tesauro:

| Consulta | Literal | Con equivalentes | Documentos adicionales | Aumento relativo |
|---|---:|---:|---:|---:|
| daño moral | 1.649 | 1.930 | +281 | +17,0 % |
| daño punitivo | 278 | 428 | +150 | +54,0 % |

La ejecución informó aproximadamente 220 ms para la primera consulta y 64 ms para la segunda con el acervo local ya preparado. Son tiempos de una corrida, no percentiles ni garantía de latencia. Los documentos adicionales son coincidencias del índice local deduplicadas por la consulta; no equivalen a una revisión humana de pertinencia.

El resultado justifica conservar la expansión automática de equivalentes en el acervo local. La siguiente medición debe calcular precisión@20 y recall sobre un conjunto de fallos revisados, y repetir el ensayo en fuentes provinciales distintas de Mendoza antes de extrapolar el porcentaje.

### Métricas que hacen posible mejorar de forma sistemática

| Métrica | Qué mide | Cómo usarla |
|---|---|---|
| Precisión@10 / @20 | Proporción de primeros resultados realmente pertinentes | Ajustar ranking, filtros y vocabulario |
| Recall@k sobre corpus de prueba | Cuántos documentos conocidos recupera el sistema | Detectar términos y fuentes que faltan |
| Rendimiento incremental por fuente | Fallos únicos aportados por una fuente | Mantener, ampliar o replantear adaptadores |
| Rendimiento por equivalente | Documentos nuevos recuperados por cada alias | Conservar alias útiles y retirar los redundantes |
| Tasa de duplicados | Repetición entre SAIJ y repositorios originales | Mejorar identidad de documentos y fusión |
| Cobertura por tribunal/instancia/materia/año | Zonas documentales con escasa presencia | Priorizar cosechas y nuevas conexiones |
| Tasa de pasaje verificable | Resultados con extracto y enlace al origen | Detectar fichas vacías y fallos de extracción |
| Latencia y tasa de error | Tiempo y disponibilidad por fuente | Afinar timeouts, circuit breakers y respaldo |
| Frescura | Antigüedad desde la última actualización del corpus | Decidir cuándo volver a cosechar |
| Tasa de contradicción | Resultados que distinguen o revierten un criterio previo | Evitar mostrar una doctrina como pacífica |

Para calcular precisión y recall se necesita un conjunto de consultas de referencia por rama con fallos revisados por personas. Sin ese conjunto, hablar de “mejoró 40 %” sería decoración estadística. El sistema debe registrar consultas, versiones del tesauro y resultados obtenidos sin almacenar datos sensibles de expedientes o usuarios más allá de lo necesario.

## 8. Plan de trabajo priorizado

### Fase 1 — Calidad de recuperación
- Integrar la corrección del acervo local de esta rama después de ejecutar pruebas.
- Extender las pruebas de equivalencias a todas las fuentes, filtros de año, provincias, modos y paginación.
- Incorporar un campo de procedencia por resultado: fuente primaria, agregador, doctrina, sumario, ficha o cosecha local.
- Mostrar avisos de cobertura parcial y última actualización en cada columna de fuente.

### Fase 2 — Nuevas fuentes prioritarias
- Probar la Secretaría de Jurisprudencia renovada de la CSJN.
- Integrar el buscador federal/nacional con decisiones de primera instancia.
- Estudiar la interfaz de Corrientes y comparar sus 48.358 fallos publicados con la vista SAIJ.
- Evaluar TFN, PTN y CNDC como adaptadores especializados.
- Mantener un registro de acceso, términos de uso, robots, límites, licencias y condiciones técnicas de cada portal.

### Fase 3 — Red de precedentes
- Extraer citas de sentencias y vincularlas con documentos ya existentes.
- Crear relaciones entrantes y salientes: “cita a”, “sigue”, “distingue”, “revoca”, “confirma”, “aplica”, “comenta”.
- Añadir vínculos a doctrina y normativa con tipo de relación explícito.
- Permitir búsquedas por patrón fáctico, problema procesal y consecuencia jurídica además del tema nominal.

### Fase 4 — Cobertura federal y comparada
- Usar el directorio de Justicia.ar para auditar uno por uno los portales judiciales provinciales.
- Priorizar integraciones directas donde la fuente oficial aporte texto o metadatos que SAIJ no tenga.
- Expandir internacionalmente con OHCHR JURIS, NORMLEX, HUDOC e InfoCuria como colecciones comparadas, claramente rotuladas por autoridad y jurisdicción.
- Revisar periódicamente el catálogo de 125 fuentes manuales para decidir cuáles merecen convertirse en integraciones reales.

## 9. Cambios realizados en esta rama

- La expansión FTS5 del acervo local admite equivalentes en todas las fuentes, no sólo Mendoza.
- La búsqueda local por índice y el respaldo de registros guardados conservan los equivalentes y deduplican los documentos recuperados por varias formas.
- La ruta local transmite las variantes del tesauro para cualquier fuente.
- Los conceptos relacionados abren una consulta diferenciada y el mensaje ya no los llama sinónimos.
- Se agregaron pruebas de regresión para equivalentes que sólo aparecen en el texto de otra fuente y para la acción diferenciada de conceptos relacionados.
- Se ampliaron las fuentes manuales de 106 a 125, incorporando portales judiciales provinciales y fuentes nacionales especializadas. Una prueba ahora impide ids duplicados y etiquetas de materia ajenas a las ramas existentes.
- Se corrigió el manifiesto del respaldo: SCBA tenía 8.565 registros en el archivo, pero conteos.json declaraba 7.148; la prueba de integridad del respaldo pasó luego de actualizar el dato.
- Se actualizaron comentarios que describían de forma desactualizada la fuente CSJN y la distinción entre repositorios, doctrina y colecciones editoriales.

**Rama:** audit/expansion-local-corpus-2026  
**Estado de validación:** GitHub Actions ejecutó la suite completa con Node 24: **144 pruebas aprobadas, 0 fallidas**. La prueba nueva del catálogo comprueba 125 identificadores únicos y etiquetas de materia válidas para las 28 ramas. También finalizaron correctamente las verificaciones especializadas de seguridad, búsqueda, tesauro, cursor, cobertura FTS, concurrencia SQLite y respaldo. No se realizó despliegue.

## 10. Fuentes de verificación

Consultadas el 17 de noviembre de 2026, salvo donde se indica fecha de publicación:

- SAIJ, descripción oficial del alcance de la base: https://www.argentina.gob.ar/justicia/saij/buscar-informacion-juridica
- Justicia.ar, directorio de jurisprudencia: https://www.justicia.ar/herramientas/sentencias
- CSJN, ampliación del buscador federal y nacional a primera instancia, 5 de septiembre de 2025: https://www.csjn.gob.ar/novedades/detalle/10964
- Secretaría de Jurisprudencia CSJN: https://sjservicios.csjn.gov.ar/sj/
- Poder Judicial de Corrientes, nuevo sistema, 28 de agosto de 2026: https://www.justicia.ar/novedades/5374/2026/08/el-poder-judicial-presenta-un-nuevo-sistema-de-busqueda-de-jurisprudencia
- Tribunal Fiscal de la Nación: https://www.argentina.gob.ar/tribunalfiscal/jurisprudencia
- Procuración del Tesoro, buscador de dictámenes y explicación de su alcance: https://www.argentina.gob.ar/node/213854
- CNDC, buscadores de dictámenes, resoluciones, jurisprudencia y sanciones: https://www.argentina.gob.ar/defensadelacompetencia/buscadores
- OIT, compilación del Comité de Libertad Sindical: https://www.ilo.org/dyn/normlex/en/f?p=NORMLEXPUB:70001:0::NO:::
- OHCHR JURIS: https://juris.ohchr.org/
- TEDH, HUDOC: https://www.echr.coe.int/en/hudoc-database
- Tribunal de Justicia de la Unión Europea, InfoCuria: https://infocuria.curia.europa.eu/

---
Este informe es una auditoría de fuentes públicas y del código disponible en el repositorio. No sustituye la revisión profesional de una causa concreta ni certifica que el repositorio contenga todas las decisiones existentes.
