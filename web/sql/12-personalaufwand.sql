-- Personalaufwand je Aufgabengruppe (MVAG 221) — aktueller Voranschlag
-- Personal ist der groesste, aber kurzfristig unbeweglichste Block. Die
-- Aufschluesselung zeigt, wo Personalkosten anfallen.
SELECT
    gruppe,
    gruppe_text,
    COUNT(*)                  AS posten,
    ROUND(SUM(eh_wert), 0)    AS betrag,
    ROUND(SUM(eh_vergleich), 0) AS vergleich
FROM v_detail
WHERE richtung='ausgabe' AND substr(mvag_eh,1,3)='221'
  AND dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
GROUP BY gruppe, gruppe_text
HAVING SUM(eh_wert) > 0
ORDER BY betrag DESC;
