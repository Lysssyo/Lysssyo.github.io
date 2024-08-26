---
title: Docker安装
date: 2024-07-26 15:28:00 +0800
categories: [Docker]
tags: [setup]
---

本安装教程参考Docker官方文档以及黑马飞书文档，地址如下：

- https://docs.docker.com/engine/install/centos/
- [⁠安装Docker - 飞书云文档 (feishu.cn)](https://b11et3un53m.feishu.cn/wiki/Rfocw7ctXij2RBkShcucLZbrn2d)

# 1.卸载旧版

首先如果系统中已经存在旧的Docker，则先卸载：

```Shell
yum remove docker \
    docker-client \
    docker-client-latest \
    docker-common \
    docker-latest \
    docker-latest-logrotate \
    docker-logrotate \
    docker-engine
```

# 2.配置Docker的yum库

首先要安装一个yum工具

```Bash
yum install -y yum-utils
```

安装成功后，执行命令，配置Docker的yum源：

```Bash
yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
```

# 3.安装Docker

最后，执行命令，安装Docker

```Bash
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

# 4.启动和校验

```Bash
# 启动Docker
systemctl start docker

# 停止Docker
systemctl stop docker

# 重启
systemctl restart docker

# 设置开机自启
systemctl enable docker

# 执行docker ps命令，如果不报错，说明安装启动成功
docker ps
```

# 5.配置镜像加速

这里以阿里云镜像加速为例。

## 5.1.注册阿里云账号

首先访问阿里云网站:

https://www.aliyun.com/

注册一个账号。

## 5.2.开通镜像服务

在首页的产品中，找到阿里云的**容器镜像服务**：

![image-20240726152740387](/assets/Docker安装.assets/image-20240726152740387.png)

点击后进入控制台：

![image-20240726152733363](/assets/Docker安装.assets/image-20240726152733363.png)

首次可能需要选择立刻开通，然后进入控制台。

## 5.3.配置镜像加速

找到**镜像工具**下的镜像加速器：

![image-20240726152717806](/assets/Docker安装.assets/image-20240726152717806.png)

页面向下滚动，即可找到配置的文档说明：

![image-20240726152709974](/assets/Docker安装.assets/image-20240726152709974.png)

具体命令如下：

```Bash
# 创建目录
mkdir -p /etc/docker

# 复制内容，注意把其中的镜像加速地址改成你自己的
tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://xxxx.mirror.aliyuncs.com"]
}
EOF

# 重新加载配置
systemctl daemon-reload

# 重启Docker
systemctl restart docker
```