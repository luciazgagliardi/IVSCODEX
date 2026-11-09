import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('rearmar no elimina registros publicados cuando falta la cosecha cruda', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ivs-base-'));
  try {
    const base = path.join(dir, 'base'), salida = path.join(dir, 'salida');
    fs.mkdirSync(base);
    const filas = [
      {id:'mza_archivo_1',fuente:'mendoza',tribunal:'SUPREMA CORTE DE JUSTICIA',sumario:'Criterio judicial',caratula:'A c/ B'},
      {id:'saij_archivo_1',fuente:'saij',provincia:'Mendoza',tribunal:'CAMARA DEL TRABAJO',sumario:'Despido indirecto'},
    ];
    fs.writeFileSync(path.join(base, 'mendoza-001.jsonl.gz'), zlib.gzipSync(JSON.stringify(filas[0])));
    fs.writeFileSync(path.join(base, 'saij-001.jsonl.gz'), zlib.gzipSync(JSON.stringify(filas[1])));
    fs.writeFileSync(path.join(base, 'manifiesto.json'), JSON.stringify({version:'prueba-antigua',archivos:['mendoza-001.jsonl.gz','saij-001.jsonl.gz'],conteos:{mendoza:1,saij:1,csjn:0}}));
    const script = fileURLToPath(new URL('../scripts/armarAcervo.mjs', import.meta.url));
    const r = spawnSync(process.execPath,[script],{encoding:'utf8',timeout:30000,env:{...process.env,DIR_ACERVO_BASE:base,DIR_ACERVO_DATOS:salida}});
    assert.equal(r.status,0,r.stderr || r.stdout);
    const man = JSON.parse(fs.readFileSync(path.join(salida,'manifiesto.json'),'utf8'));
    assert.equal(man.conteos.mendoza,1);
    assert.equal(man.conteos.saij,1);
    const ids = man.archivos.flatMap(nombre=>zlib.gunzipSync(fs.readFileSync(path.join(salida,nombre))).toString().split('\n').filter(Boolean).map(x=>JSON.parse(x).id));
    assert.deepEqual(ids.sort(),filas.map(x=>x.id).sort());
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
