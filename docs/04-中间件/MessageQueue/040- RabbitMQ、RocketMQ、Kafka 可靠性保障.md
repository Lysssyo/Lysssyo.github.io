---
title: RabbitMQ、RocketMQ、Kafka 可靠性保障
category: 中间件
tags: [MessageQueue, RabbitMQ, RocketMQ, Kafka, 可靠性, 分布式]
---

# RabbitMQ、RocketMQ、Kafka 可靠性保障

为了保障消息中间件的**高可靠性（Reliability）**，即确保消息**不丢失**、**不重复**（或可去重）且**顺序正确**（视场景而定），RabbitMQ、RocketMQ 和 Kafka 在**生产者发送**、**Broker 存储**、**消费者消费** 这三个核心环节都有各自的机制。

## 1. RabbitMQ 的可靠性保障

RabbitMQ 是基于 AMQP 协议的，设计上非常注重消息的路由和投递确认。它的可靠性主要依赖于**确认机制**和**持久化**。

### (1) 生产者端：发布确认 (Publisher Confirms)

- **机制**：生产者将 Channel 设置为 `confirm` 模式。
    
- **流程**：消息发送到 Broker 后，Broker 会返回一个 `ack`（确认）或 `nack`（未确认）。
    
    - **普通消息**：消息写入磁盘（如果是持久化消息）后发送 Ack。
        
    - **仲裁队列**：消息被复制到大多数 Raft 节点后发送 Ack。
        
- **失败处理**：生产者收到 `nack` 或超时未收到响应，进行重试。
    
- **路由保障**：使用 `mandatory=true` 参数，如果消息无法路由到任何队列，Broker 会触发 `ReturnCallback` 将消息退回给生产者。
    

### (2) Broker 端：持久化与高可用

- **持久化 (Persistence)**：
    
    - **队列持久化**：声明队列时设置 `durable=true`。
        
    - **消息持久化**：发送消息时设置 `deliveryMode=2`。
        
- **高可用 (HA)**：
    
    - **仲裁队列 (Quorum Queues)**：**推荐**。基于 Raft 协议，支持大多数节点写入确认，数据强一致性，无单点故障。
        
    - **镜像队列 (Mirrored Queues)**：**已废弃**。主从同步复制，性能较差，网络分区易丢数据。
        

### (3) 消费者端：手动确认 (Manual Ack)

为了确认消费者是否成功处理消息，RabbitMQ 提供了消费者确认机制（**Consumer Acknowledgement**）。即：**当消费者处理消息结束后（处理消息的方法执行完毕）**，应该向RabbitMQ发送一个回执，告知 RabbitMQ 自己消息处理状态。回执有三种可选值：

- `ack`：成功处理消息，RabbitMQ 从队列中删除该消息。
- `nack`：消息处理失败，RabbitMQ 需要再次投递消息。
- `reject`：消息处理失败并拒绝该消息，RabbitMQ 从队列中删除该消息。

> [!TIP] 消费者确认机制有两种模式
> **自动确认 (Auto Ack)**：消息一发出去就认为成功（对应 Spring 的 `none`）
> **手动确认 (Manual Ack)**：消费者必须显式调用 `basicAck`、`basicNack` 或 `basicReject`。

- **机制**：关闭自动 Ack (`autoAck=false`)。
    
- **流程**：消费者处理完业务逻辑后，显式调用 `basicAck`。

#### 5.1.3.2 失败重试机制

如果消费者断开连接或发送 `nack(requeue=true)`，消息会回到 Queue 的头部（或尾部，取决于版本和类型），然后**立即**再次通过网络投递给消费者。消息requeue就会无限循环，导致MQ压力飙升。

RabbitMQ 处理失败消息的标准做法是配置队列的 `x-dead-letter-exchange` 属性。当消息被 `reject` 且 `requeue=false` 时，MQ 服务端会自动把消息挪到 DLX。

---

## 2. RocketMQ 的可靠性保障

RocketMQ 诞生于阿里电商业务，天然支持**金融级**可靠性，特别强调刷盘和复制策略的灵活配置。

### (1) 生产者端：同步发送与事务消息

- **同步发送**：`producer.send(msg)` 会阻塞等待 Broker 的 ACK 响应。如果返回 `SEND_OK`，表示发送成功。
    
- **重试机制**：如果发送失败，RocketMQ 客户端内部会自动重试（默认 2 次），并尝试切换到其他 Broker 节点。
    
- **事务消息**：支持分布式事务（半消息机制），确保本地事务执行与消息发送的原子性。
    

### (2) Broker 端：刷盘与复制策略 (核心差异点)

RocketMQ 的可靠性高度依赖配置：

- **刷盘策略 (Flush Strategy)**：
    
    - **同步刷盘 (SYNC_FLUSH)**：消息写入内存后，必须强制刷入磁盘（fsync）才返回成功。**（数据最安全，但吞吐低）**
        
    - **异步刷盘 (ASYNC_FLUSH)**：消息写入内存（PageCache）即返回成功，后台线程异步刷盘。**（吞吐高，断电可能丢少量数据）**
        
- **复制策略 (Replication Strategy)**：
    
    - **同步复制 (SYNC_MASTER)**：Master 收到消息后，必须同步给 Slave 才返回成功。**（高可靠，无单点故障）**
        
    - **异步复制 (ASYNC_MASTER)**：Master 写完即返回，异步传给 Slave。
        

### (3) 消费者端：ACK 与 消息重试

- **确认机制**：消费者注册监听器，返回 `ConsumeConcurrentlyStatus.CONSUME_SUCCESS` 才算消费成功。
    
- **自动重试**：如果业务抛出异常或返回 `RECONSUME_LATER`，RocketMQ 不会立刻丢弃消息，而是将消息放入**重试队列**，并按照**指数衰减**的时间间隔（1s, 5s, 10s...）进行多次重试（默认 16 次）。
    
- **死信队列**：重试耗尽后进入 DLQ，需人工干预。
    

---

## 3. Apache Kafka 的可靠性保障

Kafka 设计初衷是高吞吐的日志处理，但通过配置也可以实现极高的可靠性（CAP 中偏向 CP 或 AP 可调）。

### (1) 生产者端：`acks` 参数

- **`acks=0`**：发后即忘，不等待 Broker 确认。（不可靠，吞吐最高）
    
- **`acks=1`**：Leader 写入本地日志即返回确认。（Leader 挂掉可能丢数据）
    
- **`acks=all` (或 -1)**：Leader 等待所有 **ISR (In-Sync Replicas)** 列表中的副本都写入成功才返回确认。（**最可靠**）
    
- **幂等性**：开启 `enable.idempotence=true`，保证单分区内消息不重复。
    

### (2) Broker 端：ISR 与 副本机制

- **副本 (Replication)**：每个分区（Partition）有多个副本。
    
- **ISR (In-Sync Replicas)**：动态维护的、与 Leader 保持同步的副本集合。
    
- **`min.insync.replicas`**：**关键参数**。配合 `acks=all` 使用。例如设置为 2，表示至少要有 2 个副本（包括 Leader）写入成功，生产者才会收到成功响应。如果 ISR 数量少于此值，Broker 会拒绝写入。
    
- **`unclean.leader.election.enable=false`**：禁止非 ISR 节点竞选 Leader，防止数据丢失（牺牲可用性换一致性）。
    

### (3) 消费者端：Offset 提交

- **手动提交 (Manual Commit)**：关闭 `enable.auto.commit`。消费者处理完业务逻辑后，再调用 `commitSync()` 或 `commitAsync()`。
    
- **At-Least-Once**：如果消费了但没提交 Offset 就挂了，重启后会重复消费，需要业务端保证**幂等性**。
    

---

## 4. 横向对比总结表

|**维度**|**RabbitMQ**|**RocketMQ**|**Kafka**|
|---|---|---|---|
|**生产者确认**|Publisher Confirms (回调)|同步发送 (Sync Send)|`acks=all`|
|**Broker 落盘**|队列/消息声明为 Durable|配置 `SYNC_FLUSH` (同步刷盘)|依赖 OS PageCache，异步刷盘|
|**多副本同步**|Quorum Queues (Raft)|`SYNC_MASTER` (同步复制)|ISR 机制 + `min.insync.replicas`|
|**消费者确认**|Manual Ack (显式调用)|返回消费状态 (SUCCESS)|手动提交 Offset|
|**消费重试**|重新入队 (requeue)，易死循环|**原生支持 16 级延时重试**|需业务层自行实现 (死信/重试 Topic)|
|**极端场景可靠性**|**高** (金融级，强一致性)|**极高** (配置双 Sync 时)|**高** (配置 acks=all + min.isr > 1)|

