---
date created: 2026-01-25 15:29:48
date modified: 2026-01-25 20:03:43
---
# Function Calling 实战指南

> [!TIP] **核心定义**
> Function Calling 是连接大模型（大脑）与外部世界（手脚）的桥梁，它让 LLM 具备了操控外部工具、获取实时数据及输出结构化数据的能力。

---

## 1. 核心本质与工作流

### 核心本质
Function Calling **不是** LLM 运行了代码，而是 LLM **生成了运行代码的意图（结构化 JSON）**。最终代码的执行权限始终在开发者手中。

### “FC 闭环”五步法
1.  **注册工具 (Tools Definition)**：使用 JSON Schema 描述函数的功能、参数类型及必填项。
2.  **意图识别 (Model Decision)**：LLM 根据用户问题和工具描述，决定是否调用工具。
3.  **本地执行 (Local Execution)**：开发者解析 LLM 返回的 JSON 参数，在本地执行真实函数。
4.  **结果反馈 (Context Feeding)**：将执行结果作为 `role: tool` 消息送回 LLM。
5.  **总结输出 (Final Response)**：LLM 结合上下文，给出人类可读的最终回答。

---

## 2. 工程化代码示例 (Python)

```python
import json
import os
from openai import OpenAI

# 1. 初始化客户端
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY", "your-key-here"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

# 2. 定义业务逻辑函数
def get_current_weather(location, unit="celsius"):
    """查询指定城市的实时天气"""
    # 模拟 API 返回
    weather_data = {
        "Beijing": {"temp": "22", "condition": "Sunny"},
        "Shanghai": {"temp": "25", "condition": "Rainy"}
    }
    res = weather_data.get(location, {"temp": "unknown", "condition": "unknown"})
    return json.dumps({**res, "location": location, "unit": unit})

def calculate_tax(price, tax_rate=0.1):
    """计算商品税后总价"""
    total = float(price) * (1 + float(tax_rate))
    return json.dumps({"price": price, "tax_rate": tax_rate, "total_price": round(total, 2)})

# 3. 工具映射注册表 (自动化路由)
available_functions = {
    "get_current_weather": get_current_weather,
    "calculate_tax": calculate_tax,
}

# 4. JSON Schema 定义 (描述质量直接决定模型调用准确率)
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "当用户询问特定城市天气时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "城市名，如：北京"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_tax",
            "description": "计算商品税后价格。",
            "parameters": {
                "type": "object",
                "properties": {
                    "price": {"type": "number", "description": "商品原价"},
                    "tax_rate": {"type": "number", "description": "税率，默认 0.1"},
                },
                "required": ["price"],
            },
        },
    }
]

def run_agent(query):
    messages = [{"role": "user", "content": query}]

    # 第一轮交互：模型决策
    response = client.chat.completions.create(
        model="gemini-1.5-flash", # 或其他支持 FC 的模型
        messages=messages,
        tools=tools,
        tool_choice="auto", 
    )
    
    response_message = response.choices[0].message
    tool_calls = response_message.tool_calls

    if tool_calls:
        # 必须将模型生成的 tool_calls 消息加入历史
        messages.append(response_message)

        # 处理并行工具调用
        for tool_call in tool_calls:
            func_name = tool_call.function.name
            func_args = json.loads(tool_call.function.arguments)
            
            print(f"[*] 正在调用工具: {func_name} | 参数: {func_args}")
            
            # 路由与执行
            func_to_call = available_functions.get(func_name)
            if func_to_call:
                result = func_to_call(**func_args)
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": func_name,
                    "content": result,
                })

        # 第二轮交互：模型总结
        second_response = client.chat.completions.create(
            model="gemini-1.5-flash",
            messages=messages,
        )
        return second_response.choices[0].message.content
    
    return response_message.content

if __name__ == "__main__":
    ans = run_agent("我在北京买个 100 块的东西，税率是 0.2，今天天气如果不好的话我就不出门买了。")
    print(f"\nFinal Answer:\n{ans}")
```

---

## 3. 核心机制详解

### Parallel Function Calling (并行调用)

现代模型（如 GPT-4, Gemini 1.5）支持一次性返回多个 `tool_calls`。

- **场景**：用户问“北京和上海的天气”，模型会同时请求两次 `get_current_weather`。
- **注意**：代码必须使用 `for` 循环处理 `tool_calls` 列表。

### Tool Choice 控制

通过 `tool_choice` 参数精准控制模型行为：

- `"none"`：模型不使用工具，仅回复文本。
- `"auto"`（默认）：模型自主决定（最常用）。
- `{"type": "function", "function": {"name": "..."}}`：**强制**模型必须调用某个特定函数。

---

## 4. 平台化实践：Dify 与 OpenAPI

在工程化平台（如 Dify、FastGPT）中，**定义工具的方式与纯代码实现有所不同**。平台为了通用性，采用了 **OpenAPI Specification (OAS)**（即 **Swagger** 规范）作为标准。

### 4.1 为什么是 OpenAPI？

- **手写 Client**：我们需要手动构建 Python 字典 (`tools = [...]`) 来告诉 LLM。
- **平台化 Agent**：平台无法预知你会接入什么 API。OpenAPI 是一份标准“说明书”，告诉 Dify：
    1.  **去哪找接口** (`servers`)：如 `https://api.x.ai/v1`
    2.  **有什么功能** (`paths`)：如 `/chat/completions`
    3.  **怎么传参**：GET/POST，JSON Body 还是 Query String。

Dify 的后端会解析这个 OpenAPI Schema，**自动转换**为 LLM 能理解的 `tools` 结构。

### 4.2 结构解析与自动生成

一个典型的 OpenAPI JSON 片段：

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "IP Geolocation API",
    "version": "1.0.0",
    "description": "查询 IP 地理位置"
  },
  "servers": [
    {
      "url": "http://ip-api.com"
    }
  ],
  "paths": {
    "/json/{query}": {
      "get": {
        "description": "Get location info for an IP address",
        "operationId": "getIpLocation",
        "parameters": [
          {
            "name": "query",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "The IP address to query"
          }
        ],
        "responses": {
          "200": {
            "description": "Successful response"
          }
        }
      }
    }
  }
}
```


### 4.3 实战：集成第三方接口

将任何第三方 API（如高德地图、Notion、公司内部接口）接入 Dify 的工作流：

**Step 1: 准备文档**

找到目标接口文档，例如：`GET http://ip-api.com/json/{query}`。

**Step 2: LLM 转换 (核心技巧)**

不要手写 Schema，直接把 cURL 或文档贴给 ChatGPT/DeepSeek：

> [!TIP]
> Prompt: "请把这个 API 文档转换为 Dify 支持的 OpenAPI 3.0.0 JSON 格式。"

**Step 3: 导入 Dify**

在 Dify -> 工具 -> 自定义 -> 创建工具，粘贴生成的 JSON。

**Step 4: 配置鉴权**

- **Header Auth**：在 Dify 界面配置，不要硬编码在 JSON 中。
- **Query Auth**：部分旧接口将 Key 放在 URL 参数中，也可在 Dify 中配置。
