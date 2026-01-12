本文基于：[Redisson底层实现](https://zhuanlan.zhihu.com/p/343811173)

## 1. Demo

public static void main(String[] args) throws InterruptedException, UnsupportedEncodingException {  
    Config config = new Config();  
    config.useSingleServer().setAddress("redis://172.29.2.10:7000");  
    RedissonClient redisson = Redisson.create(config);  
    RBlockingQueue<String> blockingQueue = redisson.getBlockingQueue("dest_queue1"); // 这个名字等下用作channel，zset等的名字  
    RDelayedQueue<String> delayedQueue = redisson.getDelayedQueue(blockingQueue);  
    new Thread() {  
        public void run() {  
            while(true) {  
                try {  
                                        //阻塞队列有数据就返回，否则wait  
                    System.err.println( blockingQueue.take());  
                } catch (InterruptedException e) {  
                    e.printStackTrace();  
                }  
            }  
        };  
    }.start();  
      
    for(int i=1;i<=5;i++) {  
                // 向阻塞队列放入数据  
        delayedQueue.offer("fffffffff"+i, 13, TimeUnit.SECONDS);  
    }  
}

上面的代码块**基于阻塞队列blockingQueue创建了一个“延迟投递视图”**：你往 _delayedQueue_ 中 `offer` 的元素，不会立刻出现在 _blockingQueue_；而是在指定的延迟时间（这里 13 秒）到期后，由 Redisson 框架自动转移到你传入的 _blockingQueue_，供真正的消费者从 _blockingQueue_ 中阻塞式获取并处理

> RDelayedQueue 是什么？
> 
> Redisson 提供的“延迟投递”包装器。你通过 `getDelayedQueue(目标队列)` 绑定一个“目标队列”（可以是 `RBlockingQueue`、`RBoundedBlockingQueue` 等实现 `RQueue` 的队列）。之后对该 _RDelayedQueue_ 调用 `offer(e, delay, unit)` 时，Redisson 会记录一个延迟，到期后自动把元素投递（转移）到你指定的目标队列；只有到期后，消费者才能在目标队列中看到它

## 2. 底层实现

**阶段1： 客户端程序启动，offer方法执行之前 ，redis服务会收到如下redis命令：**

1610452446.652126 [0 172.29.2.194:65025] "SUBSCRIBE" "redisson_delay_queue_channel:{dest_queue1}"  
1610452446.672009 [0 lua] "zrangebyscore" "redisson_delay_queue_timeout:{dest_queue1}" "0" "1610452442403" "limit" "0" "2"  
1610452446.672018 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0" "WITHSCORES"  
1610452446.673896 [0 172.29.2.194:65034] "BLPOP" "dest_queue1" "0" 

核心发生了三件事：

1. **SUBSCRIBE** `redisson_delay_queue_channel:{dest_queue1}`
    
    - Redisson客户端订阅内部频道，用来接收“下一个到期时间”的通知，以便本地定时任务调度。
        
2. **ZRANGEBYSCORE / ZRANGE** `redisson_delay_queue_timeout:{dest_queue1}`
    
    > 扫盲：
    > 
    > |命令|选取依据|返回顺序|常见用途|
    > |---|---|---|---|
    > |`ZRANGE key i j`|按 **索引位置** i…j|score 升序、再字典序|分页、取头/尾元素|
    > |`ZRANGEBYSCORE key a b`|按 **score 区间** a…b|score 升序、再字典序|区间查询（如延迟到期）、限流|
    
    - `ZRANGEBYSCORE … LIMIT 0 2`，启动时先扫一遍历史延迟数据（如果上次宕机有遗留，得补发）。
        
    - `ZRANGE … 0 0 WITHSCORES`，**看看当前还有哪些“最近要到期”的任务**，并获取它的到期时间（score），Redisson 拿到这个最早到期的 timestamp 后，就会用本地定时器（HashedWheelTimer）安排下一次搬运“闹钟”，到那个时间点再去执行一次 `ZRANGEBYSCORE`。
        
    
    > 这里不影响主流程，没理解就先跳过回头看
    
3. **BLPOP dest_queue1 0**
    
    - 立刻在目标阻塞队列上阻塞等待（无限期），一旦有到期元素被推送进来，马上消费。
        
    
    > 读到这里，需要知道，目标阻塞队列是`dest_queue1`，即消费者是在`dest_queue`上等数据
    

**阶段 2：调用 `delayedQueue.offer(...)`（插入延迟消息）**

1610452446.684465 [0 lua] "zadd" "redisson_delay_queue_timeout:{dest_queue1}" "1610452455407" ":\xdf\x0eO\x8c\xa7\xd4C\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff1"  
1610452446.684480 [0 lua] "rpush" "redisson_delay_queue:{dest_queue1}" ":\xdf\x0eO\x8c\xa7\xd4C\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff1"  
1610452446.684492 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0"  
1610452446.684498 [0 lua] "publish" "redisson_delay_queue_channel:{dest_queue1}" "1610452455407"  
1610452446.687922 [0 lua] "zadd" "redisson_delay_queue_timeout:{dest_queue1}" "1610452455422" "e\xfd\xfe?j?\xdbC\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff2"  
1610452446.687943 [0 lua] "rpush" "redisson_delay_queue:{dest_queue1}" "e\xfd\xfe?j?\xdbC\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff2"  
1610452446.687958 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0"  
1610452446.690478 [0 lua] "zadd" "redisson_delay_queue_timeout:{dest_queue1}" "1610452455424" "\x80J\x01j\x11\xee\xda\xc3\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff3"  
1610452446.690492 [0 lua] "rpush" "redisson_delay_queue:{dest_queue1}" "\x80J\x01j\x11\xee\xda\xc3\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff3"  
1610452446.690502 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0"  
1610452446.692661 [0 lua] "zadd" "redisson_delay_queue_timeout:{dest_queue1}" "1610452455427" "v\xb5\xd0r\xb48\xd4\xc3\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff4"  
1610452446.692674 [0 lua] "rpush" "redisson_delay_queue:{dest_queue1}" "v\xb5\xd0r\xb48\xd4\xc3\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff4"  
1610452446.692683 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0"  
1610452446.696054 [0 lua] "zadd" "redisson_delay_queue_timeout:{dest_queue1}" "1610452455429" "\xe7\a\x8b\xee\t-\x94C\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff5"  
1610452446.696081 [0 lua] "rpush" "redisson_delay_queue:{dest_queue1}" "\xe7\a\x8b\xee\t-\x94C\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff5"  
1610452446.696098 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0"

对你每一次 `offer`，Redis 侧出现以下模式：

1. **ZADD redisson_delay_queue_timeout:{dest_queue1} <到期时间戳> <编码消息>**
    
    - 把消息按“到期时间”记入有序集合（延迟计划表）。
        
2. **RPUSH redisson_delay_queue:{dest_queue1} <同样的编码消息>**
    
    - 存一份备份 List，后面搬运成功后要 LREM 删除它，防重复。
        
3. **ZRANGE ... 0 0**（取最早到期项）
    
    - 看看刚加进去是不是新的“最早到期时间”。
        
    
    > 扫盲：
    > 
    > ZRANGE key start stop [WITHSCORES]
    > 
    > - **key**：目标有序集合的名称。
    >     
    > - **start** 和 **stop**：按索引区间指定要返回的成员位置（0 表示第一个元素，1 表示第二个，以此类推；-1 表示最后一个，-2 表示倒数第二个）。
    >     
    > - **WITHSCORES**（可选）：如果加上这个标志，返回结果会把每个成员对应的 score 一并返回。
    >     
    
4. **PUBLISH redisson_delay_queue_channel:{dest_queue1} <最早到期时间戳>**
    
    - 通知所有订阅客户端：“下一个到期点是多少”，大家据此安排本地定时器（HashedWheelTimer 等）。
        

> 第三步和第四步的意义在于，**判断刚插入的这条延迟消息，是否比队列里之前所有的都要“更早到期”**。
> 
> - 如果它不是最早到期的，就继续排队，原来注册好的定时器会在之前最早那条触发时搬运到期的数据
>     
> - 如果它确实是新的“最早到期时间”，Redisson 就得**发一次 PUBLISH**，让所有客户端取消原来那个定时器（或者不管），重新设置一个新的本地闹钟，到这个更新后的更早时间再去拉一波到期消息。
>     
> 
> 此外，在日志里你看到奇怪的前缀二进制：那是 Redisson 的内部编码（随机ID + 数据长度 + payload），不用管。

上面实际上是**客户端把“最早到期时间”打包给 Redis → Redis `PUBLISH` → 客户端（包括自己）再接收并用来重设闹钟**，形成一个闭环。

**阶段 3：到期搬运（延迟时间到 → 推入目标队列）**

1610452459.680953 [0 lua] "zrangebyscore" "redisson_delay_queue_timeout:{dest_queue1}" "0" "1610452455416" "limit" "0" "2"  
1610452459.680967 [0 lua] "rpush" "dest_queue1" "\x04>\nfffffffff1"  
1610452459.680976 [0 lua] "lrem" "redisson_delay_queue:{dest_queue1}" "1" ":\xdf\x0eO\x8c\xa7\xd4C\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff1"  
1610452459.680984 [0 lua] "zrem" "redisson_delay_queue_timeout:{dest_queue1}" ":\xdf\x0eO\x8c\xa7\xd4C\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff1"  
1610452459.680991 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0" "WITHSCORES" // 判断是否有值  
1610452459.745813 [0 lua] "zrangebyscore" "redisson_delay_queue_timeout:{dest_queue1}" "0" "1610452455480" "limit" "0" "2"  
1610452459.745829 [0 lua] "rpush" "dest_queue1" "\x04>\nfffffffff2"  
1610452459.745837 [0 lua] "lrem" "redisson_delay_queue:{dest_queue1}" "1" "e\xfd\xfe?j?\xdbC\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff2"  
1610452459.745845 [0 lua] "rpush" "dest_queue1" "\x04>\nfffffffff3"  
1610452459.745848 [0 lua] "lrem" "redisson_delay_queue:{dest_queue1}" "1" "\x80J\x01j\x11\xee\xda\xc3\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff3"  
1610452459.745855 [0 lua] "zrem" "redisson_delay_queue_timeout:{dest_queue1}" "e\xfd\xfe?j?\xdbC\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff2" "\x80J\x01j\x11\xee\xda\xc3\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff3"  
1610452459.745864 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0" "WITHSCORES"  
1610452459.756909 [0 172.29.2.194:65026] "BLPOP" "dest_queue1" "0"  
1610452459.758092 [0 lua] "zrangebyscore" "redisson_delay_queue_timeout:{dest_queue1}" "0" "1610452455493" "limit" "0" "2"  
1610452459.758108 [0 lua] "rpush" "dest_queue1" "\x04>\nfffffffff4"  
1610452459.758114 [0 lua] "lrem" "redisson_delay_queue:{dest_queue1}" "1" "v\xb5\xd0r\xb48\xd4\xc3\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff4"  
1610452459.758121 [0 lua] "rpush" "dest_queue1" "\x04>\nfffffffff5"  
1610452459.758124 [0 lua] "lrem" "redisson_delay_queue:{dest_queue1}" "1" "\xe7\a\x8b\xee\t-\x94C\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff5"  
1610452459.758133 [0 lua] "zrem" "redisson_delay_queue_timeout:{dest_queue1}" "v\xb5\xd0r\xb48\xd4\xc3\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff4" "\xe7\a\x8b\xee\t-\x94C\r\x00\x00\x00\x00\x00\x00\x00\x04>\nfffffffff5"  
1610452459.758143 [0 lua] "zrange" "redisson_delay_queue_timeout:{dest_queue1}" "0" "0" "WITHSCORES"  
1610452459.759030 [0 172.29.2.194:65037] "BLPOP" "dest_queue1" "0"  
1610452459.760933 [0 172.29.2.194:65036] "BLPOP" "dest_queue1" "0"  
1610452459.763913 [0 172.29.2.194:65038] "BLPOP" "dest_queue1" "0"  
1610452459.765999 [0 172.29.2.194:65039] "BLPOP" "dest_queue1" "0"

当 13 秒到：

1. **ZRANGEBYSCORE redisson_delay_queue_timeout:{dest_queue1} 0 now LIMIT ...**
    
    - 找出所有已经“到期”的消息（Redisson 源码一次最多取 100）
        
    
    > 扫盲
    > 
    > ZRANGEBYSCORE key min max  
    >  [WITHSCORES]  
    >  [LIMIT offset count]
    > 
    > - **key**：目标有序集合的名字。
    >     
    > - **min**：score 下界（可以是数字，也可以是 `-inf` 表示无穷小）。
    >     
    > - **max**：score 上界（可以是数字，也可以是 `+inf` 表示无穷大）。
    >     
    
2. 对这些到期消息执行：
    
    - **RPUSH dest_queue1 <payload>** → 真正投递到你消费者用的阻塞队列。
        
    - **LREM redisson_delay_queue:{dest_queue1} 1 <编码消息>** → 从备份 List 删除。
        
    - **ZREM redisson_delay_queue_timeout:{dest_queue1} <编码消息...>** → 从延迟计划表删除。
        
3. **ZRANGE ... 0 0 WITHSCORES**
    
    - 看是否还有下一批未到期；有就重新设置下一个闹钟。
        
4. 因为消费者线程早就在做 **BLPOP dest_queue1 0**，现在 dest_queue1 被 `RPUSH`，它立刻返回，`blockingQueue.take()` 打印出消息。
    

> 日志能看到同一批次里多条 `RPUSH dest_queue1`：因为多条消息到期时间相近，被批量搬运。

其他思考：如果在延迟时间到之前，取消这个延迟任务怎么样？

你可以在延迟到期前，通过把那条消息从 **延迟队列的底层 ZSET 和备份 List** 中删除来实现「取消」。Redisson 在 `RDelayedQueue` 上也暴露了 `remove(E e)` 方法，本质上就是执行下面两步：

// 假设你之前 offer 了一个 key 对象 keyVO  
delayedQueue.remove(keyVO);

它在服务端会跑两条命令：

ZREM redisson_delay_queue_timeout:{dest_queue1} <编码后的 keyVO>  
LREM redisson_delay_queue:{dest_queue1} 1 <编码后的 keyVO>

这样就把这条延迟任务既从“何时到期”表里删了，也从备份 List 里删了——到期时就不会再搬运，也不会进到目标队列。