/**
 * Construye el inventario terminológico de IVS CODEX a partir de fuentes
 * oficiales, sin inventar términos.
 *
 * Fuentes:
 *  1. Tesauro SAIJ de Derecho Argentino (SAIJ, Ministerio de Justicia y
 *     Derechos Humanos), SKOS/RDF, licencia CC-BY 4.0:
 *     https://datos.jus.gob.ar/dataset/tesauro-saij-de-derecho-argentino
 *  2. Tesauro de jurisprudencia del Poder Judicial de Mendoza (voces con que
 *     la SCJM y las Cámaras indexan sus sumarios), consultado por prefijo en
 *     https://wwwjuri.jus.mendoza.gov.ar/bib/jurisprudencia/funciones/tesauro.php
 *     y guardado en backend/datos/vocabulario/voces-scjm.txt.
 *  3. Los anillos curados de frontend/index.html (var TESAURO), medidos en
 *     vivo antes de entrar (ver el comentario de esa sección).
 *  4. Equivalencias históricas por reforma legislativa, cada una con su
 *     norma (ops/vocabulario/relaciones-historicas.json).
 *
 * Regla central: una relación del tesauro oficial NO es por sí misma una
 * sinonimia. SAIJ usa los términos no preferidos («usado por») para indexar,
 * y a veces cuelga del mismo descriptor un término más específico o un
 * concepto vecino (p. ej. «asesinato» ← «homicidio por precio o promesa
 * remuneratoria»). Por eso cada relación lleva tipo, estado y política:
 *   - politica "expandir": se suma sola a la búsqueda. Solo identidad léxica
 *     (ortografía, puntuación, plural) o equivalencias verificadas.
 *   - politica "sugerir": se ofrece como línea de investigación rotulada.
 *   - politica "no_expandir": se muestra con advertencia (controvertida).
 *
 * Uso:
 *   node ops/vocabulario/construir-inventario.mjs [ruta-al-tesauro-saij.xml]
 * Sin ruta, descarga el XML oficial. Escribe
 * backend/datos/vocabulario/inventario.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const URL_SAIJ = 'https://datos.jus.gob.ar/dataset/e41e8224-f868-4688-9fae-94d320f8ee5e/resource/0a823ec3-4609-41b6-8af8-93afd23aaf9c/download/tesauro-saij.xml';
const SALIDA = path.join(RAIZ, 'backend/datos/vocabulario/inventario.json');

// ---------- normalización ----------
export function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[()[\]{}"'«»“”.,;:¿?¡!]/g, ' ').replace(/[-–—/]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'e', 'o', 'u', 'a', 'al', 'por', 'para', 'con', 'sin', 'su', 'sus', 'un', 'una']);
function raiz(p) { // plural y género gramatical simples, nada más
  if (p.length > 4 && p.endsWith('es') && !p.endsWith('ces')) return p.slice(0, -2);
  if (p.length > 4 && p.endsWith('ces')) return p.slice(0, -3) + 'z';
  if (p.length > 3 && p.endsWith('s')) p = p.slice(0, -1);
  if (p.length > 3 && /[oa]$/.test(p)) p = p.slice(0, -1);
  return p;
}
const firma = (s) => normalizar(s).split(' ').filter((w) => w && !VACIAS.has(w)).map(raiz).sort().join(' ');
const palabras = (s) => new Set(normalizar(s).split(' ').filter((w) => w && !VACIAS.has(w)));

/** Clasifica un término no preferido de SAIJ respecto de su descriptor. */
export function clasificarAlt(pref, alt) {
  if (normalizar(pref) === normalizar(alt)) return { tipo: 'equivalencia_ortografica', estado: 'verificada', politica: 'expandir', evidencia: 'Identidad léxica tras normalizar tildes, mayúsculas y puntuación.' };
  if (firma(pref) === firma(alt)) return { tipo: 'variacion_morfologica', estado: 'verificada', politica: 'expandir', evidencia: 'Mismas palabras con variación de número o género gramatical.' };
  const compacto = alt.replace(/[.\s]/g, '');
  const iniciales = normalizar(pref).split(' ').filter((w) => !VACIAS.has(w)).map((w) => w[0]).join('');
  if (/^[A-ZÁÉÍÓÚÑ.\s]{2,10}$/.test(alt) && compacto.length <= 8) {
    return { tipo: 'sigla', estado: 'propuesta', politica: 'sugerir', evidencia: iniciales === compacto.toLowerCase() ? 'Sigla formada por las iniciales del descriptor.' : 'Sigla registrada por SAIJ; puede ser ambigua fuera de contexto.' };
  }
  const a = palabras(pref), b = palabras(alt);
  const contiene = [...a].every((w) => b.has(w)) || [...b].every((w) => a.has(w));
  if (contiene) return { tipo: 'denominacion_extendida', estado: 'propuesta', politica: 'sugerir', evidencia: 'Una denominación contiene a la otra: puede ser la misma figura o una especie de ella. Requiere revisión.' };
  return { tipo: 'descriptor_no_preferido', estado: 'propuesta', politica: 'sugerir', evidencia: 'SAIJ indexa este término bajo el descriptor; el alcance semántico no está revisado.' };
}

// ---------- ramas de IVS CODEX según la jerarquía oficial ----------
// Se recorre de cada concepto hacia arriba; manda el ancestro más cercano
// que tenga regla. Los rótulos son los prefLabel de SAIJ.
const REGLAS_RAMA = new Map(Object.entries({
  'ejecucion de sentencia penal': 'ejec', 'ejecucion de la pena': 'ejec',
  'proceso penal': 'proc_pen',
  'relaciones de familia': 'fam', 'derechos de las ninas ninos y adolescentes': 'nna',
  'sucesiones': 'suc', 'derechos reales': 'rea', 'bienes': 'rea', 'inscripcion registral': 'rea',
  'responsabilidad civil': 'dan', 'contratos de consumo': 'cons', 'lealtad comercial': 'cons',
  'derechos personales': 'civ', 'prescripcion': 'civ', 'hechos y actos juridicos': 'civ',
  'persona humana': 'civ', 'personas juridicas': 'civ', 'ejercicio de los derechos': 'civ',
  'propiedad intelectual': 'pi', 'propiedad industrial': 'pi', 'derecho informatico': 'pi',
  'concursos': 'cyq', 'seguros': 'seg',
  'accidentes de trabajo': 'art', 'derecho colectivo del trabajo': 'sind',
  'derecho laboral': 'lab', 'seguridad social': 'prev',
  'derecho penal': 'pen', 'derecho contravencional y de faltas': 'pen',
  'derecho procesal': 'proc_civ', 'derecho administrativo': 'adm',
  'derecho tributario y aduanero': 'trib',
  'derechos politicos': 'elec', 'derecho constitucional': 'const',
  'proteccion de la mujer': 'gen', 'derechos de la mujer': 'gen',
  'derecho internacional privado': 'dipr', 'derechos humanos': 'ddhh', 'derecho internacional': 'ddhh',
  'recursos hidricos': 'agua', 'recursos minerales': 'agua', 'recursos energeticos': 'agua',
  'derecho ambiental': 'amb', 'recursos naturales': 'amb',
  'derecho comercial': 'com', 'derecho bancario': 'com', 'economia y finanzas': 'com',
  'derecho civil': 'civ',
}));

// ---------- lectura del SKOS (estructura regular, sin dependencias) ----------
function leerSkos(xml) {
  const idDe = (u) => Number((/skosTema=(\d+)/.exec(u || '') || [])[1]) || null;
  const texto = (bloque, et) => [...bloque.matchAll(new RegExp(`<skos:${et}[^>]*>([\\s\\S]*?)</skos:${et}>`, 'g'))]
    .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()).filter(Boolean);
  const refs = (bloque, et) => [...bloque.matchAll(new RegExp(`<skos:${et} rdf:resource="([^"]+)"`, 'g'))].map((m) => idDe(m[1])).filter(Boolean);
  const C = new Map();
  for (const m of xml.matchAll(/<skos:Concept rdf:about="([^"]+)">([\s\S]*?)<\/skos:Concept>/g)) {
    const id = idDe(m[1]);
    C.set(id, { id, pref: texto(m[2], 'prefLabel')[0] || '', alt: texto(m[2], 'altLabel'), oculto: texto(m[2], 'hiddenLabel'),
      bt: refs(m[2], 'broader'), nt: refs(m[2], 'narrower'), rt: refs(m[2], 'related'), nota: texto(m[2], 'scopeNote') });
  }
  const modificado = (/<dct:modified>([^<]+)</.exec(xml) || [])[1] || null;
  return { C, modificado };
}

function ancestros(C, c) {
  const out = []; const vistos = new Set([c.id]); let x = c;
  while (x.bt.length) { const p = C.get(x.bt[0]); if (!p || vistos.has(p.id)) break; vistos.add(p.id); out.push(p); x = p; }
  return out;
}

function anillosCurados() {
  const html = fs.readFileSync(path.join(RAIZ, 'frontend/index.html'), 'utf8');
  const ini = html.indexOf('var TESAURO=[');
  const fin = html.indexOf('\n];', ini);
  const ctx = {};
  vm.runInNewContext(html.slice(ini, fin + 3).replace('var TESAURO', 'TESAURO'), ctx);
  return ctx.TESAURO;
}

async function main() {
  const ruta = process.argv[2];
  const xml = ruta ? fs.readFileSync(ruta, 'utf8') : await (await fetch(URL_SAIJ)).text();
  const sha256 = crypto.createHash('sha256').update(xml).digest('hex');
  const { C, modificado } = leerSkos(xml);

  const scjm = fs.readFileSync(path.join(RAIZ, 'backend/datos/vocabulario/voces-scjm.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const scjmNorm = new Map(scjm.map((v) => [normalizar(v), v]));
  const usadasScjm = new Set();

  const historicas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ops/vocabulario/relaciones-historicas.json'), 'utf8'));
  const curados = anillosCurados();

  const conceptos = [];
  const contadores = { relaciones: 0, porTipo: {}, porEstado: {}, porPolitica: {}, porRama: {}, conVozScjm: 0 };
  const contar = (r) => {
    contadores.relaciones++;
    for (const [k, v] of [['porTipo', r.tipo], ['porEstado', r.estado], ['porPolitica', r.politica]]) contadores[k][v] = (contadores[k][v] || 0) + 1;
  };

  for (const c of C.values()) {
    if (!c.pref) continue;
    const anc = ancestros(C, c);
    const cadena = [c, ...anc];
    let rama = null;
    for (const x of cadena) { const r = REGLAS_RAMA.get(normalizar(x.pref)); if (r) { rama = r; break; } }
    const top = anc.length ? anc[anc.length - 1] : c;
    const subrama = anc.length >= 2 ? anc[anc.length - 2].pref : (anc.length === 1 ? c.pref : null);

    const relaciones = [];
    const agregar = (r) => { relaciones.push(r); contar(r); };
    for (const alt of c.alt) agregar({ termino: alt, ...clasificarAlt(c.pref, alt), fuente: 'saij' });
    for (const h of c.oculto) agregar({ termino: h, tipo: 'variante_oculta', estado: 'propuesta', politica: 'sugerir', fuente: 'saij', evidencia: 'hiddenLabel de SAIJ (variante de indexación).' });
    const ref = (ids, tipo, evidencia) => ids.map((i) => C.get(i)).filter(Boolean).forEach((x) =>
      agregar({ termino: x.pref, saij: x.id, tipo, estado: 'verificada_en_fuente', politica: 'sugerir', fuente: 'saij', evidencia }));
    ref(c.bt, 'concepto_mas_amplio', 'Relación jerárquica (broader) del tesauro oficial.');
    ref(c.nt, 'concepto_mas_especifico', 'Relación jerárquica (narrower) del tesauro oficial.');
    ref(c.rt, 'concepto_relacionado', 'Relación asociativa (related) del tesauro oficial. No es sinonimia.');

    // ¿El mismo descriptor (o una de sus variantes) es voz del tesauro de la SCJM?
    const vozScjm = [c.pref, ...c.alt].map((t) => scjmNorm.get(normalizar(t))).find(Boolean) || null;
    if (vozScjm) { usadasScjm.add(normalizar(vozScjm)); contadores.conVozScjm++; }

    contadores.porRama[rama || 'sin_rama'] = (contadores.porRama[rama || 'sin_rama'] || 0) + 1;
    conceptos.push({ id: `saij:${c.id}`, saij: c.id, canonico: c.pref, rama, especialidad: top.pref, subrama,
      nivel: anc.length, ...(vozScjm ? { vozScjm } : {}), ...(c.nota.length ? { nota: c.nota.join(' ') } : {}), relaciones });
  }

  // Anillos curados: se enlazan al concepto SAIJ si coincide algún término.
  const porTermino = new Map();
  for (const k of conceptos) for (const t of [k.canonico, ...k.relaciones.filter((r) => r.tipo !== 'concepto_mas_amplio' && r.tipo !== 'concepto_mas_especifico' && r.tipo !== 'concepto_relacionado').map((r) => r.termino)]) {
    if (!porTermino.has(normalizar(t))) porTermino.set(normalizar(t), k);
  }
  const anillos = curados.map((a) => {
    const ts = [a.canonico, ...(a.equivalentes || [])];
    const saij = ts.map((t) => porTermino.get(normalizar(t))).find(Boolean);
    const relaciones = [
      ...(a.equivalentes || []).map((t) => {
        const confirmada = saij && saij.relaciones.some((r) => normalizar(r.termino) === normalizar(t) && /equivalencia|variacion|descriptor_no_preferido|denominacion/.test(r.tipo));
        return { termino: t, tipo: 'equivalencia_conceptual', estado: 'verificada', politica: 'expandir', fuente: 'ivs_codex',
          evidencia: 'Anillo curado y medido en vivo (frontend/index.html, var TESAURO).' + (confirmada ? ' Confirmado también por el Tesauro SAIJ.' : '') };
      }),
      ...(a.relacionados || []).map((t) => ({ termino: t, tipo: 'concepto_relacionado', estado: 'verificada', politica: 'sugerir', fuente: 'ivs_codex', evidencia: 'Anillo curado: vecino que no es lo mismo.' })),
    ];
    relaciones.forEach(contar);
    return { id: `ivs:${a.id}`, canonico: a.canonico, rama: a.rama, ...(saij ? { saij: saij.saij } : {}), ...(a.desde ? { desde: a.desde } : {}),
      ...(a.normas ? { normas: a.normas } : {}), ...(a.nota ? { nota: a.nota } : {}), relaciones };
  });

  // Relaciones históricas por reforma, con su norma.
  for (const h of historicas.relaciones) contar(h);

  // Voces de la SCJM que no coinciden con ningún descriptor SAIJ: quedan como
  // descriptores jurisdiccionales (Mendoza), útiles para el filtro de tesauro
  // del buscador oficial, sin relaciones inventadas.
  const vocesSoloScjm = scjm.filter((v) => !usadasScjm.has(normalizar(v)));

  const inventario = {
    version: new Date().toISOString().slice(0, 10),
    fuentes: [
      { id: 'saij', nombre: 'Tesauro SAIJ de Derecho Argentino', organismo: 'Sistema Argentino de Información Jurídica, Ministerio de Justicia y Derechos Humanos de la Nación', licencia: 'CC-BY-4.0', url: 'https://datos.jus.gob.ar/dataset/tesauro-saij-de-derecho-argentino', descarga: URL_SAIJ, modificado: modificado, sha256 },
      { id: 'scjm', nombre: 'Tesauro de jurisprudencia del Poder Judicial de Mendoza', organismo: 'Suprema Corte de Justicia de Mendoza (biblioteca de jurisprudencia)', url: 'https://wwwjuri.jus.mendoza.gov.ar/bib/jurisprudencia/consultar.php', voces: scjm.length, nota: 'Consultado por prefijo (una petición por letra). Mismo tesauro para SC, CC y CT.' },
      { id: 'ivs_codex', nombre: 'Anillos curados de IVS CODEX', url: 'frontend/index.html (var TESAURO)' },
      { id: 'normativa', nombre: 'Relaciones históricas por reforma legislativa', url: 'ops/vocabulario/relaciones-historicas.json' },
    ],
    esquema: {
      tipos: ['equivalencia_conceptual', 'equivalencia_historica', 'equivalencia_ortografica', 'variacion_morfologica', 'sigla', 'denominacion_extendida', 'descriptor_no_preferido', 'variante_oculta', 'concepto_mas_amplio', 'concepto_mas_especifico', 'concepto_relacionado', 'concepto_contrapuesto', 'figura_que_se_confunde'],
      estados: { verificada: 'Comprobada (identidad léxica, medición en vivo o norma expresa).', verificada_en_fuente: 'La relación existe en el tesauro oficial; no implica sinonimia.', propuesta: 'Pendiente de revisión jurídica.', controvertida: 'Hay razones para dudar; no expandir.', rechazada: 'Descartada.' },
      politicas: { expandir: 'Se suma automáticamente a la búsqueda.', sugerir: 'Se ofrece como línea de investigación rotulada.', no_expandir: 'Se muestra con advertencia.' },
    },
    estadisticas: { conceptosSaij: conceptos.length, anillosCurados: anillos.length, relacionesHistoricas: historicas.relaciones.length, vocesScjm: scjm.length, vocesSoloScjm: vocesSoloScjm.length, ...contadores },
    conceptos, anillos, historicas: historicas.relaciones, vocesSoloScjm,
  };
  // Compactar: los valores que dependen solo del tipo viven en esquema.porDefecto.
  const porDefecto = {
    concepto_mas_amplio: { estado: 'verificada_en_fuente', politica: 'sugerir', fuente: 'saij', evidencia: 'Relación jerárquica (broader) del tesauro oficial.' },
    concepto_mas_especifico: { estado: 'verificada_en_fuente', politica: 'sugerir', fuente: 'saij', evidencia: 'Relación jerárquica (narrower) del tesauro oficial.' },
    concepto_relacionado: { estado: 'verificada_en_fuente', politica: 'sugerir', fuente: 'saij', evidencia: 'Relación asociativa (related) del tesauro oficial. No es sinonimia.' },
    descriptor_no_preferido: { estado: 'propuesta', politica: 'sugerir', fuente: 'saij', evidencia: 'SAIJ indexa este término bajo el descriptor; el alcance semántico no está revisado.' },
    denominacion_extendida: { estado: 'propuesta', politica: 'sugerir', fuente: 'saij', evidencia: 'Una denominación contiene a la otra: puede ser la misma figura o una especie de ella. Requiere revisión.' },
    variacion_morfologica: { estado: 'verificada', politica: 'expandir', fuente: 'saij', evidencia: 'Mismas palabras con variación de número o género gramatical.' },
    equivalencia_ortografica: { estado: 'verificada', politica: 'expandir', fuente: 'saij', evidencia: 'Identidad léxica tras normalizar tildes, mayúsculas y puntuación.' },
  };
  inventario.esquema.porDefecto = porDefecto;
  for (const k of conceptos) for (const r of k.relaciones) {
    const d = porDefecto[r.tipo]; if (!d) continue;
    for (const [c, v] of Object.entries(d)) if (r[c] === v) delete r[c];
  }
  fs.writeFileSync(SALIDA, JSON.stringify(inventario));
  console.log(JSON.stringify(inventario.estadisticas, null, 1));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
