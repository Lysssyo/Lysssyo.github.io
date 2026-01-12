# resilience4j

[官方文档](https://resilience4j.readme.io/docs/getting-started)

[官方Demo](https://github.com/resilience4j/resilience4j-spring-boot2-demo)

## 1. 熔断器

> The CircuitBreaker is implemented **via a finite state machine** with **three normal states: CLOSED, OPEN and HALF_OPEN** and three special states METRICS_ONLY, DISABLED and FORCED_OPEN.
>
> The CircuitBreaker uses a **sliding window** to store and aggregate the outcome of calls. You can choose between a count-based sliding window and a time-based sliding window. The count-based sliding window aggregrates the outcome of the last N calls. The time-based sliding window aggregrates the outcome of the calls of the last N seconds.

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112193850498.png)

**核心参数**

|参数名|作用|
|---|---|
|`failureRateThreshold`|失败率阈值（百分比），超过则跳转到OPEN状态|
|`slowCallDurationThreshold`|定义慢调用的时间阈值（如2秒）|
|`permittedNumberOfCallsInHalfOpenState`|HALF_OPEN状态下允许的试探调用数，全部成功则回到CLOSED|
|`waitDurationInOpenState`|OPEN状态等待时间，之后自动或手动切换到HALF_OPEN|
|`slidingWindowType`|滑动窗口类型（`COUNT_BASED`基于调用次数，`TIME_BASED`基于时间窗口）|

**使用方式**

1. 注解方式

    ```java
    @Service
    public class UserService {
    
        // 当调用失败率达到阈值时，触发熔断
        @CircuitBreaker(name = "userService", fallbackMethod = "getUserFallback")
        public String getUser(String userId) {
            // 模拟可能失败的服务调用
            if (userId.equals("error")) {
                throw new RuntimeException("模拟服务失败");
            }
            return "User-" + userId;
        }
    
        // Fallback方法（参数需与原方法一致，最后加一个异常参数）
        private String getUserFallback(String userId, Exception ex) {
            return "Fallback User (CircuitBreaker triggered: " + ex.getMessage() + ")";
        }
    }
    ```

    对应配置文件

    ```yaml
    resilience4j:
      circuitbreaker:
        instances:
          userService:
            failureRateThreshold: 50     # 失败率阈值（%）
            slidingWindowSize: 10       # 滑动窗口大小
            minimumNumberOfCalls: 5     # 最小调用次数
            waitDurationInOpenState: 5s # OPEN→HALF_OPEN等待时间
    ```

2. 编程式配置（直接使用 Resilience4j API）

    ```java
    public class PaymentService {
    
        private final CircuitBreaker circuitBreaker;
    
        public PaymentService() {
            // 1. 自定义配置
            CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .failureRateThreshold(50)
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(10)
                .waitDurationInOpenState(Duration.ofSeconds(5))
                .build();
    
            // 2. 创建实例
            this.circuitBreaker = CircuitBreaker.of("paymentService", config);
        }
    
        public String processPayment(String orderId) {
            // 3. 使用装饰器执行受保护逻辑
            return circuitBreaker.executeSupplier(() -> {
                if (orderId.startsWith("FAIL")) {
                    throw new RuntimeException("支付失败");
                }
                return "Payment processed: " + orderId;
            });
        }
    }
    ```

3. 使用装饰器模式

    ```java
    @Service
    public class ResilienceServiceImpl implements ResilienceService {
    
        private final CircuitBreakerRegistry circuitBreakerRegistry;
        private final RateLimiterRegistry rateLimiterRegistry;
        private final RetryRegistry retryRegistry;
    
        public ResilienceServiceImpl(CircuitBreakerRegistry cbRegistry,
                                     RateLimiterRegistry rlRegistry,
                                     RetryRegistry retryRegistry) {
            this.circuitBreakerRegistry = cbRegistry;
            this.rateLimiterRegistry = rlRegistry;
            this.retryRegistry = retryRegistry;
        }
    
        @Override
        public <T> Supplier<T> decorate(String key, Supplier<T> call, Function<Throwable, T> fallback) {
            CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker(key, getCircuitBreakerConfig(key));
            RateLimiter rl = rateLimiterRegistry.rateLimiter(key, getRateLimiterConfig(key));
            Retry retry = retryRegistry.retry(key, getRetryConfig(key));
    
            return Decorators.ofSupplier(call)
                    .withCircuitBreaker(cb)
                    .withRateLimiter(rl)
                    .withRetry(retry)
                    .withFallback(Collections.singletonList(Throwable.class), fallback)
                    .decorate();
        }
    
        @Override
        public <T> CompletableFuture<T> decorateAsync(String key,
                                                      Supplier<CompletableFuture<T>> call,
                                                      Function<Throwable, CompletableFuture<T>> fallback) {
            CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker(key, getCircuitBreakerConfig(key));
            RateLimiter rl = rateLimiterRegistry.rateLimiter(key, getRateLimiterConfig(key));
            Retry retry = retryRegistry.retry(key, getRetryConfig(key));
    
            return Decorators.ofSupplier(call)
                    .withCircuitBreaker(cb)
                    .withRateLimiter(rl)
                    .withRetry(retry)
                    .withFallback(Collections.singletonList(Throwable.class), fallback)
                    .decorate()
                    .get()
                    .toCompletableFuture();
        }
    
        // 根据 key 动态配置策略（可扩展为从 Redis / YAML / Nacos 加载）
        private CircuitBreakerConfig getCircuitBreakerConfig(String key) {
            if (key.contains("/startCharging")) {
                return CircuitBreakerConfig.custom()
                        .failureRateThreshold(50)
                        .slidingWindowSize(10)
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .build();
            }
            return CircuitBreakerConfig.ofDefaults();
        }
    
        private RateLimiterConfig getRateLimiterConfig(String key) {
            if (key.contains("/queryToken")) {
                return RateLimiterConfig.custom()
                        .limitRefreshPeriod(Duration.ofSeconds(1))
                        .limitForPeriod(30)
                        .timeoutDuration(Duration.ofMillis(0))
                        .build();
            } else if (key.contains("/startCharging")) {
                return RateLimiterConfig.custom()
                        .limitRefreshPeriod(Duration.ofSeconds(1))
                        .limitForPeriod(5)
                        .timeoutDuration(Duration.ofMillis(0))
                        .build();
            }
            return RateLimiterConfig.ofDefaults();
        }
    
        private RetryConfig getRetryConfig(String key) {
            if (key.contains("/startCharging")) {
                return RetryConfig.custom()
                        .maxAttempts(2)
                        .waitDuration(Duration.ofMillis(300))
                        .build();
            }
            return RetryConfig.custom()
                    .maxAttempts(3)
                    .waitDuration(Duration.ofMillis(500))
                    .build();
        }
    }
    ```

对比以上两种使用方式，很明显注解的方式会比较简单，但是如果一个接口又要熔断、限流、重试，那么注解就要写很多，导致注解爆炸，解决方法可用采用一个自定义注解封装这几个注解。第三种方法我觉得是最好的，可用根据不同的业务的key从库中拿到熔断、限流、重试器的配置，然后通过注册器组装，再把原始调用封装进去就能用了，详见下一篇ApiClient

限流、重试的配置思路大体和上面一样，也可以参考官方文档和官方demo

## 2. 限流器

限流器的底层是令牌桶，不过不同于传统令牌桶

传统令牌桶是**持续匀速**添加令牌，而Resilience4j采用**离散补充**方式：

|类型|补充方式|示例（10个/10秒）|
|---|---|---|
|经典令牌桶|每1秒加1个|0.1个/毫秒|
|Resilience4j|每10秒加10个|瞬间补满|

这种设计优势：

1. 计算更简单（无需记录最后补充时间）
2. 性能更高（减少CAS操作次数）
3. 更适合突发流量控制

## 3. 重试

重试可以配置最大重试次数以及重试间隔时间，甚至这个重试间隔时间可以用函数配置，例如可以考虑指数退避函数

|组件|是否计入重试调用|原因说明|
|---|---|---|
|**限流器**|❌ 不计入|所有重试调用都发生在限流之后|
|**熔断器**|✅ 会计入|每次重试都会经过熔断器检查|
|**原始调用**|✅ 所有尝试都计入|每次重试都会进行实际调用|

## 4. Fallback

降级逻辑。

|模块|功能|执行位置|触发条件|
|---|---|---|---|
|**限流器**|控制请求速率|最外层|请求超过配额时立即拒绝|
|**熔断器**|防止下游过载|限流后|失败率达到阈值时自动熔断|
|**重试机制**|提高请求成功率|熔断后|对特定异常进行重试|
|**Fallback**|提供优雅降级|最内层|当所有保护机制都失败时执行|

```java
@Override
public <T> Supplier<T> decorate(String key, Supplier<T> call, Function<Throwable, T> fallback) {
    CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker(key, getCircuitBreakerConfig(key));
    RateLimiter rl = rateLimiterRegistry.rateLimiter(key, getRateLimiterConfig(key));
    Retry retry = retryRegistry.retry(key, getRetryConfig(key));

    return Decorators.ofSupplier(call)
            .withCircuitBreaker(cb)
            .withRateLimiter(rl)
            .withRetry(retry)
            .withFallback(Collections.singletonList(Throwable.class), fallback) // 由调用者定义
            .decorate();
}
```
