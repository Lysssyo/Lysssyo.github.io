---
date created: 2026-01-15 12:05:30
date modified: 2026-01-16 00:08:29
---
# Coze-Loop-Startup

## **0. 场景概述**

- 依赖服务`MySQL/Redis/ClickHouse/MinIO/RocketMQ/FaaS`部署在远程服务器的 docker compose 中。
- 本地仅启动后端（可选启动前端），通过公网或 SSH 隧道访问远程依赖。

## **1. 服务器准备**

```bash
  # 安装基础工具与 Docker（CentOS 示例）
  sudo yum install -y yum-utils
  sudo yum-config-manager --add-repo <https://download.docker.com/linux/centos/docker-ce.repo>
  sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  
  systemctl start docker
  systemctl enable docker
  
  # 镜像加速（可选）
  bash <(wget -qO- <https://xuanyuan.cloud/docker.sh>)

  # 安装 git
  sudo yum install -y git
  git --version

  # 拉取仓库
  git clone <https://gitee.com/lysssyo/apollo.git>
```

> [!TIP] 加速域名
> [加速域名](../../98-Private/密码串.md#加速域名)



## **2. 远程依赖部署**

```bash
  cd apollo/release/deployment/docker-compose
  docker compose -f docker-compose.yml -f docker-compose-local.yml --env-file .env --profile redis --profile mysql --profile clickhouse --profile minio --profile rmq --profile faas up -dofile faas up -d
  docker ps   # 确认 Healthy
  
  # 停止全部容器（需要时）
  # docker stop $(docker ps -q)
```

## **3. SSH 隧道**

1. 在本地host文件添加以下内容
    
    ```
    # C:\\Windows\\System32\\drivers\\etc\\hosts
    
    127.0.0.1       rocketmq-broker
    127.0.0.1       rocketmq-namesrv
    ```
    
    当你的程序想连接 rocketmq-namesrv 时，它会直接连接你本地的 127.0.0.1 上的 9876 端口
    
2. 开隧道（保持窗口不关）
    
    ```bash
    	ssh -N `
    		-L 9876:127.0.0.1:9876 `
    		-L 10911:127.0.0.1:10911 `
    		-L 10909:127.0.0.1:10909 `
    		-L 40629:172.18.0.2:40629 `
    		-L 9000:127.0.0.1:9000 `
    	root@109.123.253.38
    ```

	>[!TIP]
	>109.123.253.38为服务器公网ip
	>
	> root密码为[服务器密码](../../98-Private/密码串.md#服务器密码)
	


## **4. 本地后端启动**

```
# 1) 工作目录设置为 conf 所在路径，便于后端读取配置
cd D:\\coze-loop\\release\\deployment\\docker-compose

$env:PWD = (Get-Location).Path

# 2) 将 64 位 Go 放在 PATH 最前，避免旧版本/32 位被使用
$env:PATH = "C:\\Program Files\\Go\\bin;$env:PATH"

# 3) 端口映射环境变量（对应 WSL Compose 的端口暴露）
$env:COZE_LOOP_REDIS_DOMAIN="109.123.253.38";  $env:COZE_LOOP_REDIS_PORT="6379"; $env:COZE_LOOP_REDIS_PASSWORD="cozeloop-redis"
$env:COZE_LOOP_MYSQL_DOMAIN="109.123.253.38";  $env:COZE_LOOP_MYSQL_PORT="3306"; $env:COZE_LOOP_MYSQL_USER="root";  $env:COZE_LOOP_MYSQL_PASSWORD="cozeloop-mysql"; $env:COZE_LOOP_MYSQL_DATABASE="cozeloop-mysql"
$env:COZE_LOOP_CLICKHOUSE_DOMAIN="109.123.253.38";  $env:COZE_LOOP_CLICKHOUSE_PORT="9000"; $env:COZE_LOOP_CLICKHOUSE_USER="default";  $env:COZE_LOOP_CLICKHOUSE_PASSWORD="cozeloop-clickhouse"; $env:COZE_LOOP_CLICKHOUSE_DATABASE="cozeloop-clickhouse"
$env:COZE_LOOP_OSS_PROTOCOL="http";  $env:COZE_LOOP_OSS_DOMAIN="109.123.253.38"; $env:COZE_LOOP_OSS_PORT="9001";  $env:COZE_LOOP_OSS_REGION="us-east-1";  $env:COZE_LOOP_OSS_USER="root"; $env:COZE_LOOP_OSS_PASSWORD="cozeloop-minio";  $env:COZE_LOOP_OSS_BUCKET="cozeloop-minio"
$env:COZE_LOOP_RMQ_NAMESRV_DOMAIN="rocketmq-namesrv";  $env:COZE_LOOP_RMQ_NAMESRV_PORT="9876"
$env:COZE_LOOP_PYTHON_FAAS_DOMAIN="109.123.253.38";  $env:COZE_LOOP_PYTHON_FAAS_PORT="8000"
$env:COZE_LOOP_JS_FAAS_DOMAIN="109.123.253.38";  $env:COZE_LOOP_JS_FAAS_PORT="8001"

# 4) 进入 backend 模块（有 go.mod）
 cd D:\\coze-loop\\backend

# 5)（可选）设置 Go 代理，加速依赖

# 6) 启动后端
go run .\\cmd
```

## **5. 本地前端启动**

- 设置api代理

```
// frontend/apps/cozeloop/rsbuild.config.ts
server: { port, proxy: { '/api': '<http://localhost:8888>' } },
```

- 安装依赖

```
 rush install --purge --to @cozeloop/community-base --ignore-hooks
```

- 启动前端项目

```
cd D:\\coze-loop\\frontend\\apps\\cozeloop
rushx dev
```

## **6. 代码提交**

```
git add .
git commit -m '服务器更新' --no-verify   
git push origin main
```

## **7. 其他问题**

为什么`$env:COZE_LOOP_RMQ_NAMESRV_DOMAIN="192.168.199.91(内网ip)";`而其他的依赖用的是公网ip（180.184.27.188）呢

RocketMQ 的 broker 会把自己对外服务的地址注册到 namesrv（字段 brokerIP1）。默认如果不指定，会用容器/主机当前能看到的 IP，之前是 172.* 的容器内网，外部客户端拿到后无法连接；

如果指定为公网ip，则内部服务没法访问，因为内部服务无法访问宿主机（不支持回环）

现在我们手工指定为宿主机内网 IP 192.168.199.91，目的是让同一台机上的容器或同一内网里的服务能直接访问，不再出现内部服务无法访问的问题

**影响**：namesrv 返回的地址就是 brokerIP1；客户端必须能直连这个地址的 10911/10909。当前设置成内网 IP，内网/本机通过 SSH 隧道可以访问，但纯公网客户端直接连会超时。

> 检查内部服务能否访问
> 
> ```
> docker exec -it coze-loop-rmq-broker sh -c '$ROCKETMQ_HOME/bin/mqadmin clusterList -n coze-loop-rmq-namesrv:9876'
> ```

## **8. 本地启动所有容器**

```
cd /.
cd mnt/d/coze-loop
make compose-up-dev
```

## **9. 远程部署服务**

```
# 更新代码
cd /.
cd root/apollo
git pull

# 停止dev组合
docker compose -f release/deployment/docker-compose/docker-compose.yml \\
  -f release/deployment/docker-compose/docker-compose-dev.yml \\
  --env-file release/deployment/docker-compose/.env \\
  --profile "*" down
    
# 手动删卷    
docker volume rm coze-loop-nginx-data

# 重新启动dev组合
make compose-up-dev

# 或者这个
docker compose -f release/deployment/docker-compose/docker-compose.yml \\
  -f release/deployment/docker-compose/docker-compose-dev.yml \\
  --env-file release/deployment/docker-compose/.env \\
  --profile "*" up -d
  
# 手动启动app、nginx（如果没有启动）
docker start coze-loop-app
docker start coze-loop-nginx
```

**“停止 dev 组合”指的是**把用 docker-compose.yml + docker-compose-dev.yml 起的这一组开发容器停掉并清理掉，不是关某一个服务。

> [!TIP] 
> 这些文件定义了 app、nginx、redis、mysql、clickhouse、minio、rocketmq 等一组容器和网络。
> 执行 docker compose ... down 会依次停止并删除这些容器和自动创建的网络，但不会删镜像；默认也不会删卷，所以数据/静态资源卷会保留。
> 加 -v（down -v）会连带删除它们用到的 named volume（例如静态资源的 coze-loop-nginx-data），这样下次 up 时会重新用镜像里的新前端填充卷。
> 与 docker compose stop 相比，down 更彻底：stop 只是让容器变为 Exited，down 会直接删除容器，保证重新 up 时是干净的实例。

**你怎么知道要删哪个卷？**

我是看 compose 配置推断的：

在 release/deployment/docker-compose/docker-compose.yml 里，app 把 /coze-loop/resources 挂到一个 named volume nginx_data，nginx 把同一个 volume 挂到 /usr/share/nginx/html。

- .env 定义了 COZE_LOOP_NGINX_DATA_VOLUME_NAME=coze-loop-nginx-data，所以实际卷名就是 coze-loop-nginx-data。
- 当卷存在时，它会覆盖镜像里 /coze-loop/resources 的新文件，所以要刷新前端就得删这个卷。

验证/查找卷的方法：

- 直接看 compose：docker compose -f ... config --volumes 会列出 nginx_data。
- 看现有卷：docker volume ls | grep coze-loop。
- 看卷内容时间戳：docker run --rm -v coze-loop-nginx-data:/data busybox ls -l /data。

删卷：docker compose ... down -v 会顺便删除 compose 创建的卷；或显式 docker volume rm coze-loop-nginx-data。

## **10. 防火墙**

```
sudo yum install firewalld -y

sudo systemctl start firewalld

sudo systemctl enable firewalld

# 查看状态
systemctl status firewalld

# 确认 ssh 是否在允许列表中
firewall-cmd --list-all
# (一定要看到 services: ... ssh ... 这一项)

# 如果没看到 ssh，立刻执行下面这句救命：
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload

# 停止防火墙
sudo systemctl stop firewalld
```

## **其他**

查看docker某个容器的日志

```
docker logs coze-loop-rmq-init
```

> [!TIP]
> 这个服务用来初始化topic，如果topic不存在，可能是这个服务出了问题

powershell设置代理，登录gemini

```
$env:http_proxy="http://127.0.0.1:33210"
$env:https_proxy="http://127.0.0.1:33210"
```

> [!TIP]
> 验证是否成功： 输入 $env:http_proxy 查看

TODO：

1. ID生成器