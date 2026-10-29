// Tipos mínimos de gifenc (la librería no trae los suyos). Solo lo que usa mapExport.ts.
// Se importa su versión ESM: el campo "browser" del paquete apunta a la CommonJS y Angular avisa.
declare module 'gifenc/dist/gifenc.esm.js' {
  export type Palette = number[][];

  export interface GifStream {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: Palette; delay?: number; repeat?: number; transparent?: boolean; dispose?: number }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GifStream;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: string }): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: string): Uint8Array;
}
