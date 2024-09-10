---
title: 类路径与相对路径
date: 2024-09-10 22:43:00 +0800
categories: [Java, Grammar]
tags: [Java, Grammar,classPath]
---
# 类路径与相对路径

## 1. 类路径

类路径在这：

![image-20240910223606970](/assets/路径.assets/image-20240910223606970.png)

SpringBoot 会将 **`src/main/resources`** 下的文件**打包到类路径**中，**访问时需要通过类路径来定位**，而不是通过工作目录。

例如，如果要在`bootstrap.yaml`中定位`log4j2-dev.xml`应该这样写：

```yaml
# 日志文件配置路径
logging:
  config: classpath:log4j2-dev.xml
```



## 2. 相对路径

一般的`.java`文件，以及`.yaml`等配置文件的相对路径是**相对于程序运行时的工作目录**

可以通过 `System.getProperty("user.dir")` 来确认当前工作目录，`user.dir` 属性表示程序运行时的工作目录。

```java
public class LogFilePathChecker {
    public static void main(String[] args) {
        // 获取当前工作目录
        String currentDir = System.getProperty("user.dir");

        // 输出工作目录
        System.out.println("当前工作目录是: " + currentDir);
    }
}
```

![image-20240910230650722](/assets/路径.assets/image-20240910230650722.png)

所以，`xuecheng-plus-system-api`的工作目录是`D:\AAA_SecondDesktop\A_Technology\Test\xuecheng-plus`，那么如果`xuecheng-plus-system-api`的`log4j2`想把日志放在`xuecheng-plus`模块下的`logs`文件夹中，应该这样配置：

![image-20240910225745993](/assets/路径.assets/image-20240910225745993.png)

> `./`表示当前工作路径



## 3. 补充pom的相对路径

![image-20240910225455065](路径.assets/image-20240910225455065.png)

`../xuecheng-plus-parent` 表示相对路径的定位是从当前模块的 `pom.xml` 文件所在的目录向上一级，然后进入 `xuecheng-plus-parent` 目录，从那里找到父项目的 `pom.xml`。



以上表述不准确，学深一点再来补充吧。


