# Fallos de prueba

Textos completos de sentencias reales, tal como los devuelve el extractor del
proyecto (`lib/documento.js`). Los usa `test/analisis.prueba.js`.

| Archivo | Tribunal | Por qué está |
|---|---|---|
| `scjm-rio-uruguay-2026-05-08.txt` | SCJM, 08/05/2026, CUIJ 13-07241584-6/1 | Caso de referencia del documento «IVS CODEX · Instrucciones para auditar» (magistrados, licencia, Balthazard, montos, Ontiveros). Fuente: wwwnoti.jus.mendoza.gov.ar, `vertexto.php?ide=12010568712`. |
| `scjm-berro-2026-08-12.txt` | SCJM, 12/08/2026 | Disidencia parcial de un ministro y adhesiones plurales («los Dres. … adhieren»). |
| `tsj-distribuidora-pompeya.txt` | TSJ CABA | Dos votos en disidencia; el voto de la mayoría no lleva nombre. |
| `tsj-caja-de-seguros.txt` | TSJ CABA | Votos «por su voto», una disidencia y una adhesión dividida entre dos votos. |
| `tsj-rozen-2003.txt` | TSJ CABA, 02/07/2003 | Adhesiones parciales en primera persona («Adhiero a los apartados 1, 2, 3…»). Fuente de localización: compilación oficial *Constitución y Justicia*, tomo V (2003), índice XVIII, entrada LVII, pp. 418–419: https://tsjcaba.opac.ar/pgmedia/Media/PDFs/1.5740_D-05998.%20Fallos%20TSJ%20CABA%202003.pdf |
| `tsj-lopez-viviana.txt` | TSJ CABA | Carátula con «CONTRA» y «SOBRE»; artículos del CCAyT; varias citas en un mismo paréntesis. |
| `tsj-federacion-patronal-firma-digital.txt` | TSJ CABA, 09/09/2026 | Firma digital «APELLIDO, NOMBRES / JUEZ/A», un juez de licencia, una disidencia y la mayoría sin autor. |


## Estado de procedencia de los fixtures TSJ adicionales

Los archivos `tsj-caja-de-seguros.txt`, `tsj-distribuidora-pompeya.txt`, `tsj-federacion-patronal-firma-digital.txt` y `tsj-lopez-viviana.txt` se mantienen como fixtures de prueba de extracción/análisis. Sus metadatos se inventariaron en el corpus 2.0 como candidatos pendientes, no como referencias gold: falta completar la correspondencia con la fuente oficial directa. En particular, `tsj-caja-de-seguros.txt` corresponde a Burgos c/ Perfumo (expte. 67516/2021), no a Zerpa c/ Maidana.
