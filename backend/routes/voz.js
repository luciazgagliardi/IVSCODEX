import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import WebSocket from 'ws';

export const routerVoz = express.Router();

routerVoz.get('/voz', (_req, res) => {
  res.json({ ok: true, idioma: LANG, voz: VOZ, requiereInternet: true });
});

const VOZ = 'es-AR-ElenaNeural';
const LANG = 'es-AR';
const CHROMIUM = '143.0.3650.75';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const SEC_VERSION = '2-' + CHROMIUM;
const WINDOWS_EPOCH = 11644473600n;
const PREFIX = Buffer.from(
  ['Q29weXJpZ2h0IChDKSBNaWNyb3NvZnQg', 'Q29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQu'].join(''),
  'base64'
);
const COEFFICIENTS = [
  [0xE82E91B1, 0xB32700D0], [0x44DE24C6, 0x88DFF51D],
  [0x3BEB65BC, 0x29514038], [0xC89C5933, 0xB328CBDF],
  [0x8D1EC211, 0xD405B4D5], [0x314EF5D5, 0x26E55F3C],
  [0xE92491B1, 0x607801C6], [0xF0A5B9D5, 0x82B2C1FB],
  [0x06064CF3, 0xFA51A3DA], [0xDA79FA60, 0x207CC464],
  [0xBED20560, 0x3C3C74F3], [0x89F9C9F8, 0xD2D14B61],
  [0x35FA38C6, 0xBB04A2C1], [0xCB49E3C6, 0xC5626167],
];

const rol16 = (x) => ((x << 16) | (x >>> 16)) >>> 0;

function cs64Digest(data, shaDigest) {
  const keyA = (shaDigest.readUInt32LE(0) | 1) >>> 0;
  const keyB = (shaDigest.readUInt32LE(4) | 1) >>> 0;
  const factors = [
    Math.imul(keyA, 0x82893933) >>> 0,
    Math.imul(keyB, 0x82893933) >>> 0,
  ];
  const terms = COEFFICIENTS.map(([coefficient], i) =>
    Math.imul(coefficient, factors[i % 2]) >>> 0
  );
  const offsets = COEFFICIENTS.map(([, offset]) => offset);
  const padded = Buffer.alloc(Math.ceil((data.length + 1) / 8) * 8);
  padded.set(data, 1);

  for (let i = 0; i < padded.length / 4; i++) {
    const word = padded.readUInt32LE(i * 4);
    let term = Math.imul(word, i % 2 === 0 ? keyA : keyB);
    let offset = Math.imul(rol16(word), i % 2 === 0 ? 0xEF0569FB : 0xC31713DB);
    if (i === 0) {
      term = (term + Math.imul(0xF2F90B1A, factors[0])) >>> 0;
      offset = (offset + 0x0B1A0000) >>> 0;
    }
    terms.push(term >>> 0);
    offsets.push(offset >>> 0);
  }

  let swapAcc = 0, swapLast = 0, state = 0, acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i], y = terms[i + 1];
    let t = rol16((offsets[i] + x) >>> 0);
    let q = Math.imul(t, 0x76F50F34);
    swapAcc += (Math.imul(rol16(q), 0xC3EFEA97) + q) >>> 0;
    t = rol16((offsets[i + 1] + y) >>> 0);
    q = Math.imul(t, 0x1881CE3C);
    swapLast = (Math.imul(rol16(q), 0x35BD1EC9) + q) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;
    state = (Math.imul(state, keyA) + x) >>> 0;
    for (const k of [0xCF98B111, 0x87085B9F, 0x12CEB96D, 0x257E1D83]) {
      state = Math.imul(rol16(state), k) >>> 0;
    }
    acc += state;
    t = (Math.imul(state, keyB) + y) >>> 0;
    t = Math.imul(rol16(t), 0xA27416F5) >>> 0;
    t = Math.imul(rol16(t), 0xD38396FF) >>> 0;
    state = Math.imul(rol16(Math.imul(rol16(t), 0x7C932B89)), 0xBFA49F69) >>> 0;
    acc = (acc + state) >>> 0;
  }

  const result = Buffer.allocUnsafe(8);
  result.writeUInt32LE((swapLast ^ state) >>> 0, 0);
  result.writeUInt32LE((swapAcc ^ acc) >>> 0, 4);
  return result;
}

function securityToken() {
  const epochSeconds = BigInt(Math.floor(Date.now() / 1000)) + WINDOWS_EPOCH;
  const roundedSeconds = epochSeconds - (epochSeconds % 300n);
  const ticks = roundedSeconds * 10000000n;
  const data = Buffer.from(String(ticks) + TRUSTED_CLIENT_TOKEN, 'ascii');
  const sha = createHash('sha256').update(PREFIX).update(data).digest();
  const cs64 = cs64Digest(data, sha);
  return cs64.toString('hex').toUpperCase() + '-' + sha.toString('hex').toUpperCase();
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[char]);
}

async function sintetizarVozArgentina(input) {
  const texto = String(input || '').trim();
  if (!texto) throw new TypeError('El texto está vacío.');
  if (texto.length > 900) throw new RangeError('El fragmento supera el máximo de 900 caracteres.');

  const url = 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1' +
    '?Ocp-Apim-Subscription-Key=' + TRUSTED_CLIENT_TOKEN +
    '&Sec-MS-GEC=' + securityToken() +
    '&Sec-MS-GEC-Version=' + SEC_VERSION;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/' + CHROMIUM.split('.')[0] + '.0.0.0 Safari/537.36 Edg/' +
    CHROMIUM.split('.')[0] + '.0.0.0';
  const socket = new WebSocket(url, {
    host: 'speech.platform.bing.com',
    origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    headers: {
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'User-Agent': userAgent,
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
    },
  });

  return new Promise((resolve, reject) => {
    const partes = [];
    let finalizado = false;
    const temporizador = setTimeout(
      () => terminar(new Error('El servicio de voz agotó el tiempo de espera.')),
      30000
    );
    const limpiar = () => {
      clearTimeout(temporizador);
      socket.removeAllListeners('message');
      socket.removeAllListeners('open');
      socket.removeAllListeners('error');
      socket.removeAllListeners('close');
    };
    function terminar(error) {
      if (finalizado) return;
      finalizado = true;
      limpiar();
      if (error) {
        try { socket.terminate(); } catch {}
        reject(error);
      } else {
        try { socket.close(); } catch {}
        const audio = Buffer.concat(partes);
        if (!audio.length) reject(new Error('El servicio de voz no devolvió audio.'));
        else resolve(audio);
      }
    }

    socket.on('open', () => {
      try {
        const config = {
          context: { synthesis: { audio: {
            metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          } } },
        };
        socket.send(
          'Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
          JSON.stringify(config)
        );
        const requestId = randomBytes(16).toString('hex');
        const ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ' +
          'xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="' + LANG + '">' +
          '<voice name="' + VOZ + '"><prosody rate="default" pitch="default" volume="default">' +
          escapeXml(texto) + '</prosody></voice></speak>';
        socket.send(
          'X-RequestId:' + requestId +
          '\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n' + ssml
        );
      } catch (error) {
        terminar(error);
      }
    });

    socket.on('message', (raw, isBinary) => {
      const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      if (isBinary) {
        if (data.length < 2) return terminar(new Error('El servicio devolvió un paquete de audio inválido.'));
        const offset = data.readUInt16BE(0) + 2;
        if (offset > data.length) return terminar(new Error('El servicio devolvió un paquete de audio incompleto.'));
        if (offset < data.length) partes.push(data.subarray(offset));
        return;
      }
      const mensaje = data.toString('utf8');
      if (mensaje.includes('Path:turn.end')) return terminar();
      if (mensaje.includes('Path:turn.error')) return terminar(new Error('El servicio de voz rechazó la síntesis.'));
    });

    socket.on('error', terminar);
    socket.on('close', (code) => {
      if (!finalizado) terminar(new Error('Se cerró la conexión del servicio de voz (' + code + ').'));
    });
  });
}

routerVoz.post('/voz', async (req, res, next) => {
  try {
    const texto = String(req.body?.texto || '').trim();
    if (!texto) return res.status(400).json({ ok: false, mensaje: 'No hay texto para leer.' });
    if (texto.length > 900) {
      return res.status(413).json({ ok: false, mensaje: 'El fragmento supera el límite de lectura.' });
    }
    const audio = await sintetizarVozArgentina(texto);
    res.status(200).set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }).send(audio);
  } catch (error) {
    next(error);
  }
});
