/**
 * DropdownComponent
 * ------------------
 * Angular standalone component that renders a collapsible panel
 * with a title and customizable icon.
 *
 * Designed for use in modular user interfaces where grouped
 * content can be expanded or collapsed. Integrates Angular
 * Material Expansion Panel and FontAwesome/Material icons.
 *
 * Key features:
 * - Configurable title and icon
 * - Expand/collapse control via `expanded` input
 * - Lightweight, reusable layout component for nested content
 *
 * Commonly used in dashboards, side panels, or settings sections
 * to group content under a labeled header.
 *
 * @author: Juseth E. Chancay
 * @date: 2025-06-02
 */

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';


@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule
  ],
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.css'
})


export class DropdownComponent {
  @Input() expanded: boolean = false;
  @Input() iconClass: string = "fa-brands fa-angular";
  @Input() title: string = "";
}



