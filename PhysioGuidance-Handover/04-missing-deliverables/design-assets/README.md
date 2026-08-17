# §4c — Design Assets

**Status: Requires Client Action.**

Design source files (Figma projects, editable logos, icons, illustrations, certificate design source, email template design source) were not held in the code repository. This folder is the placeholder for them.

## What Amna asked for

- Figma files / projects
- Logos (editable source, not just the exported PNG in `frontend/public/`)
- Icons
- Illustrations
- Certificate source designs
- Email-template design assets
- Course / site graphics
- Editable design source files

## What we already have in the code

- Exported logo PNG: `frontend/public/images/logo.png` (used across the platform + all handover PDFs)
- NELC logo PNG: `frontend/public/nelc-logo.png`
- Certificate PDF renderer (`backends/src/modules/certificates/certificates.service.ts`) uses hard-coded Cairo + Amiri fonts, a static QR code, and PDFKit vector drawing — there is no design source file for it; the "design" is code.
- Email templates: source in `backends/src/modules/email/templates/*.html` and admin-editable at `/dashboard/admin/templates`. There is no separate design source file — the templates are HTML directly.

## What is still pending

Please provide (or tell Ghulam where to find):
- Figma workspace / project link and access
- Any illustrator or affinity source files created during design
- Any brand-book / style-guide PDF

Once these arrive, Ghulam will add them to this folder and mark §4c Completed in the master README.
