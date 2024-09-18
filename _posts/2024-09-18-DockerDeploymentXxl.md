---
title: docker部署xxl-job-admin
date: 2024-09-18 18:33:00 +0800
categories: [Docker, Deployment]
tags: [Docker, Deployment]
---
官方文档：[xuxueli/xxl-job-admin - Docker Image | Docker Hub](https://hub.docker.com/r/xuxueli/xxl-job-admin)

```
docker run -d \
    --name xxl-job-admin \
    --restart always \
    --network xuecheng \
    -p 8080:8080 \
    -v /data/xxl-job-admin/config/application.properties:/application.properties \
    -v /tmp:/data/applogs \
    -e PARAMS='--spring.config.location=/application.properties' \
    xuxueli/xxl-job-admin:2.3.1
```

`-e PARAMS='--spring.config.location=/application.properties'` 这一行设置了一个环境变量 `PARAMS`，其值为 `--spring.config.location=/application.properties`。这实际上是告诉 Spring Boot 应用程序在哪里可以找到配置文件。

**具体讲解：**

1. **Spring Boot 配置文件路径**：
   - Spring Boot 应用程序默认在类路径下查找配置文件。但是，如果配置文件不在默认位置，或者需要使用不同的配置文件路径，就需要通过 `--spring.config.location` 参数来指定配置文件的位置。
   - 在第二条命令中，`-e PARAMS='--spring.config.location=/application.properties'` 实际上将这个参数传递给了 `xxl-job-admin` 容器内的 Spring Boot 应用程序。这意味着 Spring Boot 应用程序会使用 `/application.properties` 作为配置文件的位置。
2. **为何需要这一行**：
   - 如果没有这一行，Spring Boot 应用程序可能会使用默认的配置文件路径。如果你的 `application.properties` 文件没有放在默认的位置（例如 `classpath:/config/application.properties`），那么 Spring Boot 无法找到正确的配置文件，就会导致数据库连接等配置问题。
   - 在你的情况下，数据库连接配置可能在 `application.properties` 中，而文件被挂载到了 `/application.properties` 路径。由于没有指定配置文件路径，Spring Boot 可能无法找到这个文件，导致连接不上数据库。

**具体而言：**

进入`xxl-job-admin`容器，使用`ls`命令查看所有文件

```
root@Lysssyo-Computer:~# docker exec -it xxl-job-admin /bin/sh
# ls
app.jar  application.properties  bin  boot  data  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run	sbin  srv  sys	tmp  usr  var
```

`app.jar`是`xxl-job-admin`的jar包，`application.properties`是通过`-v /data/xxl-job-admin/config/application.properties:/application.properties \`挂载到容器内的配置文件。但是，`app.jar`中的类路径下还有一个配置文件：

<img src="/assets/docker部署xxl-job-admin.assets/image-20240918183032335.png" alt="image-20240918183032335" style="zoom: 67%;" />

如果没有用`PARAMS`进行配置，程序会默认在类路径下找配置文件，所以挂载到容器的配置文件无法生效