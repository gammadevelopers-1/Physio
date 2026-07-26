/**
 * Shared PDF export helpers.
 *
 * pdfkit ships with Helvetica only, which has no Arabic glyphs — Arabic text
 * renders as boxes unless we register a font with Arabic coverage AND flip on
 * PDFKit's RTL text-shaping feature (`features: ['rtla']`). We use
 * NotoSansArabic (bundled at src/assets/fonts/) because it has both Regular
 * and Bold variants and full Arabic + Latin coverage.
 *
 * Call `registerArabicFonts(doc)` once after constructing a PDFDocument, then
 * use `writeText(doc, text, opts)` for every text call. `writeText` detects
 * Arabic runs and switches font + enables RTL shaping automatically.
 */

import * as path from 'path';
import * as fs from 'fs';

export const ARABIC_REGEX =
  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export const ARABIC_FONT = 'NotoArabic';
export const ARABIC_FONT_BOLD = 'NotoArabicBold';
export const LATIN_FONT = 'Helvetica';
export const LATIN_FONT_BOLD = 'Helvetica-Bold';

export function hasArabic(text: string | null | undefined): boolean {
  return !!text && ARABIC_REGEX.test(text);
}

/**
 * Marker we stamp on the PDFDocument once the Arabic fonts are known-good.
 * writeText checks this before switching to the Arabic font; if unset (font
 * files missing / prod image drift), Arabic text falls back to Helvetica —
 * glyphs become boxes but the report still ships instead of 500'ing.
 */
const ARABIC_READY = Symbol.for('physioguidance.pdf.arabicFontsReady');

/**
 * Register NotoSansArabic Regular + Bold on the given PDFDocument. Safe to
 * call once per document. Logs a warning and continues if the fonts are
 * missing (Arabic will fall back to Helvetica boxes, but the report still ships).
 */
export function registerArabicFonts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  logger?: { warn: (msg: string) => void },
): void {
  try {
    const fontsDir = path.join(process.cwd(), 'src', 'assets', 'fonts');
    const regularPath = path.join(fontsDir, 'NotoSansArabic-Regular.ttf');
    const boldPath = path.join(fontsDir, 'NotoSansArabic-Bold.ttf');
    if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
      throw new Error(`Arabic font file(s) missing at ${fontsDir}`);
    }
    doc.registerFont(ARABIC_FONT, regularPath);
    doc.registerFont(ARABIC_FONT_BOLD, boldPath);
    doc[ARABIC_READY] = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (logger) logger.warn(`Arabic font unavailable on PDF; falling back to Helvetica: ${msg}`);
  }
}

export interface WriteTextOpts {
  /** Bold variant (Helvetica-Bold / NotoArabicBold). */
  bold?: boolean;
  /** Font size in points. Preserved after the call. */
  fontSize?: number;
  /** Fill color. Preserved after the call. */
  color?: string;
  /** Absolute X coordinate; when omitted uses PDFKit's current cursor. */
  x?: number;
  /** Absolute Y coordinate; when omitted uses PDFKit's current cursor. */
  y?: number;
  /** Any other PDFKit text options (width, align, lineBreak, ...). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  textOptions?: Record<string, any>;
}

/**
 * Write a piece of text to the document, auto-switching to the Arabic font
 * and enabling RTL shaping when the text contains Arabic characters. Mixed
 * runs are written with the Arabic font (which contains Latin glyphs too);
 * pure-Latin runs stay on Helvetica so tables keep their compact metrics.
 */
export function writeText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  text: string | null | undefined,
  opts: WriteTextOpts = {},
): void {
  const value = text ?? '';
  const bold = opts.bold ?? false;
  // Only route through the Arabic font when BOTH the text needs it and the
  // font actually registered. Never call doc.font('NotoArabic') otherwise —
  // pdfkit throws on unknown font names and takes the whole request down.
  const useArabicFont = hasArabic(value) && doc[ARABIC_READY] === true;
  const font = useArabicFont
    ? bold ? ARABIC_FONT_BOLD : ARABIC_FONT
    : bold ? LATIN_FONT_BOLD : LATIN_FONT;

  try {
    doc.font(font);
  } catch {
    // If even the Latin font swap fails we swallow — pdfkit will keep the
    // previously active font, which is strictly better than a 500.
  }
  if (opts.fontSize !== undefined) doc.fontSize(opts.fontSize);
  if (opts.color !== undefined) doc.fillColor(opts.color);

  const textOpts = { ...(opts.textOptions ?? {}) };
  if (useArabicFont) {
    // Merge RTL shaping into any caller-supplied `features`. Without this
    // Arabic glyphs render in isolated (unshaped) form.
    const existing: string[] = Array.isArray(textOpts.features) ? textOpts.features : [];
    textOpts.features = Array.from(new Set([...existing, 'rtla']));
  }

  if (opts.x !== undefined && opts.y !== undefined) {
    doc.text(value, opts.x, opts.y, textOpts);
  } else {
    doc.text(value, textOpts);
  }
}
