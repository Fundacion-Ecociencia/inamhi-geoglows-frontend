import { Component } from '@angular/core';
import { StormReportEditorComponent } from '../../components/storm-report-editor/storm-report-editor.component';
import { HotspotReportEditorComponent } from "../../components/hotspot-report-editor/hotspot-report-editor.component";
import { AppTemplateComponent } from "../../components/template/app-template.component";
import { DropdownComponent } from "../../components/dropdown/dropdown.component";
import { MatFormField } from "@angular/material/form-field";
import { MatSelect, MatSelectModule } from "@angular/material/select";
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';



@Component({
  selector: 'app-hydromet-report',
  standalone: true,
  imports: [
    StormReportEditorComponent,
    AppTemplateComponent,
    DropdownComponent,
    MatFormField,
    MatSelect,
    MatSelectModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HotspotReportEditorComponent
],
  templateUrl: './hydromet-report.component.html',
  styleUrl: './hydromet-report.component.css'
})
export class HydrometReportComponent {


  reports = [
    "Reporte de tormentas severas",
    "Reporte de focos de calor",
    "Reporte hidrológico Especial Esmeraldas"
  ]
  selectedReport = "Reporte de focos de calor"

}
