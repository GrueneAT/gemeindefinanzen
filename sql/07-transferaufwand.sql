-- Transferaufwand im Detail (MVAG 223) — Umlagen und Zuschuesse
-- Pflichtumlagen (NOEKAS-/Krankenanstalten-, Sozialhilfe-, Landesumlage) sind
-- gebunden; freiwillige Zuschuesse an Vereine/Organisationen sind steuerbar.
SELECT
    bezeichnung,
    ansatz_text,
    ROUND(eh_wert, 0)        AS betrag,
    ROUND(eh_vergleich, 0)   AS vergleich,
    CASE
        WHEN lower(bezeichnung) LIKE '%umlage%'
          OR lower(bezeichnung) LIKE '%krankenanstalt%'
          OR lower(bezeichnung) LIKE '%sozialhilfe%'
          OR lower(bezeichnung) LIKE '%sprengel%'
        THEN 'Pflichtumlage'
        ELSE 'sonstiger Transfer'
    END                      AS art
FROM v_detail
WHERE richtung='ausgabe' AND substr(mvag_eh,1,3)='223' AND eh_wert > 0
  AND dokument_id = (SELECT dokument_id FROM dokument
                     WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1)
ORDER BY eh_wert DESC
LIMIT 30;
