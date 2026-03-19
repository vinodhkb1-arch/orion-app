/**
 * queryBuilders.js
 *
 * SQL export query builders for each basket type and query kind.
 * All queries mirror the backend queries in main.py — if you update a query
 * there, update the corresponding builder here too (they are coupled).
 *
 * The dataset name comes from ORION_SOURCE in api.js — change it there only.
 */
import { ORION_SOURCE } from '../api';
export function buildInstWorksQuery(ids, yf, yt) {
  return `-- ORION: all works · ${ids.length} institution${ids.length !== 1 ? 's' : ''} · ${yf}–${yt}

SELECT DISTINCT wai.work_id
FROM \`${ORION_SOURCE}.work_affiliation_institution\` wai
JOIN \`${ORION_SOURCE}.work\` w ON wai.work_id = w.work_id
WHERE wai.institution_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
ORDER BY wai.work_id`;
}

export function buildInstCoInstQuery(ids, yf, yt) {
  return `-- ORION: co-occurring institutions · ${ids.length} institution${ids.length !== 1 ? 's' : ''} · ${yf}–${yt}

SELECT i.institution_id, i.institution AS name,
       i.country_iso_alpha2_code AS country,
       it.institution_type AS type,
       COUNT(DISTINCT wai2.work_id) AS works_count
FROM \`${ORION_SOURCE}.work_affiliation_institution\` wai
JOIN \`${ORION_SOURCE}.work\` w ON wai.work_id = w.work_id
JOIN \`${ORION_SOURCE}.work_affiliation_institution\` wai2
    ON wai.work_id = wai2.work_id
   AND wai2.institution_id NOT IN (${ids.join(', ')})
JOIN \`${ORION_SOURCE}.institution\` i ON wai2.institution_id = i.institution_id
LEFT JOIN \`${ORION_SOURCE}.institution_type\` it ON i.institution_type_id = it.institution_type_id
WHERE wai.institution_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
ORDER BY works_count DESC`;
}

export function buildInstCoFunderQuery(ids, yf, yt) {
  return `-- ORION: co-occurring funders · ${ids.length} institution${ids.length !== 1 ? 's' : ''} · ${yf}–${yt}

SELECT f.funder_id, f.funder AS name,
       f.country_iso_alpha2_code AS country,
       COUNT(DISTINCT wg.work_id) AS works_count
FROM \`${ORION_SOURCE}.work_affiliation_institution\` wai
JOIN \`${ORION_SOURCE}.work\` w ON wai.work_id = w.work_id
JOIN \`${ORION_SOURCE}.work_grant\` wg ON w.work_id = wg.work_id
JOIN \`${ORION_SOURCE}.funder\` f ON wg.funder_id = f.funder_id
WHERE wai.institution_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
ORDER BY works_count DESC`;
}

export function buildFunderWorksQuery(ids, yf, yt) {
  return `-- ORION: all works · ${ids.length} funder${ids.length !== 1 ? 's' : ''} · ${yf}–${yt}

SELECT DISTINCT wg.work_id
FROM \`${ORION_SOURCE}.work_grant\` wg
JOIN \`${ORION_SOURCE}.work\` w ON wg.work_id = w.work_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
ORDER BY wg.work_id`;
}

export function buildFunderCoInstQuery(ids, yf, yt) {
  return `-- ORION: co-occurring institutions · ${ids.length} funder${ids.length !== 1 ? 's' : ''} · ${yf}–${yt}

SELECT i.institution_id, i.institution AS name,
       i.country_iso_alpha2_code AS country,
       it.institution_type AS type,
       COUNT(DISTINCT wai.work_id) AS works_count
FROM \`${ORION_SOURCE}.work_grant\` wg
JOIN \`${ORION_SOURCE}.work\` w ON wg.work_id = w.work_id
JOIN \`${ORION_SOURCE}.work_affiliation_institution\` wai ON w.work_id = wai.work_id
JOIN \`${ORION_SOURCE}.institution\` i ON wai.institution_id = i.institution_id
LEFT JOIN \`${ORION_SOURCE}.institution_type\` it ON i.institution_type_id = it.institution_type_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
ORDER BY works_count DESC`;
}

export function buildFunderCoFunderQuery(ids, yf, yt) {
  return `-- ORION: co-occurring funders · ${ids.length} funder${ids.length !== 1 ? 's' : ''} · ${yf}–${yt}

SELECT f.funder_id, f.funder AS name,
       f.country_iso_alpha2_code AS country,
       COUNT(DISTINCT wg2.work_id) AS works_count
FROM \`${ORION_SOURCE}.work_grant\` wg
JOIN \`${ORION_SOURCE}.work\` w ON wg.work_id = w.work_id
JOIN \`${ORION_SOURCE}.work_grant\` wg2
    ON wg.work_id = wg2.work_id
   AND wg2.funder_id NOT IN (${ids.join(', ')})
JOIN \`${ORION_SOURCE}.funder\` f ON wg2.funder_id = f.funder_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
ORDER BY works_count DESC`;
}

// ── Search / browse query builders (for EntityList "Get export query") ────────

const INST_FIELD_MAP = {
  name:    'i.institution',
  country: 'i.country_iso_alpha2_code',
  type:    'it.institution_type',
};

const FUNDER_FIELD_MAP = {
  name:        'f.funder',
  country:     'f.country_iso_alpha2_code',
  description: 'f.description',
};

/**
 * Mirrors the backend /api/institutions/search (or /top when q is empty).
 * q='' → top institutions by works_count; otherwise LIKE filter on `field`.
 */
export function buildInstSearchQuery(q, field, yf, yt) {
  const col   = INST_FIELD_MAP[field] ?? 'i.institution';
  const where = q.trim()
    ? `WHERE LOWER(${col}) LIKE '%${q.toLowerCase().replace(/'/g, "\\'")}%'`
    : '-- No filter applied (top institutions by works count)';
  const desc  = q.trim() ? `${field} LIKE '%${q}%'` : 'top by works count';
  return `-- ORION: institutions · ${desc} · ${yf}–${yt}

SELECT
    i.institution_id,
    i.institution          AS name,
    i.country_iso_alpha2_code AS country,
    it.institution_type    AS type,
    COUNT(DISTINCT wai.work_id) AS works_count
FROM \`${ORION_SOURCE}.institution\` i
LEFT JOIN \`${ORION_SOURCE}.institution_type\` it
    ON i.institution_type_id = it.institution_type_id
LEFT JOIN \`${ORION_SOURCE}.work_affiliation_institution\` wai
    ON i.institution_id = wai.institution_id
LEFT JOIN \`${ORION_SOURCE}.work\` w
    ON wai.work_id = w.work_id
   AND w.pub_year BETWEEN ${yf} AND ${yt}
${where}
GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
ORDER BY works_count DESC`;
}

/**
 * Mirrors the backend /api/funders/search (or /top when q is empty).
 */
export function buildFunderSearchQuery(q, field, yf, yt) {
  const col   = FUNDER_FIELD_MAP[field] ?? 'f.funder';
  const where = q.trim()
    ? `WHERE LOWER(${col}) LIKE '%${q.toLowerCase().replace(/'/g, "\\'")}%'`
    : '-- No filter applied (top funders by works count)';
  const desc  = q.trim() ? `${field} LIKE '%${q}%'` : 'top by works count';
  return `-- ORION: funders · ${desc} · ${yf}–${yt}

SELECT
    f.funder_id,
    f.funder                  AS name,
    f.country_iso_alpha2_code AS country,
    f.description,
    COUNT(DISTINCT wg.work_id) AS works_count
FROM \`${ORION_SOURCE}.funder\` f
LEFT JOIN \`${ORION_SOURCE}.work_grant\` wg
    ON f.funder_id = wg.funder_id
LEFT JOIN \`${ORION_SOURCE}.work\` w
    ON wg.work_id = w.work_id
   AND w.pub_year BETWEEN ${yf} AND ${yt}
${where}
GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code, f.description
ORDER BY works_count DESC`;
}

// ── Topic / micro-cluster breakdown ──────────────────────────────────────────

const CLASSIFICATION = 'cwts-leiden.openalex_2023nov_classification';

export function buildInstTopicsQuery(ids, yf, yt) {
  return `-- ORION: topic breakdown · ${ids.length} institution${ids.length !== 1 ? 's' : ''} · ${yf}–${yt}

WITH basket_works AS (
    SELECT DISTINCT wai.work_id
    FROM \`${ORION_SOURCE}.work_affiliation_institution\` wai
    JOIN \`${ORION_SOURCE}.work\` w ON wai.work_id = w.work_id
    WHERE wai.institution_id IN (${ids.join(', ')})
      AND w.pub_year BETWEEN ${yf} AND ${yt}
),
basket_clusters AS (
    SELECT cl.micro_cluster_id, COUNT(DISTINCT cl.work_id) AS basket_works_count
    FROM \`${CLASSIFICATION}.clustering\` cl
    INNER JOIN basket_works bw ON cl.work_id = bw.work_id
    GROUP BY cl.micro_cluster_id
),
cluster_totals AS (
    SELECT cl.micro_cluster_id, COUNT(DISTINCT cl.work_id) AS total_works_in_cluster
    FROM \`${CLASSIFICATION}.clustering\` cl
    JOIN \`${ORION_SOURCE}.work\` w ON cl.work_id = w.work_id
    WHERE w.pub_year BETWEEN ${yf} AND ${yt}
    GROUP BY cl.micro_cluster_id
)
SELECT
    ct.micro_cluster_id,
    mc.long_label,
    COALESCE(bc.basket_works_count, 0) AS basket_works_count,
    ct.total_works_in_cluster,
    ROUND(SAFE_DIVIDE(COALESCE(bc.basket_works_count, 0), ct.total_works_in_cluster), 4) AS proportion
FROM cluster_totals ct
LEFT JOIN basket_clusters bc ON ct.micro_cluster_id = bc.micro_cluster_id
LEFT JOIN \`${CLASSIFICATION}.micro_cluster\` mc ON ct.micro_cluster_id = mc.micro_cluster_id
ORDER BY basket_works_count DESC, ct.total_works_in_cluster DESC`;
}

export function buildFunderTopicsQuery(ids, yf, yt) {
  return `-- ORION: topic breakdown · ${ids.length} funder${ids.length !== 1 ? 's' : ''} · ${yf}–${yt}

WITH basket_works AS (
    SELECT DISTINCT wg.work_id
    FROM \`${ORION_SOURCE}.work_grant\` wg
    JOIN \`${ORION_SOURCE}.work\` w ON wg.work_id = w.work_id
    WHERE wg.funder_id IN (${ids.join(', ')})
      AND w.pub_year BETWEEN ${yf} AND ${yt}
),
basket_clusters AS (
    SELECT cl.micro_cluster_id, COUNT(DISTINCT cl.work_id) AS basket_works_count
    FROM \`${CLASSIFICATION}.clustering\` cl
    INNER JOIN basket_works bw ON cl.work_id = bw.work_id
    GROUP BY cl.micro_cluster_id
),
cluster_totals AS (
    SELECT cl.micro_cluster_id, COUNT(DISTINCT cl.work_id) AS total_works_in_cluster
    FROM \`${CLASSIFICATION}.clustering\` cl
    JOIN \`${ORION_SOURCE}.work\` w ON cl.work_id = w.work_id
    WHERE w.pub_year BETWEEN ${yf} AND ${yt}
    GROUP BY cl.micro_cluster_id
)
SELECT
    ct.micro_cluster_id,
    mc.long_label,
    COALESCE(bc.basket_works_count, 0) AS basket_works_count,
    ct.total_works_in_cluster,
    ROUND(SAFE_DIVIDE(COALESCE(bc.basket_works_count, 0), ct.total_works_in_cluster), 4) AS proportion
FROM cluster_totals ct
LEFT JOIN basket_clusters bc ON ct.micro_cluster_id = bc.micro_cluster_id
LEFT JOIN \`${CLASSIFICATION}.micro_cluster\` mc ON ct.micro_cluster_id = mc.micro_cluster_id
ORDER BY basket_works_count DESC, ct.total_works_in_cluster DESC`;
}
