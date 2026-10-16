/*****************************************************************************
 *                             APP PANEL COMPONENT                           *
 *****************************************************************************
 * App (landing) component.
 *
 * @author Juseth E. Chancay
 * @lastUpdated 2025-08-19
 */




/*****************************************************************************
 *                           LIBRARIES AND MODULES                           *
 *****************************************************************************/
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { CardappComponent } from '../../components/cardapp/cardapp.component';


/*****************************************************************************
 *                           COMPONENT DEFINITION                            *
 *****************************************************************************/
@Component({
  selector: 'app-apps',
  standalone: true,
  imports: [CommonModule, CardappComponent],
  templateUrl: './apps.component.html',
  styleUrl: './apps.component.css'
})
export class AppsComponent {

  /***************************************************************************
   *                             State variables                             *
   ***************************************************************************/
  public scrolled:boolean = false;
  // ENSO Ecuador se usa por enlace directo (/apps/enso) hasta que se decida mostrarla.
  public showEnsoCard = false;

}
