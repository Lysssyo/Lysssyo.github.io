---
title: Lua简单Demo
date: 2024-10-17 08:43:00 +0800
categories: [中间件, Redis]
tags: [Redia,Lua]
---



## 1. 判断锁删除锁

编写如下Lua脚本，放在类路径下，命名为：`unlock.lua`

```lua
-- 这里的 KEYS[1] 就是锁的key，这里的ARGV[1] 就是当前线程标示
-- 获取锁中的标示，判断是否与当前线程标示一致
if (redis.call('GET', KEYS[1]) == ARGV[1]) then
  -- 一致，则删除锁
  return redis.call('DEL', KEYS[1])
end
-- 不一致，则直接返回
return 0
```

```java
public class SimpleRedisLock implements ILock {

    private final StringRedisTemplate stringRedisTemplate;
    private final String name;
    private static final String KEY_PREFIX = "lock:";
    private static final String ID_PREFIX = UUID.randomUUID().toString(true) + "-"; //toString(-)是为了不要uuid中的 -
    private static final DefaultRedisScript<Long> UNLOCK_SCRIPT;

    static {
        UNLOCK_SCRIPT = new DefaultRedisScript<>();
        UNLOCK_SCRIPT.setLocation(new ClassPathResource("unlock.lua"));
        UNLOCK_SCRIPT.setResultType(Long.class);
    }

    public SimpleRedisLock(String name, StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
        this.name = name;
    }

    @Override
    public boolean tryLock(long timeoutSec) {
        // 获取线程标示
        String threadId = ID_PREFIX + Thread.currentThread().getId();
        // 获取锁
        Boolean success = stringRedisTemplate.opsForValue()
                .setIfAbsent(KEY_PREFIX + name, threadId, timeoutSec, TimeUnit.SECONDS);
        return Boolean.TRUE.equals(success);
    }

    @Override
    public void unlock() {
        // 调用lua脚本
        stringRedisTemplate.execute(
                UNLOCK_SCRIPT,
                Collections.singletonList(KEY_PREFIX + name),
                ID_PREFIX + Thread.currentThread().getId());

    }

}
```

从而解决原子性问题。

## 2. 秒杀

<img src="assets/2024-10-07-LuaSimpleDemo.assets/image-20241017085141364.png" alt="image-20241017085141364" style="zoom:80%;" />

编写如下Lua脚本：

```lua
-- 秒杀前的条件判断
-- 参数，来自Java程序
local voucherId = ARGV[1]
local userId = ARGV[2]
local orderId = ARGV[3]

-- Key
local stockKey = "seckill:stock:" .. voucherId  -- 参数作为Key的一部分
local orderKey = "seckill:order:" .. voucherId

-- 判断库存是否充足
if (tonumber(redis.call('get', stockKey)) <= 0) then
    -- 库存不足
    return 1
end

-- 判断是否下过单
if (redis.call('sismember', orderKey, userId) == 1) then
    -- 下过单
    return 2
end

-- 扣库存 incrby stockKey -1
redis.call('incrby', stockKey, -1)

-- 下单（保存用户）sadd orderKey userId
redis.call('sadd', orderKey, userId)

-- 发送消息到队列中， XADD stream.orders * k1 v1 k2 v2 ...
redis.call('xadd', 'stream.orders', '*', 'userId', userId, 'voucherId', voucherId, 'id', orderId)

return 0
```

在Java程序中：

```java
	private static final DefaultRedisScript<Long> SECKILL_SCRIPT;

    static { // 静态初始化块，通过静态代码块，SECKILL_SCRIPT 只会在类加载时初始化一次，之后所有的实例都共享这个脚本对象
        SECKILL_SCRIPT = new DefaultRedisScript<>();
        SECKILL_SCRIPT.setLocation(new ClassPathResource("lua/seckill.lua"));
        SECKILL_SCRIPT.setResultType(Long.class);
    }

	@Override
    public Result seckillVoucher(Long voucherId) {
        //获取用户
        Long userId = UserHolder.getUser().getId();
        long orderId = redisWorker.nextId("order");
        // 1.执行lua脚本
        Long result = stringRedisTemplate.execute(
                SECKILL_SCRIPT,
                Collections.emptyList(),
                voucherId.toString(), userId.toString(), String.valueOf(orderId)
        );

        int R = result.intValue();
        if (R == 1) {
            throw new HeimaDpException("库存不足");
        }
        if (R == 2) {
            throw new HeimaDpException("用户已下过单");
        }
        return Result.ok();
    }
```



## 3. redis.call()

`redis.call()`方法的返回值与执行的命令有关。

```
-- 集合中有 1010 这个元素，返回值是number类型
> eval "return type(redis.call(\"sismember\", KEYS[1], ARGV[1]))" 1 seckill:order:10 1010
number

-- 集合中有 1010 这个元素，返回值为1
> eval "return (redis.call(\"sismember\", KEYS[1], ARGV[1]))" 1 seckill:order:10 1010
1

-- 集合中没有rose这个元素，返回值依然是number类型
> eval "return type(redis.call(\"sismember\", KEYS[1], ARGV[1]))" 1 seckill:order:10 rose
number

-- 集合中没有rose这个元素，返回值为0
> eval "return (redis.call(\"sismember\", KEYS[1], ARGV[1]))" 1 seckill:order:10 rose
0

-- 有seckill:stock:10（String类型） 这个元素
> eval "return redis.call(\"get\", KEYS[1])" 1 seckill:stock:10
80
> eval "return type(redis.call(\"get\", KEYS[1]))" 1 seckill:stock:10
string

-- 没有seckill:stock:90（String类型） 这个元素
> eval "return redis.call(\"get\", KEYS[1])" 1 seckill:stock:90
null
> eval "return type(redis.call(\"get\", KEYS[1]))" 1 seckill:stock:90
boolean

-- Zset（like:blog:4）有1010这个数据
> eval "return (redis.call(\"zscore\", KEYS[1], ARGV[1]))" 1 like:blog:4 1010
1729474566892
> eval "return type(redis.call(\"zscore\", KEYS[1], ARGV[1]))" 1 like:blog:4 1010
string

-- Zset（like:blog:4） 没有1111这个数据
> eval "return (redis.call(\"zscore\", KEYS[1], ARGV[1]))" 1 like:blog:4 1111
null
> eval "return type(redis.call(\"zscore\", KEYS[1], ARGV[1]))" 1 like:blog:4 1111
boolean
```

