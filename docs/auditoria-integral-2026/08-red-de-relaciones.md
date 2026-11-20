# 8. Red de relaciones jurídicas

**Implementado:** `backend/lib/redJuridica.js`, que extrae aristas con evidencia de un documento, y `backend/test/redJuridica.prueba.js`.
**Reutiliza:** el analizador del Lector (`frontend/analisis-fallo.js`: `detectar` e `IVSAnalisis`), que ya trabaja con reglas deterministas y grados de certeza. No se agregaron dependencias ni IA.

## 8.1 Principio rector

Una red que afirme que un fallo «sigue» o «abandona» un criterio sin que una persona lo haya leído induce a error de la peor manera, porque presenta una conclusión jurídica como un dato. Por eso las relaciones se dividen en dos clases:

| Clase | Relaciones | Quién las crea | Cómo se muestran |
|---|---|---|---|
| **Textuales** (el texto lo dice) | `menciona_norma`, `cita_precedente`, `confirma`, `revoca`, `modifica`, `anula` | Extracción automática, con la evidencia literal y su posición | «Menciona», «cita», «resolvió», con el pasaje |
| **Interpretativas** (exigen lectura jurídica) | `aplica`, `interpreta`, `sigue`, `distingue`, `limita`, `abandona`, `contradice`, `complementa`, `comenta`, `deriva_de` | Solo una persona, con nota y fecha (estado `revisada`) | Solo si fueron revisadas, con autoría |

`menciona_norma` es deliberadamente distinta de `aplica`: un fallo puede citar el art. 52 bis de la Ley 24.240 para decir que no corresponde aplicarlo. La prueba `redJuridica.prueba.js` fija esa regla y verifica que ninguna relación interpretativa se genere sola.

## 8.2 Modelo de datos propuesto (SQLite, junto al acervo FTS5)

```sql
CREATE TABLE nodos(
  id TEXT PRIMARY KEY,            -- 'doc:<fuente>:<id>' | 'norma:ccyc:1748' | 'precedente:fallos:300:936' | 'concepto:saij:8333'
  tipo TEXT NOT NULL,             -- documento | norma | articulo | precedente | concepto | tribunal | magistrado
  rotulo TEXT NOT NULL,
  datos TEXT                      -- JSON: jurisdicción, instancia, fecha, fuente, URL de origen
);
CREATE TABLE aristas(
  origen TEXT NOT NULL REFERENCES nodos(id),
  relacion TEXT NOT NULL,         -- ver 8.1
  destino TEXT NOT NULL REFERENCES nodos(id),
  evidencia TEXT,                 -- pasaje literal
  ini INTEGER, fin INTEGER,       -- posición en el texto del origen
  metodo TEXT NOT NULL,           -- 'regla:articulo-con-norma-explicita' | 'revision:<usuario>'
  certeza TEXT NOT NULL,          -- confirmado | probable | no_confirmado
  estado TEXT NOT NULL,           -- extraida | requiere_revision | revisada | rechazada
  creada TEXT NOT NULL,
  PRIMARY KEY (origen, relacion, destino)
);
CREATE INDEX aristas_destino ON aristas(destino, relacion);
CREATE TABLE revisiones(origen TEXT, relacion TEXT, destino TEXT, usuario TEXT, nota TEXT, fecha TEXT);
```

- **Normalización de normas:** se usa la clave que ya produce el Lector (`NORMA_A_CLAVE`: `ccyc:1748`, `lct:245`). Así un artículo se conecta con el tesauro (`normas` de los anillos, p. ej. `ccyc:1741` → daño moral) y con la sección Norma (InfoLeg).
- **Conceptos:** cada documento se vincula a los descriptores SAIJ/SCJM que trae en sus voces (`voces` del acervo) con `trata_de`. La relación ya está en los datos del tribunal y no es una inferencia.

## 8.3 Medición sobre una sentencia real

Sentencia de la 2ª Cámara Civil de Mendoza, del 15/12/2025: confirmó una condena por daños derivados de violencia de género. Se obtuvo del enlace oficial que devolvió la búsqueda de CC.

| Relación | Cantidad | Certeza |
|---|---|---|
| menciona_norma | 23 | confirmado (norma explícita junto al artículo) |
| confirma | 1 | confirmado («Rechazar el recurso de apelación… que se confirma en todas sus partes») |

Al construir la red apareció un error de atribución del Lector, que **ya está corregido**: «art. 1748 del Cód. Civ. y Com.» se atribuía al Código Civil derogado y «Art. 26 del C. Penal» a la Ley 26.485. La causa era que el punto de la abreviatura cortaba la ventana de lectura (`frontend/analisis-fallo.js`, `finDeVentana`). Tiene prueba de regresión en `backend/test/analisis.prueba.js`.

## 8.4 Cómo ayudaría a reconstruir la evolución de un criterio

1. **Por norma:** «¿qué fallos mencionan el art. 1748 CCyC?», ordenados por fecha y tribunal, con el pasaje. Es la base para separar lo que menciona de lo que interpreta: la persona marca `interpreta` y queda registrado.
2. **Por cadena de instancias:** las aristas `confirma` y `revoca` de la parte resolutiva, unidas por número de expediente o CUIJ (el Lector ya lo extrae), reconstruyen el recorrido de un caso: primera instancia, Cámara y SCJM.
3. **Por precedente:** «¿quién cita Fallos 300:936?». Con las relaciones revisadas (`sigue`, `distingue`, `abandona`), la vista de evolución muestra una línea temporal donde cada cambio de criterio lleva su autoría y su pasaje. Las posiciones contrapuestas se muestran en columnas separadas y nunca se mezclan como «doctrina pacífica».
4. **Por hechos:** el vocabulario reconoce los conceptos de una consulta fáctica («filtración de agua del vecino» → voz SCJM «FILTRACIONES DE AGUA») y la red los conecta con las normas que mencionan los fallos indexados con esa voz. Se presenta como **expansión investigativa**, rotulada, no como un encuadre jurídico afirmado.

## 8.5 Próximos pasos (ver `10-pendientes.md`)

1. Ejecutar `aristasDeDocumento` al importar el acervo (`acervoImportar.js`) y persistir en las tablas de 8.2. El costo se mide en el acervo real de Azure, que no está en este entorno.
2. Exponer `GET /api/red/norma/:clave` y `GET /api/red/documento/:id`.
3. Agregar en el Lector el panel «Relaciones de este fallo» y, en Buscar, el filtro «menciona el art. X».
4. Agregar la interfaz de revisión para las relaciones interpretativas.
