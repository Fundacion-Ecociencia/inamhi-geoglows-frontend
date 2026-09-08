import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';

@Injectable({ providedIn: 'root' })
export class VectorGridLoader {
  private loading: Promise<void> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // En navegador, asegura que tu instancia importada quede en window.L
    if (isPlatformBrowser(this.platformId)) {
      (window as any).L = L;
    }
  }

  /**
   * Devuelve la instancia de Leaflet que ya tiene vectorGrid cargado.
   * No intenta escribir en el import; usa window.L.
   */
  async getLeaflet(): Promise<any> {
    if (!isPlatformBrowser(this.platformId)) return L;

    const wL = (window as any).L || L;

    // Si ya está disponible, listo
    if (wL?.vectorGrid?.protobuf) return wL;

    // Carga side-effect del plugin bundled
    if (!this.loading) {
      this.loading = import('leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.js').then(() => {});
    }
    await this.loading;

    return (window as any).L || L;
  }
}
