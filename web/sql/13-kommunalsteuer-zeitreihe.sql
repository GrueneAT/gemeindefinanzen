-- Kommunalsteuer ueber alle eingelesenen Dokumente (Zeitreihe)
-- Verfolgt die wichtigste eigene Abgabe ueber Rechnungsabschluesse und
-- Voranschlaege hinweg. 'wert' ist je nach Dokument Ist (RA) oder Plan (VA).
SELECT
    dokument,
    typ,
    ROUND(eh_wert, 0)        AS kommunalsteuer
FROM v_zeitreihe
WHERE konto='833000'
ORDER BY finanzjahr, typ;
