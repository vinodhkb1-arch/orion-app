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
  return `-- ORION export: all works for institution basket
-- Institution IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns the unique work_id of every paper affiliated with
-- the selected institutions in the given year range.
-- See the Guide tab for instructions and join examples.

SELECT DISTINCT wai.work_id
FROM \`${ORION_SOURCE}.work_affiliation_institution\` wai
JOIN \`${ORION_SOURCE}.work\` w ON wai.work_id = w.work_id
WHERE wai.institution_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
ORDER BY wai.work_id`;
}

export function buildInstCoInstQuery(ids, yf, yt) {
  return `-- ORION export: co-occurring institutions for institution basket
-- Institution IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns institutions that share at least one paper with
-- the basket institutions, ranked by co-occurrence count.

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
  return `-- ORION export: co-occurring funders for institution basket
-- Institution IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns funders whose grants appear on papers affiliated with
-- the basket institutions, ranked by co-occurrence count.

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
  return `-- ORION export: all works for funder basket
-- Funder IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns the unique work_id of every paper that acknowledges
-- funding from the selected funders in the given year range.
-- See the Guide tab for instructions and join examples.

SELECT DISTINCT wg.work_id
FROM \`${ORION_SOURCE}.work_grant\` wg
JOIN \`${ORION_SOURCE}.work\` w ON wg.work_id = w.work_id
WHERE wg.funder_id IN (${ids.join(', ')})
  AND w.pub_year BETWEEN ${yf} AND ${yt}
ORDER BY wg.work_id`;
}

export function buildFunderCoInstQuery(ids, yf, yt) {
  return `-- ORION export: co-occurring institutions for funder basket
-- Funder IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns institutions affiliated with papers funded by
-- the basket funders, ranked by co-occurrence count.

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
  return `-- ORION export: co-occurring funders for funder basket
-- Funder IDs: ${ids.join(', ')}
-- Year range: ${yf}–${yt}
--
-- Returns other funders that co-funded the same papers as
-- the basket funders, ranked by co-occurrence count.

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
  const desc  = q.trim()
    ? `-- Search: ${field} LIKE '%${q}%'`
    : '-- Browse: top institutions by works count';
  return `-- ORION export: institution search results
${desc}
-- Year range: ${yf}–${yt}
--
-- Returns the institutions shown in the Institutions tab for the
-- current search, ordered by works count in the given year range.
-- (No row limit — fetch all matching results.)

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
  const desc  = q.trim()
    ? `-- Search: ${field} LIKE '%${q}%'`
    : '-- Browse: top funders by works count';
  return `-- ORION export: funder search results
${desc}
-- Year range: ${yf}–${yt}
--
-- Returns the funders shown in the Funders tab for the
-- current search, ordered by works count in the given year range.
-- (No row limit — fetch all matching results.)

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

// ── Shared components ─────────────────────────────────────────────────────────
