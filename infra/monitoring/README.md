# Cloud Logging Alerts

Security & reliability alerts on the production GCP project.

## What's deployed

| Alert | Trigger | Source metric |
|---|---|---|
| Failed login burst | >30 × 401 on `/api/auth/login` in 5 min | `logging.googleapis.com/user/auth_login_401_count` |
| Backend 5xx spike | >20 × 5xx responses in 5 min | `logging.googleapis.com/user/backend_5xx_count` |
| Suspicious 403 burst | >50 × 403 responses in 5 min | `logging.googleapis.com/user/backend_403_count` |

All three deliver to two email channels:
- `ghulam@physioguidance.org` (dev)
- `nelc.platform@gmail.com` (Amna / PM)

Thresholds are conservative — single users typo passwords a few times, occasional 5xx from cold starts is normal. Tune downward if real attacks slip through.

## Re-applying

If a policy gets deleted, edit the JSON and recreate:

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=infra/monitoring/alert-failed-login-burst.json
```

The notification channel IDs are baked into the JSON. To recreate channels:

```bash
gcloud beta monitoring channels create \
  --display-name="Ghulam (dev)" \
  --type=email \
  --channel-labels=email_address=ghulam@physioguidance.org
```

Then update the `notificationChannels` arrays in each policy JSON with the new channel resource names.

## Re-creating the log-based metrics

If a metric gets deleted, the alert silently stops firing. Recreate with:

```bash
gcloud logging metrics create auth_login_401_count \
  --description="Failed logins (401 on /api/auth/login)" \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="physioguidance-api" AND httpRequest.requestUrl=~"/api/auth/login" AND httpRequest.status=401'

gcloud logging metrics create backend_5xx_count \
  --description="Backend 5xx responses (any /api/*)" \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="physioguidance-api" AND httpRequest.status>=500 AND httpRequest.status<=599'

gcloud logging metrics create backend_403_count \
  --description="Backend 403 forbidden (CSRF / unauthorized probes)" \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="physioguidance-api" AND httpRequest.status=403'
```
