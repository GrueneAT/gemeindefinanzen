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

  // Fall 2: unbehandelte Fehler sichtbar machen.
  function zeigeFehler(text) {
    banner("<strong>Fehler beim Start:</strong> " + String(text))
  }
  window.addEventListener("error", function (e) {
    zeigeFehler((e && e.message) || e)
  })
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason
    zeigeFehler((r && r.message) || r || "unbekannt")
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
