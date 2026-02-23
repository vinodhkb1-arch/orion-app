# ORION Auth Setup

## Architecture

- Users sign in with Google (identity only — no BigQuery scope needed from them)
- Queries run via the Cloud Run **service account** (your credentials)
- All BigQuery costs are billed to **BILLING_PROJECT_ID** — a dedicated project
  you create just to absorb query costs, separate from where your data lives

---

## Step 1 — Create a dedicated billing project

This project's sole purpose is to be billed for BigQuery queries.
Your data stays in `dashboard-488117` and `cwts-leiden` — this is just for billing.

```bash
gcloud projects create orion-query-billing --name="ORION Query Billing"
gcloud billing accounts list   # find your billing account ID
gcloud billing projects link orion-query-billing \
  --billing-account=XXXXXX-XXXXXX-XXXXXX
gcloud services enable bigquery.googleapis.com \
  --project=orion-query-billing
```

Then grant the Cloud Run service account permission to run jobs in this project:
```bash
# Find your Cloud Run service account
gcloud run services describe orion-app \
  --region europe-west1 \
  --format='value(spec.template.spec.serviceAccountName)'

# Grant it bigquery.jobUser on the billing project
gcloud projects add-iam-policy-binding orion-query-billing \
  --member=serviceAccount:YOUR-SERVICE-ACCOUNT@developer.gserviceaccount.com \
  --role=roles/bigquery.jobUser
```

Set `BILLING_PROJECT_ID=orion-query-billing` in your env vars.

---

## Step 2 — Create OAuth 2.0 credentials

1. Go to https://console.cloud.google.com/apis/credentials (in `dashboard-488117`)
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**, Name: `ORION Dashboard`
4. Authorized redirect URIs:
   ```
   https://YOUR-APP-URL.run.app/auth/callback
   http://localhost:8000/auth/callback   (for local dev)
   ```
5. Copy the **Client ID** and **Client Secret**

---

## Step 3 — Configure the OAuth consent screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. User Type: **External** (or Internal for a Workspace org)
3. App name: `ORION`, fill in support/developer email
4. Scopes: add `openid`, `email`, `profile` (no BigQuery scope needed)
5. Add test users while in development; publish when ready for everyone

---

## Step 4 — Set environment variables on Cloud Run

```bash
gcloud run services update orion-app \
  --region europe-west1 \
  --set-env-vars \
    OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com",\
    OAUTH_CLIENT_SECRET="your-client-secret",\
    OAUTH_REDIRECT_URI="https://YOUR-APP-URL.run.app/auth/callback",\
    BILLING_PROJECT_ID="orion-query-billing",\
    SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
```

---

## Step 5 — Grant the service account access to your datasets

The Cloud Run service account needs to read your data:

```bash
SA=YOUR-SERVICE-ACCOUNT@developer.gserviceaccount.com

bq add-iam-policy-binding \
  --member=serviceAccount:$SA \
  --role=roles/bigquery.dataViewer \
  dashboard-488117:orion_cache
```

Repeat for `cwts-leiden:openalex_2025aug` if you control that project,
or ask the project owner to grant your service account dataViewer there.

---

## Local development

```bash
cp .env.example .env   # fill in your values
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Use `http://localhost:8000/auth/callback` as the redirect URI in both
`.env` and the Google Console.
