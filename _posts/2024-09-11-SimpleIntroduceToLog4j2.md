---
title: Log4j2简单介绍
date: 2024-09-11 09:07:00 +0800
categories: [Java, 日志框架]
tags: [Java, log4j2]
---

## 1. 模板

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Configuration monitorInterval="180" packages="">
    <properties>
        <property name="logdir">logs</property>
        <property name="PATTERN">%date{YYYY-MM-dd HH:mm:ss,SSS} %level [%thread][%file:%line] - %msg%n%throwable</property>
    </properties>
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="${PATTERN}"/>
        </Console>

        <RollingFile name="ErrorAppender" fileName="${logdir}/error.log"
            filePattern="${logdir}/$${date:yyyy-MM-dd}/error.%d{yyyy-MM-dd-HH}.log" append="true">
            <PatternLayout pattern="${PATTERN}"/>
            <ThresholdFilter level="ERROR" onMatch="ACCEPT" onMismatch="DENY"/>
            <Policies>
                <TimeBasedTriggeringPolicy interval="1" modulate="true" />
            </Policies>
        </RollingFile>

        <RollingFile name="DebugAppender" fileName="${logdir}/info.log"
            filePattern="${logdir}/$${date:yyyy-MM-dd}/info.%d{yyyy-MM-dd-HH}.log" append="true">
            <PatternLayout pattern="${PATTERN}"/>
            <ThresholdFilter level="DEBUG" onMatch="ACCEPT" onMismatch="DENY"/>
            <Policies>
                <TimeBasedTriggeringPolicy interval="1" modulate="true" />
            </Policies>
        </RollingFile>
        
        <!--异步appender-->
         <Async name="AsyncAppender" includeLocation="true">
            <AppenderRef ref="ErrorAppender"/>
            <AppenderRef ref="DebugAppender"/>
        </Async>
    </Appenders>
    
    <Loggers>
         <!--过滤掉spring和mybatis的一些无用的debug信息
        <logger name="org.springframework" level="INFO">
        </logger>
        <logger name="org.mybatis" level="INFO">
        </logger>-->
        <logger name="cn.itcast.wanxinp2p.consumer.mapper" level="DEBUG">
        </logger>

        <logger name="springfox" level="INFO">
        </logger>
		<logger name="org.apache.http" level="INFO">
        </logger>
        <logger name="com.netflix.discovery" level="INFO">
        </logger>
        
        <logger name="RocketmqCommon"  level="INFO" >
		</logger>
		
		<logger name="RocketmqRemoting" level="INFO"  >
		</logger>
		
		<logger name="RocketmqClient" level="WARN">
		</logger>

        <logger name="org.dromara.hmily" level="WARN">
        </logger>

        <logger name="org.dromara.hmily.lottery" level="WARN">
        </logger>

        <logger name="org.dromara.hmily.bonuspoint" level="WARN">
        </logger>
		
        <!--OFF   0-->
        <!--FATAL   100-->
        <!--ERROR   200-->
        <!--WARN   300-->
        <!--INFO   400-->
        <!--DEBUG   500-->
        <!--TRACE   600-->
        <!--ALL   Integer.MAX_VALUE-->
        <Root level="INFO" includeLocation="true">
            <AppenderRef ref="AsyncAppender"/>
            <AppenderRef ref="Console"/>
            <AppenderRef ref="DebugAppender"/>
        </Root>
    </Loggers>
</Configuration>
```

## 2. 核心组件

### 2.1 Appenders

Appender 用来指定日志输出到哪个地方，可以同时指定日志的输出目的地。

### 2.2  Layouts

布局器 Layouts用于控制日志输出内容的格式，让我们可以使用各种需要的格式输出日志。

### 2.3 Loggers

日志记录器，负责收集处理日志记录。Log4J中有一个特殊的logger叫做“root”，他是所有logger的根，也就意味着其他所有的logger都会直接或者间接地继承自root。

## 3. 具体讲解

### 3.1 Configuration

```xml
<Configuration monitorInterval="180" packages="">
</Configuration>
```

- `monitorInterval="180"`：Log4j2将每180秒自动检查一次配置文件的变化。如果文件发生了更改，配置将被重新加载。

- `packages=""`：指定自定义插件所在的包，当前为空，表示不使用任何自定义插件。

这个Log4j2配置文件设置了日志的格式、日志级别、以及不同类型的日志输出方式。以下是对该配置文件的详细解读：

### 3.2 Properties

```xml
    <properties>
        <property name="logdir">./logs</property>
        <property name="PATTERN">%date{YYYY-MM-dd HH:mm:ss,SSS} %level [%thread][%file:%line] - %msg%n%throwable</property>
    </properties>
```

- `logdir`：定义日志文件的存放目录为当前工作目录下的`logs`文件夹。
- `PATTERN`：指定日志的输出格式。这个格式会应用到日志的所有输出中。格式为：
  - `%date{YYYY-MM-dd HH:mm:ss,SSS}`：输出日期和时间，精确到毫秒。
  - `%level`：输出日志级别（如INFO、DEBUG等）。
  - `%thread`：输出日志记录发生时的线程名。
  - `%file:%line`：输出日志记录发生的文件名和行号。
  - `%msg`：输出日志消息内容。
  - `%n`：换行符。
  - `%throwable`：如果有异常，会输出异常堆栈信息。

### 3.3 **Appenders**

定义了日志输出的方式，包括控制台输出、滚动文件输出和异步输出。

- **Console Appender** (`Console`):

  ```xml
          <Console name="Console" target="SYSTEM_OUT">
              <PatternLayout pattern="${PATTERN}"/>
          </Console>
  ```

  - `target="SYSTEM_OUT"`：日志输出到标准输出（即控制台）。
  - 使用定义的`PATTERN`格式输出日志到控制台。

  

- **RollingFile Appender for Error Logs** (`ErrorAppender`):

  ```xml
          <RollingFile name="ErrorAppender" fileName="${logdir}/error.log"
              filePattern="${logdir}/$${date:yyyy-MM-dd}/error.%d{yyyy-MM-dd-HH}.log" append="true">
              <PatternLayout pattern="${PATTERN}"/>
              <ThresholdFilter level="ERROR" onMatch="ACCEPT" onMismatch="DENY"/>
              <Policies>
                  <TimeBasedTriggeringPolicy interval="1" modulate="true" />
              </Policies>
          </RollingFile>
  ```

  - `RollingFile` 是一个特殊的 `Appender`，它会在日志文件达到某些条件时（例如文件大小或时间）创建新的日志文件，保留多个日志文件的历史版本。

  - `fileName="${logdir}/error.log"`：错误日志存放在`logs/error.log`中（当日志记录时，它首先写入这个文件）。

  - `filePattern="${logdir}/$${date:yyyy-MM-dd}/error.%d{yyyy-MM-dd-HH}.log"`：按照每天滚动，将日志存储在不同的日期目录下，并且文件名包含小时信息（文件名模式是 `error.日期-小时.log`）。

    > 这里的 `$$` 是为了避免Log4j2将其解释为变量，因此 `$$` 会被当作 `$` 来处理。

  - `append="true"` 表示日志信息会追加到已有文件末尾，而不是每次覆盖这个文件。这样可以防止日志文件在每次应用启动时被清空。

  - `ThresholdFilter level="ERROR"`：只记录`ERROR`级别及以上的日志信息。

  - `TimeBasedTriggeringPolicy`：基于时间的日志滚动策略，每小时创建一个新的日志文件。

  补充：`ErrorAppender` 会将**当前的日志**输出到 `logs/error.log`，但在**每小时**触发滚动时，会将日志文件移动到 `logs/2024-09-10/` 目录下，并以 `error.2024-09-10-12.log` 的形式存储历史日志文件。

  - 在没有滚动时，日志始终写入 `logs/error.log`。
  - 当到达滚动条件（如每小时触发）时，现有的 `error.log` 会被归档，并按 `logs/2024-09-10/error.2024-09-10-12.log` 这样的格式存储。之后 `error.log` 文件会被清空，继续记录新的日志。

  因此，最终归档的日志会出现在 `logs/2024-09-10/` 目录中，而 `logs/error.log` 始终保存的是当前正在写入的日志内容。

  

- **RollingFile Appender for Debug Logs** (`DebugAppender`):

  ```xml
          <RollingFile name="DebugAppender" fileName="${logdir}/info.log"
              filePattern="${logdir}/$${date:yyyy-MM-dd}/info.%d{yyyy-MM-dd-HH}.log" append="true">
              <PatternLayout pattern="${PATTERN}"/>
              <ThresholdFilter level="DEBUG" onMatch="ACCEPT" onMismatch="DENY"/>
              <Policies>
                  <TimeBasedTriggeringPolicy interval="1" modulate="true" />
              </Policies>
          </RollingFile>
  ```

  - `fileName="${logdir}/info.log"`：信息日志存放在`logs/info.log`中。

  - `filePattern="${logdir}/$${date:yyyy-MM-dd}/info.%d{yyyy-MM-dd-HH}.log"`：同样按照每天滚动，并且文件名包含小时信息。

  - `ThresholdFilter level="DEBUG"`：只记录`DEBUG`级别及以上的日志信息。

    

- **Async Appender** (`AsyncAppender`):

  ```xml
          <!--异步appender-->
           <Async name="AsyncAppender" includeLocation="true">
              <AppenderRef ref="ErrorAppender"/>
              <AppenderRef ref="DebugAppender"/>
          </Async>
  ```

  - `<Async>` Appender 是 Log4j2 的一种异步日志输出方式，它将日志输出任务交给独立的线程来处理，而不是直接在当前线程中进行。这可以提高应用程序的性能，尤其是在大量日志写入时，因为它避免了日志写入操作阻塞主线程。

  - `includeLocation="true"`:

    - `includeLocation` 属性决定是否包含日志的源位置信息（如类名、方法名、文件名、行号等）。
    - `true` 表示在异步日志中仍然包含源代码位置信息（如 `[file:line]`），尽管这会带来一些性能开销。

  - `<AppenderRef ref="ErrorAppender"/>`:

    - `AppenderRef` 用来引用其他已经定义的 `Appender`，这里指向了 `ErrorAppender`。
    - 这意味着 `AsyncAppender` 会异步调用 `ErrorAppender` 来处理 `ERROR` 级别的日志。

    `<AppenderRef ref="DebugAppender"/>`:

    - 同样，`AsyncAppender` 也会异步调用 `DebugAppender` 来处理 `DEBUG` 级别的日志。

      

### 3.4 **Loggers**

定义了针对特定包或类的日志记录器的日志级别。

- **org.springframework 和 org.mybatis**：设置为`INFO`级别，过滤掉不必要的`DEBUG`信息。
- **cn.itcast.wanxinp2p.consumer.mapper**：设置为`DEBUG`级别，记录详细的调试信息。
- **springfox, org.apache.http, com.netflix.discovery**：设置为`INFO`级别，过滤掉低于`INFO`级别的日志。
- **RocketmqCommon, RocketmqRemoting**：设置为`INFO`级别，过滤掉低于`INFO`级别的日志。
- **RocketmqClient, org.dromara.hmily, org.dromara.hmily.lottery, org.dromara.hmily.bonuspoint**：分别设置为`WARN`级别，记录`WARN`及以上的日志信息。

### 3.5 **Root Logger**

- `level="DEBUG"`：根日志记录器的级别为`DEBUG`，即记录所有`DEBUG`及以上级别的日志信息。
- 包含三个Appender：
  - `AsyncAppender`：异步输出。
  - `Console`：控制台输出。
  - `DebugAppender`：文件输出。

例如，有如下的目录层次：

<img src="assets/Log4j2配置模板.assets/image-20240911095435628.png" alt="image-20240911095435628" style="zoom:80%;" />

## 4. 注意

使用log4j2时要排除其他的日志框架

```xml
        <!-- 排除 Spring Boot 依赖的日志包冲突 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter</artifactId>
            <exclusions>
                <exclusion>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-starter-logging</artifactId>
                </exclusion>
            </exclusions>
        </dependency>
```



附：Log4j2代码高亮设置

在Log4j 2.10以前的版本，pattern中配置%highlight属性是可以正常打印彩色日志的

例如：

```xml
        <Console name="Console" target="SYSTEM_OUT">
            <!--<PatternLayout pattern="${PATTERN}"/>-->
            <PatternLayout pattern="%d %highlight{%-5level}{ERROR=Bright RED, WARN=Bright Yellow, INFO=Bright Green, DEBUG=Bright Cyan, TRACE=Bright White} %style{[%t]}{bright,magenta} %style{%c{1.}.%M(%L)}{cyan}: %msg%n"/>
        </Console>
```

但是更新到2.10版本以后，控制台中就无法显示彩色日志了，各种级别的日志混杂在一起，难以阅读

通过查阅[官方文档](http://logging.apache.org/log4j/2.x/manual/layouts.html#enable-jansi)，发现在2.10版本以后，Log4j2默认关闭了Jansi（一个支持输出ANSI颜色的类库）

```
ANSI Styling on Windows
ANSI escape sequences are supported natively on many platforms but are not by default on Windows. To enable ANSI support add the Jansi jar to your application and set property log4j.skipJansi to false. This allows Log4j to use Jansi to add ANSI escape codes when writing to the console.

NOTE: Prior to Log4j 2.10, Jansi was enabled by default. The fact that Jansi requires native code means that Jansi can only be loaded by a single class loader. For web applications this means the Jansi jar has to be in the web container's classpath. To avoid causing problems for web applications, Log4j will no longer automatically try to load Jansi without explicit configuration from Log4j 2.10 onward.
```

可见，配置 log4j.skipJansi 这个全局属性即可。

IDEA中，点击右上角->Edit Configurations，在VM options中添加

```
-Dlog4j.skipJansi=false
```

启动应用，显示效果如下：

![image-20241101095546890](assets/2024-09-11-SimpleIntroduceToLog4j2.assets/image-20241101095546890.png)
