# System-generated document samples

Six PDFs showing exactly what the platform produces for invoices, proforma invoices, and CME certificates in both English and Arabic. **All six are rendered by the actual production PDFKit code paths** — the same functions that fire when a real student pays or a real certificate is approved.

| File | Description |
|---|---|
| `sample-invoice-en.pdf` | Final tax invoice (paid), English. Fires after Moyasar/Tabby/Tamara/Bank-transfer payment succeeds. |
| `sample-invoice-ar.pdf` | Same, Arabic (RTL layout, mirrored columns, Arabic labels + numerals option). |
| `sample-proforma-en.pdf` | Pre-payment proforma invoice, English. Bank-transfer buyers download this before submitting the actual transfer. |
| `sample-proforma-ar.pdf` | Same, Arabic. |
| `sample-certificate-en.pdf` | CME certificate of attendance, English. A4 landscape, includes CME hours badge, Saudi Health Commission accreditation logo, and a QR code linking to the public verification page. |
| `sample-certificate-ar.pdf` | Same, Arabic. |

## What is "sample" about them

The layout, fonts, colours, branding, QR code, accreditation text, VAT calculation, footer, and page structure are **identical to production output** — nothing was faked or duplicated. The only difference from a real receipt is the buyer/course/invoice-number payload:

| Field | Sample value | Production value |
|---|---|---|
| Buyer name | "Sample Student" / "طالب نموذجي" | Real student name |
| Buyer email | `sample.student@example.com` | Real email |
| National ID | `1000000008` | Real ID |
| Course titles | Include the label "(SAMPLE)" | Real course title |
| Invoice number | `INV-2026-99999` | Real per-year sequence `INV-YYYY-NNNNN` |
| Accreditation number | `SAMPLE-2026` / `CRS001-SAMPLE` | Real NELC-issued number |
| QR code target | `physioguidance.org/en/verify/PG-SAMPLE0` (returns Not Found — this is a sample ID) | Real verifiable certificate ID |
| VAT number | `312345678900003` (placeholder shown for layout) | Real ZATCA-registered VAT number |

The VAT rate (15 percent), currency (SAR), payment-status pill, gateway/method display, page dimensions (A4 portrait for invoice + proforma, A4 landscape for certificate), and every visual element are identical.

## How they were generated

Command (from repo root):

```bash
cd backends
npx ts-node src/main-samples.ts
```

Output goes to `backends/samples-output/`. The script is committed at [backends/src/main-samples.ts](https://github.com/physioguidance1-arch/physioguidance/blob/main/backends/src/main-samples.ts) — a standalone Node process that:

- Instantiates the real `InvoiceService` and `CertificatesService` classes directly (no NestJS bootstrap, no database)
- Pre-populates the tax + branding caches with current production values so the DB is not needed
- Calls the same `generatePdf()`, `generateProformaPdfFromQuote()`, and `renderCertificatePdfBuffer()` methods the production runtime calls
- Writes six PDFs to disk

The whole script is under 300 lines and is annotated with why it exists. Any developer can re-run it whenever the sample buyer/course data or the underlying PDF layout changes.
