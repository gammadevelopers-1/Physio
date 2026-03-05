/**
 * VTT/SRT parsing and serialization utilities for caption editing.
 */

export interface CaptionEntry {
  startTime: string; // "HH:MM:SS.mmm"
  endTime: string;
  text: string;
}

/**
 * Parse a WebVTT string into an array of CaptionEntry objects.
 */
export function parseVtt(vttContent: string): CaptionEntry[] {
  const entries: CaptionEntry[] = [];
  // Remove BOM and normalize line endings
  const content = vttContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    // Find the line with the timestamp
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(
        /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/,
      );
      if (match) {
        const text = lines
          .slice(i + 1)
          .join('\n')
          .trim();
        if (text) {
          entries.push({
            startTime: match[1],
            endTime: match[2],
            text,
          });
        }
        break;
      }
    }
  }

  return entries;
}

/**
 * Serialize an array of CaptionEntry objects into a WebVTT string.
 */
export function serializeVtt(entries: CaptionEntry[]): string {
  const lines = ['WEBVTT', ''];
  entries.forEach((entry, i) => {
    lines.push(String(i + 1));
    lines.push(`${entry.startTime} --> ${entry.endTime}`);
    lines.push(entry.text);
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Parse an SRT string into CaptionEntry objects.
 * SRT uses commas in timestamps: "HH:MM:SS,mmm"
 */
export function parseSrt(srtContent: string): CaptionEntry[] {
  const entries: CaptionEntry[] = [];
  const content = srtContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(
        /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/,
      );
      if (match) {
        const text = lines
          .slice(i + 1)
          .join('\n')
          .trim();
        if (text) {
          entries.push({
            startTime: match[1].replace(',', '.'),
            endTime: match[2].replace(',', '.'),
            text,
          });
        }
        break;
      }
    }
  }

  return entries;
}

/**
 * Convert SRT content to VTT format.
 */
export function srtToVtt(srtContent: string): string {
  const entries = parseSrt(srtContent);
  return serializeVtt(entries);
}
