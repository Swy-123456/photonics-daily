import { settings } from './config.mjs'
import { fetchAll } from './fetch.mjs'
import { loadSeen, filterNew, markSeen, saveSeen } from './dedupe.mjs'
import { generate } from './generate.mdx.mjs'
import { captureDiagram } from './capture.mjs'

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('缺少环境变量 DEEPSEEK_API_KEY')
  }

  loadSeen()

  const items = await fetchAll()
  console.log(`共抓取 ${items.length} 条，去重 + ${settings.timeWindowHours}h 时间窗过滤…`)

  const fresh = filterNew(items)
  console.log(`新内容 ${fresh.length} 条，本次最多生成 ${settings.maxItemsPerRun} 篇`)

  const toGenerate = fresh.slice(0, settings.maxItemsPerRun)
  if (toGenerate.length === 0) {
    console.log('没有需要生成的新内容，结束。')
    saveSeen()
    return
  }

  let ok = 0
  for (const item of toGenerate) {
    try {
      const captured = await captureDiagram(item)
      await generate(item, apiKey, captured)
      markSeen(item)
      ok += 1
    } catch (e) {
      console.error(`✗ 生成失败：${item.title}\n  ${e.message}`)
    }
  }
  saveSeen()
  console.log(`完成：成功 ${ok}/${toGenerate.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
