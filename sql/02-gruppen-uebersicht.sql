-- Ergebnishaushalt je Aufgabengruppe (VRV-Gliederung 0-9) — aktueller Voranschlag
-- Zeigt, in welchen Aufgabenbereichen die Gemeinde Geld einnimmt und ausgibt.
SELECT
    gruppe,
    gruppe_text,
    ROUND(SUM(CASE WHEN richtung='einnahme' THEN eh_wert END), 0) AS einnahmen,
    ROUND(SUM(CASE WHEN richtung='ausgabe'  THEN eh_wert END), 0) AS ausgaben,
    ROUND(SUM(CASE WHEN richtung='einnahme' THEN eh_wert
                   ELSE -eh_wert END), 0)                         AS saldo
FROM v_detail
WHERE dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
GROUP BY gruppe, gruppe_text
ORDER BY gruppe;
