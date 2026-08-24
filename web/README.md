# 赣行志 · 江西旅行知识地图

数据库的可视化浏览层。页面内容由仓库根目录的 JSON 节点自动生成，展示代码不维护第二份旅游数据。

## 本地开发

```bash
pnpm install
pnpm run dev
```

## 构建

```bash
# Sites / Cloudflare Worker 构建
pnpm run build

# GitHub Pages 静态构建
pnpm run build:github
```

GitHub Pages 产物写入 `github-dist/`。仓库根目录已经提供 `.github/workflows/pages.yml`，推送到 GitHub 后可由 Actions 自动发布。

## 数据同步

`scripts/generate-site-data.mjs` 读取 `../data/`，递归收集三个主节点引用的展览、文物、历史事件和旧址，生成 `app/generated/places.json`。开发和构建命令都会先自动执行同步。
