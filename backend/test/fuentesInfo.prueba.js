import test from 'node:test';
import assert from 'node:assert/strict';
import { FUENTES } from '../lib/fuentes.js';
import {
  informacionFuente,
  catalogoFuentesIntegradas,
  anotarProcedencia,
} from '../lib/fuentesInfo.js';

test('cada conexión automática tiene autoridad, procedencia, jurisdicción y límites declarados', () => {
  const catalogo = catalogoFuentesIntegradas();
  const ids = catalogo.map((f) => f.slug);
  assert.equal(new Set(ids).size, ids.length, 'no hay slugs duplicados en el catálogo');
  for (const fuente of FUENTES) {
    const info = informacionFuente(fuente.slug);
    assert.ok(info, 'falta metadata para ' + fuente.slug);
    for (const campo of ['linea', 'lineas', 'autoridad', 'tipo', 'procedencia', 'jurisdiccion', 'cobertura', 'modalidad', 'limite', 'url']) {
      assert.ok(info[campo], fuente.slug + ' debe declarar ' + campo);
    }
    assert.ok(Array.isArray(info.lineas) && info.lineas.length, fuente.slug + ' debe pertenecer a una o más líneas');
  }
});

test('doctrina, selección editorial, agregador y tribunal oficial no se confunden', () => {
  assert.equal(informacionFuente('dialnet').modalidad, 'indice_academico');
  assert.equal(informacionFuente('mendozalegal').modalidad, 'seleccion_editorial');
  assert.equal(informacionFuente('saij').modalidad, 'agregador_oficial');
  assert.equal(informacionFuente('mendoza').modalidad, 'buscador_oficial');
  assert.ok(informacionFuente('csjn').procedencia.includes('SAIJ'));
  assert.ok(informacionFuente('csjn').limite.toLowerCase().includes('portal directo'));
});

test('SAIJ se reclasifica según el tipo documental realmente consultado', () => {
  assert.equal(informacionFuente('saij', { tribunal: 'legislacion' }).linea, 'Normativa');
  assert.equal(informacionFuente('saij', { tribunal: 'doctrina' }).linea, 'Doctrina jurídica');
  assert.equal(informacionFuente('saij', { tribunal: 'dictamenes' }).linea, 'Derecho administrativo y dictámenes');
  assert.equal(informacionFuente('saij', { tribunal: 'fallos' }).linea, 'Jurisprudencia · fichas de fallos');
  const mendoza = informacionFuente('saij', { tribunal: 'sumarios', provincia: 'Mendoza' });
  assert.equal(mendoza.linea, 'Jurisprudencia provincial · Mendoza');
  assert.equal(mendoza.jurisdiccion, 'Mendoza, Argentina');
  assert.ok(mendoza.lineas.includes('provincial'));
  assert.ok(!mendoza.lineas.includes('nacional'));
});

test('las vistas provinciales SAIJ identifican la provincia y mantienen clara la procedencia agregadora', () => {
  for (const slug of ['buenosaires','caba_saij','catamarca_saij','chaco','chubut','cordoba','corrientes','entrerrios','formosa','jujuy_saij','lapampa','larioja','mendoza_saij','misiones','neuquen','rionegro_saij','salta','sanjuan','sanluis','santacruz','santafe_saij','santiagodelestero','tierradelfuego','tucuman']) {
    const info = informacionFuente(slug);
    assert.equal(info.modalidad, 'agregador_oficial');
    assert.ok(info.jurisdiccion.endsWith(', Argentina'));
    assert.ok(info.procedencia.includes('SAIJ'));
    assert.ok(info.limite.includes('conexión directa') || info.limite.includes('poder judicial'));
  }
});

test('los límites por ruta aceptan slugs con guion bajo de las facetas provinciales', () => {
  const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.equal((index.match(/\[a-z_\-\]\+/g) || []).length, 3);
});

test('la procedencia se incorpora sin destruir los metadatos originales ni mutar la ficha', () => {
  const original = { id: 'x1', caratula: 'Caso de prueba', tribunal: 'Tribunal de prueba' };
  const salida = anotarProcedencia('mendoza', [original]);
  assert.notEqual(salida[0], original);
  assert.equal(original.procedencia, undefined);
  assert.equal(salida[0].fuenteSlug, 'mendoza');
  assert.equal(salida[0].procedencia, 'Poder Judicial de Mendoza');
  assert.equal(salida[0].nivelAutoridad, 'Órgano judicial oficial');
  assert.equal(salida[0].tipoDocumento, 'Fallos y sumarios judiciales');
});
