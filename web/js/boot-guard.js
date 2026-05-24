// Start-Waechter — ein klassisches Skript (KEIN ES-Modul), damit es auch dann
// laeuft, wenn die eigentliche Modul-App nicht starten kann.
//
// Browser blockieren ES-Module beim Oeffnen ueber file:// — dann laeuft app.js
// nicht an und die Seite bliebe ohne dieses Skript stumm. Der Waechter macht
// drei Faelle sichtbar: Aufruf als lokale Datei, unbehandelte Fehler und ein
// Ausbleiben des Starts.

(function () {
  "use strict"

  function banner(html) {
    var d = document.getElementById("boot-banner")
    if (!d) {
      d = document.createElement("div")
      d.id = "boot-banner"
      d.className = "boot-banner"
      var ziel = document.body || document.documentElement
      ziel.insertBefore(d, ziel.firstChild)
    }
    d.innerHTML = html
  }

  // Fall 1: als lokale Datei geoeffnet — die App kann so nicht laufen.
  if (location.protocol === "file:") {
    banner(
      "<strong>Diese Seite muss ueber einen Webserver laufen.</strong> " +
        "Sie wurde als lokale Datei geoeffnet (file://) — Browser blockieren " +
        "dabei die benoetigten Module, daher reagiert nichts. Bitte die " +
        "veroeffentlichte Internet-Adresse der App verwenden.",
    )
    return
  }

  // Fall 2: unbehandelte Fehler sichtbar machen — aber nur eigene.
  // Browser-Extensions (Password-Manager, Translation-Tools, AI-Helper usw.)
  // feuern Errors und Promise-Rejections in den window-Scope der Seite
  // ("Tab not found", "runtime.sendMessage", "message channel closed",
  // "Extension context invalidated", "Could not establish connection",
  // "The message port closed before a response was received" u. ae.).
  // Manche Extensions injizieren Scripts in den Main-World der Seite, dann
  // hat der Fehler die Page-Origin als filename — Filename-Check allein
  // reicht nicht. Wir filtern darum auch nach bekannten Message-Patterns.

  // Bekannte Extension-Patterns in Error-Messages.
  var EXT_PATTERN = /Tab not found|runtime\.sendMessage|runtime\.connect|message channel closed|message port closed|Extension context invalidated|Could not establish connection|The message port|chrome\.runtime|chrome-extension:\/\/|moz-extension:\/\//i

  function istExtensionUrl(s) {
    return /^[a-z-]+-extension:\/\//i.test(String(s || ""))
  }

  function istExtensionMessage(msg) {
    if (!msg) return false
    return EXT_PATTERN.test(String(msg))
  }

  function istEigenerFehler(e) {
    if (!e) return true
    var filename = e.filename || (e.error && e.error.fileName) || ""
    if (istExtensionUrl(filename)) return false
    // Stack durchsuchen — Extension-Scripts im Main-World tauchen oft im
    // Stack-Trace mit ihrer extension:// URL auf.
    var stack = (e.error && e.error.stack) || ""
    if (/[a-z-]+-extension:\/\//i.test(stack)) return false
    // Message gegen bekannte Extension-Patterns pruefen.
    if (istExtensionMessage(e.message)) return false
    return true
  }

  function zeigeFehler(text) {
    banner("<strong>Fehler beim Start:</strong> " + String(text))
  }
  window.addEventListener("error", function (e) {
    if (!istEigenerFehler(e)) {
      if (typeof console !== "undefined" && console.debug) {
        console.debug("boot-guard: Extension-Fehler ignoriert:", e && e.message)
      }
      return
    }
    zeigeFehler((e && e.message) || e)
  })
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason
    var msg = (r && r.message) || r || "unbekannt"
    var stack = (r && r.stack) || ""
    if (istExtensionMessage(msg) || /[a-z-]+-extension:\/\//i.test(stack)) {
      if (typeof console !== "undefined" && console.debug) {
        console.debug("boot-guard: Extension-Rejection ignoriert:", msg)
      }
      return
    }
    zeigeFehler(msg)
  })

  // Fall 3: Start bleibt aus — die App setzt window.__appBereit, wenn sie
  // einsatzbereit ist. Passiert das nicht, nach einigen Sekunden melden.
  setTimeout(function () {
    if (!window.__appBereit) {
      banner(
        "<strong>Die App konnte nicht starten.</strong> Bitte die Seite neu " +
          "laden. Besteht das Problem weiter, mit F12 die Browser-Konsole " +
          "oeffnen — die rote Meldung dort benennt die Ursache.",
      )
    }
  }, 8000)
})()
