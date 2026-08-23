# 城市美食与住宿图层数据契约

城市页面固定提供 `景点`、`美食`、`住宿` 三个图层。展示层不内置模拟节点；相应 JSON 加入城市 `child_nodes` 后，由生成脚本自动接入。

## 美食图层

城市节点的 `child_nodes.food` 只引用带坐标、适合在城市总图展示的美食区域：

```json
{
  "id": "nc_food_area_example",
  "name": "美食区域名称",
  "city": "南昌",
  "node_type": "food",
  "food_scope": "area",
  "location": {
    "latitude": 0,
    "longitude": 0,
    "coordinate_system": "GCJ-02",
    "amap_poi_id": null
  },
  "meal_periods": ["breakfast", "dinner", "late_night"],
  "price_range_cny": {"minimum": null, "maximum": null, "status": "dynamic"},
  "child_nodes": {"dishes": [], "restaurants": []},
  "ai_score": {
    "local_character": null,
    "value": null,
    "queue_risk": null,
    "family": null,
    "late_night": null
  }
}
```

菜品和代表店铺作为美食区域的独立子节点，不直接加入城市总图。美食模式自动将景点显示为灰色参照层；景点间距离和通勤时间不写入 JSON。

## 住宿图层

城市节点的 `child_nodes.accommodation_areas` 引用住宿区域：

```json
{
  "id": "nc_stay_area_example",
  "name": "住宿区域名称",
  "city": "南昌",
  "node_type": "accommodation_area",
  "location": {
    "latitude": 0,
    "longitude": 0,
    "coordinate_system": "GCJ-02",
    "map_anchor": "区域中心锚点"
  },
  "suitable_for": [],
  "transit_profile": {
    "rail_station_access": null,
    "public_transport": null,
    "walkability": null
  },
  "experience": {
    "advantages": [],
    "tradeoffs": [],
    "holiday_price_risk": null,
    "night_noise_risk": null
  },
  "amap_integration": {
    "dynamic_fields": ["attraction_commute", "station_transfer", "hotel_poi_search"],
    "api_status": "key_not_configured"
  }
}
```

网页已预留以下输入：主要游览节点、抵达或离开车站、交通方式、最长单程通勤和夜间需求。高德 API 接入前只展示数据库中的区域特征，不生成虚假的实时交通结果。

## 自动接入步骤

1. 将每个节点保存为独立 JSON。
2. 把美食区域 ID 加入城市 `child_nodes.food`，或把住宿区域 ID 加入 `child_nodes.accommodation_areas`。
3. 运行网站数据生成与校验。
4. 页面会自动更新图层数量、地图节点、全域小图和节点卡。
