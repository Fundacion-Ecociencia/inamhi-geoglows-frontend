/*****************************************************************************
 *                             ANALYTICS SERVICE                             *
 *****************************************************************************
 * Google Analytics 4.
 *
 * - Solo carga en env.gaHost (producción). En localhost no carga nada, salvo
 *   que se active con  localStorage.setItem('ga_debug', '1')  y se recargue la
 *   página: entonces manda los eventos con debug_mode (se ven en DebugView de
 *   Analytics). Se apaga con  localStorage.removeItem('ga_debug').
 * - Los cambios de pantalla los cuenta la "medición mejorada" de Analytics
 *   (cambios del historial del navegador); el título de cada pantalla sale de
 *   la propiedad `title` de las rutas en app.routes.ts.
 * - Si un bloqueador de anuncios impide la descarga del script, la plataforma
 *   sigue igual.
 */




/*****************************************************************************
 *                           LIBRARIES AND MODULES                           *
 *****************************************************************************/
import { Injectable } from '@angular/core';
import { env } from '../../environments/environment';

const DEBUG_KEY = 'ga_debug';




/*****************************************************************************
 *                            SERVICE DEFINITION                             *
 *****************************************************************************/
@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  private readonly id: string = env.gaMeasurementId;
  private loaded = false;

  /** Se llama una vez al arrancar la app. */
  init(): void {
    const debug = readStorage(DEBUG_KEY) === '1';
    const active = !!this.id && (location.hostname === env.gaHost || debug);
    if (!active || this.loaded) return;
    this.loaded = true;

    // Mismo arranque que el fragmento oficial de Google (gtag.js).
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () { w.dataLayer.push(arguments); };
    // Analytics sí; nada de publicidad.
    w.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    w.gtag('js', new Date());
    const config: Record<string, unknown> = {
      // Cookies solo para este dominio, no para todo geoglows.org.
      cookie_domain: 'none',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    };
    // debug_mode activa DebugView con cualquier valor, incluso false: solo se
    // agrega cuando se pide.
    if (debug) config['debug_mode'] = true;
    w.gtag('config', this.id, config);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.id)}`;
    script.onerror = () => {
      if (debug) console.info('Analytics: el script de Google no cargó (¿bloqueador de anuncios?)');
    };
    document.head.appendChild(script);
  }
}


/** localStorage puede fallar en modo privado o con el almacenamiento bloqueado. */
function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
