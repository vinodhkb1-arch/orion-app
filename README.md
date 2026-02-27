# ⭐ ORION Research Dashboard

**ORION** is an open-source web dashboard for exploring research institutions and funders from the [CWTS OpenAlex](https://www.cwts.nl/blog?article=n-r2s234) dataset — without writing any SQL.

Built on [FastAPI](https://fastapi.tiangolo.com/) + React, deployed on Google Cloud Run, and powered by Google BigQuery.

> **Live demo:** [https://orion-app-kp52msbgxa-ew.a.run.app](https://orion-app-kp52msbgxa-ew.a.run.app)

---

## What it does

- **Browse** thousands of research institutions and funders, searchable by name, country, or type
- **Filter** by publication year range
- **Build baskets** of institutions or funders and run cross-queries:
  - Total works (no double counting)
  - Co-occurring institutions
  - Co-occurring funders
- **Visualise networks** — open a co-occurrence network directly in [VOSviewer Online](https://app.vosviewer.com/) with one click
- **Export SQL** — copy the underlying BigQuery query for any result to run independently
- **Export CSV** — download any result table

BigQuery query costs are billed to the **user's own GCP project**, not the host. Most users stay within BigQuery's 1 TB/month free tier.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI · Google Cloud BigQuery |
| Frontend | React SPA (Create React App) |
| Auth | Google OAuth 2.0 (identity only) · signed cookie sessions |
| Deployment | Google Cloud Run · Docker · Cloud Build |
| Data | `cwts-leiden.openalex_2025aug` (BigQuery public dataset) |

---

## Getting started

### Prerequisites

- A [Google Cloud project](https://console.cloud.google.com/projectcreate) with billing enabled
- The BigQuery API enabled on that project
- A Google OAuth 2.0 client ID configured for your domain (see [SETUP_AUTH.md](SETUP_AUTH.md))
- Docker (for local development) or access to Google Cloud Shell (for deployment)

### Running locally

```bash
# 1. Clone the repo
git clone https://github.com/jpbascur/orion-app.git
cd orion-app

# 2. Set up environment variables
cp .env.example .env
# Edit .env and fill in your OAuth credentials and a SESSION_SECRET

# 3. Build the React frontend
cd client && npm install && npm run build && cd ..

# 4. Run the backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Then open [http://localhost:8000](http://localhost:8000).

For a full local development guide, see [DEV_SETUP.md](DEV_SETUP.md).

### Deploying to Google Cloud Run

```bash
# Production
bash DEPLOY.sh

# Dev/staging environment
bash DEPLOY.sh --dev
```

See [SETUP.md](SETUP.md) for first-time deployment instructions.

---

## Project structure

```
orion-app/
├── main.py                  # FastAPI backend — all API endpoints
├── requirements.txt
├── Dockerfile
├── DEPLOY.sh                # Cloud Run deployment script
├── cloudbuild.yaml          # Cloud Build config (production)
├── cloudbuild.dev.yaml      # Cloud Build config (dev)
├── client/
│   ├── public/
│   └── src/
│       ├── App.js           # Root component, routing, shared state
│       ├── api.js           # Fetch wrapper, CSV export, VOSviewer helper
│       ├── bytesInfo.js     # BytesTag component (data usage display)
│       └── pages/
│           ├── Institutions.js
│           ├── Funders.js
│           ├── InstBasket.js
│           ├── FunderBasket.js
│           ├── BasketPage.js    # Shared basket logic
│           ├── EntityList.js    # Shared browse/search logic
│           ├── BasketShared.js  # Shared components + SQL query builders
│           ├── Overview.js
│           ├── Guide.js
│           ├── LoginGate.js
│           └── ErrorPage.js
├── SETUP.md
├── SETUP_AUTH.md
├── DEV_SETUP.md
├── CHANGELOG.md
└── LICENSE
```

---

## Data

ORION queries the **CWTS OpenAlex 2025 August snapshot**, a processed and enriched version of [OpenAlex](https://openalex.org/) data made available as a public BigQuery dataset by [CWTS Leiden](https://www.cwts.nl/) as part of the [ORION (Open Research Information on BigQuery)](https://orion-dbs.community) initiative.

- Dataset: `cwts-leiden.openalex_2025aug`
- Institution–work links: via `work_affiliation_institution` (authorship-level affiliation)
- Funder–work links: via `work_grant` (funding acknowledgement-level)

> **Note on coverage:** Funder–work links are derived from funding acknowledgements in PDFs and metadata feeds. Coverage is uneven, particularly for older publications.

---

## Acknowledgements

ORION Research Dashboard builds on the work of several open research infrastructure projects:

- **[ORION — Open Research Information on BigQuery](https://orion-dbs.community)** — the initiative that makes the CWTS OpenAlex dataset available as a public BigQuery dataset, making tools like this possible.

- **[CWTS Leiden Ranking](https://www.leidenranking.com/)** / **[CWTS](https://www.cwts.nl/)** at Leiden University — for producing and maintaining the OpenAlex dataset snapshot used by this dashboard.

- **[OpenAlex](https://openalex.org/)** — the open catalogue of the global research system, maintained by OurResearch. OpenAlex data is released under a [CC0 licence](https://creativecommons.org/publicdomain/zero/1.0/).

- **[VOSviewer](https://www.vosviewer.com/) / [VOSviewer Online](https://app.vosviewer.com/)** — developed by Nees Jan van Eck and Ludo Waltman at CWTS, Leiden University. Used here for co-occurrence network visualisation.

---

## Contributing

Contributions, issues and feature requests are welcome. Please open an issue on GitHub before submitting a pull request.

---

## License

[MIT](LICENSE) © 2025 Juan Pablo Bascur Cifuentes

---

## Contact

Juan Pablo Bascur Cifuentes — [juanpablobascurcifuentes@gmail.com](mailto:juanpablobascurcifuentes@gmail.com)

GitHub: [github.com/jpbascur/orion-app](https://github.com/jpbascur/orion-app)
