"""Validate travel node JSON without third-party dependencies."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data"
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")
CHILD_TYPES = {
    "permanent_exhibition",
    "temporary_exhibition",
    "artifact",
    "collection_group",
    "history_event",
    "historic_site",
    "archaeological_site",
}
NODE_TYPES = {
    "city", "journey", "itinerary", "attraction", "museum", "memorial",
    "permanent_exhibition", "temporary_exhibition", "artifact",
    "collection_group", "history_event", "historic_site",
    "archaeological_site", "food", "accommodation_area", "transport",
}
CONTENT_STATUSES = {"draft", "candidate", "complete", "needs_update", "archived"}
VERIFICATION_LEVELS = {"unverified", "experience_only", "third_party", "official", "mixed", "historical"}
TIME_SENSITIVITIES = {"low", "medium", "high", "critical"}
CONFIDENCE_LEVELS = {"low", "low-medium", "medium", "medium-high", "high"}
MEDIA_TYPES = {
    "exterior", "interior", "exhibition_hall", "artifact", "viewpoint",
    "night_view", "food", "street_environment", "transport_entrance",
    "accommodation_environment",
}
MEDIA_SOURCE_TYPES = {"official", "open_license", "self_produced", "user_provided"}


def iter_reference_ids(node: dict) -> list[str]:
    references: list[str] = []
    child_nodes = node.get("child_nodes", {})
    if isinstance(child_nodes, dict):
        for values in child_nodes.values():
            if isinstance(values, list):
                references.extend(value for value in values if isinstance(value, str))
    for key in (
        "related_node_ids",
        "related_artifact_ids",
        "related_exhibition_ids",
        "related_collection_group_ids",
        "artifact_ids",
    ):
        values = node.get(key, [])
        if isinstance(values, list):
            references.extend(value for value in values if isinstance(value, str))
    return references


def main() -> int:
    errors: list[str] = []
    nodes: dict[str, tuple[Path, dict]] = {}
    media_assets: dict[str, Path] = {}

    for path in sorted(DATA_ROOT.rglob("*.json")):
        try:
            node = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path.relative_to(ROOT)}: invalid JSON: {exc}")
            continue

        if not isinstance(node, dict):
            errors.append(f"{path.relative_to(ROOT)}: root value must be an object")
            continue

        missing = [key for key in ("id", "name", "node_type") if not node.get(key)]
        if missing:
            errors.append(
                f"{path.relative_to(ROOT)}: missing required fields: {', '.join(missing)}"
            )
            continue

        node_id = node["id"]
        if not isinstance(node_id, str) or not ID_PATTERN.fullmatch(node_id):
            errors.append(f"{path.relative_to(ROOT)}: invalid id {node_id!r}")
            continue
        if node_id in nodes:
            first_path = nodes[node_id][0].relative_to(ROOT)
            errors.append(
                f"{path.relative_to(ROOT)}: duplicate id {node_id!r}; first seen in {first_path}"
            )
            continue
        nodes[node_id] = (path, node)

        if node.get("node_type") not in NODE_TYPES:
            errors.append(
                f"{path.relative_to(ROOT)}: unknown node_type {node.get('node_type')!r}"
            )

        for field in ("aliases", "category", "tags", "sources"):
            if not isinstance(node.get(field), list):
                errors.append(f"{path.relative_to(ROOT)}: {field} must be a list")

        metadata = node.get("metadata")
        if not isinstance(metadata, dict):
            errors.append(f"{path.relative_to(ROOT)}: metadata must be an object")
        else:
            if metadata.get("schema_version") != "2.0":
                errors.append(f"{path.relative_to(ROOT)}: metadata.schema_version must be '2.0'")
            if metadata.get("content_status") not in CONTENT_STATUSES:
                errors.append(f"{path.relative_to(ROOT)}: invalid metadata.content_status {metadata.get('content_status')!r}")
            if metadata.get("verification_level") not in VERIFICATION_LEVELS:
                errors.append(f"{path.relative_to(ROOT)}: invalid metadata.verification_level {metadata.get('verification_level')!r}")
            if metadata.get("time_sensitivity") not in TIME_SENSITIVITIES:
                errors.append(f"{path.relative_to(ROOT)}: invalid metadata.time_sensitivity {metadata.get('time_sensitivity')!r}")
            if "last_verified_at" not in metadata or "next_review_at" not in metadata:
                errors.append(f"{path.relative_to(ROOT)}: metadata requires last_verified_at and next_review_at")

        city_id = node.get("city_id")
        if city_id is not None and (not isinstance(city_id, str) or not city_id.startswith("city_")):
            errors.append(f"{path.relative_to(ROOT)}: invalid city_id {city_id!r}")
        if node.get("node_type") not in {"city", "journey", "itinerary", "transport"} and not city_id:
            errors.append(f"{path.relative_to(ROOT)}: city-scoped node requires city_id")

        sources = node.get("sources", [])
        for index, source in enumerate(sources if isinstance(sources, list) else []):
            if not isinstance(source, dict) or not source.get("name") or not source.get("url"):
                errors.append(f"{path.relative_to(ROOT)}: sources[{index}] requires name and url")

        media = node.get("media")
        if media is not None:
            if not isinstance(media, dict) or "cover" not in media or not isinstance(media.get("gallery"), list):
                errors.append(f"{path.relative_to(ROOT)}: media requires cover and gallery")
            else:
                assets = ([media.get("cover")] if media.get("cover") else []) + media.get("gallery", [])
                for index, asset in enumerate(assets):
                    label = "cover" if index == 0 and media.get("cover") else f"gallery[{index - 1 if media.get('cover') else index}]"
                    if not isinstance(asset, dict):
                        errors.append(f"{path.relative_to(ROOT)}: media.{label} must be an object")
                        continue
                    required_media = {"asset_id", "path", "type", "alt", "source_type", "source_name", "source_url", "license", "credit", "verified_at"}
                    missing_media = sorted(required_media - set(asset))
                    if missing_media:
                        errors.append(f"{path.relative_to(ROOT)}: media.{label} missing: {', '.join(missing_media)}")
                        continue
                    asset_id = asset.get("asset_id")
                    if asset_id in media_assets:
                        errors.append(f"{path.relative_to(ROOT)}: duplicate media asset_id {asset_id!r}")
                    elif isinstance(asset_id, str):
                        media_assets[asset_id] = path
                    if asset.get("type") not in MEDIA_TYPES:
                        errors.append(f"{path.relative_to(ROOT)}: invalid media type {asset.get('type')!r}")
                    if asset.get("source_type") not in MEDIA_SOURCE_TYPES:
                        errors.append(f"{path.relative_to(ROOT)}: invalid media source_type {asset.get('source_type')!r}")
                    if asset.get("source_type") == "open_license":
                        for field in ("source_name", "source_url", "license", "credit"):
                            if not isinstance(asset.get(field), str) or not asset[field].strip():
                                errors.append(
                                    f"{path.relative_to(ROOT)}: open-license media.{label} requires non-empty {field}"
                                )
                    media_path = asset.get("path")
                    if not isinstance(media_path, str) or not media_path.startswith("/images/"):
                        errors.append(f"{path.relative_to(ROOT)}: media path must start with /images/")
                    elif not (ROOT / "web" / "public" / media_path.lstrip("/")).is_file():
                        errors.append(f"{path.relative_to(ROOT)}: media file does not exist: {media_path}")

        if node.get("node_type") in CHILD_TYPES and not node.get("parent_id"):
            errors.append(f"{path.relative_to(ROOT)}: child node requires parent_id")

        scores = node.get("ai_score", {})
        if isinstance(scores, dict):
            for score_name, score in scores.items():
                if score is not None and (not isinstance(score, int) or not 1 <= score <= 5):
                    errors.append(
                        f"{path.relative_to(ROOT)}: ai_score.{score_name} must be 1-5 or null"
                    )

        experience_layer = node.get("experience_layer")
        if experience_layer is not None:
            required_experience_fields = {
                "source",
                "confidence",
                "positive",
                "avoid",
                "visit_tips",
                "crowd_model",
                "ai_note",
            }
            if node.get("node_type") != "accommodation_area":
                required_experience_fields.add("recommended_duration")
            if not isinstance(experience_layer, dict):
                errors.append(f"{path.relative_to(ROOT)}: experience_layer must be an object")
            else:
                missing_experience_fields = sorted(
                    required_experience_fields - set(experience_layer)
                )
                if missing_experience_fields:
                    errors.append(
                        f"{path.relative_to(ROOT)}: experience_layer missing: "
                        + ", ".join(missing_experience_fields)
                    )
                sources = experience_layer.get("source")
                if not isinstance(sources, list) or not sources:
                    errors.append(
                        f"{path.relative_to(ROOT)}: experience_layer.source must be a non-empty list"
                    )
                confidence = experience_layer.get("confidence")
                confidence_overall = confidence.get("overall") if isinstance(confidence, dict) else None
                if confidence_overall not in CONFIDENCE_LEVELS:
                    errors.append(
                        f"{path.relative_to(ROOT)}: invalid experience_layer.confidence.overall "
                        f"{confidence_overall!r}"
                    )
                duration = experience_layer.get("recommended_duration")
                minute_keys = (
                    "minimum_minutes",
                    "recommended_min_minutes",
                    "recommended_max_minutes",
                )
                minute_values = [duration.get(key) for key in minute_keys] if isinstance(duration, dict) else []
                if duration is not None and (
                    len(minute_values) != 3
                    or any(not isinstance(value, int) or value <= 0 for value in minute_values)
                    or minute_values != sorted(minute_values)
                ):
                    errors.append(
                        f"{path.relative_to(ROOT)}: experience_layer duration minutes must be positive and ordered"
                    )

    known_ids = set(nodes)
    for node_id, (path, node) in nodes.items():
        parent_id = node.get("parent_id")
        if parent_id and parent_id not in known_ids:
            errors.append(
                f"{path.relative_to(ROOT)}: unknown parent_id {parent_id!r}"
            )
        for reference_id in iter_reference_ids(node):
            if reference_id not in known_ids:
                errors.append(
                    f"{path.relative_to(ROOT)}: unknown node reference {reference_id!r}"
                )
        city_id = node.get("city_id")
        if city_id and (city_id not in nodes or nodes[city_id][1].get("node_type") != "city"):
            errors.append(f"{path.relative_to(ROOT)}: unknown city_id {city_id!r}")

    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validation passed: {len(nodes)} node(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
