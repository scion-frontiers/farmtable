#!/usr/bin/env bash
#
# proxy-gcloud.sh — Local forwarding proxy for the IAP-protected farmtable Cloud Run service.
#
# Uses `gcloud run services proxy` which handles IAP/IAM authentication automatically
# using the caller's local gcloud credentials.
#
# Prerequisites:
#   1. gcloud CLI installed (https://cloud.google.com/sdk/docs/install)
#   2. Authenticated with a @google.com account:
#        gcloud auth login
#      The IAP policy on this Cloud Run service grants roles/iap.httpsResourceAccessor
#      to domain:google.com, so any authenticated @google.com account will work.
#   3. No service account key or impersonation is needed — your user identity is sufficient.
#
# Usage:
#   ./proxy-gcloud.sh [PORT]
#
#   PORT defaults to 8080 if not specified.
#   Once running, access the service at http://localhost:PORT
#
# How it works:
#   `gcloud run services proxy` starts a local HTTP server that:
#   - Accepts plain HTTP requests on the local port
#   - Automatically mints an identity token using the active gcloud account
#   - Forwards each request to the Cloud Run service with the token attached
#   - Handles token refresh transparently
#
set -euo pipefail

LOCAL_PORT="${1:-8080}"

PROJECT="deploy-demo-test"
REGION="us-central1"
SERVICE="farmtable"

echo "Starting local proxy for Cloud Run service '${SERVICE}'..."
echo "Project: ${PROJECT}"
echo "Region:  ${REGION}"
echo "Local:   http://localhost:${LOCAL_PORT}"
echo ""
echo "Press Ctrl+C to stop."
echo ""

exec gcloud run services proxy "${SERVICE}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --port="${LOCAL_PORT}"
