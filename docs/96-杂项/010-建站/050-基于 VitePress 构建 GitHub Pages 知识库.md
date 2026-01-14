# 基于 VitePress 构建 GitHub Pages 知识库

## 1. 什么是 VitePress
VitePress 是一个静态站点生成器（SSG），专为编写技术文档而设计。它基于 Vue 3 和 Vite，速度极快，开箱即用。

- 🔗 **官方文档**：[https://vitepress.dev/](https://vitepress.dev/)

---

## 2. 本地部署 VitePress 工程

参考官方文档：[Getting Started](https://vitepress.dev/zh/guide/getting-started)

### 初始化项目
```bash
# 进入项目根目录
npm add -D vitepress@next
npx vitepress init
```

### 2.1 自动生成侧边栏 (vitepress-sidebar)
手动维护侧边栏非常麻烦，使用 `vitepress-sidebar` 插件可以自动根据文件目录生成侧边栏。
只需要在 Obsidian 或资源管理器里新建文件夹、拖拽文件、重命名，网站结构就会自动更新。

**安装插件：**
```bash
npm install vitepress-sidebar
```

**配置插件：**
修改 `.vitepress/config.mts`：
```typescript
// .vitepress/config.mts
import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar' // 引入插件

export default defineConfig({
  themeConfig: {
    // 不再手动写死 sidebar，而是调用函数生成
    sidebar: generateSidebar({
      documentRootPath: 'docs', // 你的文档根目录
      useTitleFromFileHeading: true, // 自动读取 md 文件里的 H1 作为标题
      collapsed: true, // 所有文件夹默认折叠
      // 更多配置...
    })
  }
})
```

### 2.2 Mermaid 图表支持
VitePress 完美支持 Mermaid 流程图、时序图等。

> [!WARNING] 版本兼容性注意
> **`vitepress-plugin-mermaid` 目前只适配到了 `v1.x` 版本。**
> 如果使用 `vitepress@2.x` 可能会遇到问题。建议将 VitePress 锁定在稳定的 `v1` 版本。

**安装步骤：**

1. **修改版本号**：打开 `package.json`，将 `"vitepress"` 版本修改为：
   ```json
   "vitepress": "^1.5.0"
   ```
2. **清理环境**：删除 `node_modules` 文件夹和 `package-lock.json` 文件。
3. **重新安装依赖**：
   ```bash
   npm install
   ```
4. **安装插件**：
   ```bash
   npm install vitepress-plugin-mermaid
   ```

### 2.3 开启本地搜索
VitePress 1.0 内置了 **Minisearch**，无需 Algolia 即可实现极速的本地全文搜索。

在 `.vitepress/config.mts` 中添加配置：
```typescript
export default defineConfig({
  themeConfig: {
    search: {
      provider: 'local'
    }
  }
})
```


> [!TIP]  体验效果
按下 `Ctrl + K` (Mac: `Cmd + K`)，会弹出毛玻璃特效的搜索框。
输入关键词（如 "HashMap"），它会通过分词高亮显示所有相关段落。体验堪比 IDE 的全局搜索。


### 2.4 运行 Vue 组件
这是 VitePress 最强大的功能之一：Markdown 中可以直接运行 Vue 组件。

**实战场景：** 编写一个实时显示比特币价格的组件。

**步骤 1：创建组件**
在 `.vitepress/theme/components/` 下新建 `CryptoPrice.vue`:
```vue
<script setup>
import { ref, onMounted } from 'vue'
const price = ref('Loading...')

// 模拟拉取数据
onMounted(() => {
  // 实际场景可以使用 fetch() 调用 API
  setTimeout(() => {
     price.value = '$98,000'
  }, 1000)
})
</script>

<template>
  <div class="coin-card">
    <span>Bitcoin: </span>
    <span class="price">{{ price }}</span>
  </div>
</template>

<style scoped>
.coin-card { padding: 10px; background: #f3f3f3; border-radius: 8px; font-weight: bold; }
.price { color: #d81b60; }
</style>
```

**步骤 2：全局注册组件**
修改 `.vitepress/theme/index.ts`（或 `.js`）：
```typescript
import DefaultTheme from 'vitepress/theme'
import CryptoPrice from './components/CryptoPrice.vue' // 1. 引入组件

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 2. 注册全局组件
    app.component('CryptoPrice', CryptoPrice)
  }
}
```

**步骤 3：在 Markdown 中使用**
```markdown
# 投资笔记

当前比特币价格参考：
<CryptoPrice />
```

---

## 3. 部署到 GitHub Pages

### 第一步：准备 GitHub 仓库
如果你希望通过 `username.github.io` 访问，仓库名必须严格遵循此格式。
1. 新建仓库，名称为：`yourname.github.io` (替换为你的 GitHub 用户名)。
2. 确保仓库是 **Public** 的。

### 第二步：配置 Base 路径
修改 `docs/.vitepress/config.mts`。

> [!WARNING] 路径配置非常关键
> 设置错误会导致样式丢失 (404) 或图片无法加载。请根据仓库类型选择：
>
> - **情况 A：根域名访问**
>   - 仓库名：`username.github.io`
>   - 配置：`base: '/'` (或者直接不写)
>
> - **情况 B：子项目/子目录访问**
>   - 仓库名：`my-project`
>   - 配置：`base: '/my-project/'`
>   - ⚠️ **注意：** 必须以斜杠开始，并以斜杠结束！


### 第三步：配置 GitHub Actions
在项目根目录创建文件：`.github/workflows/deploy.yml`。

<details>
<summary>点击查看 deploy.yml 完整配置</summary>

```yaml
# .github/workflows/deploy.yml
name: Deploy VitePress site to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Install dependencies
        run: npm ci

      - name: Build with VitePress
        run: npm run docs:build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
</details>

### 第四步：推送代码
```bash
git init
git add .
git commit -m "init: my knowledge base"
git branch -M main
git remote add origin https://github.com/YourName/yourname.github.io.git
git push -u origin main
```

### 第五步：开启 Pages 服务
1. 进入 GitHub 仓库 -> **Settings** -> **Pages**。
2. 在 **Build and deployment** > **Source** 中，选择 **GitHub Actions**。
3. Action 运行完成后，你就可以访问你的个人网站了！

---

## 4. 图床配置指南

为了让 Markdown 中的图片在任何地方都能正常显示，建议使用“阿里云 OSS + PicGo”方案。

### 阶段一：阿里云 OSS 准备
[阿里云OSS](https://oss.console.aliyun.com/bucket)

[RAM权限控制](https://ram.console.aliyun.com/overview?activeTab=overview)
1. 创建 **OSS Bucket** (设置权限为 **公共读**)。
2. 创建 **RAM 用户**，获取 `AccessKey ID` 和 `Secret`。
   *   *安全提示：只给该用户分配 `AliyunOSSFullAccess` 或更细粒度的上传权限。*

### 阶段二：配置 PicGo
1. 下载安装 [PicGo](https://picgo.github.io/PicGo-Doc/)。
2. 配置 **阿里云 OSS** 图床，填入 Key、Secret 和 Bucket 信息。
3. 测试上传一张图片，确保能成功返回 URL。

### 阶段三：配置 Obsidian
1. 安装插件：**Image Auto Upload Plugin**。
2. 配置插件连接到 PicGo (默认端口 36677)。
3. **验证闭环**：在 Obsidian 粘贴截图 -> 自动上传 -> 链接变为 `https://xxx.aliyuncs.com/...`

### 阶段四：验证
使用 **Obsidian Git** 插件推送文章，GitHub Pages 自动构建后，图片应能正常加载。
