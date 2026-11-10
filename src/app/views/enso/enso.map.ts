/*****************************************************************************
 *                          ENSO ECUADOR: MAPAS                              *
 *****************************************************************************
 * - createPacificMap: mapa Leaflet del Pacífico tropical con las regiones
 *   Niño. La anomalía de TSM (WMS animado) la agrega el componente.
 * - EcuadorMap: mapa MapLibre con la red de drenaje de Martin coloreada por
 *   el caudal esperado (`mvt_enso_composite`) y la leyenda LegendControlEnso.
 *   MapLibre, como Hydroviewer, porque son 12 mil tramos vectoriales. El mismo
 *   mapa muestra la perspectiva estacional (malla C3S o caudal costero de
 *   `mvt_enso_outlook`): `setView` decide qué capas se ven.
 *****************************************************************************/
import * as L from 'leaflet';
import maplibregl from 'maplibre-gl';
import { env } from '../../../environments/environment';
import {
  c3sColorExpression, c3sOpacityExpression, CARTO_ATTRIBUTION, CompositeMetric, maskOpacity, NINO_REGIONS,
  outlookColorExpression, outlookOpacityExpression, PROB_CLASSES, probColorExpression, RATIO_CLASSES, RATIO_NULL_COLOR,
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
export function createPacificMap(id: string): { map: L.Map; regions: L.LayerGroup } {
  const light = L.tileLayer(VOYAGER, { zIndex: -1, attribution: CARTO_ATTRIBUTION });
  const dark = L.tileLayer(DARK, { zIndex: -1, attribution: CARTO_ATTRIBUTION });
  // En el teléfono un dedo desplaza la página, no el mapa (igual que la plantilla).
  const map = L.map(id, {
    center: [-5, -125], zoom: 3, zoomControl: false, dragging: !L.Browser.mobile,
  });
  light.addTo(map);
  // autoZIndex: false para que los mapas base conserven zIndex −1. Con el valor por defecto el
  // control les asigna 1 y 2 al cambiar: el oscuro quedaba encima de la TSM (z 1) y el claro, al
  // volver, empataba con ella y la tapaba por estar después en la página.
  L.control.layers({ 'Mapa claro': light, 'Mapa oscuro': dark }, {},
                   { position: 'topright', autoZIndex: false }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const logo = new L.Control({ position: 'topleft' });
  logo.onAdd = () => logoElement();
  logo.addTo(map);

  // Un panel propio por encima de la TSM (overlayPane, z 400) para que los recuadros no queden
  // debajo de la capa animada, que se agrega después.
  map.createPane('ninoRegions').style.zIndex = '450';
  const regions = L.layerGroup();
  for (const { name, bbox: [w, s, e, n], color, dash, label } of NINO_REGIONS) {
    L.rectangle([[s, w], [n, e]], {
      pane: 'ninoRegions', color, weight: dash ? 2.5 : 2, dashArray: dash, fill: false, interactive: false,
    }).addTo(regions);
    // La etiqueta va fuera del recuadro, centrada en su lado norte o sur.
    const lat = label === 'arriba' ? n : s;
    L.tooltip({
      permanent: true, direction: label === 'arriba' ? 'top' : 'bottom', offset: [0, label === 'arriba' ? -2 : 2],
      className: 'nino-label', pane: 'ninoRegions', interactive: false,
    }).setLatLng([lat, (w + e) / 2])
      .setContent(`<span style="border-left:4px ${dash ? 'dotted' : 'solid'} ${color};padding-left:4px;color:${color}">${name}</span>`)
      .addTo(regions);
  }
  regions.addTo(map);

  setTimeout(() => map.invalidateSize(), 10);
  return { map, regions };
}


/*****************************************************************************
 *                     Leyenda del caudal esperado (MapLibre)                *
 *****************************************************************************/
/** Leyenda de una capa de la perspectiva estacional (la arma el componente con sus textos). */
export interface OutlookLegend {
  title: string;
  /** Líneas de fuente, temporada, etc. (HTML ya escapado). */
  lines: string[];
  /** Clases en dos columnas (bajo | sobre lo normal) y luego las de una sola. */
  columns?: { headers: [string, string]; rows: [string, string, string][] };
  classes: { color: string; label: string; opacity?: number }[];
  /** 'fill' para la malla C3S, 'line' para los ríos. */
  shape: 'fill' | 'line';
  note?: string;
  missing?: string;
}

export class LegendControlEnso {
  private _container!: HTMLDivElement;
  private phase = '';
  private month = '';
  private missing = false;
  private metric: CompositeMetric = 'prob';
  private mask = false;
  /** Con valor, la leyenda es la de la perspectiva; con null, la del caudal esperado. */
  private outlook: OutlookLegend | null = null;

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

  public update(phase: string, month: string, missing: boolean, metric: CompositeMetric = this.metric,
                mask: boolean = this.mask): void {
    Object.assign(this, { phase, month, missing, metric, mask });
    this.render();
  }

  /** Cambia a la leyenda de la perspectiva (o, con null, vuelve a la del caudal esperado). */
  public setOutlook(outlook: OutlookLegend | null): void {
    this.outlook = outlook;
    this.render();
  }

  private render(): void {
    if (!this._container) { return; }
    // Dos columnas para que la leyenda ocupe poco alto en el teléfono.
    const swatch = (color: string, label: string) =>
      `<span><span style="display:inline-block;width:18px;height:4px;margin:0 5px 3px 0;` +
      `background:${color}"></span>${label}</span>`;
    if (this.outlook) { this.renderOutlook(this.outlook, swatch); return; }
    const prob = this.metric === 'prob';
    this._container.innerHTML =
      (prob ? `<b>Probabilidad de caudal en el tercio alto o bajo</b><br>`
            : `<b>Caudal esperado / caudal medio</b><br>`) +
      `<b>Fase:</b> ${this.phase}<br><b>Mes:</b> ${this.month}` +
      (prob
        ? `<div>${PROB_CLASSES.map(c => swatch(c.color, c.label)).join('<br>')}<br>${swatch(RATIO_NULL_COLOR, 'Sin dato')}</div>` +
          `<div style="color:#444">Base: 33 % (un año cualquiera)` +
          (this.mask ? `<br>Tenue: no significativo (FDR 10 %)` : '') + `</div>`
        : `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:8px">` +
          RATIO_CLASSES.map(c => swatch(c.color, c.label)).join('') +
          swatch(RATIO_NULL_COLOR, 'Sin dato') + `</div>`) +
      (this.missing ? `<div style="color:#b2182b"><b>La capa de caudal esperado aún no está publicada.</b></div>` : '');
  }

  private renderOutlook(o: OutlookLegend, line: (color: string, label: string) => string): void {
    // Celdas: cuadro de color con su opacidad real sobre el mapa; ríos: la misma raya del caudal esperado.
    const box = (color: string, label = '', opacity = 1) =>
      `<span><span style="display:inline-block;width:12px;height:12px;margin:0 5px -2px 0;` +
      `border:1px solid rgba(0,0,0,0.25);background:${color};opacity:${opacity}"></span>${label}</span>`;
    const swatch = (c: { color: string; label: string; opacity?: number }) =>
      o.shape === 'fill' ? box(c.color, c.label, c.opacity ?? 1) : line(c.color, c.label);
    const grid = o.columns
      ? `<div style="display:grid;grid-template-columns:auto auto auto;column-gap:6px;align-items:center">` +
        `<span></span><b>${o.columns.headers[0]}</b><b>${o.columns.headers[1]}</b>` +
        o.columns.rows.map(([label, lo, up]) => `<span>${label}</span>${box(lo)}${box(up)}`).join('') + `</div>`
      : '';
    this._container.innerHTML =
      `<b>${o.title}</b><br>` + o.lines.join('<br>') + grid +
      `<div>${o.classes.map(swatch).join('<br>')}</div>` +
      (o.note ? `<div style="color:#444">${o.note}</div>` : '') +
      (o.missing ? `<div style="color:#b2182b"><b>${o.missing}</b></div>` : '');
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
const BASE_DRAINAGE_LAYER = 'enso-drainage';
/** Perspectiva estacional: malla C3S (GeoJSON de la API) y caudal costero (Martin). */
const C3S = 'enso-c3s-grid';
const C3S_LAYER = 'enso-c3s-fill';
const OUTLOOK = 'mvt_enso_outlook';
const OUTLOOK_SOURCE_LAYER = 'enso_outlook';
const OUTLOOK_LAYER = 'enso-outlook-line';

/** Qué muestra el mapa: el caudal esperado según la fase, la malla C3S o el caudal costero. */
export type EcuadorView = 'composite' | 'c3s' | 'streamflow';

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

const PROB_COLOR = probColorExpression();

export class EcuadorMap {
  public map: maplibregl.Map;
  public legend = new LegendControlEnso();
  private ready: Promise<void>;
  private view: EcuadorView = 'composite';
  /** Si Martin no tiene la capa de caudal costero, se deja ver la red de base en gris. */
  private streamflowMissing = false;
  /** Última leyenda de cada capa de la perspectiva, para restaurarla al volver a esa vista. */
  private outlookLegends: Partial<Record<EcuadorView, OutlookLegend>> = {};

  /**
   * `onRiverClick` recibe la vista activa para que el componente abra el modal que corresponde
   * (caudal esperado o perspectiva de caudal); `onCellClick`, las propiedades de la celda C3S.
   */
  constructor(container: string, mobile: boolean, onRiverClick: (props: any, view: EcuadorView) => void,
              private onCellClick: (props: any) => void = () => {}) {
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

  private addLayers(onRiverClick: (props: any, view: EcuadorView) => void): void {
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
      id: BASE_DRAINAGE_LAYER, type: 'line', source: DRAINAGE, 'source-layer': DRAINAGE,
      paint: { 'line-color': RATIO_NULL_COLOR, 'line-width': LINE_WIDTH },
    });
    // Capa invisible y ancha para que el clic sea fácil (como Hydroviewer).
    map.addLayer({
      id: HIT_LAYER, type: 'line', source: DRAINAGE, 'source-layer': DRAINAGE,
      paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 7 },
    });
    // La capa de clic se oculta en la vista C3S: una capa oculta no recibe eventos.
    map.on('click', HIT_LAYER, (e: any) => {
      if (e.features?.length) { onRiverClick(e.features[0].properties, this.view); }
    });
    map.on('mouseenter', HIT_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', HIT_LAYER, () => { map.getCanvas().style.cursor = ''; });
    // La malla C3S cambia de fuente en cada selección, pero el id de la capa es fijo: los eventos
    // registrados por id siguen valiendo tras quitarla y agregarla.
    map.on('click', C3S_LAYER, (e: any) => {
      if (e.features?.length) { this.onCellClick(e.features[0].properties); }
    });
    map.on('mouseenter', C3S_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', C3S_LAYER, () => { map.getCanvas().style.cursor = ''; });
  }

  /**
   * Qué capas se ven en cada vista. Se llama al cambiar de vista y cada vez que se agrega una
   * capa, así el orden en que terminan las peticiones no importa.
   */
  private applyView(): void {
    const map = this.map;
    const v = this.view;
    const show: Record<string, boolean> = {
      [BASE_DRAINAGE_LAYER]: v === 'composite' || (v === 'streamflow' && this.streamflowMissing),
      [COMPOSITE_LAYER]: v === 'composite',
      [HIT_LAYER]: v !== 'c3s',
      [C3S_LAYER]: v === 'c3s',
      [OUTLOOK_LAYER]: v === 'streamflow',
    };
    Object.entries(show).forEach(([id, visible]) => {
      if (map.getLayer(id)) { map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); }
    });
  }

  private setOutlookLegend(view: EcuadorView, legend: OutlookLegend): void {
    this.outlookLegends[view] = legend;
    if (this.view === view) { this.legend.setOutlook(legend); }
  }

  /** Cambia de vista; con 'composite' la leyenda vuelve a la del caudal esperado. */
  public async setView(view: EcuadorView): Promise<void> {
    this.view = view;
    await this.ready;
    this.legend.setOutlook(view === 'composite' ? null : this.outlookLegends[view] ?? null);
    this.applyView();
  }

  /**
   * Malla C3S: GeoJSON de `c3s-grid`, debajo de los límites provinciales para que se lean encima.
   * Con `data` null solo se quita (sin emisión o la petición falló).
   */
  public async setC3sGrid(data: any | null, variable: 'precipitation' | 'temperature',
                          legend: OutlookLegend): Promise<void> {
    await this.ready;
    const map = this.map;
    if (map.getLayer(C3S_LAYER)) { map.removeLayer(C3S_LAYER); }
    if (map.getSource(C3S)) { map.removeSource(C3S); }
    this.setOutlookLegend('c3s', legend);
    if (!data) { return; }
    map.addSource(C3S, { type: 'geojson', data });
    map.addLayer({
      id: C3S_LAYER, type: 'fill', source: C3S,
      paint: {
        'fill-color': c3sColorExpression(variable),
        'fill-opacity': c3sOpacityExpression(),
        'fill-outline-color': 'rgba(0,0,0,0.25)',
      },
    }, PROVINCES);
    this.applyView();
  }

  /**
   * Caudal costero de Martin, con el mismo patrón que `setComposite`: la emisión va en la URL, y
   * si el TileJSON da 404 se devuelve false y la red de base queda en gris.
   */
  public async setStreamflowOutlook(issue: string, legend: OutlookLegend, missingText: string): Promise<boolean> {
    await this.ready;
    const map = this.map;
    if (map.getLayer(OUTLOOK_LAYER)) { map.removeLayer(OUTLOOK_LAYER); }
    if (map.getSource(OUTLOOK)) { map.removeSource(OUTLOOK); }
    this.streamflowMissing = false;
    this.setOutlookLegend('streamflow', legend);
    map.addSource(OUTLOOK, {
      type: 'vector', tiles: [`${env.urlMartin}/${OUTLOOK}/{z}/{x}/{y}?issue=${encodeURIComponent(issue)}`],
    });
    map.addLayer({
      id: OUTLOOK_LAYER, type: 'line', source: OUTLOOK, 'source-layer': OUTLOOK_SOURCE_LAYER,
      paint: {
        'line-color': outlookColorExpression(),
        'line-width': LINE_WIDTH,
        'line-opacity': outlookOpacityExpression(),
      },
    }, HIT_LAYER);
    this.applyView();
    const ok = await fetch(`${env.urlMartin}/${OUTLOOK}`).then(r => r.ok, () => false);
    if (!ok) {
      this.streamflowMissing = true;
      this.setOutlookLegend('streamflow', { ...legend, missing: missingText });
      this.applyView();
    }
    return ok;
  }

  /**
   * Cambiar la fase o el mes cambia la URL de la fuente: se quita y se vuelve a agregar.
   * Devuelve false si Martin no tiene la capa, para que la vista lo diga sobre el mapa.
   */
  public async setComposite(phase: string, month: number, phaseLabel: string, monthLabel: string,
                            metric: CompositeMetric = 'prob', mask = false): Promise<boolean> {
    await this.ready;
    const map = this.map;
    if (map.getLayer(COMPOSITE_LAYER)) { map.removeLayer(COMPOSITE_LAYER); }
    if (map.getSource(COMPOSITE)) { map.removeSource(COMPOSITE); }
    this.legend.update(phaseLabel, monthLabel, false, metric, mask);
    const params = `phase=${encodeURIComponent(phase)}&month=${month}`;
    map.addSource(COMPOSITE, { type: 'vector', tiles: [`${env.urlMartin}/${COMPOSITE}/{z}/{x}/{y}?${params}`] });
    map.addLayer({
      id: COMPOSITE_LAYER, type: 'line', source: COMPOSITE, 'source-layer': COMPOSITE_SOURCE_LAYER,
      paint: {
        'line-color': metric === 'prob' ? PROB_COLOR : RATIO_COLOR,
        'line-width': LINE_WIDTH,
        'line-opacity': metric === 'prob' ? maskOpacity(mask) : 1,
      },
    }, HIT_LAYER);
    this.applyView();
    // MapLibre toma una tesela 404 como vacía y no avisa: si la función aún no
    // existe en Martin, su TileJSON da 404 y se dice en la leyenda. Los tramos
    // quedan en gris (sin dato), sin romper la vista.
    const ok = await fetch(`${env.urlMartin}/${COMPOSITE}`).then(r => r.ok, () => false);
    if (!ok) { this.legend.update(phaseLabel, monthLabel, true, metric, mask); }
    return ok;
  }

  public async setProvinces(visible: boolean) {
    await this.ready;
    this.map.setLayoutProperty(PROVINCES, 'visibility', visible ? 'visible' : 'none');
  }

  public resize(): void { this.map.resize(); }
  public remove(): void { this.map.remove(); }
}
