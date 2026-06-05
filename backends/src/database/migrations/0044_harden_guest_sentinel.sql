-- Migration: Harden the guest sentinel user
--
-- Why: Migration 0040 created the sentinel `guest@system.internal` user
-- with is_active=true and a placeholder string in password_hash. The
-- placeholder is NOT a valid argon2 hash, so today an actual login
-- attempt would throw an argon2 verify error — but is_active=true is
-- still risky: if someone ever sets a real password for this row, or
-- argon2.verify behavior changes, the account becomes usable. We never
-- want this row to be loggable-into.
--
-- Fix: set is_active=false and replace the hash with a deliberately
-- invalid sentinel string. The guest ticket flow does NOT filter by
-- users.is_active, so this does not affect guest ticket creation /
-- tracking / replies — only logins.

UPDATE "users"
SET
  "is_active" = false,
  "password_hash" = '$disabled-account$do-not-use$guest-sentinel-must-not-login$'
WHERE "id" = '00000000-0000-0000-0000-000000000001'
  AND "email" = 'guest@system.internal';
