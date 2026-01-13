import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'
import { withMermaid } from 'vitepress-plugin-mermaid'
import container from 'markdown-it-container'
import fs from 'fs'
import path from 'path'

// 读取根目录的汉堡图片并转为 Base64
const hamburgerSvg = fs.readFileSync(path.resolve(__dirname, '../../hamburger.svg'), 'utf-8')
const hamburgerDataUrl = `data:image/svg+xml;base64,${Buffer.from(hamburgerSvg).toString('base64')}`

// 自动获取侧边栏配置
const sidebarConfig = generateSidebar({
  documentRootPath: 'docs',
  useTitleFromFileHeading: true,
  collapsed: true,
  excludeFiles: ['index.md']
})

// 递归查找侧边栏中的第一个有效链接
function getFirstLink(sidebar: any): string {
  const items = Array.isArray(sidebar) ? sidebar : sidebar['/'] || Object.values(sidebar)[0]
  if (!items || !Array.isArray(items)) return '/'
  
  for (const item of items) {
    if (item.link) return item.link
    if (item.items) {
      const link = getFirstLink(item.items)
      if (link) return link
    }
  }
  return '/'
}

const firstLink = getFirstLink(sidebarConfig)

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
  lang: 'zh-CN',
  title: "Keith's Knowledge Base",
  titleTemplate: false,
  description: "As the stack grows",
  head: [
    ['link', { rel: 'icon', href: hamburgerDataUrl }]
  ],

  // 核心魔法：动态修改页面数据
  transformPageData(pageData) {
    // 如果是首页，动态改写 hero 的链接
    if (pageData.relativePath === 'index.md') {
      pageData.frontmatter.hero.actions[0].link = firstLink
    }
  },

  ignoreDeadLinks: [
    // 忽略所有指向 98-Private 的链接检查
    /98-Private/,
    
    // 或者更粗暴一点，忽略所有 localhost 和 相对路径的错误（不推荐）
    // true, 
  ],

  themeConfig: {
    siteTitle: 'Keith\'s Knowledge Base',
    logo: hamburgerDataUrl,
    
    nav: [
      { text: 'Home', link: '/' },
      { text: '知识库', link: firstLink }
    ],

    sidebar: sidebarConfig,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ],

    search: {
      provider: 'local'
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'medium'
      }
    },
    

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Keith'
    }

  },
  markdown: {
    config: (md) => {
      md.use(container, 'callout', {
        validate: (params) => params.trim().match(/^callout\s+(.*)$/),
        render: (tokens, idx) => {
          const m = tokens[idx].info.trim().match(/^callout\s+(.*)$/);
          if (tokens[idx].nesting === 1) {
            const icon = m && m[1] ? m[1] : '💡';
            return `<div class="callout custom-block"><span class="callout-icon">${icon}</span><div class="callout-content">`;
          }
          else {
            return '</div></div>';
          }
        }
      })
    }
  }
}))
