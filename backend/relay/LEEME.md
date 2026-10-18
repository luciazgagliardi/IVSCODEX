# Relevo para el TSJ de CABA

El TSJ de CABA no deja leer sus PDF desde el servidor publicado (Azure): su
protección de Cloudflare le responde 403 a los centros de datos. Este relevo
lo resuelve, gratis, con un Worker de Cloudflare.

## Pasos (una sola vez)
1. Cree una cuenta gratuita en https://dash.cloudflare.com (no pide tarjeta).
2. Menú **Workers & Pages** → **Create** → **Create Worker** → nómbrelo `ivs-rele` → **Deploy**.
3. En ese Worker: **Edit code** → borre lo que hay → pegue todo el contenido de `cloudflare-worker.js` → **Deploy**.
4. En **Settings → Variables and Secrets → Add** → tipo **Secret**, nombre `RELE_CLAVE`, valor: una clave larga al azar (40 o más caracteres). Guárdela.
5. Copie la dirección del Worker (algo como `https://ivs-rele.SU-USUARIO.workers.dev`).
6. En Azure (App Service **IURIS** → Environment variables) agregue:
   - `RELE_URL` = la dirección del paso 5
   - `RELE_CLAVE` = la misma clave del paso 4
7. Aplique y espere el reinicio. Pruebe en Buscar → TSJ: los resultados deben mostrar el pasaje.

Si el TSJ también bloqueara a Cloudflare, el resultado seguirá sin texto y la
aplicación lo avisa; en ese caso queda el botón «Descargar y abrir en el Lector».

## Resultado de la prueba (18/10/2026)
Se instaló y se probó: el servidor publicado envía el pedido al Worker, el Worker
acepta la clave y llega al TSJ, pero el TSJ (www-test.tsjbaires.gov.ar) responde
403 también a Cloudflare. Es probable que ese sitio solo atienda conexiones
desde Argentina o de redes domésticas. Por lo tanto este relevo NO resuelve el
TSJ, y se puede quitar `RELE_URL` y `RELE_CLAVE` de Azure sin consecuencias.
Se conserva por si el TSJ cambia su política o si se consigue un relevo con
salida desde Argentina.
