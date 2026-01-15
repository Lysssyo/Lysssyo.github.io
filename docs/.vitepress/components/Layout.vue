<script setup>
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'

const { frontmatter } = useData()
const route = useRoute()
const isResizing = ref(false)
const showHandle = ref(false)
const handleLeft = ref(0) // 手柄的实时物理位置

// 配置常量
const STORAGE_KEY = 'vp-sidebar-width'
const DEFAULT_WIDTH = 272
const MIN_WIDTH = 200
const MAX_WIDTH = 600

// 核心：测量侧边栏真实的右边缘位置
function updateHandlePos() {
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
    // 给 DOM 一点点渲染时间
    nextTick(() => setTimeout(updateHandlePos, 100))
  }
}

function restoreWidth() {
  const savedWidth = localStorage.getItem(STORAGE_KEY)
  if (savedWidth) {
    document.documentElement.style.setProperty('--vp-sidebar-width', `${savedWidth}px`)
    nextTick(() => updateHandlePos())
  }
}

function initDrag(e) {
  e.preventDefault()
  const startX = e.clientX
  // 不再依赖物理宽度测量，避免因 box-sizing 或 padding 导致的数值不一致
  // const sidebar = document.querySelector('.VPSidebar')
  // if (!sidebar) return
  // const startWidth = sidebar.getBoundingClientRect().width
  
  // 读取当前的 CSS 变量值作为基准
  const cssWidth = getComputedStyle(document.documentElement).getPropertyValue('--vp-sidebar-width')
  const startWidth = parseInt(cssWidth) || DEFAULT_WIDTH
  
  isResizing.value = true
  document.body.classList.add('vp-resizing') // 标记开始拖拽
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

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

onMounted(() => {
  checkVisibility()
  restoreWidth()
  window.addEventListener('resize', updateHandlePos)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateHandlePos)
})

// 路由变化时重新检查和定位
watch(() => route.path, () => {
  nextTick(() => {
    checkVisibility()
    setTimeout(updateHandlePos, 200) // 延迟确保 VitePress 侧边栏已切出
  })
})
</script>

<template>
  <div 
    v-if="showHandle"
    class="sidebar-resize-handle"
    :class="{ 'is-resizing': isResizing }"
    :style="{ left: handleLeft + 'px' }" 
    @mousedown="initDrag"
    title="拖拽调整侧边栏宽度"
  >
    <div class="resize-line"></div>
  </div>
</template>

<style>
/* 全局样式：拖拽时禁用侧边栏动画，消除滞后漂移 */
body.vp-resizing .VPSidebar {
  transition: none !important;
}
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
</style>