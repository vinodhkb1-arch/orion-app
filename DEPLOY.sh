#!/bin/bash
set -e

# ── ORION Dashboard — Deploy from GitHub ─────────────────────────────────────
# Pulls source directly from GitHub and builds/deploys via Cloud Build.
# Nothing is uploaded from your local machine — GitHub is the source of truth.
#
# Usage:
#   bash DEPLOY.sh
#
# Prerequisites (one-time setup — see SETUP.md):
#   1. Create GitHub repo and push all project files
#   2. Connect the repo to Cloud Build in the GCP console
#   3. Grant Cloud Build SA the Cloud Run Admin + Service Account User roles
# ──────────────────────────────────────────────────────────────────────────────

PROJECT_ID="dashboard-488117"
REGION="europe-west1"
GITHUB_REPO_OWNER="jpbascur"
GITHUB_REPO_NAME="orion-app"
BRANCH="main"

gcloud config set project $PROJECT_ID

echo "=== Building and deploying from GitHub ($GITHUB_REPO_OWNER/$GITHUB_REPO_NAME @ $BRANCH) ==="
gcloud builds submit \
  --no-source \
  --config=cloudbuild.yaml \
  --substitutions=_GITHUB_REPO_OWNER=$GITHUB_REPO_OWNER,_GITHUB_REPO_NAME=$GITHUB_REPO_NAME,_BRANCH=$BRANCH \
  --project=$PROJECT_ID

echo ""
echo "🚀 Deployed URL:"
gcloud run services describe orion-app --region $REGION --format 'value(status.url)'
