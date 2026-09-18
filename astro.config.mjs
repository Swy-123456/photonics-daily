// @ts-check
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import tailwind from '@astrojs/tailwind'
import sitemap from '@astrojs/sitemap'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

// https://astro.build/config
export default defineConfig({
  // 部署时由 GitHub Actions 通过环境变量注入；本地开发默认 '/'。
  site: process.env.SITE_URL || 'https://yourname.github.io',
  base: process.env.BASE_PATH || '/',
  integrations: [
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],
})
