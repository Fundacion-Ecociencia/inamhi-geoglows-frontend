import maplibregl, { Map } from 'maplibre-gl';
import { env } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

export class MapControl{

  public floodWarningLayerName = "flood_warning_geoglows";

  public layerActive = "layer_active";
  public layerActiveOverlay1 = "layer_active_overlay_1";
  public layerActiveOverlay2 = "layer_active_overlay_2";

  public addIcons(map:Map, http:HttpClient){
    const icons = [
      ['icon-r0', 'assets/ico/R0.svg'],
      ['icon-r2', 'assets/ico/R2.svg'],
      ['icon-r5', 'assets/ico/R5.svg'],
      ['icon-r10', 'assets/ico/R10.svg'],
      ['icon-r25', 'assets/ico/R25.svg'],
      ['icon-r50', 'assets/ico/R50.svg'],
      ['icon-r100', 'assets/ico/R100.svg'],
    ];

    icons.forEach(([name, url]) => {
      http.get(url, { responseType: 'blob' }).subscribe((blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const context = canvas.getContext('2d');
            context!.drawImage(img, 0, 0);
            const imageData = context!.getImageData(0, 0, img.width, img.height);
            map.addImage(name, {
              width: img.width,
              height: img.height,
              data: imageData.data,
            }, { sdf: false }); // sdf: true si quieres cambiar color con icon-color
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(blob);
      });
    });

  }

  private removeLayer(layerId:string, map:Map){
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  }

  private removeSource(sourceId:string, map:Map){
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }
  }


  public addBaseMap(map:Map){
    map.addSource("osm", {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256
    });
    map.addLayer({
      id: 'osm_layer',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 22
    })
  }

  public addCities(map:Map){
    map.addSource("osm_cities", {
      type: 'raster',
      tiles: [`https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png?key=${env.cartoKey}`],
      tileSize: 256
    });
    map.addLayer({
      id: 'osm_cities_layer',
      type: 'raster',
      source: 'osm_cities',
      minzoom: 0,
      maxzoom: 22
    });
    map.setLayoutProperty(
        'osm_cities_layer',
        'visibility',
        'none'
    );
  };

  public addProvinces(map:Map){
    map.addSource('provincias-svg', {
      type: 'raster',
      tileSize: 256,
      tiles: [
        `${env.urlGeoserver}/ecuador/wms` +
        '?service=WMS' +
        '&version=1.3.0' +                         // usa 1.3.0 para CRS en lugar de SRS
        '&request=GetMap' +
        '&layers=ecuador:provincias' +
        '&styles=' +
        '&format=image/png' +                 // pide SVG
        '&transparent=true' +
        '&crs=EPSG:3857' +                        // CRS WebMercator
        '&width=256' +
        '&height=256' +
        '&bbox={bbox-epsg-3857}'                  // MapLibre sustituye esto automáticamente
      ]
    });
    map.addLayer({
      id: 'provincias-svg-layer',
      type: 'raster',
      source: 'provincias-svg',
      paint: {
        'raster-opacity': 1.0
      }
    });
    map.setLayoutProperty(
        'provincias-svg-layer',
        'visibility',
        'none'
    );
  };

  public addFloodRiskSGR(map:Map){
    map.addSource('flood-risk', {
      type: 'raster',
      tileSize: 256,
      tiles: [
        `${env.urlGeoserver}/ecuador/wms` +
        '?service=WMS' +
        '&version=1.1.0' +
        '&request=GetMap' +
        '&layers=ecuador:flood2' +
        '&styles=' +
        '&format=image/png' +
        '&transparent=true' +
        '&crs=EPSG:3857' +
        '&width=256' +
        '&height=256' +
        '&bbox={bbox-epsg-3857}'
      ]
    });
    map.addLayer({
      id: 'flood-risk-layer',
      type: 'raster',
      source: 'flood-risk',
      paint: {
        'raster-opacity': 1.0
      }
    });
    map.setLayoutProperty(
        'flood-risk-layer',
        'visibility',
        'none'
    );
    map.moveLayer("flood-risk-layer", 'drainage');
  };

  public addLandSlidesRiskSGR(map:Map){
    map.addSource('landslides-risk', {
      type: 'raster',
      tileSize: 256,
      tiles: [
        `${env.urlGeoserver}/ecuador/wms` +
        '?service=WMS' +
        '&version=1.1.0' +
        '&request=GetMap' +
        '&layers=ecuador:landslides' +
        '&styles=' +
        '&format=image/png' +
        '&transparent=true' +
        '&crs=EPSG:3857' +
        '&width=256' +
        '&height=256' +
        '&bbox={bbox-epsg-3857}'
      ]
    });
    map.addLayer({
      id: 'landslides-risk-layer',
      type: 'raster',
      source: 'landslides-risk',
      paint: {
        'raster-opacity': 1.0
      }
    });
    map.setLayoutProperty(
        'landslides-risk-layer',
        'visibility',
        'none'
    );
    map.moveLayer("landslides-risk-layer", 'drainage');
  };

  public addDroughtRiskSGR(map:Map){
    map.addSource('drought-risk', {
      type: 'raster',
      tileSize: 256,
      tiles: [
        `${env.urlGeoserver}/ecuador/wms` +
        '?service=WMS' +
        '&version=1.1.0' +
        '&request=GetMap' +
        '&layers=ecuador:drought' +
        '&styles=' +
        '&format=image/png' +
        '&transparent=true' +
        '&crs=EPSG:3857' +
        '&width=256' +
        '&height=256' +
        '&bbox={bbox-epsg-3857}'
      ]
    });
    map.addLayer({
      id: 'drought-risk-layer',
      type: 'raster',
      source: 'drought-risk',
      paint: {
        'raster-opacity': 1.0
      }
    });
    map.setLayoutProperty(
        'drought-risk-layer',
        'visibility',
        'none'
    );
    map.moveLayer("drought-risk-layer", 'drainage');
  };



  public addGenericLayer(map:Map, source:string, layer:string){
    map.addSource(layer, {
      type: 'raster',
      tileSize: 256,
      tiles: [
        `${env.urlGeoserver}/ecuador/wms` +
        '?service=WMS' +
        '&version=1.3.0' +
        '&request=GetMap' +
        `&layers=ecuador:${source}` +
        '&styles=' +
        '&format=image/png' +
        '&transparent=true' +
        '&crs=EPSG:3857' +
        '&width=256' +
        '&height=256' +
        '&bbox={bbox-epsg-3857}'
      ]
    });
    map.addLayer({
      id: `${layer}-layer`,
      type: 'raster',
      source: layer,
      paint: {
        'raster-opacity': 1.0
      }
    });
    map.setLayoutProperty(
        `${layer}-layer`,
        'visibility',
        'none'
    );
  };

  public addLocations(map: Map) {
    const sourceId = "mvt_poblacion";
    const layerId  = "poblacion_layer";

    // Helper: basic HTML escaping for popup content
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const nf = new Intl.NumberFormat("es-EC");

    // Fuente vector MVT
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "vector",
        tiles: [`${env.urlMartin}/${sourceId}/{z}/{x}/{y}`],
      });
    }

    // Capa de puntos (asegúrate que 'source-layer' = nombre de capa MVT)
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "circle",
        source: sourceId,
        "source-layer": "poblacion", // <- ajusta si tu ST_AsMVT usa otro nombre
        paint: {
          "circle-color": "#5d5c5cff",
          "circle-radius": 3,      // ~0.3 cm ≈ 11.34 px
          "circle-opacity": 0.9,
          "circle-stroke-color": "#000000",
          "circle-stroke-width": 1,
          "circle-pitch-scale": "viewport",
          "circle-pitch-alignment": "viewport",
        },
      });
    }

    // UI: cursor de “mano” cuando hay hover
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });

    // Popup al hacer click
    map.on("click", layerId, (e: any) => {
      const f = e.features?.[0];
      if (!f) return;

      const p = f.properties ?? {};
      const html = `
        <div style="min-width:220px">
          <div style="font-weight:600;margin-bottom:2px">
            ${esc(p.localidad) || "-"}
          </div>
          <div style="font-size:12px;color:#555;margin-bottom:6px">
            ${esc(p.parroquia)}, ${esc(p.canton)}, ${esc(p.provincia)}
          </div>
          <div>Hombres: ${nf.format(Number(p.hombre) || 0)}</div>
          <div>Mujeres: ${nf.format(Number(p.mujer) || 0)}</div>
          <div><b>Total: ${nf.format(Number(p.total) || 0)}</b></div>
        </div>
      `;

      new maplibregl.Popup({ closeOnClick: true, maxWidth: "280px" })
        .setLngLat(e.lngLat)  // usar el click exacto
        .setHTML(html)
        .addTo(map);
    });

    map.setLayoutProperty(
        layerId,
        'visibility',
        'none'
    );
  }



  public addDrainageNetwork(map:Map){
    const sourceId = "geoglows_drainage_ecuador";
    const layerId = "drainage_ecuador";
    const layerIdAux = "drainage";

    this.removeLayer(layerId, map);
    this.removeLayer(layerIdAux, map);
    this.removeSource(sourceId, map);

    map.addSource(sourceId, {
      type: 'vector',
      tiles: [`${env.urlMartin}/geoglows_drainage_ecuador/{z}/{x}/{y}`]
    });
    map.addLayer({
      id: layerIdAux,
      type: 'line',
      source: sourceId,
      'source-layer': sourceId,
      paint: {
        'line-color': '#4794c9',
        'line-width': [
          'interpolate',
          ['linear'],
          ['get', 'order'],
          1, 0.25,
          2, 0.50,
          3, 0.75,
          4, 1.00,
          5, 1.25,
          6, 1.50,
          7, 1.75,
          8, 2.00
        ]
      }
    });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      'source-layer': sourceId,
      paint: {
        'line-color': 'rgba(71, 148, 201, 0)',
        'line-width': 7
      }
    });

    // Change cursor to pointer on feature hover
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  };





  //-------------------------------------------------------------------------//
  //                        FLOOD WARNINGS - GEOGLOWS                        //
  //-------------------------------------------------------------------------//
  private getFloodWarningFilter(
    attr: string,
    cR2: boolean, cR5: boolean, cR10: boolean,
    cR25: boolean, cR50: boolean, cR100: boolean
  ) {
    if (!cR2 && !cR5 && !cR10 && !cR25 && !cR50 && !cR100) {
      return ["==", ["get", attr], "__no_match__"];
    }
    const conditions = [];
    if (cR2)  conditions.push(["==", ["get", attr], "R2"]);
    if (cR5)  conditions.push(["==", ["get", attr], "R5"]);
    if (cR10) conditions.push(["==", ["get", attr], "R10"]);
    if (cR25) conditions.push(["==", ["get", attr], "R25"]);
    if (cR50) conditions.push(["==", ["get", attr], "R50"]);
    if (cR100) conditions.push(["==", ["get", attr], "R100"]);
    if (conditions.length === 1) return conditions[0];
    return ["any", ...conditions];
  };


  private getFloodWarningIcon(attr: string): maplibregl.ExpressionSpecification {
    return [
      'match',
      ['get', attr],
      'R0', 'icon-r0',
      'R2', 'icon-r2',
      'R5', 'icon-r5',
      'R10', 'icon-r10',
      'R25', 'icon-r25',
      'R50', 'icon-r50',
      'R100', 'icon-r100',
      '' // default: no icon
    ];
  }
  private getFloodWarningColor(attr: string): maplibregl.ExpressionSpecification {
    return [
      "match",
      ["get", attr],
      "R0", "#2AAD27",
      "R2", "#FEF001",
      "R5", "#FD9A01",
      "R10", "#FF3805",
      "R25", "#FF0000",
      "R50", "#80006A",
      "R100", "#8000F6",
      "#000"
    ];
  }
  private getDroughtColor(attr: string): maplibregl.ExpressionSpecification {
    return [
          "interpolate",
          ["linear"],
          ["to-number", ["coalesce", ["get", attr], 0]],
          -10,  '#730000',
          -3.0, '#FF2A00',
          -2.0, '#FF9900',
          -1.5, '#FFF200',
          -1,   '#FDFFCC',
          0,   '#FFFFFF'
        ]
  }

  public addFloodWarningsPoint(map:Map, date:string){
    const sourceId = "mvt_hydroviewer_warnings_points";
    const layerName = "hydroviewer_warnings_points";
    const layerId = this.layerActive; //this.floodWarningLayerName;

    this.removeLayer(layerId, map);
    this.removeSource(sourceId, map);

    map.addSource(sourceId,{
      type: 'vector',
      tiles: [`${env.urlMartin}/mvt_hydroviewer_warnings_points/{z}/{x}/{y}?datetime=${date}`]
    });

    console.log(`${env.urlMartin}/mvt_hydroviewer_warnings_points/{z}/{x}/{y}?datetime=${date}`);

    map.addLayer({
      id: layerId,
      type: 'symbol',
      source: sourceId,
      'source-layer': layerName,
      layout: {
        'icon-image': [
          'match',
          ['get', 'wd01'],
          'R0', 'icon-r0',
          'R2', 'icon-r2',
          'R5', 'icon-r5',
          'R10', 'icon-r10',
          'R25', 'icon-r25',
          'R50', 'icon-r50',
          'R100', 'icon-r100',
          '' // default
        ],
        'icon-size': 0.5,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-optional': false
      }
    });
    // Esperar a que los tiles hayan sido cargados/renderizados
    map.once('idle', () => {
      const features = map.queryRenderedFeatures({ layers: [layerId] });
    });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      console.log(`Lat: ${lat}, Lng: ${lng}`);
    });
  }

  public updateFloodWarningsPoint(
    map:Map, attr: string,
    cR2: boolean, cR5: boolean, cR10: boolean,
    cR25: boolean, cR50: boolean, cR100: boolean
  ){
    const layerId = this.layerActive; //this.floodWarningLayerName;
    const filterExpr = this.getFloodWarningFilter(
      attr, cR2, cR5, cR10, cR25, cR50, cR100
    );
    map.setFilter(layerId, filterExpr as maplibregl.FilterSpecification);
    const iconExpr = this.getFloodWarningIcon(attr);
    map.setLayoutProperty(layerId, 'icon-image', iconExpr);

  }


  public addFloodWarningsBasin(map:Map, date:string){
    const sourceId = "mvt_hydroviewer_warnings_basins";
    const layerName = "hydroviewer_warnings_basins";
    const layerId = this.layerActive; //this.floodWarningLayerName;

    this.removeLayer(layerId, map);
    this.removeSource(sourceId, map);

    map.addSource(sourceId,{
      type: 'vector',
      tiles: [`${env.urlMartin}/mvt_hydroviewer_warnings_basins/{z}/{x}/{y}?datetime=${date}`]
    });

    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      'source-layer': layerName,
      paint: {
        'fill-color': [
          'match',
          ['get', 'wd01'],
          'R0',   'rgba(0,0,0,0)',
          'R2',   '#FEF001',
          'R5',   '#FD9A01',
          'R10',  '#FF3805',
          'R25',  '#FF0000',
          'R50',  '#80006A',
          'R100', '#8000F6',
          '#000'
        ],
        'fill-opacity': 0.6,
        'fill-outline-color': [
          'match',
          ['get', 'wd01'],
          'R0',   'rgba(0,0,0,0)',
          'R2',   '#FEF001',
          'R5',   '#FD9A01',
          'R10',  '#FF3805',
          'R25',  '#FF0000',
          'R50',  '#80006A',
          'R100', '#8000F6',
          '#000'
        ]
      }
    });
    map.moveLayer(layerId, 'drainage'); // Move before "drainage"
  }


  public updateFloodWarningsBasin(
    map:Map, attr: string,
    cR2: boolean, cR5: boolean, cR10: boolean,
    cR25: boolean, cR50: boolean, cR100: boolean
  ){
    const layerId = this.layerActive; //this.floodWarningLayerName;
    const filterExpr = this.getFloodWarningFilter(
      attr, cR2, cR5, cR10, cR25, cR50, cR100
    );
    map.setFilter(layerId, filterExpr as maplibregl.FilterSpecification);
    const colorExpr = this.getFloodWarningColor(attr);
    map.setPaintProperty(layerId, 'fill-color', colorExpr);
    map.setPaintProperty(layerId, 'fill-outline-color', colorExpr);
  }

















  public addStreamflowDroughtIndex(map:Map, start:string, end:string){
    const sourceId = "mvt_nalbantis";
    const layerName = "nalbantis";
    const layerId = this.layerActive; //"hydroviewer_warnings";

    this.removeLayer(layerId, map);
    this.removeSource(sourceId, map);

    map.addSource(sourceId,{
      type: 'vector',
      tiles: [`${env.urlMartin}/mvt_nalbantis_range/{z}/{x}/{y}?start_date=${start}&end_date=${end}`]
    });

    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      'source-layer': layerName,
      paint: {
        'fill-color': [
          "interpolate",
          ["linear"],
          ["to-number", ["coalesce", ["get", start], 0]],
          -10,  '#730000',
          -3.0, '#FF2A00',
          -2.0, '#FF9900',
          -1.5, '#FFF200',
          -1,   '#FDFFCC',
          0,   '#FFFFFF'
        ],
        //'fill-opacity': 0.9,
        'fill-outline-color': [
          "interpolate",
          ["linear"],
          ["to-number", ["coalesce", ["get", start], 0]],
          -10,  '#730000',
          -3.0, '#FF2A00',
          -2.0, '#FF9900',
          -1.5, '#FFF200',
          -1,   '#FDFFCC',
          0,   '#FFFFFF'
        ]
      }
    });

    map.moveLayer(layerId, 'drainage'); // Move before "drainage"

  }


  public updateStreamflowDroughtIndex(map:Map, attr:string){
    const layerId = this.layerActive;
    const colorExpr = this.getDroughtColor(attr);
    const transition = { duration: 1000, delay: 0}
    //map.setPaintProperty(layerId, 'fill-color-transition', transition);
    //map.setPaintProperty(layerId, 'fill-outline-color-transition', transition);
    map.setPaintProperty(layerId, 'fill-color', colorExpr);
    map.setPaintProperty(layerId, 'fill-outline-color', colorExpr);

  }


  public addMeteoWarning(map:Map, warning:string){
    const sourceId = "mvt_meteo_warnings";
    const layerName = "meteo_warnings";
    const layerId = this.layerActiveOverlay1;
    const layerId2 = this.layerActiveOverlay2;

    this.removeLayer(layerId, map);
    this.removeLayer(layerId2, map);
    this.removeSource(sourceId, map);

    map.addSource(sourceId,{
      type: 'vector',
      tiles: [`${env.urlMartin}/mvt_meteo_warnings/{z}/{x}/{y}?warning=${warning}`]
    });

    console.log(`${env.urlMartin}/mvt_meteo_warnings/{z}/{x}/{y}?warning=${warning}`)

    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      'source-layer': layerName,
      paint: {
        'fill-color': [
          'match',
          ['get', 'level'],
          'Medio',   '#FFFF4D',
          'Alto',   '#FFC44E',
          'Muy Alto',   '#EF4C4D',
          'rgba(0,0,0,0)'
        ],
        'fill-opacity': 1,
        'fill-outline-color': [
          'match',
          ['get', 'level'],
          'Medio',   '#FFFF4D',
          'Alto',   '#FFC44E',
          'Muy Alto',   '#EF4C4D',
          'rgba(0,0,0,0)'
        ]
      }
    });

    map.addLayer({
      id: layerId2,
      type: 'line',
      source: sourceId,
      'source-layer': layerName,
      paint: {
        'line-color': [
          'match',
          ['get', 'level'],
          'Crecida',   '#17249c',
          'Incendio',   '#9c1737',
          'Baja Temperatura',   '#17249c',
          'rgba(0,0,0,0)'
        ],
        'line-width': 2
      }
    });

    map.moveLayer(layerId, "drainage"); // Move before "drainage"

  }


  public dropOverlays(map:Map){
    const layerId = this.layerActiveOverlay1;
    const layerId2 = this.layerActiveOverlay2;
    this.removeLayer(layerId, map);
    this.removeLayer(layerId2, map);
    this.removeSource("mvt_meteo_warnings", map);
  }

  public dropMainLayer(map:Map){
    const layerId = this.layerActive;
    this.removeLayer(layerId, map);
  }



  public addPacum(map:Map, product:string, agg:string, date:string){
    const sourceId = "wms_pacum";
    const layerName = "wms_pacum";
    const layerId = this.layerActiveOverlay1;
    const layerId2 = this.layerActiveOverlay2;

    this.removeLayer(layerId, map);
    this.removeLayer(layerId2, map);
    this.removeSource(sourceId, map);


    const wmsBaseURL =
      `${env.urlGeoserver}/` +
      'satellite_based_precipitation/wms?' +
      'service=WMS&' +
      'version=1.1.0&' +
      'request=GetMap&' +
      `layers=satellite_based_precipitation:${product}_${agg}h&` +
      'styles=&' +
      'format=image/png&' +
      'transparent=true&' +
      `time=${date}T00:00:00.000Z&` +
      'srs=EPSG:3857&' +               // Pide en Web Mercator
      'width=256&height=256&' +        // Tamaño de cada tile
      'bbox={bbox-epsg-3857}';         // Placeholder que MapLibre reemplaza

    // 1. Añades la fuente raster
    map.addSource(sourceId, {
      type: 'raster',
      tiles: [ wmsBaseURL ],
      tileSize: 256
    });

    // 2. La layer para dibujarla
    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
    });
    map.moveLayer(layerId, "drainage");
  }


  public updateLayerVisibility(map:Map, layerId:string, isVisible:boolean) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        'visibility',
        isVisible ? 'visible' : 'none'
      );
      if(layerId==="drainage"){
        map.setLayoutProperty(
          "drainage_ecuador",
          'visibility',
          isVisible ? 'visible' : 'none'
        );
      }
    }
  }


  private stylesFFGS(typePlot:string): maplibregl.ExpressionSpecification{
    if(typePlot === "Humedad del suelo"){
      return [
          "interpolate",
          ["linear"],
          ["to-number", ["coalesce", ["get", "asm"], 0]],
          0.00, "rgba(255, 255, 255, 0)",
          0.01, "#F9F788",
          0.10, "#D6D309",
          0.20, "#B08C00",
          0.30, "#B6F8A9",
          0.40, "#1DD41C",
          0.50, "#005200",
          0.60, "#359AFF",
          0.70, "#0069D2",
          0.80, "#00367F",
          0.90, "#100053",
          1.00, "#000000",
        ]
    }

    if(typePlot === "Riesgo de crecida (prox. 24h)"){
      return [
          "interpolate",
          ["linear"],
          ["to-number", ["coalesce", ["get", "ffr"], 0]],
          0.00, "rgba(255, 255, 255, 0)",
          0.01, "#F9F788",
          0.10, "#D6D309",
          0.20, "#B08C00",
          0.30, "#B6F8A9",
          0.40, "#1DD41C",
          0.50, "#005200",
          0.60, "#359AFF",
          0.70, "#0069D2",
          0.80, "#00367F",
          0.90, "#100053",
          1.00, "#000000",
        ]
    }

    if(typePlot === "Pronóstico de precipitación (prox. 24h)"){
      return [
          "interpolate",
          ["linear"],
          ["to-number", ["coalesce", ["get", "fmap"], 0]],
              0.000, "rgba(255, 255, 255, 0)",
              1.000, "#FFFFFF",
              1.010, "#75baff",
              3.750, "#359aff",
              7.500, "#0087ff",
              11.25, "#0674C6",
              15.00, "#0C608D",
              18.75, "#148f1b",
              22.50, "#1acf05",
              26.25, "#63ed07",
              30.00, "#B1F119",
              33.75, "#d5f775",
              37.50, "#fff42b",
              41.25, "#ffcb4d",
              45.00, "#fb9a6f",
              48.75, "#f96d73",
              52.50, "#f84e78",
              56.25, "#f71e54",
              60.00, "#bf0000",
              63.75, "#880000",
              67.50, "#640000",
              71.25, "#2d0000",
              75.00, "#2d0000"
        ]
    }

    if(typePlot === "Precipitación crítica"){
      return [
          "interpolate",
          ["linear"],
          ["to-number", ["coalesce", ["get", "ffg"], 0]],
              0.000, "rgba(255, 255, 255, 0)",
              1.000, "#2d0000",
              1.010, "#640000",
              3.750, "#880000",
              7.500, "#bf0000",
              11.25, "#f71e54",
              15.00, "#f84e78",
              18.75, "#f96d73",
              22.50, "#fb9a6f",
              26.25, "#ffcb4d",
              30.00, "#fff42b",
              33.75, "#d5f775",
              37.50, "#B1F119",
              41.25, "#63ed07",
              45.00, "#1acf05",
              48.75, "#148f1b",
              52.50, "#0C608D",
              56.25, "#0674C6",
              60.00, "#0087ff",
              63.75, "#359aff",
              67.50, "#75baff",
              71.25, "#FFFFFF",
              75.00, "rgba(255, 255, 255, 0)"
        ]
    }

    return ["literal", "#FFFFFF"]


  }



  public addFFGS(map:Map, date:string, plot:string){

    const sourceId = "mvt_ffgs";
    const layerName = "ffgs";
    const layerId = this.layerActiveOverlay1;

    this.removeLayer(layerId, map);
    this.removeSource(sourceId, map);

    map.addSource(sourceId,{
      type: 'vector',
      tiles: [`${env.urlMartin}/mvt_ffgs/{z}/{x}/{y}?datetime=${date}`]
    });
    console.log(plot)

    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      'source-layer': layerName,
      paint: {
        'fill-color': this.stylesFFGS(plot),
        'fill-opacity': 1,
        'fill-outline-color': this.stylesFFGS(plot)
      }
    });

    map.moveLayer(layerId, "drainage");

  }


}


