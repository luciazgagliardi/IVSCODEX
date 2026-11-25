import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');

test('el calendario conserva su disposición lateral y se adapta a pantallas angostas', () => {
  assert.ok(html.includes('.cal-lateral{grid-column:1;grid-row:2;'));
  assert.ok(html.includes('.cal-lista{grid-column:2;grid-row:2;align-self:start;'));
  assert.ok(html.includes('.cal-lateral,.cal-lista,.cal-extra{grid-column:1;grid-row:auto}'));
});

test('los días repetidos se agrupan por fundamento sin repetir cada fecha de feria', () => {
  assert.ok(html.includes('info.tipo!=="feria"'));
  assert.ok(html.includes('if(c.mes===0&&IVSCalculos.FERIA_ENERO[c.juris])'));
  assert.ok(html.includes('lista.push(["1 al "+dm,fe.motivo+" · "+fe.norma,"extra"])'));
  assert.ok(html.includes('x[1]===ant[1]&&x[2]===ant[2]&&dia-prev<=3'));
});

test('los períodos del calendario mantienen la fecha en una sola línea y el texto separado', () => {
  assert.ok(html.includes('.cal-lista p.cal-periodo{grid-template-columns:max-content minmax(0,1fr)}'));
  assert.ok(html.includes('.cal-lista p.cal-periodo>b{white-space:nowrap}'));
  assert.ok(html.includes("class=\"cal-periodo\""));
  assert.ok(html.includes('"Del "+x[0]+" de "+MESES_N[c.mes]'));
  assert.ok(html.includes('<span class=\"cal-lista__texto\">'));
});
