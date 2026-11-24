/**
 * Cliente compartido de buscadores híbridos de jurisprudencia.
 *
 * TFN y Santa Cruz exponen el mismo contrato JSON operado por el proveedor
 * InteligenciaLegal. Se separa el adaptador de red del mapeo para no atribuir
 * a una sentencia los extractos que el proveedor genera con IA.
 */
import { USER_AGENT, TIMEOUT_MS } from '../config.js';
import { fetchOrigen } from './descargador.js';
import { errores } from './errores.js';

const texto = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const recortar = (v, max = 80000) => texto(v).slice(0, max);
const lista = (v) => Array.isArray(v) ? v.map((x) => typeof x === 'string' ? texto(x) : texto(x?.texto || x?.nombre || x?.label)).filter(Boolean) : [];

function fecha(v) {
  const s = texto(v);
  if (!s) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s.slice(0, 30);
}

function campo(obj, ...claves) {
  for (const clave of claves) {
    const valor = obj?.[clave];
    if (valor !== undefined && valor !== null && valor !== '') return valor;
  }
  return '';
}

function normalizarResultado(fila, fuente, searchIn) {
  const meta = fila?.metadata && typeof fila.metadata === 'object' ? fila.metadata : {};
  const original = texto(campo(fila, 'fallo_id', 'id', 'document_id') || campo(meta, 'fallo_id', 'id'));
  if (!original) return null;
  const id = `${fuente}_${original.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const caratula = texto(campo(meta, 'caratula', 'titulo', 'title', 'objeto', 'expediente') ||
    campo(fila, 'objeto_texto', 'matched_texto') || original);
  const tribunal = texto(campo(meta, 'tribunal', 'sala', 'organismo', 'dependencia') || (fuente === 'tfn' ? 'Tribunal Fiscal de la Nación' : 'Tribunal Superior de Justicia de Santa Cruz'));
  const doctrinas = lista(fila?.doctrinas);
  const sumarios = lista(fila?.sumarios);
  // Sólo texto_completo puede presentarse como texto del documento.
  // «matched_texto», objeto y doctrinas son campos temáticos/asistidos por IA.
  const resumen = recortar(campo(fila, 'texto_completo'));
  const extractoAsistido = recortar(campo(fila, 'matched_texto', 'objeto_texto'));
  const urlFicha = campo(meta, 'url', 'url_ficha', 'link', 'linkFicha') || (fuente === 'tfn'
    ? 'https://jurisprudenciatfn.mecon.gob.ar/'
    : 'https://jurisprudencia.jussantacruz.gob.ar/');
  const urlPdf = campo(meta, 'pdf_url', 'url_pdf', 'documento_pdf', 'linkFallo');
  const generado = searchIn === 'doctrinas' || Boolean(fila?.objeto_texto) || doctrinas.length > 0 || sumarios.length > 0;
  const tipoDocumento = generado
    ? 'Candidato temático asistido por IA; no es un extracto literal del fallo'
    : (fuente === 'tfn' ? 'Resolución o fallo tributario' : 'Sentencia del Tribunal Superior de Justicia');
  return {
    id, caratula, tribunal,
    fecha: fecha(campo(meta, 'fecha', 'fecha_fallo', 'fecha_resolucion', 'date')),
    expediente: texto(campo(meta, 'expediente', 'numero', 'fallo_id') || original),
    sumario: resumen,
    coincidenciaFuente: true,
    ...(extractoAsistido ? { extractoAsistido } : {}),
    voces: [...new Set([...doctrinas, ...sumarios])].slice(0, 80),
    magistrados: texto(campo(meta, 'magistrado', 'vocal', 'juez', 'ponente')),
    linkFicha: String(urlFicha),
    ...(urlPdf ? { linkFallo: String(urlPdf) } : {}),
    tipo: fuente === 'tfn' ? (generado ? 'dictamen_o_doctrina_asistida' : 'resolucion_tfn') :
      (generado ? 'doctrina_asistida' : 'sentencia_santacruz'),
    tipoDocumento,
    metadatosAsistidos: generado,
    fuente,
  };
}

/**
 * La API no publicó aún un parámetro de paginación verificable: devuelve
 * 25 candidatos por petición. Se informa el total declarado, pero el lote
 * se marca parcial y no se inventa un cursor que el servicio no confirmó.
 */
export async function buscarIndiceHybrid({
  fuente, apiBase, q, searchIn = 'objetos', modo = 'todas',
}) {
  const consulta = texto(q);
  if (!consulta) throw errores.consultaVacia();
  if (!['objetos', 'doctrinas'].includes(searchIn)) throw errores.consultaVacia();
  try {
    const respuesta = await fetchOrigen(`${apiBase.replace(/\/$/, '')}/hybridSearch`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // Contrato estricto de FastAPI: no agregar page/page_size ni campos extra.
      body: JSON.stringify({ query: consulta, search_in: searchIn }),
    });
    if (!respuesta.ok) throw errores.indiceFuenteFalla(fuente, `respuesta HTTP ${respuesta.status}`);
    const datos = await respuesta.json();
    if (!datos || !Array.isArray(datos.results)) throw errores.indiceFuenteFalla(fuente, 'respuesta JSON con forma inesperada');
    const resultados = datos.results.map((r) => normalizarResultado(r, fuente, searchIn)).filter(Boolean);
    const totalDeclarado = datos.total !== null && datos.total !== undefined && Number.isFinite(Number(datos.total));
    const total = totalDeclarado ? Number(datos.total) : resultados.length;
    return {
      ok: true, total, totalFuente: total,
      // El API todavía no expone paginación verificada. El resultado de 25 es
      // una muestra; la cosecha ensancha cobertura con términos distintos.
      totalParcial: !totalDeclarado || total > resultados.length, revisados: resultados.length,
      siguienteDesde: null, pagina: 1, porPagina: resultados.length,
      searchIn, modo, resultados,
    };
  } catch (e) {
    if (e?.codigo) throw e;
    if (e?.name === 'AbortError') throw errores.tiempoAgotado(TIMEOUT_MS);
    throw errores.indiceFuenteFalla(fuente, e?.cause?.code || e?.message || 'error de red');
  }
}
