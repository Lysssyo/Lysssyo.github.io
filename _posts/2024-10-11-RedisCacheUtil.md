---
title: Redis缓存工具类
date: 2024-10-11 14:20:00 +0800
categories: [中间件,Redis]
tags: [Redis]
---

```java
import cn.hutool.core.util.BooleanUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;


@Slf4j
@Component
public class CacheClient {

    private final StringRedisTemplate stringRedisTemplate;
    private static final ExecutorService CACHE_REBUILD_EXECUTOR = Executors.newFixedThreadPool(10);

    private static final long CACHE_NULL_TTL = 2L;
    private static final String CACHE_LOCK_KEY = "cache:lock:";


    /**
     * 构造函数注入 stringRedisTemplate
     *
     * @param stringRedisTemplate
     */
    public CacheClient(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    /**
     * 将任意Java对象序列化为json并存储在string类型的key中，并且可以设置TTL过期时间
     *
     * @param key   存入Redis时的Key
     * @param value 存入Redis的对象
     * @param time  过期时间（Long类型）
     * @param unit  时间单位
     */
    public void set(String key, Object value, Long time, TimeUnit unit) {
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(value), time, unit);
    }

    /**
     * 根据指定的key查询缓存，并反序列化为指定类型，利用缓存空值的方式解决缓存穿透问题
     *
     * @param key        存入Redis时的Key
     * @param type       想要反序列化的类型
     * @param id         查询数据库的id
     * @param dbFallback 给定方法参数类型，需要调用者给出查询数据库逻辑，返回查询得到的对象
     * @param time       空值存入Redis的TTL
     * @param timeUnit   空值存入Redis的时间单位
     * @return 反序列化后的对象
     */
    public <R, ID> R queryWithPassThrough(String key, Class<R> type, ID id, Function<ID, R> dbFallback, Long time, TimeUnit timeUnit) {
        String valueJson = stringRedisTemplate.opsForValue().get(key);
        // 判断是否存在
        if (valueJson != null && !valueJson.isEmpty()) {
            // 存在，直接返回
            return JSONUtil.toBean(valueJson, type);
        }
        // 判断是否为空值（到这里要么为null要么为空字符串，空字符串就说明命中了空值，为null就去数据库查）
        else if (valueJson != null) { //不为null就是为空字符串
            throw new RuntimeException("命中空值");
        } else { // 为null
            R r = dbFallback.apply(id); //去数据库查
            if (r == null) {
                // 将空值写入redis
                stringRedisTemplate.opsForValue().set(key, "", CACHE_NULL_TTL, TimeUnit.MINUTES);
                // 返回错误信息
                throw new RuntimeException("数据库中不存在该id");
            }
            this.set(key, r, time, timeUnit);
            return r; // 返回查询结果
        }
    }


    /**
     * * 将任意Java对象序列化为json并存储在string类型的key中，并且可以设置逻辑过期时间，用于处理缓存击穿问题（用于存热点Key）
     *
     * @param key   存入Redis时的Key
     * @param value 要存入的对象
     * @param time  逻辑过期时间
     * @param unit  时间单位
     */
    public void setWithLogicalExpire(String key, Object value, Long time, TimeUnit unit) {
        // 设置逻辑过期
        RedisData redisData = new RedisData();
        redisData.setData(value);
        redisData.setExpireTime(LocalDateTime.now().plusSeconds(unit.toSeconds(time)));
        // 写入Redis
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(redisData));
    }


    /**
     * 根据指定的key查询缓存，并反序列化为指定类型，利用逻辑过期解决缓存击穿问题
     *
     * @param key        存入Redis时的Key
     * @param type       想要反序列化的类型
     * @param id         查询数据库的id
     * @param dbFallback 给定方法参数类型，需要调用者给出查询数据库逻辑，返回查询得到的对象
     * @param time       空值存入Redis的TTL
     * @param unit       空值存入Redis的时间单位
     * @return 反序列化后的对象
     */
    public <R, ID> R queryWithLogicalExpire(String key, ID id, Class<R> type, Function<ID, R> dbFallback, Long time, TimeUnit unit) {

        // 从redis查询缓存
        String valueJson = stringRedisTemplate.opsForValue().get(key);
        if (valueJson == null || valueJson.isEmpty()) {
            // 不存在，出错
            throw new RuntimeException("缓存中没有数据");
        }

        // 命中，需要先把json反序列化为对象
        RedisData redisData = JSONUtil.toBean(valueJson, RedisData.class);
        // 获取真正的数据
        R r = JSONUtil.toBean((JSONObject) redisData.getData(), type);
        // 获取逻辑过期时间
        LocalDateTime expireTime = redisData.getExpireTime();
        // 判断是否过期
        if (expireTime.isAfter(LocalDateTime.now())) {
            // 未过期，直接返回缓存
            return r;
        } else { //过期，需要重建缓存
            // 先获取锁
            String lockKey = CACHE_LOCK_KEY + id;
            boolean isLock = tryLock(lockKey);
            if (isLock) { //获取锁成功
                // 6.3.成功，开启独立线程，实现缓存重建
                CACHE_REBUILD_EXECUTOR.submit(() -> {
                    try {
                        // 查询数据库
                        R newR = dbFallback.apply(id);
                        // 重建缓存
                        this.setWithLogicalExpire(key, newR, time, unit);
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    } finally {
                        // 释放锁
                        unlock(lockKey);
                    }
                });

            }
            // 返回过期的缓存
            return r;
        }
    }

    /**
     * 根据指定的key查询缓存，并反序列化为指定类型，利用互斥锁解决缓存击穿问题
     *
     * @param key        存入Redis时的Key
     * @param type       想要反序列化的类型
     * @param id         查询数据库的id
     * @param dbFallback 给定方法参数类型，需要调用者给出查询数据库逻辑，返回查询得到的对象
     * @param time       空值存入Redis的TTL
     * @param unit       空值存入Redis的时间单位
     * @return 反序列化后的对象
     */
    public <R, ID> R queryWithMutex(String key, ID id, Class<R> type, Function<ID, R> dbFallback, Long time, TimeUnit unit) {

        // 从redis查询缓存
        String valueJson = stringRedisTemplate.opsForValue().get(key);
        // 判断是否存在
        if (valueJson != null) {
            // 存在，直接返回
            return JSONUtil.toBean(valueJson, type);
        }
        // 若不存在，实现缓存重建
        // 获取互斥锁
        String lockKey = CACHE_LOCK_KEY + id;
        R r = null;
        try {
            boolean isLock = tryLock(lockKey);
            // 判断是否获取成功
            while (!isLock) {
                // 获取锁失败，休眠并重试
                Thread.sleep(50);
                isLock = tryLock(lockKey);
            }
            // 获取锁成功先DoubleCheck，因为获取到的锁可能是其他线程释放的，那么就说明已经改好缓存了，不用访问数据库
            String doubleCheckValueJson = stringRedisTemplate.opsForValue().get(key);
            if (doubleCheckValueJson != null) {
                r = dbFallback.apply(id);
            }
            // 查询数据库
            r = dbFallback.apply(id);
            // 不存在，返回错误
            if (r == null) {
                throw new RuntimeException();
            }
            // 存在，写入redis
            this.set(key, r, time, unit);
        } catch (InterruptedException e) {
            throw new RuntimeException("数据库查询失败");
        } finally {
            // 7.释放锁
            unlock(lockKey);
        }
        // 8.返回
        return r;
    }


    private boolean tryLock(String key) {
        Boolean flag = stringRedisTemplate.opsForValue().setIfAbsent(key, "1", 10, TimeUnit.SECONDS);
        return BooleanUtil.isTrue(flag);
    }

    private void unlock(String key) {
        stringRedisTemplate.delete(key);
    }
}

```

**关于`R r = dbFallback.apply(id);`**

首先先看`Function`：

```java
@FunctionalInterface
public interface Function<T, R> {

    /**
     * Applies this function to the given argument.
     *
     * @param t the function argument
     * @return the function result
     */
    R apply(T t);

    default <V> Function<V, R> compose(Function<? super V, ? extends T> before) {
        Objects.requireNonNull(before);
        return (V v) -> apply(before.apply(v));
    }

    default <V> Function<T, V> andThen(Function<? super R, ? extends V> after) {
        Objects.requireNonNull(after);
        return (T t) -> after.apply(apply(t));
    }

    static <T> Function<T, T> identity() {
        return t -> t;
    }
}
```

**Function的apply方法用于为函数赋予给定参数并获取函数的返回值**（用于**将输入的参数 `T` 转换为结果 `R`**。）

示例：

```java
Function<String, String> function = a -> a + " Jack!";
System.out.println(function.apply("Hello")); // Hello Jack!
```

`function.apply("Hello")`为函数` a -> a + " Jack!"`给定了参数`Hello`并获取了这个函数的返回值`Hello Jack!`

下面具体分析`R r = dbFallback.apply(id);`

在 `CacheClient` 类的 `queryWithPassThrough` 方法中，**设计者并不知道如何查询数据库**，因此，将函数式接口 `Function<ID, R>` 用作参数 `dbFallback`，以便将数据库查询的实现委托给调用者来定义。设计者只需规定 `ID` 作为输入参数的类型，`R` 作为返回值的类型，但具体的查询逻辑由调用者通过 `Function` 来提供。

例如，调用者可以这样使用：

```java
        CacheClient cacheClient = new CacheClient(stringRedisTemplate);
        Long id = 10L;
        Shop shop = cacheClient
                .queryWithPassThrough(
                        "cache:shop:1",
                        id,
                        Shop.class,
                        new Function<Long, Shop>() {
                            @Override
                            public Shop apply(Long id) {
                                return getById(id); //通过MyBatis-Plus查询数据库
                            }
                        },
                        30L,
                        TimeUnit.MINUTES
                );
```

