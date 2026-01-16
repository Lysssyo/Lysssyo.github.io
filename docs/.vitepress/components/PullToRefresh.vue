<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const THRESHOLD = 80 // 触发刷新的下拉距离
const MAX_DRAG = 120 // 最大拖拽距离（阻尼效果上限）

const el = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)

const state = ref<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle')
const pullY = ref(0)

let startY = 0
let isDragging = false

// 检查页面是否处于顶部
const isAtTop = () => window.scrollY <= 0

const onTouchStart = (e: TouchEvent) => {
  // 1. 只有在页面顶部才允许下拉刷新
  if (!isAtTop()) return
  // 2. 如果正在刷新中，忽略
  if (state.value === 'refreshing') return

  // 3. 关键修复：如果触摸点在任何具有独立滚动的侧边栏或容器内，禁止下拉刷新
  const target = e.target as HTMLElement
  const scrollableSelectors = [
    '.VPSidebar',      // 官方侧边栏
    '.vault-sidebar',  // 保险箱侧边栏
    '.VPLocalNav',     // 移动端局部导航
    '.vp-code-group',  // 代码块组
    'pre'              // 原生代码块
  ]
  
  if (scrollableSelectors.some(selector => target.closest(selector))) {
    return
  }

  startY = e.touches[0].clientY
  isDragging = true
}

const onTouchMove = (e: TouchEvent) => {
  if (!isDragging) return
  
  const currentY = e.touches[0].clientY
  const deltaY = currentY - startY

  // 如果向上滑动，或者页面不在顶部，取消逻辑
  if (deltaY < 0 || !isAtTop()) {
    return
  }

  // 阻止原生滚动行为（关键：防止iOS橡皮筋效果干扰）
  // 注意：这可能需要 passive: false
  if (e.cancelable && deltaY > 0) {
    e.preventDefault()
  }

  // 计算带阻尼的位移
  // 简单的阻尼公式：实际位移 = 拖拽距离 * 0.5 (随着距离增加系数变小)
  const dampedY = Math.min(deltaY * 0.5, MAX_DRAG)
  
  pullY.value = dampedY
  
  if (dampedY >= THRESHOLD) {
    state.value = 'ready'
  } else {
    state.value = 'pulling'
  }
}

const onTouchEnd = () => {
  if (!isDragging) return
  isDragging = false
  
  if (state.value === 'ready') {
    // 触发刷新
    state.value = 'refreshing'
    pullY.value = THRESHOLD // 停留在阈值处显示 loading
    
    // 执行刷新逻辑
    setTimeout(() => {
      window.location.reload()
    }, 500) // 延迟一点让用户看到 loading 动画
  } else {
    // 回弹
    state.value = 'idle'
    pullY.value = 0
  }
}

onMounted(() => {
  // 使用 passive: false 以便能调用 preventDefault 阻止原生滚动
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd, { passive: true })
})

onUnmounted(() => {
  document.removeEventListener('touchstart', onTouchStart)
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('touchend', onTouchEnd)
})
</script>

<template>
  <div 
    class="ptr-container" 
    :style="{ transform: `translateY(${pullY}px)` }"
    :class="{ 'ptr-transition': !isDragging }"
  >
    <!-- 下拉指示器 -->
    <div class="ptr-indicator">
      <div class="ptr-icon" :class="{ 'rotate': state === 'ready', 'spin': state === 'refreshing' }">
        <svg v-if="state === 'refreshing'" viewBox="0 0 24 24" width="24" height="24">
           <path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8Z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="24" height="24" :style="{ transform: `rotate(${pullY * 2}deg)` }">
          <path fill="currentColor" d="M12 5v14l-7-7 7-7z" style="transform-origin: center; transform: rotate(-90deg)"/>
        </svg>
      </div>
      <div class="ptr-text">
        {{ state === 'pulling' ? '下拉刷新' : state === 'ready' ? '释放刷新' : '正在刷新...' }}
      </div>
    </div>
    
    <!-- 插槽：用于包裹页面内容 -->
    <slot></slot>
  </div>
</template>

<style scoped>
.ptr-container {
  /* 确保容器占满 */
  min-height: 100vh;
  position: relative;
}

.ptr-transition {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.ptr-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 60px;
  /* 将指示器向上偏移，隐藏在顶部 */
  transform: translateY(-100%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: 500;
}

.ptr-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  transition: transform 0.2s;
}

.rotate {
  transform: rotate(180deg);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>