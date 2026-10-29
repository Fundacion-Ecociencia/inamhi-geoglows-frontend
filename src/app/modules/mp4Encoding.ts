// Las piezas de Mediabunny que usa Mp4Builder (mapExport.ts). mapExport las carga con import()
// la primera vez que alguien pide un video: así no van en el bundle inicial y, al pasar por este
// módulo, el chunk lleva solo lo que se usa (unos 200 KB) y no la librería entera (unos 700 KB).
export { Output, Mp4OutputFormat, BufferTarget, CanvasSource, canEncodeVideo, QUALITY_HIGH } from 'mediabunny';
