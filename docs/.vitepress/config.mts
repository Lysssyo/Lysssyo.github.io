import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'
import { withMermaid } from 'vitepress-plugin-mermaid'
import container from 'markdown-it-container'

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
  title: "Keith's Knowledge Base",
  description: "As the stack grows",
  themeConfig: {
    siteTitle: 'Keith\'s Knowledge Base',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: '知识库', link: '/intro' }
    ],

    sidebar: generateSidebar({
      documentRootPath: 'docs', // 你的文档根目录
      useTitleFromFileHeading: true, // 自动读取 md 文件里的 H1 作为标题
      collapsed: true, // 所有文件夹默认折叠
      // 更多配置...
    }),

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ],

    search: {
      provider: 'local'
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
          } else {
            return '</div></div>';
          }
        }
      })
    }
  }
}))
