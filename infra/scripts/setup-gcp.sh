#!/bin/bash

# ===========================================
# GCP Project Setup Script
# ===========================================
# Run this ONCE to set up all GCP resources

set -e

# Get script directory and load config
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

print_banner
log_info "Setting up GCP project..."
echo ""

# Pre-flight checks
check_command gcloud
check_gcp_auth

# Set project
log_step "Setting project to ${GCP_PROJECT_ID}..."
gcloud config set project ${GCP_PROJECT_ID}

# Enable APIs
log_step "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com

log_success "APIs enabled"

# Create Artifact Registry repository
log_step "Creating Artifact Registry repository..."
gcloud artifacts repositories create ${GCP_ARTIFACT_REPO} \
    --repository-format=docker \
    --location=${GCP_REGION} \
    --description="PhysioGuidance Docker images" \
    2>/dev/null || log_warning "Repository already exists (OK)"

log_success "Artifact Registry ready"

# Configure Docker
log_step "Configuring Docker for GCP..."
gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev --quiet

log_success "Docker configured"

echo ""
log_success "==========================================="
log_success "GCP setup complete!"
log_success "==========================================="
echo ""
log_info "You can now deploy using:"
echo "  make deploy-frontend    # Deploy frontend"
echo "  make deploy-backend     # Deploy backend"
echo "  make deploy-all         # Deploy both"
echo ""
