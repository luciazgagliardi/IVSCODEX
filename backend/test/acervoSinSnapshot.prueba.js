/**
 * Regresión Azure: con FTS activo en /home, pero sin copia en /tmp, la
 * búsqueda debe consultar el SQLite COMPLETO en modo estrictamente lectura.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'acervo-sin-snapshot-'));
process.env.DIR_ACERVO=path.join(tmp,'base');
process.env.DIR_ACERVO_DATOS=path.join(tmp,'tandas');
process.env.DIR_INDICE=path.join(tmp,'indice');
process.env.ACERVO_COPIA_LOCAL='1';
process.env.ACERVO_SIN_SNAPSHOT='1';
fs.mkdirSync(process.env.DIR_ACERVO_DATOS,{recursive:true});
fs.mkdirSync(process.env.DIR_INDICE,{recursive:true});

const fallos=[
  {id:'mza_1',fuente:'mendoza',caratula:'Pérez contra Aseguradora',tribunal:'Cámara Civil de Mendoza',fecha:'07/09/2026',sumario:'Se reconoce daño moral.'},
  {id:'mza_2',fuente:'mendoza',caratula:'Gómez contra Transporte',tribunal:'Cámara Civil de Mendoza',fecha:'08/09/2026',sumario:'Se reparan las consecuencias no patrimoniales.'},
  {id:'saij_1',fuente:'saij',provincia:'Mendoza',caratula:'Álvarez contra Empresa',tribunal:'Cámara Civil de Mendoza',fecha:'09/09/2026',sumario:'Se admite agravio moral.'},
  {id:'mza_3',fuente:'mendoza',caratula:'Consumidor contra Banco',tribunal:'Cámara Civil de Mendoza',fecha:'10/09/2026',sumario:'Corresponde daño punitivo.'},
  {id:'mza_4',fuente:'mendoza',caratula:'Usuario contra Proveedor',tribunal:'Cámara Civil de Mendoza',fecha:'11/09/2026',sumario:'Se impone multa civil.'},
  {id:'saij_2',fuente:'saij',provincia:'Mendoza',caratula:'Comprador contra Comercio',tribunal:'Cámara Civil de Mendoza',fecha:'12/09/2026',sumario:'Se aplica sanción pecuniaria disuasiva.'},
  {id:'saij_ajeno',fuente:'saij',provincia:'Córdoba',caratula:'Otro contra Proveedor',tribunal:'Cámara Civil de Córdoba',fecha:'12/09/2026',sumario:'Se aplica daño punitivo.'},
];
fs.writeFileSync(path.join(process.env.DIR_ACERVO_DATOS,'lote-001.jsonl.gz'),zlib.gzipSync(fallos.map(x=>JSON.stringify(x)).join('\n')));
fs.writeFileSync(path.join(process.env.DIR_ACERVO_DATOS,'manifiesto.json'),JSON.stringify({version:'azure-sin-snapshot-1',archivos:['lote-001.jsonl.gz']}));
const {prepararAcervo,buscarPagina,estadoAcervo,copiaLista}=await import('../lib/acervo.js');
await prepararAcervo({esperar:true});

test('el corpus FTS queda activo aunque la copia rápida esté suspendida',()=>{
  assert.equal(estadoAcervo().activo,true);
  assert.equal(estadoAcervo().version,'azure-sin-snapshot-1');
  assert.equal(copiaLista(),false,'no existe snapshot local en esta prueba');
});

test('sin snapshot, el hilo FTS consulta todos los fallos con sinónimos y provincia correcta',async()=>{
  const moral=await buscarPagina('mendoza','daño moral',{
    variantes:['consecuencias no patrimoniales','agravio moral'],porPagina:10,
  },{espera:12000});
  assert.ok(moral,'el SQLite persistente debe contestar sin snapshot');
  assert.equal(moral.total,3);
  assert.deepEqual(new Set(moral.resultados.map(x=>x.id)),new Set(['mza_1','mza_2','saij_1']));
  const punitivo=await buscarPagina('mendoza','daño punitivo',{
    variantes:['multa civil','sanción pecuniaria disuasiva'],porPagina:10,
  },{espera:12000});
  assert.equal(punitivo?.total,3);
  assert.deepEqual(new Set(punitivo.resultados.map(x=>x.id)),new Set(['mza_3','mza_4','saij_2']));
  assert.equal(estadoAcervo().lectura?.modo,'lectura_persistente_solo_lectura');
  assert.ok(estadoAcervo().lectura?.archivo?.endsWith('acervo.db'));
  assert.equal(estadoAcervo().errorHilo,null);
});

test('paginación desde SQLite persistente conserva el total exacto',async()=>{
  const a=await buscarPagina('mendoza','daño punitivo',{variantes:['multa civil','sanción pecuniaria disuasiva'],porPagina:2,desde:0});
  assert.equal(a.total,3);
  assert.equal(a.siguienteDesde,2);
  const b=await buscarPagina('mendoza','daño punitivo',{variantes:['multa civil','sanción pecuniaria disuasiva'],porPagina:2,desde:2});
  assert.equal(b.total,3);
  assert.equal(b.siguienteDesde,null);
  assert.ok(!a.resultados.some(x=>b.resultados.some(y=>x.id===y.id)));
});
