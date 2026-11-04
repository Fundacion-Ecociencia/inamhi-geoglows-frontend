/*****************************************************************************
 *                               HOME COMPONENT                              *
 *****************************************************************************
 * Home (landing) component.
 *
 * Responsibilities
 * ----------------
 * - Tracks window scroll to toggle `scrolled` (useful for sticky headers,
 *   shadow effects, or showing a "back to top" button).
 * - Provides smooth navigation to the "About" section via `scrollToElement`.
 * - Exposes an action to open the project GitHub repository.
 *
 * @author Juseth E. Chancay
 * @lastUpdated 2025-08-19
 */




/*****************************************************************************
 *                           LIBRARIES AND MODULES                           *
 *****************************************************************************/
import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AnalyticsService } from '../../services/analytics.service';




/*****************************************************************************
 *                           COMPONENT DEFINITION                            *
 *****************************************************************************/
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

  /***************************************************************************
   *                             State variables                             *
   ***************************************************************************/
  public scrolled:boolean = false;
  public analytics = inject(AnalyticsService);



  /***************************************************************************
   *                           Component Functions                           *
   ***************************************************************************/
  /**
   * Reopen the Google Analytics consent notice ("PRIVACIDAD" menu item).
   */
  public openPrivacy(event: Event): void {
    event.preventDefault();
    this.analytics.openSettings();
  }

  /**
   * Window scroll listener that updates `scrolled` on every scroll event.
   */
  @HostListener('window:scroll', [])
  public onWindowScroll() {
    this.scrolled = window.scrollY > 50;
  }

  /**
   * Scroll the page to the "About" section.
   */
  @ViewChild('about') myScrollContainer!: ElementRef;
  public scrollToElement(): void {
    const element = this.myScrollContainer.nativeElement;
    element.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  /**
   * Navigate to the project's GitHub repository.
   */
  public githubRedirect() {
    window.location.href = 'https://github.com/jusethCS/inamhi-geoglows';
  }

}
