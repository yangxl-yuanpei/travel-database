# 数据模型

## 节点类型

| `node_type` | 含义 | 典型父节点 |
|---|---|---|
| `journey` | 跨城市旅程骨架，保存出发地、会合点和城市顺序 | 无 |
| `city` | 城市入口节点 | 无 |
| `attraction` | 普通景点 | 城市 |
| `museum` | 博物馆或纪念馆 | 城市 |
| `memorial` | 历史事件纪念馆 | 城市 |
| `permanent_exhibition` | 常设展 | 博物馆 |
| `temporary_exhibition` | 临时展 | 博物馆 |
| `artifact` | 单件精品文物 | 博物馆 |
| `collection_group` | 一组相关藏品 | 博物馆 |
| `history_event` | 纪念馆对应的历史事件 | 纪念馆 |
| `historic_site` | 纪念馆管理或关联的历史旧址 | 纪念馆 |
| `archaeological_site` | 博物馆或遗址公园关联的考古遗址 | 遗址型博物馆 |
| `food` | 美食节点 | 城市 |
| `accommodation_area` | 住宿区域 | 城市 |
| `transport` | 两座城市之间的交通边或城市内交通节点 | 旅程或城市 |

## 跨城市旅程

`journey` 只保存城市顺序和交通节点 ID，不把车次、票价或距离直接写进页面。每一条城际移动均为独立 `transport` 文件，通过 `from_city_id` 与 `to_city_id` 连接城市。

铁路样本保存在 `rail_reference`，必须同时记录样本日期与状态。国庆等尚未开售日期使用 `national_day_sale_status: not_on_sale`，不得把常态样本表述为节假日确定价格。最终车次、票价与余票以 12306 为准。

高德层保存 GCJ-02 空间锚点和未来动态字段；站点接驳、驾车时间、公交与步行距离仍由 API 实时计算，不在数据库中维护静态两点距离。

## 事实与经验

`official_info` 中的动态事实推荐使用以下结构：

```json
{
  "value": null,
  "source_name": null,
  "source_url": null,
  "verified_at": null,
  "status": "pending_verification"
}
```

`experience` 不冒充官方事实。经验性结论将来可增加 `evidence`、样本数量和更新时间。

## 游客经验层

核心地点可增加 `experience_layer`，专门保存小红书、抖音等游客攻略经人工整理后的高频反馈。它不得覆盖或反向修改 `official_info`。

当前字段与逻辑层的对应关系：

| 逻辑层 | JSON 字段 |
|---|---|
| `official_layer` | `official_info`、`location`、`reservation` |
| `sub_nodes` | `child_nodes` 及其独立文件 |
| `experience_layer` | `experience_layer` |
| `recommendation_model` | `ai_score`、`duration`、`experience_layer.ai_note` |

`experience_layer.source` 保留平台或资料批次标记；具体帖子链接未来写入 `provenance.source_urls`。时间长度同时保存原始文本和分钟数，路线生成只使用分钟字段。

## 评分

`ai_score` 默认使用整数 1–5，数字越大表示特征越强。`crowd_risk` 越大代表拥挤风险越高。没有可靠判断时使用 `null`。

推荐的地点评分维度：

- `history`
- `photo`
- `family`
- `rain_day`
- `crowd_risk`
- `first_visit`

可按节点特性增加 `food`、`night`、`transport_cost` 等维度，仍使用 1–5。`transport_cost` 数值越高表示从城市核心区域前往的综合时间与交通成本越高，路线生成时应作为惩罚项使用。

## 数据状态

`metadata.data_status` 使用统一枚举，表示“哪一层证据已完成”，不能把不同证据层混为一个笼统的已核验：

| 状态 | 含义 |
|---|---|
| `draft` | 结构已建立，仍有核心字段待核验 |
| `candidate` | 仅作为候选，地址、分店或身份尚未确认 |
| `experience_verified` | 游客经验层已完成整理，不能据此推定官方事实已核验 |
| `third_party_verified` | 已由高德等第三方确认 POI、坐标或经营快照 |
| `time_sensitive` | 信息已核验但有明确时效，检索时必须检查日期 |
| `verified` | 当前核心官方事实已由权威来源核验 |
| `needs_update` | 已知信息过期或尚未到可确认窗口 |
| `archived` | 历史节点，默认不参与推荐 |

经验置信度仅使用 `low`、`low-medium`、`medium`、`medium-high`、`high`。住宿区域不要求游览时长；其余带 `experience_layer` 的节点必须提供分钟制 `recommended_duration`。

## 空间数据

节点只保存地址、经纬度、行政区和地图 POI ID。不得保存人工计算的节点间距离、驾车时间或公交方案。

`related_node_ids` 仅表达内容关联或适合组合游览，不表达固定距离与通行时间。实际空间成本仍由地图 API 动态计算。

## 临时展览

临时展览必须是独立节点，并至少包含 `start_date`、`end_date`、`status` 和来源信息。展览结束后可保留历史节点，但默认检索应过滤 `status: ended`。
