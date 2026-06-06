---
date created: 2026-03-19 16:24:13
date modified: 2026-04-28 15:20:10
---
# 图书馆预约系统设计（FC + GitHub Actions）

## 背景

`Lysssyo/library-reservation` 是一个图书馆自动预约系统，通过阿里云函数计算（FC）定时触发，调用 GitHub Actions 执行 Playwright 自动化脚本完成预约。

---

## 整体架构

```
VitePress 页面（LibraryControl.vue）
↓ HTTP POST（JSON）
阿里云 FC HTTP 函数（library-reservation-ctrl）
├─ action: status   → 查询 timer/timer2 触发器状态 + 读取 GitHub Variable LIB_SEAT_ID
├─ action: toggle   → 同时开/关 timer 和 timer2 两个定时触发器
└─ action: set-seat → 更新 GitHub Variable LIB_SEAT_ID

timer / timer2（阿里云 FC 定时触发器）
↓ 定时触发
阿里云 FC 函数（library-trigger）
↓ HTTP POST（repository_dispatch）
GitHub Actions（Library Auto Reserve - Alibaba Cloud Triggered）
├─ 环境：ubuntu-latest + Python 3.9 + Playwright Chromium
├─ 重试策略：最多 3 次，间隔 60s，超时 15min
└─ 执行 refresh-all.py
   ├─ 登录图书馆账号（LIB_USER / LIB_PASS）
   ├─ 获取用户 accNo
   └─ 智能刷新预约逻辑（smart_refresh_logic）
      ├─ 跳过状态 8450（未来预约，不干预）
      ├─ 重新预约状态 8452（进行中预约）
      └─ 批量补全座位（目标座位 ID 来自 LIB_SEAT_ID）
```

`LIB_USER`, `LIB_PASS` 以及 `LIB_SEAT_ID` 都是 GitHub 仓库 `Lysssyo/library-reservation` 的 `Variable`

---

## 核心设计决策

### FC 定时器触发

> [!QUESTION] 
> GitHub Actions 支持定时触发，为什么不直接定时触发 GitHub Actions 而是定时触发`library-trigger`，由它去调用 GitHub Actions？

因为 GitHub Actions 延时非常大，例如设置东八区早上8点执行，可能到早上8点半才开始跑。

### FC 定时触发器管理

> [!QUESTION]
> 为什么要开多一个 FC 去控制 `library-trigger` 这个 FC 的定时器，而不是直接调用阿里云 FC 管理 API，直接在前端去控制定时器？

阿里云 FC 管理 API（如 `UpdateTrigger`、`GetTrigger`）是**服务端 API**，设计上不支持浏览器调用，原因有两点：

**1. CORS 限制（技术硬伤）**

阿里云 FC 管理 API 的域名（`*.fc.aliyuncs.com`）不返回 `Access-Control-Allow-Origin` 响应头，浏览器的同源策略会直接拦截请求，无论如何配置前端代码都无法绕过。

**2. 签名算法（安全硬伤）**

阿里云 API 每次请求都需要用 `AccessKey Secret` 做 HMAC-SHA256 签名。如果在前端执行签名，就必须把 AK/SK 写入 JavaScript bundle，任何打开 DevTools 的人都能读取，进而操控整个阿里云账号。

---

## FC 控制函数实现

- **函数名**：`library-reservation-ctrl`
- **运行时**：Python 3.x
- **触发器**：HTTP 触发器
- **入口**：`index.handler`

### Handler 签名

调试过程中发现阿里云 FC 的实际 handler 签名为 `def handler(event, context)`，`event` 是 `bytes` 类型。HTTP 请求的完整信息（method、headers、body）被封装为 JSON 后作为 bytes 传入：

```json
{
  "version": "v1",
  "rawPath": "/",
  "headers": { ... },
  "queryParameters": {},
  "body": "{\"action\": \"status\"}",
  "isBase64Encoded": false,
  "requestContext": {
    "http": {
      "method": "POST",
      ...
    }
  }
}
```

因此解析方式为：
```python
event_data = json.loads(event.decode('utf-8'))
method = event_data['requestContext']['http']['method']
body = json.loads(event_data['body'])
```

### 响应格式

```python
return {
    'statusCode': 200,
    'headers': { 'Access-Control-Allow-Origin': '*', ... },
    'body': json.dumps(result),
}
```

### 环境变量

| 变量名                               | 用途                                                                     |
| --------------------------------- | ---------------------------------------------------------------------- |
| `ALIBABA_CLOUD_ACCESS_KEY_ID`     | 阿里云 AK，用于调用 FC 管理 API                                                  |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 阿里云 SK                                                                 |
| `GITHUB_PAT`                      | GitHub Personal Access Token，需要目标仓库的 `repo` 权限（用于读写 Actions Variables） |

### 三个接口

**status**：查询当前状态
- 调用 `GetTrigger` 读取 `timer` 触发器的 `trigger_config`，解析 `enable` 字段
- 调用 GitHub API `GET /repos/{owner}/{repo}/actions/variables/LIB_SEAT_ID` 读取座位号
- 两个触发器（`timer`、`timer2`）状态一致，读一个即可

**toggle**：开/关触发器
- 循环对 `timer` 和 `timer2` 调用 `UpdateTrigger`，写入 `{"enable": true/false}`
- 两个触发器必须同时操作，保证状态一致

**set-seat**：更新座位号
- 调用 GitHub API `PATCH /repos/{owner}/{repo}/actions/variables/LIB_SEAT_ID`
- 成功返回 HTTP 204

---

## FC 触发函数实现

- **函数名**：`library-trigger`
- **运行时**：Python 3.x
- **触发器**：定时触发器（`timer`、`timer2`）
- **入口**：`index.handler`
- **职责**：接收定时器事件，调用 GitHub API 触发 `repository_dispatch`，从而启动 GitHub Actions 工作流

### 核心逻辑

1. 读取环境变量 `GH_OWNER`、`GH_REPO`、`GH_PAT`
2. 向 `https://api.github.com/repos/{owner}/{repo}/dispatches` 发送 POST 请求
3. 事件类型为 `fc-timer-trigger`，对应 GitHub Actions workflow 中的 `repository_dispatch.types`
4. GitHub 返回 `204 No Content` 表示触发成功
5. 内置重试机制：最多 3 次，每次间隔 2 秒

### 环境变量

| 变量名       | 用途                                       |
| ------------ | ------------------------------------------ |
| `GH_OWNER`   | GitHub 仓库所有者                          |
| `GH_REPO`    | GitHub 仓库名                              |
| `GH_PAT`     | GitHub Personal Access Token（需 repo 权限）|

### 实现代码

```python
def handler(event, context):
    logger = logging.getLogger()

    MAX_RETRIES = 3
    RETRY_DELAY = 2

    owner = os.environ.get('GH_OWNER')
    repo = os.environ.get('GH_REPO')
    token = os.environ.get('GH_PAT')

    if not all([owner, repo, token]):
        logger.error("环境变量缺失，请检查 GH_OWNER, GH_REPO, GH_PAT")
        return "Config Error"

    url = f"https://api.github.com/repos/{owner}/{repo}/dispatches"

    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"token {token}",
        "User-Agent": "Aliyun-FC-Timer"
    }

    payload = {
        "event_type": "fc-timer-trigger",
        "client_payload": {
            "from": "aliyun-fc-timer"
        }
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 204:
                logger.info(f"成功触发 GitHub Action！(尝试次数: {attempt})")
                return "Trigger Success"
            else:
                logger.warning(f"第 {attempt} 次请求失败，状态码: {resp.status_code}")
        except requests.exceptions.RequestException as e:
            logger.warning(f"第 {attempt} 次请求发生异常: {e}")

        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY)
        else:
            logger.error("已达到最大重试次数，触发失败。")
            return f"Failed after {MAX_RETRIES} attempts"
```

### 与 GitHub Actions 的对应关系

`library-trigger` 发出的 `event_type: "fc-timer-trigger"` 对应 workflow 中的：

```yaml
on:
  repository_dispatch:
    types: [fc-timer-trigger]
```

GitHub Actions 收到事件后，拉取代码、安装 Playwright、执行 `refresh-all.py`，内置 3 次重试（间隔 60s，超时 15min）。

---

## 踩坑记录

### 1. FC 依赖问题：`pip install` 不生效

在 FC 控制台终端执行 `pip install alibabacloud_fc20230330` 后，函数仍报 `ModuleNotFoundError`。原因是 FC 运行时环境与终端的 Python 环境是隔离的，`pip install` 安装到了终端的 site-packages，函数执行时找不到。

尝试 `pip install -t . alibabacloud_fc20230330` 把包安装到当前目录（与 `index.py` 同级），结果把大量包文件散落在函数根目录，难以清理。最终通过 FC 控制台的「层（Layer）」功能或内置依赖方式解决，并清空根目录重新部署。

### 2. Handler 签名错误：WSGI vs event/context

最初参考通用 Python HTTP 服务的写法，用了 WSGI 风格：

```python
def handler(environ, start_response):
    if environ.get('REQUEST_METHOD') == 'OPTIONS':
```

点击「测试函数」后报错：

```
'bytes' object has no attribute 'get'
```

原因是阿里云 FC 的入口**只支持** `def handler(event, context)`，`event` 是 `bytes`。点「测试函数」走的是事件触发接口，直接把 payload 作为 bytes 传入，`environ` 实际上是 bytes 对象，调 `.get()` 自然报错。

通过写一个调试版 handler 打印 event 的类型和内容，发现 HTTP 请求被封装成了如下 JSON bytes：

```json
{
  "version": "v1",
  "rawPath": "/",
  "headers": { ... },
  "body": "{\"action\": \"status\"}",
  "requestContext": {
    "http": { "method": "POST", ... }
  }
}
```

据此修正解析方式，正式代码改为：

```python
def handler(event, context):
    event_data = json.loads(event.decode('utf-8'))
    method = event_data['requestContext']['http']['method']
    body = json.loads(event_data['body'])
```

> 注意：「测试函数」按钮不适合测试 HTTP 触发函数，应通过 HTTP 触发器 URL 用 curl 或 Apifox 测试。
