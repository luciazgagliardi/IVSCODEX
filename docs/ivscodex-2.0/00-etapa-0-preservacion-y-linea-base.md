# IVS CODEX 2.0 — Etapa 0: preservación y línea de base

**Estado:** en curso.  
**Rama:** architecture/ivscodex-2-scope.  
**PR:** #75, borrador, sin fusionar.  
**Regla operativa:** ningún cambio destructivo en Azure, en el acervo activo ni en la rama acervo hasta verificar respaldo y restauración.

## 1. Identificadores de la línea de base

| Elemento | Estado comprobado |
|---|---|
| main auditado | 1ef4de0221f4c4d8aca8227926cc00994f91013a |
| Rama de datos acervo | 13963f2cb8d337e2f085fb3c8eac28c761a86598 |
| Versión del manifiesto de acervo | 20261122-36a843d6 |
| Fecha de generación del manifiesto | 2026-11-22 15:47:37 UTC |
| Estado de la nueva línea IVS Codex 2.0 | PR #75 en borrador; no fusionada |

El manifiesto de la rama acervo declara estos conteos:

| Colección | Registros declarados |
|---|---:|
| CABA | 21.129 |
| CSJN | 61.810 |
| Catamarca | 5.160 |
| Chubut | 12.242 |
| Dialnet | 4.334 |
| HUDOC | 17.992 |
| Jujuy | 36.922 |
| Juristeca | 37.624 |
| Mendoza | 47.052 |
| Mendoza Legal | 180 |
| Río Negro | 412 |
| SAIJ | 779.900 |
| Santa Cruz | 2.769 |
| SCBA | 40.645 |
| TFN | 14.693 |

**No sumar estas filas para anunciar documentos únicos:** CSJN es un conteo transversal/subconjunto del corpus SAIJ y puede haber solapamientos entre colecciones y canales. El número correcto de documentos únicos debe obtenerse de la clave canónica y de una medición del índice, no de sumar los contadores del manifiesto.

## 2. Qué contiene hoy la rama de datos

Inspección del árbol Git de acervo:
- 85 archivos blob.
- 487.476.730 bytes (aprox. 487,5 MB decimales) en el árbol actual.
- Incluye las tandas normalizadas declaradas en manifiesto.json, archivos crudos bajo _fuentes/, avances de cosecha bajo _avance/ y reportes bajo _reportes/.

Esta cifra es el contenido del árbol actual de la rama, **no el tamaño completo del repositorio Git ni del almacenamiento de Azure**. El informe de Claude había informado un tamaño mayor para el repositorio completo; no se debe confundirlo con el árbol de datos activo.

## 3. Acoplamiento actual entre código, publicación y datos

Verificado en .github/workflows/azure-backend.yml:
1. El workflow hace checkout del código de main.
2. Hace checkout de la rama acervo dentro de backend/acervo-datos.
3. Elimina el subdirectorio .git del checkout de datos.
4. Ejecuta npm ci y despliega la carpeta backend completa a Azure App Service.

Verificado en backend/index.js, backend/config.js y backend/lib/acervo.js:
- El servidor usa /home/datos como almacenamiento persistente en Azure App Service.
- El arranque compara el manifiesto con el SQLite activo y puede importar una versión nueva.
- La importación usa archivos temporales y un puntero de publicación; la base anterior puede seguir disponible mientras se prepara la nueva.
- Las cosechas de runtime se guardan en /home/datos/acervo/cosechas/ y se vuelven a incorporar a futuras versiones.

**Consecuencia:** la rama acervo no contiene por sí sola todo el estado que debe preservarse. En particular, las cosechas runtime, el índice incremental, las cuentas y sus datos están fuera del árbol de datos versionado.

## 4. Inventario de datos productivos que se debe respaldar

Antes de cambiar almacenamiento, rutas o importador se debe obtener una instantánea consistente de:

1. /home/datos/acervo-activo.json y el manifiesto que identifica la versión desplegada.
2. La base SQLite activa señalada por el puntero, junto con los archivos WAL/SHM pertinentes o una copia SQLite coherente obtenida mediante un mecanismo de respaldo en línea.
3. Las generaciones SQLite anteriores que todavía sean necesarias para rollback.
4. /home/datos/acervo/cosechas/ (incluye registros capturados por el servidor después de la versión original).
5. /home/datos/indice/ (índices incrementales y estado de fuentes).
6. /home/datos/usuarios/ y archivos de cuentas/sesiones/datos de usuario que existan.
7. /home/datos/cache/ y /home/datos/ocr-cache/ cuando sean necesarios para reanudar procesos; la caché reconstruible puede respaldarse con menor prioridad.
8. Variables de configuración no secretas, nombres de variables secretas y estado de presencia de cada una. **Nunca escribir valores de secretos en logs ni en el repositorio.**

Una copia del manifiesto de acervo no sustituye este respaldo. Tampoco se debe copiar en caliente el archivo .db ignorando sus WAL: la instantánea debe ser consistente con SQLite.

## 5. Última observación histórica de Azure que requiere reconfirmación

En la inspección SSH compartida el 22/11/2026:
- El puntero activo señalaba la versión 20261122-36a843d6.
- La base de esa generación rondaba 1,88 GB.
- Su WAL rondaba 605 MB.
- La carpeta de cosecha CABA rondaba 557 MB.

Son datos de una captura anterior, no una lectura en tiempo real del 23/11. Antes de respaldar o migrar se debe volver a consultar el estado real, los tamaños, el espacio libre y el proceso activo. No se deben asumir los tamaños ni los nombres de archivo anteriores.

## 6. Huecos que la primera corrección técnica empieza a cerrar

El manifiesto activo inspeccionado contiene version, generado, archivos y conteos, pero no un hash SHA-256 por tanda.

En la versión anterior del importador:
- una línea JSONL no parseable se ignoraba silenciosamente;
- no se comparaban los conteos finales importados con los conteos declarados por el manifiesto;
- no se rechazaba explícitamente un ID repetido que INSERT OR IGNORE omitiera.

La PR #75 agrega:
- SHA-256 por tanda comprimida para los manifiestos nuevos;
- verificación del hash antes de descomprimir;
- nombres de archivo restringidos al patrón esperado;
- validación de id y fuente;
- rechazo de JSON inválido y documentos duplicados;
- comparación exacta de conteos;
- compatibilidad con manifiestos antiguos sin sección de integridad.

La nueva validación se prueba sobre fixtures. **Todavía no se ha ejecutado contra una importación completa del corpus productivo.**

## 7. Plan de respaldo y restauración

### 7.1 Captura
- Reconsultar versión activa y directorios de datos.
- Inventariar tamaños y espacio libre.
- Crear una copia SQLite coherente sin interrumpir escrituras de forma insegura.
- Respaldar cosechas, índices incrementales, usuarios y manifiestos.
- Calcular SHA-256 de cada artefacto.
- Guardar los hashes y tamaños en un inventario separado del contenido.
- Mantener al menos dos generaciones y una copia externa.

### 7.2 Restauración de prueba
- Restaurar en un directorio temporal o instancia aislada, nunca sobre producción.
- Verificar hashes.
- Ejecutar PRAGMA quick_check y la comprobación de integridad FTS5.
- Comparar conteos por fuente, documentos únicos y metadatos.
- Ejecutar un conjunto de consultas de referencia, incluyendo términos acentuados, conectores en frases exactas, variantes y filtros de jurisdicción/año.
- Comprobar lectura de documentos originales y procedencia.
- Medir tiempos y confirmar que el puntero activo no cambió.

### 7.3 Criterio para habilitar migraciones
No se autoriza eliminar archivos, limpiar generaciones anteriores, cambiar el puntero de producción ni sustituir el almacenamiento hasta que:
- exista una copia externa verificada;
- una restauración aislada haya pasado integridad SQLite/FTS;
- la recuperación de referencia sea igual o mejor que la versión actual;
- la plataforma pueda volver a la versión anterior sin reconstruir el corpus desde cero.

## 8. Línea de base funcional que debe mantenerse

La línea de base debe medir por separado:
- consulta local FTS;
- consulta directa a fuente oficial;
- proxy autorizado;
- fuente alternativa;
- fallo de acceso;
- cero auténtico;
- búsqueda por frase exacta;
- búsqueda por artículo y norma;
- paginación completa;
- lectura del documento original;
- deduplicación y procedencia;
- consultas simultáneas de distintos usuarios.

Las pruebas históricas de disponibilidad y latencia de 20–22/11 sirven como antecedente, no como certificación actual. La prueba de 39/40 intentos remotos tampoco acredita estabilidad sostenida ni exhaustividad.

## 9. Estado de seguridad de esta etapa

- No se modificó main.
- No se desplegó a Azure ni a GitHub Pages.
- No se cambió el puntero del acervo.
- No se borró ni sobrescribió ningún dato productivo.
- La única modificación funcional propuesta está aislada en PR #75 y requiere pasar CI y revisión antes de fusionarse.
