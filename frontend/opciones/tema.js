/* Paletas de las demos de IVS CODEX.
   «Negro cálido» es la de siempre: no pisa nada, las páginas se ven como estaban.
   Las otras cuatro cambian sólo las variables de color (el resto de la página las lee).
   Elegir una guarda la preferencia en el navegador y vale para todas las demos;
   también se puede forzar con ?tema=azul en la dirección. */
(function () {
  var T = {
    negro: { n: 'Negro cálido', sw: ['#100e0b', '#f1eee6', '#d9a31b'] },
    azul: { n: 'Azul noche', v: { bg: '#161c27', bgr: '22,28,39', bg2: '#1b2230', s1: '#202838', s2: '#29334a', s3: '#2f3a52', fg: '#ece8dc', fgr: '236,232,220', gold: '#d4a94a', goldr: '212,169,74', ong: '#161c27' } },
    verde: { n: 'Verde bosque', v: { bg: '#14211d', bgr: '20,33,29', bg2: '#192a25', s1: '#1d2f29', s2: '#26403a', s3: '#2d4a43', fg: '#eee9db', fgr: '238,233,219', gold: '#cfae6a', goldr: '207,174,106', ong: '#14211d' } },
    bordo: { n: 'Bordó', v: { bg: '#26151a', bgr: '38,21,26', bg2: '#2d191f', s1: '#35202a', s2: '#432a36', s3: '#4d323f', fg: '#f1e9dc', fgr: '241,233,220', gold: '#dbb470', goldr: '219,180,112', ong: '#26151a' } },
    papel: { n: 'Papel crema', claro: 1, v: { bg: '#f4eee0', bgr: '244,238,224', bg2: '#ece5d3', s1: '#fbf8f0', s2: '#e6dec9', s3: '#ddd3ba', fg: '#1f1b14', fgr: '31,27,20', gold: '#946a06', goldr: '148,106,6', ong: '#f4eee0' } }
  };
  var ORDEN = ['negro', 'azul', 'verde', 'bordo', 'papel'];
  var CLAVE = 'ivs-tema';
  var d = document, raiz = d.documentElement;

  Object.keys(T).forEach(function (k) {
    var v = T[k].v;
    if (v) T[k].sw = [v.bg, v.fg, v.gold];
  });

  function leer() {
    var q = /[?&]tema=([a-z]+)/.exec(location.search);
    if (q && T[q[1]]) return q[1];
    try { var g = localStorage.getItem(CLAVE); if (g && T[g]) return g; } catch (e) {}
    return 'negro';
  }

  var css = '';
  ORDEN.forEach(function (k) {
    var v = T[k].v;
    if (!v) return;
    css += 'html[data-tema="' + k + '"]{' +
      '--bg:' + v.bg + ';--bg-rgb:' + v.bgr + ';--bg2:' + v.bg2 + ';--sup:' + v.s1 + ';--sup2:' + v.s3 + ';' +
      '--fg:' + v.fg + ';--fg-rgb:' + v.fgr + ';--gold:' + v.gold + ';--gold-rgb:' + v.goldr + ';' +
      '--xf1eee6:' + v.fg + ';--x100e0b:' + v.bg + ';--x14110a:' + v.ong + ';' +
      '--x17140f:' + v.s1 + ';--x15120e:' + v.bg2 + ';--x1a1712:' + v.s2 + ';--x1e1a14:' + v.s3 + ';' +
      'color-scheme:' + (T[k].claro ? 'light' : 'dark') + '}';
  });
  css += 'html[data-tema="papel"]{--mute2:#6b675d}' +
    'html[data-tema="papel"] .grano{opacity:.18;filter:invert(1)}' +
    '#tema-sel{position:fixed;z-index:2147483000;bottom:12px;left:12px;display:flex;gap:4px;align-items:center;padding:4px;border-radius:999px;font:500 12px/1 "Instrument Sans",system-ui,sans-serif;background:rgba(128,128,128,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 0 0 1px rgba(128,128,128,.35)}' +
    '#tema-sel button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:999px;color:#fff;mix-blend-mode:normal}' +
    '#tema-sel button i{width:14px;height:14px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px rgba(128,128,128,.55)}' +
    '#tema-sel button span{display:none;white-space:nowrap}' +
    '#tema-sel button[aria-pressed="true"] span{display:inline}' +
    '#tema-sel button[aria-pressed="true"]{background:rgba(0,0,0,.55)}' +
    '#tema-sel button:focus-visible{outline:2px solid #fff;outline-offset:1px}' +
    '';
  var st = d.createElement('style');
  st.id = 'tema-css';
  st.textContent = css;
  (d.head || raiz).appendChild(st);

  function aplicar(k) {
    if (k === 'negro') raiz.removeAttribute('data-tema'); else raiz.setAttribute('data-tema', k);
    var m = d.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', k === 'negro' ? '#100e0b' : T[k].v.bg);
    var bs = d.querySelectorAll('#tema-sel button');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(bs[i].dataset.k === k));
  }

  function elegir(k) {
    try { localStorage.setItem(CLAVE, k); } catch (e) {}
    aplicar(k);
  }

  aplicar(leer());

  window.addEventListener('storage', function (e) { if (e.key === CLAVE && T[e.newValue]) aplicar(e.newValue); });

  if (window.self !== window.top) return;

  function armar() {
    if (d.getElementById('tema-sel')) return;
    var s = d.createElement('div');
    s.id = 'tema-sel';
    s.setAttribute('role', 'group');
    s.setAttribute('aria-label', 'Paleta de colores');
    ORDEN.forEach(function (k) {
      var b = d.createElement('button');
      b.type = 'button';
      b.dataset.k = k;
      b.title = T[k].n;
      b.setAttribute('aria-label', T[k].n);
      b.innerHTML = '<i style="background:linear-gradient(135deg,' + T[k].sw[0] + ' 0 50%,' + T[k].sw[2] + ' 50% 100%)"></i><span>' + T[k].n + '</span>';
      b.addEventListener('click', function () { elegir(k); });
      s.appendChild(b);
    });
    d.body.appendChild(s);
    aplicar(leer());
  }
  if (d.body) armar(); else d.addEventListener('DOMContentLoaded', armar);
})();
