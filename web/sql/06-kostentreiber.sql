-- Kostentreiber: Aufwandsposten mit dem groessten Anstieg gegenueber Vorjahr
-- Im aktuellen Voranschlag ist 'eh_delta' = Wert minus Vergleichsspalte, also
-- VA aktuell gegenueber VA Vorjahr. Wo waechst das Budget?
SELECT
    bezeichnung,
    gruppe_text,
    ROUND(eh_vergleich, 0)              AS vorjahr,
    ROUND(eh_wert, 0)                   AS aktuell,
    ROUND(eh_delta, 0)                  AS veraenderung,
    CASE WHEN eh_vergleich > 0
         THEN ROUND(100.0 * eh_delta / eh_vergleich, 1)
         ELSE NULL END                  AS veraenderung_prozent
FROM v_detail
WHERE richtung='ausgabe' AND eh_delta > 0
  AND dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
ORDER BY eh_delta DESC
LIMIT 25;
