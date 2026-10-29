/**
 * MapExport
 *
 * Exporta un mapa de Leaflet tal como se ve en pantalla, para usarlo en presentaciones:
 * - Lleva las capas (teselas, polígonos, marcadores), el logo y las leyendas.
 * - Deja fuera lo que solo sirve en pantalla: zoom, selector de capas, botones de las leyendas,
 *   ventanas emergentes y la atribución de Leaflet. En lugar de la atribución pone un crédito
 *   discreto del mapa base, porque la licencia de OpenStreetMap y la de CARTO lo exigen.
 *
 * Por qué no se usa html2canvas sobre todo el mapa: vuelve a descargar todas las teselas, incluidas
 * las de las fechas que WMSTimeControl precarga ocultas (opacidad 0). Medido el 29 oct 2026: 6,7 s
 * por imagen, inviable para un GIF de 25 cuadros. Aquí las teselas visibles se dibujan a mano desde
 * la caché del navegador (60 teselas en 32 ms) y html2canvas solo dibuja el logo y las leyendas.
 *
 * Las teselas de otros servidores (GeoServer, CARTO) se piden con CORS. Ambos responden
 * Access-Control-Allow-Origin: *; si un servidor no lo hiciera, sus teselas faltarían en la imagen
 * (se cuentan en `missingImages`) en vez de bloquear la exportación entera.
 */

import * as L from 'leaflet';
import html2canvas from 'html2canvas';
import { GIFEncoder, quantize, applyPalette, GifStream } from 'gifenc/dist/gifenc.esm.js';
import type { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from 'mediabunny';

// Mediabunny se descarga la primera vez que alguien pide un video, no con la página (ver mp4Encoding.ts).
const loadMediabunny = () => import('./mp4Encoding');

const UNSUPPORTED_VIDEO = 'Este navegador no puede generar video MP4. Pruebe con Chrome o Edge actualizados, o descargue el GIF.';

/** Error con un mensaje pensado para mostrárselo al usuario tal cual. */
export class ExportError extends Error {}

/** Crédito del mapa base que reemplaza a la atribución de Leaflet en la imagen. */
export const BASEMAP_CREDIT = 'Mapa base: © OpenStreetMap · © CARTO';

/** Algo que se dibuja en la imagen: una tesela, un svg de polígonos o un marcador, con su posición. */
interface DrawItem {
  el: Element;
  rect: DOMRect;
  alpha: number;
}

/** Controles de Leaflet que no van en la imagen. */
const HIDDEN_CONTROLS = ['leaflet-control-zoom', 'leaflet-control-layers', 'leaflet-control-attribution'];

/** Paneles que no van en la imagen: etiquetas al pasar el ratón y ventanas emergentes. */
const HIDDEN_PANES = ['leaflet-tooltip-pane', 'leaflet-popup-pane'];


export class MapExporter {
  /** Imágenes ya cargadas, por URL: en un GIF el mapa base y los límites se reutilizan en cada cuadro. */
  private images = new Map<string, Promise<HTMLImageElement | null>>();
  private objectUrls: string[] = [];
  /** Imágenes que no se pudieron leer (sin CORS o con error de red) y quedaron fuera. */
  public missingImages = 0;

  constructor(private map: L.Map, private credit: string = BASEMAP_CREDIT) {}

  /**
   * Dibuja el mapa en un canvas de (ancho × alto del mapa en pantalla) × scale píxeles.
   * scale = 2 da una imagen nítida para presentaciones; 1 basta para los cuadros de un GIF.
   */
  public async render(scale = 1): Promise<HTMLCanvasElement> {
    await this.waitForIdle();
    const container = this.map.getContainer();
    const box = container.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = getComputedStyle(container).backgroundColor || '#dddddd';
    ctx.fillRect(0, 0, width, height);

    // 1) Capas, en el mismo orden en que se apilan en pantalla. Primero se cargan todas las imágenes
    //    en paralelo (una por una tardaba 6 s) y después se dibujan en orden.
    const mapPane = this.map.getPane('mapPane')!;
    const panes = byZIndex(childrenOf(mapPane).filter(el => el.classList.contains('leaflet-pane')));
    const items: DrawItem[] = [];
    for (const pane of panes) {
      if (HIDDEN_PANES.some(c => pane.classList.contains(c))) continue;
      this.collectPane(items, pane, box);
    }
    const sources = await Promise.all(items.map(item => this.sourceOf(item)));
    items.forEach((item, k) => {
      const source = sources[k];
      if (!source) return;
      ctx.globalAlpha = item.alpha;
      ctx.drawImage(source, item.rect.left - box.left, item.rect.top - box.top, item.rect.width, item.rect.height);
    });
    ctx.globalAlpha = 1;

    // 2) Logo y leyendas. html2canvas clona el documento; se ignora todo lo que está fuera del mapa
    //    y las capas (ya dibujadas), porque en Chrome espera a que carguen todas las imágenes clonadas.
    const controls = await html2canvas(container, {
      backgroundColor: null,
      scale,
      logging: false,
      useCORS: true,
      ignoreElements: (el) => isIgnoredByHtml2canvas(el, container, mapPane),
      onclone: (_doc, clone) => { clone.style.background = 'transparent'; },
    });
    ctx.drawImage(controls, 0, 0, width, height);

    // 3) Crédito del mapa base, abajo a la derecha, donde estaba la atribución.
    if (this.credit) {
      drawCredit(ctx, this.credit, width, height);
    }
    return canvas;
  }

  /**
   * Espera a que el mapa deje de moverse y a que las capas visibles terminen de cargar sus teselas.
   * Sin esto, pulsar la cámara justo después de mover el mapa (o mientras "Cargar capa" lo encuadra)
   * daba una imagen a medio desplazar o con cuadros en blanco. Con un tope de tiempo: si un servidor
   * no responde, la imagen sale con lo que haya.
   */
  private async waitForIdle(timeoutMs = 10000): Promise<void> {
    // Leaflet arranca las animaciones de zoom en el cuadro siguiente al que se pidieron. Con tope de
    // 100 ms porque en una pestaña en segundo plano el navegador no da cuadros y la espera no acabaría.
    await new Promise(resolve => { requestAnimationFrame(resolve); setTimeout(resolve, 100); });
    // Campos internos de Leaflet 1.9: no hay API pública para saber si el mapa se está moviendo.
    const internals = this.map as any;
    if (internals._animatingZoom || internals._panAnim?._inProgress || internals._flyToFrame) {
      await waitForEvent(this.map, 'moveend', timeoutMs);
    }
    // Las fechas que WMSTimeControl precarga ocultas (opacidad 0) no hacen falta para esta imagen.
    const loading: L.Layer[] = [];
    this.map.eachLayer(layer => {
      if (layer instanceof L.GridLayer && (layer.options as L.GridLayerOptions).opacity !== 0 && layer.isLoading()) {
        loading.push(layer);
      }
    });
    await Promise.all(loading.map(layer => waitForEvent(layer, 'load', timeoutMs)));
  }

  /** Libera las copias de las imágenes. Llamar al terminar la exportación. */
  public dispose(): void {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls = [];
    this.images.clear();
  }

  /** Junta, en orden de apilado, lo que hay que dibujar de un panel. */
  private collectPane(items: DrawItem[], pane: HTMLElement, box: DOMRect): void {
    if (pane.classList.contains('leaflet-tile-pane')) {
      // Capa de teselas → un contenedor por nivel de zoom → teselas (img, canvas o svg).
      for (const layer of byZIndex(childrenOf(pane))) {
        const alpha = opacityOf(layer);
        if (alpha <= 0) continue;
        for (const level of byZIndex(childrenOf(layer))) {
          for (const tile of childrenOf(level)) {
            this.collectElement(items, tile, box, alpha);
          }
        }
      }
      return;
    }
    // Polígonos (svg o canvas del renderizador de Leaflet) y marcadores (img).
    for (const el of childrenOf(pane)) {
      this.collectElement(items, el, box, opacityOf(el));
    }
  }

  private collectElement(items: DrawItem[], el: Element, box: DOMRect, alpha: number): void {
    if (alpha <= 0) return;
    // Una tesela sin "leaflet-tile-loaded" todavía carga o falló: en pantalla tampoco se ve.
    if (el instanceof HTMLImageElement && el.classList.contains('leaflet-tile') && !el.classList.contains('leaflet-tile-loaded')) return;
    const rect = el.getBoundingClientRect();
    const outside = rect.right <= box.left || rect.left >= box.right || rect.bottom <= box.top || rect.top >= box.bottom;
    if (rect.width === 0 || rect.height === 0 || outside) return;
    items.push({ el, rect, alpha });
  }

  private sourceOf(item: DrawItem): Promise<CanvasImageSource | null> {
    const el = item.el;
    if (el instanceof HTMLImageElement) return this.image(el.currentSrc || el.src);
    if (el instanceof HTMLCanvasElement) return Promise.resolve(el);
    if (el instanceof SVGSVGElement) return this.svg(el, item.rect);
    return Promise.resolve(null);
  }

  private image(src: string): Promise<HTMLImageElement | null> {
    let promise = this.images.get(src);
    if (!promise) {
      promise = this.loadImage(src);
      this.images.set(src, promise);
    }
    return promise;
  }

  private async loadImage(src: string): Promise<HTMLImageElement | null> {
    try {
      let url = src;
      if (!isSameOrigin(src)) {
        // Dibujar la imagen de otro servidor tal cual "contamina" el canvas y el navegador ya no deja
        // exportarlo. Se pide una copia con CORS; 'force-cache' la toma de la caché si ya se cargó.
        const res = await fetch(src, { mode: 'cors', cache: 'force-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        url = URL.createObjectURL(await res.blob());
        this.objectUrls.push(url);
      }
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch (error) {
      this.missingImages++;
      console.warn('MapExporter: no se pudo leer la imagen', src, error);
      return null;
    }
  }

  /** Convierte un svg de Leaflet (polígonos, líneas, círculos) en imagen. */
  private async svg(el: SVGSVGElement, r: DOMRect): Promise<HTMLImageElement | null> {
    const clone = el.cloneNode(true) as SVGSVGElement;
    // Leaflet lo ubica con un transform de CSS; la posición ya viene en r.
    clone.removeAttribute('style');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', `${r.width}`);
    clone.setAttribute('height', `${r.height}`);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch (error) {
      this.missingImages++;
      console.warn('MapExporter: no se pudo dibujar una capa vectorial', error);
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}


/**
 * Arma un GIF que se repite sin fin, cuadro a cuadro, para no guardar todos los cuadros en memoria.
 */
export class GifBuilder {
  private gif: GifStream = GIFEncoder();
  private size: [number, number] | null = null;

  /** Agrega un cuadro. Todos deben medir lo mismo: si el mapa cambió de tamaño, lanza un error. */
  public addFrame(canvas: HTMLCanvasElement, delayMs: number): void {
    const { width, height } = canvas;
    if (this.size && (this.size[0] !== width || this.size[1] !== height)) {
      throw new ExportError('El mapa cambió de tamaño mientras se generaba el GIF. Vuelva a intentarlo.');
    }
    this.size = [width, height];
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    this.gif.writeFrame(index, width, height, { palette, delay: delayMs });
  }

  public finish(): Blob {
    this.gif.finish();
    return new Blob([this.gif.bytes()], { type: 'image/gif' });
  }

  public async dispose(): Promise<void> {}
}


/**
 * Arma un video MP4 (H.264) con los mismos cuadros que el GIF, para las redes que no aceptan GIF
 * (Facebook, según los pronosticadores el 29 oct 2026). Codifica con WebCodecs a través de Mediabunny.
 *
 * - 30 cuadros por segundo constantes: cada cuadro del mapa se repite durante su tiempo (500 ms son
 *   15 cuadros). Los repetidos casi no ocupan, y un video de 2 cuadros por segundo lo manejan mal
 *   algunos editores y plataformas.
 * - H.264 exige ancho y alto pares: si el mapa mide un número impar, se pierde la última fila o
 *   columna de píxeles.
 * - A diferencia del GIF, el video no se repite solo: eso lo decide el reproductor.
 */
export class Mp4Builder {
  public static readonly FPS = 30;
  private output: Output<Mp4OutputFormat, BufferTarget> | null = null;
  private source: CanvasSource | null = null;
  private canvas = document.createElement('canvas');
  private frames = 0;

  /**
   * Lanza ExportError si este navegador no puede codificar H.264 a ese tamaño. Se llama antes de
   * empezar, para no dibujar todos los cuadros y avisar recién al final.
   */
  public static async assertSupported(width: number, height: number): Promise<void> {
    if (typeof VideoEncoder === 'undefined') {
      throw new ExportError(UNSUPPORTED_VIDEO);
    }
    const { canEncodeVideo, QUALITY_HIGH } = await loadMediabunny();
    const supported = await canEncodeVideo('avc', { width: even(width), height: even(height), quality: QUALITY_HIGH }).catch(() => false);
    if (!supported) {
      throw new ExportError(UNSUPPORTED_VIDEO);
    }
  }

  /** Agrega un cuadro que dura delayMs. Todos deben medir lo mismo: si el mapa cambió de tamaño, lanza un error. */
  public async addFrame(frame: HTMLCanvasElement, delayMs: number): Promise<void> {
    const width = even(frame.width);
    const height = even(frame.height);
    if (!this.output) {
      await this.open(width, height);
    } else if (width !== this.canvas.width || height !== this.canvas.height) {
      throw new ExportError('El mapa cambió de tamaño mientras se generaba el video. Vuelva a intentarlo.');
    }
    this.canvas.getContext('2d')!.drawImage(frame, 0, 0);
    const repeats = Math.max(1, Math.round(delayMs * Mp4Builder.FPS / 1000));
    for (let k = 0; k < repeats; k++) {
      // Cada cuadro nuevo del mapa empieza con un cuadro clave, para que el reproductor pueda saltar a él.
      await this.source!.add(this.frames / Mp4Builder.FPS, 1 / Mp4Builder.FPS, k === 0 ? { keyFrame: true } : undefined);
      this.frames++;
    }
  }

  public async finish(): Promise<Blob> {
    if (!this.output) throw new Error('El video no tiene cuadros.');
    await this.output.finalize();
    return new Blob([this.output.target.buffer!], { type: 'video/mp4' });
  }

  /** Libera el codificador si la exportación se canceló a medias. */
  public async dispose(): Promise<void> {
    if (this.output?.state === 'started') {
      await this.output.cancel().catch(() => {});
    }
  }

  private async open(width: number, height: number): Promise<void> {
    const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } = await loadMediabunny();
    this.canvas.width = width;
    this.canvas.height = height;
    // El índice "fast start" va al principio del archivo: Facebook y los navegadores empiezan a
    // reproducir sin bajarlo entero.
    this.output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    this.source = new CanvasSource(this.canvas, { codec: 'avc', quality: QUALITY_HIGH });
    this.output.addVideoTrack(this.source, { frameRate: Mp4Builder.FPS });
    await this.output.start();
  }
}

/** Lo que tienen en común GifBuilder y Mp4Builder, para armar la animación igual con los dos. */
export interface AnimationBuilder {
  addFrame(canvas: HTMLCanvasElement, delayMs: number): void | Promise<void>;
  finish(): Blob | Promise<Blob>;
  dispose(): Promise<void>;
}

function even(n: number): number {
  return n - (n % 2);
}


/** Descarga un archivo generado en el navegador. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revocar en el mismo instante puede cortar la descarga en Firefox y Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.')), type);
  });
}


/** Resuelve cuando el mapa o la capa emite el evento, o al vencer el tope de tiempo. */
function waitForEvent(target: L.Evented, event: string, timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      target.off(event, done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    target.once(event, done);
  });
}

function childrenOf(el: Element): HTMLElement[] {
  return Array.from(el.children) as HTMLElement[];
}

/** Ordena como se apilan en pantalla: por z-index y, a igual z-index, por orden en el documento. */
function byZIndex(elements: HTMLElement[]): HTMLElement[] {
  return elements
    .map((el, i) => ({ el, i, z: parseInt(getComputedStyle(el).zIndex, 10) || 0 }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map(item => item.el);
}

function opacityOf(el: Element): number {
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return 0;
  const opacity = parseFloat(style.opacity);
  return isNaN(opacity) ? 1 : opacity;
}

function isSameOrigin(src: string): boolean {
  if (src.startsWith('data:') || src.startsWith('blob:')) return true;
  return new URL(src, location.href).origin === location.origin;
}

/** Lo que html2canvas no debe clonar: todo fuera del mapa, las capas y los controles de pantalla. */
function isIgnoredByHtml2canvas(el: Element, container: HTMLElement, mapPane: HTMLElement): boolean {
  if (el === mapPane) return true;
  const outsideMap = document.body.contains(el) && !el.contains(container) && !container.contains(el);
  if (outsideMap) return true;
  if (HIDDEN_CONTROLS.some(c => el.classList.contains(c))) return true;
  // Botones dentro de las leyendas (minimizar, expandir): solo sirven en pantalla.
  return el.tagName === 'BUTTON' && !!el.closest('.leaflet-control-container');
}

function drawCredit(ctx: CanvasRenderingContext2D, text: string, width: number, height: number): void {
  ctx.font = '10px Roboto, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  const pad = 5;
  const boxWidth = ctx.measureText(text).width + pad * 2;
  const boxHeight = 16;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(width - boxWidth, height - boxHeight, boxWidth, boxHeight);
  ctx.fillStyle = '#333333';
  ctx.fillText(text, width - boxWidth + pad, height - boxHeight / 2);
}
