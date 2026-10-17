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
