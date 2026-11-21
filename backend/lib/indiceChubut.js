/**
 * Eureka! — Poder Judicial de Chubut.
 *
 * Utiliza el modo de acceso anónimo que el propio portal ofrece. No usa
 * credenciales de operadores, ni endpoints de documentos no anonimizados.
 */
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';

export const ORIGEN_CHUBUT = 'https://apps1cloud.juschubut.gov.ar/eureka';
const HOST = new URL(ORIGEN_CHUBUT).hostname;
const SESIONES = new Map();
const limpiar = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function cookiesNuevas(resp) {
  const values = resp.headers.getSetCookie?.() || [];
  if (values.length) return values.map((x) => x.split(';')[0]).filter(Boolean);
  const uno = resp.headers.get('set-cookie');
  return uno ? [uno.split(';')[0]] : [];
}
function unirCookies(a, b) {
  const m = new Map(String(a || '').split('; ').filter(Boolean).map(x => [x.split('=')[0], x]));
  for (const c of b || []) if (c.includes('=')) m.set(c.split('=')[0], c);
  return [...m.values()].join('; ');
}
function valor(obj, ...nombres) {
  for (const nombre of nombres) {
    if (obj?.[nombre] !== undefined && obj[nombre] !== null && obj[nombre] !== '') return obj[nombre];
    const encontrado = Object.keys(obj || {}).find(k => k.toLowerCase() === nombre.toLowerCase());
    if (encontrado && obj[encontrado] !== undefined && obj[encontrado] !== null && obj[encontrado] !== '') return obj[encontrado];
  }
  return '';
}
async function pedir(url, { cookie = '', method = 'GET', body } = {}) {
  await esperarTurno(HOST);
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method, signal: control.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        Referer: ORIGEN_CHUBUT + '/',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } : {}),
      },
      ...(body ? { body: new URLSearchParams(body).toString() } : {}),
    });
    if (!resp.ok) throw errores.indiceFuenteFalla('chubut', `respuesta HTTP ${resp.status}`);
    const text = await resp.text();
    return { text, cookies: cookiesNuevas(resp) };
  } catch (e) {
    if (e?.codigo) throw e;
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    throw errores.indiceFuenteFalla('chubut', e?.cause?.code || e?.message || 'error de red');
  } finally { clearTimeout(reloj); }
}

async function sesion(clave) {
  const previa = SESIONES.get(clave);
  if (previa && previa.vence > Date.now()) return previa;
  const inicio = await pedir(ORIGEN_CHUBUT + '/Home/RegistrarAccesoAnonimo');
  const actual = { cookie: unirCookies('', inicio.cookies), idBusqueda: '', vence: Date.now() + 20 * 60_000 };
  SESIONES.set(clave, actual);
  return actual;
}

function fechaChubut(v) {
  const s = limpiar(v);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : s;
}
function filaChubut(row, tipo) {
  const c = row?.cell && typeof row.cell === 'object' ? row.cell : row || {};
  const idOriginal = valor(row, 'id', 'idSentencia', 'idSumario') || valor(c, 'id', 'idSentencia', 'idSumario');
  if (!idOriginal) return null;
  const esSumario = tipo === 'sumarios';
  const id = `chubut_${esSumario ? 'sumario' : 'sentencia'}_${idOriginal}`;
  const numero = limpiar(valor(c, 'numero', 'numeroExpediente', 'expediente'));
  const anio = limpiar(valor(c, 'anio', 'ano'));
  const protocolo = limpiar(valor(c, 'protocolo', 'numeroProtocolo'));
  const organismo = limpiar(valor(c, 'organismo', 'tribunal', 'dependencia'));
  const competencia = limpiar(valor(c, 'competencia', 'materia'));
  const fecha = fechaChubut(valor(c, 'fechaFirma', 'fecha', 'fechaResolucion'));
  const caratula = limpiar(valor(c, 'caratula', 'titulo', 'objeto', 'descripcion')) ||
    (numero ? `Expte. ${numero}${anio ? '/' + anio : ''}` : `${esSumario ? 'Sumario' : 'Sentencia'} ${idOriginal}`);
  const texto = limpiar(valor(c, 'sumario', 'textoSumario', 'resumen', 'texto', 'extracto'));
  const pdf = !esSumario ? `${ORIGEN_CHUBUT}/Sentencias/BajarDocumento?idSentencia=${encodeURIComponent(idOriginal)}` : '';
  return {
    id, caratula, tribunal: organismo || 'Poder Judicial de Chubut',
    fecha, expediente: numero || protocolo,
    // No fingir que la carátula es el texto del sumario: si el registro no trae
    // pasaje, se deja vacío para que no aparezca como coincidencia textual.
    sumario: texto,
    voces: [competencia, protocolo].filter(Boolean),
    linkFicha: esSumario ? ORIGEN_CHUBUT + '/' : ORIGEN_CHUBUT + '/Sentencias/BajarDocumento?idSentencia=' + encodeURIComponent(idOriginal),
    ...(pdf ? { linkFallo: pdf } : {}),
    fuente: 'chubut', provincia: 'Chubut',
    tipo: esSumario ? 'sumario' : 'fallo',
  };
}

export async function buscarChubut({ q, tribunal = 'sumarios', modo = 'todas', pagina = 1, desde = null, porPagina = 20 }) {
  const consulta = limpiar(q);
  if (!consulta) throw errores.consultaVacia();
  const tipo = tribunal === 'sentencias' || tribunal === 'fallos' ? 'sentencias' : 'sumarios';
  const clave = tipo + '|' + consulta;
  const sess = await sesion(clave);
  const page = Math.max(1, Number(desde ?? pagina) || 1);
  const params = new URLSearchParams({
    Texto: consulta,
    Organismos: '',
    Competencias: '',
    Anios: '',
    Tipo: '',
    Numero: '',
    EsFraseExacta: modo === 'exacta' ? 'true' : 'false',
    EsBusquedaAmplia: modo === 'alguna' ? 'true' : 'false',
    EsNuevaBusqueda: page === 1 ? 'true' : 'false',
    IdBusqueda: sess.idBusqueda,
    EsBusquedaAvanzada: 'false',
    PageIndex: String(page),
  });
  const ruta = tipo === 'sentencias' ? '/Sentencias/BuscarPorCriterios?' : '/Sumarios/BuscarPorCriterios?';
  const resp = await pedir(ORIGEN_CHUBUT + ruta + params.toString(), { cookie: sess.cookie });
  let datos;
  try { datos = JSON.parse(resp.text); }
  catch { throw errores.indiceFuenteFalla('chubut', 'la API no devolvió JSON'); }
  if (!datos || !Array.isArray(datos.rows)) throw errores.indiceFuenteFalla('chubut', 'respuesta JSON sin filas');
  sess.cookie = unirCookies(sess.cookie, resp.cookies);
  sess.idBusqueda = valor(datos, 'idBusqueda', 'IdBusqueda') || sess.idBusqueda;
  const resultados = datos.rows.map(row => filaChubut(row, tipo)).filter(Boolean);
  const total = Number(valor(datos, 'totalFilas', 'total', 'records') || 0);
  const pages = Number(valor(datos, 'pageCount', 'totalPages') || 0);
  const hayMas = pages ? page < pages : (resultados.length >= Math.min(porPagina, 20) && page < 50);
  return {
    total, totalFuente: total,
    totalParcial: total > 1000,
    revisados: resultados.length,
    siguienteDesde: hayMas ? page + 1 : null,
    pagina: page, porPagina: resultados.length || porPagina,
    resultados,
  };
}
