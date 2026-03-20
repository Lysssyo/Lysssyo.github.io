# daily-smart-brief 项目学习笔记

> 项目地址：https://github.com/Lysssyo/daily-smart-brief
> 项目功能：自动化简报系统（抓取数据 → AI 分析 → 模板渲染 → 邮件发布）

**完整触发链：**
```
阿里云 FC 定时器
  → fc.py handler（发送 repository_dispatch 事件）
    → GitHub API
      → GitHub Actions workflow
        → python main.py --type xxx
          → Pipeline.run()
```

---

## 一、项目结构总览

```
daily-smart-brief/
├── fc.py                          # 阿里云 FC 入口：定时触发，向 GitHub 发送 dispatch 事件
├── main.py                        # GitHub Actions 入口：解析命令行参数，调度流水线
├── app_config.json                # 应用配置（模型名称、邮件主题、发件人等）
├── .env                           # 本地敏感配置（API Key、代理设置，不提交 git）
├── core/
│   ├── config.py                  # 配置中心：加载 .env、代理、API Key
│   ├── utils.py                   # 工具函数：读取文本文件
│   └── renderer.py                # 渲染与发布
├── pipelines/
│   ├── base.py                    # 抽象基类 BasePipeline
│   ├── github_brief.py            # GitHub Trending + HN 流水线
│   └── macro_brief.py             # 宏观资讯流水线
└── assets/
    ├── prompts/                   # LLM 系统提示词（.md 文件）
    └── templates/                 # 邮件模板（.mjml 文件）
```

### 数据流

```
fetch_data()  ->  preprocess_data()  ->  analyze_with_gemini()  ->  run() 渲染发布
   (抓取)            (清洗合并)              (LLM 分析 -> JSON)       (模板 -> 邮件)
```

---

## 二、入口：main.py

```python
import argparse, sys, os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))  # 确保当前目录在 Python 路径中

def main():
    # 1. 定义支持的管线
    pipelines = {
        "github": GitHubBriefPipeline,
        "macro":  MacroBriefPipeline
    }

    # 2. 解析命令行参数
    parser = argparse.ArgumentParser(description="Daily Smart Brief - 智能日报生成器")
    parser.add_argument(
        "--type",
        type=str,
        choices=list(pipelines.keys()) + ["all"],
        default="all",
        help="指定要生成的日报类型: github, macro, 或 all (默认)"
    )
    args = parser.parse_args()

    # 3. 确定要运行的任务
    tasks_to_run = []
    if args.type == "all":
        tasks_to_run = list(pipelines.values())   # 取出所有 Pipeline 类
    else:
        tasks_to_run = [pipelines[args.type]]     # 只取指定的那个

    # 4. 依次执行
    for PipelineClass in tasks_to_run:
        try:
            pipeline = PipelineClass()            # 实例化
            pipeline.run()                        # 调用抽象方法
        except Exception as e:
            print(f"失败: {PipelineClass.__name__} 遇到错误: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
```

**要点：**

**`argparse` 三行拆解：**

```python
# 第一行：创建"解析器"对象，description 是 --help 时显示的说明文字
parser = argparse.ArgumentParser(description="Daily Smart Brief - 智能日报生成器")

# 第二行：向解析器注册一个参数 --type
parser.add_argument(
    "--type",                                      # 参数名，命令行中写 --type xxx
    type=str,                                      # 接收的值会被转换为 str 类型
    choices=list(pipelines.keys()) + ["all"],      # 合法值白名单：["github", "macro", "all"]
    default="all",                                 # 不传 --type 时的默认值
    help="指定要生成的日报类型"                     # --help 时显示的说明
)

# 第三行：真正去读取命令行，返回一个命名空间对象
args = parser.parse_args()
# 之后通过 args.type 取值，例如执行 python main.py --type github 时，args.type == "github"
```


**其他要点：**
- `if __name__ == "__main__"`：只有直接运行该文件时才执行，被其他文件 `import` 时不执行。
- `PipelineClass.__name__`：获取类的名字字符串，如 `"GitHubBriefPipeline"`，用于打印日志。
- `sys.path.append(...)`：把项目根目录加入模块搜索路径，确保 `from pipelines.xxx import ...` 能找到正确位置。

---

## 三、抽象基类：pipelines/base.py

```python
from abc import ABC, abstractmethod

class BasePipeline(ABC):
    @abstractmethod
    def run(self):
        """执行管线以生成并发布简报。"""
        pass
```

**要点：**
- `ABC`（Abstract Base Class）：只定义规范/接口，不负责存储状态，不能直接实例化。
- `@abstractmethod`：**立规矩**。强制所有子类必须实现 `run()` 方法，否则实例化时报错。
- `pass`：空操作占位符。语法要求有代码块但逻辑上无需操作时使用。
- 抽象类中无 `__init__`，因为不存储任何状态；具体属性定义在子类的 `__init__` 里。

---

## 四、配置中心：core/config.py

```python
import os, sys, json
from dotenv import load_dotenv

# 顶层代码：import 时自动执行
load_dotenv()                          # 从 .env 文件读取环境变量注入 os.environ

# 代理：通过 .env 的 USE_PROXY=true 开关
if os.environ.get("USE_PROXY") == "true":
    proxy_url = os.environ.get("PROXY_URL", "http://127.0.0.1:7897")
    os.environ["HTTP_PROXY"]  = proxy_url
    os.environ["HTTPS_PROXY"] = proxy_url

def get_env_variable(key, required=True):
    value = os.environ.get(key)
    if required and not value:
        sys.exit(1)
    return value

def load_app_settings():
    with open("app_config.json", 'r', encoding='utf-8') as f:
        return json.load(f)

GEMINI_API_KEY = get_env_variable("GEMINI_API_KEY", required=False)
APP_SETTINGS   = load_app_settings()
```

### 模块导入的执行机制

当 Python 第一次 `import` 一个模块时，会从上到下执行该文件所有**顶层代码**（不在函数/类里的代码）。因此 `from core.config import GEMINI_API_KEY` 会自动触发 `load_dotenv()` 和代理设置。

**单例缓存**：Python 缓存已导入的模块，多个文件重复导入同一模块，初始化逻辑只执行一次。

### 环境变量与 .env 安全模式

```
# .env 文件（不提交 git）
GEMINI_API_KEY=your_key_here
USE_PROXY=true
PROXY_URL=http://127.0.0.1:7897
```

- `os.environ.get('KEY')`：安全读取，键不存在时返回 `None` 而非报错。
- `config.py` 作为**配置中转站**，其他业务文件只需 `from core.config import XXX`。

---

## 五、核心流水线：pipelines/github_brief.py

### 5.1 类定义与初始化

```python
class GitHubBriefPipeline(BasePipeline):
    def __init__(self):
        self.renderer      = Renderer()
        self.prompt_path   = os.path.join("assets", "prompts", "github_prompt.md")
        self.template_path = os.path.join("assets", "templates", "github.mjml")
        self.config        = APP_SETTINGS.get("github", {})
```

- `self`：代表"当前实例对象"，在类方法中用于访问/设置对象自身的属性。
- 子类 `__init__` 负责初始化所有状态，抽象基类不参与。

### 5.2 fetch_data()：网络请求

```python
def fetch_data(self):
    headers = {"User-Agent": "Mozilla/5.0 ..."}  # 模拟浏览器，防止被拒绝
    try:
        gh_resp = requests.get(gh_url, headers=headers, timeout=10)
        gh_html = gh_resp.text
    except Exception as e:
        print(f"GitHub 请求失败: {e}")
        gh_html = ""
```

**具名参数（Keyword Arguments）的意义：**
- **可读性**：`headers=headers, timeout=10` 一眼明白每个值的含义（显式优于隐式）。
- **跳选可选参数**：`requests.get` 支持几十个参数，只传需要的几个，其余保持默认。
- **顺序无关**：只要指明参数名，传递顺序不影响结果。

**`requests` 常用参数：**

| 参数 | 说明 |
|------|------|
| `url` | 目标地址 |
| `params` | URL 查询字符串参数 |
| `headers` | HTTP 请求头（伪装身份） |
| `timeout` | 超时秒数 |
| `verify` | 是否验证 SSL 证书 |
| `auth` | 接口鉴权信息 |

### 5.3 preprocess_data()：正则解析

```python
def preprocess_data(self, gh_html: str, hn_json: str) -> str:
    pattern_block = r'<article class="Box-row">([\s\S]*?)<\/article>'
    pattern_name  = r'<h2 class="h3 lh-condensed">[\s\S]*?href="\/([^\"]+)"'
    pattern_stars = r'(\d+|[\d,]+) stars today'

    articles = re.findall(pattern_block, gh_html)   # 找所有区块 -> 列表
    for article in articles:
        name_match = re.search(pattern_name, article)  # 在区块内精准提取 -> 匹配对象
        if not name_match: continue
        name = name_match.group(1).strip()
```

**类型提示（Type Hints）：**
```python
def preprocess_data(self, gh_html: str, hn_json: str) -> str:
#                           参数类型提示                  返回值类型提示
```
Python 是动态语言，类型提示**不强制执行**，仅用于提高可读性和 IDE 智能补全，不影响运行时行为。

**原始字符串 `r'...'`：**
- 反斜杠 `\` 不再作为 Python 的转义符，专门交给正则引擎处理。
- 写正则表达式时几乎是标配：`r'\d+'` 而非 `'\\d+'`。

**正则转义符：**
- `\/`：匹配字符 `/`（让有"魔力"的符号回归原义）
- `\.`：匹配字符 `.`
- `[\s\S]*?`：匹配包括换行在内的任意字符（非贪婪）

**`re.findall` vs `re.search`：**

| | `re.findall` | `re.search` |
|---|---|---|
| 目标 | 找**所有**匹配 | 找**第一个**匹配 |
| 返回值 | 字符串列表 `List` | 匹配对象（没找到返回 `None`） |
| 取值方式 | 直接遍历列表 | 必须调用 `.group(1)` |
| 典型场景 | 把大网页切成多个区块 | 在已定位的区块内提取字段 |

**非贪婪匹配 `*?`：** 尽可能少匹配内容，HTML 解析中用于"遇到第一个结束标签就停下"。

**JSON 处理与字典安全取值：**
```python
data_json = json.loads(hn_json)       # Load String：JSON 字符串 -> Python 字典/列表
hits      = data_json.get('hits', []) # 安全取值：键不存在时返回 []，不报 KeyError
title     = hit.get('title', '无标题')
```
- `json.loads()`：从**字符串**解析；`json.load()`：从**文件对象**解析。
- `dict.get('key', default)`：键不存在时返回默认值，避免 `KeyError` 崩溃。

**真值测试（Truth Value Testing）：**
```python
if not url: continue           # 等价于 if url == "" or url is None: continue
if not hn_json: hn_json = "{}"
```
被视为"假（Falsy）"的值：`None`、`False`、`0`、`""`、`[]`、`{}`。
`if not x` 是 Pythonic 写法，用于检查数据是否为空/无效。

### 5.4 analyze_with_gemini()：调用 LLM

```python
def analyze_with_gemini(self, raw_text: str):
    client_genai  = genai.Client(api_key=GEMINI_API_KEY)
    prompt_content = load_text_file(self.prompt_path)    # 读取提示词文件
    model_name    = self.config.get("model", "gemini-2.0-flash-exp")

    response = client_genai.models.generate_content(
        model=model_name,
        contents=f"以下是今日抓取的技术热榜数据，请分析：\n\n{raw_text}",
        config=types.GenerateContentConfig(
            system_instruction=prompt_content,
            response_mime_type="application/json",
            temperature=0.7
        )
    )
    return response.text
```

### 5.5 run()：JSON 清洗与组装

```python
def run(self):
    gh_data, hn_data = self.fetch_data()
    raw_input = self.preprocess_data(gh_data, hn_data)
    json_str  = self.analyze_with_gemini(raw_input)

    # AI 可能返回带 Markdown 代码块的 JSON，需清洗
    clean_json_str = json_str.strip()             # 去除首尾空白
    if clean_json_str.startswith("```json"):
        clean_json_str = clean_json_str[7:]       # 切片：跳过前 7 个字符
    if clean_json_str.endswith("```"):
        clean_json_str = clean_json_str[:-3]      # 切片：去掉最后 3 个字符

    data = json.loads(clean_json_str.strip())
```

**字符串处理方法：**
- `strip()`：去除首尾所有空白字符（空格、换行等）
- `startswith()` / `endswith()`：检查字符串开头/结尾
- 字符串切片 `[start:end]`：`[7:]` = 从索引 7 到末尾；`[:-3]` = 到倒数第 3 个字符前

**防御性解析的必要性：** AI 返回内容具有不确定性，直接 `json.loads()` 可能因 Markdown 语法符号导致解析失败，必须先清洗。

---

## 六、工具函数：core/utils.py

```python
def load_text_file(filepath):
    """读取文本文件并返回其内容。"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()    # 一次性读取全部内容为字符串
    except Exception as e:
        print(f"错误: 无法读取文件 {filepath}: {e}")
        sys.exit(1)
```

- `prompt_path` 是路径字符串（地图）；`prompt_content` 是读取后的实际文字（宝藏）。
- 用 `with open` 而非手动 `f.close()`，防止异常时文件未关闭。

---

## 八、网络相关

### 代理配置

Python 网络库（`requests`、`urllib3`）默认读取 `HTTP_PROXY` 和 `HTTPS_PROXY` 环境变量。

```python
os.environ["HTTPS_PROXY"] = "http://127.0.0.1:7897"  # 在代码内临时开启
```

最佳实践：存入 `.env`，在 `config.py` 统一注入，实现一键开关。

```
# .env
USE_PROXY=true  
PROXY_URL=http://127.0.0.1:7897
```

```python
# config.py
from dotenv import load_dotenv

load_dotenv()

if os.environ.get("USE_PROXY") == "true"
	proxy_url = os.environ.get("PROXY_URL","http://127.0.0.1:7897")
	os.environ["HTTP_PROXY"] = proxy_url
	os.environ["HTTPS_PROXY"] = proxy_url
```

---

## 九、定时触发器：fc.py（阿里云函数计算）

### 角色定位

`fc.py` 运行在**阿里云函数计算（Function Compute）** 上，配置了定时触发器（如每天早上 8 点）。它本身不做任何数据处理，只做一件事：**通知 GitHub 去跑流水线**。

```
阿里云 FC 定时器 → GitHub repository_dispatch API → GitHub Actions → main.py
```

### 完整代码解析

```python
def handler(event, context):         # FC 规定的函数签名，event/context 由平台注入
    logger = logging.getLogger()     # 使用 logging 而非 print，日志会被 FC 平台收集

    MAX_RETRIES = 3
    RETRY_DELAY = 2

    # 从 FC 平台的环境变量读取敏感配置（不硬编码在代码里）
    owner = os.environ.get('GH_OWNER')   # GitHub 用户名/组织名
    repo  = os.environ.get('GH_REPO')   # 仓库名
    token = os.environ.get('GH_PAT')    # GitHub Personal Access Token

    if not all([owner, repo, token]):    # all() 全部为真才为真，有一个空就报错返回
        logger.error("环境变量缺失")
        return "Config Error"

    url = f"https://api.github.com/repos/{owner}/{repo}/dispatches"

    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"token {token}",   # GitHub API 鉴权
        "User-Agent": "Aliyun-FC-Timer"
    }

    payload = {
        "event_type": "fc-timer-trigger",    # GitHub Actions workflow 监听的事件名
        "client_payload": {
            "from": "aliyun-fc-timer",
            "task_type": "tech"              # 传给 workflow 的自定义参数
        }
    }

    # 重试循环
    for attempt in range(1, MAX_RETRIES + 1):   # range(1, 4) -> 1, 2, 3
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)

            if resp.status_code == 204:      # GitHub dispatch 成功返回 204 No Content（无响应体）
                logger.info(f"成功触发 GitHub Action！(尝试次数: {attempt})")
                return "Trigger Success"
            else:
                logger.warning(f"第 {attempt} 次失败，状态码: {resp.status_code}")

        except requests.exceptions.RequestException as e:   # 只捕获网络相关异常
            logger.warning(f"第 {attempt} 次异常: {e}")

        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY)          # 等待 2 秒再重试
        else:
            logger.error("已达最大重试次数")
            return f"Failed after {MAX_RETRIES} attempts"
```

### 关键概念

**`handler(event, context)` 函数签名：**

阿里云 FC 的规定入口格式，类似 AWS Lambda 的 `handler`。平台调用时会自动传入 `event`（触发事件数据）和 `context`（运行时上下文），即使用不到也必须声明。

**`logging` vs `print`：**

FC 平台会自动收集 `logging` 的输出到日志服务，方便排查问题；`print` 在某些云环境下可能丢失。

**`all([owner, repo, token])`：**

`all()` 接收一个可迭代对象，全部元素为真时返回 `True`，有任意一个 Falsy（`None`、`""`）就返回 `False`。比逐个 `if not owner` 判断更简洁。

**HTTP 204 No Content：**

GitHub 的 `repository_dispatch` API 触发成功时返回 204，表示"已收到，无需返回数据"。不能用 `resp.ok`（200-299 都算 ok），要精确判断 204。

**`requests.post(..., json=payload)`：**

`json=` 参数会自动把字典序列化为 JSON 字符串，并设置 `Content-Type: application/json` 请求头，无需手动 `json.dumps()`。

**重试逻辑的设计：**

`range(1, MAX_RETRIES + 1)` 从 1 开始计数（方便日志显示"第 1 次"），最后一次失败时不再 `sleep` 直接返回错误，避免无意义等待。

**`requests.exceptions.RequestException`：**

只捕获网络相关的异常（连接失败、超时等），而非所有 `Exception`。精准捕获使其他意外错误（如编程错误）能正常向上抛出，便于排查。

---

## 十、GitHub Actions Workflow

`.github/workflows/daily_run.yml`

```yaml
name: Daily Smart Brief  
on:  
  repository_dispatch:  
    types: [fc-timer-trigger]  
  workflow_dispatch:
```

### `repository_dispatch` 是什么

`repository_dispatch` 是 GitHub Actions 专门为**外部系统远程触发**设计的事件类型。

- 只有通过 `POST https://api.github.com/repos/{owner}/{repo}/dispatches` 这个 API 才能激活它。
- 普通的 push、PR、定时 cron 等事件**不会**触发它。
- 相当于 GitHub 给外部系统开了一扇"专用后门"：你发暗号（event_type），我开门（运行 workflow）。

### workflow 文件解析

```yaml
name: Daily Smart Brief

on:
  repository_dispatch:
    types: [fc-timer-trigger]   # 只响应 event_type == "fc-timer-trigger" 的 dispatch
  workflow_dispatch:            # 额外允许在 GitHub 网页上手动点按钮触发（方便调试）

jobs:
  run-report:
    runs-on: ubuntu-latest      # 在 GitHub 提供的 Ubuntu 虚拟机上运行
    steps:
      - uses: actions/checkout@v3          # 拉取仓库代码到虚拟机
      - uses: actions/setup-python@v4      # 安装 Python 3.10
        with:
          python-version: '3.10'
      - run: pip install -r requirements.txt  # 安装依赖

      # Task 1: GitHub Brief
      - name: Run GitHub Brief (Retry on Failure)
        if: github.event.client_payload.task_type == 'tech' || ...
        uses: nick-fields/retry@v3         # 第三方 Action：失败自动重试
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}   # 从仓库 Secrets 注入环境变量
          RENDER_API_URL: ${{ secrets.RENDER_API_URL }}
        with:
          timeout_minutes: 10
          max_attempts: 3
          retry_wait_seconds: 60
          command: python main.py --type github            # 实际执行的命令

      # Task 2: Macro Brief
      - name: Run Grok Macro Brief (Retry on Failure)
        if: always() && (github.event.client_payload.task_type == 'macro' || ...)
        # always() 表示即使 Task 1 失败，Task 2 也独立运行
        uses: nick-fields/retry@v3
        env:
          XAI_API_KEY: ${{ secrets.XAI_API_KEY }}
          RENDER_API_URL: ${{ secrets.RENDER_API_URL }}
        with:
          command: python main.py --type macro
```

### 暗号对接：fc.py 与 workflow 的绑定

fc.py 发出的 `event_type` 必须与 workflow 的 `types` 列表**完全一致**，GitHub 才触发：

```
fc.py:      "event_type": "fc-timer-trigger"
workflow:   types: [fc-timer-trigger]          ← 必须匹配
```

### `client_payload` 控制任务分支

fc.py 传入的 `task_type` 在 workflow 里通过 `github.event.client_payload.task_type` 读取，实现远程控制跑哪个任务：

| fc.py 发送的 task_type | 实际执行 |
|---|---|
| `"tech"` | 只跑 `python main.py --type github` |
| `"macro"` | 只跑 `python main.py --type macro` |
| `"all"` | 两个都跑 |

### Secrets 注入机制

API Key 等敏感信息存在 GitHub 仓库的 **Settings → Secrets**，workflow 通过 `secrets.KEY_NAME` 读取并注入为环境变量。这样代码里不出现任何密钥，CI 环境也能安全使用。

### `always()` 的作用

默认情况下，前一个 step 失败后后续 step 会跳过。`always()` 强制该 step 无论前面成功与否都执行，使两个任务**相互独立**，一个失败不影响另一个。