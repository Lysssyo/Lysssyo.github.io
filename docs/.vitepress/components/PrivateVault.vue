<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { privateStore, type PrivateFile } from '../store'

const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const API_URL = 'https://privatege-proxy-uypbjhvwjb.cn-hongkong.fcapp.run/'
const sidebarWidth = ref(250) // 侧边栏宽度状态
const isResizing = ref(false)
const isSidebarCollapsed = ref(window.innerWidth < 768) // 移动端默认折叠

// 监听窗口大小，自动调整移动端状态
window.addEventListener('resize', () => {
  if (window.innerWidth < 768) {
    // 移动端逻辑：如果不主动操作，可以保持原状，或者强制折叠
  }
})

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

// 拖拽逻辑
function initResize(e: MouseEvent) {
  if (isSidebarCollapsed.value) return // 折叠时不能拖拽

  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMouseMove = (moveEvent: MouseEvent) => {
    const delta = moveEvent.clientX - startX
    let newWidth = startWidth + delta
    if (newWidth < 150) newWidth = 150
    if (newWidth > 500) newWidth = 500
    sidebarWidth.value = newWidth
  }

  const onMouseUp = () => {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// 初始化 Markdown-it 实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    // @ts-ignore
    if (lang && window.hljs) {
      try {
        // @ts-ignore
        return (
          '<pre class="hljs"><code>' +
          // @ts-ignore
          window.hljs.highlight(str, { language: lang, ignoreIllegals: true })
            .value +
          '</code></pre>'
        )
      } catch (__) {}
    }
    return (
      '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
    )
  },
})

// 动态加载 Highlight.js
function loadHighlight() {
  if (document.getElementById('hljs-script')) return

  // 仅加载 JS，样式由组件 CSS 控制以保持一致性
  const script = document.createElement('script')
  script.id = 'hljs-script'
  script.src =
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js'
  document.head.appendChild(script)
}

onMounted(() => {
  loadHighlight()
})

// Helper: Build Tree from Flat GitHub Paths
function buildFileTree(flatFiles: any[]): PrivateFile[] {
  const root: PrivateFile[] = []
  const map = new Map<string, PrivateFile>()

  // 1. Create all nodes
  flatFiles.forEach((f) => {
    const isDir = f.type === 'tree'
    const node: PrivateFile = {
      name: f.path.split('/').pop() || '',
      path: f.path,
      type: isDir ? 'dir' : 'file',
      children: isDir ? [] : undefined,
    }
    map.set(f.path, node)
  })

  // 2. Assemble tree
  flatFiles.forEach((f) => {
    const node = map.get(f.path)!
    const parts = f.path.split('/')
    if (parts.length === 1) {
      root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = map.get(parentPath)
      if (parent && parent.children) {
        parent.children.push(node)
      } else {
        root.push(node)
      }
    }
  })

  const sortFn = (a: PrivateFile, b: PrivateFile) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'dir' ? -1 : 1
  }

  const sortRecursive = (nodes: PrivateFile[]) => {
    nodes.sort(sortFn)
    nodes.forEach((n) => {
      if (n.children) sortRecursive(n.children)
    })
  }
  sortRecursive(root)

  return root
}

async function unlock() {
  loading.value = true
  errorMsg.value = ''

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: password.value,
        action: 'list',
      }),
    })

    if (!res.ok) {
      throw new Error(`Server Error: ${res.status}`)
    }

    const data = await res.json()
    const realData = data.data || data

    if (realData.files) {
      const tree = buildFileTree(realData.files)
      privateStore.token = password.value
      privateStore.setData(tree)
    } else {
      throw new Error('返回数据格式不对，找不到 files 字段')
    }
  } catch (e: any) {
    errorMsg.value = e.message || '网络请求失败'
  } finally {
    loading.value = false
  }
}

async function selectFile(file: PrivateFile) {
  if (file.type === 'dir') return

  privateStore.currentDoc = file

  if (!file.content) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: privateStore.token,
          action: 'content',
          path: file.path,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const contentBase64 = data.content.replace(/\s/g, '')
      const binaryString = window.atob(contentBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const decoder = new TextDecoder('utf-8')
      file.content = decoder.decode(bytes)
    } catch (e) {
      console.error(e)
      file.content = '> ❌ Error loading content'
    }
  }
}

const renderedContent = computed(() => {
  if (!privateStore.currentDoc) return ''
  if (privateStore.currentDoc.content === undefined) return '*(Loading...)*'

  // 1. 去除 Frontmatter (YAML 头)
  const raw = privateStore.currentDoc.content || ''
  const cleanContent = raw.replace(/^---[\s\S]*?---\n/, '')

  // 2. 使用 markdown-it 渲染
  return md.render(cleanContent)
})
</script>

<template>
  <div class="vault-wrapper">
    <!-- State 1: Locked -->
    <div v-if="!privateStore.isUnlocked" class="lock-screen">
      <div class="lock-card">
        <div class="icon-lock">🔐</div>
        <h2>私有保险箱</h2>
        <p class="subtext">连接至 Private Cloud</p>

        <div class="input-box">
          <input
            type="password"
            v-model="password"
            placeholder="请输入访问密码..."
            @keyup.enter="unlock"
          />
          <button @click="unlock" :disabled="loading">
            {{ loading ? '连接中...' : '解锁' }}
          </button>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      </div>
    </div>

    <!-- State 2: Unlocked -->
    <div
      v-else
      class="vault-ui"
      :class="{ 'sidebar-collapsed': isSidebarCollapsed }"
    >
      <!-- Resizer Handle (Always visible to allow expanding) -->
      <div
        class="vault-resizer"
        :class="{ 'is-collapsed': isSidebarCollapsed }"
        @mousedown="initResize"
      >
        <!-- Toggle Button inside Resizer -->
        <div
          class="vault-toggle-btn"
          @mousedown.stop
          @click="toggleSidebar"
          :title="isSidebarCollapsed ? '展开' : '收起'"
        >
          <span class="icon">{{ isSidebarCollapsed ? '›' : '‹' }}</span>
        </div>
      </div>

      <!-- Mobile Toggle Button (Visible only on mobile) -->
      <button class="mobile-sidebar-toggle" @click="toggleSidebar">
        <span class="icon">📂</span>
      </button>

      <!-- Content -->
      <div class="vault-content">
        <!-- vp-doc 类复用 VitePress 原生样式 -->
        <div v-if="privateStore.currentDoc" class="vp-doc">
          <div v-html="renderedContent"></div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon">👋</div>
          <h3>已安全连接</h3>
          <p>从左侧选择文件以从 GitHub 私有仓库加载内容</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vault-wrapper {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  /* overflow: hidden;  <-- 暂时注释掉，排查是否被裁切 */
  height: 600px;
  display: flex;
  flex-direction: column;
}

.lock-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg);
}
.lock-card {
  text-align: center;
  padding: 40px;
  background: var(--vp-c-bg);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 400px;
}
.icon-lock {
  font-size: 48px;
  margin-bottom: 16px;
}
.lock-card h2 {
  margin: 0 0 8px;
  font-weight: 600;
}
.subtext {
  color: var(--vp-c-text-2);
  margin-bottom: 24px;
  font-size: 14px;
}
.input-box {
  display: flex;
  gap: 8px;
}
.input-box input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
}
.input-box button {
  padding: 8px 16px;
  background: var(--vp-c-brand);
  color: white;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.error-msg {
  color: var(--vp-c-danger);
  margin-top: 12px;
  font-size: 13px;
}

.vault-ui {
  display: flex;
  height: 100%;
  position: relative; /* 为绝对定位元素做参考 */
}

/* 拖拽手柄样式 */
.vault-resizer {
  width: 8px;
  min-width: 8px; /* 防止 flex 压缩 */
  cursor: col-resize;
  background: transparent;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: -4px;
  z-index: 20;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vault-resizer:hover,
.vault-resizer:active {
  background: var(--vp-c-brand-soft);
}

/* 折叠状态下的手柄：改为绝对定位，确保不被挤压或隐藏 */
.vault-resizer.is-collapsed {
  position: absolute !important;
  left: 0 !important;
  top: 60px; /* 避开 Header */
  bottom: 0;
  width: 24px !important;
  margin-left: 0 !important;
  background: var(--vp-c-bg-alt) !important;
  border-right: 1px solid var(--vp-c-divider) !important;
  z-index: 50 !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
}
/* 恢复被移除的 overflow 以保证圆角 */
.vault-wrapper {
  overflow: hidden; 
}
/* ... */
.vault-resizer.is-collapsed:hover {
  background: var(--vp-c-brand-soft);
}

/* 内嵌的折叠按钮 */
.vault-toggle-btn {
  width: 24px;
  height: 24px;
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  opacity: 0; /* 展开时默认隐藏 */
  transition: opacity 0.2s;
  font-size: 14px;
  line-height: 1;
  color: var(--vp-c-text-2);
}

.vault-resizer:hover .vault-toggle-btn,
.vault-resizer.is-collapsed .vault-toggle-btn {
  opacity: 1; /* 折叠时或者悬停时显示 */
}

.vault-toggle-btn:hover {
  background-color: var(--vp-c-brand);
  color: white;
  border-color: var(--vp-c-brand);
}

.vault-sidebar {
  border-right: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
  transition: width 0.3s ease;
  overflow-x: hidden;
}

/* 移动端独立开关 */
.mobile-sidebar-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  display: none; /* Desktop 隐藏 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .mobile-sidebar-toggle {
    display: block; /* Mobile 显示 */
  }

  .vault-resizer {
    display: none; /* 移动端不需要拖拽 */
  }
}

/* 桌面端折叠处理 */
@media (min-width: 769px) {
  .sidebar-collapsed .vault-sidebar {
    width: 0 !important;
    border-right: none;
  }
  .sidebar-collapsed .vault-content {
    padding-left: 50px; /* 给 toggle 按钮留位置 */
  }
}

/* 拖拽手柄样式 */
.vault-resizer {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
  flex-shrink: 0;
  margin-left: -1px; /* 重叠边框 */
  z-index: 10;
}
.vault-resizer:hover,
.vault-resizer:active {
  background: var(--vp-c-brand);
}

.vault-header {
  padding: 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.file-tree {
  padding: 8px;
}
.tree-group {
  margin-bottom: 4px;
}

.tree-folder-label {
  display: flex;
  align-items: center;
  padding: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
}

.tree-children {
  padding-left: 16px;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  margin-left: 4px;
  font-size: 14px;
  color: var(--vp-c-text-1);
  cursor: pointer;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-item .icon {
  margin-right: 6px;
}

.tree-folder-label .icon {
  margin-right: 6px;
}

.tree-item:hover {
  background: var(--vp-c-bg-mute);
}

.tree-item.active {
  background: var(--vp-c-brand-dimm);
  color: var(--vp-c-brand);
  font-weight: 600;
}

.vault-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 40px;
  background: var(--vp-c-bg);
}
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-2);
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* === Syntax Highlighting Theme (VitePress-like) === */
.vp-doc :deep(.hljs) {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  padding: 20px 24px;
  margin: 16px 0;
  border-radius: 8px;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.5;
}

/* Keywords */
.vp-doc :deep(.hljs-keyword),
.vp-doc :deep(.hljs-function) {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
.vp-doc :deep(.hljs-string) {
  color: #10b981;
}
.vp-doc :deep(.hljs-comment) {
  color: var(--vp-c-text-3);
  font-style: italic;
}
.vp-doc :deep(.hljs-number),
.vp-doc :deep(.hljs-literal) {
  color: #f59e0b;
}
.vp-doc :deep(.hljs-title) {
  color: #3b82f6;
}

/* 3. 针对特定的页面类 */
.vp-doc {
  max-width: 100% !important;
}
</style>
