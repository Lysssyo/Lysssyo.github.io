# 项目复盘：VitePress 私有保险箱 (Private Vault)

本文档记录了我们在 VitePress 静态博客中集成“私有 GitHub 仓库内容”的全过程，涵盖了从架构设计到具体 Bug 修复的完整链路。

---

## 1. 核心需求与架构

**需求**：
在完全公开的静态博客（GitHub Pages）中，提供一个“私有保险箱”功能。用户输入密码后，能动态加载并浏览 GitHub 私有仓库中的 Markdown 笔记，且这些私有内容**绝不能**包含在公开的构建产物中。

**架构设计 (Mode A - 后端代理模式)**：
*   **前端 (VitePress)**：纯静态页面，通过 Vue 组件 (`PrivateVault.vue`) 动态渲染。
*   **后端 (Aliyun FC)**：作为安全网关，持有 GitHub Token。负责验证简单密码，并代理转发 GitHub API 请求。
*   **数据源 (GitHub)**：私有仓库存储实际的 Markdown 文档。

---

## 2. 遇到的关键问题与解决方案

### 问题一：VitePress 侧边栏污染
**现象**：私有仓库的目录（`98-Private`）或者功能页面（`private.md`）意外出现在了左侧公共侧边栏中。
**解决**：在 `config.mts` 中配置 `excludeByGlobPattern`，并在 `private.md` 头部添加 `sidebar: false`。

### 问题二：Vue 模板在 Markdown 中渲染失效
**现象**：Markdown 中的 Vue 模板未编译，直接显示代码。
**解决**：将逻辑封装为 `PrivateVault.vue` 组件，Markdown 文件仅作引用。

### 问题三：CORS 跨域与“Failed to fetch” (深度复盘)

这是本项目耗时最长、也是最经典的问题。

#### 1. 最初的代码 (手动处理 CORS)
一开始，我们在阿里云函数的 Node.js 代码中手动设置了 CORS 头，试图“允许所有跨域”：

```javascript
// ❌ 早期版本的错误代码
exports.handler = (req, resp, context) => {
  const headers = {
    // 我们手动添加了 *，希望能允许任何网站访问
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    // ...
  };
  
  // 处理逻辑...
  resp.setStatusCode(200);
  // 把上面定义的头塞进响应里
  for (const key in headers) resp.setHeader(key, headers[key]);
  resp.send(...);
};
```

#### 2. 出现的故障 (双重头冲突)
前端请求时报错 `Failed to fetch`，控制台报错信息如下：
> `Access to fetch at '...' from origin 'http://localhost:5173' has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header contains multiple values 'http://localhost:5173, *', but only one is allowed.`

**深度分析**：
*   **浏览器的愤怒**：HTTP 协议规定，`Access-Control-Allow-Origin` 响应头**只能有一个值**。
*   **谁加了第一个值？** 阿里云函数计算（FC）的 HTTP 触发器网关。因为它检测到是浏览器请求，且配置中可能开启了默认 CORS 支持，它自动添加了 `'Access-Control-Allow-Origin': 'http://localhost:5173'`。
*   **谁加了第二个值？** 我们的代码（见上文），手动加了 `'Access-Control-Allow-Origin': '*'`。
*   **结果**：浏览器收到了两个头（或合并为一个非法值），直接判定请求不安全，拦截了响应数据。

#### 3. 另外一个隐形杀手 (Content-Disposition)
除了 CORS，我们还发现了阿里云 FC 免费域名 (`*.fcapp.run`) 的一个强制策略：它会给所有响应加上 `Content-Disposition: attachment`。
这意味着浏览器会倾向于把这个请求当成“文件下载”处理，而不是 API 调用。这会干扰 `fetch` 的行为，导致 JS 无法读取响应体，表现为“请求成功但无数据”或 CORS 错误。

#### 4. 最终解决方案 (Vite Proxy)
我们放弃了在后端“硬刚”CORS，而是采用了前端开发最标准的 **代理方案**。

**修改前端配置 (`docs/.vitepress/config.mts`)**：
```typescript
// ✅ 最终方案：让 Vite 开发服务器做中转
vite: {
  server: {
    proxy: {
      '/api': {
        // 目标指向阿里云函数
        target: 'https://privatege-proxy-uypbjhvwjb.cn-hangzhou.fcapp.run',
        changeOrigin: true, // 将 Host 请求头修改为目标 URL，防止后端服务器拒绝处理
        rewrite: (path) => path.replace(/^\/api/, '') // 去掉 /api 前缀
      }
    }
  }
}
```

**修改前端请求 (`PrivateVault.vue`)**：
```typescript
// 不再直接请求 https://...，而是请求本地路径
const API_URL = '/api' 
```

**后端代码清理**：
移除了所有手动设置 CORS 的代码，让函数只关注业务逻辑。

**为什么这样就通了？**
1.  **浏览器只请求 localhost**：浏览器 -> Vite Dev Server (本地)。这是同源请求，**根本不涉及 CORS**，浏览器非常开心。
2.  **Vite 转发给阿里云**：Vite (Node.js) -> 阿里云函数。这是服务器对服务器的通信，**不受浏览器的同源策略限制**，也没有 CORS 问题。
3.  **避开下载限制**：Vite 收到阿里云的数据（即使标记为下载），会把内容取出来传给前端 JS，前端就能正常拿到 JSON 了。

---

## 3. 为什么这么做？(设计哲学)

1.  **为什么不直接在前端填 GitHub Token？**
    *   **安全**：GitHub Token 权限很大（通常是读写整个仓库）。如果写在前端（哪怕是用户输入），Token 就会暴露在浏览器历史、网络日志甚至 XSS 攻击中。通过阿里云函数中转，Token 永远不出服务器内网。

2.  **为什么要做“沉浸式双栏布局”？**
    *   **用户体验**：VitePress 默认侧边栏适合阅读文档，但不适合“文件管理器”的操作。独立的双栏 UI（左树右文）更符合“保险箱/网盘”的心智模型，且不破坏主站的导航结构。

---

## 4. 下一步计划

*   **部署上线**：将 `api` 代理配置应用到生产环境（通常需要 Nginx 反代或将函数绑定自定义域名）。
*   **功能增强**：支持图片显示（目前只支持文本）、搜索功能、大文件懒加载。
*   **安全加固**：增加密码尝试次数限制，防止爆破。