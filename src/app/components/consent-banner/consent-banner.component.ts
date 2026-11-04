/*****************************************************************************
 *                         CONSENT BANNER COMPONENT                          *
 *****************************************************************************
 * Aviso de consentimiento para Google Analytics. Aparece abajo, sobre todas
 * las pantallas, hasta que el visitante acepta o rechaza. Se vuelve a abrir
 * desde "Privacidad" en la página de inicio y en la de aplicaciones.
 * La lógica está en services/analytics.service.ts.
 */
import { Component, inject } from '@angular/core';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  templateUrl: './consent-banner.component.html',
  styleUrl: './consent-banner.component.css'
})
export class ConsentBannerComponent {
  readonly analytics = inject(AnalyticsService);
  public details = false;
}
