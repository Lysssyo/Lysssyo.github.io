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
  <Transition name="fade">
    <div v-if="offlineReady || needRefresh" class="pwa-overlay">
      <div class="pwa-toast" role="alert">
        <div class="pwa-icon">
          <span v-if="offlineReady">✅</span>
          <span v-else>🚀</span>
        </div>
        <div class="pwa-content">
          <h3 class="pwa-title">{{ offlineReady ? '已准备就绪' : '发现新版本' }}</h3>
          <p class="pwa-message">
            {{ offlineReady ? '内容已缓存，现在可以离线访问。' : '网站内容已更新，请点击刷新以查看最新版本。' }}
          </p>
        </div>
        <div class="pwa-actions">
          <button v-if="needRefresh" @click="onUpdate" class="pwa-reload">
            立即刷新
          </button>
          <button @click="close" class="pwa-close">
            稍后
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.pwa-toast {
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.pwa-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.pwa-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.pwa-message {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.pwa-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

button {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--vp-c-divider);
}

.pwa-reload {
  background-color: var(--vp-c-brand);
  color: white;
  border-color: var(--vp-c-brand);
}

.pwa-reload:hover {
  background-color: var(--vp-c-brand-dark);
}

.pwa-close {
  background-color: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
}

.pwa-close:hover {
  background-color: var(--vp-c-divider);
}

/* 动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* PC 端布局微调 */
@media (min-width: 640px) {
  .pwa-actions {
    flex-direction: row-reverse;
  }
  
  button {
    flex: 1;
  }
}
</style>