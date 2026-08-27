/**
 * Paginar resultados que filtramos NOSOTROS, sin perder ni repetir ninguno.
 *
 * El problema que resuelve, dicho con el caso real que lo destapó: buscar
 * "daño moral" en Mendoza por frase exacta. El sitio devuelve 319 filas
 * ordenadas; nosotros revisamos 60, encontramos 52 que tienen la frase y
 * mostramos 20. Hasta ahí bien. La página 2 era el problema: cada fuente
 * calculaba dónde arrancar a partir del NÚMERO DE PÁGINA, y cada una lo
 * hacía distinto y mal.
 *
 *   - SAIJ arrancaba en la fila 20 (página 2 × 20 por página) cuando la
 *     página 1 ya había revisado hasta la 300: se pisaban 280 filas.
 *   - Dialnet igual, arrancando en la 21 sobre 100 ya revisadas.
 *   - Mendoza no se pisaba —avanzaba de a 60— pero tiraba a la basura las
 *     32 coincidencias que había encontrado y no llegó a mostrar.
 *
 * Las tres cosas son la misma confusión: la página N de RESULTADOS no es la
 * página N de FILAS del sitio, porque en el medio hay un filtro que descarta
 * una parte. La única forma de que las dos numeraciones no se despeguen es
 * no numerar: llevar un cursor con la fila exacta donde quedó la página
 * anterior y seguir desde ahí.
 *
 * Eso es lo que devuelve "siguienteDesde": la fila del sitio inmediatamente
 * posterior a la última que se llegó a mostrar. La página siguiente arranca
 * ahí y no se pierde ni se repite nada, sin importar cuántas filas haya
 * habido que descartar en el medio.
 *
 * Lo usan las cuatro fuentes que filtran de este lado (Mendoza, SAIJ,
 * Dialnet y Mendoza Legal). CABA no: resuelve los tres modos en su propio
 * formulario, así que su paginación ya es la de los resultados.
 */

import { filtrarPorModo } from './relevancia.js';

/**
 * Recorre las filas de una fuente desde una fila dada, filtrándolas, hasta
 * juntar una página de coincidencias o quedarse sin material.
 *
 * @param {object} opciones
 * @param {(offset: number) => Promise<Array<object|null>>} opciones.traer
 *   Trae una tanda que EMPIECE exactamente en `offset` (0-based). Cada
 *   fuente resuelve acá su propia forma de pedir: SAIJ, Dialnet y Mendoza
 *   Legal aceptan un offset cualquiera; Mendoza es por número de página y
 *   tiene que recortar.
 *
 *   El array devuelto tiene UNA POSICIÓN POR FILA DEL SITIO, y las filas que
 *   no se pudieron leer (una ficha sin id, un documento sin carátula) van
 *   como null en su lugar en vez de desaparecer. Es importante que sea así y
 *   no una lista compactada: el cursor apunta a filas del SITIO, y si las
 *   descartadas no ocuparan lugar, la cuenta se correría. Corrida para
 *   atrás, la página siguiente repetiría resultados; corrida para adelante
 *   —que es lo que pasaba con una lista compactada— se saltearía
 *   coincidencias sin que nadie se entere, que es bastante peor.
 * @param {number} opciones.desde  Fila del sitio donde arrancar.
 * @param {number|(() => number)} opciones.total  Cuántas filas dice tener el
 *   sitio. Puede ser una función para las fuentes que recién lo saben
 *   después del primer pedido (SAIJ lo manda en el cuerpo de la respuesta,
 *   no antes). Sirve para saber cuándo se agotó y no seguir pidiendo de
 *   gusto — varios de estos sitios, en vez de contestar "no hay más",
 *   devuelven la última página otra vez (probado contra Mendoza: next_p=20,
 *   21 y 40 devuelven las mismas 19 fichas finales). Sin este tope,
 *   "siguiente" repetiría contenido para siempre.
 * @param {number} opciones.maxTandas  Tope de pedidos al sitio dentro de un
 *   mismo pedido nuestro. Es la cortesía: cada tanda es tráfico real a un
 *   organismo, con su espera en el medio.
 * @returns {Promise<{resultados, revisados, siguienteDesde, aflojado}>}
 *   siguienteDesde es null cuando no queda nada más que revisar.
 */
export async function paginarFiltrado({
  traer, desde = 0, total = 0, porPagina = 20, q, modo = 'todas', excluir = '', maxTandas = 5,
  anioDesde = null, anioHasta = null, aflojar = true,
}) {
  const cuantasHay = () => (typeof total === 'function' ? Number(total()) || 0 : Number(total) || 0);
  const arranque = Math.max(0, Number(desde) || 0);
  const revisados = [];
  // Por cada registro aprovechable, en qué fila del sitio estaba. Es lo que
  // permite después apuntar el cursor a la fila siguiente a la última
  // MOSTRADA aunque en el medio se hayan descartado filas ilegibles.
  const filaDe = [];
  let cursor = arranque;
  let agotado = false;

  for (let tanda = 0; tanda < maxTandas; tanda++) {
    if (cuantasHay() && cursor >= cuantasHay()) { agotado = true; break; }

    const filas = await traer(cursor);
    if (!filas.length) { agotado = true; break; }

    // Cada registro se anota con la fila del sitio en la que estaba, que es
    // su posición en la tanda. Los null (filas ilegibles) ocupan lugar en la
    // numeración y no entran en lo que se filtra.
    for (let i = 0; i < filas.length; i++) {
      if (!filas[i]) continue;
      filaDe.push(cursor + i);
      revisados.push(filas[i]);
    }
    cursor += filas.length;

    // Sin aflojar mientras se recorre: si con todas las palabras ya alcanza
    // para llenar la página, no hace falta pedir otra tanda ni bajar el
    // listón. Aflojar es el último recurso y se decide recién al final.
    const { lista } = filtrarPorModo(revisados, { q, modo, excluir, anioDesde, anioHasta, aflojar: false });
    if (lista.length >= porPagina) break;
    if (cuantasHay() && cursor >= cuantasHay()) { agotado = true; break; }
  }

  let { lista, aflojado } = filtrarPorModo(revisados, { q, modo, excluir, anioDesde, anioHasta, aflojar: false });
  // Recién ahora, agotadas las tandas, se permite aflojar. Es el último recurso: devolver algo parecido avisando que se
  // aflojó, en vez de nada. Pero hay búsquedas donde bajar el listón hace
  // daño — buscar quién cita el art. 13 y recibir cualquier fallo que diga
  // "artículo" es peor que un cero honesto. Por eso se puede desactivar.
  if (!lista.length && aflojar) ({ lista, aflojado } = filtrarPorModo(revisados, { q, modo, excluir, anioDesde, anioHasta }));

  const resultados = lista.slice(0, porPagina);

  // El cursor: la fila siguiente a la última que se MUESTRA, no a la última
  // que se revisó. Esa diferencia es justamente lo que evitaba que Mendoza
  // perdiera 32 coincidencias por página — las que encontró de más quedan
  // para la página siguiente, que arranca justo después de la última que
  // sí se mostró.
  let siguienteDesde;
  if (resultados.length >= porPagina) {
    const ultima = resultados[resultados.length - 1];
    // indexOf por identidad: filtrarPorModo no copia los registros, filtra
    // el mismo array, así que el objeto mostrado es el mismo que se revisó.
    siguienteDesde = filaDe[revisados.indexOf(ultima)] + 1;
  } else {
    // No se llenó la página: o se agotó la fuente, o se acabaron las tandas
    // permitidas. En los dos casos lo revisado se consumió entero.
    siguienteDesde = agotado ? null : cursor;
  }

  return { resultados, revisados: cursor - arranque, siguienteDesde, aflojado };
}
