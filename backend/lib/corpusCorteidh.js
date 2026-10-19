/**
 * Índice de texto propio de la Corte Interamericana.
 *
 * El buscador del sitio de la Corte IDH NO busca en el texto de las sentencias:
 * sólo en nombres, carátulas y palabras clave (medido: "Maldonado Vargas" da 4
 * documentos, "extrapatrimonial" y hasta "daño inmaterial" dan cero, aunque el
 * término está en esas sentencias — lo señaló una usuaria con dos casos
 * concretos). El otro buscador que indexaba el texto (BJDH) le responde 403 al
 * servidor. Así que el texto se indexa acá.
 *
 * Qué se indexa: las sentencias de casos contenciosos y las opiniones
 * consultivas (630 documentos en octubre de 2026). Las supervisiones,
 * medidas provisionales y resoluciones siguen saliendo por el buscador del
 * sitio, como antes.
 *
 * Cómo: en segundo plano y de a un documento (lib/descargador.js ya espacia los
 * pedidos al sitio), se baja cada PDF, se extrae el texto, se guarda comprimido
 * y se suman sus palabras a un índice invertido (palabra -> documentos). Se
 * retoma donde quedó si el servidor se reinicia, y una vez por día suma lo nuevo.
 * Para buscar se cruzan las listas del índice y sólo se abre el texto de los
 * candidatos, para verificar la frase y recortar el pasaje.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { DIR_DATOS } from '../config.js';
import { descargar } from './descargador.js';
import { extraerDesdeBuffer } from './documento.js';
import { escribirJsonAtomico, leerJson } from './almacen.js';
import { plegar, VACIAS } from './relevancia.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const DIR = path.join(DIR_DATOS, 'corteidh');
const DIR_TEXTOS = path.join(DIR, 'textos');
const ARCHIVO_MANIFIESTO = path.join(DIR, 'manifiesto.json');
const ARCHIVO_INDICE = path.join(DIR, 'indice.json');

const TIPOS_INDEXADOS = new Set(['Casos Contenciosos', 'Opiniones Consultivas']);

/** Estado en memoria: lista de documentos y, por palabra, sus posiciones en esa lista. */
let docs = null; // [{ id, tipo, titulo, fecha, pdf, ficha, chars }]
let fallidos = {}; // id -> motivo
let indice = null; // Map palabra -> number[]
let cargando = null;
let construyendo = false;
let estadoConstruccion = { total: 0, hechos: 0, ultimoError: '' };

const palabrasDe = (t) =>
  plegar(t)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 3 && p.length <= 30 && !VACIAS.has(p));

async function cargar() {
  if (docs) return;
  if (!cargando) {
    cargando = (async () => {
      const m = await leerJson(ARCHIVO_MANIFIESTO, { docs: [], fallidos: {} });
      const i = await leerJson(ARCHIVO_INDICE, {});
      docs = Array.isArray(m.docs) ? m.docs : [];
      fallidos = m.fallidos || {};
      indice = new Map(Object.entries(i));
    })();
  }
  await cargando;
}

async function guardar() {
  await fs.mkdir(DIR, { recursive: true });
  await escribirJsonAtomico(ARCHIVO_MANIFIESTO, { docs, fallidos, actualizado: new Date().toISOString() });
  await escribirJsonAtomico(ARCHIVO_INDICE, Object.fromEntries(indice));
}

export function estadoCorpus() {
  return {
    indexados: docs ? docs.length : 0,
    fallidos: Object.keys(fallidos).length,
    construyendo,
    ...estadoConstruccion,
  };
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Baja e indexa lo que falte. `listar` devuelve todos los documentos del sitio
 * (lo provee lib/indiceCorteidh.js, que sabe leer su buscador).
 */
export async function actualizarCorpus(listar, { log = () => {} } = {}) {
  if (construyendo) return;
  construyendo = true;
  try {
    await cargar();
    await fs.mkdir(DIR_TEXTOS, { recursive: true });
    const todos = await listar();
    const ya = new Set(docs.map((d) => d.id));
    const faltan = todos.filter((r) => TIPOS_INDEXADOS.has(r.expediente) && r.linkFallo && !ya.has(r.id) && !fallidos[r.id]);
    estadoConstruccion = { total: docs.length + faltan.length, hechos: docs.length, ultimoError: '' };
    if (faltan.length) log(`[corteidh] faltan indexar ${faltan.length} documentos`);
    let desdeGuardado = 0;
    for (const r of faltan) {
      try {
        const { buffer, contentType } = await descargar(r.linkFallo);
        const { texto } = await extraerDesdeBuffer(buffer, contentType, r.linkFallo);
        if (!texto || texto.length < 500) throw new Error('el PDF no trae texto');
        await fs.writeFile(path.join(DIR_TEXTOS, `${r.id}.txt.gz`), await gzip(texto));
        const n = docs.length;
        docs.push({ id: r.id, tipo: r.expediente, titulo: r.caratula, fecha: r.fecha, pdf: r.linkFallo, ficha: r.linkFicha, chars: texto.length });
        for (const p of new Set(palabrasDe(texto))) {
          const lista = indice.get(p);
          if (lista) lista.push(n);
          else indice.set(p, [n]);
        }
        estadoConstruccion.hechos = docs.length;
      } catch (e) {
        fallidos[r.id] = String(e?.message || e).slice(0, 160);
        estadoConstruccion.ultimoError = fallidos[r.id];
      }
      if (++desdeGuardado >= 20) {
        desdeGuardado = 0;
        await guardar();
        log(`[corteidh] ${docs.length} documentos indexados`);
      }
      await pausa(500);
    }
    if (faltan.length) {
      await guardar();
      log(`[corteidh] índice completo: ${docs.length} documentos (${Object.keys(fallidos).length} sin texto)`);
    }
  } finally {
    construyendo = false;
  }
}

/* ---------- búsqueda ---------- */

const CLASES = { a: '[aáàâä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôö]', u: '[uúùûü]', n: '[nñ]', c: '[cç]' };
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Una palabra como expresión regular que no distingue tildes ni mayúsculas. */
const patron = (palabra) => [...plegar(palabra)].map((ch) => CLASES[ch] || escapar(ch)).join('');

function recorte(texto, indiceCoincidencia) {
  const desde = Math.max(0, indiceCoincidencia - 220);
  const hasta = Math.min(texto.length, desde + 700);
  return (desde > 0 ? '… ' : '') + texto.slice(desde, hasta).replace(/\s+/g, ' ').trim() + (hasta < texto.length ? ' …' : '');
}

const clavefecha = (f) => String(f || '').split('/').reverse().join('');

/*
 * Los textos se leen del disco del servidor, que en Azure es de red y lento
 * (medido: abrir 400 textos para una frase común tardaba 16-25 s). Por eso:
 * se abren sólo los que hacen falta para la página pedida, y los ya leídos
 * quedan en memoria, comprimidos, con un tope.
 */
const CACHE_GZ = new Map(); // id -> Buffer comprimido (orden de inserción = antigüedad)
let bytesCache = 0;
const MAX_BYTES_CACHE = 48 * 1024 * 1024;
async function leerTexto(id) {
  let gz = CACHE_GZ.get(id);
  if (gz) {
    CACHE_GZ.delete(id);
    CACHE_GZ.set(id, gz); // pasa al final: recién usado
  } else {
    gz = await fs.readFile(path.join(DIR_TEXTOS, `${id}.txt.gz`));
    CACHE_GZ.set(id, gz);
    bytesCache += gz.length;
    for (const [k, v] of CACHE_GZ) {
      if (bytesCache <= MAX_BYTES_CACHE) break;
      CACHE_GZ.delete(k);
      bytesCache -= v.length;
    }
  }
  return (await gunzip(gz)).toString('utf8');
}

// Lo verificado de una frase exacta, para que la página siguiente siga donde quedó.
const VERIFICADAS = new Map(); // clave -> { hasta, estado: (string|null|undefined)[], siguiente }
const VIDA_VERIF_MS = 10 * 60_000;

/**
 * Busca en el texto de las sentencias indexadas. Devuelve null si todavía no
 * hay índice (primer arranque), o:
 *   { resultados, total, parcial, ids, indexados }
 * `resultados` es sólo la ventana [desde, desde+cuantos), con el pasaje de la
 * coincidencia en `sumario`. `ids` son todos los documentos que coinciden (o
 * los verificados hasta ahora, con frase exacta), para no repetirlos después.
 * `filtro(doc)` deja afuera documentos por fecha o carátula antes de abrirlos.
 */
export async function buscarEnCorpus(q, modo = 'todas', { desde = 0, cuantos = 20, filtro = null, presupuestoMs = 8000 } = {}) {
  await cargar();
  if (!docs.length) return null;
  const palabras = [...new Set(palabrasDe(q))];
  const vacio = { resultados: [], total: 0, parcial: false, ids: new Set(), indexados: docs.length };
  if (!palabras.length) return vacio;

  const listas = palabras.map((p) => indice.get(p) || []);
  let candidatos;
  if (modo === 'alguna') {
    candidatos = [...new Set(listas.flat())];
  } else {
    if (listas.some((l) => !l.length)) return vacio;
    const [primera, ...resto] = [...listas].sort((a, b) => a.length - b.length);
    const conjuntos = resto.map((l) => new Set(l));
    candidatos = primera.filter((n) => conjuntos.every((c) => c.has(n)));
  }
  if (filtro) candidatos = candidatos.filter((n) => filtro(docs[n]));
  // Primero los documentos cuyo TÍTULO trae lo buscado (buscar "Maldonado Vargas"
  // tiene que dar el caso, no las sentencias que lo citan); después, por fecha.
  const enTitulo = (n) => palabras.every((p) => plegar(docs[n].titulo).includes(p));
  candidatos.sort((a, b) => (enTitulo(b) - enTitulo(a)) || clavefecha(docs[b].fecha).localeCompare(clavefecha(docs[a].fecha)));

  const crudas = String(q).trim().split(/\s+/).filter(Boolean);
  const reFrase = new RegExp(crudas.map(patron).join('[\\s,;:]+'), 'iu');
  const larga = palabras.reduce((a, b) => (b.length > a.length ? b : a));
  const reLarga = new RegExp(patron(larga), 'iu');
  const aRegistro = (n, pasaje) => {
    const d = docs[n];
    return { id: d.id, expediente: d.tipo, caratula: d.titulo, tribunal: 'Corte IDH', fecha: d.fecha, sumario: pasaje, voces: [], linkFicha: d.ficha || null, linkFallo: d.pdf };
  };

  if (modo !== 'exacta') {
    // Todas las palabras (o alguna) ya lo garantiza el índice: el total es exacto
    // y sólo se abren los textos de esta página, para recortar el pasaje.
    const ventana = candidatos.slice(desde, desde + cuantos);
    const resultados = [];
    for (const n of ventana) {
      let texto = '';
      try { texto = await leerTexto(docs[n].id); } catch { /* sin texto: va sin pasaje */ }
      const m = reFrase.exec(texto) || reLarga.exec(texto);
      resultados.push(aRegistro(n, m ? recorte(texto, m.index) : ''));
    }
    return { resultados, total: candidatos.length, parcial: false, ids: new Set(candidatos.map((n) => docs[n].id)), indexados: docs.length };
  }

  // Frase exacta: hay que abrir cada candidato para ver si la trae. Se verifica
  // en orden hasta llenar la página (o agotar el tiempo) y se recuerda lo hecho.
  const clave = `${plegar(q)}|${filtro ? 'f' : ''}|${candidatos.length}`;
  let v = VERIFICADAS.get(clave);
  if (!v || v.hasta < Date.now()) {
    v = { hasta: Date.now() + VIDA_VERIF_MS, estado: new Array(candidatos.length), siguiente: 0 };
    if (VERIFICADAS.size > 50) VERIFICADAS.clear();
    VERIFICADAS.set(clave, v);
  }
  const necesarios = desde + cuantos;
  const encontrados = () => v.estado.filter((x) => typeof x === 'string').length;
  const t0 = Date.now();
  while (v.siguiente < candidatos.length && encontrados() < necesarios && Date.now() - t0 < presupuestoMs) {
    const n = candidatos[v.siguiente];
    let texto = '';
    try { texto = await leerTexto(docs[n].id); } catch { /* ilegible: no cuenta */ }
    const m = reFrase.exec(texto);
    v.estado[v.siguiente] = m ? recorte(texto, m.index) : null;
    v.siguiente++;
  }
  const coinciden = [];
  v.estado.forEach((x, i) => { if (typeof x === 'string') coinciden.push([candidatos[i], x]); });
  const parcial = v.siguiente < candidatos.length;
  return {
    resultados: coinciden.slice(desde, desde + cuantos).map(([n, pasaje]) => aRegistro(n, pasaje)),
    total: coinciden.length,
    parcial,
    ids: new Set(coinciden.map(([n]) => docs[n].id)),
    indexados: docs.length,
  };
}
