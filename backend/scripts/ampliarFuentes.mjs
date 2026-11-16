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
import { siguienteCursor, combinarRegistro, idDocumentalValido } from '../lib/avanceCosecha.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(RAIZ, process.env.DIR_COSECHA || 'acervo-crudo/respaldo');
export const PLAN = {
  mendoza: { porPagina: 20, variantes: [{ tribunal: 'SC' }, { tribunal: 'CC' }, { tribunal: 'CT' }],
    consultas: ['de', 'daño moral', 'consecuencias no patrimoniales', 'responsabilidad civil', 'despido', 'indemnización', 'accidente de trabajo', 'accidente in itinere', 'despido discriminatorio', 'tutela sindical', 'hostigamiento laboral', 'familia', 'sucesión', 'amparo', 'amparo de salud', 'medida cautelar', 'responsabilidad del estado', 'empleo público', 'contrato', 'contrato de seguro', 'exclusión de cobertura', 'franquicia', 'daño punitivo', 'intereses moratorios', 'prescripción liberatoria', 'usucapión', 'alimentos', 'alimentos provisorios', 'compensación económica', 'violencia de género', 'beneficio de litigar sin gastos', 'recurso extraordinario provincial'] },
  caba: { porPagina: 20, consultas: ['sentencia', 'daños', 'responsabilidad civil', 'daño punitivo', 'recurso', 'responsabilidad del estado', 'contrato', 'locación de vivienda', 'despido discriminatorio', 'tutela sindical', 'consumidor', 'familia', 'alimentos', 'amparo', 'amparo de salud', 'medida cautelar', 'perspectiva de género', 'violencia institucional', 'administrativo', 'empleo público', 'penal', 'libertad de expresión'] },
  scba: { porPagina: 20, consultas: ['sentencia', 'recurso', 'daño moral', 'responsabilidad civil', 'daño punitivo', 'despido', 'despido discriminatorio', 'accidente de trabajo', 'accidente in itinere', 'tutela sindical', 'alimentos', 'contrato', 'consumidor', 'familia', 'sucesiones', 'intereses moratorios', 'responsabilidad del estado', 'medida cautelar', 'usucapión', 'prescripción adquisitiva', 'violencia de género', 'amparo'] },
  juristeca: { porPagina: 50, consultas: ['daños', 'daño moral', 'daño punitivo', 'responsabilidad civil', 'sentencia', 'recurso extraordinario', 'contrato', 'incumplimiento contractual', 'laboral', 'despido discriminatorio', 'accidente de trabajo', 'penal', 'prisión preventiva', 'familia', 'alimentos', 'compensación económica', 'consumidor', 'cláusulas abusivas', 'amparo', 'medida cautelar', 'sociedades', 'concursos y quiebras', 'administrativo', 'responsabilidad del estado'] },
  santafe: { porPagina: 30, consultas: ['recurso', 'sentencia', 'daños', 'daño moral', 'responsabilidad civil', 'contrato', 'incumplimiento contractual', 'trabajo', 'despido', 'accidente laboral', 'penal', 'prisión preventiva', 'familia', 'alimentos', 'responsabilidad', 'responsabilidad del estado', 'consumidor', 'daño punitivo', 'amparo', 'medida cautelar', 'sucesión', 'prescripción adquisitiva'] },
  rionegro: { porPagina: 10, variantes: [{ tribunal: 'STJ' }, { tribunal: 'CJ' }],
    consultas: ['sentencia', 'recurso', 'daños', 'daño moral', 'responsabilidad civil', 'despido', 'accidente de trabajo', 'alimentos', 'familia', 'contrato', 'amparo', 'medida cautelar', 'penal', 'prisión preventiva', 'responsabilidad del estado', 'prescripción adquisitiva'] },
  dialnet: { porPagina: 20, consultas: ['derecho', 'daño moral', 'responsabilidad civil', 'daño punitivo', 'contratos', 'derecho penal', 'prueba digital', 'evidencia electrónica', 'derecho laboral', 'discriminación laboral', 'familia', 'consumidor', 'derechos humanos', 'derecho constitucional', 'derecho administrativo', 'inteligencia artificial y derecho', 'debido proceso', 'procesal', 'sucesiones', 'derecho ambiental'] },
  mendozalegal: { porPagina: 20, consultas: ['de', 'daños', 'recurso', 'responsabilidad', 'despido', 'contrato', 'familia', 'consumidor', 'amparo', 'penal'] },
};
const limite = (nombre, def, max) => Math.max(1, Math.min(max, Number(process.env[nombre]) || def));
const MAX_PAGINAS = limite('MAX_PAGINAS', 120, 1500);
const MAX_TERMINOS = limite('MAX_TERMINOS', 36, 300);
const PAUSA_MS = Math.max(1100, Math.min(15000, Number(process.env.PAUSA_MS) || 1800));
const PAGINAS_POR_TAREA = limite('PAGINAS_POR_TAREA', 3, 30);
// Las semillas cubren las materias troncales en cada ejecución; las voces
// rotativas reciben más páginas, pero no pueden consumir toda la cuota.
const PAGINAS_POR_SEMILLA = limite('PAGINAS_POR_SEMILLA', 1, 10);
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const leerJson = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; } };
const claveDe = (q, variante) => JSON.stringify([q, variante]);
const limpiar = (r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !k.startsWith('_') && v != null && v !== ''));
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
  // Las ejecuciones anteriores descartaban TODOS los ids por una expresión
  // regular mal escapada. Sus cursores no equivalen a documentos cosechados:
  // recorrer de nuevo desde la primera página, una única vez por fuente.
  if (progreso.versionIds !== 2) {
    progreso.tareas = {};
    progreso.indiceTerminos = 0;
    progreso.versionIds = 2;
  }
  const extras = await leerJson(path.join(RAIZ, 'datos', 'terminos-cosecha.json'), []);
  const palabras = Array.isArray(extras) ? [...new Set(extras.filter((x) => typeof x === 'string').map((x) => x.trim()).filter((x) => x.length > 2 && x.length <= 90))] : [];
  const indiceInicial = progreso.indiceTerminos || 0;
  const ventana = [];
  for (let k = 0; k < Math.min(MAX_TERMINOS, palabras.length); k++)
    ventana.push(palabras[(indiceInicial + k) % palabras.length]);
  const variantes = cfg.variantes || [{}];
  const semillas = cfg.consultas.flatMap((q) => variantes.map((v) => ({ q, variante: v })));
  const adicionales = ventana.flatMap((q, indiceTermino) => variantes.map((v) => ({ q, variante: v, indiceTermino, adicional: true })));
  // Primero una página de cada consulta troncal; después las voces rotativas
  // agrupadas por término. Así una base amplia no consume toda la cuota en
  // profundizar tres o cuatro semillas y deja sin probar centenares de temas.
  const tareas = [...semillas.map((t) => ({ ...t, adicional: false })), ...adicionales];
  const variantesVisitadas = Array.from({ length: ventana.length }, () => new Set());
  const informeCosecha = { fuente: base, fecha: new Date().toISOString(), anteriores: antes, procesadas: 0, paginas: 0, errores: [], agotadas: 0 };
  let ultimo = 0;
  let rechazosDeAcceso = 0;
  const pareceBloqueoDeRed = (mensaje) => /(?:respuesta 403|UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT|ENETUNREACH|ECONNREFUSED)/i.test(mensaje);
  async function guardar() {
    const contenido = zlib.gzipSync(JSON.stringify({ fuente: base, generado: new Date().toISOString(), registros: [...registros.values()] }), { level: 8 });
    await fs.writeFile(archivo + '.tmp', contenido);
    await fs.rename(archivo + '.tmp', archivo);
    await fs.writeFile(avance + '.tmp', JSON.stringify(progreso, null, 2));
    await fs.rename(avance + '.tmp', avance);
    await fs.writeFile(informe, JSON.stringify({ ...informeCosecha, nuevos: registros.size - antes, total: registros.size }, null, 2));
  }
  for (const { q, variante, adicional, indiceTermino } of tareas) {
    if (informeCosecha.paginas >= MAX_PAGINAS) break;
    const clave = claveDe(q, variante);
    const estado = progreso.tareas[clave] || { desde: 0, pagina: 1, completas: false, paginas: 0 };
    if (estado.completas) {
      if (adicional) variantesVisitadas[indiceTermino].add(JSON.stringify(variante));
      continue;
    }
    informeCosecha.procesadas++;
    let falloEnTarea = false;
    const paginasDeEstaTarea = adicional ? PAGINAS_POR_TAREA : PAGINAS_POR_SEMILLA;
    for (let n = 0; n < paginasDeEstaTarea && informeCosecha.paginas < MAX_PAGINAS; n++) {
      let respuesta;
      try {
        const falta = ultimo + PAUSA_MS - Date.now();
        if (falta > 0) await dormir(falta);
        ultimo = Date.now();
        respuesta = await buscar({ q, ...variante, modo: 'todas', desde: estado.desde, pagina: estado.pagina, porPagina: cfg.porPagina });
        if (!Array.isArray(respuesta?.resultados)) throw new Error('Sin resultados[]');
        if (!respuesta.resultados.length && (respuesta.totalFuente || respuesta.total || 0) > 0)
          throw new Error('Página vacía con resultados informados por el sitio');
        const cursor = siguienteCursor(estado.desde, respuesta, { cursorDescendente: base === 'juristeca' });
        for (const r of respuesta.resultados) {
          if (!idDocumentalValido(r?.id)) continue;
          const limpio = limpiar({ ...r, fuente: base });
          registros.set(r.id, combinarRegistro(registros.get(r.id), limpio));
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
        // Cuatro consultas independientes con bloqueo de red y ninguna página
        // obtenida indican que esta ejecución no puede cosechar desde su IP.
        // No marcar ninguna consulta como agotada: se reintentará en la próxima.
        if (informeCosecha.paginas === 0 && pareceBloqueoDeRed(estado.ultimoError)) rechazosDeAcceso++;
        else rechazosDeAcceso = 0;
        informeCosecha.errores.push({ q, variante, error: estado.ultimoError });
        // Se conserva el cursor y no se marca agotamiento. Otras consultas
        // independientes pueden seguir, incluso si esta fuente falla en una.
        falloEnTarea = true;
        break;
      }
    }
    progreso.tareas[clave] = estado;
    if (adicional && !falloEnTarea) variantesVisitadas[indiceTermino].add(JSON.stringify(variante));
    if (rechazosDeAcceso >= 4) {
      informeCosecha.bloqueada = true;
      informeCosecha.causaBloqueo = estado.ultimoError;
      console.log('FUENTE_BLOQUEADA ' + JSON.stringify({ fuente: base, causa: estado.ultimoError,
        intentosIndependientes: rechazosDeAcceso, cursorPreservado: true }));
      await guardar();
      break;
    }
    await guardar();
  }
  // Avanzar solamente los términos cuyas variantes llegaron a tener turno.
  // Antes se adelantaba toda la ventana (hasta 300 voces) aunque el límite de
  // páginas sólo hubiese permitido probar las primeras 20–40: las restantes
  // podían quedar olvidadas durante decenas de ejecuciones. El cursor de cada
  // consulta conserva su página para profundizarla cuando vuelva a rotar.
  let terminosAvanzados = 0;
  while (terminosAvanzados < ventana.length && variantesVisitadas[terminosAvanzados].size === variantes.length)
    terminosAvanzados++;
  if (palabras.length)
    progreso.indiceTerminos = (indiceInicial + terminosAvanzados) % palabras.length;
  await guardar();
  console.log(JSON.stringify({ ...informeCosecha, nuevos: registros.size - antes, total: registros.size, siguienteTermino: progreso.indiceTerminos }));
}
