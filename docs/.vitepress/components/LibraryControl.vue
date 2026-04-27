<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const API_BASE = 'https://lib.zl6544hx.asia'
const SEAT_OFFSET = 101267703

type MsgType = 'success' | 'error'

interface ApiState {
  enabled?: boolean
  seat_id?: string | null
  last_run_at?: string | null
  last_result?: string | null
  error?: string
}

interface LogResponse {
  date: string
  lines: string[]
  error?: string
}

const statusLoading = ref(true)
const actionLoading = ref('')
const triggerEnabled = ref(false)
const rawSeatId = ref('')
const seatInput = ref('')
const lastRunAt = ref('')
const lastResult = ref('')
const logDate = ref(todayInShanghai())
const logLines = ref<string[]>([])
const logsLoaded = ref(false)
const logModalOpen = ref(false)
const msg = ref('')
const msgType = ref<MsgType>('success')

const seatId = computed(() => {
  if (!rawSeatId.value) return ''
  const id = Number(rawSeatId.value)
  return Number.isFinite(id) ? String(id - SEAT_OFFSET) : rawSeatId.value
})

const isBusy = computed(() => statusLoading.value || Boolean(actionLoading.value))

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `请求失败：${res.status}`)
  }
  return data as T
}

function applyState(data: ApiState) {
  triggerEnabled.value = Boolean(data.enabled)
  rawSeatId.value = data.seat_id ? String(data.seat_id) : ''
  seatInput.value = seatId.value
  lastRunAt.value = data.last_run_at || ''
  lastResult.value = data.last_result || ''
}

async function fetchStatus(silent = false) {
  statusLoading.value = true
  try {
    const [state, seat] = await Promise.all([
      apiRequest<ApiState>('/status'),
      apiRequest<ApiState>('/seat'),
    ])
    applyState({ ...state, seat_id: seat.seat_id ?? state.seat_id })
    if (!silent) showMsg('状态已刷新', 'success')
  } catch (e) {
    showMsg(errorMessage(e, '获取状态失败'), 'error')
  } finally {
    statusLoading.value = false
  }
}

async function toggleTrigger() {
  const newState = !triggerEnabled.value
  actionLoading.value = 'enabled'
  try {
    const data = await apiRequest<ApiState>('/enabled', {
      method: 'POST',
      body: JSON.stringify({ enabled: newState }),
    })
    applyState(data)
    showMsg(newState ? '自动预约已开启' : '自动预约已关闭', 'success')
  } catch (e) {
    showMsg(errorMessage(e, '操作失败'), 'error')
  } finally {
    actionLoading.value = ''
  }
}

async function updateSeat() {
  const seat = seatInput.value.trim()
  if (!seat) return
  if (!/^\d+$/.test(seat)) {
    showMsg('座位号必须是纯数字', 'error')
    return
  }

  actionLoading.value = 'seat'
  try {
    const seat_id = String(Number(seat) + SEAT_OFFSET)
    const data = await apiRequest<ApiState>('/seat', {
      method: 'POST',
      body: JSON.stringify({ seat_id }),
    })
    applyState(data)
    showMsg('座位号已更新', 'success')
  } catch (e) {
    showMsg(errorMessage(e, '更新失败'), 'error')
  } finally {
    actionLoading.value = ''
  }
}

async function runOnce() {
  actionLoading.value = 'run'
  try {
    const data = await apiRequest<{ started?: boolean; message?: string }>('/run', {
      method: 'POST',
    })
    showMsg(data.message || '任务已开始', data.started === false ? 'error' : 'success')
    await fetchStatus(true)
  } catch (e) {
    showMsg(errorMessage(e, '启动失败'), 'error')
  } finally {
    actionLoading.value = ''
  }
}

async function fetchTodayLogs() {
  actionLoading.value = 'logs'
  logsLoaded.value = true
  logDate.value = todayInShanghai()
  try {
    const data = await apiRequest<LogResponse>(`/logs?date=${logDate.value}`)
    logLines.value = data.lines || []
    logModalOpen.value = true
    showMsg('今日日志已加载', 'success')
  } catch (e) {
    showMsg(errorMessage(e, '获取日志失败'), 'error')
  } finally {
    actionLoading.value = ''
  }
}

function todayInShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

function showMsg(text: string, type: MsgType) {
  msg.value = text
  msgType.value = type
  window.setTimeout(() => { msg.value = '' }, 3000)
}

function closeLogModal() {
  logModalOpen.value = false
}

onMounted(() => fetchStatus(true))
</script>

<template>
  <div class="lib-wrapper">
    <div class="lib-shell">
      <div v-if="statusLoading" class="lib-card lib-loading">加载中...</div>

      <template v-else>
        <section class="lib-card lib-controls">
          <div class="control-head">
            <div>
              <div class="section-title">预约控制</div>
              <div class="run-meta">
                最近运行：{{ lastRunAt || '暂无记录' }}
                <span v-if="lastResult" :class="lastResult === 'success' ? 'result-ok' : 'result-warn'">
                  {{ lastResult }}
                </span>
              </div>
            </div>
            <button class="lib-secondary-btn compact" :disabled="isBusy" @click="fetchTodayLogs">
              {{ actionLoading === 'logs' ? '加载中...' : '查看今日日志' }}
            </button>
          </div>

          <div class="lib-section">
            <div class="lib-section-label">自动预约开关</div>
            <button
              class="lib-toggle-btn"
              :class="triggerEnabled ? 'enabled' : 'disabled'"
              :disabled="isBusy"
              @click="toggleTrigger"
            >
              <span class="toggle-dot" />
              {{ actionLoading === 'enabled' ? '操作中...' : (triggerEnabled ? '关闭自动预约' : '开启自动预约') }}
            </button>
          </div>

          <div class="lib-section">
            <div class="lib-section-label">座位号</div>
            <div class="lib-input-row">
              <input
                v-model="seatInput"
                type="text"
                inputmode="numeric"
                placeholder="输入座位号..."
                :disabled="isBusy"
                @keyup.enter="updateSeat"
              />
              <button class="lib-submit-btn" :disabled="isBusy || !seatInput.trim()" @click="updateSeat">
                {{ actionLoading === 'seat' ? '更新中...' : '更新座位' }}
              </button>
            </div>
          </div>

          <div class="lib-action-row">
            <button class="lib-run-btn" :disabled="isBusy" @click="runOnce">
              {{ actionLoading === 'run' ? '启动中...' : '立即执行一次' }}
            </button>
            <button class="lib-secondary-btn" :disabled="isBusy" @click="fetchStatus(false)">
              {{ statusLoading ? '刷新中...' : '刷新状态' }}
            </button>
          </div>

          <div v-if="msg" class="lib-msg" :class="msgType">{{ msg }}</div>
        </section>

        <Teleport to="body">
          <div v-if="logModalOpen" class="log-modal-mask" @click.self="closeLogModal">
            <section class="log-modal" role="dialog" aria-modal="true" aria-labelledby="log-title">
              <div class="log-header">
                <div>
                  <div id="log-title" class="section-title">今日日志</div>
                  <p>{{ logDate }}，全部日志</p>
                </div>
                <div class="log-actions">
                  <button class="lib-secondary-btn compact" :disabled="isBusy" @click="fetchTodayLogs">
                    {{ actionLoading === 'logs' ? '刷新中...' : '刷新' }}
                  </button>
                  <button class="log-close-btn" type="button" aria-label="关闭日志弹窗" @click="closeLogModal">×</button>
                </div>
              </div>

              <pre v-if="logLines.length" class="log-box">{{ logLines.join('\n') }}</pre>
              <div v-else class="log-empty">
                {{ logsLoaded ? '今天暂无日志' : '正在加载日志...' }}
              </div>
            </section>
          </div>
        </Teleport>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lib-wrapper {
  min-height: calc(100vh - var(--vp-nav-height));
  background: var(--vp-c-bg);
  padding: 32px 16px;
}

.lib-shell {
  width: min(720px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lib-card {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.lib-loading {
  padding: 28px;
  color: var(--vp-c-text-2);
  text-align: center;
}

.lib-section-label {
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 700;
}

.lib-controls {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.section-title {
  color: var(--vp-c-text-1);
  font-size: 20px;
  font-weight: 750;
  line-height: 1.2;
}

.run-meta {
  margin-top: 8px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6;
}

.run-meta span {
  display: inline-flex;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.result-ok {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.result-warn {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.lib-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lib-toggle-btn,
.lib-submit-btn,
.lib-run-btn,
.lib-secondary-btn {
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s, border-color 0.2s, background 0.2s;
}

.lib-toggle-btn:hover:not(:disabled),
.lib-submit-btn:hover:not(:disabled),
.lib-run-btn:hover:not(:disabled),
.lib-secondary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.lib-toggle-btn:disabled,
.lib-submit-btn:disabled,
.lib-run-btn:disabled,
.lib-secondary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.lib-toggle-btn {
  width: 100%;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.lib-toggle-btn.enabled,
.lib-submit-btn,
.lib-run-btn {
  background: #047857;
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
}

.lib-input-row,
.lib-action-row {
  display: flex;
  gap: 10px;
}

.lib-input-row input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  outline: none;
}

.lib-input-row input:focus {
  border-color: #059669;
}

.lib-submit-btn,
.lib-run-btn,
.lib-secondary-btn {
  padding: 10px 16px;
}

.lib-run-btn,
.lib-secondary-btn {
  flex: 1;
}

.lib-secondary-btn {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.lib-secondary-btn.compact {
  flex: 0 0 auto;
}

.lib-msg {
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 12px;
  text-align: center;
}

.lib-msg.success {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.lib-msg.error {
  background: rgba(239, 68, 68, 0.12);
  color: var(--vp-c-danger);
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.log-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.log-header p {
  margin: 4px 0 0;
  color: var(--vp-c-text-3);
  font-size: 13px;
}

.log-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.46);
}

.log-modal {
  width: min(920px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  padding: 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: var(--vp-c-bg);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
}

.log-close-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.log-box {
  flex: 1;
  min-height: 280px;
  margin: 0;
  padding: 16px;
  overflow: auto;
  border-radius: 14px;
  background: #0f172a;
  color: #d1fae5;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.log-empty {
  padding: 28px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 14px;
  color: var(--vp-c-text-2);
  text-align: center;
}

@media (max-width: 720px) {
  .log-header,
  .log-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .lib-wrapper {
    padding: 16px 12px;
  }

  .lib-controls {
    padding: 18px;
  }

  .control-head {
    gap: 12px;
  }

  .lib-input-row,
  .lib-action-row {
    gap: 8px;
  }

  .lib-submit-btn,
  .lib-run-btn,
  .lib-secondary-btn {
    padding: 10px 12px;
    white-space: nowrap;
  }

  .log-modal-mask {
    align-items: flex-end;
    padding: 0;
  }

  .log-modal {
    width: 100%;
    max-height: 92vh;
    padding: 18px;
    border-right: none;
    border-bottom: none;
    border-left: none;
    border-radius: 18px 18px 0 0;
  }

  .log-actions {
    width: 100%;
    align-items: stretch;
  }

  .log-close-btn {
    position: absolute;
    top: 14px;
    right: 14px;
  }

  .log-box {
    min-height: 55vh;
    font-size: 11px;
  }
}
</style>
