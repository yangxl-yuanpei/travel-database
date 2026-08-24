"""Convert the Nanchang food candidate dataset into travel knowledge nodes.

The source file remains outside the repository. This importer intentionally reads
only ``food_candidates`` and never copies credentials or OCR image files.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "cities" / "nanchang" / "food"


@dataclass(frozen=True)
class FoodArea:
    id: str
    name: str
    short_name: str
    longitude: float
    latitude: float
    radius_km: float
    raw_areas: tuple[str, ...]
    description: str
    related_node_ids: tuple[str, ...]


AREAS = (
    FoodArea(
        "nc_food_area_dashiyuan",
        "大士院—蛤蟆街美食区",
        "大士院",
        115.8854,
        28.6847,
        1.5,
        ("大士院", "蛤蟆街"),
        "传统早餐、小吃和老店较集中的步行型美食片区。",
        ("nc_tengwangge",),
    ),
    FoodArea(
        "nc_food_area_wanshougong",
        "万寿宫—珠宝街美食区",
        "万寿宫",
        115.8897,
        28.6734,
        1.2,
        ("万寿宫", "珠宝街"),
        "靠近万寿宫历史文化街区，以街头小吃、糕点、饮品和夜间消费为主。",
        ("nc_wanshougong_block", "nc_bayi_memorial"),
    ),
    FoodArea(
        "nc_food_area_yangzixiang",
        "羊子巷—系马桩美食区",
        "羊子巷",
        115.8992,
        28.6735,
        1.15,
        ("羊子巷", "系马桩", "大顺巷"),
        "水煮、粉面、小炒和本地小吃密集的老城餐饮片区。",
        ("nc_bayi_square", "nc_wanshougong_block"),
    ),
    FoodArea(
        "nc_food_area_bayi",
        "八一广场—孺子路美食区",
        "八一广场",
        115.9078,
        28.6718,
        1.4,
        ("八一广场",),
        "适合作为市中心游览前后补给的粉面、正餐与夜宵片区。",
        ("nc_bayi_square",),
    ),
    FoodArea(
        "nc_food_area_honggutan",
        "红谷滩中心美食区",
        "红谷滩",
        115.8538,
        28.6905,
        2.7,
        ("红谷滩",),
        "覆盖万达金街及红谷滩中心商圈，餐饮类型较综合。",
        ("nc_jx_museum", "nc_qiushui_square"),
    ),
    FoodArea(
        "nc_food_area_hongdu",
        "洪都—上海路美食区",
        "洪都",
        115.9228,
        28.6386,
        2.0,
        ("洪都",),
        "以水煮、小吃和本地社区餐饮为主，距老城核心区较远。",
        (),
    ),
    FoodArea(
        "nc_food_area_zijing",
        "紫荆夜市—经开美食区",
        "紫荆夜市",
        115.8350,
        28.7335,
        1.9,
        ("紫荆夜市",),
        "以夜市、学生消费和小吃粉面为主的经开片区。",
        (),
    ),
)


AREA_BY_RAW_NAME = {
    raw_name: area for area in AREAS for raw_name in area.raw_areas
}


def unique_strings(values: Any, limit: int | None = None) -> list[str]:
    result: list[str] = []
    if not isinstance(values, list):
        return result
    for value in values:
        if isinstance(value, str) and value.strip() and value.strip() not in result:
            result.append(value.strip())
            if limit is not None and len(result) >= limit:
                break
    return result


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    value = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return radius * 2 * math.asin(math.sqrt(value))


def parse_coordinate(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def parse_price(value: Any) -> int | None:
    if not isinstance(value, str):
        return None
    match = re.search(r"\d+", value)
    return int(match.group()) if match else None


def category_codes(categories: list[str]) -> list[str]:
    codes = {
        "早餐": "breakfast",
        "米粉": "rice_noodles",
        "拌粉": "mixed_rice_noodles",
        "瓦罐汤": "claypot_soup",
        "水煮": "shuizhu_snacks",
        "赣菜": "jiangxi_cuisine",
        "正餐": "full_meal",
        "烧烤": "barbecue",
        "夜宵": "late_night",
        "甜品": "dessert",
        "饮品": "drinks",
        "糕点": "pastry",
        "伴手礼": "souvenir",
        "小吃": "snacks",
        "茶馆": "teahouse",
        "卤味": "braised_food",
    }
    return [codes[item] for item in categories if item in codes]


def meal_periods(categories: list[str]) -> list[str]:
    periods: list[str] = []
    mapping = {
        "早餐": ("breakfast",),
        "米粉": ("breakfast", "lunch", "dinner"),
        "拌粉": ("breakfast", "lunch", "dinner"),
        "瓦罐汤": ("breakfast", "lunch", "dinner"),
        "赣菜": ("lunch", "dinner"),
        "正餐": ("lunch", "dinner"),
        "烧烤": ("dinner", "late_night"),
        "夜宵": ("late_night",),
        "甜品": ("afternoon", "evening"),
        "饮品": ("afternoon", "evening"),
        "茶馆": ("afternoon", "evening"),
        "小吃": ("anytime",),
        "糕点": ("anytime",),
        "伴手礼": ("anytime",),
        "水煮": ("lunch", "dinner", "late_night"),
        "卤味": ("anytime",),
    }
    for category in categories:
        for period in mapping.get(category, ("anytime",)):
            if period not in periods:
                periods.append(period)
    return periods or ["unknown"]


def choose_area(candidate: dict[str, Any], longitude: float | None, latitude: float | None) -> FoodArea | None:
    raw_area = candidate.get("area")
    preferred = AREA_BY_RAW_NAME.get(raw_area) if isinstance(raw_area, str) else None
    if preferred:
        if longitude is None or latitude is None:
            return preferred
        if haversine_km(longitude, latitude, preferred.longitude, preferred.latitude) <= max(preferred.radius_km, 2.2):
            return preferred
        return None
    if longitude is None or latitude is None:
        return None
    ranked = sorted(
        ((haversine_km(longitude, latitude, area.longitude, area.latitude), area) for area in AREAS),
        key=lambda item: item[0],
    )
    distance, area = ranked[0]
    return area if distance <= area.radius_km else None


def confidence(candidate: dict[str, Any], source_count: int) -> tuple[str, str]:
    status = candidate.get("location_status")
    reviews = candidate.get("dianping") if isinstance(candidate.get("dianping"), dict) else {}
    uncertain_name = candidate.get("name_status") == "uncertain"
    if status == "found" and source_count >= 2 and (reviews.get("score") is not None or reviews.get("review_count")) and not uncertain_name:
        return "medium-high", "高德位置较明确，且有多张游客截图或第三方点评数据交叉支持；尚未人工实地核验。"
    if status == "found" and not uncertain_name:
        return "medium", "高德位置匹配较明确，但游客经验与营业状态仍需人工复核。"
    if status in {"found", "found_partial"}:
        return "low-medium", "名称或位置存在近似匹配，适合作为候选，不应直接视为已核验推荐。"
    return "low", "缺少可靠 POI 或仅为菜品名，目前只保留为待核验候选。"


def duration_profile(categories: list[str]) -> tuple[int, int, int]:
    if "正餐" in categories or "赣菜" in categories:
        return 40, 60, 120
    if "茶馆" in categories:
        return 30, 60, 150
    if "夜宵" in categories or "烧烤" in categories:
        return 40, 60, 120
    return 10, 20, 45


def build_experience(candidate: dict[str, Any], source_ids: list[str], categories: list[str]) -> dict[str, Any]:
    visitor = candidate.get("visitor_experience") if isinstance(candidate.get("visitor_experience"), dict) else {}
    positives = unique_strings(visitor.get("positive"), 5)
    keywords = unique_strings(visitor.get("keywords"), 5)
    negatives = unique_strings(visitor.get("negative"), 4)
    combined_positive = []
    for value in positives + keywords:
        if value not in combined_positive:
            combined_positive.append(value)
    source_count = len(source_ids)
    level, reason = confidence(candidate, source_count)
    queue_text = " ".join(combined_positive + negatives)
    queue_signal = "排队" in queue_text or "必吃榜" in str((candidate.get("dianping") or {}).get("rank") or "")
    duration_min, recommended_min, recommended_max = duration_profile(categories)
    dishes = unique_strings(candidate.get("recommended_dishes"), 8)
    tips: list[str] = []
    if dishes:
        tips.append(f"优先从候选推荐菜中选择：{'、'.join(dishes[:5])}")
    tips.append("出发前通过高德或电话渠道复核营业状态与具体分店。")
    if candidate.get("location_status") == "found_partial":
        tips.append("该店名称或位置为近似匹配，到店前需再次确认。")
    avoid = [
        {"content": item, "risk": "negative_review_signal", "severity": "medium"}
        for item in negatives
    ]
    if queue_signal:
        avoid.append({"content": "热门时段可能排队，国庆期间建议错峰。", "risk": "food_queue", "severity": "medium"})
    return {
        "source": [f"游客截图:{image_id}" for image_id in source_ids] or ["游客截图候选数据库"],
        "confidence": {"overall": level, "reason": reason},
        "positive": [{"content": item, "type": "visitor_keyword"} for item in combined_positive],
        "avoid": avoid,
        "visit_tips": tips,
        "crowd_model": {
            "weekday": "待核验",
            "weekend": "热门店铺可能增加",
            "national_holiday": "排队风险较高" if queue_signal else "预计高于平日，需动态查询",
        },
        "recommended_duration": {
            "minimum_minutes": duration_min,
            "recommended_min_minutes": recommended_min,
            "recommended_max_minutes": recommended_max,
        },
        "ai_note": "本节点由游客截图、高德候选 POI 与第三方点评摘要转换而来；推荐菜和体验属于经验层，不代表官方承诺。",
    }


def build_ai_score(candidate: dict[str, Any], categories: list[str], average_price: int | None) -> dict[str, int | None]:
    reviews = candidate.get("dianping") if isinstance(candidate.get("dianping"), dict) else {}
    visitor = candidate.get("visitor_experience") if isinstance(candidate.get("visitor_experience"), dict) else {}
    signals = " ".join(unique_strings(visitor.get("positive")) + unique_strings(visitor.get("negative")) + unique_strings(visitor.get("keywords")))
    local_categories = {"早餐", "米粉", "拌粉", "瓦罐汤", "水煮", "赣菜", "小吃", "糕点", "卤味"}
    local_character = 5 if len(local_categories.intersection(categories)) >= 2 else 4 if local_categories.intersection(categories) else 2
    if average_price is None:
        value = None
    elif average_price <= 20:
        value = 5
    elif average_price <= 50:
        value = 4
    elif average_price <= 100:
        value = 3
    else:
        value = 2
    review_count = reviews.get("review_count") if isinstance(reviews.get("review_count"), int) else 0
    if "排队" in signals or reviews.get("rank"):
        queue_risk = 5
    elif review_count >= 5000:
        queue_risk = 4
    elif review_count >= 1000:
        queue_risk = 3
    else:
        queue_risk = None
    return {
        "local_character": local_character,
        "value": value,
        "queue_risk": queue_risk,
        "family": None,
        "late_night": 5 if "夜宵" in categories or "烧烤" in categories else 3 if "正餐" in categories else None,
        "photo": 4 if "拍照" in signals or "出片" in signals else None,
    }


def node_id(candidate: dict[str, Any], index: int) -> str:
    gaode = candidate.get("gaode") if isinstance(candidate.get("gaode"), dict) else {}
    poi_id = gaode.get("poi_id")
    if isinstance(poi_id, str) and re.fullmatch(r"[A-Za-z0-9]+", poi_id):
        return f"nc_food_rest_{poi_id.lower()}"
    scope = "dish" if candidate.get("location_status") == "dish" else "candidate"
    return f"nc_food_{scope}_{index:03d}"


def build_restaurant_node(candidate: dict[str, Any], index: int) -> tuple[dict[str, Any], FoodArea | None]:
    gaode = candidate.get("gaode") if isinstance(candidate.get("gaode"), dict) else {}
    longitude = parse_coordinate(gaode.get("lng"))
    latitude = parse_coordinate(gaode.get("lat"))
    area = choose_area(candidate, longitude, latitude)
    categories = unique_strings(candidate.get("category"))
    source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
    source_ids = unique_strings(source.get("image_id"))
    dishes = unique_strings(candidate.get("recommended_dishes"), 12)
    reviews = candidate.get("dianping") if isinstance(candidate.get("dianping"), dict) else {}
    average_price = parse_price(reviews.get("avg_price"))
    status = candidate.get("location_status") if isinstance(candidate.get("location_status"), str) else "not_found"
    is_dish = status == "dish"
    minimum, recommended_min, recommended_max = duration_profile(categories)
    address = gaode.get("address") if isinstance(gaode.get("address"), str) else candidate.get("address")
    if not isinstance(address, str):
        address = None
    location = {
        "address": address,
        "latitude": latitude,
        "longitude": longitude,
        "coordinate_system": "GCJ-02",
        "amap_poi_id": gaode.get("poi_id") if isinstance(gaode.get("poi_id"), str) else None,
        "status": status,
    }
    node = {
        "id": node_id(candidate, index),
        "name": candidate.get("name") or f"未命名候选{index}",
        "short_name": candidate.get("name") or f"候选{index}",
        "city": "南昌",
        "node_type": "food",
        "food_scope": "dish" if is_dish else "restaurant",
        "parent_id": area.id if area else None,
        "branch": candidate.get("branch") if isinstance(candidate.get("branch"), str) else None,
        "category": categories,
        "category_codes": category_codes(categories),
        "official_info": {
            "status": "not_officially_verified",
            "description": "游客内容中的候选菜品，尚未绑定可靠店铺。" if is_dish else "候选餐饮节点；名称和地址来自游客资料与第三方地图匹配，非店铺官方资料。",
            "directory_name": gaode.get("name") if isinstance(gaode.get("name"), str) else None,
            "directory_district": gaode.get("district") if isinstance(gaode.get("district"), str) else None,
        },
        "location": location,
        "meal_periods": meal_periods(categories),
        "menu_profile": {"recommended_dishes": dishes, "source_type": "visitor_experience"},
        "price_range_cny": {
            "average_reference": average_price,
            "raw_reference": reviews.get("avg_price") if isinstance(reviews.get("avg_price"), str) else None,
            "status": "third_party_snapshot" if average_price is not None else "unknown",
        },
        "duration": {
            "minimum_minutes": minimum,
            "recommended_minutes": recommended_min,
            "maximum_minutes": recommended_max,
        },
        "experience_layer": build_experience(candidate, source_ids, categories),
        "third_party_review_snapshot": {
            "score": reviews.get("score") if isinstance(reviews.get("score"), (int, float)) else None,
            "average_price": reviews.get("avg_price") if isinstance(reviews.get("avg_price"), str) else None,
            "review_count": reviews.get("review_count") if isinstance(reviews.get("review_count"), int) else None,
            "rank": reviews.get("rank") if isinstance(reviews.get("rank"), str) else None,
            "sentiment": reviews.get("sentiment") if isinstance(reviews.get("sentiment"), str) else "无数据",
            "score_source": reviews.get("score_source") if isinstance(reviews.get("score_source"), str) else "无数据",
            "review_excerpts_stored": False,
        },
        "source_trace": {
            "platform": source.get("platform") if isinstance(source.get("platform"), str) else None,
            "image_ids": source_ids,
            "raw_verification_status": candidate.get("verification_status"),
            "raw_location_status": status,
            "location_note": candidate.get("location_note"),
            "name_status": candidate.get("name_status"),
            "note": candidate.get("note"),
        },
        "ai_score": build_ai_score(candidate, categories, average_price),
        "tags": list(dict.fromkeys(categories + ([area.short_name] if area else []) + ["南昌美食候选", "待人工核验"])),
        "metadata": {
            "schema_version": "1.0",
            "data_status": "draft",
            "last_verified_at": None,
            "import_source": "nanchang_food_candidates_raw.json",
        },
    }
    return node, area


def area_experience(area: FoodArea, child_nodes: list[dict[str, Any]]) -> dict[str, Any]:
    queue_count = sum(1 for child in child_nodes if child["ai_score"].get("queue_risk") in {4, 5})
    located_count = sum(1 for child in child_nodes if child["location"].get("latitude") is not None)
    return {
        "source": ["南昌美食候选数据库:41张游客截图", "高德POI空间聚合", "第三方点评摘要"],
        "confidence": {
            "overall": "medium",
            "reason": "区域边界由候选店铺坐标与传统片区名称聚合，适合旅行决策，但不代表行政或官方商圈边界。",
        },
        "positive": [
            {"content": f"收录{len(child_nodes)}个候选子节点，其中{located_count}个带可用坐标。", "type": "data_coverage"},
            {"content": area.description, "type": "area_character"},
        ],
        "avoid": ([{"content": f"有{queue_count}家候选节点存在较高排队信号，国庆需错峰。", "risk": "food_queue", "severity": "medium"}] if queue_count else []),
        "visit_tips": ["先结合附近景点选择片区，再进入代表店铺与推荐菜。", "营业时间、排队和临时闭店应通过高德动态复核。"],
        "crowd_model": {"weekday": "分店差异较大", "weekend": "热门店铺客流上升", "national_holiday": "核心片区排队风险高"},
        "recommended_duration": {"minimum_minutes": 30, "recommended_min_minutes": 60, "recommended_max_minutes": 180},
        "ai_note": "区域节点只承担地图选择与检索入口；店铺间距离和通勤不写入数据库，由高德 API 动态计算。",
    }


def build_area_node(area: FoodArea, children: list[dict[str, Any]]) -> dict[str, Any]:
    restaurant_ids = [child["id"] for child in children if child["food_scope"] == "restaurant"]
    dish_ids = [child["id"] for child in children if child["food_scope"] == "dish"]
    periods: list[str] = []
    prices: list[int] = []
    categories: list[str] = []
    for child in children:
        for value in child["meal_periods"]:
            if value not in periods and value != "unknown":
                periods.append(value)
        for value in child["category"]:
            if value not in categories:
                categories.append(value)
        price = child["price_range_cny"].get("average_reference")
        if isinstance(price, int):
            prices.append(price)
    queue_scores = [child["ai_score"]["queue_risk"] for child in children if child["ai_score"].get("queue_risk")]
    value_scores = [child["ai_score"]["value"] for child in children if child["ai_score"].get("value")]
    return {
        "id": area.id,
        "name": area.name,
        "short_name": area.short_name,
        "city": "南昌",
        "node_type": "food",
        "food_scope": "area",
        "category": ["美食区域"] + categories[:8],
        "official_info": {"status": "ai_aggregated_area", "description": area.description, "boundary_rule": "候选店铺空间聚合，不是官方商圈边界"},
        "location": {
            "address": f"{area.short_name}片区中心锚点",
            "latitude": area.latitude,
            "longitude": area.longitude,
            "coordinate_system": "GCJ-02",
            "amap_poi_id": None,
            "map_anchor": area.short_name,
        },
        "meal_periods": periods,
        "price_range_cny": {
            "minimum": min(prices) if prices else None,
            "maximum": max(prices) if prices else None,
            "status": "third_party_snapshot" if prices else "dynamic",
        },
        "duration": {"minimum_minutes": 30, "recommended_minutes": 90, "maximum_minutes": 180},
        "child_nodes": {"dishes": dish_ids, "restaurants": restaurant_ids},
        "related_node_ids": list(area.related_node_ids),
        "experience_layer": area_experience(area, children),
        "ai_score": {
            "local_character": 5,
            "value": round(sum(value_scores) / len(value_scores)) if value_scores else None,
            "queue_risk": max(queue_scores) if queue_scores else None,
            "family": None,
            "late_night": 5 if "late_night" in periods else 3,
        },
        "tags": ["南昌美食", "美食区域", area.short_name, "国庆错峰"],
        "metadata": {"schema_version": "1.0", "data_status": "draft", "last_verified_at": None, "import_source": "nanchang_food_candidates_raw.json"},
    }


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Path to nanchang_food_candidates_raw.json")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    payload = json.loads(args.source.read_text(encoding="utf-8"))
    candidates = payload.get("food_candidates")
    if not isinstance(candidates, list):
        raise ValueError("source JSON must contain food_candidates[]")

    if args.output.exists():
        shutil.rmtree(args.output)
    args.output.mkdir(parents=True)

    grouped: dict[str, list[dict[str, Any]]] = {area.id: [] for area in AREAS}
    unassigned = 0
    mapped = 0
    dish_count = 0
    for index, candidate in enumerate(candidates, start=1):
        if not isinstance(candidate, dict):
            continue
        node, area = build_restaurant_node(candidate, index)
        if node["food_scope"] == "dish":
            dish_count += 1
            destination = args.output / "dishes" / f"{node['id']}.json"
        elif area:
            destination = args.output / "restaurants" / area.id.removeprefix("nc_food_area_") / f"{node['id']}.json"
        else:
            destination = args.output / "restaurants" / "unmapped" / f"{node['id']}.json"
        write_json(destination, node)
        if area:
            grouped[area.id].append(node)
            mapped += 1
        else:
            unassigned += 1

    for area in AREAS:
        write_json(args.output / "areas" / f"{area.id}.json", build_area_node(area, grouped[area.id]))

    manifest = {
        "source_city": payload.get("city"),
        "source_candidate_count": len(candidates),
        "generated_area_count": len(AREAS),
        "generated_dish_count": dish_count,
        "unassigned_candidate_count": unassigned,
        "mapped_candidate_count": mapped,
        "policy": "City map references area nodes only; restaurant and dish nodes remain independent children or unmapped draft candidates.",
    }
    summary_lines = ["# 南昌美食导入摘要", ""] + [f"- `{key}`: {value}" for key, value in manifest.items()]
    (args.output / "IMPORT_SUMMARY.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
