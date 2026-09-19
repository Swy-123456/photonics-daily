import { writeFileSync, mkdirSync } from 'node:fs'
import { settings } from './config.mjs'
import { slugFromItem } from './lib/slug.mjs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

async function fetchWithTimeout(url, ms = 20000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA },
    })
  } finally {
    clearTimeout(t)
  }
}

function extFromUrl(url, contentType = '') {
  const m = url.match(/\.(png|jpe?g|gif|webp|svg)(?:\?|#|$)/i)
  if (m) {
    const e = m[1].toLowerCase()
    return e === 'jpeg' ? 'jpg' : e
  }
  const ct = contentType.split(';')[0].trim().toLowerCase()
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return map[ct] || 'jpg'
}

async function downloadImage(url, dest) {
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`下载 ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error('图片过小，疑似占位/追踪像素')
  writeFileSync(dest, buf)
  return dest
}

async function fetchHtml(url) {
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`页面 ${res.status}`)
  return res.text()
}

/** arXiv：经 ar5iv 提取论文第一个图 */
async function captureArxivFigure(item) {
  const slug = slugFromItem(item)
  const html = await fetchHtml(`https://ar5iv.labs.arxiv.org/html/${slug}`)
  const imgs = [...html.matchAll(/src="(\/html\/[^"]+\/assets\/Fig[^"]*\.(?:png|jpe?g|gif))"/g)]
  if (imgs.length === 0) return null
  const url = `https://ar5iv.labs.arxiv.org${imgs[0][1]}`
  const ext = extFromUrl(url)
  const dest = `${settings.diagramsDir}/${slug}.${ext}`
  mkdirSync(settings.diagramsDir, { recursive: true })
  await downloadImage(url, dest)
  return `${slug}.${ext}`
}

/** RSS：抓文章页 og:image */
async function captureOgImage(item) {
  const html = await fetchHtml(item.url)
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (!m) return null
  const url = new URL(m[1].replace(/&amp;/g, '&'), item.url).toString()
  const ext = extFromUrl(url)
  const slug = slugFromItem(item)
  const dest = `${settings.diagramsDir}/${slug}.${ext}`
  mkdirSync(settings.diagramsDir, { recursive: true })
  await downloadImage(url, dest)
  return `${slug}.${ext}`
}

/** 尝试抓取原文真实配图；失败返回 null（由生成环节回退自绘 SVG） */
export async function captureDiagram(item) {
  try {
    if (item.type === 'arxiv') {
      const f = await captureArxivFigure(item)
      if (f) {
        console.log(`  ↳ 已抓取原文配图 ${f}`)
        return f
      }
    } else {
      const f = await captureOgImage(item)
      if (f) {
        console.log(`  ↳ 已抓取 og:image ${f}`)
        return f
      }
    }
  } catch (e) {
    console.warn(`  ↳ 原文配图抓取失败，回退自绘：${e.message}`)
  }
  return null
}
