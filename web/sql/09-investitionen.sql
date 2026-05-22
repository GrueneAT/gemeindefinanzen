-- Investive Auszahlungen (Finanzierungshaushalt) — groesste Vorhaben zuerst
-- Investitionen sind oft mehrjaehrig und teils foerder-/darlehensfinanziert;
-- ihre zeitliche Streckung ist ein eigener Hebel gegenueber laufendem Aufwand.
SELECT
    bezeichnung,
    gruppe_text,
    ROUND(fh_wert, 0)        AS auszahlung,
    ROUND(fh_vergleich, 0)   AS vergleich
FROM v_detail
WHERE richtung='ausgabe' AND gebarung='investiv' AND fh_wert > 0
  AND dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
ORDER BY fh_wert DESC
LIMIT 25;
