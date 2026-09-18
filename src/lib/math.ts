import katex from 'katex'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 将一段文本中的 LaTeX 数学渲染为 KaTeX HTML（构建时，非客户端）。
 * - `$...$` 为行内公式
 * - `$$...$$` 为块级公式
 * 非数学部分会被 HTML 转义，避免注入。
 */
export function renderMathInline(input: string): string {
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(input)) !== null) {
    out += escapeHtml(input.slice(last, m.index))
    if (m[1] !== undefined) {
      out += katex.renderToString(m[1].trim(), { displayMode: true, throwOnError: false })
    } else {
      out += katex.renderToString(m[2].trim(), { displayMode: false, throwOnError: false })
    }
    last = regex.lastIndex
  }
  out += escapeHtml(input.slice(last))
  return out
}

/**
 * 将多段落纯文本渲染为 HTML：
 * - 按空行分段，每段包成 `<p>`，段内换行转 `<br>`
 * - 独占一行的 `$$...$$` 渲染为块级公式（不包 `<p>`）
 * - 其余 `$...$` 渲染为行内公式
 */
export function renderRichText(input: string): string {
  return input
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^\$\$[\s\S]+?\$\$$/.test(block)) {
        return katex.renderToString(block.slice(2, -2).trim(), {
          displayMode: true,
          throwOnError: false,
        })
      }
      return `<p>${renderMathInline(block).replace(/\n/g, '<br>')}</p>`
    })
    .join('')
}
