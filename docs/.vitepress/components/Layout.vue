<script setup>
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'

const { frontmatter } = useData()
const route = useRoute()
const isResizing = ref(false)
const showHandle = ref(false)
const handleLeft = ref(0) // 手柄的实时物理位置
const isCollapsed = ref(false) // 侧边栏折叠状态
const lastWidth = ref(DEFAULT_WIDTH) // 记录折叠前的宽度

// 配置常量
const STORAGE_KEY = 'vp-sidebar-width'
const COLLAPSE_KEY = 'vp-sidebar-collapsed'
const DEFAULT_WIDTH = 272
const MIN_WIDTH = 200
const MAX_WIDTH = 600

// 核心：测量侧边栏真实的右边缘位置
function updateHandlePos() {
  if (isCollapsed.value) {
    handleLeft.value = 0
    return
  }
  const sidebar = document.querySelector('.VPSidebar')
  if (sidebar) {
    const rect = sidebar.getBoundingClientRect()
    handleLeft.value = rect.right
  }
}

function checkVisibility() {
  const isDesktop = window.matchMedia('(min-width: 960px)').matches
  const isHomePage = frontmatter.value.layout === 'home'
  showHandle.value = isDesktop && !isHomePage
  if (showHandle.value) {
    nextTick(() => setTimeout(updateHandlePos, 100))
  }
}

// 切换折叠状态
function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem(COLLAPSE_KEY, String(isCollapsed.value))
  
  if (isCollapsed.value) {
    // 收起：保存当前宽度，然后设为 0
    const currentWidth = getComputedStyle(document.documentElement).getPropertyValue('--vp-sidebar-width')
    lastWidth.value = parseInt(currentWidth) || DEFAULT_WIDTH
    document.documentElement.style.setProperty('--vp-sidebar-width', '0px')
    document.body.classList.add('vp-sidebar-collapsed')
  } else {
    // 展开：恢复宽度
    document.documentElement.style.setProperty('--vp-sidebar-width', `${lastWidth.value}px`)
    document.body.classList.remove('vp-sidebar-collapsed')
  }
  
  // 更新手柄位置
  setTimeout(updateHandlePos, 300)
}

function restoreWidth() {
  // 1. 恢复折叠状态
  const collapsedState = localStorage.getItem(COLLAPSE_KEY)
  if (collapsedState === 'true') {
    isCollapsed.value = true
    document.body.classList.add('vp-sidebar-collapsed')
    document.documentElement.style.setProperty('--vp-sidebar-width', '0px')
  } else {
    // 2. 恢复宽度
    const savedWidth = localStorage.getItem(STORAGE_KEY)
    if (savedWidth) {
      lastWidth.value = parseInt(savedWidth)
      document.documentElement.style.setProperty('--vp-sidebar-width', `${savedWidth}px`)
    }
  }
  nextTick(() => updateHandlePos())
}

function initDrag(e) {
  if (isCollapsed.value) return // 折叠状态下禁止拖拽
  
  e.preventDefault()
  // ... (保持原有的拖拽逻辑) ...
  const startX = e.clientX
  // 读取当前的 CSS 变量值作为基准
  const cssWidth = getComputedStyle(document.documentElement).getPropertyValue('--vp-sidebar-width')
  const startWidth = parseInt(cssWidth) || DEFAULT_WIDTH
  
  isResizing.value = true
  document.body.classList.add('vp-resizing') // 标记开始拖拽

  const onMouseMove = (moveEvent) => {
    let newWidth = startWidth + (moveEvent.clientX - startX)
    if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH
    if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH
    
    // 更新 CSS 变量驱动侧边栏缩放
    document.documentElement.style.setProperty('--vp-sidebar-width', `${newWidth}px`)
    // 实时测量新位置，确保手柄线精准跟随
    updateHandlePos()
  }

  const onMouseUp = () => {
    isResizing.value = false
    document.body.classList.remove('vp-resizing') // 移除标记
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    
    const finalWidth = getComputedStyle(document.documentElement).getPropertyValue('--vp-sidebar-width')
    localStorage.setItem(STORAGE_KEY, parseInt(finalWidth))
    
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
// ... (Hook 部分保持不变) ...
onMounted(() => {
  checkVisibility()
  restoreWidth()
  window.addEventListener('resize', updateHandlePos)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateHandlePos)
})

watch(() => route.path, () => {
  nextTick(() => {
    checkVisibility()
    setTimeout(updateHandlePos, 200) 
  })
})
</script>

<template>
  <div 
    v-if="showHandle"
    class="sidebar-resize-handle"
    :class="{ 'is-resizing': isResizing, 'is-collapsed': isCollapsed }"
    :style="{ left: handleLeft + 'px' }" 
    @mousedown="initDrag"
    title="拖拽调整宽度"
  >
    <div class="resize-line"></div>
    
    <!-- 折叠按钮 -->
    <div class="collapse-btn" @mousedown.stop @click="toggleSidebar" :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'">
      <span class="icon">{{ isCollapsed ? '›' : '‹' }}</span>
    </div>
  </div>
</template>

<style>
/* 全局样式：拖拽时禁用侧边栏动画，消除滞后漂移 */
body.vp-resizing .VPSidebar {
  transition: none !important;
}
/* 折叠状态下隐藏侧边栏本体和顶部标题 */
body.vp-sidebar-collapsed .VPSidebar,
body.vp-sidebar-collapsed .VPNavBarTitle,
body.vp-sidebar-collapsed .VPNavBar .title {
  display: none !important;
}

/* 此时不再需要强制覆盖 padding-left，因为变量已经是 0 了，
   VitePress 会自动处理布局。 */
</style>

<style scoped>
.sidebar-resize-handle {
  position: fixed;
  /* left 由 JS 动态计算 */
  top: var(--vp-nav-height);
  bottom: 0;
  width: 16px;
  margin-left: -8px; 
  z-index: 50;
  cursor: col-resize;
  display: flex;
  justify-content: center;
  align-items: center; /* 垂直居中放置按钮 */
  pointer-events: auto;
}

.resize-line {
  width: 2px;
  height: 100%;
  background-color: transparent;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.sidebar-resize-handle:hover .resize-line,
.sidebar-resize-handle.is-resizing .resize-line {
  background-color: var(--vp-c-brand-1);
  opacity: 1;
  box-shadow: 0 0 4px var(--vp-c-brand-1);
}

/* 折叠按钮样式 */
.collapse-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s ease;
  z-index: 60;
  opacity: 0; /* 默认隐藏，hover 时显示 */
}

/* 悬停手柄区域时显示按钮 */
.sidebar-resize-handle:hover .collapse-btn,
.sidebar-resize-handle.is-collapsed .collapse-btn {
  opacity: 1;
}

.collapse-btn:hover {
  background-color: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-1);
}

.icon {
  font-size: 16px;
  line-height: 1;
  font-weight: bold;
  margin-top: -2px;
}

/* 折叠状态下的手柄样式调整 */
.sidebar-resize-handle.is-collapsed {
  cursor: default;
  width: 24px;
  margin-left: 0;
  left: 0 !important; /* 强制停靠在左边 */
}
.sidebar-resize-handle.is-collapsed .resize-line {
  display: none;
}
</style>