# 城市通勤查询服务

城市页通勤查询器已支持：

1. 数据库节点之间查询；
2. 步行、公交、驾车、骑行四种方式；
3. 通勤结果卡、路线几何预览和详细步骤；
4. 跳转高德地图继续导航；
5. 自由地点搜索和浏览器当前位置。

## 安全结构

```text
GitHub Pages / Sites 网页
        ↓
通勤代理 /api/commute、/api/places
        ↓
高德 Web 服务 API
```

`AMAP_WEB_SERVICE_KEY` 只能保存在代理服务环境变量中，不得写入前端代码、JSON 数据或 GitHub Pages 构建变量。

## 本地配置

1. 在高德开放平台申请“Web 服务 API”类型 Key。
2. 将 `web/.dev.vars.example` 复制为 `web/.dev.vars`。
3. 填写 `AMAP_WEB_SERVICE_KEY`。
4. 使用完整开发服务运行网站；同源情况下前端默认请求 `/api/commute` 和 `/api/places`。

没有 Key 时，网页结构仍可使用，但实时地点搜索和路径查询会显示“尚未配置”，不会产生模拟结果。

## GitHub Pages 配置

GitHub Pages 只能承载静态前端，因此还需要部署一份带 Worker 的完整 `web` 服务作为通勤代理。部署后：

1. 在代理服务中设置 Secret：`AMAP_WEB_SERVICE_KEY`。
2. 设置变量 `COMMUTE_ALLOWED_ORIGINS`，值为 GitHub Pages 的完整 Origin，例如 `https://yangxl-yuanpei.github.io`。
3. 在 GitHub 仓库 `Settings → Secrets and variables → Actions → Variables` 中添加：

```text
COMMUTE_API_BASE=https://你的通勤代理域名
```

Pages 工作流会将它写入 `VITE_COMMUTE_API_BASE`。该地址不是密钥，可以公开。

## 接口

### 地点提示

```http
GET /api/places?keywords=万寿宫&city=南昌
```

只返回具有有效坐标的高德建议项。

### 通勤查询

```http
POST /api/commute
Content-Type: application/json
```

```json
{
  "origin": {
    "name": "滕王阁",
    "longitude": 115.881197,
    "latitude": 28.681332,
    "poi_id": "高德 POI ID"
  },
  "destination": {
    "name": "江西省博物馆",
    "longitude": 115.881823,
    "latitude": 28.7059,
    "poi_id": "高德 POI ID"
  },
  "mode": "transit",
  "city_code": "0791"
}
```

代理会校验坐标与交通方式，并将高德不同接口的返回值统一为分钟、距离、费用、换乘、步骤和路线坐标。动态结果只保留在当前网页会话。
