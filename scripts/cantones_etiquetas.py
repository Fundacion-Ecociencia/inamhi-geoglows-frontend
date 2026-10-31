"""Puntos para los nombres de cantón de Met Data Explorer (src/assets/geojson/cantones_etiquetas_2025.geojson).

Uso: python3 -I scripts/cantones_etiquetas.py <cantones_2025.shp> src/assets/geojson/cantones_etiquetas_2025.geojson

Entrada: el mismo shapefile que publica la capa ecuador:cantones en GeoServer (DPA 2025, EPSG:4326; lo prepara
ops/una_vez/cantones_publicar_capa.sh del backend). Si cambia la capa, hay que regenerar este archivo.

Un punto por cantón, en el polo de inaccesibilidad (polylabel) de su parte más grande: a diferencia del centroide,
siempre cae dentro del cantón, también en los alargados o con forma de C. Se omite "ISLA" (sin cantón asignado).
Los cantones van ordenados de mayor a menor superficie: el frontend da prioridad a los primeros cuando dos
nombres se tapan.
"""
import json
import sys

import pandas as pd
import pyogrio
import shapely
from shapely.ops import polylabel

entrada, salida = sys.argv[1], sys.argv[2]
meta, _, geom, campos = pyogrio.raw.read(entrada)
df = pd.DataFrame({n: c for n, c in zip(meta["fields"], campos)})
df["geom"] = shapely.from_wkb(geom)
df = df[df.DPA_CANTON != "ISLA"]

filas = []
for _, r in df.iterrows():
    partes = list(r.geom.geoms) if r.geom.geom_type == "MultiPolygon" else [r.geom]
    mayor = max(partes, key=lambda p: p.area)
    punto = polylabel(mayor, tolerance=0.0005)
    if not mayor.contains(punto):   # no debería pasar; por si acaso, un punto que sí está dentro
        punto = mayor.representative_point()
    filas.append((r.geom.area, {
        "type": "Feature",
        "properties": {"codigo": r.DPA_CANTON, "nombre": r.DPA_DESCAN, "provincia": r.DPA_DESPRO},
        "geometry": {"type": "Point", "coordinates": [round(punto.x, 5), round(punto.y, 5)]},
    }))

filas.sort(key=lambda f: -f[0])
salida_json = {"type": "FeatureCollection", "features": [f for _, f in filas]}
with open(salida, "w", encoding="utf-8") as f:
    json.dump(salida_json, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(filas)} cantones -> {salida}")
