import { cartoKey } from "./carto-key";

export const env = {
  production: true,
  urlHost: "https://services.geoglows.org/",
  urlAPI: "https://services.geoglows.org/api",
  urlGeoserver: "https://services.geoglows.org/geoserver",
  urlMartin: "https://services.geoglows.org/martin",
  // Llave de CARTO Basemaps (devteam@ecociencia.org), restringida en el panel
  // de CARTO al dominio inamhi.geoglows.org. Vive en carto-key.ts, fuera de git.
  cartoKey: cartoKey
};
