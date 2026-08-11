/* ============================================================
   Juris et de jure — frontend del extractor
   Sin dependencias. Todo el resaltado corre en tu navegador.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 0. Blindaje ---------- */
  function panic(msg) {
    try {
      var p = document.getElementById('panic');
      p.style.display = 'block';
      p.textContent = 'Se rompió algo en la interfaz (' + String(msg).slice(0, 100) + '). Recargá la página.';
    } catch (e) { /* ni eso funcionó */ }
  }
  window.onerror = function (m) { panic(m); return true; };

  /* ---------- 1. Estado ---------- */
  var estado = {
    q: '',
    modo: 'exacta',
    parcial: true,
    texto: '',
    titulo: '',
    urlFinal: '',
    info: null,
    marca: 0,
    pasajes: [],
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 2. Utilidades ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var relojFlash;
  function flash(msg) {
    var f = $('flash');
    f.textContent = msg;
    f.style.display = 'block';
    clearTimeout(relojFlash);
    relojFlash = setTimeout(function () { f.style.display = 'none'; }, 2800);
  }

  function copiar(txt) {
    if (!txt) { flash('No hay nada para copiar'); return; }
    var ok = function () { flash('Copiado'); };
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(ok, function () { copiarViejo(txt, ok); });
    } else {
      copiarViejo(txt, ok);
    }
  }
  function copiarViejo(txt, ok) {
    try {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var hecho = document.execCommand('copy');
      document.body.removeChild(ta);
      hecho ? ok() : flash('Tu navegador no dejó copiar. Seleccioná el texto a mano.');
    } catch (e) {
      flash('Tu navegador no dejó copiar. Seleccioná el texto a mano.');
    }
  }

  function palabras(s) {
    return String(s || '').trim().split(/\s+/).filter(function (w) { return w.length > 0; });
  }

  function hoy() {
    var f = new Date();
    return ('0' + f.getDate()).slice(-2) + '/' + ('0' + (f.getMonth() + 1)).slice(-2) + '/' + f.getFullYear();
  }

  /* ---------- 3. Motor de búsqueda dentro del texto ---------- */

  /* Pliega el texto (minúsculas, sin acentos) guardando el mapa de
     posiciones hacia el original. Así "dano moral" encuentra "DAÑO MORAL"
     y el resaltado cae en el lugar exacto. */
  function plegar(t) {
    var s = '', map = [], i, j, c, n;
    for (i = 0; i < t.length; i++) {
      c = t.charAt(i);
      try { n = c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { n = c; }
      n = n.toLowerCase();
      for (j = 0; j < n.length; j++) { s += n.charAt(j); map.push(i); }
    }
    map.push(t.length);
    return { s: s, map: map };
  }

  function terminos() {
    var q = String(estado.q || '').trim();
    if (!q) return [];
    if (estado.modo === 'exacta') return [q];
    return palabras(q);
  }

  var LETRA = /[a-z0-9]/;
  var TOPE_MARCAS = 1500;

  function coincidencias(texto) {
    var ts = terminos();
    if (!texto || !ts.length) return [];
    var P = plegar(texto), bruto = [], k, pt, desde, idx, fin, okA, okB;
    for (k = 0; k < ts.length; k++) {
      pt = plegar(ts[k]).s.trim();
      if (!pt) continue;
      desde = 0;
      while (bruto.length < 6000) {
        idx = P.s.indexOf(pt, desde);
        if (idx < 0) break;
        fin = idx + pt.length;
        okA = estado.parcial || idx === 0 || !LETRA.test(P.s.charAt(idx - 1));
        okB = estado.parcial || fin >= P.s.length || !LETRA.test(P.s.charAt(fin));
        if (okA && okB) bruto.push({ a: P.map[idx], b: P.map[fin] });
        desde = idx + 1;
      }
    }
    bruto.sort(function (x, y) { return x.a - y.a || x.b - y.b; });
    var out = [];
    for (k = 0; k < bruto.length; k++) {
      if (out.length && bruto[k].a <= out[out.length - 1].b) {
        if (bruto[k].b > out[out.length - 1].b) out[out.length - 1].b = bruto[k].b;
      } else {
        out.push({ a: bruto[k].a, b: bruto[k].b });
      }
    }
    return out;
  }

  function textoResaltado(texto, cs) {
    var h = '', pos = 0, i, n = Math.min(cs.length, TOPE_MARCAS);
    for (i = 0; i < n; i++) {
      h += esc(texto.slice(pos, cs[i].a));
      h += '<mark data-m="' + i + '"' + (i === estado.marca ? ' class="actual"' : '') + '>' +
           esc(texto.slice(cs[i].a, cs[i].b)) + '</mark>';
      pos = cs[i].b;
    }
    h += esc(texto.slice(pos));
    return h;
  }

  function pasajesDe(texto, cs) {
    var grupos = [], i;
    for (i = 0; i < cs.length; i++) {
      if (grupos.length && cs[i].a - grupos[grupos.length - 1].b < 170) {
        grupos[grupos.length - 1].b = cs[i].b;
      } else {
        grupos.push({ a: cs[i].a, b: cs[i].b });
      }
      if (grupos.length >= 120) break;
    }
    return grupos.map(function (g) {
      var ini = Math.max(0, g.a - 210), fin = Math.min(texto.length, g.b + 210);
      var e1 = texto.indexOf(' ', ini); if (ini > 0 && e1 >= 0 && e1 < g.a) ini = e1 + 1;
      var e2 = texto.lastIndexOf(' ', fin); if (fin < texto.length && e2 > g.b) fin = e2;
      var rel = texto.slice(ini, fin);
      var dentro = cs.filter(function (c) { return c.a >= ini && c.b <= fin; });
      var h = '', pos = 0;
      dentro.forEach(function (c) {
        h += esc(rel.slice(pos, c.a - ini)) + '<mark>' + esc(rel.slice(c.a - ini, c.b - ini)) + '</mark>';
        pos = c.b - ini;
      });
      h += esc(rel.slice(pos));
      var plano = rel.replace(/\s+/g, ' ').trim();
      return {
        ini: ini,
        html: (ini > 0 ? '… ' : '') + h.replace(/\n+/g, ' ') + (fin < texto.length ? ' …' : ''),
        txt: (ini > 0 ? '… ' : '') + plano + (fin < texto.length ? ' …' : ''),
      };
    });
  }

  /* ---------- 4. Datos de la sentencia ---------- */

  var MESES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };
  function sinAcentos(s) {
    try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { return s; }
  }

  function detectar(texto) {
    var t = texto.slice(0, 9000), d = {}, m;

    m = t.match(/["“']?\s*([A-ZÁÉÍÓÚÑ][^"“”\n]{4,120}?\s+c\/\s+[^"“”\n]{2,120}?\s+(?:s\/|p\/)\s+[^"“”\n]{2,90}?)\s*["”']?(?:\n|\.|$)/);
    if (m) d.car = m[1].replace(/\s+/g, ' ').trim();

    m = t.match(/Fallos:?\s*(\d{2,3})\s*:\s*(\d{1,4})/i);
    if (m) { d.tomo = m[1]; d.pag = m[2]; }

    m = t.match(/(?:expte\.?|expediente|causa)\s*(?:n[°ºo.]?\s*)?[:\s]\s*([A-Z0-9][\w\-\/.]{3,28})/i);
    if (m) d.exp = m[1].replace(/[.,;]$/, '');

    m = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
    if (m && MESES[sinAcentos(m[2].toLowerCase())]) {
      var mes = MESES[sinAcentos(m[2].toLowerCase())];
      d.fecha = ('0' + m[1]).slice(-2) + '/' + ('0' + mes).slice(-2) + '/' + m[3];
    } else {
      m = t.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
      if (m) d.fecha = ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3];
    }

    if (/corte\s+suprema\s+de\s+justicia\s+de\s+la\s+naci/i.test(t)) {
      d.trib = 'Corte Suprema de Justicia de la Nación'; d.tipo = 'csjn';
    } else if (/suprema\s+corte\s+de\s+justicia.{0,40}mendoza|\bS\.?C\.?J\.?M\b/i.test(t)) {
      d.trib = 'Suprema Corte de Justicia de Mendoza'; d.tipo = 'scjm';
    } else if (/corte\s+interamericana/i.test(t)) {
      d.trib = 'Corte Interamericana de Derechos Humanos'; d.tipo = 'cidh';
    } else if (/tribunal\s+europeo|european\s+court\s+of\s+human\s+rights/i.test(t)) {
      d.trib = 'Tribunal Europeo de Derechos Humanos'; d.tipo = 'tedh';
    } else {
      m = t.match(/((?:Excma\.?\s+)?(?:C[áa]mara|Juzgado|Tribunal)[^\n.;]{5,90})/i);
      if (m) { d.trib = m[1].replace(/\s+/g, ' ').trim(); d.tipo = 'cam'; }
    }

    m = t.match(/Sala\s+([IVXLC]+|\d+|[ÚU]nica|Primera|Segunda|Tercera|Cuarta)\b/i);
    if (m) d.sala = 'Sala ' + m[1];

    function unicos(re, tope) {
      var vistos = {}, lista = texto.match(re) || [];
      lista.forEach(function (a) { vistos[a.replace(/\s+/g, ' ').toLowerCase()] = 1; });
      return Object.keys(vistos).slice(0, tope);
    }
    d.arts = unicos(/\bart(?:s)?\.?\s*\d{1,4}(?:\s*(?:bis|ter|qu[áa]ter))?/gi, 14);
    d.leyes = unicos(/\bley(?:es)?\s*(?:n[°ºo.]?\s*)?[\d][\d.]{2,7}/gi, 14);
    d.citados = unicos(/Fallos:?\s*\d{2,3}\s*:\s*\d{1,4}/gi, 20);
    return d;
  }

  function formatoCita(tipo, c) {
    var C = c.car ? '"' + c.car + '"' : '"[carátula]"';
    if (tipo === 'csjn') return 'CSJN, ' + C + (c.fecha ? ', sent. del ' + c.fecha : '') + (c.tomo && c.pag ? ', Fallos: ' + c.tomo + ':' + c.pag : '') + '.';
    if (tipo === 'scjm') return 'SCJM' + (c.trib ? ', ' + c.trib : '') + ', ' + C + (c.exp ? ', expte. n.º ' + c.exp : '') + (c.fecha ? ', sent. del ' + c.fecha : '') + '.';
    if (tipo === 'cidh') return 'Corte IDH, Caso ' + (c.car || '[caso]') + (c.fecha ? '. Sentencia de ' + c.fecha : '') + (c.tomo ? '. Serie ' + c.tomo : '') + (c.pag ? ' n.º ' + c.pag : '') + '.';
    if (tipo === 'tedh') return 'TEDH, ' + C + (c.pag ? ', n.º ' + c.pag : '') + (c.fecha ? ', sentencia de ' + c.fecha : '') + '.';
    return (c.trib || '[tribunal]') + ', ' + C + (c.exp ? ', expte. n.º ' + c.exp : '') + (c.fecha ? ', sent. del ' + c.fecha : '') + '.';
  }

  function citaDelDoc() {
    var d = detectar(estado.texto || '');
    return formatoCita(d.tipo || 'cam', {
      car: d.car, trib: d.tipo === 'scjm' ? (d.sala || '') : (d.trib || ''),
      fecha: d.fecha, tomo: d.tomo, pag: d.pag, exp: d.exp,
    });
  }

  /* ---------- 5. Llamada a la API ---------- */

  /* Si servís el frontend desde el mismo Express, la ruta relativa alcanza.
     Si lo abrís con Live Server en el 5500, apuntá acá al backend.
     Si esto se publicó solo (p. ej. GitHub Pages, sin backend en el mismo
     origen), no hay '/api' que valga: apuntá al backend ya desplegado. */
  var BACKEND_DESPLEGADO = 'https://TU-BACKEND-DESPLEGADO.example.com/api'; // TODO: reemplazar tras desplegar backend/
  var backendConfigurado = BACKEND_DESPLEGADO.indexOf('TU-BACKEND') === -1;
  var API = (location.protocol === 'file:' || location.port === '5500')
    ? 'http://localhost:3000/api'
    : location.hostname.endsWith('github.io')
      ? BACKEND_DESPLEGADO
      : '/api';

  function mostrarError(codigo, mensaje) {
    var ayudas = {
      DOMINIO_NO_PERMITIDO: 'Abrí server/config.js, sumá el dominio a DOMINIOS_PERMITIDOS y reiniciá el servidor con Ctrl+C y npm start.',
      PDF_ESCANEADO: 'Ese PDF es una imagen del papel. Descargalo, pasalo por un OCR (por ejemplo el de Acrobat o ocrmypdf) y volvé a intentar.',
      HTML_SIN_TEXTO: 'Suele pasar cuando el fallo está dentro de un frame o se arma con JavaScript. Abrí el enlace en el navegador, copiá el texto y pegalo a mano.',
      RESPUESTA_NO_OK: 'Fijate que el enlace sea el del documento y no el del formulario de búsqueda: muchos buscadores judiciales no exponen el fallo en una URL fija.',
      TIEMPO_AGOTADO: 'Los sitios judiciales se ponen lentos en horario de tribunales. Probá más tarde.',
      DEMASIADAS_PETICIONES: 'El límite es a propósito, para no castigar servidores públicos.',
      RED_PRIVADA: 'El servidor bloquea direcciones internas por seguridad. Es correcto que pase esto.',
    };
    $('error-msg').textContent = mensaje || 'Error desconocido.';
    $('error-ayuda').textContent = ayudas[codigo] || '';
    $('error').hidden = false;
  }

  async function procesar(refrescar) {
    var url = $('url').value.trim();
    if (!url) { flash('Pegá el enlace del fallo'); $('url').focus(); return; }

    if (location.hostname.endsWith('github.io') && !backendConfigurado) {
      mostrarError(
        'SIN_BACKEND',
        'Esta página está publicada sin un backend conectado todavía. Quien la administra tiene que desplegar backend/ y reemplazar el placeholder de la URL en script.js.'
      );
      return;
    }

    $('error').hidden = true;
    $('resultado').hidden = true;
    $('cargando').hidden = false;
    $('cargando-txt').textContent = 'Descargando el documento…';
    $('btn-procesar').disabled = true;
    $('btn-refrescar').disabled = true;

    var reloj = setTimeout(function () {
      $('cargando-txt').textContent = 'Sigue descargando… los sitios oficiales a veces tardan.';
    }, 6000);

    try {
      var r = await fetch(API + '/extraer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, refrescar: !!refrescar }),
      });
      var data = await r.json();

      if (!r.ok || !data.ok) {
        mostrarError(data.codigo, data.mensaje);
        return;
      }

      estado.texto = data.texto;
      estado.titulo = data.titulo || '';
      estado.urlFinal = data.urlFinal || url;
      estado.info = data;
      estado.marca = 0;
      $('resultado').hidden = false;
      $('form-panel').hidden = true;
      pintar();
      flash(data.desdeCache
        ? 'Traído del caché'
        : 'Listo: ' + data.palabras.toLocaleString('es-AR') + ' palabras en ' + (data.ms / 1000).toFixed(1) + ' s');
      window.scrollTo(0, 0);
    } catch (e) {
      mostrarError(
        'SIN_SERVIDOR',
        'No pude hablar con el servidor. ¿Está corriendo? En la terminal del proyecto tiene que decir "Interfaz http://localhost:3000".'
      );
    } finally {
      clearTimeout(reloj);
      $('cargando').hidden = true;
      $('btn-procesar').disabled = false;
      $('btn-refrescar').disabled = false;
    }
  }

  /* ---------- 6. Pintado ---------- */

  function pintarCadena() {
    var el = $('cadena');
    if (!estado.texto) { el.textContent = 'Pegá un enlace para empezar'; return; }
    var partes = [];
    if (estado.q) partes.push('<b>' + esc(estado.q) + '</b>');
    if (estado.titulo) partes.push(esc(estado.titulo.slice(0, 70)));
    if (estado.info) {
      partes.push(esc(estado.info.tipo.toUpperCase()));
      partes.push(estado.info.palabras.toLocaleString('es-AR') + ' palabras');
    }
    el.innerHTML = partes.join(' · ');
  }

  function conteo(cs) {
    var el = $('doc-cnt');
    if (!cs.length) {
      el.innerHTML = estado.q
        ? 'Sin coincidencias para <b>' + esc(estado.q) + '</b>'
        : 'Escribí arriba para resaltar dentro del fallo';
      return;
    }
    var vis = Math.min(cs.length, TOPE_MARCAS);
    el.innerHTML = '<b>' + cs.length + '</b> coincidencia' + (cs.length === 1 ? '' : 's') +
      (cs.length > TOPE_MARCAS ? ' (se marcan las primeras ' + TOPE_MARCAS + ')' : '') +
      ' · ' + (estado.marca + 1) + ' de ' + vis;
  }

  function irAMarca(mover) {
    try {
      var ms = $('doc').querySelectorAll('mark');
      if (!ms.length) return;
      var i = Math.max(0, Math.min(estado.marca, ms.length - 1));
      for (var k = 0; k < ms.length; k++) ms[k].className = (k === i ? 'actual' : '');
      if (mover && ms[i].scrollIntoView) ms[i].scrollIntoView({ block: 'center' });
    } catch (e) { /* si no se puede desplazar, no importa */ }
  }

  function pintar() {
    if (!estado.texto) return;
    var cs = coincidencias(estado.texto);
    if (estado.marca >= cs.length) estado.marca = 0;

    conteo(cs);
    pintarCadena();

    var origen = $('link-origen');
    origen.href = estado.urlFinal || '#';
    origen.textContent = estado.info && estado.info.tipo === 'pdf' ? 'Abrir el PDF' : 'Abrir la fuente';

    // Metadatos
    var d = detectar(estado.texto), items = [];
    if (estado.titulo) items.push(['Título del documento', estado.titulo]);
    if (d.car) items.push(['Carátula detectada', d.car]);
    if (d.trib) items.push(['Tribunal', d.trib + (d.sala ? ' · ' + d.sala : '')]);
    if (d.fecha) items.push(['Fecha', d.fecha]);
    if (d.exp) items.push(['Expediente', d.exp]);
    if (d.tomo && d.pag) items.push(['Colección', 'Fallos: ' + d.tomo + ':' + d.pag]);
    if (estado.info) {
      items.push(['Origen', estado.info.tipo.toUpperCase() +
        (estado.info.paginas ? ' · ' + estado.info.paginas + ' pág.' : '') +
        ' · ' + estado.info.caracteres.toLocaleString('es-AR') + ' caracteres' +
        (estado.info.desdeCache ? ' · desde caché' : '')]);
    }
    if (d.leyes && d.leyes.length) items.push(['Leyes citadas', d.leyes.join(' · ')]);
    if (d.arts && d.arts.length) items.push(['Artículos citados', d.arts.join(' · ')]);
    if (d.citados && d.citados.length) items.push(['Fallos citados', d.citados.join(' · ')]);

    $('doc-meta').innerHTML = items.map(function (x) {
      return '<div class="meta-i"><b>' + esc(x[0]) + '</b>' + esc(x[1]) + '</div>';
    }).join('') +
      '<div style="flex-basis:100%;height:0"></div>' +
      '<button type="button" class="mini" data-act="copiar-cita">Copiar la cita</button>';

    $('doc').innerHTML = textoResaltado(estado.texto, cs);

    // Pasajes
    var cont = $('pasajes'), tit = $('tit-pasajes');
    if (!cs.length) {
      tit.textContent = 'Pasajes';
      cont.innerHTML = '<div class="vacio">' + (estado.q
        ? 'Tu búsqueda no aparece en este documento. Probá con menos palabras o cambiá el modo a «Alguna palabra».'
        : 'Escribí arriba qué resaltar y los pasajes aparecen acá.') + '</div>';
      cont._ps = [];
    } else {
      var ps = pasajesDe(estado.texto, cs);
      tit.textContent = ps.length + ' pasaje' + (ps.length === 1 ? '' : 's') + ' con contexto';
      cont.innerHTML = ps.map(function (p, i) {
        return '<div class="pasaje"><div class="txt">' + p.html + '</div><div class="acc">' +
          '<button type="button" class="mini" data-act="pas-cita" data-i="' + i + '">Copiar con la cita</button>' +
          '<button type="button" class="mini" data-act="pas-copiar" data-i="' + i + '">Copiar el pasaje</button>' +
          '<span class="pos">carácter ' + p.ini + '</span></div></div>';
      }).join('');
      cont._ps = ps;
    }
    irAMarca(false);
  }

  /* ---------- 7. Eventos ---------- */

  $('btn-procesar').addEventListener('click', function () { procesar(false); });
  $('btn-refrescar').addEventListener('click', function () { procesar(true); });

  $('url').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); procesar(false); }
  });

  $('q').addEventListener('input', function (e) {
    estado.q = e.target.value;
    estado.marca = 0;
    if (estado.texto) pintar(); else pintarCadena();
  });
  $('q').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('btn-sig').click(); }
  });

  $('modos').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'chip-parcial') {
      estado.parcial = !estado.parcial;
      b.setAttribute('aria-pressed', estado.parcial ? 'true' : 'false');
    } else if (b.dataset.modo) {
      estado.modo = b.dataset.modo;
      Array.prototype.forEach.call($('modos').querySelectorAll('[data-modo]'), function (x) {
        x.setAttribute('aria-pressed', x.dataset.modo === estado.modo ? 'true' : 'false');
      });
    }
    estado.marca = 0;
    if (estado.texto) pintar();
  });

  function saltar(paso) {
    var total = Math.min(coincidencias(estado.texto).length, TOPE_MARCAS);
    if (!total) { flash('No hay coincidencias'); return; }
    estado.marca = (estado.marca + paso + total) % total;
    irAMarca(true);
    conteo(coincidencias(estado.texto));
  }
  $('btn-sig').addEventListener('click', function () { saltar(1); });
  $('btn-ant').addEventListener('click', function () { saltar(-1); });

  $('btn-copiar-todo').addEventListener('click', function () { copiar(estado.texto); });

  $('btn-nuevo').addEventListener('click', function () {
    estado.texto = ''; estado.info = null; estado.marca = 0; estado.titulo = '';
    $('resultado').hidden = true;
    $('error').hidden = true;
    $('form-panel').hidden = false;
    $('url').value = '';
    $('url').focus();
    pintarCadena();
    window.scrollTo(0, 0);
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act;

    if (act === 'copiar-cita') { copiar(citaDelDoc()); return; }

    if (act === 'pas-copiar' || act === 'pas-cita') {
      var ps = $('pasajes')._ps || [];
      var p = ps[Number(b.dataset.i)];
      if (!p) { flash('No pude recuperar ese pasaje'); return; }
      if (act === 'pas-copiar') { copiar(p.txt); return; }
      copiar(citaDelDoc() + '\n«' + p.txt + '»\n(consultado el ' + hoy() +
        (estado.urlFinal ? ' en ' + estado.urlFinal : '') + ')');
    }
  });

  $('ver-dominios').addEventListener('click', async function (e) {
    e.preventDefault();
    var panel = $('panel-dominios');
    if (!panel.hidden) { panel.hidden = true; return; }
    try {
      var r = await fetch(API + '/dominios');
      var d = await r.json();
      $('tit-dominios').textContent = d.modoAbierto
        ? 'Modo abierto: se acepta cualquier dominio público'
        : d.dominios.length + ' fuentes habilitadas';
      $('lista-dominios').innerHTML = d.dominios
        .map(function (x) { return '<span class="voz">' + esc(x) + '</span>'; }).join('');
      panel.hidden = false;
    } catch (err) {
      flash('No pude leer la lista: el servidor no responde');
    }
  });

  /* ---------- 8. Arranque ---------- */

  (async function salud() {
    try {
      var r = await fetch(API + '/salud');
      var d = await r.json();
      $('punto').className = 'punto ok';
      $('estado-txt').textContent = 'Servidor activo · ' + d.dominiosPermitidos + ' fuentes';
    } catch (e) {
      $('punto').className = 'punto mal';
      $('estado-txt').textContent = 'Servidor apagado';
    }
  })();

  pintarCadena();
  $('url').focus();
})();
