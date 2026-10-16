/**
 * Geoserver service helper for interacting with WMS ImageMosaic layers.
 * Provides utilities to fetch available dates and generate WMS layers.
 * @author Juseth E. Chancay
 * @lastUpdated 2025-08-19
 */

import * as L from 'leaflet';

export class Geoserver {

  /**
   * Fetch the latest available dates from an ImageMosaic WMS service.
   *
   * @param url - Base WMS endpoint URL.
   * @param layer - Name of the GeoServer layer to query.
   * @param n - How many of the latest dates to return (default 10).
   * @returns Promise that resolves to an array of ISO date strings.
   *
   * Details
   * -------
   * - Sends a GetCapabilities request to the WMS service.
   * - Parses the XML response and searches for the given layer.
   * - Extracts the "time" extent values from the layer metadata.
   * - Returns the last n dates (10 by default, for efficiency).
   * - Returns an empty array if the layer or time extent is not found.
   */
  public async getAvailableDatesFromImageMosaic(
    url: string,
    layer: string,
    n: number = 10
  ): Promise<string[]> {
    const getCapabilitiesUrl =
      `${url}?service=WMS&version=1.1.1&request=GetCapabilities`;

    try {
      // Fetch XML data from the WMS service
      const response = await fetch(getCapabilitiesUrl);
      const xmlText = await response.text();

      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "application/xml");

      // Find the requested layer by its <Name>
      const layerElement = Array.from(xmlDoc.querySelectorAll("Layer"))
        .find(node =>
          node.querySelector("Name")?.textContent === layer
        );

      if (!layerElement) return [];

      // Access the <Extent> node with name="time"
      const timeExtent =
        layerElement.querySelector("Extent[name='time']");
      if (!timeExtent || !timeExtent.textContent) return [];

      // Split values and keep the last n entries (10 by default)
      const dates = timeExtent.textContent.split(",");
      return dates.slice(-n);

    } catch (error) {
      console.error("Error fetching dates:", error);
      return [];
    }
  }

  /**
   * Create a Leaflet WMS layer from an ImageMosaic service.
   *
   * @param url - WMS endpoint URL.
   * @param layer - Name of the GeoServer layer.
   * @param time - ISO time string to request a specific timestep.
   * @returns Leaflet TileLayer configured for the WMS request.
   *
   */
  public getWMSFromImageMosaic(
    url: string,
    layer: string,
    time: string
  ): any {
    const options = {
      layers: layer,
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      crs: L.CRS.EPSG4326,
      time: time,
      tileSize: 512,
      detectRetina: false,
      tiled: false
    } as L.WMSOptions & { time: string };

    return L.tileLayer.wms(url, options);
  }


  public getWMSFromViewOptions(
    url: string,
    layer: string,
    time: string
  ): any {
    const options = {
      layers: layer,
      format: 'image/svg',
      transparent: true,
      version: '1.1.1',
      crs: L.CRS.EPSG4326,
      viewparams: `dts:${time}`,
      tileSize: 512,
      detectRetina: false,
      tiled: false
    } as L.WMSOptions & { viewparams: string };

    return L.tileLayer.wms(url, options);
  }





}
