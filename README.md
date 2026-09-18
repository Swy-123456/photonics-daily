# 光子器件每日资讯

一个自动化的光子器件资讯聚合站。每天（北京时间早 7:00）自动抓取光子器件领域的公开内容，
整理为包含 **原理说明 / 结构图示 / 应用场景** 的结构化资讯页，并自动构建发布到 GitHub Pages。

## 技术栈

- **Astro** — 静态站点生成
- **MDX** — 内容（Markdown + 组件）
- **Tailwind CSS** — 样式
- **Pagefind** — 全文搜索
- **KaTeX** — 公式渲染
- **GitHub Pages** — 部署

## 目录结构

```
光子器件/
├── astro.config.mjs            # 站点配置（site / base / 集成）
├── package.json
├── tailwind.config.mjs
├── tsconfig.json
├── src/
│   ├── content/
│   │   ├── config.ts           # 资讯 frontmatter 的 zod schema
│   │   └── news/*.mdx          # 每条资讯一个 MDX
│   ├── pages/
│   │   ├── index.astro         # 首页（日期倒序 + 应用领域筛选）
│   │   ├── news/[slug].astro   # 资讯详情页
│   │   ├── search.astro        # 全文搜索（Pagefind）
│   │   └── about.astro
│   ├── components/             # NewsCard / FilterBar / Diagram / TagBadge
│   ├── layouts/BaseLayout.astro
│   └── styles/global.css
├── public/diagrams/            # 结构图示（SVG / 论文截图）
├── scripts/                    # 抓取 + 生成管线（config/fetch/dedupe/generate/run-daily）
├── data/seen.json              # 去重记录（自动生成，需提交）
└── .github/workflows/deploy.yml
```

## 本地运行

> 前置要求：Node.js ≥ 18（本机尚未安装，请先安装，可参考
> [Node.js 官网](https://nodejs.org/) 或 `winget install OpenJS.NodeJS.LTS`）。

```bash
npm install
npm run dev
```

打开 http://localhost:4321 即可看到首页（含示例资讯、领域筛选）。

## 构建与搜索

```bash
npm run build      # astro build + 生成 Pagefind 索引
npm run preview    # 预览构建产物
```

> 说明：全文搜索依赖构建后的 Pagefind 索引，`npm run dev` 下不可用；
> 需 `npm run build && npm run preview` 后访问 `/search`。

## 部署到 GitHub Pages（自动化）

推送 `main` 分支后，`.github/workflows/deploy.yml` 会自动构建并部署；每天北京时间 7:00
（UTC 23:00）的 cron 还会先抓取并生成新资讯。

**首次配置：**

1. 在 GitHub 新建仓库并推送本项目（**含 `package-lock.json`**）。
2. 仓库 **Settings → Secrets and variables → Actions** 添加密钥 `DEEPSEEK_API_KEY`。
3. 仓库 **Settings → Pages** 的 Source 选择 **GitHub Actions**。
4. 部署路径（`site` / `base`）由 workflow 根据仓库名自动计算，无需手动改 `astro.config.mjs`；
   本地开发默认 `/`。

## 内容数据模型

每篇资讯（`src/content/news/*.mdx`）的 frontmatter：

| 字段 | 说明 |
| --- | --- |
| `title` | 标题 |
| `sourceName` / `sourceUrl` | 来源名与原文链接 |
| `publishedAt` | 发布日期（`YYYY-MM-DD`） |
| `category` | 器件类型（硅光芯片/光波导/激光器/调制器/光电探测器/光子集成回路） |
| `summary` | 一句话核心结论（≤50 字，首页卡片） |
| `background` | 背景知识与技术演进（约 300 字） |
| `mechanism` | 核心物理机制详解（500-800 字，含 `$...$` LaTeX 公式） |
| `diagram` / `diagramAlt` / `diagramCaption` | 图示文件名 / alt 文本 / 图注 |
| `diagramExplanation` | 结构图示逐点解读 |
| `applications` | 应用场景与工程挑战 |
| `glossary` | 关键术语表（`term` + `definition` 数组） |
| `tags` | 应用领域（光通信/光计算/传感/量子光子学，可多选） |

新增一条资讯：在 `src/content/news/` 下新建一个 `.mdx`，图示放进 `public/diagrams/` 即可。

## 自动化管线（Phase 2，已实现）

- [x] `scripts/config.mjs` — 内容源 + 设置 + 系统提示词
- [x] `scripts/fetch.mjs` — 抓 Nature Photonics / PIC Magazine / AZoOptics RSS + arXiv physics.optics
- [x] `scripts/dedupe.mjs` — URL 去重 + 24h 时间窗，持久化到 `data/seen.json`
- [x] `scripts/generate.mdx.mjs` — 调用 DeepSeek API 生成 MDX + SVG 图示
- [x] `scripts/run-daily.mjs` — 编排
- [x] `.github/workflows/deploy.yml` — `cron '0 23 * * *'` 抓取 → 生成 → 提交 → 构建 → 部署

本地手动跑一次（需设置 `DEEPSEEK_API_KEY`）：

```bash
DEEPSEEK_API_KEY=sk-xxx npm run daily
```

**已做简化 / 后续增强：**

- Optics.org 无公开 RSS，已从源列表移除；行业公司产品发布页暂未接入（可作为后续源）。
- 图示 v1 由模型生成 SVG；真实配图自动截取（arXiv 可经 ar5iv 提取 Fig）为后续增强。
