/**
 * Generates test files for the content processing pipeline WCAG checks.
 * Run from repo root: node scripts/generate-test-files.mjs
 */

import pdfLib from '../backends/node_modules/pdf-lib/cjs/index.js';
const { PDFDocument, PDFName, PDFBool } = pdfLib;
import AdmZip from '../backends/node_modules/adm-zip/adm-zip.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../test-files');
fs.mkdirSync(OUT, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// 1. PDF that should PASS WCAG (has title, language, tagged structure)
// ─────────────────────────────────────────────────────────────────────────────
async function makePdfPass() {
  const pdf = await PDFDocument.create();
  pdf.setTitle('PhysioGuidance Test Guide');
  pdf.setAuthor('PhysioGuidance QA');
  pdf.setLanguage('en');

  // Add tagged structure (MarkInfo)
  const catalog = pdf.context.lookup(pdf.context.trailerInfo.Root);
  const markInfoDict = pdf.context.obj({
    Marked: PDFBool.True,
  });
  catalog.set(PDFName.of('MarkInfo'), markInfoDict);

  const page = pdf.addPage([595, 842]);
  page.drawText('PhysioGuidance Test Guide\n\nThis is a WCAG-compliant test PDF.\nIt has a title, language, and tagged structure.\n\nUse this file to verify the content processing pipeline.', {
    x: 50,
    y: 750,
    size: 14,
    lineHeight: 22,
  });

  const bytes = await pdf.save();
  const out = path.join(OUT, 'wcag-pass-test.pdf');
  fs.writeFileSync(out, bytes);
  console.log(`✅ Created: ${out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PDF that should FAIL WCAG (no title, no language, not tagged)
// ─────────────────────────────────────────────────────────────────────────────
async function makePdfFail() {
  const pdf = await PDFDocument.create();
  // Deliberately no title, no language, no MarkInfo

  const page = pdf.addPage([595, 842]);
  page.drawText('This PDF has no metadata.\nIt will fail WCAG checks.', {
    x: 50,
    y: 750,
    size: 12,
  });

  const bytes = await pdf.save();
  const out = path.join(OUT, 'wcag-fail-test.pdf');
  fs.writeFileSync(out, bytes);
  console.log(`❌ Created: ${out}  (should fail WCAG — no title, no language, not tagged)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DOCX that should PASS WCAG (title, language, headings)
// ─────────────────────────────────────────────────────────────────────────────
function makeDocxPass() {
  const zip = new AdmZip();

  // [Content_Types].xml
  zip.addFile('[Content_Types].xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`));

  // _rels/.rels
  zip.addFile('_rels/.rels', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`));

  // docProps/core.xml — title + language
  zip.addFile('docProps/core.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>PhysioGuidance Accessible Document</dc:title>
  <dc:creator>PhysioGuidance QA</dc:creator>
  <dc:language>en-US</dc:language>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-03-03T00:00:00Z</dcterms:created>
</cp:coreProperties>`));

  // word/_rels/document.xml.rels
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`));

  // word/document.xml — with Heading1, Heading2, and body text
  zip.addFile('word/document.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>PhysioGuidance Accessible Document</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is a test document for the PhysioGuidance content pipeline. It has proper metadata including a title, language, and heading structure.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Section 1: Overview</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This document is designed to pass WCAG accessibility checks. It includes multiple heading levels for proper document structure.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Section 2: Pipeline Test</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Upload this file to verify that the WCAG processor correctly identifies headings, title, and language metadata.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`));

  const out = path.join(OUT, 'wcag-pass-test.docx');
  zip.writeZip(out);
  console.log(`✅ Created: ${out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOCX that should WARN (has title but no headings)
// ─────────────────────────────────────────────────────────────────────────────
function makeDocxWarn() {
  const zip = new AdmZip();

  zip.addFile('[Content_Types].xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`));

  zip.addFile('_rels/.rels', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`));

  // Has title but no language
  zip.addFile('docProps/core.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Partial Metadata Document</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-03-03T00:00:00Z</dcterms:created>
</cp:coreProperties>`));

  zip.addFile('word/_rels/document.xml.rels', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`));

  // No headings — plain paragraphs only
  zip.addFile('word/document.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>This document has a title but no language set and no headings.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>It should trigger a WCAG warning because it is missing the language attribute and structural headings.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`));

  const out = path.join(OUT, 'wcag-warn-test.docx');
  zip.writeZip(out);
  console.log(`⚠️  Created: ${out}  (should warn — no language, no headings)`);
}

// Run all
(async () => {
  await makePdfPass();
  await makePdfFail();
  makeDocxPass();
  makeDocxWarn();
  console.log(`\nAll test files written to: ${OUT}`);
  console.log('\nExpected WCAG outcomes:');
  console.log('  wcag-pass-test.pdf   → PASS  (title ✓, language ✓, tagged ✓)');
  console.log('  wcag-fail-test.pdf   → FAIL  (no title, no language, not tagged)');
  console.log('  wcag-pass-test.docx  → PASS  (title ✓, language ✓, headings ✓)');
  console.log('  wcag-warn-test.docx  → WARN  (title ✓, no language, no headings)');
})();
