-- Per-course VAT treatment override. Used by the finance manager's
-- Tax settings page to mark individual courses as VAT-exempt or
-- zero-rated (ZATCA reporting). 'standard' is the default and uses
-- the global VAT rate from system_settings.tax.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS vat_treatment varchar(20) NOT NULL DEFAULT 'standard';

ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_vat_treatment_check;

ALTER TABLE courses
  ADD CONSTRAINT courses_vat_treatment_check
  CHECK (vat_treatment IN ('standard', 'exempt', 'zero_rated'));
