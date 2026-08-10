#!/usr/bin/env python3
"""Rank new Bloxodes evergreen lookup topics from Bing demand and dataset fit.

The script consumes read-only Bing Webmaster keyword exports captured in /tmp
and writes aggregate, secret-free report data plus a companion notebook.
"""

from __future__ import annotations

import datetime as dt
import contextlib
import io
import json
import math
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = ROOT / "docs" / "analytics" / "reports"
STEM = "2026-08-05-next-evergreen-catalog-opportunities"
DATA_PATH = REPORT_DIR / f"{STEM}-data.json"
NOTEBOOK_PATH = REPORT_DIR / f"{STEM}.ipynb"
BENCHMARK_PATH = REPORT_DIR / "2026-08-05-bing-evergreen-catalog-playbook-data.json"
LATEST_DEMAND_WEEKS = {"2026-07-25", "2026-08-01"}

OPPORTUNITIES: dict[str, dict[str, Any]] = {
    "font_library_generator": {
        "label": "Roblox Fonts Library + Font Generator",
        "families": ["font_catalog", "font_generator"],
        "intent_fit": 0.70,
        "data_score": 5,
        "reuse_score": 3,
        "effort_score": 3,
        "priority": "Build as the highest-demand new topic",
        "dataset": "85 public FontFamily assets returned by Roblox in one Creator Store response, with IDs, names, native styles, descriptions, votes, dates, and thumbnails.",
        "page_shape": "A hybrid tool/database: live text preview, copyable fancy text, all Studio fonts, font asset IDs, native weights/styles, and copyable Luau snippets.",
        "risk": "The generic query has mixed intent (fancy-text generator, Roblox logo font, and Studio fonts), so a static 85-row table would underserve it.",
    },
    "crosshair_ids": {
        "label": "Roblox Crosshair and Cursor IDs",
        "families": ["crosshair_ids"],
        "intent_fit": 0.95,
        "data_score": 5,
        "reuse_score": 5,
        "effort_score": 2,
        "priority": "Build first as the fastest catalog win",
        "dataset": "2,233 unique public decal candidates across crosshair, cursor, and reticle searches before Bloxodes verification and moderation filtering.",
        "page_shape": "A dedicated crosshair/cursor ID catalog or decal category with previews, one-click ID copy, shape/style filters, and tested game-use instructions.",
        "risk": "The current production decal corpus has no crosshair/cursor keyword matches because those search seeds are not collected yet; the raw candidates still need the existing verification gate.",
    },
    "mesh_ids": {
        "label": "Roblox Mesh IDs",
        "families": ["mesh_ids"],
        "intent_fit": 0.90,
        "data_score": 4,
        "reuse_score": 2,
        "effort_score": 4,
        "priority": "Build next as the strongest new asset database",
        "dataset": "Roblox MeshPart search exposes at least 1,000 top results with pagination, asset ID, texture ID, name, creator, votes, dates, and preview support.",
        "page_shape": "A searchable MeshPart catalog that copies MeshId and TextureId separately, shows preview/creator/votes, and explains Studio use and asset permissions.",
        "risk": "It needs a new ingestion, verification, table, and route family; Creator Store totalResults is capped at 1,000 per query, so broad discovery needs multiple seeds/sorts.",
    },
    "flag_ids": {
        "label": "Roblox Flag IDs",
        "families": ["flag_ids"],
        "intent_fit": 0.80,
        "data_score": 4,
        "reuse_score": 5,
        "effort_score": 2,
        "priority": "Backlog decal-category expansion",
        "dataset": "Can be collected and verified through the existing public decal pipeline using flag and country-name search seeds.",
        "page_shape": "A flag-image ID category grouped by country and style.",
        "risk": "Lower demand and ambiguous intent make it materially smaller than the top three.",
    },
    "spray_paint_codes": {
        "label": "Roblox Spray Paint IDs",
        "families": ["spray_paint_codes"],
        "intent_fit": 0.90,
        "data_score": 4,
        "reuse_score": 5,
        "effort_score": 2,
        "priority": "Backlog decal-category expansion",
        "dataset": "Uses the existing verified decal corpus plus spray-paint/graffiti collector seeds.",
        "page_shape": "A game-use-focused decal collection for spray-paint and art experiences.",
        "risk": "Demand is modest and many assets overlap the existing graffiti and general decal experience.",
    },
}

# These families exclude avatar marketplace item types already live under
# /catalog/roblox-items-and-bundles/*.
CANDIDATES: dict[str, dict[str, Any]] = {
    "font_generator": {
        "label": "Roblox font and fancy-text generator",
        "terms": ["roblox font generator", "roblox fonts generator", "roblox text generator", "roblox fancy text", "roblox fonts copy and paste"],
    },
    "sound_effect_ids": {
        "label": "Roblox sound-effect IDs",
        "terms": ["roblox sound effect ids", "roblox sound effects ids", "roblox sfx ids", "roblox sound effect id"],
    },
    "model_ids": {
        "label": "Roblox model IDs",
        "terms": ["roblox model ids", "roblox model id", "roblox model codes", "roblox models ids"],
    },
    "mesh_ids": {
        "label": "Roblox mesh IDs",
        "terms": ["roblox mesh ids", "roblox mesh id", "roblox mesh codes", "mesh id roblox", "mesh ids roblox"],
    },
    "texture_ids": {
        "label": "Roblox texture IDs",
        "terms": ["roblox texture ids", "roblox texture id", "roblox texture codes", "texture id roblox", "texture ids roblox"],
    },
    "skybox_ids": {
        "label": "Roblox skybox IDs",
        "terms": ["roblox skybox ids", "roblox skybox id", "roblox skybox codes"],
    },
    "particle_ids": {
        "label": "Roblox particle IDs",
        "terms": ["roblox particle ids", "roblox particle id", "roblox particle texture ids"],
    },
    "plugin_ids": {
        "label": "Roblox plugin IDs",
        "terms": ["roblox plugin ids", "roblox plugin id", "roblox plugin codes"],
    },
    "badge_ids": {
        "label": "Roblox badge IDs",
        "terms": ["roblox badge ids", "roblox badge id", "roblox badge codes"],
    },
    "outfit_ids": {
        "label": "Roblox outfit IDs",
        "terms": ["roblox outfit ids", "roblox outfit id", "roblox outfit codes"],
    },
    "font_catalog": {
        "label": "Roblox fonts and font codes",
        "terms": ["roblox fonts", "roblox font list", "roblox font codes", "roblox studio fonts", "roblox font ids", "roblox font id", "font id roblox"],
    },
    "material_catalog": {
        "label": "Roblox materials list",
        "terms": ["roblox materials", "roblox material list", "roblox studio materials", "roblox material ids"],
    },
    "crosshair_ids": {
        "label": "Roblox crosshair IDs",
        "terms": ["roblox crosshair ids", "roblox crosshair id", "roblox crosshair codes", "crosshair id roblox", "roblox cursor ids", "roblox cursor id"],
    },
    "spray_paint_codes": {
        "label": "Roblox spray-paint codes",
        "terms": ["roblox spray paint codes", "roblox spray paint ids", "roblox spray paint id"],
    },
    "flag_ids": {
        "label": "Roblox flag IDs",
        "terms": ["roblox flag ids", "roblox flag id", "roblox flag codes"],
    },
    "logo_ids": {
        "label": "Roblox logo IDs",
        "terms": ["roblox logo ids", "roblox logo id", "roblox logo codes"],
    },
    "game_icon_ids": {
        "label": "Roblox game-icon IDs",
        "terms": ["roblox game icon ids", "roblox icon ids", "roblox icon id"],
    },
    "thumbnail_ids": {
        "label": "Roblox thumbnail IDs",
        "terms": ["roblox thumbnail ids", "roblox thumbnail id", "roblox thumbnail codes"],
    },
    "library_ids": {
        "label": "Roblox library IDs",
        "terms": ["roblox library ids", "roblox library id", "roblox library codes"],
    },
    "asset_packs": {
        "label": "Roblox Studio asset packs",
        "terms": ["roblox asset packs", "roblox studio asset packs", "roblox model packs"],
    },
    "game_ids": {
        "label": "Roblox game, place, and universe IDs",
        "terms": ["roblox game ids", "roblox game id", "roblox place ids", "roblox place id", "roblox universe ids", "roblox universe id"],
    },
    "user_id_lookup": {
        "label": "Roblox user ID lookup",
        "terms": ["roblox user ids", "roblox user id", "roblox id lookup", "find roblox user id"],
    },
    "group_id_lookup": {
        "label": "Roblox group ID lookup",
        "terms": ["roblox group ids", "roblox group id", "roblox group id lookup"],
    },
    "gamepass_ids": {
        "label": "Roblox game-pass IDs",
        "terms": ["roblox gamepass ids", "roblox game pass ids", "roblox gamepass id", "roblox game pass id"],
    },
    "developer_product_ids": {
        "label": "Roblox developer-product IDs",
        "terms": ["roblox developer product ids", "roblox developer product id", "roblox product ids"],
    },
    "boombox_codes": {
        "label": "Roblox boombox codes",
        "terms": ["roblox boombox codes", "roblox boombox music codes", "boombox codes roblox"],
    },
    "anime_decal_ids": {
        "label": "Roblox anime decal IDs",
        "terms": ["roblox anime decal ids", "anime decal ids roblox", "anime decals roblox", "roblox anime image ids"],
    },
    "meme_decal_ids": {
        "label": "Roblox meme decal IDs",
        "terms": ["roblox meme decal ids", "meme decal ids roblox", "roblox meme ids", "meme ids roblox"],
    },
    "aesthetic_decal_ids": {
        "label": "Roblox aesthetic decal IDs",
        "terms": ["roblox aesthetic decal ids", "aesthetic decal ids roblox", "aesthetic decals roblox", "roblox aesthetic image ids"],
    },
    "cute_decal_ids": {
        "label": "Roblox cute decal IDs",
        "terms": ["roblox cute decal ids", "cute decal ids roblox", "cute decals roblox", "roblox cute image ids"],
    },
    "bloxburg_decal_ids": {
        "label": "Bloxburg decal and texture IDs",
        "terms": ["bloxburg decal ids", "bloxburg texture ids", "roblox bloxburg decal ids", "bloxburg picture codes"],
    },
    "flag_decal_ids": {
        "label": "Roblox flag decal IDs",
        "terms": ["roblox flag decal ids", "flag decal ids roblox", "roblox flag image ids"],
    },
    "phonk_music_ids": {
        "label": "Roblox phonk music IDs",
        "terms": ["roblox phonk ids", "phonk ids roblox", "roblox phonk music ids", "roblox phonk codes"],
    },
    "rap_music_ids": {
        "label": "Roblox rap music IDs",
        "terms": ["roblox rap music ids", "roblox rap ids", "rap ids roblox", "roblox rap codes"],
    },
    "anime_music_ids": {
        "label": "Roblox anime music IDs",
        "terms": ["roblox anime music ids", "anime music ids roblox", "roblox anime song ids", "anime song ids roblox"],
    },
    "meme_music_ids": {
        "label": "Roblox meme music IDs",
        "terms": ["roblox meme song ids", "meme song ids roblox", "roblox meme music ids", "roblox meme sound ids"],
    },
    "loud_music_ids": {
        "label": "Roblox loud music IDs",
        "terms": ["roblox loud music ids", "loud music ids roblox", "roblox loud song ids", "loud song ids roblox"],
    },
}


def bing_date(raw: str) -> str:
    match = re.search(r"/Date\((\d+)", raw)
    if not match:
        raise ValueError(f"Unsupported Bing date: {raw}")
    return dt.datetime.fromtimestamp(int(match.group(1)) / 1000, dt.timezone.utc).date().isoformat()


def term_slug(term: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", term.lower()).strip("-")


def load_keyword_demand(term: str) -> dict[str, Any]:
    path = Path("/tmp") / f"bing-next-{term_slug(term)}.json"
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    rows = payload.get("d", [])
    selected = [row for row in rows if bing_date(row["Date"]) in LATEST_DEMAND_WEEKS]
    return {
        "term": term,
        "weekly_exact_impressions": sum(float(row["Impressions"]) for row in selected) / len(LATEST_DEMAND_WEEKS),
        "history_rows": len(rows),
        "latest_rows": len(selected),
    }


def demand_ranking() -> list[dict[str, Any]]:
    ranking = []
    for key, candidate in CANDIDATES.items():
        terms = [load_keyword_demand(term) for term in candidate["terms"]]
        ranking.append(
            {
                "key": key,
                "label": candidate["label"],
                "weekly_exact_impressions": sum(row["weekly_exact_impressions"] for row in terms),
                "terms": terms,
            }
        )
    return sorted(ranking, key=lambda row: row["weekly_exact_impressions"], reverse=True)


def family_weekly_history(key: str) -> list[dict[str, Any]]:
    weekly: dict[str, float] = {}
    for term in CANDIDATES[key]["terms"]:
        path = Path("/tmp") / f"bing-next-{term_slug(term)}.json"
        with path.open(encoding="utf-8") as handle:
            rows = json.load(handle).get("d", [])
        for row in rows:
            week = bing_date(row["Date"])
            weekly[week] = weekly.get(week, 0.0) + float(row["Impressions"])
    return [{"week": week, "impressions": weekly[week]} for week in sorted(weekly)]


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def recent_momentum(key: str) -> dict[str, Any]:
    history = family_weekly_history(key)
    recent = [row["impressions"] for row in history[-4:]]
    prior = [row["impressions"] for row in history[-8:-4]]
    recent_avg = mean(recent)
    prior_avg = mean(prior)
    return {
        "recent_4_week_avg": recent_avg,
        "prior_4_week_avg": prior_avg,
        "change": recent_avg / prior_avg - 1 if prior_avg else None,
    }


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def source_checks() -> dict[str, Any]:
    live_catalog = load_json(Path("/tmp/bloxodes-live-catalog-pages.json"))
    live_tools = load_json(Path("/tmp/bloxodes-live-tools.json"))
    categories = load_json(Path("/tmp/bloxodes-live-decal-categories.json"))
    font_assets = load_json(Path("/tmp/roblox-opportunity-fontfamily.json"))
    mesh_assets = load_json(Path("/tmp/roblox-opportunity-meshpart.json"))
    font_thumbnails = load_json(Path("/tmp/roblox-font-thumbnails.json"))
    texture = next(row for row in categories if row["slug"] == "textures")
    return {
        "published_catalog_pages": len(live_catalog),
        "published_tools": len(live_tools),
        "live_decal_categories": len(categories),
        "live_texture_category_items": int(texture["item_count"]),
        "font_family_total_results": int(font_assets["totalResults"]),
        "font_family_rows_returned": len(font_assets.get("creatorStoreAssets", [])),
        "font_thumbnail_completed": sum(row.get("state") == "Completed" for row in font_thumbnails.get("data", [])),
        "font_thumbnail_sample": len(font_thumbnails.get("data", [])),
        "mesh_total_results_cap": int(mesh_assets["totalResults"]),
        "mesh_first_page_rows": len(mesh_assets.get("creatorStoreAssets", [])),
        "mesh_has_next_page": bool(mesh_assets.get("nextPageToken")),
        "crosshair_search_total_results": 1000,
        "cursor_search_total_results": 1000,
        "reticle_search_total_results": 265,
        "crosshair_cursor_reticle_unique_raw": 2233,
        "current_verified_decal_keyword_matches": 0,
        "live_id_title_samples": [
            "3,278 Roblox Hair Codes and IDs",
            "354 Roblox Classic Face IDs and Codes",
            "2,949 Roblox Classic Shirt IDs and Codes",
            "634 Roblox Animation Pack and Bundle IDs",
        ],
    }


def build_analysis() -> dict[str, Any]:
    demand = demand_ranking()
    demand_by_key = {row["key"]: row for row in demand}
    benchmark = load_json(BENCHMARK_PATH)
    benchmark_pages = {row["page_key"]: row for row in benchmark["page_results"]}
    observations = source_checks()
    rows = []
    for key, definition in OPPORTUNITIES.items():
        exact = sum(demand_by_key[family]["weekly_exact_impressions"] for family in definition["families"])
        addressable = exact * definition["intent_fit"]
        rows.append(
            {
                "key": key,
                "topic": definition["label"],
                "weekly_exact_impressions": exact,
                "intent_fit": definition["intent_fit"],
                "addressable_weekly_exact_impressions": addressable,
                "mature_weekly_click_low": addressable * 0.5,
                "mature_weekly_click_base": addressable,
                "mature_weekly_click_high": addressable * 1.5,
                "data_score": definition["data_score"],
                "reuse_score": definition["reuse_score"],
                "effort_score": definition["effort_score"],
                "priority": definition["priority"],
                "dataset": definition["dataset"],
                "page_shape": definition["page_shape"],
                "risk": definition["risk"],
            }
        )
    rows.sort(key=lambda row: row["addressable_weekly_exact_impressions"], reverse=True)
    rank_by_demand = {row["key"]: index + 1 for index, row in enumerate(rows)}
    for row in rows:
        row["demand_rank"] = rank_by_demand[row["key"]]

    history_keys = ["font_catalog", "font_generator", "mesh_ids", "texture_ids", "crosshair_ids"]
    weekly_history = []
    for key in history_keys:
        for row in family_weekly_history(key)[-12:]:
            weekly_history.append({"family": key, **row})

    top_three = [row for row in rows if row["key"] in {"font_library_generator", "crosshair_ids", "mesh_ids"}]
    combined = {
        "weekly_exact_impressions": sum(row["weekly_exact_impressions"] for row in top_three),
        "addressable_weekly_exact_impressions": sum(row["addressable_weekly_exact_impressions"] for row in top_three),
        "mature_weekly_click_low": sum(row["mature_weekly_click_low"] for row in top_three),
        "mature_weekly_click_base": sum(row["mature_weekly_click_base"] for row in top_three),
        "mature_weekly_click_high": sum(row["mature_weekly_click_high"] for row in top_three),
    }

    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "latest_demand_window": sorted(LATEST_DEMAND_WEEKS),
        "decision": "Which genuinely new evergreen Roblox lookup topics should Bloxodes build next after the avatar item-ID rollout?",
        "recommendation": {
            "highest_demand": "Roblox Fonts Library + Font Generator",
            "fastest_catalog_win": "Roblox Crosshair and Cursor IDs",
            "strongest_new_database": "Roblox Mesh IDs",
            "portfolio_conclusion": "No untouched single topic is close to Music IDs demand; the rational path is a three-page portfolio rather than expecting one page to match Music IDs.",
        },
        "benchmarks": {
            "music_weekly_clicks": benchmark_pages["music"]["weekly_clicks"],
            "music_core_exact_demand": benchmark_pages["music"]["core_exact_demand"],
            "decal_weekly_clicks": benchmark_pages["decal"]["weekly_clicks"],
            "decal_core_exact_demand": benchmark_pages["decal"]["core_exact_demand"],
            "observed_click_to_core_demand_ratios": {
                key: benchmark_pages[key]["weekly_clicks"] / benchmark_pages[key]["core_exact_demand"]
                for key in ["music", "decal", "colors", "classic_faces", "gear"]
                if benchmark_pages[key]["core_exact_demand"]
            },
        },
        "opportunities": rows,
        "top_three_combined": combined,
        "all_candidate_demand": demand,
        "weekly_history": weekly_history,
        "momentum": {key: recent_momentum(key) for key in history_keys},
        "source_checks": observations,
        "existing_opportunities_not_new": [
            {
                "topic": "Roblox Texture IDs",
                "weekly_exact_impressions": demand_by_key["texture_ids"]["weekly_exact_impressions"],
                "reason": f"Already live as the Textures decal category with {observations['live_texture_category_items']:,} verified items; improve that route instead of creating a duplicate.",
            },
            {
                "topic": "Roblox Boombox Codes",
                "weekly_exact_impressions": demand_by_key["boombox_codes"]["weekly_exact_impressions"],
                "reason": "Already served and ranked by Music IDs; make it an on-page alias/section, not a competing page.",
            },
            {
                "topic": "Roblox User ID Lookup",
                "weekly_exact_impressions": demand_by_key["user_id_lookup"]["weekly_exact_impressions"],
                "reason": "Already covered by the published Roblox ID Extractor tool.",
            },
            {
                "topic": "Avatar item ID catalogs",
                "weekly_exact_impressions": None,
                "reason": "The live nested item pages now render ID-focused titles and are explicitly excluded from this screen.",
            },
        ],
        "data_quality": {
            "status": "Share with caveats",
            "checks": [
                "Screened 142 exact keyword phrases across 37 candidate families using Bing Webmaster Keyword Stats.",
                "Used the two latest complete Bing keyword buckets (July 25 and August 1, 2026) and inspected 12-week stability for the leading families.",
                "Verified 42 published catalog records, 12 live decal categories, and 10 published tools in production before labeling a topic new.",
                "Tested live Roblox Creator Store search and thumbnail responses for FontFamily, MeshPart, Decal crosshair/cursor/reticle, and image previews.",
            ],
            "caveats": [
                "Bing Keyword Stats are global/unspecified-market exact-query estimates, not Google volume and not a complete semantic topic total.",
                "A zero means Bing returned no reportable rows for that exact phrase; it does not prove literally zero searches.",
                "The font opportunity combines mixed intents; the 70% intent-fit assumption is a judgment range, not an observed conversion rate.",
                "The 0.5x-1.5x mature-click range is a scenario anchored to existing Bloxodes catalog click-to-core-demand ratios, not a traffic guarantee.",
                "Crosshair records are raw public candidates before Bloxodes' active/deleted/private/moderation checks; the verified publishable count will be lower than 2,233.",
                "Creator Store totalResults is capped at 1,000 per MeshPart query, so a production mesh collector must combine search seeds and sort orders.",
            ],
        },
    }


def notebook_cell(cell_type: str, source: str, execution_count: int | None = None, outputs: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    cell: dict[str, Any] = {"cell_type": cell_type, "metadata": {}, "source": source.splitlines(keepends=True)}
    if cell_type == "code":
        cell["execution_count"] = execution_count
        cell["outputs"] = outputs or []
    return cell


def write_companion_notebook(analysis: dict[str, Any]) -> None:
    relative_data = str(DATA_PATH.relative_to(ROOT))
    cells = [
        notebook_cell("markdown", "## tl;dr\n\nThe best new Bloxodes portfolio is: a hybrid Roblox font library/generator for demand, a crosshair/cursor ID catalog for fast reuse, and a Mesh ID catalog for the strongest new asset database. No single untouched topic approaches Music IDs scale."),
        notebook_cell("markdown", "## Context & Methods\n\n### Key Assumptions\n\n- Demand is the average of Bing's July 25 and August 1, 2026 exact-keyword buckets.\n- Addressable demand applies an explicit intent-fit assumption.\n- Mature click scenarios use 0.5x, 1.0x, and 1.5x addressable exact demand, grounded in the spread of existing Bloxodes catalog benchmarks.\n- Roblox API and production inventory checks are recorded in the saved data artifact."),
        notebook_cell("markdown", "## Data"),
        notebook_cell("code", f"import json\nfrom pathlib import Path\ndata = json.loads(Path({relative_data!r}).read_text())\nprint('generated_at', data['generated_at'])\nprint('opportunities', len(data['opportunities']))"),
        notebook_cell("markdown", "## Results"),
        notebook_cell("code", "for row in data['opportunities']:\n    print(f\"{row['demand_rank']}. {row['topic']}: {row['weekly_exact_impressions']:.1f} exact/wk; {row['mature_weekly_click_low']:.0f}-{row['mature_weekly_click_high']:.0f} mature clicks/wk scenario\")"),
        notebook_cell("code", "checks = data['source_checks']\nprint('font assets', checks['font_family_total_results'])\nprint('crosshair/cursor/reticle raw unique', checks['crosshair_cursor_reticle_unique_raw'])\nprint('mesh query cap', checks['mesh_total_results_cap'])\nprint('texture category already live', checks['live_texture_category_items'])"),
        notebook_cell("code", "ratios = data['benchmarks']['observed_click_to_core_demand_ratios']\nassert min(ratios.values()) < 0.6 and max(ratios.values()) > 1.5\nassert data['source_checks']['font_thumbnail_completed'] == data['source_checks']['font_thumbnail_sample']\nassert data['top_three_combined']['mature_weekly_click_low'] < data['top_three_combined']['mature_weekly_click_base'] < data['top_three_combined']['mature_weekly_click_high']\nprint('reasonableness checks passed')"),
        notebook_cell("markdown", "## Takeaways\n\n- Build the font library/generator to attack the largest new demand pool.\n- Build crosshair/cursor IDs first if speed matters; the existing decal verification and category stack can absorb it.\n- Treat Mesh IDs as the next major database investment.\n- Improve the existing Textures category and Music page aliases instead of creating duplicate pages."),
    ]
    namespace: dict[str, Any] = {}
    count = 0
    for cell in cells:
        if cell["cell_type"] != "code":
            continue
        count += 1
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            exec(compile("".join(cell["source"]), f"{NOTEBOOK_PATH.name}:cell-{count}", "exec"), namespace)
        cell["execution_count"] = count
        text = stdout.getvalue()
        cell["outputs"] = [{"name": "stdout", "output_type": "stream", "text": text.splitlines(keepends=True)}] if text else []
    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3"},
            "execution": {"method": "deterministic in-process top-to-bottom runner", "status": "passed"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    NOTEBOOK_PATH.write_text(json.dumps(notebook, indent=2), encoding="utf-8")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--terms", action="store_true")
    parser.add_argument("--demand", action="store_true")
    parser.add_argument("--trends", action="store_true")
    parser.add_argument("--build", action="store_true")
    args = parser.parse_args()
    if args.build:
        analysis = build_analysis()
        DATA_PATH.write_text(json.dumps(analysis, indent=2), encoding="utf-8")
        write_companion_notebook(analysis)
        print(DATA_PATH)
        print(NOTEBOOK_PATH)
    elif args.trends:
        for key in ["font_catalog", "font_generator", "mesh_ids", "texture_ids", "crosshair_ids"]:
            print(f"\n{key}")
            for row in family_weekly_history(key)[-12:]:
                print(f"{row['week']}\t{row['impressions']:.1f}")
    elif args.demand:
        for row in demand_ranking():
            print(f"{row['weekly_exact_impressions']:8.1f}\t{row['key']}\t{row['label']}")
            for term in row["terms"]:
                if term["weekly_exact_impressions"]:
                    print(f"          {term['weekly_exact_impressions']:8.1f}\t{term['term']}")
    else:
        print("\n".join(term for family in CANDIDATES.values() for term in family["terms"]))
