/**
 * Providers utility class for application-wide configuration.
 *
 * @author Juseth E. Chancay
 * @lastUpdated 2025-08-19
 *
 * Responsibilities
 * ----------------
 * - Define reusable date format settings for Angular Material
 *   DateAdapter and DatePicker components.
 * - Ensure consistency in parsing, displaying, and accessibility
 *   labels across the application.
 *
 * Key Features
 * ------------
 * - Parsing format for ISO-like datetime strings (`YYYY-MM-DDTHH:mm`).
 * - Display formats for datetime, date, and month-year labels.
 * - Accessibility (A11y) labels for screen readers.
 */

export class providers{
  public dateFormat = {
    parse: {
      dateInput: 'YYYY-MM-DDTHH:mm',
    },
    display: {
      datetimeInput: 'YYYY-MM-DD HH:mm',
      dateInput: 'YYYY-MM-DD',
      monthYearLabel: 'MMM YYYY',
      dateA11yLabel: 'LL',
      monthYearA11yLabel: 'MMMM YYYY',
    },
  };
}
