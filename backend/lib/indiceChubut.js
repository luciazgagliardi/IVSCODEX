/**
 * Eureka! — Poder Judicial de Chubut.
 *
 * Utiliza el modo de acceso anónimo que el propio portal ofrece. No usa
 * credenciales de operadores, ni endpoints de documentos no anonimizados.
 */
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { esperarTurno } from './descargador.js';
import { errores } from './errores.js';
import { sinClave } from './proxyOrigen.js';
import { buscarProvinciaSaij } from './indiceProvincialSaij.js';

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
async function pedir(urlTexto, { cookie = '', method = 'GET', body } = {}) {
  let actual = new URL(urlTexto);
  if (actual.hostname !== HOST) throw new Error('Destino fuera del portal Eureka');
  let metodo = method;
  let cuerpo = body ? new URLSearchParams(body).toString() : undefined;
  let cookieJar = String(cookie || '');
  let ultimoTipo = '';
  for (let salto = 0; salto <= 5; salto++) {
    await esperarTurno(HOST);
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    let resp;
    try {
      resp = await fetch(actual, {
        method: metodo,
        redirect: 'manual',
        signal: control.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json, text/javascript, text/html;q=0.9, */*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
          Origin: ORIGEN_CHUBUT,
          Referer: ORIGEN_CHUBUT + '/Home/Index',
          'X-Requested-With': 'XMLHttpRequest',
          ...(cookieJar ? { Cookie: cookieJar } : {}),
          ...(cuerpo ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } : {}),
        },
        ...(cuerpo ? { body: cuerpo } : {}),
      });
      const nuevas = cookiesNuevas(resp);
      cookieJar = unirCookies(cookieJar, nuevas);
      ultimoTipo = resp.headers.get('content-type') || '';
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const destino = resp.headers.get('location');
        if (!destino) throw errores.indiceFuenteFalla('chubut', 'redirección sin destino');
        const siguiente = new URL(destino, actual);
        if (siguiente.hostname !== HOST) {
          throw errores.indiceFuenteFalla('chubut', 'redirección fuera del portal oficial');
        }
        if ([301, 302, 303].includes(resp.status) && metodo !== 'GET' && metodo !== 'HEAD') {
          metodo = 'GET';
          cuerpo = undefined;
        }
        actual = siguiente;
        continue;
      }
      if (!resp.ok) throw errores.indiceFuenteFalla('chubut', 'respuesta HTTP ' + resp.status);
      const text = await resp.text();
      return { text, cookies: nuevas, cookieJar, contentType: ultimoTipo, status: resp.status, urlFinal: actual.toString() };
    } catch (e) {
      if (e?.codigo) throw e;
      if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
      const error = errores.indiceFuenteFalla('chubut', e?.cause?.code || e?.message || 'error de red');
      error.cause = new Error(sinClave(e?.cause?.code || e?.cause?.message || e?.message || 'error de red'));
      throw error;
    } finally {
      clearTimeout(reloj);
    }
  }
  throw errores.indiceFuenteFalla('chubut', 'demasiadas redirecciones del portal');
}

async function sesion(clave) {
  const previa = SESIONES.get(clave);
  if (previa && previa.vence > Date.now()) return previa;

  // Eureka emite primero cookies de visita y después habilita el acceso
  // anónimo. Pedir directamente RegistrarAccesoAnonimo omite ese primer
  // paso en algunas respuestas del portal y termina devolviendo HTML de
  // sesión vencida en vez del JSON AJAX.
  const portada = await pedir(ORIGEN_CHUBUT + '/Home/Index');
  const inicio = await pedir(ORIGEN_CHUBUT + '/Home/RegistrarAccesoAnonimo', {
    cookie: portada.cookieJar,
  });
  const actual = {
    cookie: inicio.cookieJar || unirCookies(portada.cookieJar, inicio.cookies),
    idBusqueda: '',
    vence: Date.now() + 20 * 60_000,
  };
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

async function buscarChubutSimple({ q, tribunal = 'sumarios', modo = 'todas', pagina = 1, desde = null, porPagina = 20, _reintentoSesion = false }) {
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
  catch (parseError) {
    const sesionExpirada = /sistema eureka|tiempo de sesi[oó]n|acceso restringido|ingresar usuario y clave/i.test(resp.text.slice(0, 5000));
    if (sesionExpirada && !_reintentoSesion) {
      SESIONES.delete(clave);
      return buscarChubutSimple({
        q: consulta, tribunal, modo, pagina, desde, porPagina,
        _reintentoSesion: true,
      });
    }
    const error = errores.indiceFuenteFalla('chubut', 'la búsqueda anónima no devolvió el JSON del portal');
    error.cause = new Error(sinClave(
      'HTTP ' + (resp.status || 200) + '; content-type ' + (resp.contentType || 'desconocido') +
      '; sesión expirada ' + String(sesionExpirada)
    ));
    throw error;
  }
  if (!datos || !Array.isArray(datos.rows)) throw errores.indiceFuenteFalla('chubut', 'respuesta JSON sin filas');
  sess.cookie = resp.cookieJar || unirCookies(sess.cookie, resp.cookies);
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


const CURSOR_SUMARIOS_CHUBUT = 1_000_000;

/**
 * Búsqueda combinada: sentencias anonimizadas primero. Los sumarios sólo
 * completan una página cuando ya no queda otra sentencia por mostrar.
 * El portal pagina por número de página (1-based), no por desplazamiento.
 */
function claveCasoChubut(r) {
  const exp = limpiar(r?.expediente || '');
  const tribunal = limpiar(r?.tribunal || '').toLowerCase();
  if (exp) return tribunal + '|exp|' + exp.toLowerCase();
  const caratula = limpiar(r?.caratula || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return caratula ? [tribunal, caratula, r?.fecha || ''].join('|') : 'id|' + String(r?.id || '');
}

async function buscarChubutEureka(opciones = {}) {
  const tribunal = opciones.tribunal || 'todo';
  if (['sentencias', 'fallos', 'sumarios'].includes(tribunal))
    return buscarChubutSimple({ ...opciones, tribunal });

  const cantidad = Math.min(20, Math.max(1, Number(opciones.porPagina) || 20));
  const cursor = opciones.desde == null ? null : Number(opciones.desde);

  if (Number.isFinite(cursor) && cursor >= CURSOR_SUMARIOS_CHUBUT) {
    const pagina = cursor - CURSOR_SUMARIOS_CHUBUT;
    const salida = await buscarChubutSimple({ ...opciones, tribunal: 'sumarios', pagina: 1, desde: pagina });
    const resultados = (salida.resultados || []).map((r) => ({ ...r, esSumarioRespaldo: true }));
    return {
      ...salida,
      resultados,
      siguienteDesde: salida.siguienteDesde == null ? null : CURSOR_SUMARIOS_CHUBUT + salida.siguienteDesde,
      complementoSumarios: true,
      cantidadFallos: 0,
      cantidadSumarios: resultados.length,
      tipoConsulta: 'sumarios_de_respaldo',
    };
  }

  // Un error del carril de sentencias se propaga. Un 403/timeout no significa
  // que el buscador haya agotado los fallos y no autoriza sustituirlos.
  const fallos = await buscarChubutSimple({ ...opciones, tribunal: 'sentencias' });
  const listaFallos = fallos.resultados || [];
  if (listaFallos.length >= cantidad || fallos.siguienteDesde != null) {
    return {
      ...fallos,
      cantidadFallos: listaFallos.length,
      cantidadSumarios: 0,
      complementoSumarios: false,
      tipoConsulta: 'fallos',
    };
  }

  const faltan = cantidad - listaFallos.length;
  if (!faltan) return fallos;
  const sumarios = await buscarChubutSimple({
    ...opciones, tribunal: 'sumarios', pagina: 1, desde: 1, porPagina: faltan,
  });
  const vistos = new Set(listaFallos.map(claveCasoChubut));
  const relleno = [];
  for (const r of (sumarios.resultados || [])) {
    const clave = claveCasoChubut(r);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    relleno.push({ ...r, esSumarioRespaldo: true });
    if (listaFallos.length + relleno.length >= cantidad) break;
  }
  return {
    ...fallos,
    total: listaFallos.length + relleno.length,
    totalFuente: Number(fallos.totalFuente || 0) + Number(sumarios.totalFuente || 0),
    totalFuenteFallos: Number(fallos.totalFuente || 0),
    totalFuenteSumarios: Number(sumarios.totalFuente || 0),
    totalParcial: Boolean(fallos.totalParcial || sumarios.totalParcial || sumarios.siguienteDesde != null || relleno.length > 0),
    revisados: Number(fallos.revisados || 0) + Number(sumarios.revisados || 0),
    siguienteDesde: sumarios.siguienteDesde == null
      ? null
      : CURSOR_SUMARIOS_CHUBUT + Number(sumarios.siguienteDesde),
    porPagina: cantidad,
    resultados: listaFallos.concat(relleno),
    complementoSumarios: relleno.length > 0,
    cantidadFallos: listaFallos.length,
    cantidadSumarios: relleno.length,
    tipoConsulta: relleno.length ? 'fallos_con_sumarios_de_respaldo' : 'fallos',
  };
}


/**
 * Eureka! entrega el buscador mediante una sesión anónima; cuando el portal
 * devuelve una página HTML inesperada (en vez del JSON del listado), se
 * renueva una vez dentro de buscarChubutSimple. Si aun así el servidor oficial
 * no permite consultar, se conserva acceso jurisdiccional mediante la faceta
 * pública SAIJ de Chubut, sin confundir ambas procedencias.
 */
export async function buscarChubut(opciones = {}) {
  try {
    return await buscarChubutEureka(opciones);
  } catch (error) {
    const tribunal = ['fallos', 'sentencias', 'sumarios', 'todo'].includes(opciones.tribunal)
      ? opciones.tribunal : 'todo';
    let alternativa = null;
    let ultimoError = null;
    const intentos = tribunal === 'todo' ? ['todo', 'sumarios'] : [tribunal];
    for (const tipo of intentos) {
      try {
        alternativa = await buscarProvinciaSaij('chubut_saij', {
          ...opciones, tribunal: tipo,
        });
        if (alternativa.resultados?.length || tipo === 'sumarios') break;
      } catch (e) { ultimoError = e; }
    }
    if (!alternativa) {
      error.cause = ultimoError || error.cause;
      throw error;
    }
    return {
      ...alternativa,
      origenEnVivo: 'saij',
      fuenteAlternativa: 'chubut_saij',
      desdeIndiceLocal: false,
      resultados: (alternativa.resultados || []).map((r) => ({
        ...r,
        fuente: 'saij',
        fuenteSlug: 'saij',
        procedencia: 'SAIJ',
        jurisdiccion: 'Chubut',
      })),
    };
  }
}
