#!/bin/bash

# ===========================================
# Backups Setup Script
# ===========================================
# Provisions everything the admin-dashboard "Backups" tab needs:
#   - a private GCS bucket for downloadable SQL exports
#   - a lifecycle rule so exports auto-delete after RETENTION_DAYS
#   - IAM so (a) the Cloud SQL instance SA can WRITE exports to the bucket
#     and (b) the API runtime SA can trigger backups/exports + read the
#     bucket to mint signed download URLs.
#
# Re-runnable (idempotent). Run once after deploying the backend.
#
# Usage:
#   ./setup-backups.sh
# ===========================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

BACKUPS_BUCKET="${BACKUPS_BUCKET:-physioguidance-backups}"
DB_INSTANCE_NAME="${DB_INSTANCE_NAME:-physioguidance-db}"
RETENTION_DAYS="${BACKUPS_RETENTION_DAYS:-30}"

print_banner
log_info "Backups bucket:  ${BACKUPS_BUCKET}"
log_info "Cloud SQL inst:  ${DB_INSTANCE_NAME}"
log_info "Retention:       ${RETENTION_DAYS} days"
echo ""

check_command gcloud
check_command gsutil
check_gcp_auth
gcloud config set project ${GCP_PROJECT_ID} --quiet

# Step 1: Create the backups bucket (private, no public access)
log_step "Ensuring backups bucket exists..."
if ! gcloud storage buckets describe "gs://${BACKUPS_BUCKET}" &>/dev/null; then
    gcloud storage buckets create "gs://${BACKUPS_BUCKET}" \
        --location=${GCP_REGION} \
        --uniform-bucket-level-access \
        --public-access-prevention
    log_success "Created bucket: ${BACKUPS_BUCKET}"
else
    log_info "Bucket already exists: ${BACKUPS_BUCKET}"
fi

# Step 2: Lifecycle — delete export objects older than RETENTION_DAYS.
# Keeps storage cost bounded; Cloud SQL's own backup retention is separate.
log_step "Applying ${RETENTION_DAYS}-day lifecycle rule..."
LIFECYCLE_FILE="$(mktemp)"
cat > "${LIFECYCLE_FILE}" <<EOF
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": ${RETENTION_DAYS} }
    }
  ]
}
EOF
gcloud storage buckets update "gs://${BACKUPS_BUCKET}" --lifecycle-file="${LIFECYCLE_FILE}"
rm -f "${LIFECYCLE_FILE}"
log_success "Lifecycle applied"

# Step 3: Grant the Cloud SQL INSTANCE service account write access to the
# bucket. Cloud SQL exports run AS the instance's service account, not the
# caller — without this the export fails with a permission error.
log_step "Granting Cloud SQL instance SA write access on the bucket..."
INSTANCE_SA=$(gcloud sql instances describe ${DB_INSTANCE_NAME} \
    --format='value(serviceAccountEmailAddress)' 2>/dev/null || echo "")
if [[ -n "${INSTANCE_SA}" ]]; then
    gcloud storage buckets add-iam-policy-binding "gs://${BACKUPS_BUCKET}" \
        --member="serviceAccount:${INSTANCE_SA}" \
        --role="roles/storage.objectAdmin" \
        --quiet
    log_success "Granted objectAdmin to instance SA: ${INSTANCE_SA}"
else
    log_warning "Could not resolve Cloud SQL instance SA — exports may fail until granted"
fi

# Step 4: Grant the API RUNTIME service account the permissions it needs to
# (a) create backup runs + trigger exports, and (b) read the bucket to mint
# signed URLs. Runtime SA = the default Compute SA (same one the API uses).
PROJECT_NUMBER=$(gcloud projects describe ${GCP_PROJECT_ID} --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

log_step "Granting Cloud SQL admin to runtime SA (backup + export ops)..."
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/cloudsql.admin" \
    --condition=None \
    --quiet &>/dev/null || log_warning "Could not bind cloudsql.admin on runtime SA"

log_step "Granting bucket read/list to runtime SA (download links)..."
gcloud storage buckets add-iam-policy-binding "gs://${BACKUPS_BUCKET}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/storage.objectViewer" \
    --quiet &>/dev/null || log_warning "Could not bind objectViewer on runtime SA"

# Signing V4 URLs from a keyless Cloud Run SA uses the IAM SignBlob API,
# which requires the SA to be able to sign as itself.
log_step "Granting token-creator on the runtime SA (signed URL minting)..."
gcloud iam service-accounts add-iam-policy-binding ${RUNTIME_SA} \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/iam.serviceAccountTokenCreator" \
    --quiet &>/dev/null || log_warning "Could not bind serviceAccountTokenCreator (signed URLs may fail)"

echo ""
log_success "==========================================="
log_success "Backups infrastructure ready."
log_success "==========================================="
echo ""
log_info "Set these env vars on the API service (infra/backend/deploy.sh):"
log_info "  BACKUPS_BUCKET=${BACKUPS_BUCKET}"
log_info "  CLOUD_SQL_INSTANCE=${DB_INSTANCE_NAME}"
log_info "  DATABASE_NAME=physioguidance"
echo ""
