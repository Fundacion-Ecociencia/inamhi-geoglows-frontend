/*****************************************************************************
 *                     ENSO ECUADOR: LISTAS Y CONSTANTES                     *
 *****************************************************************************
 * Todo lo que la vista necesita y no cambia en tiempo de ejecución: opciones
 * de los selectores, colores con significado, regiones Niño y umbrales.
 * El contrato de la API está en docs/plan-enso.md, sección 6.
 *****************************************************************************/

/** Ancho bajo el cual el panel empieza cerrado (mismo corte que Bootstrap md). */
export const NARROW_SCREEN = 768;

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  'contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export interface Option<T = string> { value: T; label: string; }


/*---------------------------------------------------------------------------*/
/*                         Estado del ENSO (semáforo)                        */
/*---------------------------------------------------------------------------*/
export type PhaseClass = 'warm' | 'cold' | 'neutral';

/** Borde izquierdo de cada tarjeta del estado, según la fase. */
export const PHASE_COLORS: Record<PhaseClass, string> = {
  warm: '#E34A33', cold: '#3182BD', neutral: '#9AA0A6',
};

/** Etiqueta por defecto si la API no manda `label`. */
export const PHASE_LABELS: Record<PhaseClass, string> = {
  warm: 'Cálida', cold: 'Fría', neutral: 'Neutra',
};

/**
 * Umbrales de fase [frío, cálido]: ENFEN 2024 para el ICEN y Niño 1+2
 * (cálida desde 0,5; fría bajo −0,7) y NOAA para ONI y RONI (±0,5).
 */
export const ICEN_LIMITS: [number, number] = [-0.7, 0.5];
export const ONI_LIMITS: [number, number] = [-0.5, 0.5];

/** Borde de la tarjeta de TSM costera según el nivel respecto al umbral convectivo calibrado. */
export const COASTAL_SST_COLORS: Record<string, string> = {
  muy_probable: '#E34A33', probable: '#FDAE6B', bajo: '#9AA0A6',
};


/*---------------------------------------------------------------------------*/
/*                       Pacífico: anomalía de TSM (WMS)                     */
/*---------------------------------------------------------------------------*/
export const SST_WORKSPACE = 'enso';
export const SST_LAYER = 'enso:enso_sst_anomaly';
/** En el GetCapabilities del espacio de trabajo la capa aparece sin prefijo (como GOES en Hydropower). */
export const SST_LAYER_NAME = 'enso_sst_anomaly';
/**
 * Barra de colores generada con barra_colores.py (skill geoglows-frontend) a
 * partir de los cortes y colores exactos del SLD de la capa
 * (backend: tasks/enso/enso_sst_anomaly.sld, −6 a +6 °C cada 0,5 °C). Si el
 * SLD cambia, hay que regenerar esta imagen con los mismos valores.
 */
export const SST_COLORBAR = 'assets/legend/enso_sst_anomaly.png';
export const SST_DAYS: number[] = [30, 60, 120];
/** Para la animación se toma una fecha de cada 4, con un máximo de 30 cuadros. */
export const SST_STEP = 4;
export const SST_MAX_FRAMES = 30;

/**
 * Regiones Niño como rectángulos [oeste, sur, este, norte] en grados.
 * Niño 4 va de 160°E a 150°W y cruza el antimeridiano: se dibuja de −200 a −150
 * (Leaflet sigue la longitud más allá de −180), así se ve completo a la izquierda.
 *
 * Niño 3.4 comparte los bordes norte y sur con Niño 3 y Niño 4. Para que se
 * distingan, cada región tiene su color, Niño 3.4 va punteado y encima (por
 * los huecos se ve la línea de abajo), y cada etiqueta va fuera del recuadro:
 * la de Niño 3.4 arriba y las demás abajo. Los colores evitan el rojo y el azul
 * de la escala de anomalías.
 */
export interface NinoRegion {
  name: string;
  bbox: [number, number, number, number];
  color: string;
  dash?: string;
  label: 'arriba' | 'abajo';
}
export const NINO_REGIONS: NinoRegion[] = [
  { name: 'Niño 4', bbox: [-200, -5, -150, 5], color: '#8C510A', label: 'abajo' },
  { name: 'Niño 3', bbox: [-150, -5, -90, 5], color: '#1B7837', label: 'abajo' },
  { name: 'Niño 1+2', bbox: [-90, -10, -80, 0], color: '#000000', label: 'abajo' },
  { name: 'Niño 3.4', bbox: [-170, -5, -120, 5], color: '#762A83', dash: '10 7', label: 'arriba' },
];


/*---------------------------------------------------------------------------*/
/*                      Ecuador: caudal esperado (Martin)                    */
/*---------------------------------------------------------------------------*/
export const PHASES: Option[] = [
  { value: 'calida_fuerte', label: 'Cálida moderada o mayor (ICEN > 1,3)' },
  { value: 'calida_debil', label: 'Cálida débil (0,5 a 1,3)' },
  { value: 'neutra', label: 'Neutra (−0,7 a 0,5)' },
  { value: 'fria', label: 'Fría (< −0,7)' },
];

/**
 * Agrupación del ENFEN 2024, la misma que usa la API. Solo se usa si
 * `status.coastal.phase_group` no llega.
 */
export function phaseGroupFromIcen(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) { return 'neutra'; }
  if (value < ICEN_LIMITS[0]) { return 'fria'; }
  if (value > 1.3) { return 'calida_fuerte'; }
  if (value >= ICEN_LIMITS[1]) { return 'calida_debil'; }
  return 'neutra';
}

export const MONTHS: Option<number>[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ value: i + 1, label }));

/** Clases de `ratio` (caudal en la fase / caudal medio) para el mapa y la leyenda. */
export const RATIO_CLASSES: { limit: number; color: string; label: string }[] = [
  { limit: 0.7, color: '#2166ac', label: '< 0,7' },
  { limit: 0.9, color: '#92c5de', label: '0,7–0,9' },
  { limit: 1.1, color: '#bdbdbd', label: '0,9–1,1' },
  { limit: 1.5, color: '#f4a582', label: '1,1–1,5' },
  { limit: 2.5, color: '#d6604d', label: '1,5–2,5' },
  { limit: Infinity, color: '#b2182b', label: '> 2,5' },
];
export const RATIO_NULL_COLOR = '#555';

/**
 * Medida del mapa de caudal esperado.
 * - prob: probabilidad por terciles (Mason y Goddard 2001; mapas ENSO del IRI): fracción de los años de
 *   la fase con el caudal del mes en el tercio alto o bajo de todos los años. La base es 33 %. No
 *   explota en ríos casi secos ni la domina un año extremo. Recomendada.
 * - ratio: caudal medio en la fase / caudal medio de todos los años (la medida original).
 */
export type CompositeMetric = 'prob' | 'ratio';
export const METRICS: Option<CompositeMetric>[] = [
  { value: 'prob', label: 'Probabilidad por terciles (recomendada)' },
  { value: 'ratio', label: 'Razón de caudal (medias)' },
];
export const DEFAULT_METRIC: CompositeMetric = 'prob';

/** Clases de la probabilidad: el tercio dominante y qué tan seguido ocurrió. */
export const PROB_STRONG = 0.7;
export const PROB_WEAK = 0.45;
export const PROB_CLASSES: { color: string; label: string }[] = [
  { color: '#b2182b', label: 'Alto, muy probable (≥ 70 %)' },
  { color: '#f4a582', label: 'Alto, probable (45–70 %)' },
  { color: '#bdbdbd', label: 'Sin señal clara' },
  { color: '#92c5de', label: 'Bajo, probable (45–70 %)' },
  { color: '#2166ac', label: 'Bajo, muy probable (≥ 70 %)' },
];
/** Opacidad de lo no significativo cuando se activa la máscara (FDR 10 %, Wilks 2016). */
export const FADED_OPACITY = 0.3;

/**
 * Expresión de MapLibre para el color por probabilidad: el tercio dominante (alto o bajo) y su
 * frecuencia en los años de la fase. Si ninguno llega a PROB_WEAK, o empatan, "sin señal clara".
 * Sin p_upper (sin muestra o filas sin recalcular), el color de "sin dato".
 */
export function probColorExpression(): any {
  const up = ['to-number', ['get', 'p_upper']];
  const lo = ['to-number', ['get', 'p_lower']];
  const [strongUp, weakUp, none, weakLo, strongLo] = PROB_CLASSES.map(c => c.color);
  return [
    'case',
    ['==', ['typeof', ['get', 'p_upper']], 'null'], RATIO_NULL_COLOR,
    ['all', ['>=', up, PROB_STRONG], ['>', up, lo]], strongUp,
    ['all', ['>=', lo, PROB_STRONG], ['>', lo, up]], strongLo,
    ['all', ['>=', up, PROB_WEAK], ['>', up, lo]], weakUp,
    ['all', ['>=', lo, PROB_WEAK], ['>', lo, up]], weakLo,
    none,
  ];
}

/** Con la máscara, lo no significativo queda tenue (MapLibre lee el booleano de la tesela). */
export function maskOpacity(mask: boolean): any {
  return mask ? ['case', ['==', ['get', 'significant'], true], 1, FADED_OPACITY] : 1;
}


/*---------------------------------------------------------------------------*/
/*                                  Índices                                  */
/*---------------------------------------------------------------------------*/
/** Los 12 que acepta la API (INDICES de backend/enso/controllers.py). */
export const INDICES: Option[] = [
  { value: 'icen', label: 'ICEN costero oficial' },
  { value: 'icen_prov', label: 'ICEN provisional' },
  { value: 'oni', label: 'ONI' },
  { value: 'roni', label: 'RONI' },
  { value: 'nino12_week', label: 'Niño 1+2 semanal' },
  { value: 'nino34_week', label: 'Niño 3.4 semanal' },
  { value: 'nino12', label: 'Niño 1+2 mensual' },
  { value: 'nino3', label: 'Niño 3 mensual' },
  { value: 'nino34', label: 'Niño 3.4 mensual' },
  { value: 'nino4', label: 'Niño 4 mensual' },
  { value: 'soi', label: 'SOI' },
  { value: 'mei', label: 'MEI.v2' },
];
export const INDEX_YEARS: number[] = [10, 20, 40, 80];



/*---------------------------------------------------------------------------*/
/*                          Vistas del área principal                        */
/*---------------------------------------------------------------------------*/
export type ViewMode = 'pacific' | 'ecuador' | 'charts';

/** Botones de la barra superior. `short` es el texto cuando no cabe el largo (móvil). */
export const VIEW_MODES: { value: ViewMode; label: string; short: string; icon: string }[] = [
  { value: 'pacific', label: 'Pacífico: anomalía de TSM', short: 'Pacífico', icon: 'fa-solid fa-water' },
  { value: 'ecuador', label: 'Ecuador: caudal esperado', short: 'Ecuador', icon: 'fa-solid fa-arrow-trend-up' },
  { value: 'charts', label: 'Gráficas', short: 'Gráficas', icon: 'fa-solid fa-chart-column' },
];
/** El Pacífico se crea al abrir la vista; Ecuador, la primera vez que se muestra. */
export const DEFAULT_MODE: ViewMode = 'pacific';


/*---------------------------------------------------------------------------*/
/*                                  Gráficas                                 */
/*---------------------------------------------------------------------------*/
export type ChartType = 'series' | 'heatmap' | 'hovmoller' | 'coastal' | 'nmme'
  | 'cpc_phase' | 'cpc_strength' | 'cpc_roni';

/** Tipos de gráfico de cada panel y su endpoint en /api/enso/. */
export const CHART_TYPES: (Option<ChartType> & { endpoint: string })[] = [
  { value: 'series', label: 'Serie de un índice', endpoint: 'index-plot' },
  { value: 'heatmap', label: 'Año × mes de un índice', endpoint: 'index-heatmap-plot' },
  { value: 'hovmoller', label: 'Ondas Kelvin (Hovmöller)', endpoint: 'hovmoller-plot' },
  { value: 'coastal', label: 'TSM costera absoluta y umbral convectivo', endpoint: 'coastal-sst-plot' },
  { value: 'nmme', label: 'Pronóstico del Niño (NMME)', endpoint: 'nmme-plume-plot' },
  { value: 'cpc_phase', label: 'Pronóstico oficial NOAA: probabilidad por fase', endpoint: 'cpc-probs-plot' },
  { value: 'cpc_strength', label: 'Pronóstico oficial NOAA: probabilidad por intensidad', endpoint: 'cpc-strength-plot' },
  { value: 'cpc_roni', label: 'Pronóstico oficial NOAA: abanico del RONI', endpoint: 'cpc-roni-plot' },
];

/**
 * Pronóstico oficial del CPC (NOAA): es siempre del RONI, así que el selector de índice queda
 * deshabilitado y mostrando "RONI".
 */
export const CPC_CHARTS: ChartType[] = ['cpc_phase', 'cpc_strength', 'cpc_roni'];

/** Índices con pronóstico del NMME (pluma). */
export const NMME_INDICES: Option[] = [
  { value: 'nino12', label: 'Niño 1+2 (costa)' },
  { value: 'nino34', label: 'Niño 3.4 (Pacífico central)' },
];

export interface ChartSettings { type: ChartType; index: string; years: number; }

/**
 * Lo que muestra cada panel al abrir la vista. Los dos primeros (los visibles
 * por defecto) ponen lado a lado el ICEN y el ONI año por mes: un mismo
 * episodio se ve grave en la costa y moderado en el Pacífico central.
 */
export const CHART_DEFAULTS: ChartSettings[] = [
  { type: 'heatmap', index: 'icen', years: 20 },   // oficial completado con el provisional: desde 1950, como el ONI
  { type: 'heatmap', index: 'oni', years: 20 },
  { type: 'coastal', index: 'icen_prov', years: 20 },
  { type: 'nmme', index: 'nino12', years: 20 },
];
export const PANEL_COUNTS: number[] = [1, 2, 3, 4];
export const DEFAULT_PANEL_COUNT = 2;

/** Cuadrícula por número de paneles; `wide` es el panel que ocupa todo el ancho. */
export const CHART_LAYOUTS: Record<number, { columns: number; rows: number; wide?: number }> = {
  1: { columns: 1, rows: 1 },
  2: { columns: 2, rows: 1 },
  3: { columns: 2, rows: 2, wide: 2 },
  4: { columns: 2, rows: 2 },
};
