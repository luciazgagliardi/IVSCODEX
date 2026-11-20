/**
 * Red de relaciones jurídicas: convierte el análisis de un documento en
 * aristas tipadas, cada una con la evidencia textual que la sostiene.
 *
 * Reutiliza el analizador del Lector (frontend/analisis-fallo.js: detectar e
 * IVSAnalisis), que ya trabaja con reglas deterministas y grados de certeza.
 * No usa IA y no infiere doctrina.
 *
 * Qué se genera automáticamente (lo que el texto permite afirmar):
 *   - menciona_norma: el documento cita un artículo de una norma. «Menciona»,
 *     no «aplica» ni «interpreta»: un fallo puede citar un artículo para
 *     descartarlo. Si la norma se dedujo por contexto, queda «probable».
 *   - cita_precedente: cita literal de un precedente (p. ej. «Fallos 300:936»).
 *   - confirma / revoca / modifica / anula: lo que la parte resolutiva dice
 *     sobre la resolución recurrida, con el texto literal.
 *
 * Qué NUNCA se genera solo: sigue, distingue, limita, abandona, contradice,
 * complementa, comenta, deriva_de. Requieren lectura jurídica; se cargan como
 * relaciones revisadas por una persona (estado «revisada»).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { detectar, IVSAnalisis } = require(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/analisis-fallo.js'));

export const RELACIONES = {
  automaticas: ['menciona_norma', 'cita_precedente', 'confirma', 'revoca', 'modifica', 'anula'],
  soloRevisionHumana: ['aplica', 'interpreta', 'sigue', 'distingue', 'limita', 'abandona', 'contradice', 'complementa', 'comenta', 'deriva_de'],
};

const VERBO_A_RELACION = { confirma: 'confirma', revoca: 'revoca', modifica: 'modifica', anula: 'anula' };

function fragmento(texto, ini, fin, antes = 120, despues = 60) {
  return (ini > antes ? '…' : '') + texto.slice(Math.max(0, ini - antes), Math.min(texto.length, fin + despues)).replace(/\s+/g, ' ').trim() + (fin + despues < texto.length ? '…' : '');
}

/**
 * @param {{id: string, texto: string, tipo?: string, caratula?: string}} doc
 * @returns {{documento: string, aristas: object[], avisos: string[]}}
 */
export function aristasDeDocumento(doc) {
  const texto = String(doc?.texto || '');
  const aristas = [];
  const avisos = [];
  if (texto.length < 200) return { documento: doc?.id ?? null, aristas, avisos: ['Texto demasiado breve para extraer relaciones.'] };

  // 1. Normas citadas: una arista por norma y artículo, con la primera evidencia.
  const d = detectar(texto);
  const vistas = new Map();
  for (const c of d.citas || []) {
    if (!c.f || /sin ley identificada/i.test(c.f)) continue;
    const clave = `${c.f}|${c.l}`;
    const previa = vistas.get(clave);
    if (previa) { previa.apariciones++; if (!c.ctx && previa.certeza !== 'confirmado') { previa.certeza = 'confirmado'; previa.evidencia = { texto: fragmento(texto, c.pos, c.fin), ini: c.pos, fin: c.fin }; } continue; }
    const a = {
      origen: doc.id, relacion: 'menciona_norma',
      destino: { tipo: 'norma', norma: c.f, articulo: c.l },
      evidencia: { texto: fragmento(texto, c.pos, c.fin), ini: c.pos, fin: c.fin },
      metodo: c.ctx ? 'regla:articulo-con-norma-deducida-por-contexto' : 'regla:articulo-con-norma-explicita',
      certeza: c.ctx ? 'probable' : 'confirmado',
      estado: c.ctx ? 'requiere_revision' : 'extraida',
      apariciones: 1,
    };
    vistas.set(clave, a);
    aristas.push(a);
  }

  // 2. Precedentes citados literalmente (Fallos T:P y equivalentes que reconoce el lector).
  const citados = Array.isArray(d.citados) ? d.citados : Object.keys(d.citados || {});
  for (const cita of new Set(citados)) {
    if (!/\D/.test(cita) || cita.length < 5) continue;
    const pos = texto.indexOf(cita);
    aristas.push({
      origen: doc.id, relacion: 'cita_precedente',
      destino: { tipo: 'precedente', cita },
      evidencia: pos >= 0 ? { texto: fragmento(texto, pos, pos + cita.length), ini: pos, fin: pos + cita.length } : null,
      metodo: 'regla:cita-literal', certeza: 'confirmado', estado: 'extraida',
    });
  }

  // 3. Lo que la parte resolutiva dice sobre la resolución recurrida.
  let decision = null;
  try { decision = IVSAnalisis.analizar(texto, { tipo: doc.tipo || null, car: doc.caratula || null }).decision; } catch { avisos.push('No se pudo analizar la parte resolutiva.'); }
  const g = decision?.global;
  if (g && Array.isArray(g.verbos)) {
    for (const v of g.verbos) {
      const relacion = VERBO_A_RELACION[v];
      if (!relacion) continue;
      aristas.push({
        origen: doc.id, relacion,
        destino: { tipo: 'resolucion_recurrida', descripcion: g.literal || null },
        evidencia: g.evidencia ? { texto: g.evidencia.texto, ini: g.evidencia.ini, fin: g.evidencia.fin } : null,
        metodo: `regla:${g.regla || 'parte-resolutiva'}`,
        certeza: g.certeza || 'probable',
        estado: g.certeza === 'confirmado' ? 'extraida' : 'requiere_revision',
      });
    }
  }
  if (!aristas.some((a) => a.destino.tipo === 'resolucion_recurrida')) {
    avisos.push('No se identificó qué resolvió el tribunal sobre la resolución recurrida.');
  }
  return { documento: doc.id, aristas, avisos };
}
