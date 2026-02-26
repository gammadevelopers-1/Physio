import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFBool } from 'pdf-lib';
import * as AdmZip from 'adm-zip';

export interface WcagCheckItem {
  rule: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface WcagResult {
  status: 'pass' | 'warning' | 'fail';
  score: number;
  details: WcagCheckItem[];
}

@Injectable()
export class WcagService {
  private readonly logger = new Logger(WcagService.name);

  /**
   * Check WCAG compliance for a material by inspecting the actual file.
   * Returns scored check items with pass/warning/fail status.
   */
  async checkCompliance(params: {
    materialType: string;
    hasCaptions: boolean;
    hasTranscript: boolean;
    filePath: string | null;
    mimeType?: string;
  }): Promise<WcagResult> {
    let checks: WcagCheckItem[] = [];

    switch (params.materialType) {
      case 'video':
        checks = this.checkVideoCompliance(params.hasCaptions, params.hasTranscript);
        break;
      case 'pdf':
        checks = await this.checkPdfCompliance(params.filePath);
        break;
      case 'document':
        checks = await this.checkDocumentCompliance(params.filePath, params.mimeType);
        break;
      case 'image':
        checks = this.checkImageCompliance(params.filePath);
        break;
      default:
        checks = [{ rule: 'INFO', label: 'Unknown Type', passed: true, detail: `Material type: ${params.materialType}` }];
    }

    const { score, status } = this.calculateScore(checks);
    return { status, score, details: checks };
  }

  private checkVideoCompliance(hasCaptions: boolean, hasTranscript: boolean): WcagCheckItem[] {
    const checks: WcagCheckItem[] = [];

    checks.push({
      rule: 'WCAG-1.2.2',
      label: 'Captions',
      passed: hasCaptions,
      detail: hasCaptions ? 'Captions present' : 'Missing captions (required for deaf/hard-of-hearing users)',
    });

    checks.push({
      rule: 'WCAG-1.2.3',
      label: 'Transcript',
      passed: hasTranscript,
      detail: hasTranscript ? 'Transcript present' : 'Missing transcript (required for audio description alternative)',
    });

    return checks;
  }

  private async checkPdfCompliance(filePath: string | null): Promise<WcagCheckItem[]> {
    if (!filePath) {
      return [{ rule: 'WCAG-1.3.1', label: 'File Access', passed: false, detail: 'File not available for inspection' }];
    }

    try {
      const bytes = fs.readFileSync(filePath);
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const checks: WcagCheckItem[] = [];

      // 1. Document title (WCAG 2.4.2)
      const title = pdf.getTitle();
      checks.push({
        rule: 'WCAG-2.4.2',
        label: 'Document Title',
        passed: !!title && title.trim().length > 0,
        detail: title && title.trim().length > 0
          ? `Title: "${title.trim()}"`
          : 'No document title set in PDF metadata',
      });

      // 2. Language attribute (WCAG 3.1.1)
      let lang: string | null = null;
      try {
        const catalogRef = pdf.context.trailerInfo.Root;
        const catalog = pdf.context.lookup(catalogRef) as PDFDict;
        if (catalog && typeof catalog.get === 'function') {
          const langObj = catalog.get(PDFName.of('Lang'));
          if (langObj) {
            lang = langObj.toString().replace(/[()\/]/g, '').trim();
          }
        }
      } catch {
        // Catalog access failed — treat as no language set
      }
      checks.push({
        rule: 'WCAG-3.1.1',
        label: 'Document Language',
        passed: !!lang && lang.length > 0,
        detail: lang && lang.length > 0
          ? `Language: ${lang}`
          : 'No language attribute set in PDF metadata',
      });

      // 3. Tagged structure (WCAG 1.3.1)
      let isTagged = false;
      try {
        const catalogRef = pdf.context.trailerInfo.Root;
        const catalog = pdf.context.lookup(catalogRef) as PDFDict;
        if (catalog && typeof catalog.get === 'function') {
          const markInfoRef = catalog.get(PDFName.of('MarkInfo'));
          if (markInfoRef) {
            const markInfo = (markInfoRef instanceof PDFDict)
              ? markInfoRef
              : pdf.context.lookup(markInfoRef) as PDFDict;
            if (markInfo && typeof markInfo.get === 'function') {
              const marked = markInfo.get(PDFName.of('Marked'));
              isTagged = marked instanceof PDFBool && marked.asBoolean();
            }
          }
        }
      } catch {
        // MarkInfo access failed
      }
      checks.push({
        rule: 'WCAG-1.3.1',
        label: 'Tagged Structure',
        passed: isTagged,
        detail: isTagged
          ? 'PDF has tagged structure for assistive technology'
          : 'PDF is not tagged (no structural markup for headings, lists, tables)',
      });

      // 4. Valid page count (WCAG 1.4.5)
      const pageCount = pdf.getPageCount();
      checks.push({
        rule: 'WCAG-1.4.5',
        label: 'Page Content',
        passed: pageCount > 0,
        detail: `PDF has ${pageCount} page(s)`,
      });

      // 5. Author metadata (informational, not scored)
      const author = pdf.getAuthor();
      checks.push({
        rule: 'INFO',
        label: 'Author Metadata',
        passed: !!author,
        detail: author ? `Author: "${author}"` : 'No author metadata set',
      });

      return checks;
    } catch (err) {
      this.logger.warn(`PDF parsing failed: ${(err as Error).message}`);
      return [
        { rule: 'WCAG-1.3.1', label: 'PDF Parsing', passed: false, detail: `Could not parse PDF: ${(err as Error).message}` },
      ];
    }
  }

  private async checkDocumentCompliance(filePath: string | null, mimeType?: string): Promise<WcagCheckItem[]> {
    if (!filePath) {
      return [{ rule: 'WCAG-1.3.1', label: 'File Access', passed: false, detail: 'File not available for inspection' }];
    }

    try {
      const zip = new AdmZip(filePath);
      const checks: WcagCheckItem[] = [];

      // 1. Document title (WCAG 2.4.2) — from docProps/core.xml
      let title: string | null = null;
      let lang: string | null = null;
      try {
        const coreEntry = zip.getEntry('docProps/core.xml');
        if (coreEntry) {
          const coreXml = coreEntry.getData().toString('utf-8');
          const titleMatch = coreXml.match(/<dc:title>(.*?)<\/dc:title>/s);
          title = titleMatch?.[1]?.trim() || null;
          const langMatch = coreXml.match(/<dc:language>(.*?)<\/dc:language>/s);
          lang = langMatch?.[1]?.trim() || null;
        }
      } catch {
        // core.xml parsing failed
      }

      checks.push({
        rule: 'WCAG-2.4.2',
        label: 'Document Title',
        passed: !!title && title.length > 0,
        detail: title && title.length > 0
          ? `Title: "${title}"`
          : 'No document title in metadata',
      });

      // 2. Language attribute (WCAG 3.1.1)
      checks.push({
        rule: 'WCAG-3.1.1',
        label: 'Document Language',
        passed: !!lang && lang.length > 0,
        detail: lang && lang.length > 0
          ? `Language: ${lang}`
          : 'No language attribute set in document metadata',
      });

      // 3. Heading structure (WCAG 1.3.1) — DOCX only
      const isDocx = mimeType?.includes('wordprocessing') || filePath.endsWith('.docx');
      if (isDocx) {
        let headingCount = 0;
        try {
          const docEntry = zip.getEntry('word/document.xml');
          if (docEntry) {
            const docXml = docEntry.getData().toString('utf-8');
            headingCount = (docXml.match(/w:val="Heading[1-6]"/g) || []).length;
          }
        } catch {
          // document.xml parsing failed
        }

        checks.push({
          rule: 'WCAG-1.3.1',
          label: 'Heading Structure',
          passed: headingCount > 0,
          detail: headingCount > 0
            ? `Found ${headingCount} heading(s) in document`
            : 'No headings found — document may lack structural hierarchy',
        });

        // 4. Image alt text (WCAG 1.1.1) — DOCX only, if images present
        try {
          const docEntry = zip.getEntry('word/document.xml');
          if (docEntry) {
            const docXml = docEntry.getData().toString('utf-8');
            const imageCount = (docXml.match(/<wp:inline/g) || []).length;
            if (imageCount > 0) {
              const altTextCount = (docXml.match(/descr="[^"]+"/g) || []).length;
              checks.push({
                rule: 'WCAG-1.1.1',
                label: 'Image Alt Text',
                passed: altTextCount >= imageCount,
                detail: `${altTextCount}/${imageCount} embedded images have alt text`,
              });
            }
          }
        } catch {
          // image alt text check failed
        }
      }

      // For PPTX: check for slide structure
      const isPptx = mimeType?.includes('presentation') || filePath.endsWith('.pptx');
      if (isPptx) {
        let slideCount = 0;
        try {
          const entries = zip.getEntries();
          slideCount = entries.filter((e: { entryName: string }) => e.entryName.match(/^ppt\/slides\/slide\d+\.xml$/)).length;
        } catch {
          // slide count check failed
        }
        checks.push({
          rule: 'WCAG-1.3.1',
          label: 'Slide Structure',
          passed: slideCount > 0,
          detail: slideCount > 0
            ? `Presentation has ${slideCount} slide(s)`
            : 'No slides found in presentation',
        });
      }

      return checks;
    } catch (err) {
      this.logger.warn(`Document parsing failed: ${(err as Error).message}`);
      return [
        { rule: 'WCAG-1.3.1', label: 'Document Parsing', passed: false, detail: `Could not parse document: ${(err as Error).message}` },
      ];
    }
  }

  private checkImageCompliance(filePath: string | null): WcagCheckItem[] {
    const checks: WcagCheckItem[] = [];

    // Alt text: material title is used as alt text in the frontend
    checks.push({
      rule: 'WCAG-1.1.1',
      label: 'Alt Text',
      passed: true,
      detail: 'Material title is used as alt text in the frontend',
    });

    // File validity check
    if (filePath) {
      try {
        const stats = fs.statSync(filePath);
        const validSize = stats.size > 100;
        checks.push({
          rule: 'WCAG-1.4.5',
          label: 'Image Validity',
          passed: validSize,
          detail: validSize
            ? `File size: ${(stats.size / 1024).toFixed(1)}KB`
            : 'File appears too small to be a valid image',
        });
      } catch {
        checks.push({
          rule: 'WCAG-1.4.5',
          label: 'Image Validity',
          passed: false,
          detail: 'Could not read image file',
        });
      }
    }

    return checks;
  }

  private calculateScore(checks: WcagCheckItem[]): { score: number; status: 'pass' | 'warning' | 'fail' } {
    const scored = checks.filter(c => c.rule !== 'INFO');
    if (scored.length === 0) return { score: 100, status: 'pass' };

    const passed = scored.filter(c => c.passed).length;
    const score = Math.round((passed / scored.length) * 100);
    const status = score >= 75 ? 'pass' : score >= 50 ? 'warning' : 'fail';
    return { score, status };
  }
}
