# Clash 配置文件

## 1. 数据流

理解 Clash 配置，先不要急着背字段，先看一条请求会怎么走：

```text
本机程序
  ↓ 连接到 port / socks-port
Clash / mihomo
  ↓ 按 rules 从上到下匹配
某个策略组（proxy-groups）
  ↓ 继续解析当前选中项
具体节点 / DIRECT / REJECT
  ↓
目标网站
```

如果目标是域名而不是 IP，Clash 还可能需要 DNS 模块先把域名解析成 IP，再继续做后续判断和连接。

配置文件里的核心块，可以按下面顺序理解：

1. **基础设置**：Clash 自己监听什么端口、工作在什么模式
2. **proxies**：有哪些具体节点可用
3. **proxy-groups**：如何把节点组织成策略组
4. **rules**：每类流量最终交给哪个策略组
5. **dns**：Clash 自己如何解析域名

配置文件在 YAML 里不一定非要按这个顺序书写，但从理解上按这条主线最清楚。

---

## 2. 基础设置

```yaml
port: 7890          # 本机 HTTP 代理端口
socks-port: 7891    # 本机 SOCKS5 代理端口
allow-lan: false    # 不允许局域网设备使用
mode: rule          # 按规则分流（还有 global/direct 模式）
log-level: error    # 只记录错误日志
external-controller: 0.0.0.0:9090  # 管理面板 API 端口
unified-delay: true # 统一延迟计算方式
```

这一段决定的是：Clash 在本机怎么对外提供代理服务，以及自身的运行方式。

---

## 3. proxies（具体节点）

`proxies` 里定义的，才是真正的远程代理服务器。每个条目对应一个可以直接出站的节点。

### 字段说明

```yaml
- name: "🇭🇰丛雨云"           # 显示名称
  type: vmess               # 代理协议
  server: hkov.a.vxgky.com  # 远程服务器地址
  port: 9999                # 远程服务器端口（不是本机端口）
  uuid: cf32dbaf-...        # 认证身份标识（相当于密码）
  alterId: 0                # 0 = 使用新版 AEAD 加密
  cipher: auto              # 加密方式自动协商
  udp: true                 # 支持 UDP 转发
  tls: true                 # 外层套 TLS 加密
  skip-cert-verify: false   # 严格验证 TLS 证书
  servername: g.cgyu.cc     # TLS 握手时的 SNI（伪装域名）
  network: grpc             # 传输方式，例如 ws, grpc
  grpc-opts:
    grpc-service-name: m    # gRPC 服务路径
```

### WebSocket 模式示例

```yaml
network: ws
ws-opts:
  path: /m                              # WebSocket 请求路径
  headers:
    host: www.douyinqqkuaishou.top      # HTTP Host 头伪装
h2-opts: ~    # null，未使用
http-opts: ~  # null，未使用
grpc-opts: ~  # null，未使用
```

`~` 在 YAML 中表示 `null`。选了 `ws` 模式，其他传输方式的配置就留空。

### `type` 和 `network` 是两层东西

这几种协议工作在不同层次，是嵌套关系：

```text
TCP → TLS → gRPC/WebSocket → VMess/Trojan → 真实流量
 ↑          ↑                  ↑
传输层    应用层传输方式       代理协议
(基础)   (伪装成什么样子)    (加密、认证、告诉服务端目标地址)
```

| 层次 | 协议 | 职责 |
| --- | --- | --- |
| 传输层 | TCP | 基础数据传输 |
| 应用层传输方式 | gRPC / WebSocket / HTTP/2 | 决定流量的"外观"（对应配置里的 `network` 字段） |
| 代理协议 | VMess / Trojan / Shadowsocks | 加密、认证、目标寻址（对应配置里的 `type` 字段） |

---

## 4. proxy-groups（策略组）

策略组不是远程服务器，而是**节点的集合 + 选择策略**。它的作用是把很多具体节点组织起来，供规则引用。

可以把它理解成一层"分发器"：

- `proxies` 定义"有哪些具体节点"
- `proxy-groups` 定义"这些节点怎么选、怎么组合"

```yaml
proxy-groups:
- name: 🔰 节点选择
  type: select
  proxies:
  - ♻️ 自动选择
  - 🎯 全球直连
  - 🇭🇰丛雨云
  - 🇯🇵全部超时请检查系统时间
- name: ♻️ 自动选择
  type: url-test
  url: http://www.gstatic.com/generate_204
  interval: 300
  proxies:
  - 🇭🇰丛雨云
  - 🇭🇰x0.7 倍率 测试节点
  - 🇯🇵Japan 春日野 悠
  - 🇯🇵Japan 春日野 穹
  - 🇭🇰Hong Kong 緒山 美波里
- name: 🎥 Netflix
  type: select
  proxies:
  - 🔰 节点选择
  - ♻️ 自动选择
  - 🎯 全球直连
  - 🇭🇰丛雨云
  - 🇯🇵全部超时请检查系统时间
  - 🇸🇬请开启自动更新订阅
  - 🇹🇼congyu.org 🐱
  - 🇭🇰Hong Kong ムラサメ
- name: 🌍 国外媒体
  type: select
  proxies:
  - 🔰 节点选择
  - ♻️ 自动选择
  - 🎯 全球直连
  - 🇭🇰丛雨云
  - 🇯🇵全部超时请检查系统时间
  - 🇸🇬请开启自动更新订阅
  - 🇹🇼congyu.org 🐱
  - 🇭🇰Hong Kong ムラサメ
  - 🇭🇰x0.7 倍率 测试节点
  - 🇯🇵Japan 春日野 悠
  - 🇯🇵Japan 春日野 穹
- name: 🎯 全球直连
  type: select
  proxies:
  - DIRECT
- name: 🛑 全球拦截
  type: select
  proxies:
  - REJECT
```

### 常见类型

| 类型         | 说明                |
| ---------- | ----------------- |
| `select`   | 手动选择，在管理面板里自己点    |
| `url-test` | 自动测速，定期选延迟最低的节点   |
| `relay`    | 按顺序把多个节点串起来形成链式代理 |

### 内置特殊代理

- `DIRECT`：不经过代理，直接连接
- `REJECT`：直接丢弃请求

### 策略组可以嵌套

策略组的 `proxies` 列表中，成员既可以是具体节点，也可以是另一个策略组的名字。

```yaml
# 🎥 Netflix —— 它的选项里包含另一个策略组"🔰 节点选择"
- name: 🎥 Netflix
  type: select
  proxies:
  - 🔰 节点选择    # 另一个策略组
  - 🎯 全球直连    # 也是策略组
  - 🇭🇰丛雨云     # 具体节点

# 🔰 节点选择 —— 包含具体节点和子策略组
- name: 🔰 节点选择
  type: select
  proxies:
  - ♻️ 自动选择
  - 🎯 全球直连
  - 🇭🇰丛雨云
  - 🇯🇵Japan 春日野 悠
  - ...
```

当请求命中规则被分配给某个策略组后，Clash 会沿着"当前选中项"一路向下解析，直到找到具体节点或 `DIRECT` / `REJECT` 为止。

**示例场景**：访问 `netflix.com`，`🎥 Netflix` 当前选中 `🔰 节点选择`，而 `🔰 节点选择` 当前选中 `🇭🇰丛雨云`

```text
规则命中: DOMAIN-SUFFIX,netflix.com → 🎥 Netflix
                                       ↓ 当前选中: 🔰 节点选择（策略组）
                                    🔰 节点选择
                                       ↓ 当前选中: 🇭🇰丛雨云（具体节点）
                                    🇭🇰丛雨云  ✓
```

如果把 `🎥 Netflix` 直接切换为 `🇭🇰丛雨云`，那就跳过中间层，直接路由到该节点。

### 每个策略组的选择彼此独立

每个策略组都有自己的当前选中项，互不影响。例如：

- `🔰 节点选择` → `🇭🇰丛雨云`
- `Ⓜ️ Microsoft` → `🎯 全球直连`
- `🎥 Netflix` → `🔰 节点选择`
- `🐟 漏网之鱼` → `🔰 节点选择`

这就是为什么配置里通常会拆很多策略组：不同类型的流量可以走不同路线，而且可以分别调整。

### `relay`：链式代理

`relay` 是一种特殊的策略组类型。它不是"在几个节点里选一个"，而是把 `proxies` 列表里的成员**按顺序全部串起来**。

```yaml
- name: Relay-StaticIP
  type: relay
  proxies:
  - 🇦🇱Albania
  - 我的静态IP出口
```

它表示的实际链路是：

```text
本机程序 → Clash / mihomo → 🇦🇱Albania → 我的静态IP出口 → 目标网站
```

这里：

- `🇦🇱Albania` 是第一跳
- `我的静态IP出口` 是第二跳，也是最终出口

顺序非常重要。`relay` 会先连接第一跳，再通过第一跳去连接第二跳，最后由最后一跳访问目标网站。因此目标网站通常看到的是**最后一跳的出口 IP**，而不是第一跳的 IP。

如果把 `relay` 放进一个普通选择组里：

```yaml
- name: Proxy
  type: select
  proxies:
  - Relay-StaticIP
  - ♻️ 自动选择
  - 🎯 全球直连
```

那么 `Relay-StaticIP` 只是 `Proxy` 的一个可选项。只有当流量先被分配到 `Proxy`，并且 `Proxy` 当前选中的正好是 `Relay-StaticIP` 时，链式代理才会真正生效。

> 注：Mihomo 官方文档已标注 `relay` 将逐步废弃，新配置更推荐使用 `dialer-proxy`；但理解现有配置时，仍然经常会遇到 `relay`。

---

## 5. rules（分流规则）

`rules` 决定的是：一条请求最终被交给哪个策略组。

### 格式

```text
匹配类型,匹配值,策略组
```

Clash 收到请求后，会**从上到下逐条匹配，命中第一条就停止**。

### 常见匹配类型

| 类型 | 说明 | 示例 |
| --- | --- | --- |
| `DOMAIN` | 精确匹配完整域名 | `DOMAIN,analytics.strava.com,🔰 节点选择` |
| `DOMAIN-SUFFIX` | 匹配域名后缀（含所有子域名） | `DOMAIN-SUFFIX,163.com,🎯 全球直连` |
| `DOMAIN-KEYWORD` | 域名中包含关键词即命中 | `DOMAIN-KEYWORD,xunlei,🎯 全球直连` |
| `IP-CIDR` | 按 IP 段匹配 | `IP-CIDR,192.168.0.0/16,🎯 全球直连` |
| `GEOIP` | 按 IP 归属地匹配 | `GEOIP,CN,🎯 全球直连` |
| `MATCH` | 兜底规则，放在最末尾 | `MATCH,🐟 漏网之鱼` |

### 核心关系：`rules` 先决定分给谁，策略组再决定具体怎么走

不管你在策略组里选了什么节点，只要请求命中了某条 `rule`，就会先被交给这条规则指定的策略组。之后，Clash 才会继续解析这个策略组当前到底指向哪个具体节点。

所以：

- `rules` 决定"交给哪个策略组"
- `proxy-groups` 决定"这个策略组当前实际走什么"

### 兜底规则

```yaml
- MATCH,🐟 漏网之鱼
```

所有前面都没匹配到的流量，都会交给 `🐟 漏网之鱼`。如果 `🐟 漏网之鱼` 默认又指向 `🔰 节点选择`，那就等于"未知流量默认走代理"。

---

## 6. DNS 块

DNS 是辅助模块，负责"Clash 自己怎么解析域名"。

```yaml
dns:
  enable: false  # 整个 DNS 模块不生效，Clash 直接用系统默认 DNS
  listen: 0.0.0.0:8853
  ipv6: true
  default-nameserver:
  - 223.5.5.5
  - 119.29.29.29
  nameserver:
  - https://dns.alidns.com/dns-query
  - https://223.5.5.5/dns-query
  fallback:
  - https://1.1.1.1/dns-query
  - https://dns.twnic.tw/dns-query
  - tls://8.8.8.8:853
```

### DNS 和分流的关系

需要把 DNS 和 `rules` 分开理解：

- `rules` 决定流量交给哪个策略组
- DNS 负责把域名解析成 IP

DNS 本身不直接决定使用哪个策略组，但如果规则里有 `IP-CIDR`、`GEOIP` 之类依赖 IP 的匹配，解析结果会影响这些规则能不能命中。

### DoH（DNS over HTTPS）

传统 DNS 查询是明文 UDP 请求（端口 53），运营商能看到你查询了什么域名，也可能篡改结果。DoH 把 DNS 查询放进 HTTPS 里，内容加密，不容易被观察和污染。

### 三层 DNS 的分工

| 层级 | 配置项 | 作用 |
| --- | --- | --- |
| 最底层 | `default-nameserver` | 用来解析 DoH 服务器域名本身的 IP |
| 主力 | `nameserver` | 日常域名解析 |
| 备用 | `fallback` | 用境外 DoH / DoT 兜底，防止返回被污染的结果 |

### `default-nameserver` 为什么存在

这是为了解决"鸡生蛋"问题：要访问 `https://dns.alidns.com/dns-query`，首先得知道 `dns.alidns.com` 的 IP。这时就得先用 `default-nameserver` 做一次最原始的解析。

如果 `nameserver` 写的是 IP 形式，例如 `https://223.5.5.5/dns-query`，那就不需要这一步，`default-nameserver` 实际上可能不会被用到。

---

## 7. 完整流量路径示例

假设：

- `🔰 节点选择` 当前选中 `🇭🇰丛雨云`
- `Ⓜ️ Microsoft` 当前选中 `🎯 全球直连`
- `🐟 漏网之鱼` 当前选中 `🔰 节点选择`

那么不同流量的最终路径大致如下：

| 访问目标 | 命中规则 | 策略组 | 最终走向 |
| --- | --- | --- | --- |
| `bing.com` | `DOMAIN-SUFFIX,bing.com,Ⓜ️ Microsoft` | `Ⓜ️ Microsoft` | 直连 |
| `signal.org` | `DOMAIN-SUFFIX,signal.org,🔰 节点选择` | `🔰 节点选择` | `🇭🇰丛雨云` |
| `163.com` | `DOMAIN-SUFFIX,163.com,🎯 全球直连` | `🎯 全球直连` | 直连 |
| 某个未知网站 | `MATCH,🐟 漏网之鱼` | `🐟 漏网之鱼 → 🔰 节点选择` | `🇭🇰丛雨云` |

### 链式代理什么时候才算真正用上

1. `rules` 把流量交给了某个会落到 `relay` 的策略组
2. 如果规则指向的是策略组类型是选择组，那么这个选择组当前确实选中了 `relay`策略组

例如：

```yaml
- name: Proxy
  type: select
  proxies:
  - Relay-StaticIP
  - ♻️ 自动选择
  - 🎯 全球直连

rules:
- MATCH,Proxy
```

这段配置里，只有当 `Proxy` 当前选中 `Relay-StaticIP` 时，实际链路才是：

```text
本机程序 → Clash / mihomo → 第一跳节点 → 第二跳节点 → 目标网站
```

如果 `Proxy` 当前选中的是 `♻️ 自动选择` 或 `🎯 全球直连`，那就不会走链式代理。

### 如何判断链式代理是否生效

判断思路分三层：

1. 看 `rules` 最终把这类流量交给了哪个策略组
2. 看这个策略组当前选中的是否是 `relay` 组
3. 再去看目标网站显示的出口 IP 是否已经变成最后一跳

如果启用了 Clash / mihomo 的控制器 API，可以直接查当前组的运行时选择结果：

```bash
curl http://127.0.0.1:9090/proxies/Proxy
```

如果配置了 `secret`，则带上认证头：

```bash
curl -H "Authorization: Bearer <你的secret>" http://127.0.0.1:9090/proxies/Proxy
```
