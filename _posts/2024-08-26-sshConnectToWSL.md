---
title: SSH连接WSL
date: 2024-08-26 14:07:00 +0800
categories: [WSL]
tags: [WSL, SSH]
---
1. 启动 WSL2

   确保你的 WSL2 实例正在运行。在 Windows 的命令提示符或 PowerShell 中输入 `wsl` 启动 WSL2。

2. 安装和配置 OpenSSH

   1. 安装 OpenSSH 服务器

      ```
      sudo apt update
      sudo apt install openssh-server
      ```

   2. 启动 OpenSSH 服务器

      ```
      sudo service ssh start
      ```

   3. 配置 SSH 服务以便它能够接受外部连接。编辑 SSH 配置文件

      ```
      sudo nano /etc/ssh/sshd_config
      ```

      确保以下配置项未被注释掉（去掉前面的 `#`）：

      ```
      Port 22
      PermitRootLogin yes
      PasswordAuthentication yes
      ListenAddress 0.0.0.0
      ```

      > 下面的截图是用2222端口，没差

      ![image-20240826135339074](/assets/SSH连接WSL.assets/image-20240826135339074.png)

   4. 重启 SSH 服务以应用配置

      ```
      sudo service ssh restart
      ```

3. 进入Xshell配置连接

   根据主机`localhost`，端口`2222`，以及用户和密码进行连接

   为什么能用localhost呢？说明如下：

   [使用 WSL 访问网络应用程序 | Microsoft Learn](https://learn.microsoft.com/zh-cn/windows/wsl/networking)

   <img src="/assets/SSH连接WSL.assets/image-20240826135917423.png" alt="image-20240826135917423" style="zoom: 80%;" />

   

   在实际操作中，有以下实践：

   WSL中部署了docker，docker中运行了容器mysql，mysql设置的端口映像是`  -p 3308:3306`。但是，在Windows中的Navicat连接3308的Mysql时，出现连接不上的问题。

   解决方法：

   删去`C:\Users\Lysssyo\.wslconfig`中的`networkingMode=mirrored`配置，即不启用镜像网络特性支持。（不知道为什么会有这个错误）