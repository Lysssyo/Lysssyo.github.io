# `coze-loop` 项目评测数据集上传问题排查与修复技术文档

## 1. 背景概述
在基于 Docker Compose 的 `coze-loop` 开发环境中，用户在评测集模块使用“本地导入”功能时，遇到了文件上传失败及后续导入报错的问题。环境涉及 WSL、远程 Linux 服务器（8.166.138.138）以及 Nginx 代理。

---

## 2. 问题一：预签名 URL 域名不可达
### 现象
浏览器尝试向 `http://coze-loop-minio:9000/...` 发起 `PUT` 请求，报错：`net::ERR_NAME_NOT_RESOLVED`。

### 原因分析
*   **容器网络 vs 宿主机网络**：后端运行在 Docker 容器内，它默认使用 Docker 内部网络的服务名 `coze-loop-minio`。
*   **浏览器环境**：浏览器运行在用户的宿主机（Windows/Mac）上，它无法解析 Docker 内部的 DNS 名称。

### 解决方法
**实现内外网地址分离**。
1.  **代码层面**：修改 `S3Config` 增加 `ExternalEndpoint`，并在后端初始化时根据环境变量 `COZE_LOOP_OSS_EXTERNAL_DOMAIN` 生成该端点。
2.  **配置层面**：在 `.env` 中设置外部 IP 为服务器公网 IP 或域名。
3.  **代理逻辑**：通过 Nginx（8082 端口）转发 OSS 请求到内部 MinIO（9000 端口）。

---

## 3. 问题二：Go 后端编译错误
### 现象
1.  `session.NewSession undefined`
2.  `undefined: cfg`

### 原因分析
1.  **变量遮蔽 (Shadowing)**：在 Go 代码中，由于定义了 `session, err := ...`，局部变量名 `session` 覆盖了导入的 `github.com/aws/aws-sdk-go/aws/session` 包名，导致后续无法调用包方法。
2.  **作用域错误**：修改 `main.go` 时，将配置代码插入到了闭包（匿名函数）之外，导致变量 `cfg` 不在作用域内。

### 解决方法
1.  将局部变量 `session` 重命名为 `sess`。
2.  修正 `main.go` 的插入位置，确保其处于 `NewS3Config` 的回调函数内部。

---

## 4. 问题三：Nginx 启动异常 (Invalid arguments)
### 现象
Nginx 容器报错：`invalid number of arguments in "proxy_set_header" directive`。

### 原因分析
在 Shell 脚本中使用 `cat <<EOF` 生成配置文件时，`proxy_set_header Host $host;` 中的 `$host` 被 Shell 解释为了环境变量。由于宿主机没有 `$host` 变量，最终生成的 `nginx.conf` 变成了 `proxy_set_header Host ;`（缺少参数）。

### 解决方法
在 `entrypoint.sh` 中对 `$host` 进行转义，写成 `\$host`。

---

## 5. 问题四：MinIO 403 Forbidden (签名校验失败)
### 现象
请求 URL 已经是正确的公网 IP/域名，但 MinIO 返回 `403 Forbidden`。

### 原因分析
**S3 签名 V4 机制 (Signature V4)**：
S3 协议要求请求中的 `Host` 头部必须与生成签名时使用的 Host 完全一致。
*   **后端签名**：使用了 `8.166.138.138:8082`。
*   **Nginx 转发**：最初配置 `proxy_set_header Host $host;`。在 Nginx 中，`$host` 不包含端口号。
*   **不一致性**：MinIO 收到的是没有端口的 Host，导致重新计算的签名与前端传来的签名不匹配。

### 解决方法
将 Nginx 配置改为 `proxy_set_header Host $http_host;`。`$http_host` 会原封不动地转发浏览器发送的 `域名:端口` 组合。

---

## 6. 问题五：502 Bad Gateway (后端无法访问内部 OSS)
### 现象
文件 `PUT` 上传成功，但随后的 `/import` 接口报错：`head object ...: Bad Gateway`。

### 原因分析
**代理污染**：
后端容器配置了 `HTTP_PROXY=http://172.17.0.1:7890`（为了访问外部大模型）。
当后端尝试连接 `http://coze-loop-minio:9000` 时，请求被发往了外部代理，外部代理无法识别 Docker 内部域名。

### 解决方法
修改 `.env` 中的 `NO_PROXY` 变量，将所有内部服务名（`coze-loop-minio`, `coze-loop-mysql` 等）全部加入排除列表。

---

## 7. 问题六：域名访问失效 (server_name)
### 现象
使用 IP 访问正常，但改用域名访问时报错。

### 原因分析
Nginx 原始配置为 `server_name localhost;`。当使用域名访问时，请求头的 `Host` 与 `localhost` 不匹配，Nginx 拒绝处理请求。

### 解决方法
修改 Nginx 配置，将 `server_name` 改为 `_`（通配符），使其接受任何指向该服务器的域名。

---

## 8. 问题七：CORS 跨域报错 (PUT 请求失败)
### 现象
浏览器报错：`Access to XMLHttpRequest at ... has been blocked by CORS policy`。

### 原因分析
**Nginx if 作用域限制**：
后端处理跨域时，浏览器会先发送一个 `OPTIONS` 预检请求。
在 Nginx 配置中：
```nginx
if ($request_method = OPTIONS) {
    return 204;
}
```
由于 `if` 块内部使用了 `return`，在 `if` 块之外定义的 `add_header`（跨域头）不会被应用到这个 `204` 响应中。浏览器拿不到跨域授权头，导致后续 `PUT` 请求被拦截。

### 解决方法
在所有的 `if ($request_method = OPTIONS)` 块内部显式添加跨域头部。

---

## 9. 最终架构逻辑总结
通过上述修复，系统的 OSS 流量走向如下：

1.  **获取链接**：前端调用后端 API -> 后端根据 `EXTERNAL_DOMAIN` 环境（IP 或域名）计算预签名 URL。
2.  **前端上传**：浏览器向 `域名:8082` 发起 `PUT`。
3.  **Nginx 转发**：Nginx 识别路径 `/${BUCKET}/` -> 使用 `$http_host` 透传域名和端口 -> 转发至内部 `minio:9000`。
4.  **MinIO 校验**：MinIO 收到一致的 Host -> 校验签名通过 -> 保存文件。
5.  **后端处理**：后端通过 `NO_PROXY` 绕过代理 -> 直接连接 `minio:9000` 读取文件进行解析。
