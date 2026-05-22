-- Eckwerte je Dokument: Ertraege, Aufwand, Nettoergebnis
-- Eine Zeile je eingelesenem Voranschlag / Nachtrag / Rechnungsabschluss —
-- der direkte Mehrjahresvergleich. Spalte 'wert' (VA-Plan bzw. RA-Ist).
SELECT
    spalte_wert                  AS dokument,
    ROUND(ertraege, 0)           AS ertraege,
    ROUND(aufwand, 0)            AS aufwendungen,
    ROUND(nettoergebnis, 0)      AS nettoergebnis
FROM v_eckwerte
ORDER BY finanzjahr, typ;
