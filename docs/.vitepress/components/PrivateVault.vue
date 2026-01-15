<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { privateStore, type PrivateFile } from '../store'

const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const API_URL = 'https://privatege-proxy-uypbjhvwjb.cn-hongkong.fcapp.run/'
const sidebarWidth = ref(250)
const isResizing = ref(false)
const isSidebarCollapsed = ref(window.innerWidth < 768)
const sidebarRef = ref<HTMLElement | null>(null)
// 按钮位置状态 (默认左上角)
const btnPos = ref({ top: 12, left: 12 })
const isBtnDragging = ref(false)

// 按钮拖拽逻辑
function initBtnDrag(e: MouseEvent | TouchEvent) {
  // 阻止默认滚动与鼠标事件透传 (修复移动端双重触发问题)
  if (e.type === 'touchstart') {
    e.preventDefault()
  }

  const startX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX
  const startY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY
  const startLeft = btnPos.value.left
  const startTop = btnPos.value.top
  
  let hasMoved = false

  const onMove = (moveEvent: MouseEvent | TouchEvent) => {
    const clientX = moveEvent instanceof MouseEvent ? moveEvent.clientX : moveEvent.touches[0].clientX
    const clientY = moveEvent instanceof MouseEvent ? moveEvent.clientY : moveEvent.touches[0].clientY
    
    const deltaX = clientX - startX
    const deltaY = clientY - startY
    
    // 放宽判定阈值：只有移动超过 5px 才算拖拽
    // 移动端点击时手指很容易产生 2-4px 的位移，如果阈值太低会导致点击失效
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasMoved = true
      isBtnDragging.value = true
    }
    
    if (hasMoved) {
      moveEvent.preventDefault() // 拖拽时阻止滚动
      let newLeft = startLeft + deltaX
      let newTop = startTop + deltaY
      
      // 边界限制
      const maxLeft = window.innerWidth - 40 // 按钮宽约40
      const maxTop = window.innerHeight - 40
      if (newLeft < 0) newLeft = 0
      if (newLeft > maxLeft) newLeft = maxLeft
      if (newTop < 0) newTop = 0
      if (newTop > maxTop) newTop = maxTop
      
      btnPos.value = { left: newLeft, top: newTop }
    }
  }

  const onUp = () => {
    // 如果没有发生拖拽，则触发点击切换
    if (!hasMoved) {
      toggleSidebar()
    }
    
    isBtnDragging.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onUp)
  }

  window.addEventListener('mousemove', onMove, { passive: false })
  window.addEventListener('mouseup', onUp)
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onUp)
}

// 监听窗口大小
window.addEventListener('resize', () => {
  // 可选：移动端自动折叠逻辑
})

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  
  // 清除手动设置的 style，让 Vue 接管
  if (sidebarRef.value) {
    sidebarRef.value.style.width = ''
  }
  
  // 安全检查
  if (!isSidebarCollapsed.value && sidebarWidth.value < 150) {
    sidebarWidth.value = 250
  }
}

// 拖拽逻辑 (rAF 优化版：实时跟手)
function initResize(e: MouseEvent) {
  if (isSidebarCollapsed.value) return 
  
  isResizing.value = true
  document.body.classList.add('vp-resizing')
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  const sidebarEl = sidebarRef.value
  
  let animationFrameId: number

  const onMouseMove = (moveEvent: MouseEvent) => {
    // 使用 rAF 节流，避免在一帧内多次触发重排
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    
    animationFrameId = requestAnimationFrame(() => {
      const delta = moveEvent.clientX - startX
      let newWidth = startWidth + delta
      if (newWidth < 150) newWidth = 150
      if (newWidth > 500) newWidth = 500
      
      // 直接操作 DOM，实时反馈
      if (sidebarEl) {
        sidebarEl.style.width = `${newWidth}px`
      }
    })
  }

  const onMouseUp = (upEvent: MouseEvent) => {
    isResizing.value = false
    document.body.classList.remove('vp-resizing')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    
    // 同步最终状态
    const delta = upEvent.clientX - startX
    let newWidth = startWidth + delta
    if (newWidth < 150) newWidth = 150
    if (newWidth > 500) newWidth = 500
    sidebarWidth.value = newWidth
    
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
        return '<pre class="hljs"><code>' +
               // @ts-ignore
               window.hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
})

// 动态加载 Highlight.js
function loadHighlight() {
  if (document.getElementById('hljs-script')) return 

  const script = document.createElement('script')
  script.id = 'hljs-script'
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js'
  document.head.appendChild(script)
}

onMounted(() => {
  loadHighlight()
})

// Helper: Build Tree from Flat GitHub Paths
function buildFileTree(flatFiles: any[]): PrivateFile[] {
  const root: PrivateFile[] = []
  const map = new Map<string, PrivateFile>()

  flatFiles.forEach(f => {
    const isDir = f.type === 'tree'
    const node: PrivateFile = {
      name: f.path.split('/').pop() || '',
      path: f.path,
      type: isDir ? 'dir' : 'file',
      children: isDir ? [] : undefined
    }
    map.set(f.path, node)
  })

  flatFiles.forEach(f => {
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
    nodes.forEach(n => {
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
        action: 'list'
      })
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
          path: file.path
        })
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
  
  const raw = privateStore.currentDoc.content || ''
  const cleanContent = raw.replace(/^---[\s\S]*?---\n/, '')
  
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
    <div v-else class="vault-ui" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
      
      <!-- Toggle Button (Draggable) -->
      <button 
        class="mobile-sidebar-toggle" 
        :style="{ top: btnPos.top + 'px', left: btnPos.left + 'px', cursor: isBtnDragging ? 'grabbing' : 'pointer' }"
        @mousedown="initBtnDrag"
        @touchstart="initBtnDrag"
        title="切换文件列表 (可拖动)"
      >
        <span class="icon">📂</span>
      </button>

      <!-- Sidebar -->
      <div class="vault-sidebar" 
           ref="sidebarRef"
           :style="{ width: isSidebarCollapsed ? '0px' : sidebarWidth + 'px' }">
        <div class="vault-header">
          <span class="vault-title">📦 远程文件库</span>
        </div>
        
        <div class="file-tree">
           <template v-for="node in privateStore.fileList" :key="node.path">
             <!-- Folder (Level 1) -->
             <div v-if="node.type === 'dir'" class="tree-group">
               <div class="tree-folder-label">
                 <span class="icon">📂</span>
                 <span>{{ node.name }}</span>
                </div>
               <div class="tree-children">
                 <template v-for="child in node.children" :key="child.path">
                   <div v-if="child.type === 'file'" class="tree-item" :class="{ active: privateStore.currentDoc?.path === child.path }" @click="selectFile(child)">
                     <span class="icon">📄</span><span>{{ child.name }}</span>
                   </div>
                   <div v-else class="tree-group-nested"><div class="tree-folder-label"><span class="icon">📂</span><span>{{ child.name }}</span></div></div>
                 </template>
               </div>
             </div>
             <!-- File (Level 1) -->
             <div v-else class="tree-item" :class="{ active: privateStore.currentDoc?.path === node.path }" @click="selectFile(node)">
                <span class="icon">📄</span><span>{{ node.name }}</span>
             </div>
           </template>
        </div>
      </div>

      <!-- Resizer Handle (Always visible to allow expanding) -->
      <div class="vault-resizer" @mousedown="initResize"></div>

      <!-- Content -->
      <div class="vault-content">
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
  overflow: hidden;
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
  box-shadow: 0 4px 24px rgba(0,0,0,0.05);
  width: 100%;
  max-width: 400px;
}
.icon-lock { font-size: 48px; margin-bottom: 16px; }
.lock-card h2 { margin: 0 0 8px; font-weight: 600; }
.subtext { color: var(--vp-c-text-2); margin-bottom: 24px; font-size: 14px; }
.input-box { display: flex; gap: 8px; }
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
.error-msg { color: var(--vp-c-danger); margin-top: 12px; font-size: 13px; }

.vault-ui { 
  display: flex; 
  height: 100%; 
  position: relative; 
}

.vault-sidebar {
  border-right: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
  transition: width 0.3s ease, transform 0.3s ease;
  overflow-x: hidden; 
}

/* 拖拽时禁用过渡，消除滞后感 */
:global(body.vp-resizing) .vault-sidebar {
  transition: none !important;
}

/* 切换按钮 (左上角) */
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
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.sidebar-collapsed .mobile-sidebar-toggle {
  background: var(--vp-c-bg-alt);
}

/* 拖拽手柄样式 */
.vault-resizer {
  width: 1px; /* 默认为一条细线 */
  background: var(--vp-c-divider);
  cursor: col-resize;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  transition: background 0.2s, width 0.2s;
}

/* 增加隐形热区 */
.vault-resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -6px;
  right: -6px;
  z-index: 20;
}

.vault-resizer:hover,
.vault-resizer:active {
  background: var(--vp-c-brand);
  width: 4px; /* 激活时变宽 */
}

.vault-header {
  padding: 16px;
  padding-left: 50px; /* 给 toggle 按钮留出空间 */
  border-bottom: 1px solid var(--vp-c-divider);
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.file-tree { padding: 8px; }
.tree-group { margin-bottom: 4px; }

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
  padding-top: 50px; /* 给按钮留出空间 */
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
.empty-icon { font-size: 48px; margin-bottom: 16px; }

/* 移动端适配逻辑 */
@media (max-width: 768px) {
  .vault-sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 80% !important; 
    max-width: 300px;
    z-index: 15;
    box-shadow: 4px 0 16px rgba(0,0,0,0.1);
    transform: translateX(0); /* 默认显示 */
  }
  
  /* 折叠时移出屏幕 */
  .vault-ui.sidebar-collapsed .vault-sidebar {
    transform: translateX(-100%);
    width: 80% !important;
    border-right: none;
  }
  
  /* 遮罩层 */
  .vault-ui::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 14;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  .vault-ui:not(.sidebar-collapsed)::before {
    opacity: 1;
    pointer-events: auto; 
  }
  
  .vault-resizer {
    display: none;
  }
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

.vp-doc :deep(.hljs-keyword), .vp-doc :deep(.hljs-function) { color: var(--vp-c-brand-1); font-weight: 600; }
.vp-doc :deep(.hljs-string) { color: #10b981; }
.vp-doc :deep(.hljs-comment) { color: var(--vp-c-text-3); font-style: italic; }
.vp-doc :deep(.hljs-number), .vp-doc :deep(.hljs-literal) { color: #f59e0b; }
.vp-doc :deep(.hljs-title) { color: #3b82f6; }

/* 3. 针对特定的页面类 */
.vp-doc {
  max-width: 100% !important;
}
</style>