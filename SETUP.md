# ORION — One-Time Setup Guide

After completing these steps, deploying is just `bash DEPLOY.sh` from your local machine.
Cloud Build fetches the code from GitHub — you never upload source files manually again.

---

## Step 1 — Create the GitHub repository

1. Go to https://github.com/new
2. Name the repo `orion-app`, set it to **Private** or Public, and click **Create repository**
3. On your local machine, put all the project files into a folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/jpbascur/orion-app.git
git push -u origin main
```

Your repo should contain these files at the root:
```
├── DEPLOY.sh
├── SETUP.md
├── cloudbuild.yaml
├── Dockerfile
├── main.py
├── requirements.txt
└── client/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── index.css
        ├── App.js
        └── pages/
            ├── Overview.js
            ├── useTable.js
            ├── Institutions.js
            ├── Funders.js
            ├── InstBasket.js
            └── FunderBasket.js
```

---

## Step 2 — Confirm your repo details in DEPLOY.sh

These are already filled in for you — no changes needed:

```bash
GITHUB_REPO_OWNER="jpbascur"
GITHUB_REPO_NAME="orion-app"
```

---

## Step 3 — Grant Cloud Build permission to deploy to Cloud Run

This is a one-time IAM change. Run this in your terminal (with `gcloud` logged in):

```bash
PROJECT_ID="dashboard-488117"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser"
```

---

## Step 4 — Deploy

```bash
bash DEPLOY.sh
```

Cloud Build will clone your GitHub repo, build the Docker image, push it to Container Registry, and deploy to Cloud Run. Logs stream directly in your terminal.

To deploy a new version in future, just push your changes to GitHub and run `bash DEPLOY.sh` again.

---

## Checking build history

- Console: https://console.cloud.google.com/cloud-build/builds
- CLI: `gcloud builds list --project=dashboard-488117`
