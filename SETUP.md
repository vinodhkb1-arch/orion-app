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

## Step 4 — First deploy

```bash
bash DEPLOY.sh
```

Cloud Build will build the Docker image, push it to Container Registry, and deploy to Cloud Run. Logs stream directly in your terminal.

---

## Day-to-day deploying

**First time you open Cloud Shell** (one-time setup — makes Cloud Shell always open in the right place):

```bash
git clone https://github.com/jpbascur/orion-app.git
cd orion-app
echo 'cd ~/orion-app && git checkout dev 2>/dev/null' >> ~/.bashrc
```

**Every deploy after that** — checkout first, then pull, then deploy:

```bash
git checkout dev && git pull && bash DEPLOY.sh --dev
```

**To deploy main (production):**

```bash
git checkout main && git pull && bash DEPLOY.sh
```

**To switch back to dev after:**

```bash
git checkout dev
```

> **Why not `rm -rf` + `git clone` each time?**
> It doesn't help — Docker layer caching happens on Cloud Build's remote VMs, not in
> your local Cloud Shell. Recloning just wastes 30–60 seconds uploading a fresh build
> context. `git pull` updates your files in place with no subdirectory created.

---

## Checking build history

- Console: https://console.cloud.google.com/cloud-build/builds
- CLI: `gcloud builds list --project=dashboard-488117`
