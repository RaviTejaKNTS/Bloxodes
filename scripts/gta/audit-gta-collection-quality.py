"""Profile GTA collection authoring data for editorial review.

This audit intentionally reports suspicious patterns; source checking is still needed
before changing factual values or publishing a dataset revision.
"""

import argparse
import hashlib
import json
import re
from itertools import combinations
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / "tmp/content-workspace/gta"
FILLER = re.compile(
    r"mission details and requirements for|use the (?:item )?image to|"
    r"search exact (?:perch|location) shown in image|"
    r"appears among grand theft auto|listed online vehicle entry|"
    r"complete the team objective, survive the round and outscore|"
    r"available details|documented grouping|game details billboard clue|"
    r"pending verification|no purchasable GTABase vehicle page|"
    r"search the exact perch shown in the location image|"
    r"use its handling on highways and tight city turns|"
    r"it suits long countryside runs and city missions|"
    r"meet the listed threshold to mark the challenge complete|"
    r"available through story mode progress",
    re.I,
)
PLACEHOLDER = re.compile(r"(?:-?N/?A-?|TBD|unknown|no cap documented)", re.I)
PUBLIC_PROCESS_COPY = re.compile(
    r"\b(?:available details|game details|location details|source review|"
    r"pending verification|authoring workspace)\b",
    re.I,
)


def filled(value):
    if value is None or value == "" or value == [] or value == {}:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def text(value):
    if isinstance(value, str):
        return value.strip()
    return json.dumps(value, ensure_ascii=False, sort_keys=True) if filled(value) else ""


def finding(kind, severity, count, total, samples):
    return {"kind": kind, "severity": severity, "count": count, "total": total, "samples": samples[:5]}


def inspect(path):
    doc = json.loads(path.read_text())
    meta = doc.get("meta", {})
    items = doc.get("items", [])
    code = f"{meta.get('gameSlug')}-{meta.get('collection')}"
    root = path.parent
    manifest_path = root / "runtime-manifest.json"
    final_path = root / "final.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    final = json.loads(final_path.read_text()) if final_path.exists() else {}
    rows = [(row.get("system", {}).get("slug", str(index + 1)), row.get("item", {})) for index, row in enumerate(items)]
    n = len(rows)
    findings = []
    if not manifest:
        findings.append(finding("missing_manifest", "critical", 1, 1, []))
    if not final:
        findings.append(finding("missing_final", "critical", 1, 1, []))
    if not manifest.get("sourceUrls"):
        findings.append(finding("missing_sources", "high", 1, 1, []))
    if not n:
        findings.append(finding("empty_dataset", "critical", 1, 1, []))

    # A generic source page can resolve to another game or same-name person.
    # exactMatch alone is not evidence: older manifests marked wrong-title
    # pictures exact. Shared graphics require an explicit corroborating source.
    allowed_image_titles = {
        "gta": {"GTA1"}, "gta-2": {"GTA2"}, "gta-iii": {"GTAIII", "GTA3"},
        "gta-vice-city": {"GTAVC"}, "gta-san-andreas": {"GTASA"},
        "gta-4": {"GTAIV", "GTA4"},
        "gta-4-tbogt": {"GTAIV", "GTA4", "TBOGT"},
        "gta-4-tlad": {"GTAIV", "GTA4", "TLAD"},
        "gta-5": {"GTAV", "GTA5", "GTAO"}, "gta-online": {"GTAV", "GTA5", "GTAO"},
        "gta-advance": {"GTAA"}, "gta-liberty-city-stories": {"GTALCS"},
        "gta-vice-city-stories": {"GTAVCS"}, "gta-chinatown-wars": {"GTACTW", "GTACW"},
        "gta-london-1961": {"GTAL", "GTAL1961"},
        "gta-london-1969": {"GTAL", "GTAL1969"},
    }
    images_path = root / "images.json"
    if images_path.exists():
        images = json.loads(images_path.read_text())
        active_images = {row.get("system", {}).get("slug"): row.get("system", {}).get("image") for row in items}
        image_conflicts = []
        for entry in images.get("entries", []):
            if not active_images.get(entry.get("itemSlug")):
                continue
            provenance = " ".join(str(entry.get(key) or "") for key in ("sourceFile", "sourceImageUrl", "directUrl"))
            tags = {tag.upper() for tag in re.findall(
                r"(?<![A-Z])(GTA(?:LCS|VCS|III|VI|IV|CTW|CW|SA|VC|AA|O|[12345V]|L(?:196[19])?)|TBOGT|TLAD)(?=[^A-Z]|$)",
                provenance, re.I,
            )}
            review = entry.get("scopeReview", {})
            shared = (review.get("result") == "shared-asset"
                      and str(review.get("source", "")).startswith("https://")
                      and bool(review.get("note")))
            if tags and not tags.intersection(allowed_image_titles.get(meta.get("gameSlug"), set())) and not shared:
                image_conflicts.append(f"{entry.get('itemSlug')}: {', '.join(sorted(tags))}")
        if image_conflicts:
            findings.append(finding("image_source_scope_conflict", "high", len(image_conflicts), n, image_conflicts))

    def public_strings(value, prefix=""):
        if isinstance(value, str):
            yield prefix, value
        elif isinstance(value, dict):
            for key, child in value.items():
                yield from public_strings(child, f"{prefix}.{key}" if prefix else key)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                yield from public_strings(child, f"{prefix}[{index}]")

    process_copy = [field for field, value in public_strings(final) if PUBLIC_PROCESS_COPY.search(value)]
    if process_copy:
        findings.append(finding("page_copy_exposes_process", "high", len(process_copy), len(final), process_copy))

    keys = set(meta.get("itemFields", [])) | set(meta.get("columns", []))
    keys.discard("name")
    empty_keys = [key for key in sorted(keys) if not any(filled(item.get(key)) for _, item in rows)]
    if empty_keys:
        findings.append(finding("declared_fields_empty_everywhere", "medium", len(empty_keys), len(keys), empty_keys))

    narrative_keys = {"cardSummary", "description", "bespokeDescription", "bio", "bioLong", "mapHint"}
    count_only_keys = {"name", "guideNumber", "number", "collectionOrder"}
    thin_rows = []
    for row in items:
        item = row.get("item", {})
        system = row.get("system", {})
        useful = sum(filled(value) for key, value in item.items() if key not in count_only_keys | narrative_keys)
        has_distinct_note = any(filled(item.get(key)) for key in narrative_keys)
        numbered_image_guide = filled(item.get("guideNumber")) and filled(item.get("location")) and filled(system.get("image"))
        if useful < 2 and not has_distinct_note and not numbered_image_guide:
            thin_rows.append(system.get("slug", ""))
    if thin_rows:
        findings.append(finding("thin_item_rows", "medium", len(thin_rows), n, thin_rows))

    clipped_descriptions = []
    for row in items:
        item = row.get("item", {})
        description = item.get("description")
        summary = item.get("cardSummary")
        if (isinstance(description, str) and isinstance(summary, str)
                and len(summary) > 120 and description == summary[:120] + "."):
            clipped_descriptions.append(row.get("system", {}).get("slug", ""))
    if clipped_descriptions:
        findings.append(finding("clipped_descriptions", "high", len(clipped_descriptions), n, clipped_descriptions))

    markup_rows = [slug for slug, item in rows if any(
        isinstance(value, str) and re.search(r"\}\}|\{\{|See #|\[\[|\]\]|<ref|\|thumb", value)
        for value in item.values()
    )]
    if markup_rows:
        findings.append(finding("unparsed_source_markup", "high", len(markup_rows), n, markup_rows))

    display = meta.get("display", {})
    visible = list(dict.fromkeys(
        [key for group in ("cardFields", "subtitleFields", "tableFields") for key in display.get(group, [])]
        + [display[key] for key in ("badgeField", "descriptionField", "cardDescriptionField") if display.get(key)]
    ))
    duplicate_visible = []
    for first, second in combinations(visible, 2):
        # GTA 2 keeps separate unlocks for each district. Equal model names
        # across districts are valid and should remain independently labelled.
        if code == "gta-2-vehicles" and first.endswith("Reward") and second.endswith("Reward"):
            continue
        pairs = [(slug, item) for slug, item in rows if filled(item.get(first)) and filled(item.get(second))]
        # Independent boolean capabilities can legitimately share most values.
        # Equal yes/no distributions do not establish duplicate information.
        boolean_values = {"yes", "no", "true", "false"}
        if pairs and all(text(item[key]).casefold() in boolean_values for _, item in pairs for key in (first, second)):
            continue
        duplicates = [slug for slug, item in pairs if text(item[first]).casefold() == text(item[second]).casefold()]
        if len(pairs) >= 10 and len(duplicates) / len(pairs) >= 0.8:
            duplicate_visible.append(f"{first}/{second}: {len(duplicates)}/{len(pairs)} same")
    if duplicate_visible:
        findings.append(finding("duplicate_visible_fields", "medium", len(duplicate_visible), len(visible), duplicate_visible))

    for first, second, severity in [
        ("objectives", "cardSummary", "high"),
        ("mapHint", "location", "high"),
        ("description", "cardSummary", "medium"),
        ("district", "location", "medium"),
        ("district", "area", "medium"),
        ("district", "region", "medium"),
    ]:
        pairs = [(slug, item) for slug, item in rows if filled(item.get(first)) and filled(item.get(second))]
        duplicates = [slug for slug, item in pairs if text(item[first]) == text(item[second])]
        if len(pairs) >= 3 and len(duplicates) / len(pairs) >= 0.8:
            findings.append(finding(f"{first}_duplicates_{second}", severity, len(duplicates), len(pairs), duplicates))

    repetitive = []
    for key in ("cardSummary", "description", "bespokeDescription", "bioLong"):
        values = [text(item.get(key)) for _, item in rows if filled(item.get(key))]
        if len(values) >= 10 and len(set(values)) / len(values) < 0.5:
            repetitive.append(f"{key}: {len(set(values))}/{len(values)} distinct")
    if repetitive:
        findings.append(finding("repeated_descriptive_copy", "high", len(repetitive), 4, repetitive))

    filler_rows = [slug for slug, item in rows if any(FILLER.search(text(value)) for value in item.values())]
    if filler_rows:
        findings.append(finding("known_filler_copy", "high", len(filler_rows), n, filler_rows))
    placeholder_rows = [slug for slug, item in rows if any(PLACEHOLDER.fullmatch(text(value)) for value in item.values())]
    if placeholder_rows:
        findings.append(finding("public_placeholder_value", "medium", len(placeholder_rows), n, placeholder_rows))

    prose_fields = {"cardSummary", "description", "bespokeDescription", "bio", "bioLong", "mapHint", "objective", "objectives"}
    abbreviated = [f"{slug}:{key}={value}" for slug, item in rows for key, raw in item.items()
                   if key in prose_fields and isinstance(raw, str) and 0 < len(value := raw.strip()) <= 4]
    if abbreviated:
        findings.append(finding("suspicious_short_prose", "medium", len(abbreviated), n, abbreviated))

    range_mismatch = []
    for slug, item in rows:
        match = re.fullmatch(r"\s*(\d+)\s*[-–]\s*(\d+)\s*", text(item.get("players")))
        if match and filled(item.get("crewMax")) and text(item["crewMax"]) != match.group(2):
            range_mismatch.append(slug)
    if range_mismatch:
        findings.append(finding("player_range_conflicts_with_crew_max", "critical", len(range_mismatch), n, range_mismatch))

    if "radio" in str(meta.get("collection", "")) and code != "gta-advance-radio-media":
        def has_fixed_music(item):
            identity = " ".join(text(item.get(key)) for key in ("name", "genre", "stationType", "format")).lower()
            return not (re.search(r"\btalk\b", identity) or any(label in identity for label in (
                "self radio", "media player", "player-selected music", "independence fm",
                "mp3 player", "tape deck", "user track", "cut radio", "custom radio",
            )))

        no_tracks = [slug for slug, item in rows if has_fixed_music(item) and not filled(item.get("tracklist"))]
        if no_tracks:
            findings.append(finding("radio_station_without_tracklist", "high", len(no_tracks), n, no_tracks))

    image_gaps = [slug for (slug, _), row in zip(rows, items) if not filled(row.get("system", {}).get("image"))]
    documented_text_only = str(meta.get("notes", {}).get("imagePolicy", "")).lower().startswith("no item images:")
    if image_gaps and "cheat" not in str(meta.get("collection", "")) and not (documented_text_only and len(image_gaps) == n):
        severity = "high" if manifest.get("collection", {}).get("pageType") in ("collectible", "checklist") else "medium"
        findings.append(finding("missing_item_images", severity, len(image_gaps), n, image_gaps))

    # Byte-identical thumbnails across distinct items often mean a generic
    # screenshot was silently assigned to the entire roster.
    media_root = root / manifest.get("mediaRoot", "media")
    hashes = {}
    for row in items:
        image = row.get("system", {}).get("image")
        if not image:
            continue
        image_path = media_root / image
        if image_path.is_file():
            digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
            hashes.setdefault(digest, []).append(row.get("system", {}).get("slug", image))
    reused = [slugs for slugs in hashes.values() if len(slugs) >= 3]
    if reused:
        findings.append(finding("identical_images_across_items", "high", sum(map(len, reused)), n, [", ".join(group[:5]) for group in sorted(reused, key=len, reverse=True)]))

    return {
        "code": code,
        "path": str(path.relative_to(ROOT)),
        "items": n,
        "sources": len(manifest.get("sourceUrls", [])),
        "findings": findings,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=Path, help="Write complete report to this path")
    parser.add_argument("--map", type=Path, help="JSON object mapping published codes to their reviewed dataset paths")
    args = parser.parse_args()
    if args.map:
        mapping_file = args.map if args.map.is_absolute() else ROOT / args.map
        mapping = json.loads(mapping_file.read_text())
        paths = [ROOT / value for value in mapping.values()]
        if len(paths) != len(set(paths)) or any(not path.is_file() for path in paths):
            raise ValueError("The authoritative workspace map has duplicate or missing dataset paths")
    else:
        paths = sorted(WORKSPACE.glob("*/collections/*/dataset.json"))
    pages = [inspect(path) for path in paths]
    counts = Counter(f["severity"] for page in pages for f in page["findings"])
    by_kind = Counter(f["kind"] for page in pages for f in page["findings"])
    report = {"workspacePages": len(pages), "items": sum(page["items"] for page in pages), "findingCounts": dict(counts), "kindCounts": dict(by_kind), "pages": pages}
    if args.json:
        out = args.json if args.json.is_absolute() else ROOT / args.json
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"GTA quality profile: {report['workspacePages']} authoring pages, {report['items']} items")
    print("Findings by severity:", dict(counts))
    print("Findings by type:", dict(by_kind))
    ranked = sorted(pages, key=lambda page: (sum({"critical": 8, "high": 3, "medium": 1}[f["severity"]] for f in page["findings"]), page["items"]), reverse=True)
    for page in ranked[:25]:
        if page["findings"]:
            print(page["code"], page["items"], ", ".join(f"{f['kind']}={f['count']}" for f in page["findings"]))


if __name__ == "__main__":
    main()
