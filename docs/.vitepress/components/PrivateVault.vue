<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { marked } from 'marked'
import { privateStore, type PrivateFile } from '../store'

const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const API_URL = '/api'

// Helper: Build Tree from Flat GitHub Paths
function buildFileTree(flatFiles: any[]): PrivateFile[] {
  const root: PrivateFile[] = []
  const map = new Map<string, PrivateFile>()

  // 1. Create all nodes
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

  // 2. Assemble tree
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
        // If parent not found (maybe filtered out?), add to root or ignore
        // For safety, add to root if parent missing
        root.push(node) 
      }
    }
  })
  
  // Sort: Dirs first, then files
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
    console.log('Starting fetch to:', API_URL)
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: password.value,
        action: 'list'
      })
    })
    
    console.log('Fetch status:', res.status, res.statusText)
    
    if (!res.ok) {
       const text = await res.text()
       console.error('Error Body:', text)
       throw new Error(`Server Error: ${res.status}`)
    }
    
    const data = await res.json()
    console.log('Parsed JSON:', data)
    
    // Compatibility: Handle if data is wrapped in 'data' prop
    const realData = data.data || data 
    
    if (realData.files) {
      const tree = buildFileTree(realData.files)
      privateStore.token = password.value 
      privateStore.setData(tree)
    } else {
      console.warn('Structure mismatch:', data)
      throw new Error('返回数据格式不对，找不到 files 字段')
    }
    
  } catch (e: any) {
    console.error('Unlock Failed:', e)
    errorMsg.value = e.message || '网络请求失败'
  } finally {
    loading.value = false
  }
}

async function selectFile(file: PrivateFile) {
  if (file.type === 'dir') return
  
  // Optimistic update
  privateStore.currentDoc = file
  
  if (!file.content) {
    // Fetch content if missing
    try {
      // Show loading placeholder?
      // For now simple content fetch
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: privateStore.token, // Use stored password
          action: 'content',
          path: file.path
        })
      })
      
      const data = await res.json()
      console.log('Content API Response:', data)
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
  return marked.parse(privateStore.currentDoc.content || '')
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
    <div v-else class="vault-ui">
      
      <!-- Sidebar -->
      <div class="vault-sidebar">
        <div class="vault-header">
          <span class="vault-title">📦 远程文件库</span>
        </div>
        
        <div class="file-tree">
           <!-- Level 1 -->
           <template v-for="node in privateStore.fileList" :key="node.path">
             
             <!-- Folder (Level 1) -->
             <div v-if="node.type === 'dir'" class="tree-group">
               <div class="tree-folder-label">{{ node.name }}</div>
               
               <!-- Level 2 Children -->
               <div class="tree-children">
                 <template v-for="child in node.children" :key="child.path">
                   <!-- File (Level 2) -->
                   <div 
                     v-if="child.type === 'file'"
                     class="tree-item"
                     :class="{ active: privateStore.currentDoc?.path === child.path }"
                     @click="selectFile(child)"
                   >
                     {{ child.name }}
                   </div>
                   <!-- Nested Folder (Level 2) - Not recursive for simplicity, just show label -->
                   <div v-else class="tree-folder-label-nested">
                      📂 {{ child.name }} (Nested)
                   </div>
                 </template>
               </div>
             </div>

             <!-- File (Level 1) -->
             <div 
               v-else 
               class="tree-item"
               :class="{ active: privateStore.currentDoc?.path === node.path }"
               @click="selectFile(node)"
             >
               {{ node.name }}
             </div>

           </template>
        </div>
      </div>

      <!-- Content -->
      <div class="vault-content">
        <div v-if="privateStore.currentDoc" class="markdown-body">
           <div v-html="renderedContent" class="md-content"></div>
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
  background: var(--vp-c-bg-alt);
}
.lock-card {
  text-align: center;
  padding: 40px;
  background: var(--vp-c-bg);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.1);
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
  background: var(--vp-c-bg-alt);
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

.vault-ui { display: flex; height: 100%; }
.vault-sidebar {
  width: 250px;
  border-right: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.vault-header {
  padding: 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.file-tree { padding: 10px; flex: 1; }
.tree-folder-label {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-top: 8px;
}
.tree-item {
  padding: 6px 12px 6px 24px;
  font-size: 14px;
  color: var(--vp-c-text-1);
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-item:hover { background: var(--vp-c-bg-mute); }
.tree-item.active { background: var(--vp-c-brand-dimm); color: var(--vp-c-brand); font-weight: 500; }

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
.empty-icon { font-size: 48px; margin-bottom: 16px; }

/* Markdown Override */
.md-content :deep(h1) { font-size: 2.2em; font-weight: 700; margin-bottom: 1em; border-bottom: 1px solid var(--vp-c-divider); padding-bottom: 0.3em; }
.md-content :deep(h2) { font-size: 1.6em; font-weight: 600; margin: 1.5em 0 0.8em; }
.md-content :deep(p) { margin-bottom: 1.2em; line-height: 1.6; }
.md-content :deep(ul) { list-style: disc; padding-left: 20px; margin-bottom: 1.2em; }
.md-content :deep(code) { font-family: monospace; background: var(--vp-c-bg-mute); padding: 2px 5px; border-radius: 4px; font-size: 0.9em; }
.md-content :deep(pre) { background: var(--vp-c-bg-mute); padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 1.2em; }
</style>
