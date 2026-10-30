/* Paletas completas de IVS CODEX, sin degradé: un negro teñido de base, un escalón más claro para los paneles,
   el color del texto (que también tiñe los títulos) y un acento. Se aplican sobre la portada y la aplicación reales
   sin tocar sus archivos: css() arma la hoja que se inyecta.
   Las cálidas van hacia el vino, el rojo y el coral: sin marrón ni amarillo. */
window.IVSPaletas = (function () {
  var PAL = [
    { id: 'actual', grupo: 'actual', nombre: 'Actual', bg: '#100e0b', panel: '#15120e', fg: '#f1eee6', acento: '#d9a31b', flat: false,
      nota: 'Para comparar: negro cálido con degradé terracota, carmesí y oro.' },
    { id: 'pizarra', grupo: 'tuyas', nombre: 'Pizarra y oro', bg: '#1c1f24', panel: '#262b33', fg: '#f2eee5', mute: '#9aa2af', acento: '#c49c5f', flat: true,
      nota: 'De tu segunda imagen: carbón azulado, gris pizarra, crema y oro apagado. El oro queda sobre un fondo frío, sin marrón alrededor.' },
    { id: 'arena', grupo: 'tuyas', nombre: 'Azul pizarra y arena', bg: '#1e252d', panel: '#29313b', fg: '#e6e9eb', acento: '#bd995c', flat: true,
      nota: 'De tu primera imagen: azul pizarra oscuro, texto gris azulado claro y el oro arena como acento. Más azul y más suave que la anterior.' },
    { id: 'marino-oro', grupo: 'tuyas', nombre: 'Marino y oro', bg: '#0c1117', panel: '#132230', fg: '#dadada', mute: '#b9b7b8', acento: '#bf8f1f', flat: true,
      nota: 'De tu tercera imagen: negro marino, grises neutros y un oro más profundo. La más oscura y la más seria.' },
    { id: 'ladrillo', grupo: 'tuyas', nombre: 'Ladrillo y rosado', bg: '#1f1311', panel: '#2b1b18', fg: '#f1e6e1', acento: '#d08b7a', flat: true,
      nota: 'De la primera señalada: el rosado beige para el texto y el ladrillo aclarado para el acento, sobre un fondo de ladrillo muy oscuro. La más cálida de las seis.' },
    { id: 'salvia', grupo: 'tuyas', nombre: 'Salvia y crema', bg: '#181d1b', panel: '#212825', fg: '#e2e0cc', acento: '#a3b3a9', flat: true,
      nota: 'De la segunda señalada: crema verdosa para el texto y gris salvia como acento, sobre un negro verdoso. Calma y poco contraste entre el texto y el acento.' },
    { id: 'marino-ambar', grupo: 'tuyas', nombre: 'Marino y ámbar', bg: '#1a2030', panel: '#232a3d', fg: '#f1efea', acento: '#f0b430', flat: true,
      nota: 'De la tercera señalada: azul marino con ámbar vivo. El acento más fuerte de todos; con el marino se separa del fondo.' },
    { id: 'tinta', grupo: 'fria', nombre: 'Tinta', bg: '#0b0e15', panel: '#121722', fg: '#e8ecf4', acento: '#9bb4f2', flat: true,
      nota: 'Negro azulado, texto blanco frío y un azul pervinca apagado de acento (menos saturado, para que no encandile sobre el negro).' },
    { id: 'abismo', grupo: 'fria', nombre: 'Abismo', bg: '#0a1112', panel: '#101a1b', fg: '#e6efee', acento: '#86cfc4', flat: true,
      nota: 'Negro verdoso azulado con acento agua. Más calmo que el azul.' },
    { id: 'grafito', grupo: 'fria', nombre: 'Grafito', bg: '#0d0e10', panel: '#141518', fg: '#eceef1', acento: '#c3c9d4', flat: true,
      nota: 'Casi sin tinte, con acento plata. El más sobrio y el que menos compite con el contenido.' },
    { id: 'vino', grupo: 'calida', nombre: 'Vino', bg: '#1a0a11', panel: '#251320', fg: '#f4eaec', acento: '#e9a2b0', flat: true,
      nota: 'Negro de fondo de vino (rojo, no marrón), texto rosado muy claro y acento rosa empolvado.' },
    { id: 'coral', grupo: 'calida', nombre: 'Coral', bg: '#0f0d0d', panel: '#171414', fg: '#f3eeec', acento: '#f2806c', flat: true,
      nota: 'Carbón con un velo rojizo y acento coral: un solo toque cálido y vivo sobre un fondo casi neutro.' },
    { id: 'durazno', grupo: 'calida', nombre: 'Burdeos y durazno', bg: '#150a0e', panel: '#1e1116', fg: '#f5ece9', acento: '#f1b3a0', flat: true,
      nota: 'Negro bordó con acento durazno: más suave y luminoso que el coral.' }
  ];

  function rgbDe(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lista(h) { return rgbDe(h).join(','); }
  function mezcla(a, b, t) { return a.map(function (v, i) { return Math.round(v * t + b[i] * (1 - t)); }); }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function lum(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function contraste(h1, h2) { var a = lum(rgbDe(h1)), b = lum(rgbDe(h2)); if (a < b) { var t = a; a = b; b = t; } return (a + 0.05) / (b + 0.05); }

  /* La hoja de estilo de una paleta. Pisa las mismas variables que usan las paletas del interruptor del sitio. */
  function css(id) {
    var p = PAL.filter(function (x) { return x.id === id; })[0] || PAL[0];
    if (p.id === 'actual') return '';
    var B = rgbDe(p.bg), F = rgbDe(p.fg);
    var tx = F.join(','), humo = hex(mezcla(F, B, 0.55)), ov = B.map(function (v) { return Math.round(v * 0.5); }).join(',');
    return ':root:root,html[data-tema]{' +
      '--bg:' + p.bg + ';--bg-rgb:' + B.join(',') + ';--ov-rgb:' + ov + ';--panel:' + p.panel + ';' +
      '--fg:' + p.fg + ';--tx:' + tx + ';--humo:' + humo + ';' +
      '--mute:' + (p.mute || 'rgba(' + tx + ',.62)') + ';--dim:rgba(' + tx + ',.36);--line:rgba(' + tx + ',.15);' +
      '--gold:' + p.acento + ';--gold-rgb:' + lista(p.acento) + '}' +
      'html{background:' + p.bg + '!important}body{background:transparent!important}' +
      '.luces{display:none!important}';
  }

  return { PAL: PAL, css: css, contraste: contraste };
})();
