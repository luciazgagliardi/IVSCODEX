# Auditoría integral 2026 · 04 · Calculadoras (CALCVLVS) y plazos (TEMPVS)

**Fecha de corte:** 20/11/2026 · **Alcance:** `frontend/calculos.js`, sección 7 de `frontend/index.html` (cálculos, plazos, calendario), `frontend/portada/calculos.js` y la lógica inline de `frontend/portada/index.html` (y su copia idéntica `frontend/portada-opciones/v9/calculos.js`), pruebas de `backend/test/calculos.prueba.js`.
**Equipo:** laboral, riesgos del trabajo, daños, procesal civil (Mendoza y Nación), honorarios, intereses y actualización, previsional.

> **Advertencia de método.** Las líneas citadas corresponden al estado del árbol de trabajo al 20/11/2026: `frontend/index.html` tiene cambios sin commitear, así que los números de línea pueden correrse. Distinguimos **[Norma]** (texto de la fuente oficial, citado o resumido), **[Razonamiento]** (interpretación del equipo) y **[No verificado]** (dato que no pudimos confirmar en fuente oficial). Los scripts que reproducen cada caso están en `/tmp/claude-0/-home-user-IVSCODEX/d8cd0855-d31b-5889-b360-396bfd4f0b92/scratchpad/calculos/scripts/` (`cargar.js` extrae la sección 7 de `index.html` y la ejecuta en Node sin DOM; `prueba1.js` a `prueba4.js` corren los casos). Las 22 pruebas existentes (`node --test backend/test/calculos.prueba.js`) pasan: no cubren nada de lo que sigue.

---

## 1. Resumen

1. **El cómputo de plazos da vencimientos anticipados en casos reales de 2026, y eso es lo más grave.** Falta el feriado nacional del **lunes 9/11/2026** (visita del papa León XIV, Decreto 1103/2026) y el del 10/11 en CABA. En Mendoza no se descuentan por defecto los días que **la ley procesal declara inhábiles** (art. 60 ap. II del CPCCyT, Ley 9001): los no laborables turísticos (23/3, 10/7 y 7/12/2026), todo el mes de enero y el receso de julio (13 al 24/7/2026, Acordada SCJM 32.674). Con la configuración por defecto, la herramienta da vencimientos que se adelantan de 1 día a más de un mes. En la portada pública ni siquiera se pueden cargar esos días.
2. **En Mendoza no corre el plazo de gracia para escritos electrónicos.** Así lo establecen el art. 61 ap. III de la Ley 9001 y la Acordada SCJM 31.699 (B.O. 18/10/2024). La herramienta lo ofrece igual para Mendoza y cita el art. 124 del CPCCN. Un abogado que confíe en ese plazo presenta fuera de término.
3. **El despido no recoge la Ley 27.802 de Modernización Laboral (B.O. 6/3/2026).** Durante el período de prueba la herramienta calcula indemnización del art. 245 y preaviso de 15 días. Desde la reforma no corresponde ninguno de los dos (art. 245 «luego de transcurrido el período de prueba» y nuevo art. 231 inc. b). Además, el aviso atribuye a la Ley 27.742 cambios en la base del art. 245 que en realidad introdujo la Ley 27.802 (art. 51), y enumera mal las derogaciones.
4. **Los honorarios de Mendoza (Ley 9131) se calculan por tramos acumulativos.** Según el texto del art. 2, el porcentaje del grado se aplica sobre todo el monto, con piso en el máximo del grado precedente. Con la lectura literal, la herramienta sobrestima el mínimo entre un 11 % y un 18 % en montos usuales. Además presenta un mínimo legal («como mínimo») como si fuera el honorario.
5. **Los honorarios de Nación omiten el mínimo del art. 58 de la Ley 27.423** (10 UMA en procesos de conocimiento). En juicios chicos el titular del resultado queda muy por debajo del mínimo legal.
6. **Intereses y actualización no contemplan el art. 276 de la LCT** (texto de la Ley 27.802: IPC más 3 % anual) **ni el art. 55 de la Ley 27.802** para juicios en trámite. Para créditos laborales, la opción por defecto es la «tasa activa BNA».
7. **Funcionan bien, con salvedades:** la escala del art. 21 de la Ley 27.423 (verificada), el piso del art. 21, la renta capitalizada Vuoto/Méndez (verificada a mano), el cálculo de interés simple, la selección de datos de las series CER, UVA e IPC (BCRA v4.0, variables 30 y 31 verificadas en vivo), los plazos del CCyC (con citas a actualizar) y los feriados de la Ley 27.399, incluidos los traslados de 2026.

**Prioridades.** P0: C-01 a C-07. P1: C-08 a C-12. P2: C-13 a C-17.

---

## 2. Tabla de estado por herramienta

| Herramienta | Dónde | Estado | Evidencia principal |
|---|---|---|---|
| Feriados nacionales (Ley 27.399) | `index.html:9730-9757`, `portada/calculos.js:42-69` | **Desactualizada** | Los 16 feriados de 2026 que genera el código coinciden con los de argentina.gob.ar, pero falta el **9/11/2026** (Decreto 1103/2026). No hay días turísticos ni feriados locales de CABA (C-01). |
| Feriados de Mendoza | `index.html:9754` | **Correcta con salvedades** | Solo el 25/7 (Santiago Apóstol), que en 2026 cayó sábado. **[No verificado]** si hay otros feriados provinciales. |
| Plazos procesales en días hábiles | `index.html:10178-10200`, `portada/index.html:158-164` | **Incorrecta** (Mendoza y ferias); **desactualizada** (Nación, noviembre de 2026) | C-01, C-02, C-03 y C-15. |
| Plazo de gracia | `index.html:10187-10198` | **Incorrecta para Mendoza**; correcta para Nación (art. 124 CPCCN) | C-04. |
| Calendario judicial e inhábiles | `index.html:9758-9771, 10252+, 11097` | **Correcta con salvedades** | Los inhábiles se cargan a mano y no dependen de la jurisdicción (C-03). |
| Prescripción (CCyC y LCT) | `index.html:10213-10241`, `portada/index.html:180-184` | **Correcta con salvedades** | Plazos verificados contra InfoLEG. Hay citas viejas (lesa humanidad pasó al art. 2560) y no se avisa cuando el vencimiento cae en día inhábil (C-13). |
| Intereses (simple, por tramos) | `calculos.js:72-91`, `index.html:9868-9884` | **Correcta con salvedades** | La aritmética está bien. No contempla art. 770 inc. b CCyC, art. 276 LCT ni art. 55 de la Ley 27.802 (C-09). |
| Actualización CER/UVA/IPC/RIPTE | `calculos.js:35-69`, `index.html:9799-9833` | **Correcta con salvedades** | Variables BCRA 30 (CER) y 31 (UVA) y series IPC/RIPTE verificadas en vivo. Ver la observación sobre RIPTE (§5). |
| Despido (LCT) | `calculos.js:170-199`, `index.html:9960-10002` | **Incorrecta** (período de prueba); **desactualizada** (Ley 27.802) | C-05, C-08 y C-10. |
| Despido en la portada | `portada/index.html:165-179` | **Incorrecta / divergente** | C-12. |
| Incapacidad (Vuoto/Méndez) | `calculos.js:154-167`, `index.html:10017-10050` | **Correcta con salvedades** | Verificada a mano (§4.4). No incluye Acciarri ni la tarifa de la LRT (C-16). |
| Honorarios Nación (Ley 27.423) | `calculos.js:120-145`, `index.html:10059-10081` | **Correcta con salvedades** (art. 21) / **incorrecta** en el resultado final (art. 58) | C-07 y C-14. |
| Honorarios Mendoza (Ley 9131) | `index.html:10082-10106, 9670, 10128` | **Incorrecta** | C-06 y C-11. |
| Tasa de justicia | `calculos.js:146`, `index.html:10113` | **Correcta con salvedades** (Nación 3 %, art. 2 de la Ley 23.898) | El 3 % queda precargado aunque se elija Mendoza (C-11). |
| Liquidación | `calculos.js:94-100`, `index.html:10141-10165` | **Correcta con salvedades** | Toma los honorarios máximos sin avisarlo (C-14). |
| Pruebas automáticas | `backend/test/calculos.prueba.js` | **Insuficientes** | No cubren feriados, plazos, prescripción, honorarios de Mendoza ni la portada (C-17). |

---

## 3. Hallazgos

### C-01 · Falta el feriado nacional del 9/11/2026 y el del 10/11/2026 en CABA · **P0**

- **Dónde:** `frontend/index.html:9730-9757` (`feriados`) y su copia en `frontend/portada/calculos.js:42-69`.
- **Por qué ocurre:** la lista se genera con una regla fija (Ley 27.399) y no admite feriados dispuestos por decreto para un año determinado.
- **[Norma]** El calendario oficial de argentina.gob.ar (`/sites/default/files/holidays-2026-es.json`) incluye «2026-11-09 · Visita de Su Santidad el Papa León XIV · inamovible» y «2026-11-10 · … feriado en Córdoba y Ciudad Autónoma de Buenos Aires». Según la prensa especializada, la norma es el **Decreto 1103/2026** (art. 2). **[No verificado]** No pudimos leer el texto en el Boletín Oficial (devuelve 403 desde este entorno).
- **Consecuencia:** el vencimiento se adelanta. Notificación el jueves 05/11/2026 con un plazo de 3 días hábiles en Nación:
  - la herramienta da **martes 10/11/2026**;
  - lo correcto es **miércoles 11/11/2026**: 06/11 es el día 1, 09/11 es feriado, 10/11 es el día 2 y 11/11 es el día 3.
  - En CABA, con notificación el 06/11/2026 y un plazo de 5 días, la herramienta da el **13/11** y lo correcto es el **17/11**: 09/11 y 10/11 son inhábiles; 11, 12, 13, 16 y 17 son los días 1 a 5.
  - En los tribunales nacionales con sede en CABA, que el 10/11 sea inhábil depende de la acordada de la CSJN **[No verificado]**.
  - Quien siga la herramienta presenta un día antes de lo necesario (no hay perjuicio), pero si la usa para computar un plazo de la contraria o una caducidad, el error lo perjudica.
- **Cómo se reproduce:** `node scratchpad/calculos/scripts/prueba1.js`. Imprime «Feriados oficiales ausentes en el código: [ '2026-11-09' ]».
- **Corrección propuesta:** agregar una tabla anual de feriados y no laborables «por decreto», con la norma y la URL de la fuente, que se fusione con la regla fija y tenga clave por jurisdicción (por ejemplo `caba`). Alternativa: leer el JSON oficial de argentina.gob.ar a través del servidor y caer en la regla fija si falla, avisándolo. Para 2026 hay que agregar: 09/11 (nacional), 10/11 (CABA) y los no laborables turísticos 23/3, 10/7 y 7/12 (Resolución JGM 164/2025, art. 7 de la Ley 27.399).
- **Regresión:** `feriados(2026,'nacion')['2026-11-09']` debe existir. `calcProcesales({notif:'2026-11-05',dias:3,tipo:'habiles',juris:'nacion'})` → vence el **miércoles 11/11/2026**. Con `juris:'caba'`, notificación 06/11/2026 y 5 días → **martes 17/11/2026**.

### C-02 · Mendoza: no se descuentan los días que el CPCCyT declara inhábiles (turísticos, enero y receso de julio) · **P0**

- **Dónde:** `index.html:9766-9771` (`motivoInhabil`, `siguienteHabil`), `index.html:10178-10186`, `portada/index.html:193`.
- **[Norma]** Art. 60 ap. II de la Ley 9001: «Son hábiles todos los días del año salvo los sábados, domingos, feriados **y no laborables, declarados por ley o decreto, por los poderes ejecutivos de la Nación o de la Provincia**, o por acordadas de la Suprema Corte de Justicia; **todo el mes de enero y diez (10) días hábiles entre el 10 y 31 de julio**, que fijará anualmente el Superior Tribunal». El texto vigente está en argentina.gob.ar, normativa provincial, Ley 9001. Para 2026 la **Acordada SCJM 32.674** (06/07/2026, B.O. Mendoza) fijó el receso del **13 al 24 de julio de 2026**.
- **Por qué ocurre:** el código solo descuenta fines de semana, la lista nacional y el 25/7. Las ferias y los no laborables quedan librados a que el usuario los cargue.
- **[Razonamiento]** En Mendoza esos días son inhábiles **por ley**. Que el usuario tenga que cargarlos no es un ajuste opcional: sin ellos, el resultado por defecto es jurídicamente incorrecto.
- **Consecuencias, paso a paso:**
  - Notificación el viernes **20/03/2026**, 3 días: 23/3 es no laborable turístico (inhábil), 24/3 es feriado y 25, 26 y 27 son los días 1 a 3. Vence el **viernes 27/03/2026**; la herramienta da **jueves 26/03**.
  - Notificación el miércoles **08/07/2026**, 5 días: 9/7 es feriado, 10/7 es turístico, del 13 al 24/7 corre el receso, 25 y 26 son fin de semana y del 27 al 31/7 son los días 1 a 5. Vence el **viernes 31/07/2026**; la herramienta da **jueves 16/07** (15 días antes).
  - Notificación el **04/12/2026**, 2 días: 7/12 es turístico y 8/12 es feriado. Vence el **10/12/2026**; la herramienta da el **09/12**.
  - Notificación el **28/12/2026**, 5 días: 29, 30 y 31/12 son los días 1 a 3, enero es inhábil y 1 y 2/2/2027 son los días 4 y 5. Vence el **martes 02/02/2027**; la herramienta da el **05/01/2027**.
  - En una caducidad de instancia o en un plazo de la contraria, el error puede llevar a pedir una caducidad o un decaimiento que no corresponden, o a perder un derecho.
- **Cómo se reproduce:** `node scratchpad/calculos/scripts/prueba1.js` y `prueba4.js`. Con los inhábiles cargados a mano, la herramienta da los valores correctos, lo que confirma el diagnóstico.
- **Corrección propuesta:** si `juris==="mendoza"`, tratar automáticamente como inhábiles (a) todo enero, (b) el receso de julio de cada año, con una tabla por año que cite la acordada (2026: Ac. 32.674, del 13/7 al 24/7) y que, si falta el dato del año, bloquee el resultado o lo marque como provisorio, y (c) los no laborables nacionales y provinciales. **[Razonamiento]** Los no laborables religiosos optativos (Pascua judía, Ramadán, etc.) son dudosos por su alcance personal: conviene mostrarlos con un aviso en lugar de descontarlos en silencio.
- **Regresión (Mendoza, días hábiles):** 20/03/2026 + 3 → **27/03/2026**; 08/07/2026 + 5 → **31/07/2026**; 04/12/2026 + 2 → **10/12/2026**; 28/12/2026 + 5 → **02/02/2027**.

### C-03 · Ferias de Nación no precargadas; inhábiles sin jurisdicción; portada sin forma de cargarlos · **P0**

- **Dónde:** `index.html:9758-9764` (`inhabilExtra` no recibe la jurisdicción), `index.html:10283` y `11097-11104` (botón «feria de enero»), `portada/index.html:158-164` y `193`.
- **[Norma]**
  - Nación: la feria de invierno de 2026 va del **20 al 31/7/2026** (Acordada CSJN 11/2026, según Microjuris). **[No verificado]** No pudimos leer el texto en csjn.gov.ar.
  - La feria de enero de la justicia nacional dura todo el mes (Reglamento para la Justicia Nacional). **[No verificado]** No pudimos leer el texto oficial del RJN.
- **Por qué ocurre:**
  1. Las ferias solo se descuentan si el usuario las carga.
  2. `CALC.inhabiles` es una sola lista para todas las jurisdicciones: el receso de Mendoza cargado se aplica también a Nación, y al revés.
  3. La portada (`motivo()`, línea 193) no consulta ningún inhábil cargado. Su nota dice «cárguelos en el calendario de la plataforma», pero la portada no los lee.
- **Consecuencia:** en Nación, con notificación el 15/07/2026 y un plazo de 5 días, la herramienta da el **22/07/2026**; con la feria, vence el **05/08/2026**. En la portada no hay manera de llegar al resultado correcto.
- **Corrección propuesta:** precargar las ferias por jurisdicción y por año con su acordada (y cartel de «dato no cargado» cuando falte el año), guardar `juris` en cada inhábil cargado, hacer que `inhabilExtra(iso, juris)` filtre por jurisdicción y que la portada use la misma función o deje de mostrar un resultado de días hábiles en meses con feria.
- **Regresión:** Nación, 15/07/2026 + 5 días hábiles → **05/08/2026**. Con un inhábil `{juris:'mendoza', 13–24/7}`, Nación 08/07/2026 + 5 no debe saltear esos días.

### C-04 · Plazo de gracia ofrecido en Mendoza para escritos electrónicos · **P0**

- **Dónde:** `index.html:10187` (`gracia=siguienteHabil(...)`), `10190` (fila «Plazo de gracia») y `10198` (base legal: «art. 124 CPCCN»). Lo mismo en `portada/index.html:163`.
- **[Norma]** Art. 61 ap. III de la Ley 9001: «…sólo podrá ser entregado válidamente el día hábil inmediato posterior y dentro de las dos (2) primeras horas del despacho. **No regirá el plazo de gracia en el supuesto de presentación de escritos electrónicos en el expediente digital, cuando el sistema funcione las veinticuatro (24) horas**». La **Acordada SCJM 31.699** (B.O. Mendoza 18/10/2024) declaró cumplida esa condición: desde su publicación «no rige el plazo de gracia… en aquellos casos en los cuales el modo de ingresar el escrito judicial sea a través de una presentación electrónica/digital». Lo mantiene «únicamente, en aquellos supuestos que involucren plazos de prescripción de la acción o caducidad de instancia que vencieren en día inhábil… hasta las nueve y treinta horas». Texto transcripto en Microjuris al Día, 28/10/2024.
- **Consecuencia:** con un plazo que vence el viernes 27/03/2026, la herramienta muestra «Con plazo de gracia: lunes 30/03/2026, dos primeras horas». Un escrito electrónico presentado el 30/03 es **extemporáneo** y el derecho precluye (art. 62 de la Ley 9001: plazos perentorios). La herramienta, además, funda la regla en una norma ajena a Mendoza.
- **Corrección propuesta:** con `juris==="mendoza"`, no mostrar plazo de gracia y explicar: «Vence a las 24 h del día del vencimiento (art. 63 Ley 9001). No rige el plazo de gracia para escritos electrónicos (art. 61 ap. III Ley 9001; Acordada SCJM 31.699)». La excepción para prescripción y caducidad que vencen en día inhábil va como nota. Base legal para Mendoza: arts. 60, 61 y 63 de la Ley 9001.
- **Regresión:** Mendoza, 20/03/2026 + 3 → vence el **27/03/2026, a las 24 h**, **sin** fila «Plazo de gracia». Nación, mismo caso → vence el 26/03/2026, con plazo de gracia el 27/03/2026 en las dos primeras horas (art. 124 CPCCN).

### C-05 · Despido en período de prueba: calcula indemnización del art. 245 y preaviso que no corresponden · **P0**

- **Dónde:** `frontend/calculos.js:180-191`. Ahí `r.indemnizacion=base*computables` se calcula siempre, y `r.preaviso=op.prueba?s/2:…` da 15 días. Lo usan `index.html:9966-9978`.
- **[Norma]**
  - Art. 245 LCT, texto del art. 51 de la Ley 27.802 (B.O. 6/3/2026, vigente desde su publicación según el art. 217): la indemnización corresponde «habiendo o no mediado preaviso **y luego de transcurrido el período de prueba**».
  - Art. 231 inc. b, texto del art. 48 de la Ley 27.802: «Para el supuesto en que el trabajador se encuentre en período de prueba **no se requerirá la obligación de preaviso**».
  - Ya antes de la reforma, el art. 92 bis (texto de la Ley 27.742) excluía la indemnización por la extinción durante la prueba.
  - Fuente: argentina.gob.ar, normativa nacional, Ley 27.802, texto actualizado.
- **Consecuencia:** remuneración de $1.000.000, ingreso el 01/06/2026, egreso el 15/09/2026, con la opción «período de prueba» tildada:
  - la herramienta suma indemnización de $1.000.000, preaviso de $500.000 y SAC sobre el preaviso de $41.666,67, con un total de **$2.428.750,55**;
  - lo correcto es indemnización $0, preaviso $0 y SAC sobre el preaviso $0. Quedan días trabajados $500.000, SAC proporcional $209.239,13, vacaciones $164.164,38 y SAC sobre vacaciones $13.680,37: total **$887.083,88**;
  - la herramienta sobrestima en **$1.541.666,67**, una cifra que un abogado podría reclamar o pagar.
- **[Razonamiento]** Para despidos durante la prueba anteriores al 06/03/2026 seguía correspondiendo el preaviso de 15 días (art. 92 bis según la Ley 27.742, que remitía a los arts. 231 y 232), pero no la indemnización. Hay que distinguir por la fecha de egreso.
- **Cómo se reproduce:** `node scratchpad/calculos/scripts/prueba2.js`, primer bloque.
- **Corrección propuesta:** si `op.prueba`, poner `indemnizacion=0`. Si además la fecha de egreso es igual o posterior al 2026-03-06, poner `preaviso=0`; si es anterior, mantener los 15 días. Avisar que la prueba dura 6 meses salvo que el convenio la amplíe, y que se pierde si no hubo registración (art. 92 bis).
- **Regresión:** `despidoComponentes(1e6, 2026-06-01, 2026-09-15, {prueba:true,sinPreaviso:true,integracion:true,sacRubros:true})` → `indemnizacion=0, preaviso=0, sacPreaviso=0, integracion=0`. Con ingreso el 01/09/2025 y egreso el 15/12/2025 → `indemnizacion=0, preaviso=500000`.

### C-06 · Honorarios de Mendoza: la escala del art. 2 de la Ley 9131 se aplica por tramos acumulativos · **P0**

- **Dónde:** `index.html:10082-10106`, en particular `TR=[[0,20,20],[20,50,16],[50,Infinity,12]]` y el bucle que suma porciones. También `min=f;max=f` (línea 10102) y el aviso «tramos acumulativos» (10105).
- **[Norma]** Art. 2 de la Ley 9131 (texto en el PDF del Colegio de Abogados de Mendoza, Id SAIJ LPM0009131): «el honorario del abogado… **se regulará como mínimo** en la cantidad que resulte de aplicar la siguiente escala: **Juicios de hasta 20 JUS… el 20 %. Más de 20 JUS hasta 50 JUS… el 16 %. Más de 50 JUS en adelante… el 12 %**. Si el mérito… lo justificara… podrá ser aumentada hasta un treinta por ciento (30 %). **Si al aplicar la escala resultase un honorario de monto inferior al determinado por el máximo del grado precedente, se regulará ese máximo.**»
- **[Razonamiento]**
  - La escala clasifica el **juicio** por su monto total («Juicios de hasta…») y le aplica un porcentaje.
  - La regla del «máximo del grado precedente» solo tiene sentido si el porcentaje recae sobre todo el monto: con tramos acumulativos el resultado nunca puede quedar por debajo del máximo anterior, y la regla sería superflua.
  - La propia SCJM encuadra el monto total en un grado («El monto ejecutado de $805.973,10 encuadraba en los juicios de 20 jus hasta 50 jus», sentencia publicada en www2.jus.mendoza.gov.ar, proveído 10773695277).
  - Además, el art. 2 fija un **mínimo**, no el honorario. Mostrar `min===max` como «Honorarios según la escala» es inexacto.
- **Consecuencia (JUS de $784.337,29 cargado por defecto, valor no verificado):**

| Monto | En JUS | Herramienta (acumulativa) | Lectura literal (mínimo) | Diferencia |
|---|---|---|---|---|
| $30.000.000 | 38,25 | $5.427.469,83 | 16 % × 30.000.000 = **$4.800.000** (piso del grado anterior: 20 % × 20 JUS = 4 JUS = $3.137.349,16) | +13,1 % |
| $40.000.000 | 51,00 | $6.996.144,41 | 12 % = $4.800.000 < piso 16 % × 50 JUS = 8 JUS → **$6.274.698,32** | +11,5 % |
| $100.000.000 | 127,50 | $14.196.144,41 | 12 % → **$12.000.000** | +18,3 % |
| $10.000.000 | 12,75 | $2.000.000 | $2.000.000 | 0 |

  Una regulación pedida o consentida sobre la base de la herramienta excede el mínimo legal sin justificar el incremento por mérito. Si la usa la parte condenada en costas para controlar la regulación, la cuenta sale mal en el otro sentido.
- **Cómo se reproduce:** `node scratchpad/calculos/scripts/prueba3.js`.
- **Corrección propuesta:** `p = enJus<=20?20 : enJus<=50?16 : 12; base = m*p/100; piso = enJus<=20?0 : enJus<=50? 20*jus*0.20 : 50*jus*0.16; minimo = max(base, piso); maximo = minimo*1.30` (art. 2, mérito). Mostrar el **rango de mínimo a máximo** y aplicar después los arts. 3, 7, 8 y 31. Si se quiere conservar la lectura acumulativa, mostrarla como alternativa «pendiente de verificación», como ya se hace con el art. 21 de la Ley 27.423.
- **Regresión:** monto 40.000.000 y JUS 784.337,29 → mínimo **$6.274.698,32** y máximo con mérito **$8.157.107,82**. Monto 100.000.000 → mínimo **$12.000.000**. Monto 30.000.000 → mínimo **$4.800.000**.

### C-07 · Honorarios de Nación: el resultado ignora el mínimo legal del art. 58 de la Ley 27.423 · **P0**

- **Dónde:** `calculos.js:122-145` y `index.html:10059-10081`. El aviso de que «los mínimos por tipo de proceso (art. 58)… no se calculan acá» está solo en la base legal (línea 10080).
- **[Norma]** Art. 58 de la Ley 27.423: «El mínimo establecido para regular honorarios de juicios susceptibles de apreciación pecuniaria… será: a) En los procesos de conocimiento, de diez (10) UMA; b) En los ejecutivos, de seis (6) UMA; c) En los procesos de mediación, de dos (2) UMA…» (argentina.gob.ar, Ley 27.423, texto actualizado). La UMA vale $108.005 desde el 01/09/2026 según una resolución SGA que cita la Acordada 31/2026 **[No verificado en csjn.gov.ar]**. La herramienta no guarda ese valor: lo carga el usuario.
- **Consecuencia:** un proceso de conocimiento por $1.000.000 equivale a 9,26 UMA. La herramienta muestra en el titular «$220.000 a $330.000», cuando el mínimo legal es **10 UMA = $1.080.050**: queda entre un 70 % y un 80 % por debajo. Además, «Llevar a la liquidación» manda $330.000.
- **Corrección propuesta:** pedir el tipo de proceso (conocimiento, ejecutivo, mediación u otro) y aplicar `min = max(min, mínimoArt58 × UMA)` y `max = max(max, min)`, con una fila que lo explique. Indicar también las etapas del art. 29 (1/3 cada una) y el art. 30 (alzada del 30 % al 35 %) como notas.
- **Regresión:** `honorariosNacion(1000000, 108005, {proceso:'conocimiento'})` → `min = max = 1.080.050`. Con `ejecutivo` → `648.030`. Con 12.000.000 no cambia: 2.720.431,50 a 2.834.409.

### C-08 · El aviso del despido cita mal la Ley 27.742 y no recoge la Ley 27.802 · **P1**

- **Dónde:** `index.html:9995` (aviso), `9970` (nota de tope), `10000` (base legal) y `10007-10010` (`formDespido`, rótulo «Mejor remuneración…»).
- **[Norma]**
  - La Ley 27.742 no modificó el art. 245. Solo incorporó el 245 bis y el fondo de cese (art. 96) y derogó los «artículos 8° a 17 y 120, inciso a), de la ley 24.013; el artículo 9° de la ley 25.013; los artículos 43 a 48 de la ley 25.345…» (art. 99) y **toda la Ley 25.323** (art. 100). Rige desde el 09/07/2024 (art. 237).
  - La exclusión del SAC, las vacaciones y los premios no mensuales, y las definiciones de «habitual» (6 meses en el último año calendario) y «normal» (promedio de 6 meses o de un año, el que sea más favorable), vienen del **art. 51 de la Ley 27.802**, que también lleva a la ley el piso del 67 % de «Vizzoti».
  - El art. 80 LCT (texto del art. 25 de la Ley 27.802) ya no contiene la multa.
- **Consecuencias:**
  1. El aviso afirma que se derogaron «los arts. 8, 9, 10 y 15 de la Ley 24.013 y los arts. 1 y 2 de la Ley 25.323», una enumeración incompleta.
  2. No distingue por fecha. Para despidos anteriores al 09/07/2024 hay debate sobre si las multas siguen siendo exigibles; un fallo citado por la doctrina sostiene que la Ley 27.742 no se aplica a contratos en curso (art. 7 CCyC) **[No verificado en fuente judicial oficial]**. El aviso las da por inaplicables sin más.
  3. El rótulo pide la «mejor remuneración mensual, normal y habitual» sin las definiciones legales actuales, que cambian el número cuando hay remuneraciones variables.
- **Corrección propuesta:** reescribir el aviso según la fecha de egreso:
  - antes del 09/07/2024: rigen la Ley 25.323 y los arts. 8 a 15 de la Ley 24.013, si se cumplen sus recaudos;
  - entre el 09/07/2024 y el 05/03/2026: derogadas por los arts. 99 y 100 de la Ley 27.742;
  - desde el 06/03/2026: además, el art. 245 según la Ley 27.802.
  
  Citar el art. 245 (Ley 27.802) para la exclusión del SAC y el piso del 67 %, y agregar ayuda para el promedio de 6 meses de los variables.
- **Regresión (prueba sobre el texto):** con egreso el 2026-11-20, el aviso contiene «art. 245 LCT (texto Ley 27.802)» y no contiene «Según la reforma de la Ley 27.742 (2024), la base del art. 245». Con egreso el 2024-03-01, el aviso menciona que las multas de la Ley 25.323 pueden ser exigibles.

### C-09 · Intereses y actualización de créditos laborales: falta el régimen del art. 276 LCT y del art. 55 de la Ley 27.802; falta el anatocismo del art. 770 CCyC · **P1**

- **Dónde:** `calculos.js:72-91`, `index.html:9666` (`tipo:"activa"` por defecto), `9875` y `9879-9880`.
- **[Norma]**
  - Art. 276 LCT (art. 54 de la Ley 27.802): «Los créditos provenientes de las relaciones individuales de trabajo serán actualizados por la variación… del IPC – Nivel General… **con más una tasa de interés del tres por ciento (3 %) anual**, desde que cada suma sea debida y hasta el momento del efectivo pago».
  - Art. 55 de la Ley 27.802, para juicios en trámite sin sentencia definitiva: tasa pasiva del BCRA, con un tope en IPC + 3 % y un piso del 67 % de ese resultado.
  - Art. 770 inc. b CCyC: los intereses se acumulan al capital desde la notificación de la demanda.
- **Consecuencia:** para un crédito laboral nacido después del 06/03/2026, la herramienta propone la «tasa activa del Banco de la Nación» sin advertir que la ley fija otro método. Tampoco ofrece el combinado IPC + 3 %: el usuario tendría que encadenar dos calculadoras sin guía sobre la base del 3 %. Ninguna calculadora capitaliza una vez a la fecha de notificación de la demanda.
  - **[Razonamiento]** Si la aplicación del art. 276 a créditos de competencia provincial se discute por razones constitucionales, eso debe decirse en un aviso; no puede omitirse el régimen.
  - Sobre la vigencia hubo una cautelar de la CGT, dictada por el JNT n.° 63 el 30/03/2026 y luego dejada sin efecto por el JCAF n.° 12, según la prensa **[No verificado en fuente judicial]**.
- **Corrección propuesta:** agregar el modo «Crédito laboral (art. 276 LCT)»: coeficiente IPC(mes de pago o último publicado) / IPC(mes de exigibilidad), multiplicado por el capital, más el 3 % anual simple sobre el capital actualizado, con la fórmula a la vista. **[Razonamiento]** Que la base del 3 % sea el capital actualizado es una lectura que hay que mostrar como tal. Agregar también el modo «Juicio en trámite al 06/03/2026 (art. 55)» con tope y piso, y la opción «capitalizar a la notificación de la demanda (art. 770 inc. b)».
- **Regresión:** capital $1.000.000, IPC inicial 12.276,766 (08/2026) e IPC final 12.785,9321 (10/2026) → coeficiente 1,041474. Con 61 días entre el 01/08 y el 01/10: interés al 3 % = 1.041.473,96 × 0,03 × 61/365 = $5.221,64. Total **$1.046.695,60**, con base y fórmula a la vista.

### C-10 · Antigüedad: el día del egreso no se cuenta para la fracción de 3 meses ni para los 5 años del preaviso · **P1**

- **Dónde:** `calculos.js:170-174` (`masDeTres: masMeses(desdeAniv,3)<b`) y `calculos.js:187` (`masDeCinco=masMeses(a,60)<b`). La copia está en `index.html:9954-9958`.
- **[Norma]** Art. 245: «por cada año de servicio **o fracción mayor de tres (3) meses**». Art. 231 inc. b: dos meses cuando la antigüedad «fuere **superior**» a cinco años.
- **[Razonamiento]** La herramienta cuenta el día del egreso como trabajado (art. 103: «días trabajados del mes (dia)», que incluye ese día). Coherentemente, con ingreso el 01/01/2020 y egreso el 01/04/2024 la antigüedad es de 4 años, 3 meses y 1 día, una fracción mayor de 3 meses. Lo mismo con egreso el 01/01/2025: 5 años y 1 día, que es «superior» a cinco años.
- **Consecuencia (remuneración de $1.000.000):**
  - con egreso el 01/04/2024, la herramienta computa **4** años y lo coherente son **5**: $1.000.000 menos de indemnización;
  - con egreso el 01/01/2025, la herramienta da preaviso de **1 mes** y corresponden **2**: $1.000.000 menos, más el SAC.
- **Corrección propuesta:** comparar contra `b+1 día` (`masMeses(desdeAniv,3) < masDias(b,1)` y lo mismo para los 60 meses). Así la fracción y los 5 años se miden con el mismo criterio que los días trabajados. Señalarlo como criterio, con la alternativa.
- **Regresión:** (01/01/2020 → 31/03/2024) → 4 años computables. (01/01/2020 → 01/04/2024) → **5**. (01/01/2020 → 31/12/2024) → 1 mes de preaviso. (01/01/2020 → 01/01/2025) → **2 meses**.

### C-11 · JUS precargado con un valor no verificado y tasa de justicia del 3 % precargada para Mendoza · **P1**

- **Dónde:** `index.html:9670` (`jus:"784.337,29"`, `tasaPct:"3"`) e `index.html:10128` (nota «$784.337,29, vigente desde el 05/10/2026… JUS general de 2026 $628.730,43»).
- **Por qué ocurre:** contradice el principio del propio archivo (`index.html:9660-9664`: «los valores que cambian con el tiempo… no se escriben acá»).
- **[No verificado]** No encontramos en fuente oficial ninguno de los dos valores del JUS. La prensa informa una reforma reciente al mecanismo de actualización del JUS (art. 7 del CPCCyT); conviene consultar las acordadas de jusmendoza.gob.ar.
- **Consecuencia:**
  - El valor precargado se queda viejo sin aviso: es justamente el problema que el comentario quería evitar.
  - Al cambiar a Mendoza sigue precargado el 3 %, que es la alícuota de la Ley 23.898 (Nación). La pantalla muestra «Tasa de justicia (3 %, sin IVA)» para un proceso mendocino, cuya alícuota fija la ley impositiva provincial. Con un monto de $40.000.000 aparecen $1.200.000 de tasa sin respaldo normativo.
- **Corrección propuesta:** dejar vacío el JUS (o cargarlo desde una tabla con fecha y número de acordada, verificada), vaciar `tasaPct` al elegir Mendoza y exigir que el usuario la cargue.
- **Regresión:** al elegir `juris:'mendoza'` sin tocar nada, `calcHonorarios()` no muestra ninguna fila de «Tasa de justicia» y exige el JUS.

### C-12 · La portada calcula el despido distinto que la plataforma · **P1**

- **Dónde:** `frontend/portada/index.html:165-179`, que repite la lógica a mano. El comentario de la línea 11 dice «Los cálculos son los mismos de la aplicación».
- **Por qué ocurre:** la portada no calcula el SAC sobre el preaviso, la integración ni las vacaciones, no aplica tope ni período de prueba y no usa `IVSCalculos.despidoComponentes`.
- **Consecuencia:** remuneración de $1.250.000, ingreso el 10/03/2020 y egreso el 20/11/2026, sin preaviso:
  - la plataforma da **$14.238.515,28**;
  - la portada da **$13.917.788,50**: le faltan $208.333,33 + $34.722,22 + $77.671,23 = $320.726,78 de SAC;
  - con las mismas entradas salen dos totales públicos distintos, y además la portada arrastra los errores de C-05 y C-10.
- **Corrección propuesta:** que la portada cargue `frontend/calculos.js` y use `despidoComponentes`, y lo mismo para los plazos y la prescripción. Eliminar las copias (`portada/calculos.js` y `portada-opciones/v9/calculos.js`).
- **Regresión:** para las mismas entradas, portada y plataforma deben dar el mismo total.

### C-13 · Prescripción: citas desactualizadas y sin aviso cuando el vencimiento cae en día inhábil · **P2**

- **Dónde:** `index.html:10213-10241` y `portada/calculos.js:76-88`.
- **[Norma]** (InfoLEG/argentina.gob.ar, CCyC, texto actualizado)
  - Desde la Ley 27.586 (B.O. 16/12/2020), la imprescriptibilidad de las acciones civiles por delitos de lesa humanidad está en el **art. 2560** y se derogó el último párrafo del 2561.
  - El art. 2560 fue sustituido otra vez por la **Ley 27.799** (B.O. 2/1/2026): agrega que los tributos locales prescriben según la Ley 11.683.
  - Los plazos de 5, 3, 2 y 1 año y los incisos de los arts. 2561, 2562 y 2564 que usa la herramienta coinciden con el texto vigente; los verificamos.
- **Consecuencias:**
  1. Cita «art. 2561» para lesa humanidad.
  2. Con inicio el 29/02/2024 y prescripción laboral, el vencimiento es el **sábado 28/02/2026** (art. 6 CCyC: bien calculado) y no hay ningún aviso de que cae en día inhábil. La Acordada SCJM 31.699 mantiene en Mendoza el plazo de gracia hasta las 9:30 para demandas cuya prescripción vence en día inhábil; en Nación, la jurisprudencia admite el plazo de gracia del art. 124 CPCCN **[No verificado]**.
  3. Para créditos laborales no se menciona el art. 257 LCT (los reclamos ante la autoridad administrativa interrumpen la prescripción por hasta 6 meses).
- **Corrección propuesta:** citar el art. 2560 (según la Ley 27.586) para lesa humanidad, avisar cuando el vencimiento cae en día inhábil con la regla de cada jurisdicción, y agregar el art. 257 LCT en la acción «laboral».
- **Regresión:** acción `lesa` → la base contiene «art. 2560». Acción `laboral` con inicio el 2024-02-29 → «sábado, 28 de febrero de 2026» más un aviso de día inhábil.

### C-14 · Liquidación: supuestos ocultos (honorarios máximos y tasa sobre el monto del proceso) · **P2**

- **Dónde:** `index.html:10117` (`aLiquidacion:{honorarios:max, …, tasa:m*tp/100}`).
- **Consecuencia:** «Llevar a la liquidación» pasa en silencio el **máximo** del rango; para 12.000.000 con la UMA de $108.005, pasa $2.834.409 cuando el rango empieza en $2.720.431,50. También pasa una tasa de justicia sobre el monto del proceso, que puede no coincidir con la tasa efectivamente oblada ni con exenciones (por ejemplo, el trabajador). En la planilla de liquidación, los honorarios deben ser los **regulados**.
- **Corrección propuesta:** no transferir honorarios estimados, o hacerlo con la etiqueta «estimado (máximo de escala), reemplazar por el regulado». Pedir confirmación de la tasa.
- **Regresión:** después de «Llevar a la liquidación» desde honorarios, la fila de honorarios queda vacía o lleva el rótulo «estimado».

### C-15 · Base legal de los plazos: cita el CPCCN para Mendoza y CABA y no explica qué fecha de notificación cargar · **P2**

- **Dónde:** `index.html:10198`.
- **[Norma]** En Mendoza los plazos corren «desde el día hábil siguiente a la notificación… y vencerán a las veinticuatro (24) del día correspondiente» (art. 63 de la Ley 9001). La notificación simple se produce «el día siguiente hábil posterior» a la aparición en lista (art. 66 de la Ley 9001).
- **Consecuencia:** el usuario puede cargar la fecha de la providencia o la de publicación en lista en lugar de la fecha en que la notificación quedó perfeccionada, y adelantar el vencimiento un día hábil.
- **Corrección propuesta:** base legal por jurisdicción y un rótulo del campo que diga «Fecha en que quedó notificado (no la de la providencia; en Mendoza, art. 66 Ley 9001)».
- **Regresión:** con `juris:'mendoza'`, la base contiene «art. 63 Ley 9001» y no «CPCCN».

### C-16 · Incapacidad: faltan Acciarri y la tarifa de la LRT; la RIPTE se ofrece sin calculadora sistémica · **P2**

- **Dónde:** `calculos.js:154-167` e `index.html:10017-10050`. El tesauro y el buscador sugieren «fórmula Acciarri» (`index.html`, líneas ~2197 y ~2537), pero no existe esa calculadora.
- **Verificación hecha (§4.4):** Vuoto y Méndez coinciden con el cálculo manual al centavo.
- **Consecuencia:**
  - Quien busque «Acciarri» no encuentra la fórmula que pide.
  - Para accidentes de trabajo no hay cálculo de la prestación del art. 14 ap. 2 inc. a de la LRT (53 × VIB × 65/edad × %), ni del adicional del 20 % (art. 3 de la Ley 26.773), ni de los pisos actualizados por RIPTE. **[No verificado en esta auditoría]** No recalculamos esos valores.
  - Tras el art. 278 LCT (texto de la Ley 27.802), que declara incompatibles las prestaciones de «esta ley… y/o en los distintos regímenes laborales especiales» con los reclamos fundados en el CCyC, la acción «accidente» de la prescripción (art. 2562 inc. b CCyC) necesita un aviso. **[Razonamiento]** El alcance de esa incompatibilidad respecto de la opción del art. 4 de la Ley 26.773 es discutible.
- **Corrección propuesta:** agregar Acciarri (renta con tasa y edad límite configurables, y la variante de ingreso creciente si se adopta) indicando la fuente doctrinaria y el tribunal que la usa. Agregar la calculadora de la LRT con los valores oficiales de la SRT con fecha, y un aviso sobre el art. 278 LCT.
- **Regresión:** `incapacidad(900000,18,34,'mendez').capital = 74.303.589,02`; `incapacidad(900000,18,34,'vuoto').capital = 29.334.655,10`. Ya están cubiertos; agregar casos de Acciarri cuando exista.

### C-17 · Pruebas: sin cobertura de plazos, feriados, prescripción, honorarios de Mendoza ni portada · **P2**

- **Dónde:** `backend/test/calculos.prueba.js`, que solo prueba `frontend/calculos.js`. `feriados`, `calcProcesales`, `calcPrescripcion` y la rama de Mendoza de `calcHonorarios` viven en `index.html` y ningún test los toca.
- **Consecuencia:** C-01 a C-07 pasaron sin que fallara ninguna prueba.
- **Corrección propuesta:** mover `feriados`, `computarPlazo(juris, notif, n, inhabiles)`, `prescripcion(...)` y `honorariosMendoza(...)` a `calculos.js` y agregar como pruebas los casos de regresión de este informe. Agregar también una prueba que compare la lista de feriados con un archivo fijo del calendario oficial de cada año.

---

## 4. Verificación manual de lo que sí está bien

### 4.1 Escala del art. 21 de la Ley 27.423 (texto verificado en argentina.gob.ar)
- Tramos de 15/45/90/150/450/750 UMA con porcentajes 22–33, 20–26, 18–24, 17–22, 15–20, 13–17 y 12–15: coinciden con `ESCALA_27423`.
- Caso de $12.000.000 con UMA de $108.005: equivale a 111,106 UMA, en el tramo de 91 a 150 (17–22 %).
  - Aplicación directa: 2.040.000 a 2.640.000.
  - Piso: 90 UMA = 9.720.450; máximo del grado anterior = 24 % = 2.332.908; excedente = 2.279.550.
  - Rango con piso: 2.332.908 + 17 % × 2.279.550 = **2.720.431,50**, hasta 2.332.908 + 22 % × 2.279.550 = **2.834.409**. Coincide con la herramienta.
- **Salvedad:** C-07 (art. 58).

### 4.2 Interés simple
- $1.500.000 al 58,5 % entre el 01/01/2025 y el 01/01/2026: 365 días → 1.500.000 × 0,585 = **877.500**. Coincide.
- Con dos tramos (30 % y 60 %, 181 y 184 días): 1.500.000 × (0,30 × 181 + 0,60 × 184)/365 = 223.150,68 + 453.698,63 = **676.849,32**. Coincide.
- **Salvedad:** en años bisiestos divide por 365 (366 días al 36,5 % dan el 36,6 %). Es un criterio usual, pero no está dicho en pantalla.

### 4.3 Vizzoti y tope
- Remuneración de $3.000.000 con tope de $1.500.000: base = max(1.500.000; 0,67 × 3.000.000) = **2.010.000**. Coincide.
- Hoy la regla está en la ley: penúltimo párrafo del art. 245 según la Ley 27.802 («En ningún supuesto la aplicación del tope… podrá ser inferior al sesenta y siete por ciento (67 %)»).

### 4.4 Incapacidad: renta capitalizada C = A·(1−(1+i)^−n)/i
- **Méndez** (ingreso de $900.000, 18 %, 34 años):
  - A = 900.000 × 13 × (60/34) × 0,18 = 3.716.470,59;
  - n = 75 − 34 = 41; (1,04)^41 = 4,99306; factor = (1 − 0,200278)/0,04 = 19,99305;
  - C ≈ **74.303.589**. La herramienta da 74.303.589,02.
- **Vuoto:**
  - A = 900.000 × 13 × 0,18 = 2.106.000;
  - n = 31; (1,06)^31 = 6,08810; factor = 13,92909;
  - C ≈ **29.334.655**. La herramienta da 29.334.655,10.
- Los parámetros (Vuoto: 65 años y 6 %; Méndez: 75 años, 4 % y 60/edad por debajo de 60 años) coinciden con lo que la doctrina atribuye a CNAT, Sala III, «Vuoto» (1978) y «Méndez» (28/4/2008). **[No verificado]** No leímos el texto de los fallos en fuente oficial.

### 4.5 Feriados de la Ley 27.399 en 2026 (contra el calendario oficial de argentina.gob.ar)
- Coinciden: 1/1, 16 y 17/2, 24/3, 2/4, 3/4, 1/5, 25/5, 15/6 (Güemes, trasladado del miércoles 17), 20/6, 9/7, 17/8, 12/10, 23/11 (Soberanía, trasladada del viernes 20), 8/12 y 25/12.
- La regla de traslado de `trasladar()` (martes y miércoles al lunes anterior; jueves y viernes al lunes siguiente) es la del art. 6 de la Ley 27.399.
- Falta el 9/11 (C-01).

### 4.6 Series de índices
- La API del BCRA v4.0 identifica la variable 30 como «Coeficiente de estabilización de referencia (base 2.2.02=1)» y la 31 como «Unidad de valor adquisitivo (base 31.3.16=14.05)», con datos hasta el 15/12/2026 (el CER se publica por adelantado).
- IPC `148.3_INIVELNAL_DICI_M_26`: último dato 10/2026 = 12.785,9321.
- Cada resultado muestra el índice, la fecha del dato usado, el coeficiente y la fuente, así que es reproducible.

### 4.7 Datos de entrada y fuente en cada resultado
- Todas las calculadoras de la plataforma muestran los datos de entrada, la fórmula o los rubros y la base legal.
- **Excepciones:**
  - la portada, que no muestra base legal en despido ni en plazos;
  - honorarios de Mendoza, que no muestran la regla del máximo del grado precedente;
  - la tasa de justicia de Mendoza, sin norma (C-11).

---

## 5. Observaciones sin hallazgo formal

- **Dato raro en la RIPTE:** la API de datos.gob.ar devuelve para `158.1_REPTE_0_0_5` el valor de 2026-08-01 = 1.915.878,76, idéntico al de 2026-06-01. Puede ser un error de la fuente. Antes de usarlo, conviene verificarlo con la publicación de la Secretaría de Trabajo. **[No verificado]**
- **Calendario oficial:** la página HTML de argentina.gob.ar mostraba «Hoy es feriado» el 20/11/2026, pero el JSON oficial ubica el feriado de la Soberanía el 23/11/2026, que es lo que hace el código. Tomamos el JSON como dato.
- **Ley 27.802, Título II (Fondo de Asistencia Laboral):** su vigencia se prorrogó al 01/12/2026 (Decreto 408/2026, texto según el Decreto 1228/2026, según la nota de InfoLEG). No afecta los cálculos actuales.
- **Costas en juicios laborales:** el art. 277 LCT (texto de la Ley 27.802) mantiene el tope del 25 % del monto de la sentencia para las costas de primera instancia, honorarios incluidos, con prorrateo. Las calculadoras de honorarios y de liquidación deberían advertirlo en procesos laborales.

---

## 6. Fuentes consultadas

- Calendario oficial de feriados 2026, en formato JSON: <https://www.argentina.gob.ar/sites/default/files/holidays-2026-es.json>. Página: <https://www.argentina.gob.ar/jefatura/feriados-nacionales-2026>.
- Resolución JGM 164/2025 (no laborables turísticos de 2026): <https://www.argentina.gob.ar/normativa/nacional/421799/texto>.
- Decreto 1103/2026 (feriado del 9/11/2026), por fuente secundaria: <https://www.palabrasdelderecho.com.ar/articulo/7017/Se-oficializo-el-feriado-nacional-para-el-lunes-9-de-noviembre-por-la-visita-del-Papa-Leon-XIV> y <https://chequeado.com/el-explicador/visita-del-papa-leon-xiv-cuales-son-los-feriados-del-9-10-y-11-de-noviembre-y-donde-rigen/>.
- Ley 9001 de Mendoza (CPCCyT), texto actualizado: <https://www.argentina.gob.ar/normativa/provincial/ley-9001-123456789-0abc-defg-100-9000mvorpyel/actualizacion>.
- Acordada SCJM 31.699 (plazo de gracia), transcripta: <https://aldiaargentina.microjuris.com/2024/10/28/legislacion-mendoza-la-suprema-corte-determino-que-no-rige-el-plazo-de-gracia-cuando-el-modo-de-ingresar-el-escrito-judicial-sea-a-traves-de-la-presentacion-electronica-digital/>.
- Acordada SCJM 32.674 (receso de julio de 2026), en el B.O. de Mendoza: <https://www.elsol.com.ar/wp-content/uploads/2026/07/pedido_320370_07072026.pdf>. Acordada SCJM 32.453 (feria de enero de 2026): <https://jusmendoza.gob.ar/wp-content/uploads/2026/01/Feria-Judicial-Enero-2026-Modificatoria-Acordada-N°-32453.pdf>.
- Acordada CSJN 11/2026 (feria de invierno), por fuente secundaria: <https://aldiaargentina.microjuris.com/2026/06/05/legislacion-csjn-se-establece-la-feria-judicial-de-invierno-desde-el-20-hasta-el-31-de-julio-de-2026/>.
- Ley 27.742: <https://www.argentina.gob.ar/normativa/nacional/norma-401266/texto>.
- Ley 27.802: <https://www.argentina.gob.ar/normativa/nacional/ley-27802-423680/texto>. Sobre la cautelar de la CGT, por prensa: <https://www.cronista.com/economia-politica/uno-por-uno-los-articulos-de-la-reforma-laboral-que-fueron-suspendidos-por-la-justicia>.
- Ley 27.423: <https://www.argentina.gob.ar/normativa/nacional/ley-27423-305057/actualizacion>.
- Ley 9131 de Mendoza: <https://colabogmza.com.ar/wp-content/uploads/2024/12/Regulan-aranceles-de-Abogados-y-Procuradores.pdf>. SCJM, sentencias sobre los arts. 2, 7 y 18: <https://www2.jus.mendoza.gov.ar/listas/proveidos/vertexto.php?ide=10773695277>.
- Código Civil y Comercial, texto actualizado: <https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion>. Texto original: <https://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/norma.htm>.
- API de Estadísticas del BCRA v4.0: <https://api.bcra.gob.ar/estadisticas/v4.0/monetarias>. Series de tiempo: <https://apis.datos.gob.ar/series/api/series/>.
- **No accesibles desde este entorno (403 o DNS):** boletinoficial.gob.ar, csjn.gov.ar y saij.gob.ar. Los datos que dependen de ellos están marcados **[No verificado]**.
