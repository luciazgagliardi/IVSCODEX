# IVS Codex 2.0 — Protocolo del corpus de recuperación documental

**Versión:** 1.0.0 (piloto provisional)  
**Fecha:** 25/11/2026  
**Datos:** [04-corpus-recuperacion-v1.json](./04-corpus-recuperacion-v1.json)

## 1. Para qué sirve

Este corpus evalúa si una consulta recupera documentos jurídicos pertinentes y excluye documentos que no responden al problema planteado. Es una batería distinta de:

- los 280 casos de vocabulario, que comprueban reconocimiento terminológico;
- las 371 preguntas de diagnóstico, que comprueban formulaciones e inventario;
- las pruebas unitarias de transporte, paginación, deduplicación y errores.

Una consulta reconocida no implica que se haya recuperado una sentencia correcta. Una conexión exitosa tampoco demuestra pertinencia jurídica.

## 2. Lote piloto incorporado

El lote v1 contiene **3 documentos de texto completo, 3 consultas y 6 etiquetas negativas**:

| Documento | Jurisdicción / tribunal | Materia preliminar | Fuente y situación |
|---|---|---|---|
| Río Uruguay c/ Campos, González y Villarreal (08/05/2026) | Mendoza / SCJM | Daños por accidente de tránsito, incapacidad, seguros | Fixture completo. El LEAME declara host e identificador; la ruta se ajusta al patrón exigido por la prueba existente. El endpoint no fue reabierto desde este entorno. |
| Berro c/ Banco BBVA (12/08/2026) | Mendoza / SCJM | Despido y alegación de discriminación | Fixture completo con carátula, CUIJ y fecha; falta localizar y comprobar el enlace oficial directo. |
| Rozen Frejda (02/07/2003) | CABA / TSJ | Expropiación inversa y retrocesión | Fixture completo con expediente y carátula; falta localizar y comprobar el enlace oficial directo. |

Las etiquetas son **preliminares**, no un dictamen jurídico. Los tres textos son fixtures existentes en `backend/test/fallos/`; no se crearon carátulas ni sentencias para completar el lote.

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

En la versión actual, **0 de 3 casos son aptos para calcular métricas**. Un caso pasa a ser elegible únicamente cuando:

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

`backend/test/corpusRecuperacion.prueba.js` comprueba estructura, unicidad de identificadores, existencia de fixtures, presencia de anclas en los textos y referencias coherentes entre positivos y negativos. Esta prueba no ejecuta consultas de búsqueda, no contacta portales y no reemplaza la revisión jurídica humana.
