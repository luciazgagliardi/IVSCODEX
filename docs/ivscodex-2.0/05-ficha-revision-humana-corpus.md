# IVS Codex 2.0 — Ficha de revisión jurídica del corpus de recuperación

**Versión de ficha:** 1.0  
**Uso:** revisión independiente de documentos y etiquetas antes de habilitarlos como referencia gold.

> Una coincidencia léxica, un sumario editorial o una respuesta HTTP correcta no constituyen validación jurídica. No aprobar una etiqueta sin poder explicar por qué el documento responde —o no responde— a la consulta.

---

## A. Identificación del documento

| Campo | Registro |
|---|---|
| ID estable del corpus | |
| Jurisdicción | |
| Tribunal / organismo | |
| Sala / fuero / instancia | |
| Tipo documental | Sentencia íntegra / resolución interlocutoria / dictamen / sumario / otro |
| Fecha de la decisión | |
| Fecha de publicación | |
| Expediente / CUIJ / número de causa | |
| Carátula literal | |
| Registro / actuación / identificador del organismo | |
| Fixture local (si existe) | |
| Hash SHA-256 del texto verificado | |

## B. Procedencia y autoridad

**Clasificación de la fuente (marcar una):**

- [ ] Fuente primaria: documento publicado por el tribunal u organismo emisor.
- [ ] Repositorio o catálogo oficial: acredita existencia/localización, pero no es el texto individual.
- [ ] Agregador institucional oficial.
- [ ] Repositorio académico o institucional secundario.
- [ ] Editorial / proveedor privado.
- [ ] Fuente desconocida o no comprobable.

| Campo | Registro |
|---|---|
| URL exacta consultada | |
| Fecha y hora de verificación | |
| ¿Abre sin autenticación o desafío? | |
| Identificador que entrega la fuente | |
| ¿El identificador coincide con el expediente del documento? | |
| ¿Se verificó tribunal, carátula y fecha en la fuente? | |
| ¿El texto es íntegro o parcial? | |
| Páginas, votos o anexos faltantes | |
| Restricciones de acceso / licencia conocidas | |
| Evidencia de procedencia (enlace, captura, metadatos o registro) | |

**Decisión de procedencia:**

- [ ] Verificada como fuente primaria.
- [ ] Verificada sólo como localizador oficial o compilación.
- [ ] Identidad plausible, fuente directa pendiente.
- [ ] No coincide / documento equivocado.
- [ ] No verificable.

**Motivo obligatorio:**  
...

## C. Control de integridad del texto

Comprobar y registrar:

- [ ] Encabezado, carátula y expediente coinciden con la fuente.
- [ ] Tribunal, jurisdicción y fecha coinciden.
- [ ] Se conserva la parte resolutiva.
- [ ] Se conservan fundamentos y votos relevantes.
- [ ] Se conservan disidencias y adhesiones cuando existan.
- [ ] No hay páginas omitidas ni mezcla de dos documentos.
- [ ] OCR / extracción no altera negaciones, cifras, artículos o nombres de normas.
- [ ] Firma digital / registro verificado cuando la fuente lo ofrece.

**Errores de extracción encontrados y corrección propuesta:**  
...

## D. Revisión de cada consulta asociada

Repetir este bloque para cada consulta del corpus.

### Consulta

| Campo | Registro |
|---|---|
| ID de consulta | |
| Consulta exacta | |
| Variante evaluada | |
| Filtros explícitos | |
| Problema jurídico que busca resolver | |
| Hechos jurídicamente relevantes | |
| Institución / norma / pretensión central | |

### Clasificación del documento respecto de la consulta

Elegir sólo una:

- [ ] **POSITIVO:** trata la cuestión jurídica central o una cuestión sustancialmente pertinente.
- [ ] **NEGATIVO DIFÍCIL:** comparte vocabulario, partes o contexto, pero resuelve una cuestión diferente.
- [ ] **NEGATIVO POR FILTRO:** queda excluido por una jurisdicción, tribunal, período o tipo documental expresamente solicitado.
- [ ] **PARCIAL / CONTEXTUAL:** aporta antecedentes, cita la figura o trata un aspecto conexo, pero no satisface la consulta principal.
- [ ] **AMBIGUO:** los hechos o la consulta no permiten una clasificación confiable.
- [ ] **DUPLICADO:** mismo documento que otro registro, con identificador o fuente diferente.

**Fundamento jurídico de la clasificación:**  
...

**Pasajes exactos que sostienen la clasificación:**

| Página / considerando / voto | Pasaje o ancla | Qué demuestra |
|---|---|---|
| | | |
| | | |

**Motivo de exclusión (obligatorio para negativos):**  
Debe explicar la diferencia de hechos, pretensión, institución jurídica, ratio decidendi, jurisdicción o filtro. No alcanza con decir «no es relevante» ni con señalar que falta una palabra.

## E. Evaluación de pertinencia

Puntuar cada dimensión de 0 a 2:

| Dimensión | 0 | 1 | 2 | Puntaje |
|---|---|---|---|---:|
| Coincidencia de hechos | No coincide | Coincidencia parcial | Hechos centrales coinciden | |
| Institución jurídica | Distinta | Conexa | Es la cuestión central | |
| Pretensión / remedio | Distinto | Parcial | Coincide | |
| Ratio decidendi | No la trata | La menciona o contextualiza | La resuelve / interpreta | |
| Jurisdicción y tribunal | Contradice el filtro | No especificado | Coincide | |

**La puntuación no decide automáticamente la etiqueta.** La clasificación y su fundamento prevalecen. Una sentencia puede mencionar una figura muchas veces y aun así no ser pertinente.

## F. Revisión independiente

| Campo | Revisor/a 1 | Revisor/a 2 |
|---|---|---|
| Nombre o identificador profesional | | |
| Especialidad relevante | | |
| Fecha de revisión | | |
| Clasificación | | |
| Fundamento suficiente | Sí / No | Sí / No |
| Procedencia verificada | Sí / No | Sí / No |
| Conflicto o reserva | | |

**¿Hay desacuerdo?** Sí / No

**Resolución del desacuerdo / tercer revisor:**  
...

## G. Decisión de elegibilidad

Un caso sólo puede habilitarse para métricas cuando se cumplen todas las condiciones:

- [ ] Fuente primaria verificada, o el caso está etiquetado explícitamente como prueba de localización y no como gold documental.
- [ ] Identidad, integridad y metadatos coinciden.
- [ ] Consulta y filtros están definidos sin ambigüedad material.
- [ ] Cada positivo tiene pasajes que demuestran pertinencia.
- [ ] Cada negativo tiene un motivo concreto y comprobable.
- [ ] Dos revisiones independientes coinciden, o un tercer revisor resolvió el desacuerdo.
- [ ] Se guardó esta ficha y la versión del corpus a la que corresponde.

**Resultado:**

- [ ] APTO PARA MÉTRICAS.
- [ ] APTO SÓLO PARA PRUEBAS DE PROCEDENCIA / EXTRACCIÓN.
- [ ] PENDIENTE DE FUENTE.
- [ ] PENDIENTE DE REVISIÓN.
- [ ] RECHAZADO / IDENTIDAD INCORRECTA.

**Restricciones y observaciones finales:**  
...

---

## H. Datos de reproducibilidad de la evaluación del buscador

Completar sólo después de la aprobación jurídica.

| Campo | Registro |
|---|---|
| Commit de IVS Codex 2.0 | |
| Versión / manifiesto del acervo aislado | |
| Índice utilizado | |
| Fecha y hora de ejecución | |
| Consulta exacta enviada | |
| Filtros y modo de búsqueda | |
| Ranking / posición del documento | |
| Resultado del buscador | Recuperado / omitido / recuperado incorrectamente |
| Evidencia del resultado | |
| Incidencia registrada | |

**No ejecutar contra producción como parte de esta ficha.** La evaluación del buscador debe realizarse en un entorno aislado y reproducible.
