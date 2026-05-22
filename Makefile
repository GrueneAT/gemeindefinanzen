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

pages: $(DB) ## Dashboard nach site/index.html bauen (GitHub Pages)
	@mkdir -p site
	$(GEMFIN) report --db "$(DB)" --out site/index.html
	@echo "GitHub-Pages-Seite: site/index.html"

queries: $(DB) ## Alle Abfragen in sql/ ausfuehren und anzeigen
	$(GEMFIN) query --db "$(DB)" --all

export: $(DB) ## Daten nach CSV und Excel exportieren
	$(GEMFIN) export --db "$(DB)" --dir data

test: ## Tests ausfuehren
	$(PYTHON) -m pytest -q

lint: ## Code pruefen
	ruff check src tests && mypy src

all: db validate report ## Komplette Pipeline

# --- Browser-App (web/) -----------------------------------------------------
# Die Browser-App parst VRV-PDFs vollstaendig clientseitig (mupdf.js +
# sqlite-wasm). schema.sql und die sql/-Abfragen sind die Python-Quelle —
# 'make web-sync' kopiert sie nach web/, damit die statische Seite ohne das
# Repo-Wurzelverzeichnis deploybar ist.

web-sync: ## schema.sql und sql/ nach web/ synchronisieren
	cp src/gemeindefinanzen/schema.sql web/schema.sql
	mkdir -p web/sql && cp sql/*.sql web/sql/
	@echo "web/schema.sql und web/sql/ aktualisiert"

web-deps: ## JS-Abhaengigkeiten installieren (mupdf, sqlite-wasm)
	npm install

web-test: ## JS-Tests der Browser-App ausfuehren
	npm run test:js

web-serve: web-sync ## web/ lokal ausliefern (node direkt, ohne Container)
	node scripts/serve.mjs $(WEB_PORT)

# Container-Variante: startet den statischen Server in einem Docker-Container
# und veroeffentlicht den Port auf dem Host. Im Browser http://localhost:8080/web/
# oeffnen — 'localhost' ist ein sicherer Kontext, daher funktioniert auch die
# OPFS-Persistenz. Beenden mit Strg-C.
WEB_PORT  ?= 8080
WEB_IMAGE ?= node:slim
web-docker: web-sync ## web/ im Docker-Container ausliefern (Port veroeffentlicht)
	@echo "Browser oeffnen: http://localhost:$(WEB_PORT)/web/   (Strg-C beendet)"
	docker run --rm -p $(WEB_PORT):$(WEB_PORT) \
		-v "$(CURDIR)":/app -w /app $(WEB_IMAGE) \
		node scripts/serve.mjs $(WEB_PORT)

test-js: web-test ## Alias fuer web-test

clean: ## Generierte Artefakte loeschen
	rm -rf data/*.db data/*.csv data/*.xlsx reports/*.html site build

.PHONY: help setup db validate report pages queries export test lint all clean \
	web-sync web-deps web-test web-serve web-docker test-js
