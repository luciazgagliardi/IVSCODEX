/**
 * Cliente de JUBA, el buscador de jurisprudencia de la Suprema Corte de la
 * Provincia de Buenos Aires (juba.scba.gov.ar).
 *
 * Es un formulario ASP.NET (WebForms) sin captcha: hay que pedir la página una
 * vez para obtener su estado oculto (__VIEWSTATE y compañía) y la cookie de
 * sesión, y después mandarlo de vuelta con la consulta. Medido en vivo:
 *
 *   - "daño moral" da 2.737 sumarios (y 22.434 fallos que lo mencionan en su
 *     texto completo). Cada página trae 20 sumarios con su texto, las voces, las
 *     normas citadas y los datos del fallo: tribunal, causa, fecha, carátula,
 *     magistrados y un enlace a su texto completo (VerTextoCompleto.aspx).
 *   - Busca TODAS las palabras, en cualquier orden ("moral daño" da lo mismo) y
 *     no entiende comillas ('"daño moral"' da cero). La frase exacta se exige de
 *     este lado, sobre el texto del sumario.
 *   - No pagina por URL: se pasa de página con el propio control del sitio
 *     ("Ir a página"), mandando el estado oculto de la página anterior. Por eso
 *     se guarda la sesión de cada consulta unos minutos.
 */

import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { enCola } from './almacen.js';
import { errores } from './errores.js';
import { paginarFiltrado } from './paginarFiltrado.js';

const HOST = 'juba.scba.gov.ar';
const URL_BUSCAR = `https://${HOST}/Buscar.aspx`;
const POR_PAGINA_SITIO = 20;

/* ---------- formulario ---------- */

const ENTIDADES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', ordm: 'º', ordf: 'ª' };
const decodificar = (t) =>
  String(t || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTIDADES[e] ?? m);

/** Los campos ocultos y de texto del formulario, como los mandaría el navegador. */
function camposDe(html) {
  const campos = {};
  for (const [tag] of String(html).matchAll(/<input\b[^>]*>/gi)) {
    const attr = (n) => decodificar(new RegExp(`\\b${n}="([^"]*)"`, 'i').exec(tag)?.[1] ?? '');
    const tipo = attr('type').toLowerCase();
    const nombre = attr('name');
    if (nombre && (tipo === 'hidden' || tipo === 'text' || !tipo)) campos[nombre] = attr('value');
  }
  return campos;
}

async function pedir(url, { cookie = '', cuerpo = null } = {}) {
  await esperarTurno(HOST);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: cuerpo ? 'POST' : 'GET',
      signal: control.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': `Mozilla/5.0 (compatible; ${USER_AGENT})`,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
        Referer: URL_BUSCAR,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(cuerpo ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: cuerpo ? new URLSearchParams(cuerpo).toString() : undefined,
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('scba', `respuesta ${resp.status}`);
    const nuevas = (resp.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
    return { html: await resp.text(), cookies: nuevas };
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('scba', e?.cause?.code || e?.message);
  } finally {
    clearTimeout(reloj);
  }
}

const unirCookies = (vieja, nuevas) => {
  const m = new Map(String(vieja || '').split('; ').filter(Boolean).map((c) => [c.split('=')[0], c]));
  for (const c of nuevas) m.set(c.split('=')[0], c);
  return [...m.values()].join('; ');
};

/* ---------- sesiones por consulta ---------- */

const SESIONES = new Map(); // consulta -> { cookie, campos, pagina, total, html, hasta }
const VIDA_SESION_MS = 10 * 60_000;

async function abrir(q) {
  const inicio = await pedir(URL_BUSCAR);
  let cookie = unirCookies('', inicio.cookies);
  const campos = camposDe(inicio.html);
  campos['ctl00$cphMainContent$txtExpresionBusquedaRapida'] = q;
  campos['ctl00$cphMainContent$btnUnicaBusqueda'] = 'Buscar';
  campos['ctl00$cphMainContent$ddlMateria'] = 'Todos';
  const r = await pedir(URL_BUSCAR, { cookie, cuerpo: campos });
  cookie = unirCookies(cookie, r.cookies);
  const total = Number(/en Texto del Sumario \((\d+)\)/.exec(r.html)?.[1] || /Resultado:\s*\d+\s*de\s*(\d+)/.exec(r.html)?.[1] || 0);
  return { cookie, campos: camposDe(r.html), pagina: 1, total, html: r.html, hasta: Date.now() + VIDA_SESION_MS };
}

/** El HTML de la página `n` de resultados de `q` (1 = la primera). */
function paginaDe(q, n) {
  return enCola(`scba|${q}`, async () => {
    let s = SESIONES.get(q);
    if (!s || s.hasta < Date.now()) {
      s = await abrir(q);
      if (SESIONES.size > 40) SESIONES.clear();
      SESIONES.set(q, s);
    }
    if (s.pagina !== n && s.total) {
      const campos = { ...s.campos };
      delete campos['ctl00$cphMainContent$btnUnicaBusqueda'];
      campos.__EVENTTARGET = 'ctl00$cphMainContent$lnkIrPagina';
      campos.__EVENTARGUMENT = '';
      campos['ctl00$cphMainContent$ddlPaginaResultados'] = String(n);
      const r = await pedir(URL_BUSCAR, { cookie: s.cookie, cuerpo: campos });
      s.cookie = unirCookies(s.cookie, r.cookies);
      s.campos = camposDe(r.html);
      s.html = r.html;
      s.pagina = n;
    }
    s.hasta = Date.now() + VIDA_SESION_MS;
    return { html: s.html, total: s.total };
  });
}

/* ---------- lectura de resultados ---------- */

const texto = (html) =>
  decodificar(String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|td|li|span)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

function parsear(html) {
  const registros = [];
  const trozos = String(html).split(/Resultado:\s*\d+\s*de\s*\d+/).slice(1);
  for (const trozo of trozos) {
    const lineas = texto(trozo);
    const numero = lineas.map((l) => /^([A-Z]\d{6,8})$/.exec(l)?.[1]).find(Boolean);
    if (!numero) continue;
    const iNumero = lineas.findIndex((l) => l === numero);
    const materia = lineas.slice(0, iNumero).find((l) => /^[A-ZÁÉÍÓÚÑ ,]+$/.test(l)) || '';
    // las voces: la línea con barras que sigue al número
    const vocesLinea = lineas.slice(iNumero + 1, iNumero + 3).find((l) => l.includes('|')) || '';
    const voces = vocesLinea.split('|').map((v) => v.trim()).filter(Boolean);
    // el sumario: el renglón más largo (es el texto de la doctrina)
    const sumario = lineas.slice(iNumero + 1).reduce((a, b) => (b.length > a.length && !/^Car[áa]tula:|^Magistrados/.test(b) ? b : a), '');
    const linea = (re) => lineas.map((l) => re.exec(l)?.[1]).find(Boolean) || '';
    const caratula = linea(/^Car[áa]tula:\s*(.+)$/);
    const magistrados = linea(/^Magistrados Votantes:\s*(.+)$/);
    const fallo = lineas.find((l) => /^[A-Z]{2}\d{4}\b.*\b\d{2}\/\d{2}\/\d{4}\b/.test(l)) || '';
    const fecha = /\b(\d{2}\/\d{2}\/\d{4})\b/.exec(fallo)?.[1] || '';
    const codigo = /^([A-Z]{2}\d{4}(?:\s+[A-Z]{2})?)/.exec(fallo)?.[1] || '';
    const causa = /^[A-Z]{2}\d{4}(?:\s+[A-Z]{2})?\s+(\d+)/.exec(fallo)?.[1] || '';
    const idFallo = /VerTextoCompleto\.aspx\?idFallo=(\d+)/i.exec(trozo)?.[1];
    registros.push({
      id: `scba_${numero}`,
      expediente: [causa && `Causa ${causa}`, `Sumario ${numero}`].filter(Boolean).join(' · '),
      caratula: caratula || voces.join(' · ') || `Sumario ${numero}`,
      tribunal: [/^SC/.test(codigo) ? 'Suprema Corte de Buenos Aires' : codigo, materia && materia.charAt(0) + materia.slice(1).toLowerCase()].filter(Boolean).join(' · '),
      fecha,
      sumario,
      voces,
      magistrados,
      linkFicha: null,
      linkFallo: idFallo ? `https://${HOST}/VerTextoCompleto.aspx?idFallo=${idFallo}` : null,
    });
  }
  return registros;
}

/**
 * Busca en JUBA. Misma forma de entrada y de salida que los otros clientes
 * (ver lib/fuentes.js). "todas" y "alguna" van tal cual (el sitio exige todas
 * las palabras); la frase exacta se filtra de este lado, sobre el sumario.
 */
export async function buscarScba({ q, modo = 'todas', excluir = '', pagina = 1, porPagina = 20, desde = null, anioDesde = null, anioHasta = null }) {
  const termino = String(q || '').trim();
  if (!termino) throw errores.consultaVacia();
  const arranque = desde === null ? (Math.max(1, pagina) - 1) * POR_PAGINA_SITIO : Math.max(0, desde);

  let totalSitio = 0;
  const traer = async (offset) => {
    const n = Math.floor(offset / POR_PAGINA_SITIO) + 1;
    const { html, total } = await paginaDe(termino, n);
    totalSitio = total;
    if (!total || (n - 1) * POR_PAGINA_SITIO >= total) return [];
    return parsear(html).slice(offset % POR_PAGINA_SITIO);
  };

  const filtrar = modo === 'exacta' || excluir || anioDesde || anioHasta;
  if (!filtrar) {
    const resultados = (await traer(arranque)).slice(0, porPagina);
    const hasta = arranque + resultados.length;
    return { total: totalSitio, totalFuente: totalSitio, siguienteDesde: hasta < totalSitio ? hasta : null, pagina, porPagina, resultados };
  }
  const salida = await paginarFiltrado({
    traer,
    desde: arranque,
    total: () => totalSitio,
    porPagina,
    q: termino,
    modo: modo === 'exacta' ? 'exacta' : 'alguna', // el sitio ya exigió todas las palabras
    excluir,
    anioDesde,
    anioHasta,
    maxTandas: 5,
  });
  return {
    total: salida.resultados.length,
    totalFuente: totalSitio,
    siguienteDesde: salida.siguienteDesde,
    totalParcial: salida.siguienteDesde !== null,
    revisados: salida.revisados,
    aflojado: salida.aflojado,
    pagina,
    porPagina,
    resultados: salida.resultados,
  };
}
