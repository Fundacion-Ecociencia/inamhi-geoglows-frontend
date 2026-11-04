import { Routes } from '@angular/router';
import { HomeComponent } from './views/home/home.component';
import { AppsComponent } from './views/apps/apps.component';
import { HydroviewerComponent } from './views/hydroviewer/hydroviewer.component';
import { HydropowerComponent } from './views/hydropower/hydropower.component';
import { MetDataExplorerComponent } from './views/met-data-explorer/met-data-explorer.component';
import { HydrometReportComponent } from './views/hydromet-report/hydromet-report.component';
import { EnsoComponent } from './views/enso/enso.component';


// El título de cada ruta va a la pestaña del navegador y a los reportes de
// Google Analytics, que los agrupa por título de página.
export const routes: Routes = [
  { path: "", component: HomeComponent, title: "INAMHI GEOGLOWS" },
  { path: "apps", component: AppsComponent, title: "Aplicaciones · INAMHI GEOGLOWS" },
  { path: "apps/hydroviewer", component: HydroviewerComponent, title: "Hydroviewer · INAMHI GEOGLOWS" },
  { path: "apps/hydropower", component: HydropowerComponent, title: "Hydropower · INAMHI GEOGLOWS" },
  { path: "apps/met-data-explorer", component: MetDataExplorerComponent, title: "Met Data Explorer · INAMHI GEOGLOWS" },
  { path: "apps/hydromet-report-tool", component: HydrometReportComponent, title: "Hydromet Report · INAMHI GEOGLOWS" },
  { path: "apps/enso", component: EnsoComponent, title: "ENSO · INAMHI GEOGLOWS" },
  { path: "**", redirectTo: "", pathMatch: "full" }
];
