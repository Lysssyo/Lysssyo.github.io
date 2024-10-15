---
title: Redis消息队列
date: 2024-10-15 18:22:00 +0800
categories: [中间件, Redis]
tags: [Redis,消息队列]
---



## 1. 基于PubSub实现消息队列

PubSub（发布订阅）是Redis2.0版本引入的消息传递模型。顾名思义，消费者可以订阅一个或多个channel，生产者向对应channel发送消息后，所有订阅者都能收到相关消息。

<img src="assets/2024-10-15-RedisMessageQueue.assets/image-20241015182925281.png" alt="image-20241015182925281" style="zoom:80%;" />

```
 SUBSCRIBE channel [channel] ：订阅一个或多个频道
 PUBLISH channel msg ：向一个频道发送消息
 PSUBSCRIBE pattern[pattern] ：订阅与pattern格式匹配的所有频道
```

优点：

* 采用发布订阅模型，支持多生产者、多消费者

缺点：

* 不支持数据持久化
* 无法避免消息丢失
* 消息堆积有上限，超出时数据丢失



## 2. 基于Stream实现消息队列

Stream 是 Redis 5.0 引入的一种新数据类型，可以实现一个功能非常完善的消息队列。

### 2.1 基本命令

#### 2.1.1 XADD 发生消息

```
XADD key [NOMKSTREAM] [<MAXLEN | MINID> [= | ~] threshold
  [LIMIT count]] <* | id> field value [field value ...]
```

![image-20241015183340871](assets/2024-10-15-RedisMessageQueue.assets/image-20241015183340871.png)

例如：

```
## 创建名为 users 的队列，并向其中发送一个消息，内容是:{name=Keith,age=20}，并且使用Redis自动生成ID
> xadd users * name Keith age 20
1728988711945-0
```

#### 2.1.2 XREAD 读取消息

```
XREAD [COUNT count] [BLOCK milliseconds] STREAMS key [key ...] id [id ...]
```

<img src="assets/2024-10-15-RedisMessageQueue.assets/image-20241015183626721.png" alt="image-20241015183626721" style="zoom: 67%;" />

例一：

```
> XREAD COUNT 1 STREAMS users 0
users
1728988711945-0
name
Keith
age
20
```

例二：

```
> XREAD COUNT 1 STREAMS users  1728988711944-0
users
1728988711945-0
name
Keith
age
20
```

例三：

```
> XREAD COUNT 1 STREAMS users  1728988711945-0
null
```

**注意：**当ID为`$`时，读取最新的信息，并且只能读这条命令敲出来后发到消息队列的消息

> 有伪代码如下：
>
> ```java
> while(true){
>     //尝试读取队列中的消息，最多阻塞2秒
>     Object msg = redis.execute("XREAD COUNT 1 BLOCK 2000 STREAMS users $");
>     if(msg == null){
>         continue;
>     }
>    //处理消息
>     handleMessage(msg);
> }
> ```
>
> 如果用这种方法实现消息队列，那么在处理信息时，新投递到消息队列的信息会被丢弃。

STREAM类型消息队列的`XREAD`命令特点：

* 消息可回溯
* 一个消息可以被多个消费者读取
* 可以阻塞读取
* 有消息漏读的风险

### 2.2 消费者组

消费者组（Consumer Group）：将多个消费者划分到一个组中，监听同一个队列。具有如下特点：

- 消息分流  

  队列中的消息会分流给组内的不同消费者，而不是重复消费，从而加快消息处理的这速度。   

- 消息标示  

  消费者组会维护一个标识，记录最后一个被处理的消息，哪怕消费者宕机重启，还会从标识之后读取消息。确保每一个消息都会被消费 

- 消息确认  

  消费者获取消息后，消息处于`pending`状态，并存入一个`pending-list`。当处理完成后需要通过`XACK`来确认消息，标记消息为已处理，才会从`pending-list`移除。

#### 2.2.1 创建消费者组

```
-- 创建消费者组
XGROUP CREATE key group <id | $> [MKSTREAM] [ENTRIESREAD entries-read]
```

> - `key`：队列名称
> - `group`：消费者组名称
> - `ID`：起始ID标示，$代表队列中最后一个消息，0则代表队列中第一个消息
>   - 如果队列中已经有消息单不想消费，可以选择`$`；
>   - 如果队列的消息还需要消费，选择`0`
> - `MKSTREAM`：队列不存在时自动创建队列

例一：

```
> XGROUP CREATE users group1 0
OK
```

#### 2.2.2 其他命令

 **删除指定的消费者组**

```java
XGROUP DESTORY key groupName
```

 **给指定的消费者组添加消费者**

```java
XGROUP CREATECONSUMER key groupname consumername
```

 **删除消费者组中的指定消费者**

```java
XGROUP DELCONSUMER key groupname consumername
```

**从消费者组读取消息**

```java
XREADGROUP GROUP group consumer [COUNT count] [BLOCK milliseconds] [NOACK] STREAMS key [key ...] ID [ID ...]
```

* `group`：消费组名称

* `consumer`：消费者名称，如果消费者不存在，会自动创建一个消费者

* `count`：本次查询的最大数量

* `BLOCK milliseconds`：当没有消息时最长等待时间

* `NOACK`：无需手动ACK，获取到消息后自动确认

* `STREAMS key`：指定队列名称

* `ID`：获取消息的起始ID

  The ID to specify in the **STREAMS** option when using `XREADGROUP` can be one of the following two:

  - The special `>` ID, which means that the consumer want to receive only messages that were *never delivered to any other consumer*. It just means, give me new messages.
  - Any other ID, that is, 0 or any other valid ID or incomplete ID (just the millisecond time part), will have the effect of **returning entries** that are **pending** for the consumer sending the command with IDs greater than the one provided. So basically if the ID is not `>`, then the command will just let the client access its pending entries: messages delivered to it, but not yet acknowledged. Note that in this case, both `BLOCK` and `NOACK` are ignored.

例如：

名为users的Stream队列如下：

| NO. (Total: 2) | ID              | Value                       |
| -------------- | --------------- | --------------------------- |
| 1              | 1728990151697-0 | {"name":"Tom","age":"21"}   |
| 2              | 1728988711945-0 | {"name":"Keith","age":"20"} |

```
> XREADGROUP GROUP group1 consumer1 COUNT 1  STREAMS users >
users
1728988711945-0
name
Keith
age
20
> XREADGROUP GROUP group1 consumer1 COUNT 1  STREAMS users 0
users
1728988711945-0
name
Keith
age
20
> XREADGROUP GROUP group1 consumer1 COUNT 1  STREAMS users >
users
1728990151697-0
name
Tom
age
21
> XREADGROUP GROUP group1 consumer1 COUNT 1  STREAMS users >
null
> XREADGROUP GROUP group1 consumer1 COUNT 1  STREAMS users 1728988711945-0
users
1728990151697-0
name
Tom
age
21
```

STREAM类型消息队列的`XREADGROUP`命令特点：

* 消息可回溯
* 可以多消费者争抢消息，加快消费速度
* 可以阻塞读取
* 没有消息漏读的风险
* 有消息确认机制，保证消息至少被消费一次

![image-20241015192424863](assets/2024-10-15-RedisMessageQueue.assets/image-20241015192424863.png)
