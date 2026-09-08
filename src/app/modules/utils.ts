/*****************************************************************************
 *
 * Utility helpers for date ranges commonly used in GEOGloWS views.
 *
 * Notes
 * -----
 * - All computations use the browser's local timezone (JavaScript Date).
 * - Strings returned are formatted as ISO-like `YYYY-MM-DD` (no timezone).
 * - Methods are side-effect free (they do not mutate caller-provided dates).
 *
 *****************************************************************************/
import * as L from 'leaflet';

export class Utils {

  /**
   * Build a daily date list for a 15-day window starting at `selectedDate`.
   *
   * The list is inclusive of both ends:
   * `selectedDate ... selectedDate + 14 days` (15 items total).
   *
   * @param selectedDate - Start date (local time). Accepts a `Date`.
   * @returns Array of `YYYY-MM-DD` strings for each day in the window.
   *
   * @example
   * getDateRangeGeoglows(new Date('2025-08-01'))
   * // => ['2025-08-01', ..., '2025-08-15']
   *
   * @remarks
   * This method iterates by calendar days using local time; month and
   * year rollovers are handled by `Date#setDate`.
   */
  public getDateRangeGeoglows(selectedDate: Date): string[] {
    const result: string[] = [];
    const startDate = new Date(selectedDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 14);

    let currentDate = new Date(startDate); // prevent mutating startDate
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      result.push(`${year}-${month}-${day}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return result;
  }

  /**
   * Return the first day of each month within a start–end range (inclusive).
   *
   * @param start - Range start (Date | string | number). Parsed by `new Date`.
   * @param end   - Range end   (Date | string | number). Parsed by `new Date`.
   * @returns Array of `YYYY-MM-01` strings for every month in the range.
   *          Returns an empty array if either date is invalid.
   *
   * @example
   * getFirstDaysOfMonthsInRange('2025-02-10', '2025-05-03')
   * // => ['2025-02-01','2025-03-01','2025-04-01','2025-05-01']
   *
   * @remarks
   * - The range is inclusive by month: if `end` is within May, 'YYYY-05-01'
   *   will be included.
   * - Uses local calendar arithmetic (`new Date(y, m, 1)`).
   */
  public getFirstDaysOfMonthsInRange(
    start: Date | string | number,
    end: Date | string | number
  ): string[] {
    const result: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error("Invalid dates:", start, end);
      return [];
    }

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= last) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      result.push(`${year}-${month}-01`);
      current.setMonth(current.getMonth() + 1);
    }
    return result;
  }

  /**
   * Get the first and last calendar day of the previous month
   * relative to `today`.
   *
   * @param today - Reference date (defaults to `new Date()`).
   * @returns An object with:
   *  - `start`: first day of the previous month at local 00:00
   *  - `end`  : last day of the previous month at local 00:00
   *
   * @example
   * // If today is 2025-08-19:
   * getPreviousMonthRange()
   * // => { start: 2025-07-01T00:00:00, end: 2025-07-31T00:00:00 }
   *
   * @remarks
   * If you need an end-of-day timestamp, adjust `end` in the caller
   * (e.g., add `23:59:59.999` or use an exclusive upper bound).
   */
  public getPreviousMonthRange(today: Date = new Date()): {
    start: Date; end: Date;
  } {
    const y = today.getFullYear();
    const m = today.getMonth();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);

    return { start, end };
  }


    /**
   * Parse and format an array of date strings into a compact, human-readable
   * representation `YYYY-MM-DD HH:mm` using the browser's local timezone.
   *
   * @param dates - Array of strings representing date/time values that can be
   *                parsed by `new Date()` (e.g., ISO 8601 `"2025-09-05T14:20:00Z"`
   *                or `"2025-09-05 14:20"`). Each element is converted into
   *                `"YYYY-MM-DD HH:mm"`.
   *
   * @returns Array of strings with each date formatted as
   *          `YYYY-MM-DD HH:mm` in local time.
   *
   * @example
   * // Input with UTC suffix ('Z'); output reflects local time
   * parseGOESDatetime([
   *   '2025-09-05T14:07:00Z',
   *   '2025-09-05T14:20:30Z'
   * ]);
   * // => ['2025-09-05 09:07', '2025-09-05 09:20']   // if local is UTC-05
   *
   * @example
   * // Input without timezone suffix (interpreted as local time)
   * parseGOESDatetime(['2025-09-05 14:07']);
   * // => ['2025-09-05 14:07']
   *
   */
  public parseGOESDatetime(dates: string[]): string[] {
  return dates.map(dateString => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    });
  }




  /**
   * Generate an array of formatted date strings between two dates, with
   * support for hourly, daily, monthly, or yearly frequencies. Dates can be
   * returned in display, WMS, or ISO-Z format.
   *
   * @param startDate - Start date of the sequence (inclusive).
   * @param endDate - End date of the sequence (inclusive).
   * @param frequency - Step size: `"horaria"`, `"diaria"`, `"mensual"`,
   *                    or `"anual"`.
   * @param format - Output format:
   *   - `"display"` → `YYYY-MM-DD HH:mm` or `YYYY-MM-DD`
   *   - `"wms"`     → `YYYY-MM-DDTHHmm`
   *   - `"isoz"`    → `YYYY-MM-DDTHH:mm:00.000Z`
   *
   * @returns Array of formatted date strings for the given range and step.
   *
   * @example
   * // Hourly in display format
   * generateSatelliteDates(
   *   new Date('2025-01-01'),
   *   new Date('2025-01-01'),
   *   'horaria',
   *   'display'
   * );
   * // => ['2025-01-01 00:00', ... '2025-01-01 23:00']
   *
   * @example
   * // Hourly in WMS format
   * generateSatelliteDates(
   *   new Date('2025-01-01'),
   *   new Date('2025-01-01'),
   *   'horaria',
   *   'wms'
   * );
   * // => ['2025-01-01T0000', ... '2025-01-01T2300']
   *
   * @example
   * // Hourly in ISO-Z format
   * generateSatelliteDates(
   *   new Date('2025-01-01'),
   *   new Date('2025-01-01'),
   *   'horaria',
   *   'isoz'
   * );
   * // => ['2025-01-01T00:00:00.000Z', ... '2025-01-01T23:00:00.000Z']
   *
   * @throws Error if frequency is not supported.
   */
  public generateSatelliteDates(
    startDate: Date,
    endDate: Date,
    frequency: string,
    format: 'display' | 'wms' | 'api' | 'isoz' = 'isoz'
  ): string[] {
    const generatedDates: string[] = [];
    let currentDate: Date = new Date(startDate);

    const pad = (n: number) => n.toString().padStart(2, '0');

    while (currentDate <= endDate) {
      if (frequency.toLowerCase() === 'horaria') {
        const currentHour = new Date(currentDate);
        currentHour.setHours(0, 0, 0, 0);

        while (
          currentHour <= endDate &&
          currentHour.getDate() === currentDate.getDate()
        ) {
          const yyyy = currentHour.getFullYear();
          const mm = pad(currentHour.getMonth() + 1);
          const dd = pad(currentHour.getDate());
          const hh = pad(currentHour.getHours());
          const min = pad(currentHour.getMinutes());

          let formatted = '';
          switch (format) {
            case 'wms':
              formatted = `${yyyy}-${mm}-${dd}T${hh}${min}`;
              break;
            case 'isoz':
              formatted = `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000Z`;
              break;
            case 'api':
              formatted = `${yyyy}${mm}${dd}${hh}${min}`;
              break;
            default:
              formatted = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
          }

          generatedDates.push(formatted);
          currentHour.setHours(currentHour.getHours() + 1);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      } else {
        const yyyy = currentDate.getFullYear();
        const mm = pad(currentDate.getMonth() + 1);
        const dd = pad(currentDate.getDate());

        let formatted = '';
        switch (format) {
          case 'isoz':
            formatted = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
            break;
          case 'wms':
            formatted = `${yyyy}-${mm}-${dd}T0000`;
            break;
          case 'api':
            formatted = `${yyyy}${mm}${dd}0000`;
            break;
          default:
            formatted = `${yyyy}-${mm}-${dd}`;
        }

        generatedDates.push(formatted);

        switch (frequency.toLowerCase()) {
          case 'diaria':
            currentDate.setDate(currentDate.getDate() + 1);
            break;
          case 'mensual':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
          case 'anual':
            currentDate.setFullYear(currentDate.getFullYear() + 1);
            break;
          default:
            throw new Error('Invalid frequency');
        }
      }
    }
    return generatedDates;
  }




  public createLegendControl(): {
                legendControl: L.Control; legendElement: HTMLDivElement } {
    const legendContainer = document.createElement('div');
    legendContainer.className = 'legend-container';
    legendContainer.style.position = 'relative';
    legendContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    legendContainer.style.color = 'black';
    legendContainer.style.padding = '5px 20px 5px 5px';
    legendContainer.style.fontSize = '0.8rem';
    legendContainer.style.borderRadius = '5px';
    legendContainer.style.maxWidth = '280px';
    const dateElement = document.createElement('div');
    dateElement.className = 'legend-date';
    legendContainer.appendChild(dateElement);
    L.DomEvent.disableClickPropagation(legendContainer);
    L.DomEvent.disableScrollPropagation(legendContainer);
    const dateControl = new L.Control({ position: 'bottomleft' });
    (dateControl as any).onAdd = () => legendContainer;
    return { legendControl: dateControl, legendElement: dateElement };
  }

  public getCutoffDate(cutoffHour = 8): Date {
    const now = new Date();
    const res = new Date(now);
    if (now.getHours() < cutoffHour) res.setDate(res.getDate() - 1);
    res.setHours(0, 0, 0, 0);
    return res;
  }


  public computeForecastDate(
    baseDate?: Date | string | null,
    format: 'display' | 'wms' | 'init' | 'isoz' = 'isoz',
    frequency: string = "3 Horaria"
  ): string[] {
    let base: Date;

    // 1) Normalizar baseDate a Date
    if (!baseDate) {
      base = new Date();
    } else if (baseDate instanceof Date) {
      base = new Date(baseDate.getTime());
    } else {
      base = new Date(baseDate as string);
    }

    // Siempre a medianoche primero
    base.setHours(0, 0, 0, 0);

    const dates: Date[] = [];

    // ---------- 2) Construir la serie según frecuencia ----------
    if (frequency === 'Mensual') {
      // Mensual: horizonte de 4 meses, paso 1 mes
      // Empieza a las 07:00 del mes base
      const start = new Date(base.getTime());
      start.setHours(7, 0, 0, 0); // 07:00

      const monthsAhead = 4;
      for (let i = 0; i <= monthsAhead; i++) {
        const d = new Date(start.getTime());
        d.setMonth(d.getMonth() + i);
        dates.push(d);
      }
    } else {
      // 3 Horaria, Diaria, Semanal

      let horizonDays = 3;   // por defecto
      let stepMs = 3 * 60 * 60 * 1000; // por defecto 3 horas
      let startHour = 1;     // por defecto 01:00 (3 Horaria)

      switch (frequency) {
        case '3 Horaria':
          horizonDays = 3;
          stepMs = 3 * 60 * 60 * 1000; // 3 horas
          startHour = 1;               // 01:00
          break;

        case 'Diaria':
          horizonDays = 2;
          stepMs = 24 * 60 * 60 * 1000; // 1 día
          startHour = 7;                // 07:00
          break;

        case 'Semanal':
          horizonDays = 7; // 2 semanas
          stepMs = 7 * 24 * 60 * 60 * 1000; // 7 días
          startHour = 7;                     // 07:00
          break;
      }

      // start y end con la hora adecuada
      const start = new Date(base.getTime());
      start.setHours(startHour, 0, 0, 0);

      const end = new Date(base.getTime());
      end.setDate(end.getDate() + horizonDays);
      end.setHours(startHour, 0, 0, 0);

      let current = new Date(start.getTime());
      while (current <= end) {
        dates.push(new Date(current.getTime()));
        current = new Date(current.getTime() + stepMs);
      }
    }

    // ---------- 3) Formateo ----------
    const pad = (n: number) => n.toString().padStart(2, '0');

    return dates.map((date) => {
      const yyyy = date.getFullYear();
      const mm = pad(date.getMonth() + 1);
      const dd = pad(date.getDate());
      const hh = pad(date.getHours());

      switch (format) {
        case 'wms':
          return `${yyyy}-${mm}-${dd}T${hh}00`;
        case 'isoz':
          return `${yyyy}-${mm}-${dd}T${hh}:00:00.000Z`;
        case 'init':
          return `${yyyy}-${mm}-${dd}`;
        default:
          if (frequency === 'Semanal'){
            const date2 = new Date(date.getTime());
            date2.setDate(date2.getDate() + 7)
            const yyyy2 = date2.getFullYear();
            const mm2 = pad(date2.getMonth() + 1);
            const dd2 = pad(date2.getDate());
            return `<br>De ${yyyy}-${mm}-${dd} ${hh}:00 a ${yyyy2}-${mm2}-${dd2} ${hh}:00`;
          }
          if (frequency === 'Diaria'){
            const date2 = new Date(date.getTime());
            date2.setDate(date2.getDate() + 1)
            const yyyy2 = date2.getFullYear();
            const mm2 = pad(date2.getMonth() + 1);
            const dd2 = pad(date2.getDate());
            return `<br>De ${yyyy}-${mm}-${dd} ${hh}:00 a ${yyyy2}-${mm2}-${dd2} ${hh}:00`;
          }
          return `${yyyy}-${mm}-${dd} ${hh}:00`;
      }
    });
  }










}
