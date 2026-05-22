-- Kommunalsteuer im Kontext der Ertraege
-- Stellt die Kommunalsteuer des aktuellen Voranschlags neben die Gesamt-
-- ertraege und das Nettoergebnis — zeigt, wie stark das Budget von dieser
-- einen eigenen Abgabe abhaengt.
WITH va AS (SELECT dokument_id FROM dokument
            WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1),
kennzahl AS (
    SELECT
        (SELECT eh_wert FROM v_detail
         WHERE konto='833000' AND dokument_id IN (SELECT dokument_id FROM va)) AS komm,
        (SELECT SUM(eh_wert) FROM v_detail
         WHERE richtung='einnahme' AND dokument_id IN (SELECT dokument_id FROM va)) AS ertraege,
        (SELECT nettoergebnis FROM v_eckwerte
         WHERE dokument_id IN (SELECT dokument_id FROM va)) AS netto
)
SELECT 'Kommunalsteuer Voranschlag'      AS kennzahl, ROUND(komm, 0)  AS euro FROM kennzahl
UNION ALL SELECT 'Anteil an allen Ertraegen %', ROUND(100.0*komm/ertraege, 1) FROM kennzahl
UNION ALL SELECT 'Nettoergebnis Voranschlag',   ROUND(netto, 0)               FROM kennzahl;
