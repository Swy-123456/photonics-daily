import { defineCollection, z } from 'astro:content'

/**
 * 每篇资讯的 frontmatter 结构，构建时由 zod 校验。
 * Phase 2 抓取管线生成 MDX 时必须满足此 schema。
 *
 * 注意：background / mechanism / diagramExplanation / applications / glossary
 * 当前标记为 optional，是为了兼容尚未迁移的旧示例文件；
 * 新内容（及 Phase 2 生成）应全部填写，迁移完成后可收紧为必填。
 */
const news = defineCollection({
  type: 'content',
  schema: z.object({
    /** 资讯标题 */
    title: z.string(),
    /** 来源名称，如 Nature Photonics / arXiv / Optics.org */
    sourceName: z.string(),
    /** 原文链接 */
    sourceUrl: z.string(),
    /** 发布日期 */
    publishedAt: z.coerce.date(),
    /** 器件类型 */
    category: z.enum(['硅光芯片', '光波导', '激光器', '调制器', '光电探测器', '光子集成回路']),
    /** 一句话核心结论（≤50 字，用于首页卡片） */
    summary: z.string(),
    /** 背景知识与技术演进（约 300 字：为什么出现、解决了什么痛点） */
    background: z.string().optional(),
    /** 核心物理机制详解（500-800 字，含 $...$ / $$...$$ 公式与物理效应） */
    mechanism: z.string().optional(),
    /** 关键图示文件名（位于 public/diagrams/ 下） */
    diagram: z.string(),
    /** 图示 alt 文本（无障碍说明） */
    diagramAlt: z.string(),
    /** 图示标题/图注 */
    diagramCaption: z.string(),
    /** 结构图示逐点解读 */
    diagramExplanation: z.string().optional(),
    /** 原文真实配图（可选，抓取成功后与自绘 SVG 并排展示） */
    figure: z.string().optional(),
    /** 应用场景与工程挑战 */
    applications: z.string().optional(),
    /** 关键术语表（专业名词 + 通俗解释） */
    glossary: z
      .array(z.object({ term: z.string(), definition: z.string() }))
      .optional(),
    /** 应用领域标签（可多选） */
    tags: z.array(z.enum(['光通信', '光计算', '传感', '量子光子学'])).default([]),
  }),
})

export const collections = { news }
