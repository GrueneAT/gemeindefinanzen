-- Groesste Einzelausgaben des Ergebnishaushalts (alle Aufwandsarten)
-- Der schnelle Gesamtueberblick: welche einzelnen Posten das Budget dominieren.
SELECT
    bezeichnung,
    gruppe_text,
    CASE substr(mvag_eh,1,3)
        WHEN '221' THEN 'Personal'
        WHEN '222' THEN 'Sachaufwand'
        WHEN '223' THEN 'Transfer'
        WHEN '224' THEN 'Finanz'
        ELSE 'sonstige' END    AS art,
    ROUND(eh_wert, 0)         AS betrag
FROM v_detail
WHERE richtung='ausgabe' AND eh_wert > 0
  AND dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
ORDER BY eh_wert DESC
LIMIT 30;
