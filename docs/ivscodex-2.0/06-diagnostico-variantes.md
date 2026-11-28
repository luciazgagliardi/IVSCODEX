# IVS Codex 2.0 — Diagnóstico de variantes de consulta

Base técnica: 230444cd750adec60b6fd68d8a1f5806a6271066 (PR #77 integrado).
CI de base: https://github.com/luciazgagliardi/IVSCODEX/actions/runs/45710493170

## Objetivo

La batería v1.2.0 tiene ocho consultas principales y dieciséis variantes que no se ejecutaban en las pruebas anteriores. El diagnóstico nuevo ejecuta las 24 formulaciones mediante el filtro real y el índice temporal, con el mismo corpus provisional. Registra IDs recuperados, positivos omitidos, negativos recuperados, registros sin etiqueta y duplicados, por formulación y capa. No modifica las consultas para que coincidan artificialmente.

`cd backend && node --test test/corpusVariantes.prueba.js`

Las ocho formulaciones principales conservan sus aserciones estrictas. Las variantes se informan como diagnóstico exploratorio, sin convertir una prueba de ejecución verde en aceptación de recuperación. Una omisión o un negativo recuperado requiere análisis y revisión jurídica; el informe TAP registra ambos. Ninguno de los casos adquiere elegibilidad para métricas. El texto completo en el campo sumario no reproduce los campos de los portales; no se valida ranking global, paginación, latencia ni conectores externos.

## Seguridad de ejecución

El workflow antiguo registró la ejecución de push fallida https://github.com/luciazgagliardi/IVSCODEX/actions/runs/45710490702 con cero jobs. Se propone un disparador explícito para push en la rama técnica, y validación de sintaxis también en PR hacia ella. El job de red tiene una URL de Azure de producción fija; queda limitado a ejecución manual desde main. La concurrencia se separa por ref y evento. No se ejecuta el diagnóstico de red en 2.0.

## Fuentes pendientes

La nueva comprobación del boletín oficial de noviembre de 2025 confirma el expediente SAL 44430/25-0 y fecha 05/11/2025 de Pompeya, pero no se obtuvo el destino individual del hipervínculo. Berro tampoco cuenta con localizador primario directo verificado. No se promueve ningún candidato ni se altera el corpus.

## Estado de aceptación

Pendiente de CI del nuevo commit y revisión jurídica independiente. Sin despliegue, sin cambio de main, sin contacto con Azure ni acervo persistente.

## Hallazgos preliminares del 28/11/2026

Reproducción independiente de las reglas de coincidencia estricta (normalización de tildes, raíces de seis caracteres y coincidencia numérica completa) sobre los ocho fixtures de la base 230444c. No ejecuta el módulo real ni el índice, no incluye la reparación de mojibake y no sustituye el nuevo diagnóstico CI.

- 8/8 formulaciones principales con conjunto exacto.
- 12/16 variantes con conjunto exacto según las etiquetas provisionales.
- 3 variantes omiten el positivo y 2 recuperan un negativo (una presenta ambos defectos).

| Caso | Variante | Observación |
|---|---|---|
| REC-MZA-LAB-001 | despido y trato discriminatorio de una trabajadora bancaria | Omite Berro (raíz bancar ausente); incorpora Godoy |
| REC-MZA-FAM-001 | cómo se calcula la base de honorarios del abogado en una causa de alimentos definitivos | Recupera Codina y también Godoy |
| REC-MZA-CONS-001 | compré una cuna por internet y el transporte perdió el paquete | Omite Baldoni (raíz perdio ausente) |
| REC-MZA-CONS-002 | plan de ahorro de un vehículo con seguro y discusión sobre devolución de cuotas | Omite Garay (raíz discus ausente) |

No son métricas oficiales. Debe confirmarse el comportamiento en el módulo e índice reales con el nuevo test. No se deben retocar las variantes para forzar coincidencia: investigar expansión de equivalencias con anclaje jurídico, tratamiento de negaciones y verbos de hechos, y ruido de raíces presentes en citas o antecedentes. Comparar precisión y omisiones sin modificar las etiquetas antes de revisión independiente.

## Confirmación en CI y corrección de coherencia

CI de 83bfa51: https://github.com/luciazgagliardi/IVSCODEX/actions/runs/46138199762 — 309/309, sintaxis frontend 8+10. Los logs del job 140958112135 confirman los cuatro casos problemáticos y muestran que el índice JSON, a diferencia del filtro estricto, recupera Baldoni y Garay mediante relajación silenciosa, incluyendo respectivamente uno y dos negativos. La ruta local anunciaba `aflojado:false` incluso en esa situación. El índice ahora exige todas las raíces por defecto; sólo el llamante que pida `aflojar:true` puede obtener la relajación. La búsqueda relajada numérica usa límites de dígitos, igual que la estricta. La batería compara filtro estricto, índice estricto, índice flexible y expansión de variantes verificadas por el vocabulario real, sin introducir equivalencias no verificadas ni retocar el corpus. Las omisiones del modo estricto siguen siendo brechas de recuperación, no se ocultan.

El workflow antiguo volvió a fallar sin jobs en 46138194494. Se amplió también el workflow independiente de sintaxis a las ramas auxiliares y PR de 2.0. No se da por resuelta la anomalía antigua hasta comprobar una ejecución real. La nueva CI queda pendiente de verificación.

## Aislamiento adicional del diagnóstico remoto (28/11/2026)

La CI del commit 5a191735568f09242c923a27c9a588ee0d82ac6f confirmó 311 pruebas aprobadas, ninguna fallida, y sintaxis del frontend validada (8 scripts inline y 10 archivos JS): https://github.com/luciazgagliardi/IVSCODEX/actions/runs/46143203803. La validación de sintaxis separada también concluyó correctamente: https://github.com/luciazgagliardi/IVSCODEX/actions/runs/46143203818. El workflow heredado `diagnosticar-en-vivo.yml` sigue fallando sin jobs en https://github.com/luciazgagliardi/IVSCODEX/actions/runs/46143199828; por tanto no se presenta como validación superada ni se supone su causa raíz.

Para evitar disparadores automáticos redundantes en 2.0, el workflow heredado se restringe a `workflow_dispatch`. El job que consulta las fuentes permanece además limitado a `refs/heads/main`, de modo que un dispatch en una rama técnica no consulta los endpoints. La validación automática segura de sintaxis permanece en `validar-diagnostico-2.0.yml`. No se disparó el workflow manual, ni se consultó Azure o producción. Este cambio sólo vive en la rama aislada; no altera los workflows actualmente activos en main. La desaparición de nuevas ejecuciones fallidas del workflow heredado deberá comprobarse en futuros pushes, sin atribuirla a una corrección del error de GitHub sin diagnóstico de causa.
