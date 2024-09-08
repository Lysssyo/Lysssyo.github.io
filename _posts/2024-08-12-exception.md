---
title: 全局异常处理器
date: 2024-08-12 22:05:00 +0800
categories: [Java, JavaWeb]
tags: [SpringBoot, RestControllerAdvice]
---
## @RestControllerAdvice与@ExceptionHandler实现全局异常处理

- @RestControllerAdvice

  `@RestControllerAdvice` = `@ControllerAdvice` + `@ResponseBody`

- @ControllerAdvice

  `@ControllerAdvice` 是一个全局增强注解，用于定义全局的异常处理、数据绑定、以及预处理功能。它可以在整个应用程序范围内捕获异常，并对特定控制器或者请求进行统一处理。

- @ResponseBody

  `@ResponseBody`注解用于将控制器的方法返回值直接写入 HTTP 响应体中，而不是解析为视图。这意味着方法返回的对象会自动转换为 JSON 或 XML 格式并返回给客户端。

- @ExceptionHandler

  `@ExceptionHandler` 是 Spring Framework 中用于处理异常的注解，它允许你在特定的控制器类或全局范围内捕获和处理异常。它通常与 `@ControllerAdvice` 或 `@RestControllerAdvice` 结合使用，以便全局处理控制器中的异常。

本文主要介绍`@RestControllerAdvice`与`@ExceptionHandler`注解实现全局异常处理。

**实现步骤**

1. 自定义异常类

`CommonException`

```java
@Getter
public class CommonException extends RuntimeException{
    private int code;

    public CommonException(String message, int code) {
        super(message);
        this.code = code;
    }

    public CommonException(String message, Throwable cause, int code) {
        super(message, cause);
        this.code = code;
    }

    public CommonException(Throwable cause, int code) {
        super(cause);
        this.code = code;
    }
}
```

`BadRequestException`

```java
public class BadRequestException extends CommonException{

    public BadRequestException(String message) {
        super(message, 400);
    }

    public BadRequestException(String message, Throwable cause) {
        super(message, cause, 400);
    }

    public BadRequestException(Throwable cause) {
        super(cause, 400);
    }
}
```

`BizIllegalException`

```java
public class BizIllegalException extends CommonException{

    public BizIllegalException(String message) {
        super(message, 500);
    }

    public BizIllegalException(String message, Throwable cause) {
        super(message, cause, 500);
    }

    public BizIllegalException(Throwable cause) {
        super(cause, 500);
    }
}
```

2. 创建全局异常处理器

```java
@RestControllerAdvice
@Slf4j
public class CommonExceptionAdvice {

    @ExceptionHandler(CommonException.class)
    public Object handleBadRequestException(CommonException e) {
        log.error("自定义异常 -> {} , 异常原因：{}  ",e.getClass().getName(), e.getMessage());
        log.debug("详细信息：", e); //为了当log.level为debug级别时在控制台输出堆栈详细信息。
        return processResponse(e);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Object handleMethodArgumentNotValidException(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getAllErrors()
                .stream().map(ObjectError::getDefaultMessage)
                .collect(Collectors.joining("|"));
        log.error("请求参数校验异常 -> {}", msg);
        log.debug("", e);
        return processResponse(new BadRequestException(msg));
    }

    @ExceptionHandler(BindException.class)
    public Object handleBindException(BindException e) {
        log.error("请求参数绑定异常 ->BindException， {}", e.getMessage());
        log.debug("", e);
        return processResponse(new BadRequestException("请求参数格式错误"));
    }

    @ExceptionHandler(NestedServletException.class)
    public Object handleNestedServletException(NestedServletException e) {
        log.error("参数异常 -> NestedServletException，{}", e.getMessage());
        log.debug("", e);
        return processResponse(new BadRequestException("请求参数处理异常"));
    }

    @ExceptionHandler(Exception.class)
    public Object handleRuntimeException(Exception e) {
        log.error("其他异常 uri : {} -> ", WebUtils.getRequest().getRequestURI(), e);
        return processResponse(new CommonException("服务器内部异常", 500));
    }

    private ResponseEntity<R<Void>> processResponse(CommonException e){
        return ResponseEntity.status(e.getCode()).body(R.error(e));
    }
}
```

> 注意全局异常处理器要放在启动类所在包或其子包下，如果不在启动类所在包或启动类所在包的子包，需要声明包扫描。
>
> 例如，`CommonExceptionAdvice`在`com.hmall.advice`下，而启动类在`com.hmall.cart`下，所以启动类需要声明包扫描：
>
> ```java
> @SpringBootApplication
> @MapperScan("com.hmall.cart.mapper")
> @ComponentScan(basePackages = {"com.hmall.advice","com.hmall.cart"})//声明包扫描
> @EnableFeignClients(basePackages = "com.hmall.api.clients",defaultConfiguration = DefaultFeignConfig.class)
> public class CartServiceApplication {
> 
>  public static void main(String[] args) {
>      SpringApplication.run(CartServiceApplication.class, args);
>  }
> 
> }
> ```

3. 假设业务代码中抛出错误

```java
    private void checkCartsFull(Long userId) {
        int count = lambdaQuery().eq(Cart::getUserId, userId).count();
        if (count >= cartProperties.getMaxAmount()) {
            throw new BizIllegalException(StrUtil.format("用户购物车课程不能超过{}", cartProperties.getMaxAmount()));
        }
    }
```

抛出的`BizIllegalException`继承自`CommonException`，而`CommonException`会被`CommonExceptionAdvice`中的`handleBadRequestException`方法处理

> 因为`handleBadRequestException`方法添加了`@ExceptionHandler(CommonException.class)`注解，表示该方法用于处理 `CommonException` 类型的异常。

![image-20240812215923052](/assets/@ControllerAdvice实现全局异常处理.assets/image-20240812215923052.png)



补充：日志级别

以这个配置为例：

```yaml
logging:
  level:
    com.hmall: debug
```

在 Spring Boot 的 `application.yml` 文件中，配置项 `logging.level.com.hmall: debug` 用于设置日志记录的级别。

- `logging:` 是日志配置的顶层键。
- `level:` 指定了日志级别。
- `com.hmall:` 是你要设置日志级别的包或类的名称。在这种情况下，它可能是你项目中的一个特定包或类。
- `debug` 是你为该包或类设置的日志级别。

具体来说，这条配置的含义是：将 `com.hmall` 包下的所有类的日志级别设置为 `debug`。这意味着所有在该包中的类会记录 `debug` 级别及其以上的日志信息（即 `debug`、`info`、`warn`、`error` 级别的日志都会被记录下来）。

日志级别从低到高分别为：

- `TRACE`
- `DEBUG`
- `INFO`
- `WARN`
- `ERROR`

选择合适的日志级别对于调试和排查问题非常重要。`debug` 级别通常用于开发环境中进行详细日志记录。