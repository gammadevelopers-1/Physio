#!/bin/bash

# ===========================================
# Secret Manager Helper Script
# ===========================================
# Manage production secrets in GCP Secret Manager
#
# Usage:
#   ./manage-secrets.sh list              - List all secrets
#   ./manage-secrets.sh get SECRET_NAME   - Get a secret value
#   ./manage-secrets.sh set SECRET_NAME   - Set a secret (prompts for value)
#   ./manage-secrets.sh delete SECRET_NAME - Delete a secret
# ===========================================

set -e

# Load config
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

# Pre-flight checks
check_command gcloud
check_gcp_auth
gcloud config set project ${GCP_PROJECT_ID} --quiet

# Enable Secret Manager
gcloud services enable secretmanager.googleapis.com 2>/dev/null

ACTION=${1:-list}
SECRET_NAME=${2:-}

case $ACTION in
    list)
        log_info "Secrets in ${GCP_PROJECT_ID}:"
        echo ""
        gcloud secrets list --format="table(name.basename(),createTime.date(),replication.automatic)"
        ;;

    get)
        if [ -z "$SECRET_NAME" ]; then
            log_error "Usage: ./manage-secrets.sh get SECRET_NAME"
            exit 1
        fi
        log_info "Getting secret: ${SECRET_NAME}"
        gcloud secrets versions access latest --secret=${SECRET_NAME}
        echo ""
        ;;

    set)
        if [ -z "$SECRET_NAME" ]; then
            log_error "Usage: ./manage-secrets.sh set SECRET_NAME"
            exit 1
        fi
        log_info "Setting secret: ${SECRET_NAME}"
        echo -n "Enter secret value: "
        read -s SECRET_VALUE
        echo ""

        # Check if secret exists
        if gcloud secrets describe ${SECRET_NAME} &>/dev/null; then
            echo -n "${SECRET_VALUE}" | gcloud secrets versions add ${SECRET_NAME} --data-file=-
            log_success "Secret updated: ${SECRET_NAME}"
        else
            echo -n "${SECRET_VALUE}" | gcloud secrets create ${SECRET_NAME} --data-file=-
            log_success "Secret created: ${SECRET_NAME}"
        fi
        ;;

    delete)
        if [ -z "$SECRET_NAME" ]; then
            log_error "Usage: ./manage-secrets.sh delete SECRET_NAME"
            exit 1
        fi
        log_warning "Deleting secret: ${SECRET_NAME}"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            gcloud secrets delete ${SECRET_NAME} --quiet
            log_success "Secret deleted: ${SECRET_NAME}"
        else
            log_info "Cancelled"
        fi
        ;;

    *)
        echo "Usage: ./manage-secrets.sh [list|get|set|delete] [SECRET_NAME]"
        exit 1
        ;;
esac
