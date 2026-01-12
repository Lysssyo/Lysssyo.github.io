## 0. 用例

本笔记所有示例基于根据Id查询商户信息的业务：

```java
@GetMapping("/{id}")
public Result queryShopById(@PathVariable("id") Long id) {
    return shopService.queryById(id);
}
```

请求与响应示例：

``GET http://localhost:8081/shop/1``

响应：

```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "103茶餐厅",
        "typeId": 1,
        "images": "https://....jpg",
        "area": "大关",
        "address": "金华路锦昌文华苑29号",
        "x": 120.149192,
        "y": 30.316078,
        "avgPrice": 80,
        "sold": 4215,
        "comments": 3035,
        "score": 37,
        "openHours": "10:00-22:00",
        "createTime": "2021-12-22T18:10:39",
        "updateTime": "2022-01-13T17:32:19"
    }
}
```

## 1. 简单Redis缓存

![image-20241010083857069.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241010083857069.png)

```java
private Result originQueryById(Long id) {
    // 从Redis中查询
    String key = RedisConstant.CACHE_SHOP_KEY + id;
    Map<Object, Object> cacheShop = stringRedisTemplate.opsForHash().entries(key);//即使没有查到，也会返回size为0的map

    Shop shop = null;
    if (cacheShop.size() == 0) { //Redis中没有查到
        log.info("Redis缓存没命中，查询数据库");
        shop = getById(id);
        if (shop == null) {
            throw new HeimaDpException(CommonException.SHOP_NOT_EXIT.getErrMessage());
        }
        Map<String, Object> shopMap = BeanUtil.beanToMap(shop, new HashMap<>(),
                CopyOptions.create()
                        .setIgnoreNullValue(true)
                        .setFieldValueEditor((fieldName, fieldValue) -> fieldValue == null ? null : fieldValue.toString()));  //如果对所有 fieldValue 都执行toString方法，可能会有空指针异常，所以要先判空
        
        stringRedisTemplate.opsForHash().putAll(key, shopMap);
        stringRedisTemplate.expire(key, RedisConstant.CACHE_SHOP_TTL, TimeUnit.MINUTES);
    } else { // Redis中存在，直接返回
        shop = BeanUtil.fillBeanWithMap(cacheShop, new Shop(), false);
    }
    return Result.ok(shop);
}
```

## 2. 缓存更新策略

由于我们的**缓存的数据源来自于数据库**，而数据库的**数据是会发生变化的**。因此，如果当数据库中**数据发生变化，而缓存却没有同步**，此时就会有**一致性问题存在**，其后果是：用户使用缓存中的过时数据，就会产生类似多线程数据安全问题，从而影响业务。所以，需要进行缓存更新。

缓存更新有如下几种策略：

- **内存淘汰**

    redis自动进行，当redis内存达到咱们设定的max-memery的时候，会自动触发淘汰机制，淘汰掉一些不重要的数据（可以自己设置策略方式）

- **超时剔除**

    当给redis设置了过期时间TTL之后，redis会将超时的数据进行删除，

- **主动更新**

    手动调用方法把缓存删掉，通常用于解决缓存和数据库不一致问题

![image-20241009112312049.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241009112312049.png)


低一致性需求：使用内存淘汰机制。

高一致性需求：**主动更新，并以超时剔除作为兜底方案。**

### 2.1 主动更新

主动更新有如下几种方案：

- **Cache Aside Pattern 旁路缓存策略**

    缓存调用者在更新完数据库后再去更新缓存，也称之为**双写方案**

- **Read/Write Through Pattern**

    由系统本身完成，数据库与缓存的问题交由系统本身去处理

- **Write Behind Caching Pattern**

    调用者只操作缓存，其他线程去异步处理数据库，实现最终一致

如果采用第一个方案，那么假设我们每次操作数据库后，都操作缓存，但是中间如果没有人查询，那么这个更新动作实际上只有最后一次生效，中间的更新动作意义并不大，所以，采用的策略是：**缓存删除，等待再次查询时，再写缓存**

**那么，应该先删除缓存再操作数据库还是先操作数据库再删除缓存？**

![1653323595206.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/1653323595206.png)

- **先删缓存再操作数据库**

    如果删除缓存后，有新线程查询缓存，就会未命中，然后读数据库、写缓存，此时才更新数据库的话，就会出现缓存与数据库不一致且缓存的数据为旧数据

- **先操作数据库，再删除缓存**

    如果在操作数据库之前，缓存失效（例如超时剔除），此时如果线程A查询缓存，就会未命中，然后读数据库，在线程A写缓存之前，线程B才开始操作数据库，删除缓存，然后线程A又才写缓存，就会出现缓存与数据库不一致且缓存的数据为旧数据。但是，显然这种情况比上一种发生的概率小，因为缓存的速度较快，操作缓存的线程A比操作数据库的线程B还慢的概率不大。

> [!NOTE]
> 无论先删缓存还是先更新数据库，都会有并发问题，缓存都有可能为旧数据。
>
> 注意：读写缓存的速度远比更新数据库快。

**综上，先操作数据库，再删除缓存**

**此外，如何保证缓存与数据库的操作的同时成功或失败？**

[数据库和缓存如何保证一致性](https://xiaolincoding.com/redis/architecture/mysql_redis_consistency.html#%E5%A6%82%E4%BD%95%E4%BF%9D%E8%AF%81%E4%B8%A4%E4%B8%AA%E6%93%8D%E4%BD%9C%E9%83%BD%E8%83%BD%E6%89%A7%E8%A1%8C%E6%88%90%E5%8A%9F)

> 见《七、缓存篇：数据库和缓存如何保证一致性》 之 《 如何保证两个操作都能执行成功？》

## 3. 缓存穿透

缓存穿透是指客户端请求的数据在缓存中和数据库中都不存在，这样缓存永远不会生效，这些请求都会打到数据库。

常见的解决方案有两种：

- **缓存空对象**

    当我们客户端访问不存在的数据时，先请求redis，但是此时redis中没有数据，此时会访问到数据库，但是数据库中也没有数据，这个数据穿透了缓存，直击数据库，我们都知道数据库能够承载的并发不如redis这么高，如果大量的请求同时过来访问这种不存在的数据，这些请求就都会访问到数据库，简单的解决方案就是哪怕这个数据在数据库中也不存在，我们也把这个数据存入到redis中去，这样，下次用户过来访问这个不存在的数据，那么在redis中也能找到这个数据就不会进入到缓存了

    - 优点：实现简单，维护方便
    - 缺点：额外的内存消耗，可能造成短期的不一致

- **布隆过滤**

    布隆过滤器其实采用的是哈希思想来解决这个问题，通过一个庞大的二进制数组，走哈希思想去判断当前这个要查询的这个数据是否存在，如果布隆过滤器判断存在，则放行，这个请求会去访问redis，哪怕此时redis中的数据过期了，但是数据库中一定存在这个数据，在数据库中查询出来这个数据后，再将其放入到redis中。假设布隆过滤器判断这个数据不存在，则直接返回。这种方式优点在于节约内存空间，但是存在误判，误判原因在于：布隆过滤器走的是哈希思想，只要哈希思想，就可能存在哈希冲突

    - 优点：内存占用较少，没有多余key
    - 缺点：实现复杂，存在误判可能

![image-20241009140424944.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241009140424944.png)

其他解决方法：

- 增强id的复杂度，避免被猜测id规律
- 做好数据的基础格式校验
- 加强用户权限校验
- 做好热点参数的限流

### 3.1 缓存空对象Demo

![image-20241010085438684.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241010085438684.png)

```java
/**
 * 缓存空对象Demo
 * 由于商户信息在Redis中是以Hash存储的，所以需要定义一个空值——定义：空值是如下结构：key=id value=0
 *
 * @param id 商户id
 * @return
 */
private Result originQueryById(Long id) {
    long startTime = System.currentTimeMillis();  // 获取开始时间

    // 从Redis中查询
    String key = RedisConstant.CACHE_SHOP_KEY + id;
    Map<Object, Object> cacheShop = stringRedisTemplate.opsForHash().entries(key); //即使没有查到，也会返回size为0的map
    Shop shop = null;

    // 判断命中的是否是空值 如何区别没命中还是命中空值？
    if (cacheShop.containsKey("id") && "0".equals(cacheShop.get("id"))) { //如果命中空值
        // 命中空值
        throw new HeimaDpException("商户不存在");
    } else if (cacheShop.isEmpty()) {  // 没有命中空值，但是Redis中不存在，查询数据库
        log.info("Redis缓存没命中，查询数据库");
        shop = getById(id);
        
        if (shop == null) {
            // 数据库中也不存在，将空值写入Redis，避免缓存穿透
            Map<String, Object> emptyMap = new HashMap<>();
            emptyMap.put("id", "0");
            stringRedisTemplate.opsForHash().putAll(key, emptyMap);
            stringRedisTemplate.expire(key, RedisConstant.CACHE_SHOP_TTL, TimeUnit.MINUTES);
            throw new HeimaDpException(CommonException.SHOP_NOT_EXIT.getErrMessage());
        }
        
        Map<String, Object> shopMap = BeanUtil.beanToMap(shop, new HashMap<>(),
                CopyOptions.create()
                        .setIgnoreNullValue(true)
                        .setFieldValueEditor((fieldName, fieldValue) -> fieldValue == null ? null : fieldValue.toString()));
        stringRedisTemplate.opsForHash().putAll(key, shopMap);
        stringRedisTemplate.expire(key, RedisConstant.CACHE_SHOP_TTL, TimeUnit.MINUTES);


    } else { // Redis中存在，直接返回

        shop = BeanUtil.fillBeanWithMap(cacheShop, new Shop(), false);
    }

    return Result.ok(shop);

}
```

![image-20241010090511164.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241010090511164.png)

如果数据在Redis中是以String的格式存储，则可以定义空值为空字符串

```java
@Test
public void testNULL2() {
    String key = RedisConstant.CACHE_SHOP_KEY + 15;
    String s = stringRedisTemplate.opsForValue().get(key);  // 没命中，返回null
    stringRedisTemplate.opsForValue().set(key, "");
    String s2 = stringRedisTemplate.opsForValue().get(key);  // 命中空值，返回空字符串""
}
```

## 4. 缓存雪崩

缓存雪崩是指在同一时段大量的缓存key同时失效或者Redis服务宕机，导致大量请求到达数据库，带来巨大压力。

解决方案：

- 给不同的Key的TTL添加随机值
- 利用Redis集群提高服务的可用性
- 给缓存业务添加降级限流策略
- 给业务添加多级缓存

![1653327884526.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/1653327884526.png)

## 5. 缓存击穿

缓存击穿问题也叫热点Key问题，就是一个被高并发访问并且缓存重建业务较复杂的key突然失效了，无数的请求访问会在瞬间给数据库带来巨大的冲击。

值得注意的是，没有必要同时解决缓存击穿问题与缓存穿透问题。因为**缓存穿透**是攻击者使用不存在的Key去打数据库，而**缓存击穿**是热点Key突然失效造成对数据库的冲击。热点Key不可能在数据库中不存在，所以没必要为热点Key设计空值，而是要放在热点Key直接打到数据库。

假设线程1在查询缓存之后，本来应该去查询数据库，然后把这个数据重新加载到缓存的，此时只要线程1走完这个逻辑，其他线程就都能从缓存中加载这些数据了。但是假设在线程1没有走完的时候，后续的线程2，线程3，线程4同时过来访问当前这个方法， 那么这些线程都不能从缓存中查询到数据，那么他们就会同一时刻来访问查询缓存，都没查到，接着同一时间去访问数据库，同时的去执行数据库代码，对数据库访问压力过大。

![1653328022622.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/1653328022622.png)

常见的解决方案有两种：互斥锁、逻辑过期

- **互斥锁**

    因为锁能实现互斥性。假设线程过来，只能一个人一个人的来访问数据库，从而避免对于数据库访问压力过大，但这也会影响查询的性能，因为此时会让查询的性能从并行变成了串行，我们可以采用tryLock方法 + double check来解决这样的问题。

    假设现在线程1过来访问，他查询缓存没有命中，但是此时他获得到了锁的资源，那么线程1就会一个人去执行逻辑，假设现在线程2过来，线程2在执行过程中，并没有获得到锁，那么线程2就可以进行到休眠，直到线程1把锁释放后，线程2获得到锁，然后再来执行逻辑，此时就能够从缓存中拿到数据了。

- **逻辑过期**

    之所以会出现这个缓存击穿问题，主要原因是在于我们对key设置了过期时间，假设不设置过期时间，其实就不会有缓存击穿的问题。但是不设置过期时间，这样数据不就一直占用我们内存了吗？可以采用逻辑过期方案解决之。

    把过期时间设置在 redis的value中，注意：这个过期时间并不会直接作用于redis，而是通过逻辑去处理。假设线程1去查询缓存，然后从value中判断出来当前的数据已经过期了，此时线程1去获得互斥锁，那么其他线程会进行阻塞。获得了锁的线程会开启一个线程去进行重构数据的逻辑，直到新开的线程完成这个逻辑后，才释放锁。而线程1直接进行返回，假设现在线程3过来访问，由于线程线程2持有着锁，所以线程3无法获得锁，线程3也直接返回数据，只有等到新开的线程2把重建数据构建完后，其他线程才能走返回正确的数据。

    这种方案巧妙在于，异步的构建缓存，缺点在于在构建完缓存之前，返回的都是脏数据。

![image-20241010090902410.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241010090902410.png)

**对比：**

**互斥锁方案：**由于保证了互斥性，所以数据一致，且实现简单，因为仅仅只需要加一把锁而已，也没其他的事情需要操心，所以没有额外的内存消耗，缺点在于有锁就有死锁问题的发生，且只能串行执行性能肯定受到影响

**逻辑过期方案：** 线程读取过程中不需要等待，性能好，有一个额外的线程持有锁去进行重构数据，但是在重构数据完成前，其他的线程只能返回之前的数据，且实现起来麻烦

![1653357522914.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/1653357522914.png)

### 5.1 互斥锁

![image-20241010092426024.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241010092426024.png)

> [!NOTE]
> 互斥锁是一种悲观锁，认为线程安全问题一定会发生。

```java
private Result queryByIdWithMutex(Long id) {
    // 从Redis中查询
    String key = RedisConstant.CACHE_SHOP_KEY + id;
    Map<Object, Object> cacheShop = stringRedisTemplate.opsForHash().entries(key); 
    Shop shop = null;
    if (cacheShop.isEmpty()) {  // Redis中不存在，查询数据库
        // 查询数据库之前：获取锁
        String lockKey = "lock:shop:" + id;
        try {
            boolean isLock = tryLock(lockKey);
            while (!isLock) {
                // 获取失败
                // 休眠后继续获取
                Thread.sleep(200);
                //log.info("阻塞...");
                isLock = tryLock(lockKey);
            }
            // 获取到了锁
            // 先检查Redis中是否已经写入了，DoubleCheck
            cacheShop = stringRedisTemplate.opsForHash().entries(key);
            // 如果有了，直接拿Redis里面的然后返回
            if (cacheShop.size() != 0) { 
                // 因为一个线程拿到锁，不一定是因为它是第一个拿到锁的，也可能是因为别的线程操作完数据库把锁释放了，
                // 所以要检查是否为后面那种情况
                return Result.ok(cacheShop);
            } else { // 如果没有，就查数据库，写入Redis
                log.info("Redis缓存没命中，查询数据库");
                shop = getById(id);
                Map<String, Object> shopMap = BeanUtil.beanToMap(shop, new HashMap<>(),
                        CopyOptions.create()
                                    .setIgnoreNullValue(true)
                                    .setFieldValueEditor(
                                        (fieldName, fieldValue) -> 
                                            fieldValue == null ? null : fieldValue.toString()));
                stringRedisTemplate.opsForHash().putAll(key, shopMap);
                stringRedisTemplate.expire(key, RedisConstant.CACHE_SHOP_TTL, TimeUnit.MINUTES);

            }
        } catch (Exception e) {
            throw new HeimaDpException("商户服务查询数据库出现异常！");
        } finally {
            unlock(lockKey);
        }
    } else { // Redis中存在，直接返回
        shop = BeanUtil.fillBeanWithMap(cacheShop, new Shop(), false);
    }
    return Result.ok(shop);
}

private boolean tryLock(String key) {
    Boolean flag = stringRedisTemplate.opsForValue().setIfAbsent(key, "1", 10, TimeUnit.SECONDS);
    // 注意，这里为key设置过期时间是为了避免线程获取锁之后还没释放锁的时候宕机了，导致业务不可用
    return BooleanUtil.isTrue(flag); //函数的返回值为boolean类，如果直接返回Boolean会自动拆箱，可能出现空指针异常
}

private void unlock(String key) {
    stringRedisTemplate.delete(key);
}
```

### 5.2 逻辑过期

![image-20241010155113689.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241010155113689.png)

1. 新建一个实体类，加入过期时间的字段

    ```java
    @Data
    public class RedisShopData extends Shop {
        private LocalDateTime expireTime;
    }
    ```

2. 具体实现：

    ```java
    private Result queryByIdWithLogicTTL(Long id) {
        // 从Redis中查询
        String key = RedisConstant.CACHE_SHOP_KEY + id;
        Map<Object, Object> cacheShop = stringRedisTemplate.opsForHash().entries(key); //即使没有查到，也会返回size为0的map

        if (cacheShop.isEmpty()) { // 没有命中空值，但是Redis中数据异常，也不返回数据
            throw new HeimaDpException("Redis中没有数据，出错");
        } else { // 命中
            // 获取旧数据
            Shop shop = BeanUtil.fillBeanWithMap(cacheShop, new Shop(), false);
            // 获取过期时间
            String expireTimeStr = (String) cacheShop.get("expireTime");
            // 为什么不用BeanUtil的 fillBeanWithMap 方法获取expireTime呢，因为用fillBeanWithMap获取到的日期有误，不知道为什么
            
            // 将字符串转换为 LocalDateTime
            LocalDateTime expireTime = LocalDateTime
                .parse(expireTimeStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            // 判断缓存是否过期
            if (expireTime.isAfter(LocalDateTime.now())) { //没有过期，直接返回
                //log.info("数据没有过期，直接返回");
                return Result.ok(shop);
            } else { //如果过期了，就开一个线程再返回
                //log.info("数据过期，尝试获取锁，开启新线程重构缓存重构");
                String lockKey = "lock:shop:" + id;
                boolean isLock = tryLock(lockKey);
                if (isLock) {
                    log.info("获取锁成功");
                    CACHE_REBUILD_EXECUTOR.submit(() -> {
                        try {
                            // 查询数据库
                            Shop newShop = getById(id);
                            // 封装过期时间
                            RedisShopData redisShopData = new RedisShopData();
                            BeanUtil.copyProperties(newShop, redisShopData);
                            redisShopData.setExpireTime(LocalDateTime.now().plusSeconds(10));
                            // 写入Redis
                            Map<String, Object> shopMap = 
                                BeanUtil.beanToMap(redisShopData, new HashMap<>(),CopyOptions.create()
                                            .setIgnoreNullValue(true)
                                            .setFieldValueEditor(
                                                (fieldName, fieldValue) -> 
                                                    fieldValue == null ? null : fieldValue.toString()));
                            
                            stringRedisTemplate.opsForHash().putAll(key, shopMap);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        } finally {
                            unlock(lockKey);
                        }
                    });
                }

            }
            return Result.ok(shop);
        }
    }

    private boolean tryLock(String key) {
        Boolean flag = stringRedisTemplate.opsForValue().setIfAbsent(key, "1", 10, TimeUnit.SECONDS);
        return BooleanUtil.isTrue(flag);
    }

    private void unlock(String key) {
        stringRedisTemplate.delete(key);
    }
    ```

3. 如果Redis中不是以Hash存储数据，而是以String存，那么在存取的时候要进行序列化与反序列化，示例如下：

    ```java
    @Data
    public class RedisData {
        private LocalDateTime expireTime;
        private Object data;
    }
    ```

    ```java
    public Shop queryWithLogicalExpire(Long id) { //省略空值检查  
        String key = RedisConstant.CACHE_SHOP_KEY + id;  
        // 1.从redis查询商铺缓存  
        String json = stringRedisTemplate.opsForValue().get(key);  
        // 2.判断是否为空字符串  
        if (StrUtil.isBlank(json)) {             
            throw new HeimaDpException("Redis中没有数据，出错");  
        }  
        // 4.命中，需要先把json反序列化为对象  
        RedisData redisData = JSONUtil.toBean(json, RedisData.class);  
        Shop shop = JSONUtil.toBean((JSONObject) redisData.getData(), Shop.class);  
        LocalDateTime expireTime = redisData.getExpireTime();  
        // 5.判断是否过期  
        if (expireTime.isAfter(LocalDateTime.now())) {  
            // 5.1.未过期，直接返回店铺信息  
            return shop;  
        }  
        // 5.2.已过期，需要缓存重建  
        // 6.缓存重建  
        // 6.1.获取互斥锁  
        String lockKey = "lock:shop:" + id;  
        boolean isLock = tryLock(lockKey);  
        // 6.2.判断是否获取锁成功  
        if (isLock) {  
            CACHE_REBUILD_EXECUTOR.submit(() -> {  
                try {  
                    //重建缓存  
                    this.saveShop2Redis(id, 20L);  
                } catch (Exception e) {  
                    throw new RuntimeException(e);  
                } finally {  
                    unlock(lockKey);  
                }  
            });  
        }  
        // 6.4.返回过期的商铺信息  
        return shop;  
    }  
    
    public void saveShop2Redis(Long id, Long expireSeconds) {  
        Shop shop = getById(id);  
        RedisData redisData = new RedisData();  
        redisData.setData(shop);  
        redisData.setExpireTime(LocalDateTime.now().plusSeconds(expireSeconds));  
        stringRedisTemplate.opsForValue()  
            .set(RedisConstant.CACHE_SHOP_KEY + id, JSONUtil.toJsonStr(redisData));  
    }
    ```
