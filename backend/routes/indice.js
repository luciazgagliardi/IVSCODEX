/**
 * Rutas del índice propio (el "robot").
 *
 *   POST /api/indice/<fuente>/buscar      { q, pagina?, tribunal?, modo?, excluir? }
 *     (tribunal solo lo usa "mendoza": SC | CC | CT — ver lib/indiceMza.js)
 *   POST /api/indice/<fuente>/fragmentos  { q, urls } -> un pasaje por documento
 *   GET  /api/indice/<fuente>/estado                  -> cuánto hay guardado
 *
 * La búsqueda siempre le pregunta al sitio de origen en el momento —nunca
 * sirve solo la copia guardada como si fuera una búsqueda nueva— y de paso
 * la va guardando. Una fuente por módulo en lib/, todas con la misma forma
 * de entrada/salida para poder montarlas acá sin repetir código. Ver README
 * y los planes de este cambio.
 */

import express from 'express';
import { FUENTES, consultaDeArticulo } from '../lib/fuentes.js';
import { obtenerDocumento } from '../lib/documento.js';
import { resumenDeArticulo } from '../lib/indiceDialnet.js';
import { upsertRegistros, estadoIndice, buscarEnIndice } from '../lib/indice.js';
import { estadoAcervo, textosDe, agregarAlAcervo, acervoCubre, buscarPagina, sumarVivos } from '../lib/acervo.js';
import { IVSPasajes } from '../lib/pasajes.js';
import { marcarUsoCaba, estadoCosechaCaba } from '../lib/cosechaCaba.js';
import { errores, ErrorApp } from '../lib/errores.js';
import { proponerAnillo, hayModelo } from '../lib/proponerAnillo.js';
import { NORMAS, articuloDe, rubricaDe } from '../lib/legislacion.js';
import { serieOficial } from '../lib/series.js';

export const router = express.Router();

/** Un año utilizable: cuatro cifras dentro de un rango con sentido judicial. */
function anioValido(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1800 && n <= 2200;
}

/** Los modos de búsqueda que entiende la API. Cualquier otro se ignora. */
const MODOS = new Set(['exacta', 'todas', 'alguna']);

/** El host de una URL, o '' si no se puede leer. */
const hostDe = (u) => { try { return new URL(u).hostname; } catch { return ''; } };

/** Las bases cuyo texto leído del documento se guarda en el acervo (las que no mandan texto con el resultado). */
const GUARDAN_TEXTO = new Set(['caba', 'juristeca', 'rionegro']);

/** Cuántos documentos como mucho se traen en un mismo pedido de fragmentos. */
const MAX_FRAGMENTOS = 6;
/** Cuánto se trabaja en una tanda de fragmentos antes de devolver lo que haya (ms). */
const PRESUPUESTO_MS = 22_000;
/** Caracteres a cada lado de la coincidencia en el pasaje devuelto. */
const VENTANA = 160;


/**
 * Dónde termina el encabezado y empieza el fallo en sí.
 *
 * Todo fallo arranca con el número de expediente y la carátula completa,
 * que puede ser larguísima ("...S/ QUEJA POR RECURSO DE INCONSTITUCIONALIDAD
 * DENEGADO (CIVIL) EN X C/ Y S/ DAÑOS Y PERJUICIOS..."). Una coincidencia
 * ahí no aporta nada: la carátula ya se ve en el título del resultado, y
 * encima hace que el pasaje sea el título repetido. Por eso se busca el
 * primer "Vistos:" / "Resulta:" / etc., que es donde arranca el texto real;
 * un largo fijo no alcanza porque las carátulas varían muchísimo.
 */
function inicioDelCuerpo(texto) {
  const m = /\b(vistos?|resulta|resultan|antecedentes|fundamentos|considerandos?)\s*:/i.exec(texto);
  if (m) return m.index + m[0].length;
  return Math.min(400, Math.floor(texto.length / 3));
}

/**
 * Recorta un pasaje del texto alrededor de la coincidencia más útil.
 *
 * Es el equivalente al sumario que Mendoza manda ya armado con cada
 * resultado. CABA no manda nada de eso —solo carátula, secretaría y
 * fecha— así que el pasaje hay que sacarlo del documento en sí.
 */
function recortarPasaje(texto, q, { exigir = false } = {}) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpio) return '';
  // el tramo con más palabras de la búsqueda, sin acentos y por la raíz (lib/pasajes.js), en el
  // cuerpo del fallo antes que en la carátula; sin coincidencia, el arranque del cuerpo (o nada, si se exige)
  return IVSPasajes.pasaje(limpio, q, { desde: inicioDelCuerpo(limpio), largo: VENTANA * 2, exigir }).texto;
}

/**
 * Buscar los fallos que aplican un artículo. Es otra cosa que buscar texto.
 *
 * Una sola consulta no alcanza, y está medido contra los sitios reales:
 *
 *  - Cada motor quiere la cita escrita distinto. Los de tipo SAIJ (SAIJ,
 *    CSJN, Dialnet) buscan con OR y rinden con la palabra entera
 *    ("artículo 1741"); los formularios que hacen LIKE (Mendoza, CABA)
 *    rinden con la abreviatura ("art 1741"). Ver COMO_SE_CITA en fuentes.js.
 *
 *  - Y hay fuentes donde el número NO ESTÁ EN NINGÚN LADO. Mendoza indexa
 *    el sumario y las voces del tesauro, que describen el TEMA: buscar
 *    "art 1710" ahí da CERO, y no por estar mal escrito — probado también
 *    "artículo 1710" y "1710" pelado, los tres cero. Pero "prevención del
 *    daño", que es la rúbrica de ese artículo, da CINCUENTA. También se
 *    probó el campo "articulo" del propio formulario de Mendoza: lo ignora,
 *    devuelve el total sin filtrar (34.283 con y sin él).
 *
 * Por eso se corren VARIAS formas y se unen los resultados, sin repetir:
 * el número como lo escribe cada motor, el número pelado, y la rúbrica del
 * artículo sacada del texto oficial de InfoLeg. Un fallo puede aparecer por
 * cualquiera de las tres.
 *
 * En este modo no hay paginación: se devuelve la unión de la primera vuelta
 * de cada forma. Paginar sobre tres streams que se solapan daría saltos y
 * repeticiones, y para "¿quién aplicó este artículo?" lo que importa es la
 * cobertura, no llegar al resultado número doscientos.
 */
async function buscarPorArticulo({ slug, buscar, art, norma, modo, excluir, anioDesde, anioHasta, tribunal }) {
  const formas = [];
  const agregar = (t) => { const v = String(t || '').trim(); if (v && !formas.includes(v)) formas.push(v); };

  agregar(consultaDeArticulo(slug, art));   // la que este motor entiende
  agregar(art);                              // el número pelado
  const formasPorNumero = formas.length;     // hasta acá, todo cita el número

  let rubrica = null;
  if (norma) {
    try {
      const ficha = await articuloDe(norma, art);   // cacheado en disco
      rubrica = rubricaDe(ficha.texto);
      agregar(rubrica);
    } catch { /* sin rúbrica se busca igual, sólo por número */ }
  }

  const porId = new Map();
  const usadas = [];
  for (const forma of formas) {
    try {
      const r = await buscar({
        q: forma,
        pagina: 1,
        // Siempre "todas las palabras": con "exacta" un fallo que dice
        // "artículo 1741" no matchearía la forma "art 1741", que es
        // justamente lo que hay que evitar acá.
        modo: 'todas',
        // Sin aflojar: si ningún fallo trae el número, la respuesta correcta
        // es cero. Bajar el listón acá devolvería fallos que sólo dicen
        // "artículo", presentados como si citaran el que se buscó.
        aflojar: false,
        ...(excluir ? { excluir: String(excluir) } : {}),
        ...(anioValido(anioDesde) ? { anioDesde: Number(anioDesde) } : {}),
        ...(anioValido(anioHasta) ? { anioHasta: Number(anioHasta) } : {}),
        ...(tribunal ? { tribunal } : {}),
      });
      const porNumero = formas.indexOf(forma) < formasPorNumero;
      let nuevos = 0;
      for (const x of (r.resultados || [])) {
        if (!x || !x.id) continue;
        if (porId.has(x.id)) {
          // Si ya estaba por el tema y ahora aparece por el número, gana el
          // número: es la coincidencia fuerte.
          if (porNumero) porId.get(x.id).citaElNumero = true;
          continue;
        }
        // Marca de cómo apareció. Los que entran sólo por la rúbrica tratan
        // el TEMA del artículo, que no es lo mismo que citarlo: la pantalla
        // lo dice, porque alguien podría citarlos creyendo que lo aplican.
        porId.set(x.id, { ...x, citaElNumero: porNumero });
        nuevos++;
      }
      usadas.push({ forma, encontrados: (r.resultados || []).length, nuevos });
    } catch (e) {
      usadas.push({ forma, error: (e && e.message) || 'falló' });
    }
  }

  // Si TODAS las formas fallaron, esto no es "no hay resultados": es que la
  // fuente no contestó, y hay que decirlo con un error para que el frontend
  // pueda recurrir a su respaldo. Sin esto, SAIJ —que le niega la conexión al
  // servidor publicado— devolvía cero como si el artículo no estuviera en
  // ningún fallo, y el navegador nunca tomaba el relevo.
  const fallaron = usadas.filter((u) => u.error);
  if (fallaron.length === usadas.length && usadas.length) {
    throw errores.indiceFuenteFalla(slug, fallaron[0].error);
  }

  const resultados = [...porId.values()];
  return {
    total: resultados.length,
    totalFuente: null,
    siguienteDesde: null,
    // Es un piso: se unió la primera vuelta de cada forma, no todo lo que hay.
    totalParcial: true,
    revisados: 0,
    aflojado: false,
    pagina: 1,
    porPagina: resultados.length,
    resultados,
    // Con qué se preguntó y qué aportó cada forma. Va a la respuesta para que
    // la pantalla pueda decirlo: si aparecieron por la rúbrica y no por el
    // número, el abogado tiene que saberlo antes de citarlos.
    porArticulo: { articulo: art, rubrica, formas: usadas },
  };
}

/** Largo máximo de una consulta de búsqueda. */
const MAX_CONSULTA = 500;

/*
 * La copia local (el acervo, lib/acervo.js) contesta al instante y con el total
 * exacto de lo que tiene, de a páginas. Se usa:
 *   - cuando la pantalla la pide junto con la búsqueda en vivo (soloLocal), para
 *     mostrar resultados enseguida mientras el sitio oficial contesta;
 *   - para seguir paginando una búsqueda que vino de ahí (local);
 *   - cuando el sitio no le contesta al servidor (firewall, caído, fuera de la
 *     región): durante media hora no se lo hace esperar a nadie y se contesta con
 *     la copia; una sola consulta de fondo vuelve a probar el sitio, y lo que
 *     traiga entra a la copia.
 * Cada búsqueda en vivo que sí contesta suma a la copia lo que todavía no tenía:
 * así crece de a poco, con lo que la gente busca, sin barridos.
 */
const SIN_ACCESO_MS = 30 * 60 * 1000;
const sinAcceso = new Map(); // base → hasta cuándo se contesta con la copia sin preguntarle al sitio
const sondeos = new Map();   // base → cuándo se volvió a probar el sitio por última vez
const accesible = (slug) => !(sinAcceso.get(slug) > Date.now());
function sondear(slug, buscarVivo) {
  if (Date.now() - (sondeos.get(slug) || 0) < SIN_ACCESO_MS) return;
  sondeos.set(slug, Date.now());
  buscarVivo()
    .then((r) => { sinAcceso.delete(slug); sumarVivos(slug, r?.resultados).catch(() => {}); })
    .catch(() => sinAcceso.set(slug, Date.now() + SIN_ACCESO_MS));
}
/** Una página de la copia local, con la forma de la respuesta en vivo. null si la copia no tiene esa base. */
async function paginaLocal(slug, consulta, { modo, excluir, anioDesde, anioHasta, provincia, tribunal, desde = 0, porPagina = 20 }) {
  const o = { modo: MODOS.has(modo) ? modo : 'todas', excluir: typeof excluir === 'string' ? excluir.slice(0, 200) : '',
    ...(anioValido(anioDesde) ? { anioDesde: Number(anioDesde) } : {}), ...(anioValido(anioHasta) ? { anioHasta: Number(anioHasta) } : {}) };
  let p = buscarPagina(slug, consulta, { ...o, provincia: slug === 'saij' && typeof provincia === 'string' ? provincia.slice(0, 60) : '',
    tribunal: typeof tribunal === 'string' ? tribunal : '', desde, porPagina });
  if (!p) {
    // sin acervo para esa base: lo guardado por las búsquedas y el respaldo, también de a páginas
    const lista = await buscarEnIndice(slug, consulta, o);
    if (!lista.length) return null;
    const pos = Math.max(0, desde);
    p = { total: lista.length, resultados: lista.slice(pos, pos + porPagina), siguienteDesde: pos + porPagina < lista.length ? pos + porPagina : null };
  }
  return { total: p.total, totalFuente: null, siguienteDesde: p.siguienteDesde, resultados: p.resultados, totalParcial: false, revisados: 0, aflojado: false, desdeIndiceLocal: true };
}

// El catálogo de fuentes vive en lib/fuentes.js: lo comparten estas rutas y
// el verificador de citas (lib/verificarCita.js).
for (const { slug, buscar } of FUENTES) {
  const atenderBusqueda = async (req, res, next) => {
    try {
      const cuerpo = req.body || {};
      const { pagina, desde, tribunal, modo, excluir, anioDesde, anioHasta, articulo, norma, provincia, variantes } = cuerpo;
      // La consulta es solo texto y de largo acotado: un objeto o un texto de
      // megabytes no debe llegar a los buscadores oficiales.
      const q = typeof cuerpo.q === 'string' ? cuerpo.q.trim().slice(0, MAX_CONSULTA) : '';
      const art = String(articulo || '').trim();
      const esPorArticulo = /^\d{1,4}(\s*(bis|ter|quater))?$/i.test(art);

      // Buscar por artículo es un caso aparte y por eso sale por otra puerta:
      // NO alcanza con una consulta. Ver buscarPorArticulo().
      if (esPorArticulo) {
        const salida = await buscarPorArticulo({ slug, buscar, art, norma, modo, excluir, anioDesde, anioHasta, tribunal });
        const guardadas = await upsertRegistros(slug, salida.resultados);
        return res.json({ ok: true, ...salida, guardadosEnIndice: guardadas, fuente: slug });
      }

      const consulta = q;
      if (!consulta) throw errores.consultaVacia();
      if (slug === 'caba') marcarUsoCaba(); // la cosecha de fondo le deja el sitio a quien está buscando

      const arranque = Date.now();
      const desdeN = Number.isFinite(Number(desde)) && Number(desde) >= 0 ? Number(desde) : 0;
      const pedidoLocal = { modo, excluir, anioDesde, anioHasta, provincia, tribunal, desde: desdeN };

      // la copia local, a pedido (o para seguir paginando lo que vino de ahí)
      if (cuerpo.soloLocal === true || cuerpo.local === true) {
        const loc = await paginaLocal(slug, consulta, pedidoLocal);
        if (!loc) return res.json({ ok: false, codigo: 'SIN_COPIA_LOCAL', fuente: slug });
        return res.json({ ok: true, ...loc, ms: Date.now() - arranque });
      }

      let total, totalFuente, siguienteDesde = null, resultados, desdeIndiceLocal = false, avisoFalla = null;
      let totalParcial = false, revisados = 0, aflojado = false;
      const parametrosVivo = {
        q: consulta,
        pagina: Number(pagina) > 0 ? Number(pagina) : 1,
        // El cursor: la fila del sitio donde sigue esta página. Lo devuelve
        // el pedido anterior como "siguienteDesde" y el frontend lo manda
        // de vuelta tal cual. Numerar las páginas no alcanza cuando el
        // filtro corre de este lado — ver lib/paginarFiltrado.js.
        ...(Number.isFinite(Number(desde)) && Number(desde) >= 0 ? { desde: Number(desde) } : {}),
        // Rango de años. Ojo con el nombre: "desde" de arriba es el CURSOR
        // (una fila del sitio) y esto es un AÑO — dos cosas distintas que
        // se llaman parecido, de ahí "anioDesde". Se filtra en
        // lib/relevancia.js, igual para las seis fuentes.
        ...(anioValido(anioDesde) ? { anioDesde: Number(anioDesde) } : {}),
        ...(anioValido(anioHasta) ? { anioHasta: Number(anioHasta) } : {}),
        // El modo lo entiende cada fuente a su manera: CABA lo resuelve en
        // el propio sitio, Mendoza y SAIJ lo filtran despues. Ver
        // lib/relevancia.js.
        ...(MODOS.has(modo) ? { modo } : {}),
        ...(typeof excluir === 'string' && excluir.trim() ? { excluir: excluir.slice(0, 200) } : {}),
        ...(typeof tribunal === 'string' && /^[A-Za-z0-9_-]{1,30}$/.test(tribunal) ? { tribunal } : {}),
        // Sólo SAIJ: filtra por provincia (las demás fuentes lo ignoran).
        ...(typeof provincia === 'string' && provincia.length <= 60 ? { provincia } : {}),
      };

      // un sitio que no le contesta al servidor: la copia, sin hacer esperar a nadie; de fondo se lo vuelve a probar
      if (!accesible(slug) && acervoCubre(slug)) {
        sondear(slug, () => buscar(parametrosVivo));
        const loc = await paginaLocal(slug, consulta, pedidoLocal);
        if (loc) return res.json({ ok: true, ...loc, ms: Date.now() - arranque });
      }

      try {
        ({ total, totalFuente = null, siguienteDesde = null, resultados, totalParcial = false, revisados = 0, aflojado = false } = await buscar(parametrosVivo));
        sinAcceso.delete(slug);
        // lo que trajo el sitio y la copia todavía no tenía, a la copia (de fondo)
        sumarVivos(slug, resultados).catch(() => {});
      } catch (e) {
        // El sitio de origen no respondió o cambió de forma —no dejamos a
        // quien busca sin nada: probamos con lo que ya quedó guardado de
        // búsquedas anteriores. Es parcial y puede estar viejo, pero es
        // mejor que un error en pantalla, y el frontend avisa que es local.
        // durante media hora, la copia contesta sin hacer esperar a nadie (ver sondear)
        if (!(e instanceof ErrorApp && e.codigo === 'CONSULTA_VACIA')) sinAcceso.set(slug, Date.now() + SIN_ACCESO_MS);
        // la copia local, de a páginas y con su total exacto. El sitio no dijo cuántos tiene:
        // totalFuente va null para que la pantalla no muestre un total de origen inventado.
        const loc = await paginaLocal(slug, consulta, pedidoLocal);
        if (!loc || !loc.resultados.length) throw e instanceof ErrorApp ? e : errores.indiceFuenteFalla(slug, e?.message);
        ({ total, totalFuente, siguienteDesde, resultados, totalParcial, revisados, aflojado, desdeIndiceLocal } = loc);
        avisoFalla = (e instanceof ErrorApp ? e.message : null) || 'El sitio de origen no respondió.';
      }

      // CABA no siempre avisa con un error cuando algo salió mal: a veces
      // devuelve directamente "0 resultados" para una consulta que sí tiene
      // (visto con acentos que el sitio no matchea, ver lib/indiceCaba.js).
      // Antes de creerle el cero, se revisa si el índice local tiene algo.
      if (slug === 'caba' && total === 0) {
        const loc = await paginaLocal(slug, consulta, pedidoLocal);
        if (loc && loc.resultados.length) {
          ({ total, totalFuente, siguienteDesde, resultados, totalParcial, revisados, aflojado, desdeIndiceLocal } = loc);
          avisoFalla = 'La fuente CABA no devolvió coincidencias; muestro resultados guardados localmente, que pueden estar desactualizados.';
        }
      }

      // Formas equivalentes del término (el anillo del tesauro: "daño moral",
      // "daño extrapatrimonial", "daño inmaterial"…). Cada tribunal escribe una
      // distinta y buscar sólo una deja fallos afuera. Sólo en la primera página:
      // se agregan hasta 10 resultados nuevos por variante, marcados con la forma
      // que los encontró, y no tocan la paginación de la búsqueda principal.
      const listaVariantes = Array.isArray(variantes)
        ? [...new Set(variantes.filter((v) => typeof v === 'string' && v.trim() && v.length <= 100).map((v) => v.trim()))]
            .filter((v) => v.toLowerCase() !== consulta.toLowerCase()).slice(0, 4)
        : [];
      const primeraPagina = !(Number(desde) > 0) && !(Number(pagina) > 1);
      if (listaVariantes.length && primeraPagina && !desdeIndiceLocal) {
        const vistos = new Set(resultados.map((r) => r.id));
        const extras = [];
        const tope = new Promise((ok) => setTimeout(ok, 20_000)); // las variantes no demoran la respuesta más que esto
        const tareas = listaVariantes.map(async (v) => {
          try {
            const r = await buscar({
              q: v, pagina: 1, porPagina: 10,
              ...(MODOS.has(modo) ? { modo } : {}),
              ...(excluir ? { excluir: String(excluir) } : {}),
              ...(anioValido(anioDesde) ? { anioDesde: Number(anioDesde) } : {}),
              ...(anioValido(anioHasta) ? { anioHasta: Number(anioHasta) } : {}),
              ...(tribunal ? { tribunal } : {}),
              ...(typeof provincia === 'string' && provincia.length <= 60 ? { provincia } : {}),
            });
            for (const x of (r.resultados || []).slice(0, 10)) {
              if (!x || vistos.has(x.id)) continue;
              vistos.add(x.id);
              extras.push({ ...x, variante: v });
            }
          } catch {
            // una variante que falla no arruina la búsqueda principal
          }
        });
        await Promise.race([Promise.all(tareas), tope]);
        if (extras.length) {
          resultados = resultados.concat(extras);
          total = (total || 0) + extras.length;
        }
      }

      // los que llegan sin texto (CABA, Juristeca, Dialnet) y ya tienen el suyo en el acervo, salen con él:
      // así el pasaje aparece al instante, sin ir a leer el PDF de nuevo
      const sinTexto = resultados.filter((r) => r && !r.sumario);
      if (sinTexto.length) {
        const textos = textosDe(sinTexto.map((r) => r.id));
        // sólo si lo buscado está en lo guardado (que es el principio del fallo); si no, el pasaje sale del PDF
        for (const r of sinTexto) if (textos.has(r.id)) r.sumario = recortarPasaje(textos.get(r.id), consulta, { exigir: true }) || undefined;
      }

      const guardados = desdeIndiceLocal
        ? (await estadoIndice(slug)).guardados
        : await upsertRegistros(slug, resultados.map(({ variante, ...r }) => r)); // la marca de variante es de esta búsqueda, no del documento

      res.json({
        ok: true,
        total,
        // Cuando el sitio de origen no sabe hacer el modo pedido, el filtro
        // corre de este lado: "total" es entonces lo verificado, no lo que
        // dice su contador. Ver lib/relevancia.js.
        //
        // "totalFuente" es el contador del propio sitio para esas palabras.
        // Los dos números juntos son lo único que se puede afirmar sin
        // mentir: "N verificados entre los primeros M que se miraron, sobre
        // los totalFuente que dice tener el sitio". Con uno solo, el de
        // arriba se leía como el total y no lo es.
        totalFuente,
        siguienteDesde,
        totalParcial,
        revisados,
        aflojado,
        resultados,
        guardadosEnIndice: guardados,
        desdeIndiceLocal,
        avisoFalla,
        ms: Date.now() - arranque,
      });
    } catch (e) {
      next(e instanceof ErrorApp ? e : errores.indiceFuenteFalla(slug, e?.message));
    }
  };
  router.post(`/indice/${slug}/buscar`, atenderBusqueda);
  // la copia local sola: no le pregunta nada a los sitios oficiales, así que no cuenta para el límite de peticiones (index.js)
  router.post(`/indice/${slug}/local`, (req, res, next) => {
    req.body = { ...(req.body || {}), local: true };
    return atenderBusqueda(req, res, next);
  });

  /**
   * Trae varios documentos y devuelve un pasaje de cada uno.
   *
   * Va en una sola petición y no en una por documento a propósito: el
   * límite de peticiones del servidor es por navegador (40 cada 5 min en
   * index.js), y pedir 20 documentos sueltos lo quemaría en una búsqueda.
   * Acá adentro se descargan de a uno igual, respetando la espera entre
   * pedidos al sitio oficial (esperarTurno, en lib/descargador.js).
   *
   * Un documento que falla no arruina al resto: vuelve con "error" y los
   * demás con su pasaje.
   */
  router.post(`/indice/${slug}/fragmentos`, async (req, res, next) => {
    try {
      const urls = req.body?.urls;
      const q = typeof req.body?.q === 'string' ? req.body.q.trim().slice(0, MAX_CONSULTA) : '';
      if (!q) throw errores.consultaVacia();
      if (!Array.isArray(urls) || !urls.length) {
        return res.json({ ok: true, fragmentos: [] });
      }

      const arranque = Date.now();
      if (slug === 'caba') marcarUsoCaba();
      // los datos de cada resultado (opcional), para guardar su texto en el acervo
      const registrosPorUrl = new Map((Array.isArray(req.body?.registros) ? req.body.registros : []).slice(0, MAX_FRAGMENTOS)
        .filter((r) => r && typeof r.id === 'string' && typeof r.url === 'string' && /^[a-z]+_[\w-]{1,80}$/.test(r.id))
        .map((r) => [r.url, { id: r.id, caratula: String(r.caratula || '').slice(0, 400), fecha: String(r.fecha || '').slice(0, 20), tribunal: String(r.tribunal || '').slice(0, 200), expediente: String(r.expediente || '').slice(0, 80) }]));
      const pedidas = urls.filter((u) => typeof u === 'string' && u && u.length <= 2048).slice(0, MAX_FRAGMENTOS);

      const fragmentos = [];
      let pendientes = [];
      // Si un sitio rechaza un documento de la tanda (401/403), los demás de ese
      // sitio en la MISMA tanda vuelven con el mismo aviso sin reintentar. No se
      // recuerda entre tandas: ahora que Chrome resuelve el desafío de Cloudflare,
      // un 403 puede ser un tropiezo de un momento y no tiene que dejar a todos
      // sin pasajes durante minutos.
      const SITIOS_CERRADOS = new Map(); // host -> { mensaje }
      // los documentos de la tanda se leen en paralelo (la espera de cortesía por sitio la sigue
      // poniendo esperarTurno): uno por uno, cuatro PDF eran doce segundos de pantalla vacía
      const porUrl = new Map();
      const leerUno = async (url, i) => {
        // Los documentos largos (sentencias de la Corte IDH, de varios MB) pueden
        // sumar más de lo que el navegador espera por una tanda (40 s). Pasado el
        // presupuesto se devuelve lo ya leído y se avisa cuáles faltan, para que la
        // pantalla los pida en la tanda siguiente. El primero siempre se procesa.
        if (i > 0 && Date.now() - arranque > PRESUPUESTO_MS) { pendientes.push(url); return; }
        try {
          // Dialnet: lo útil es el resumen del artículo (otra página de la misma ficha).
          if (/^https?:\/\/dialnet\.unirioja\.es\/servlet\/articulo/i.test(url)) {
            const resumen = await resumenDeArticulo(url);
            porUrl.set(url, { url, fragmento: resumen ? recortarPasaje(resumen, q, { exigir: true }) : '', error: resumen ? null : 'Dialnet no publica un resumen de este artículo.' });
            return;
          }
          const cerrado = SITIOS_CERRADOS.get(hostDe(url));
          if (cerrado) { porUrl.set(url, { url, fragmento: '', error: cerrado.mensaje }); return; }
          const doc = await obtenerDocumento(url);
          porUrl.set(url, { url, fragmento: recortarPasaje(doc.texto, q, { exigir: slug === 'dialnet' }), error: null });
          // el texto leído queda en el acervo: la próxima vez ese fallo sale con su pasaje al instante
          const reg = registrosPorUrl.get(url);
          if (reg && GUARDAN_TEXTO.has(slug) && doc.texto && doc.texto.length > 200) {
            const t = doc.texto.replace(/\s+/g, ' ').trim();
            agregarAlAcervo([{ ...reg, fuente: slug, linkFallo: url, sumario: t.length > 6000 ? `${t.slice(0, 6000).replace(/\s+\S*$/, '')} …` : t }]).catch(() => {});
          }
        } catch (e) {
          const mensaje = e instanceof ErrorApp ? e.message : 'No se pudo leer este documento.';
          if (e?.codigo === 'RESPUESTA_NO_OK' && [401, 403].includes(e.extra?.estadoOrigen)) {
            SITIOS_CERRADOS.set(hostDe(url), { mensaje });
          }
          porUrl.set(url, { url, fragmento: '', error: mensaje });
        }
      };
      await Promise.all(pedidas.map((u, i) => leerUno(u, i)));
      for (const u of pedidas) if (porUrl.has(u)) fragmentos.push(porUrl.get(u));
      res.json({ ok: true, fragmentos, ...(pendientes.length ? { pendientes } : {}), ms: Date.now() - arranque });
    } catch (e) {
      next(e instanceof ErrorApp ? e : errores.indiceFuenteFalla(slug, e?.message));
    }
  });

  router.get(`/indice/${slug}/estado`, async (_req, res, next) => {
    try {
      res.json({ ok: true, ...(await estadoIndice(slug)) });
    } catch (e) {
      next(e);
    }
  });
}

/** Qué normas se pueden consultar por artículo (ver lib/legislacion.js). */
/**
 * ¿Se pueden pedir propuestas de términos equivalentes?
 *
 * Devuelve un booleano y nada más: nunca la clave ni un fragmento de ella.
 * El frontend lo usa para mostrar o esconder el botón, así que sin esto
 * tendría que ofrecer algo que después falla.
 */
router.get('/tesauro/estado', (_req, res) => {
  res.json({ ok: true, disponible: hayModelo() });
});

/**
 * Propone un anillo de sinonimia para un término: POST /api/tesauro/proponer
 *
 * Devuelve una PROPUESTA, no un cambio: nada entra al tesauro hasta que una
 * abogada lo aprueba y queda escrito en el archivo, con firma y fecha. El
 * modelo acá no busca ni afirma nada sobre ningún fallo — su única salida
 * son términos de búsqueda (ver la nota grande de lib/proponerAnillo.js).
 */
router.post('/tesauro/proponer', async (req, res, next) => {
  try {
    const termino = String(req.body?.termino || '').trim();
    if (!termino) throw errores.consultaVacia();
    if (termino.length > 120) throw errores.citaDemasiadoLarga();

    const ramas = Array.isArray(req.body?.ramas)
      ? req.body.ramas.filter((x) => typeof x === 'string').slice(0, 60)
      : [];
    const yaEnTesauro = Array.isArray(req.body?.yaEnTesauro)
      ? req.body.yaEnTesauro.filter((x) => typeof x === 'string').slice(0, 200)
      : [];

    res.json({ ok: true, propuesta: await proponerAnillo(termino, { ramas, yaEnTesauro }) });
  } catch (e) {
    next(e);
  }
});

/**
 * Una serie oficial que el navegador no puede leer directo (hoy, RIPTE):
 * GET /api/series/ripte → { ok, datos: [[fecha, valor], …], fuente }.
 * Ver lib/series.js.
 */
router.get('/series/:clave', async (req, res, next) => {
  try {
    if (!/^[a-z]{2,20}$/.test(req.params.clave)) throw errores.normaDesconocida(req.params.clave);
    const s = await serieOficial(req.params.clave);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ ok: true, datos: s.datos, fuente: s.fuente, desactualizada: !!s.desactualizada });
  } catch (e) {
    next(e);
  }
});

router.get('/legislacion/normas', (_req, res) => {
  res.json({ ok: true, normas: NORMAS.map((n) => ({ clave: n.clave, nombre: n.nombre, sigla: n.sigla, aviso: n.aviso || null })) });
});

/**
 * El texto oficial de un artículo: GET /api/legislacion/<norma>/<articulo>
 *
 * Es lo que faltaba para cerrar el círculo — un fallo se lee citando
 * artículos, y hasta ahora había que salir a otra pestaña a buscar el texto.
 */
router.get('/legislacion/:norma/:articulo', async (req, res, next) => {
  try {
    // Las claves de norma son cortas y alfanuméricas; el artículo, un número.
    if (!/^[a-z0-9_-]{1,40}$/i.test(req.params.norma) || req.params.articulo.length > 20) {
      throw errores.normaDesconocida(req.params.norma);
    }
    res.json({ ok: true, ...(await articuloDe(req.params.norma, req.params.articulo)) });
  } catch (e) {
    next(e instanceof ErrorApp ? e : errores.indiceFuenteFalla('infoleg', e?.message));
  }
});

/**
 * Si cada buscador oficial le contesta a ESTE servidor, y cuánto tarda.
 *
 * Nació de un problema concreto: SAIJ funciona desde una conexión común
 * pero devuelve 403 al servidor publicado (un datacenter en Brasil), y
 * desde afuera eso se veía como "no aparecen resultados" sin más. Con esta
 * ruta se distingue de un vistazo si el problema es el sitio de origen, la
 * red del servidor, o nuestro código. El frontend, cuando el servidor no
 * llega a SAIJ, repite la consulta desde el navegador de quien busca.
 */
let ultimoEstado = { en: 0, dato: null };
/** Cuántos fallos tiene el acervo propio (lib/acervo.js), por base, y de qué versión. */
router.get('/acervo/estado', (_req, res) => {
  const e = estadoAcervo();
  res.json({ ok: true, activo: e.activo, version: e.version, conteos: e.conteos, importando: e.importando, error: e.error || null, cosechaCaba: estadoCosechaCaba() });
});

router.get('/fuentes/estado', async (_req, res) => {
  // Cada llamada hace una búsqueda de verdad en cada sitio oficial: se
  // reutiliza el último resultado durante 2 minutos para que esta ruta no
  // sirva para multiplicar pedidos contra terceros.
  if (ultimoEstado.dato && Date.now() - ultimoEstado.en < 120000) {
    return res.json({ ok: true, fuentes: ultimoEstado.dato });
  }
  const fuentes = await Promise.all(
    FUENTES.map(async ({ slug, buscar }) => {
      const arranque = Date.now();
      try {
        const r = await buscar({ q: 'daño', pagina: 1 });
        return { slug, alcanzable: true, resultados: r.resultados.length, ms: Date.now() - arranque };
      } catch (e) {
        return {
          slug,
          alcanzable: false,
          codigo: e?.codigo || 'ERROR',
          motivo: e instanceof ErrorApp ? e.message : String(e?.message || e).slice(0, 200),
          ms: Date.now() - arranque,
        };
      }
    })
  );
  ultimoEstado = { en: Date.now(), dato: fuentes };
  res.json({ ok: true, fuentes });
});
