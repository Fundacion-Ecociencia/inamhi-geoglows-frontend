/**
 * AppTemplateComponent
 * ---------------------
 * Angular standalone component for application template layout.
 * Provides a standard header and modal structure for apps integrated
 * in a larger hydrometeorological or geospatial platform.
 *
 * Key features:
 * - Display of app name, logo, and navigation button
 * - Toggleable side panel for user interaction
 * - Bootstrap-based modals for data, info, and video progress
 * - Optional redirect to login with dynamic return URL
 * - Emits panel activation state to parent components
 *
 * This component is suitable for integration in modular web apps
 * that require consistent UI for navigation, user info display, and
 * modal dialogs.
 *
 * @author: Juseth E. Chancay
 * @date: 2025-06-02
 */


import { Component, ElementRef, EventEmitter } from '@angular/core';
import { Input, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Modal } from 'bootstrap';


@Component({
  selector: 'app-template',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-template.component.html',
  styleUrls: ['./app-template.component.css']
})


export class AppTemplateComponent {
  // Definition of communication variables
  @Input() appName?: string;
  @Input() imageUrl?: string;
  @Input() appUrl?: string;

  // Boolean variables for dropdown and panel components
  public isOpen: boolean = false;
  @Input() isPanelActive: boolean = true;
  @Output() panelActivate = new EventEmitter<boolean>();

  // State variables
  public isAuth: boolean = false;
  public userFullName: string = "";
  public username: string = "";
  public staff: boolean = false;

  // Modals panels
  @ViewChild('dataModal') dataModal?: ElementRef;
  @ViewChild('infoModal') infoModal?: ElementRef;
  @ViewChild('videoProgressModal') videoProgressModal?: ElementRef;

  // Constructor
  constructor(private router: Router) {}

  // Toggle panel visibility
  public toggleDropdown(): void {
    this.isPanelActive = !this.isPanelActive;
    this.panelActivate.emit(this.isPanelActive);
  }

  // Close app and redirect to app panel
  public redirectToApps(): void {
    this.router.navigateByUrl('/apps');
  }

  // Show data modal
  public showDataModal(): void {
    if (this.dataModal) {
      const modal = new Modal(this.dataModal.nativeElement);
      modal.show();
    }
  }

  // Show info modal
  public showInfoModal(): void {
    if (this.infoModal) {
      const modal = new Modal(this.infoModal.nativeElement);
      modal.show();
    }
  }

  // Login and redirect
  public loginRedirect(){
    this.router.navigateByUrl(`/login?next=${this.appUrl}`);
  }
}
