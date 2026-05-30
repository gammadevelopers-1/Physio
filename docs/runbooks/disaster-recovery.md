# Disaster Recovery Runbook

**Scope:** Rare cases where the live database is corrupted, lost, or compromised and we need to restore the entire instance — not just recover a few rows.

For everything else, **use the admin Backups tab in the dashboard** — it already covers:

| Need | Where to do it |
|---|---|
| Bring back a course material deleted in the last 90 days | Admin → Settings → Backups → **Recently deleted course materials** |
| Bring back any file deleted in the last 90 days (videos, images, captions, CMS uploads) | Admin → Settings → Backups → **Recently deleted files** |
| Roll the website back to a previous deployed version | Admin → Settings → Backups → **Website versions** |
| Inspect old data to recover specific rows | Admin → Settings → Backups → **Restore sandboxes** (Phase 2D) |
| Download a recent SQL backup to keep offline | Admin → Settings → Backups → **Backup history → Download** |

This runbook only applies when those tools cannot help — e.g. the entire Cloud SQL instance is unreachable or the live database has been wiped.

---

## What you need before starting

- GCP project access (`nelc-elearning-platform-479319`) as a user with `roles/cloudsql.admin`, `roles/storage.objectAdmin` on `gs://physioguidance-backups`, and `roles/run.developer`.
- `gcloud` CLI installed and authenticated (`gcloud auth login`, `gcloud config set project nelc-elearning-platform-479319`).
- 30–60 minutes of focused time. Restores are not fast.

---

## Option A — Restore to the existing instance from a Cloud SQL backup run

Use this when the data is corrupted but the instance is still healthy. Cloud SQL keeps **7 days of point-in-time recovery (PITR)** + **automated daily backups**.

1. **List available backup runs**
   ```bash
   gcloud sql backups list --instance=physioguidance-db
   ```
   Note the `ID` and `WINDOW_START_TIME` of the backup you want.

2. **Trigger the restore** (this **overwrites** the current `physioguidance` DB)
   ```bash
   gcloud sql backups restore <BACKUP_ID> \
     --restore-instance=physioguidance-db
   ```
   This takes 5–15 minutes. The instance is unavailable during the restore window.

3. **Verify**
   - Connect via Cloud SQL Studio and spot-check a few tables.
   - Hit `https://physioguidance-api-gw6zn2f4sq-uc.a.run.app/api/health`.
   - Smoke test login + course list.

4. **Audit the event**
   - Note the backup ID and timestamp in `audit_logs` manually (the app cannot log this because it was offline).

---

## Option B — Restore into a fresh instance, then cut over

Use this when the existing instance is compromised, corrupted beyond a single backup restore, or you want to keep the original around for forensics.

### B.1 Create the new instance

```bash
gcloud sql instances create physioguidance-db-restored \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --root-password=<TEMP_STRONG_PASSWORD> \
  --backup \
  --enable-point-in-time-recovery \
  --network=default
```

### B.2 Pick a source and restore

**From a Cloud SQL backup run** of the original instance:
```bash
gcloud sql backups restore <BACKUP_ID> \
  --restore-instance=physioguidance-db-restored \
  --backup-instance=physioguidance-db
```

**OR from a SQL export in GCS** (created via the admin dashboard or `gcloud sql export sql`):
```bash
gcloud sql databases create physioguidance --instance=physioguidance-db-restored
gcloud sql import sql physioguidance-db-restored \
  gs://physioguidance-backups/db/physioguidance-<STAMP>.sql.gz \
  --database=physioguidance
```

### B.3 Verify the new instance

```bash
gcloud sql connect physioguidance-db-restored --user=postgres --database=physioguidance
```
Spot check the row counts of `users`, `courses`, `enrollments`, `payments`.

### B.4 Create the app user on the new instance

```sql
CREATE USER apiuser WITH PASSWORD '<SAME_PASSWORD_AS_DATABASE_URL_SECRET>';
GRANT ALL PRIVILEGES ON DATABASE physioguidance TO apiuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO apiuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO apiuser;
```

### B.5 Update the DATABASE_URL secret

```bash
# Build the new connection string
NEW_URL="postgresql://apiuser:<password>@<new-instance-public-ip>:5432/physioguidance?sslmode=require"

# Add as a new secret version
echo -n "$NEW_URL" | gcloud secrets versions add DATABASE_URL --data-file=-
```

### B.6 Redeploy Cloud Run services to pick up the new secret

```bash
bash infra/backend/deploy.sh --skip-pull --skip-build
```

This skips rebuilding (the image is unchanged) but rolls out a new revision that reads the new secret version. Verify traffic is routed to the new revision:
```bash
gcloud run services describe physioguidance-api --region=us-central1 --format='value(status.traffic)'
```

### B.7 Verify end-to-end

- Health: `curl https://physioguidance-api-gw6zn2f4sq-uc.a.run.app/api/health`
- Log in as an admin → confirm dashboard loads with real data
- Open a course → confirm content is visible
- Stripe / Zoom integrations may need re-validation depending on what data was restored

### B.8 Decommission the old instance (only after a full verification window)

**Wait at least 24h** before deleting the original. If anything broke in the new instance, you want the option to roll back the `DATABASE_URL` secret.

```bash
# When confident:
gcloud sql instances delete physioguidance-db
```

---

## Selective recovery — getting specific rows back

If only a few rows are missing and the rest of the DB is fine, **do NOT use this runbook**. Use the **Restore sandbox** feature in the admin dashboard:

1. Pick a SQL export from before the data was lost
2. Click "Restore from backup" → sandbox is ready in 2–5 minutes
3. Open Cloud SQL Studio, navigate to the sandbox database
4. Find the rows you need with a `SELECT`
5. Open a second Cloud SQL Studio tab on the live `physioguidance` database
6. Manually write the `INSERT` / `UPDATE` to put those rows back
7. Drop the sandbox (or let it auto-expire in 24h)

---

## Things NOT to do

- **Never** `DROP DATABASE physioguidance` on the live instance. There is no undo at the database level — only via the full restore procedures above.
- **Never** point the live app at a sandbox database created by Phase 2D. Sandboxes auto-drop on expiry and your app would lose its data store mid-session.
- **Never** check in real backup files, dumps, or restored exports to git. Backups are PII-heavy by design.
- **Never** restore to production from a backup you have not verified in a sandbox first — schema drift between dump and current code can corrupt live data silently.

---

## After the recovery

1. Add a brief incident note to `docs/incidents/` describing what happened and which path was taken.
2. If a backup was used that's not from the standard automated daily set, document where it came from.
3. Review whether the recovery scenario could have been prevented (e.g. by adding row-level soft delete to another table, by tightening admin permissions).
