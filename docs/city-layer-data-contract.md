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

### 南昌美食数据实施

南昌当前采用 7 个地图级美食区域，分别覆盖大士院—蛤蟆街、万寿宫—珠宝街、羊子巷—系马桩、八一广场—孺子路、红谷滩、洪都—上海路、紫荆夜市—经开。

候选数据库通过 `scripts/import_nanchang_food.py` 转换：

```powershell
python scripts/import_nanchang_food.py <nanchang_food_candidates_raw.json>
```

转换规则：

1. 城市 `child_nodes.food` 只引用区域节点；
2. 店铺与菜品均为独立 `food` 节点，通过 `food_scope` 区分；
3. 高德坐标统一转换为 GCJ-02 数值，经纬度缺失或匹配冲突的候选不进入地图；
4. 游客截图、第三方地图和点评摘要分别保存，第三方资料不得进入官方事实层；
5. 不保存点评原文、电话号码或 API Key；
6. 未人工核验的数据保持 `metadata.data_status = "draft"`。

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
    "api_status": "proxy_configured"
  }
}
```

住宿区域的坐标是检索和路线计算锚点，不是行政边界；不得把区域锚点到景点的固定距离写入 JSON。网页上方通勤查询器使用高德代理动态计算路线，酒店库存、房价和房型仍保持动态。

### 南昌住宿数据实施

南昌当前采用 6 个住宿区域：八一广场—中山路、滕王阁—万寿宫、秋水广场—红谷滩中心、江西省博物馆—红谷滩万达、南昌西站—九龙湖、绳金塔—南昌站。

1. 游客截图只进入 `experience_layer`，不作为官方事实；
2. 截图中的酒店价格属于发布时样本，不进入数据库；
3. 高德 POI 只负责区域锚点和路线计算，不代表推荐某家酒店；
4. 节假日涨价、噪声和人流均为风险等级，不是实时结论；
5. `metadata.data_status` 用于区分多源经验已核对与仍需补样的节点。

## 自动接入步骤

1. 将每个节点保存为独立 JSON。
2. 把美食区域 ID 加入城市 `child_nodes.food`，或把住宿区域 ID 加入 `child_nodes.accommodation_areas`。
3. 运行网站数据生成与校验。
4. 页面会自动更新图层数量、地图节点、全域小图和节点卡。
