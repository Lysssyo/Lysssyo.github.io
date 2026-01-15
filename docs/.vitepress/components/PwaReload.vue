<script setup lang="ts">
import { ref, onMounted } from 'vue'

const offlineReady = ref(false)
const needRefresh = ref(false)
const updateServiceWorker = ref<any>(null)

onMounted(async () => {
  // 只在浏览器端执行
  if (typeof window !== 'undefined') {
    const { useRegisterSW } = await import('virtual:pwa-register/vue')
    const sw = useRegisterSW()
    offlineReady.value = sw.offlineReady.value
    needRefresh.value = sw.needRefresh.value
    updateServiceWorker.value = sw.updateServiceWorker
    
    // 监听状态变化
    const { watch } = await import('vue')
    watch(sw.offlineReady, (val) => offlineReady.value = val)
    watch(sw.needRefresh, (val) => needRefresh.value = val)
  }
})

const close = async () => {
  offlineReady.value = false
  needRefresh.value = false
}

const onUpdate = async () => {
  if (updateServiceWorker.value) {
    await updateServiceWorker.value()
  }
}
</script>

<template>
  <div v-if="offlineReady || needRefresh" class="pwa-toast" role="alert">
    <div class="pwa-message">
      <span v-if="offlineReady"> App ready to work offline </span>
      <span v-else> New content available, click on reload button to update. </span>
    </div>
    <div class="pwa-actions">
      <button v-if="needRefresh" @click="onUpdate" class="pwa-reload">
        Reload
      </button>
      <button @click="close" class="pwa-close">
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.pwa-toast {
  position: fixed;
  right: 0;
  bottom: 0;
  margin: 16px;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  z-index: 100;
  text-align: left;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  background-color: var(--vp-c-bg);
  transition: all 0.3s;
}

.pwa-message {
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--vp-c-text-1);
}

.pwa-actions {
  display: flex;
  gap: 8px;
}

button {
  border: 1px solid var(--vp-c-divider);
  outline: none;
  margin-right: 5px;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
}

button.pwa-reload {
  background-color: var(--vp-c-brand);
  color: white;
  border-color: var(--vp-c-brand);
}

button:hover {
  opacity: 0.8;
}
</style>