\pset pager off
\pset format csv

-- Bloxodes Umami analysis window: 10 complete Asia/Kolkata calendar days.
-- 2026-07-12 00:00 IST through 2026-07-22 00:00 IST (exclusive).

\echo website_and_coverage
WITH selected_website AS (
  SELECT website_id, name, domain
  FROM website
  WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
)
SELECT
  w.name,
  w.domain,
  MIN(e.created_at) AS first_event_utc,
  MAX(e.created_at) AS last_event_utc,
  COUNT(*) FILTER (WHERE e.event_type = 1) AS pageviews_all_time,
  COUNT(*) FILTER (WHERE e.event_type = 2 AND e.event_name = 'engaged_visit') AS engaged_visits_all_time
FROM selected_website w
LEFT JOIN website_event e USING (website_id)
GROUP BY w.name, w.domain;

\echo family_performance
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), bounded_events AS (
  SELECT e.*
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
    AND (e.event_type = 1 OR (e.event_type = 2 AND e.event_name = 'engaged_visit'))
), classified AS (
  SELECT
    e.*,
    CASE
      WHEN url_path = '/articles' OR url_path LIKE '/articles/%' THEN 'article'
      WHEN url_path = '/codes' OR url_path LIKE '/codes/%' THEN 'codes'
      WHEN url_path = '/wiki' OR url_path LIKE '/wiki/%' THEN 'wiki'
      WHEN url_path = '/tools' OR url_path LIKE '/tools/%' THEN 'tool'
      WHEN url_path = '/catalog' OR url_path LIKE '/catalog/%' THEN 'catalog'
      WHEN url_path = '/events' OR url_path LIKE '/events/%' THEN 'event'
      WHEN url_path = '/checklists' OR url_path LIKE '/checklists/%' THEN 'checklist'
      WHEN url_path = '/quizzes' OR url_path LIKE '/quizzes/%' THEN 'quiz'
      WHEN url_path = '/stats' OR url_path LIKE '/stats/%' THEN 'stats'
      WHEN url_path = '/' THEN 'home'
      ELSE 'other'
    END AS content_type
  FROM bounded_events e
), family AS (
  SELECT
    content_type,
    COUNT(*) FILTER (WHERE event_type = 1) AS pageviews,
    COUNT(DISTINCT visit_id) FILTER (WHERE event_type = 1) AS visits,
    COUNT(DISTINCT session_id) FILTER (WHERE event_type = 1) AS visitors,
    COUNT(DISTINCT url_path) FILTER (WHERE event_type = 1) AS viewed_paths,
    COUNT(*) FILTER (WHERE event_type = 2) AS engaged_visits
  FROM classified
  GROUP BY content_type
)
SELECT
  content_type,
  pageviews,
  ROUND(100.0 * pageviews / SUM(pageviews) OVER (), 2) AS pageview_share_pct,
  visits,
  visitors,
  viewed_paths,
  engaged_visits,
  ROUND(100.0 * engaged_visits / NULLIF(pageviews, 0), 2) AS engaged_per_pageview_pct,
  ROUND(pageviews::numeric / NULLIF(viewed_paths, 0), 1) AS pageviews_per_viewed_path
FROM family
ORDER BY pageviews DESC;

\echo family_momentum_equal_5_day_periods
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), pageviews AS (
  SELECT
    CASE
      WHEN url_path = '/articles' OR url_path LIKE '/articles/%' THEN 'article'
      WHEN url_path = '/codes' OR url_path LIKE '/codes/%' THEN 'codes'
      WHEN url_path = '/wiki' OR url_path LIKE '/wiki/%' THEN 'wiki'
      WHEN url_path = '/tools' OR url_path LIKE '/tools/%' THEN 'tool'
      WHEN url_path = '/catalog' OR url_path LIKE '/catalog/%' THEN 'catalog'
      WHEN url_path = '/events' OR url_path LIKE '/events/%' THEN 'event'
      WHEN url_path = '/checklists' OR url_path LIKE '/checklists/%' THEN 'checklist'
      WHEN url_path = '/quizzes' OR url_path LIKE '/quizzes/%' THEN 'quiz'
      WHEN url_path = '/stats' OR url_path LIKE '/stats/%' THEN 'stats'
      WHEN url_path = '/' THEN 'home'
      ELSE 'other'
    END AS content_type,
    CASE
      WHEN created_at < TIMESTAMPTZ '2026-07-16 18:30:00+00' THEN 'Jul 12-16'
      ELSE 'Jul 17-21'
    END AS period
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.event_type = 1
    AND e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
), pivoted AS (
  SELECT
    content_type,
    COUNT(*) FILTER (WHERE period = 'Jul 12-16') AS first_5d_pageviews,
    COUNT(*) FILTER (WHERE period = 'Jul 17-21') AS last_5d_pageviews
  FROM pageviews
  GROUP BY content_type
)
SELECT
  content_type,
  first_5d_pageviews,
  last_5d_pageviews,
  ROUND(100.0 * (last_5d_pageviews - first_5d_pageviews) / NULLIF(first_5d_pageviews, 0), 1) AS change_pct
FROM pivoted
ORDER BY last_5d_pageviews DESC;

\echo daily_family_performance
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), bounded_events AS (
  SELECT e.*
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
    AND (e.event_type = 1 OR (e.event_type = 2 AND e.event_name = 'engaged_visit'))
), classified AS (
  SELECT
    (created_at AT TIME ZONE 'Asia/Kolkata')::date AS local_date,
    event_type,
    CASE
      WHEN url_path = '/articles' OR url_path LIKE '/articles/%' THEN 'article'
      WHEN url_path = '/codes' OR url_path LIKE '/codes/%' THEN 'codes'
      WHEN url_path = '/wiki' OR url_path LIKE '/wiki/%' THEN 'wiki'
      WHEN url_path = '/tools' OR url_path LIKE '/tools/%' THEN 'tool'
      WHEN url_path = '/catalog' OR url_path LIKE '/catalog/%' THEN 'catalog'
      WHEN url_path = '/events' OR url_path LIKE '/events/%' THEN 'event'
      WHEN url_path = '/checklists' OR url_path LIKE '/checklists/%' THEN 'checklist'
      WHEN url_path = '/quizzes' OR url_path LIKE '/quizzes/%' THEN 'quiz'
      WHEN url_path = '/stats' OR url_path LIKE '/stats/%' THEN 'stats'
      WHEN url_path = '/' THEN 'home'
      ELSE 'other'
    END AS content_type
  FROM bounded_events
)
SELECT
  local_date,
  content_type,
  COUNT(*) FILTER (WHERE event_type = 1) AS pageviews,
  COUNT(*) FILTER (WHERE event_type = 2) AS engaged_visits
FROM classified
GROUP BY local_date, content_type
ORDER BY local_date, content_type;

\echo top_article_pages
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), bounded AS (
  SELECT e.*
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
    AND (e.url_path = '/articles' OR e.url_path LIKE '/articles/%')
    AND (e.event_type = 1 OR (e.event_type = 2 AND e.event_name = 'engaged_visit'))
)
SELECT
  url_path,
  MAX(page_title) FILTER (WHERE event_type = 1) AS page_title,
  COUNT(*) FILTER (WHERE event_type = 1) AS pageviews,
  COUNT(DISTINCT visit_id) FILTER (WHERE event_type = 1) AS visits,
  COUNT(*) FILTER (WHERE event_type = 2) AS engaged_visits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 2) / NULLIF(COUNT(*) FILTER (WHERE event_type = 1), 0), 2) AS engaged_per_pageview_pct
FROM bounded
GROUP BY url_path
ORDER BY pageviews DESC
LIMIT 20;

\echo top_non_catalog_pages
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), bounded AS (
  SELECT e.*
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
    AND e.event_type = 1
    AND NOT (e.url_path = '/catalog' OR e.url_path LIKE '/catalog/%')
)
SELECT
  url_path,
  MAX(page_title) AS page_title,
  COUNT(*) AS pageviews,
  COUNT(DISTINCT visit_id) AS visits
FROM bounded
GROUP BY url_path
ORDER BY pageviews DESC
LIMIT 30;

\echo article_referrer_mix
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
)
SELECT
  COALESCE(NULLIF(referrer_domain, ''), '(direct / unknown)') AS referrer,
  COUNT(*) AS article_pageviews,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS share_pct
FROM website_event e
JOIN selected_website w USING (website_id)
WHERE e.event_type = 1
  AND e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
  AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
  AND (e.url_path = '/articles' OR e.url_path LIKE '/articles/%')
GROUP BY COALESCE(NULLIF(referrer_domain, ''), '(direct / unknown)')
ORDER BY article_pageviews DESC
LIMIT 15;

\echo engagement_event_data_quality
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), engaged AS (
  SELECT e.event_id, e.url_path,
    CASE
      WHEN url_path = '/articles' OR url_path LIKE '/articles/%' THEN 'article'
      WHEN url_path = '/codes' OR url_path LIKE '/codes/%' THEN 'codes'
      WHEN url_path = '/wiki' OR url_path LIKE '/wiki/%' THEN 'wiki'
      WHEN url_path = '/tools' OR url_path LIKE '/tools/%' THEN 'tool'
      WHEN url_path = '/catalog' OR url_path LIKE '/catalog/%' THEN 'catalog'
      WHEN url_path = '/events' OR url_path LIKE '/events/%' THEN 'event'
      WHEN url_path = '/checklists' OR url_path LIKE '/checklists/%' THEN 'checklist'
      WHEN url_path = '/quizzes' OR url_path LIKE '/quizzes/%' THEN 'quiz'
      WHEN url_path = '/stats' OR url_path LIKE '/stats/%' THEN 'stats'
      WHEN url_path = '/' THEN 'home'
      ELSE 'other'
    END AS url_content_type
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.event_type = 2
    AND e.event_name = 'engaged_visit'
    AND e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
), typed AS (
  SELECT engaged.*, d.string_value AS event_content_type
  FROM engaged
  LEFT JOIN event_data d
    ON d.website_event_id = engaged.event_id
   AND d.data_key = 'content_type'
)
SELECT
  COUNT(*) AS engaged_events,
  COUNT(*) FILTER (WHERE event_content_type IS NULL) AS missing_content_type,
  COUNT(*) FILTER (WHERE event_content_type IS DISTINCT FROM url_content_type) AS mismatched_content_type
FROM typed;

\echo daily_engagement_concentration
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), per_session_day AS (
  SELECT
    (e.created_at AT TIME ZONE 'Asia/Kolkata')::date AS local_date,
    e.session_id,
    COUNT(*) FILTER (WHERE e.event_type = 1) AS pageviews,
    COUNT(*) FILTER (WHERE e.event_type = 2 AND e.event_name = 'engaged_visit') AS engaged_visits
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
    AND (e.event_type = 1 OR (e.event_type = 2 AND e.event_name = 'engaged_visit'))
  GROUP BY local_date, e.session_id
)
SELECT
  local_date,
  SUM(pageviews) AS pageviews,
  SUM(engaged_visits) AS engaged_visits,
  COUNT(*) FILTER (WHERE engaged_visits > 0) AS engaged_sessions,
  ROUND(SUM(engaged_visits)::numeric / NULLIF(COUNT(*) FILTER (WHERE engaged_visits > 0), 0), 2) AS engaged_events_per_engaged_session,
  MAX(engaged_visits) AS max_engaged_events_one_session
FROM per_session_day
GROUP BY local_date
ORDER BY local_date;

\echo july_16_engaged_session_buckets
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), per_session AS (
  SELECT e.session_id, COUNT(*) AS engaged_visits
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.event_type = 2
    AND e.event_name = 'engaged_visit'
    AND e.created_at >= TIMESTAMPTZ '2026-07-15 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-16 18:30:00+00'
  GROUP BY e.session_id
)
SELECT
  CASE
    WHEN engaged_visits = 1 THEN '1'
    WHEN engaged_visits BETWEEN 2 AND 4 THEN '2-4'
    WHEN engaged_visits BETWEEN 5 AND 9 THEN '5-9'
    WHEN engaged_visits BETWEEN 10 AND 24 THEN '10-24'
    ELSE '25+'
  END AS engaged_events_per_session_bucket,
  COUNT(*) AS sessions,
  SUM(engaged_visits) AS engaged_events
FROM per_session
GROUP BY 1
ORDER BY MIN(engaged_visits);

\echo july_16_engaged_country_device_mix
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
)
SELECT
  COALESCE(s.country, '--') AS country,
  COALESCE(s.device, '(unknown)') AS device,
  COALESCE(s.browser, '(unknown)') AS browser,
  COUNT(*) AS engaged_events,
  COUNT(DISTINCT e.session_id) AS sessions
FROM website_event e
JOIN selected_website w USING (website_id)
JOIN session s ON s.session_id = e.session_id
WHERE e.event_type = 2
  AND e.event_name = 'engaged_visit'
  AND e.created_at >= TIMESTAMPTZ '2026-07-15 18:30:00+00'
  AND e.created_at <  TIMESTAMPTZ '2026-07-16 18:30:00+00'
GROUP BY 1,2,3
ORDER BY engaged_events DESC
LIMIT 20;

\echo family_performance_excluding_july_16_anomaly
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), bounded_events AS (
  SELECT e.*
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
    AND NOT (e.created_at >= TIMESTAMPTZ '2026-07-15 18:30:00+00'
             AND e.created_at < TIMESTAMPTZ '2026-07-16 18:30:00+00')
    AND (e.event_type = 1 OR (e.event_type = 2 AND e.event_name = 'engaged_visit'))
), classified AS (
  SELECT
    event_type,
    CASE
      WHEN url_path = '/articles' OR url_path LIKE '/articles/%' THEN 'article'
      WHEN url_path = '/codes' OR url_path LIKE '/codes/%' THEN 'codes'
      WHEN url_path = '/wiki' OR url_path LIKE '/wiki/%' THEN 'wiki'
      WHEN url_path = '/tools' OR url_path LIKE '/tools/%' THEN 'tool'
      WHEN url_path = '/catalog' OR url_path LIKE '/catalog/%' THEN 'catalog'
      WHEN url_path = '/events' OR url_path LIKE '/events/%' THEN 'event'
      WHEN url_path = '/checklists' OR url_path LIKE '/checklists/%' THEN 'checklist'
      WHEN url_path = '/quizzes' OR url_path LIKE '/quizzes/%' THEN 'quiz'
      WHEN url_path = '/stats' OR url_path LIKE '/stats/%' THEN 'stats'
      WHEN url_path = '/' THEN 'home'
      ELSE 'other'
    END AS content_type
  FROM bounded_events
)
SELECT
  content_type,
  COUNT(*) FILTER (WHERE event_type = 1) AS pageviews,
  COUNT(*) FILTER (WHERE event_type = 2) AS engaged_visits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 2) /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 1), 0), 2) AS engaged_per_pageview_pct
FROM classified
GROUP BY content_type
ORDER BY pageviews DESC;

\echo article_pageview_concentration
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), per_path AS (
  SELECT e.url_path, COUNT(*) AS pageviews
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.event_type = 1
    AND e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
    AND (e.url_path = '/articles' OR e.url_path LIKE '/articles/%')
  GROUP BY e.url_path
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY pageviews DESC) AS rank
  FROM per_path
)
SELECT
  COUNT(*) AS viewed_article_paths,
  SUM(pageviews) AS article_pageviews,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pageviews)::numeric, 1) AS median_pageviews_per_path,
  ROUND(100.0 * SUM(pageviews) FILTER (WHERE rank <= 5) / SUM(pageviews), 2) AS top_5_share_pct,
  ROUND(100.0 * SUM(pageviews) FILTER (WHERE rank <= 10) / SUM(pageviews), 2) AS top_10_share_pct
FROM ranked;

\echo daily_singapore_laptop_chrome_engagement
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
)
SELECT
  (e.created_at AT TIME ZONE 'Asia/Kolkata')::date AS local_date,
  COUNT(*) AS engaged_events,
  COUNT(DISTINCT e.session_id) AS sessions
FROM website_event e
JOIN selected_website w USING (website_id)
JOIN session s ON s.session_id = e.session_id
WHERE e.event_type = 2
  AND e.event_name = 'engaged_visit'
  AND e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
  AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
  AND s.country = 'SG'
  AND s.device = 'laptop'
  AND s.browser = 'chrome'
GROUP BY local_date
ORDER BY local_date;

\echo article_detail_performance_excluding_july_16_anomaly
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
)
SELECT
  COUNT(*) FILTER (WHERE e.event_type = 1) AS article_detail_pageviews,
  COUNT(*) FILTER (WHERE e.event_type = 2) AS engaged_visits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE e.event_type = 2) /
    NULLIF(COUNT(*) FILTER (WHERE e.event_type = 1), 0), 2) AS engaged_per_pageview_pct
FROM website_event e
JOIN selected_website w USING (website_id)
WHERE e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
  AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
  AND NOT (e.created_at >= TIMESTAMPTZ '2026-07-15 18:30:00+00'
           AND e.created_at < TIMESTAMPTZ '2026-07-16 18:30:00+00')
  AND e.url_path LIKE '/articles/%'
  AND (e.event_type = 1 OR (e.event_type = 2 AND e.event_name = 'engaged_visit'));

\echo article_referrer_groups
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
), classified AS (
  SELECT
    CASE
      WHEN referrer_domain IS NULL OR referrer_domain = '' THEN 'direct / unknown'
      WHEN referrer_domain = 'bloxodes.com' OR referrer_domain = 'www.bloxodes.com' THEN 'internal'
      WHEN referrer_domain LIKE '%google%'
        OR referrer_domain LIKE '%bing%'
        OR referrer_domain LIKE '%yahoo%'
        OR referrer_domain LIKE '%duckduckgo%'
        OR referrer_domain LIKE '%yandex%'
        OR referrer_domain LIKE '%ecosia%'
        OR referrer_domain LIKE '%brave%' THEN 'search'
      WHEN referrer_domain IN ('tiktok.com','www.tiktok.com','facebook.com','www.facebook.com','x.com','twitter.com','reddit.com','www.reddit.com') THEN 'social'
      WHEN referrer_domain IN ('chatgpt.com','perplexity.ai','www.perplexity.ai','gemini.google.com') THEN 'AI assistant'
      ELSE 'other external'
    END AS referrer_group
  FROM website_event e
  JOIN selected_website w USING (website_id)
  WHERE e.event_type = 1
    AND e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
    AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
    AND (e.url_path = '/articles' OR e.url_path LIKE '/articles/%')
)
SELECT
  referrer_group,
  COUNT(*) AS article_pageviews,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS share_pct
FROM classified
GROUP BY referrer_group
ORDER BY article_pageviews DESC;

\echo top_article_details_excluding_july_16_anomaly
WITH selected_website AS (
  SELECT website_id FROM website WHERE domain = 'bloxodes.com' AND deleted_at IS NULL
)
SELECT
  e.url_path,
  MAX(e.page_title) FILTER (WHERE e.event_type = 1) AS page_title,
  COUNT(*) FILTER (WHERE e.event_type = 1) AS pageviews,
  COUNT(*) FILTER (WHERE e.event_type = 2) AS engaged_visits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE e.event_type = 2) /
    NULLIF(COUNT(*) FILTER (WHERE e.event_type = 1), 0), 2) AS engaged_per_pageview_pct
FROM website_event e
JOIN selected_website w USING (website_id)
WHERE e.created_at >= TIMESTAMPTZ '2026-07-11 18:30:00+00'
  AND e.created_at <  TIMESTAMPTZ '2026-07-21 18:30:00+00'
  AND NOT (e.created_at >= TIMESTAMPTZ '2026-07-15 18:30:00+00'
           AND e.created_at < TIMESTAMPTZ '2026-07-16 18:30:00+00')
  AND e.url_path LIKE '/articles/%'
  AND (e.event_type = 1 OR (e.event_type = 2 AND e.event_name = 'engaged_visit'))
GROUP BY e.url_path
ORDER BY pageviews DESC
LIMIT 15;
