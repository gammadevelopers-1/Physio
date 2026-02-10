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
echo ""
log_info "Public bucket URL: https://storage.googleapis.com/${BUCKET_PUBLIC}/"
echo ""
