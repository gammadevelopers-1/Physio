#!/bin/bash

# ===========================================
# Cloud Storage Setup Script
# ===========================================
# Creates GCP Cloud Storage buckets
#
# Usage:
#   ./setup-storage.sh
# ===========================================

set -e

# Load config
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

# Bucket names
BUCKET_PUBLIC="${GCP_PROJECT_ID}-public"
BUCKET_PRIVATE="${GCP_PROJECT_ID}-private"
BUCKET_TRAINERS="${GCP_PROJECT_ID}-trainers"
BUCKET_CMS="physioguidance-cms"
STRAPI_RUNTIME_SA="strapi-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

print_banner
log_info "Setting up Cloud Storage buckets..."
echo ""

# Pre-flight checks
check_command gcloud
check_command gsutil
check_gcp_auth

# Set project
gcloud config set project ${GCP_PROJECT_ID} --quiet

# Enable Cloud Storage API
log_step "Enabling Cloud Storage API..."
gcloud services enable storage.googleapis.com

# Create public bucket (for course images, blog images)
log_step "Creating public bucket: ${BUCKET_PUBLIC}"
gsutil mb -l ${GCP_REGION} gs://${BUCKET_PUBLIC} 2>/dev/null || log_warning "Bucket already exists (OK)"
gsutil iam ch allUsers:objectViewer gs://${BUCKET_PUBLIC}
log_success "Public bucket ready"

# Create private bucket (for user uploads, certificates)
log_step "Creating private bucket: ${BUCKET_PRIVATE}"
gsutil mb -l ${GCP_REGION} gs://${BUCKET_PRIVATE} 2>/dev/null || log_warning "Bucket already exists (OK)"
log_success "Private bucket ready"

# Create trainers bucket (for trainer documents)
log_step "Creating trainers bucket: ${BUCKET_TRAINERS}"
gsutil mb -l ${GCP_REGION} gs://${BUCKET_TRAINERS} 2>/dev/null || log_warning "Bucket already exists (OK)"
log_success "Trainers bucket ready"

# Create CMS bucket (Strapi Media Library backend) + grant runtime SA the required roles.
# The Strapi GCS provider does bucket.exists() on every upload, which needs
# storage.buckets.get — NOT included in storage.objectAdmin. Both roles required:
#   - storage.objectAdmin        → CRUD on objects (upload/replace/delete)
#   - storage.legacyBucketReader → bucket metadata reads (storage.buckets.get)
# Without both, uploads fail with a plain 500 (nothing visible until you tail Cloud Run logs).
log_step "Creating CMS bucket: ${BUCKET_CMS}"
gsutil mb -l ${GCP_REGION} gs://${BUCKET_CMS} 2>/dev/null || log_warning "Bucket already exists (OK)"
# Public-read so the frontend can serve media by URL
gsutil iam ch allUsers:objectViewer gs://${BUCKET_CMS}
# Enable uniform bucket-level access to match strapi-provider config (uniform=true)
gsutil uniformbucketlevelaccess set on gs://${BUCKET_CMS} 2>/dev/null || true
# Grant the Strapi runtime SA both roles it needs
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_CMS} \
    --member="serviceAccount:${STRAPI_RUNTIME_SA}" \
    --role="roles/storage.objectAdmin" \
    --quiet 2>/dev/null || log_warning "objectAdmin binding may already exist"
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_CMS} \
    --member="serviceAccount:${STRAPI_RUNTIME_SA}" \
    --role="roles/storage.legacyBucketReader" \
    --quiet 2>/dev/null || log_warning "legacyBucketReader binding may already exist"
log_success "CMS bucket ready with runtime SA permissions"

# Set CORS for all buckets
log_step "Setting CORS configuration..."
cat > /tmp/cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set /tmp/cors.json gs://${BUCKET_PUBLIC}
gsutil cors set /tmp/cors.json gs://${BUCKET_PRIVATE}
gsutil cors set /tmp/cors.json gs://${BUCKET_TRAINERS}
gsutil cors set /tmp/cors.json gs://${BUCKET_CMS}
rm /tmp/cors.json

log_success "CORS configured"

# Store bucket names in Secret Manager
log_step "Storing bucket names in Secret Manager..."
echo -n "${BUCKET_PUBLIC}" | gcloud secrets create STORAGE_BUCKET_PUBLIC --data-file=- 2>/dev/null || \
echo -n "${BUCKET_PUBLIC}" | gcloud secrets versions add STORAGE_BUCKET_PUBLIC --data-file=-

echo -n "${BUCKET_PRIVATE}" | gcloud secrets create STORAGE_BUCKET_PRIVATE --data-file=- 2>/dev/null || \
echo -n "${BUCKET_PRIVATE}" | gcloud secrets versions add STORAGE_BUCKET_PRIVATE --data-file=-

echo -n "${BUCKET_TRAINERS}" | gcloud secrets create STORAGE_BUCKET_TRAINERS --data-file=- 2>/dev/null || \
echo -n "${BUCKET_TRAINERS}" | gcloud secrets versions add STORAGE_BUCKET_TRAINERS --data-file=-

echo ""
log_success "==========================================="
log_success "Cloud Storage setup complete!"
log_success "==========================================="
echo ""
log_info "Buckets created:"
echo "  Public:   gs://${BUCKET_PUBLIC}"
echo "  Private:  gs://${BUCKET_PRIVATE}"
echo "  Trainers: gs://${BUCKET_TRAINERS}"
echo "  CMS:      gs://${BUCKET_CMS}"
echo ""
log_info "Public bucket URL: https://storage.googleapis.com/${BUCKET_PUBLIC}/"
echo ""
