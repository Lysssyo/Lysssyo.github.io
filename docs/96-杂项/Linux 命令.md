# Linux 命令

## 一、目录与路径

### 1. 查看当前位置：`pwd`

```bash
pwd
```

显示当前所在目录。

### 2. 切换目录：`cd`

常用命令：

```bash
cd 目录名
cd ..
cd
cd ~
cd -
cd /
cd .
```

含义：

```text
cd 目录名   进入目录
cd ..      回到上一级
cd 或 cd ~  回到用户主目录
cd -       回到上一次所在目录
cd /       回到根目录
cd .       当前目录
```

进入绝对路径：

```bash
cd /etc
```

进入相对路径：

```bash
cd test
cd ./test
```

进入隐藏目录：

```bash
cd ~/.ssh
```

进入带空格的目录：

```bash
cd "my folder"
cd my\ folder
```

进入父目录的兄弟目录：

```bash
cd ../docs
```

常见路径符号：

```text
.      当前目录
..     上一级目录
~      用户主目录
/      根目录
-      上一次所在目录
```

---

## 二、文件与目录操作

### 1. 创建文件：`touch`

创建单个空文件：

```bash
touch note.txt
```

如果文件不存在，就创建空文件；如果已存在，就更新修改时间。

一次创建多个文件：

```bash
touch a.txt b.txt c.txt
```

### 2. 创建目录：`mkdir`

创建目录：

```bash
mkdir test
```

创建多级目录：

```bash
mkdir -p a/b/c
```

### 3. 查看目录：`ls`

查看当前目录内容：

```bash
ls
```

详细列表显示：

```bash
ls -l
```

示例输出：

```text
-rw-r--r-- 1 root root 0 Apr 25 16:20 note.txt
```

含义：

| 部分 | 含义 |
| --- | --- |
| `-rw-r--r--` | 文件类型和权限 |
| `1` | 硬链接数量 |
| `root` | 文件所有者 |
| `root` | 文件所属用户组 |
| `0` | 文件大小，字节 |
| `Apr 25 16:20` | 最后修改时间 |
| `note.txt` | 文件名 |

显示隐藏文件，隐藏文件一般以 `.` 开头：

```bash
ls -a
```

### 4. 复制：`cp`

复制文件：

```bash
cp a.txt b.txt
```

复制目录：

```bash
cp -r dir1 dir2
```

### 5. 移动和重命名：`mv`

重命名：

```bash
mv old.txt new.txt
```

移动文件：

```bash
mv file.txt /tmp/
```

### 6. 删除文件和目录：`rm`

删除文件：

```bash
rm note.txt
```

删除多个文件：

```bash
rm a.txt b.txt c.txt
```

删除前询问确认：

```bash
rm -i note.txt
```

强制删除，不询问，文件不存在也不报错：

```bash
rm -f note.txt
```

递归删除目录及其内容：

```bash
rm -r test
```

强制递归删除目录，更危险：

```bash
rm -rf test
```

`-f` 常见用途：

1. 文件不存在也不想报错
2. 删除只读文件时不想被询问
3. 批量删除缓存、日志、构建产物

危险命令不要乱用：

```bash
rm -rf /
rm -rf /*
rm -rf * # 删除当前目录下的所有非隐藏文件和目录
```

删除前建议先确认：

```bash
pwd
ls
```

---

## 三、文件内容读写

### 1. 覆盖写入

```bash
echo "hello linux" > note.txt
```

`>` 会覆盖原文件内容。

### 2. 追加写入

```bash
echo "new line" >> note.txt
```

`>>` 表示追加，不覆盖。

### 3. 覆盖写入多行

```bash
cat > note.txt << EOF
第一行
第二行
第三行
EOF
```

### 4. 追加写入多行

```bash
cat >> note.txt << EOF
追加第一行
追加第二行
EOF
```

### 5. 手动追加写入

```bash
cat >> config.yaml
```

然后输入内容，最后按 `Ctrl + D` 结束。

注意：如果没有写 `<< EOF`，那么 `EOF` 只是普通文本，不会结束输入。

### 6. 查看文件内容：`cat`、`less`、`head`、`tail`

查看小文件。`cat` 没有固定行数上限，但大文件会刷屏：

```bash
cat file.txt
```

翻页查看大文件：

```bash
less bigfile.txt
```

`less` 常用按键：

| 按键     | 含义      |
| ------ | ------- |
| 空格     | 下一页     |
| `b`    | 上一页     |
| `/关键词` | 搜索      |
| `n`    | 下一个匹配结果 |
| `N`    | 上一个匹配结果 |
| `q`    | 退出      |

> [!TIP]
> 在 `less` 中搜索后，按空格是向下翻页，不是跳到下一个搜索结果；下一个搜索结果用 `n`。

查看开头，或指定前 20 行：

```bash
head file.txt
head -n 20 file.txt
```

查看结尾，或指定最后 20 行：

```bash
tail file.txt
tail -n 20 file.txt
```

实时查看日志：

```bash
tail -f app.log
```

---

## 四、搜索、管道与帮助

### 1. 搜索内容：`grep`

搜索包含 `error` 的行：

```bash
grep "error" app.log
```

忽略大小写：

```bash
grep -i "error" app.log
```

显示行号：

```bash
grep -n "error" app.log
```

忽略大小写并显示行号：

```bash
grep -in "error" app.log
```

显示上下文：

```bash
grep -A 3 "error" app.log
grep -B 3 "error" app.log
grep -C 3 "error" app.log
```

参数含义：

```text
-A  after，匹配行后面
-B  before，匹配行前面
-C  context，匹配行前后
```

反向匹配，显示不包含 `debug` 的行：

```bash
grep -v "debug" app.log
```

递归搜索当前目录，`-n` 显示行号，`-i` 忽略大小写：

```bash
grep -r "server" .
grep -rn "server" .
grep -rin "server" .
```

统计匹配行数：

```bash
grep -c "error" app.log
```

只显示匹配到的部分：

```bash
grep -o "server" config.yaml
```

高亮匹配内容：

```bash
grep --color=auto "server" config.yaml
```

先搜索，再只显示最后 5 条匹配结果：

```bash
grep -i "server" config.yaml | tail -n 5
```

### 2. 参数和管道

命令结构：

```bash
grep -i "server" config.yaml | tail -n 5
```

拆开：

```text
grep          命令
-i            参数/选项：忽略大小写
"server"      搜索内容
config.yaml   文件名
|             管道，把前一个命令输出交给后一个命令
tail          命令
-n 5          显示最后 5 行
```

参数分两类：

```text
开关型参数：不需要值，例如 grep -i、grep -n
带值型参数：需要值，例如 tail -n 5、grep -A 3、grep -m 5
```

### 3. 查看帮助：`--help` 和 `man`

查看命令帮助：

```bash
命令 --help
```

例如：

```bash
grep --help
tail --help
ls --help
```


看 `--help` 时，如果写了 `=NUM`、`=FILE`、`=PATTERNS`，通常表示需要额外的值。

---

## 五、权限与文件属性

### 1. 文件权限：`-rw-r--r--`

```text
-   rw-   r--   r--
│   │     │     │
│   │     │     └── 其他用户权限
│   │     └──────── 所属组权限
│   └────────────── 文件所有者权限
└─────────────────── 文件类型
```

含义：

```text
-     普通文件
rw-   所有者可读、可写、不可执行
r--   同组用户只读
r--   其他用户只读
```

权限字符：

| 字符 | 含义 |
| --- | --- |
| `r` | read，读取 |
| `w` | write，写入/修改 |
| `x` | execute，执行 |
| `-` | 没有该权限 |

文件类型：

```text
-  普通文件
d  目录
l  软链接
```

---

## 六、进程与系统状态

### 1. 查看进程：`ps`

默认只显示当前终端相关进程：

```bash
ps
```

显示系统中几乎所有进程：

```bash
ps aux
```

`aux` 含义：

```text
a   显示其他用户的进程
u   用户友好格式，显示 USER、CPU、MEM 等
x   显示没有终端的后台进程
```

常见字段：

```text
USER      谁启动的进程
PID       进程 ID
%CPU      CPU 占用
%MEM      内存占用
COMMAND   进程命令
```

搜索某个进程：

```bash
ps aux | grep nginx
ps aux | grep clash
```

注意：可能看到 `grep clash`，这是搜索命令本身。

更干净写法：

```bash
ps aux | grep '[c]lash'
```

### 2. 动态查看进程：`top`、`htop`

动态查看进程：

```bash
top
```

`top` 常用按键：

```text
q    退出
P    按 CPU 占用排序
M    按内存占用排序
k    杀进程，输入 PID
```

更好用的工具：

```bash
htop
```

安装：

```bash
sudo apt install htop
```

### 3. 查找和结束进程：`pgrep`、`kill`、`pkill`

只查 PID：

```bash
pgrep nginx
pgrep -a nginx
```

杀进程：

```bash
kill PID
kill -9 PID
pkill nginx
```

建议先普通 `kill`，没用再考虑 `kill -9`。

---

## 七、网络端口

### 查看网络端口：`ss`

查看 TCP 监听端口：

```bash
ss -lntp
```

查看 UDP 监听端口：

```bash
ss -lnup
```

参数含义：

```text
-l   listening，只看监听端口
-n   number，直接显示数字端口
-t   TCP
-u   UDP
-p   显示对应进程
```

---

## 八、压缩与解压

### 1. `tar.gz`

压缩：

```bash
tar -czvf archive.tar.gz 目录名
```

解压：

```bash
tar -xzvf archive.tar.gz
```

解压到指定目录：

```bash
tar -xzvf archive.tar.gz -C /tmp
```

参数：

```text
-c  create，创建压缩包
-x  extract，解压
-z  gzip 格式
-v  显示过程
-f  指定文件名
-C  指定解压目录
```

### 2. `zip`

压缩目录：

```bash
zip -r archive.zip 目录名
```

解压：

```bash
unzip archive.zip
```

解压到指定目录：

```bash
unzip archive.zip -d /tmp
```

---

## 九、下载与网络请求

### 1. 下载文件：`wget`

下载文件到当前目录：

```bash
wget URL
```

指定保存文件名：

```bash
wget -O newname.zip https://example.com/file.zip
```

断点续传：

```bash
wget -c https://example.com/bigfile.zip
```

### 2. 下载或请求内容：`curl`

下载文件，使用远程文件名保存：

```bash
curl -O URL
```

指定保存文件名：

```bash
curl -o newname.zip https://example.com/file.zip
```

注意：

```text
curl -O    使用远程原文件名
curl -o    自己指定文件名
```

断点续传：

```bash
curl -C - -O https://example.com/bigfile.zip
```

只查看网页或 API 返回内容：

```bash
curl https://example.com
```

---

## 十、软件安装与包管理

### 1. `apt`、`yum`、`wget` 区别

```text
apt / yum install   系统包管理器，负责安装软件
wget                只是从网络下载文件
```

Ubuntu / Debian：

```bash
sudo apt install git
```

CentOS / RHEL：

```bash
sudo yum install git
```

新一些的 CentOS/RHEL 系统可能用：

```bash
sudo dnf install git
```

`apt` 可以理解为 Linux 的应用商店 / 软件管家，负责：

1. 去哪里下载
2. 下载哪个版本
3. 需要哪些依赖
4. 安装到系统哪里
5. 以后怎么更新/卸载

### 2. `apt` 常用命令

```bash
sudo apt update       # 更新软件列表
sudo apt install git  # 安装软件
sudo apt remove git   # 卸载软件
sudo apt upgrade      # 升级已安装软件
```

---

## 十一、Docker 安装与软件源

### 1. Ubuntu 安装 Docker 示例

```bash
# 1. 更新 apt 软件列表
sudo apt update

# 2. 安装基础工具
sudo apt install -y ca-certificates curl git

# 3. 添加 Docker 官方 GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 4. 添加 Docker 官方 apt 软件源
sudo tee /etc/apt/sources.list.d/docker.sources << EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# 5. 再次更新 apt 软件列表
sudo apt update

# 6. 安装 Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 7. 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 8. 查看 Docker 是否安装成功
docker --version
docker compose version

# 镜像加速（可选）
bash <(wget -qO- https://xuanyuan.cloud/docker.sh)

# 查看 git 是否安装成功
git --version

# 拉取仓库
git clone https://gitee.com/lysssyo/apollo.git
```

### 2. 更新 apt 软件列表

```bash
sudo apt update
```

刷新软件源的软件清单，不是升级软件。

### 3. 安装基础工具

```bash
sudo apt install -y ca-certificates curl git
```

```text
ca-certificates   验证 HTTPS 证书
curl              下载网络内容
git               拉取代码仓库
-y                自动回答 yes
```

### 4. 创建 keyrings 目录

```bash
sudo install -m 0755 -d /etc/apt/keyrings
```

创建 `/etc/apt/keyrings`，用来存放软件源的 GPG key。

### 5. 下载 Docker 官方 GPG key

```bash
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
```

下载 Docker 官方公钥，用于验证 Docker 软件源和软件包没有被篡改。

`curl` 参数：

```text
-f   失败时报错
-s   静默模式
-S   失败时显示错误
-L   跟随重定向
-o   指定保存文件名
```

### 6. 设置 key 权限

```bash
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

让所有用户都能读取这个 key。

### 7. 添加 Docker 官方 apt 软件源

```bash
sudo tee /etc/apt/sources.list.d/docker.sources << EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

本质是创建文件：

```text
/etc/apt/sources.list.d/docker.sources
```

它告诉 `apt`：以后安装 Docker 时，去 Docker 官方软件源找。

示例内容：

```text
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
```

关键字段：

```text
URIs          软件从哪里下载
Suites        Ubuntu 版本代号，例如 noble、jammy、focal
Architectures 系统架构，例如 amd64、arm64
Signed-By     用哪个 GPG key 验证这个软件源
```

### 8. `tee` 为什么能写系统文件

```bash
sudo tee 文件名 << EOF
内容
EOF
```

`tee` 会把中间内容写入指定文件。因为 `tee` 前面加了 `sudo`，所以能写 `/etc/...` 这种系统目录。

不推荐这样写：

```bash
sudo echo "xxx" > /etc/apt/sources.list.d/docker.sources
```

因为 `>` 重定向不是由 `sudo` 执行的，可能权限不够。

### 9. GPG key 如何被用上

真正让 `apt` 使用 key 的是这一行：

```text
Signed-By: /etc/apt/keyrings/docker.asc
```

流程：

1. `apt update` 访问 Docker 官方软件源
2. 下载软件列表
3. 软件列表带有 Docker 官方数字签名
4. `apt` 用 `docker.asc` 这个公钥验证签名
5. 验证通过，说明来源可信
6. 之后 `apt install docker-ce` 才会信任并安装

类比：

```text
软件源 = 应用商店地址
GPG key = 这个应用商店的官方印章
Signed-By = 告诉 apt：检查这个商店时，用这个印章验证
```

