/*****************************************************************************
 *                          ENSO ECUADOR: MAPAS                              *
 *****************************************************************************
 * - createPacificMap: mapa Leaflet del Pacífico tropical con las regiones
 *   Niño. La anomalía de TSM (WMS animado) la agrega el componente.
 * - EcuadorMap: mapa MapLibre con la red de drenaje de Martin coloreada por
 *   el caudal esperado (`mvt_enso_composite`) y la leyenda LegendControlEnso.
 *   MapLibre, como Hydroviewer, porque son 12 mil tramos vectoriales.
 *****************************************************************************/
import * as L from 'leaflet';
import maplibregl from 'maplibre-gl';
import { env } from '../../../environments/environment';
import {
  CARTO_ATTRIBUTION, NINO_REGIONS, RATIO_CLASSES, RATIO_NULL_COLOR,
} from './enso.config';

const VOYAGER = `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=${env.cartoKey}`;
const DARK = `https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png?key=${env.cartoKey}`;

function logoElement(): HTMLImageElement {
  const image = document.createElement('img');
  image.className = 'inamhi-logo';
  image.src = 'assets/img/inamhi-white-logo.png';
  image.alt = 'INAMHI';
  return image;
}


/*****************************************************************************
 *                        Pacífico tropical (Leaflet)                        *
 *****************************************************************************/
export function createPacificMap(id: string): { map: L.Map; regions: L.GeoJSON } {
  const light = L.tileLayer(VOYAGER, { zIndex: -1, attribution: CARTO_ATTRIBUTION });
  const dark = L.tileLayer(DARK, { zIndex: -1, attribution: CARTO_ATTRIBUTION });
  // En el teléfono un dedo desplaza la página, no el mapa (igual que la plantilla).
  const map = L.map(id, {
    center: [-5, -125], zoom: 3, zoomControl: false, dragging: !L.Browser.mobile,
  });
  light.addTo(map);
  L.control.layers({ 'Mapa claro': light, 'Mapa oscuro': dark }, {},
                   { position: 'topright' }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const logo = new L.Control({ position: 'topleft' });
  logo.onAdd = () => logoElement();
  logo.addTo(map);

  const features = NINO_REGIONS.map(({ name, bbox: [w, s, e, n] }) => ({
    type: 'Feature' as const,
    properties: { name },
    geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
  }));
  const regions = L.geoJSON({ type: 'FeatureCollection', features } as any, {
    style: { color: '#000', weight: 1.5, fill: false, interactive: false },
    onEachFeature: (f, layer) => layer.bindTooltip(f.properties.name, {
      permanent: true, direction: 'center', className: 'nino-label',
    }),
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 10);
  return { map, regions };
}


/*****************************************************************************
 *                     Leyenda del caudal esperado (MapLibre)                *
 *****************************************************************************/
export class LegendControlEnso {
  private _container!: HTMLDivElement;
  private phase = '';
  private month = '';
  private missing = false;

  onAdd() {
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl';
    Object.assign(this._container.style, {
      background: 'rgba(255,255,255,0.9)', borderRadius: '5px', padding: '5px 8px',
      fontSize: '0.75rem', margin: '8px', maxWidth: '240px', color: '#000',
    });
    this.render();
    return this._container;
  }

  onRemove() { this._container?.parentNode?.removeChild(this._container); }

  public update(phase: string, month: string, missing: boolean): void {
    Object.assign(this, { phase, month, missing });
    this.render();
  }

  private render(): void {
    if (!this._container) { return; }
    // Dos columnas para que la leyenda no tape media celda del tablero.
    const swatch = (color: string, label: string) =>
      `<span><span style="display:inline-block;width:18px;height:4px;margin:0 5px 3px 0;` +
      `background:${color}"></span>${label}</span>`;
    this._container.innerHTML =
      `<b>Caudal esperado / caudal medio</b><br>` +
      `<b>Fase:</b> ${this.phase}<br><b>Mes:</b> ${this.month}` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:8px">` +
      RATIO_CLASSES.map(c => swatch(c.color, c.label)).join('') +
      swatch(RATIO_NULL_COLOR, 'Sin dato') + `</div>` +
      (this.missing ? `<div style="color:#b2182b"><b>La capa de caudal esperado aún no está publicada.</b></div>` : '');
  }
}


/*****************************************************************************
 *                      Ecuador: caudal esperado (MapLibre)                  *
 *****************************************************************************/
const DRAINAGE = 'geoglows_drainage_ecuador';
const COMPOSITE = 'mvt_enso_composite';
/** Nombre de la capa dentro de las teselas de la función de Martin. */
const COMPOSITE_SOURCE_LAYER = 'enso_composite';
const COMPOSITE_LAYER = 'enso-composite-line';
const HIT_LAYER = 'enso-drainage-hit';
const PROVINCES = 'enso-provinces';

/** Ancho por orden de Strahler, como Hydroviewer. Si el tramo no trae `order`, 0,75. */
const LINE_WIDTH: any = [
  'interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'order'], 3]],
  1, 0.25, 2, 0.5, 3, 0.75, 4, 1, 5, 1.25, 6, 1.5, 7, 1.75, 8, 2,
];

/** Color por clase de `ratio`; gris oscuro si el tramo no tiene dato. */
const RATIO_COLOR: any = [
  'case',
  ['==', ['typeof', ['get', 'ratio']], 'null'], RATIO_NULL_COLOR,
  ['step', ['to-number', ['get', 'ratio']], RATIO_CLASSES[0].color,
    ...RATIO_CLASSES.slice(1).flatMap((c, i) => [RATIO_CLASSES[i].limit, c.color])],
];

export class EcuadorMap {
  public map: maplibregl.Map;
  public legend = new LegendControlEnso();
  private ready: Promise<void>;

  constructor(container: string, mobile: boolean, onRiverClick: (props: any) => void) {
    this.map = new maplibregl.Map({
      container, center: [-78.5, -1.7], zoom: 6, dragPan: !mobile,
      style: { version: 8, sources: {}, layers: [] },
    });
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    this.map.addControl({ onAdd: () => logoElement(), onRemove: () => {} } as any, 'top-left');
    this.map.addControl(this.legend as any, 'bottom-left');

    // Las teselas de CARTO fallan en local (la llave solo vale para el dominio
    // de producción); cualquier otro error se anota sin romper la vista.
    this.map.on('error', (e: any) => {
      if (e.sourceId !== 'carto') { console.warn('Mapa de Ecuador:', e.error?.message ?? e); }
    });

    this.ready = new Promise(resolve => this.map.on('load', () => {
      this.addLayers(onRiverClick);
      resolve();
    }));
  }

  private addLayers(onRiverClick: (props: any) => void): void {
    const map = this.map;
    map.addSource('carto', { type: 'raster', tiles: [VOYAGER], tileSize: 256, attribution: CARTO_ATTRIBUTION });
    map.addLayer({ id: 'carto-layer', type: 'raster', source: 'carto' });

    map.addSource(PROVINCES, {
      type: 'raster', tileSize: 256,
      tiles: [`${env.urlGeoserver}/ecuador/wms?service=WMS&version=1.3.0&request=GetMap` +
        '&layers=ecuador:provincias&styles=&format=image/png&transparent=true' +
        '&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}'],
    });
    map.addLayer({ id: PROVINCES, type: 'raster', source: PROVINCES });

    // Red de drenaje de base: se ve aunque el composite aún no exista.
    map.addSource(DRAINAGE, { type: 'vector', tiles: [`${env.urlMartin}/${DRAINAGE}/{z}/{x}/{y}`] });
    map.addLayer({
      id: 'enso-drainage', type: 'line', source: DRAINAGE, 'source-layer': DRAINAGE,
      paint: { 'line-color': RATIO_NULL_COLOR, 'line-width': LINE_WIDTH },
    });
    // Capa invisible y ancha para que el clic sea fácil (como Hydroviewer).
    map.addLayer({
      id: HIT_LAYER, type: 'line', source: DRAINAGE, 'source-layer': DRAINAGE,
      paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 7 },
    });
    map.on('click', HIT_LAYER, (e: any) => {
      if (e.features?.length) { onRiverClick(e.features[0].properties); }
    });
    map.on('mouseenter', HIT_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', HIT_LAYER, () => { map.getCanvas().style.cursor = ''; });
  }

  /** Cambiar la fase o el mes cambia la URL de la fuente: se quita y se vuelve a agregar. */
  public async setComposite(phase: string, month: number, phaseLabel: string, monthLabel: string) {
    await this.ready;
    const map = this.map;
    if (map.getLayer(COMPOSITE_LAYER)) { map.removeLayer(COMPOSITE_LAYER); }
    if (map.getSource(COMPOSITE)) { map.removeSource(COMPOSITE); }
    this.legend.update(phaseLabel, monthLabel, false);
    // MapLibre toma una tesela 404 como vacía y no avisa: si la función aún no
    // existe en Martin, su TileJSON da 404 y se dice en la leyenda. Los tramos
    // quedan en gris (sin dato), sin romper la vista.
    fetch(`${env.urlMartin}/${COMPOSITE}`).then(r => r.ok, () => false)
      .then(ok => { if (!ok) { this.legend.update(phaseLabel, monthLabel, true); } });
    const params = `phase=${encodeURIComponent(phase)}&month=${month}`;
    map.addSource(COMPOSITE, { type: 'vector', tiles: [`${env.urlMartin}/${COMPOSITE}/{z}/{x}/{y}?${params}`] });
    map.addLayer({
      id: COMPOSITE_LAYER, type: 'line', source: COMPOSITE, 'source-layer': COMPOSITE_SOURCE_LAYER,
      paint: { 'line-color': RATIO_COLOR, 'line-width': LINE_WIDTH },
    }, HIT_LAYER);
  }

  public async setProvinces(visible: boolean) {
    await this.ready;
    this.map.setLayoutProperty(PROVINCES, 'visibility', visible ? 'visible' : 'none');
  }

  public resize(): void { this.map.resize(); }
  public remove(): void { this.map.remove(); }
}
