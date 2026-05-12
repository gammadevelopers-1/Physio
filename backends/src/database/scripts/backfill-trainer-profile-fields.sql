-- ===================================================================
-- Backfill trainer profile fields from role_requests.profile_data
-- ===================================================================
-- Fixes trainers approved BEFORE the role-request patch logic was
-- added (commit that copies profile_data → users on approval).
--
-- Idempotent: only writes when the user's column is NULL or empty.
-- Picks the MOST RECENT approved role_request per user (DISTINCT ON).
-- Treats empty string as NULL for both sides — empty profile_data
-- values don't overwrite, and empty user values are treated as missing.
-- ===================================================================

WITH latest_approved AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    profile_data
  FROM role_requests
  WHERE status = 'APPROVED'
  ORDER BY user_id, reviewed_at DESC NULLS LAST, created_at DESC
)
UPDATE users u
SET
  profession = COALESCE(NULLIF(u.profession, ''), NULLIF(la.profile_data->>'profession', '')),
  specialty = COALESCE(NULLIF(u.specialty, ''), NULLIF(la.profile_data->>'specialty', '')),
  qualification = COALESCE(NULLIF(u.qualification, ''), NULLIF(la.profile_data->>'qualification', '')),
  twitter = COALESCE(NULLIF(u.twitter, ''), NULLIF(la.profile_data->>'twitter', '')),
  linkedin = COALESCE(
    NULLIF(u.linkedin, ''),
    NULLIF(la.profile_data->>'linkedIn', ''),
    NULLIF(la.profile_data->>'linkedin', '')
  ),
  first_name_ar = COALESCE(NULLIF(u.first_name_ar, ''), NULLIF(la.profile_data->>'firstNameAr', '')),
  last_name_ar = COALESCE(NULLIF(u.last_name_ar, ''), NULLIF(la.profile_data->>'lastNameAr', '')),
  updated_at = NOW()
FROM latest_approved la
WHERE la.user_id = u.id
  AND (
    (u.profession IS NULL OR u.profession = '')
    OR (u.specialty IS NULL OR u.specialty = '')
    OR (u.qualification IS NULL OR u.qualification = '')
    OR (u.twitter IS NULL OR u.twitter = '')
    OR (u.linkedin IS NULL OR u.linkedin = '')
    OR (u.first_name_ar IS NULL OR u.first_name_ar = '')
    OR (u.last_name_ar IS NULL OR u.last_name_ar = '')
  );
