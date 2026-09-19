import { createHash } from 'node:crypto'

/** 生成稳定、URL 唯一的 slug（抓图与生成共用，保证文件名一致） */
export function slugFromItem(item) {
  const m = item.url.match(/arxiv\.org\/abs\/([\w.-]+)/)
  if (m) return m[1].replace(/v\d+$/, '')
  const date = (item.publishedAt || '').slice(0, 10)
  const hash = createHash('sha1').update(item.url).digest('hex').slice(0, 8)
  return `${date}-${hash}`
}
