// src/main.ts
;(window as any).locateFile = (file: string) => {
  // Si piden el WASM en la raíz
  if (file === 'sql-wasm.wasm') {
    return 'sql-wasm.wasm';
  }
  // Otros archivos WASM (por si acaso)
  return `assets/geopackage/${file}`;
};

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
