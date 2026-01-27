import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { VitePWA } from 'vite-plugin-pwa'
import container from 'markdown-it-container'
import taskLists from 'markdown-it-task-lists'
import fs from 'fs'
import path from 'path'

// 读取根目录的汉堡图片并转为 Base64
const logoSvg = fs.readFileSync(path.resolve(__dirname, '../../logo.svg'), 'utf-8')
const logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`

// 自动获取侧边栏配置
const sidebarConfig = generateSidebar({
  documentRootPath: 'docs',
  useTitleFromFileHeading: true,
  collapsed: true,
  excludeByGlobPattern: ['index.md', '.gitignore', '98-Private/**', 'chat.md','保险箱.md', 'guide.md','001-guide.md']
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

const firstLink = '/001-guide'

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
  lang: 'zh-CN',
  title: "Keith's Knowledge Base",
  titleTemplate: false,
  description: "As the stack grows",
  head: [
    ['link', { rel: 'manifest', href: '/manifest.webmanifest' }],
    ['link', { rel: 'icon', href: logoDataUrl }],
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'apple-touch-icon', href: '/pwa-192x192.png' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    ['meta', { name: 'theme-color', content: '#ffffff' }]
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

  vite: {
    plugins: [
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['logo.svg'],
        manifest: {
          name: 'Keith\'s Knowledge Base',
          short_name: 'KeithKB',
          description: 'Personal Knowledge Base powered by VitePress',
          theme_color: '#ffffff',
          scope: '/',      // 围墙是整个网站
          start_url: '/',  // 打开 App 第一眼看哪里
          id: '/',         // App 的唯一标识符
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
        }
      })
    ]
  },

  themeConfig: {
    siteTitle: 'Keith\'s Knowledge Base',
    logo: logoDataUrl,
    
    nav: [
      { text: 'Home', link: '/' },
      { text: '知识库', link: firstLink },
      { text: '私有保险箱', link: '/保险箱' }
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
      md.use(taskLists)
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
