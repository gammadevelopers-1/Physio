-- Platform-wide settings + notification templates.
--
-- The admin Settings page needs somewhere to persist platform config
-- that isn't appropriate for env vars (admin-editable at runtime) but
-- is too cross-cutting for any single domain table.
--
-- Shape:
--   system_settings        one row per category, value is JSONB
--   notification_templates one row per (event_key, channel, locale)
--
-- Categories used today: general, localization, auth, payments,
-- notifications, maintenance, integrations. Each row's JSONB shape is
-- documented in the backend service that reads it.

CREATE TABLE IF NOT EXISTS system_settings (
  category    VARCHAR(64) PRIMARY KEY,
  value       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL
);

-- Seed default rows. Re-running the migration won't clobber existing
-- values because we only insert when the row doesn't exist.

INSERT INTO system_settings (category, value)
VALUES ('general', '{
  "platformName": "PhysioGuidance",
  "platformNameAr": "فيزيو جايدنس",
  "contactEmail": "support@physioguidance.org",
  "supportPhone": "0555614285",
  "timezone": "Asia/Riyadh",
  "logoUrl": null,
  "faviconUrl": null
}'::jsonb)
ON CONFLICT (category) DO NOTHING;

INSERT INTO system_settings (category, value)
VALUES ('localization', '{
  "defaultLanguage": "en",
  "allowedLanguages": ["en", "ar"],
  "rtlOverride": "auto",
  "dateFormat": "DD-MM-YYYY",
  "numberSystem": "western",
  "weekStartsOn": "sunday",
  "calendarDisplay": "gregorian"
}'::jsonb)
ON CONFLICT (category) DO NOTHING;

INSERT INTO system_settings (category, value)
VALUES ('auth', '{
  "require2FA": false,
  "sessionTimeoutMinutes": 15,
  "refreshTokenDays": 7,
  "passwordMinLength": 8,
  "passwordRequireUppercase": false,
  "passwordRequireNumber": false,
  "passwordRequireSpecial": false,
  "lockoutAttempts": 5,
  "lockoutMinutes": 15
}'::jsonb)
ON CONFLICT (category) DO NOTHING;

INSERT INTO system_settings (category, value)
VALUES ('payments', '{
  "gateway": "bank_transfer",
  "testMode": true,
  "currency": "SAR",
  "moyasar": {
    "publishableKey": "",
    "secretKeyRef": null
  },
  "tap": {
    "publishableKey": "",
    "secretKeyRef": null
  },
  "tamara": {
    "merchantToken": "",
    "secretKeyRef": null
  },
  "bankTransfer": {
    "bankName": "",
    "accountHolder": "",
    "iban": "",
    "instructionsEn": "",
    "instructionsAr": ""
  },
  "webhookSecretRef": null,
  "invoiceFooterEn": "",
  "invoiceFooterAr": "",
  "autoSendReceipt": true
}'::jsonb)
ON CONFLICT (category) DO NOTHING;

INSERT INTO system_settings (category, value)
VALUES ('notifications', '{
  "channels": {
    "email": true,
    "whatsapp": true,
    "sms": false,
    "push": false
  }
}'::jsonb)
ON CONFLICT (category) DO NOTHING;

INSERT INTO system_settings (category, value)
VALUES ('maintenance', '{
  "enabled": false,
  "messageEn": "We are currently performing scheduled maintenance. The platform will be back shortly.",
  "messageAr": "نقوم حالياً بأعمال صيانة مجدولة. ستعود المنصة قريباً.",
  "scheduledStart": null,
  "scheduledEnd": null
}'::jsonb)
ON CONFLICT (category) DO NOTHING;

-- Notification templates store admin-editable message bodies for
-- the email-template-builder UI. Keyed by (event_key, channel, locale)
-- so each event can have one template per channel per language.
--
-- The existing hardcoded emails in mail.service.ts keep working
-- unchanged. New templates created via the admin UI get loaded by
-- event_key when the dispatcher looks them up; missing rows fall
-- through to the code-side defaults.

CREATE TABLE IF NOT EXISTS notification_templates (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key   VARCHAR(128) NOT NULL,
  channel     VARCHAR(32)  NOT NULL,
  locale      VARCHAR(8)   NOT NULL,
  subject     TEXT,
  body        TEXT         NOT NULL,
  enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT notification_templates_unique_key
    UNIQUE (event_key, channel, locale)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_lookup
  ON notification_templates (event_key, channel, locale)
  WHERE enabled = TRUE;
