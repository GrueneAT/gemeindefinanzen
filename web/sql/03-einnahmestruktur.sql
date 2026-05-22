-- Einnahmestruktur des Ergebnishaushalts — aktueller Voranschlag
-- Macht die Abhaengigkeit von einzelnen Einnahmequellen sichtbar — zentral fuer
-- die Frage, wie verkraftbar ein Wegfall der Kommunalsteuer ist.
WITH va AS (SELECT dokument_id FROM dokument
            WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
SELECT
    konto,
    bezeichnung,
    ansatz_text,
    ROUND(eh_wert, 0)                                       AS betrag,
    ROUND(100.0 * eh_wert / (SELECT SUM(eh_wert) FROM v_detail
                             WHERE richtung='einnahme'
                               AND dokument_id IN (SELECT dokument_id FROM va)),
          1)                                                AS anteil_prozent
FROM v_detail
WHERE richtung='einnahme' AND eh_wert > 0
  AND dokument_id IN (SELECT dokument_id FROM va)
ORDER BY eh_wert DESC
LIMIT 25;
