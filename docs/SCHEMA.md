# Datenbankschema

SQLite, definiert in `src/gemeindefinanzen/schema.sql`. Eine Datei enthält
beliebig viele Dokumente (Jahre, VA/NVA/RA) nebeneinander.

## Betragsspalten — wichtig

Jeder Detailnachweis hat drei Betragsspalten je Haushalt. Ihre Bedeutung
hängt vom Dokumenttyp ab — deshalb heißen sie im Schema **neutral**
`wert` / `vergleich` / `dritte`:

| Dokumenttyp | `wert` | `vergleich` | `dritte` |
|-------------|--------|-------------|----------|
| Voranschlag (VA) | VA Jahr | VA Vorjahr | RA Vorvorjahr |
| Nachtragsvoranschlag (NVA) | VA Jahr inkl. NVA | VA Jahr | 1. NVA (Änderung) |
| Rechnungsabschluss (RA) | RA Jahr (Ist) | VA Jahr (Soll) | Abweichung RA−VA |

Was die Spalten eines konkreten Dokuments bedeuten, steht in
`dokument.spalte_wert` / `spalte_vergleich` / `spalte_dritte`.

## Tabellen

### `dokument`

Ein Eintrag je eingelesene PDF.

| Spalte | Bedeutung |
|--------|-----------|
| `dokument_id` | Primärschlüssel |
| `gemeinde` | Name der Gemeinde, aus dem PDF-Kopf (z. B. „Stadtgemeinde …“) |
| `typ` | `VA` / `NVA` / `RA` |
| `finanzjahr` | Hauptjahr des Dokuments |
| `spalte_wert`, `spalte_vergleich`, `spalte_dritte` | Klartext-Bedeutung der drei Betragsspalten |
| `fassung`, `quelldatei`, `seiten`, `eingelesen_am` | Herkunft |

### `posten` — die Kerntabelle

Jede Zeile des Detailnachweises.

| Spalte | Bedeutung |
|--------|-----------|
| `dokument_id` | Verweis auf `dokument` |
| `zeilentyp` | `detail` / `summe` / `saldo` |
| `richtung` | `einnahme` / `ausgabe` |
| `vrk` | voller Kontoschlüssel, z. B. `2/920000+833000` |
| `ansatz`, `konto`, `gruppe` | funktionelle/ökonomische Gliederung |
| `bezeichnung` | Klartext der Zeile |
| `gebarung` | `operativ` / `investiv` / `finanzierung` / `ruecklage` |
| `eh_wert`, `eh_vergleich`, `eh_dritte` | Ergebnishaushalt — drei Spalten |
| `fh_wert`, `fh_vergleich`, `fh_dritte` | Finanzierungshaushalt — drei Spalten |
| `mvag_eh`, `mvag_fh` | Aufwands-/Ertragsart je Haushalt |
| `qu` | Querschnittskennzahl |

Für die meisten Auswertungen: `WHERE zeilentyp='detail'` — oder gleich die
View `v_detail`.

### Referenztabellen

| Tabelle | Inhalt | Herkunft |
|---------|--------|----------|
| `ref_gruppe` | Aufgabengruppen 0–9 | VRV 2015 (fest) |
| `ref_mvag` | Aufwands-/Ertragsarten | VRV 2015 (fest) |
| `ref_ansatz` | Ansatz → Bezeichnung | aus den Dokumenten abgeleitet |
| `ref_konto` | Konto → Bezeichnung + Kontenklasse | aus den Dokumenten abgeleitet |

## Views

| View | Zweck |
|------|-------|
| `v_detail` | alle Detailposten mit aufgelösten Bezeichnungen und `eh_delta` |
| `v_ansatz_summe` | Summen je Ansatz und Richtung |
| `v_gruppe_summe` | Summen je Aufgabengruppe und Richtung |
| `v_eckwerte` | Erträge, Aufwand, Nettoergebnis je Dokument |
| `v_zeitreihe` | Detailposten über alle Dokumente — Basis für Mehrjahresvergleiche |

`v_detail` ist der empfohlene Einstieg. Zusätzliche berechnete Spalten:

- `eh_delta` — `eh_wert` minus `eh_vergleich`. Bei einem VA die Veränderung
  zum Vorjahr, bei einem RA die Abweichung Ist gegenüber Soll.
- `dokument` — `typ || ' ' || finanzjahr`, z. B. „VA 2026“.

## Beispielabfragen

Nettoergebnis des aktuellen Voranschlags:

```sql
SELECT nettoergebnis FROM v_eckwerte
WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1;
```

Kommunalsteuer über alle Jahre:

```sql
SELECT dokument, eh_wert FROM v_zeitreihe
WHERE konto='833000' ORDER BY finanzjahr, typ;
```

Größte Sachaufwandsposten eines Dokuments:

```sql
SELECT bezeichnung, eh_wert FROM v_detail
WHERE richtung='ausgabe' AND substr(mvag_eh,1,3)='222'
  AND dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
ORDER BY eh_wert DESC LIMIT 20;
```
