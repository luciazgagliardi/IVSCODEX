/* LECTIO · lectura en voz alta
 * Usa la síntesis de voz del navegador. El texto del fallo no se envía a
 * ningún servicio externo: SpeechSynthesis trabaja desde esta página.
 */
(function () {
  "use strict";

  var sintesis = window.speechSynthesis || null;
  var Utterance = window.SpeechSynthesisUtterance || null;
  var lector = {
    texto: "",
    tramos: [],
    indice: 0,
    velocidad: 1,
    vozURI: "",
    vozIndice: -1,
    estado: "idle",
    utterance: null,
    generacion: 0,
    huellaDocumento: ""
  };

  function vocesEspanol() {
    if (!sintesis || !sintesis.getVoices) return [];
    return sintesis.getVoices().filter(function (voz) {
      var idioma = (voz.lang || "").toLowerCase();
      return /^es(?:-|$)/i.test(idioma) && idioma !== "es-us";
    }).sort(function (a, b) {
      function rango(v) {
        var lang = (v.lang || "").toLowerCase();
        if (lang === "es-ar") return 0;
        if (lang === "es-419") return 1;
        if (lang === "es-mx") return 2;
        if (/^es-(cl|co|uy|pe|bo|py|ve|ec|cr|gt|hn|ni|pa|do|pr)$/i.test(lang)) return 3;
        if (lang === "es-es") return 4;
        if (lang === "es") return 5;
        if (lang === "es-us") return 6;
        return 5;
      }
      return rango(a) - rango(b) || a.name.localeCompare(b.name, "es");
    });
  }

  function etiquetaVoz(voz) {
    if (!voz) return "Sin voz española";
    var lang = (voz.lang || "").toLowerCase();
    if (lang === "es-ar") return "Español argentino";
    if (lang === "es-419" || lang === "es-mx" ||
        /^es-(cl|co|uy|pe|bo|py|ve|ec|cr|gt|hn|ni|pa|do|pr)$/i.test(lang)) {
      return "Español latino";
    }
    return "Español";
  }

  function vozElegida() {
    var voces = vocesEspanol();
    if (lector.vozURI) {
      for (var i = 0; i < voces.length; i++) {
        if (voces[i].voiceURI === lector.vozURI) return voces[i];
      }
    }
    for (var j = 0; j < voces.length; j++) {
      if (/^es-ar$/i.test(voces[j].lang || "")) return voces[j];
    }
    return voces[0] || null;
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
        var segmentador = new Intl.Segmenter("es", { granularity: "sentence" });
        frases = Array.from(segmentador.segment(limpio), function (parte) {
          return parte.segment;
        });
      } catch (_) {}
    }
    if (!frases.length) {
      frases = limpio.match(/[^.!?…]+(?:[.!?…]+["»”’)\]]*)?|[.!?…]+/g) || [limpio];
    }

    var tramos = [];
    frases.forEach(function (frase) {
      frase = frase.trim();
      while (frase.length > 220) {
        var corte = frase.lastIndexOf(" ", 220);
        if (corte < 100) corte = 220;
        tramos.push(frase.slice(0, corte).trim());
        frase = frase.slice(corte).trim();
      }
      if (frase) tramos.push(frase);
    });
    return tramos;
  }

  function estadoTexto(mensaje) {
    var el = document.getElementById("voz-estado");
    if (el && mensaje) el.textContent = mensaje;
  }

  function actualizarControles(mensaje) {
    var boton = document.querySelector('[data-act="voz-iniciar"]');
    var detener = document.querySelector('[data-act="voz-detener"]');
    var velocidad = document.getElementById("voz-velocidad");
    var cambioVoz = document.querySelector('[data-act="voz-voz-siguiente"]');
    var disponible = !!(sintesis && Utterance);

    if (boton) {
      var textoBoton = lector.estado === "speaking" ? "Pausar" :
        (lector.estado === "paused" ? "Continuar" : "Escuchar");
      if (boton.textContent !== textoBoton) boton.textContent = textoBoton;
      boton.setAttribute("aria-label", textoBoton + " lectura del fallo");
      boton.disabled = !disponible;
    }
    if (detener) detener.disabled = !disponible ||
      (lector.estado === "idle" && lector.indice === 0);
    if (velocidad) {
      var textoVelocidad = lector.velocidad.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "×";
      if (velocidad.textContent !== textoVelocidad) velocidad.textContent = textoVelocidad;
    }
    if (cambioVoz) {
      var voz = vozElegida();
      var textoVoz = etiquetaVoz(voz);
      if (cambioVoz.textContent !== textoVoz) cambioVoz.textContent = textoVoz;
      cambioVoz.title = voz
        ? voz.name + " · " + voz.lang + " · Cambiar voz"
        : "No se encontró ninguna voz en español instalada en el dispositivo";
      cambioVoz.disabled = !disponible || vocesEspanol().length < 2;
    }
    if (mensaje) estadoTexto(mensaje);
  }

  function cancelarActual() {
    lector.generacion++;
    if (sintesis) sintesis.cancel();
    lector.utterance = null;
  }

  function detener(mensaje) {
    cancelarActual();
    lector.estado = "idle";
    lector.indice = 0;
    actualizarControles(mensaje || "Lectura detenida.");
  }

  function hablarTramo(generacion) {
    if (!sintesis || !Utterance || generacion !== lector.generacion) return;
    if (lector.indice >= lector.tramos.length) {
      lector.estado = "done";
      lector.utterance = null;
      actualizarControles("Lectura terminada.");
      return;
    }

    var frase = lector.tramos[lector.indice];
    var voz = vozElegida();
    if (!voz) {
      lector.estado = "error";
      lector.utterance = null;
      actualizarControles("No hay una voz en español disponible. Instale una voz de español en el dispositivo y vuelva a intentarlo. No se reproducirá con voz inglesa.");
      return;
    }
    var u = new Utterance(frase);
    u.lang = voz.lang;
    u.voice = voz;
    u.rate = lector.velocidad;
    u.pitch = 1;
    lector.utterance = u;
    lector.estado = "speaking";
    actualizarControles("Leyendo tramo " + (lector.indice + 1) + " de " + lector.tramos.length + ".");

    u.onend = function () {
      if (generacion !== lector.generacion || lector.estado !== "speaking") return;
      lector.indice++;
      hablarTramo(generacion);
    };
    u.onerror = function (evento) {
      if (generacion !== lector.generacion || evento.error === "canceled" || evento.error === "interrupted") return;
      lector.estado = "error";
      lector.utterance = null;
      actualizarControles("El navegador interrumpió la lectura. Puede volver a iniciarla.");
    };
    sintesis.speak(u);
  }

  function iniciar(texto, huella) {
    if (!sintesis || !Utterance) {
      actualizarControles("Este navegador no ofrece lectura en voz alta.");
      return;
    }
    if (!vozElegida()) {
      actualizarControles("No hay una voz en español disponible en este dispositivo. Instale una voz española y vuelva a intentarlo.");
      return;
    }

    if (lector.estado === "speaking") {
      sintesis.pause();
      lector.estado = "paused";
      actualizarControles("Lectura pausada.");
      return;
    }
    if (lector.estado === "paused") {
      sintesis.resume();
      lector.estado = "speaking";
      actualizarControles("Lectura reanudada.");
      return;
    }

    if (lector.texto !== texto || lector.huellaDocumento !== huella || !lector.tramos.length) {
      cancelarActual();
      lector.texto = texto;
      lector.tramos = dividirTexto(texto);
      lector.indice = 0;
      lector.huellaDocumento = huella;
    } else if (lector.indice >= lector.tramos.length) {
      lector.indice = 0;
    }

    if (!lector.tramos.length) {
      actualizarControles("No hay texto disponible para leer.");
      return;
    }

    cancelarActual();
    lector.estado = "speaking";
    hablarTramo(lector.generacion);
  }

  function leerSeleccion() {
    var seleccion = window.getSelection ? String(window.getSelection()) : "";
    var doc = document.getElementById("doc");
    if (!seleccion.trim() || !doc || !window.getSelection().rangeCount ||
        !doc.contains(window.getSelection().getRangeAt(0).commonAncestorContainer)) {
      actualizarControles("Seleccione primero un fragmento del fallo.");
      return;
    }
    var huella = doc.textContent || "";
    cancelarActual();
    lector.texto = seleccion.trim();
    lector.tramos = dividirTexto(lector.texto);
    lector.indice = 0;
    lector.huellaDocumento = huella;
    if (!lector.tramos.length) return;
    lector.estado = "speaking";
    hablarTramo(lector.generacion);
  }

  function cambiarVelocidad(delta) {
    lector.velocidad = Math.max(0.75, Math.min(2, Math.round((lector.velocidad + delta) * 100) / 100));
    actualizarControles("Velocidad: " + lector.velocidad.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "×. Se aplica al siguiente tramo.");
  }

  function cambiarVoz() {
    var voces = vocesEspanol();
    if (voces.length < 2) return;
    var actual = -1;
    for (var i = 0; i < voces.length; i++) {
      if (voces[i].voiceURI === lector.vozURI) actual = i;
    }
    if (actual < 0) {
      var preferida = vozElegida();
      actual = voces.findIndex(function (voz) { return preferida && voz.voiceURI === preferida.voiceURI; });
    }
    actual = (actual + 1) % (voces.length + 1);
    lector.vozURI = actual === voces.length ? "" : voces[actual].voiceURI;
    actualizarControles("La nueva voz se aplicará al siguiente tramo.");
  }

  document.addEventListener("click", function (evento) {
    var boton = evento.target && evento.target.closest
      ? evento.target.closest("[data-act]") : null;
    if (!boton) return;
    var accion = boton.getAttribute("data-act");
    if (["voz-iniciar", "voz-detener", "voz-leer-seleccion",
      "voz-vel-menos", "voz-vel-mas", "voz-voz-siguiente"].indexOf(accion) < 0) return;

    evento.preventDefault();
    evento.stopPropagation();
    if (accion === "voz-iniciar") {
      var doc = document.getElementById("doc");
      var texto = doc ? (doc.textContent || "") : "";
      iniciar(texto, texto);
    } else if (accion === "voz-leer-seleccion") {
      leerSeleccion();
    } else if (accion === "voz-detener") {
      detener("Lectura detenida.");
    } else if (accion === "voz-vel-menos") {
      cambiarVelocidad(-0.25);
    } else if (accion === "voz-vel-mas") {
      cambiarVelocidad(0.25);
    } else if (accion === "voz-voz-siguiente") {
      cambiarVoz();
    }
  }, true);

  if (sintesis) {
    sintesis.onvoiceschanged = function () { actualizarControles(); };
  }

  var observador = new MutationObserver(function () {
    var barra = document.querySelector(".lector-voz");
    if (!barra) {
      if (lector.estado === "speaking" || lector.estado === "paused") {
        detener("Lectura detenida al salir del Lector.");
      }
      return;
    }

    var doc = document.getElementById("doc");
    var huella = doc ? (doc.textContent || "") : "";
    if ((lector.estado === "speaking" || lector.estado === "paused") &&
        lector.huellaDocumento && huella && huella !== lector.huellaDocumento) {
      detener("La lectura se detuvo porque se abrió otro documento.");
      return;
    }
    actualizarControles();
  });

  function observar() {
    if (document.body) observador.observe(document.body, { childList: true, subtree: true });
    actualizarControles();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observar, { once: true });
  } else {
    observar();
  }
  window.addEventListener("beforeunload", cancelarActual);
})();