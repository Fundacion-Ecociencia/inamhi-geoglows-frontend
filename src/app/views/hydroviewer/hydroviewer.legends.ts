/**
 * LegendControlGeoglowsFloodWarning
 *
 *
 * Responsibilities
 * ----------------
 * - Create a MapLibre control to display flood alerts from GEOGLOWS.
 * - Show model initialization date and forecast date.
 *
 * Key Features
 * ------------
 * - White box with styled text and icons.
 * - Compatible with MapLibre's control API (onAdd, onRemove).
 *
 * @author Juseth E. Chancay
 * @lastUpdated 2025-08-19
 *
 */

export class LegendControlGeoglowsFloodWarning {
  private _container!: HTMLDivElement;
  private _map: any;

  constructor(private dateString: string, private forecast: string) {}

  onAdd(map: any) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl';
    this._container.style.background = 'white';
    this._container.style.borderRadius = '5px';
    this._container.style.padding = '7px 10px';
    this._container.style.fontSize = '13px';
    this._container.style.margin = '8px';
    this._container.style.width = '280px';
    this._container.innerHTML = `
      <b>
        <i class="fa-regular fa-cloud-showers-water"></i>
        Alertas por inundación (GEOGLOWS)
      </b><br>
      <b>Inicialización del modelo:</b> ${this.dateString}<br>
      <b>Pronóstico para:</b> ${this.forecast}
    `;
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}





/**
 * LegendControlDrought
 *
 * Responsibilities
 * ----------------
 * - Create a MapLibre control to display drought indices.
 * - Show date and legend for drought severity categories.
 *
 * Key Features
 * ------------
 * - Uses colored boxes for drought levels.
 * - Accessible labels and simple layout.
 */
export class LegendControlDrought {
  private _container!: HTMLDivElement;
  private _map: any;

  constructor(private dateString: string, private title: string) {}

  onAdd(map: any) {
    this._map = map;
    this._container = document.createElement('div');
    // OBLIGATORIO: esta clase para controles MapLibre
    this._container.className = 'maplibregl-ctrl';
    this._container.style.background = 'white';
    this._container.style.borderRadius = '5px';
    this._container.style.padding = '7px 10px';
    this._container.style.fontSize = '13px';
    this._container.style.margin = '8px';
    this._container.style.width = '280px';
    this._container.innerHTML = `
      <b><i class="fa-regular fa-sun-plant-wilt"></i> ${this.title}</b><br>
      <b>Fecha:</b> ${this.dateString}<br>

      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="
          width: 25px;
          height: 15px;
          background: #FFFFFF;
          border: 1px solid #ccc;
          margin-right: 10px;">
        </div>
        <span>Sin sequía</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="
          width: 25px;
          height: 15px;
          background: #FDFFCC;
          border: 1px solid #ccc;
          margin-right: 10px;">
        </div>
        <span>Sequía leve</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="
          width: 25px;
          height: 15px;
          background: #FFF200;
          border: 1px solid #ccc;
          margin-right: 10px;">
        </div>
        <span>Sequía moderada</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="
          width: 25px;
          height: 15px;
          background: #FF9900;
          border: 1px solid #ccc;
          margin-right: 10px;">
        </div>
        <span>Sequía severa</span>
      </div>
      <div style="display: flex; align-items: center;">
        <div style="
          width: 25px;
          height: 15px;
          background: #FF2A00;
          border: 1px solid #ccc;
          margin-right: 10px;">
        </div>
        <span>Sequía extrema</span>
      </div>


    `;
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}






/**
 * LegendControlMeteoWarning
 *
 * Responsibilities
 * ----------------
 * - Display a MapLibre control for meteorological warnings.
 * - Show type, number, and validity dates of warnings.
 *
 * Key Features
 * ------------
 * - Warning levels with colors (medium, high, very high).
 * - Dynamic legend based on warning type (flood, frost, fire).
 */
export class LegendControlMeteoWarning {
  private _container!: HTMLDivElement;
  private _map: any;

  constructor(
    private title: string,
    private number: string,
    private start:string,
    private end:string) {}

  onAdd(map: any) {
    this._map = map;
    this._container = document.createElement('div');
    // OBLIGATORIO: esta clase para controles MapLibre
    this._container.className = 'maplibregl-ctrl';
    this._container.style.background = 'white';
    this._container.style.borderRadius = '5px';
    this._container.style.padding = '7px 10px';
    this._container.style.fontSize = '13px';
    this._container.style.margin = '8px';
    this._container.style.width = '280px';
    this._container.innerHTML = `
      <b><i class="fa-regular fa-chart-tree-map"></i> Advertencia No ${this.number}.</b><br>
      <b>${this.title}</b><br>
      Válido desde ${this.start}<br>hasta ${this.end}

      <div style="display: flex; align-items: center; margin-bottom: 2px; margin-top:8px">
        <div style="width: 25px; height: 15px; background: #FFFF4D; border: 1px solid #ccc; margin-right: 10px;"></div>
        <span>Nivel Medio</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 25px; height: 15px; background: #FFC44E; border: 1px solid #ccc; margin-right: 10px;"></div>
        <span>Nivel Alto</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 25px; height: 15px; background: #EF4C4D; border: 1px solid #ccc; margin-right: 10px;"></div>
        <span>Nivel Muy Alto</span>
      </div>
    `;
    if(this.title == "Lluvias, tormentas y viento"){
      this._container.innerHTML = `${this._container.innerHTML}
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 25px; height: 15px; background: #FFFFFF; border: 3px solid #17249c; margin-right: 10px;"></div>
        <span>Zonas propensas a crecidas</span>
      </div>
      `
    } else {
      this._container.innerHTML = `${this._container.innerHTML}
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 25px; height: 15px; background: #FFFFFF; border: 3px solid #17249c; margin-right: 10px;"></div>
        <span>Zonas propensas a heladas</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 2px;">
        <div style="width: 25px; height: 15px; background: #FFFFFF; border: 3px solid #9c1737; margin-right: 10px;"></div>
        <span>Zonas propensas a incendios</span>
      </div>
      `

    }
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}



/**
 * LegendControlPacum
 *
 * Responsibilities
 * ----------------
 * - Display a MapLibre control for accumulated precipitation.
 * - Show start and end dates of the selected aggregation period.
 *
 * Key Features
 * ------------
 * - Uses static legend image for precipitation intensity.
 * - Compact and styled white container.
 */
export class LegendControlPacum {
  private _container!: HTMLDivElement;
  private _map: any;

  constructor(private title:string, private date1:string, private date2:string) {}

  onAdd(map: any) {
    this._map = map;
    this._container = document.createElement('div');
    // OBLIGATORIO: esta clase para controles MapLibre
    this._container.className = 'maplibregl-ctrl';
    this._container.style.background = 'white';
    this._container.style.borderRadius = '5px';
    this._container.style.padding = '7px 10px';
    this._container.style.fontSize = '13px';
    this._container.style.margin = '8px';
    this._container.style.width = '280px';
    this._container.innerHTML = `
      <b><i class="fa-regular fa-cloud-sun-rain"></i></b>
      <b>Precipitacion acumulada</b><br>Desde ${this.date1} 07:00 <br>hasta ${this.date2} 07:00 <br>
      <img
        src="https://inamhi.geoglows.org/assets/legend/P_Diaria.png"
        alt="Leyenda de precipitaciones horarias"
        width="260px"
      />
    `;
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}



/**
 * LegendControlFFGS
 *
 * Responsibilities
 * ----------------
 * - Create a MapLibre control for Flash Flood Guidance System.
 * - Show product type and validity date.
 *
 * Key Features
 * ------------
 * - Supports multiple FFGS products:
 *   soil moisture, critical precipitation, forecasts, flood risk.
 * - Uses different legend images depending on product type.
 */
export class LegendControlFFGS {
  private _container!: HTMLDivElement;
  private _map: any;

  constructor(private title:string, private date:string) {}

  onAdd(map: any) {
    this._map = map;
    this._container = document.createElement('div');
    // OBLIGATORIO: esta clase para controles MapLibre
    this._container.className = 'maplibregl-ctrl';
    this._container.style.background = 'white';
    this._container.style.borderRadius = '5px';
    this._container.style.padding = '7px 10px';
    this._container.style.fontSize = '13px';
    this._container.style.margin = '8px';
    this._container.style.width = '280px';

    if(this.title === "Humedad del suelo"){
      this._container.innerHTML = `
        <b><i class="fa-regular fa-house-flood-water"></i></b>
        <b>Flash Flood Guidance System</b><br>${this.title}<br>
        Válido para ${this.date}
        <img
          src="https://inamhi.geoglows.org/assets/legend/asm.png"
          width="260px"
        />`;
      return this._container;
    }
    if(this.title === "Riesgo de crecida (prox. 24h)"){
      this._container.innerHTML = `
        <b><i class="fa-regular fa-house-flood-water"></i></b>
        <b>Flash Flood Guidance System</b><br>${this.title}<br>
        Válido para ${this.date}
        <img
          src="https://inamhi.geoglows.org/assets/legend/asm.png"
          width="260px"
        />`;
      return this._container;
    }
    if(this.title === "Pronóstico de precipitación (prox. 24h)"){
      this._container.innerHTML = `
        <b><i class="fa-regular fa-house-flood-water"></i></b>
        <b>Flash Flood Guidance System</b><br>${this.title}<br>
        Válido para ${this.date}
        <img
          src="https://inamhi.geoglows.org/assets/legend/P_Diaria.png"
          width="260px"
        />`;
      return this._container;
    }
    if(this.title === "Precipitación crítica"){
      this._container.innerHTML = `
        <b><i class="fa-regular fa-house-flood-water"></i></b>
        <b>Flash Flood Guidance System</b><br>${this.title}<br>
        Válido para ${this.date}
        <img
          src="https://inamhi.geoglows.org/assets/legend/ffg2.png"
          width="260px"
        />`;
      return this._container;
    }
    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}
