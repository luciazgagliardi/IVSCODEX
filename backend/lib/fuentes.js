/**
 * Catálogo de las fuentes que este servidor sabe consultar en vivo.
 *
 * Vivía adentro de routes/indice.js, que era el único que lo necesitaba.
 * Se mudó acá cuando apareció el segundo consumidor —el verificador de citas
 * (lib/verificarCita.js)— porque importar un router desde una librería para
 * sacarle una constante es al revés de como tiene que ir la dependencia: las
 * rutas usan las librerías, no al contrario.
 *
 * Cada entrada tiene la misma forma de entrada/salida (ver los tres clientes
 * en lib/indice*.js), que es lo que permite montarlas en bucle en las rutas y
 * recorrerlas en bucle al verificar una cita, sin un caso especial por fuente.
 *
 * Ojo con lo que NO está: esto son los buscadores que se pueden consultar
 * programáticamente. El catálogo grande de organismos que muestra el
 * frontend (la solapa "Fuentes", unas cien bases) es otra cosa: son enlaces
 * para abrir a mano, sin API ni formulario reproducible. Por eso el
 * verificador dice siempre contra qué buscó: el alcance real es esta lista,
 * no aquella.
 *
 * De las seis, dos no son tribunales: Dialnet (lib/indiceDialnet.js) es
 * doctrina, no jurisprudencia, y Mendoza Legal (lib/indiceMendozaLegal.js)
 * es una revista que publica fallos elegidos a mano, con el resumen escrito
 * por una persona. Por eso el verificador de citas (lib/verificarCita.js) no
 * elige a ninguna de las dos — su lista de fuentes posibles está fijada a
 * mano ahí adentro, no recorre este array entero — pero el Buscador general
 * sí las ofrece como una fuente más. Ninguna de las dos sirve para confirmar
 * que un expediente existe: una no indexa sentencias y la otra indexa una
 * selección, así que no encontrar algo ahí no dice absolutamente nada.
 */

import { buscarMza } from './indiceMza.js';
import { buscarCaba } from './indiceCaba.js';
import { buscarSaij } from './indiceSaij.js';
import { buscarDialnet } from './indiceDialnet.js';
import { buscarMendozaLegal } from './indiceMendozaLegal.js';

/** Una entrada por fuente indexada. slug = nombre de archivo en backend/indice/. */
export const FUENTES = [
  {
    slug: 'mendoza',
    nombre: 'Poder Judicial de Mendoza',
    // Los códigos de tribunal que entiende buscarMza: SC (Suprema Corte),
    // CC (Cámaras Civiles) y CT (Cámaras del Trabajo). Ver lib/indiceMza.js.
    tribunalPorDefecto: 'SC',
    buscar: (args) => buscarMza(args),
  },
  {
    slug: 'caba',
    nombre: 'TSJ de la Ciudad Autónoma de Buenos Aires',
    tribunalPorDefecto: null,
    buscar: (args) => buscarCaba(args),
  },
  {
    slug: 'saij',
    nombre: 'SAIJ · Ministerio de Justicia de la Nación',
    // Para verificar una cita hay que mirar los FALLOS, no los sumarios: el
    // sumario es doctrina suelta (título armado con descriptores del
    // tesauro, sin carátula ni expediente), así que no sirve para confirmar
    // que un expediente concreto existe. Ver lib/indiceSaij.js.
    tribunalPorDefecto: 'fallos',
    buscar: (args) => buscarSaij(args),
  },
  // La Corte Suprema sale de SAIJ filtrando por su faceta de tribunal: el
  // sitio propio de la CSJN protege todos sus buscadores con reCAPTCHA.
  // Ver la nota en lib/indiceSaij.js.
  {
    slug: 'csjn',
    nombre: 'Corte Suprema de Justicia de la Nación (vía SAIJ)',
    tribunalPorDefecto: null,
    buscar: (args) => buscarSaij({ ...args, soloCsjn: true }),
  },
  {
    slug: 'dialnet',
    nombre: 'Dialnet · doctrina jurídica en español',
    tribunalPorDefecto: null,
    buscar: (args) => buscarDialnet(args),
  },
  // Jurisprudencia comentada, no una base de sentencias: son los fallos que
  // la revista del Colegio de Abogados de Mendoza eligió publicar, con
  // resumen propio. Ver lib/indiceMendozaLegal.js.
  {
    slug: 'mendozalegal',
    nombre: 'Mendoza Legal · jurisprudencia seleccionada',
    tribunalPorDefecto: null,
    buscar: (args) => buscarMendozaLegal(args),
  },
];

/** La ficha de una fuente por su slug, o null si ese slug no existe. */
export function fuentePorSlug(slug) {
  return FUENTES.find((f) => f.slug === slug) || null;
}

/** El nombre legible de una fuente; si no la conoce, devuelve el slug pelado. */
export function nombreDeFuente(slug) {
  return fuentePorSlug(slug)?.nombre || String(slug || '');
}
