import { writeFileSync, mkdirSync } from 'node:fs'
import { settings, SYSTEM_PROMPT, CATEGORIES, TAGS } from './config.mjs'
import { slugFromItem } from './lib/slug.mjs'

/** 调用 DeepSeek（OpenAI 兼容 chat/completions） */
async function callDeepSeek(user, apiKey) {
  const res = await fetch(`${settings.deepseekBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.deepseekModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 400)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

/** 从模型输出中稳健提取 JSON（剥掉可能的 ```json 围栏） */
function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(cleaned)
}

// ---- YAML / MDX 组装 ----
function quote(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function blockScalar(s) {
  return '|\n' + s.split('\n').map((l) => '  ' + l).join('\n')
}

function emitFrontmatter(fields) {
  const lines = ['---']
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) lines.push(`${k}: ${JSON.stringify(v)}`)
    else if (typeof v === 'string') lines.push(`${k}: ${v.includes('\n') ? blockScalar(v) : quote(v)}`)
    else lines.push(`${k}: ${v}`)
  }
  lines.push('---', '')
  return lines.join('\n')
}

function placeholderSvg(title) {
  const safe = String(title || '').replace(/[<>&]/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img"><rect width="640" height="360" fill="#f8fafc"/><text x="320" y="180" text-anchor="middle" font-size="18" fill="#64748b">${safe}</text></svg>`
}

/**
 * 转义正文里会被 MDX 误判为 JSX 标签的 `<`（如 `<2`、`<n`、`<0.5 dB`）。
 * MDX 会把 `<` 后紧跟字母/数字的内容当 JSX 元素，`<2` 会触发
 * `Unexpected character '2' before name` 导致构建失败。
 * 跳过 `$...$`/`$$...$$` 数学公式与行内代码 `` `...` ``，避免误伤。
 */
function escapeMdxBody(md) {
  return md
    .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|`[^`\n]+`)/g)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/<(?=[A-Za-z0-9_$])/g, '&lt;')))
    .join('')
}

/** 把模型返回的器件类型规整到合法枚举（模糊匹配 + 兜底） */
function pickCategory(raw) {
  const s = String(raw || '').trim()
  if (CATEGORIES.includes(s)) return s
  const map = [
    ['硅光', '硅光芯片'],
    ['波导', '光波导'],
    ['激光', '激光器'],
    ['调制', '调制器'],
    ['探测', '光电探测器'],
    ['集成', '光子集成回路'],
  ]
  for (const [kw, cat] of map) if (s.includes(kw)) return cat
  return '光子集成回路'
}

/** 过滤到合法应用领域标签 */
function pickTags(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter((t) => TAGS.includes(t))
}

/** 对单条资讯：调模型 → （已有真实配图则引用，否则写自绘 SVG）→ 组装并写 MDX */
export async function generate(item, apiKey, captured = null) {
  const user = [
    '请深度扩写以下资讯：',
    '',
    `标题：${item.title}`,
    `来源：${item.sourceName}`,
    `链接：${item.url}`,
    `发布时间：${item.publishedAt}`,
    '',
    '摘要/正文：',
    item.summary,
  ].join('\n')

  const raw = await callDeepSeek(user, apiKey)
  const j = parseJson(raw)

  const slug = slugFromItem(item)

  // 总是生成自绘 SVG 示意图（无论是否抓到真实配图）
  const diagramFile = `${slug}.svg`
  mkdirSync(settings.diagramsDir, { recursive: true })
  const svg = String(j.diagramSvg || '').trim()
  const validSvg = svg.includes('<svg')
  writeFileSync(
    `${settings.diagramsDir}/${diagramFile}`,
    validSvg ? svg : placeholderSvg(j.title || item.title)
  )
  const diagramAlt = j.diagramAlt || j.diagramCaption || String(item.title)
  const diagramCaption = j.diagramCaption || '结构示意图'
  const diagramExplanation = j.diagramExplanation

  const fields = {
    title: j.title || item.title,
    sourceName: item.sourceName,
    sourceUrl: item.url,
    publishedAt: (item.publishedAt || '').slice(0, 10),
    category: pickCategory(j.category),
    summary: j.summary || String(item.title || '').slice(0, 50),
    background: j.background,
    mechanism: j.mechanism,
    diagram: diagramFile,
    diagramAlt,
    diagramCaption,
    diagramExplanation,
    figure: captured || undefined,
    applications: j.applications,
    glossary: Array.isArray(j.glossary) ? j.glossary : [],
    tags: pickTags(j.tags),
  }

  const body = escapeMdxBody(String(j.body || '').trim())
  const mdx = emitFrontmatter(fields) + body + '\n'

  mkdirSync(settings.contentDir, { recursive: true })
  writeFileSync(`${settings.contentDir}/${slug}.mdx`, mdx)
  console.log(`✓ 生成 ${slug}.mdx（${j.category || '未分类'}）`)
  return slug
}
