/**
 * Santa Fe (lib/indiceSantaFe.js): de cada sumario salen la carátula, la fecha,
 * la resolución, las voces, el texto y el enlace a la sentencia completa.
 *
 *   node --test test/santafe.prueba.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parsear, totalDe } from '../lib/indiceSantaFe.js';

const HTML = `<div class='subtitulos padding'><h4>Su b&uacute;squeda arrojo "864" resultados</h4></div>
<div id='div_sum_51900' style='text-align:justify'><div id= 'titulo_51900'><h6><span style='color: #104b45;'>Tesauro > </span><span>DERECHO LABORAL > DESPIDO INDIRECTO </span></h6></div>
<p class='verde'> DESPIDO INDIRECTO. PLAZO.</p><div id='p_51900'><p><p>Al arribar a la conclusión de tener por configurado el despido indirecto. - REFERENCIAS NORMATIVAS: Ley 20744, artículos 57 y 63.</p></p></div>
<p class='caratulas'><a TARGET='_blank' href='https://portal.justiciasantafe.gov.ar/bdj/index.php?pg=bus&m=busqueda&c=busqueda&a=get&id=55529'>GALEANO, SILVIA LORENA c/ VETERINARIA CIMA S.R.L. s/ RECURSO DE INCONSTITUCIONALIDAD /// CORTE SUPREMA DE JUSTICIA, Santa Fe, Santa Fe; 14-oct-2026; Fuente Propia; 1040/26</a></p></div>`;

test('un sumario de la Corte de Santa Fe', () => {
  assert.equal(totalDe(HTML), 864);
  const [r] = parsear(HTML);
  assert.equal(r.id, 'santafe_51900');
  assert.equal(r.caratula, 'GALEANO, SILVIA LORENA c/ VETERINARIA CIMA S.R.L. s/ RECURSO DE INCONSTITUCIONALIDAD');
  assert.equal(r.fecha, '14/10/2026');
  assert.equal(r.expediente, 'Resolución 1040/26');
  assert.deepEqual(r.voces, ['DESPIDO INDIRECTO']);
  assert.equal(r.sumario, 'Al arribar a la conclusión de tener por configurado el despido indirecto.');
  assert.match(r.linkFallo, /a=get&id=55529$/);
});
