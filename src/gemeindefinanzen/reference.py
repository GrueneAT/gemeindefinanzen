"""VRV-2015-Referenzdaten: bundesweit standardisierte Klassifikationen.

Diese Codes sind nicht gemeindespezifisch — sie gelten fuer jede oesterreichische
Gemeinde. Ansatz- und Kontobezeichnungen werden dagegen aus dem Dokument selbst
abgeleitet (siehe ``loader``), weil sie dort vollstaendig und korrekt vorliegen.
"""

from __future__ import annotations

# Funktionelle Gliederung — erste Ziffer des Ansatzes (VRV 2015 Anlage 2).
GRUPPEN: dict[str, str] = {
    "0": "Vertretungskoerper und allgemeine Verwaltung",
    "1": "Oeffentliche Ordnung und Sicherheit",
    "2": "Unterricht, Erziehung, Sport und Wissenschaft",
    "3": "Kunst, Kultur und Kultus",
    "4": "Soziale Wohlfahrt und Wohnbaufoerderung",
    "5": "Gesundheit",
    "6": "Strassen- und Wasserbau, Verkehr",
    "7": "Wirtschaftsfoerderung",
    "8": "Dienstleistungen",
    "9": "Finanzwirtschaft",
}

# Mittelverwendungs-/-aufbringungsgruppen (MVAG) — 1. und 2. Ebene.
# 2xxx = Ergebnishaushalt, 3xxx = Finanzierungshaushalt.
MVAG: dict[str, str] = {
    "211": "Ertraege aus operativer Verwaltungstaetigkeit",
    "212": "Ertraege aus Transfers",
    "213": "Finanzertraege",
    "221": "Personalaufwand",
    "222": "Sachaufwand",
    "223": "Transferaufwand",
    "224": "Finanzaufwand",
    "311": "Einzahlungen aus operativer Verwaltungstaetigkeit",
    "312": "Einzahlungen aus Transfers",
    "313": "Einzahlungen aus Finanzertraegen",
    "321": "Auszahlungen Personal",
    "322": "Auszahlungen Sachaufwand",
    "323": "Auszahlungen Transfers",
    "324": "Auszahlungen Finanzaufwand",
    "331": "Einzahlungen aus investiver Gebarung",
    "332": "Auszahlungen aus investiver Gebarung",
    "333": "Erhaltene Kapitaltransfers",
    "341": "Einzahlungen aus Finanzierungstaetigkeit",
    "342": "Auszahlungen aus Finanzierungstaetigkeit",
}

# Querschnittskennzahlen (Anlage 5b) — verdichtete Gesamtsicht.
QUERSCHNITT: dict[str, str] = {
    "10": "Eigene Abgaben",
    "11": "Ertragsanteile",
    "12": "Gebuehren, Leistungen, Besitz",
    "13": "Veraeusserungen, sonstige Ertraege",
    "14": "Nicht finanzierungswirksame operative Ertraege",
    "15": "Ertraege aus Transfers",
    "16": "Finanzertraege",
    "17": "Erhaltene Kapitaltransfers",
    "18": "Sonstige Ertraege",
    "20": "Personalaufwand",
    "21": "Sachaufwand",
    "22": "Verluste / Rueckstellungen",
    "23": "Transferaufwand",
    "24": "Finanzaufwand",
    "33": "Investitionseinzahlungen",
    "34": "Investitionsauszahlungen",
    "35": "Einzahlungen Finanzierungstaetigkeit",
    "36": "Auszahlungen Finanzierungstaetigkeit",
}


def gruppe_name(ansatz: str) -> str:
    return GRUPPEN.get(ansatz[:1], "Unbekannt")


def mvag_name(mvag: str) -> str:
    """Bezeichnung zur MVAG; faellt auf die 3-stellige Ebene zurueck."""
    if not mvag:
        return ""
    return MVAG.get(mvag, MVAG.get(mvag[:3], ""))


def kontenklasse(konto: str) -> str:
    """Grobe oekonomische Klasse aus der ersten Kontoziffer."""
    if not konto:
        return ""
    klassen = {
        "0": "Anlagen / Vermoegen",
        "1": "Umlaufvermoegen / Forderungen",
        "2": "Fremdmittel / Rueckstellungen",
        "5": "Personalaufwand",
        "6": "Verwaltungs- und Betriebsaufwand",
        "7": "Sonstiger Aufwand / Transfers",
        "8": "Ertraege / Einnahmen",
        "9": "Verrechnung",
    }
    return klassen.get(konto[:1], "Sonstige")
