/* Lectura en voz alta del Lector · voz neuronal argentina.
 *
 * La síntesis se hace en el servidor (POST /api/voz), que antes de sintetizar
 * convierte el texto en lo que se diría en voz alta: «c/» → «contra»,
 * «art. 14 inc. b)» → «artículo catorce inciso b», «Ley 24.240» →
 * «ley veinticuatro mil doscientos cuarenta», etc. (backend/lib/vozJuridica.js).
 *
 * Para que la lectura no se corte:
 *  - el primer tramo es corto, así que el audio arranca enseguida;
 *  - mientras suena un tramo ya se piden los dos siguientes;
 *  - los cortes caen al final de una oración y nunca después de una
 *    abreviatura («art.», «Sra.», «Expte.»), que no es el final de nada.
 */
(function () {
  "use strict";

  var lector = {
    texto: "", tramos: [], indice: 0, velocidad: 1,
    estado: "idle", audio: null, url: "", generacion: 0, huellaDocumento: "",
    pedidos: {}, controladores: []
  };
  var MAX_TRAMO = 650;       // el servidor acepta hasta 900 caracteres por pedido
  var TRAMO_INICIAL = 300;   // el primero, corto: es el que hay que esperar
  var ADELANTE = 2;          // cuántos tramos se piden por adelantado

  var ABREVIATURAS = "art|arts|inc|incs|sr|sra|sres|sras|srta|dr|dra|dres|dras|ing|lic|arq|esc|prof|profa|expte|expdte|exp|fs|fol|" +
    "cám|cam|nac|fed|civ|com|crim|corr|trab|cont|adm|fam|pen|lab|inst|nom|circ|sec|secc|juzg|trib|sup|pcia|prov|pcial|dpto|av|arg|" +
    "const|cód|proc|rec|ext|cap|tít|consid|cons|res|disp|dec|dto|ord|ac|pto|ptos|cfr|cf|conf|vgr|ej|op|ob|loc|cit|ib|ibíd|ibid|id|" +
    "ss|sigs|sgtes|sigtes|cc|conc|pág|págs|pp|p|vol|ed|t|ts|ref|aprox|atte|bs|as|gral|pdte|pte|dn|dña|excmo|excma|ilmo|ilma|" +
    "n|nro|núm|num|apel|casac|ejec|inconst|fdo|vta|l|v|vs|s|c|e|hs|apart|párr|dres|mag";
  var TERMINA_EN_ABREVIATURA = new RegExp("(?:^|[\\s(\\[«\"“])(?:" + ABREVIATURAS + ")\\.[)\\]»\"”]*$", "i");
  var TERMINA_EN_INICIAL = /(?:^|[\s(])\p{Lu}\.$/u;

  function apiBase() {
    try {
      var estado = window.IVS && window.IVS.estado ? window.IVS.estado() : null;
      return estado && typeof estado.api === "string" ? estado.api.replace(/\/$/, "") : "";
    } catch (_) { return ""; }
  }

  /* ---------- partir el texto en tramos ---------- */

  function oraciones(limpio) {
    var frases = [];
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      try {
        var segmentador = new Intl.Segmenter("es-AR", { granularity: "sentence" });
        frases = Array.from(segmentador.segment(limpio), function (parte) { return parte.segment; });
      } catch (_) {}
    }
    if (!frases.length) frases = limpio.match(/[^.!?…]+(?:[.!?…]+["»”’)\]]*)?|[.!?…]+/g) || [limpio];

    // El segmentador corta en «art.», «Sra.», «Expte.»…: se vuelve a pegar lo
    // que no es el final de una oración.
    var unidas = [];
    frases.forEach(function (f) {
      var previa = unidas.length ? unidas[unidas.length - 1] : "";
      var previaT = previa.trim();
      var sigue = f.trim().charAt(0);
      var abreviatura = previaT && (TERMINA_EN_ABREVIATURA.test(previaT) || TERMINA_EN_INICIAL.test(previaT));
      var minuscula = previaT && /[.]$/.test(previaT) && /[a-záéíóúñ0-9]/.test(sigue);
      if (previa && (abreviatura || minuscula)) unidas[unidas.length - 1] = previa + f;
      else unidas.push(f);
    });
    return unidas;
  }

  function dividirTexto(texto) {
    var limpio = String(texto || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!limpio) return [];

    var tramos = [], actual = "";
    function cerrar() { if (actual) { tramos.push(actual); actual = ""; } }
    oraciones(limpio).forEach(function (frase) {
      frase = frase.trim();
      while (frase.length > MAX_TRAMO) {
        var corte = frase.lastIndexOf(", ", MAX_TRAMO);
        if (corte < 250) corte = frase.lastIndexOf(" ", MAX_TRAMO);
        if (corte < 250) corte = MAX_TRAMO;
        cerrar();
        var parte = frase.slice(0, corte + 1).trim();
        if (parte) tramos.push(parte);
        frase = frase.slice(corte + 1).trim();
      }
      if (!frase) return;
      var tope = tramos.length === 0 ? TRAMO_INICIAL : MAX_TRAMO;
      if (actual && (actual.length + frase.length + 1) > tope) {
        cerrar();
        actual = frase;
      } else {
        actual = actual ? actual + " " + frase : frase;
      }
      // el primer tramo se cierra apenas tiene cuerpo: que el audio arranque pronto
      if (tramos.length === 0 && actual.length >= 120) cerrar();
    });
    cerrar();
    return tramos;
  }

  /* ---------- estado en pantalla ---------- */

  function estadoTexto(mensaje) {
    var el = document.getElementById("voz-estado");
    if (el && mensaje) el.textContent = mensaje;
  }

  function actualizarControles() {
    var boton = document.querySelector('[data-act="voz-iniciar"]');
    var detener = document.querySelector('[data-act="voz-detener"]');
    var velocidad = document.getElementById("voz-velocidad");
    var etiqueta = document.getElementById("voz-label");
    if (boton) {
      var texto = lector.estado === "speaking" ? "Pausar" :
        (lector.estado === "paused" ? "Continuar" :
          (lector.estado === "loading" ? "Preparando…" : "Escuchar"));
      if (etiqueta && etiqueta.textContent !== texto) etiqueta.textContent = texto;
      boton.setAttribute("aria-label", texto + " lectura del fallo");
      boton.disabled = lector.estado === "loading";
    }
    if (detener) detener.disabled = lector.estado === "idle" || lector.estado === "done";
    if (velocidad) {
      var valor = lector.velocidad.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "×";
      if (velocidad.textContent !== valor) velocidad.textContent = valor;
    }
  }

  /* ---------- audio ---------- */

  function limpiarAudio() {
    if (lector.audio) {
      lector.audio.onended = null;
      lector.audio.onerror = null;
      lector.audio.pause();
      lector.audio.removeAttribute("src");
      lector.audio.load();
      lector.audio = null;
    }
    if (lector.url) {
      URL.revokeObjectURL(lector.url);
      lector.url = "";
    }
  }

  function cancelarActual() {
    lector.generacion++;
    lector.controladores.forEach(function (c) { try { c.abort(); } catch (_) {} });
    lector.controladores = [];
    lector.pedidos = {};
    limpiarAudio();
  }

  function detener(mensaje) {
    cancelarActual();
    lector.estado = "idle";
    lector.indice = 0;
    actualizarControles();
    estadoTexto(mensaje || "Lectura detenida.");
  }

  /** Pide el audio de un tramo (una sola vez) y guarda la promesa. */
  function pedir(i, generacion) {
    if (i >= lector.tramos.length) return null;
    if (lector.pedidos[i]) return lector.pedidos[i];
    var base = apiBase();
    if (!base) return Promise.reject(new Error("sin servidor"));

    function intento(restantes) {
      var controlador = new AbortController();
      lector.controladores.push(controlador);
      return fetch(base + "/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: lector.tramos[i] }),
        signal: controlador.signal
      }).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.blob();
      }).then(function (blob) {
        if (!blob.size) throw new Error("audio vacío");
        return blob;
      }).catch(function (e) {
        if ((e && e.name === "AbortError") || generacion !== lector.generacion || restantes <= 0) throw e;
        return new Promise(function (ok) { setTimeout(ok, 600); }).then(function () { return intento(restantes - 1); });
      });
    }

    var p = intento(2);
    lector.pedidos[i] = p;
    p.catch(function () { if (lector.pedidos[i] === p) delete lector.pedidos[i]; });
    return p;
  }

  function adelantar(generacion) {
    for (var k = 1; k <= ADELANTE; k++) {
      var p = pedir(lector.indice + k, generacion);
      if (p) p.catch(function () {});
    }
  }

  function hablarTramo(generacion) {
    if (generacion !== lector.generacion) return;
    if (lector.indice >= lector.tramos.length) {
      lector.estado = "done";
      limpiarAudio();
      actualizarControles();
      estadoTexto("Lectura terminada.");
      return;
    }
    if (!apiBase()) {
      lector.estado = "error";
      actualizarControles();
      estadoTexto("No se pudo conectar al servidor de IVS CODEX. La voz argentina requiere conexión a internet.");
      return;
    }

    var actual = pedir(lector.indice, generacion);
    // si el audio no estaba listo, se avisa; si ya venía adelantado, ni se nota
    var demora = setTimeout(function () {
      if (generacion !== lector.generacion || lector.estado === "speaking") return;
      lector.estado = "loading";
      actualizarControles();
      estadoTexto("Preparando el audio, tramo " + (lector.indice + 1) + " de " + lector.tramos.length + "…");
    }, 250);
    adelantar(generacion);

    actual.then(function (blob) {
      clearTimeout(demora);
      if (generacion !== lector.generacion) return;
      delete lector.pedidos[lector.indice];

      lector.url = URL.createObjectURL(blob);
      var audio = new Audio(lector.url);
      audio.preload = "auto";
      audio.playbackRate = lector.velocidad;
      if ("preservesPitch" in audio) audio.preservesPitch = true;
      lector.audio = audio;
      audio.onended = function () {
        if (generacion !== lector.generacion) return;
        limpiarAudio();
        lector.indice++;
        hablarTramo(generacion);
      };
      audio.onerror = function () {
        if (generacion !== lector.generacion) return;
        lector.estado = "error";
        limpiarAudio();
        actualizarControles();
        estadoTexto("No se pudo reproducir el audio. Vuelva a tocar Escuchar para reintentar.");
      };

      return audio.play().then(function () {
        if (generacion !== lector.generacion) return;
        lector.estado = "speaking";
        actualizarControles();
        estadoTexto("Leyendo con voz neuronal argentina · tramo " + (lector.indice + 1) + " de " + lector.tramos.length + ".");
      }, function () {
        if (generacion !== lector.generacion) return;
        lector.estado = "paused";
        actualizarControles();
        estadoTexto("El navegador bloqueó el inicio automático. Toque Continuar para reproducir el audio.");
      });
    }).catch(function (error) {
      clearTimeout(demora);
      if (error && error.name === "AbortError") return;
      if (generacion !== lector.generacion) return;
      lector.estado = "error";
      actualizarControles();
      estadoTexto("No se pudo generar la voz argentina. Revise la conexión y vuelva a intentarlo.");
    });
  }

  /* ---------- acciones ---------- */

  function iniciar(texto, huella) {
    var mismoTexto = lector.texto === texto && lector.huellaDocumento === huella;
    if (mismoTexto && lector.estado === "speaking" && lector.audio) {
      lector.audio.pause();
      lector.estado = "paused";
      actualizarControles();
      estadoTexto("Lectura pausada.");
      return;
    }
    if (mismoTexto && lector.estado === "paused" && lector.audio) {
      lector.audio.play().then(function () {
        lector.estado = "speaking";
        actualizarControles();
        estadoTexto("Lectura reanudada.");
      }).catch(function () {
        estadoTexto("No se pudo reanudar el audio. Vuelva a tocar Continuar.");
      });
      return;
    }
    if (mismoTexto && lector.estado === "loading") return;

    cancelarActual();
    if (!mismoTexto || !lector.tramos.length || lector.estado === "done" || lector.estado === "error") {
      lector.texto = texto;
      lector.tramos = dividirTexto(texto);
      lector.indice = 0;
      lector.huellaDocumento = huella;
    }
    if (!lector.tramos.length) {
      actualizarControles();
      estadoTexto("No hay texto disponible para leer.");
      return;
    }
    lector.estado = "loading";
    actualizarControles();
    hablarTramo(lector.generacion);
  }

  function leerDocumento() {
    var doc = document.getElementById("doc");
    var texto = doc ? (doc.textContent || "").trim() : "";
    if (!texto) {
      estadoTexto("No hay un fallo abierto para leer.");
      return;
    }
    iniciar(texto, texto);
  }

  function leerSeleccion() {
    var sel = window.getSelection && window.getSelection();
    var seleccion = sel ? String(sel) : "";
    var doc = document.getElementById("doc");
    if (!seleccion.trim() || !doc || !sel || !sel.rangeCount ||
        !doc.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      estadoTexto("Seleccione primero un fragmento del fallo.");
      return;
    }
    iniciar(seleccion.trim(), doc.textContent || "");
  }

  function cambiarVelocidad(delta) {
    lector.velocidad = Math.max(0.75, Math.min(1.75,
      Math.round((lector.velocidad + delta) * 100) / 100));
    if (lector.audio) lector.audio.playbackRate = lector.velocidad;
    actualizarControles();
    estadoTexto("Velocidad: " + lector.velocidad.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "×.");
  }

  document.addEventListener("click", function (evento) {
    var boton = evento.target && evento.target.closest ? evento.target.closest("[data-act]") : null;
    if (!boton) return;
    var accion = boton.getAttribute("data-act");
    if (["voz-iniciar", "voz-detener", "voz-leer-seleccion", "voz-vel-menos", "voz-vel-mas"].indexOf(accion) < 0) return;
    evento.preventDefault();
    evento.stopPropagation();
    if (accion === "voz-iniciar") leerDocumento();
    else if (accion === "voz-leer-seleccion") leerSeleccion();
    else if (accion === "voz-detener") detener("Lectura detenida.");
    else if (accion === "voz-vel-menos") cambiarVelocidad(-0.25);
    else if (accion === "voz-vel-mas") cambiarVelocidad(0.25);
  }, true);

  var observador = new MutationObserver(function () {
    var barra = document.querySelector(".lector-voz");
    if (!barra) {
      if (["speaking", "paused", "loading"].indexOf(lector.estado) >= 0)
        detener("Lectura detenida al salir del Lector.");
      return;
    }
    var doc = document.getElementById("doc");
    var huella = doc ? (doc.textContent || "") : "";
    if (["speaking", "paused", "loading"].indexOf(lector.estado) >= 0 &&
        lector.huellaDocumento && huella && huella !== lector.huellaDocumento) {
      detener("La lectura se detuvo porque se abrió otro documento.");
      return;
    }
    actualizarControles();
  });

  function observar() {
    if (document.body) observador.observe(document.body, { childList: true, subtree: true });
    actualizarControles();
    estadoTexto("Voz neuronal argentina · requiere internet; el fragmento se envía al servicio de voz para generar el audio.");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observar, { once: true });
  else observar();
  window.addEventListener("beforeunload", cancelarActual);

  // para las pruebas: la partición se puede revisar sin tocar la página
  window.IVSVoz = { dividirTexto: dividirTexto };
})();
