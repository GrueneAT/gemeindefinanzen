-- Kommunalsteuer im Kontext und Szenario "minus 800.000 EUR"
-- Stellt die Kommunalsteuer des aktuellen Voranschlags neben das Nettoergebnis
-- und rechnet vor, wie ein dauerhafter Einnahmenausfall von 800.000 EUR wirkt.
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
UNION ALL SELECT 'Nettoergebnis Voranschlag',   ROUND(netto, 0)               FROM kennzahl
UNION ALL SELECT 'Nettoergebnis nach -800.000', ROUND(netto - 800000, 0)      FROM kennzahl;
