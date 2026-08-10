#!/usr/bin/env python3
"""Build an aggregate, secret-free analysis of Bloxodes evergreen catalog pages.

Inputs are temporary read-only exports captured from Bing Webmaster, live page
HTML, Supabase catalog content, and the previously saved Umami family report.
The outputs contain aggregate page/query metrics only; no API keys, sessions,
visitor identifiers, or raw visitor events are written.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import re
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = ROOT / "docs" / "analytics" / "reports"
STEM = "2026-08-05-bing-evergreen-catalog-playbook"
DATA_PATH = REPORT_DIR / f"{STEM}-data.json"
NOTEBOOK_PATH = REPORT_DIR / f"{STEM}.ipynb"

LATEST_PAGE_WEEKS = {"2026-07-24", "2026-07-31"}
LATEST_DEMAND_WEEKS = {"2026-07-25", "2026-08-01"}

PAGES = {
    "music": {
        "label": "Music IDs",
        "url": "https://bloxodes.com/catalog/roblox-music-ids",
        "query_file": "/tmp/bing-page-query-music.json",
        "html_file": "/tmp/live-roblox-music-ids.html",
        "catalog_code": "roblox-music-ids",
    },
    "decal": {
        "label": "Decal IDs",
        "url": "https://bloxodes.com/catalog/roblox-decal-ids",
        "query_file": "/tmp/bing-page-query-decal.json",
        "html_file": "/tmp/live-roblox-decal-ids.html",
        "catalog_code": "roblox-decal-ids",
    },
    "colors": {
        "label": "Color codes",
        "url": "https://bloxodes.com/catalog/roblox-color-codes",
        "query_file": "/tmp/bing-page-query-colors.json",
        "html_file": "/tmp/live-roblox-color-codes.html",
        "catalog_code": "roblox-color-codes",
    },
    "free_items": {
        "label": "Free items",
        "url": "https://bloxodes.com/catalog/free-roblox-items",
        "query_file": "/tmp/bing-page-query-free-items.json",
        "html_file": "/tmp/live-free-roblox-items.html",
        "catalog_code": "free-roblox-items",
    },
    "classic_faces": {
        "label": "Classic faces",
        "url": "https://bloxodes.com/catalog/roblox-items-and-bundles/roblox-body-parts/classic-faces",
        "query_file": "/tmp/bing-page-query-classic-faces.json",
        "catalog_code": "roblox-items-and-bundles/roblox-body-parts/classic-faces",
    },
    "classic_shirts": {
        "label": "Classic shirts",
        "url": "https://bloxodes.com/catalog/roblox-items-and-bundles/roblox-clothing/classic-shirts",
        "query_file": "/tmp/bing-page-query-classic-shirts.json",
        "catalog_code": "roblox-items-and-bundles/roblox-clothing/classic-shirts",
    },
    "gear": {
        "label": "Gear",
        "url": "https://bloxodes.com/catalog/roblox-items-and-bundles/roblox-accessories/gear",
        "query_file": "/tmp/bing-page-query-gear.json",
        "catalog_code": "roblox-items-and-bundles/roblox-accessories/gear",
    },
}

TOPIC_KEYWORDS = {
    "music": ["roblox-music-ids", "roblox-music-id", "roblox-song-ids", "roblox-music-codes"],
    "decal": ["roblox-decal-ids", "roblox-decal-id", "roblox-image-ids", "roblox-image-id"],
    "colors": ["roblox-color-codes", "roblox-hex-codes"],
    "free_items": ["free-roblox-items"],
    "classic_faces": ["roblox-faces"],
    "gear": ["roblox-gear"],
}

CANDIDATES = {
    "sound_ids": ("Roblox sound IDs", "sound-ids"),
    "hair_ids": ("Roblox hair IDs", "hair-ids"),
    "face_ids": ("Roblox face IDs", "face-ids"),
    "gear_ids": ("Roblox gear IDs", "gear-ids"),
    "shirt_ids": ("Roblox shirt IDs", "shirt-ids"),
    "clothing_ids": ("Roblox clothing IDs", "clothing-ids"),
    "asset_ids": ("Roblox asset IDs", "asset-ids"),
    "item_ids": ("Roblox item IDs", "item-ids"),
    "image_codes": ("Roblox image codes", "image-codes"),
    "animation_ids": ("Roblox animation IDs", "animation-ids"),
    "emote_ids": ("Roblox emote IDs", "emote-ids"),
    "game_ids": ("Roblox game IDs", "game-ids"),
}


def load_json(path: str | Path) -> Any:
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def bing_date(raw: str) -> str:
    match = re.search(r"/Date\((\d+)", raw)
    if not match:
        raise ValueError(f"Unsupported Bing date: {raw}")
    return dt.datetime.fromtimestamp(int(match.group(1)) / 1000, dt.timezone.utc).date().isoformat()


def pct_change(current: float, previous: float) -> float | None:
    return current / previous - 1 if previous else None


def weighted_position(rows: list[dict[str, Any]]) -> float | None:
    impressions = sum(float(row["Impressions"]) for row in rows)
    if not impressions:
        return None
    return sum(float(row["AvgImpressionPosition"]) * float(row["Impressions"]) for row in rows) / impressions


def window_metrics(rows: list[dict[str, Any]], weeks: set[str]) -> dict[str, Any]:
    selected = [row for row in rows if bing_date(row["Date"]) in weeks]
    denominator = len(weeks)
    clicks = sum(float(row["Clicks"]) for row in selected) / denominator
    impressions = sum(float(row["Impressions"]) for row in selected) / denominator
    return {
        "weekly_clicks": clicks,
        "weekly_impressions": impressions,
        "ctr": clicks / impressions if impressions else None,
        "avg_impression_position": weighted_position(selected),
        "rows": len(selected),
    }


class VisibleHtml(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.skip_depth = 0
        self.text: list[str] = []
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript"}:
            self.skip_depth += 1
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.text.append(data)


def strip_tags(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()


def page_html_profile(path: str) -> dict[str, Any]:
    raw = Path(path).read_text(encoding="utf-8", errors="ignore")
    parser = VisibleHtml()
    parser.feed(raw)
    title = re.search(r"<title>(.*?)</title>", raw, re.I | re.S)
    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', raw, re.I)
    description = re.search(r'<meta name="description" content="([^"]*)"', raw, re.I)
    h1 = re.findall(r"<h1\b[^>]*>(.*?)</h1>", raw, re.I | re.S)
    internal_links = {
        link for link in parser.links
        if link.startswith("/") or link.startswith("https://bloxodes.com")
    }
    schema_types: list[str] = []
    for body in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', raw, re.I | re.S):
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict) and isinstance(parsed.get("@type"), str):
            schema_types.append(parsed["@type"])
    visible = " ".join(parser.text)
    return {
        "document_bytes": len(raw.encode("utf-8")),
        "visible_word_count": len(re.findall(r"[A-Za-z0-9']+", visible)),
        "h1": strip_tags(h1[0]) if h1 else None,
        "h2_count": len(re.findall(r"<h2\b", raw, re.I)),
        "first_page_item_count": raw.count("data-journey-item"),
        "unique_internal_link_count": len(internal_links),
        "schema_types": schema_types,
        "title": strip_tags(title.group(1)) if title else None,
        "canonical": canonical.group(1) if canonical else None,
        "meta_description": description.group(1) if description else None,
    }


def count_words(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, str):
        return len(re.findall(r"[A-Za-z0-9']+", value))
    return count_words(json.dumps(value, ensure_ascii=False))


def demand_for_files(slugs: list[str]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for slug in slugs:
        payload = load_json(f"/tmp/bing-keyword-{slug}.json")
        rows.extend(payload.get("d", []))
    selected = [row for row in rows if bing_date(row["Date"]) in LATEST_DEMAND_WEEKS]
    return {
        "weekly_exact_impressions": sum(float(row["Impressions"]) for row in selected) / len(LATEST_DEMAND_WEEKS),
        "weekly_broad_impressions": sum(float(row["BroadImpressions"]) for row in selected) / len(LATEST_DEMAND_WEEKS),
        "queries": sorted({row["Query"] for row in selected}),
    }


def query_profile(path: str) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, int]]:
    rows = load_json(path).get("d", [])
    selected = [row for row in rows if bing_date(row["Date"]) in LATEST_PAGE_WEEKS]
    metrics = window_metrics(selected, LATEST_PAGE_WEEKS)
    metrics["query_count"] = len({str(row["Query"]).strip().lower() for row in selected})

    grouped: dict[str, dict[str, float]] = defaultdict(
        lambda: {"weekly_clicks": 0, "weekly_impressions": 0, "weighted_position": 0}
    )
    for row in selected:
        query = str(row["Query"]).strip().lower()
        grouped[query]["weekly_clicks"] += float(row["Clicks"]) / len(LATEST_PAGE_WEEKS)
        grouped[query]["weekly_impressions"] += float(row["Impressions"]) / len(LATEST_PAGE_WEEKS)
        grouped[query]["weighted_position"] += (
            float(row["AvgImpressionPosition"]) * float(row["Impressions"]) / len(LATEST_PAGE_WEEKS)
        )
    top_queries: list[dict[str, Any]] = []
    for query, values in grouped.items():
        impressions = values["weekly_impressions"]
        top_queries.append({
            "query": query,
            "weekly_clicks": values["weekly_clicks"],
            "weekly_impressions": impressions,
            "ctr": values["weekly_clicks"] / impressions if impressions else None,
            "avg_impression_position": values["weighted_position"] / impressions if impressions else None,
        })
    top_queries.sort(key=lambda row: row["weekly_clicks"], reverse=True)
    top_ten_clicks = sum(row["weekly_clicks"] for row in top_queries[:10])
    metrics["top_10_query_click_share"] = top_ten_clicks / metrics["weekly_clicks"] if metrics["weekly_clicks"] else None

    quality = {
        "rows": len(rows),
        "duplicate_week_query_keys": len(rows) - len({(bing_date(row["Date"]), str(row["Query"]).strip().lower()) for row in rows}),
        "clicks_greater_than_impressions_rows": sum(float(row["Clicks"]) > float(row["Impressions"]) for row in rows),
        "clicks_in_anomalous_rows": sum(
            float(row["Clicks"]) for row in rows if float(row["Clicks"]) > float(row["Impressions"])
        ),
        "impressions_in_anomalous_rows": sum(
            float(row["Impressions"]) for row in rows if float(row["Clicks"]) > float(row["Impressions"])
        ),
    }
    return metrics, top_queries[:15], quality


def rank(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=lambda index: values[index])
    result = [0.0] * len(values)
    index = 0
    while index < len(order):
        end = index
        while end + 1 < len(order) and values[order[end + 1]] == values[order[index]]:
            end += 1
        average = (index + end + 2) / 2
        for offset in range(index, end + 1):
            result[order[offset]] = average
        index = end + 1
    return result


def correlation(left: list[float], right: list[float]) -> float:
    left_mean = sum(left) / len(left)
    right_mean = sum(right) / len(right)
    numerator = sum((x - left_mean) * (y - right_mean) for x, y in zip(left, right))
    denominator = math.sqrt(
        sum((x - left_mean) ** 2 for x in left) * sum((y - right_mean) ** 2 for y in right)
    )
    return numerator / denominator


def build() -> dict[str, Any]:
    page_stats_rows = load_json("/tmp/bloxodes-bing-page-stats.json")["d"]
    catalog_rows = load_json("/tmp/catalog-pages-live.json")
    catalog_by_code = {row["code"]: row for row in catalog_rows}

    weekly_winner_rows: list[dict[str, Any]] = []
    for page_key in ("music", "decal"):
        page = PAGES[page_key]
        for row in page_stats_rows:
            if row["Query"] != page["url"]:
                continue
            weekly_winner_rows.append({
                "week": bing_date(row["Date"]),
                "page": page["label"],
                "clicks": row["Clicks"],
                "impressions": row["Impressions"],
                "ctr": row["Clicks"] / row["Impressions"] if row["Impressions"] else None,
                "avg_impression_position": row["AvgImpressionPosition"],
            })
    weekly_winner_rows.sort(key=lambda row: (row["week"], row["page"]))

    page_results: list[dict[str, Any]] = []
    quality_by_page: dict[str, Any] = {}
    top_queries_by_page: dict[str, Any] = {}
    for key, page in PAGES.items():
        total_rows = [row for row in page_stats_rows if row["Query"] == page["url"]]
        total = window_metrics(total_rows, LATEST_PAGE_WEEKS)
        query_metrics, top_queries, quality = query_profile(page["query_file"])
        demand = demand_for_files(TOPIC_KEYWORDS[key]) if key in TOPIC_KEYWORDS else None
        result = {
            "page_key": key,
            "page": page["label"],
            "url": page["url"],
            **total,
            "returned_query_count": query_metrics["query_count"],
            "returned_query_weekly_clicks": query_metrics["weekly_clicks"],
            "returned_query_weekly_impressions": query_metrics["weekly_impressions"],
            "returned_query_ctr": query_metrics["ctr"],
            "returned_query_avg_position": query_metrics["avg_impression_position"],
            "top_10_query_click_share": query_metrics["top_10_query_click_share"],
            "core_exact_demand": demand["weekly_exact_impressions"] if demand else None,
        }
        page_results.append(result)
        quality_by_page[key] = quality
        top_queries_by_page[key] = top_queries
    page_results.sort(key=lambda row: row["weekly_clicks"], reverse=True)

    demand_comparison = [
        {
            "page": row["page"],
            "weekly_page_clicks": row["weekly_clicks"],
            "weekly_core_exact_demand": row["core_exact_demand"],
            "avg_impression_position": row["avg_impression_position"],
            "ctr": row["ctr"],
        }
        for row in page_results
        if row["core_exact_demand"] is not None
    ]

    demand_logs = [math.log(row["weekly_core_exact_demand"]) for row in demand_comparison]
    click_logs = [math.log(row["weekly_page_clicks"]) for row in demand_comparison]
    directional_log_correlation = correlation(demand_logs, click_logs)
    spearman = correlation(
        rank([row["weekly_core_exact_demand"] for row in demand_comparison]),
        rank([row["weekly_page_clicks"] for row in demand_comparison]),
    )

    live_profiles: list[dict[str, Any]] = []
    for key in ("music", "decal", "colors", "free_items"):
        page = PAGES[key]
        catalog = catalog_by_code[page["catalog_code"]]
        profile = page_html_profile(page["html_file"])
        profile.update({
            "page_key": key,
            "page": page["label"],
            "content_updated_at": catalog.get("content_updated_at"),
            "editorial_word_count": sum(count_words(catalog.get(field)) for field in (
                "intro_md", "description_md", "description_json", "how_it_works_md", "faq_json"
            )),
        })
        live_profiles.append(profile)

    candidates: list[dict[str, Any]] = []
    for key, (label, slug) in CANDIDATES.items():
        rows = load_json(f"/tmp/bing-candidate-{slug}.json").get("d", [])
        selected = [row for row in rows if bing_date(row["Date"]) in LATEST_DEMAND_WEEKS]
        exact = sum(float(row["Impressions"]) for row in selected) / len(LATEST_DEMAND_WEEKS)
        candidates.append({
            "candidate": label,
            "weekly_exact_demand": exact,
            "existing_surface": {
                "sound_ids": "Music IDs page already ranks for this synonym",
                "hair_ids": "Existing hair-accessories catalog page; no Bing page stats returned",
                "face_ids": "Existing classic-faces catalog page",
                "gear_ids": "Existing gear catalog page",
                "shirt_ids": "Existing classic-shirts catalog page",
                "clothing_ids": "Existing clothing catalog family",
                "asset_ids": "Existing catalog families and ID extractor",
                "item_ids": "Existing items-and-bundles catalog",
                "image_codes": "Decal IDs page already covers this synonym",
                "animation_ids": "Existing animation catalog family",
                "emote_ids": "Existing emotes catalog page",
                "game_ids": "No focused catalog surface",
            }[key],
        })
    candidates.sort(key=lambda row: row["weekly_exact_demand"], reverse=True)

    umami_rows = []
    csv_path = REPORT_DIR / "2026-07-22-content-type-performance-data.csv"
    if csv_path.exists():
        header, *body = csv_path.read_text(encoding="utf-8").strip().splitlines()
        columns = header.split(",")
        for line in body:
            values = line.split(",")
            row = dict(zip(columns, values))
            if row.get("content_type") == "catalog":
                umami_rows.append({
                    "window": "2026-07-12 to 2026-07-21 Asia/Kolkata",
                    "scope": "all catalog pages combined",
                    "pageviews": int(row["pageviews"]),
                    "adjusted_9d_pageviews": int(row["adjusted_9d_pageviews"]),
                    "adjusted_9d_engaged_visits": int(row["adjusted_9d_engaged_visits"]),
                    "adjusted_engaged_rate": float(row["adjusted_engaged_rate_pct"]) / 100,
                })

    snapshot = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "timezone": "Asia/Kolkata for saved Umami context; Bing weekly dates normalized to UTC dates",
        "latest_page_window": sorted(LATEST_PAGE_WEEKS),
        "latest_demand_window": sorted(LATEST_DEMAND_WEEKS),
        "page_results": page_results,
        "weekly_winner_rows": weekly_winner_rows,
        "demand_comparison": demand_comparison,
        "top_queries": top_queries_by_page,
        "live_page_profiles": live_profiles,
        "candidate_topics": candidates,
        "directional_log_demand_click_correlation": directional_log_correlation,
        "directional_spearman_demand_click_correlation": spearman,
        "dataset_counts": {"music": 59320, "decal": 38046},
        "umami_saved_context": umami_rows,
        "umami_access": {
            "fresh_page_level_status": "blocked",
            "reason": "The production endpoint returned HTTP 401 and the available browser session is signed out; no Umami credential is stored in the repo environment.",
            "impact": "Current music-vs-decal engagement and source mix cannot be verified. Bing search conclusions remain available.",
        },
        "data_quality": {
            "page_query_stats": quality_by_page,
            "known_limitations": [
                "Bing GetPageQueryStats returns a bounded top-query extract, not every long-tail query.",
                "Bing keyword demand uses global/unspecified country and language because supported market enums were not available.",
                "The latest Bing page comparison averages the two weekly buckets dated July 24 and July 31, 2026.",
                "The demand-versus-click correlation has only six topic observations with uneven synonym coverage; it is directional, not causal.",
                "Fresh Umami page-level data was unavailable; the saved Umami context is catalog-family level only.",
            ],
        },
    }
    DATA_PATH.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return snapshot


def build_notebook(snapshot: dict[str, Any]) -> None:
    cells = [
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "## tl;dr\n",
                "Music IDs and Decal IDs win primarily because they combine unusually large evergreen Bing demand with a complete, copy-ready database. The template helps convert that demand into strong rankings and CTR, but content length, schema, and freshness alone do not explain the gap.\n",
            ],
        },
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "## Context & Methods\n",
                "\n",
                "### Key Assumptions\n",
                "- Bing page performance is the average of weekly buckets dated July 24 and July 31, 2026.\n",
                "- Bing global exact-query demand is the average of July 25 and August 1, 2026.\n",
                "- Page-query extracts are bounded top-query lists, so query counts are coverage indicators rather than complete inventories.\n",
                "- Fresh Umami page-level data is unavailable; the saved July catalog-family aggregate is context only.\n",
            ],
        },
        {"cell_type": "markdown", "metadata": {}, "source": ["## Data\n"]},
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "import json\n",
                "from pathlib import Path\n",
                "\n",
                f"data = json.loads(Path('{DATA_PATH.name}').read_text(encoding='utf-8'))\n",
                "len(data['page_results']), len(data['candidate_topics'])\n",
            ],
        },
        {"cell_type": "markdown", "metadata": {}, "source": ["## Results\n"]},
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "page_summary = [\n",
                "    {key: row[key] for key in ('page', 'weekly_clicks', 'weekly_impressions', 'ctr', 'avg_impression_position', 'core_exact_demand')}\n",
                "    for row in data['page_results']\n",
                "]\n",
                "page_summary\n",
            ],
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "{\n",
                "    'log_demand_click_correlation': round(data['directional_log_demand_click_correlation'], 3),\n",
                "    'spearman_demand_click_correlation': round(data['directional_spearman_demand_click_correlation'], 3),\n",
                "    'top_candidates': data['candidate_topics'][:6],\n",
                "}\n",
            ],
        },
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                "## Takeaways\n",
                "1. Protect the music and decal pages; their rankings and CTR show product-market fit for evergreen ID lookup intent.\n",
                "2. Replicate the page contract only where Bing demand is already proven. Hair IDs, face IDs, and gear IDs are the best existing-surface opportunities.\n",
                "3. Add natural ID/code synonyms to titles, H1s, intros, and FAQs only when the dataset genuinely fulfills that lookup intent.\n",
                "4. Treat schema, word count, and update labels as supporting hygiene, not the growth engine.\n",
                "5. Re-run the Umami page-level engagement comparison after authentication is restored.\n",
            ],
        },
    ]
    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    NOTEBOOK_PATH.write_text(json.dumps(notebook, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    result = build()
    build_notebook(result)
    print(json.dumps({
        "data_path": str(DATA_PATH),
        "notebook_path": str(NOTEBOOK_PATH),
        "pages": len(result["page_results"]),
        "candidate_topics": len(result["candidate_topics"]),
    }, indent=2))
