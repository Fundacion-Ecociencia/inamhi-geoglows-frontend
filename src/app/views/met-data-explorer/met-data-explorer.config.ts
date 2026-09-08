
export class dataApp{
  // Satellite based variables
  public satelliteVariables:string[] = ["Precipitación"];

  // Satellite based products
  public satelliteData =   [
    { Variable: 'Precipitación',  Product: 'PERSIANN PDIR',    Code:"persiann_pdir",   Temporal: 'Diaria', Tag:"(mm)" },
    { Variable: 'Precipitación',  Product: 'IMERG Early Run',  Code:"imerg_early_run",     Temporal: 'Diaria', Tag:"(mm)" },
  ];

  // WRF
  public models:string[] = ["Weather Research and Forecasting"]
  public modelData = [
    {Model: "Weather Research and Forecasting", Variable: "Precipitación", Temporal: "3 Horaria", Tag: "(mm)", Code: "wrf_precipitation"},
    {Model: "Weather Research and Forecasting", Variable: "Precipitación", Temporal: "Diaria", Tag: "(mm)", Code: "wrf_precipitation_daily"},
    {Model: "Weather Research and Forecasting", Variable: "Precipitación", Temporal: "Semanal", Tag: "(mm)", Code: "wrf_precipitation_weekly"},
    {Model: "Weather Research and Forecasting", Variable: "Temperatura", Temporal: "3 Horaria", Tag: "(°C)", Code: "wrf_temperature"},
    {Model: "Weather Research and Forecasting", Variable: "Temperatura", Temporal: "Diaria", Tag: "(°C)", Code: "wrf_temperature_daily"},
    {Model: "Weather Research and Forecasting", Variable: "Humedad relativa", Temporal: "3 Horaria", Tag: "(%)", Code: "wrf_relative_humidity"},
    {Model: "Weather Research and Forecasting", Variable: "Humedad relativa", Temporal: "Diaria", Tag: "(%)", Code: "wrf_relative_humidity_daily"},
    {Model: "Weather Research and Forecasting", Variable: "Velocidad del viento", Temporal: "3 Horaria", Tag: "(m/s)", Code: "wrf_wind_speed"},
    {Model: "Weather Research and Forecasting", Variable: "Velocidad del viento", Temporal: "Diaria", Tag: "(m/s)", Code: "wrf_wind_speed_daily"},
    {Model: "Weather Research and Forecasting", Variable: "Indice de Haines", Temporal: "3 Horaria", Tag: "(-)", Code: "wrf_haines"}
  ]

  // GOES Products
  public goesProducts:string[] = ['Cloud and Moisture Imagery', 'Custom RGB Products', 'Deep convection and Hailstorm'];
  public goesOverlay:string[] = ['None', 'Group Energy Density', "Fire/Hot Spot Characterization", "Lightning Cast", "Nowcasting Ecuador", "Hailstorm Potential Index"];

  public goesData = [
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_01", B:1, Band: 'Banda 1: 0.47 µm ("Blue")', Tag: ""},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_02", B:2, Band: 'Banda 2: 0.64 µm ("Red")', Tag: ""},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_03", B:3, Band: 'Banda 3: 0.86 µm ("Veggie")', Tag: ""},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_04", B:4, Band: 'Banda 4: 1.37 µm ("Cirrus")', Tag: ""},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_05", B:5, Band: 'Banda 5: 1.6 µm ("Snow/Ice")', Tag: ""},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_06", B:6, Band: 'Banda 6: 2.2 µm ("Cloud Particle Size")', Tag: ""},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_07", B:7, Band: 'Banda 7: 3.9 µm ("Shortwave Window")', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_08", B:8, Band: 'Banda 8: 6.2 µm ("Upper-Level Tropospheric Water Vapor")', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_09", B:9, Band: 'Banda 9: 6.9 µm ("Mid-Level Tropospheric Water Vapor")', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_10", B:10, Band: 'Banda 10: 7.3 µm ("Lower-level Water Vapor")', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_11", B:11, Band: 'Banda 11: 8.4 µm ("Cloud-Top Phase")', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_12", B:12, Band: 'Banda 12: 9.6 µm ("Ozone")', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_13", B:13, Band: 'Banda 13: 10.3 µm ("Clean" IR Longwave Window)', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_14", B:14, Band: 'Banda 14: 11.2 µm ("IR" Longwave Window)', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_15", B:15, Band: 'Banda 15: 12.3 µm ("Dirty" Longwave Window)', Tag: "(°C)"},
    {Product: "Cloud and Moisture Imagery", Code:"goes_abi_l2_cmipf_16", B:16, Band: 'Banda 16: 13.3 µm ("CO2" Longwave Infrared)', Tag: "(°C)"},

    {Product: "Custom RGB Products", Code:"goes_rgb_true_color",       B:16, Band: 'True Color', Tag: ""},
    {Product: "Custom RGB Products", Code:"goes_rgb_day_cloud_phase",  B:16, Band: 'Day Cloud Phase Distinction', Tag: ""},
    {Product: "Custom RGB Products", Code:"goes_rgb_fire_temperature", B:16, Band: 'Fire Temperature', Tag: ""},

    {Product: "Deep convection and Hailstorm", Code:"goes_cloud_deep_proxy",            B:1, Band: 'Cloud Deep Proxy', Tag: ""},
    {Product: "Deep convection and Hailstorm", Code:"goes_cloud_top_glaciation_proxy",  B:1, Band: 'Cloud Top Glaciation Proxy', Tag: ""},
    {Product: "Deep convection and Hailstorm", Code:"goes_particle_size_proxy",         B:1, Band: 'Ice Particle Size', Tag: ""},
    {Product: "Deep convection and Hailstorm", Code:"goes_updraft_strength_proxy",      B:1, Band: 'Updraft Strength', Tag: "(°C/min)"},

    {Product: "Group Energy Density", Code:"goes_glm_l2_lcfa", B:1, Band: 'Group Energy Density', Tag: ""},
    {Product: "Fire/Hot Spot Characterization", Code:"goes_abi_l2_fdcf", B:1, Band: 'Fire/Hot Spot Characterization', Tag: ""},
    {Product: "Lightning Cast", Code:"goes_lightning_cast", B:1, Band: 'Lightning Cast', Tag: ""},
    {Product: "Nowcasting Ecuador", Code:"goes_lightning_cast_inamhi", B:1, Band: 'Nowcasting Ecuador', Tag: ""},
    {Product: "Hailstorm Potential Index", Code:"goes_hailstorm", B:1, Band: 'Hailstorm Potential Index', Tag: ""},
  ];



  // SNGR events
  public sngrEvents:string[] = ["Inundación", "Incendio Forestal", "Deslizamiento", "Aluvión (Flujos)", "Granizada", "Tormenta Eléctrica"];
  public sngrFilters:string[] = ["Fecha del evento", "Fecha de actualización"];


}
