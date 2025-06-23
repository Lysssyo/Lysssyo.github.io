---
title: 基于Redis TTL实现心跳监测
date: 2025-06-23 09:00:00 +0800
categories: [中间件,Redis]
tags: []
---



## 1. 业务背景

充电平台中，基础设施平台会像运营商平台定时推送充电中的订单的状态信息（15秒一次），这是推模式，为了做推模式的兜底，需要拉模式，即对于长时间没有接收到心跳的订单，我们要主动去查询，基于Redis TTL，可以知道哪些订单没有收到推送



## 2. 实现

1. 启用 Redis Keyspace Notification

   ```
   CONFIG SET notify-keyspace-events Ex
   ```

2. 每次收到状态推送，为订单设置 Redis key，带 TTL（例如 90 秒）

   ```
   SET charging:status:order:123456 '{"soc": 80, "power": 4.5}' EX 90
   ```

3. 订阅频道`__keyevent@0__:expired`，当 key 过期（即 90 秒未更新），收到通知，触发拉取状态

> **触发方式**：被动触发，Redis 自动推送过期事件。
>
> **处理流程**：状态推送 → 更新 TTL key → 过期触发事件 → 监听器监听变化



## 3. 与其他方式的区别

### 3.1 Redis延迟队列

**实现**

1. 每次收到状态推送，将订单加入 Redis ZSet，score 设为“当前时间 + 90 秒”：

   ```
   ZADD delay_queue:order_status_check <current_timestamp + 90> 123456
   ```

2. 定时任务（例如每秒）轮询 ZSet，获取 score 小于当前时间的订单

   ```
   ZRANGEBYSCORE delay_queue:order_status_check 0 <current_timestamp> LIMIT 0 1000
   ```

3. 处理到期订单（拉取状态），然后移除

   ```
   ZREM delay_queue:order_status_check 123456
   ```

> **触发方式**：主动轮询，定时检查到期任务。
>
> **处理流程**：状态推送 → 加入 ZSet → 定时轮询 → 批量拉取状态 → 业务操作



### 3.2 任务表方式

**原理**：

1. 数据库维护任务表，记录每单的“上次拉取时间”（last_pull_time）和状态（order_id, status）。

2. 定时任务（例如每分钟）扫描任务表，查找 last_pull_time 距离当前时间超过 90 秒的订单：

   ```sql
   SELECT order_id FROM task_table WHERE status = 'CHARGING' AND last_pull_time < NOW() - INTERVAL 90 SECOND;
   ```

3. 对筛选出的订单触发拉取状态，更新任务表

> **触发方式**：主动轮询，依赖数据库查询。
>
> **处理流程**：状态推送 → 更新任务表 → 定时扫描 → 拉取状态 → 更新任务表



### 3.3 对比

| **对比项**           | **Redis TTL 到期事件**          | **Redis 延迟队列**                          | **任务表方式**                        |
| -------------------- | ------------------------------- | ------------------------------------------- | ------------------------------------- |
| **触发方式**         | 被动触发（事件驱动）            | 主动轮询（时间驱动）                        | 主动轮询（时间驱动）                  |
| **实时性**           | 毫秒级（过期立即触发）          | 秒级（受轮询频率限制，例如 1 秒）           | 分钟级（受扫描周期限制，例如 1 分钟） |
| **CPU 开销**         | 极低（SET O(1)，事件广播 O(1)） | 低（ZRANGEBYSCORE O(log N)，ZREM O(log N)） | 中高（数据库查询 O(N) 或 O(log N)）   |
| **内存/存储开销**    | 低（3000 key，几十 MB）         | 低（3000 ZSet 元素，几十 MB）               | 中（数据库表，索引+数据）             |
| **实现复杂度**       | 低（配置通知+订阅）             | 中（维护 ZSet+轮询+清理）                   | 高（数据库表+定时任务+索引优化）      |
| **扩展性（高并发）** | 中（<10 万 key 安全）           | 高（支持分片、批量处理）                    | 低（数据库瓶颈明显）                  |
| **可靠性**           | 中（需防集中过期）              | 高（ZREM 天然幂等）                         | 高（数据库持久化）                    |
| **动态调整能力**     | 低（TTL 不可取消/修改）         | 高（ZADD/ZREM 可调整）                      | 中（SQL 更新灵活但慢）                |
| **运维成本**         | 低（依赖 Redis 配置）           | 中（需监控轮询性能）                        | 高（需优化数据库性能）                |
| **适用场景**         | 实时性高、订单量中小            | 高并发、需任务管理                          | 可靠性要求高、实时性要求低            |



进一步思考——有什么适合Redis延迟队列的场景呢？

 延迟队列更适合以下场景：

1. **需要保留任务记录、具备补偿、幂等能力**
2. **业务复杂、不同类型任务需要不同处理逻辑**
3. **需要统一处理到期事件（如通知、状态变更）**
4. **批量拉取、异步处理能力更强的场景**

 TTL 更适合：

- 轻量、无需存储内容的超时检测，如**心跳丢失检测、登录态管理、缓存过期**

**示例**

| 业务场景                       | 推荐方式       | 原因                                 |
| ------------------------------ | -------------- | ------------------------------------ |
| 心跳检测超时，触发状态拉取     | Redis TTL      | 实现简单，丢一两个无影响             |
| 支付超时15分钟自动取消订单     | Redis 延迟队列 | 需记录订单信息、具备幂等性与补偿能力 |
| 发消息后 10 秒未读触发提醒     | 延迟队列       | 多任务类型，需统一触发机制           |
| 用户登录 30 分钟无操作自动下线 | Redis TTL      | 轻量、无需任务结构                   |



## 4. 对比MQ补偿

```
1. 发送 MQ 前 写任务表，任务状态为INIT
2. 发送 MQ 成功后，修改任务表，任务状态改为FINISH
3. 定时任务：扫描任务表中状态为INIT的任务，重发MQ
```

那么能不能用Redis TTL来做MQ补偿呢？

```
1. 发送 MQ 前 set key，设置 TTL（如60s）
2. 发送 MQ 成功后，del key
3. 若 key 未被删除，TTL 到期触发事件，说明消息未成功发送，触发补偿重发
```

**不行**

1. **不具备持久性保证**

   MQ 补偿的核心目标是：**在系统宕机/故障/丢包等情况下，也能恢复未成功发送的消息**。Redis 是内存型服务，即使开启持久化（AOF/RDB），也**无法保证 TTL 到期事件不丢**。

   举个例子：消息发出失败，Redis 宕机，那这个 TTL key 消失了，根本不会触发补偿。

2. **事件通知机制不可靠/不适合分布式**

   Redis 的 keyevent 机制在**集群模式下**并不保证所有节点都能感知 TTL 到期。比如你设置了 key 在 node1，而监听器在 node2，是监听不到的。



## 4. 示例

```java
import org.springframework.data.redis.listener.RedisMessageListenerContainer; 

@Configuration
public class RedisListenerConfig {

    @Autowired
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private RedisTtlExpiredListener redisTtlExpiredListener;

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer() {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();

        container.setConnectionFactory(redisConnectionFactory);

        // 监听过期事件频道
        container.addMessageListener(redisTtlExpiredListener, new PatternTopic("__keyevent@0__:expired"));

        return container;
    }
}
```

```java
@Slf4j
@Component
public class RedisTtlExpiredListener implements MessageListener {

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString(); // key名称

        // 只处理我们关心的 key 前缀
        if (!expiredKey.startsWith("charging:status:order:")) {
            return;
        }
        log.info("收到Redis过期事件: key = {}", expiredKey);

        // 提取订单ID
        String orderId = expiredKey.substring("charging:status:order:".length());

        // 异步处理，防止阻塞 Redis 线程
        CompletableFuture.runAsync(() -> {
            try {
                // do Something
            } catch (Exception e) {
                log.error("订单状态拉取异常，orderId = {}", orderId, e);
            }
        });
    }
}
```

