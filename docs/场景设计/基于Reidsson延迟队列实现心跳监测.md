# 基于Reidsson延迟队列实现心跳监测

## 1. 业务背景

上游平台推送的“桩状态”和“订单状态”消息，由于是异步消息推送，所以无法保证推送到本平台的消息顺序。

比如：在订单结束时，上游会推送 “订单结束（`status=4`）” 和 “订单计费结束（`status=5`）” 两条状态消息。

- 正常顺序：先推状态 4，再推状态 5。
- 乱序情况：可能因为网络原因，先收到状态 5，再收到状态 4。

如果直接处理，订单状态可能会先变成 5，然后又被回退成 4，导致数据不一致。

**为了保证最终状态一致性，我们希望实现：**

如果先收到了 `status=5`，那么之后再收到的 `status=4` 应该是无效的（即状态只能单向流转：`...->4->5`）。

**解决方案：**

使用 **Redisson 延迟队列**。当收到消息时，不立即处理，而是先放入延迟队列“缓冲”一段时间（比如 5 秒）。在 5 秒内，如果收到了多条关于同一个订单的消息，我们可以利用 Redis 缓存来辅助判断，只保留“最新/最终”的状态，或者在消费时进行校验。

其实，更简单的逻辑是：

1. 收到消息，先不处理，扔进延迟队列（delay = 5s）。
2. 5 秒后，消息出队，准备处理。
3. 处理前，查一下数据库（或 Redis 缓存）里该订单的当前状态。
4. 如果 **消息状态 > 当前状态**，则更新；否则丢弃。

但这里我们主要讨论 **Redisson 延迟队列的实现与心跳监测机制的结合**（或者说是利用延迟队列做超时监测，类似于上篇提到的 TTL 机制，但更灵活）。

这里提到的“心跳监测”场景可能是：

- 上游承诺每 15 秒推一次状态。
- 如果 90 秒没收到推送，我们认为上游断联或订单异常，需要主动查询。

利用 Redisson 延迟队列实现：

1. 收到推送，处理业务。
2. 同时，往延迟队列 `offer` 一个“检查任务”，延迟 90 秒。
3. 90 秒后，消费者收到这个“检查任务”。
4. 消费者检查：最近 90 秒内有没有收到过新的推送？
    - 如果收到了（有更新），忽略这个检查任务。
    - 如果没收到，说明超时了，触发主动查询。

## 2. 实现

### 2.1 依赖

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.17.0</version>
</dependency>
```

### 2.2 核心代码

**1. 定义队列**

```java
@Configuration
public class RedissonQueueConfig {

    @Bean
    public RBlockingQueue<String> blockingQueue(RedissonClient redissonClient) {
        // 目标阻塞队列
        return redissonClient.getBlockingQueue("order_timeout_check_queue");
    }

    @Bean
    public RDelayedQueue<String> delayedQueue(RBlockingQueue<String> blockingQueue, RedissonClient redissonClient) {
        // 绑定延迟队列
        return redissonClient.getDelayedQueue(blockingQueue);
    }
}
```

**2. 生产者（收到推送时）**

```java
@Service
public class OrderStatusListener {

    @Autowired
    private RDelayedQueue<String> delayedQueue;

    @Autowired
    private StringRedisTemplate redisTemplate;

    public void onMessage(String orderId) {
        // 1. 处理业务逻辑（省略）
        System.out.println("收到订单推送: " + orderId);

        // 2. 记录最后一次收到推送的时间
        redisTemplate.opsForValue().set("last_push_time:" + orderId, String.valueOf(System.currentTimeMillis()));

        // 3. 添加一个 90 秒后的检查任务
        // 注意：这里为了简单，直接发 orderId。实际可能需要发一个对象包含时间戳，防止ABA问题
        delayedQueue.offer(orderId, 90, TimeUnit.SECONDS);
    }
}
```

**3. 消费者（处理延迟任务）**

```java
@Component
public class TimeoutCheckConsumer implements CommandLineRunner {

    @Autowired
    private RBlockingQueue<String> blockingQueue;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Override
    public void run(String... args) throws Exception {
        new Thread(() -> {
            while (true) {
                try {
                    // 阻塞获取到期的任务
                    String orderId = blockingQueue.take();
                    checkTimeout(orderId);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }

    private void checkTimeout(String orderId) {
        // 获取最后一次推送时间
        String lastTimeStr = redisTemplate.opsForValue().get("last_push_time:" + orderId);
        if (lastTimeStr == null) {
            // 可能是订单已结束，缓存被清除了
            return;
        }

        long lastTime = Long.parseLong(lastTimeStr);
        long now = System.currentTimeMillis();

        // 如果 (当前时间 - 最后推送时间) >= 90秒 (允许一点误差)
        // 说明这 90 秒内没有新的推送更新 last_push_time
        if (now - lastTime >= 90 * 1000 - 1000) {
            System.out.println("订单 " + orderId + " 超时未推送，发起主动查询...");
            // TODO: 调用主动查询接口
        } else {
            System.out.println("订单 " + orderId + " 在检查期间有新推送，忽略本次检查");
        }
    }
}
```

## 3. 与其他方案对比

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| **Redis TTL (Key失效监听)** | 实现极其简单，利用 Redis 原生机制 | 1. **不可靠**：Redis 不保证立即触发过期事件，可能有延迟。<br>2. **不持久化**：发布订阅模式在 Redis 宕机期间会丢消息。<br>3. **广播风暴**：集群环境下所有实例都会收到过期通知。 |
| **Redis ZSet (手动轮询)** | 可靠性高，支持持久化，逻辑可控 | 需要自己写轮询线程（`zrangeByScore`），对 Redis 有持续的轮询压力。 |
| **RabbitMQ 延迟插件** | 消息中间件级别的可靠性，吞吐量高 | 需要安装插件，增加了运维成本。 |
| **Redisson 延迟队列** | **结合了 ZSet 的可靠性和 阻塞队列 的易用性**。<br>无需自己写轮询算法，API 友好。 | 依赖 Redisson 客户端，底层还是基于 Redis ZSet，大量延迟任务可能存在性能瓶颈（Lua 脚本执行）。 |

**结论：**

- 如果你的系统已经引入了 Redisson，且延迟任务量级在**中等规模**（万级/十万级），Redisson 延迟队列是一个非常优雅且开发成本低的方案。
- 相比 TTL 监听，它**可靠且支持持久化**。
- 相比手写 ZSet 轮询，它**封装好了复杂的细节**（时间轮、分发）。
