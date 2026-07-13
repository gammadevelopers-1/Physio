#!/bin/bash

# ===========================================
# Production Database Migration Script
# ===========================================
# Runs migrations against Cloud SQL
#
# Usage:
#   ./migrate-production.sh
# ===========================================

set -e

# Load config (provides GCP_PROJECT_ID, GCP_REGION, DB_INSTANCE_NAME)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

# Database connection — instance name comes from config.sh
# (currently physioguidance-db-me in me-central2)
CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"

print_banner
log_info "Running production migrations..."
echo ""

# Pre-flight checks
check_command gcloud
check_gcp_auth

# Set project
gcloud config set project ${GCP_PROJECT_ID} --quiet

# Get database URL from Secret Manager
log_step "Fetching database credentials..."
DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL)

if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL secret not found. Run setup-database.sh first."
    exit 1
fi

# Start Cloud SQL Proxy
log_step "Starting Cloud SQL Proxy..."
log_info "Connection: ${CONNECTION_NAME}"

# Check if cloud-sql-proxy is installed
if ! command -v cloud-sql-proxy &> /dev/null; then
    log_warning "Cloud SQL Proxy not installed. Installing..."

    # Install based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloud-sql-proxy
    else
        curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
        chmod +x cloud-sql-proxy
        sudo mv cloud-sql-proxy /usr/local/bin/
    fi
fi

# Start proxy in background
cloud-sql-proxy --port 5433 ${CONNECTION_NAME} &
PROXY_PID=$!

# Wait for proxy to start
sleep 3

# Export for Drizzle. drizzle.config.ts prefers DATABASE_URL if set, so
# rewrite its host:port to point at the proxy on localhost:5433. Otherwise
# drizzle would try to connect to the public IP embedded in the secret,
# which the DB firewall/private-IP setup rejects.
DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's|@[^/]+|@localhost:5433|')
export DATABASE_HOST=localhost
export DATABASE_PORT=5433
export DATABASE_URL

# Run migrations
log_step "Running migrations..."
cd "${SCRIPT_DIR}/../../backends"
npm run db:migrate

# Stop proxy
log_step "Stopping Cloud SQL Proxy..."
kill $PROXY_PID 2>/dev/null || true

echo ""
log_success "==========================================="
log_success "Production migrations complete!"
log_success "==========================================="
echo ""
