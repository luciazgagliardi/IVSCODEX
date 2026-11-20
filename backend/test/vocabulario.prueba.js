/**
 * Vocabulario jurídico: reglas de integridad del tesauro.
 * Un relacionado no es un sinónimo; lo que se suma solo a la búsqueda tiene
 * que estar verificado.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizar, cargar, procedencia, normalizar } from '../lib/vocabulario.js';

const expandidos = (q) => analizar(q).conceptos.flatMap((c) => c.expandir.map((x) => normalizar(x.termino)));

test('todo lo que se expande solo está verificado', () => {
  const { entradas } = cargar();
  for (const e of entradas.values()) for (const r of e.relaciones || []) {
    if (r.politica === 'expandir') assert.equal(r.estado, 'verificada', `${e.canonico} → ${r.termino}`);
    // Un término no preferido de SAIJ sin revisar nunca se suma solo.
    if (/^(descriptor_no_preferido|denominacion_extendida|sigla|concepto_relacionado|concepto_mas_amplio|concepto_mas_especifico|concepto_contrapuesto|figura_que_se_confunde)$/.test(r.tipo)) {
      assert.notEqual(r.politica, 'expandir', `${e.canonico} → ${r.termino} (${r.tipo})`);
    }
  }
});

test('daño moral: se expande a sus equivalentes y no a vecinos ni al daño punitivo', () => {
  const e = expandidos('daño moral');
  assert.ok(e.includes('consecuencias no patrimoniales'));
  assert.ok(!e.includes('dano psicologico'), 'relacionado ≠ sinónimo');
  assert.ok(!e.includes('danos punitivos') && !e.includes('dano punitivo'), 'la jerarquía SAIJ no habilita expandir');
  const c = analizar('daño moral').conceptos[0];
  assert.ok((c.grupos.seConfundeCon || []).some((x) => normalizar(x.termino) === 'dano punitivo'));
});

test('el concepto se reconoce dentro de una consulta más larga y se conserva lo escrito', () => {
  const r = analizar('Daño moral por accidente de tránsito');
  assert.ok(r.conceptos.some((c) => c.canonico === 'daño moral'));
  assert.ok(r.variantes.length > 0);
  assert.ok(r.variantes.every((v) => v.consulta.endsWith('por accidente de tránsito')), JSON.stringify(r.variantes));
});

test('entrar por un equivalente suma el canónico', () => {
  assert.ok(expandidos('usucapión').includes('prescripcion adquisitiva'));
});

test('denominaciones anteriores a la reforma llevan a la vigente, con su norma', () => {
  assert.ok(expandidos('tenencia de los hijos').includes('cuidado personal'));
  const r = analizar('tenencia');
  const c = r.conceptos.find((x) => x.canonico === 'cuidado personal');
  assert.ok(c, JSON.stringify(r.conceptos.map((x) => x.canonico)));
  const h = c.expandir.find((x) => normalizar(x.termino) === 'cuidado personal');
  assert.ok(h && /648/.test(h.norma));
  // «tenencia» sola es ambigua: también es la tenencia simple de estupefacientes.
  // Se devuelven los dos conceptos por separado, sin elegir en silencio.
  assert.ok(r.conceptos.some((x) => x.canonico === 'tenencia simple'));
  assert.ok(!c.expandir.some((x) => /tenencia simple/.test(x.termino)));
  assert.ok(expandidos('régimen de visitas').includes('regimen de comunicacion'));
});

test('régimen de visitas no se expande a «plan de parentalidad» (SAIJ lo cuelga del mismo descriptor)', () => {
  assert.ok(!expandidos('régimen de visitas').includes('plan de parentalidad'));
});

test('un concepto contrapuesto no se reconoce como el de al lado', () => {
  const r = analizar('despido directo');
  assert.ok(!r.conceptos.some((c) => c.canonico === 'despido indirecto'));
  assert.ok(!expandidos('despido directo').includes('despido indirecto'));
});

test('la unión convivencial no se expande desde «concubinato» (art. 510 CCyC)', () => {
  const r = analizar('concubinato');
  assert.ok(!expandidos('concubinato').includes('union convivencial'));
  const c = r.conceptos.find((x) => x.canonico === 'unión convivencial');
  assert.ok(c && c.grupos.historicas.some((x) => /510/.test(x.alcance || '')));
});

test('reconoce voces oficiales del tesauro de Mendoza aunque estén en plural', () => {
  const r = analizar('filtración de agua del vecino');
  assert.ok(r.descriptoresScjm.some((d) => /FILTRACIONES DE AGUA/.test(d.termino)), JSON.stringify(r.descriptoresScjm));
});

test('procedencia con atribución CC-BY y estadísticas', () => {
  const p = procedencia();
  const saij = p.fuentes.find((f) => f.id === 'saij');
  assert.equal(saij.licencia, 'CC-BY-4.0');
  assert.ok(p.estadisticas.conceptosSaij > 10000);
});

test('una consulta sin conceptos no inventa nada', () => {
  const r = analizar('zzzz qqqq');
  assert.equal(r.conceptos.length, 0);
  assert.equal(r.variantes.length, 0);
});
