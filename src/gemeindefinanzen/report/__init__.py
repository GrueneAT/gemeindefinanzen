"""Interaktives HTML-Dashboard aus der Datenbank erzeugen.

Das Paket gliedert die Generierung in vier Schichten:

- ``data``   — sammelt alle Dokumente in ein JSON-serialisierbares Objekt.
- ``charts`` — baut die ECharts-Optionsbausteine je Dokument und Zeitreihe.
- ``assets`` — statische CSS- und JS-Bausteine (Tabs, Umschalter, Suche).
- ``html``   — setzt die Einzelseite zusammen und schreibt die Datei.

Oeffentlicher Einstieg ist ``build_report(db_path, out_path)`` — die Signatur
bleibt zur CLI-Kompatibilitaet unveraendert.
"""

from __future__ import annotations

from .html import build_report

__all__ = ["build_report"]
