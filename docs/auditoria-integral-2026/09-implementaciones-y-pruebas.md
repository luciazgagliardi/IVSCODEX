# 9. Implementaciones realizadas y batería de pruebas

Rama: `claude/laughing-mccarthy-czlbrp`. Nada se desplegó: está todo en la rama y `main` sigue sin cambios.

**Estado de las pruebas:**
- backend `node --test`: **216 de 216**;
- frontend `node --test frontend/test/*.test.mjs`: **23 de 23**;
- batería de vocabulario `node ops/vocabulario/evaluar-bateria.mjs`: **165 de 280** casos, con **0** expansiones indebidas (punto de partida: 156 y 1).

Cada cambio tiene una prueba de regresión. Cuando se pudo, la prueba ejecuta la función real y no solo busca un patrón de texto.

## 9.1 Implementaciones, por prioridad

| P | Commit | Qué cambió | Archivos | Prueba |
|---|---|---|---|---|
| P0 | `949a548` (ya en producción) | Mendoza: protocolo vigente del portal. CC y CT dejaron de dar 403 | `backend/lib/indiceMza.js` | `indiceMzaProtocolo.prueba.js` |
| P0 | `4a55929` | Límite de peticiones por IP y por fuente. Una segunda búsqueda daba 21 a 33 respuestas 429 y ahora 0. El riel muestra «— sin respuesta» en vez de «0» | `backend/index.js`, `config.js`, `frontend/index.html` | `limitePorFuente.prueba.js` (servidor real), `falsos-ceros.test.mjs` |
| P0 | `1b0cd2e` | Copia local en 0 y sitio oficial caído: error, no «Sin coincidencias»; el contador dice cuántas bases no respondieron | `frontend/index.html` | `falsos-ceros.test.mjs` |
| P0 | `3e7a139` | El total general no suma dos veces SAIJ y sus vistas | `frontend/index.html` | `falsos-ceros.test.mjs` (ejecuta `totalGeneral`) |
| P0 | `7a2fc14` | Corte del navegador alineado con el servidor (50 s); errores HTTP nombrados; botón «Reintentar las bases sin respuesta» | `frontend/index.html` | `falsos-ceros.test.mjs` (ejecuta `leerRespuesta`) |
| P0 | `36c60e4` | El verificador ya no da por verificada una cita con fecha o tomo que contradicen el fallo («Halabi», Fallos 301:999, 1979). La guía ya no dice «se presume inexistente» | `backend/lib/verificarCita.js`, `frontend/index.html` | `citas.prueba.js` |
| P0 | `b0e1a5c` | Lector: «art. 1748 del Cód. Civ. y Com.» ya no se atribuye al Código Civil derogado, ni «art. 26 del C. Penal» a la Ley 26.485 | `frontend/analisis-fallo.js` | `analisis.prueba.js` |
| P0 | `517f1c2` | Juristeca respeta el rango de años (antes 50 de 50 fuera de rango) | `backend/lib/indiceJuristeca.js` | `jujuy.prueba.js` (`filtrarPorAnio`) |
| P0 | `8ae9679` | Textos de privacidad exactos: archivos al servidor, que no los guarda; voz a Microsoft. Tasa de intereses rotulada como cargada por el usuario | `frontend/index.html`, `lector-voz.js`, `portada/index.html` | `falsos-ceros.test.mjs` |
| P0 | `d3be88c`, `c5ad011` | Cálculos y plazos:<br>– feriados 2026 por decreto;<br>– inhábiles de Mendoza (enero, receso de julio, no laborables) y sin plazo de gracia para escritos electrónicos;<br>– período de prueba según la Ley 27.802;<br>– honorarios Ley 9131 y mínimos del art. 58 de la Ley 27.423;<br>– bordes de antigüedad;<br>– portada igual a la plataforma | `frontend/calculos.js`, `index.html`, `portada/*` | `plazosFeriados.prueba.js` (14), `calculos.prueba.js` (+6), `calculos-pantalla.test.mjs` |
| P1 | `2c6b950` | Despido: el aviso cita la ley que corresponde a la fecha de egreso (Ley 27.742 o Ley 27.802) | `frontend/index.html` | `calculos-pantalla.test.mjs` |
| P1 | `eba8ac5` | TSJ CABA: dominio vigente (el anterior no resolvía en DNS) | `backend/lib/indiceCaba.js` | `limitePorFuente.prueba.js` |
| P1 | `70d8305`, `ac4c3f8` | Vocabulario jurídico desde fuentes oficiales con relaciones tipadas; reconocimiento de conceptos dentro de consultas largas | `backend/lib/vocabulario.js`, `routes/vocabulario.js`, `datos/vocabulario/*`, `ops/vocabulario/*` | `vocabulario.prueba.js` (15), batería de 280 casos |
| P1 | `4a55929` | Buscar: variantes verificadas para consultas sin anillo y panel «Líneas de investigación» rotulado | `frontend/index.html` | navegador (Playwright) |
| P2 | `3f069f7`, `7945e40` | Nueva fuente: Poder Judicial de Jujuy, con su aviso legal en la ficha | `backend/lib/indiceJujuy.js`, `fuentes.js`, `fuentesInfo.js`, `frontend/index.html` | `jujuy.prueba.js`, navegador |
| P3 | `9dd3af8` | Red de relaciones: aristas textuales con evidencia, sin inferir doctrina | `backend/lib/redJuridica.js` | `redJuridica.prueba.js` |

Además se verificaron en el navegador real (Playwright, escritorio 1440×900 e iPhone 13) la búsqueda con vocabulario, tres búsquedas seguidas sin 429, Jujuy, SCBA con falla simulada, un 503 simulado con reintento y el total general. Ninguna de esas pruebas dio errores de consola ni desborde horizontal.

## 9.2 Batería de pruebas

| Conjunto | Dónde | Qué cubre | Cómo se corre |
|---|---|---|---|
| Suite del backend | `backend/test/*.prueba.js` | 216 pruebas: protocolo de Mendoza, límites, vocabulario, red, verificación de citas, cálculos, plazos y feriados, Jujuy, Juristeca, lector | `cd backend && node --test` |
| Suite del frontend | `frontend/test/*.test.mjs` | 23 pruebas que ejecutan funciones reales de la página (`estadoBase`, `totalGeneral`, `leerRespuesta`, cálculos de pantalla) | `node --test frontend/test/*.test.mjs` |
| Batería de vocabulario | `docs/auditoria-integral-2026/datos/consultas-referencia.json` | 280 casos: 28 ramas × 10 formas (técnica, equivalente, ortográfica, coloquial, descriptor judicial, histórica, normativa, fáctica, procesal, contrapuesta) con «no debe expandir a» | `node ops/vocabulario/evaluar-bateria.mjs [--fallas]` |
| Preguntas de especialistas | `datos/preguntas-especialistas.json` | 371 preguntas de 60 perspectivas, con el diagnóstico de `analizar()` | Insumo para nuevos anillos |
| Medición de recuperación | `ops/medir-recuperacion.mjs` → `datos/linea-base-recuperacion*.json` | Totales, únicos, duplicados, errores, latencia y solapamiento entre variantes, por fuente | `NODE_USE_ENV_PROXY=1 node ops/medir-recuperacion.mjs` |

### Resultado de la batería de vocabulario por forma

| Forma | Antes | Ahora |
|---|---|---|
| técnica | 26/28 | 26/28 |
| equivalente | 22/28 | 25/28 |
| variante ortográfica | 23/28 | 25/28 |
| coloquial | 1/28 | 1/28 |
| descriptor judicial | 26/28 | 26/28 |
| histórica | 14/28 | 15/28 |
| normativa (artículo) | 7/28 | 8/28 |
| fáctica | 1/28 | 1/28 |
| procesal | 18/28 | 20/28 |
| contrapuesta | 18/28 | 18/28 |
| **Total** | **156** | **165** |
| expansiones indebidas | 1 | **0** |

La columna «Antes» es la salida del mismo evaluador sobre el código previo a las correcciones (commit `70d8305`). Las formas coloquial y fáctica siguen en 1 de 28 porque falta la capa de lenguaje común (ver `10-pendientes.md`); no se rellenó con expresiones inventadas.
