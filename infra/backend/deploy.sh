#!/bin/bash

# ===========================================
# Backend Deployment Script
# ===========================================
# Deploys NestJS backend to Cloud Run

set -e

# Get script directory and load config
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

# Parse arguments
SKIP_PULL=false
SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-pull) SKIP_PULL=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        *) shift ;;
    esac
done

# Variables
IMAGE_TAG="${DOCKER_REGISTRY}/${BACKEND_SERVICE_NAME}:${TIMESTAMP}"
IMAGE_LATEST="${DOCKER_REGISTRY}/${BACKEND_SERVICE_NAME}:latest"
BACKEND_DIR="${SCRIPT_DIR}/../../backends"

print_banner
log_info "Deploying: Backend (NestJS)"
echo ""

# Pre-flight checks
check_command gcloud
check_command docker
check_docker
check_gcp_auth

# Set project
gcloud config set project ${GCP_PROJECT_ID} --quiet

# Step 1: Pull latest code
if [ "$SKIP_PULL" = false ]; then
    log_step "Pulling latest code..."
    cd "${SCRIPT_DIR}/../.."
    git pull origin main 2>/dev/null || log_warning "Git pull skipped"
fi

# Step 2: Configure Docker for GCP
log_step "Configuring Docker for GCP..."
gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev --quiet

# Step 3: Build Docker image
if [ "$SKIP_BUILD" = false ]; then
    log_step "Building Docker image..."
    cd "${BACKEND_DIR}"

    docker build \
        --platform linux/amd64 \
        -f ../infra/backend/production/Dockerfile \
        -t ${IMAGE_TAG} \
        -t ${IMAGE_LATEST} \
        .

    log_success "Image built: ${IMAGE_TAG}"
fi

# Step 4: Push to Artifact Registry
log_step "Pushing to Artifact Registry..."
docker push ${IMAGE_TAG}
docker push ${IMAGE_LATEST}
log_success "Image pushed"

# Step 5: Resolve production URLs for CORS
log_step "Resolving production URLs..."
FRONTEND_URL="${PRODUCTION_FRONTEND_URL:-$(get_service_url ${FRONTEND_SERVICE_NAME})}"
CLOUD_RUN_FRONTEND_URL="$(get_service_url ${FRONTEND_SERVICE_NAME})"
# GCP has two Cloud Run URL formats - get both
GCP_PROJECT_NUMBER=$(gcloud projects describe ${GCP_PROJECT_ID} --format='value(projectNumber)' 2>/dev/null || echo "")
CLOUD_RUN_FRONTEND_URL_NEW=""
if [ -n "$GCP_PROJECT_NUMBER" ]; then
    CLOUD_RUN_FRONTEND_URL_NEW="https://${FRONTEND_SERVICE_NAME}-${GCP_PROJECT_NUMBER}.${GCP_REGION}.run.app"
fi
if [ -z "$FRONTEND_URL" ]; then
    FRONTEND_URL="https://physioguidance-web-*.run.app"
    log_warning "Frontend URL not found, using wildcard. Update CORS_ORIGIN after first frontend deploy."
fi
log_info "CORS_ORIGIN will include: ${FRONTEND_URL}"

# Step 6: Deploy to Cloud Run
log_step "Deploying to Cloud Run..."

# Check if Cloud SQL instance exists
# DB_INSTANCE_NAME comes from infra/config.sh (currently physioguidance-db-me in me-central2)
CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"

# Common env vars for all backend deployments
# NOTE: PORT is reserved by Cloud Run (set via --port flag), do not include it here
# Use ^||^ delimiter because CORS_ORIGIN contains commas
# Include custom domains + both Cloud Run URL formats for direct access
CORS_VALUE="${FRONTEND_URL},https://www.physioguidance.org"
if [ -n "$CLOUD_RUN_FRONTEND_URL" ] && [ "$CLOUD_RUN_FRONTEND_URL" != "$FRONTEND_URL" ]; then
    CORS_VALUE="${CORS_VALUE},${CLOUD_RUN_FRONTEND_URL}"
fi
if [ -n "$CLOUD_RUN_FRONTEND_URL_NEW" ] && [ "$CLOUD_RUN_FRONTEND_URL_NEW" != "$FRONTEND_URL" ] && [ "$CLOUD_RUN_FRONTEND_URL_NEW" != "$CLOUD_RUN_FRONTEND_URL" ]; then
    CORS_VALUE="${CORS_VALUE},${CLOUD_RUN_FRONTEND_URL_NEW}"
fi
BACKEND_URL="${PRODUCTION_BACKEND_URL:-$(get_service_url ${BACKEND_SERVICE_NAME})}"
# Strapi URL — used server-side by SiteSettingsService (PDF rendering pulls
# siteName etc from Strapi single-type /site-setting). Falls back to default
# hardcoded branding if unset or unreachable so PDFs never block.
STRAPI_URL_FOR_BACKEND="${PRODUCTION_STRAPI_URL:-$(get_service_url ${STRAPI_SERVICE_NAME})}"
ENV_VARS="^||^NODE_ENV=production||CORS_ORIGIN=${CORS_VALUE}||API_PREFIX=api||LOG_LEVEL=warn||STORAGE_DRIVER=gcp||GCP_PROJECT_ID=${GCP_PROJECT_ID}||GCP_REGION=${GCP_REGION}||STORAGE_BUCKET_PUBLIC=physioguidance-public||STORAGE_BUCKET_PRIVATE=physioguidance-private||STORAGE_BUCKET_TRAINERS=physioguidance-trainers||BACKUPS_BUCKET=physioguidance-backups||CLOUD_SQL_INSTANCE=${DB_INSTANCE_NAME}||DATABASE_NAME=physioguidance||APP_URL=${BACKEND_URL}/api||FRONTEND_URL=${FRONTEND_URL}||STRAPI_URL=${STRAPI_URL_FOR_BACKEND}"

# Payment gateways: where the buyer is redirected back to after paying (Moyasar
# etc.) and where gateway webhooks are received. These MUST be public HTTPS URLs —
# a localhost default breaks the post-payment redirect and leaves payments pending.
ENV_VARS="${ENV_VARS}||PAYMENT_CALLBACK_URL=${FRONTEND_URL}/payment/callback||PAYMENT_WEBHOOK_BASE_URL=${BACKEND_URL}/api/webhooks"

# Cloud Tasks (event-driven scheduling). TasksService.enqueue() is a no-op
# when TASKS_ENABLED=false — leave it true in prod so per-row events (session
# reminders, ticket auto-close, payment cleanup, etc.) are scheduled at real
# fire time instead of polled by per-minute crons. Dispatcher SA is granted
# roles/run.invoker on the api-web service by setup-cloud-tasks.sh, and
# OidcVerifierService accepts only tokens signed for TASKS_DISPATCH_URL by
# TASKS_DISPATCHER_SA — so an attacker who guesses the URL still can't POST.
TASKS_DISPATCH_URL="${TASKS_DISPATCH_URL:-${BACKEND_URL}/api/internal/tasks/dispatch}"
TASKS_DISPATCHER_SA="${TASKS_DISPATCHER_SA:-tasks-dispatcher@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"
# TASKS_OIDC_AUDIENCE must match on BOTH sides — the producer signs the
# OIDC token with this audience, and OidcVerifierService checks tokens
# against it. Producer defaults to `new URL(dispatchUrl).origin`, so we
# set the verifier explicitly to the same value. Empty string here would
# reject every incoming task with HTTP 401.
TASKS_OIDC_AUDIENCE="${TASKS_OIDC_AUDIENCE:-${BACKEND_URL}}"
ENV_VARS="${ENV_VARS}||TASKS_ENABLED=true||TASKS_LOCATION=${GCP_REGION}||TASKS_DISPATCH_URL=${TASKS_DISPATCH_URL}||TASKS_DISPATCHER_SA=${TASKS_DISPATCHER_SA}||TASKS_OIDC_AUDIENCE=${TASKS_OIDC_AUDIENCE}"
log_info "Cloud Tasks: dispatch=${TASKS_DISPATCH_URL} sa=${TASKS_DISPATCHER_SA} audience=${TASKS_OIDC_AUDIENCE}"

# Secrets from GCP Secret Manager (required)
SECRETS="DATABASE_URL=DATABASE_URL:latest"
SECRETS="${SECRETS},JWT_SECRET=JWT_SECRET:latest"
SECRETS="${SECRETS},JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest"
# Field-level encryption key for PII (national_id, phone, scfhs_number)
# on the users table. Without this, encryptPII() falls back to plaintext
# storage — see backends/src/common/crypto.ts.
SECRETS="${SECRETS},PII_ENCRYPTION_KEY=PII_ENCRYPTION_KEY:latest"

# Google reCAPTCHA secret (verifies tokens from /auth/login + /auth/register)
if gcloud secrets describe RECAPTCHA_SECRET_KEY &>/dev/null 2>&1; then
    SECRETS="${SECRETS},RECAPTCHA_SECRET_KEY=RECAPTCHA_SECRET_KEY:latest"
    log_info "reCAPTCHA secret found - login/register protected"
else
    log_warning "RECAPTCHA_SECRET_KEY not found in Secret Manager - login/register will FAIL until set"
fi

# Email (Resend API)
if gcloud secrets describe RESEND_API_KEY &>/dev/null 2>&1; then
    SECRETS="${SECRETS},RESEND_API_KEY=RESEND_API_KEY:latest"
    log_info "Resend API key found - email will be configured"
else
    log_warning "RESEND_API_KEY secret not found - email/2FA will not work"
fi

# Mail from address
if gcloud secrets describe MAIL_FROM &>/dev/null 2>&1; then
    SECRETS="${SECRETS},MAIL_FROM=MAIL_FROM:latest"
fi

# Mail reply-to address
if gcloud secrets describe MAIL_REPLY_TO &>/dev/null 2>&1; then
    SECRETS="${SECRETS},MAIL_REPLY_TO=MAIL_REPLY_TO:latest"
    log_info "Reply-to address configured"
fi

# Sentry (backend error monitoring — SDK no-ops if DSN missing)
if gcloud secrets describe SENTRY_DSN_BACKEND &>/dev/null 2>&1; then
    SECRETS="${SECRETS},SENTRY_DSN=SENTRY_DSN_BACKEND:latest"
    log_info "Sentry backend DSN found - error tracking enabled"
else
    log_warning "SENTRY_DSN_BACKEND not in Secret Manager - Sentry SDK will no-op"
fi

# Zoom Integration
if gcloud secrets describe ZOOM_ACCOUNT_ID &>/dev/null 2>&1; then
    SECRETS="${SECRETS},ZOOM_ACCOUNT_ID=ZOOM_ACCOUNT_ID:latest"
    SECRETS="${SECRETS},ZOOM_CLIENT_ID=ZOOM_CLIENT_ID:latest"
    SECRETS="${SECRETS},ZOOM_CLIENT_SECRET=ZOOM_CLIENT_SECRET:latest"
    SECRETS="${SECRETS},ZOOM_WEBHOOK_SECRET_TOKEN=ZOOM_WEBHOOK_SECRET_TOKEN:latest"
    ENV_VARS="${ENV_VARS}||ZOOM_MOCK=false"
    log_info "Zoom credentials found - live Zoom integration enabled"
else
    ENV_VARS="${ENV_VARS}||ZOOM_MOCK=true"
    log_warning "ZOOM_ACCOUNT_ID secret not found - using mock Zoom service"
fi

# Content Processing (Redis/Memorystore)
if gcloud secrets describe REDIS_HOST &>/dev/null 2>&1; then
    SECRETS="${SECRETS},REDIS_HOST=REDIS_HOST:latest"
    ENV_VARS="${ENV_VARS}||REDIS_PORT=6378||REDIS_TLS=true||FFMPEG_ENABLED=true||AUTO_APPROVE_MATERIALS=true"
    log_info "Redis/Memorystore configured — content processing enabled"
    if gcloud secrets describe REDIS_CA_CERT &>/dev/null 2>&1; then
        SECRETS="${SECRETS},REDIS_CA_CERT=REDIS_CA_CERT:latest"
        log_info "Redis CA cert found — using verified TLS"
    fi
else
    ENV_VARS="${ENV_VARS}||FFMPEG_ENABLED=false"
    log_warning "REDIS_HOST secret not found — content processing disabled"
fi

# OpenAI (Whisper transcription)
if gcloud secrets describe OPENAI_API_KEY &>/dev/null 2>&1; then
    SECRETS="${SECRETS},OPENAI_API_KEY=OPENAI_API_KEY:latest"
    log_info "OpenAI API key found — auto-transcription enabled"
else
    log_warning "OPENAI_API_KEY secret not found — transcription disabled"
fi

# Moyasar payment gateway — attach both test + live key sets (whichever exist in
# Secret Manager). MOYASAR_MODE (env var) selects the active set at runtime.
for _MS in MOYASAR_SECRET_KEY_TEST MOYASAR_PUBLISHABLE_KEY_TEST MOYASAR_WEBHOOK_SECRET_TEST \
           MOYASAR_SECRET_KEY_LIVE MOYASAR_PUBLISHABLE_KEY_LIVE MOYASAR_WEBHOOK_SECRET_LIVE; do
    if gcloud secrets describe "$_MS" &>/dev/null 2>&1; then
        SECRETS="${SECRETS},${_MS}=${_MS}:latest"
        log_info "Moyasar secret found: $_MS"
    fi
done
# Preserve the current MOYASAR_MODE across deploys so a routine code deploy never
# silently flips prod between sandbox and live. Override: MOYASAR_MODE=live bash deploy.sh
# Toggle (no rebuild): gcloud run services update ${BACKEND_SERVICE_NAME} \
#   --region=${GCP_REGION} --update-env-vars MOYASAR_MODE=live   (or =test)
if [ -z "${MOYASAR_MODE:-}" ]; then
    MOYASAR_MODE=$(gcloud run services describe ${BACKEND_SERVICE_NAME} --region=${GCP_REGION} \
        --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null \
        | grep -A1 "name: MOYASAR_MODE\$" | grep 'value:' | head -1 | awk '{print $2}')
    MOYASAR_MODE="${MOYASAR_MODE:-test}"
fi
ENV_VARS="${ENV_VARS}||MOYASAR_MODE=${MOYASAR_MODE}"
log_info "Moyasar mode: ${MOYASAR_MODE}"

# Preserve Phase 1 + Phase 2 refactor env vars across deploys. gcloud uses
# --set-env-vars (replaces), so without this block a routine deploy would
# wipe SKIP_BULLMQ_WORKERS / EXTERNALIZED_CRONS and put the api-web
# container back to running BullMQ workers + the in-container xapi.flush
# @Cron (double execution vs api-worker + Cloud Run Jobs).
#
# Each var is optional at runtime — unset means "old behavior".
for _PRESERVE in SKIP_BULLMQ_WORKERS SKIP_CRONS EXTERNALIZED_CRONS; do
    _VAL=$(gcloud run services describe ${BACKEND_SERVICE_NAME} --region=${GCP_REGION} \
        --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null \
        | grep -A1 "name: ${_PRESERVE}\$" | grep 'value:' | head -1 | awk '{print $2}' | tr -d "'\"")
    if [ -n "${_VAL}" ]; then
        ENV_VARS="${ENV_VARS}||${_PRESERVE}=${_VAL}"
        log_info "Preserving ${_PRESERVE}=${_VAL}"
    fi
done

# Tamara BNPL — JWT API token + webhook notification token + public key.
# Sandbox URL stays default; switch to https://api.tamara.co for live.
for _TM in TAMARA_API_TOKEN TAMARA_NOTIFICATION_TOKEN TAMARA_PUBLIC_KEY; do
    if gcloud secrets describe "$_TM" &>/dev/null 2>&1; then
        SECRETS="${SECRETS},${_TM}=${_TM}:latest"
        log_info "Tamara secret found: $_TM"
    fi
done

# Reconciliation cron token — verified server-side by the cron endpoint
# (X-Cron-Token header) as a belt-and-braces check on top of OIDC. If the
# secret isn't created yet, the cron endpoints throw 401 until it is, which
# is the safe default for a security-sensitive system endpoint.
if gcloud secrets describe RECONCILIATION_CRON_TOKEN &>/dev/null 2>&1; then
    SECRETS="${SECRETS},RECONCILIATION_CRON_TOKEN=RECONCILIATION_CRON_TOKEN:latest"
    log_info "Reconciliation cron token secret found"
fi
# Tamara API URL — PRODUCTION. Override with TAMARA_API_URL=https://api-sandbox.tamara.co for sandbox.
TAMARA_API_URL="${TAMARA_API_URL:-https://api.tamara.co}"
ENV_VARS="${ENV_VARS}||TAMARA_API_URL=${TAMARA_API_URL}"
log_info "Tamara API URL: ${TAMARA_API_URL}"

# Tabby BNPL — secret key + webhook secret are sensitive; public key +
# merchant code are non-sensitive (also shipped to browser via frontend
# NEXT_PUBLIC_* vars) but kept here for backend signing of API requests.
for _TB in TABBY_SECRET_KEY TABBY_WEBHOOK_SECRET; do
    if gcloud secrets describe "$_TB" &>/dev/null 2>&1; then
        SECRETS="${SECRETS},${_TB}=${_TB}:latest"
        log_info "Tabby secret found: $_TB"
    fi
done
# Tabby non-sensitive config — public key + merchant code as env vars.
# Override per env (TABBY_MERCHANT_CODE=PHYS bash deploy.sh) for live keys.
TABBY_API_URL="${TABBY_API_URL:-https://api.tabby.ai/api/v2}"
TABBY_MERCHANT_CODE="${TABBY_MERCHANT_CODE:-PHYS}"
TABBY_PUBLIC_KEY="${TABBY_PUBLIC_KEY:-pk_test_019e2e71-0358-6bb2-e50b-73334f9ec199}"
ENV_VARS="${ENV_VARS}||TABBY_API_URL=${TABBY_API_URL}||TABBY_MERCHANT_CODE=${TABBY_MERCHANT_CODE}||TABBY_PUBLIC_KEY=${TABBY_PUBLIC_KEY}"
log_info "Tabby merchant code: ${TABBY_MERCHANT_CODE}"

# NELC LRS (xAPI integration) — Saudi National eLearning Center.
# Passwords are sensitive (NELC-issued Basic-auth credentials) → Secret
# Manager. Everything else is non-sensitive config → plain env vars.
# The deploy script overwrites env vars on each run, so this block has
# to be present here for the NELC config to survive future deploys.
#
# Two environments live side-by-side: staging + production. The active
# one is admin-toggleable (system_settings.nelc.mode); NELC_LRS_MODE is
# only the bootstrap default applied when the DB hasn't been written yet.
# Default = staging — accidental production traffic requires an explicit
# admin click in the UI.
if gcloud secrets describe NELC_LRS_PASSWORD &>/dev/null 2>&1; then
    SECRETS="${SECRETS},NELC_LRS_PASSWORD=NELC_LRS_PASSWORD:latest"
    log_info "NELC LRS staging password secret found"
else
    log_warning "NELC_LRS_PASSWORD (staging) secret not found - staging transmission will fail"
fi
if gcloud secrets describe NELC_LRS_PASSWORD_PROD &>/dev/null 2>&1; then
    SECRETS="${SECRETS},NELC_LRS_PASSWORD_PROD=NELC_LRS_PASSWORD_PROD:latest"
    log_info "NELC LRS production password secret found"
else
    log_warning "NELC_LRS_PASSWORD_PROD secret not found - admin cannot switch to production"
fi
NELC_LRS_ENABLED="${NELC_LRS_ENABLED:-true}"
NELC_LRS_MODE="${NELC_LRS_MODE:-staging}"
NELC_LRS_ENDPOINT_STAGING="${NELC_LRS_ENDPOINT_STAGING:-https://lrs.nelc.gov.sa/lrs-license-stg/xapi/statements}"
NELC_LRS_ENDPOINT_PROD="${NELC_LRS_ENDPOINT_PROD:-https://lrs.nelc.gov.sa/lrs-nelc/xapi/statements}"
NELC_LRS_USERNAME="${NELC_LRS_USERNAME:-physioguidance_org}"
NELC_PLATFORM_IDENTIFIER="${NELC_PLATFORM_IDENTIFIER:-https://physioguidance.org/}"
NELC_PLATFORM_NAME_EN="${NELC_PLATFORM_NAME_EN:-PhysioGuidance}"
NELC_PLATFORM_NAME_AR="${NELC_PLATFORM_NAME_AR:-فيزيو جايدنس}"
NELC_LMS_URL="${NELC_LMS_URL:-https://physioguidance.org}"
ENV_VARS="${ENV_VARS}||NELC_LRS_ENABLED=${NELC_LRS_ENABLED}||NELC_LRS_MODE=${NELC_LRS_MODE}||NELC_LRS_ENDPOINT_STAGING=${NELC_LRS_ENDPOINT_STAGING}||NELC_LRS_ENDPOINT_PROD=${NELC_LRS_ENDPOINT_PROD}||NELC_LRS_USERNAME=${NELC_LRS_USERNAME}||NELC_PLATFORM_IDENTIFIER=${NELC_PLATFORM_IDENTIFIER}||NELC_PLATFORM_NAME_EN=${NELC_PLATFORM_NAME_EN}||NELC_PLATFORM_NAME_AR=${NELC_PLATFORM_NAME_AR}||NELC_LMS_URL=${NELC_LMS_URL}"
log_info "NELC LRS enabled: ${NELC_LRS_ENABLED}, default mode: ${NELC_LRS_MODE} (admin can toggle from UI)"

# Sentry — non-sensitive config as env vars; API token + webhook secret
# pulled from Secret Manager only if both secrets exist. Without the API
# token the admin Error Monitoring tab renders a "not configured" panel
# rather than erroring; without the webhook secret the alert receiver
# rejects every POST (defense-in-depth in production).
SENTRY_ORG_BE="${SENTRY_ORG:-physioguidance}"
SENTRY_PROJECT_BE="${SENTRY_PROJECT:-physioguidance-web}"
SENTRY_API_HOST_BE="${SENTRY_API_HOST:-de.sentry.io}"
ENV_VARS="${ENV_VARS}||SENTRY_ORG=${SENTRY_ORG_BE}||SENTRY_PROJECT=${SENTRY_PROJECT_BE}||SENTRY_API_HOST=${SENTRY_API_HOST_BE}"
if gcloud secrets describe SENTRY_API_TOKEN &>/dev/null 2>&1; then
    SECRETS="${SECRETS},SENTRY_API_TOKEN=SENTRY_API_TOKEN:latest"
    log_info "Sentry API token found — admin Error Monitoring tab enabled"
else
    log_warning "SENTRY_API_TOKEN not in Secret Manager — admin Error Monitoring will show 'not configured'"
fi
if gcloud secrets describe SENTRY_WEBHOOK_SECRET &>/dev/null 2>&1; then
    SECRETS="${SECRETS},SENTRY_WEBHOOK_SECRET=SENTRY_WEBHOOK_SECRET:latest"
    log_info "Sentry webhook secret found — alert webhook signature-verified"
else
    log_warning "SENTRY_WEBHOOK_SECRET not in Secret Manager — alert webhook will be rejected in production"
fi
log_info "Sentry: ${SENTRY_ORG_BE}/${SENTRY_PROJECT_BE} via ${SENTRY_API_HOST_BE}"

# Per-service runtime SA (least-privilege). Roles granted in Amna's
# setup script: cloudsql.client, secretmanager.secretAccessor on the
# specific secrets bound below, storage.objectAdmin on the three
# platform buckets, cloudtrace.agent, monitoring.metricWriter.
API_RUNTIME_SA="api-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

if gcloud sql instances describe ${DB_INSTANCE_NAME} &>/dev/null; then
    log_info "Connecting to Cloud SQL: ${DB_INSTANCE_NAME}"
    gcloud run deploy ${BACKEND_SERVICE_NAME} \
        --image=${IMAGE_TAG} \
        --region=${GCP_REGION} \
        --platform=managed \
        --service-account=${API_RUNTIME_SA} \
        --port=${BACKEND_PORT} \
        --memory=${BACKEND_MEMORY} \
        --cpu=${BACKEND_CPU} \
        --cpu-throttling \
        --min-instances=${BACKEND_MIN_INSTANCES} \
        --max-instances=${BACKEND_MAX_INSTANCES} \
        --add-cloudsql-instances=${CONNECTION_NAME} \
        --vpc-connector=physio-vpc-connector-me \
        --vpc-egress=all-traffic \
        --set-env-vars="${ENV_VARS}" \
        --set-secrets="${SECRETS}" \
        --quiet
else
    log_warning "No Cloud SQL instance found. Deploying without Cloud SQL proxy."
    gcloud run deploy ${BACKEND_SERVICE_NAME} \
        --image=${IMAGE_TAG} \
        --region=${GCP_REGION} \
        --platform=managed \
        --service-account=${API_RUNTIME_SA} \
        --port=${BACKEND_PORT} \
        --memory=${BACKEND_MEMORY} \
        --cpu=${BACKEND_CPU} \
        --cpu-throttling \
        --min-instances=${BACKEND_MIN_INSTANCES} \
        --max-instances=${BACKEND_MAX_INSTANCES} \
        --vpc-connector=physio-vpc-connector-me \
        --vpc-egress=all-traffic \
        --set-env-vars="${ENV_VARS}" \
        --set-secrets="${SECRETS}" \
        --quiet
fi

# Force traffic to the just-deployed (latest) revision. Without this, if
# traffic was previously pinned to a specific named revision (e.g. by the
# admin "Rollback" button in the Backups tab, which calls update-traffic
# with an explicit revision name), the next deploy would create a new
# revision but leave traffic on the pinned old one — the new code would
# silently never serve. --to-latest makes the deploy authoritative.
log_step "Routing traffic to the new revision..."
gcloud run services update-traffic ${BACKEND_SERVICE_NAME} \
    --to-latest \
    --region=${GCP_REGION} \
    --quiet

# Get service URL
SERVICE_URL=$(gcloud run services describe ${BACKEND_SERVICE_NAME} \
    --region=${GCP_REGION} \
    --format='value(status.url)')

echo ""
log_success "==========================================="
log_success "Backend deployed successfully!"
log_success "==========================================="
echo ""
log_info "URL: ${SERVICE_URL}"
log_info "Health: ${SERVICE_URL}/api/health"
echo ""
