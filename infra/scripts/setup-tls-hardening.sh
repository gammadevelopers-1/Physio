#!/bin/bash

# ===========================================
# TLS / Edge Hardening Setup Script
# ===========================================
# Hardens the EXTERNAL HTTPS load balancer that fronts the platform
# (physioguidance.org / www / api / cms). Addresses the external scan
# findings (SSL Labs, ImmuniWeb) that live at the edge, NOT in app code:
#
#   1. SSL policy (RESTRICTED, min TLS 1.2) attached to the HTTPS proxy:
#        - disables TLS 1.0 / TLS 1.1
#        - removes weak / non-compliant ciphers (TLS_RSA, CBC, 3DES)
#          -> clears the "Marvin attack" + PCI/NIST cipher findings
#        - SSL Labs: B -> A/A+
#
#   2. HTTP -> HTTPS 301 redirect at the LB:
#        - the HTTP proxy currently SERVES the site over plain HTTP.
#          This points it at a redirect-only url-map so every HTTP hit
#          is 301'd to HTTPS (path + query preserved).
#        - clears the "no HTTPS redirection" finding (Hardenize / Mozilla)
#
# These are EDGE config changes (no app deploy). Re-runnable (idempotent).
#
# Resources (discovered via `gcloud compute ... list`):
#   target-https-proxy : physioguidance-https-proxy   (global)
#   target-http-proxy  : physioguidance-web-http-proxy (global)
#   content url-map    : physioguidance-web-urlmap
#
# Requires the active account to have compute load-balancer admin rights
# (roles/compute.loadBalancerAdmin or compute.securityAdmin / editor).
#
# Usage:
#   ./setup-tls-hardening.sh
# ===========================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

SSL_POLICY="${SSL_POLICY:-physioguidance-ssl-policy}"
SSL_PROFILE="${SSL_PROFILE:-RESTRICTED}"
MIN_TLS="${MIN_TLS:-1.2}"
HTTPS_PROXY="${HTTPS_PROXY:-physioguidance-https-proxy}"
HTTP_PROXY="${HTTP_PROXY:-physioguidance-web-http-proxy}"
REDIRECT_URLMAP="${REDIRECT_URLMAP:-physioguidance-web-redirect}"

print_banner
log_info "SSL policy:      ${SSL_POLICY} (${SSL_PROFILE}, min TLS ${MIN_TLS})"
log_info "HTTPS proxy:     ${HTTPS_PROXY}"
log_info "HTTP  proxy:     ${HTTP_PROXY}"
log_info "Redirect urlmap: ${REDIRECT_URLMAP}"
echo ""

check_command gcloud
check_gcp_auth
gcloud config set project ${GCP_PROJECT_ID} --quiet

# -------------------------------------------------------------------
# Step 1: SSL policy — disable TLS 1.0/1.1 + weak ciphers
# -------------------------------------------------------------------
log_step "Creating SSL policy ${SSL_POLICY}..."
gcloud compute ssl-policies create ${SSL_POLICY} \
    --profile=${SSL_PROFILE} \
    --min-tls-version=${MIN_TLS} \
    --global \
    2>/dev/null || log_warning "SSL policy already exists — updating instead"

# Ensure the profile/min-version are correct even if it already existed.
gcloud compute ssl-policies update ${SSL_POLICY} \
    --profile=${SSL_PROFILE} \
    --min-tls-version=${MIN_TLS} \
    --global \
    || log_warning "Could not update SSL policy (check permissions)"

log_step "Attaching SSL policy to ${HTTPS_PROXY}..."
gcloud compute target-https-proxies update ${HTTPS_PROXY} \
    --ssl-policy=${SSL_POLICY} \
    --global \
    || log_error "Failed to attach SSL policy to ${HTTPS_PROXY}"

log_success "SSL policy applied — TLS 1.0/1.1 + weak ciphers disabled"

# -------------------------------------------------------------------
# Step 2: HTTP -> HTTPS redirect
# -------------------------------------------------------------------
log_step "Creating redirect url-map ${REDIRECT_URLMAP}..."

REDIRECT_YAML="$(mktemp)"
cat > "${REDIRECT_YAML}" <<EOF
name: ${REDIRECT_URLMAP}
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  stripQuery: false
EOF

if gcloud compute url-maps describe ${REDIRECT_URLMAP} --global &>/dev/null; then
    log_warning "Redirect url-map exists — importing latest definition"
fi
gcloud compute url-maps import ${REDIRECT_URLMAP} \
    --global \
    --source="${REDIRECT_YAML}" \
    --quiet \
    || log_error "Failed to import redirect url-map"
rm -f "${REDIRECT_YAML}"

log_step "Pointing ${HTTP_PROXY} at the redirect url-map..."
gcloud compute target-http-proxies update ${HTTP_PROXY} \
    --url-map=${REDIRECT_URLMAP} \
    --global \
    || log_error "Failed to repoint HTTP proxy"

log_success "HTTP -> HTTPS 301 redirect active"

# -------------------------------------------------------------------
# Verification
# -------------------------------------------------------------------
echo ""
log_success "==========================================="
log_success "Edge hardening complete"
log_success "==========================================="
echo ""
log_info "Verify (allow ~1-2 min to propagate):"
echo "  gcloud compute target-https-proxies describe ${HTTPS_PROXY} --global --format='value(sslPolicy)'"
echo "  curl -sI http://physioguidance.org | grep -i location   # expect 301 -> https"
echo "  # then re-run SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=www.physioguidance.org"
echo ""
