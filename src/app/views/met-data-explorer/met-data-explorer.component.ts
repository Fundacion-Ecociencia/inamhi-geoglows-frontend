// TS MODULES AND LIBRARIES
import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormGroup, FormControl, FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import { MatInput } from '@angular/material/input'

// JS LIBRARIES
import * as L from 'leaflet';
import { VectorGridLoader } from '../../services/vector-grid-loader.service';
//import 'leaflet.vectorgrid'; // Import the leaflet.vectorgrid plugin
import * as PlotlyJS from 'plotly.js-dist-min';
import html2canvas from 'html2canvas';
import { PlotlyModule } from 'angular-plotly.js';
PlotlyModule.plotlyjs = PlotlyJS;

// Type declaration for leaflet.vectorgrid
//declare module 'leaflet' {
//  namespace vectorGrid {
//    function protobuf(url: string, options?: any): any;
//  }
//}

//let vectorGridLoaded = false;
//async function ensureVectorGrid() {
//  if (!vectorGridLoaded && !(L as any).vectorGrid?.protobuf) {
//    await import('leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.js');
//    vectorGridLoaded = true;
//  }
//}

import { ColorInterp } from '../../modules/colorInterpolate';

// CUSTOM COMPONENTS AND MODULES
import { AppTemplateComponent } from "../../components/template/app-template.component";
import { DropdownComponent } from '../../components/dropdown/dropdown.component';
import { LoadingComponent } from '../../components/loading/loading.component';
import { providers } from '../../modules/providers';
import { dataApp } from './met-data-explorer.config';
import { env } from '../../../environments/environment';
import { Utils } from '../../modules/utils';
import { WMSTimeControl } from '../../modules/wmsTimeControl';
import { Geoserver } from '../../modules/geoserver';
import { FileUploaderComponent } from "../../components/uploader/uploader.component";
import { MapExporter, GifBuilder, ExportError, downloadBlob, canvasToBlob } from '../../modules/mapExport';
import { format } from 'maplibre-gl';



@Component({
  selector: 'app-met-data-explorer',
  standalone: true,
  providers: [
        provideMomentDateAdapter(new providers().dateFormat)
  ],
  imports: [
    AppTemplateComponent,
    CommonModule,
    DropdownComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatLabel,
    MatSelect,
    MatOption,
    MatDatepickerModule,
    FormsModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
    //LoadingComponent,
    PlotlyModule,
    MatInput,
    FileUploaderComponent
],
  templateUrl: './met-data-explorer.component.html',
  styleUrl: './met-data-explorer.component.css'
})
export class MetDataExplorerComponent {

  // Components variables
  @ViewChild('template') template!: AppTemplateComponent;

  /** Utilities class instances */
  public utilsApp = new Utils();

  // Leaflet variables
  public map!: L.Map;
  public dataAppConfig = new dataApp();
  public geoserver = new Geoserver();

  // Satellite based product
  public satelliteData = this.dataAppConfig.satelliteData;
  public satelliteVariable: string[] = this.dataAppConfig.satelliteVariables;
  public selectedSatelliteVariable: string = this.satelliteVariable[0];
  public satelliteProducts: any = [];
  public selectedSatelliteProduct: string = "";
  public satelliteTemporal: any = [];
  public selectedSatelliteTemporal: string = "";
  public satelliteDateRange: FormGroup = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });
  public satelliteMinDate: Date = new Date(2004, 0, 1);
  public satelliteMaxDate: Date = new Date();

  // WRF forecast
  public forecastModels = this.dataAppConfig.models;
  public selectedForecastModel = this.forecastModels[0];
  public forecastData = this.dataAppConfig.modelData;
  public forecastVariables: any = [];
  public selectedForecastVariable: string = "";
  public forecastTemporal: any = [];
  public selectedForecastTemporal: string = "";
  public dateControlForecast = new FormControl(new Date());
  public minDateForecast = new Date('2025-11-25');
  public maxDateForecast = new Date();


  // GOES product
  public goesData = this.dataAppConfig.goesData;
  public goesProducts: string[] = this.dataAppConfig.goesProducts;
  public goesBands: string[] = [];
  public goesOverlay: string[] = this.dataAppConfig.goesOverlay;
  public selectedGoesProduct: string = this.goesProducts[0];
  public selectedGoesBand: string = "";
  public selectedGoesOverlay: string = this.dataAppConfig.goesOverlay[0];
  public activeGoesProduct: string = "";
  public activeGoesBand:string = "";
  public activeGoesOverlay:string = "";
  public isAutoUpdateGoes: boolean = false;
  public autoUpdateGoesFun: any;

  /** Meteo Warnings */
  public meteoWarningsMetaData:any;
  public meteoWarningTypes:string[] = [];
  public meteoWarningStartDates:string[] = [];
  public meteoWarningEndDates:string[] = [];
  public selectedMeteoWarningType:string = "";
  public meteoWarnings:string[] = [];
  public selectedMeteoWarning:string = "";


  /** FFGS */
  public FFGSProducts:string[] = [
    "Humedad del suelo",
    "Precipitación crítica",
    "Pronóstico de precipitación (prox. 24h)",
    "Riesgo de crecida (prox. 24h)"
  ];
  public selectedFFGSProduct:string = "Humedad del suelo";
  public dateControlFFGS = new FormControl(new Date());
  public minDateFFGS = new Date('2025-03-01');
  public maxDateFFGS = new Date();
  public FFGSRun:string[] = [ "01", "07", "13", "19" ];
  public selectedFFGSRun:string = "01";


  // Fire
  public pacum24Layer:any;
  public pacum24Legend:any;
  public isActivePacum24Layer:boolean = false;
  public noRainLayer:any;
  public noRainLegend:any;
  public isActiveNoRainLayer:boolean = false;
  public soilMoistureLayer:any;
  public soilMoistureLegend:any;
  public isActiveSoilMoistureLayer:boolean = false;
  public fireGOESLayer:any;
  public fireGOESLegend:any;
  public isActiveFireGOESLayer:boolean = false


  // Time control Layers
  public isPlay:boolean = false;
  public timeControl: WMSTimeControl | undefined;

  // Exportación del mapa (imagen y GIF)
  public isExporting:boolean = false;
  public exportStatus:string = '';
  // Leaflet 1.9 trae disable()/enable() en el control de zoom, pero @types/leaflet no los declara.
  private zoomControl!: L.Control.Zoom & { disable(): unknown; enable(): unknown };

  // Base layers
  public countriesLayer:any;
  public isActiveCountriesLayer:boolean = true;
  public provinceLayer: any;
  public isActiveProvinceLayer:boolean = true;
  public citiesLayer:any;
  public isActiveCitiesLayer:boolean = true;

  // SGR layers
  public floodRiskSGRLayer:any;
  public isActiveFloodRiskSGRLayer:boolean = false;
  public droughtRiskSGRLayer:any;
  public isActiveDroughtRiskSGRLayer:boolean = false;
  public landSlidesRiskSGRLayer:any;
  public isActiveLandSlidesRiskSGRLayer:boolean = false;

  // MAE layers (protected areas)
  public corredorConectividadLayer:any;
  public isActiveCorredorConectividadLayer:boolean = false;
  public recargaHidricaLayer:any;
  public isActiveRecargaHidricaLayer:boolean = false;
  public proteccionHidricaLayer:any;
  public isActiveProteccionHidricaLayer:boolean = false;
  public humedalRamsarLayer:any;
  public isActiveHumedalRamsarLayer:boolean = false;
  public reservaBiosferaLayer:any;
  public isActiveReservaBiosferaLayer:boolean = false;
  public socioBosqueLayer:any;
  public isActiveSocioBosqueLayer:boolean = false;
  public bosqueProtectorLayer:any;
  public isActiveBosqueProtectorLayer:boolean = false;
  public areasProtegidasLayer:any;
  public isActiveAreasProtegidasLayer:boolean = false;

  // Hydropowers
  public hydropowerLayer:any;
  public isActiveHydropowerLayer:boolean = false;
  public pauteLayer:any;
  public isActivePauteLayer:boolean = false;
  public cocaCodoLayer:any;
  public isActiveCocaCodoLayer:boolean = false;
  public minasSanFranciscoLayer:any;
  public isActiveMinasSanFranciscoLayer:boolean = false;
  public agoyanLayer:any;
  public isActiveAgoyanLayer:boolean = false;
  public delsintanisaguaLayer:any;
  public isActiveDelsintanisaguaLayer:boolean = false;
  public dueLayer:any;
  public isActiveDueLayer:boolean = false;


  // SNGR events
  public sngrEvents: string[] = this.dataAppConfig.sngrEvents;
  public selectedSngrEvent: string = this.dataAppConfig.sngrEvents[0];
  public sngrFilters: string[] = this.dataAppConfig.sngrFilters;
  public selectedSngrFilter: string = this.dataAppConfig.sngrFilters[0];
  public sngrEventDateRange: FormGroup = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });
  public sngrEventMinDate: Date = new Date(2025, 0, 1)
  public sngrEventMaxDate: Date = new Date();
  public sngrEventLayer:any;
  public sngrEventLegend:any;
  public sngrEventControler:any;




  // Downloads
  public activeLayerDownload: any;
  public activeDatesDownload: any;
  public activeInitdDownload: any;
  public activeTypeDownload: any;




  constructor(private formBuilder: FormBuilder, private vg: VectorGridLoader){}

  ngOnInit() {
    this.initializeMap();
    this.resizeMap();
    this.updateSatelliteProduct();
    this.updateSatelliteTemporal();
    this.initFormDate();
    this.updateGoesBand();
    this.initializedMeteoWarningControl();
    this.initializeWildfireLayers();
    this.updateSelectedForecastModel();
    this.updateSelectedForecastVariable();
  }




  public initializeMap() {
    // Base maps
    const osm = L.tileLayer(
      `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=${env.cartoKey}`, {
         zIndex: -1,
         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      });
    const carto = L.tileLayer(
      `https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png?key=${env.cartoKey}`, {
        zIndex: -1,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      });
    const baseMaps = {
      "Mapa claro": osm,
      'Mapa oscuro': carto
    };

    // Add base map
    this.map = L.map('map', {
      center: [-1.7, -78.5],
      zoom: 7,
      zoomControl: false,
    });
    osm.addTo(this.map);

    // Add controls
    L.control.layers(baseMaps, {}, { position: 'topright' }).addTo(this.map);
    this.zoomControl = L.control.zoom({ position: 'topright' }).addTo(this.map) as typeof this.zoomControl;

    // Add logo control
    const logoControl = new L.Control({ position: 'topleft' });
    logoControl.onAdd = () => {
      const image = document.createElement('img');
      image.className = "inamhi-logo";
      image.src = 'assets/img/inamhi-white-logo.png';
      return(image)
    }
    logoControl.addTo(this.map);


    //this.citiesLayer = L.tileLayer(
    //  'https://services.geoglows.org/martin/mvt_poblacion/{z}/{x}/{y}', {
    //    zIndex: 1100
    //  });
    //this.citiesLayer.addTo(this.map);
    //L.vectorGrid
    //.protobuf('https://services.geoglows.org/martin/mvt_poblacion/{z}/{x}/{y}', {
    //  vectorTileLayerStyles: {
    //    'points': {
    //      color: 'red',
    //      fill: true
    //    }
    //  }
    //})
    //.addTo(this.map);

    this.countriesLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:paises_sudamerica',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 1000
    });
    this.countriesLayer.addTo(this.map);

    this.provinceLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:provincias',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.provinceLayer.addTo(this.map);

    this.citiesLayer = L.tileLayer(
      `https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png?key=${env.cartoKey}`, {
       zIndex: 1001
    });
    this.citiesLayer.addTo(this.map);
    // 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png'
    // 'https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png'


    this.floodRiskSGRLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:flood2',
      format: 'image/png',
      transparent: true,
      version: '1.1.0',
      zIndex: 1
    });
    this.droughtRiskSGRLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:drought',
      format: 'image/png',
      transparent: true,
      version: '1.1.0',
      zIndex: 1
    });
    this.landSlidesRiskSGRLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:landslides',
      format: 'image/png',
      transparent: true,
      version: '1.1.0',
      zIndex: 1
    });
    this.corredorConectividadLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:corredor_conectividad',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.recargaHidricaLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:zonas_recarga_hidrica',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.proteccionHidricaLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:areas_protegidas',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.humedalRamsarLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:humedal_ramsar',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.reservaBiosferaLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:reserva_biosfera',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.socioBosqueLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:conservacion_socio_bosque',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.bosqueProtectorLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:bosque_vegetacion_protectora',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.areasProtegidasLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:sistema_nacional_areas_protegidas',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.hydropowerLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:hidroelectricas_mayores_50W',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 2000
    });
    this.pauteLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:paute',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.cocaCodoLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:coca',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.minasSanFranciscoLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:jubones',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.agoyanLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:agoyan',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.delsintanisaguaLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:delsintanisagua',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });
    this.dueLayer = L.tileLayer.wms(`${env.urlGeoserver}/ecuador/wms?`, {
      layers: 'ecuador:due',
      format: 'image/svg',
      transparent: true,
      version: '1.1.0',
      zIndex: 999
    });




  }

  public resizeMap(): void {
    setTimeout(() => { this.map.invalidateSize() }, 10);
  }

  /**
   * Turns layers on or off based on the state of their toggle.
   */
  public updateOverlayers(isActiveCondition:boolean, layer:any){
    !isActiveCondition ? layer.addTo(this.map) : this.map.removeLayer(layer);
  }




  // -------------------------------------------------------------------------//
  //                            SATELLITE PRODUCTS                            //
  // -------------------------------------------------------------------------//
  public updateSatelliteProduct(): void {
    const filtered = new Set<string>();
    this.satelliteData.forEach(item => {
      if (item.Variable === this.selectedSatelliteVariable) {
        filtered.add(item.Product)}});
    this.satelliteProducts = Array.from(filtered);
    this.selectedSatelliteProduct = this.satelliteProducts[0] || null;
  }

  public updateSatelliteTemporal(): void {
    const filtered = new Set<string>();
    this.satelliteData.forEach(item => {
      if (
        item.Variable === this.selectedSatelliteVariable &&
        item.Product === this.selectedSatelliteProduct
      ) {
        filtered.add(item.Temporal)}});
    this.satelliteTemporal = Array.from(filtered);
    this.selectedSatelliteTemporal = this.satelliteTemporal[0] || null;
  }

  private initFormDate(): void {
    const startDate = new Date();
    startDate.setDate(this.satelliteMaxDate.getDate() - 1)
    const endDate = new Date();
    endDate.setDate(this.satelliteMaxDate.getDate())
    this.satelliteDateRange = this.formBuilder.group({
      start: [startDate],
      end: [endDate]
    });
    this.sngrEventDateRange = this.formBuilder.group({
      start: [startDate],
      end: [endDate]
    });
  }

  public updateSatelliteLayer(){
    let layerCode = this.satelliteData.filter(
        (item) =>
          item.Variable === this.selectedSatelliteVariable &&
          item.Product === this.selectedSatelliteProduct &&
          item.Temporal === this.selectedSatelliteTemporal
      )[0].Code;
    let startDate = this.satelliteDateRange.value.start;
    let endDate = this.satelliteDateRange.value.end;

    let layers = this.utilsApp
      .generateSatelliteDates(
        startDate,
        endDate,
        this.selectedSatelliteTemporal)
      .map((date: any) => {
        const wmsLayer = L.tileLayer.wms(
          `${env.urlGeoserver}/satellite_based_precipitation/wms`, {
            layers: `satellite_based_precipitation:${layerCode}_24h`,
            format: 'image/png',
            transparent: true,
            version: '1.1.0',
            styles: '',
            srs: 'EPSG:3857',
            time: `${date}`,
            tileSize: 512
          } as L.WMSOptions & { time: string })
        return wmsLayer
      })

    let titles = this.utilsApp
      .generateSatelliteDates(
        startDate,
        endDate,
        this.selectedSatelliteTemporal,
        "display")
      .map((date: any) => {
        const startDate = date;
        const dateEnd = new Date(date);
        dateEnd.setDate(dateEnd.getDate());
        const yyyy = dateEnd.getFullYear();
        const mm = String(dateEnd.getMonth() + 1).padStart(2, '0');
        const dd = String(dateEnd.getDate()).padStart(2, '0');
        const endDate = `${yyyy}-${mm}-${dd}`
        const title = `
          <b>Precipitacion acumulada (mm)</b><br>
          <b>Producto:</b> ${this.selectedSatelliteProduct}<br>
          <b>Fecha válida:</b><br>
          De ${endDate} 07:00 a ${startDate} 07:00 <br>
          <img
            style="padding-top: 7px"
            src="assets/legend/daily_precipitation.png"
            width="270px"
          />`;
        return title
      })

    this.timeControl?.destroy();
    this.timeControl = new WMSTimeControl(
      this.map, layers, undefined, "", titles, true
    );
    this.activeLayerDownload = `${layerCode}_24h`;
    this.activeDatesDownload = this.utilsApp.generateSatelliteDates(
      startDate,
      endDate,
      this.selectedSatelliteTemporal,
      "api"
    );
    this.activeTypeDownload = "raster";
  }


  // -------------------------------------------------------------------------//
  //                             FORECAST MODELS                              //
  // -------------------------------------------------------------------------//
  public updateSelectedForecastModel(){
    this.forecastVariables = Array.from(
      new Set(
        this.forecastData
          .filter(item => item.Model === this.selectedForecastModel)
          .map(item => item.Variable)));
    this.selectedForecastVariable = this.forecastVariables[0];
  }

  public updateSelectedForecastVariable(){
    this.forecastTemporal = Array.from(
      new Set(
        this.forecastData
          .filter(item => item.Model === this.selectedForecastModel)
          .filter(item => item.Variable === this.selectedForecastVariable)
          .map(item => item.Temporal)));
    this.selectedForecastTemporal = this.forecastTemporal[0];
  }

  public updateForecastLayer(){
    const selectedForecastProduct = Array.from(
      new Set(
        this.forecastData
          .filter(item => item.Model === this.selectedForecastModel)
          .filter(item => item.Variable === this.selectedForecastVariable)
          .filter(item => item.Temporal === this.selectedForecastTemporal)
          .map(item => item.Code)))[0];
    const selectedForecastUnit = Array.from(
      new Set(
        this.forecastData
          .filter(item => item.Model === this.selectedForecastModel)
          .filter(item => item.Variable === this.selectedForecastVariable)
          .filter(item => item.Temporal === this.selectedForecastTemporal)
          .map(item => item.Tag)))[0];
    const initModelDate = this.dateControlForecast.value ?? new Date();
    const dates = this.utilsApp.computeForecastDate(initModelDate, "isoz", this.selectedForecastTemporal);
    const layers = dates.map((date: any) => {
        const wmsLayer = L.tileLayer.wms(
          `${env.urlGeoserver}/wrf/wms`, {
            layers: `wrf:${selectedForecastProduct}`,
            format: 'image/png',
            transparent: true,
            version: '1.1.0',
            styles: '',
            srs: 'EPSG:3857',
            time: `${date}`,
            dim_initd: `${dates[0]}`,
            tileSize: 512   // 4 teselas por fecha a escala país en vez de 12 (GOES ya usa 512)
          } as L.WMSOptions & { time: string, dim_initd: string})
        return wmsLayer
      });
    const dateStr = this.utilsApp.computeForecastDate(initModelDate, "display", this.selectedForecastTemporal);
    const dateInit = this.utilsApp.computeForecastDate(initModelDate, "init", this.selectedForecastTemporal);
    const titles = dateStr.map((date: any) => {
      const t = `
          <b>${this.selectedForecastModel}</b><br>
          <b>${this.selectedForecastVariable} ${this.selectedForecastTemporal} ${selectedForecastUnit}</b><br>
          <b>Inicialización:</b> ${dateInit[0]}<br>
          <b>Fecha de pronóstico:</b> ${date}<br>
          <img
            style="padding-top: 7px"
            src="assets/legend/${selectedForecastProduct}.png"
            width="270px"
          />`;
      return t
    })
    this.timeControl?.destroy();
    this.timeControl = new WMSTimeControl(
      this.map, layers, undefined, "", titles, false
    );

    this.activeLayerDownload = `${selectedForecastProduct}`;
    let initdate = new Date(dates[0]);
    initdate.setHours(initdate.getHours() + 5);
    const yyyyi = initdate.getFullYear();
    const mmi = String(initdate.getMonth() + 1).padStart(2, '0');
    const ddi = String(initdate.getDate()).padStart(2, '0');

    this.activeDatesDownload = dates.map((date: any) => {
      date = new Date(date);
      date.setHours(date.getHours() + 5);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const finaldate = `${yyyyi}${mmi}${ddi}_${yyyy}${mm}${dd}${hh}00`;
      return finaldate
    })
    this.activeTypeDownload = "raster";

  }







  // -------------------------------------------------------------------------//
  //                                   GOES                                   //
  // -------------------------------------------------------------------------//
  public updateGoesBand() {
    this.goesBands = Array.from(
      new Set(
        this.goesData
          .filter(item => item.Product === this.selectedGoesProduct)
          .map(item => item.Band)));
    this.selectedGoesBand = this.goesBands[0];
  }

  public async updateGoesLayer(){
    const isPlayBkp = this.isPlay;
    this.isPlay = false;
    const workspace = "goes";
    const store = this.goesData.filter(
        (item) =>
          item.Product === this.selectedGoesProduct &&
          item.Band === this.selectedGoesBand
      )[0].Code;
    console.log(store);
    const url = `${env.urlGeoserver}/${workspace}/wms`;
    const url2 = `${env.urlGeoserver}/postgis/wms`;
    const layers = await this.geoserver
                             .getAvailableDatesFromImageMosaic(url, store);
    const dates = this.utilsApp.parseGOESDatetime(layers);
    const wmsLayers = layers.map((layer) =>
      this.geoserver.getWMSFromImageMosaic(url, `${workspace}:${store}`, layer)
    )



    if (this.selectedGoesOverlay !== "None"){
      const overlay = this.goesData.filter(
        (item) => item.Product === this.selectedGoesOverlay)[0].Code;
      const wmsOverlays = layers.map(
        (layer) => this.geoserver
                       .getWMSFromViewOptions(url2, `postgis:${overlay}`, layer)
      );
      const titles = dates.map((date) => `
          <b>${this.selectedGoesBand.replace(":", ":<br>")}</b><br>
          <b>Fecha y hora:</b> ${date}
          <img src="/assets/legend/${store}.png" width="270px" style="margin-top:7px" />
          <img src="/assets/legend/${overlay}.png" width="270px" />
        `);
      this.timeControl?.destroy();
      this.timeControl = new WMSTimeControl(
        this.map,
        wmsLayers,
        wmsOverlays,
        "",
        titles,
        true
      );
    }else{
      const titles = dates.map((date) => `
        <b>${this.selectedGoesBand.replace(":", ":<br>")}</b><br>
        <b>Fecha y hora:</b> ${date}
        <img src="/assets/legend/${store}.png" width="270px" style="margin-top:7px" />
      `);
      this.timeControl?.destroy();
      this.timeControl = new WMSTimeControl(
        this.map,
        wmsLayers,
        undefined,
        "",
        titles,
        true
      );
    }
    this.isPlay = isPlayBkp;
    this.isPlay && this.timeControl?.play();

    this.activeLayerDownload = `${store}`;
    this.activeDatesDownload = layers.map((date: any) => {
      date = new Date(date);
      date.setHours(date.getHours() + 5);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const finaldate = `${yyyy}${mm}${dd}${hh}${min}`;
      return finaldate
    })
    this.activeTypeDownload = "raster";
  }

  /**
   * Enables or disables automatic GOES layer updates every 60 seconds.
   * When active, the layer is updated and animation resumes if playing.
   */
  public autoUpdateGoes(): void {
    if(this.isAutoUpdateGoes){
      this.autoUpdateGoesFun = setInterval(() => {
        this.updateGoesLayer();
      }, 30000);
    }else{
      this.autoUpdateGoesFun && clearInterval(this.autoUpdateGoesFun);
    }
  }




  // -------------------------------------------------------------------------//
  //                         METEOROLOGICAL WARNINGS                          //
  // -------------------------------------------------------------------------//
  /**
   * Fetches meteo warnings, normalizes invalid JSON tokens (NaN), updates
   * component state, and triggers the dependent UI update.
   */
  public initializedMeteoWarningControl(): void {
    fetch(`${env.urlAPI}/hydroviewer/get-meteo-warnings`)
      .then(response => response.text())
      .then(text => {
        const fixedText = text.replace(/NaN/g, 'null');
        return JSON.parse(fixedText);
      })
      .then(response => {
        this.meteoWarningsMetaData = response.result;

        this.meteoWarningTypes = [...new Set(
          this.meteoWarningsMetaData.map(
            (item: { type: any; }) => item.type
          ))
        ] as string[];

        this.meteoWarningStartDates = [...new Set(
          this.meteoWarningsMetaData.map(
            (item: { start: any; }) => item.start
          ))
        ] as string[];

        this.meteoWarningEndDates = [...new Set(
          this.meteoWarningsMetaData.map(
            (item: { end: any; }) => item.end
          ))
        ] as string[];

        this.selectedMeteoWarningType = this.meteoWarningTypes[0];
        this.onUpdateWarningType();
      });
  };

  public onUpdateWarningType(){
    const filtered = new Set<string>();
    this.meteoWarningsMetaData.forEach(
      (item: { type: string; warning: string; }) => {
        if (item.type === this.selectedMeteoWarningType) {
          filtered.add(item.warning)
        };
      });
    this.meteoWarnings = Array.from(filtered);
    this.selectedMeteoWarning = this.meteoWarnings[
      this.meteoWarnings.length - 1
    ];
  }


  public async updateMeteoWarningLayer() {

    const Lref: any = await this.vg.getLeaflet();   // <-- usa este
    const url = `${env.urlMartin}/mvt_meteo_warnings/{z}/{x}/{y}`+
                `?warning=${this.selectedMeteoWarning}`;
    const layerName = 'meteo_warnings';

    // Colores equivalentes a tu MapLibre:
    const fillColors: Record<string, string> = {
      'Medio': '#FFFF4D',
      'Alto': '#FFC44E',
      'Muy Alto': '#EF4C4D',
    };
    const lineColors: Record<string, string> = {
      'Crecida': '#17249c',
      'Incendio': '#9c1737',
      'Baja Temperatura': '#17249c',
    };

    const styleFn = (props: any) => {
      const lvl = props.level;
      // Oculta si no hay match
      if (!fillColors[lvl] && !lineColors[lvl]) {
        return { fill: false, stroke: false };
      }

      // Por defecto, dibuja el relleno + contorno
      // del relleno (Medio/Alto/Muy Alto)
      if (fillColors[lvl]) {
        return {
          fill: true,
          fillColor: fillColors[lvl],
          fillOpacity: 1,
          stroke: true,
          color: fillColors[lvl], // como tu fill-outline-color
          weight: 1,
          opacity: 1,
        };
      }

      // Si es un nivel de línea (Crecida/Incendio/Baja Temperatura)
      return {
        fill: false,
        stroke: true,
        color: lineColors[lvl],
        weight: 2,
        opacity: 1,
      };
    };

    const meteoWarningLayer = Lref.vectorGrid.protobuf(url, {
      vectorTileLayerStyles: { [layerName]: styleFn },
      rendererFactory: (L as any).canvas?.tile ?
                       (L as any).canvas.tile : undefined,
      interactive: true,
      getFeatureId: (f: any) =>
                     f.properties.id ?? f.properties.gid ?? `${f.id}`,
    });

    // Set initial date
    const startDate = new Set<string>();
    this.meteoWarningsMetaData.forEach((item: { start: string; warning: string; }) => {
      if (item.warning === this.selectedMeteoWarning) {
        startDate.add(item.start.replace("T", " ").replace(":00:00", ":00"))
      };
    });

    // Set final date
    const endDate = new Set<string>();
    this.meteoWarningsMetaData.forEach((item: { end: string; warning: string; }) => {
      if (item.warning === this.selectedMeteoWarning) {
        endDate.add(item.end.replace("T", " ").replace(":00:00", ":00"))
      };
    });

    let title = `
      <b>
        <i class="fa-solid fa-triangle-exclamation"></i>
        Advertencia No ${this.selectedMeteoWarning}.
      </b><br>
      <b>${this.selectedMeteoWarningType}</b><br>
      Válido desde ${Array.from(startDate)[0]}<br>
      hasta ${Array.from(endDate)[0]}
      <div
        style="
          display:flex;
          align-items:center;
          margin-bottom:2px;
          margin-top:8px;
        ">
        <div
          style="
            width:25px;
            height:15px;
            background:#FFFF4D;
            border:1px solid #ccc;
            margin-right:10px;
          "></div>
        <span>Nivel Medio</span>
      </div>
      <div
        style="
          display:flex;
          align-items:center;
          margin-bottom:2px;
        ">
        <div
          style="
            width:25px;
            height:15px;
            background:#FFC44E;
            border:1px solid #ccc;
            margin-right:10px;
          "></div>
        <span>Nivel Alto</span>
      </div>
      <div
        style="
          display:flex;
          align-items:center;
          margin-bottom:2px;
        ">
        <div
          style="
            width:25px;
            height:15px;
            background:#EF4C4D;
            border:1px solid #ccc;
            margin-right:10px;
          "></div>
        <span>Nivel Muy Alto</span>
      </div>`;

      if (this.selectedMeteoWarningType === 'Lluvias, tormentas y viento') {
        title = `${title}
        <div
          style="
            display:flex;
            align-items:center;
            margin-bottom:2px;
          ">
          <div
            style="
              width:25px;
              height:15px;
              background:#FFFFFF;
              border:3px solid #17249c;
              margin-right:10px;
            "></div>
          <span>Zonas propensas a crecidas</span>
        </div>`;
      } else {
        title = `${title}
        <div
          style="
            display:flex;
            align-items:center;
            margin-bottom:2px;
          ">
          <div
            style="
              width:25px;
              height:15px;
              background:#FFFFFF;
              border:3px solid #17249c;
              margin-right:10px;
            "></div>
          <span>Zonas propensas a heladas</span>
        </div>
        <div
          style="
            display:flex;
            align-items:center;
            margin-bottom:2px;
          ">
          <div
            style="
              width:25px;
              height:15px;
              background:#FFFFFF;
              border:3px solid #9c1737;
              margin-right:10px;
            "></div>
          <span>Zonas propensas a incendios</span>
        </div>`;
      }

    this.timeControl?.destroy();
    this.timeControl = new WMSTimeControl(
      this.map,
      [meteoWarningLayer],
      undefined,
      "",
      [title],
      true
    );

    this.activeTypeDownload = "meteo-warnings";
  }



  /***************************************************************************
   *                                  FFGS                                   *
   ***************************************************************************/
  private ffgsFieldFor(plot: string): string {
    switch (plot) {
      case 'Humedad del suelo': return 'asm';
      case 'Riesgo de crecida (prox. 24h)': return 'ffr';
      case 'Pronóstico de precipitación (prox. 24h)': return 'fmap';
      case 'Precipitación crítica': return 'ffg';
      default: return 'asm';
    }
  }

  private ffgsStopsFor(plot: string): Array<[number, string]> {
    if (plot === 'Humedad del suelo' ||
        plot === 'Riesgo de crecida (prox. 24h)') {
      return [
        [0.00, 'rgba(255,255,255,0)'],
        [0.01, '#F9F788'],
        [0.10, '#D6D309'],
        [0.20, '#B08C00'],
        [0.30, '#B6F8A9'],
        [0.40, '#1DD41C'],
        [0.50, '#005200'],
        [0.60, '#359AFF'],
        [0.70, '#0069D2'],
        [0.80, '#00367F'],
        [0.90, '#100053'],
        [1.00, '#000000'],
      ];
    }

    if (plot === 'Pronóstico de precipitación (prox. 24h)') {
      return [
        [0.000, 'rgba(255,255,255,0)'],
        [1.000, '#FFFFFF'],
        [1.010, '#75baff'],
        [3.750, '#359aff'],
        [7.500, '#0087ff'],
        [11.25, '#0674C6'],
        [15.00, '#0C608D'],
        [18.75, '#148f1b'],
        [22.50, '#1acf05'],
        [26.25, '#63ed07'],
        [30.00, '#B1F119'],
        [33.75, '#d5f775'],
        [37.50, '#fff42b'],
        [41.25, '#ffcb4d'],
        [45.00, '#fb9a6f'],
        [48.75, '#f96d73'],
        [52.50, '#f84e78'],
        [56.25, '#f71e54'],
        [60.00, '#bf0000'],
        [63.75, '#880000'],
        [67.50, '#640000'],
        [71.25, '#2d0000'],
        [75.00, '#2d0000'],
      ];
    }

    if (plot === 'Precipitación crítica') {
      return [
        [0.000, 'rgba(255,255,255,0)'],
        [1.000, '#2d0000'],
        [1.010, '#640000'],
        [3.750, '#880000'],
        [7.500, '#bf0000'],
        [11.25, '#f71e54'],
        [15.00, '#f84e78'],
        [18.75, '#f96d73'],
        [22.50, '#fb9a6f'],
        [26.25, '#ffcb4d'],
        [30.00, '#fff42b'],
        [33.75, '#d5f775'],
        [37.50, '#B1F119'],
        [41.25, '#63ed07'],
        [45.00, '#1acf05'],
        [48.75, '#148f1b'],
        [52.50, '#0C608D'],
        [56.25, '#0674C6'],
        [60.00, '#0087ff'],
        [63.75, '#359aff'],
        [67.50, '#75baff'],
        [71.25, '#FFFFFF'],
        [75.00, 'rgba(255,255,255,0)'],
      ];
    }
    return [[0, '#FFFFFF']];
  }


  private ffgsInterpolatedStyleFn(plot: string) {
    const field = this.ffgsFieldFor(plot);
    const stops = this.ffgsStopsFor(plot);

    return (props: any) => {
      const raw = props?.[field];
      const val = Number(raw);
      if (isNaN(val)) return { fill: false, stroke: false };

      const rgba = ColorInterp.interpolateStops(val, stops);
      if (rgba.a <= 0.02) return { fill: false, stroke: false };

      const css = ColorInterp.rgbaToCss(rgba);
      return {
        fill: true,
        fillColor: css,
        fillOpacity: 1,
        stroke: true,
        color: css,
        weight: 0.8,
        opacity: 1,
      };
    };
  }

  public async  updateFFGS(){
    const Lref: any = await this.vg.getLeaflet();   // <-- usa este

    const selectedDate = this.dateControlFFGS.value ?? new Date();
    const a = this.utilsApp.getDateRangeGeoglows(selectedDate);
    const queryDate = `${a[0]} ${this.selectedFFGSRun}:00:00`;
    const queryDate2 = `${a[0]} ${this.selectedFFGSRun}:00`;

    const url = `${env.urlMartin}/mvt_ffgs/{z}/{x}/{y}?datetime=${queryDate}`;
    const layerName = 'ffgs';

    let title = "";

    if(this.selectedFFGSProduct === "Humedad del suelo"){
      title = `
        <b><i class="fa-solid fa-house-flood-water"></i></b>
        <b>Flash Flood Guidance System</b><br>${this.selectedFFGSProduct}<br>
        Válido para ${queryDate2}
        <img
          src="assets/legend/asm.png"
          width="260px"
        />`;
    }
    if(this.selectedFFGSProduct === "Riesgo de crecida (prox. 24h)"){
      title = `
        <b><i class="fa-solid fa-house-flood-water"></i></b>
        <b>Flash Flood Guidance System</b><br>${this.selectedFFGSProduct}<br>
        Válido para ${queryDate2}
        <img
          src="assets/legend/asm.png"
          width="260px"
        />`;
    }
    if(this.selectedFFGSProduct === "Pronóstico de precipitación (prox. 24h)"){
      title = `
        <b><i class="fa-solid fa-house-flood-water"></i></b>
        <b>Flash Flood Guidance System</b><br>${this.selectedFFGSProduct}<br>
        Válido para ${queryDate2}
        <img
          src="assets/legend/daily_precipitation.png"
          width="260px"
        />`;
    }
    if(this.selectedFFGSProduct === "Precipitación crítica"){
      title = `
        <b><i class="fa-solid fa-house-flood-water"></i></b>
        <b>Flash Flood Guidance System</b><br>${this.selectedFFGSProduct}<br>
        Válido para ${queryDate2}
        <img
          src="assets/legend/ffg2.png"
          width="260px"
        />`;
    }

    const meteoWarningLayer = Lref.vectorGrid.protobuf(url, {
      vectorTileLayerStyles: {
        [layerName]: this.ffgsInterpolatedStyleFn(this.selectedFFGSProduct),
      },
      rendererFactory:
        (L as any).canvas?.tile ? (L as any).canvas.tile : undefined,
      interactive: true,
      getFeatureId: (f: any) =>
        f.properties?.id ?? f.properties?.gid ?? `${f.id}`,
    }).addTo(this.map);

    this.timeControl?.destroy();
    this.timeControl = new WMSTimeControl(
      this.map,
      [meteoWarningLayer],
      undefined,
      "",
      [title],
      true
    );

    this.activeTypeDownload = "ffgs";

  }



  public dropOverlays(){
    this.timeControl?.destroy();
  }









  /***************************************************************************
   *                            WILDFIRE MODULE                              *
   ***************************************************************************/

  public initializeWildfireLayers(){
    const dateNow = this.utilsApp.getCutoffDate();

    this.pacum24Layer = this.utilsApp
      .generateSatelliteDates(dateNow, dateNow, "Diaria")
      .map((date: any) => {
        const wmsLayer = L.tileLayer.wms(
          `${env.urlGeoserver}/satellite_based_precipitation/wms`, {
            layers: `satellite_based_precipitation:persiann_pdir_24h`,
            format: 'image/png',
            transparent: true,
            version: '1.1.0',
            styles: '',
            srs: 'EPSG:3857',
            time: `${date}`,
            tileSize: 512
          } as L.WMSOptions & { time: string })
        return wmsLayer
      })[0]

    this.noRainLayer = this.utilsApp
      .generateSatelliteDates(dateNow, dateNow, "Diaria")
      .map((date: any) => {
        const wmsLayer = L.tileLayer.wms(
          `${env.urlGeoserver}/satellite_based_precipitation/wms`, {
            layers: `satellite_based_precipitation:persiann_no_precipitation`,
            format: 'image/png',
            transparent: true,
            version: '1.1.0',
            styles: '',
            srs: 'EPSG:3857',
            time: `${date}`,
            tileSize: 512
          } as L.WMSOptions & { time: string })
        return wmsLayer
      })[0];

    this.soilMoistureLayer = L.tileLayer.wms(
      `${env.urlGeoserver}/ffgs/wms`, {
        layers: `ffgs:soil_moisture`,
        format: 'image/png',
        transparent: true,
        version: '1.1.0'
      })
  }




  public updatePacum24(){
    this.updateOverlayers(!this.isActivePacum24Layer, this.pacum24Layer);
    if(this.isActivePacum24Layer){
      const dateNow = this.utilsApp.getCutoffDate();
      let title = this.utilsApp
        .generateSatelliteDates(dateNow,dateNow,"Diaria","display")
        .map((date: any) => {
          const startDate = date;
          const dateEnd = new Date(date);
          dateEnd.setDate(dateEnd.getDate());
          const yyyy = dateEnd.getFullYear();
          const mm = String(dateEnd.getMonth() + 1).padStart(2, '0');
          const dd = String(dateEnd.getDate()).padStart(2, '0');
          const endDate = `${yyyy}-${mm}-${dd}`
          const title = `
            <b>Precipitacion diaria</b><br>
            <b>Desde</b> ${endDate} 07:00<br><b>hasta</b> ${startDate} 07:00<br>
            <img
              src="assets/legend/wrf_precipitation_daily.png"
              width="270px"
            />`;
          return title
        })[0];
      let {legendControl, legendElement} = this.utilsApp.createLegendControl();
      legendElement.innerHTML = title;
      this.pacum24Legend = legendControl.addTo(this.map);
    } else {
      this.pacum24Legend.remove();
    }
  }


  public updateNoRain(){
    this.updateOverlayers(!this.isActiveNoRainLayer, this.noRainLayer);
    if(this.isActiveNoRainLayer){
      const dateNow = this.utilsApp.getCutoffDate();
      const yyyy = dateNow.getFullYear();
      const mm = String(dateNow.getMonth() + 1).padStart(2, '0');
      const dd = String(dateNow.getDate()).padStart(2, '0');
      const title = `
        <b>Dias consecutivos sin lluvia significativa</b><br>
        <b>Última actualización:</b> ${yyyy}-${mm}-${dd} 07:00<br>
        <span style='font-size:10px; font-weigth:200'>
          *Se considera "sin lluvia significativa" a días con precipitación menor a 2mm
        </span>
        <img
          src="assets/img/days-without-precipitation.png"
          width="270px" />
      `;
      let {legendControl, legendElement} = this.utilsApp.createLegendControl();
      legendElement.innerHTML = title;
      this.noRainLegend = legendControl.addTo(this.map);
    } else {
      this.noRainLegend.remove();
    }
  }


  updateSoilMoisture(){
    this.updateOverlayers(!this.isActiveSoilMoistureLayer, this.soilMoistureLayer);

    if(this.isActiveSoilMoistureLayer){
      const dateNow = this.utilsApp.getCutoffDate();
      const yyyy = dateNow.getFullYear();
      const mm = String(dateNow.getMonth() + 1).padStart(2, '0');
      const dd = String(dateNow.getDate()).padStart(2, '0');
      const title = `
        <b>Humedad del suelo diaria (%)</b><br>
        <b>Última actualización:</b> ${yyyy}-${mm}-${dd} 07:00<br>
        <img
          src="assets/legend/asm.png"
          width="270px" />
      `;
      let {legendControl, legendElement} = this.utilsApp.createLegendControl();
      legendElement.innerHTML = title;
      this.soilMoistureLegend = legendControl.addTo(this.map);
    } else {
      this.soilMoistureLegend.remove();
    }
  }

  autoUpdateFireGOES(){
    if(this.isActiveFireGOESLayer){
      const url = `${env.urlAPI}/met-data-explorer/goes-hotspots`;
      fetch(url)
        .then((response) => response.json())
        .then((response) => {
          this.fireGOESLayer =  L.geoJSON(response, {
            pointToLayer: (feature, latlng) => {
              return L.marker(latlng, {
                icon: L.icon({
                  iconUrl: `assets/ico/M${feature.properties.diff}.svg`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                })
              });
            }
          }).addTo(this.map);
        })

      const title = `
        <img src="assets/legend/goes-hotspots.png" width="130px"/>`;
      let {legendControl, legendElement} = this.utilsApp.createLegendControl();
      legendElement.innerHTML = title;
      this.fireGOESLegend= legendControl.addTo(this.map);
    }else {
      this.fireGOESLayer !== undefined && this.map.removeLayer(this.fireGOESLayer);
      this.fireGOESLegend !== undefined && this.fireGOESLegend.remove();
    }
  }



  public updateSNGRevents(){
    const formatDatetime = (d: any): string =>
            d ? new Date(d).toISOString().slice(0, 10) : "";

    const startDate = formatDatetime(this.sngrEventDateRange.value.start);
    const endDate = formatDatetime(this.sngrEventDateRange.value.end);
    const event = this.selectedSngrEvent;
    const filter = this.selectedSngrFilter === "Fecha de actualización"
                      ? "update"
                      : "datetime";

    const url = `${env.urlAPI}/met-data-explorer/get-sngr-events`;

    fetch(`${url}?start=${startDate}&end=${endDate}&event=${event}&filtertime=${filter}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} - ${res.statusText}`);
        }
        return res.json();
      })
      .then((geojson) => {
        if (!geojson || (geojson.type !== "FeatureCollection" && geojson.type !== "Feature")) {
          throw new Error("Respuesta no válida: no parece GeoJSON.");
        }

        this.sngrEventLayer !== undefined && this.map.removeLayer(this.sngrEventLayer);
        this.sngrEventLegend !== undefined && this.sngrEventLegend.remove();

        this.sngrEventLayer = L.geoJSON(geojson, {
          pointToLayer: (feature, latlng) => {
            const iconName = feature?.properties?.icon ?? "default.svg";
            return L.marker(latlng, {
              icon: L.icon({
                iconUrl: `assets/ico/${iconName}`,
                iconSize: [20, 16],
                iconAnchor: [8, 8],
              }),
            });
          },

          onEachFeature: (feature, layer) => {
            const code = feature?.properties?.code ?? "Sin código";
            const province = feature?.properties?.province ?? "";
            const canton = feature?.properties?.canton ?? "";
            const county = feature?.properties?.county ?? "";
            const sector = feature?.properties?.sector ?? "";
            const latitude = feature?.properties?.latitude ?? "";
            const longitude = feature?.properties?.longitude ?? "";
            const datetime = feature?.properties?.datetime ?? "";
            const update = feature?.properties?.update ?? "";
            const cause = feature?.properties?.cause ?? "";
            const status = feature?.properties?.status ?? "";

            layer.bindPopup(`
              <div style="font-size:14px;"><b>${this.selectedSngrEvent}</b></div>
              <div style="font-size:11px; max-width:240px; line-height:1.5">
                <b>Código del evento:</b> ${code}<br>
                <b>Provincia:</b> ${province}<br>
                <b>Cantón:</b> ${canton}<br>
                <b>Parroquia:</b> ${county}<br>
                <b>Localidad:</b> ${sector}<br>
                <b>Latitud:</b> ${latitude}<br>
                <b>Longitud:</b> ${longitude}<br>
                <b>Fecha del evento:</b> ${datetime}<br>
                <b>Fecha de actualización:</b> ${update}<br>
                <b>Causa:</b> ${cause}<br>
                <b>Estado:</b> ${status}<br>
              </div>
            `);
          },
        }).addTo(this.map);

        const title = `<img src="assets/legend/${event}.png" width="150px"/>`;
        let {legendControl, legendElement} = this.utilsApp.createLegendControl();
        legendElement.innerHTML = title;
        this.sngrEventLegend = legendControl.addTo(this.map);

      })
      .catch((err) => {
        this.sngrEventLayer !== undefined && this.map.removeLayer(this.sngrEventLayer);
        this.sngrEventLegend !== undefined && this.sngrEventLegend.remove();
      });

    this.activeTypeDownload = "sngr";
  }


  public downloadSNGREvents(filename = 'sngr_events.geojson'): void {
    if(this.sngrEventLayer){
      const data = this.sngrEventLayer.toGeoJSON(); // FeatureCollection
      const json = JSON.stringify(data, null, 2);

      const blob = new Blob([json], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      alert("No se tiene ninguna capa activa en el mapa.")
    }
  }



  public autoUpdateSNGRevents(){
    if (this.sngrEventControler !== null) {
      clearInterval(this.sngrEventControler);
      this.sngrEventControler = null;
    }
    this.updateSNGRevents();
    this.sngrEventControler = setInterval(() => {
        this.updateSNGRevents();
        console.log("Updating SNGR data...")
      }, 1 * 60 * 1000); // 5 minutes
  }

  public removeSNGRevents(){
    if (this.sngrEventControler !== null) {
      clearInterval(this.sngrEventControler);
      this.sngrEventControler = null;
    }
    this.sngrEventLayer !== undefined && this.map.removeLayer(this.sngrEventLayer);
    this.sngrEventLegend !== undefined && this.sngrEventLegend.remove();
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
      this.timeControl?.pause();
      this.isPlay = false;
    } else {
      this.timeControl?.play();
      this.isPlay = true;
    }
  }

  /**
   * Steps one frame backward in the time animation.
   */
  public previousTimeControl(): void {
    this.timeControl?.previous();
  }

  /**
   * Steps one frame forward in the time animation.
   */
  public nextTimeControl(): void {
    this.timeControl?.next();
  }

  /**
   * Stops and destroys the time control. Also sets the state to not playing.
   */
  public stopTimeControl(): void {
    this.timeControl !== undefined && this.timeControl.destroy();
    this.isPlay = false;
  }








  public async downloadRaster(){
    console.log("Descargando datos...")
    if (this.activeTypeDownload === "raster"){
      const layer = this.activeLayerDownload;
      const index = this.timeControl?.currentDateIndex ?? 0;
      const datetime = this.activeDatesDownload[index];

      console.log(`Downloading layer: ${layer} datetime: ${datetime}`)

      const url =
        "https://services.geoglows.org/api/met-data-explorer/donwload-geotiff" +
        `?layer=${encodeURIComponent(layer)}` +
        `&datetime=${encodeURIComponent(datetime)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${layer}_${datetime}.tif`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    if(this.activeTypeDownload === "meteo-warnings"){
      const url = `https://services.geoglows.org/api/met-data-explorer/get-meteo-warnings?no=${this.selectedMeteoWarning}`;

      const res = await fetch(url, { method: "GET", headers: { Accept: "application/geo+json, application/json"} });

      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}: ${res.statusText}`);
      }

      // Si el API responde JSON (FeatureCollection)
      const data = await res.json();

      // Guardar como archivo .geojson
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/geo+json",
      });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `meteo_warnings_no_${this.selectedMeteoWarning}.geojson`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }

    if(this.activeTypeDownload === "ffgs"){
      const selectedDate = this.dateControlFFGS.value ?? new Date();
      const ab = this.utilsApp.getDateRangeGeoglows(selectedDate);

      const url = `https://services.geoglows.org/api/met-data-explorer/get-ffgs-data?date=${ab[0]}&hour=${this.selectedFFGSRun}`;
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/geo+json, application/json"} });

      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}: ${res.statusText}`);
      }

      // Si el API responde JSON (FeatureCollection)
      const data = await res.json();

      // Guardar como archivo .geojson
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/geo+json",
      });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ffgs.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }

    if(this.activeTypeDownload === "sngr"){
      this.downloadSNGREvents()
    }
  }


  //public activeDatesDownload: any;
  //public activeInitdDownload: any;
  //public activeTypeDownload: any;




  /**
   * Descarga una imagen PNG del mapa tal como se ve (capas, logo y leyenda), sin los controles de
   * pantalla, para presentaciones. Al doble de resolución para que la leyenda se lea nítida.
   */
  public async captureMap(){
    if (this.isExporting) return;
    this.isExporting = true;
    this.exportStatus = 'Generando imagen...';
    const tc = this.timeControl;
    const wasLive = !!tc && !tc.destroyed;
    const resumePlayback = this.pausePlayback(tc);
    const fileName = this.exportFileName('png');
    const exporter = new MapExporter(this.map);
    try {
      const canvas = await exporter.render(2);
      // Las teselas se leen antes que la leyenda: si en medio se cargó otra capa, saldrían mezcladas.
      if (this.timeControl !== tc || (wasLive && tc!.destroyed)) {
        throw new ExportError('La capa cambió mientras se generaba la imagen. Vuelva a intentarlo.');
      }
      downloadBlob(await canvasToBlob(canvas), fileName);
      this.warnMissingImages(exporter);
    } catch (error) {
      console.error('Error al generar la imagen del mapa', error);
      alert(error instanceof ExportError ? error.message : 'No se pudo generar la imagen del mapa.');
    } finally {
      exporter.dispose();
      resumePlayback();
      this.isExporting = false;
      this.exportStatus = '';
    }
  }

  /**
   * Descarga un GIF que repite la animación de la capa activa: un cuadro por fecha, en el mismo
   * orden que el botón de reproducir. Al terminar deja el mapa en la fecha en que estaba.
   */
  public async captureVideo(){
    if (this.isExporting) return;
    const tc = this.timeControl;
    if (!tc || tc.destroyed || tc.layers.length < 2) {
      alert('Para el GIF hace falta una capa animada con más de una fecha (satélite, pronóstico o GOES).');
      return;
    }

    this.isExporting = true;
    const startIndex = tc.currentDateIndex;
    const resumePlayback = this.pausePlayback(tc);
    const restoreInteraction = this.lockMap();
    const exporter = new MapExporter(this.map);
    const gif = new GifBuilder();
    const total = tc.layers.length;
    const fileName = this.exportFileName('gif');

    try {
      for (let i = 0; i < total; i++) {
        this.exportStatus = `Generando GIF: cuadro ${i + 1} de ${total}`;
        tc.goTo(i);
        await tc.whenReady(i);
        const canvas = await exporter.render(1);
        // Se comprueba después de las esperas de cada cuadro, también del último: si en medio se cargó
        // otra capa (o la actualización automática de GOES rehízo la animación), el cuadro ya no es
        // de la misma serie.
        if (this.timeControl !== tc || tc.destroyed) {
          throw new ExportError('La capa cambió mientras se generaba el GIF. Vuelva a intentarlo.');
        }
        const delay = i === total - 1 ? MetDataExplorerComponent.GIF_LAST_FRAME_MS : MetDataExplorerComponent.GIF_FRAME_MS;
        gif.addFrame(canvas, delay);
      }
      downloadBlob(gif.finish(), fileName);
      this.warnMissingImages(exporter);
    } catch (error) {
      console.error('Error al generar el GIF', error);
      alert(error instanceof ExportError ? error.message : 'No se pudo generar el GIF.');
    } finally {
      exporter.dispose();
      restoreInteraction();
      if (this.timeControl === tc && !tc.destroyed) {
        tc.goTo(startIndex);
      }
      resumePlayback();
      this.isExporting = false;
      this.exportStatus = '';
    }
  }

  /** Tiempo de cada cuadro del GIF y del último, que se queda un poco más antes de repetir. */
  private static readonly GIF_FRAME_MS = 500;
  private static readonly GIF_LAST_FRAME_MS = 1500;

  /**
   * Detiene la reproducción mientras se exporta: el intervalo de 300 ms cambiaría de fecha a mitad
   * del dibujo y las teselas saldrían de una fecha y la leyenda de otra. Devuelve la función que la
   * reanuda, solo si estaba en marcha y la capa sigue siendo la misma.
   */
  private pausePlayback(tc: WMSTimeControl | undefined): () => void {
    const wasPlaying = this.isPlay;
    tc?.pause();
    this.isPlay = false;
    return () => {
      if (wasPlaying && tc && this.timeControl === tc && !tc.destroyed) {
        tc.play();
        this.isPlay = true;
      }
    };
  }

  /**
   * Bloquea el mapa mientras se arma el GIF: todos los cuadros deben mostrar la misma zona, el mismo
   * mapa base y la leyenda abierta. Desactivar los manejadores de Leaflet no basta, porque los botones
   * +/−, el selector de capas y el de minimizar la leyenda siguen respondiendo; `inert` los apaga para
   * el ratón, el teclado y el tacto, y el control de zoom se pone en gris para que se note.
   * Devuelve la función que deja todo como estaba.
   */
  private lockMap(): () => void {
    const container = this.map.getContainer();
    const handlers = ['dragging', 'scrollWheelZoom', 'doubleClickZoom', 'boxZoom', 'keyboard', 'touchZoom']
      .map(name => (this.map as any)[name] as L.Handler | undefined)
      .filter((handler): handler is L.Handler => !!handler && handler.enabled());
    handlers.forEach(handler => handler.disable());
    this.zoomControl.disable();
    container.inert = true;
    return () => {
      container.inert = false;
      this.zoomControl.enable();
      handlers.forEach(handler => handler.enable());
    };
  }

  /** Nombre del archivo: capa y fecha si se conocen; si no, "mapa" y la hora local. */
  private exportFileName(ext: 'png' | 'gif'): string {
    const tc = this.timeControl;
    const dates: string[] = this.activeDatesDownload ?? [];
    const known = tc && !tc.destroyed && this.activeTypeDownload === 'raster' &&
      this.activeLayerDownload && dates.length === tc.layers.length;
    let name: string;
    if (known) {
      const tag = ext === 'gif' ? `${dates[0]}_${dates[dates.length - 1]}` : `${dates[tc.currentDateIndex]}`;
      name = `${this.activeLayerDownload}_${tag}`;
    } else {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      name = `mapa_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    }
    return `${name.replace(/[^\w.-]+/g, '-')}.${ext}`;
  }

  /** Si faltaron teselas, el archivo se descarga igual, pero el usuario debe saberlo antes de usarlo. */
  private warnMissingImages(exporter: MapExporter){
    if (exporter.missingImages > 0) {
      alert(`El archivo se descargó, pero ${exporter.missingImages} partes del mapa no se pudieron leer y quedaron en blanco. Revise la imagen antes de usarla.`);
    }
  }






  /***************************************************************************
   *                     Geographical Control Functions                      *
   ***************************************************************************/
  // En tu componente/clase:
  private uploadedLayer?: L.FeatureGroup;

  /** Detecta tipos geométricos (igual a tu función actual). */
  public detectGeometryTypes(
    geojson: GeoJSON.FeatureCollection
  ): Set<string> {
    const types = new Set<string>();
    for (const f of geojson.features) {
      if (f.geometry) types.add(f.geometry.type);
    }
    return types;
  }

  /** Cargar GeoJSON en Leaflet (no MapLibre). */
  public onGeoFileLoaded( geojson: any ): void {
    // Quita la capa previa si existe
    if (this.uploadedLayer) {
      this.map.removeLayer(this.uploadedLayer);
      this.uploadedLayer = undefined!;
    }

    // Usamos FeatureGroup para poder hacer fitBounds luego
    this.uploadedLayer = L.featureGroup().addTo(this.map);

    const types = this.detectGeometryTypes(geojson);
    const hasPoints = types.has('Point') || types.has('MultiPoint');

    // 1) Si hay puntos, los agregamos como circleMarker
    if (hasPoints) {
      const points = L.geoJSON(geojson, {
        filter: f =>
          f.geometry?.type === 'Point' || f.geometry?.type === 'MultiPoint',
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 5,
            color: '#007cbf',
            fillColor: '#007cbf',
            fillOpacity: 1,
            weight: 1,
            opacity: 1,
          }),
      });
      points.addTo(this.uploadedLayer);
    }

    // 2) Si hay líneas/polígonos, los pintamos como trazo (sin relleno)
    const hasLinesOrPolys =
      types.has('LineString') ||
      types.has('MultiLineString') ||
      types.has('Polygon') ||
      types.has('MultiPolygon');

    if (hasLinesOrPolys) {
      const paths = L.geoJSON(geojson, {
        filter: f => {
          const t = f.geometry?.type;
          return (
            t === 'LineString' ||
            t === 'MultiLineString' ||
            t === 'Polygon' ||
            t === 'MultiPolygon'
          );
        },
        style: f => {
          const t = (f as any).geometry?.type;
          // Para polígonos: solo contorno (sin relleno)
          if (t === 'Polygon' || t === 'MultiPolygon') {
            return {
              color: '#000000',
              weight: 3,
              opacity: 1,
              fill: false,
            };
          }
          // Para líneas
          return {
            color: '#000000',
            weight: 3,
            opacity: 1,
          };
        },
      });
      paths.addTo(this.uploadedLayer);
    }

    // Ajusta vista si hay geometrías
    const bounds = this.uploadedLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds.pad(0.1));
    }
  }















}
