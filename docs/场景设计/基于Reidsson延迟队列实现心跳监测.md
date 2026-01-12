## 1. 业务背景

上游平台每 15 秒向本平台推送计费中的订单状态信息。为了确保系统的可靠性，我们不仅依赖推模式，还需要引入拉模式，以防推送丢失或延迟。拉模式可以通过 Redisson特性来识别哪些订单长时间没有接收到状态推送。

``` mermaid
sequenceDiagram

    %%--- 参与者 ---
    participant Upstream as 上游业务 / Producer
    participant MQ
    participant HBHandler as HeartbeatHandler<br/>(Redisson 客户端)
    participant RDelay as RDelayedQueue<br/>hb:compensate
    participant HBWatcher as HeartbeatWatcher<br/>(take 线程)
    participant Access as 设备接入服务

    %%--- 1. 上游推送心跳 ---
    Upstream ->> MQ: ChargingStatusEvent

    %%--- 2. 消费者续期 ---
    MQ ->> HBHandler: 消息
    HBHandler ->> RDelay: remove(orderId)<br/>offer(orderId, 90 s)

    %%--- 3. 心跳超时触发补偿 ---
    RDelay -->> HBWatcher: orderId (到期搬迁后 take)
    HBWatcher ->> Access: fetchOrderStatus(orderId)


```

## 2. 实现

**HeartbeatHandler — RabbitMQ 消费 & 续期**

@Component  
@RequiredArgsConstructor  
public class HeartbeatHandler {  
​  
    private static final String HB_QUEUE = "hb:compensate";      // 统一队列名  
    private final RedissonClient redisson;  
​  
    private RDelayedQueue<String> dq() {  
        RBlockingQueue<String> bq = redisson.getBlockingQueue(HB_QUEUE);  
        return redisson.getDelayedQueue(bq);  
    }  
​  
    /** RabbitMQ 监听心跳事件 */  
    @RabbitListener(queues = "${mq.heartbeat.queue}")      // MQ 绑定的队列  
    public void onHeartbeat(ChargingStatusEvent evt) {  
        String orderId = evt.getOrderId();  
        // 可以补充其他业务处理  
        RDelayedQueue<String> dq = dq();  
        dq.remove(orderId);  
        dq.offer(orderId, 90, TimeUnit.SECONDS);          // 90 s 无新心跳则触发补偿  
    }  
}

**HeartbeatWatcher — 到期补偿线程**

@Component  
@RequiredArgsConstructor  
public class HeartbeatWatcher {  
​  
    private static final String HB_QUEUE = "hb:compensate";  
​  
    private final RedissonClient redisson;  
​  
    @PostConstruct  
    public void start() {  
        Executors.newSingleThreadExecutor().submit(this::loop);  
    }  
​  
    /** 阻塞式 take —— 到期任务唯一消费 */  
    private void loop() {  
        RBlockingQueue<String> bq = redisson.getBlockingQueue(HB_QUEUE);  
        for (;;) {  
            try {  
                String orderId = bq.take();               // 原子获取到期订单  
                // 做后续业务处理  
            } catch (InterruptedException ie) {  
                Thread.currentThread().interrupt();  
                break;  
            } catch (Exception ex) {  
                // 日志 + 重试策略  
            }  
        }  
    }  
}

## 3. 与其他方案对比

|维度|**Redisson RDelayedQueue**（ZSet + BlockingQueue）|**Redis TTL + KeyspaceEvent**|**写任务表 / 轮询**（MySQL 或 PostgreSQL）|
|---|---|---|---|
|**触发机制**|_拉模型_——Redisson 内部每 1 s 扫描 bucket ZSet，将到期元素原子搬到 BlockingQueue，业务线程 `take()`|_推模型_——Key 到期时 Redis 主动 `PUBLISH __keyevent..:expired` 消息|_拉模型_——应用定时查询 `task_table WHERE next_time <= now()`|
|**实时性**|秒级（搬迁周期可调；500 ms–1 s 常用）|受 `hz` 与采样影响，典型 0.2–1 s；极端低密度时可达 10+ s|取决于轮询间隔（通常 ≥1 s，长则分钟级）|
|**可靠性**|At-Least-Once：元素留在 ZSet/List，实例宕机重启后仍可消费|Pub/Sub 无持久化；主从切换或客户端断线会丢事件，需要额外补偿逻辑|数据持久化在 DB；实例重启不会丢，但需处理锁与并发|
|**并发 & 去重**|`take()` 天然互斥，多实例不会重复；`remove+offer` 保证队列单元素|单实例订阅安全；多实例需自己幂等；事件风暴可压垮缓冲区|依赖 `UPDATE … WHERE status='NEW' LIMIT N` + 行锁；高并发易产生锁竞争|
|**代码复杂度**|业务只写 `offer` / `take`，逻辑清晰；Redisson 封装搬迁与阻塞|极简，但须配置通知 + 写补偿 + 调参 hz/effort + 处理丢事件|要建表、写 DAO、处理悲观/乐观锁、分片或分库|
|**Redis/DB 负荷**|仅“断链订单”写一次；搬迁批量 Lua 执行，命令数低|所有心跳刷新 TTL，写放大高；发送每条过期事件|DB 持续轮询；高 QPS 时 IO & 锁开销大|
|**扩展性**|Redis Cluster 支持；多实例水平扩容|多分片需对每个主节点订阅；事件易碎|DB table 热点可能成为瓶颈；需分片或迁移到 NoSQL|
|**运维关注点**|监控 queue size、Lua 执行时长；Redis OOM 前清理 bucket|监控 Pub/Sub 连接、event 丢失率；调优 active-expire|监控锁等待、慢查询；定期清理历史任务|
|**典型适用**|高实时性 + 高可靠性（<10 s 发现、万级 key）|实时性要求中等且 key 密度高；业务能容忍偶发漏事件|任务量小或需事务一致性（支付重算等）|