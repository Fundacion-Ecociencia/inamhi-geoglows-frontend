/*****************************************************************************
 *                    ENSO ECUADOR: MODO DE PRUEBA SIN API                   *
 *****************************************************************************
 * Se activa en el navegador con  localStorage.setItem('enso_mock', '1')  y se
 * apaga con  localStorage.removeItem('enso_mock'). Devuelve respuestas de
 * ejemplo con la forma del contrato (docs/plan-enso.md, sección 6) para
 * probar el modal y los gráficos mientras /api/enso/ no está desplegada.
 * Los valores son inventados: no sirven para nada más que ver la vista.
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

const RESPONSES: Record<string, () => any> = {
  'status': () => ({
    coastal: { index: 'icen_prov', value: 1.12, date: '2026-09-01', phase: 'calida_moderada', label: 'Cálida moderada', phase_group: 'calida_debil' },
    global: { index: 'roni', value: 1.69, date: '2026-09-01', phase: 'el_nino', label: 'El Niño' },
    oni: { index: 'oni', value: 2.16, date: '2026-09-01', phase: 'el_nino', label: 'El Niño' },
    nino12_week: { value: 1.84, date: '2026-10-07' },
  }),
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
  'icen-heatmap-plot': () => ({ plot: {
    data: [{ type: 'heatmap', x: mes, y: Array.from({ length: 20 }, (_, i) => 2007 + i), colorscale: 'RdBu',
      zmin: -3, zmax: 3, z: Array.from({ length: 20 }, (_, j) => mes.map((_, i) => series[j * 12 + i])),
      colorbar: { title: { text: 'ICEN (°C)' } } }],
    layout: dark('Año', 'Mes'),
  } }),
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
  if (endpoint === 'composite-csv') {
    return new Response('comid,month,phase,q_mean,ratio,n_years\n9035711,1,calida_fuerte,812.4,1.62,4\n',
      { status: 200, headers: { 'Content-Type': 'text/csv' } });
  }
  const make = RESPONSES[endpoint];
  if (!make) { return new Response('{}', { status: 404 }); }
  // 'NaN' entre comillas se vuelve NaN literal, como lo manda el backend de Python.
  return new Response(JSON.stringify(make()).replace(/"NaN"/g, 'NaN'), { status: 200 });
}
