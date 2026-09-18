import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { settings, SYSTEM_PROMPT, CATEGORIES, TAGS } from './config.mjs'

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

/** 生成稳定、URL 唯一的 slug */
function slugFromItem(item) {
  const m = item.url.match(/arxiv\.org\/abs\/([\w.-]+)/)
  if (m) return m[1].replace(/v\d+$/, '')
  const date = (item.publishedAt || '').slice(0, 10)
  const hash = createHash('sha1').update(item.url).digest('hex').slice(0, 8)
  return `${date}-${hash}`
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

/** 对单条资讯：调模型 → 写 SVG → 组装并写 MDX */
export async function generate(item, apiKey) {
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
  const diagramFile = `${slug}.svg`

  // 写图示（模型生成的 SVG；失败则占位）
  mkdirSync(settings.diagramsDir, { recursive: true })
  const svg = String(j.diagramSvg || '').trim()
  const validSvg = svg.includes('<svg')
  writeFileSync(
    `${settings.diagramsDir}/${diagramFile}`,
    validSvg ? svg : placeholderSvg(j.title || item.title)
  )

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
    diagramAlt: j.diagramAlt || j.diagramCaption || String(item.title),
    diagramCaption: j.diagramCaption || '结构示意图',
    diagramExplanation: j.diagramExplanation,
    applications: j.applications,
    glossary: Array.isArray(j.glossary) ? j.glossary : [],
    tags: pickTags(j.tags),
  }

  const body = String(j.body || '').trim()
  const mdx = emitFrontmatter(fields) + body + '\n'

  mkdirSync(settings.contentDir, { recursive: true })
  writeFileSync(`${settings.contentDir}/${slug}.mdx`, mdx)
  console.log(`✓ 生成 ${slug}.mdx（${j.category || '未分类'}）`)
  return slug
}
