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
import { buscarMza } from '../lib/indiceMza.js';
import { buscarCaba } from '../lib/indiceCaba.js';
import { buscarSaij } from '../lib/indiceSaij.js';
import { obtenerDocumento } from '../lib/documento.js';
import { upsertRegistros, estadoIndice, buscarEnIndice } from '../lib/indice.js';
import { errores, ErrorApp } from '../lib/errores.js';

export const router = express.Router();

/** Los modos de búsqueda que entiende la API. Cualquier otro se ignora. */
const MODOS = new Set(['exacta', 'todas', 'alguna']);

/** Cuántos documentos como mucho se traen en un mismo pedido de fragmentos. */
const MAX_FRAGMENTOS = 6;
/** Caracteres a cada lado de la coincidencia en el pasaje devuelto. */
const VENTANA = 160;

/**
 * Qué buscar dentro del documento, en orden de preferencia.
 *
 * Primero la consulta entera: si alguien busca "daño moral", el pasaje
 * tiene que mostrar "daño moral", no la primera vez que aparece "daño"
 * suelto en cualquier otra parte del fallo. Recién si esa frase no está
 * literal se cae a las palabras por separado.
 */
function agujasDe(q) {
  const limpia = String(q || '').replace(/["'()]/g, ' ').replace(/\s+/g, ' ').trim();
  const sueltas = limpia
    .split(' ')
    .filter((p) => p.length >= 3 && !/^(and|or|not|site)$/i.test(p));

  const agujas = [];
  if (limpia.includes(' ') && limpia.length >= 3) agujas.push(limpia);
  for (const p of sueltas) if (!agujas.includes(p)) agujas.push(p);
  return agujas;
}

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
function recortarPasaje(texto, q) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpio) return '';

  const enMinusculas = limpio.toLocaleLowerCase('es');
  const cuerpo = inicioDelCuerpo(limpio);

  let pos = -1;          // coincidencia en el cuerpo del fallo: la que sirve
  let posEncabezado = -1; // la misma pero dentro de la carátula: último recurso

  for (const aguja of agujasDe(q)) {
    const buscada = aguja.toLocaleLowerCase('es');
    const enCuerpo = enMinusculas.indexOf(buscada, cuerpo);
    if (enCuerpo !== -1) { pos = enCuerpo; break; }
    if (posEncabezado === -1) posEncabezado = enMinusculas.indexOf(buscada);
  }
  if (pos === -1) pos = posEncabezado;

  // Sin coincidencia (pasa cuando el buscador matcheó por una forma
  // declinada de la palabra): mostramos el arranque del cuerpo, que es
  // donde el fallo empieza a decir algo.
  if (pos === -1) {
    const trozo = limpio.slice(cuerpo, cuerpo + VENTANA * 2).trim();
    return (cuerpo > 0 ? '… ' : '') + trozo + (cuerpo + VENTANA * 2 < limpio.length ? ' …' : '');
  }

  const desde = Math.max(0, pos - VENTANA);
  const hasta = Math.min(limpio.length, pos + VENTANA);
  return (desde > 0 ? '… ' : '') + limpio.slice(desde, hasta).trim() + (hasta < limpio.length ? ' …' : '');
}

/** Una entrada por fuente indexada. slug = nombre de archivo en backend/indice/. */
const FUENTES = [
  { slug: 'mendoza', buscar: (args) => buscarMza(args) },
  { slug: 'caba', buscar: (args) => buscarCaba(args) },
  { slug: 'saij', buscar: (args) => buscarSaij(args) },
  // La Corte Suprema sale de SAIJ filtrando por su faceta de tribunal: el
  // sitio propio de la CSJN protege todos sus buscadores con reCAPTCHA.
  // Ver la nota en lib/indiceSaij.js.
  { slug: 'csjn', buscar: (args) => buscarSaij({ ...args, soloCsjn: true }) },
];

for (const { slug, buscar } of FUENTES) {
  router.post(`/indice/${slug}/buscar`, async (req, res, next) => {
    try {
      const { q, pagina, tribunal, modo, excluir } = req.body || {};
      if (!q) throw errores.consultaVacia();

      const arranque = Date.now();
      let total, resultados, desdeIndiceLocal = false, avisoFalla = null;
      let totalParcial = false, revisados = 0, aflojado = false;

      try {
        ({ total, resultados, totalParcial = false, revisados = 0, aflojado = false } = await buscar({
          q,
          pagina: Number(pagina) > 0 ? Number(pagina) : 1,
          // El modo lo entiende cada fuente a su manera: CABA lo resuelve en
          // el propio sitio, Mendoza y SAIJ lo filtran despues. Ver
          // lib/relevancia.js.
          ...(MODOS.has(modo) ? { modo } : {}),
          ...(excluir ? { excluir: String(excluir) } : {}),
          ...(tribunal ? { tribunal } : {}),
        }));
      } catch (e) {
        // El sitio de origen no respondió o cambió de forma —no dejamos a
        // quien busca sin nada: probamos con lo que ya quedó guardado de
        // búsquedas anteriores. Es parcial y puede estar viejo, pero es
        // mejor que un error en pantalla, y el frontend avisa que es local.
        resultados = await buscarEnIndice(slug, q, { modo, excluir });
        total = resultados.length;
        totalParcial = false;
        revisados = resultados.length;
        aflojado = false;
        desdeIndiceLocal = true;
        avisoFalla = (e instanceof ErrorApp ? e.message : null) || 'El sitio de origen no respondió.';
        if (!resultados.length) throw e instanceof ErrorApp ? e : errores.indiceFuenteFalla(slug, e?.message);
      }

      // CABA no siempre avisa con un error cuando algo salió mal: a veces
      // devuelve directamente "0 resultados" para una consulta que sí tiene
      // (visto con acentos que el sitio no matchea, ver lib/indiceCaba.js).
      // Antes de creerle el cero, se revisa si el índice local tiene algo.
      if (slug === 'caba' && total === 0) {
        const locales = await buscarEnIndice(slug, q, { modo, excluir });
        if (locales.length) {
          resultados = locales;
          total = locales.length;
          totalParcial = true;
          revisados = locales.length;
          desdeIndiceLocal = true;
          avisoFalla = 'La fuente CABA no devolvió coincidencias; muestro resultados guardados localmente, que pueden estar desactualizados.';
        }
      }

      const guardados = desdeIndiceLocal
        ? (await estadoIndice(slug)).guardados
        : await upsertRegistros(slug, resultados);

      res.json({
        ok: true,
        total,
        // Cuando el sitio de origen no sabe hacer el modo pedido, el filtro
        // corre de este lado: "total" es entonces lo verificado, no lo que
        // dice su contador. Ver lib/relevancia.js.
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
      const { q, urls } = req.body || {};
      if (!q) throw errores.consultaVacia();
      if (!Array.isArray(urls) || !urls.length) {
        return res.json({ ok: true, fragmentos: [] });
      }

      const arranque = Date.now();
      const pedidas = urls.filter((u) => typeof u === 'string' && u).slice(0, MAX_FRAGMENTOS);

      const fragmentos = [];
      for (const url of pedidas) {
        try {
          const doc = await obtenerDocumento(url);
          fragmentos.push({ url, fragmento: recortarPasaje(doc.texto, q), error: null });
        } catch (e) {
          fragmentos.push({
            url,
            fragmento: '',
            error: e instanceof ErrorApp ? e.message : 'No se pudo leer este documento.',
          });
        }
      }

      res.json({ ok: true, fragmentos, ms: Date.now() - arranque });
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
router.get('/fuentes/estado', async (_req, res) => {
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
  res.json({ ok: true, fuentes });
});
