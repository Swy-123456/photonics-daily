# Phase 2 生成管线 · 系统 Prompt 说明

自动化管线（`scripts/run-daily.mjs` → `scripts/generate.mdx.mjs`）每天抓取到新资讯后，
调用 **DeepSeek API**（OpenAI 兼容）将其「深度扩写」为符合内容 schema 的专业文章。

> 实际发给模型的系统提示词定义在 `scripts/config.mjs` 的 `SYSTEM_PROMPT` 常量中，
> 本文档是对它的说明与约定。修改提示词请改 `config.mjs`，并保持本文档同步。

## 角色设定

资深光子学研究员：拥有硅基光子学、激光物理、非线性光学、量子光学与光通信的深厚功底，
同时擅长面向工程师与科研爱好者的科普写作。

## 调用方式

- 端点：`POST {DEEPSEEK_BASE_URL}/chat/completions`（默认 `https://api.deepseek.com/chat/completions`）
- 鉴权：`Authorization: Bearer $DEEPSEEK_API_KEY`
- 模型：`deepseek-chat`（默认，可经 `DEEPSEEK_MODEL` 覆盖为 `deepseek-reasoner`）
- 输出：`response_format: { type: "json_object" }`，模型返回一个 JSON 对象

## 输出 JSON 结构

| 字段 | 说明 |
| --- | --- |
| `title` | 中文标题 |
| `category` | 器件类型（六选一：硅光芯片/光波导/激光器/调制器/光电探测器/光子集成回路） |
| `summary` | 一句话核心结论，≤50 字 |
| `background` | 背景与演进，约 300 字 |
| `mechanism` | 核心机制 500-800 字，含 `$...$`/`$$...$$` LaTeX 公式 |
| `diagramCaption` / `diagramAlt` | 图注 / 无障碍文本 |
| `diagramExplanation` | 图示逐点解读 |
| `applications` | 应用场景与工程挑战 |
| `glossary` | `[{term, definition}]` 术语表 |
| `tags` | 应用领域（可多选） |
| `body` | 「知识延伸」小节的 Markdown |
| `diagramSvg` | 一张简洁 SVG 示意图 |

`scripts/generate.mdx.mjs` 会把 JSON 组装成 MDX（frontmatter + 正文）写入 `src/content/news/`，
并把 `diagramSvg` 存为 `public/diagrams/<slug>.svg`。

## 写作要求（重要）

- 用通俗比喻解释复杂物理过程（如把微环谐振器比作「光的高速公路收费站」）。
- mechanism 必须包含关键公式与物理效应（光电效应、量子限制效应、马赫-曾德尔干涉、四波混频等）。
- 公式正确、符号一致，公式后给出通俗解释。
- 正文包含「知识延伸」小节，科普上下游知识。

## 图示策略

- v1：由模型生成简洁 SVG 示意图（`diagramSvg`），无版权风险、可离线自动化。
- 后续增强：从原文页面自动截取/下载真实配图（arXiv 可经 ar5iv 提取 Fig），失败再回退自绘；
  转载时需标注出处与版权说明。

## 去重与时效

- 只处理过去 24 小时内的新内容（`TIME_WINDOW_HOURS` 可调）。
- 与 `data/seen.json` 中已收录 id 重复的跳过；每次最多生成 `MAX_ITEMS_PER_RUN` 篇。
