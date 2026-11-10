import test from 'node:test';
import assert from 'node:assert/strict';
import { esSentenciaClasificada, esTextoJudicialSustantivo } from '../lib/clasificarActuacionMza.js';

test('Mendoza: avisos y vistas de causa NO son fallos',()=>{
  const tramites=[
    'constancia de notificacion de sentencia - emplazamiento a pagar tasa de jus',
    'vista de causa sin llamamiento para sentencia',
    'vista de causa unipersonal dr. cesar rumbo.sin llamamiento para sentencia.',
    'NOTIFICACIÓN DE SENTENCIA',
    'DECRETO: visto el dictado de sentencia',
    'proveído sobre sentencia definitiva',
    'sin llamamiento para sentencia',
  ];
  for(const x of tramites)assert.equal(esSentenciaClasificada(x),false,'Trámite indebidamente clasificado: '+x);
});
test('Mendoza: fallos definitivos, monitorios y homologaciones judiciales sí pueden incorporarse',()=>{
  const sentencias=[
    'sentencia definitiva (fin)',
    'sentencia unipersonal firma digital',
    'sentencia unipersonal homologatoria',
    'sentencia monitoria ejecuciÓn honorarios firma digital',
    'sentencia colegiada diferencia indemnizacion',
    'au. inicial. convenio. sentencia unipersonal homologatoria',
    'audiencia conciliacion. convenio. sentencia unipersonal homologacion',
    'acta conv.cap y hon c/ sentencia unipersonal homologatoria firma digital',
  ];
  for(const x of sentencias)assert.equal(esSentenciaClasificada(x),true,'Sentencia omitida: '+x);
});
test('Mendoza: no alcanza con carátula o aviso para ser un texto sustantivo',()=>{
  assert.equal(esTextoJudicialSustantivo('notificación de sentencia.'),false);
  assert.equal(esTextoJudicialSustantivo('sentencia. '.repeat(80)),false);
  assert.equal(esTextoJudicialSustantivo('PODER JUDICIAL DE MENDOZA VISTOS '+ 'fundamentos de hecho y derecho. '.repeat(30)),true);
});
