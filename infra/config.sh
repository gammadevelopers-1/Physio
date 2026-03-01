#!/bin/bash

# ===========================================
# PhysioGuidance - Shared Infrastructure Config
# ===========================================
# This file is sourced by all deployment scripts
# Update these values for your environment

# GCP Configuration
export GCP_PROJECT_ID="${GCP_PROJECT_ID:-nelc-elearning-platform-479319}"
export GCP_REGION="${GCP_REGION:-us-central1}"
export GCP_ARTIFACT_REPO="physioguidance"

# Frontend Configuration
export FRONTEND_SERVICE_NAME="physioguidance-web"
export FRONTEND_PORT=3000
export FRONTEND_MEMORY="512Mi"
export FRONTEND_CPU="1"
export FRONTEND_MIN_INSTANCES=0
export FRONTEND_MAX_INSTANCES=3

# Backend Configuration
export BACKEND_SERVICE_NAME="physioguidance-api"
export BACKEND_PORT=8080
export BACKEND_MEMORY="256Mi"
export BACKEND_CPU="1"
export BACKEND_MIN_INSTANCES=0
export BACKEND_MAX_INSTANCES=3

# Strapi CMS Configuration
export STRAPI_SERVICE_NAME="physioguidance-cms"
export STRAPI_PORT=1337
export STRAPI_MEMORY="512Mi"
export STRAPI_CPU="1"
export STRAPI_MIN_INSTANCES=0
export STRAPI_MAX_INSTANCES=2

# Cloud SQL Configuration
export DB_INSTANCE_NAME="physioguidance-db"
export DB_TIER="db-f1-micro"
export DB_VERSION="POSTGRES_15"

# ===========================================
# Production URLs (custom domain via GCP Load Balancer)
# ===========================================
# SSL is active for api/cms/www subdomains.
# Override with env vars if needed.
export PRODUCTION_FRONTEND_URL="${PRODUCTION_FRONTEND_URL:-https://physioguidance.org}"
export PRODUCTION_BACKEND_URL="${PRODUCTION_BACKEND_URL:-https://api.physioguidance.org}"
export PRODUCTION_STRAPI_URL="${PRODUCTION_STRAPI_URL:-https://cms.physioguidance.org}"

# Derived values (don't modify)
export DOCKER_REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPO}"
export TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Helper: get Cloud Run service URL
get_service_url() {
    local service_name=$1
    gcloud run services describe ${service_name} \
        --region=${GCP_REGION} \
        --format='value(status.url)' 2>/dev/null || echo ""
}

# ===========================================
# Helper Functions
# ===========================================

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is not installed"
        exit 1
    fi
}

# Check if Docker is running
check_docker() {
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Check if authenticated with GCP
check_gcp_auth() {
    if ! gcloud auth print-access-token &> /dev/null; then
        log_error "Not authenticated with GCP. Run: gcloud auth login"
        exit 1
    fi
}

# Print deployment banner
print_banner() {
    echo ""
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${CYAN}  PhysioGuidance Deployment${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo -e "  Project:  ${GCP_PROJECT_ID}"
    echo -e "  Region:   ${GCP_REGION}"
    echo -e "${CYAN}==========================================${NC}"
    echo ""
}
