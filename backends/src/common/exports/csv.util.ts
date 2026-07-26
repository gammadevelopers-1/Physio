/**
 * Shared CSV export helpers.
 *
 * Why the BOM: Excel opens .csv files as CP-1252 unless the file starts with
 * a UTF-8 BOM (﻿). Without it, Arabic (and any non-ASCII) becomes mojibake
 * — a client-visible bug we ship every time a new endpoint hand-rolls its own
 * CSV writer. All new CSV exports must go through toCsvBuffer/toCsvString.
 */

export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
export const CSV_BOM = '﻿';

type CsvValue = string | number | boolean | null | undefined | Date;

export interface CsvOptions {
  /** Column headers rendered as the first row. */
  headers?: string[];
  /** Field delimiter. Defaults to comma. */
  delimiter?: string;
  /** Line ending. Excel prefers CRLF. */
  eol?: string;
  /** When true, disables the leading BOM (rare — only for API-to-API pipes). */
  omitBom?: boolean;
}

/**
 * Escape a single CSV cell per RFC-4180 + defend against Excel formula
 * injection. A cell that starts with =, +, -, @, tab, or CR is prefixed with
 * a single quote so Excel treats it as text.
 */
export function escapeCsvCell(value: CsvValue, delimiter = ','): string {
  if (value === null || value === undefined) return '';
  let str = value instanceof Date ? value.toISOString() : String(value);

  // Formula-injection guard (CVE class — Excel/LibreOffice will execute).
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;

  const needsQuotes = str.includes(delimiter) || str.includes('"') || /[\r\n]/.test(str);
  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a full CSV string (with BOM by default). */
export function toCsvString(rows: CsvValue[][], opts: CsvOptions = {}): string {
  const delimiter = opts.delimiter ?? ',';
  const eol = opts.eol ?? '\r\n';
  const body: string[] = [];
  if (opts.headers?.length) {
    body.push(opts.headers.map((h) => escapeCsvCell(h, delimiter)).join(delimiter));
  }
  for (const row of rows) {
    body.push(row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter));
  }
  const csv = body.join(eol) + (body.length ? eol : '');
  return opts.omitBom ? csv : CSV_BOM + csv;
}

/** Same as toCsvString but returns a Buffer suitable for StreamableFile/res.send. */
export function toCsvBuffer(rows: CsvValue[][], opts: CsvOptions = {}): Buffer {
  return Buffer.from(toCsvString(rows, opts), 'utf-8');
}

/**
 * Prepend the BOM to an already-built CSV string. Use when migrating existing
 * builders that already do their own row assembly and we only want to fix the
 * encoding contract without rewriting the whole thing.
 */
export function ensureCsvBom(csv: string): string {
  return csv.startsWith(CSV_BOM) ? csv : CSV_BOM + csv;
}
