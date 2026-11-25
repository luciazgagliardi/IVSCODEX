# IVS Codex 2.0 — Protocolo del corpus de recuperación documental

**Versión:** 1.2.0 (corpus ampliado + índice local, deduplicación y filtros de tribunal)  
**Fecha:** 25/11/2026  
**Datos:** [04-corpus-recuperacion-v1.json](./04-corpus-recuperacion-v1.json)

## 1. Para qué sirve

Este corpus evalúa si una consulta recupera documentos jurídicos pertinentes y excluye documentos que no responden al problema planteado. Es una batería distinta de:

- los 280 casos de vocabulario, que comprueban reconocimiento terminológico;
- las 371 preguntas de diagnóstico, que comprueban formulaciones e inventario;
- las pruebas unitarias de transporte, paginación, deduplicación y errores.

Una consulta reconocida no implica que se haya recuperado una sentencia correcta. Una conexión exitosa tampoco demuestra pertinencia jurídica.

## 2. Lote piloto incorporado

La primera tanda v1.1.5 contenía **3 documentos gold provisionales, 3 consultas, 3 positivos, 6 negativos y 4 fixtures pendientes**; la ampliación v1.2.0 incorpora cinco sentencias oficiales adicionales. El conjunto actual contiene **8 documentos, 8 consultas, 8 positivos y 56 negativos**:

| Documento | Jurisdicción / tribunal | Materia preliminar | Fuente y situación |
|---|---|---|---|
| Río Uruguay c/ Campos, González y Villarreal (08/05/2026) | Mendoza / SCJM | Daños por accidente de tránsito, incapacidad, seguros | Fixture completo. El LEAME declara host e identificador; la ruta se ajusta al patrón exigido por la prueba existente. El endpoint no fue reabierto desde este entorno. |
| Berro c/ Banco BBVA (12/08/2026) | Mendoza / SCJM | Despido y alegación de discriminación | Fixture completo con carátula, CUIJ y fecha; falta localizar y comprobar el enlace oficial directo. |
| Rozen Frejda (02/07/2003) | CABA / TSJ | Expropiación inversa y retrocesión | Fixture completo con expediente y carátula; falta localizar y comprobar el enlace oficial directo. |

Las etiquetas son **preliminares**, no un dictamen jurídico. Los tres documentos iniciales eran fixtures existentes en `backend/test/fallos/`; la versión v1.2.0 incorpora cinco sentencias íntegras nuevas con sus fixtures y enlaces primarios individuales.

Además se inventariaron **4 fixtures adicionales** en `candidatosPendientesFuente`. Son textos que ya existen en el repositorio, pero todavía no se incluyen como documentos gold ni como positivos/negativos porque falta confirmar sus localizadores oficiales. El registro Caja de Seguros/Burgos no debe confundirse con Caja de Seguros/Zerpa: son causas distintas. 

### 2.1 Cola de fixtures pendientes de fuente primaria

Se identificaron otros cuatro textos completos existentes en `backend/test/fallos/`:

| Fixture | Identificador | Tema preliminar | Estado |
|---|---|---|---|
| `tsj-caja-de-seguros.txt` | TSJ 220909/2025-0 | Caja de Seguros c/ Burgos y Perfumo; daños de tránsito; efecto suspensivo | Fuente primaria pendiente; no confundir con Caja de Seguros c/ Zerpa |
| `tsj-distribuidora-pompeya.txt` | TSJ 44430/2025-0 | Despido, jubilación y continuidad del vínculo laboral | El Boletín oficial TSJ noviembre 2025 confirma carátula, expediente SAL 44430/25-0 y fecha 05/11/2025 (p. impresa 6); es un sumario, no la sentencia íntegra. URL individual pendiente |
| `tsj-federacion-patronal-firma-digital.txt` | TSJ 356291/2025-0 | Daños de tránsito, aseguradora y recurso extraordinario federal | El fixture registra firma digital del 09/09/2026 y Registro 3076/2026; no se toma como fecha judicial validada. Falta el localizador oficial |
| `tsj-lopez-viviana.txt` | QTS 36249/2018-3 y 36249/2018-4 | Empleo público, cesantía y revisión judicial | Fuente primaria pendiente; fecha final no confirmada |

Estos candidatos quedan fuera de `documentos`, de las etiquetas gold y de toda métrica hasta comprobar su correspondencia con una fuente primaria. La fecha no se completa con una fecha de actuación ni con una referencia secundaria. Para Federación Patronal/GEY, la marca horaria de la firma digital del fixture se conserva en `fechaObservadaEnFixture`, pero `fecha` permanece nula hasta cotejar la fuente primaria. Para Pompeya, la fecha 05/11/2025 sí se consigna porque aparece en el boletín oficial, aunque la sentencia íntegra siga pendiente.


#### Comprobación oficial adicional: Distribuidora Pompeya

El Boletín de Jurisprudencia del TSJ CABA de noviembre de 2025 identifica la causa «Distribuidora Pompeya SRL s/ queja ... en Goncalo, Stella Maris c/ Distribuidora Pompeya S.R.L. y otros s/ despido», expediente SAL 44430/25-0, con fecha de sentencia 05/11/2025. La entrada aparece en la página impresa 6.  
Fuente oficial: https://www.tsjbaires.gob.ar/repositorio/indicesboletines/2025/2025_11_Boletin_indice.pdf

El propio Tribunal explica que sus boletines reúnen sumarios preparados por la Secretaría y que estos no forman parte de la sentencia; la sección «Novedades» normalmente incluye un hipervínculo al texto completo. Por ello el corpus registra este PDF como **localizador oficial de resumen**, conserva `officialUrl: null` para la sentencia individual y deja el candidato fuera del conjunto gold hasta obtener y cotejar el documento íntegro.

### Referencia de control: sumario oficial de Distribuidora Pompeya

El boletín oficial del TSJ CABA de noviembre de 2025 identifica el expediente SAL 44430/25-0 y la fecha 05/11/2025 en sus páginas impresas 5–6. Sus páginas 2 y 4 aclaran que los sumarios son elaborados por la Secretaría, no forman parte de las sentencias y no expresan opinión jurisdiccional.

Fuente oficial: https://www.tsjbaires.gob.ar/repositorio/indicesboletines/2025/2025_11_Boletin_indice.pdf

El corpus conserva esta entrada en `referenciasOficialesNoGold`, separada del documento individual. Sirve para búsquedas de sumarios oficiales; no satisface filtros «sólo sentencias», no reemplaza el texto íntegro y no integra el conjunto gold. El portal institucional identifica un buscador público de sentencias completas desde 1998, recuperables por parámetros como carátula, fecha y Secretaría: https://www.tsjbaires.gob.ar/servicios/jurisprudencia/buscador-de-sentencias. El enlace individual de Pompeya sigue pendiente de extracción y cotejo.

### 2.2 Lote documental oficial de Mendoza v1.2.0

Se incorporan cinco sentencias íntegras del respaldo oficial del Poder Judicial de Mendoza, cada una con enlace individual `vertexto.php?ide=...`, carátula, tribunal, fecha, CUIJ y fixture de texto completo:

| Documento | Tribunal / fecha | Materia |
|---|---|---|
| Godoy c/ Hospital Lagomaggiore | Primera Cámara del Trabajo, 18/09/2026 | Amparo sindical, tutela y restitución de haberes |
| Municipalidad de Mendoza en J° Ureta | Suprema Corte, 19/08/2026 | Responsabilidad estatal, falta de servicio, vereda y Ley 8968 |
| Codina en J° González Barberis c/ Ojeda Romero | Suprema Corte, 12/08/2026 | Base regulatoria de honorarios en alimentos definitivos, Ley 9131 |
| Baldoni c/ Estilo Artesanal, Mercado Libre y Via Cargo | Segunda Cámara Civil, 10/06/2026 | Consumo, contratación electrónica, transporte y daño punitivo |
| Garay Lira c/ Chevrolet y La Segunda | Tercera Cámara Civil, 15/09/2026 | Plan de ahorro, seguro, restitución de cuotas y privación de uso |

El lote pasa de 3 a **8 documentos**, de 3 a **8 consultas**, con **8 positivos y 56 exclusiones**. Cada consulta etiqueta los otros siete documentos como negativos; Baldoni y Garay funcionan además como negativos difíciles recíprocos dentro del mismo campo del consumo, pero con contratos y pretensiones distintos.

La suite verifica que el filtro estricto devuelva exactamente el documento positivo de cada consulta y que `buscarEnIndice` reproduzca el mismo conjunto en un índice temporal. Estos registros tienen fuentes oficiales y texto completo, pero sus etiquetas todavía requieren revisión jurídica humana; por tanto, los ocho casos siguen fuera de métricas oficiales de producto.

## 3. Cómo se etiqueta

Cada consulta incluye texto exacto y variantes, clase de consulta, filtros de jurisdicción/tribunal/tipo documental, positivos con anclas textuales y negativos con motivo concreto.

Los negativos se separan en:
- **hard negatives:** documentos del mismo tribunal/jurisdicción que tratan otra cuestión jurídica;
- **negativos por filtro:** documentos de otra jurisdicción o tribunal que no deben cruzar un filtro explícito.

La mera ausencia de una palabra no basta para convertir un documento en negativo. Cada exclusión debe justificar la diferencia de hechos, pretensión, institución o jurisdicción.

## 4. Procedencia y límites de la v1

### Río Uruguay

El fixture `scjm-rio-uruguay-2026-05-08.txt` contiene el texto íntegro utilizado por las pruebas de análisis de fallos. `backend/test/fallos/LEAME.md` identifica como origen el portal del Poder Judicial de Mendoza, host `wwwnoti.jus.mendoza.gov.ar`, con `ide=12010568712`. La prueba `backend/test/mendozaOficial.prueba.js` valida para enlaces oficiales de esa colección el patrón `/listas/proveidos/vertexto.php?ide=...` y admite el host `wwwnoti`. Por eso el corpus conserva el enlace formado a partir de ambos datos. **La URL no pudo ser reabierta desde el entorno de auditoría y no se declara disponibilidad en vivo.**

Como corroboración independiente de la identificación y fecha del precedente, un pronunciamiento posterior publicado en el portal oficial de Mendoza cita la causa SCJM 13-07241584-6/1, Río Uruguay c/ Campos, González y Villarreal, del 08/05/2026:  
https://www2.jus.mendoza.gov.ar/listas/proveidos/vertexto.php?ide=12151953977

### Rozen Frejda

El PDF oficial del TSJ CABA, *Constitución y Justicia: Fallos del Tribunal Superior de Justicia de la Ciudad de Buenos Aires*, tomo V (2003), identifica el caso en el índice general XVIII, entrada LVII: «Rozen Frejda s/queja por recurso de inconstitucionalidad denegado en: “Rozen Frejda c/GCBA s/expropiación inversa. Retrocesión”». El índice asocia el expediente 2183/03, fecha 2/7/2003 y páginas impresas 418–419.  
Fuente oficial: https://tsjcaba.opac.ar/pgmedia/Media/PDFs/1.5740_D-05998.%20Fallos%20TSJ%20CABA%202003.pdf

El localizador apunta a la compilación oficial y su índice; no se declara que exista o se haya encontrado una ficha individual. La coincidencia de expediente, carátula y fecha con el fixture está documentada.

### Berro

El fixture conserva el texto completo, CUIJ 13-07662606-9/1, carátula, tribunal y fecha. Se encontraron referencias secundarias con esos datos, pero no un enlace oficial directo comprobable. No se infiere el parámetro `ide` a partir del número de actuación, la firma digital ni un identificador interno.

## 5. Puerta de elegibilidad

En la versión actual, **0 de 8 casos son aptos para calcular métricas**. Un caso pasa a ser elegible únicamente cuando:

1. se abre y verifica el enlace de la fuente primaria;
2. se confirma que el documento coincide con texto, carátula, tribunal, jurisdicción y fecha;
3. una persona con criterio jurídico revisa positivos, negativos y motivos;
4. se registra quién revisó, cuándo y qué versión del corpus aprobó;
5. la ejecución se realiza sobre un entorno aislado y conserva commit, versión del acervo y parámetros.

Hasta entonces, no publicar precisión@k, recall@k, exhaustividad ni rankings derivados de este piloto.

## 6. Cómo ampliarlo

No se debe ampliar por cantidad bruta. Para cada nuevo caso:
1. localizar el documento en la fuente primaria oficial;
2. conservar el enlace directo y el identificador del organismo;
3. guardar el texto íntegro sólo cuando la publicación y las condiciones de acceso lo permitan;
4. registrar jurisdicción, tribunal, tipo documental y fecha;
5. formular la consulta como la haría un abogado;
6. anotar positivos por pertinencia demostrable y negativos con motivo;
7. agregar anclas textuales para la revisión automática de integridad;
8. dejar el caso fuera de métricas hasta su revisión humana.

Una ficha SAIJ, un sumario editorial y una sentencia del tribunal no se etiquetan como el mismo documento ni se atribuyen al mismo origen. Si el vínculo de origen no está disponible, el registro queda explícitamente incompleto.

## 7. Validación automatizada

`backend/test/corpusRecuperacion.prueba.js` comprueba estructura, unicidad de identificadores, existencia de fixtures, presencia de anclas, fechas válidas y exclusión de candidatos sin fuente primaria. La suite completa pasó **308/308** en [GitHub Actions 45709647230](https://github.com/luciazgagliardi/IVSCODEX/actions/runs/45709647230). La ejecución sobre el commit `04460a0d5680c80d5b43ff49f4b83158865013e5` incluye el corpus v1.2.0: ocho consultas, ocho positivos y 56 negativos, igualdad exacta del conjunto recuperado, `buscarEnIndice` sobre un índice temporal, deduplicación y filtros Mendoza SC/CC/CT; la validación del frontend confirmó 8 scripts inline y 10 archivos JavaScript. No contacta portales ni reemplaza la revisión jurídica humana. La plantilla obligatoria para la revisión profesional es [05-ficha-revision-humana-corpus.md](./05-ficha-revision-humana-corpus.md).

### 7.1 Filtro de relevancia con documentos jurídicos de referencia

La prueba invoca `filtrarPorModo` de `backend/lib/relevancia.js` sobre los textos completos versionados:
- modo `todas` con `aflojar: false`: cada una de las 8 consultas debe devolver exactamente su positivo y excluir los otros siete documentos; en conjunto, se controlan 8 positivos y 56 negativos;
- no se permite relajación silenciosa;
- el negativo difícil de Río Uruguay puede aparecer en modo `alguna` por vocabulario genérico, pero no en modo `todas` para la consulta laboral.

Esta es una regresión del filtro real con fixtures completos usados como texto de referencia. No supone que los conectores entreguen el documento completo como sumario.

### 7.2 Índice local en almacenamiento temporal

La misma suite invoca `upsertRegistros` y `buscarEnIndice` de `backend/lib/indice.js` sobre un directorio temporal del runner. Inserta los ocho documentos, ejecuta las ocho consultas, valida los 8 positivos y 56 negativos, vuelve a insertar un ID y comprueba que el inventario siga en ocho documentos y que no existan IDs repetidos. También verifica el control adversarial del modo `alguna`.

El test restaura `DIR_INDICE` y elimina el directorio temporal en `finally`. No llama a conectores, no importa el acervo persistente, no accede a Azure ni escribe en `/home/datos`. Además, ejecuta la ruta con la clave real `mendoza`: `SC`, `CC` y `CT` devuelven únicamente los registros cuyo campo `tribunal` corresponde al fuero; el registro sin tribunal no se atribuye a ningún fuero y `todo` conserva los cuatro registros de control.

Estas pruebas acreditan **relevancia textual sobre fixtures y búsqueda en el índice local**, no los campos reales de los portales, filtros HTTP, paginación remota, concurrencia del despliegue ni ranking integrado. La ejecución de matriz contra un entorno aislado completo sigue pendiente.


