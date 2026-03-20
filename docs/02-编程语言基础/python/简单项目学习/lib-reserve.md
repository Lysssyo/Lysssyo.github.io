# lib-reserve 项目学习笔记

> 项目功能：图书馆座位自动预约与状态刷新
> 项目地址：`https://github.com/Lysssyo/library-reservation`

**完整触发链：**
```
阿里云 FC 定时器
  → repository_dispatch 事件 (fc-timer-trigger)
    → GitHub Actions (reserve.yml)
      → python refresh-all.py
        → login() 获取凭据 → smart_refresh_logic() 执行预约
```

---

## 一、项目结构

```
gzhu-lib-reserve/
├── refresh-all.py          # 入口：登录 → 获取 ID → 执行预约逻辑
├── login.py                # Playwright 模拟登录，截获 token/cookie
├── utils.py                # 工具函数 + 核心预约状态机
├── config.py               # 配置类：环境变量、API 地址、预约参数
└── .github/workflows/
    └── reserve.yml         # GitHub Actions：安装 Playwright，运行脚本
```

---

## 二、配置类：config.py

```python
import os

class Config:
    # 类属性：直接定义在类上，所有实例共享，不需要实例化就能访问
    USER    = os.environ.get("LIB_USER")
    PASS    = os.environ.get("LIB_PASS")
    SEAT_ID = os.environ.get("LIB_SEAT_ID", "101267824")  # 有默认值

    MAX_HOURS    = 4      # 单段最大预约时长（小时）
    GAP_MINUTES  = 10     # 段与段之间的间隔（分钟）
    LIMIT_HOUR   = 21     # 最晚预约截止：21:45
    LIMIT_MINUTE = 45

    BASE_URL  = "https://libbooking.gzhu.edu.cn/ic-web"
    LOGIN_URL = "https://libbooking.gzhu.edu.cn/#/ic/home"

    @classmethod
    def validate(cls):
        """校验必要配置是否存在"""
        if not cls.USER or not cls.PASS:
            raise ValueError("未检测到 LIB_USER 或 LIB_PASS 环境变量。")
```

### `@classmethod`装饰器 与 `cls`

```python
@classmethod
def validate(cls):   # cls 代表"类本身"，类似实例方法里的 self
    if not cls.USER: ...
```

| | 普通方法 | `@classmethod` |
|---|---|---|
| 第一个参数 | `self`（实例） | `cls`（类本身） |
| 调用方式 | `obj.method()` | `Config.validate()`（无需实例化） |
| 典型用途 | 操作实例状态 | 工厂方法、校验类级别配置 |

`Config` 在这里当作**配置命名空间**使用，从不实例化，所有属性和方法都通过类名直接访问。

### `raise ValueError` vs `sys.exit()`

```python
raise ValueError("错误信息")   # 抛出异常，调用方可以用 try/except 捕获并处理
sys.exit(1)                    # 直接终止进程，调用方无法捕获
```

`Config.validate()` 用 `raise`，让 `refresh-all.py` 的 `main()` 用 `try/except` 捕获后优雅打印并 `return`，而非强制终止整个进程。

---

## 三、入口：refresh-all.py

```python
def main():
    try:
        Config.validate()           # 校验环境变量，缺失则抛 ValueError
    except ValueError as e:
        print(e)
        return                      # 优雅退出，不崩溃

    # 1. Playwright 模拟登录，获取三个凭据
    jsid, ic, token = get_library_credentials(Config.USER, Config.PASS)
    if not (jsid and ic and token):  # 任意一个为空则失败
        print("登录失败，流程终止。")
        return

    # 2. 用 cookie 调 API 获取用户账号 ID
    accNo = get_acc_no(jsid, ic)

    # 3. 核心状态机：判断场景并执行对应预约动作
    smart_refresh_logic(jsid, ic, token, accNo)

if __name__ == "__main__":
    main()
```

登录成功后拿到三个凭据，后续所有 API 请求都靠这三个东西鉴权：
- `JSESSIONID`：服务器 Session 标识（Cookie）
- `ic-cookie`：图书馆系统自定义 Cookie
- `token`：JWT 风格的请求头 Token

---

## 四、浏览器自动化：login.py

### Playwright 是什么

Playwright 是微软开发的浏览器自动化库，可以**真正驱动一个浏览器**完成登录、点击、填表等操作。对于有 JS 动态渲染、验证码、SSO 跳转的网站，`requests` 无法处理，必须用 Playwright。

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)  # headless=True：无界面模式（CI 必须）
    context = browser.new_context(
        ignore_https_errors=True,
        user_agent="Mozilla/5.0 ..."
    )
    page = context.new_page()
```

`sync_playwright()` 是同步 API 的上下文管理器，负责启动/关闭 Playwright 进程。

### 网络拦截：在响应中截获 Token

```python
captured_token = None          # 外层变量，用于跨函数传值

def handle_response(response):
    nonlocal captured_token    # 声明修改的是外层的 captured_token，而非创建新的局部变量
    if "ic-web/auth/userInfo" in response.url and response.status == 200:
        data = response.json()
        captured_token = data.get("data", {}).get("token")

page.on("response", handle_response)   # 注册监听器：每次收到网络响应都调用此函数
```

**`nonlocal` 关键字：**
- 嵌套函数（内层函数）直接赋值外层变量时，Python 默认认为是创建了一个**新的局部变量**。
- `nonlocal captured_token` 明确告诉 Python："我要修改的是外层作用域里那个 `captured_token`"。
- 对比：`global` 修改全局变量；`nonlocal` 修改上一层（但非全局）的变量。

**`page.on("response", handle_response)`：**
- 事件监听器。每当页面收到任何 HTTP 响应，都会自动调用 `handle_response`。
- 这是**回调函数（Callback）** 模式：把函数本身作为参数传给另一个函数，由它在合适的时机调用。

### 登录流程

```python
page.goto(Config.LOGIN_URL, wait_until="networkidle")  # 打开页面，等到网络静止

# 检查是否自动跳转到 CAS
if "newcas.gzhu.edu.cn" not in page.url:
    page.wait_for_selector("text=登录", timeout=5000)  # 等待"登录"文字出现
    page.click("text=登录")                             # 点击

page.wait_for_url("**/cas/login**", timeout=20000)     # 等待 URL 变成 CAS 登录页

page.fill("#un", username)   # 填入学号（CSS 选择器 #un 定位输入框）
page.fill("#pd", password)
page.click("#index_login_btn")

# 等待跳回图书馆系统（URL 含 libbooking 且不含 errorMsg）
page.wait_for_url(lambda url: "libbooking.gzhu.edu.cn" in url and "errorMsg" not in url, timeout=30000)
```

**`wait_for_url` 传 lambda：**

`lambda url: ...` 是匿名函数，这里用于传入一个**判断条件**而非固定字符串，当 URL 满足条件时等待结束。

### 三个凭据是什么、怎么拿、怎么用

图书馆系统是 **Java Web + 前端 SPA + REST API** 的混合架构，每层有自己的身份标识：

```
浏览器                       服务器
  │── Cookie: JSESSIONID ──▶ Java Tomcat 会话层（识别"你是哪个 Session"）
  │── Cookie: ic-cookie  ──▶ 智慧图书馆前端层（ic 系统自己的状态标识）
  └── Header: token      ──▶ /ic-web/* REST API 层（接口级鉴权）
```

三层都通过，服务器才返回数据。

**JSESSIONID 和 ic-cookie** —— 登录成功后浏览器自动存入 Cookie，从浏览器上下文直接读取：

```python
cookies = context.cookies()
# 每个 cookie 是个字典：{"name": "JSESSIONID", "value": "ABC123", "domain": "..."}

jsessionid = next((c["value"] for c in cookies if c["name"] == "JSESSIONID"), "")
#            ↑ 生成器表达式：遍历 cookies，找到名字是 JSESSIONID 的，取其 value
#            next(..., "") ：取第一个结果，找不到则返回空字符串
ic_cookie  = next((c["value"] for c in cookies if c["name"] == "ic-cookie"), "")
```

**token** —— 藏在登录后某个 API 响应的 JSON 体里，不是 Cookie，需要主动截获。代码用两道保险：

```python
# 第一道：网络拦截（主路径）——在导航开始之前注册，"飞行途中"截获
page.on("response", handle_response)

def handle_response(response):
    nonlocal captured_token
    if "ic-web/auth/userInfo" in response.url and response.status == 200:
        data = response.json()
        captured_token = data.get("data", {}).get("token")
        # 登录成功后前端自动请求 /auth/userInfo，响应 JSON 里就带着 token

# 第二道：读 localStorage（兜底）——前端 JS 也会把 token 存进去
if not captured_token:
    captured_token = page.evaluate("window.localStorage.getItem('token')")
    # page.evaluate() 在浏览器里执行这段 JS 并把结果返回给 Python
```

拦截器比 localStorage 更早拿到 token（请求刚回来就截了），但万一时序问题没截到，兜底方案从 localStorage 补取。

**三个凭据的使用方式：**

```python
headers = {
    "Cookie": f"JSESSIONID={jsid}; ic-cookie={ic}",  # 两个 cookie 放 Cookie 请求头
    "token": token,        # token 放自定义请求头（不是 Authorization，是图书馆系统自定义的）
    "User-Agent": "...",
}
requests.get(url, headers=headers)   # 后续所有 API 请求都带这个 headers
```

**为什么不直接用账号密码请求 API：**

图书馆用的是学校 **CAS 统一认证**（单点登录），登录流程涉及多次重定向、动态 JS 渲染，纯 `requests` 无法模拟。Playwright 驱动真实浏览器走完 SSO 流程，把"认证成功的状态"提取出来交给 `requests` 使用——借浏览器登录，借 `requests` 操作 API。

**`next(generator, default)`：**

在生成器/迭代器里取第一个满足条件的元素，找不到时返回默认值，避免 `StopIteration` 报错。

### `finally` 块

```python
try:
    # 主流程
    ...
    return jsessionid, ic_cookie, captured_token
except Exception as e:
    print(f"[Fatal Error] {e}")
    return None, None, None
finally:
    browser.close()   # 无论成功还是失败，浏览器一定会被关闭
```

`finally` 块中的代码**无论如何都会执行**，即使 `try` 里有 `return`，也会先执行 `finally` 再返回。适合用于释放资源（关闭浏览器、文件、数据库连接）。

---

## 五、工具函数与核心逻辑：utils.py

### 时区处理

```python
from datetime import datetime, timedelta, timezone

SHA_TZ = timezone(timedelta(hours=8))   # 定义北京时间 UTC+8

def get_now_beijing():
    mock_now = os.environ.get("MOCK_NOW")
    if mock_now:
        # 用于调试：通过环境变量模拟任意时间点
        return datetime.strptime(mock_now, "%Y-%m-%d %H:%M:%S")
    return datetime.now(SHA_TZ).replace(tzinfo=None)
    #                           ↑ 去掉时区信息，得到"朴素 datetime"，方便后续直接加减
```

**为什么要处理时区：** GitHub Actions 运行在海外 Ubuntu 服务器，系统时区是 UTC。若不强制指定北京时间，计算出的"现在是几点"会差 8 小时，导致预约时间错误。

**`datetime.strptime(str, format)`：** 将字符串按格式解析为 `datetime` 对象。
**`datetime.strftime(format)`：** 将 `datetime` 对象格式化为字符串（方向相反）。

### `timedelta`：时间加减

```python
from datetime import timedelta

current_end = current_start + timedelta(hours=4) - timedelta(minutes=10)
# timedelta 代表一段时间长度，支持 days/hours/minutes/seconds
# datetime + timedelta = 新的 datetime（时间点平移）
```

### 时间戳解析

```python
def parse_lib_time(val):
    if isinstance(val, (int, float)):          # 如果是数字，当作时间戳处理
        ts = val / 1000 if val > 1e11 else val # 毫秒级时间戳（13位）转秒级（10位）
        return datetime.fromtimestamp(ts, SHA_TZ).replace(tzinfo=None)
    else:
        return datetime.strptime(val, "%Y-%m-%d %H:%M:%S")  # 字符串直接解析
```

**`isinstance(val, (int, float))`：** 检查变量是否属于某个类型（或类型元组中的任意一个）。

### 预约状态机：三种场景

图书馆 API 返回两种状态码：

- `8450`：未来预约（已预约但还没到时间）
- `8452`：进行中预约（当前正在使用）

```python
def smart_refresh_logic(jsid, ic, token, accNo):
    r8450 = get_reservations(..., "8450")   # 查未来预约列表
    r8452 = get_reservations(..., "8452")   # 查进行中预约列表

    if not r8450 and not r8452:
        # 场景 1：冷启动，没有任何预约，从现在开始铺满全天
        ...
    elif not r8452 and r8450:
        # 场景 2：静默期，当前无座但未来有预约（处于 10 分钟 Gap 中）
        # 如果空档 >= 1 小时则补全，否则静默等待
        ...
    elif r8452:
        # 场景 3：刷新进行中预约（Keep-alive）
        # 若未签到（status != 1093）：提前结束 + 立即重新预约到原结束时间
        # 若已签到（status == 1093）：跳过，不干扰
        ...
```

**场景 1 的分段循环：**
```python
while current_start < limit_time:                             # 循环直到 21:45
    current_end = current_start + timedelta(hours=MAX_HOURS) - timedelta(minutes=GAP_MINUTES)
    if current_end > limit_time: current_end = limit_time    # 不超过截止时间

    if reserve_action(..., current_start, current_end):
        current_start = current_end + timedelta(minutes=GAP_MINUTES)  # 推进起点
    else:
        break                                                 # 预约失败则停止
    time.sleep(1)                                             # 避免请求过快
```

**场景 3 的刷新逻辑（Keep-alive）：**
```python
for res in r8452:
    if status_code == 1093:   # 已签到，跳过
        continue

    # 1. 记录原结束时间
    old_end_dt = parse_lib_time(res.get("resvEndTime"))

    # 2. 提前结束当前预约
    requests.post(end_url, headers=headers, data=json.dumps({"uuid": uuid}))
    time.sleep(1)

    # 3. 立即从现在重新预约到原结束时间
    new_start = get_corrected_start_time(get_now_beijing())
    reserve_action(..., new_start, old_end_dt)
```

这个"提前结束 + 立即重约"的操作目的是**重置预约计时器**，防止长时间未签到被系统判定为违规失效。

### API 请求：`data=json.dumps(payload)` vs `json=payload`

```python
# 写法 1（utils.py 中的用法）
requests.post(url, headers=headers, data=json.dumps(payload))
# data= 传字符串，需要手动序列化，且需要手动在 headers 里设置 Content-Type

# 写法 2（更简洁）
requests.post(url, headers=headers, json=payload)
# json= 自动序列化 + 自动设置 Content-Type: application/json
```

两者效果相同，`json=` 更简洁；`data=json.dumps()` 在需要精确控制请求体格式时使用。