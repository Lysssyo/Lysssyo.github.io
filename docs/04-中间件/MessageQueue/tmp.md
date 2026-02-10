---
title: RabbitMQ 初识 - 可靠性、幂等性与延迟消息
category: 中间件
tags: [RabbitMQ, 消息队列, 可靠性, 幂等性, 延迟消息]
---

# RabbitMQ 核心机制详解

## 4. 可靠性

首先，我们一起分析一下消息丢失的可能性有哪些。

消息从发送者发送消息，到消费者处理消息，需要经过的流程是这样的：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200116883.png)

消息从生产者到消费者的每一步都可能导致消息丢失：

- **发送消息时丢失：**
    - 生产者发送消息时连接MQ失败
    - 生产者发送消息到达MQ后未找到`Exchange`
    - 生产者发送消息到达MQ的`Exchange`后，未找到合适的`Queue`
    - 消息到达MQ后，处理消息的进程发生异常
- **MQ导致消息丢失：**
    - 消息到达MQ，保存到队列后，尚未消费就突然宕机
- **消费者处理消息时：**
    - 消息接收后尚未处理突然宕机
    - 消息接收后处理过程中抛出异常

综上，我们要解决消息丢失问题，保证MQ的可靠性，就必须从3个方面入手：

1. 确保生产者一定把消息发送到MQ
2. 确保MQ不会将消息弄丢
3. 确保消费者一定要处理消息

---

### 4.1 生产者的可靠性

#### 4.1.1 生产者重试机制

修改`publisher`模块的`application.yaml`文件，添加下面的内容：

```yaml
spring:
  rabbitmq:
    connection-timeout: 1s # 设置MQ的连接超时时间
    template:
      retry:
        enabled: true # 开启超时重试机制
        initial-interval: 1000ms # 失败后的初始等待时间
        multiplier: 1 # 失败后下次的等待时长倍数，下次等待时长 = initial-interval * multiplier
        max-attempts: 3 # 最大重试次数
```

> [!WARNING] 注意
> 当网络不稳定的时候，利用重试机制可以有效提高消息发送的成功率。不过SpringAMQP提供的重试机制是**阻塞式**的重试，也就是说多次重试等待的过程中，当前线程是被阻塞的。
>
> 如果对于业务性能有要求，建议禁用重试机制。如果一定要使用，请合理配置等待时长和重试次数，当然也可以考虑使用异步线程来执行发送消息的代码。

#### 4.1.2 生产者确认机制

在少数情况下，也会出现消息发送到MQ之后丢失的现象，比如：

- MQ内部处理消息的进程发生了异常
- 生产者发送消息到达MQ后未找到`Exchange`
- 生产者发送消息到达MQ的`Exchange`后，未找到合适的`Queue`，因此无法路由

针对上述情况，RabbitMQ提供了生产者消息确认机制，包括`Publisher Confirm`和`Publisher Return`两种。在开启确认机制的情况下，当生产者发送消息给MQ后，MQ会根据消息处理的情况返回不同的**回执**。

> - `Publisher Confirm` 用于确认消息是否成功到达 RabbitMQ 服务器。
> - `Publisher Return` 用于处理不可路由的消息。

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200125646.png)

总结如下：

![image-20241024164554726.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241024164554726.png)

> [!IMPORTANT] 提示
> **当RabbitMQ成功接收到生产者发送的消息时，它会向生产者发送一个`Basic.Ack`命令**，表示消息已经被成功接收并准备进行后续的路由操作。
>
> `ack`和`nack`属于**Publisher Confirm**机制，`ack`是投递成功；`nack`是投递失败。而`return`则属于**Publisher Return**机制。

- **当消息投递到MQ，但是路由失败时**，通过**Publisher Return返回异常信息**，**同时返回ack的确认信息**，**代表投递成功**。
    
    > 路由失败跟MQ没有关系，路由失败只有两种原因：routine key填的不对、要么就是这个交换机没有队列给它绑定。MQ自己的内部机制是不可能失败的，一般在业务开发当中几乎不太可能会出现这种情况，因为一旦出现这种情况只能说明两件事，要么是代码写的有问题，要么是交换机的配置有问题，这都是开发人员导致的，完全可以在开发层面避免它。

- 临时消息投递到了MQ，并且入队成功，返回ACK，告知投递成功。
- 持久消息投递到了MQ，并且入队完成持久化，返回ACK ，告知投递成功。
- 其它情况都会返回NACK，告知投递失败。
    
    > 例如没有到达交换机；例如持久化消息入队但是未持久化。

**实现生产者确认机制：**

1. **在publisher模块的`application.yaml`中添加配置**

    ```yaml
    spring:
      rabbitmq:
        publisher-confirm-type: correlated # 开启publisher confirm机制，并设置confirm类型
        publisher-returns: true # 开启publisher return机制
    ```

    这里`publisher-confirm-type`有三种模式可选：
    - `none`：关闭confirm机制
    - `simple`：同步阻塞等待MQ的回执消息
    - `correlated`：MQ异步回调方式返回回执消息

2. **定义ReturnCallback**
    
    作用：监听消息是否从交换机成功传递到队列。
    
    每个`RabbitTemplate`只能配置一个`ReturnCallback`，因此我们可以在配置类中统一设置。我们在publisher模块定义一个配置类：
    
    ```java
    @Slf4j
    @AllArgsConstructor
    @Configuration
    public class MqConfig {
        private final RabbitTemplate rabbitTemplate;
    
        @PostConstruct
        public void init(){
            rabbitTemplate.setReturnsCallback(new RabbitTemplate.ReturnsCallback() {
                @Override
                public void returnedMessage(ReturnedMessage returned) {
                    log.error("触发return callback,");
                    log.debug("exchange: {}", returned.getExchange());
                    log.debug("routingKey: {}", returned.getRoutingKey());
                    log.debug("message: {}", returned.getMessage());
                    log.debug("replyCode: {}", returned.getReplyCode());
                    log.debug("replyText: {}", returned.getReplyText());
                }
            });
        }
    }
    ```

    > `@PostConstruct`注解：在bean被创建并完成属性注入后，执行一些初始化操作（带有@PostConstruct注解的方法会被自动调用）。

    也可以这样写：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112213732607.png)
    
3. **定义ConfirmCallback**
    
    由于每个消息发送时的处理逻辑不一定相同，因此ConfirmCallback需要在每次发消息时定义。具体来说，是在调用RabbitTemplate中的convertAndSend方法时，多传递一个参数：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200154070.png)

    这里的`CorrelationData`中包含两个核心的东西：
    - `id`：消息的唯一标示，MQ对不同的消息的回执以此做判断，避免混淆。
    - `SettableListenableFuture`：回执结果的Future对象。
    
    将来MQ的回执就会通过这个`Future`来返回，我们可以提前给`CorrelationData`中的`Future`添加回调函数来处理消息回执：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200159141.png)

    **测试代码：**
    
    ```java
    @Test
    void testPublisherConfirm() {
        // 1.创建CorrelationData
        CorrelationData cd = new CorrelationData();
        // 2.给Future添加ConfirmCallback
        cd.getFuture().addCallback(new ListenableFutureCallback<CorrelationData.Confirm>() {
            @Override
            public void onFailure(Throwable ex) {
                // 2.1.Future发生异常时的处理逻辑，基本不会触发
                log.error("send message fail", ex);
            }
            @Override
            public void onSuccess(CorrelationData.Confirm result) {
                // 2.2.Future接收到回执的处理逻辑，参数中的result就是回执内容
                if(result.isAck()){ // result.isAck()，boolean类型，true代表ack回执，false 代表 nack回执
                    log.debug("发送消息成功，收到 ack!");
                }else{ // result.getReason()，String类型，返回nack时的异常描述
                    log.error("发送消息失败，收到 nack, reason : {}", result.getReason());
                }
            }
        });
        // 3.发送消息
        rabbitTemplate.convertAndSend("hmall.direct", "q", "hello", cd);
    }
    ```

    **情况示例：**
    
    1. **没有到达交换机**
        ![image-20240821201948884.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821201948884.png)
        
    2. **到了交换机路由失败**
        ![image-20240821202128683.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821202128683.png)
        
    3. **到了交换机且路由成功**
        ![image-20240821203202210.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821203202210.png)



---

### 4.2 MQ的可靠性

消息到达MQ以后，如果MQ不能及时保存，也会导致消息丢失，所以MQ的可靠性也非常重要。

> [!TIP] 提示
> 1. 消息发送到MQ默认是发送到内存，mq在内存满的情况下，会持久化一部分到磁盘，然而这个过程较为耗时，所以这个过程中发送过来的消息就相当于丢失了。
> 2. SpringAMQP创建的消息、队列、交换机默认都是持久化的。

#### 4.2.1 数据持久化

为了提升性能，默认情况下MQ的数据都是在内存存储的临时数据，重启后就会消失。为了保证数据的可靠性，必须配置数据持久化，包括：

- 交换机持久化
- 队列持久化
- 消息持久化

1. **交换机持久化**
    在控制台的`Exchanges`页面，添加交换机时可以配置交换机的`Durability`参数：
    设置 `durable=true`，表示**RabbitMQ 重启后交换机仍然存在**，不会丢失。
    ![image-20240821211201804.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821211201804.png)

    > SpringAMQP创建的交换机默认持久化：
    > ```java
    > @Configuration  
    > public class DirectConfig {  
    >     @Bean  
    >     public DirectExchange directExchange(){
    >         return ExchangeBuilder.directExchange("hmall.direct").build();  
    >     }
    > }
    > ```
    
2. **队列持久化**
    设置 `durable=true`，表示**RabbitMQ 重启后队列还存在**（队列结构保留），不会丢失。
    SpringAMQP创建的队列默认持久化。
    ```java
    @Configuration  
    public class DirectConfig {  
        @Bean  
        public DirectExchange directExchange(){
            return ExchangeBuilder.directExchange("hmall.direct").build();  
        }
        @Bean  
        public Queue directQueue1(){
            return new Queue("hmall.direct.queue1");  
        }
        @Bean  
        public Binding bindingQueue1WithRed(Queue directQueue1, DirectExchange directExchange){
            return BindingBuilder.bind(directQueue1).to(directExchange).with("q");  
        }
    }
    ```
    
3. **消息持久化**
    消息在发送时，设置 `deliveryMode=2`（持久化模式），表示消息会**写入磁盘**，即使 RabbitMQ 异常宕机也能恢复。
    SpringAMQP创建的消息默认持久化。
    ```java
    @Test  
    public void testSendMap() throws InterruptedException {
        Map<String,Object> msg = new HashMap<>();  
        msg.put("name", "柳岩");  
        msg.put("age", 21);  
        rabbitTemplate.convertAndSend("object3.queue", msg);
    }
    ```
    ![image-20240821211717209.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821211717209.png)

#### 4.2.2 LazyQueue

在默认情况下，RabbitMQ会将接收到的信息保存在内存中以降低消息收发的延迟。但在某些特殊情况下，这会导致消息积压，比如：
- 消费者宕机或出现网络故障
- 消息发送量激增，超过了消费者处理速度
- 消费者处理业务发生阻塞

一旦出现消息堆积问题，RabbitMQ的内存占用就会越来越高，直到触发内存预警上限。此时RabbitMQ会将内存消息刷到磁盘上，这个行为成为`PageOut`. `PageOut`会耗费一段时间，并且会阻塞队列进程。因此在这个过程中RabbitMQ不会再处理新的消息，生产者的所有请求都会被阻塞。

为了解决这个问题，从RabbitMQ的3.6.0版本开始，就增加了LazyQueues的模式，也就是惰性队列。惰性队列的特征如下：
- 接收到消息后**直接存入磁盘**而非内存（对写入磁盘的IO操作做了优化）。
- 消费者要消费消息时才会从磁盘中读取并加载到内存（也就是懒加载）。
- 支持数百万条的消息存储。

而**在3.12版本之后，LazyQueue已经成为所有队列的默认格式。**因此官方推荐升级MQ为3.12版本或者所有队列都设置为LazyQueue模式。

**代码配置Lazy模式：**

在利用SpringAMQP声明队列的时候，添加`x-queue-mod=lazy`参数也可设置队列为Lazy模式：

```java
@Bean  
public Queue lazyQueue(){
    return QueueBuilder  
            .durable("lazy.queue")  
            .lazy() // 开启Lazy模式  
            .build();  
}
```

> 这里是通过`QueueBuilder`的`lazy()`函数配置Lazy模式，底层源码如下：
> ![image-20240821213137634.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821213137634.png)

当然，我们也可以基于注解来声明队列并设置为Lazy模式：

```java
@RabbitListener(queuesToDeclare = @Queue(  
        name = "lazy.queue",  
        durable = "true",  
        arguments = @Argument(name = "x-queue-mode", value = "lazy")  
))
public void listenLazyQueue(String msg){
    log.info("接收到 lazy.queue的消息：{}", msg);
}
```

> 队列接收到信息后：
> ![image-20240821214413681.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821214413681.png)
> 
> 如果不是lazyQueue：
> ![image-20240821215207435.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821215207435.png)

> [!INFO] 数据解释
> **消息（总数、就绪、未确认）**：
> - **总数**：队列中的消息总数，在本例中为 `1`。
> - **就绪**：准备好被发送到消费者但尚未发送的消息数量，这里是 `1`。
> - **未确认**：已发送给消费者但尚未被确认的消息数量，这个值为 `0`，意味着没有消息在等待确认。
>
> **处理内存（总数、内存中、持久、临时、分页出）**：
> - **总数**：队列中消息使用的总内存，为 `19 KiB`（19 千字节）。
> - **内存中**：存储在内存中的消息大小，为 `18 B`。
> - **持久**：标记为持久的消息大小，为 `18 B`。持久消息是指那些在代理重启后仍然存在的消息。
> - **临时**：临时消息（非持久消息）的大小，为 `0 B`，表示没有临时消息。
> - **分页出**：由于内存压力而被分页到磁盘的消息大小，为 `0 B`，表示没有消息被分页出。

---

### 4.3 消费者的可靠性

当RabbitMQ向消费者投递消息以后，需要知道消费者的处理状态如何。因为消息投递给消费者并不代表就一定被正确消费了，可能出现的故障有很多，比如：
- 消息投递的过程中出现了网络故障
- 消费者接收到消息后突然宕机
- 消费者接收到消息后，**因处理不当导致异常**

一旦发生上述情况，消息也会丢失。因此，RabbitMQ必须知道消费者的处理状态，一旦消息处理失败才能重新投递消息。

#### 4.3.1 消费者确认机制

为了确认消费者是否成功处理消息，RabbitMQ提供了消费者确认机制（**Consumer Acknowledgement**）。即：**当消费者处理消息结束后（处理消息的方法执行完毕）**，应该向RabbitMQ发送一个回执，告知RabbitMQ自己消息处理状态。回执有三种可选值：
- `ack`：成功处理消息，RabbitMQ从队列中删除该消息。
- `nack`：消息处理失败，RabbitMQ需要再次投递消息。
- `reject`：消息处理失败并拒绝该消息，RabbitMQ从队列中删除该消息。

由于消息回执的处理代码比较统一，因此SpringAMQP帮我们实现了消息确认。并允许我们通过配置文件设置ACK处理方式，有三种模式：

- **`none`**：不处理。即消息投递给消费者后立刻ack，消息会立刻从MQ删除。非常不安全，不建议使用。
- **`manual`**：手动模式。需要自己在业务代码中调用api，发送`ack`或`reject`，存在业务入侵，但更灵活。
    
    ```java
    @RabbitListener(queues = RabbitmqConfig3.CRM_ORDER_QUEUE, concurrency = "8")  
    public void onMessage(@Payload OrderFinishedEvent event, Message message, Channel channel) throws Exception {  
        long tag = message.getMessageProperties().getDeliveryTag();  
        int retry = (int) message.getMessageProperties().getHeaders().getOrDefault("x-retry", 0);
        try {  
            if (!dedupService.claim(event.getOrderId())) {  
                log.info("[MQ] duplicate order {} ignored", event.getOrderId());  
                channel.basicAck(tag, false);
                return;  
            }
            crmClient.push(event);
            log.info("[MQ] pushed order {} to CRM", event.getOrderId());  
            channel.basicAck(tag, false);
        } catch (Exception ex) {  
            log.error("[MQ] push fail order {} retry {}", event.getOrderId(), retry, ex);
            if (retry < MAX_RETRY) {  
                message.getMessageProperties().getHeaders().put("x-retry", retry + 1);
                channel.basicNack(tag, false, false); // 进入 DLX 延迟队列  
            } else {  
                dedupService.markFailed(event.getOrderId());  
                channel.basicAck(tag, false);
            }
        }
    }
    ```
    
    在 `Channel` 层面，**`basicAck` 和 `basicNack`** 是 RabbitMQ _显式确认_（manual acknowledge）协议的核心 API：
    
    **1. `channel.basicAck(long deliveryTag, boolean multiple)`**
    | 参数 | 作用 | 
    | :--- | :--- |
    | `deliveryTag` | **通道内自增序号**，代表_哪一条_消息被确认。由 `MessageProperties#getDeliveryTag()` 取得。 |
    | `multiple` | `true` = 把 **到当前 tag 为止的所有未确认消息** 一起确认（批量）；`false` = 仅当前这条。 |
    
    > **语义**：Broker 收到 ACK 后就立即把这条消息从队列的 _unacked_ 区域删除，永不再投递。
    
    **2. `channel.basicNack(long deliveryTag, boolean multiple, boolean requeue)`**
    | 参数 | 作用 |
    | :--- | :--- |
    | `deliveryTag` | 和 ACK 一样，指明哪条消息（或在哪之前的多条）。 |
    | `multiple` | 批量 NACK；通常保持 `false`，避免把“健康消息”一起打回。 |
    | `requeue` | `true` = 直接回到**同一个队列尾部**；`false` = **不回原队列**，而是走 **死信逻辑**。 |
    
    为何示例代码写 `requeue=false`？
    1. **需要延迟重试**：回到同队列不会产生延迟，又会立即被同集群消费，形不成退避。
    2. **防止“消息打滚”**：如果 CRM 永远 500，立刻重投 → 又失败 → 再重投 … 队列会被卡死。
    3. **让 DLX + TTL 队列接管** 重试节奏（30 s / 5 min …）。
        
- **`auto`**：自动模式。SpringAMQP利用AOP对我们的消息处理逻辑做了环绕增强，当业务正常执行时则自动返回`ack`. 当业务出现异常时，根据异常判断返回不同结果：
    - 如果是**业务异常**，会自动返回`nack`；
    - 如果是**消息处理或校验异常**，自动返回`reject`;
    > ![image-20240821225616085.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821225616085.png)

通过下面的配置可以修改SpringAMQP的ACK处理方式：

```yaml
spring:  
  rabbitmq:  
    listener:  
      simple:  
        acknowledge-mode: none # 不做处理
```

**测试对比：**

- **测试1：配置为 `none`**
    消费者在处理信息时抛出异常，信息会被直接从队列中删去。
- **测试2：配置为 `auto` 抛出 `MessageConversionException`**
    SpringAMQP 自动返回 `reject`，信息被直接删去。
- **测试3：配置为 `auto` 抛出 `RuntimeException`**
    SpringAMQP 自动返回 `nack`，RabbitMQ 会重新投递。

#### 4.3.2 失败重试机制

当消费者出现异常后，消息会不断requeue（重入队）到队列，再重新发送给消费者。如果消费者一直无法执行成功，消息requeue就会无限循环，导致MQ压力飙升。

为了应对上述情况Spring提供了**消费者失败重试机制：在消费者出现异常时利用本地重试**，而不是无限制的requeue。

```yaml
spring:  
  rabbitmq:  
    listener:  
      simple:  
        retry:  
          enabled: true # 开启消费者失败重试  
          initial-interval: 1000ms # 初始的失败等待时长为1秒  
          multiplier: 1 # 下次等待时长倍数
          max-attempts: 3 # 最大重试次数  
          stateless: true # true无状态；false有状态
```

> [!CAUTION] 注意
> 失败后**同一条消息仍占用消费线程**；若重试间隔较长，线程被 block，吞吐骤降。内部重试仅适合“毫秒级、极少次数”的瞬时异常。

**什么时候可以只用内部重试？**
| 典型场景 | 原因 |
| :--- | :--- |
| 数据库偶发死锁、网络抖动 | RT<50 ms，重试 1-2 次即可；长时间挂起线程影响小 |
| 同步调用链需要“失败即回滚” | 不允许最终一致；要么立即成功，要么全局事务回滚 |
| 运维限制 | 小团队可权衡先用内部重试，后期再切 DLX |

#### 4.3.3 失败处理策略

本地重试达到最大次数后，默认会丢弃消息。Spring允许自定义重试耗尽后的策略，由`MessageRecovery`接口定义：
- `RejectAndDontRequeueRecoverer`：直接 `reject`，丢弃消息（默认）。
- `ImmediateRequeueMessageRecoverer`：返回 `nack`，重新入队。
- **`RepublishMessageRecoverer`**：将失败消息投递到指定的交换机。

**比较优雅的方案是 `RepublishMessageRecoverer`**，将失败消息投递到一个专门存放异常消息的队列，后续人工介入。

![image-20240824161026114.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240824161026114.png)

**完整配置示例：**

```java
@Configuration  
@ConditionalOnProperty(name = "spring.rabbitmq.listener.simple.retry.enabled", havingValue = "true")  
public class ErrorMessageConfig {  
    @Bean  
    public DirectExchange errorMessageExchange(){
        return new DirectExchange("error.direct");  
    }
    @Bean  
    public Queue errorQueue(){
        return new Queue("error.queue", true);  
    }
    @Bean  
    public Binding errorBinding(Queue errorQueue, DirectExchange errorMessageExchange){
        return BindingBuilder.bind(errorQueue).to(errorMessageExchange).with("error");  
    }
    @Bean  
    public MessageRecoverer republishMessageRecoverer(RabbitTemplate rabbitTemplate){
        return new RepublishMessageRecoverer(rabbitTemplate, "error.direct", "error");  
    }
}
```

---

### 4.4 兜底方案

核心在于**主动查询**。

例如：支付服务的MQ通知失败时，交易服务利用**定时任务**定期查询支付状态。

**总结一致性保证：**
1. 支付成功后发送MQ消息。
2. 开启生产者/消费者确认、失败重试、持久化。
3. 设置定时任务作为兜底，确保最终一致性。

---

## 5. 业务幂等性处理

幂等是指同一个业务执行一次或多次对业务状态的影响是一致的。

### 5.1 唯一消息ID
1. 消息生成唯一ID。
2. 消费后将ID存入数据库。
3. 再次收到同ID消息时通过查询数据库跳过。

SpringAMQP可以通过开启 `jjmc.setCreateMessageIds(true)` 自动生成ID。

### 5.2 业务状态判断
基于业务本身的状态来判断（例如：更新订单前检查状态是否仍为“未支付”）。

---

## 6. 顺序性

乱序场景：
- 一个队列多个消费者。
- 一个消费者内部多线程处理。

**保证顺序性：**
- **拆分多个 Queue**：按业务 key 分片，每队列一个消费者。
- **消费端内存队列**：单消费者接收，内部维护内存Map，根据 key 路由到本地 worker 串行执行。

---

## 7. 延迟消息

用于一段时间以后才执行的任务，如“超时未支付自动取消订单”。

### 7.1 死信交换机（DLX）+ TTL

当消息满足以下情况会成为死信：
- TTL 过期。
- 被 NACK/Reject 且 `requeue=false`。
- 队列超长。

**延迟重试流转：**
`[业务队列] --过期--> [死信交换机] --路由--> [重试队列(带TTL)] --过期--> [原业务交换机] --广播--> [原业务队列]`

### 7.2 DelayExchange 插件 (推荐)

插件安装后声明交换机设置 `delayed=true`：

```java
@Bean  
public DirectExchange delayExchange(){
    return ExchangeBuilder  
            .directExchange("delay.direct")
            .delayed() // 关键：开启延迟属性
            .durable(true)
            .build();  
}
```

发送延迟消息：
```java
rabbitTemplate.convertAndSend("delay.direct", "delay", message, m -> {
    m.getMessageProperties().setDelay(5000); // 延迟5秒
    return m;
});
```

> [!CAUTION] 限制
> 延迟消息不建议设置过长的延迟时间，以免造成较大的 CPU 和内存开销（由 CPU 维护计时）。