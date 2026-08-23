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
                "recommended_duration",
                "ai_note",
            }
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
                duration = experience_layer.get("recommended_duration", {})
                minute_keys = (
                    "minimum_minutes",
                    "recommended_min_minutes",
                    "recommended_max_minutes",
                )
                minute_values = [duration.get(key) for key in minute_keys] if isinstance(duration, dict) else []
                if (
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

    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validation passed: {len(nodes)} node(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
