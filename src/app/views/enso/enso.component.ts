/*****************************************************************************
 *                              ENSO ECUADOR                                 *
 *****************************************************************************
 * Tablero (patrón B de la skill geoglows-frontend) para vigilar El Niño desde
 * el Ecuador: estado del ENSO en el panel, anomalía de TSM del Pacífico
 * (WMS animado), caudal esperado por río según la fase (Martin), índices y
 * Hovmöller de ondas Kelvin. Contrato de la API: docs/plan-enso.md, sección 6.
 *
 * - enso.config.ts: listas de los selectores, colores y umbrales.
 * - enso.map.ts: mapa del Pacífico (Leaflet) y de Ecuador (MapLibre).
 * - enso.mock.ts: respuestas de ejemplo con localStorage 'enso_mock' = '1'.
 *****************************************************************************/
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import * as L from 'leaflet';
import * as PlotlyJS from 'plotly.js-dist-min';
import { PlotlyModule } from 'angular-plotly.js';
PlotlyModule.plotlyjs = PlotlyJS;

import { env } from '../../../environments/environment';
import { AppTemplateComponent } from '../../components/template/app-template.component';
import { DropdownComponent } from '../../components/dropdown/dropdown.component';
import { LoadingComponent } from '../../components/loading/loading.component';
import { Geoserver } from '../../modules/geoserver';
import { WMSTimeControl } from '../../modules/wmsTimeControl';
import * as cfg from './enso.config';
import { createPacificMap, EcuadorMap } from './enso.map';
import { mockFetch } from './enso.mock';

type CellKey = 'index' | 'hovmoller' | 'composite' | 'analogs' | 'icen';
interface PlotCell { state: 'loading' | 'ready' | 'empty'; plot?: any; }
interface StatusCard { title: string; value: string; extra: string; label: string; date: string; color: string; }

/** "+1,12 °C" o "−0,85 °C": signo explícito (menos tipográfico) y coma decimal. */
function formatValue(v: any): string {
  if (v === null || v === undefined || isNaN(Number(v))) { return '—'; }
  const n = Number(v);
  return `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',').replace('-', '−')} °C`;
}

/** Fase de una tarjeta: la que manda la API o, si no la manda, por los umbrales [frío, cálido]. */
function phaseClass(phase: string | undefined, value: any, [cold, warm]: [number, number]): cfg.PhaseClass {
  const p = (phase ?? '').toLowerCase();
  if (/calid|el_ni[nñ]o|warm/.test(p)) { return 'warm'; }
  if (/fr[ií]a|la_ni[nñ]a|cold/.test(p)) { return 'cold'; }
  if (p || value === null || value === undefined) { return 'neutral'; }
  return value >= warm ? 'warm' : value < cold ? 'cold' : 'neutral';
}

/** Quita el tamaño fijo para que el gráfico ocupe su celda y se reajuste con el panel. */
function fitToCell(plot: any): any {
  const layout = { ...plot.layout, autosize: true };
  delete layout.width;
  delete layout.height;
  return { data: plot.data, layout };
}

/**
 * El backend arma los gráficos con el tema oscuro del tablero; el modal es
 * blanco, así que se pasan a fondo blanco, letra #333 y ejes grises, como
 * los de Hydroviewer. Ancho fijo: el modal está oculto cuando se pintan.
 */
function lightTheme(plot: any, width: number): any {
  const dark = (o: any) => o ? { ...o, color: '#333' } : o;
  const layout: any = { ...plot.layout, width, height: 400, autosize: false,
    paper_bgcolor: 'white', plot_bgcolor: 'white', font: { ...plot.layout?.font, color: '#333' } };
  if (layout.legend) { layout.legend = { ...layout.legend, font: dark(layout.legend.font) }; }
  Object.keys(layout).filter(k => /^[xy]axis\d*$/.test(k)).forEach(k => {
    const ax = layout[k];
    layout[k] = { ...ax, linecolor: 'gray', tickcolor: 'gray', tickfont: dark(ax.tickfont),
      title: typeof ax.title === 'object' ? { ...ax.title, font: dark(ax.title.font) } : ax.title };
  });
  const data = (plot.data ?? []).map((t: any) => !t.colorbar ? t : { ...t, colorbar: {
    ...t.colorbar, tickfont: { ...t.colorbar.tickfont, color: '#333' },
    title: typeof t.colorbar.title === 'object' ? { ...t.colorbar.title, font: { ...t.colorbar.title.font, color: '#333' } } : t.colorbar.title,
  } });
  return { data, layout };
}


@Component({
  selector: 'app-enso',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule,
    PlotlyModule, AppTemplateComponent, DropdownComponent, LoadingComponent,
  ],
  templateUrl: './enso.component.html',
  styleUrl: './enso.component.css'
})
export class EnsoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('template') template!: AppTemplateComponent;
  @ViewChild('indexCell') indexCell!: ElementRef<HTMLElement>;
  @ViewChild('hovmollerCell') hovmollerCell!: ElementRef<HTMLElement>;
  @ViewChild('modalWidth') modalWidth!: ElementRef<HTMLElement>;

  public readonly cfg = cfg;
  /** El panel arranca cerrado en móvil para que el contenido no quede en 60 px. */
  public isPanelActive: boolean = window.innerWidth >= cfg.NARROW_SCREEN;

  /** Estado del ENSO */
  public statusCards: StatusCard[] | null = null;
  public statusFailed = false;

  /** Pacífico: anomalía de TSM */
  public sstDays = 60;
  public sstMessage = '';
  public isPlay = false;
  private pacific!: L.Map;
  private regions!: L.GeoJSON;
  private timeControl?: WMSTimeControl;
  private geoserver = new Geoserver();

  /** Ecuador: caudal esperado */
  public phase = 'neutra';
  public month = new Date().getMonth() + 1;
  private ecuador!: EcuadorMap;

  /** Índices */
  public index = 'icen_prov';
  public years = 20;

  /** Capas */
  public showProvinces = true;
  public showRegions = true;

  /** Gráficos del tablero y del modal */
  public cells: Record<CellKey, PlotCell> = {
    index: { state: 'loading' }, hovmoller: { state: 'loading' },
    composite: { state: 'loading' }, analogs: { state: 'loading' }, icen: { state: 'loading' },
  };
  private seq: Record<string, number> = {};
  public river = { comid: '', river: '', province: '', canton: '' };
  public analogYears: number[] = [];
  public csvError = false;

  /** Modo de prueba sin API (ver enso.mock.ts). */
  private readonly mock = (() => {
    try { return localStorage.getItem('enso_mock') === '1'; } catch { return false; }
  })();


  ngAfterViewInit(): void {
    ({ map: this.pacific, regions: this.regions } = createPacificMap('map-pacific'));
    this.ecuador = new EcuadorMap('map-ecuador', L.Browser.mobile, p => this.openRiver(p));
    this.loadStatus().then(() => this.updateComposite());
    this.updateSst();
    this.updateIndexPlot();
    this.loadPlot('hovmoller', `hovmoller-plot?${this.cellSize(this.hovmollerCell)}`);
  }

  ngOnDestroy(): void {
    this.timeControl?.destroy();
    this.pacific?.remove();
    this.ecuador?.remove();
  }


  /*************************************************************************
   *                              Peticiones                               *
   *************************************************************************/
  private async api(path: string): Promise<Response> {
    const url = `${env.urlAPI}/enso/${path}`;
    const res = await (this.mock ? mockFetch(url) : fetch(url));
    if (!res.ok) { throw new Error(`HTTP ${res.status} en ${url}`); }
    return res;
  }

  /** La API puede mandar NaN, que no es JSON válido: se cambia por null (como Hydropower). */
  private async getJSON(path: string): Promise<any> {
    const text = await (await this.api(path)).text();
    return JSON.parse(text.replace(/\bNaN\b/g, 'null'));
  }

  /** Pide una figura y la deja en su celda; si falla, la celda dice "Sin datos por ahora". */
  private async loadPlot(key: CellKey, path: string, modalWidth?: number): Promise<any> {
    const id = this.seq[key] = (this.seq[key] ?? 0) + 1;
    // Sin reasignar si ya está cargando: evita un cambio de referencia en ngAfterViewInit.
    if (this.cells[key].state !== 'loading') { this.cells[key] = { state: 'loading' }; }
    try {
      const res = await this.getJSON(path);
      if (!res?.plot?.data) { throw new Error(`Respuesta sin gráfico en ${path}`); }
      if (id !== this.seq[key]) { return null; }
      const plot = modalWidth ? lightTheme(res.plot, modalWidth) : fitToCell(res.plot);
      this.cells[key] = { state: 'ready', plot };
      return res;
    } catch (error) {
      console.warn('ENSO:', error);
      if (id === this.seq[key]) { this.cells[key] = { state: 'empty' }; }
      return null;
    }
  }

  private cellSize(cell: ElementRef<HTMLElement>): string {
    const el = cell.nativeElement;
    // La API solo acepta enteros (un decimal responde 400).
    return `width=${Math.round(el.offsetWidth)}&height=${Math.round(el.offsetHeight)}`;
  }


  /*************************************************************************
   *                           Estado del ENSO                             *
   *************************************************************************/
  private async loadStatus(): Promise<void> {
    try {
      const s = await this.getJSON('status');
      const c = s.coastal ?? {}, g = s.global ?? {}, o = s.oni ?? {}, w = s.nino12_week ?? {};
      // Cada bloque puede venir null si no hay datos: su tarjeta dice "Sin datos" en gris.
      const card = (title: string, d: any, limits: [number, number], extra = '', date = (d.date ?? '').slice(0, 7)) => {
        const empty = d.value === null || d.value === undefined;
        const cls = empty ? 'neutral' : phaseClass(d.phase, d.value, limits);
        return { title, value: formatValue(d.value), extra,
                 label: empty ? 'Sin datos' : d.label ?? cfg.PHASE_LABELS[cls],
                 date: date || '—', color: cfg.PHASE_COLORS[cls] };
      };
      this.statusCards = [
        card(`Costa (ICEN ${c.index === 'icen' ? 'oficial' : 'provisional'})`, c, cfg.ICEN_LIMITS),
        card('Pacífico central (RONI)', g, cfg.ONI_LIMITS, o.value != null ? `(ONI ${formatValue(o.value)})` : ''),
        card('Niño 1+2 semanal', w, cfg.ICEN_LIMITS, '', w.date ? `semana del ${w.date.slice(0, 10)}` : ''),
      ];
      this.phase = c.phase_group ?? cfg.phaseGroupFromIcen(c.value);
    } catch (error) {
      console.warn('ENSO:', error);
      this.statusFailed = true;
    }
  }


  /*************************************************************************
   *                       Pacífico: anomalía de TSM                       *
   *************************************************************************/
  public async updateSst(): Promise<void> {
    this.timeControl?.destroy();
    this.timeControl = undefined;
    this.isPlay = false;
    const url = `${env.urlGeoserver}/${cfg.SST_WORKSPACE}/wms`;
    const all = (await this.geoserver.getAvailableDatesFromImageMosaic(url, cfg.SST_LAYER_NAME, this.sstDays))
      .map(d => d.trim()).filter(Boolean);
    if (!all.length) {
      this.sstMessage = 'La capa de temperatura del mar aún no está publicada';
      return;
    }
    this.sstMessage = '';
    // Una fecha de cada 4 contando desde la más reciente, para que siempre esté la última.
    const dates = all.filter((_, i) => (all.length - 1 - i) % cfg.SST_STEP === 0).slice(-cfg.SST_MAX_FRAMES);
    const layers = dates.map(d => this.geoserver.getWMSFromImageMosaic(url, cfg.SST_LAYER, d));
    const titles = dates.map(d => `
      <b>Anomalía de TSM (°C)</b><br>
      <b>Producto:</b> NOAA OISST v2.1<br>
      <b>Fecha:</b> ${d.slice(0, 10)}<br>
      <img style="padding-top: 7px" src="${cfg.SST_COLORBAR}" width="270px" alt="Escala de −6 a 6 °C"/>`);
    this.timeControl = new WMSTimeControl(this.pacific, layers, undefined, '', titles, true);
  }

  public playAnimation(): void {
    this.isPlay ? this.timeControl?.pause() : this.timeControl?.play();
    this.isPlay = !this.isPlay && !!this.timeControl;
  }
  public previousFrame(): void { this.timeControl?.previous(); }
  public nextFrame(): void { this.timeControl?.next(); }
  /** Detener: pausa y vuelve al primer cuadro, sin quitar la capa del mapa. */
  public stopAnimation(): void {
    this.timeControl?.pause();
    this.timeControl?.setStart();
    this.isPlay = false;
  }


  /*************************************************************************
   *                Ecuador, índices y capas del panel                     *
   *************************************************************************/
  public updateComposite(): void {
    const phase = cfg.PHASES.find(p => p.value === this.phase)?.label ?? this.phase;
    const month = cfg.MONTHS.find(m => m.value === this.month)?.label ?? String(this.month);
    this.ecuador.setComposite(this.phase, this.month, phase, month);
  }

  public updateIndexPlot(): void {
    this.loadPlot('index', `index-plot?index=${this.index}&years=${this.years}&${this.cellSize(this.indexCell)}`);
  }

  public toggleProvinces(): void { this.ecuador.setProvinces(this.showProvinces); }

  public toggleRegions(): void {
    this.showRegions ? this.regions.addTo(this.pacific) : this.regions.remove();
  }

  /** Al abrir o cerrar el panel cambia el ancho: mapas y gráficos se reajustan. */
  public onPanelToggle(isActive: boolean): void {
    this.isPanelActive = isActive;
    setTimeout(() => {
      this.pacific?.invalidateSize();
      this.ecuador?.resize();
      window.dispatchEvent(new Event('resize'));
    }, 250);
  }


  /*************************************************************************
   *                          Modal de un río                              *
   *************************************************************************/
  private openRiver(props: any): void {
    this.river = { comid: String(props.comid ?? ''), river: props.river ?? '',
                   province: props.province ?? '', canton: props.canton ?? '' };
    this.analogYears = [];
    this.csvError = false;
    (['composite', 'analogs', 'icen'] as CellKey[]).forEach(k => this.cells[k] = { state: 'loading' });
    this.template.showDataModal();

    // Como Hydroviewer: se mide el ancho cuando el modal ya está abierto.
    setTimeout(() => {
      const width = Math.round(Math.max(this.modalWidth.nativeElement.offsetWidth - 30, 300));
      const size = `width=${width}&height=400`;
      const comid = encodeURIComponent(this.river.comid);
      this.loadPlot('composite', `composite-plot?comid=${comid}&${size}`, width).then(r => {
        if (r) {
          this.river = { ...this.river, river: r.river ?? this.river.river,
                         province: r.province ?? this.river.province, canton: r.canton ?? this.river.canton };
        }
      });
      this.loadPlot('analogs', `analogs-plot?comid=${comid}&${size}`, width)
        .then(r => this.analogYears = r?.years ?? []);
      this.loadPlot('icen', `icen-heatmap-plot?${size}`, width);
    }, 300);
  }

  public async downloadCsv(): Promise<void> {
    this.csvError = false;
    try {
      const blob = await (await this.api(`composite-csv?comid=${encodeURIComponent(this.river.comid)}`)).blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `enso_caudal_${this.river.comid}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (error) {
      console.warn('ENSO:', error);
      this.csvError = true;
    }
  }
}
