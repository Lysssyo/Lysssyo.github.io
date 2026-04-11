<script setup lang="ts">
import { ref, onMounted } from 'vue'

const FC_URL = 'https://libraryion-ctrl-pzjqodsuid.us-west-1.fcapp.run/'
const SEAT_OFFSET = 101267703

const statusLoading = ref(true)
const loading = ref(false)
const triggerEnabled = ref(false)
const seatId = ref('')
const seatInput = ref('')
const msg = ref('')
const msgType = ref<'success' | 'error'>('success')

async function callFC(body: object) {
  const res = await fetch(FC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function fetchStatus() {
  statusLoading.value = true
  try {
    const data = await callFC({ action: 'status' })
    triggerEnabled.value = data.triggerEnabled
    const displaySeat = data.seatId ? String(Number(data.seatId) - SEAT_OFFSET) : ''
    seatId.value = displaySeat
    seatInput.value = displaySeat
  } catch (e) {
    showMsg('获取状态失败', 'error')
  } finally {
    statusLoading.value = false
  }
}

async function toggleTrigger() {
  loading.value = true
  const newState = !triggerEnabled.value
  try {
    const data = await callFC({ action: 'toggle', enable: newState })
    if (data.success) {
      triggerEnabled.value = newState
      showMsg(newState ? '触发器已开启' : '触发器已关闭', 'success')
    } else {
      showMsg(data.error || '操作失败', 'error')
    }
  } catch (e) {
    showMsg('请求失败', 'error')
  } finally {
    loading.value = false
  }
}

async function updateSeat() {
  const seat = seatInput.value.trim()
  if (!seat) return
  loading.value = true
  try {
    const data = await callFC({ action: 'set-seat', seat: String(Number(seat) + SEAT_OFFSET) })
    if (data.success) {
      seatId.value = seat
      showMsg('座位号已更新', 'success')
    } else {
      showMsg(data.error || '更新失败', 'error')
    }
  } catch (e) {
    showMsg('请求失败', 'error')
  } finally {
    loading.value = false
  }
}

function showMsg(text: string, type: 'success' | 'error') {
  msg.value = text
  msgType.value = type
  setTimeout(() => { msg.value = '' }, 3000)
}

onMounted(fetchStatus)
</script>

<template>
  <div class="lib-wrapper">
    <div class="lib-card">
      <div class="lib-icon">📚</div>
      <h2>图书馆预约控制台</h2>
      <p class="lib-subtext">管理自动预约定时触发器与座位号</p>

      <div v-if="statusLoading" class="lib-loading">加载中...</div>

      <div v-else class="lib-controls">
        <!-- 触发器开关 -->
        <div class="lib-section">
          <div class="lib-section-label">定时触发器</div>
          <button
            class="lib-toggle-btn"
            :class="triggerEnabled ? 'enabled' : 'disabled'"
            :disabled="loading"
            @click="toggleTrigger"
          >
            <span class="toggle-dot" />
            {{ loading ? '操作中...' : (triggerEnabled ? '已开启' : '已关闭') }}
          </button>
        </div>

        <!-- 座位号 -->
        <div class="lib-section">
          <div class="lib-section-label">座位号 <span class="current-seat">当前：{{ seatId || '未设置' }}</span></div>
          <div class="lib-input-row">
            <input
              v-model="seatInput"
              type="text"
              placeholder="输入座位号..."
              :disabled="loading"
              @keyup.enter="updateSeat"
            />
            <button class="lib-submit-btn" :disabled="loading || !seatInput.trim()" @click="updateSeat">
              更新
            </button>
          </div>
        </div>

        <!-- 消息提示 -->
        <div v-if="msg" class="lib-msg" :class="msgType">{{ msg }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lib-wrapper {
  min-height: calc(100vh - var(--vp-nav-height));
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg);
  padding: 40px 16px;
}

.lib-card {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.lib-icon { font-size: 48px; margin-bottom: 16px; }

.lib-card h2 { margin: 0 0 8px; font-weight: 600; font-size: 20px; }

.lib-subtext { color: var(--vp-c-text-2); font-size: 14px; margin-bottom: 32px; }

.lib-loading { color: var(--vp-c-text-2); font-size: 14px; }

.lib-controls { display: flex; flex-direction: column; gap: 24px; }

.lib-section { text-align: left; }

.lib-section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-seat {
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.lib-toggle-btn {
  width: 100%;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s, opacity 0.2s;
  border: none;
}

.lib-toggle-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.lib-toggle-btn.enabled {
  background: var(--vp-c-brand);
  color: #fff;
}

.lib-toggle-btn.disabled {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-divider);
}

.toggle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.8;
}

.lib-input-row { display: flex; gap: 8px; }

.lib-input-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.lib-input-row input:focus { border-color: var(--vp-c-brand); }

.lib-submit-btn {
  padding: 8px 16px;
  background: var(--vp-c-brand);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.lib-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.lib-msg {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 6px;
  text-align: center;
}

.lib-msg.success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.lib-msg.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--vp-c-danger);
}

@media (max-width: 480px) {
  .lib-wrapper { padding: 24px 12px; align-items: flex-start; padding-top: 40px; }
  .lib-card { padding: 24px 20px; }
  .lib-icon { font-size: 36px; }
}
</style>
