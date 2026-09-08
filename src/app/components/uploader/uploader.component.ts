import { Component, EventEmitter, Output } from '@angular/core';
import shp from 'shpjs';
import { kml } from '@mapbox/togeojson';

import { GeoPackageAPI } from '@ngageoint/geopackage';

@Component({
  selector: 'app-file-uploader',
  standalone: true,
  templateUrl: './uploader.component.html',
  styleUrls: ['./uploader.component.css']
})

export class FileUploaderComponent {
  @Output() geojsonLoaded = new EventEmitter<any>();

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();

    let geojson: any;
    if (ext === 'zip' || ext === 'shp') {
      // Procesar shapefile en cliente
      const arrayBuffer = await file.arrayBuffer();
      geojson = await shp(arrayBuffer);

    } else if (ext === 'kml') {
      // Procesar KML en cliente
      const text = await file.text();
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(text, 'text/xml');
      geojson = kml(kmlDoc);

    } else if (ext === 'gpkg') {
      // Procesar GeoPackage en cliente usando DAO dinámico
      const arrayBuffer = await file.arrayBuffer();
      // Abrir con Uint8Array (requerido por la API)
      const geopackage = await GeoPackageAPI.open(new Uint8Array(arrayBuffer));
      const featureTables = geopackage.getFeatureTables();
      const features: any[] = [];
      for (const table of featureTables) {
        // Obtener DAO para acceder al bounding box real de la tabla
        const dao = geopackage.getFeatureDao(table);
        // Obtener bounding box real de la tabla
        const bb = dao.getBoundingBox();
        // Query de features dentro del bounding box de la tabla
        const tableFeatures = geopackage.queryForGeoJSONFeaturesInTable(
          table,
          bb
        );
        features.push(...tableFeatures);
      }
      geojson = { type: 'FeatureCollection', features };

    } else {
      alert('Formato no soportado');
      return;
    }

    this.geojsonLoaded.emit(geojson);
  }
}
