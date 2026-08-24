# 2026 国庆江西旅行数据库

面向 AI Agent 的结构化旅游节点数据库。当前阶段以城市级节点采集为主，不保存固定路线，也不人工维护景点之间的距离。

## 目录结构

```text
data/
  cities/
    <city_id>/
      city.json
      attractions/
      museums/
        <museum_id>/
          museum.json
          exhibitions/
          artifacts/
          collection_groups/
schemas/
  node.schema.json
scripts/
  validate_json.py
docs/
  data-model.md
```

每个景点、展览、文物和藏品组都使用独立 JSON 文件。博物馆主节点只保存子节点 ID，不内嵌完整子节点。

全部节点采用 Schema 2.0，共有字段包括 `aliases`、`category`、`tags`、`sources` 与分层 `metadata`。图片通过 `media` 保存路径、来源、许可和替代文字。

## 数据原则

- `official_info`：名称、地址、开放时间、门票、预约和官方介绍等可核验事实。
- `experience`：推荐程度、游览时长、人流、拍摄体验和避坑建议。
- `ai_score`：用于 Agent 筛选的 1–5 分结构化评分。
- `location`：保存经纬度和高德 POI ID；路线距离和时间未来通过高德 API 动态计算。
- 动态信息必须记录来源和核验日期；无法确认时使用 `null` 和 `pending_verification`。

## 添加节点

1. 按节点类型放入相应目录。
2. ID 使用小写蛇形命名，例如 `nc_tengwangge`。
3. 时间长度统一使用分钟，价格统一使用数值和货币代码。
4. 博物馆子节点填写 `parent_id`，父节点通过 `child_nodes` 引用子节点 ID。
5. 不确定的事实不要推测填写。

## 校验

```powershell
.\scripts\validate.ps1
```

校验器会检查 JSON 语法、必填字段、ID 格式、ID 唯一性以及父子节点引用。

## 地图网页

`web/` 是数据库的展示层，包含跨城市旅行总图、城市地图和节点详细攻略。页面使用高德 GCJ-02 坐标按真实空间关系投影，数据由根目录 JSON 自动生成。

城市地图统一采用“核心区局部放大 + 全域概览小图 + 动态比例尺”的格式，并提供景点、美食、住宿三个数据图层。远郊节点保留在全域图中，不得为了页面排版修改或伪造坐标。具体规则见 `docs/city-map-standard.md` 和 `docs/city-layer-data-contract.md`。

城市页还包含统一通勤查询器，支持数据库节点、自由地点和当前位置作为起终点，并提供步行、公交、驾车、骑行结果。动态路线通过安全代理调用高德，不写回数据库。配置方式见 `docs/commute-service.md`。

```powershell
cd web
pnpm install
pnpm run build:github
```

仓库已包含 GitHub Pages 工作流 `.github/workflows/pages.yml`。推送到 GitHub 并在仓库 Pages 设置中选择 **GitHub Actions** 后即可发布。
