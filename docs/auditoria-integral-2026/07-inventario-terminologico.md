# 7. Inventario terminológico

**Archivo estructurado:** `backend/datos/vocabulario/inventario.json`. Lo genera `ops/vocabulario/construir-inventario.mjs` de forma reproducible.
**Código de consulta:** `backend/lib/vocabulario.js`. Lo expone `GET /api/vocabulario/analizar?q=` y `GET /api/vocabulario/procedencia`.
**Pruebas:** `backend/test/vocabulario.prueba.js`.

## 7.1 Por qué no se generó una lista con un modelo de lenguaje

Pediste un sistema terminológico construido con investigación documental, no una lista improvisada. Por eso el inventario parte de los vocabularios con que los propios sistemas oficiales **indexan** sus documentos.

| Fuente | Organismo | Qué aporta | Licencia o condición |
|---|---|---|---|
| Tesauro SAIJ de Derecho Argentino | SAIJ, Ministerio de Justicia y Derechos Humanos | 15.116 conceptos con descriptor preferido, 6.581 términos no preferidos, jerarquía (amplio/específico), 2.287 relaciones asociativas y 27 ramas temáticas | CC-BY 4.0, [datos.jus.gob.ar](https://datos.jus.gob.ar/dataset/tesauro-saij-de-derecho-argentino). Se atribuye en la interfaz y en `procedencia`. |
| Tesauro de jurisprudencia del Poder Judicial de Mendoza | Biblioteca de jurisprudencia de la SCJM | 28.501 voces con que la SCJM y las Cámaras (CC y CT) indexan sus sumarios | Consulta pública del formulario oficial (`funciones/tesauro.php`): una petición por letra, con 2 s entre peticiones. |
| Anillos curados de IVS CODEX | — | 40 conceptos con 77 equivalencias medidas en vivo antes de entrar | `frontend/index.html` (`var TESAURO`) |
| Relaciones normativas | — | 31 relaciones, cada una con su norma: reformas del CCyC, Ley 25.087, Ley 26.425, Decreto 953/2024, Ley 9001 de Mendoza, figuras que se confunden y conceptos contrapuestos | `ops/vocabulario/relaciones-historicas.json` |

**Validación cruzada:** el 93 % de los descriptores SAIJ (14.055) coincide con una voz del tesauro de Mendoza. Mendoza indexa con el vocabulario de SAIJ, y por eso un descriptor SAIJ es, en la práctica, también el descriptor del tribunal mendocino.

**Complementariedad:** de las 77 equivalencias curadas, solo 10 figuran también en SAIJ. «Consecuencias no patrimoniales», por ejemplo, no está en el tesauro oficial. Las dos capas se necesitan.

## 7.2 Magnitud

| Indicador | Objetivo del encargo | Logrado | Observación |
|---|---|---|---|
| Conceptos canónicos | ≥ 3.000 | **15.116** descriptores oficiales SAIJ, más 40 anillos y 31 nodos normativos | Ninguno es inventado. |
| Variantes y expresiones de búsqueda | ≥ 20.000 | **32.707** expresiones distintas reconocibles (descriptores, no preferidos, siglas y voces SCJM) | 14.436 voces de Mendoza no tienen correspondencia en SAIJ. |
| Relaciones tipadas | — | **39.223**, cada una con tipo, estado, fuente, evidencia y política | Ver 7.4. |
| Relaciones con verificación semántica | — | 266 | Es la cifra honesta de lo que puede expandirse solo. |

**Lo que todavía falta.** El encargo pide incluir lenguaje común y expresiones coloquiales. Hoy hay una sola («trabajo en negro»). Las fuentes oficiales no las contienen, y generarlas con un modelo violaría la regla del encargo. En el informe de pendientes (`10-pendientes.md`) se proponen fuentes legítimas: categorías de reclamos de los datasets oficiales de defensa del consumidor, motivos de consulta de organismos y glosarios institucionales.

## 7.3 Modelo de relaciones

Cada relación guarda: concepto principal, término relacionado, tipo, rama y subrama (por concepto), jurisdicción (en las normativas), período de validez (`vigenciaTermino`), fuente, evidencia, estado y política de expansión.

**Tipos:** `equivalencia_conceptual`, `equivalencia_historica`, `equivalencia_ortografica`, `variacion_morfologica`, `sigla`, `denominacion_extendida`, `descriptor_no_preferido`, `variante_oculta`, `concepto_mas_amplio`, `concepto_mas_especifico`, `concepto_relacionado`, `concepto_contrapuesto`, `figura_que_se_confunde`, `expresion_coloquial`.

**Estados:**
- `verificada`: identidad léxica, medición en vivo o norma expresa.
- `verificada_en_fuente`: la relación existe en el tesauro oficial, pero eso no implica sinonimia.
- `propuesta`: pendiente de revisión jurídica.
- `controvertida` y `rechazada`: reservados para la revisión.

**Políticas:**
- `expandir`: se suma sola a la búsqueda. Solo procede si la relación está `verificada`, y una prueba lo controla sobre todo el inventario.
- `sugerir`: se ofrece como línea de investigación rotulada.
- `no_expandir`: se muestra con advertencia.

### Por qué los términos no preferidos de SAIJ no se expanden solos

SAIJ cuelga del mismo descriptor términos que no son sinónimos. Lo comprobé con una muestra:

| Descriptor SAIJ | Término no preferido | Relación real |
|---|---|---|
| asesinato | homicidio por precio o promesa remuneratoria | especie, no sinónimo |
| derecho a la privacidad | principio de reserva de ley | concepto distinto |
| habeas data | protección de datos personales | relacionado |
| plan de parentalidad | régimen de visitas, régimen de comunicación | no equivalentes |
| cuidado personal compartido | cuidado personal | el género bajo la especie |
| daño moral (jerarquía) | daños punitivos como término específico | multa civil, no rubro resarcitorio (art. 52 bis, Ley 24.240) |

Por eso cada término no preferido se clasifica en forma automática:
- Identidad ortográfica o morfológica: se expande.
- Sigla: se sugiere.
- Una denominación contenida en otra: se sugiere, «puede ser una especie».
- Resto: «descriptor no preferido, alcance por revisar».

| Tipo | Cantidad | Política |
|---|---|---|
| concepto_mas_amplio / concepto_mas_especifico | 15.086 / 15.086 | sugerir |
| descriptor_no_preferido | 5.125 | sugerir |
| concepto_relacionado | 2.357 | sugerir |
| denominacion_extendida | 1.171 | sugerir |
| sigla | 193 | sugerir |
| variacion_morfologica / equivalencia_ortografica | 82 / 10 | expandir |
| equivalencia_conceptual (anillos medidos) | 77 | expandir |
| equivalencia_historica | 24 | caso por caso: «tenencia → cuidado personal» se expande; «concubinato → unión convivencial» no, porque el art. 510 CCyC exige requisitos |
| figura_que_se_confunde / concepto_contrapuesto | 3 / 3 | no_expandir |

## 7.4 Cobertura por rama (conceptos SAIJ asignados por reglas sobre la jerarquía oficial)

La rama se asigna por el ancestro más cercano que tenga regla (`REGLAS_RAMA` en el constructor). Por ejemplo, «libertad condicional» cuelga en SAIJ de *ejecución de la pena < … < Derecho procesal* y se asigna a Ejecución penal.

| Rama IVS | Conceptos | Con voz SCJM | Variantes | Relacionados |
|---|---|---|---|---|
| Procesal civil | 1.624 | 1.585 | 1.051 | 287 |
| Obligaciones y contratos (civil general) | 1.324 | 1.259 | 591 | 249 |
| Penal | 1.200 | 1.156 | 600 | 261 |
| Comercial | 1.149 | 1.099 | 405 | 169 |
| Administrativo | 1.134 | 974 | 435 | 152 |
| Laboral individual | 918 | 872 | 509 | 141 |
| Tributario | 681 | 658 | 296 | 82 |
| Derechos humanos e internacional público | 630 | 453 | 196 | 65 |
| Constitucional | 568 | 521 | 299 | 91 |
| Daños | 414 | 403 | 221 | 74 |
| Reales | 346 | 339 | 126 | 40 |
| Previsional | 299 | 288 | 159 | 45 |
| Procesal penal | 262 | 252 | 116 | 65 |
| Familia | 255 | 239 | 122 | 44 |
| Ambiental | 254 | 238 | 78 | 35 |
| Aguas, minería y energía | 210 | 201 | 69 | 19 |
| Propiedad intelectual y datos | 200 | 172 | 64 | 21 |
| Concursos | 191 | 191 | 46 | 31 |
| Electoral | 172 | 167 | 54 | 10 |
| Sucesiones | 120 | 119 | 35 | 8 |
| Seguros | 104 | 103 | 19 | 16 |
| Colectivo | 92 | 92 | 43 | 6 |
| **Riesgos del trabajo** | **71** | 67 | 42 | 29 |
| **Consumidor** | **60** | 51 | 25 | 20 |
| **Internacional privado** | **31** | 28 | 14 | 5 |
| **Ejecución penal** | **26** | 26 | 3 | 0 |
| **Género** | **17** | 12 | 7 | 6 |
| **Niñez y adolescencia** | **10** | 10 | 17 | 4 |

**Especialidades sin rama en IVS CODEX, con vocabulario oficial disponible:** Cultura y educación (561), Salud pública (468), Actividades económicas, incluida la vitivinicultura (463), Defensa y seguridad (345), Transporte (329), Navegación (170), Comunicaciones (167), Aeronáutico (140), Bienestar social (101).

**Lectura jurídica:** las ramas más débiles en el vocabulario oficial (niñez, género, consumidor, riesgos del trabajo, ejecución penal) son justamente aquellas cuya terminología cambió más con las reformas recientes: Ley 26.061, Ley 26.485, el CCyC y el régimen de comisiones médicas. El tesauro SAIJ (última modificación 2020-09-18) no las acompaña. Esas ramas necesitan anillos curados propios. Las propuestas validadas están en `datos/anillos-propuestos.json`.

## 7.5 Cómo se usa en la búsqueda

1. Mientras se escribe, el frontend pide `/api/vocabulario/analizar` con un retardo de 320 ms y nunca bloquea la búsqueda.
2. El analizador reconoce el tramo más largo de la consulta que coincide con un término (hasta 10 palabras, tolerando singular y plural) y fusiona por concepto canónico el anillo, la norma y el descriptor SAIJ. Si el mismo tramo admite conceptos distintos, los devuelve separados: «tenencia» → cuidado personal **y** tenencia simple (estupefacientes). La ambigüedad queda a la vista.
3. Arma las variantes reemplazando solo el tramo reconocido por cada forma verificada y conserva el resto de lo escrito («Usucapión de un lote» → «prescripción adquisitiva de un lote»). Se envían como `variantes` a las fuentes, igual que los anillos.
4. El panel **Líneas de investigación** muestra, rotulados, el descriptor oficial, las denominaciones por revisar, los conceptos más amplios y más específicos, los relacionados («no son sinónimos»), las relaciones antes y después de una reforma con su norma, las figuras que se confunden y las voces del tesauro de Mendoza.

## 7.6 Limitaciones

- La asignación de ramas sigue reglas sobre la jerarquía SAIJ: puede equivocarse en conceptos con varios padres. Las correcciones detectadas están en `datos/correcciones-inventario.json`.
- Una relación `verificada_en_fuente` **no** está revisada jurídicamente. La revisión por especialistas es un pendiente explícito.
- El tesauro SAIJ no se actualiza desde 2020. El constructor registra el `sha256` y la fecha de modificación de la descarga para detectar versiones nuevas.
- El vocabulario de Mendoza se obtuvo por prefijo de una letra. Si el portal limitara la cantidad de respuestas por prefijo, faltarían voces. La letra con más voces devolvió 2.581 y no se observó un tope fijo, pero no se puede asegurar que no exista.
