/**
 * Lo que cada persona guarda en su cuenta: fuentes marcadas, busquedas
 * recientes, pasajes guardados del Lector y sus propios anillos del
 * tesauro de sinonimia.
 *
 * Hasta ahora esto vivia solo en el localStorage del navegador, asi que la
 * cuenta no servia para nada: te registrabas y tus guardados seguian atados
 * a esa computadora y a ese navegador (los pasajes ni siquiera sobrevivian
 * a un refresh de la pagina). Aca pasan a estar del lado del servidor,
 * ligados al usuario: entras desde otra maquina y estan.
 *
 * Mismo patron que lib/usuarios.js: un JSON en disco, sin base de datos. Un
 * archivo por usuario en vez de uno solo con todo, para que dos personas
 * guardando al mismo tiempo no se pisen el archivo entre si.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { DIR_USUARIOS } from '../config.js';

const CARPETA = path.join(DIR_USUARIOS, 'datos');

/** Topes para que un cliente con un error no llene el disco. */
const MAX_FAVORITOS = 500;
const MAX_HISTORIAL = 50;
const MAX_PASAJES = 60; // mismo tope que ya usa el frontend en memoria
const MAX_ANILLOS = 300; // anillos propios del tesauro; 300 es mas del decuplo del catalogo que viene de fabrica
const MAX_TERMINOS = 12; // por lado (equivalentes / relacionados) dentro de un anillo
const LARGO_MAX_TERMINO = 120;
const LARGO_MAX_ID = 120;
const LARGO_MAX_TEXTO = 8000; // cita + pasaje citado; un fallo entero no entra, y no hace falta
const LARGO_MAX_CORTO = 300; // búsqueda, url

let listo = false;
async function asegurarCarpeta() {
  if (listo) return;
  await fs.mkdir(CARPETA, { recursive: true });
  listo = true;
}

/** El id del usuario viene de la sesion, pero igual no se pega crudo a una ruta. */
function archivoDe(usuarioId) {
  const limpio = String(usuarioId || '').replace(/[^a-zA-Z0-9-]/g, '');
  if (!limpio) throw new Error('usuarioId invalido');
  return path.join(CARPETA, `${limpio}.json`);
}

const VACIO = { fav: {}, hist: [], pasajes: [], actualizadoEn: null };

export async function leerDatos(usuarioId) {
  try {
    await asegurarCarpeta();
    const crudo = await fs.readFile(archivoDe(usuarioId), 'utf8');
    const dato = JSON.parse(crudo);
    return {
      fav: dato && typeof dato.fav === 'object' && dato.fav ? dato.fav : {},
      hist: Array.isArray(dato?.hist) ? dato.hist : [],
      pasajes: Array.isArray(dato?.pasajes) ? dato.pasajes : [],
      anillos: Array.isArray(dato?.anillos) ? dato.anillos : [],
      actualizadoEn: dato?.actualizadoEn || null,
    };
  } catch {
    return { fav: {}, hist: [], pasajes: [], anillos: [] }; // todavia no guardo nada
  }
}

/** Solo http/https: una URL de otro esquema no sirve para "ver el original". */
function urlValida(u) {
  try {
    const p = new URL(String(u || ''));
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.toString() : '';
  } catch {
    return '';
  }
}

/** Un pasaje guardado tal como lo arma el frontend (ver pas-guardar en index.html). */
function saneaPasaje(p) {
  const t = String(p?.t || '').trim().slice(0, LARGO_MAX_TEXTO);
  if (!t) return null;
  return {
    t,
    r: String(p?.r || '').slice(0, LARGO_MAX_CORTO),
    url: urlValida(p?.url).slice(0, LARGO_MAX_CORTO),
    q: String(p?.q || '').slice(0, LARGO_MAX_CORTO),
    modo: ['exacta', 'todas', 'alguna'].includes(p?.modo) ? p.modo : 'todas',
  };
}

/**
 * Un anillo del tesauro cargado por la propia usuaria.
 *
 * La regla que sostiene el tesauro se aplica tambien aca, y no solo del
 * lado de la pantalla: equivalentes y relacionados no pueden compartir un
 * termino. Si llega uno repetido en los dos lados, se queda en equivalentes
 * —que es lo que la persona marco como "lo mismo"— y se saca del otro. Sin
 * esto, un anillo guardado podria decir a la vez que dos figuras son
 * identicas y que no lo son.
 */
function saneaAnillo(a) {
  const termino = (x) => String(x || '').trim().slice(0, LARGO_MAX_TERMINO);
  const lista = (xs) => {
    const vistos = new Set();
    const out = [];
    for (const x of Array.isArray(xs) ? xs : []) {
      const t = termino(x);
      const clave = t.toLowerCase();
      if (!t || vistos.has(clave)) continue;
      vistos.add(clave);
      out.push(t);
      if (out.length >= MAX_TERMINOS) break;
    }
    return out;
  };

  const canonico = termino(a?.canonico);
  if (!canonico) return null;

  const equivalentes = lista(a?.equivalentes).filter((t) => t.toLowerCase() !== canonico.toLowerCase());
  if (!equivalentes.length) return null; // un anillo sin equivalentes no expande nada

  const enEq = new Set(equivalentes.map((t) => t.toLowerCase()));
  enEq.add(canonico.toLowerCase());
  const relacionados = lista(a?.relacionados).filter((t) => !enEq.has(t.toLowerCase()));

  const desde = Number.isInteger(a?.desde) && a.desde > 1800 && a.desde < 2200 ? a.desde : null;

  return {
    canonico,
    equivalentes,
    relacionados,
    rama: String(a?.rama || '').slice(0, 40) || null,
    desde,
    nota: String(a?.nota || '').trim().slice(0, 400) || null,
    creadoEn: String(a?.creadoEn || '').slice(0, 40) || new Date().toISOString().slice(0, 10),
  };
}

/**
 * Deja los datos en una forma sana antes de escribirlos: solo las marcas
 * encendidas, sin ids ni textos absurdamente largos, y con tope de cantidad.
 */
function sanear({ fav, hist, pasajes, anillos }) {
  const favLimpio = {};
  if (fav && typeof fav === 'object') {
    for (const clave of Object.keys(fav)) {
      if (!fav[clave]) continue; // una marca apagada no hace falta guardarla
      const id = String(clave).slice(0, LARGO_MAX_ID);
      favLimpio[id] = true;
      if (Object.keys(favLimpio).length >= MAX_FAVORITOS) break;
    }
  }

  const vistas = new Set();
  const histLimpio = [];
  for (const entrada of Array.isArray(hist) ? hist : []) {
    const q = String(entrada || '').trim().slice(0, 200);
    if (!q || vistas.has(q)) continue;
    vistas.add(q);
    histLimpio.push(q);
    if (histLimpio.length >= MAX_HISTORIAL) break;
  }

  const pasajesLimpio = [];
  for (const p of Array.isArray(pasajes) ? pasajes : []) {
    const limpio = saneaPasaje(p);
    if (limpio) pasajesLimpio.push(limpio);
    if (pasajesLimpio.length >= MAX_PASAJES) break;
  }

  // Un canonico repetido haria ambigua la expansion: gana el primero.
  const anillosLimpio = [];
  const canonicosVistos = new Set();
  for (const a of Array.isArray(anillos) ? anillos : []) {
    const limpio = saneaAnillo(a);
    if (!limpio) continue;
    const clave = limpio.canonico.toLowerCase();
    if (canonicosVistos.has(clave)) continue;
    canonicosVistos.add(clave);
    anillosLimpio.push(limpio);
    if (anillosLimpio.length >= MAX_ANILLOS) break;
  }

  return { fav: favLimpio, hist: histLimpio, pasajes: pasajesLimpio, anillos: anillosLimpio };
}

export async function guardarDatos(usuarioId, entrada) {
  await asegurarCarpeta();
  const dato = { ...sanear(entrada || {}), actualizadoEn: Date.now() };
  await fs.writeFile(archivoDe(usuarioId), JSON.stringify(dato), 'utf8');
  return dato;
}

/**
 * Une lo que ya habia en la cuenta con lo que trae el navegador.
 *
 * Se usa al entrar: alguien que venia usando la web sin cuenta tiene cosas
 * guardadas en ese navegador, y al registrarse no las tiene que perder. Se
 * suman las dos, con lo local primero por ser lo mas reciente.
 */
export async function fusionarDatos(usuarioId, local) {
  const servidor = await leerDatos(usuarioId);
  const fav = { ...servidor.fav };
  for (const clave of Object.keys(local?.fav || {})) {
    if (local.fav[clave]) fav[clave] = true;
  }
  const hist = [...(local?.hist || []), ...servidor.hist];

  // Los pasajes no se dedupean por texto exacto porque dos citas idénticas
  // guardadas con búsquedas distintas son, en la práctica, dos consultas
  // distintas que igual vale la pena conservar.
  const pasajes = [...(local?.pasajes || []), ...servidor.pasajes];

  return guardarDatos(usuarioId, { fav, hist, pasajes });
}
