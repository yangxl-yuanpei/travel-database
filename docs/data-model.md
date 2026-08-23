# 数据模型

## 节点类型

| `node_type` | 含义 | 典型父节点 |
|---|---|---|
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
| `food` | 美食节点 | 城市 |
| `accommodation_area` | 住宿区域 | 城市 |
| `transport` | 交通节点 | 城市 |

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

## 空间数据

节点只保存地址、经纬度、行政区和地图 POI ID。不得保存人工计算的节点间距离、驾车时间或公交方案。

## 临时展览

临时展览必须是独立节点，并至少包含 `start_date`、`end_date`、`status` 和来源信息。展览结束后可保留历史节点，但默认检索应过滤 `status: ended`。
