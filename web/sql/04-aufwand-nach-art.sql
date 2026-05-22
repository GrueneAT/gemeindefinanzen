-- Aufwand nach Aufwandsart (MVAG): Personal / Sach / Transfer / Finanz
-- Grobe Steuerbarkeit: Personal und Pflichttransfers sind kurzfristig kaum
-- veraenderbar, Sachaufwand enthaelt den groessten Ermessensanteil.
SELECT
    CASE substr(mvag_eh, 1, 3)
        WHEN '221' THEN '1 Personalaufwand'
        WHEN '222' THEN '2 Sachaufwand'
        WHEN '223' THEN '3 Transferaufwand'
        WHEN '224' THEN '4 Finanzaufwand'
        ELSE             '9 Sonstiger / nicht zugeordnet'
    END                                                    AS aufwandsart,
    COUNT(*)                                               AS posten,
    ROUND(SUM(eh_wert), 0)                                 AS betrag,
    ROUND(SUM(eh_vergleich), 0)                            AS vergleich,
    ROUND(SUM(eh_wert) - SUM(eh_vergleich), 0)             AS veraenderung
FROM v_detail
WHERE richtung='ausgabe'
  AND dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
GROUP BY aufwandsart
ORDER BY aufwandsart;
