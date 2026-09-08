/*****************************************************************************
 *                           HYDROPOWER COMPONENT                            *
 *****************************************************************************
 * Hydropower visualization and monitoring component.
 *
 * Responsibilities
 * ----------------
 * - Initializes and synchronizes three Leaflet maps with a common basemap.
 * - Loads hydropower plant basins (WFS) and station points (API).
 * - Displays time-enabled GOES satellite layers and manages playback controls.
 * - Integrates satellite-based precipitation products (IMERG, PERSIANN).
 * - Displays drought indices (e.g., Nalbantis) using WMS layers.
 * - Fetches and renders hydropower plots (observed and forecast) with Plotly.
 *
 * Key Features
 * ------------
 * - Multi-map synchronization (pan/zoom).
 * - Interactive time controls for GOES and precipitation layers.
 * - Dynamic legends and tooltips for enhanced visualization.
 * - Modular structure for hydropower, GOES, precipitation, drought, and plots.
 *
 * @author Juseth E. Chancay
 * @lastUpdated 2025-09-16
 */


/*****************************************************************************
 *                           LIBRARIES AND MODULES                           *
 *****************************************************************************/
// Angular
import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { provideMomentDateAdapter }
  from '@angular/material-moment-adapter';

// Third-party libraries
import * as L from 'leaflet';
import * as PlotlyJS from 'plotly.js-dist-min';
import { PlotlyModule } from 'angular-plotly.js';
PlotlyModule.plotlyjs = PlotlyJS;

// App environment
import { env } from '../../../environments/environment';

// App components
import { AppTemplateComponent }
  from '../../components/template/app-template.component';
import { DropdownComponent }
  from '../../components/dropdown/dropdown.component';
import { LoadingComponent }
  from '../../components/loading/loading.component';

// App modules & utilities
import { Geoserver } from '../../modules/geoserver';
import { WMSTimeControl } from '../../modules/wmsTimeControl';
import { Utils } from '../../modules/utils';
import { providers } from '../../modules/providers';

// App configuration
import { dataApp } from './hydropower.config';



/*****************************************************************************
 *                           COMPONENT DEFINITION                            *
 *****************************************************************************/
@Component({
  selector: 'app-hydropower',
  standalone: true,
  providers: [
      provideMomentDateAdapter(new providers().dateFormat)
    ],
  imports: [
    CommonModule,
    FormsModule,
    AppTemplateComponent,
    DropdownComponent,
    MatFormField,
    MatSelect,
    MatOptionModule,
    MatLabel,
    MatButtonModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatInputModule,
    LoadingComponent,
    PlotlyModule
],
  templateUrl: './hydropower.component.html',
  styleUrl: './hydropower.component.css'
})


export class HydropowerComponent {
  /***************************************************************************
   *                             State variables                             *
   ***************************************************************************/

  /** ViewChilds for template references */
  @ViewChild('panelDaily') panelPlot!: ElementRef;

  /** Leaflet instances */
  public map1!: L.Map;
  public map2!: L.Map;
  public map3!: L.Map;

  /** Utilities class instances */
  public dataAppConfig = new dataApp();
  public geoserver = new Geoserver();
  public utils = new Utils();
  public timeControl1: WMSTimeControl | undefined;
  public timeControl2: WMSTimeControl | undefined;
  public timeControl3: WMSTimeControl | undefined;
  public isPlay:boolean = false;

  /** Hydropower module */
  public selectedHydropower:string = "Agoyán";
  public hydropowers:string[] = [
    "Agoyán",
    "Amaluza",
    "Coca Codo Sinclair",
    "Daule Peripa",
    "Delsitanisagua",
    "Mazar",
    "Minas San Francisco",
    "Pisayambo"
  ];
  public hydropowerLayer1: any;
  public hydropowerLayer2: any;
  public hydropowerLayer3: any;
  public hydropowerPoint1: any;
  public hydropowerPoint2: any;
  public hydropowerPoint3: any;

  /** GOES module */
  public goesData = this.dataAppConfig.goesData;
  public goesProducts: string[] = this.dataAppConfig.goesProducts;
  public goesBands: string[] = [];
  public selectedGoesProduct: string = this.goesProducts[0];
  public selectedGoesBand: string = "";
  public activeGoesProduct: string = "";
  public activeGoesBand:string = "";
  public isAutoUpdateGoes: boolean = false;
  public autoUpdateGoesFun: any;

  /** Satellite-based Precipitation module */
  public satellitePrecipitationProducts:string[] = [
    "PERSIANN PDIR",
    "IMERG EARLY RUN"
  ];
  public selectedSatellitePrecipitationProduct:string = "PERSIANN PDIR";
  public dateControlSatellitePrecipitation = new FormControl(new Date());
  public minDateSatellitePrecipitation = new Date('2025-01-01');
  public maxDateSatellitePrecipitation = new Date();

  /** Drought module */
  public droughtIndices: string[] = ["Streamflow Drought Index (SDI)"];
  public selectedDroughtIndex: string = "Streamflow Drought Index (SDI)";
  public dateControlDrought:any;
  public minDateDrought = new Date('2023-01-01');
  public maxDateDrought = new Date();

  /** Plot states */
  public isReadyDataPlot:boolean = false;
  public dailyAveragePlot:any;
  public forecastPlot:any;


  /***************************************************************************
   *                       Constructor and Lifecycle                         *
   ***************************************************************************/
  constructor(){
    const { start, end } = this.utils.getPreviousMonthRange()
    this.dateControlDrought = new FormControl(start)
    this.maxDateDrought = end;
  }

  ngOnInit() {
    this.initializeMap();
    this.updateHydropower();
    this.updateGOESBand();
    this.updateGOESLayer();
    this.updatePacum();
    this.getDroughtIndex();
    this.getHydrographPlot();
  }


  /***************************************************************************
   *                           Component Functions                           *
   ***************************************************************************/
  /**
   * Initializes Leaflet instances with base OSM and required layers.
   * Sets up click and cursor interaction.
   */
  public initializeMap() {
    // Create maps
    this.map1 = L.map('map-01', {
      center: [-1.7, -78.5],
      zoom: 7,
      zoomControl: false
    });
    this.map2 = L.map('map-02', {
      center: [-1.7, -78.5],
      zoom: 7,
      zoomControl: false
    });
    this.map3 = L.map('map-03', {
      center: [-1.7, -78.5],
      zoom: 7,
      zoomControl: false
    });

    // Base map
    const baseLayer = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    [this.map1, this.map2, this.map3].forEach(m => {
      L.tileLayer(baseLayer, { zIndex: -1 }).addTo(m);
    });

    // Synchronize movements and zoom
    const maps = [this.map1, this.map2, this.map3];

    maps.forEach((map, idx) => {
      map.on("move zoom", () => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        maps.forEach((otherMap, jdx) => {
          if (idx !== jdx) {
            otherMap.setView(center, zoom, { animate: false });
          }
        });
      });
    });

    // Adjust sizes after rendering
    setTimeout(() => {
      this.map1.invalidateSize();
      this.map2.invalidateSize();
      this.map3.invalidateSize();
    }, 10);
  }


  /**
   * Dictionary mapping hydropower plant names to the corresponding GeoServer
   * layer names.
   */
  private readonly HYDRO_LAYER: Record<string, string> = {
    'Agoyán': 'agoyan',
    'Amaluza': 'paute',
    'Coca Codo Sinclair': 'coca',
    'Daule Peripa': 'marcel_laniado',
    'Delsitanisagua': 'delsintanisagua',
    'Mazar': 'paute',
    'Minas San Francisco': 'jubones',
    'Pisayambo': 'delsintanisagua',
  } as const;


  /**
   * Builds a WFS request URL for a given GeoServer layer.
   * @param layerName - The name of the GeoServer layer.
   * @returns The complete WFS request URL in GeoJSON format.
   */
  private buildWfsUrl(layerName: string): string {
    const base = `${env.urlGeoserver}/ecuador/ows`;
    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: `ecuador:${layerName}`,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
    });
    return `${base}?${params.toString()}`;
  }

  /**
   * Creates a Leaflet GeoJSON layer for polygons/lines.
   * @param geojson - A GeoJSON FeatureCollection.
   * @returns A styled Leaflet GeoJSON layer.
   */
  private makeHydroWfsLayer(geojson: GeoJSON.FeatureCollection): L.GeoJSON {
    return L.geoJSON(geojson, {
      style: {
        color: '#000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0
      }
    });
  }

  /**
   * Creates a Leaflet GeoJSON layer for hydropower stations (points).
   * Each point is displayed as a red circle marker.
   * If the feature has a "hydropower" property, it is used as a tooltip.
   * @param geojson - A GeoJSON FeatureCollection.
   * @returns A Leaflet GeoJSON layer with point markers.
   */
  private makeHydroWfsPoint(geojson: GeoJSON.FeatureCollection): L.GeoJSON {
    return L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const marker = L.circleMarker(latlng, {
          radius: 4,
          fillColor: 'red',
          color: '#b30000',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.9
        });

        if (feature.properties && feature.properties['hydropower']) {
          marker.bindTooltip(
            String(feature.properties['hydropower']),
            {
              //permanent: true,
              direction: 'top',
              className: 'hydro-label'
            }
          );
        }
        return marker;
      }
    });
  }

  /**
   * Updates hydropower visualization across maps:
   * - Removes any existing layers.
   * - Fetches hydropower geometry (WFS) and station data (API).
   * - Adds polygon and point layers to all three maps.
   * - Fits the map view to the hydropower area.
   */
  public async updateHydropower(): Promise<void> {
    const layerName = this.HYDRO_LAYER[this.selectedHydropower] ?? '';

    this.hydropowerLayer1 && this.map1?.removeLayer(this.hydropowerLayer1);
    this.hydropowerLayer2 && this.map2?.removeLayer(this.hydropowerLayer2);
    this.hydropowerLayer3 && this.map3?.removeLayer(this.hydropowerLayer3);

    this.hydropowerPoint1 && this.map1?.removeLayer(this.hydropowerPoint1);
    this.hydropowerPoint2 && this.map2?.removeLayer(this.hydropowerPoint2);
    this.hydropowerPoint3 && this.map3?.removeLayer(this.hydropowerPoint3);

    const url = this.buildWfsUrl(layerName);
    const res = await fetch(url, {headers: {'Accept': 'application/json'}});
    let data: GeoJSON.FeatureCollection;
    data = await res.json();

    this.hydropowerLayer1 = this.makeHydroWfsLayer(data).addTo(this.map1)
    this.hydropowerLayer2 = this.makeHydroWfsLayer(data).addTo(this.map2)
    this.hydropowerLayer3 = this.makeHydroWfsLayer(data).addTo(this.map3)

    this.map1.fitBounds(this.hydropowerLayer1.getBounds());

    const point = await fetch(
      'https://services.geoglows.org/api/hydropowers/get-station' +
      `?hydropower=${this.selectedHydropower}`, {
       headers: { 'Accept': 'application/json' }
      });
    let dataPoint: GeoJSON.FeatureCollection;
    dataPoint = await point.json();

    this.hydropowerPoint1 = this.makeHydroWfsPoint(dataPoint).addTo(this.map1)
    this.hydropowerPoint2 = this.makeHydroWfsPoint(dataPoint).addTo(this.map2)
    this.hydropowerPoint3 = this.makeHydroWfsPoint(dataPoint).addTo(this.map3)
    this.getHydrographPlot();
  }






  /**
   * Updates the list of available GOES bands based on the selected product.
   * Defaults to band 13.
   */
  public updateGOESBand(): void {
    this.goesBands = Array.from(
      new Set(
        this.goesData
          .filter(item => item.Product === this.selectedGoesProduct)
          .map(item => item.Band)));
    this.selectedGoesBand = this.goesBands[12];
  }

  /**
   * Loads and displays GOES WMS layers for the selected band:
   * - Retrieves available dates from GeoServer ImageMosaic.
   * - Parses datetime values into readable labels.
   * - Generates layer titles with legend and date.
   * - Initializes the time control on map 1.
   */
  public async updateGOESLayer(): Promise<void> {
    const workspace = "goes";
    const store = Array.from(
      new Set(
        this.goesData
          .filter(item => item.Band === this.selectedGoesBand)
          .map(item => item.Code))
        )[0];
    const url = `${env.urlGeoserver}/${workspace}/wms`;
    const layers = await this.geoserver.getAvailableDatesFromImageMosaic(
      url,
      store
    );
    const dates = this.utils.parseGOESDatetime(layers);
    const wmsLayers = layers.map((layer) =>
       this.geoserver.getWMSFromImageMosaic(url, `${workspace}:${store}`
    , layer))

    const titles = dates.map((date) => `
      <b>${this.selectedGoesBand.replace(":", ":<br>")}</b><br>
      <b>Fecha y hora:</b> ${date}
      <img src="/assets/legend/${store}.png" width="270px" />
    `);
    this.timeControl1?.destroy();
    this.timeControl1 = new WMSTimeControl(
      this.map1,
      wmsLayers,
      undefined,
      "",
      titles,
      true
    );
  }

  /**
   * Enables or disables automatic GOES layer updates every 60 seconds.
   * When active, the layer is updated and animation resumes if playing.
   */
  public autoUpdateGoes(): void {
    if(this.isAutoUpdateGoes){
      this.autoUpdateGoesFun = setInterval(() => {
        this.updateGOESLayer().then(
          () => this.isPlay && this.timeControl1?.play()
        );
      }, 60000);
    }else{
      this.autoUpdateGoesFun && clearInterval(this.autoUpdateGoesFun);
    }
  }


  /**
   * Updates the satellite-based accumulated precipitation layer:
   * - Computes the date range from the selected control.
   * - Builds the WMS request with the correct product and aggregation.
   * - Displays the layer on map 2 with a title and legend.
   */
  public updatePacum(): void {
    let agg = "24";
    let product = "";
    let hh = 1;

    if(this.selectedSatellitePrecipitationProduct === "PERSIANN PDIR"){
      product = "persiann_pdir";
    }
    if(this.selectedSatellitePrecipitationProduct === "IMERG EARLY RUN"){
      product = "imerg_early_run";
    }

    if (this.dateControlSatellitePrecipitation.value) {
      const a = this.utils.getDateRangeGeoglows(
        this.dateControlSatellitePrecipitation.value
      );
      const startDate = a[0];

      const dateEnd = new Date(a[0]);
      dateEnd.setDate(dateEnd.getDate() - hh + 1);
      const yyyy = dateEnd.getFullYear();
      const mm = String(dateEnd.getMonth() + 1).padStart(2, '0');
      const dd = String(dateEnd.getDate()).padStart(2, '0');
      const endDate = `${yyyy}-${mm}-${dd}`

      const wmsLayer = L.tileLayer.wms(
        `${env.urlGeoserver}/satellite_based_precipitation/wms`, {
          layers: `satellite_based_precipitation:${product}_${agg}h`,
          format: 'image/png',
          transparent: true,
          version: '1.1.0',
          styles: '',
          srs: 'EPSG:3857',
          time: `${startDate}T00:00:00.000Z`
        } as L.WMSOptions & { time: string });

      this.timeControl2?.destroy();
      const title = `
        <b>Precipitacion acumulada</b><br>
        <b>Desde</b> ${endDate} 07:00 <b>hasta</b> ${startDate} 07:00 <br>
        <img
          src="/assets/legend/daily_precipitation.png"
          width="270px"
        />
      `;
      this.timeControl2 = new WMSTimeControl(
        this.map2,
        [wmsLayer],
        undefined,
        "",
        [title],
        true
      );
    }
  }


  /**
   * Displays the Nalbantis drought index for the selected month.
   * - Builds the WMS request with `viewparams` for the given date.
   * - Adds the legend with drought categories.
   * - Initializes the time control on map 3.
   */
  public getDroughtIndex(): void {

    const date = new Date(this.dateControlDrought.value)
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dateSTR = `${yyyy}-${mm}-01`

    const wmsLayer = L.tileLayer.wms(`${env.urlGeoserver}/postgis/wms`, {
        layers: 'postgis:nalbantis',
        format: 'image/png',
        transparent: true,
        version: '1.1.0',
        srs: 'EPSG:3857',
        viewparams: `dts:${dateSTR}`
      } as L.WMSOptions & { viewparams: string }
    );

    this.timeControl3?.destroy();
    const title = `
      <b>Índice de sequía <br>de Nalbantis</b><br>
      <b>Fecha:</b> ${dateSTR}<br>
      <div style="
              display: flex;
              align-items: center;
              font-size:11px;
              margin-bottom: 2px;">
        <div style="
              width: 25px;
              height: 10px;
              background: #FFFFFF;
              border: 1px solid #ccc;
              margin-right: 10px;"></div>
        <span>Sin sequía</span>
      </div>
      <div style="
              display: flex;
              align-items: center;
              font-size:11px;
              margin-bottom: 2px;">
        <div style="
              width: 25px;
              height: 10px;
              background: #FDFFCC;
              border: 1px solid #ccc;
              margin-right: 10px;"></div>
        <span>Sequía leve</span>
      </div>
      <div style="
              display: flex;
              align-items: center;
              font-size:11px;
              margin-bottom: 2px;">
        <div style="
              width: 25px;
              height: 10px;
              background: #FFF200;
              border: 1px solid #ccc;
              margin-right: 10px;"></div>
        <span>Sequía moderada</span>
      </div>
      <div style="
              display: flex;
              align-items: center;
              font-size:11px;
              margin-bottom: 2px;">
        <div style="
              width: 25px;
              height: 10px;
              background: #FF9900;
              border: 1px solid #ccc;
              margin-right: 10px;"></div>
        <span>Sequía severa</span>
      </div>
      <div style="
              display: flex;
              align-items: center;
              font-size:11px;
              margin-bottom: 0px;
              padding:0px">
        <div style="
              width: 25px;
              height: 10px;
              background: #FF2A00;
              border: 1px solid #ccc;
              margin-right: 10px;"></div>
        <span>Sequía extrema</span>
      </div>
      `;
    this.timeControl3 = new WMSTimeControl(
      this.map3,
      [wmsLayer],
      undefined,
      "",
      [title],
      true
    );
  }


  /**
   * Fetches and renders hydropower plots (observed and forecast):
   * - Computes the plot dimensions from the panel size.
   * - Calls the API to get observed and forecast data.
   * - Updates component properties with plot data.
   * - Sets readiness flag once data is loaded.
   */
  public getHydrographPlot(): void {
    this.isReadyDataPlot = false;
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`

    setTimeout(() => {
      const elementWidth = this.panelPlot.nativeElement.offsetWidth;
      const elementHeight = this.panelPlot.nativeElement.offsetHeight - 100;
      const urltemp1 = `${env.urlAPI}/hydropowers/get-observed-data-plot` +
            `?hydropower=${this.selectedHydropower}` +
            `&width=${elementWidth}`+
            `&height=${elementHeight}`;
      fetch(urltemp1)
        .then(response => response.text())
        .then(text => {
          const fixedText = text.replace(/NaN/g, 'null');
          return JSON.parse(fixedText);
        })
        .then((response) => {
          this.dailyAveragePlot = response.hs;
        })

      const urltemp2 = `${env.urlAPI}/hydropowers/get-forecast-plot` +
            `?hydropower=${this.selectedHydropower}` +
            `&width=${elementWidth}`+
            `&height=${elementHeight}`+
            `&date=${dateStr}`;
      fetch(urltemp2)
        .then(response => response.text())
        .then(text => {
          const fixedText = text.replace(/NaN/g, 'null');
          return JSON.parse(fixedText);
        })
        .then((response) => {
          this.forecastPlot = response.fp;
          this.isReadyDataPlot = true;
        })
    }, 300)
  }

  public getHydrographCSV(): void {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`

    setTimeout(() => {
      const urltemp2 = `${env.urlAPI}/hydropowers/get-forecast-csv` +
            `?hydropower=${this.selectedHydropower}` +
            `&date=${dateStr}`;
      window.location.href = urltemp2;
    }, 300)
  }


  /***************************************************************************
   *                         Time Control Functions                          *
   ***************************************************************************/
  /**
   * Toggles the time animation control for GOES layers:
   * - Pauses if currently playing.
   * - Plays if currently paused.
   */
  public playTimeControl(): void {
    if (this.isPlay) {
      this.timeControl1?.pause();
      this.isPlay = false;
    } else {
      this.timeControl1?.play();
      this.isPlay = true;
    }
  }

  /**
   * Steps one frame backward in the time animation.
   */
  public previousTimeControl(): void {
    this.timeControl1?.previous();
  }

  /**
   * Steps one frame forward in the time animation.
   */
  public nextTimeControl(): void {
    this.timeControl1?.next();
  }

  /**
   * Stops and destroys the time control. Also sets the state to not playing.
   */
  public stopTimeControl(): void {
    this.timeControl1 !== undefined && this.timeControl1.destroy();
    this.isPlay = false;
  }

}
