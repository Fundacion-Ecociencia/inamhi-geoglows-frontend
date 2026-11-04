import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConsentBannerComponent } from './components/consent-banner/consent-banner.component';
import { AnalyticsService } from './services/analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConsentBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

  constructor() {
    // Google Analytics: muestra el aviso o carga el script según la decisión guardada.
    inject(AnalyticsService).init();
  }

}
