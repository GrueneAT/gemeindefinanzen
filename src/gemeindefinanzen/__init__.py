"""Analyse oesterreichischer Gemeindevoranschlaege und Rechnungsabschluesse (VRV 2015).

Pipeline:  PDF  ->  extract  ->  parser  ->  loader (SQLite)  ->  validate / query / report
"""

__version__ = "0.1.0"
