#!/usr/bin/env python3
"""Build and analyze the August 2026 Bing music IDs traffic snapshot.

The input files are read-only JSON responses captured from Bing Webmaster API.
The generated data file contains aggregate weekly page/query metrics only. It
does not contain an API key, visitor-level rows, or request URLs with secrets.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any


REPORT_STEM = "2026-08-05-bing-music-ids-traffic"
PAGE_URL = "https://bloxodes.com/catalog/roblox-music-ids"
BASELINE_WEEKS = {"2026-06-12", "2026-06-19"}
LATEST_WEEKS = {"2026-07-24", "2026-07-31"}
PEAK_WEEK = {"2026-06-26"}
BASELINE_DEMAND_WEEKS = {"2026-06-13", "2026-06-20"}
LATEST_DEMAND_WEEKS = {"2026-07-25", "2026-08-01"}
PEAK_DEMAND_WEEK = {"2026-06-27"}
SITE_BASELINE_START = "2026-06-06"
SITE_BASELINE_END = "2026-06-19"
SITE_LATEST_START = "2026-07-18"
SITE_LATEST_END = "2026-07-31"
CORE_QUERIES = {
    "roblox id",
    "roblox music codes",
    "roblox music id",
    "roblox music ids",
    "roblox song id",
    "roblox song ids",
    "roblox sound id",
    "roblox sound ids",
}


def bing_date(raw: str) -> str:
    match = re.search(r"/Date\((\d+)", raw)
    if not match:
        raise ValueError(f"Unsupported Bing date: {raw}")
    stamp = int(match.group(1)) / 1000
    return dt.datetime.fromtimestamp(stamp, dt.timezone.utc).date().isoformat()


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def normalize_query_stats(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "week": bing_date(row["Date"]),
            "query": row["Query"].strip().lower(),
            "clicks": row["Clicks"],
            "impressions": row["Impressions"],
            "avg_impression_position": row["AvgImpressionPosition"],
        }
        for row in rows
    ]


def build_snapshot(temp_dir: Path) -> dict[str, Any]:
    page_rows = normalize_query_stats(load_json(temp_dir / "bing-page-stats.json")["d"])
    page_rows = [
        {
            "week": row["week"],
            "clicks": row["clicks"],
            "impressions": row["impressions"],
            "ctr": row["clicks"] / row["impressions"] if row["impressions"] else 0,
            "avg_impression_position": row["avg_impression_position"],
        }
        for row in page_rows
        if row["query"] == PAGE_URL
    ]

    query_rows = normalize_query_stats(
        load_json(temp_dir / "bing-music-page-query-stats.json")["d"]
    )

    site_daily = [
        {
            "date": bing_date(row["Date"]),
            "clicks": row["Clicks"],
            "impressions": row["Impressions"],
            "ctr": row["Clicks"] / row["Impressions"] if row["Impressions"] else 0,
        }
        for row in load_json(temp_dir / "bing-site-rank-traffic.json")["d"]
    ]

    demand_rows: list[dict[str, Any]] = []
    for query in sorted(CORE_QUERIES):
        slug = query.replace(" ", "-")
        rows = load_json(temp_dir / f"bing-keyword-{slug}.json")["d"]
        demand_rows.extend(
            {
                "week": bing_date(row["Date"]),
                "query": row["Query"].strip().lower(),
                "exact_impressions": row["Impressions"],
                "broad_impressions": row["BroadImpressions"],
            }
            for row in rows
        )

    url_info = load_json(temp_dir / "bing-music-url-info.json")["d"]
    current_index_status = {
        "is_page": url_info["IsPage"],
        "last_crawled_at_utc": dt.datetime.fromtimestamp(
            int(re.search(r"\d+", url_info["LastCrawledDate"]).group()) / 1000,
            dt.timezone.utc,
        ).isoformat(),
        "document_size_bytes": url_info["DocumentSize"],
        "anchor_count": url_info["AnchorCount"],
    }

    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "page_url": PAGE_URL,
        "source": "Bing Webmaster API aggregate weekly exports",
        "page_weekly": sorted(page_rows, key=lambda row: row["week"]),
        "page_query_weekly": sorted(
            query_rows, key=lambda row: (row["week"], row["query"])
        ),
        "site_daily": sorted(site_daily, key=lambda row: row["date"]),
        "keyword_demand_weekly": sorted(
            demand_rows, key=lambda row: (row["week"], row["query"])
        ),
        "current_index_status": current_index_status,
        "live_indexing_signals": {
            "http_status": 200,
            "robots_meta": "index, follow",
            "canonical": PAGE_URL,
            "listed_in_catalog_sitemap": True,
            "robots_txt_blocks_page": False,
        },
    }


def page_window(rows: list[dict[str, Any]], weeks: set[str]) -> dict[str, float]:
    selected = [row for row in rows if row["week"] in weeks]
    clicks = sum(row["clicks"] for row in selected) / len(weeks)
    impressions = sum(row["impressions"] for row in selected) / len(weeks)
    weighted_position = sum(
        row["avg_impression_position"] * row["impressions"] for row in selected
    ) / sum(row["impressions"] for row in selected)
    return {
        "weekly_clicks": clicks,
        "weekly_impressions": impressions,
        "ctr": clicks / impressions,
        "avg_impression_position": weighted_position,
    }


def query_window(
    rows: list[dict[str, Any]], weeks: set[str], queries: set[str] | None = None
) -> dict[str, Any]:
    selected = [
        row
        for row in rows
        if row["week"] in weeks and (queries is None or row["query"] in queries)
    ]
    clicks = sum(row["clicks"] for row in selected) / len(weeks)
    impressions = sum(row["impressions"] for row in selected) / len(weeks)
    weighted_position = (
        sum(row["avg_impression_position"] * row["impressions"] for row in selected)
        / sum(row["impressions"] for row in selected)
        if impressions
        else None
    )
    return {
        "weekly_clicks": clicks,
        "weekly_impressions": impressions,
        "ctr": clicks / impressions if impressions else None,
        "avg_impression_position": weighted_position,
        "query_count": len({row["query"] for row in selected}),
    }


def demand_window(rows: list[dict[str, Any]], weeks: set[str]) -> dict[str, float]:
    selected = [row for row in rows if row["week"] in weeks]
    return {
        "weekly_exact_impressions": sum(row["exact_impressions"] for row in selected)
        / len(weeks),
        "weekly_broad_impressions": sum(row["broad_impressions"] for row in selected)
        / len(weeks),
    }


def site_window(
    rows: list[dict[str, Any]], start: str, end: str
) -> dict[str, float]:
    selected = [row for row in rows if start <= row["date"] <= end]
    clicks = sum(row["clicks"] for row in selected)
    impressions = sum(row["impressions"] for row in selected)
    return {
        "days": len(selected),
        "clicks": clicks,
        "impressions": impressions,
        "ctr": clicks / impressions if impressions else 0,
    }


def aggregate_queries(
    rows: list[dict[str, Any]], weeks: set[str]
) -> dict[str, dict[str, float]]:
    result: dict[str, dict[str, float]] = defaultdict(
        lambda: {"clicks": 0, "impressions": 0, "weighted_position": 0}
    )
    for row in rows:
        if row["week"] not in weeks:
            continue
        item = result[row["query"]]
        item["clicks"] += row["clicks"] / len(weeks)
        item["impressions"] += row["impressions"] / len(weeks)
        item["weighted_position"] += (
            row["avg_impression_position"] * row["impressions"] / len(weeks)
        )
    for item in result.values():
        item["ctr"] = item["clicks"] / item["impressions"] if item["impressions"] else 0
        item["avg_impression_position"] = (
            item["weighted_position"] / item["impressions"]
            if item["impressions"]
            else None
        )
    return result


def analyze(data: dict[str, Any]) -> dict[str, Any]:
    page_rows = data["page_weekly"]
    query_rows = data["page_query_weekly"]
    demand_rows = data["keyword_demand_weekly"]
    site_rows = data["site_daily"]

    baseline = page_window(page_rows, BASELINE_WEEKS)
    latest = page_window(page_rows, LATEST_WEEKS)
    peak = page_window(page_rows, PEAK_WEEK)

    total_click_change = latest["weekly_clicks"] - baseline["weekly_clicks"]
    impression_effect = (
        (latest["weekly_impressions"] - baseline["weekly_impressions"])
        * (baseline["ctr"] + latest["ctr"])
        / 2
    )
    ctr_effect = (
        (latest["ctr"] - baseline["ctr"])
        * (baseline["weekly_impressions"] + latest["weekly_impressions"])
        / 2
    )

    top_baseline = query_window(query_rows, BASELINE_WEEKS)
    top_latest = query_window(query_rows, LATEST_WEEKS)
    residual_baseline = {
        "weekly_clicks": baseline["weekly_clicks"] - top_baseline["weekly_clicks"],
        "weekly_impressions": baseline["weekly_impressions"]
        - top_baseline["weekly_impressions"],
    }
    residual_latest = {
        "weekly_clicks": latest["weekly_clicks"] - top_latest["weekly_clicks"],
        "weekly_impressions": latest["weekly_impressions"]
        - top_latest["weekly_impressions"],
    }
    for item in (residual_baseline, residual_latest):
        item["ctr"] = item["weekly_clicks"] / item["weekly_impressions"]

    core_page_baseline = query_window(query_rows, BASELINE_WEEKS, CORE_QUERIES)
    core_page_latest = query_window(query_rows, LATEST_WEEKS, CORE_QUERIES)
    demand_baseline = demand_window(demand_rows, BASELINE_DEMAND_WEEKS)
    demand_latest = demand_window(demand_rows, LATEST_DEMAND_WEEKS)
    demand_peak = demand_window(demand_rows, PEAK_DEMAND_WEEK)
    site_baseline = site_window(
        site_rows, SITE_BASELINE_START, SITE_BASELINE_END
    )
    site_latest = site_window(site_rows, SITE_LATEST_START, SITE_LATEST_END)

    baseline_queries = aggregate_queries(query_rows, BASELINE_WEEKS)
    latest_queries = aggregate_queries(query_rows, LATEST_WEEKS)
    movers: list[dict[str, Any]] = []
    for query in sorted(set(baseline_queries) & set(latest_queries)):
        before = baseline_queries[query]
        after = latest_queries[query]
        if before["impressions"] < 40 or after["impressions"] < 40:
            continue
        position_change = (
            after["avg_impression_position"] - before["avg_impression_position"]
        )
        if position_change < 0.5 and before["clicks"] - after["clicks"] < 10:
            continue
        movers.append(
            {
                "query": query,
                "baseline_weekly_clicks": before["clicks"],
                "latest_weekly_clicks": after["clicks"],
                "click_change": after["clicks"] - before["clicks"],
                "baseline_weekly_impressions": before["impressions"],
                "latest_weekly_impressions": after["impressions"],
                "baseline_ctr": before["ctr"],
                "latest_ctr": after["ctr"],
                "baseline_position": before["avg_impression_position"],
                "latest_position": after["avg_impression_position"],
                "position_change": position_change,
            }
        )
    movers.sort(key=lambda row: row["click_change"])

    return {
        "baseline": baseline,
        "latest": latest,
        "peak": peak,
        "overall_change": {
            "weekly_click_change": total_click_change,
            "weekly_click_change_pct": total_click_change / baseline["weekly_clicks"],
            "weekly_impression_change_pct": (
                latest["weekly_impressions"] / baseline["weekly_impressions"] - 1
            ),
            "ctr_change_points": latest["ctr"] - baseline["ctr"],
            "position_change": latest["avg_impression_position"]
            - baseline["avg_impression_position"],
        },
        "click_loss_decomposition": {
            "fewer_impressions_click_effect": impression_effect,
            "lower_ctr_click_effect": ctr_effect,
            "fewer_impressions_share": impression_effect / total_click_change,
            "lower_ctr_share": ctr_effect / total_click_change,
        },
        "top_query_extract": {"baseline": top_baseline, "latest": top_latest},
        "residual_long_tail": {
            "baseline": residual_baseline,
            "latest": residual_latest,
            "click_change_pct": residual_latest["weekly_clicks"]
            / residual_baseline["weekly_clicks"]
            - 1,
            "impression_change_pct": residual_latest["weekly_impressions"]
            / residual_baseline["weekly_impressions"]
            - 1,
            "ctr_change_points": residual_latest["ctr"] - residual_baseline["ctr"],
            "share_of_total_click_loss": (
                residual_latest["weekly_clicks"] - residual_baseline["weekly_clicks"]
            )
            / total_click_change,
        },
        "core_queries": {
            "page_baseline": core_page_baseline,
            "page_latest": core_page_latest,
            "demand_baseline": demand_baseline,
            "demand_latest": demand_latest,
            "demand_peak": demand_peak,
        },
        "site_context": {
            "baseline": site_baseline,
            "latest": site_latest,
            "click_change_pct": site_latest["clicks"] / site_baseline["clicks"] - 1,
            "impression_change_pct": site_latest["impressions"]
            / site_baseline["impressions"]
            - 1,
            "ctr_change_points": site_latest["ctr"] - site_baseline["ctr"],
        },
        "ranking_movers": movers[:12],
        "query_set_counts": {
            "baseline_observed": len(baseline_queries),
            "latest_observed": len(latest_queries),
            "stable_observed": len(set(baseline_queries) & set(latest_queries)),
        },
    }


def build_notebook(path: Path, data_path: Path, results: dict[str, Any]) -> None:
    overall = results["overall_change"]
    long_tail = results["residual_long_tail"]
    summary = (
        f"The latest stable weeks averaged {results['latest']['weekly_clicks']:,.0f} Bing "
        f"clicks, {overall['weekly_click_change_pct']:.1%} below the June 12/19 baseline. "
        f"Impressions were {overall['weekly_impression_change_pct']:.1%} lower and CTR "
        f"fell {overall['ctr_change_points']:.2%} points. The residual long tail lost "
        f"{abs(long_tail['click_change_pct']):.1%} of clicks while the reported top-query "
        "extract grew, so the persistent problem is concentrated outside the head terms."
    )
    cells = [
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": ["## tl;dr\n", summary],
        },
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "## Context & Methods\n",
                "This diagnostic compares the equal two-week Bing buckets dated June 12/19 with July 24/31, 2026. The June 26 peak and July 10 incident are shown separately.\n\n",
                "### Key Assumptions\n",
                "Bing's page/query endpoints are weekly and top-query limited. The difference between page totals and reported top queries is treated as a residual long tail, not as a list of individually observed queries.\n",
            ],
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "from pathlib import Path\n",
                "import json, runpy\n",
                f"data_path = Path({str(data_path)!r})\n",
                f"analysis_path = Path({str(path.with_name(REPORT_STEM + '-analysis.py'))!r})\n",
                "module = runpy.run_path(str(analysis_path))\n",
                "data = json.loads(data_path.read_text())\n",
                "results = module['analyze'](data)\n",
            ],
        },
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": ["## Data\n", "Credential-free aggregate Bing Webmaster snapshot.\n"],
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "{\n",
                "  'page_weeks': len(data['page_weekly']),\n",
                "  'page_query_rows': len(data['page_query_weekly']),\n",
                "  'site_days': len(data['site_daily']),\n",
                "  'keyword_demand_rows': len(data['keyword_demand_weekly']),\n",
                "  'data_through': max(row['week'] for row in data['keyword_demand_weekly']),\n",
                "}\n",
            ],
        },
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": ["## Results\n", "The dictionaries below reproduce the report's equal-window comparisons and driver decomposition.\n"],
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "{key: results[key] for key in [\n",
                "    'baseline', 'latest', 'peak', 'overall_change',\n",
                "    'click_loss_decomposition', 'top_query_extract',\n",
                "    'residual_long_tail', 'core_queries', 'query_set_counts'\n",
                "    , 'site_context'\n",
                "]}\n",
            ],
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": ["results['ranking_movers']\n"],
        },
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "## Takeaways\n",
                "- The July indexing incident was sharp but temporary; the page recovered most headline-query visibility.\n",
                "- The lasting loss is split between fewer impressions and lower CTR, and it is concentrated in the residual long tail.\n",
                "- Core exact-query demand is below the June 27 peak, but the page's core-query impressions and clicks improved versus mid-June.\n",
            ],
        },
    ]
    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "version": "3"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    path.write_text(json.dumps(notebook, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--temp-dir", type=Path, default=Path("/tmp"))
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).parent)
    parser.add_argument("--build-snapshot", action="store_true")
    args = parser.parse_args()

    data_path = args.output_dir / f"{REPORT_STEM}-data.json"
    notebook_path = args.output_dir / f"{REPORT_STEM}.ipynb"
    if args.build_snapshot:
        snapshot = build_snapshot(args.temp_dir)
        data_path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    data = load_json(data_path)
    results = analyze(data)
    build_notebook(notebook_path, data_path, results)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
