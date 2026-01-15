---
date created: 2026-01-15 23:32:33
date modified: 2026-01-15 23:34:49
---
将 VitePress 网站改造成 PWA（Progressive Web App）其实非常简单，主要依赖于 Vite 生态中强大的插件 **`vite-plugin-pwa`**。

以下是保姆级的配置步骤，只需要 3 步即可完成：

### 第一步：安装插件

在你的 VitePress 项目根目录下，运行以下命令安装插件：

Bash

```
npm install -D vite-plugin-pwa
# 或者
pnpm add -D vite-plugin-pwa
```

### 第二步：修改配置文件

我们需要在 VitePress 的配置文件中引入这个插件。注意，VitePress 的配置本质上是 Vite 配置的超集，所以我们可以直接在 `vite` 字段下注入插件。

打开 `.vitepress/config.mts` (或 `.js`/`.ts`)：

TypeScript

```
import { defineConfig } from 'vitepress'
import { VitePWA } from 'vite-plugin-pwa' // 1. 引入插件

export default defineConfig({
  // ... 你的其他 VitePress 配置 ...

  // 2. 在这里配置 Vite 插件
  vite: {
    plugins: [
      VitePWA({
        // 核心配置：自动更新模式
        // 'autoUpdate' = 发现新版本自动接管，简单省事（推荐文档类网站使用）
        // 'prompt' = 弹窗提示用户“有新内容，点击刷新”，体验更好但需要写 UI 组件，我想要prompt模式
        registerType: 'prompt', 
        
        // 注入模式
        injectRegister: 'auto',

        // 包含哪些静态资源需要被缓存
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],

        // PWA 的清单文件 (Manifest) 配置
        // 手机安装 App 后看到的图标、名字都由这里决定
        manifest: {
          name: '我的知识库',
          short_name: 'Knowledge',
          description: '基于 VitePress 构建的个人知识库 PWA',
          theme_color: '#ffffff',
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

        // Service Worker 配置 (缓存策略)
        workbox: {
          // 匹配所有这些扩展名的文件进行离线缓存
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      })
    ]
  }
})
```

### 第三步：准备图标 (重要)

PWA **必须**要有图标才能被识别为“可安装应用”。你需要准备至少两个图标文件，放在 `public` 文件夹下（如果没有 `public` 文件夹，就在项目根目录新建一个）。

需要的资源：

1. **pwa-192x192.png** (至少 192px)
    
2. **pwa-512x512.png** (至少 512px)
    
3. **favicon.ico** (网页图标)
    

> 💡 **小工具推荐**：你可以随便找张高清 Logo 图，用在线工具（如 [favicon.io](https://favicon.io/) 或 PWA Icon Generator）一键生成这些不同尺寸的图标。

### 第四步：针对 iOS 的优化 (可选但推荐)

iOS (Safari) 对 PWA Manifest 的支持不如 Android 完美，建议在 `config.mts` 的 `head` 里额外加几个 meta 标签，让它在 iPhone 上看起来更像原生 App。

TypeScript

```
// .vitepress/config.mts
export default defineConfig({
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    // 专门为了 iOS 设置的图标
    ['link', { rel: 'apple-touch-icon', href: '/pwa-192x192.png' }],
    // 允许 iOS 全屏
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }], 
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }], 
  ],
  // ...
})
```

### 第五步：构建与测试

PWA 在开发模式 (`npm run dev`) 下默认是不生效的（为了调试方便），你需要**构建**后才能看到效果。

1. 运行构建：
    
    Bash
    
    ```
    npm run build
    ```
    
2. 本地预览：
    
    Bash
    
    ```
    npm run preview
    ```
    
3. 打开浏览器（Chrome/Edge）：
    
    - 你应该会在地址栏右侧看到一个 **“安装图标”**（一个小电脑带个加号）。
        
    - 点击安装，它就会作为一个独立 App 弹出来。
        
    - 断开网络，刷新页面，如果还能访问，说明 **离线缓存** 成功了！
        

### ⚠️ 关于你的“私有仓库”组件

如果你按照我之前的建议做了“私有仓库”组件：

- **Public 页面**：会被 Service Worker 自动缓存，离线可看。
    
- **Private 组件**：
    
    - VitePWA 的 `workbox` 配置只会缓存构建出来的静态文件。
        
    - 它**不会**缓存你组件里 `fetch` 请求的 GitHub API 数据。
        
    - 这正是我们想要的！**数据逻辑由你的 Vue 组件里的 LocalStorage 控制**，静态资源逻辑由 PWA 插件控制。两者互不冲突，完美共存。