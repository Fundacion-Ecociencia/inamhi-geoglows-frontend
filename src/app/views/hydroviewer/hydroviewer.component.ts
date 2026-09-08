/*****************************************************************************
 *                           HYDROVIEWER COMPONENT                           *
 *****************************************************************************
 * Interactive hydrologic viewer built with Angular + MapLibre + Plotly.
 *
 * Responsibilities
 * ----------------
 * - Initialize and manage a MapLibre instance with multiple thematic layers.
 * - Display flood and drought indices with time-enabled controls.
 * - Load and visualize meteorological warnings, satellite precipitation
 *   accumulations, and FFGS products.
 * - Provide interactive legends, overlays, and time-step navigation.
 * - Fetch and render hydrological plots and tables when users select
 *   river segments.
 * - Handle user-uploaded GeoJSON files for ad-hoc visualization.
 *
 * Key Features
 * ------------
 * - Multi-hazard visualization (floods, droughts, meteo warnings).
 * - Time controls for stepping, playing, and pausing animations.
 * - Dynamic legends for each active layer with contextual metadata.
 * - Modular layer management for geospatial overlays and risk maps.
 * - Integration with Plotly for observed/forecast hydrographs
 *   and statistical plots.
 * - User-friendly support for external GeoJSON uploads.
 *
 * @author Juseth E. Chancay
 * @lastUpdated 2025-08-18
 */


/*****************************************************************************
 *                           LIBRARIES AND MODULES                           *
 *****************************************************************************/
// Angular
import { Component, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule, MatOptionModule } from '@angular/material/core';
import { provideMomentDateAdapter } from '@angular/material-moment-adapter';

// Third-party libraries
import maplibregl, { Map } from 'maplibre-gl';
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
import { FileUploaderComponent }
  from '../../components/uploader/uploader.component';
import { LoadingComponent }
  from '../../components/loading/loading.component';

// App modules & utilities
import { providers } from '../../modules/providers';
import { Utils } from '../../modules/utils';
import { MapControl } from './hydroviewer.map';
import {
  LegendControlDrought,
  LegendControlFFGS,
  LegendControlGeoglowsFloodWarning,
  LegendControlMeteoWarning,
  LegendControlPacum,
} from './hydroviewer.legends';




/*****************************************************************************
 *                           COMPONENT DEFINITION                            *
 *****************************************************************************/
@Component({
  selector: 'app-hydroviewer',
  standalone: true,
  providers: [
    provideMomentDateAdapter(new providers().dateFormat)
  ],
  imports: [
    CommonModule,
    FormsModule,
    PlotlyModule,
    MatInputModule,
    MatOptionModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    AppTemplateComponent,
    DropdownComponent,
    LoadingComponent,
    FileUploaderComponent
],
  templateUrl: './hydroviewer.component.html',
  styleUrl: './hydroviewer.component.css'
})

export class HydroviewerComponent {
  /***************************************************************************
   *                             State variables                             *
   ***************************************************************************/
  /** MapLibre instance */
  private map!: Map;

  /** Time sequence play state */
  public isPlay: boolean = false;
  public intervalId: any;

  /** Utilities class instances */
  public utilsApp = new Utils();
  public mapControl = new MapControl();

  /** ViewChilds for template references */
  @ViewChild('template') template!: AppTemplateComponent;
  @ViewChild('panelPlot') panelPlot!: ElementRef;
  @ViewChild('table') table!: ElementRef;

  /** Flood warnings */
  public isActiveFloodGeoglowslayer:boolean = true;
  public isActiveFlood002:boolean = true;
  public isActiveFlood005:boolean = true;
  public isActiveFlood010:boolean = true;
  public isActiveFlood025:boolean = true;
  public isActiveFlood050:boolean = true;
  public isActiveFlood100:boolean = true;
  public activeDateIndex:number = 0;
  public selectedFloodGeoglowsProduct: string = "Alertas Puntuales";
  public floodGeoglowsProducts:string[] = [
    "Alertas Puntuales",
    "Mapa de Cuencas"
  ];
  public dateControlFloodGeoglows = new FormControl(new Date());
  public dateControlPanelFloodGeoglows = new FormControl(new Date());
  public minDateFloodGeoglows = new Date('2025-01-01');
  public maxDateFloodGeoglows = new Date();
  public rangeDateFloodGeoglows:string[] = [];
  public comid: string = "";
  public latitude: string = "";
  public longitude: string = "";
  public river: string = "";
  public province: string = "";
  public canton: string = "";
  public historicalSimulationPlot: any;
  public dailyAveragePlot:any;
  public monthlyAveragePlot:any;
  public flowDurationCurve:any;
  public volumePlot:any;
  public forecastPlot:any;
  public htmlContent:string = "";
  public isReadyDataPlot:boolean = false;
  public wdKeys: string[] = [
    "wd01", "wd02", "wd03", "wd04", "wd05", "wd06", "wd07",
    "wd08", "wd09", "wd10", "wd11", "wd12", "wd13", "wd14"
  ];


  /** Droughts */
  public isActiveDroughtIndiceslayer:boolean = false;
  public droughtIndices: string[] = ["Streamflow Drought Index (SDI)"];
  public selectedDroughtIndex: string = "Streamflow Drought Index (SDI)";
  public minDateDrought = new Date('2023-01-01');
  public maxDateDrought = new Date();
  public dateRangeControlDrought: FormGroup = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });
  public dateRangeDrought:string[] = []


  /** Meteo Warnings */
  public meteoWarningsMetaData:any;
  public meteoWarningTypes:string[] = [];
  public meteoWarningStartDates:string[] = [];
  public meteoWarningEndDates:string[] = [];
  public selectedMeteoWarningType:string = "";
  public meteoWarnings:string[] = [];
  public selectedMeteoWarning:string = "";

  /** Satellite based precipitation */
  public satellitePrecipitationProducts:string[] = [
    "PERSIANN PDIR",
    "IMERG EARLY RUN"
  ];
  public selectedSatellitePrecipitationProduct:string = "PERSIANN PDIR";
  public aggregationLevels:string[] = [
    "Acumulado en últimas 24h",
    "Acumulado en últimas 48h",
    "Acumulado en últimas 72h"
  ];
  public selectedAggregationLevel:string = "Acumulado en últimas 24h";
  public dateControlSatellitePrecipitation = new FormControl(new Date());
  public minDateSatellitePrecipitation = new Date('2025-01-01');
  public maxDateSatellitePrecipitation = new Date();

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

  /** Legend controls */
  private legendControl: any;
  private legendControlOverlay: any;

  /** Layers */
  public isActiveDrainageLayer:boolean = true;
  public isActiveLocalitiesLayer:boolean = false;
  public isActiveCityLayer:boolean = false;
  public isActiveCantonLayer:boolean = false;
  public isActiveProvinceLayer:boolean = false;
  public isActiveFloodRiskSGRLayer:boolean = false;
  public isActiveDroughtRiskSGRLayer:boolean = false;
  public isActiveLandSlidesRiskSGRLayer:boolean = false;
  public isActiveCorredorConectividadLayer:boolean = false;
  public isActiveRecargaHidricaLayer:boolean = false;
  public isActiveProteccionHidricaLayer:boolean = false;
  public isActiveHumedalRamsarLayer:boolean = false;
  public isActiveReservaBiosferaLayer:boolean = false;
  public isActiveSocioBosqueLayer:boolean = false;
  public isActiveBosqueProtectorLayer:boolean = false;
  public isActiveAreasProtegidasLayer:boolean = false;
  public isActiveHydropowerLayer:boolean = false;
  public isActivePauteLayer:boolean = false;
  public isActiveCocaCodoLayer:boolean = false;
  public isActiveMinasSanFranciscoLayer:boolean = false;
  public isActiveAgoyanLayer:boolean = false;
  public isActiveDelsintanisaguaLayer:boolean = false;
  public isActiveDueLayer:boolean = false;




  /***************************************************************************
   *                       Constructor and Lifecycle                         *
   ***************************************************************************/
  constructor(
    private http: HttpClient,
    private renderer: Renderer2,
    private formBuilder: FormBuilder){
  }

  ngOnInit() {
    this.initializeDates();
    this.initializedMeteoWarningControl();
    this.initializeMap();
    this.resizeMap();
  };



  /***************************************************************************
   *                        Legend Control Functions                         *
   ***************************************************************************/
  public updateLegendFloodWarnings(initDate: string, forecastDate: string) {
    if(this.isActiveFloodGeoglowslayer){
      if (this.legendControl) {
        this.map.removeControl(this.legendControl);
      }
      this.legendControl = new LegendControlGeoglowsFloodWarning(
        initDate,
        forecastDate
      );
      this.map.addControl(this.legendControl, 'bottom-left');
    }
  }

  public updateLegendDroughtIndices(initDate: string, title: string) {
    if(this.isActiveDroughtIndiceslayer){
      if (this.legendControl) {
        this.map.removeControl(this.legendControl);
      }
      this.legendControl = new LegendControlDrought(initDate, title);
      this.map.addControl(this.legendControl, 'bottom-left');
    }
  }

  public updateLegendControlMeteoWarning(title: string, no: string,
                                          start:string, end:string) {
    if (this.legendControlOverlay) {
      this.map.removeControl(this.legendControlOverlay);
    }
    this.legendControlOverlay = new LegendControlMeteoWarning(
      title,
      no,
      start,
      end
    );
    this.map.addControl(this.legendControlOverlay, 'bottom-left');
  }

  public updateLegendControlPacum(title: string, date1: string,
                                  date2:string) {
    if (this.legendControlOverlay) {
      this.map.removeControl(this.legendControlOverlay);
    }
    this.legendControlOverlay = new LegendControlPacum(title, date1, date2)
    this.map.addControl(this.legendControlOverlay, 'bottom-left');
  }

  public updateLegendControlFFGS(title: string, date: string) {
    if (this.legendControlOverlay) {
      this.map.removeControl(this.legendControlOverlay);
    }
    this.legendControlOverlay = new LegendControlFFGS(title, date)
    this.map.addControl(this.legendControlOverlay, 'bottom-left');
  }




  /***************************************************************************
   *                           Component Functions                           *
   ***************************************************************************/
  /**
   * Initializes date controls for flood and drought modules.
   * - Flood: sets max available date and computes its range.
   * - Drought: previous month [first day, last day].
   */
  public initializeDates(): void {
    // Flood
    const floodDate = this.maxDateFloodGeoglows ?? null;
    this.dateControlFloodGeoglows.setValue(floodDate);
    if (floodDate) {
      this.rangeDateFloodGeoglows =
        this.utilsApp.getDateRangeGeoglows(floodDate);
    }
    // Drought
    const { start, end } = this.utilsApp.getPreviousMonthRange()
    this.dateRangeControlDrought = this.formBuilder.group({
      start: [start],
      end: [end],
    });
  };




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



  /**
   * Initializes MapLibre with base OSM and required layers. Sets up click and
   * cursor interaction.
   */
  public initializeMap() {

    //Define the MapLibre
    this.map = new maplibregl.Map({
      container: 'map',
      center: [-78.5, -1.7],
      zoom: 6
    });

    // Add components to map
    this.mapControl.addIcons(this.map, this.http)
    this.mapControl.addBaseMap(this.map);
    this.mapControl.addDrainageNetwork(this.map);
    this.mapControl.addProvinces(this.map);
    this.mapControl.addCities(this.map);
    this.mapControl.addFloodRiskSGR(this.map);
    this.mapControl.addDroughtRiskSGR(this.map);
    this.mapControl.addLandSlidesRiskSGR(this.map);

    // Add other layers to map
    this.mapControl.addGenericLayer(
      this.map,
      "corredor_conectividad",
      "corredor-conectividad"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "zonas_recarga_hidrica",
      "recarga-hidrica"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "areas_protegidas",
      "proteccion-hidrica"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "humedal_ramsar",
      "humedal-ramnsar"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "reserva_biosfera",
      "reserva-biosfera"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "conservacion_socio_bosque",
      "socio-bosque"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "bosque_vegetacion_protectora",
      "bosque-protector"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "sistema_nacional_areas_protegidas",
      "areas-protegidas"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "hidroelectricas_mayores_50W",
      "hydropower"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "paute",
      "paute"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "coca",
      "coca-codo"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "jubones",
      "minas"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "agoyan",
      "agoyan"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "delsintanisagua",
      "delsintanisagua"
    );
    this.mapControl.addGenericLayer(
      this.map,
      "due",
      "due"
    );
    this.mapControl.addLocations(this.map);

    // Add Flood Warning Layer obtained from Geoglows
    this.mapControl.addFloodWarningsPoint(
      this.map,
      this.rangeDateFloodGeoglows[0]
    );
    this.mapControl.updateFloodWarningsPoint(
      this.map,
      this.wdKeys[this.activeDateIndex],
      this.isActiveFlood002,
      this.isActiveFlood005,
      this.isActiveFlood010,
      this.isActiveFlood025,
      this.isActiveFlood050,
      this.isActiveFlood100
    );

    // Update Legend
    this.updateLegendFloodWarnings(
      this.rangeDateFloodGeoglows[0],
      this.rangeDateFloodGeoglows[this.activeDateIndex]
    );

    // Feature click: show modal and plots for selected feature
    this.map.on('click', "drainage_ecuador", (e: any) => {
      this.isReadyDataPlot = false;
      if (e.features && e.features.length > 0) {
        const prop = e.features[0].properties;
        this.comid = prop.comid;
        this.latitude = prop.latitude;
        this.longitude = prop.longitude;
        this.river = prop.river;
        this.province = prop.province;
        this.canton = prop.canton;
        this.dateControlPanelFloodGeoglows.setValue(
          this.dateControlFloodGeoglows.value
        );

        // Open modal with data panel
        this.template.showDataModal();

        // Fetch plot and table data asynchronously
        setTimeout(() => {
          const elementWidth = this.panelPlot.nativeElement.offsetWidth;
          const urltemp = `${env.urlAPI}/hydroviewer/get-plots` +
            `?comid=${this.comid}` +
            `&date=${this.rangeDateFloodGeoglows[0]}` +
            `&width=${elementWidth}`;
          console.log(urltemp);

          fetch(urltemp)
            .then(response => response.text())
            .then(text => {
              const fixedText = text.replace(/NaN/g, 'null');
              return JSON.parse(fixedText);
            })
            .then((response) => {
              this.historicalSimulationPlot = response.hs;
              this.dailyAveragePlot = response.dp;
              this.monthlyAveragePlot = response.mp;
              this.flowDurationCurve = response.fd;
              this.volumePlot = response.vp;
              this.forecastPlot = response.fp;
              this.isReadyDataPlot = true;

              // Fetch and insert forecast table into DOM
              fetch(`${env.urlAPI}/hydroviewer/get-forecast-table` +
                `?comid=${this.comid}` +
                `&date=${this.rangeDateFloodGeoglows[0]}`
              )
              .then((response) => response.text())
              .then((response) => {
                this.renderer.setProperty(
                  this.table.nativeElement,
                  'innerHTML',
                  response
                );
              });
            });
        }, 300);
      }
    });
  };




  /**
   * Forces map resize, useful after DOM/layout changes.
   */
  public resizeMap() {
    setTimeout(() => { this.map.resize(); }, 10);
  };




  /**
   * Updates flood warning visualization (filter and color) according to
   * toggles and selected time step.
   */
  public updateFloodWarnings() {
    if(this.isActiveFloodGeoglowslayer){
      setTimeout(() => { this.map.resize(); }, 5);
      // Point Warnings
      if(this.selectedFloodGeoglowsProduct === "Alertas Puntuales"){
        this.mapControl.updateFloodWarningsPoint(
          this.map,
          this.wdKeys[this.activeDateIndex],
          this.isActiveFlood002,
          this.isActiveFlood005,
          this.isActiveFlood010,
          this.isActiveFlood025,
          this.isActiveFlood050,
          this.isActiveFlood100
        );
      };

      // Basin Warnings
      if(this.selectedFloodGeoglowsProduct === "Mapa de Cuencas"){
        this.mapControl.updateFloodWarningsBasin(
          this.map,
          this.wdKeys[this.activeDateIndex],
          this.isActiveFlood002,
          this.isActiveFlood005,
          this.isActiveFlood010,
          this.isActiveFlood025,
          this.isActiveFlood050,
          this.isActiveFlood100
        );
      };
    }

    // Update Legend
    this.updateLegendFloodWarnings(
      this.rangeDateFloodGeoglows[0],
      this.rangeDateFloodGeoglows[this.activeDateIndex]
    );
  };



  /**
   * Updates the warning layer according to a new date selected by the user.
   * This removes and reloads the vector source and layer for the new date.
   */
  public updateFloodWarningsDay() {
    // Setup layer status
    this.isActiveFloodGeoglowslayer = true;
    this.isActiveDroughtIndiceslayer = false;

    if (this.dateControlFloodGeoglows.value) {
      // Set requested dates
      this.rangeDateFloodGeoglows = this.utilsApp.getDateRangeGeoglows(
        this.dateControlFloodGeoglows.value
      );
      this.activeDateIndex = 0;

      // Point warnings
      if(this.selectedFloodGeoglowsProduct === "Alertas Puntuales"){
        this.mapControl.addFloodWarningsPoint(
          this.map,
          this.rangeDateFloodGeoglows[0]
        );
        this.mapControl.updateFloodWarningsPoint(
          this.map,
          this.wdKeys[this.activeDateIndex],
          this.isActiveFlood002,
          this.isActiveFlood005,
          this.isActiveFlood010,
          this.isActiveFlood025,
          this.isActiveFlood050,
          this.isActiveFlood100
        );
      };

      // Basin warnings
      if(this.selectedFloodGeoglowsProduct === "Mapa de Cuencas"){
        this.mapControl.addFloodWarningsBasin(
          this.map,
          this.rangeDateFloodGeoglows[0]
        );
        this.mapControl.updateFloodWarningsBasin(
          this.map,
          this.wdKeys[this.activeDateIndex],
          this.isActiveFlood002,
          this.isActiveFlood005,
          this.isActiveFlood010,
          this.isActiveFlood025,
          this.isActiveFlood050,
          this.isActiveFlood100
        );
      };

      // Update Legend
      this.updateLegendFloodWarnings(
        this.rangeDateFloodGeoglows[0],
        this.rangeDateFloodGeoglows[this.activeDateIndex]
      );
    };
  };




  /**
   * Updates the drought layer according to a new date selected by the user.
   * This removes and reloads the vector source and layer for the new date.
   */
  public getDroughtIndex() {
    // Setup layer status
    this.isActiveFloodGeoglowslayer = false;
    this.isActiveDroughtIndiceslayer = true;

    // Set requested dates
    const startDate = this.dateRangeControlDrought.value.start;
    const endDate = this.dateRangeControlDrought.value.end;
    this.dateRangeDrought = this.utilsApp.getFirstDaysOfMonthsInRange(
      startDate,
      endDate
    );
    const s = this.dateRangeDrought[0];
    const e = this.dateRangeDrought[this.dateRangeDrought.length - 1];

    // Add layer and update legend
    this.mapControl.addStreamflowDroughtIndex(this.map, s, e);
    this.updateLegendDroughtIndices(s, this.selectedDroughtIndex)
  }

  public updateDroughtIndex() {
    const dateActive = this.dateRangeDrought[this.activeDateIndex];
    this.mapControl.updateStreamflowDroughtIndex(this.map, dateActive);
    this.updateLegendDroughtIndices(dateActive, this.selectedDroughtIndex);
  }




  /**
   * Updates the weather warning layer generated by INAMHI's DPA. The warning
   * colors will depend on the associated risk (heavy rainfall, high or low
   * temperatures, etc.)
   */
  public updateMeteoWarningLayer(){
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

    // Add meteorological warning layer
    this.mapControl.addMeteoWarning(this.map, this.selectedMeteoWarning);
    this.updateLegendControlMeteoWarning(
      this.selectedMeteoWarningType,
      this.selectedMeteoWarning,
      Array.from(startDate)[0],
      Array.from(endDate)[0]
    );

    // Re-order legend positions
    if(this.isActiveFloodGeoglowslayer){
      this.updateLegendFloodWarnings(
        this.rangeDateFloodGeoglows[0],
        this.rangeDateFloodGeoglows[this.activeDateIndex]
      );
    };
    if(this.isActiveDroughtIndiceslayer){
      const s = this.dateRangeDrought[0];
      this.updateLegendDroughtIndices(s, this.selectedDroughtIndex)
    }
  }






  /**
   * Update PaCUM overlay and legends based on current UI selections. Resolve
   * aggregation and product to internal keys. Read selected date and compute
   * the legend end date based on aggregation window. Add/refresh the PaCUM
   * WMS layer Refresh dependent legends (flood warnings / drought indices)
   * only if their layers are active.
   */
  public updatePacum(){
    let agd = "";
    let prd = "";
    let hh = 0;
    if(this.selectedAggregationLevel==="Acumulado en últimas 24h"){
      agd = "24";
      hh = 1;
    }
    if(this.selectedAggregationLevel==="Acumulado en últimas 48h"){
      agd = "48";
      hh = 2;
    }
    if(this.selectedAggregationLevel==="Acumulado en últimas 72h"){
      agd = "72";
      hh = 3;
    }

    if(this.selectedSatellitePrecipitationProduct === "PERSIANN PDIR"){
      prd = "persiann_pdir";
    }
    if(this.selectedSatellitePrecipitationProduct === "IMERG EARLY RUN"){
      prd = "imerg_early_run";
    }

    if (this.dateControlSatellitePrecipitation.value) {
      const a = this.utilsApp.getDateRangeGeoglows(
        this.dateControlSatellitePrecipitation.value
      );
      const startDate = a[0];
      this.mapControl.addPacum(this.map, prd, agd, startDate);

      const dateEnd = new Date(a[0]);
      dateEnd.setDate(dateEnd.getDate() - hh + 1);
      const yyyy = dateEnd.getFullYear();
      const mm = String(dateEnd.getMonth() + 1).padStart(2, '0');
      const dd = String(dateEnd.getDate()).padStart(2, '0');
      const endDate = `${yyyy}-${mm}-${dd}`

      const title = `${this.selectedSatellitePrecipitationProduct}<br>
                     ${this.selectedAggregationLevel}`;
      this.updateLegendControlPacum(title, endDate, startDate);

      // Re-order legend positions
      if(this.isActiveFloodGeoglowslayer){
        this.updateLegendFloodWarnings(
          this.rangeDateFloodGeoglows[0],
          this.rangeDateFloodGeoglows[this.activeDateIndex]
        );
      };
      if(this.isActiveDroughtIndiceslayer){
        const s = this.dateRangeDrought[0];
        this.updateLegendDroughtIndices(s, this.selectedDroughtIndex)
      }
    };
  };


  /**
   * Updates the Flash Flood Guiadence System layer selected by the user.
   * You can select data on soil moisture, precipitation forecasts,
   * flood risks, etc.
   */
  public updateFFGS(){
    const selectedDate = this.dateControlFFGS.value ?? new Date();
    const a = this.utilsApp.getDateRangeGeoglows(selectedDate);
    const queryDate = `${a[0]} ${this.selectedFFGSRun}:00:00`;
    const queryDate2 = `${a[0]} ${this.selectedFFGSRun}:00`;
    this.mapControl.addFFGS(this.map, queryDate, this.selectedFFGSProduct);
    this.updateLegendControlFFGS(this.selectedFFGSProduct, queryDate2);
    // Re-order legend positions
    if(this.isActiveFloodGeoglowslayer){
      this.updateLegendFloodWarnings(
        this.rangeDateFloodGeoglows[0],
        this.rangeDateFloodGeoglows[this.activeDateIndex]
      );
    };
    if(this.isActiveDroughtIndiceslayer){
      const s = this.dateRangeDrought[0];
      this.updateLegendDroughtIndices(s, this.selectedDroughtIndex)
    }
  }




  /**
   * Turns layers on or off based on the state of their toggle.
   */
  public updateOverlayers(isActiveCondition:boolean, layer:string){
    setTimeout(() => {
      this.mapControl.updateLayerVisibility(this.map, layer, !isActiveCondition);
    }, 10);
  }




  public dropMainLayer(){
    this.isActiveFloodGeoglowslayer = false;
    this.isActiveDroughtIndiceslayer = false;
    this.mapControl.dropMainLayer(this.map);
    if (this.legendControl) {
      this.map.removeControl(this.legendControl);
    }
  }

  public dropOverlays(){
    this.mapControl.dropOverlays(this.map);
    if (this.legendControlOverlay) {
      this.map.removeControl(this.legendControlOverlay);
    }
  }






  /***************************************************************************
   *                         Time Control Functions                          *
   ***************************************************************************/
  /**
   * Advances to the next time step and updates the warning layer.
   */
  public nextTimeControl() {
    if(this.isActiveFloodGeoglowslayer){
      this.activeDateIndex = (this.activeDateIndex + 1) %
                              this.wdKeys.length;
      this.updateFloodWarnings();
    }
    if(this.isActiveDroughtIndiceslayer){
      this.activeDateIndex = (this.activeDateIndex + 1) %
                              this.dateRangeDrought.length;
      this.updateDroughtIndex();
    }
  };



  /**
   * Moves to the previous time step and updates the warning layer.
   */
  public previuosTimeControl() {
    if(this.isActiveFloodGeoglowslayer){
      this.activeDateIndex = (this.activeDateIndex - 1 +
                              this.wdKeys.length) %
                              this.wdKeys.length;
      this.updateFloodWarnings();
    }
    if(this.isActiveDroughtIndiceslayer){
      this.activeDateIndex = (this.activeDateIndex - 1 +
                              this.dateRangeDrought.length) %
                              this.dateRangeDrought.length;
      this.updateDroughtIndex();
    }
  };


  /**
   * Starts time control animation, advancing time steps automatically.
   */
  public play() {
    if (this.intervalId == null) {
      this.intervalId = setInterval(() => {
        this.nextTimeControl();
      }, 400);
    };
  };


  /**
   * Stops time control animation.
   */
  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    };
  };


  /**
   * Toggles the play/pause state for time animation.
   */
  public playTimeControl() {
    if (this.isPlay) {
      this.isPlay = false;
      this.stop();
    } else {
      this.isPlay = true;
      this.play();
    };
  };





  /***************************************************************************
   *                     Geographical Control Functions                      *
   ***************************************************************************/
  /**
   * Inspect a GeoJSON FeatureCollection and return the distinct
   * geometry types it contains.
   *
   * RFC 7946 geometry type names include:
   * 'Point', 'MultiPoint', 'LineString', 'MultiLineString',
   * 'Polygon', 'MultiPolygon', and 'GeometryCollection'.
   *
   * - Features with `null`/missing geometry are skipped.
   * - If a feature is a `GeometryCollection`, the function adds the literal
   *   `'GeometryCollection'` and does not expand nested geometries.
   *   (Expand if needed for your use case.)
   */
  public detectGeometryTypes(geojson: GeoJSON.FeatureCollection): Set<string> {
    const types = new Set<string>();
    for (const feature of geojson.features) {
      if (feature.geometry) {
        types.add(feature.geometry.type);
      }
    }
    return types;
  }



  /**
   * Load an uploaded GeoJSON into the map as a source and add a basic
   * visualization layer based on detected geometry types.
   *
   * - Removes any existing source/layer with IDs:
   *   'uploaded-data' and 'uploaded-data-layer'.
   * - Adds a GeoJSON source ('uploaded-data').
   * - If the data contains any points (Point/MultiPoint), it adds a
   *   circle layer. Otherwise, it adds a line layer suitable for
   *   LineString/MultiLineString/Polygon outlines.
   */
  public onGeoFileLoaded(geojson: any) {
    const sourceId = 'uploaded-data';
    if (this.map.getSource(sourceId)) {
      this.map.removeLayer(sourceId + '-layer');
      this.map.removeSource(sourceId);
    }
    this.map.addSource(sourceId, { type: 'geojson', data: geojson });

    const geometryTypes = this.detectGeometryTypes(geojson);

    if (geometryTypes.has('Point') || geometryTypes.has('MultiPoint')) {
      this.map.addLayer({
        id: `${sourceId}-layer`,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 5,
          'circle-color': '#007cbf'
        }
      });
    } else {
      this.map.addLayer({
        id: `${sourceId}-layer`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#000000',
          'line-width': 3
        }
      });
    };
  }





  public async donwloadHistorical(){
    const url =
    "https://services.geoglows.org/api/hydroviewer/get-historical-csv" +
    `?comid=${encodeURIComponent(String(this.comid))}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/csv,application/octet-stream,*/*",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // Descargar como blob (archivo)
    const blob = await res.blob();

    // Intenta obtener el nombre desde Content-Disposition si existe
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] ?? `historical_${this.comid}.csv`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }


  public async donwloadForecast(){
    const d = new Date(String(this.dateControlFloodGeoglows.value));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;


    const url =
    "https://services.geoglows.org/api/hydroviewer/get-forecast-csv" +
    `?comid=${encodeURIComponent(String(this.comid))}`+
    `&date=${encodeURIComponent(dateStr)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/csv,application/octet-stream,*/*",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // Descargar como blob (archivo)
    const blob = await res.blob();

    // Intenta obtener el nombre desde Content-Disposition si existe
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] ?? `forecast_${this.comid}.csv`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }





}
