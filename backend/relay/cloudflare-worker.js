/**
 * Relevo para los PDF del TSJ de CABA — Worker de Cloudflare (plan gratuito).
 *
 * Por qué existe: www.tsjbaires.gov.ar está detrás de Cloudflare y le responde
 * 403 a las IP de los centros de datos (como la de Azure, donde corre este
 * backend). Este Worker pide el documento desde la red de Cloudflare y se lo
 * devuelve al backend. Sin él, los resultados de CABA salen sin el texto.
 *
 * Seguridad: solo atiende pedidos con la clave compartida (RELE_CLAVE) y solo
 * hacia dominios de la lista, para que nadie lo use como proxy abierto.
 *
 * Instalación (5 minutos, sin tarjeta): ver backend/relay/LEEME.md
 */

const PERMITIDOS = ['tsjbaires.gov.ar'];

export default {
  async fetch(request, env) {
    const entrada = new URL(request.url);
    // La clave se compara a tiempo constante.
    const dada = entrada.searchParams.get('k') || '';
    const esperada = env.RELE_CLAVE || '';
    if (!esperada || dada.length !== esperada.length || !igual(dada, esperada)) {
      return new Response('No autorizado', { status: 401 });
    }
    let destino;
    try { destino = new URL(entrada.searchParams.get('url') || ''); } catch { return new Response('Falta la dirección', { status: 400 }); }
    const host = destino.hostname.toLowerCase();
    if (destino.protocol !== 'https:' && destino.protocol !== 'http:') return new Response('Protocolo no permitido', { status: 400 });
    if (!PERMITIDOS.some((d) => host === d || host.endsWith('.' + d))) return new Response('Dominio no permitido', { status: 403 });

    const respuesta = await fetch(destino.toString(), {
      redirect: 'manual', // las redirecciones las sigue el backend, validando cada salto
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IVS-CODEX)',
        Accept: 'application/pdf,text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    });
    const cabeceras = new Headers();
    for (const h of ['content-type', 'content-length', 'content-disposition', 'location']) {
      const v = respuesta.headers.get(h);
      if (v) cabeceras.set(h, v);
    }
    return new Response(respuesta.body, { status: respuesta.status, headers: cabeceras });
  },
};

function igual(a, b) {
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
