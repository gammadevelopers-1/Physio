# Privacy Notice Draft — Review & Next Steps

Two content drafts covering PDPL Articles 4, 12, 14, 18, 20, 29.

- `privacy-notice-EN.md` — English version, 11 sections
- `privacy-notice-AR.md` — Arabic version, 11 sections

## Important context before publishing

### 1. The existing Strapi `/privacy` page is misnamed

Right now, `/privacy` is a **single-type** in Strapi titled "Learning Policies"
in English (or "سياسة الخصوصية" in Arabic — the AR title says "privacy" but
the sections are attendance / refunds / academic integrity, not data protection).

### 2. Recommended action

Move the current "Learning Policies" content to a new Strapi single-type
(e.g., `learning-policies-page`) or merge it into `terms-page`. Then repopulate
the `privacy-policy-page` single-type with the actual privacy content from
these drafts. The Next.js route `/[locale]/privacy` will render whatever you
put there.

### 3. Placeholders you MUST fill in before publishing

- **Data Protection Coordinator name / contact** — currently `[To be named by the platform operator]`. Fill with Amna's name (or whoever owns the DPO role) + email.
- **privacy@physioguidance.org email** — confirm this alias exists, or replace with the actual contact email.
- **Company legal entity name** — the drafts say "PhysioGuidance"; if there's a formal LLC / CR-registered entity name, use that instead.

### 4. Legal review

These drafts are a solid **starting point** for PDPL compliance but are NOT a
substitute for legal review. Recommendation: have a Saudi lawyer familiar with
the SDAIA guidance review both language versions before you claim PDPL
compliance publicly.

### 5. What's covered (PDPL mapping)

| PDPL Article | Section in Draft |
|---|---|
| Art. 4 — Right to be informed | Whole notice |
| Art. 6 — Explicit consent | Section 3 + separate consent tracking already in code |
| Art. 9 — Data minimisation | Section 2 (explicit fields) |
| Art. 12 — Right of access | Section 6 |
| Art. 14 — Right of rectification | Section 6 |
| Art. 15 — Right of erasure | Section 6 + Section 5 (retention exceptions) |
| Art. 18 — Data retention | Section 5 |
| Art. 20 — Breach notification | Section 7 |
| Art. 29 — Cross-border transfers | Section 4.2 |

### 6. Once published

- Bump `CURRENT_PRIVACY_VERSION` in `backends/src/modules/auth/consent-versions.ts` if the version differs from `2026-08-12`
- Verify `/en/privacy` and `/ar/privacy` render correctly
- Verify the footer link works from every page

## Next steps

1. Read both drafts end-to-end.
2. Fill placeholders (Sections 1 and 10).
3. Copy each section into Strapi admin (`privacy-policy-page` single-type).
4. Save + publish both locales.
5. Verify on production.
6. (Optional) Send drafts to legal counsel for review before public claim.
