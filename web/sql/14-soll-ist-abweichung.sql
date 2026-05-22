-- Soll-Ist-Abweichung im juengsten Rechnungsabschluss
-- In einem Rechnungsabschluss ist 'eh_delta' = Ist minus Soll: wo wich das
-- tatsaechliche Ergebnis am staerksten vom urspruenglichen Voranschlag ab?
-- Lehrreich fuer die Beurteilung, wie belastbar Voranschlagszahlen sind.
SELECT
    bezeichnung,
    gruppe_text,
    richtung,
    ROUND(eh_vergleich, 0)       AS soll_va,
    ROUND(eh_wert, 0)            AS ist_ra,
    ROUND(eh_delta, 0)           AS abweichung
FROM v_detail
WHERE typ='RA'
  AND finanzjahr = (SELECT MAX(finanzjahr) FROM v_detail WHERE typ='RA')
  AND ABS(eh_delta) > 20000
ORDER BY ABS(eh_delta) DESC
LIMIT 30;
