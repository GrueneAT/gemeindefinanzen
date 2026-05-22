# Gemeindefinanzen — Analyse-Pipeline
# Quelle (PDFs) -> Parser -> SQLite-DB -> Pruefung -> Abfragen -> Dashboard

DOCS     ?= documents
DB       ?= data/gemeindefinanzen.db
PYTHON   ?= python3
# PYTHONPATH=src laesst die Pipeline auch ohne 'make setup' laufen
GEMFIN    = PYTHONPATH=src $(PYTHON) -m gemeindefinanzen.cli

.DEFAULT_GOAL := help

help: ## Diese Hilfe anzeigen
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Abhaengigkeiten installieren (in Container nicht noetig)
	$(PYTHON) -m pip install -e ".[export,analyse,dev]"

db: $(DB) ## SQLite-DB aus allen PDFs in documents/ bauen

# Abhaengigkeit ist das Verzeichnis (nicht die Einzeldateien) — robust auch bei
# Leerzeichen in Dateinamen. Bei geaenderten PDFs: 'make clean db' bzw. 'make db'.
$(DB): $(DOCS) src/gemeindefinanzen/*.py src/gemeindefinanzen/schema.sql
	@mkdir -p data
	$(GEMFIN) build "$(DOCS)" --db "$(DB)"

validate: $(DB) ## Plausibilitaetspruefung gegen PDF-Summen
	$(GEMFIN) validate --db "$(DB)"

report: $(DB) ## HTML-Dashboard erzeugen
	@mkdir -p reports
	$(GEMFIN) report --db "$(DB)" --out reports/dashboard.html
	@echo "Dashboard: reports/dashboard.html"

queries: $(DB) ## Alle Abfragen in sql/ ausfuehren und anzeigen
	$(GEMFIN) query --db "$(DB)" --all

export: $(DB) ## Daten nach CSV und Excel exportieren
	$(GEMFIN) export --db "$(DB)" --dir data

test: ## Tests ausfuehren
	$(PYTHON) -m pytest -q

lint: ## Code pruefen
	ruff check src tests && mypy src

all: db validate report ## Komplette Pipeline

clean: ## Generierte Artefakte loeschen
	rm -rf data/*.db data/*.csv data/*.xlsx reports/*.html build

.PHONY: help setup db validate report queries export test lint all clean
