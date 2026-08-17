# §4c — Design Assets

**Status: Delivered (source-link + expected zip).**

## Figma design source

The full Figma design file for the platform:

**https://www.figma.com/design/KRCkhoyaFhmEKUnz3vOOqo/physioguidance.org-FInal?m=auto&t=S1RCi7BKeY01i1Rp-6**

File name in Figma: **physioguidance.org FInal**

Access is via Figma's own share link + platform-owner login. Anyone with access to the PhysioGuidance Figma workspace can open it.

To export the .fig source for a truly local copy, open the file in Figma → File menu → "Save local copy" (creates a `.fig` file). Save that alongside this README once done for a fully offline handover.

## Production images / logos / icons zip

A zip of the platform's public `frontend/public/` folder (logos, icons, illustrations, brand imagery used in production) is being provided separately by the client and will be dropped into this folder as `physioguidance-public-assets.zip` on arrival.

Coverage expected in the zip:
- Site logo (SVG + PNG variants)
- NELC logo
- Payment method icons (Moyasar, Tabby, Tamara, Bank Transfer)
- Course category illustrations
- Marketing hero images
- Certificate logo used in the PDF renderer

## What is already in the code repo

The exports currently used by the running platform are checked into git under `frontend/public/`:

- `frontend/public/images/logo.png` — the platform logo (used in every handover PDF cover)
- `frontend/public/nelc-logo.png` — NELC logo
- Icons from `lucide-react` (imported via npm, no local source needed)
- Certificate PDF renderer uses Cairo + Amiri open-source fonts, drawn via PDFKit — no design source file exists for it (the "design" is in code at [backends/src/modules/certificates/certificates.service.ts](https://github.com/physioguidance1-arch/physioguidance/blob/main/backends/src/modules/certificates/certificates.service.ts))
- Email templates are HTML editable at admin dashboard `/dashboard/admin/templates` — no separate design source

## Cross-refs

- Full inventory of what the platform renders visually is in [../../05-user-guides/admin-guide.pdf](../../05-user-guides/admin-guide.pdf) §16 (Templates) and §12 (Certificates).
- Cover page of every handover PDF uses the exact logo file that ships in production.
