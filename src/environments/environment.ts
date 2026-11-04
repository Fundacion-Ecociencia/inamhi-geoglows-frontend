import { cartoKey } from "./carto-key";

export const env = {
  production: true,
  urlHost: "https://services.geoglows.org/",
  urlAPI: "https://services.geoglows.org/api",
  urlGeoserver: "https://services.geoglows.org/geoserver",
  urlMartin: "https://services.geoglows.org/martin",
  // Llave de CARTO Basemaps (devteam@ecociencia.org), restringida en el panel
  // de CARTO al dominio inamhi.geoglows.org. Vive en carto-key.ts, fuera de git.
  cartoKey: cartoKey,
  // Google Analytics 4 (cuenta devteam@ecociencia.org). El ID no es secreto: va
  // en el código de cada página. Solo se carga en gaHost (ver
  // app/services/analytics.service.ts).
  gaMeasurementId: "G-89G6K3X6KH",
  gaHost: "inamhi.geoglows.org"
};
