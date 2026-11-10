import test from 'node:test';
import assert from 'node:assert/strict';
import { siguienteOffsetScba } from '../lib/indiceScba.js';

test('SCBA no repite una página si sólo se pudieron leer 19 de sus 20 fichas',()=>{
 assert.equal(siguienteOffsetScba(0,19,20,2744),20);
 assert.equal(siguienteOffsetScba(20,18,20,2744),40);
 assert.equal(siguienteOffsetScba(40,20,20,2744),60);
});
test('SCBA conserva paginación corta y corte final sin saltos',()=>{
 assert.equal(siguienteOffsetScba(0,10,10,100),10);
 assert.equal(siguienteOffsetScba(10,9,10,100),20);
 assert.equal(siguienteOffsetScba(80,19,20,95),null);
});
