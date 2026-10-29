/**
 * WMSTimeControl
 *
 * Responsibilities
 * ----------------
 * - Manage a sequence of WMS layers in Leaflet for temporal data.
 * - Provide controls for next, previous, play, pause, and destroy.
 * - Display a dynamic legend with titles and optional image.
 * - Allow legend minimization and expansion.
 *
 * Key Features
 * ------------
 * - Cycles through WMS layers to simulate time animations.
 * - Supports overlays synchronized with main layers.
 * - Custom Leaflet control for displaying a legend container.
 * - Play/Pause interval-based animation (default 300ms).
 * - Legend UI includes close/expand buttons.
 *
 * @author Juseth E. Chancay
 * @lastUpdated 2025-09-16
 */

import * as L from 'leaflet';

export class WMSTimeControl {
  // Atributes
  private map: L.Map;
  public layers: L.TileLayer.WMS[];
  public overlays: L.TileLayer.WMS[] | undefined;
  public currentDateIndex: number;
  /** true después de destroy(): las capas ya no están en el mapa y el control no debe volver a usarse. */
  public destroyed = false;
  private dateControl: L.Control;
  private dateElement: HTMLElement;
  private interval: any;
  private reverse:boolean;
  private titles:string[];
  private img: string | undefined;

  // Legend elements
  private legendContainer!: HTMLElement;
  private closeBtn!: HTMLButtonElement;
  private expandBtn!: HTMLButtonElement;
  private minimized = false;
  // Precarga progresiva: la fecha visible se pide primero y las demás de una en una (ver constructor)
  private pendingPreload: number[] = [];
  private preloadCancelled = false;
  private preloadInFlight = 0;
  // Cuántas fechas se precargan a la vez después de la visible. 1 = una por una (la visible tarda menos, la
  // animación completa tarda más); medido el 14 oct 2026 con WRF 3-horario (25 fechas): 1 → 0,9 s / 21 s, 3 → ver daily.
  private static readonly PRELOAD_CONCURRENCY = 3;


  /**
     * Constructor for WMSTimeControl.
     *
     * @param map - Leaflet map instance where layers are added.
     * @param layers - Array of WMS layers representing time steps.
     * @param overlays - Optional array of overlay layers.
     * @param img - Optional image URL to display in the legend.
     * @param titles - Titles for each time step (dates or metadata).
     * @param reverse - If true, starts from the last layer.
     */
  constructor(
    map: L.Map,
    layers: L.TileLayer.WMS[] | any,
    overlays: L.TileLayer.WMS[] | undefined,
    img: string | undefined,
    titles:string[],
    reverse:boolean = false
  ) {

    this.map = map;
    this.layers = layers;
    this.overlays = overlays;
    this.currentDateIndex = reverse ? this.layers.length - 1 : 0;
    this.interval = null;
    this.img = img;
    this.titles=titles;
    this.reverse = reverse;

    // Create legend container, content element and control
    this.legendContainer = document.createElement('div');
    this.legendContainer.className = 'legend-container';
    this.legendContainer.style.position = 'relative';
    this.legendContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    this.legendContainer.style.color = 'black';
    this.legendContainer.style.padding = '5px 20px 5px 5px'; // espacio para botón
    this.legendContainer.style.fontSize = '0.8rem';
    this.legendContainer.style.borderRadius = '5px';
    this.legendContainer.style.maxWidth = '280px';

    // Legend content (where you already write title + image)
    this.dateElement = document.createElement('div');
    this.dateElement.className = 'legend-date';
    this.legendContainer.appendChild(this.dateElement);

    // Close Button (X)
    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.innerHTML = '<i class="fa-regular fa-rectangle-xmark"></i>';
    this.closeBtn.title = 'Minimizar leyenda';
    this.closeBtn.style.position = 'absolute';
    this.closeBtn.style.top = '4px';
    this.closeBtn.style.right = '4px';
    this.closeBtn.style.border = 'none';
    this.closeBtn.style.background = 'transparent';
    this.closeBtn.style.fontSize = '16px';
    this.closeBtn.style.cursor = 'pointer';
    this.legendContainer.appendChild(this.closeBtn);

    // Excpand button
    this.expandBtn = document.createElement('button');
    this.expandBtn.type = 'button';
    this.expandBtn.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i>';
    this.expandBtn.title = 'Expandir leyenda';
    //this.expandBtn.style.position = 'absolute';
    this.expandBtn.style.width = '12px';
    this.expandBtn.style.margin = 'auto';
    this.expandBtn.style.top = '4px';
    this.expandBtn.style.right = '6px';
    this.expandBtn.style.border = 'none';
    this.expandBtn.style.background = 'transparent';
    this.expandBtn.style.fontSize = '14px';
    this.expandBtn.style.cursor = 'pointer';
    this.expandBtn.style.display = 'none';
    this.legendContainer.appendChild(this.expandBtn);

    // Prevents map drag/scroll from capturing legend clicks
    L.DomEvent.disableClickPropagation(this.legendContainer);
    L.DomEvent.disableScrollPropagation(this.legendContainer);

    // Leaflet control that returns the entire container
    this.dateControl = new L.Control({ position: 'bottomleft' });
    (this.dateControl as any).onAdd = () => this.legendContainer;
    this.dateControl.addTo(this.map);

    // Handlers
    this.closeBtn.addEventListener('click', () => this.minimizeLegend());
    this.expandBtn.addEventListener('click', () => this.expandLegend());


    // Primero la fecha visible; las demás se precargan de una en una cuando la anterior termina.
    // Antes se añadían todas a la vez (hasta 25 fechas x 12 teselas = 300 peticiones en el mismo instante)
    // y la fecha visible competía con las otras: el mapa se dibujaba "por cuadrados" durante varios segundos.
    if (this.layers.length > 0) {
      const startIndex = this.reverse ? this.layers.length - 1 : 0;
      const endIndex = this.reverse ? -1 : this.layers.length;
      const step = this.reverse ? -1 : 1;

      this.pendingPreload = [];
      for (let i = startIndex; i !== endIndex; i += step) {
        if (i !== this.currentDateIndex) { this.pendingPreload.push(i); }
      }

      this.addStep(this.currentDateIndex, 1);
      this.whenLoaded(this.currentDateIndex, () => this.preloadNext());

      this.updateLegend();
    }

  }

  /** Añade al mapa la capa (y su overlay) de un paso de tiempo con la opacidad indicada. */
  private addStep(i: number, opacity: number) {
    this.layers[i].setOpacity(opacity).addTo(this.map);
    if (this.overlays && this.overlays.length > 0) {
      this.overlays[i].setOpacity(opacity).addTo(this.map);
    }
  }

  /**
   * Llama a cb (una sola vez) cuando la capa del paso y su overlay, si lo hay, terminaron de cargar sus teselas.
   * Si alguna no avisa (capa sin teselas en la vista, error de red), un tope de tiempo evita que la precarga se quede
   * parada para siempre.
   */
  private whenLoaded(i: number, cb: () => void) {
    const capas: L.Layer[] = [];
    if (this.layers[i] && typeof this.layers[i].once === 'function') { capas.push(this.layers[i]); }
    if (this.overlays && this.overlays.length > 0 && this.overlays[i] && typeof this.overlays[i].once === 'function') { capas.push(this.overlays[i]); }
    let pendientes = capas.length;
    let hecho = false;
    const terminar = () => { if (!hecho) { hecho = true; clearTimeout(tope); cb(); } };
    const tope = setTimeout(terminar, 20000);
    if (pendientes === 0) { terminar(); return; }
    capas.forEach(l => l.once('load', () => { if (--pendientes === 0) terminar(); }));
  }

  /** Si un paso aún no se precargó (el usuario avanzó antes de tiempo), lo añade ahora mismo. */
  private ensureAdded(i: number) {
    const layer = this.layers[i];
    if (!layer || this.map.hasLayer(layer)) return;
    this.pendingPreload = this.pendingPreload.filter(k => k !== i);
    this.addStep(i, 0);
  }

  /** Precarga el siguiente paso pendiente, invisible, y encadena el siguiente al terminar. */
  private preloadNext() {
    while (!this.preloadCancelled && this.preloadInFlight < WMSTimeControl.PRELOAD_CONCURRENCY) {
      const i = this.pendingPreload.shift();
      if (i === undefined) return;
      this.preloadInFlight++;
      this.addStep(i, 0);
      this.whenLoaded(i, () => { this.preloadInFlight--; this.preloadNext(); });
    }
  }

  /**
   * Reset playback to the first frame.
   */
  public setStart(){
    this.currentDateIndex = 0;
    this.layers.map((layer) => { layer.setOpacity(0)});
    this.ensureAdded(this.currentDateIndex); this.layers[this.currentDateIndex]?.setOpacity(1);
    if (this.overlays && this.overlays.length > 0) {
      this.overlays.map((layer) => { layer.setOpacity(0)});
      this.overlays[this.currentDateIndex]?.setOpacity(1);
    }
    this.updateLegend();
  }

  /**
   * Move to the next time step. Loops to the start if at the end.
   */
  private updateNextLayer(){
    this.layers[this.currentDateIndex - 1]?.setOpacity(0);
    this.ensureAdded(this.currentDateIndex); this.layers[this.currentDateIndex]?.setOpacity(1);
    if (this.overlays && this.overlays.length > 0) {
      this.overlays[this.currentDateIndex - 1]?.setOpacity(0);
      this.overlays[this.currentDateIndex]?.setOpacity(1);
    }
    this.updateLegend();
  }

  public next(){
    this.currentDateIndex++;
    if (this.currentDateIndex >= this.layers.length) {
      this.currentDateIndex = 0;
      this.layers.forEach(layer => {layer.setOpacity(0)});
      if (this.overlays && this.overlays.length > 0) {
        this.overlays.forEach(layer => {layer.setOpacity(0)});
      }
    }
    this.updateNextLayer();
  }

  /**
   * Move to the previous time step. Loops to the end if at the start.
   */
  private updatePreviousLayer(){
    this.layers[this.currentDateIndex + 1]?.setOpacity(0);
    this.ensureAdded(this.currentDateIndex); this.layers[this.currentDateIndex]?.setOpacity(1);
    if (this.overlays && this.overlays.length > 0) {
      this.overlays[this.currentDateIndex + 1]?.setOpacity(0);
      this.overlays[this.currentDateIndex]?.setOpacity(1);
    }
    this.updateLegend();
  }

  public previous(){
    this.currentDateIndex--;
    if (this.currentDateIndex < 0) {
      this.currentDateIndex = this.layers.length - 1;
      this.layers.forEach(layer => {layer.setOpacity(0)});
      if (this.overlays && this.overlays.length > 0) {
        this.overlays.forEach(layer => {layer.setOpacity(0)});
      }
    }
    this.updatePreviousLayer();
  }

  /**
   * Muestra el paso i y oculta los demás. Lo usa la exportación a GIF para recorrer los pasos en orden.
   */
  public goTo(i: number){
    if (this.destroyed || i < 0 || i >= this.layers.length) return;
    this.layers.forEach((layer, k) => { if (k !== i) layer.setOpacity(0) });
    if (this.overlays && this.overlays.length > 0) {
      this.overlays.forEach((layer, k) => { if (k !== i) layer.setOpacity(0) });
    }
    this.currentDateIndex = i;
    this.ensureAdded(i);
    this.layers[i].setOpacity(1);
    this.overlays?.[i]?.setOpacity(1);
    this.updateLegend();
  }

  /**
   * Resuelve cuando la capa del paso i (y su overlay) ya no tiene teselas cargando. A diferencia de
   * whenLoaded, no espera un evento 'load' si la capa ya estaba cargada. Con un tope de tiempo por si
   * el servidor no responde: la imagen sale con lo que haya.
   */
  public whenReady(i: number, timeoutMs: number = 20000): Promise<void> {
    const loading = [this.layers[i], this.overlays?.[i]]
      .filter((layer: any) => layer && typeof layer.isLoading === 'function' && layer.isLoading());
    if (loading.length === 0) return Promise.resolve();
    return new Promise(resolve => {
      let pending = loading.length;
      const tope = setTimeout(resolve, timeoutMs);
      loading.forEach((layer: any) => layer.once('load', () => {
        if (--pending === 0) { clearTimeout(tope); resolve(); }
      }));
    });
  }

  /**
   * Start automatic playback, cycling through frames at fixed interval.
   */
  public play(){
    if (this.interval == null){
      this.interval = setInterval(() => {
        this.next()
      }, 300);
    }
  }

  /**
   * Pause automatic playback and clear the interval.
   */
  public pause(){
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Remove all layers, overlays, and the legend control from the map.
   */
  public destroy(){
    this.destroyed = true;
    this.pause();
    this.preloadCancelled = true;
    this.pendingPreload = [];
    this.layers.forEach(layer => {layer.remove()});
    if (this.overlays && this.overlays.length > 0){
      this.overlays.forEach(layer => {layer.remove()});
    }
    this.dateControl.remove();
  }



  /**
   * Minimize the legend, hiding content and showing expand button.
   */
  private minimizeLegend() {
    if (this.minimized) return;
    this.minimized = true;
    this.dateElement.style.display = 'none';
    this.closeBtn.style.display = 'none';
    this.expandBtn.style.display = 'block';
  }

  /**
   * Expand the legend, restoring content and close button.
   */
  private expandLegend() {
    if (!this.minimized) return;
    this.minimized = false;
    this.dateElement.style.display = 'block';
    this.closeBtn.style.display = 'block';
    this.expandBtn.style.display = 'none';
  }

  /**
   * Update the legend content with the current title and optional image.
   */
  private updateLegend() {
    const currentTitle = this.titles[this.currentDateIndex];
    if (currentTitle) {
      this.dateElement.innerHTML = `${currentTitle}`;
    }
    if (this.img) {
      const imageElement = document.createElement('img');
      imageElement.src = this.img;
      imageElement.style.paddingTop = '4px';
      imageElement.style.width = '350px';
      imageElement.style.maxWidth = '98%';
      this.dateElement.appendChild(imageElement);
    }
  }

}
