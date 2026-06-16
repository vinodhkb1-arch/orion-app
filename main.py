# ORION Research Dashboard — v0.1.0
# https://github.com/jpbascur/orion-app
#
# Copyright (c) 2025 Juan Pablo Bascur Cifuentes
# Released under the MIT License — see LICENSE for details.
#
# Data: CWTS OpenAlex 2025 snapshot via the ORION initiative (https://orion-dbs.community)
# Network visualisation: VOSviewer Online (Van Eck & Waltman, CWTS Leiden)

import os
import json
import time
import hashlib
import hmac
import base64

from fastapi import FastAPI, Query, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List

import httpx

from google.cloud import bigquery
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

OAUTH_CLIENT_ID     = os.environ["OAUTH_CLIENT_ID"]
OAUTH_CLIENT_SECRET = os.environ["OAUTH_CLIENT_SECRET"]
OAUTH_REDIRECT_URI  = os.environ["OAUTH_REDIRECT_URI"]
SESSION_SECRET      = os.environ["SESSION_SECRET"]

SOURCE   = "cwts-leiden.openalex_2025aug"

# Identity only — no BigQuery scope needed from the user
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

CACHE_1H  = "public, max-age=3600"
CACHE_OFF = "no-store"

app = FastAPI()

# ── Session helpers ───────────────────────────────────────────────────────────

def _sign(data: str) -> str:
    sig = hmac.new(SESSION_SECRET.encode(), data.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode()

def encode_session(payload: dict) -> str:
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"{body}.{_sign(body)}"

def decode_session(cookie: str) -> dict | None:
    try:
        body, sig = cookie.rsplit(".", 1)
        if not hmac.compare_digest(sig, _sign(body)):
            return None
        return json.loads(base64.urlsafe_b64decode(body).decode())
    except Exception:
        return None

def get_session(request: Request) -> dict:
    raw = request.cookies.get("orion_session")
    if not raw:
        return {}
    return decode_session(raw) or {}

def set_session(response, payload: dict):
    response.set_cookie(
        "orion_session",
        encode_session(payload),
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 8,
    )

# ── OAuth ─────────────────────────────────────────────────────────────────────

def make_flow(state: str | None = None) -> Flow:
    client_config = {
        "web": {
            "client_id": OAUTH_CLIENT_ID,
            "client_secret": OAUTH_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [OAUTH_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES, state=state)
    flow.redirect_uri = OAUTH_REDIRECT_URI
    return flow

def require_auth(request: Request) -> dict:
    """Returns session or raises 401."""
    session = get_session(request)
    if not session.get("email"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not session.get("project_id"):
        raise HTTPException(status_code=401, detail="No GCP project configured")
    return session

# ── BigQuery ──────────────────────────────────────────────────────────────────
# Queries use the Cloud Run service account to READ the (public) data,
# but are billed to the user's own GCP project_id stored in their session.

def get_bq(project_id: str) -> bigquery.Client:
    """Return a BQ client that bills jobs to the user's project."""
    return bigquery.Client(project=project_id)

def run_query(sql: str, params: dict, project_id: str) -> tuple[list[dict], int]:
    """Execute a parameterised BigQuery query.

    Returns a tuple of (rows, bytes_processed) where bytes_processed is the
    total bytes billed for the job (useful for surfacing cost info to users).

    Raises HTTPException with a user-friendly message for common permission
    errors (missing BigQuery Job User role, API not enabled, etc.).
    """
    from google.api_core.exceptions import Forbidden, PermissionDenied, ServiceUnavailable
    bq = get_bq(project_id)
    bq_params = []
    for name, value in params.items():
        if isinstance(value, list):
            bq_params.append(bigquery.ArrayQueryParameter(name, "INT64", value))
        elif isinstance(value, int):
            bq_params.append(bigquery.ScalarQueryParameter(name, "INT64", value))
        else:
            bq_params.append(bigquery.ScalarQueryParameter(name, "STRING", value))
    job_config = bigquery.QueryJobConfig(query_parameters=bq_params)
    try:
        job = bq.query(sql, job_config=job_config, location="EU")
        rows_iter = job.result()
    except (Forbidden, PermissionDenied) as e:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Permission denied on project '{project_id}'. "
                "Please grant the ORION service account "
                "(112226578999-compute@developer.gserviceaccount.com) "
                "the 'BigQuery Job User' role in your GCP project IAM settings, "
                "and make sure the BigQuery API is enabled. "
                f"Details: {str(e)[:200]}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)[:300]}")
    result = []
    for row in rows_iter:
        d = {}
        for key, value in row.items():
            if value is None:
                d[key] = None
            elif hasattr(value, "item"):
                d[key] = value.item()
            elif type(value).__name__ == "Decimal":
                d[key] = float(value)
            elif isinstance(value, float):
                d[key] = round(value, 4)
            elif isinstance(value, int):
                d[key] = int(value)
            else:
                d[key] = value
        result.append(d)
    bytes_processed = job.total_bytes_processed or 0
    return result, bytes_processed

def cached(data, max_age: str = CACHE_1H):
    return JSONResponse(content=data, headers={"Cache-Control": max_age})

# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.get("/auth/login")
def auth_login(project_id: str = Query(...)):
    # Encode project_id into the state parameter so no extra cookie is needed.
    # state = base64(project_id) + "." + hmac_signature
    state_payload = encode_session({"project_id": project_id})
    flow = make_flow(state=state_payload)
    auth_url, _ = flow.authorization_url(
        access_type="online",
        include_granted_scopes="true",
    )
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
def auth_callback(request: Request, code: str = Query(...), state: str = Query(...)):
    # Decode and verify project_id from state
    payload = decode_session(state)
    if not payload or "project_id" not in payload:
        return RedirectResponse("/?error=oauth_failed")

    flow = make_flow(state=state)
    try:
        flow.fetch_token(code=code)
    except Exception:
        return RedirectResponse("/?error=token_exchange_failed")

    try:
        resp = httpx.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {flow.credentials.token}"},
        )
        resp.raise_for_status()
        user = resp.json()
    except Exception:
        return RedirectResponse("/?error=userinfo_failed")

    session = {
        "email":      user.get("email", ""),
        "name":       user.get("name", ""),
        "project_id": payload["project_id"],
    }

    response = RedirectResponse("/")
    set_session(response, session)
    return response

@app.get("/auth/logout")
def auth_logout():
    response = RedirectResponse("/")
    response.delete_cookie("orion_session")
    return response

@app.get("/auth/me")
def auth_me(request: Request):
    session = get_session(request)
    if not session.get("email"):
        return JSONResponse({"authenticated": False})
    return JSONResponse({
        "authenticated": True,
        "email":      session.get("email"),
        "name":       session.get("name"),
        "project_id": session.get("project_id"),
    })

# ── Institutions ──────────────────────────────────────────────────────────────

@app.get("/api/institutions/top")
def institutions_top(
    request: Request,
    limit: int = Query(default=5000, ge=1, le=50000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    sql = f"""
        SELECT
            i.institution_id, i.institution AS name,
            i.country_iso_alpha2_code AS country,
            i.thumbnail_url, i.openalex_id,
            it.institution_type AS type,
            COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.institution` i
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        LEFT JOIN `{SOURCE}.work_affiliation_institution` wai ON i.institution_id = wai.institution_id
        LEFT JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
            AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    rows, bp = run_query(sql, {"limit": limit, "year_from": year_from, "year_to": year_to}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

@app.get("/api/institutions/search")
def institutions_search(
    request: Request,
    q: str = Query(default=""),
    field: str = Query(default="name"),
    limit: int = Query(default=5000, ge=1, le=50000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    if not q.strip():
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    field_map = {"name": "i.institution", "country": "i.country_iso_alpha2_code", "type": "it.institution_type"}
    col = field_map.get(field, "i.institution")
    sql = f"""
        SELECT
            i.institution_id, i.institution AS name,
            i.country_iso_alpha2_code AS country,
            i.thumbnail_url, i.openalex_id,
            it.institution_type AS type,
            COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.institution` i
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        LEFT JOIN `{SOURCE}.work_affiliation_institution` wai ON i.institution_id = wai.institution_id
        LEFT JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
            AND w.pub_year BETWEEN @year_from AND @year_to
        WHERE LOWER({col}) LIKE @pattern
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    rows, bp = run_query(sql, {"pattern": f"%{q.lower()}%", "limit": limit, "year_from": year_from, "year_to": year_to}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

@app.get("/api/institutions/{institution_id}/trends")
def institution_trends(request: Request, institution_id: int):
    """Return year-by-year works count for one institution."""
    session = require_auth(request)
    sql = f"""
        SELECT w.pub_year AS year, COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        -- To re-enable fractional counts, join orion_fractional_counts here
        WHERE wai.institution_id = @id
        GROUP BY year
        ORDER BY year
    """
    rows, bp = run_query(sql, {"id": institution_id}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

# ── Funders ───────────────────────────────────────────────────────────────────

@app.get("/api/funders/top")
def funders_top(
    request: Request,
    limit: int = Query(default=5000, ge=1, le=50000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    sql = f"""
        SELECT f.funder_id, f.funder AS name, f.country_iso_alpha2_code AS country,
               f.description, f.thumbnail_url, f.openalex_id,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.funder` f
        LEFT JOIN `{SOURCE}.work_grant` wg ON f.funder_id = wg.funder_id
        LEFT JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
            AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    rows, bp = run_query(sql, {"limit": limit, "year_from": year_from, "year_to": year_to}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

@app.get("/api/funders/search")
def funders_search(
    request: Request,
    q: str = Query(default=""),
    field: str = Query(default="name"),
    limit: int = Query(default=5000, ge=1, le=50000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    if not q.strip():
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    field_map = {"name": "f.funder", "country": "f.country_iso_alpha2_code", "description": "f.description"}
    col = field_map.get(field, "f.funder")
    sql = f"""
        SELECT f.funder_id, f.funder AS name, f.country_iso_alpha2_code AS country,
               f.description, f.thumbnail_url, f.openalex_id,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.funder` f
        LEFT JOIN `{SOURCE}.work_grant` wg ON f.funder_id = wg.funder_id
        LEFT JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
            AND w.pub_year BETWEEN @year_from AND @year_to
        WHERE LOWER({col}) LIKE @pattern
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    rows, bp = run_query(sql, {"pattern": f"%{q.lower()}%", "limit": limit, "year_from": year_from, "year_to": year_to}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

@app.get("/api/funders/{funder_id}/trends")
def funder_trends(request: Request, funder_id: int):
    """Return year-by-year funded work counts for one funder."""
    session = require_auth(request)
    sql = f"""
        SELECT w.pub_year AS year, COUNT(DISTINCT wg.work_id) AS works
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        WHERE wg.funder_id = @id
        GROUP BY year ORDER BY year
    """
    rows, bp = run_query(sql, {"id": funder_id}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

# ── Institution Basket ────────────────────────────────────────────────────────

class InstBasketRequest(BaseModel):
    institution_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 5000

@app.post("/api/basket/institutions/works")
def basket_inst_works(req: InstBasketRequest, request: Request):
    """Total distinct works for a basket of institutions."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"total_works": 0, "bytes_processed": 0}, CACHE_OFF)
    yf, yt, ids = req.year_from, req.year_to, req.institution_ids
    rows, bp = run_query(f"""
        SELECT COUNT(DISTINCT wai.work_id) AS total_works
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        WHERE wai.institution_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
    """, {"ids": ids, "year_from": yf, "year_to": yt}, pid)
    return cached({"total_works": rows[0]["total_works"] if rows else 0, "bytes_processed": bp}, CACHE_OFF)

@app.post("/api/basket/institutions/co-institutions")
def basket_inst_co_institutions(req: InstBasketRequest, request: Request):
    """Institutions that co-occur (at work level) with the basket institutions."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.institution_ids
    rows, bp = run_query(f"""
        SELECT i.institution_id, i.institution AS name,
               i.country_iso_alpha2_code AS country,
               it.institution_type AS type,
               COUNT(DISTINCT wai2.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        JOIN `{SOURCE}.work_affiliation_institution` wai2
            ON wai.work_id = wai2.work_id
           AND wai2.institution_id NOT IN UNNEST(@ids)
        JOIN `{SOURCE}.institution` i ON wai2.institution_id = i.institution_id
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        WHERE wai.institution_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
        ORDER BY works_count DESC LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)

@app.post("/api/basket/institutions/co-funders")
def basket_inst_co_funders(req: InstBasketRequest, request: Request):
    """Funders that co-occur (at work level) with the basket institutions."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.institution_ids
    rows, bp = run_query(f"""
        SELECT f.funder_id, f.funder AS name,
               f.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        JOIN `{SOURCE}.work_grant` wg ON w.work_id = wg.work_id
        JOIN `{SOURCE}.funder` f ON wg.funder_id = f.funder_id
        WHERE wai.institution_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
        ORDER BY works_count DESC LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)

# ── Funder Basket ─────────────────────────────────────────────────────────────

class FunderBasketRequest(BaseModel):
    funder_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 5000

@app.post("/api/basket/funders/works")
def basket_funder_works(req: FunderBasketRequest, request: Request):
    """Total distinct works funded by the basket funders."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        return cached({"total_works": 0, "bytes_processed": 0}, CACHE_OFF)
    yf, yt, ids = req.year_from, req.year_to, req.funder_ids
    rows, bp = run_query(f"""
        SELECT COUNT(DISTINCT wg.work_id) AS total_works
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        WHERE wg.funder_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
    """, {"ids": ids, "year_from": yf, "year_to": yt}, pid)
    return cached({"total_works": rows[0]["total_works"] if rows else 0, "bytes_processed": bp}, CACHE_OFF)

@app.post("/api/basket/funders/co-institutions")
def basket_funder_co_institutions(req: FunderBasketRequest, request: Request):
    """Institutions that co-occur (at work level) with the basket funders."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.funder_ids
    rows, bp = run_query(f"""
        SELECT i.institution_id, i.institution AS name,
               i.country_iso_alpha2_code AS country,
               it.institution_type AS type,
               COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        JOIN `{SOURCE}.work_affiliation_institution` wai ON w.work_id = wai.work_id
        JOIN `{SOURCE}.institution` i ON wai.institution_id = i.institution_id
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        WHERE wg.funder_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
        ORDER BY works_count DESC LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)

@app.post("/api/basket/funders/co-funders")
def basket_funder_co_funders(req: FunderBasketRequest, request: Request):
    """Funders that co-occur (at work level) with the basket funders."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.funder_ids
    rows, bp = run_query(f"""
        SELECT f.funder_id, f.funder AS name,
               f.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wg2.work_id) AS works_count
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        JOIN `{SOURCE}.work_grant` wg2
            ON wg.work_id = wg2.work_id
           AND wg2.funder_id NOT IN UNNEST(@ids)
        JOIN `{SOURCE}.funder` f ON wg2.funder_id = f.funder_id
        WHERE wg.funder_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
        ORDER BY works_count DESC LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)

# ── Topic / micro-cluster breakdown ──────────────────────────────────────────
# Uses the openalex_2023nov_classification dataset (separate from SOURCE).
# work_ids are cross-compatible between snapshots.
#
# For each basket we:
#   1. Collect the distinct work_ids for the basket in the given year range.
#   2. Join with cwts-leiden.openalex_2023nov_classification.clustering to get
#      the micro_cluster_id for each work (works without a cluster are ignored).
#   3. Join with the micro_cluster table to get the long_label.
#   4. Return the absolute count and the proportion relative to the total
#      cluster size (also filtered to the same year range via the SOURCE work table).

CLASSIFICATION = "cwts-leiden.openalex_2023nov_classification"

@app.post("/api/basket/institutions/topics")
def basket_inst_topics(req: InstBasketRequest, request: Request):
    """Micro-cluster topic breakdown for a basket of institutions.
    Returns ALL micro-clusters (within the year range), with basket_works_count=0
    for clusters where the basket has no publications."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"rows": [], "unclassified_works": 0, "bytes_processed": 0}, CACHE_OFF)
    yf, yt, ids = req.year_from, req.year_to, req.institution_ids
    rows, bp = run_query(f"""
        WITH basket_works AS (
            SELECT DISTINCT wai.work_id
            FROM `{SOURCE}.work_affiliation_institution` wai
            JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
            WHERE wai.institution_id IN UNNEST(@ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
        ),
        basket_clusters AS (
            SELECT cl.micro_cluster_id, COUNT(DISTINCT cl.work_id) AS basket_works_count
            FROM `{CLASSIFICATION}.clustering` cl
            INNER JOIN basket_works bw ON cl.work_id = bw.work_id
            GROUP BY cl.micro_cluster_id
        ),
        cluster_totals AS (
            SELECT cl.micro_cluster_id, COUNT(DISTINCT cl.work_id) AS total_works_in_cluster
            FROM `{CLASSIFICATION}.clustering` cl
            JOIN `{SOURCE}.work` w ON cl.work_id = w.work_id
            WHERE w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY cl.micro_cluster_id
        ),
        classified_count AS (
            SELECT COUNT(DISTINCT cl.work_id) AS n
            FROM `{CLASSIFICATION}.clustering` cl
            INNER JOIN basket_works bw ON cl.work_id = bw.work_id
        ),
        total_count AS (
            SELECT COUNT(*) AS n FROM basket_works
        )
        SELECT
            ct.micro_cluster_id,
            mc.long_label,
            COALESCE(bc.basket_works_count, 0) AS basket_works_count,
            ct.total_works_in_cluster,
            ROUND(SAFE_DIVIDE(COALESCE(bc.basket_works_count, 0), ct.total_works_in_cluster), 4) AS proportion,
            (SELECT n FROM total_count) - (SELECT n FROM classified_count) AS unclassified_works
        FROM cluster_totals ct
        LEFT JOIN basket_clusters bc ON ct.micro_cluster_id = bc.micro_cluster_id
        LEFT JOIN `{CLASSIFICATION}.micro_cluster` mc ON ct.micro_cluster_id = mc.micro_cluster_id
        ORDER BY basket_works_count DESC, ct.total_works_in_cluster DESC
    """, {"ids": ids, "year_from": yf, "year_to": yt}, pid)
    unclassified = rows[0]["unclassified_works"] if rows else 0
    clean_rows = [{k: v for k, v in r.items() if k != "unclassified_works"} for r in rows]
    return cached({"rows": clean_rows, "unclassified_works": unclassified, "bytes_processed": bp}, CACHE_OFF)


@app.post("/api/basket/funders/topics")
def basket_funder_topics(req: FunderBasketRequest, request: Request):
    """Micro-cluster topic breakdown for a basket of funders.
    Returns ALL micro-clusters (within the year range), with basket_works_count=0
    for clusters where the basket has no publications."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        return cached({"rows": [], "unclassified_works": 0, "bytes_processed": 0}, CACHE_OFF)
    yf, yt, ids = req.year_from, req.year_to, req.funder_ids
    rows, bp = run_query(f"""
        WITH basket_works AS (
            SELECT DISTINCT wg.work_id
            FROM `{SOURCE}.work_grant` wg
            JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
            WHERE wg.funder_id IN UNNEST(@ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
        ),
        basket_clusters AS (
            SELECT cl.micro_cluster_id, COUNT(DISTINCT cl.work_id) AS basket_works_count
            FROM `{CLASSIFICATION}.clustering` cl
            INNER JOIN basket_works bw ON cl.work_id = bw.work_id
            GROUP BY cl.micro_cluster_id
        ),
        cluster_totals AS (
            SELECT cl.micro_cluster_id, COUNT(DISTINCT cl.work_id) AS total_works_in_cluster
            FROM `{CLASSIFICATION}.clustering` cl
            JOIN `{SOURCE}.work` w ON cl.work_id = w.work_id
            WHERE w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY cl.micro_cluster_id
        ),
        classified_count AS (
            SELECT COUNT(DISTINCT cl.work_id) AS n
            FROM `{CLASSIFICATION}.clustering` cl
            INNER JOIN basket_works bw ON cl.work_id = bw.work_id
        ),
        total_count AS (
            SELECT COUNT(*) AS n FROM basket_works
        )
        SELECT
            ct.micro_cluster_id,
            mc.long_label,
            COALESCE(bc.basket_works_count, 0) AS basket_works_count,
            ct.total_works_in_cluster,
            ROUND(SAFE_DIVIDE(COALESCE(bc.basket_works_count, 0), ct.total_works_in_cluster), 4) AS proportion,
            (SELECT n FROM total_count) - (SELECT n FROM classified_count) AS unclassified_works
        FROM cluster_totals ct
        LEFT JOIN basket_clusters bc ON ct.micro_cluster_id = bc.micro_cluster_id
        LEFT JOIN `{CLASSIFICATION}.micro_cluster` mc ON ct.micro_cluster_id = mc.micro_cluster_id
        ORDER BY basket_works_count DESC, ct.total_works_in_cluster DESC
    """, {"ids": ids, "year_from": yf, "year_to": yt}, pid)
    unclassified = rows[0]["unclassified_works"] if rows else 0
    clean_rows = [{k: v for k, v in r.items() if k != "unclassified_works"} for r in rows]
    return cached({"rows": clean_rows, "unclassified_works": unclassified, "bytes_processed": bp}, CACHE_OFF)


# ── VOSviewer network export ──────────────────────────────────────────────────
# Networks are expensive to recompute and need to be accessible by VOSviewer
# Online (an external service) without auth cookies. We generate the network
# once on demand, store it in memory under a short-lived one-time token, and
# expose it via a public /api/vos/<token> endpoint that VOSviewer can fetch.

import secrets
import threading

_vos_store: dict[str, dict] = {}
_vos_lock = threading.Lock()

def _store_vos(data: dict) -> str:
    """Store network data and return a one-time token (valid 10 min)."""
    token = secrets.token_urlsafe(24)
    with _vos_lock:
        _vos_store[token] = {"data": data, "expires": time.time() + 600}
        # Prune expired tokens while we have the lock
        expired = [k for k, v in _vos_store.items() if v["expires"] < time.time()]
        for k in expired:
            del _vos_store[k]
    return token

@app.get("/api/vos/{token}")
def vos_serve(token: str):
    """Serve a pre-built VOSviewer JSON to VOSviewer Online (no auth required)."""
    with _vos_lock:
        entry = _vos_store.pop(token, None)
    if not entry or entry["expires"] < time.time():
        raise HTTPException(status_code=404, detail="Token not found or expired")
    return JSONResponse(
        content=entry["data"],
        headers={
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "https://app.vosviewer.com",
        },
    )

class VosInstRequest(BaseModel):
    institution_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 100
    all_works: bool = False  # False = basket works only; True = all works among map nodes

@app.post("/api/vos/build/institutions")
def vos_build_institutions(req: VosInstRequest, request: Request):
    """Build a VOSviewer co-occurrence network for a basket of institutions.

    Nodes = basket institutions + their top co-occurring institutions (up to limit).
    Node size = number of works (within the selected works pool).
    Edge strength = number of shared works between each pair (within the selected works pool).

    Works pool:
      all_works=False (default): only works involving at least one basket institution.
      all_works=True: all works involving any institution in the node set, regardless of basket.
    """
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        raise HTTPException(status_code=400, detail="No institution IDs provided")

    ids = req.institution_ids
    yf, yt, lim = req.year_from, req.year_to, req.limit

    # Step 1: Identify node set — always based on basket works (determines who's in the map).
    node_rows, _ = run_query(f"""
        SELECT i.institution_id AS id, i.institution AS label,
               i.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        JOIN `{SOURCE}.institution` i ON wai.institution_id = i.institution_id
        WHERE w.work_id IN (
            SELECT DISTINCT work_id
            FROM `{SOURCE}.work_affiliation_institution`
            WHERE institution_id IN UNNEST(@ids)
        )
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code
        ORDER BY works_count DESC
        LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)

    node_ids = [r["id"] for r in node_rows]
    if len(node_ids) < 2:
        raise HTTPException(status_code=400, detail="Not enough co-occurring institutions to build a network")

    # Step 2: If all_works=True, recalculate node sizes using the full works pool
    # (all works of the map institutions, not just basket works).
    if req.all_works:
        size_rows, _ = run_query(f"""
            SELECT wai.institution_id AS id,
                   COUNT(DISTINCT wai.work_id) AS works_count
            FROM `{SOURCE}.work_affiliation_institution` wai
            JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
            WHERE wai.institution_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY wai.institution_id
        """, {"node_ids": node_ids, "year_from": yf, "year_to": yt}, pid)
        size_map = {r["id"]: r["works_count"] for r in size_rows}
        for r in node_rows:
            r["works_count"] = size_map.get(r["id"], r["works_count"])

    # Step 3: Compute edge weights within the selected works pool.
    if req.all_works:
        # All works shared between any two map institutions.
        edge_rows, _ = run_query(f"""
            SELECT wai1.institution_id AS source_id,
                   wai2.institution_id AS target_id,
                   COUNT(DISTINCT wai1.work_id) AS strength
            FROM `{SOURCE}.work_affiliation_institution` wai1
            JOIN `{SOURCE}.work_affiliation_institution` wai2
                ON wai1.work_id = wai2.work_id
               AND wai1.institution_id < wai2.institution_id
            JOIN `{SOURCE}.work` w ON wai1.work_id = w.work_id
            WHERE wai1.institution_id IN UNNEST(@node_ids)
              AND wai2.institution_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY source_id, target_id
            HAVING strength > 0
        """, {"node_ids": node_ids, "year_from": yf, "year_to": yt}, pid)
    else:
        # Only works that involve at least one basket institution.
        edge_rows, _ = run_query(f"""
            SELECT wai1.institution_id AS source_id,
                   wai2.institution_id AS target_id,
                   COUNT(DISTINCT wai1.work_id) AS strength
            FROM `{SOURCE}.work_affiliation_institution` wai1
            JOIN `{SOURCE}.work_affiliation_institution` wai2
                ON wai1.work_id = wai2.work_id
               AND wai1.institution_id < wai2.institution_id
            JOIN `{SOURCE}.work` w ON wai1.work_id = w.work_id
            WHERE wai1.institution_id IN UNNEST(@node_ids)
              AND wai2.institution_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
              AND w.work_id IN (
                  SELECT DISTINCT work_id
                  FROM `{SOURCE}.work_affiliation_institution`
                  WHERE institution_id IN UNNEST(@ids)
              )
            GROUP BY source_id, target_id
            HAVING strength > 0
        """, {"node_ids": node_ids, "ids": ids, "year_from": yf, "year_to": yt}, pid)

    works_label = "all works among map institutions" if req.all_works else "works involving basket institutions"
    basket_set = set(ids)
    items = [
        {
            "id": r["id"],
            "label": r["label"],
            "description": r.get("country") or "",
            "weights": {"Works": r["works_count"]},
            **({"cluster": 1} if r["id"] in basket_set else {"cluster": 2}),
        }
        for r in node_rows
    ]
    links = [
        {"source_id": r["source_id"], "target_id": r["target_id"], "strength": r["strength"]}
        for r in edge_rows
    ]
    vos_json = {
        "network": {"items": items, "links": links},
        "config": {
            "terminology": {"item": "institution", "items": "institutions", "link_strength": "co-occurring works"},
            "parameters": {"item_size": 2, "largest_component": True},
        },
        "info": {
            "title": f"Institution co-occurrence network ({yf}–{yt})",
            "description": (
                f"Nodes: basket institutions (cluster 1, {len(ids)}) + top co-occurring institutions (cluster 2). "
                f"Node size and edge strength based on {works_label}. "
                f"Year range: {yf}–{yt}."
            ),
        },
    }
    token = _store_vos(vos_json)
    return JSONResponse({"token": token})


class VosFunderRequest(BaseModel):
    funder_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 100
    all_works: bool = False  # False = basket works only; True = all works among map nodes

@app.post("/api/vos/build/funders")
def vos_build_funders(req: VosFunderRequest, request: Request):
    """Build a VOSviewer co-occurrence network for a basket of funders.

    Nodes = basket funders + their top co-occurring funders (up to limit).
    Node size = number of works (within the selected works pool).
    Edge strength = number of shared works between each pair (within the selected works pool).

    Works pool:
      all_works=False (default): only works involving at least one basket funder.
      all_works=True: all works involving any funder in the node set, regardless of basket.
    """
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        raise HTTPException(status_code=400, detail="No funder IDs provided")

    ids = req.funder_ids
    yf, yt, lim = req.year_from, req.year_to, req.limit

    # Step 1: Identify node set — always based on basket works.
    node_rows, _ = run_query(f"""
        SELECT f.funder_id AS id, f.funder AS label,
               f.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        JOIN `{SOURCE}.funder` f ON wg.funder_id = f.funder_id
        WHERE w.work_id IN (
            SELECT DISTINCT work_id FROM `{SOURCE}.work_grant`
            WHERE funder_id IN UNNEST(@ids)
        )
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
        ORDER BY works_count DESC
        LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)

    node_ids = [r["id"] for r in node_rows]
    if len(node_ids) < 2:
        raise HTTPException(status_code=400, detail="Not enough co-occurring funders to build a network")

    # Step 2: If all_works=True, recalculate node sizes using the full works pool.
    if req.all_works:
        size_rows, _ = run_query(f"""
            SELECT wg.funder_id AS id,
                   COUNT(DISTINCT wg.work_id) AS works_count
            FROM `{SOURCE}.work_grant` wg
            JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
            WHERE wg.funder_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY wg.funder_id
        """, {"node_ids": node_ids, "year_from": yf, "year_to": yt}, pid)
        size_map = {r["id"]: r["works_count"] for r in size_rows}
        for r in node_rows:
            r["works_count"] = size_map.get(r["id"], r["works_count"])

    # Step 3: Compute edge weights within the selected works pool.
    if req.all_works:
        edge_rows, _ = run_query(f"""
            SELECT wg1.funder_id AS source_id,
                   wg2.funder_id AS target_id,
                   COUNT(DISTINCT wg1.work_id) AS strength
            FROM `{SOURCE}.work_grant` wg1
            JOIN `{SOURCE}.work_grant` wg2
                ON wg1.work_id = wg2.work_id
               AND wg1.funder_id < wg2.funder_id
            JOIN `{SOURCE}.work` w ON wg1.work_id = w.work_id
            WHERE wg1.funder_id IN UNNEST(@node_ids)
              AND wg2.funder_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY source_id, target_id
            HAVING strength > 0
        """, {"node_ids": node_ids, "year_from": yf, "year_to": yt}, pid)
    else:
        edge_rows, _ = run_query(f"""
            SELECT wg1.funder_id AS source_id,
                   wg2.funder_id AS target_id,
                   COUNT(DISTINCT wg1.work_id) AS strength
            FROM `{SOURCE}.work_grant` wg1
            JOIN `{SOURCE}.work_grant` wg2
                ON wg1.work_id = wg2.work_id
               AND wg1.funder_id < wg2.funder_id
            JOIN `{SOURCE}.work` w ON wg1.work_id = w.work_id
            WHERE wg1.funder_id IN UNNEST(@node_ids)
              AND wg2.funder_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
              AND w.work_id IN (
                  SELECT DISTINCT work_id FROM `{SOURCE}.work_grant`
                  WHERE funder_id IN UNNEST(@ids)
              )
            GROUP BY source_id, target_id
            HAVING strength > 0
        """, {"node_ids": node_ids, "ids": ids, "year_from": yf, "year_to": yt}, pid)

    works_label = "all works among map funders" if req.all_works else "works involving basket funders"
    basket_set = set(ids)
    items = [
        {
            "id": r["id"],
            "label": r["label"],
            "description": r.get("country") or "",
            "weights": {"Works": r["works_count"]},
            **({"cluster": 1} if r["id"] in basket_set else {"cluster": 2}),
        }
        for r in node_rows
    ]
    links = [
        {"source_id": r["source_id"], "target_id": r["target_id"], "strength": r["strength"]}
        for r in edge_rows
    ]
    vos_json = {
        "network": {"items": items, "links": links},
        "config": {
            "terminology": {"item": "funder", "items": "funders", "link_strength": "co-funded works"},
            "parameters": {"item_size": 2, "largest_component": True},
        },
        "info": {
            "title": f"Funder co-occurrence network ({yf}–{yt})",
            "description": (
                f"Nodes: basket funders (cluster 1, {len(ids)}) + top co-occurring funders (cluster 2). "
                f"Node size and edge strength based on {works_label}. "
                f"Year range: {yf}–{yt}."
            ),
        },
    }
    token = _store_vos(vos_json)
    return JSONResponse({"token": token})


# ── Lab (Experimental) ───────────────────────────────────────────────────────

class LabWorksRequest(BaseModel):
    work_ids: List[int]
    limit: int = 1000

@app.post("/api/lab/citation-network")
def lab_citation_network(req: LabWorksRequest, request: Request):
    """All 4 citation analyses in one query. Returns rows tagged by type."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.work_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    rows, bp = run_query(f"""
        WITH seed_papers AS (
            SELECT work_id FROM UNNEST(@ids) AS work_id
        ),
        citing_papers_raw AS (
            SELECT c.citing_work_id, c.cited_work_id
            FROM `{SOURCE}.citation` c
            JOIN seed_papers s ON c.cited_work_id = s.work_id
        ),
        seed_references_raw AS (
            SELECT c.cited_work_id, c.citing_work_id
            FROM `{SOURCE}.citation` c
            JOIN seed_papers s ON c.citing_work_id = s.work_id
        ),
        direct_citation AS (
            SELECT 'direct_citation' AS type, r.citing_work_id AS work_id, COUNT(*) AS score
            FROM citing_papers_raw r
            LEFT JOIN seed_papers sp ON r.citing_work_id = sp.work_id
            WHERE sp.work_id IS NULL
            GROUP BY r.citing_work_id
        ),
        direct_reference AS (
            SELECT 'direct_reference' AS type, r.cited_work_id AS work_id, COUNT(*) AS score
            FROM seed_references_raw r
            LEFT JOIN seed_papers sp ON r.cited_work_id = sp.work_id
            WHERE sp.work_id IS NULL
            GROUP BY r.cited_work_id
        ),
        co_citation AS (
            SELECT 'co_citation' AS type, c.cited_work_id AS work_id, COUNT(*) AS score
            FROM `{SOURCE}.citation` c
            JOIN direct_citation dc ON c.citing_work_id = dc.work_id
            LEFT JOIN seed_papers sp ON c.cited_work_id = sp.work_id
            WHERE sp.work_id IS NULL
            GROUP BY c.cited_work_id
        ),
        bib_coupling AS (
            SELECT 'bib_coupling' AS type, c.citing_work_id AS work_id, COUNT(*) AS score
            FROM `{SOURCE}.citation` c
            JOIN direct_reference dr ON c.cited_work_id = dr.work_id
            LEFT JOIN seed_papers sp ON c.citing_work_id = sp.work_id
            WHERE sp.work_id IS NULL
            GROUP BY c.citing_work_id
        ),
        all_results AS (
            SELECT * FROM direct_citation
            UNION ALL SELECT * FROM co_citation
            UNION ALL SELECT * FROM direct_reference
            UNION ALL SELECT * FROM bib_coupling
        )
        SELECT r.type, r.work_id, wt.title, w.pub_year, r.score
        FROM all_results r
        LEFT JOIN `{SOURCE}.work` w ON r.work_id = w.work_id
        LEFT JOIN `{SOURCE}.work_title` wt ON r.work_id = wt.work_id
        QUALIFY ROW_NUMBER() OVER (PARTITION BY r.type ORDER BY r.score DESC) <= @limit
        ORDER BY r.type, r.score DESC
    """, {"ids": req.work_ids, "limit": req.limit}, pid)
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)


# ── CARP — Contribution-Adjusted Research Performance ────────────────────────
# Formula: CARP(a,p) = W(a,n) × FN(p) × FW(f) × CR(a)
#
# W(a,n)  Positional weight
#   sole author          → 1.00
#   first  (2 authors)  → 0.60 | last (2 authors)  → 0.40
#   first  (3+authors)  → 0.40 | last (3+authors)  → 0.30
#   middle (3+authors)  → 0.30 / (n − 2)
#
# FN(p)   Field-normalised citation score
#   log10(1 + C) / log10(1 + μ_field_year)
#
# FW(f)   Field weight (corrects low-citation disciplines)
#   STEM = 1.00 | Social Sciences = 1.20
#   LIS / Humanities = 1.50 | Indigenous Knowledge = 1.60
#
# CR(a)   CRediT role multiplier — default 1.0 (no CRediT data in OpenAlex)
#
# Reference: Vinodh Kumar (2026). CARP metric. Zenodo.
#            https://doi.org/10.5281/zenodo.20588564

class CarpInstRequest(BaseModel):
    institution_ids: List[int]
    year_from: int = 2015
    year_to: int = 2024
    min_papers: int = 3
    limit: int = 200

@app.post("/api/carp/institutions")
def carp_institutions(req: CarpInstRequest, request: Request):
    """
    CARP author-level scores for a basket of institutions.

    Returns one row per author affiliated with any of the given institutions,
    ranked by cumulative CARP score descending.

    Each row contains:
      author_id, author_name, total_papers, CARP_total, CARP_avg,
      avg_FN, avg_W, top_fields, bytes_processed
    """
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)

    ids  = req.institution_ids
    yf   = req.year_from
    yt   = req.year_to
    minp = req.min_papers
    lim  = req.limit

    sql = f"""
    -- ── Step 1: works belonging to the institution basket ───────────────────
    WITH basket_works AS (
        SELECT DISTINCT wai.work_id
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        WHERE wai.institution_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
    ),

    -- ── Step 2: author positions for those works ─────────────────────────────
    -- author_position.author_position is a STRING: 'first' | 'middle' | 'last'
    -- author_seq counts all authors on each work (used for n_authors)
    author_pos AS (
        SELECT
            ap.work_id,
            ap.author_id,
            ap.author_position                        AS position_label,
            MAX(ap.author_seq) OVER (
                PARTITION BY ap.work_id
            )                                         AS n_authors
        FROM `{SOURCE}.author_position` ap
        INNER JOIN basket_works bw ON ap.work_id = bw.work_id
    ),

    -- ── Step 3: join work metadata ────────────────────────────────────────────
    work_meta AS (
        SELECT
            ap.work_id,
            ap.author_id,
            ap.position_label,
            ap.n_authors,
            w.pub_year,
            w.cited_by_count,
            -- Primary field via work_topic → topic → subfield → field
            f.field                                   AS field_name
        FROM author_pos ap
        JOIN `{SOURCE}.work` w
            ON ap.work_id = w.work_id
        LEFT JOIN `{SOURCE}.work_topic` wt
            ON ap.work_id = wt.work_id AND wt.topic_rank = 1
        LEFT JOIN `{SOURCE}.topic` t
            ON wt.topic_id = t.topic_id
        LEFT JOIN `{SOURCE}.subfield` sf
            ON t.subfield_id = sf.subfield_id
        LEFT JOIN `{SOURCE}.field` f
            ON sf.field_id = f.field_id
    ),

    -- ── Step 4: field mean citations per year (for FN denominator) ───────────
    field_means AS (
        SELECT
            w.pub_year,
            f.field                                   AS field_name,
            AVG(w.cited_by_count)                     AS mu
        FROM `{SOURCE}.work` w
        JOIN `{SOURCE}.work_topic` wt
            ON w.work_id = wt.work_id AND wt.topic_rank = 1
        JOIN `{SOURCE}.topic` t
            ON wt.topic_id = t.topic_id
        JOIN `{SOURCE}.subfield` sf
            ON t.subfield_id = sf.subfield_id
        JOIN `{SOURCE}.field` f
            ON sf.field_id = f.field_id
        WHERE w.pub_year BETWEEN @year_from AND @year_to
          AND w.cited_by_count IS NOT NULL
        GROUP BY w.pub_year, f.field
    ),

    -- ── Step 5: compute CARP components ─────────────────────────────────────
    carp_components AS (
        SELECT
            wm.work_id,
            wm.author_id,
            wm.position_label,
            wm.n_authors,
            wm.pub_year,
            wm.cited_by_count,
            wm.field_name,
            fm.mu                                     AS mu_field,

            -- W(a,n): positional weight
            CASE
                WHEN wm.n_authors = 1
                    THEN 1.00
                WHEN wm.n_authors = 2 AND wm.position_label = 'first'
                    THEN 0.60
                WHEN wm.n_authors = 2 AND wm.position_label = 'last'
                    THEN 0.40
                WHEN wm.n_authors >= 3 AND wm.position_label = 'first'
                    THEN 0.40
                WHEN wm.n_authors >= 3 AND wm.position_label = 'last'
                    THEN 0.30
                WHEN wm.n_authors >= 3 AND wm.position_label = 'middle'
                    THEN 0.30 / GREATEST(wm.n_authors - 2, 1)
                ELSE 0.0
            END                                       AS W_pos,

            -- FN(p): field-normalised citation score
            CASE
                WHEN fm.mu IS NULL OR fm.mu = 0
                    THEN LOG10(1 + wm.cited_by_count)
                ELSE SAFE_DIVIDE(
                    LOG10(1 + wm.cited_by_count),
                    LOG10(1 + fm.mu)
                )
            END                                       AS FN_score,

            -- FW(f): field weight
            CASE
                WHEN LOWER(wm.field_name) LIKE '%indigenous%'
                  OR LOWER(wm.field_name) LIKE '%traditional knowledge%'
                    THEN 1.60
                WHEN LOWER(wm.field_name) LIKE '%library%'
                  OR LOWER(wm.field_name) LIKE '%information science%'
                  OR LOWER(wm.field_name) LIKE '%humanities%'
                  OR LOWER(wm.field_name) LIKE '%arts%'
                  OR LOWER(wm.field_name) LIKE '%literature%'
                    THEN 1.50
                WHEN LOWER(wm.field_name) LIKE '%social%'
                  OR LOWER(wm.field_name) LIKE '%economics%'
                  OR LOWER(wm.field_name) LIKE '%education%'
                  OR LOWER(wm.field_name) LIKE '%psychology%'
                  OR LOWER(wm.field_name) LIKE '%management%'
                  OR LOWER(wm.field_name) LIKE '%business%'
                    THEN 1.20
                ELSE 1.00
            END                                       AS FW_field

        FROM work_meta wm
        LEFT JOIN field_means fm
            ON wm.pub_year = fm.pub_year
           AND wm.field_name = fm.field_name
        WHERE wm.cited_by_count IS NOT NULL
    ),

    -- ── Step 6: final CARP score per author-paper ────────────────────────────
    carp_scores AS (
        SELECT
            *,
            ROUND(W_pos * FN_score * FW_field * 1.0, 6) AS CARP_score
        FROM carp_components
        WHERE W_pos > 0
    )

    -- ── Final: aggregate to author level ─────────────────────────────────────
    SELECT
        cs.author_id,
        a.author                                      AS author_name,
        COUNT(DISTINCT cs.work_id)                    AS total_papers,
        ROUND(SUM(cs.CARP_score), 4)                  AS CARP_total,
        ROUND(AVG(cs.CARP_score), 4)                  AS CARP_avg,
        ROUND(AVG(cs.FN_score),   4)                  AS avg_FN,
        ROUND(AVG(cs.W_pos),      4)                  AS avg_W,
        STRING_AGG(
            DISTINCT cs.field_name
            ORDER BY cs.field_name
            LIMIT 3
        )                                             AS top_fields

    FROM carp_scores cs
    LEFT JOIN `{SOURCE}.author` a ON cs.author_id = a.author_id

    GROUP BY cs.author_id, a.author
    HAVING COUNT(DISTINCT cs.work_id) >= @min_papers

    ORDER BY CARP_total DESC
    LIMIT @limit
    """

    rows, bp = run_query(
        sql,
        {
            "ids":       ids,
            "year_from": yf,
            "year_to":   yt,
            "min_papers": minp,
            "limit":     lim,
        },
        pid,
    )
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)


# ── Frontend ──────────────────────────────────────────────────────────────────

BUILD_DIR = os.path.join(os.path.dirname(__file__), "client", "build")
if os.path.exists(BUILD_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(BUILD_DIR, "static")), name="static")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))
