import Parser from 'rss-parser'
import { sources } from './config.mjs'

const parser = new Parser({ timeout: 30000 })

function toIso(item) {
  return item.isoDate || item.pubDate || item.published || new Date().toISOString()
}

function normalizeRssItem(feedName, item) {
  const url = item.link || item.guid || item.id || ''
  return {
    id: url,
    title: (item.title || '').trim(),
    url,
    sourceName: feedName,
    publishedAt: toIso(item),
    summary: (item.contentSnippet || item.summary || item.content || '').trim(),
    type: 'rss',
  }
}

export async function fetchRss(feed) {
  try {
    const parsed = await parser.parseURL(feed.url)
    const items = (parsed.items || []).map((i) => normalizeRssItem(feed.name, i))
    console.log(`[${feed.name}] 抓取 ${items.length} 条`)
    return items
  } catch (e) {
    console.warn(`[${feed.name}] 抓取失败：${e.message}`)
    return []
  }
}

export async function fetchArxiv(arxiv) {
  try {
    const parsed = await parser.parseURL(arxiv.url)
    const items = (parsed.items || []).map((i) => {
      const url = i.link || i.id || ''
      return {
        id: url,
        title: (i.title || '').trim(),
        url,
        sourceName: arxiv.name,
        publishedAt: toIso(i),
        summary: (i.contentSnippet || i.summary || i.content || '').trim(),
        type: 'arxiv',
      }
    })
    console.log(`[${arxiv.name}] 抓取 ${items.length} 条`)
    return items
  } catch (e) {
    console.warn(`[${arxiv.name}] 抓取失败：${e.message}`)
    return []
  }
}

export async function fetchAll() {
  const [rssResults, arxivResults] = await Promise.all([
    Promise.all(sources.rss.map(fetchRss)),
    fetchArxiv(sources.arxiv),
  ])
  const items = [...rssResults.flat(), ...arxivResults]
  // 过滤掉无 url 或标题的无效条目，并按发布时间倒序
  return items
    .filter((i) => i.url && i.title)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
}
