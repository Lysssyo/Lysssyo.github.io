<script setup lang="ts">
import { ref } from 'vue'
import type { PrivateFile } from '../store'

const props = defineProps<{
  node: PrivateFile
  depth?: number
  currentPath?: string
}>()

const emit = defineEmits<{
  (e: 'select', node: PrivateFile): void
}>()

// 默认展开所有文件夹，或者你可以设为 false
const isExpanded = ref(true)

function toggle() {
  isExpanded.value = !isExpanded.value
}

function onSelect(n: PrivateFile) {
  emit('select', n)
}
</script>

<template>
  <div class="tree-node">
    <!-- Folder -->
    <template v-if="node.type === 'dir'">
      <div 
        class="tree-folder-label" 
        :style="{ paddingLeft: (depth || 0) * 16 + 8 + 'px' }"
        @click="toggle"
      >
        <!-- 旋转箭头 -->
        <span class="icon arrow" :class="{ expanded: isExpanded }">▶</span>
        <span class="icon">📂</span>
        <span class="text">{{ node.name }}</span>
      </div>
      
      <div v-show="isExpanded" class="tree-children">
        <FileTreeNode 
          v-for="child in node.children" 
          :key="child.path"
          :node="child"
          :depth="(depth || 0) + 1"
          :currentPath="currentPath"
          @select="onSelect"
        />
      </div>
    </template>

    <!-- File -->
    <template v-else>
      <div 
        class="tree-item" 
        :class="{ active: currentPath === node.path }"
        :style="{ paddingLeft: (depth || 0) * 16 + 24 + 'px' }" 
        @click="onSelect(node)"
      >
        <span class="icon">📄</span>
        <span class="text">{{ node.name }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tree-node {
  /* 避免过多的 margin */
}

.tree-folder-label {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  cursor: pointer;
  user-select: none;
  transition: background 0.1s;
}

.tree-folder-label:hover {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  font-size: 14px;
  color: var(--vp-c-text-1);
  cursor: pointer;
  border-radius: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s;
}

.tree-item:hover { 
  background: var(--vp-c-bg-mute); 
}

.tree-item.active {
  background: var(--vp-c-brand-dimm); 
  color: var(--vp-c-brand); 
  font-weight: 600; 
  border-right: 3px solid var(--vp-c-brand);
}

.icon { margin-right: 6px; display: inline-flex; align-items: center; }
.text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.arrow {
  font-size: 10px;
  width: 12px;
  height: 12px;
  margin-right: 4px;
  color: var(--vp-c-text-3);
  transition: transform 0.2s;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

.arrow.expanded {
  transform: rotate(90deg);
}
</style>