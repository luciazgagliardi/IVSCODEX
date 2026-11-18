/* LECTIO · voz neuronal argentina
 * La síntesis se realiza en el servidor para que no dependa de las voces
 * instaladas en el dispositivo. El fragmento se envía al servicio de voz.
 */
(function () {
  "use strict";

  var lector = {
    texto: "", tramos: [], indice: 0, velocidad: 1,
    estado: "idle", audio: null, url: "", controller: null,
    generacion: 0, huellaDocumento: ""
  };
  var MAX_TRAMO = 650;

  function apiBase() {
    try {
      var estado = window.IVS && window.IVS.estado ? window.IVS.estado() : null;
      return estado && typeof estado.api === "string" ? estado.api.replace(/\/$/, "") : "";
    } catch (_) { return ""; }
  }

  function dividirTexto(texto) {
    var limpio = String(texto || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!limpio) return [];

    var frases = [];
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      try {
        var segmentador = new Intl.Segmenter("es-AR", { granularity: "sentence" });
        frases = Array.from(segmentador.segment(limpio), function (parte) { return parte.segment; });
      } catch (_) {}
    }
    if (!frases.length) frases = limpio.match(/[^.!?…]+(?:[.!?…]+["»”’)\]]*)?|[.!?…]+/g) || [limpio];

    var tramos = [], actual = "";
    frases.forEach(function (frase) {
      frase = frase.trim();
      while (frase.length > MAX_TRAMO) {
        var corte = frase.lastIndexOf(" ", MAX_TRAMO);
        if (corte < 250) corte = MAX_TRAMO;
        var parte = frase.slice(0, corte).trim();
        if (actual) { tramos.push(actual); actual = ""; }
        if (parte) tramos.push(parte);
        frase = frase.slice(corte).trim();
      }
      if (!frase) return;
      if (actual && (actual.length + frase.length + 1) > MAX_TRAMO) {
        tramos.push(actual);
        actual = frase;
      } else {
        actual = actual ? actual + " " + frase : frase;
      }
    });
    if (actual) tramos.push(actual);
    return tramos;
  }

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
    if (lector.controller) {
      lector.controller.abort();
      lector.controller = null;
    }
    limpiarAudio();
  }

  function detener(mensaje) {
    cancelarActual();
    lector.estado = "idle";
    lector.indice = 0;
    actualizarControles();
    estadoTexto(mensaje || "Lectura detenida.");
  }

  async function hablarTramo(generacion) {
    if (generacion !== lector.generacion) return;
    if (lector.indice >= lector.tramos.length) {
      lector.estado = "done";
      limpiarAudio();
      lector.controller = null;
      actualizarControles();
      estadoTexto("Lectura terminada.");
      return;
    }

    var base = apiBase();
    if (!base) {
      lector.estado = "error";
      actualizarControles();
      estadoTexto("No se pudo conectar al servidor de IVS CODEX. La voz argentina requiere conexión a internet.");
      return;
    }

    lector.estado = "loading";
    actualizarControles();
    estadoTexto("Preparando audio argentino, tramo " + (lector.indice + 1) + " de " + lector.tramos.length + "…");
    var controlador = new AbortController();
    lector.controller = controlador;

    try {
      var respuesta = await fetch(base + "/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: lector.tramos[lector.indice] }),
        signal: controlador.signal
      });
      if (!respuesta.ok) throw new Error("No se pudo generar el audio.");
      var blob = await respuesta.blob();
      if (generacion !== lector.generacion) return;
      if (!blob.size) throw new Error("El servicio devolvió un audio vacío.");

      lector.url = URL.createObjectURL(blob);
      var audio = new Audio(lector.url);
      audio.preload = "auto";
      audio.playbackRate = lector.velocidad;
      lector.audio = audio;
      lector.controller = null;
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
        estadoTexto("No se pudo reproducir el audio. Volvé a tocar Escuchar para reintentar.");
      };

      try {
        await audio.play();
        if (generacion !== lector.generacion) return;
        lector.estado = "speaking";
        actualizarControles();
        estadoTexto("Leyendo con voz neuronal argentina · tramo " + (lector.indice + 1) + " de " + lector.tramos.length + ".");
      } catch (_) {
        if (generacion !== lector.generacion) return;
        lector.estado = "paused";
        actualizarControles();
        estadoTexto("El navegador bloqueó el inicio automático. Tocá Continuar para reproducir el audio.");
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      if (generacion !== lector.generacion) return;
      lector.controller = null;
      lector.estado = "error";
      actualizarControles();
      estadoTexto("No se pudo generar la voz argentina. Revisá la conexión y volvé a intentarlo.");
    }
  }

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
        estadoTexto("No se pudo reanudar el audio. Volvé a tocar Continuar.");
      });
      return;
    }
    if (mismoTexto && lector.estado === "loading") return;

    if (!mismoTexto || !lector.tramos.length || lector.estado === "done" || lector.estado === "error") {
      cancelarActual();
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
    cancelarActual();
    var generacion = lector.generacion;
    hablarTramo(generacion);
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
    var seleccion = window.getSelection ? String(window.getSelection()) : "";
    var doc = document.getElementById("doc");
    var sel = window.getSelection && window.getSelection();
    if (!seleccion.trim() || !doc || !sel || !sel.rangeCount ||
        !doc.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      estadoTexto("Seleccioná primero un fragmento del fallo.");
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
})();
