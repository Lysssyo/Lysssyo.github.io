---
date created: 2026-01-15 23:32:33
date modified: 2026-01-16 11:39:40
---
这个问题是因为 VitePress 的二级导航栏（通常是 `VPLocalNav`，显示面包屑或本页大纲的那个条）在某些布局下层级较高（z-index 约为 20），或者占据了页面流的高度，而你的保险箱是 `fixed` 定位的，默认层级 `15` 较低，且没有预留二级导航的高度。

解决这个问题有两个核心点：

1. **避让布局**：将按钮的初始位置下移，将侧边栏标题增加顶部间距。
    
2. **提升层级**：提高保险箱容器的 `z-index`，使其覆盖掉 VitePress 的二级导航栏（因为在保险箱全屏模式下，不需要看二级导航）。
    

下面是修改后的代码，主要改动了 `script` 中的初始坐标和 `style` 中的层级与间距。

### 修改后的代码

代码段

```
<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
// ... 其他 import 保持不变

// ... (中间代码省略，直到 btnPos 定义处) ...

// 【修改点 1】：调整按钮初始位置
// 将 top 从 12 改为 60，避开顶部的二级导航栏高度
const btnPos = ref({ top: 60, left: 16 })
const isBtnDragging = ref(false)
const pendingAnchor = ref('')

// ... (initBtnDrag, toggleSidebar 等逻辑保持不变) ...

// ... (后续所有 script 逻辑保持不变) ...
</script>

<template>
  <div class="vault-wrapper">
     <div v-else class="vault-ui" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
      <button 
        class="mobile-sidebar-toggle"
        :style="{ top: btnPos.top + 'px', left: btnPos.left + 'px', cursor: isBtnDragging ? 'grabbing' : 'pointer' }"
        @mousedown="initBtnDrag"
        @touchstart="initBtnDrag"
        title="切换文件列表 (可拖动)"
      >
        <span class="icon">📂</span>
      </button>
      
      </div>
  </div>
</template>

<style scoped>
.vault-wrapper {
  position: fixed;
  top: var(--vp-nav-height);
  right: 0;
  bottom: 0;
  left: var(--vp-sidebar-width, 0);
  width: calc(100vw - var(--vp-sidebar-width, 0));
  
  /* 【修改点 2】：提升层级 */
  /* VitePress 的 LocalNav 层级通常是 20，我们将这里提升到 30 以覆盖它 */
  /* 但不要超过主导航栏 (通常是 50-60) */
  z-index: 30; 
  
  background: var(--vp-c-bg);
  border-top: 1px solid var(--vp-c-divider);
  border-left: 1px solid var(--vp-c-divider);
  border-radius: 0;
  
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ... (中间样式保持不变) ... */

.vault-header {
  padding: 16px;
  padding-left: 50px; 
  /* 【修改点 3】：增加顶部内边距 */
  /* 即使提升了 z-index，视觉上给顶部留一点呼吸感也是好的 */
  padding-top: 24px; 
  
  border-bottom: 1px solid var(--vp-c-divider);
  font-weight: 600;
  color: var(--vp-c-text-1);
  
  /* 防止标题本身被压缩 */
  flex-shrink: 0;
}

/* ... (中间样式保持不变) ... */

.mobile-sidebar-toggle {
  position: absolute;
  /* top 和 left 由内联样式控制，这里只控制层级 */
  /* 【修改点 4】：确保按钮层级最高 */
  z-index: 100; 
  
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  
  /* 增加一点过渡效果让拖拽结束时平滑一点，但拖拽中由 JS 控制 */
  transition: background 0.2s, box-shadow 0.2s;
}

/* ... (其他样式保持不变) ... */
</style>
```

### 改动解析

1. **`z-index: 30`**:
    
    - **原因**: VitePress 的二级导航栏（Local Nav）的 z-index 通常是 20。你之前的 `z-index: 15` 导致保险箱虽然是 fixed 定位，但还是渲染在了二级导航栏的**下层**。
        
    - **效果**: 提升到 30 后，保险箱会直接“盖住”二级导航栏。这符合逻辑，因为既然进入了私有保险箱，就不需要看外层页面的目录了。
        
2. **`btnPos` 初始值**:
    
    - **原因**: 原代码是 `top: 12`。如果二级导航栏存在，它会占据顶部约 40px 的空间，按钮就被挡住了。
        
    - **效果**: 改为 `top: 60`，强制按钮初始显示在更靠下的位置，避开可能的遮挡区域。
        
3. **`.vault-header` 的 `padding-top`**:
    
    - **原因**: 视觉修正。
        
    - **效果**: 给“远程文件库”几个字增加了一些顶部呼吸空间，防止显得太拥挤。
        

这样修改后，无论是否有二级导航栏，你的私有保险箱界面都应该能位于最上层，且按钮和标题都清晰可见。