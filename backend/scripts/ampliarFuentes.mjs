/**
 * Amplía los respaldos de todas las fuentes con cliente paginado (excepto
 * SAIJ/CSJN, que tienen cosecha propia, y Corte IDH, cuyo catálogo es completo).
 * Una ejecución es ACOTADA, reanudable y nunca marca como agotado un corte.
 *
 * DIR_COSECHA=acervo-crudo/respaldo MAX_PAGINAS=120 node scripts/ampliarFuentes.mjs santafe
 * La rama acervo conserva _fuentes/<slug>.json.gz y _avance/<slug>.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { FUENTES } from '../lib/fuentes.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(RAIZ, process.env.DIR_COSECHA || 'acervo-crudo/respaldo');
export const PLAN = {
  mendoza: { porPagina: 20, variantes: [{ tribunal: 'SC' }, { tribunal: 'CC' }, { tribunal: 'CT' }],
    consultas: ['de', 'daño moral', 'consecuencias no patrimoniales', 'responsabilidad civil', 'despido', 'indemnización', 'accidente de trabajo', 'familia', 'sucesión', 'amparo', 'contrato', 'prescripción', 'alimentos', 'intereses', 'recurso'] },
  caba: { porPagina: 20, consultas: ['sentencia', 'daños', 'recurso', 'responsabilidad', 'contrato', 'despido', 'consumidor', 'familia', 'alimentos', 'amparo', 'administrativo', 'penal'] },
  scba: { porPagina: 20, consultas: ['sentencia', 'recurso', 'daño moral', 'responsabilidad civil', 'despido', 'accidente de trabajo', 'alimentos', 'contrato', 'consumidor', 'familia', 'sucesiones', 'intereses', 'amparo'] },
  juristeca: { porPagina: 50, consultas: ['daños', 'sentencia', 'contrato', 'laboral', 'penal', 'familia', 'alimentos', 'consumidor', 'amparo', 'sociedades', 'administrativo'] },
  santafe: { porPagina: 30, consultas: ['recurso', 'sentencia', 'daños', 'contrato', 'trabajo', 'penal', 'familia', 'alimentos', 'responsabilidad', 'consumidor', 'amparo', 'sucesión'] },
  rionegro: { porPagina: 10, variantes: [{ tribunal: 'STJ' }, { tribunal: 'CJ' }],
    consultas: ['sentencia', 'recurso', 'daños', 'despido', 'responsabilidad civil', 'alimentos', 'familia', 'contrato', 'amparo', 'penal', 'accidente'] },
  dialnet: { porPagina: 20, consultas: ['derecho', 'daño moral', 'responsabilidad civil', 'contratos', 'derecho penal', 'derecho laboral', 'familia', 'consumidor', 'derechos humanos', 'derecho constitucional', 'derecho administrativo', 'procesal', 'sucesiones'] },
  mendozalegal: { porPagina: 20, consultas: ['de', 'daños', 'recurso', 'responsabilidad', 'despido', 'contrato', 'familia', 'consumidor', 'amparo', 'penal'] },
};
const limite = (nombre, def, max) => Math.max(1, Math.min(max, Number(process.env[nombre]) || def));
const MAX_PAGINAS = limite('MAX_PAGINAS', 120, 1500);
const MAX_TERMINOS = limite('MAX_TERMINOS', 36, 300);
const PAUSA_MS = Math.max(1100, Math.min(15000, Number(process.env.PAUSA_MS) || 1800));
const PAGINAS_POR_TAREA = limite('PAGINAS_POR_TAREA', 3, 30);
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const leerJson = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; } };
const claveDe = (q, variante) => JSON.stringify([q, variante]);
const limpiar = (r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !k.startsWith('_') && v != null && v !== ''));
const mejor = (anterior, nuevo) => {
  if (!anterior) return nuevo;
  const juntos = { ...anterior };
  for (const [k, v] of Object.entries(nuevo))
    if (v != null && v !== '' && (!juntos[k] || (typeof v === 'string' && v.length > String(juntos[k]).length)))
      juntos[k] = v;
  return juntos;
};
export function siguienteCursor(actual, r) {
  const s = r?.siguienteDesde;
  if (s == null) return { agotada: true };
  if ((typeof s !== 'number' && typeof s !== 'string') || !String(s).trim() || String(s) === String(actual))
    throw new Error('Cursor inválido o repetido');
  if (typeof s === 'number' && (!Number.isSafeInteger(s) || s < 0 || (typeof actual === 'number' && s <= actual)))
    throw new Error('Cursor numérico no progresivo');
  return { agotada: false, desde: s };
}
const base = process.argv[2];
if (!PLAN[base]) {
  console.error('Fuente: ' + Object.keys(PLAN).join(', '));
  process.exitCode = 2;
} else {
  const cfg = PLAN[base];
  const buscar = FUENTES.find((x) => x.slug === base)?.buscar;
  if (!buscar) throw new Error('Fuente sin cliente: ' + base);
  await fs.mkdir(DIR, { recursive: true });
  const archivo = path.join(DIR, base + '.json.gz');
  const avance = path.join(DIR, 'avance-' + base + '.json');
  const informe = path.join(DIR, 'informe-' + base + '.json');
  let previo;
  try { previo = JSON.parse(zlib.gunzipSync(await fs.readFile(archivo)).toString()); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    try { previo = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(RAIZ, 'respaldo', base + '.json.gz'))).toString()); }
    catch (f) { if (f.code !== 'ENOENT') throw f; previo = { registros: [] }; }
  }
  if (!Array.isArray(previo.registros)) throw new Error('Respaldo anterior inválido');
  const registros = new Map(previo.registros.filter((r) => r?.id).map((r) => [r.id, r]));
  const antes = registros.size;
  const progreso = await leerJson(avance, { tareas: {}, indiceTerminos: 0 });
  if (!progreso.tareas || typeof progreso.tareas !== 'object') throw new Error('Avance inválido');
  const extras = await leerJson(path.join(RAIZ, 'datos', 'terminos-cosecha.json'), []);
  const palabras = Array.isArray(extras) ? [...new Set(extras.filter((x) => typeof x === 'string').map((x) => x.trim()).filter((x) => x.length > 2 && x.length <= 90))] : [];
  const indiceInicial = progreso.indiceTerminos || 0;
  const ventana = [];
  for (let k = 0; k < Math.min(MAX_TERMINOS, palabras.length); k++)
    ventana.push(palabras[(indiceInicial + k) % palabras.length]);
  const variantes = cfg.variantes || [{}];
  const semillas = cfg.consultas.flatMap((q) => variantes.map((v) => ({ q, variante: v })));
  const adicionales = ventana.flatMap((q) => variantes.map((v) => ({ q, variante: v })));
  // Intercalar consultas generales con voces específicas; evita acaparar toda
  // la cuota con la primera búsqueda de miles de coincidencias.
  const tareas = [];
  for (let i = 0; i < Math.max(semillas.length, adicionales.length); i++) {
    if (i < semillas.length) tareas.push(semillas[i]);
    if (i < adicionales.length) tareas.push(adicionales[i]);
  }
  const informeCosecha = { fuente: base, fecha: new Date().toISOString(), anteriores: antes, procesadas: 0, paginas: 0, errores: [], agotadas: 0 };
  let ultimo = 0;
  async function guardar() {
    const contenido = zlib.gzipSync(JSON.stringify({ fuente: base, generado: new Date().toISOString(), registros: [...registros.values()] }), { level: 8 });
    await fs.writeFile(archivo + '.tmp', contenido);
    await fs.rename(archivo + '.tmp', archivo);
    await fs.writeFile(avance + '.tmp', JSON.stringify(progreso, null, 2));
    await fs.rename(avance + '.tmp', avance);
    await fs.writeFile(informe, JSON.stringify({ ...informeCosecha, nuevos: registros.size - antes, total: registros.size }, null, 2));
  }
  for (const { q, variante } of tareas) {
    if (informeCosecha.paginas >= MAX_PAGINAS) break;
    const clave = claveDe(q, variante);
    const estado = progreso.tareas[clave] || { desde: 0, pagina: 1, completas: false, paginas: 0 };
    if (estado.completas) continue;
    informeCosecha.procesadas++;
    for (let n = 0; n < PAGINAS_POR_TAREA && informeCosecha.paginas < MAX_PAGINAS; n++) {
      let respuesta;
      try {
        const falta = ultimo + PAUSA_MS - Date.now();
        if (falta > 0) await dormir(falta);
        ultimo = Date.now();
        respuesta = await buscar({ q, ...variante, modo: 'todas', desde: estado.desde, pagina: estado.pagina, porPagina: cfg.porPagina });
        if (!Array.isArray(respuesta?.resultados)) throw new Error('Sin resultados[]');
        if (!respuesta.resultados.length && (respuesta.totalFuente || respuesta.total || 0) > 0)
          throw new Error('Página vacía con resultados informados por el sitio');
        const cursor = siguienteCursor(estado.desde, respuesta);
        for (const r of respuesta.resultados) {
          if (!r?.id || !String(r.id).startsWith(base + '_')) continue;
          const limpio = limpiar({ ...r, fuente: base });
          registros.set(r.id, mejor(registros.get(r.id), limpio));
        }
        estado.paginas++;
        informeCosecha.paginas++;
        estado.pagina++;
        if (cursor.agotada) {
          estado.completas = true; informeCosecha.agotadas++; break;
        }
        estado.desde = cursor.desde;
      } catch (e) {
        estado.errores = (estado.errores || 0) + 1;
        estado.ultimoError = String(e?.message || e).slice(0, 200);
        informeCosecha.errores.push({ q, variante, error: estado.ultimoError });
        // Se conserva el cursor y no se marca agotamiento. Otras consultas
        // independientes pueden seguir, incluso si esta fuente falla en una.
        break;
      }
    }
    progreso.tareas[clave] = estado;
    await guardar();
  }
  // Avanzar la ventana sólo tras completar una ronda; mantener cada término
  // con su propio cursor, para reanudar la paginación en futuras ejecuciones.
  if (informeCosecha.paginas < MAX_PAGINAS && palabras.length)
    progreso.indiceTerminos = (indiceInicial + ventana.length) % palabras.length;
  await guardar();
  console.log(JSON.stringify({ ...informeCosecha, nuevos: registros.size - antes, total: registros.size, siguienteTermino: progreso.indiceTerminos }));
}
