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

onMounted(() => fetchStatus(true))
</script>

<template>
  <div class="lib-wrapper">
    <div class="lib-shell">
      <section class="lib-card hero-card">
        <div>
          <div class="lib-eyebrow">Library Automation</div>
          <h2>图书馆预约控制台</h2>
          <p class="lib-subtext">连接 lib.zl6544hx.asia，管理自动预约、座位和运行日志。</p>
        </div>
        <button class="lib-secondary-btn" :disabled="isBusy" @click="fetchStatus(false)">
          {{ statusLoading ? '刷新中...' : '刷新状态' }}
        </button>
      </section>

      <div v-if="statusLoading" class="lib-card lib-loading">加载中...</div>

      <template v-else>
        <section class="lib-grid">
          <div class="lib-card stat-card">
            <span class="stat-label">自动预约</span>
            <strong :class="triggerEnabled ? 'text-ok' : 'text-muted'">
              {{ triggerEnabled ? '已开启' : '已关闭' }}
            </strong>
          </div>
          <div class="lib-card stat-card">
            <span class="stat-label">当前座位</span>
            <strong>{{ seatId || '未设置' }}</strong>
            <small v-if="rawSeatId">内部 ID：{{ rawSeatId }}</small>
          </div>
          <div class="lib-card stat-card">
            <span class="stat-label">最近运行</span>
            <strong>{{ lastRunAt || '暂无记录' }}</strong>
            <small>{{ lastResult || '无结果' }}</small>
          </div>
        </section>

        <section class="lib-card lib-controls">
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
            <button class="lib-secondary-btn" :disabled="isBusy" @click="fetchTodayLogs">
              {{ actionLoading === 'logs' ? '加载中...' : '查看今日日志' }}
            </button>
          </div>

          <div v-if="msg" class="lib-msg" :class="msgType">{{ msg }}</div>
        </section>

        <section class="lib-card log-card">
          <div class="log-header">
            <div>
              <div class="lib-section-label">今日日志</div>
              <p>{{ logDate }}，全部日志</p>
            </div>
            <button class="lib-secondary-btn compact" :disabled="isBusy" @click="fetchTodayLogs">刷新日志</button>
          </div>

          <pre v-if="logLines.length" class="log-box">{{ logLines.join('\n') }}</pre>
          <div v-else class="log-empty">
            {{ logsLoaded ? '今天暂无日志' : '点击“查看今日日志”加载当天全部日志' }}
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lib-wrapper {
  min-height: calc(100vh - var(--vp-nav-height));
  background:
    radial-gradient(circle at top left, rgba(16, 185, 129, 0.16), transparent 34rem),
    linear-gradient(135deg, var(--vp-c-bg) 0%, var(--vp-c-bg-soft) 100%);
  padding: 48px 16px;
}

.lib-shell {
  width: min(960px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.lib-card {
  background: color-mix(in srgb, var(--vp-c-bg) 92%, transparent);
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.08);
}

.hero-card {
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.lib-eyebrow {
  color: #059669;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.hero-card h2 {
  margin: 0 0 8px;
  font-size: 28px;
  line-height: 1.2;
}

.lib-subtext {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.lib-loading {
  padding: 28px;
  color: var(--vp-c-text-2);
  text-align: center;
}

.lib-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.stat-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label,
.lib-section-label {
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 700;
}

.stat-card strong {
  color: var(--vp-c-text-1);
  font-size: 20px;
  word-break: break-word;
}

.stat-card small {
  color: var(--vp-c-text-3);
  word-break: break-word;
}

.text-ok {
  color: #059669 !important;
}

.text-muted {
  color: var(--vp-c-text-2) !important;
}

.lib-controls {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 22px;
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

.log-card {
  padding: 24px;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.log-header p {
  margin: 4px 0 0;
  color: var(--vp-c-text-3);
  font-size: 13px;
}

.log-box {
  max-height: 460px;
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
  .hero-card,
  .log-header,
  .lib-input-row,
  .lib-action-row {
    flex-direction: column;
    align-items: stretch;
  }

  .lib-grid {
    grid-template-columns: 1fr;
  }
}
</style>
