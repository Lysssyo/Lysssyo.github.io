---
date created: 2026-01-13 21:55:39
date modified: 2026-01-13 22:22:27
---
# go实现责任链

## 第一层：定义标准接口

``` go
package main

import "fmt"

// 1. 定义核心处理函数类型 (Handler)
// 比如：下单、支付、取消订单，都长这样
type OrderHandler func(orderID string) error

// 2. 定义中间件类型 (Middleware)
// 就像俄罗斯套娃：接收一个 Handler，吐出一个被包裹过的 Handler
type Middleware func(next OrderHandler) OrderHandler
```

---

## 第二层：编写核心业务

这是最里面的“肉馅”，也就是我们真正想做的事情。

``` go
// 核心业务逻辑：保存订单
// 这就是那个初始的 next，也是最里面的一层
func SaveOrder(orderID string) error {
    fmt.Println("💰 [核心业务] 正在写入数据库，订单号:", orderID)
    return nil // 成功
}
```

---

## 第三层：编写中间件

这是“饺子皮”和“外包装”。

中间件 A：日志记录 (Logger)

它在核心业务前后都做事。

``` go
func LoggerMiddleware(next OrderHandler) OrderHandler {
    // 返回一个新的函数（闭包）
    return func(orderID string) error {
        fmt.Println("📝 [日志层-开始] 收到请求...")
        
        // --- 关键点：调用下一层 ---
        err := next(orderID) 
        // -----------------------
        
        fmt.Println("📝 [日志层-结束] 请求处理完毕")
        return err
    }
}
```

中间件 B：权限检查 (Auth)

它演示了拦截功能。如果不满足条件，就不调 next 了。

``` go
func AuthMiddleware(next OrderHandler) OrderHandler {
    return func(orderID string) error {
        fmt.Println("👮 [权限层] 正在检查身份...")
        
        // 模拟：如果是 "BAD_ORDER"，则拦截
        if orderID == "BAD_ORDER" {
            fmt.Println("🚫 [权限层] 拦截！非法订单！")
            return fmt.Errorf("无权操作") // 直接返回错误，不调用 next了！
        }
        
        fmt.Println("✅ [权限层] 放行")
        // --- 关键点：调用下一层 ---
        return next(orderID)
    }
}
```

---

## 第四层：组装工具

``` go
// 把一堆中间件串起来
func Chain(mws ...Middleware) Middleware {
	// 啥也不做，就是返回一个函数
    return func(next OrderHandler) OrderHandler {
        // 从最后一个中间件开始，一层层往里包
        for i := len(mws) - 1; i >= 0; i-- {
            // mws[i] 是当前中间件 (比如 Auth)
            // next 是它要包裹的内容 (比如 Core)
            // 执行后，next 就变大了 (变成了 Auth(Core))
            next = mws[i](next) 
        }
        return next
    }
}
```

> [!TIP] 注意！！！
> 注意！`next = mws[i](next)` 这里其实执行了`mws[i]`的逻辑！！但是，可以注意到，所有`mws`的内层都没有代码！！而是直接return，并且，return的这个函数，又是`mws`的入参

---

## 第五层：最终组装与运行

把上面所有零件拼起来跑一次。

``` go
func main() {
    
    fmt.Println("=== 测试 1：正常订单 ===")
    Chain(Logger, Auth)(SaveOrder)("ORDER_001")
    // Chain(Logger, Auth) 返回值 func(Handler) Handler
    // ... (SaveOrder) 把 SaveOrder 方法放入前面的function，作为前面的参数
    // ... ("ORDER_001")  把参数传入前面生成的函数

    fmt.Println("\n=== 测试 2：非法订单 (测试拦截) ===")
    Chain(Logger, Auth)(SaveOrder)("BAD_ORDDER")
}
```

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260116141659265.png)


---

## 运行结果与执行流分析

当你运行这段代码，控制台会打印出如下内容。请配合下面的**执行流向图**看：

### 测试 1：正常订单

```
📝 [日志层-开始] 收到请求...      <-- 进入 Logger
👮 [权限层] 正在检查身份...        <-- Logger 调 next，进入 Auth
✅ [权限层] 放行                  <-- Auth 检查通过
💰 [核心业务] 正在写入数据库...     <-- Auth 调 next，进入 SaveOrder
📝 [日志层-结束] 请求处理完毕      <-- SaveOrder 返回，回溯到 Logger
```

### 测试 2：非法订单 (拦截)

```
📝 [日志层-开始] 收到请求...      <-- 进入 Logger
👮 [权限层] 正在检查身份...        <-- Logger 调 next，进入 Auth
🚫 [权限层] 拦截！非法订单！       <-- Auth 发现错误，直接 return error
📝 [日志层-结束] 请求处理完毕      <-- Auth 返回错误给 Logger，Logger 继续收尾
```

_(注意：核心业务 `SaveOrder` 根本没有被执行，被 Auth 层截断了)_

---

### 终极理解：那个 `for` 循环到底干了啥？

让我们再看一眼 `main` 函数里的这两行：

``` go
superHandler := Chain(Logger, Auth)(SaveOrder)
```

**在内存里发生了什么？**

1. **初始状态**：
    
    - 手里拿着 `next` = `SaveOrder` (核心)
        
2. **循环第一轮 (取 Auth)**：
    
    - 执行 `Auth(SaveOrder)`。
        
    - 现在的 `next` 变身了，它变成了：**`[先查权限，通过了再调 SaveOrder]`** 这个函数。
        
3. **循环第二轮 (取 Logger)**：
    
    - 执行 `Logger( 上面的next )`。
        
    - 现在的 `next` 又变身了，变成了：**`[先记日志，然后(先查权限，通过了再调SaveOrder)，最后记日志]`**。
        
4. **最终结果**：
    
    - 返回这个“大胖子”函数给 `superHandler`。
        

### 总结

这就是为什么 Go 的代码在**定义时**看起来很复杂（又是 `func` 又是 `return func`），但在**使用时**（Main 函数里）非常干净。

你只需要把积木搭好，剩下的交给那一层层的闭包去自动流转。这就是 Go 语言所谓“显式复杂，隐式简单”的设计哲学。