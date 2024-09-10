---
title: 类路径与相对路径
date: 2024-09-10 22:43:00 +0800
categories: [Java, Grammar]
tags: [Java, Grammar,classPath]
---
## 1. 类路径

![image-20240910223606970](/assets/路径.assets/image-20240910223606970.png)

> ```yaml
> # 日志文件配置路径
> logging:
>   config: classpath:log4j2-dev.xml
> ```

## 2. 相对路径

`./`表示当前工作路径。

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

![image-20240910224152773](/assets/路径.assets/image-20240910224152773.png)





