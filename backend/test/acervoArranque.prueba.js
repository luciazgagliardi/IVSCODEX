import test from 'node:test';
import assert from 'node:assert/strict';
import { puedeIniciarCosechas } from '../lib/acervoArranque.js';

test('ninguna cosecha intensiva empieza durante el armado de SQLite',()=>{
 assert.equal(puedeIniciarCosechas({activo:false,importando:true,error:null}),false);
 assert.equal(puedeIniciarCosechas({activo:true,importando:true,error:null}),false);
 assert.equal(puedeIniciarCosechas({activo:true,importando:false,error:'importación incompleta'}),false);
 assert.equal(puedeIniciarCosechas({activo:false,importando:false}),false);
});
test('las cosechas se habilitan al completar un índice sano',()=>{
 assert.equal(puedeIniciarCosechas({activo:true,importando:false,error:null}),true);
});
