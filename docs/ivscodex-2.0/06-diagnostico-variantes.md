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
