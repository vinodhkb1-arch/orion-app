#!/bin/bash
set -e

# ── ORION Dashboard — Deploy ──────────────────────────────────────────────────
# Usage (from Cloud Shell):
#
#   First time:
#     git clone https://github.com/jpbascur/orion-app.git && cd orion-app
#
#   Every deploy after that — just pull and run, no rm needed:
#     git pull && bash DEPLOY.sh [--dev]
#
#   Or to switch branches:
#     git fetch && git checkout dev && bash DEPLOY.sh --dev
#
#   bash DEPLOY.sh        → deploy to PRODUCTION (orion-app)
#   bash DEPLOY.sh --dev  → deploy to DEV (orion-app-dev)
#
# Why not rm -rf + git clone each time?
#   It doesn't help — Docker layer caching happens on Cloud Build's remote VMs,
#   not your local Cloud Shell. Re-cloning just wastes 30–60 seconds uploading
#   a fresh build context instead of letting gcloud diff it.
# ──────────────────────────────────────────────────────────────────────────────

PROJECT_ID="dashboard-488117"
REGION="europe-west1"

# ── Parse flags ───────────────────────────────────────────────────────────────
ENV="prod"
for arg in "$@"; do
  case $arg in
    --dev) ENV="dev" ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── Resolve service name and build config per environment ─────────────────────
if [ "$ENV" = "dev" ]; then
  SERVICE_NAME="orion-app-dev"
  BUILD_CONFIG="cloudbuild.dev.yaml"
  echo "🔧 Deploying to DEV environment ($SERVICE_NAME)"
else
  SERVICE_NAME="orion-app"
  BUILD_CONFIG="cloudbuild.yaml"
  echo "🚀 Deploying to PRODUCTION environment ($SERVICE_NAME)"
  echo ""
  read -p "Are you sure you want to deploy to production? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ── Deploy ────────────────────────────────────────────────────────────────────
gcloud config set project $PROJECT_ID

echo ""
echo "=== Building and deploying from current branch: $(git branch --show-current) ==="
gcloud builds submit . \
  --config=$BUILD_CONFIG \
  --project=$PROJECT_ID

echo ""
echo "✅ Done! Deployed URL:"
gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'
