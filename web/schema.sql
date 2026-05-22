-- Gemeindefinanzen — SQLite-Schema (VRV 2015)
-- Ein Datenmodell fuer Voranschlag, Nachtragsvoranschlag und Rechnungsabschluss
-- ueber beliebig viele Jahre. Der Detailnachweis ist die Quelle; alle Aggregate
-- werden ueber Views berechnet, nicht gespeichert.
--
-- Betragsspalten: Jeder Detailnachweis hat drei Spalten je Haushalt. Ihre
-- Bedeutung haengt vom Dokumenttyp ab — deshalb heissen sie hier neutral
-- 'wert' / 'vergleich' / 'dritte'. Was sie konkret bedeuten, steht je
-- Dokument in dokument.spalte_*:
--   Voranschlag       wert = VA Jahr   | vergleich = VA Vorjahr | dritte = RA Vorvorjahr
--   Rechnungsabschluss wert = RA Jahr  | vergleich = VA Jahr    | dritte = Abweichung RA-VA

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- Dokument-Ebene: ein Eintrag je eingelesene PDF
-- ===========================================================================
CREATE TABLE IF NOT EXISTS dokument (
    dokument_id      INTEGER PRIMARY KEY,
    gemeinde         TEXT,
    typ              TEXT,      -- 'VA' | 'NVA' | 'RA'
    finanzjahr       INTEGER,   -- Hauptjahr des Dokuments
    spalte_wert      TEXT,      -- Bedeutung der Spalte 'wert',      z. B. 'VA 2026'
    spalte_vergleich TEXT,      -- Bedeutung der Spalte 'vergleich', z. B. 'VA 2025'
    spalte_dritte    TEXT,      -- Bedeutung der Spalte 'dritte',    z. B. 'RA 2024'
    fassung          TEXT,      -- z. B. 'Auflage'
    quelldatei       TEXT,
    seiten           INTEGER,
    eingelesen_am    TEXT DEFAULT (datetime('now'))
);

-- ===========================================================================
-- Referenztabellen (VRV-2015-Klassifikationen)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS ref_gruppe (
    gruppe      TEXT PRIMARY KEY,   -- '0'..'9'
    bezeichnung TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_ansatz (
    ansatz      TEXT PRIMARY KEY,   -- 6-stellig, funktionelle Gliederung
    bezeichnung TEXT,
    gruppe      TEXT REFERENCES ref_gruppe(gruppe)
);

CREATE TABLE IF NOT EXISTS ref_konto (
    konto        TEXT PRIMARY KEY,  -- 6-stellig, oekonomische Gliederung
    bezeichnung  TEXT,
    kontenklasse TEXT
);

CREATE TABLE IF NOT EXISTS ref_mvag (
    mvag        TEXT PRIMARY KEY,
    bezeichnung TEXT
);

-- ===========================================================================
-- Kern: jede Zeile des Detailnachweises
-- ===========================================================================
CREATE TABLE IF NOT EXISTS posten (
    posten_id   INTEGER PRIMARY KEY,
    dokument_id INTEGER NOT NULL REFERENCES dokument(dokument_id),
    seite       INTEGER,
    zeilentyp   TEXT NOT NULL,      -- 'detail' | 'summe' | 'saldo'
    richtung    TEXT,               -- 'einnahme' | 'ausgabe'
    vrk         TEXT,               -- voller Schluessel '2/920000+833000'
    ansatz      TEXT,
    konto       TEXT,
    gruppe      TEXT,
    bezeichnung TEXT,
    gebarung    TEXT,               -- 'operativ' | 'investiv' | 'finanzierung'
    -- Ergebnishaushalt (Ertraege/Aufwendungen, inkl. nicht zahlungswirksam)
    eh_wert      REAL,              -- Spalte 1
    eh_vergleich REAL,              -- Spalte 2
    eh_dritte    REAL,              -- Spalte 3
    -- Finanzierungshaushalt (Ein-/Auszahlungen, zahlungswirksam)
    fh_wert      REAL,
    fh_vergleich REAL,
    fh_dritte    REAL,
    mvag_eh     TEXT,
    mvag_fh     TEXT,
    qu          TEXT
);

CREATE INDEX IF NOT EXISTS ix_posten_dok      ON posten(dokument_id);
CREATE INDEX IF NOT EXISTS ix_posten_ansatz   ON posten(ansatz);
CREATE INDEX IF NOT EXISTS ix_posten_konto    ON posten(konto);
CREATE INDEX IF NOT EXISTS ix_posten_gruppe   ON posten(gruppe);
CREATE INDEX IF NOT EXISTS ix_posten_typ      ON posten(zeilentyp);

-- ===========================================================================
-- Views — fachliche Sicht mit Klartext-Bezeichnungen
-- ===========================================================================

-- Alle Detailposten mit aufgeloesten Bezeichnungen
DROP VIEW IF EXISTS v_detail;
CREATE VIEW v_detail AS
SELECT  p.posten_id, p.dokument_id, d.typ, d.finanzjahr,
        d.typ || ' ' || d.finanzjahr AS dokument,
        d.spalte_wert, d.spalte_vergleich, d.spalte_dritte,
        p.seite, p.richtung, p.gebarung, p.vrk,
        p.ansatz, ra.bezeichnung AS ansatz_text,
        p.konto,  rk.bezeichnung AS konto_text,
        p.gruppe, rg.bezeichnung AS gruppe_text,
        p.bezeichnung,
        p.mvag_eh, p.mvag_fh, p.qu,
        p.eh_wert, p.eh_vergleich, p.eh_dritte,
        p.fh_wert, p.fh_vergleich, p.fh_dritte,
        -- Spalte 1 gegen Spalte 2: bei VA = Veraenderung zum Vorjahr,
        -- bei RA = Abweichung Ist gegenueber Soll
        COALESCE(p.eh_wert,0) - COALESCE(p.eh_vergleich,0) AS eh_delta,
        COALESCE(p.fh_wert,0) - COALESCE(p.fh_vergleich,0) AS fh_delta
FROM posten p
JOIN dokument  d  ON d.dokument_id = p.dokument_id
LEFT JOIN ref_ansatz ra ON ra.ansatz = p.ansatz
LEFT JOIN ref_konto  rk ON rk.konto  = p.konto
LEFT JOIN ref_gruppe rg ON rg.gruppe = p.gruppe
WHERE p.zeilentyp = 'detail';

-- Summe je Gruppe und Richtung (Ergebnishaushalt, Spalte 'wert')
DROP VIEW IF EXISTS v_gruppe_summe;
CREATE VIEW v_gruppe_summe AS
SELECT  dokument_id, typ, finanzjahr, gruppe, gruppe_text, richtung,
        SUM(eh_wert)      AS eh_wert,
        SUM(eh_vergleich) AS eh_vergleich,
        SUM(eh_dritte)    AS eh_dritte,
        COUNT(*)          AS posten
FROM v_detail
GROUP BY dokument_id, gruppe, richtung;

-- Summe je Ansatz und Richtung
DROP VIEW IF EXISTS v_ansatz_summe;
CREATE VIEW v_ansatz_summe AS
SELECT  dokument_id, typ, finanzjahr, gruppe, ansatz, ansatz_text, richtung,
        SUM(eh_wert)      AS eh_wert,
        SUM(eh_vergleich) AS eh_vergleich,
        SUM(eh_dritte)    AS eh_dritte,
        COUNT(*)          AS posten
FROM v_detail
GROUP BY dokument_id, ansatz, richtung;

-- Eckwerte je Dokument: Ertraege, Aufwendungen, Nettoergebnis (Spalte 'wert')
DROP VIEW IF EXISTS v_eckwerte;
CREATE VIEW v_eckwerte AS
SELECT  dokument_id, typ, finanzjahr, spalte_wert,
        SUM(CASE WHEN richtung='einnahme' THEN eh_wert ELSE 0 END) AS ertraege,
        SUM(CASE WHEN richtung='ausgabe'  THEN eh_wert ELSE 0 END) AS aufwand,
        SUM(CASE WHEN richtung='einnahme' THEN eh_wert ELSE 0 END)
      - SUM(CASE WHEN richtung='ausgabe'  THEN eh_wert ELSE 0 END) AS nettoergebnis
FROM v_detail
GROUP BY dokument_id;

-- Mehrjahresvergleich: Spalte 'wert' je Konto ueber alle Dokumente.
-- Eine Zeile je (ansatz, konto, richtung); je Dokument eine Wertspalte ist
-- nicht statisch moeglich — daher Langformat, geeignet fuer PIVOT in Abfragen.
DROP VIEW IF EXISTS v_zeitreihe;
CREATE VIEW v_zeitreihe AS
SELECT  d.typ, d.finanzjahr, d.typ || ' ' || d.finanzjahr AS dokument,
        p.richtung, p.gruppe, p.ansatz, p.konto, p.bezeichnung,
        p.eh_wert, p.fh_wert
FROM posten p
JOIN dokument d ON d.dokument_id = p.dokument_id
WHERE p.zeilentyp = 'detail';
