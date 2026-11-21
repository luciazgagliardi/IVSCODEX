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
import { avanzarIndiceTerminos } from '../lib/avanceTerminos.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(RAIZ, process.env.DIR_COSECHA || 'acervo-crudo/respaldo');
export const PLAN = {
  mendoza: { porPagina: 20, variantes: [{ tribunal: 'SC' }, { tribunal: 'CC' }, { tribunal: 'CT' }, { tribunal: 'CF' }],
    consultas: ['daño moral', 'consecuencias no patrimoniales', 'daño punitivo', 'responsabilidad civil', 'daños y perjuicios', 'despido', 'indemnización', 'accidente de trabajo', 'riesgos del trabajo', 'contrato', 'incumplimiento contractual', 'prescripción', 'usucapión', 'alimentos', 'régimen de comunicación', 'sucesión', 'intereses', 'tasa activa', 'amparo', 'recurso de inconstitucionalidad', 'recurso extraordinario provincial', 'empleo público', 'derecho a la salud', 'prueba', 'medida cautelar'] },
  caba: { porPagina: 20, consultas: ['sentencia', 'daños', 'daño moral', 'recurso', 'responsabilidad', 'contrato', 'despido', 'consumidor', 'amparo', 'administrativo', 'empleo público', 'derecho a la salud', 'medida cautelar', 'arbitrariedad', 'competencia', 'hábeas corpus', 'libertad de expresión'] },
  scba: { porPagina: 20, consultas: ['sentencia', 'recurso', 'daño moral', 'daño punitivo', 'responsabilidad civil', 'despido', 'accidente de trabajo', 'incapacidad laboral', 'alimentos', 'contrato', 'consumidor', 'familia', 'sucesiones', 'intereses', 'amparo', 'medida cautelar', 'usucapión', 'desalojo', 'prueba', 'prescripción'] },
  juristeca: { porPagina: 50, consultas: ['daños', 'daño moral', 'sentencia', 'contrato', 'laboral', 'penal', 'familia', 'alimentos', 'consumidor', 'amparo', 'sociedades', 'administrativo', 'sucesiones', 'responsabilidad civil', 'concursos', 'quiebras', 'propiedad horizontal', 'prueba', 'competencia', 'medidas cautelares'] },
  santafe: { porPagina: 30, consultas: ['recurso', 'sentencia', 'daños', 'daño moral', 'contrato', 'trabajo', 'despido', 'responsabilidad civil', 'familia', 'alimentos', 'consumidor', 'amparo', 'sucesión', 'intereses', 'prueba', 'medida cautelar', 'prescripción', 'quiebra', 'empleo público'] },
  rionegro: { porPagina: 10, variantes: [{ tribunal: 'STJ' }, { tribunal: 'CJ' }],
    consultas: ['sentencia', 'recurso', 'daños', 'daño moral', 'despido', 'responsabilidad civil', 'alimentos', 'familia', 'contrato', 'amparo', 'accidente', 'intereses', 'empleo público', 'prueba', 'prescripción', 'medida cautelar'] },
  dialnet: { porPagina: 20, consultas: ['derecho', 'daño moral', 'responsabilidad civil', 'contratos', 'derecho penal', 'derecho laboral', 'derecho de familia', 'derecho del consumidor', 'derechos humanos', 'derecho constitucional', 'derecho administrativo', 'derecho procesal', 'derecho ambiental', 'derecho tributario', 'derecho internacional privado', 'arbitraje', 'prueba', 'jurisprudencia'] },
  mendozalegal: { porPagina: 20, consultas: ['daños', 'recurso', 'responsabilidad', 'responsabilidad civil', 'despido', 'contrato', 'familia', 'consumidor', 'amparo', 'penal', 'sucesiones', 'intereses', 'prueba', 'prescripción', 'daño punitivo'] },
  // El portal excluye expresamente Familia, Menores y Penal. Se cosechan
  // únicamente materias que el propio sistema público declara comprendidas.
  jujuy: { porPagina: 20, consultas: ['daño moral', 'responsabilidad civil', 'daños y perjuicios', 'despido', 'derecho laboral', 'recurso de inconstitucionalidad', 'recurso extraordinario', 'amparo', 'derecho a la salud', 'contrato', 'incumplimiento contractual', 'prescripción', 'usucapión', 'empleo público', 'debido proceso', 'defensa en juicio', 'prueba', 'intereses', 'medida cautelar', 'cosa juzgada', 'nulidad', 'competencia', 'derecho administrativo', 'derecho tributario'] },
  chubut: { porPagina: 20, variantes: [{ tribunal: 'sumarios' }, { tribunal: 'sentencias' }],
    consultas: ['daño moral', 'responsabilidad civil', 'daños y perjuicios', 'despido', 'accidente de trabajo', 'amparo', 'derecho a la salud', 'alimentos', 'familia', 'prescripción', 'contrato', 'nulidad', 'competencia', 'prueba', 'medida cautelar', 'empleo público'] },
  tfn: { porPagina: 25, variantes: [{ tribunal: 'objetos' }, { tribunal: 'doctrinas' }],
    consultas: ['impuesto a las ganancias', 'deducción de intereses', 'IVA crédito fiscal', 'determinación de oficio', 'prescripción tributaria', 'repetición de tributos', 'multa aduanera', 'clasificación arancelaria', 'valor en aduana', 'ajuste por inflación', 'quebrantos impositivos', 'salidas no documentadas', 'responsabilidad solidaria', 'procedimiento tributario', 'medida cautelar tributaria'] },
  santacruz: { porPagina: 25, variantes: [{ tribunal: 'objetos' }, { tribunal: 'doctrinas' }],
    consultas: ['amparo', 'derecho a la salud', 'empleo público', 'despido', 'daño moral', 'responsabilidad civil', 'contrato', 'familia', 'alimentos', 'prescripción', 'recurso de inconstitucionalidad', 'debido proceso', 'prueba', 'medio ambiente', 'minería', 'medida cautelar'] },
  hudoc: { porPagina: 20,
    consultas: ['freedom of expression', 'right to a fair trial', 'right to life', 'right to respect for private and family life', 'protection of property', 'freedom of religion', 'prohibition of torture', 'discrimination', 'effective remedy', 'presumption of innocence', 'access to court', 'environmental protection', 'children rights', 'data protection', 'immigration detention', 'reasonable time', 'judicial independence', 'article 6', 'article 8', 'article 10'] },
};
const limite = (nombre, def, max) => Math.max(1, Math.min(max, Number(process.env[nombre]) || def));
const MAX_PAGINAS = limite('MAX_PAGINAS', 600, 1500);
const MAX_TERMINOS = limite('MAX_TERMINOS', 240, 300);
const PAUSA_MS = Math.max(1100, Math.min(15000, Number(process.env.PAUSA_MS) || 1800));
const PAGINAS_POR_TAREA = limite('PAGINAS_POR_TAREA', 8, 30);
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
  let rechazosDeAcceso = 0;
  const pareceBloqueoDeRed = (mensaje) => /(?:respuesta\s+(?:403|429|502|503|504)|403|429|502|503|504|TimeoutError|AbortError|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|ETIMEDOUT|ENETUNREACH|ECONNREFUSED|ECONNRESET|ECONNABORTED|EPIPE)/i.test(mensaje);
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
        let ultimoError = null;
        for (let intento = 1; intento <= 3; intento++) {
          try {
            respuesta = await buscar({ q, ...variante, modo: 'todas', desde: estado.desde, pagina: estado.pagina, porPagina: cfg.porPagina });
            if (!Array.isArray(respuesta?.resultados)) throw new Error('La fuente no devolvió resultados[]');
            if (!respuesta.resultados.length && Number(respuesta.totalFuente ?? respuesta.total ?? 0) > 0)
              throw new Error('Página vacía con resultados informados por el sitio');
            ultimoError = null;
            break;
          } catch (e) {
            ultimoError = e;
            const mensaje = String(e?.message || e);
            if (!esReintentable(mensaje) || intento === 3) break;
            // Reintentos acotados para fallos transitorios; nunca insistir
            // inmediatamente ante 403/429 ni ignorar la cortesía por host.
            await dormir(Math.min(15_000, PAUSA_MS * intento * 2));
          }
        }
        if (ultimoError) throw ultimoError;
        // Una página válida rompe la racha de rechazos consecutivos de la fuente.
        rechazosDeAcceso = 0;
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
        if (pareceBloqueoDeRed(estado.ultimoError)) rechazosDeAcceso++;
        else rechazosDeAcceso = 0;
        informeCosecha.errores.push({ q, variante, error: estado.ultimoError });
        // Se conserva el cursor y no se marca agotamiento. Otras consultas
        // independientes pueden seguir, incluso si esta fuente falla en una.
        break;
      }
    }
    progreso.tareas[clave] = estado;
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
  // El índice sólo avanza sobre la secuencia contigua de términos cuyas
  // variantes ya agotaron su paginación. Si el presupuesto se termina a mitad
  // de una ronda, el proceso retoma ese término y su cursor en la ejecución siguiente.
  const avance = avanzarIndiceTerminos({ palabras, indiceInicial, ventana, variantes, tareas: progreso.tareas });
  progreso.indiceTerminos = avance.indice;
  const pendientes = tareas.filter(({ q, variante }) => !progreso.tareas[claveDe(q, variante)]?.completas);
  informeCosecha.terminosCompletados = avance.completados;
  informeCosecha.terminosPendientes = pendientes.length;
  informeCosecha.parcialPorPresupuesto = informeCosecha.paginas >= MAX_PAGINAS && pendientes.length > 0;
  informeCosecha.consultasCompletas = tareas.length - pendientes.length;
  await guardar();
  console.log(JSON.stringify({ ...informeCosecha, nuevos: registros.size - antes, total: registros.size,
    siguienteTermino: progreso.indiceTerminos, cursorConservado: pendientes.length > 0 }));
  // Los archivos ya están escritos y el workflow los sube con if: always().
  // La acción se marca fallida sólo si el origen falló de verdad.
  if (informeCosecha.errores.length || informeCosecha.bloqueada) process.exitCode = 1;
}
