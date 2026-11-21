# 10. Informe de pendientes

Lo que no se completó, por qué y qué hace falta. Se ordena por prioridad y se separa lo que **requiere una decisión de la responsable del proyecto** de lo que es trabajo técnico.

## 10.1 Decisiones que no se tomaron por cuenta propia

| # | Tema | Situación verificada | Opciones | Por qué no se resolvió solo |
|---|---|---|---|---|
| D-1 | **Lectura en voz alta** (`backend/routes/voz.js`) | Reproduce el servicio interno de «Leer en voz alta» de Microsoft Edge: se presenta como el navegador Edge con su token de cliente y calcula su firma `Sec-MS-GEC`. No hay cuenta ni licencia propias. | (a) Azure AI Speech con clave propia: la voz `es-AR-ElenaNeural` está disponible, la app ya corre en Azure y tiene costo por carácter. (b) Voz del navegador (`speechSynthesis`) como alternativa, aceptando que depende de las voces instaladas. (c) Mantener la ruta actual asumiendo el riesgo. | Implica costo y una decisión de cumplimiento. Mientras tanto se corrigió la información al usuario: ahora dice que el texto va a un servicio de Microsoft. |
| D-2 | **`robots.txt` de SAIJ y Juristeca** | SAIJ prohíbe `/descarga-archivo`, que usa `textoSaij.js` para el texto íntegro. Juristeca prohíbe `/fallos/`, de donde se bajan los PDF. | (a) Respetar `robots.txt`: ofrecer el enlace oficial sin descargar. (b) Mantener la descarga a pedido del usuario, un documento por acción y no masiva, documentando el criterio. (c) Pedir autorización a cada organismo. | `robots.txt` regula rastreadores. La descarga puntual a pedido es discutible, pero los flujos de cosecha (`cosechar-juristeca.yml`) sí son rastreo. Es una decisión jurídica y de relación con las fuentes. |
| D-3 | **Contacto de la política de privacidad** | `frontend/portada/index.html` muestra `contacto@su-dominio.com` con `href="#"`. SIGILLVM no publica una dirección. | Indicar una dirección real. | No se inventa una dirección de contacto para ejercer derechos de la Ley 25.326. |
| D-4 | **Despliegue** | Todo está en la rama `claude/laughing-mccarthy-czlbrp`, con pruebas en verde. Nada está en `main` ni en producción. | Revisar, fusionar a `main`: el workflow despliega solo. | Pediste no desplegar sin autorización. |
| D-5 | **Revisión de las equivalencias propuestas** | 23 equivalencias medidas en vivo se muestran como «propuesta · pendiente de revisión» y no se expanden. | Revisarlas, por ejemplo con la función de anillos propios, y promover las aprobadas a `expandir`. | Una propuesta de IA no entra sola al tesauro definitivo. |
| D-6 | **Ferias judiciales de Nación** | La feria de invierno 2026 (20 al 31/7) y la de enero quedaron marcadas en pantalla como «dato no verificado»: no se pudo leer la Acordada CSJN 11/2026 ni el RJN en fuente oficial (csjn.gov.ar devolvió 403 desde este entorno). | Confirmar las acordadas y quitar la marca. | No se presenta como verificado lo que no lo está. |

## 10.2 Trabajo técnico pendiente, por prioridad

### P0 (integridad)
- **Producción no coincide con el repositorio** (auditoría funcional): el `index.html` y el `lector-voz.js` publicados difieren de `main`. Hay que comparar `pages.yml` y la publicación en `sigillvm.com` antes de desplegar, para no pisar cambios hechos directamente en producción.
- **F-09:** el verificador de citas oculta las fuentes que fallaron y no consulta la SCBA.

### P1 (recuperación)
- **Capa de lenguaje común:** la batería de regresión da 1 de 28 consultas coloquiales y 1 de 28 fácticas. No se generaron expresiones con un modelo. Fuentes legítimas para construirla:
  - categorías y motivos de reclamo de los datasets abiertos de defensa del consumidor (COPREC, Ventanilla Federal);
  - glosarios institucionales (SRT, ANSES, ENRE);
  - preguntas frecuentes de los poderes judiciales.

  Cada expresión debe entrar como `expresion_coloquial` con política `sugerir`.
- **Consultas por artículo:** 8 de 28. Conectar el vocabulario con la clave normativa del Lector (`NORMA_A_CLAVE`) y con la red (`menciona_norma`).
- **Correcciones del inventario** (`datos/correcciones-inventario.json`): 52 conceptos y 10 bloques (unos 800 conceptos) con la rama mal asignada. Por ejemplo, 53 conceptos procesales penales figuran en procesal civil, lo notarial en daños y la energía en aguas. Hay que ajustar `REGLAS_RAMA` y regenerar el inventario.
- **19 relaciones SAIJ engañosas** detectadas, por ejemplo «compensación económica» bajo «indemnización». Hay que marcarlas `controvertida` en el constructor.
- **86 ejemplos impertinentes** en `frontend/datos/tesauro/*.json` (por ejemplo, «prisión preventiva peligro de fuga» trae un sumario de concursos) y 69 voces sin ejemplos. Hay que regenerarlos con un filtro de pertinencia que exija la voz en las voces del sumario.
- **F-13:** se pierden resultados al recargar la página.
- **F-14:** el enlace compartido pierde el modo «frase exacta».
- **F-15:** duplicados entre bases. Se puede deduplicar por expediente o CUIJ.

### P2 (acervo)
Integraciones verificadas como viables por el informe de fuentes, que no se implementaron:
1. Chubut (Eureka).
2. Tribunal Fiscal de la Nación. Sus «doctrinas» son extracción por IA y hay que rotularlas así.
3. Procuración del Tesoro: dictámenes, con autoridad administrativa y no judicial.
4. Santa Cruz.
5. HUDOC, como jurisprudencia **extranjera**.
6. Tomos de «Fallos» de la CSJN, para verificar citas.
7. Base Infoleg (CC-BY).

Ver `05-informe-de-fuentes.md` §5. Antes de las de Chubut, TFN y PTN conviene escribir a cada organismo: no se localizaron sus términos de uso.

Corte IDH, Río Negro, Salta, Tucumán, Neuquén y Formosa quedaron «no verificados» desde EE.UU. Hay que repetir la prueba desde la IP de producción.

### P3 (inteligencia jurídica)
- Persistir la red (`redJuridica.js`) al importar el acervo, exponer `/api/red/…` y armar la interfaz de revisión de relaciones interpretativas (ver `08-red-de-relaciones.md` §8.5).

### P4 (experiencia)
- C-09: falta la actualización IPC + 3 % del art. 276 LCT (Ley 27.802) y el art. 770 CCyC.
- C-11: el JUS está precargado sin respaldo y la tasa de justicia del 3 % aparece también en Mendoza.
- C-13 a C-17 del informe de cálculos.
- F-20: el .docx se anuncia y no se lee.
- F-22: Lexia interpreta mal «de 2020 a 2024».
- La copia `frontend/portada-opciones/v9/calculos.js` quedó con la lógica vieja. Hay que confirmar si esa variante se publica.

## 10.3 Límites de esta auditoría
- **Precisión y recall:** no hay juicios de relevancia revisados por especialistas sobre documentos, así que no se publican cifras de precisión@k ni de recall como si fueran medidas. La batería mide **reconocimiento de conceptos**; la línea de base del motor mide volúmenes, solapamientos y latencias. El conjunto de referencia anotado está diseñado en `03-motor-y-fuentes-integradas.md`.
- **Acervo de Azure:** no está en este entorno. Las mediciones locales usan el código de la rama contra los sitios oficiales en vivo.
- **Fuentes legales:** las normas citadas en las correcciones se verificaron en argentina.gob.ar o InfoLEG cuando fue posible. Las que no, están marcadas «no verificado» en cada informe.
