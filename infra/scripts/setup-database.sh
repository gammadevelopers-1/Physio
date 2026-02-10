#!/bin/bash

# ===========================================
# Production Database Setup Script (Cloud SQL)
# ===========================================
# Creates a Cloud SQL PostgreSQL instance
#
# Usage:
#   ./setup-database.sh
# ===========================================

set -e

# Load config
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

# Database configuration
DB_INSTANCE_NAME="physioguidance-db"
DB_VERSION="POSTGRES_15"
DB_TIER="db-f1-micro"  # Smallest tier (~$7-10/month)
DB_STORAGE="10GB"
DB_NAME="physioguidance"
DB_USER="apiuser"

print_banner
log_info "Setting up Cloud SQL PostgreSQL..."
echo ""

# Pre-flight checks
check_command gcloud
check_gcp_auth

# Set project
gcloud config set project ${GCP_PROJECT_ID} --quiet

# Enable Cloud SQL API
log_step "Enabling Cloud SQL API..."
gcloud services enable sqladmin.googleapis.com

# Check if instance exists
if gcloud sql instances describe ${DB_INSTANCE_NAME} &>/dev/null; then
    log_warning "Database instance '${DB_INSTANCE_NAME}' already exists"
else
    # Create Cloud SQL instance
    log_step "Creating Cloud SQL instance (this takes 5-10 minutes)..."
    gcloud sql instances create ${DB_INSTANCE_NAME} \
        --database-version=${DB_VERSION} \
        --tier=${DB_TIER} \
        --region=${GCP_REGION} \
        --storage-size=${DB_STORAGE} \
        --storage-type=HDD \
        --no-assign-ip \
        --enable-google-private-path

    log_success "Cloud SQL instance created"
fi

# Create database
log_step "Creating database '${DB_NAME}'..."
gcloud sql databases create ${DB_NAME} \
    --instance=${DB_INSTANCE_NAME} 2>/dev/null || log_warning "Database already exists (OK)"

# Generate secure password
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

# Create user
log_step "Creating database user '${DB_USER}'..."
gcloud sql users create ${DB_USER} \
    --instance=${DB_INSTANCE_NAME} \
    --password=${DB_PASSWORD} 2>/dev/null || log_warning "User already exists"

# Store password in Secret Manager
log_step "Storing credentials in Secret Manager..."
gcloud services enable secretmanager.googleapis.com

# Create or update secret
echo -n "${DB_PASSWORD}" | gcloud secrets create DATABASE_PASSWORD --data-file=- 2>/dev/null || \
echo -n "${DB_PASSWORD}" | gcloud secrets versions add DATABASE_PASSWORD --data-file=-

# Create DATABASE_URL secret
CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"
DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo -n "${DB_URL}" | gcloud secrets create DATABASE_URL --data-file=- 2>/dev/null || \
echo -n "${DB_URL}" | gcloud secrets versions add DATABASE_URL --data-file=-

echo ""
log_success "==========================================="
log_success "Database setup complete!"
log_success "==========================================="
echo ""
log_info "Instance:   ${DB_INSTANCE_NAME}"
log_info "Database:   ${DB_NAME}"
log_info "User:       ${DB_USER}"
log_info "Connection: ${CONNECTION_NAME}"
echo ""
log_warning "Password stored in Secret Manager (DATABASE_PASSWORD)"
log_warning "Connection URL stored in Secret Manager (DATABASE_URL)"
echo ""
log_info "To connect Cloud Run to this database, the deploy scripts"
log_info "will automatically configure the connection."
echo ""
