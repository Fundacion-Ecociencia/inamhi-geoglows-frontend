/*****************************************************************************
 *                    ENSO ECUADOR: MODO DE PRUEBA SIN API                   *
 *****************************************************************************
 * Se activa en el navegador con  localStorage.setItem('enso_mock', '1')  y se
 * apaga con  localStorage.removeItem('enso_mock'). Devuelve respuestas de
 * ejemplo con la forma del contrato (docs/plan-enso.md, sección 6) para
 * probar el modal y los gráficos mientras /api/enso/ no está desplegada.
 * Los valores son inventados: no sirven para nada más que ver la vista.
 *
 * Perspectiva estacional: con  localStorage.setItem('enso_mock_sin', 'c3s')
 * (o 'streamflow') ese producto llega null en outlook-status, para ver el
 * aviso "Aún no hay emisión". Martin no se simula: la capa de caudal costero
 * muestra el aviso de que no está publicada.
 *****************************************************************************/

/** Tema oscuro del tablero, como lo arma el backend de Hydropower. */
function dark(yTitle: string, xTitle: string): any {
  const axis = { showline: true, mirror: true, linecolor: 'white', ticks: 'outside', zeroline: false, automargin: true };
  return {
    template: 'simple_white', paper_bgcolor: '#3A404A', plot_bgcolor: '#3A404A',
    font: { color: 'white' }, margin: { l: 60, r: 20, b: 50, t: 20 },
    xaxis: { ...axis, title: { text: xTitle } }, yaxis: { ...axis, title: { text: yTitle } },
  };
}

const months = Array.from({ length: 240 }, (_, i) =>
  `${2006 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`);
const series = months.map((_, i) => +(1.6 * Math.sin(i / 9) + 0.4 * Math.sin(i / 2.3)).toFixed(2));
const barColor = (v: number) => v >= 0.5 ? '#E34A33' : v <= -0.5 ? '#3182BD' : '#9AA0A6';
const lons = Array.from({ length: 81 }, (_, i) => 120 + i * 2);
const weeks = Array.from({ length: 104 }, (_, i) => new Date(Date.UTC(2024, 9, 15) + i * 7 * 864e5).toISOString().slice(0, 10));
const phases = ['Cálida moderada o mayor', 'Cálida débil', 'Neutra', 'Fría'];
const phaseColors = ['#b2182b', '#f4a582', '#bdbdbd', '#2166ac'];
const mes = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/*------------------------- Perspectiva estacional -------------------------*/
const SYSTEMS = [
  { system: 'multimodelo', label: 'Multimodelo C3S', available: true },
  { system: 'ecmwf', label: 'ECMWF SEAS5', available: true },
  { system: 'ukmo', label: 'UKMO GloSea6', available: true },
  { system: 'meteo_france', label: 'Météo-France S8', available: true },
  { system: 'dwd', label: 'DWD GCFS2.2', available: true },
  { system: 'cmcc', label: 'CMCC SPS3.5', available: true },
  { system: 'ncep', label: 'NCEP CFSv2', available: true },
  { system: 'jma', label: 'JMA CPS3', available: false },
  { system: 'eccc', label: 'ECCC CanSIPS', available: true },
];
const SEASONS = [
  { lead: 1, season: 'DEF', months: 'dic–feb' },
  { lead: 2, season: 'EFM', months: 'ene–mar' },
  { lead: 3, season: 'FMA', months: 'feb–abr' },
];

/** Puntos de la malla de 1°: Ecuador continental (−5..1, −81..−75) y Galápagos (−1..1, −92..−89). */
const CELLS: { lat: number; lon: number }[] = [
  ...Array.from({ length: 7 * 7 }, (_, i) => ({ lat: -5 + Math.floor(i / 7), lon: -81 + (i % 7) })),
  ...Array.from({ length: 3 * 4 }, (_, i) => ({ lat: -1 + Math.floor(i / 4), lon: -92 + (i % 4) })),
];

/** Número fijo entre 0 y 1 a partir de un texto (para que cada sistema dé su propio mapa). */
function hash01(text: string): number {
  let h = 2166136261;
  for (const c of text) { h = Math.imul(h ^ c.charCodeAt(0), 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Probabilidades de una celda: lluvia sobre lo normal en la costa y Galápagos (Niño costero),
 * normal en la sierra, algo seca en la Amazonía; temperatura sobre lo normal casi en todo lado.
 */
function cellProbs(lat: number, lon: number, variable: string, lead: number, system: string) {
  const noise = (hash01(`${system}${variable}${lead}${lat}${lon}`) - 0.5) * 0.12;
  const fade = 1 - 0.15 * (lead - 1);
  let up: number, lo: number;
  if (variable === 'temperature') {
    const coast = lon <= -79 ? 0.3 : 0.12;   // costa y Galápagos
    up = 0.42 + coast * fade + noise;
    lo = 0.2 - coast / 3;
  } else if (lon < -85 || lon <= -80) {
    up = 0.5 + 0.15 * fade + 2 * noise + 0.04 * lat; lo = 0.15;
  } else if (lon <= -79) {
    up = 0.45 + 0.1 * fade + noise; lo = 0.22;
  } else if (lon >= -77) {
    up = 0.22; lo = 0.4 + 0.12 * fade + noise;
  } else {
    up = 0.3 + noise; lo = 0.28;
  }
  up = Math.max(0.05, Math.min(0.9, up)); lo = Math.max(0.05, Math.min(0.9 - up, lo));
  const no = 1 - up - lo;
  const [dominant, p_dominant] = ([['upper', up], ['normal', no], ['lower', lo]] as [string, number][])
    .reduce((a, b) => b[1] > a[1] ? b : a);
  // Sin habilidad: la sierra central y el sur de la Amazonía en lluvia; poco en temperatura.
  const rpss = variable === 'temperature' ? 0.15 + noise : lon > -80 && lon < -77 ? -0.05 + noise : lat <= -3 && lon >= -77 ? 0.01 : 0.12 + noise;
  // Como la API: con el normal dominante no hay ROC y la habilidad depende solo del RPSS.
  const roc = dominant === 'normal' ? null : variable === 'temperature' ? 0.72 : rpss > 0.05 ? 0.66 : 0.55;
  const r = (v: number) => +v.toFixed(3);
  return { p_lower: r(lo), p_normal: r(no), p_upper: r(up), dominant, p_dominant: r(p_dominant),
           rpss: r(rpss), roc: roc === null ? null : r(roc), skilful: roc === null ? rpss > 0 : roc > 0.6 && rpss > 0 };
}

function c3sGrid(q: URLSearchParams): any {
  const system = q.get('system') ?? 'multimodelo', variable = q.get('variable') ?? 'precipitation';
  const lead = Number(q.get('lead') ?? 1);
  const season = SEASONS.find(s => s.lead === lead)?.season ?? 'DEF';
  return {
    type: 'FeatureCollection', issue_month: '2026-11-01', season,
    features: CELLS.map(({ lat, lon }) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[lon - 0.5, lat - 0.5], [lon + 0.5, lat - 0.5],
        [lon + 0.5, lat + 0.5], [lon - 0.5, lat + 0.5], [lon - 0.5, lat - 0.5]]] },
      properties: { cell_id: (lat + 90) * 1000 + (lon + 180), lat, lon, ...cellProbs(lat, lon, variable, lead, system) },
    })),
  };
}

const RESPONSES: Record<string, (query: URLSearchParams) => any> = {
  'outlook-status': () => {
    const off = (() => { try { return localStorage.getItem('enso_mock_sin') ?? ''; } catch { return ''; } })();
    return {
      streamflow: off === 'streamflow' ? null : {
        issue_month: '2026-11-01', season: 'NDE', months: 'nov–ene',
        // Octubre de 2026 quedó fuera del rango histórico: los análogos se pesaron con el valor recortado.
        predictor: { name: 'nino12_oi', label: 'Niño 1+2 (OISST)', month: '2026-10-01', value: 5.25, used: 4.31 },
        n_reaches: 3303, pct_skilful: 58.0,
      },
      c3s: off === 'c3s' ? null : {
        issue_month: '2026-11-01', systems: SYSTEMS,
        variables: [{ variable: 'precipitation', label: 'Lluvia' }, { variable: 'temperature', label: 'Temperatura' }],
        seasons: SEASONS, pct_skilful: { precipitation: 41.0, temperature: 70.0 },
      },
      attribution: 'Pronósticos estacionales: Copernicus Climate Change Service (C3S), CC-BY 4.0, doi:10.24381/cds.68dd14c3',
    };
  },
  'c3s-grid': c3sGrid,
  'c3s-cell-plot': (q) => {
    const id = Number(q.get('cell_id') ?? 88100);
    const lat = Math.floor(id / 1000) - 90, lon = (id % 1000) - 180;
    const variable = q.get('variable') ?? 'precipitation', lead = Number(q.get('lead') ?? 1);
    const systems = SYSTEMS.filter(s => s.available);
    const probs = systems.map(s => cellProbs(lat, lon, variable, lead, s.system));
    const hover = probs.map(p => `RPSS ${p.rpss.toFixed(2)} · ROC ${p.roc === null ? '—' : p.roc.toFixed(2)}`);
    const bar = (name: string, key: 'p_lower' | 'p_normal' | 'p_upper', color: string) => ({
      type: 'bar', name, x: systems.map(s => s.label), y: probs.map(p => +(100 * p[key]).toFixed(1)),
      marker: { color }, customdata: hover, hovertemplate: `%{x}<br>${name}: %{y} %<br>%{customdata}<extra></extra>` });
    const wet = variable === 'precipitation';
    const layout: any = { ...dark('Probabilidad (%)', 'Sistema'), barmode: 'group', yaxis: { ...dark('', '').yaxis, title: { text: 'Probabilidad (%)' }, range: [0, 100] } };
    layout.shapes = [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 33.3, y1: 33.3, line: { color: 'white', width: 1, dash: 'dash' } }];
    return { cell: { lat, lon }, plot: { layout, data: [
      bar('Bajo lo normal', 'p_lower', wet ? '#e6550d' : '#2171b5'),
      bar('Normal', 'p_normal', '#bdbdbd'),
      bar('Sobre lo normal', 'p_upper', wet ? '#238b45' : '#cb181d'),
    ] } };
  },
  // Figura del contrato: cuatro barras (bajo, normal, sobre lo normal, sobre el P80) con la
  // climatología como marcadores (33 % por tercil, 20 % sobre el P80).
  'outlook-plot': () => {
    const analogs = [{ year: 1998, weight: 0.21, value: 812.3 }, { year: 1983, weight: 0.18, value: 905.1 },
      { year: 2016, weight: 0.15, value: 455.0 }, { year: 2017, weight: 0.14, value: 610.7 },
      { year: 1992, weight: 0.12, value: 388.2 }, { year: 2023, weight: 0.11, value: 520.4 },
      { year: 1987, weight: 0.09, value: null }];
    const cats = ['Bajo lo normal', 'Normal', 'Sobre lo normal', 'Sobre el P80'];
    const layout: any = dark('Probabilidad (%)', 'Categoría del caudal medio nov–ene');
    layout.xaxis.type = 'category';
    return {
      river: 'Río Daule', province: 'Guayas', canton: 'Daule', issue_month: '2026-11-01', season: 'NDE',
      months: 'nov–ene', skilful: true, rpss: 0.18, bss_p80: 0.09, analogs,
      plot: { layout, data: [
        { type: 'bar', name: 'Perspectiva', x: cats, y: [12, 25, 63, 41],
          marker: { color: ['#2166ac', '#bdbdbd', '#b2182b', '#67000d'] } },
        { type: 'scatter', mode: 'markers', name: 'Climatología', x: cats, y: [33.3, 33.3, 33.3, 20],
          marker: { color: 'white', symbol: 'line-ew-open', size: 30, line: { width: 3, color: 'white' } } },
      ] },
    };
  },

  'status': () => ({
    coastal: { index: 'icen_prov', value: 1.12, date: '2026-09-01', phase: 'calida_moderada', label: 'Cálida moderada', phase_group: 'calida_debil' },
    global: { index: 'roni', value: 1.69, date: '2026-09-01', phase: 'el_nino', label: 'El Niño' },
    oni: { index: 'oni', value: 2.16, date: '2026-09-01', phase: 'el_nino', label: 'El Niño' },
    nino12_week: { value: 1.84, date: '2026-10-07' },
    coastal_sst: { date: '2026-10-19', sst: 27.6, anom: 3.9, level: 'muy_probable',
      label: '≥ umbral convectivo alto (27,5 °C)', thresholds: { probable: 26.5, muy_probable: 27.5 } },
  }),
  'nmme-plume-plot': () => {
    const m = Array.from({ length: 21 }, (_, i) => `${2025 + Math.floor((i + 9) / 12)}-${String(((i + 9) % 12) + 1).padStart(2, '0')}-01`);
    const obs = m.slice(0, 12), fc = m.slice(12);
    const model = (name: string, k: number, color: string) => ({ type: 'scatter', mode: 'lines', name, x: fc,
      y: fc.map((_, i) => +(4.4 - (0.2 + 0.1 * k) * i).toFixed(2)), line: { color, width: 1.3 } });
    const layout: any = dark('Anomalía Niño 1+2 (°C)', 'Mes');
    layout.shapes = [0.5, 1.3, 2.1, 3.5].map(y => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y,
      line: { color: '#9AA0A6', width: 1, dash: 'dot' } }));
    return { init: '2026-10-01', models: ['CFSv2', 'CanESM5'], plot: { layout, data: [
      model('CFSv2', 0, '#66c5cc'), model('CanESM5', 3, '#f6cf71'),
      { ...model('NMME (media de los modelos)', 1, 'white'), line: { color: 'white', width: 3.5 } },
      { type: 'scatter', mode: 'lines+markers', name: 'Niño 1+2 observado (ERSST)', x: obs,
        y: obs.map((_, i) => +(0.3 * i + 0.5).toFixed(2)), line: { color: '#FCBF10', width: 3 } },
    ] } };
  },
  'coastal-sst-plot': () => {
    const days = Array.from({ length: 365 }, (_, i) => i);
    const clim = days.map(i => +(24 - 2.2 * Math.cos(2 * Math.PI * (i - 20) / 365)).toFixed(2));
    const line = (name: string, extra: number, color: string, width = 1.5, n = 365) => ({
      type: 'scatter', mode: 'lines', name, x: days.slice(0, n), line: { color, width },
      y: days.slice(0, n).map(i => +(clim[i] + extra * Math.sin(Math.PI * Math.min(i, 300) / 300)).toFixed(2)) });
    const layout: any = dark('TSM franja costera (°C)', 'Temporada (julio a junio), media de 7 días');
    layout.shapes = [26.5, 27.5].map((y, k) => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y,
      line: { color: '#FCBF10', width: 1, dash: k ? 'dot' : 'dash' } }));
    return { thresholds: { probable: 26.5, muy_probable: 27.5 }, plot: { layout, data: [
      { ...line('Climatología 1991–2020', 0, 'white', 3) },
      line('1997-98', 3.2, '#66c2a5'), line('2015-16', 1.5, '#fc8d62'),
      line('2026-27 (en curso)', 3.6, '#FCBF10', 3.5, 110),
    ] } };
  },
  'index-plot': () => ({ plot: {
    data: [{ type: 'bar', x: months, y: series, marker: { color: series.map(barColor) }, name: 'Índice' }],
    layout: dark('Anomalía (°C)', 'Fecha'),
  } }),
  'hovmoller-plot': () => ({ plot: {
    data: [{ type: 'heatmap', x: lons, y: weeks, colorscale: 'RdBu', zmin: -4, zmax: 4,
      z: weeks.map((_, j) => lons.map(x => +(3 * Math.sin((x - 2 * j) / 15)).toFixed(2))),
      colorbar: { title: { text: '°C' } } }],
    layout: dark('Fecha', 'Longitud (°E)'),
  } }),
  // index-heatmap-plot tiene la misma forma; con ?index=oni la amplitud baja a la mitad para que,
  // lado a lado, se vea la diferencia entre la costa y el Pacífico central.
  'icen-heatmap-plot': (q) => {
    const index = q.get('index') ?? 'icen', k = index === 'oni' ? 0.5 : 1;
    return { plot: {
      data: [{ type: 'heatmap', x: mes, y: Array.from({ length: 20 }, (_, i) => 2007 + i), colorscale: 'RdBu',
        zmin: -3, zmax: 3,
        z: Array.from({ length: 20 }, (_, j) => mes.map((_, i) => +(k * series[j * 12 + i]).toFixed(2))),
        colorbar: { title: { text: `${index.toUpperCase()} (°C)` } } }],
      layout: dark('Año', 'Mes'),
    } };
  },
  'composite-plot': () => ({
    river: 'Río Daule', province: 'Guayas', canton: 'Daule', phase_now: 'calida_debil',
    plot: {
      data: phases.map((name, k) => ({ type: 'bar', name, x: mes, marker: { color: phaseColors[k] },
        y: mes.map((_, i) => k === 0 && i === 6 ? 'NaN' : +(300 * (1.6 - 0.25 * k) * (1 + Math.cos(i / 2))).toFixed(1)) })),
      layout: { ...dark('Caudal (m<sup>3</sup>/s)', 'Mes'), barmode: 'group' },
    },
  }),
  'analogs-plot': () => ({
    years: [1983, 1998, 2017, 2023],
    plot: {
      data: [1983, 1998, 2017, 2023].map((y, k) => ({ type: 'scatter', mode: 'lines', name: String(y), x: mes,
        y: mes.map((_, i) => +(400 * (1 + 0.2 * k) * (1 + Math.cos(i / 2))).toFixed(1)) }))
        .concat([{ type: 'scatter', mode: 'lines', name: 'Climatología', x: mes,
          y: mes.map((_, i) => +(350 * (1 + Math.cos(i / 2))).toFixed(1)), line: { color: 'black', dash: 'dash' } } as any]),
      layout: dark('Caudal (m<sup>3</sup>/s)', 'Mes'),
    },
  }),
};

export async function mockFetch(url: string): Promise<Response> {
  await new Promise(r => setTimeout(r, 400));
  const endpoint = new URL(url).pathname.split('/').pop() ?? '';
  if (endpoint === 'outlook-csv') {
    return new Response('issue_month,comid,season,p_lower,p_normal,p_upper,p_p80,rpss,skilful\n2026-11-01,9035711,NDE,0.12,0.25,0.63,0.41,0.18,true\n',
      { status: 200, headers: { 'Content-Type': 'text/csv' } });
  }
  if (endpoint === 'composite-csv') {
    return new Response('comid,month,phase,q_mean,ratio,n_years\n9035711,1,calida_fuerte,812.4,1.62,4\n',
      { status: 200, headers: { 'Content-Type': 'text/csv' } });
  }
  const make = RESPONSES[endpoint === 'index-heatmap-plot' ? 'icen-heatmap-plot' : endpoint];
  if (!make) { return new Response('{}', { status: 404 }); }
  // 'NaN' entre comillas se vuelve NaN literal, como lo manda el backend de Python.
  return new Response(JSON.stringify(make(new URL(url).searchParams)).replace(/"NaN"/g, 'NaN'), { status: 200 });
}
