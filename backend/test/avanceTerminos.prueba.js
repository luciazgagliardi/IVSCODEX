import test from 'node:test';
import assert from 'node:assert/strict';
import { avanzarIndiceTerminos } from '../lib/avanceTerminos.js';

const clave = (q, variante) => JSON.stringify([q, variante]);

test('el avance sólo supera términos cuyas variantes están completas', () => {
  const palabras = ['civil', 'laboral', 'penal', 'familia'];
  const variantes = [{ tribunal: 'SC' }, { tribunal: 'CC' }];
  const tareas = {
    [clave('civil', variantes[0])]: { completas: true },
    [clave('civil', variantes[1])]: { completas: true },
    [clave('laboral', variantes[0])]: { completas: true },
    [clave('laboral', variantes[1])]: { completas: false },
    [clave('penal', variantes[0])]: { completas: true },
    [clave('penal', variantes[1])]: { completas: true },
  };
  assert.deepEqual(avanzarIndiceTerminos({ palabras, indiceInicial: 0, ventana: palabras.slice(0, 3), variantes, tareas }),
    { indice: 1, completados: 1, pendientes: 2 });
});

test('un bloqueo en la primera variante conserva el término actual', () => {
  const palabras = ['civil', 'laboral'];
  const variantes = [{}, { tribunal: 'sentencias' }];
  assert.deepEqual(avanzarIndiceTerminos({ palabras, indiceInicial: 1, ventana: palabras, variantes,
    tareas: { [clave('laboral', variantes[0])]: { completas: true } } }),
    { indice: 1, completados: 0, pendientes: 2 });
});

test('el índice normaliza vueltas y no avanza cuando no hay términos', () => {
  assert.deepEqual(avanzarIndiceTerminos({ palabras: ['a', 'b'], indiceInicial: 3, ventana: [], variantes: [{}], tareas: {} }),
    { indice: 1, completados: 0, pendientes: 0 });
  assert.deepEqual(avanzarIndiceTerminos({ palabras: [], indiceInicial: 7, ventana: ['x'], variantes: [{}], tareas: {} }),
    { indice: 0, completados: 0, pendientes: 0 });
});
