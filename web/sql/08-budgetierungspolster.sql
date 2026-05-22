-- Budgetierungspolster: Voranschlag deutlich ueber dem letzten Rechnungsabschluss
-- Im VA ist 'eh_dritte' der Ist-Wert des Rechnungsabschlusses (Vorvorjahr).
-- Wo der Voranschlag spuerbar hoeher liegt als das tatsaechliche Ist, steckt
-- moeglicherweise Luft — oder echter Mehrbedarf.
SELECT
    bezeichnung,
    gruppe_text,
    ROUND(eh_dritte, 0)                  AS ist_rechnungsabschluss,
    ROUND(eh_wert, 0)                    AS voranschlag,
    ROUND(eh_wert - eh_dritte, 0)        AS polster,
    CASE WHEN eh_dritte > 0
         THEN ROUND(100.0 * (eh_wert - eh_dritte) / eh_dritte, 0)
         ELSE NULL END                   AS polster_prozent
FROM v_detail
WHERE richtung='ausgabe'
  AND eh_dritte > 2000
  AND eh_wert - eh_dritte > 5000
  AND dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
ORDER BY (eh_wert - eh_dritte) DESC
LIMIT 25;
