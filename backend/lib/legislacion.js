/**
 * El texto oficial de un artículo, traído de InfoLeg.
 *
 * Cierra el círculo que le faltaba a la app. Hasta acá todo apuntaba a
 * JURISPRUDENCIA: qué dijeron los tribunales. Pero un fallo se lee citando
 * artículos ("conforme el art. 1741 del CCyC..."), y hasta ahora había que
 * salir a buscar ese texto a otra pestaña. Esto lo trae acá, con la misma
 * regla que el resto del proyecto: no lo escribimos nosotros, lo trae de la
 * fuente que hace fe.
 *
 * InfoLeg es el repositorio del Ministerio de Justicia de la Nación y sirve
 * "texto actualizado" (texact.htm) de los códigos y leyes principales: lo
 * que se ve ahí ya tiene incorporadas las reformas. Eso importa y no es un
 * detalle: al cargar la solapa Requisitos apareció que el art. 242 de la LCT
 * fue sustituido por el DNU 70/2023 — escribir de memoria habría dado un
 * texto viejo sin que nadie se enterara.
 *
 * Sólo derecho de fondo NACIONAL. Los códigos procesales provinciales
 * (Mendoza, ley 9001) no están en InfoLeg y cada provincia los publica a su
 * manera; meterlos exigiría un cliente por provincia y no se hace a medias:
 * la lista de abajo es la que se puede servir bien.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { leerCache, escribirCache } from './cache.js';
import { errores } from './errores.js';

const HOST = 'servicios.infoleg.gob.ar';
const HOST_LEYES = 'https://leyes-ar.com';

/**
 * Las normas que se pueden consultar. Cada URL fue verificada abriéndola y
 * comprobando que el articulado esté ahí (no un índice ni una portada).
 *
 * "texact" = texto actualizado, con las reformas ya incorporadas. Donde no
 * existe esa versión se usa "norma" (el texto original), y se dice en
 * "aviso" para que nadie suponga que está al día.
 */
export const NORMAS = [
  { clave: 'ccyc', nombre: 'Código Civil y Comercial', sigla: 'CCyCN',
    url: `https://${HOST}/infolegInternet/anexos/235000-239999/235975/texact.htm` },
  { clave: 'cn', nombre: 'Constitución Nacional', sigla: 'CN',
    url: `https://${HOST}/infolegInternet/anexos/0-4999/804/norma.htm` },
  { clave: 'lct', nombre: 'Ley de Contrato de Trabajo (20.744)', sigla: 'LCT',
    url: `https://${HOST}/infolegInternet/anexos/25000-29999/25552/texact.htm`,
    aviso: 'Régimen en reforma: el DNU 70/2023 y la Ley 27.742 (2024) modificaron varios artículos. Revise las notas de InfoLeg al pie del artículo.' },
  { clave: 'lcq', nombre: 'Ley de Concursos y Quiebras (24.522)', sigla: 'LCQ',
    url: `https://${HOST}/infolegInternet/anexos/25000-29999/25379/texact.htm` },
  { clave: 'lpa', nombre: 'Ley de Procedimientos Administrativos (19.549)', sigla: 'LPA',
    url: `https://${HOST}/infolegInternet/anexos/20000-24999/22363/texact.htm` },
  { clave: 'amparo', nombre: 'Ley de Amparo (16.986)', sigla: 'Ley 16.986',
    url: `https://${HOST}/infolegInternet/anexos/45000-49999/46871/norma.htm`,
    aviso: 'Texto original de 1966. El amparo tiene además rango constitucional desde 1994 (art. 43 CN).' },
  { clave: 'ldc', nombre: 'Ley de Defensa del Consumidor (24.240)', sigla: 'LDC',
    url: `https://${HOST}/infolegInternet/anexos/0-4999/638/texact.htm` },
  { clave: 'cp', nombre: 'Código Penal de la Nación', sigla: 'CP',
    url: `https://${HOST}/infolegInternet/anexos/15000-19999/16546/texact.htm` },
  { clave: 'cpccn', nombre: 'Código Procesal Civil y Comercial de la Nación', sigla: 'CPCCN',
    url: `https://${HOST}/infolegInternet/anexos/15000-19999/16547/texact.htm` },
  { clave: 'lgs', nombre: 'Ley General de Sociedades (19.550)', sigla: 'LGS',
    url: `https://${HOST}/infolegInternet/anexos/25000-29999/25553/texact.htm` },
  { clave: 'lrt', nombre: 'Ley de Riesgos del Trabajo (24.557)', sigla: 'LRT',
    url: `https://${HOST}/infolegInternet/anexos/25000-29999/27971/texact.htm` },
  { clave: 'ley11723', nombre: 'Propiedad Intelectual (11.723)', sigla: 'Ley 11.723',
    url: `https://${HOST}/infolegInternet/anexos/40000-44999/42755/texact.htm` },
  { clave: 'ley25675', nombre: 'Ley General del Ambiente (25.675)', sigla: 'Ley 25.675',
    url: `https://${HOST}/infolegInternet/anexos/75000-79999/79980/norma.htm`, aviso: 'Texto original de la ley: puede haber sido reformada después. Revise la vigencia en InfoLeg.' },
  { clave: 'ley24013', nombre: 'Ley Nacional de Empleo (24.013)', sigla: 'Ley 24.013',
    url: `https://${HOST}/infolegInternet/anexos/0-4999/412/texact.htm` },
  { clave: 'ley25345', nombre: 'Prevención de la Evasión Fiscal (25.345)', sigla: 'Ley 25.345',
    url: `https://${HOST}/infolegInternet/anexos/65000-69999/65015/texact.htm` },
  { clave: 'ley24241', nombre: 'Sistema Integrado Previsional (24.241)', sigla: 'Ley 24.241',
    url: `https://${HOST}/infolegInternet/anexos/0-4999/639/texact.htm` },
  { clave: 'ley23592', nombre: 'Actos Discriminatorios (23.592)', sigla: 'Ley 23.592',
    url: `https://${HOST}/infolegInternet/anexos/20000-24999/20465/texact.htm` },
  { clave: 'ley27348', nombre: 'Complementaria de Riesgos del Trabajo (27.348)', sigla: 'Ley 27.348',
    url: `https://${HOST}/infolegInternet/anexos/270000-274999/272119/texact.htm` },
  { clave: 'ley11683', nombre: 'Procedimiento Tributario (11.683)', sigla: 'Ley 11.683',
    url: `https://${HOST}/infolegInternet/anexos/15000-19999/18771/texact.htm`, aviso: 'El texto empieza con el decreto que aprobó el texto ordenado: los artículos 1 a 4 pueden ser los del decreto y no los de la ley.' },
  { clave: 'ley26485', nombre: 'Protección Integral a las Mujeres (26.485)', sigla: 'Ley 26.485',
    url: `https://${HOST}/infolegInternet/anexos/150000-154999/152155/texact.htm` },
  { clave: 'ley25326', nombre: 'Protección de Datos Personales (25.326)', sigla: 'Ley 25.326',
    url: `https://${HOST}/infolegInternet/anexos/60000-64999/64790/texact.htm` },
  { clave: 'ley26061', nombre: 'Protección de Niñas, Niños y Adolescentes (26.061)', sigla: 'Ley 26.061',
    url: `https://${HOST}/infolegInternet/anexos/110000-114999/110778/texact.htm` },
  { clave: 'ley26657', nombre: 'Salud Mental (26.657)', sigla: 'Ley 26.657',
    url: `https://${HOST}/infolegInternet/anexos/175000-179999/175977/norma.htm`, aviso: 'Texto original de la ley: puede haber sido reformada después. Revise la vigencia en InfoLeg.' },
  { clave: 'ley26618', nombre: 'Matrimonio Igualitario (26.618)', sigla: 'Ley 26.618',
    url: `https://${HOST}/infolegInternet/anexos/165000-169999/169608/norma.htm`, aviso: 'Texto original de la ley: puede haber sido reformada después. Revise la vigencia en InfoLeg.' },
  { clave: 'ley26743', nombre: 'Identidad de Género (26.743)', sigla: 'Ley 26.743',
    url: `https://${HOST}/infolegInternet/anexos/195000-199999/197860/texact.htm` },
  { clave: 'ley24449', nombre: 'Tránsito (24.449)', sigla: 'Ley 24.449',
    url: `https://${HOST}/infolegInternet/anexos/0-4999/818/texact.htm` },
  { clave: 'ley22250', nombre: 'Régimen de la Construcción (22.250)', sigla: 'Ley 22.250',
    url: `https://${HOST}/infolegInternet/anexos/25000-29999/27238/texact.htm` },
  { clave: 'ley14250', nombre: 'Convenciones Colectivas de Trabajo (14.250)', sigla: 'Ley 14.250',
    url: `https://${HOST}/infolegInternet/anexos/45000-49999/46379/texact.htm` },
  { clave: 'ley23551', nombre: 'Asociaciones Sindicales (23.551)', sigla: 'Ley 23.551',
    url: `https://${HOST}/infolegInternet/anexos/20000-24999/20993/texact.htm` },
  { clave: 'ley25877', nombre: 'Régimen Laboral (25.877)', sigla: 'Ley 25.877',
    url: `https://${HOST}/infolegInternet/anexos/90000-94999/93595/texact.htm` },
  { clave: 'ley26773', nombre: 'Reparación de Daños del Trabajo (26.773)', sigla: 'Ley 26.773',
    url: `https://${HOST}/infolegInternet/anexos/200000-204999/203798/texact.htm` },
  { clave: 'ley17418', nombre: 'Ley de Seguros (17.418)', sigla: 'Ley 17.418',
    url: `https://${HOST}/infolegInternet/anexos/35000-39999/39520/texact.htm` },
  { clave: 'ley26589', nombre: 'Mediación y Conciliación (26.589)', sigla: 'Ley 26.589',
    url: `https://${HOST}/infolegInternet/anexos/165000-169999/166999/texact.htm` },
  { clave: 'ley27423', nombre: 'Honorarios de Abogados, Ley Nacional (27.423)', sigla: 'Ley 27.423',
    url: `https://${HOST}/infolegInternet/anexos/305000-309999/305057/texact.htm` },
  { clave: 'ley27063', nombre: 'Código Procesal Penal Federal (27.063)', sigla: 'CPPF',
    url: `https://${HOST}/infolegInternet/anexos/235000-239999/239340/texact.htm`, aviso: 'El texto empieza con la ley que aprueba el Código: los artículos 1 y 2 pueden ser los de esa ley y no los del Código.' },
  { clave: 'ley25323', nombre: 'Ley 25.323 (indemnizaciones laborales)', sigla: 'Ley 25.323',
    url: `https://${HOST}/infolegInternet/anexos/60000-64999/64555/norma.htm`,
    aviso: 'Texto original del año 2000. Puede haber sido modificada o derogada después (según otras fuentes, por la Ley 27.742 de 2024): revise la vigencia en InfoLeg.' },

  /* Provinciales: no están en InfoLeg y Mendoza y Buenos Aires no publican sus textos artículo por artículo
     en HTML. Se traen de leyes-ar.com, que sí lo hace, y se dice en el aviso que es una copia no oficial. */
  { clave: 'cmza', nombre: 'Constitución de la Provincia de Mendoza', sigla: 'Const. Mendoza', porArticulo: `${HOST_LEYES}/constitucion_mendoza` },
  { clave: 'cpba', nombre: 'Constitución de la Provincia de Buenos Aires', sigla: 'Const. Buenos Aires', porArticulo: `${HOST_LEYES}/constitucion_buenos_aires` },
  { clave: 'cpccyt-mza', nombre: 'Código Procesal Civil, Comercial y Tributario de Mendoza (ley 9.001)', sigla: 'CPCCyT', porArticulo: `${HOST_LEYES}/codigo_procesal_civil_comercial_y_tributario_mendoza` },
  { clave: 'ley9131', nombre: 'Aranceles de Abogados y Procuradores de Mendoza (ley 9.131)', sigla: 'Ley 9.131', porArticulo: `${HOST_LEYES}/regulan_aranceles_de_abogados_y_procuradores_mendoza` },
];

export function normaPorClave(clave) {
  return NORMAS.find((n) => n.clave === String(clave || '').toLowerCase()) || null;
}

/**
 * Baja el texto plano de una norma. Se cachea en disco porque son archivos
 * grandes (el CCyC pesa 1,3 MB) que casi no cambian: pedirlos de nuevo por
 * cada consulta sería maltratar a InfoLeg de gusto.
 */
async function textoDeNorma(norma) {
  const guardado = await leerCache(norma.url);
  if (guardado && guardado.texto) return guardado.texto;

  await esperarTurno(HOST);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  let crudo;
  try {
    const resp = await fetch(norma.url, {
      signal: control.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*;q=0.8' },
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('infoleg', `respuesta ${resp.status}`);
    // InfoLeg sirve estas páginas en latin-1, no en UTF-8: decodificarlas a
    // ciegas deja "ARTÍCULO" como "ARTï¿½CULO" y rompe las búsquedas.
    const buffer = Buffer.from(await resp.arrayBuffer());
    crudo = new TextDecoder('latin1').decode(buffer);
  } catch (e) {
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    if (e?.codigo) throw e;
    throw errores.indiceFuenteFalla('infoleg', e?.cause?.message || e?.message);
  } finally {
    clearTimeout(reloj);
  }

  const consolaMuda = new VirtualConsole();
  consolaMuda.on('jsdomError', () => {});
  const dom = new JSDOM(crudo, { virtualConsole: consolaMuda });
  dom.window.document.querySelectorAll('script, style').forEach((n) => n.remove());
  const texto = (dom.window.document.body?.textContent || '').replace(/[ \s]+/g, ' ');
  dom.window.close();

  await escribirCache(norma.url, { texto });
  return texto;
}

/**
 * Dónde empieza un artículo dentro del texto de la norma.
 *
 * Los tres formatos son reales y conviven según la ley: "ARTICULO 438.-" en
 * el CCyC, "Artículo 43 .-" en la Constitución, "Art. 243." en la LCT. El
 * número va anclado con \b para que pedir el 11 no caiga en el 110.
 */
function posicionDelArticulo(texto, numero) {
  const n = String(numero).trim().replace(/\s+/g, '\\s*'); // tolera "76 bis"
  const patrones = [
    new RegExp(`ART[IÍ]CULO\\s*${n}\\b\\s*[\\.\\-–—°º:]`, 'i'),
    new RegExp(`Art[íi]culo\\s*${n}\\b\\s*[\\.\\-–—°º:]`, 'i'),
    new RegExp(`Art\\.?\\s*${n}\\b\\s*[\\.\\-–—°º:]`, 'i'),
    new RegExp(`ART[IÍ]CULO\\s*${n}\\b`, 'i'),
  ];
  // Todas las apariciones, y gana la que tiene forma de encabezado: al principio del renglón
  // y no precedida de «del», «el», «conforme al»… Antes ganaba la primera, y en la LCT la
  // primera «artículo 245.» es una mención dentro del art. 186, justo antes del capítulo IV.
  let mejor = -1, puntos = -Infinity;
  for (const [k, p] of patrones.entries()) {
    const re = new RegExp(p.source, 'gi');
    let m;
    while ((m = re.exec(texto))) {
      const antes = texto.slice(Math.max(0, m.index - 40), m.index);
      let s = -k; // a igualdad, el patrón más específico
      if (/(^|\n)\s*$/.test(antes) || m.index === 0) s += 6;
      if (/[.:;]\s*$/.test(antes)) s += 2;
      if (/\b(del|el|al|los|las|y|o|e|conforme|seg[uú]n|previsto|prevista|dispuesto|establecido|en el|por el|art[ií]culos?)\s*$/i.test(antes)) s -= 8;
      if (/^[A-ZÁÉÍÓÚ]/.test(m[0])) s += 1;
      if (s > puntos) { puntos = s; mejor = m.index; }
    }
  }
  return mejor;
}

/** Cuántos caracteres se devuelven como mucho de un artículo. */
const MAX_ARTICULO = 4000;

/**
 * El texto de un artículo concreto.
 *
 * Se corta en el arranque del artículo siguiente, no a un largo fijo: los
 * artículos van de dos renglones (art. 1900 CCyC) a varias pantallas (art.
 * 11 LCQ, con ocho incisos). Si no se encuentra dónde termina se recorta y
 * se avisa con "truncado", en vez de devolver media ley.
 */
export async function articuloDe(clave, numero) {
  const norma = normaPorClave(clave);
  if (!norma) throw errores.normaDesconocida(clave);
  const num = String(numero || '').trim();
  if (!/^\d{1,4}(\s*(bis|ter|quater))?$/i.test(num)) throw errores.articuloInvalido(num);
  if (norma.porArticulo) return articuloDePagina(norma, num);

  const texto = await textoDeNorma(norma);
  const desde = posicionDelArticulo(texto, num);
  if (desde === -1) throw errores.articuloNoEncontrado(num, norma.nombre);

  // El siguiente "ARTICULO/Art." que aparezca después del arranque marca el final.
  const resto = texto.slice(desde + 10);
  const sig = /(ART[IÍ]CULO|Art[íi]culo|Art\.)\s*\d/.exec(resto);
  let cuerpo = sig ? texto.slice(desde, desde + 10 + sig.index) : texto.slice(desde, desde + MAX_ARTICULO);

  let truncado = false;
  if (cuerpo.length > MAX_ARTICULO) { cuerpo = cuerpo.slice(0, MAX_ARTICULO); truncado = true; }

  const limpio = cuerpo.trim();
  return {
    norma: norma.nombre,
    sigla: norma.sigla,
    articulo: num,
    texto: limpio,
    // La rúbrica viaja al frontend: la necesita el respaldo por navegador
    // para armar las mismas formas de búsqueda que arma el servidor.
    rubrica: rubricaDe(limpio),
    truncado,
    aviso: norma.aviso || null,
    url: norma.url,
  };
}

/**
 * La rúbrica de un artículo: el título que va después del número.
 *
 * "ARTICULO 1710.- Deber de prevención del daño. Toda persona tiene..."
 *                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *
 * Hace falta para buscar los fallos que APLICAN el artículo, no sólo los que
 * escriben su número. Medido contra Mendoza: "art 1710" da CERO resultados
 * —sus sumarios describen el tema con descriptores del tesauro, no citan el
 * articulado— mientras que "prevención del daño" da cincuenta. Sin la
 * rúbrica, buscar por artículo en esa fuente no sirve para nada.
 *
 * Devuelve null cuando el artículo no tiene título (pasa en la Constitución
 * y en las leyes viejas, que numeran sin rubricar).
 */
export function rubricaDe(textoArticulo) {
  const t = String(textoArticulo || '');
  // Después del "N.-" viene la rúbrica, y termina en el primer punto. Se
  // exige que arranque en mayúscula y que sea corta: si lo que sigue es la
  // oración del articulado ("Toda persona tiene el deber..."), no es rúbrica.
  const m = /^\s*(?:ART[IÍ]CULO|Art[íi]culo|Art\.?)\s*[\dbisterquax\s]+\s*(?:[\.\-–—°º:]\s*)+([A-ZÁÉÍÓÚÑ][^.]{3,70})\./.exec(t);
  if (!m) return null;
  const r = m[1].trim();
  // Una rúbrica es un rótulo, no una oración: si trae verbo conjugado común
  // ("tiene", "debe", "es") probablemente ya es el texto del artículo.
  if (/\b(tiene|debe|puede|es|son|se)\b/i.test(r)) return null;
  return r;
}

/**
 * Las normas provinciales: cada artículo es una página (leyes-ar.com/<norma>/<n>.htm) con su texto en
 * <div id="statya"> y la vigencia en <div id="law_valid">. No es una fuente oficial, y el aviso lo dice.
 */
async function articuloDePagina(norma, num) {
  const url = `${norma.porArticulo}/${encodeURIComponent(num.toLowerCase().replace(/\s+/g, ' '))}.htm`;
  const host = new URL(url).hostname;
  let datos = await leerCache(url);
  if (!datos || !datos.texto) {
    await esperarTurno(host);
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    let crudo;
    try {
      const resp = await fetch(url, { signal: control.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*;q=0.8' } });
      if (resp.status === 404) throw errores.articuloNoEncontrado(num, norma.nombre);
      if (!resp.ok) throw errores.indiceFuenteFalla('leyes-ar', `respuesta ${resp.status}`);
      crudo = await resp.text();
    } catch (e) {
      if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
      if (e?.codigo) throw e;
      throw errores.indiceFuenteFalla('leyes-ar', e?.cause?.message || e?.message);
    } finally {
      clearTimeout(reloj);
    }
    const consolaMuda = new VirtualConsole();
    consolaMuda.on('jsdomError', () => {});
    const dom = new JSDOM(crudo, { virtualConsole: consolaMuda });
    const doc = dom.window.document;
    const caja = doc.getElementById('statya');
    if (!caja) { dom.window.close(); throw errores.articuloNoEncontrado(num, norma.nombre); }
    caja.querySelectorAll('h1, script, style').forEach((n) => n.remove());
    // los renglones del artículo, con un salto entre párrafos y sin la leyenda del pie («Provincia de Mendoza Artículo 160 …»)
    const partes = [...caja.querySelectorAll('p')].map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const texto = (partes.length ? partes.join('\n') : (caja.textContent || '').replace(/\s+/g, ' ').trim())
      .replace(/\s*(Provincia de [A-Za-zÁÉÍÓÚÑáéíóúñ ]+|Constitución|Código|Regulan)[^\n]*Art[íi]culo\s+\d+[^\n]*$/i, '').trim();
    const vigencia = (doc.getElementById('law_valid')?.textContent || '').replace(/\s+/g, ' ').trim();
    dom.window.close();
    if (!texto) throw errores.articuloNoEncontrado(num, norma.nombre);
    datos = { texto, vigencia };
    await escribirCache(url, datos);
  }
  const limpio = datos.texto.length > MAX_ARTICULO ? datos.texto.slice(0, MAX_ARTICULO) : datos.texto;
  return {
    norma: norma.nombre,
    sigla: norma.sigla,
    articulo: num,
    texto: limpio,
    rubrica: null,
    truncado: datos.texto.length > MAX_ARTICULO,
    aviso: 'Copia no oficial (leyes-ar.com)' + (datos.vigencia ? ': ' + datos.vigencia.replace(/\.?\s*$/, '') : '') + '. Verifíquela en la fuente oficial antes de citar.',
    url,
  };
}
