/*****************************************************************************
 *                             ANALYTICS SERVICE                             *
 *****************************************************************************
 * Google Analytics 4 con consentimiento previo.
 *
 * - Solo funciona en env.gaHost (producción). En localhost no carga nada, salvo
 *   que se active con  localStorage.setItem('ga_debug', '1')  y se recargue la
 *   página: entonces manda los eventos con debug_mode (se ven en DebugView de
 *   Analytics). Se apaga con  localStorage.removeItem('ga_debug').
 * - El script de Google no se descarga hasta que el visitante acepta. Si
 *   rechaza, no sale ninguna petición a Google.
 * - La decisión se guarda en localStorage. Se vuelve a preguntar a los 12 meses
 *   o si cambia CONSENT_VERSION (por ejemplo, si cambia el texto del aviso).
 * - Los cambios de pantalla los cuenta la "medición mejorada" de Analytics
 *   (cambios del historial del navegador); el título de cada pantalla sale de
 *   la propiedad `title` de las rutas en app.routes.ts.
 */




/*****************************************************************************
 *                           LIBRARIES AND MODULES                           *
 *****************************************************************************/
import { Injectable, signal } from '@angular/core';
import { env } from '../../environments/environment';

type Choice = 'granted' | 'denied';
interface StoredConsent { v: number; choice: Choice; ts: number; }

const CONSENT_KEY = 'ga_consent';
const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const DEBUG_KEY = 'ga_debug';




/*****************************************************************************
 *                            SERVICE DEFINITION                             *
 *****************************************************************************/
@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  /** ¿Analytics aplica en este sitio? (producción, o localhost con ga_debug) */
  readonly active: boolean;
  /** Mostrar el aviso de consentimiento. */
  readonly showBanner = signal(false);
  /** Decisión guardada del visitante, o null si no ha decidido. */
  readonly choice = signal<Choice | null>(null);

  private readonly id: string = env.gaMeasurementId;
  private readonly debug: boolean;
  private loaded = false;

  constructor() {
    this.debug = readStorage(DEBUG_KEY) === '1';
    this.active = !!this.id && (location.hostname === env.gaHost || this.debug);
  }

  /** Se llama una vez al arrancar la app. */
  init(): void {
    if (!this.active) return;
    const stored = this.readConsent();
    this.choice.set(stored);
    if (stored === 'granted') this.enable();
    else if (stored === null) this.showBanner.set(true);
  }

  accept(): void {
    this.saveConsent('granted');
    this.enable();
    this.showBanner.set(false);
  }

  reject(): void {
    this.saveConsent('denied');
    this.disable();
    this.showBanner.set(false);
  }

  /** Vuelve a mostrar el aviso para cambiar la decisión (enlace "Privacidad"). */
  openSettings(): void {
    if (this.active) this.showBanner.set(true);
  }


  /***************************************************************************
   *                          Carga y desactivación                          *
   ***************************************************************************/
  private enable(): void {
    const w = window as any;
    w[`ga-disable-${this.id}`] = false;
    if (this.loaded) {
      w.gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    this.loaded = true;

    // Mismo arranque que el fragmento oficial de Google (gtag.js).
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () { w.dataLayer.push(arguments); };
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
    if (this.debug) config['debug_mode'] = true;
    w.gtag('config', this.id, config);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.id)}`;
    // Si un bloqueador de anuncios impide la descarga, la plataforma sigue igual.
    script.onerror = () => {
      if (this.debug) console.info('Analytics: el script de Google no cargó (¿bloqueador de anuncios?)');
    };
    document.head.appendChild(script);
  }

  private disable(): void {
    const w = window as any;
    w[`ga-disable-${this.id}`] = true;
    if (this.loaded) w.gtag('consent', 'update', { analytics_storage: 'denied' });
    // Borra las cookies que haya dejado Analytics (_ga y _ga_XXXX).
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (name === '_ga' || name.startsWith('_ga_')) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    }
  }


  /***************************************************************************
   *                        Decisión del visitante                           *
   ***************************************************************************/
  private readConsent(): Choice | null {
    try {
      const raw = readStorage(CONSENT_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw) as StoredConsent;
      const valid = c.v === CONSENT_VERSION
        && (c.choice === 'granted' || c.choice === 'denied')
        && typeof c.ts === 'number'
        && Date.now() - c.ts < CONSENT_MAX_AGE_MS;
      return valid ? c.choice : null;
    } catch {
      return null;
    }
  }

  private saveConsent(choice: Choice): void {
    this.choice.set(choice);
    const value: StoredConsent = { v: CONSENT_VERSION, choice, ts: Date.now() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(value)); } catch { /* modo privado */ }
  }
}


/** localStorage puede fallar en modo privado o con el almacenamiento bloqueado. */
function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
