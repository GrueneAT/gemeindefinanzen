-- Zahlungswirksamer Sachaufwand mit Ermessensspielraum, kumuliert
-- Basis ist der Finanzierungshaushalt (tatsaechliche Auszahlungen) — damit
-- fallen nicht zahlungswirksame Posten wie Abschreibungen automatisch heraus;
-- interne Verrechnungsruecklagen werden zusaetzlich ausgeschlossen.
-- Die Spalte 'kumuliert' zeigt, wie viele Posten zusammen welchen Betrag
-- ergeben. KEINE Empfehlung — eine Suchhilfe: jeder Posten ist einzeln zu
-- bewerten.
WITH sach AS (
    SELECT konto, bezeichnung, gruppe_text, fh_wert
    FROM v_detail
    WHERE richtung='ausgabe'
      AND gebarung='operativ'
      AND substr(mvag_eh,1,3)='222'
      AND fh_wert > 0
      AND konto NOT LIKE '68%'                       -- keine Abschreibungen
      AND bezeichnung NOT LIKE '%errechnungsr%'      -- keine internen Ruecklagen
      AND dokument_id = (SELECT dokument_id FROM dokument
                         WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
)
SELECT
    bezeichnung,
    gruppe_text,
    ROUND(fh_wert, 0)                                        AS auszahlung,
    ROUND(SUM(fh_wert) OVER (ORDER BY fh_wert DESC,
                             konto ROWS UNBOUNDED PRECEDING), 0) AS kumuliert
FROM sach
ORDER BY fh_wert DESC
LIMIT 40;
