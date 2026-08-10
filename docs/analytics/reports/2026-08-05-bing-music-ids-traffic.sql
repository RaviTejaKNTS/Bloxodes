-- Reproducible SQLite queries for the Bing music IDs traffic diagnostic.
-- Run from the Bloxodes repository root:
-- sqlite3 ':memory:' < docs/analytics/reports/2026-08-05-bing-music-ids-traffic.sql

CREATE TEMP VIEW source_snapshot AS
SELECT CAST(readfile('docs/analytics/reports/2026-08-05-bing-music-ids-traffic-data.json') AS TEXT) AS payload;

CREATE TEMP VIEW page_weekly AS
SELECT
  json_extract(value, '$.week') AS week,
  json_extract(value, '$.clicks') AS clicks,
  json_extract(value, '$.impressions') AS impressions,
  json_extract(value, '$.ctr') AS ctr,
  json_extract(value, '$.avg_impression_position') AS avg_impression_position
FROM source_snapshot, json_each(json_extract(payload, '$.page_weekly'));

CREATE TEMP VIEW page_query_weekly AS
SELECT
  json_extract(value, '$.week') AS week,
  json_extract(value, '$.query') AS query,
  json_extract(value, '$.clicks') AS clicks,
  json_extract(value, '$.impressions') AS impressions,
  json_extract(value, '$.avg_impression_position') AS avg_impression_position
FROM source_snapshot, json_each(json_extract(payload, '$.page_query_weekly'));

CREATE TEMP VIEW keyword_demand_weekly AS
SELECT
  json_extract(value, '$.week') AS week,
  json_extract(value, '$.query') AS query,
  json_extract(value, '$.exact_impressions') AS exact_impressions,
  json_extract(value, '$.broad_impressions') AS broad_impressions
FROM source_snapshot, json_each(json_extract(payload, '$.keyword_demand_weekly'));

CREATE TEMP VIEW site_daily AS
SELECT
  json_extract(value, '$.date') AS date,
  json_extract(value, '$.clicks') AS clicks,
  json_extract(value, '$.impressions') AS impressions,
  json_extract(value, '$.ctr') AS ctr
FROM source_snapshot, json_each(json_extract(payload, '$.site_daily'));

-- Weekly page trend used by the report line chart.
SELECT week, clicks, impressions, ctr, avg_impression_position
FROM page_weekly
WHERE week BETWEEN '2026-05-01' AND '2026-07-31'
ORDER BY week;

-- Equal-window headline metrics.
WITH period_totals AS (
  SELECT
    CASE
      WHEN week IN ('2026-06-12', '2026-06-19') THEN 'baseline'
      WHEN week IN ('2026-07-24', '2026-07-31') THEN 'latest'
    END AS period,
    AVG(clicks) AS weekly_clicks,
    AVG(impressions) AS weekly_impressions,
    SUM(clicks) * 1.0 / SUM(impressions) AS ctr,
    SUM(avg_impression_position * impressions) * 1.0 / SUM(impressions) AS avg_position
  FROM page_weekly
  WHERE week IN ('2026-06-12', '2026-06-19', '2026-07-24', '2026-07-31')
  GROUP BY period
)
SELECT * FROM period_totals ORDER BY period;

-- Additive click-loss decomposition: symmetric split between impressions and CTR.
WITH periods AS (
  SELECT
    CASE
      WHEN week IN ('2026-06-12', '2026-06-19') THEN 'baseline'
      ELSE 'latest'
    END AS period,
    AVG(clicks) AS clicks,
    AVG(impressions) AS impressions,
    SUM(clicks) * 1.0 / SUM(impressions) AS ctr
  FROM page_weekly
  WHERE week IN ('2026-06-12', '2026-06-19', '2026-07-24', '2026-07-31')
  GROUP BY period
), paired AS (
  SELECT
    b.clicks AS baseline_clicks,
    b.impressions AS baseline_impressions,
    b.ctr AS baseline_ctr,
    l.clicks AS latest_clicks,
    l.impressions AS latest_impressions,
    l.ctr AS latest_ctr
  FROM periods b CROSS JOIN periods l
  WHERE b.period = 'baseline' AND l.period = 'latest'
)
SELECT
  'Fewer impressions' AS driver,
  -1 * (latest_impressions - baseline_impressions) * (baseline_ctr + latest_ctr) / 2 AS lost_weekly_clicks
FROM paired
UNION ALL
SELECT
  'Lower CTR' AS driver,
  -1 * (latest_ctr - baseline_ctr) * (baseline_impressions + latest_impressions) / 2 AS lost_weekly_clicks
FROM paired;

-- Returned top queries versus the residual long tail.
WITH page_periods AS (
  SELECT
    CASE
      WHEN week IN ('2026-06-12', '2026-06-19') THEN 'June 12/19 baseline'
      ELSE 'July 24/31 latest'
    END AS period,
    AVG(clicks) AS page_clicks,
    AVG(impressions) AS page_impressions
  FROM page_weekly
  WHERE week IN ('2026-06-12', '2026-06-19', '2026-07-24', '2026-07-31')
  GROUP BY period
), query_periods AS (
  SELECT
    CASE
      WHEN week IN ('2026-06-12', '2026-06-19') THEN 'June 12/19 baseline'
      ELSE 'July 24/31 latest'
    END AS period,
    SUM(clicks) / 2.0 AS query_clicks,
    SUM(impressions) / 2.0 AS query_impressions
  FROM page_query_weekly
  WHERE week IN ('2026-06-12', '2026-06-19', '2026-07-24', '2026-07-31')
  GROUP BY period
)
SELECT
  p.period,
  'Reported top queries' AS segment,
  q.query_clicks AS weekly_clicks,
  q.query_impressions AS weekly_impressions,
  q.query_clicks / q.query_impressions AS ctr
FROM page_periods p JOIN query_periods q USING (period)
UNION ALL
SELECT
  p.period,
  'Residual long tail' AS segment,
  p.page_clicks - q.query_clicks AS weekly_clicks,
  p.page_impressions - q.query_impressions AS weekly_impressions,
  (p.page_clicks - q.query_clicks) / (p.page_impressions - q.query_impressions) AS ctr
FROM page_periods p JOIN query_periods q USING (period)
ORDER BY period, segment;

-- Global/unspecified-market exact-query demand for eight fixed core terms.
WITH demand AS (
  SELECT
    query,
    CASE
      WHEN week IN ('2026-06-13', '2026-06-20') THEN 'Mid-June baseline'
      WHEN week = '2026-06-27' THEN 'June 27 peak'
      WHEN week IN ('2026-07-25', '2026-08-01') THEN 'Latest'
    END AS period,
    AVG(exact_impressions) AS exact_searches
  FROM keyword_demand_weekly
  WHERE week IN ('2026-06-13', '2026-06-20', '2026-06-27', '2026-07-25', '2026-08-01')
  GROUP BY query, period
)
SELECT query, period, exact_searches
FROM demand
ORDER BY query,
  CASE period WHEN 'Mid-June baseline' THEN 1 WHEN 'June 27 peak' THEN 2 ELSE 3 END;

-- Named secondary query movers; low-volume anomalies are excluded.
WITH query_periods AS (
  SELECT
    query,
    CASE
      WHEN week IN ('2026-06-12', '2026-06-19') THEN 'baseline'
      ELSE 'latest'
    END AS period,
    SUM(clicks) / 2.0 AS weekly_clicks,
    SUM(impressions) / 2.0 AS weekly_impressions,
    SUM(clicks) * 1.0 / SUM(impressions) AS ctr,
    SUM(avg_impression_position * impressions) * 1.0 / SUM(impressions) AS avg_position
  FROM page_query_weekly
  WHERE week IN ('2026-06-12', '2026-06-19', '2026-07-24', '2026-07-31')
  GROUP BY query, period
), paired AS (
  SELECT
    b.query,
    b.weekly_clicks AS baseline_weekly_clicks,
    l.weekly_clicks AS latest_weekly_clicks,
    l.weekly_clicks - b.weekly_clicks AS click_change,
    b.weekly_impressions AS baseline_weekly_impressions,
    l.weekly_impressions AS latest_weekly_impressions,
    b.ctr AS baseline_ctr,
    l.ctr AS latest_ctr,
    b.avg_position AS baseline_position,
    l.avg_position AS latest_position,
    l.avg_position - b.avg_position AS position_change
  FROM query_periods b JOIN query_periods l USING (query)
  WHERE b.period = 'baseline' AND l.period = 'latest'
)
SELECT *
FROM paired
WHERE baseline_weekly_impressions >= 40
  AND latest_weekly_impressions >= 40
  AND (click_change <= -10 OR position_change >= 0.5)
ORDER BY click_change ASC
LIMIT 12;

-- Site-wide context using equal 14-day windows aligned to the page buckets.
SELECT
  CASE
    WHEN date BETWEEN '2026-06-06' AND '2026-06-19' THEN 'June-aligned 14 days'
    ELSE 'Latest-aligned 14 days'
  END AS period,
  SUM(clicks) AS clicks,
  SUM(impressions) AS impressions,
  SUM(clicks) * 1.0 / SUM(impressions) AS ctr
FROM site_daily
WHERE date BETWEEN '2026-06-06' AND '2026-06-19'
   OR date BETWEEN '2026-07-18' AND '2026-07-31'
GROUP BY period
ORDER BY period;

-- Final audit: the two loss drivers must reconcile to the observed click gap.
WITH periods AS (
  SELECT
    CASE WHEN week IN ('2026-06-12', '2026-06-19') THEN 'baseline' ELSE 'latest' END AS period,
    AVG(clicks) AS clicks,
    AVG(impressions) AS impressions,
    SUM(clicks) * 1.0 / SUM(impressions) AS ctr
  FROM page_weekly
  WHERE week IN ('2026-06-12', '2026-06-19', '2026-07-24', '2026-07-31')
  GROUP BY period
), paired AS (
  SELECT
    b.clicks AS baseline_clicks,
    b.impressions AS baseline_impressions,
    b.ctr AS baseline_ctr,
    l.clicks AS latest_clicks,
    l.impressions AS latest_impressions,
    l.ctr AS latest_ctr
  FROM periods b CROSS JOIN periods l
  WHERE b.period = 'baseline' AND l.period = 'latest'
)
SELECT
  latest_clicks - baseline_clicks AS observed_click_change,
  (latest_impressions - baseline_impressions) * (baseline_ctr + latest_ctr) / 2
    + (latest_ctr - baseline_ctr) * (baseline_impressions + latest_impressions) / 2 AS decomposed_click_change,
  ABS(
    (latest_clicks - baseline_clicks)
    - ((latest_impressions - baseline_impressions) * (baseline_ctr + latest_ctr) / 2
      + (latest_ctr - baseline_ctr) * (baseline_impressions + latest_impressions) / 2)
  ) < 0.000001 AS reconciles
FROM paired;
