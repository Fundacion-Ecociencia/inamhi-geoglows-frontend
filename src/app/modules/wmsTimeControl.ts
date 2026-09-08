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


    // Load all layers and leave only the first one visible
    if (this.layers.length > 0) {
      const startIndex = this.reverse ? this.layers.length - 1 : 0;
      const endIndex = this.reverse ? -1 : this.layers.length;
      const step = this.reverse ? -1 : 1;

      // Load layers and overlays at the same time
      for (let i = startIndex; i !== endIndex; i += step) {
        this.layers[i].setOpacity(0).addTo(this.map);
        if (this.overlays && this.overlays.length > 0) {
          this.overlays[i].setOpacity(0).addTo(this.map);
        }
      }

      // Set the opacity of visible layers
      this.layers[this.currentDateIndex].setOpacity(1);
      if (this.overlays && this.overlays.length > 0) {
        this.overlays[this.currentDateIndex].setOpacity(1);
      }

      this.updateLegend();
    }

  }

  /**
   * Reset playback to the first frame.
   */
  public setStart(){
    this.currentDateIndex = 0;
    this.layers.map((layer) => { layer.setOpacity(0)});
    this.layers[this.currentDateIndex]?.setOpacity(1);
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
    this.layers[this.currentDateIndex]?.setOpacity(1);
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
    this.layers[this.currentDateIndex]?.setOpacity(1);
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
    this.pause();
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
