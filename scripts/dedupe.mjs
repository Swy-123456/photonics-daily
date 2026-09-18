import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { settings } from './config.mjs'

let seen = new Set()

/** 读取历史去重记录（data/seen.json），不存在则视为空 */
export function loadSeen() {
  try {
    if (existsSync(settings.seenFile)) {
      const data = JSON.parse(readFileSync(settings.seenFile, 'utf8'))
      seen = new Set(data.ids || [])
      console.log(`已加载去重记录 ${seen.size} 条`)
    }
  } catch (e) {
    console.warn(`读取 ${settings.seenFile} 失败，按空处理：${e.message}`)
    seen = new Set()
  }
}

function withinWindow(item) {
  const t = new Date(item.publishedAt).getTime()
  if (Number.isNaN(t)) return false
  const ago = Date.now() - t
  return ago >= 0 && ago <= settings.timeWindowHours * 3600 * 1000
}

/** 去重 + 时间窗过滤，返回真正的新内容 */
export function filterNew(items) {
  return items.filter((i) => i.id && !seen.has(i.id) && withinWindow(i))
}

/** 生成成功后标记为已处理 */
export function markSeen(item) {
  if (item.id) seen.add(item.id)
}

/** 持久化去重记录 */
export function saveSeen() {
  mkdirSync(dirname(settings.seenFile), { recursive: true })
  writeFileSync(settings.seenFile, JSON.stringify({ ids: [...seen] }, null, 2))
}
