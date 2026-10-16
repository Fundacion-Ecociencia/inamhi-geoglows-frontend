import { Routes } from '@angular/router';
import { HomeComponent } from './views/home/home.component';
import { AppsComponent } from './views/apps/apps.component';
import { HydroviewerComponent } from './views/hydroviewer/hydroviewer.component';
import { HydropowerComponent } from './views/hydropower/hydropower.component';
import { MetDataExplorerComponent } from './views/met-data-explorer/met-data-explorer.component';
import { HydrometReportComponent } from './views/hydromet-report/hydromet-report.component';
import { EnsoComponent } from './views/enso/enso.component';


export const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "apps", component: AppsComponent },
  { path: "apps/hydroviewer", component: HydroviewerComponent },
  { path: "apps/hydropower", component: HydropowerComponent },
  { path: "apps/met-data-explorer", component: MetDataExplorerComponent },
  { path: "apps/hydromet-report-tool", component: HydrometReportComponent },
  { path: "apps/enso", component: EnsoComponent },
  { path: "**", redirectTo: "", pathMatch: "full" }
];
