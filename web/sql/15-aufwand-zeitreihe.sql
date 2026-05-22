-- Aufwand nach Art ueber alle Dokumente (Zeitreihe)
-- Personal / Sach / Transfer / Finanz je eingelesenem Dokument. Zeigt, welche
-- Aufwandsart ueber die Jahre waechst — der strukturelle Blick auf den Druck.
SELECT
    dokument,
    ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='221' THEN eh_wert END), 0) AS personal,
    ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='222' THEN eh_wert END), 0) AS sachaufwand,
    ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='223' THEN eh_wert END), 0) AS transfers,
    ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='224' THEN eh_wert END), 0) AS finanz
FROM v_detail
WHERE richtung='ausgabe'
GROUP BY dokument_id, dokument
ORDER BY finanzjahr, typ;
