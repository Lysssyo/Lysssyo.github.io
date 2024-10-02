---
title: Redis简介
date: 2024-10-02 22:03:00 +0800
categories: [中间件,Redis]
tags: [Redis]
---

### 1.1 认识NoSQL

**NoSql**可以翻译做Not Only Sql（不仅仅是SQL），或者是No Sql（非Sql的）数据库。是相对于传统关系型数据库而言，有很大差异的一种特殊的数据库，因此也称之为**非关系型数据库**。

#### 1.1.1 结构化与非结构化

传统关系型数据库是结构化数据，每一张表都有严格的约束信息：字段名、字段数据类型、字段约束等等信息，插入的数据必须遵守这些约束：

![image-20241002214533787](/assets/Redis.assets/image-20241002214533787.png)

而NoSql则对数据库格式没有严格约束，往往形式松散，自由。

可以是键值型：

<img src="/assets/Redis.assets/image-20241002214541472.png" alt="image-20241002214541472" style="zoom:67%;" />

也可以是文档型：

<img src="/assets/Redis.assets/image-20241002214553496.png" alt="image-20241002214553496" style="zoom:80%;" />



甚至可以是图格式：

<img src="/assets/Redis.assets/image-20241002214605616.png" alt="image-20241002214605616" style="zoom:55%;" />



#### 1.1.2 关联和非关联

传统数据库的表与表之间往往存在关联，例如外键：

<img src="/assets/Redis.assets/image-20241002214638630.png" alt="image-20241002214638630" style="zoom:67%;" />

而非关系型数据库不存在关联关系，要维护关系要么靠代码中的业务逻辑，要么靠数据之间的耦合：

```json
{
  id: 1,
  name: "张三",
  orders: [
    {
       id: 1,
       item: {
	 id: 10, title: "荣耀6", price: 4999
       }
    },
    {
       id: 2,
       item: {
	 id: 20, title: "小米11", price: 3999
       }
    }
  ]
}
```

此处要维护“张三”的订单与商品“荣耀”和“小米11”的关系，不得不冗余的将这两个商品保存在张三的订单文档中，不够优雅。还是建议用业务来维护关联关系。



#### 1.1.3 查询方式

传统关系型数据库会基于Sql语句做查询，语法有统一标准；

而不同的非关系数据库查询语法差异极大，五花八门各种各样。

<img src="/assets/Redis.assets/image-20241002214702301.png" alt="image-20241002214702301" style="zoom: 50%;" />



#### 1.1.4 事务

传统关系型数据库能满足事务ACID的原则。

而非关系型数据库往往不支持事务，或者不能严格保证ACID的特性，只能实现基本的一致性。



#### 1.1.5 总结

除了上述四点以外，在存储方式、扩展性、查询性能上关系型与非关系型也都有着显著差异，总结如下：

<img src="/assets/Redis.assets/image-20241002214747835.png" alt="image-20241002214747835" style="zoom:80%;" />

- 存储方式
  - 关系型数据库基于磁盘进行存储，会有大量的磁盘IO，对性能有一定影响
  - 非关系型数据库，他们的操作更多的是依赖于内存来操作，内存的读写速度会非常快，性能自然会好一些

* 扩展性
  * 关系型数据库集群模式一般是主从，主从数据一致，起到数据备份的作用，称为垂直扩展。
  * 非关系型数据库可以将数据拆分，存储在不同机器上，可以保存海量数据，解决内存大小有限的问题。称为水平扩展。
  * 关系型数据库因为表之间存在关联关系，如果做水平扩展会给数据查询带来很多麻烦



### 1.2 认识Redis

Redis诞生于2009年全称是**Re**mote  **D**ictionary **S**erver 远程词典服务器，是一个基于内存的键值型NoSQL数据库。

**特征**：

- 键值（key-value）型，value支持多种不同数据结构，功能丰富
- 单线程，每个命令具备原子性
- 低延迟，速度快（基于内存.IO多路复用.良好的编码）。
- 支持数据持久化
- 支持主从集群.分片集群
- 支持多语言客户端

**作者**：Antirez

Redis的官方网站地址：https://redis.io/



## 2. Redis常见命令

### 2.1 Redis数据结构介绍

Redis是一个`key-value`的数据库，`key`一般是`String`类型，不过`value`的类型多种多样：

<img src="/assets/Redis简介.assets/image-20241002215956370.png" alt="image-20241002215956370" style="zoom: 80%;" />



### 2.2 Redis 通用命令

| 命令   | 描述                                               |
| ------ | -------------------------------------------------- |
| KEYS   | 查看符合模板的所有key                              |
| DEL    | 删除一个指定的key                                  |
| EXITS  | 判断key是否存在                                    |
| EXPIRE | 给一个key设置有效期，有效期到期时该key会被自动删除 |
| TTL    | 查看一个KEY的剩余有效期                            |



### 2.3 String命令

String类型，也就是字符串类型，是Redis中最简单的存储类型。

String类型的`value`是字符串，根据字符串的格式不同，又可以分为3类：

* string：普通字符串
* int：整数类型，可以做自增、自减操作
* float：浮点类型，可以做自增、自减操作

String的常见命令有：

| 命令        | 描述                                                         |
| ----------- | ------------------------------------------------------------ |
| SET         | 添加或者修改已经存在的一个String类型的键值对                 |
| GET         | 根据key获取String类型的value                                 |
| MSET        | 批量添加多个String类型的键值对                               |
| MGET        | 根据多个key获取多个String类型的value                         |
| INCR        | 让一个整型的key自增1                                         |
| INCRBY      | 让一个整型的key自增并指定步长，例如：incrby num 2 让num值自增2 |
| INCRBYFLOAT | 让一个浮点类型的数字自增并指定步长                           |
| SETNX       | 添加一个String类型的键值对，前提是这个key不存在，否则不执行  |
| SETEX       | 添加一个String类型的键值对，并且指定有效期                   |

> 以上命令除了INCRBYFLOAT 都是常用命令



### 2.4 Key的层级结构

Redis的key允许有多个单词形成层级结构，多个单词之间用':'隔开，例如`项目名:业务名:类型:id`

> 这个格式并非固定，也可以根据自己的需求来删除或添加词条。
>
> 例如我们的项目名称叫 heima，有user和product两种不同类型的数据，我们可以这样定义key：
>
> user相关的key：`heima:user:1`
>
> product相关的key：`heima:product:1`

如果`value`是一个Java对象，例如一个`User`对象，则可以将对象序列化为JSON字符串后存储：

| **KEY**         | **VALUE**                                 |
| --------------- | ----------------------------------------- |
| heima:user:1    | {"id":1, "name": "Jack", "age": 21}       |
| heima:product:1 | {"id":1, "name": "小米11", "price": 4999} |

一旦我们向redis采用这样的方式存储，那么在可视化界面中，redis会以层级结构来进行存储，形成类似于这样的结构，更加方便Redis获取数据



### 2.5 Hash命令

Hash类型，也叫散列，其value是一个无序字典，类似于Java中的HashMap结构。

String结构是将对象序列化为JSON字符串后存储，当需要修改对象某个字段时很不方便：

| **KEY**         | **VALUE**                                 |
| --------------- | ----------------------------------------- |
| heima:user:1    | {"id":1, "name": "Jack", "age": 21}       |
| heima:product:1 | {"id":1, "name": "小米11", "price": 4999} |

Hash结构可以将对象中的每个字段独立存储，可以针对单个字段做CRUD：

<img src="/assets/Redis简介.assets/image-20241002220018565.png" alt="image-20241002220018565" style="zoom:80%;" />

**Hash类型的常见命令**

| 命令                 | 描述                                                         |
| -------------------- | ------------------------------------------------------------ |
| HSET key field value | 添加或者修改hash类型key的field的值                           |
| HGET key field       | 获取一个hash类型key的field的值                               |
| HMSET                | 批量添加多个hash类型key的field的值                           |
| HMGET                | 批量获取多个hash类型key的field的值                           |
| HGETALL              | 获取一个hash类型的key中的所有的field和value                  |
| HKEYS                | 获取一个hash类型的key中的所有的field                         |
| HVALS                | 获取一个hash类型的key中的所有的value                         |
| HINCRBY              | 让一个hash类型key的字段值自增并指定步长                      |
| HSETNX               | 添加一个hash类型的key的field值，前提是这个field不存在，否则不执行 |



### 2.6 List命令

Redis中的`List`类型与Java中的`LinkedList`类似，可以看做是一个双向链表结构。既可以支持正向检索和也可以支持反向检索。

特征也与LinkedList类似：

* 有序
* 元素可以重复
* 插入和删除快
* 查询速度一般

常用来存储一个有序数据，例如：朋友圈点赞列表，评论列表等。

**List的常见命令有：**

| 命令                | 描述                                                         |
| ------------------- | ------------------------------------------------------------ |
| LPUSH key element   | 向列表左侧插入一个或多个元素                                 |
| LPOP key            | 移除并返回列表左侧的第一个元素，列表为空则返回null           |
| RPUSH key element   | 向列表右侧插入一个或多个元素                                 |
| RPOP key            | 移除并返回列表右侧的第一个元素，列表为空则返回null           |
| LRANGE key star end | 返回一段角标范围内的所有元素，从0开始                        |
| BLPOP BRPOP         | 与LPOP和RPOP类似，只不过在，列表为空时等待指定时间，而不是直接返回null |

<img src="/assets/Redis简介.assets/image-20241002220029214.png" alt="image-20241002220029214" style="zoom:67%;" />



### 2.7 Set命令

Redis的Set结构与Java中的HashSet类似，可以看做是一个value为null的HashMap。因为也是一个hash表，因此具备与HashSet类似的特征：

* 无序
* 元素不可重复
* 查找快
* 支持交集.并集.差集等功能

**Set类型的常见命令**

| 命令                         | 描述                        |
| ---------------------------- | --------------------------- |
| SADD key member [member ...] | 向set中添加一个或多个元素   |
| SREM key member [member ...] | 移除set中的指定元素         |
| SCARD key                    | 返回set中元素的个数         |
| SISMEMBER key member         | 判断一个元素是否存在于set中 |
| SMEMBERS                     | 获取set中的所有元素         |
| SINTER key [key ... ]        | 求所有key的交集             |
| SDIFF key [key ...]          | 求所有key的差集             |
| SUNION key [key ...]         | 求所有key的并集             |



### 2.8 SortedSet类型

Redis的SortedSet是一个可排序的set集合，与Java中的TreeSet有些类似，但底层数据结构却差别很大。SortedSet中的每一个元素都带有一个score属性，可以基于score属性对元素排序，底层的实现是一个跳表（SkipList）加 hash表。

SortedSet具备下列特性：

- 可排序
- 元素不重复
- 查询速度快

因为SortedSet的可排序特性，经常被用来实现排行榜这样的功能。

| 命令                         | 描述                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| ZADD key score member        | 添加一个或多个元素到sorted set ，如果已经存在则更新其score值 |
| ZREM key member              | 删除sorted set中的一个指定元素                               |
| ZSCORE key member            | 获取sorted set中的指定元素的score值                          |
| ZRANK key member             | 获取sorted set 中的指定元素的排名                            |
| ZCARD key                    | 获取sorted set中的元素个数                                   |
| ZCOUNT key min max           | 统计score值在给定范围内的所有元素的个数                      |
| ZINCRBY key increment member | 让sorted set中的指定元素自增，步长为指定的increment值        |
| ZRANGE key min max           | 按照score排序后，获取指定排名范围内的元素                    |
| ZRANGEBYSCORE key min max    | 按照score排序后，获取指定score范围内的元素                   |
| ZDIFF.ZINTER.ZUNION          | 求差集、交集、并集                                           |

> 注意：所有的排名默认都是升序，如果要降序则在命令的Z后面添加REV即可，例如：
>
> - **升序**获取sorted set 中的指定元素的排名：ZRANK key member
> - **降序**获取sorted set 中的指定元素的排名：ZREVRANK key memeber



## 3. Jedis

在Redis官网中提供了各种语言的客户端，地址：https://redis.io/docs/clients/

其中Java客户端也包含很多：

<img src="/assets/Redis简介.assets/image-20241002220041056.png" alt="image-20241002220041056" style="zoom:67%;" />

标记为❤的就是推荐使用的java客户端，包括：

- Jedis和Lettuce：这两个主要是提供了Redis命令对应的API，方便我们操作Redis，而SpringDataRedis又对这两种做了抽象和封装，因此我们后期会直接以SpringDataRedis来学习。
- Redisson：是在Redis基础上实现了分布式的可伸缩的java数据结构，例如Map.Queue等，而且支持跨进程的同步机制：Lock.Semaphore等待，比较适合用来实现特殊的功能需求。



### 3.1 Demo

1. 引入依赖

```xml
<!--jedis-->
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
    <version>3.7.0</version>
</dependency>
```

2. 建立连接

```java
private Jedis jedis;

@BeforeEach
void setUp() {
    // 1.建立连接
    jedis = new Jedis("192.168.150.101", 6379);
    // 2.设置密码
    jedis.auth("123321");
    // 3.选择库
    jedis.select(0);
}
```

3. 测试

```java
@Test
void testString() {
    // 存入数据
    String result = jedis.set("name", "虎哥");
    System.out.println("result = " + result);
    // 获取数据
    String name = jedis.get("name");
    System.out.println("name = " + name);
}

@Test
void testHash() {
    // 插入hash数据
    jedis.hset("user:1", "name", "Jack");
    jedis.hset("user:1", "age", "21");

    // 获取
    Map<String, String> map = jedis.hgetAll("user:1");
    System.out.println(map);
}
```

4. 释放资源

```java
@AfterEach
void tearDown() {
    if (jedis != null) {
        jedis.close();
    }
}
```



### 3.2 Jedis连接池

Jedis本身是线程不安全的，并且频繁的创建和销毁连接会有性能损耗，因此我们推荐大家使用Jedis连接池代替Jedis的直连方式。

> 有关池化思想，并不仅仅是这里会使用，很多地方都有，比如说我们的数据库连接池，比如我们tomcat中的线程池，这些都是池化思想的体现。



#### 3.2.1 创建Jedis的连接池

```java
public class JedisConnectionFactory {

     private static final JedisPool jedisPool;

     static {
         // 配置连接池
         JedisPoolConfig poolConfig = new JedisPoolConfig();
         // 最大连接
         poolConfig.setMaxTotal(8);
         // 最大空闲连接
         poolConfig.setMaxIdle(8);
         // 最小空闲连接
         poolConfig.setMinIdle(0);
         // 最长等待时间
         poolConfig.setMaxWaitMillis(1000);
         // 创建连接池对象
         jedisPool = new JedisPool(poolConfig, "localhost", 6379, 1000, "123456");
     }

     public static Jedis getJedis(){
          return jedisPool.getResource();
     }
}
```

**代码说明：**

-  JedisConnectionFacotry：工厂设计模式是实际开发中非常常用的一种设计模式，我们可以使用工厂，去降低代的耦合，比如Spring中的Bean的创建，就用到了工厂设计模式

-  静态代码块：随着类的加载而加载，确保只能执行一次，我们在加载当前工厂类的时候，就可以执行static的操作完成对连接池的初始化

-  最后提供返回连接池中连接的方法



#### 3.2.2 改造Demo

**代码说明:**

1.在我们完成了使用工厂设计模式来完成代码的编写之后，我们在获得连接时，就可以通过工厂来获得。而不用直接去new对象，降低耦合，并且使用的还是连接池对象。

2.当我们使用了连接池后，当我们关闭连接其实并不是关闭，而是将Jedis还回连接池的。

```java
    @BeforeEach
    void setUp(){
        //建立连接
        /*jedis = new Jedis("127.0.0.1",6379);*/
        jedis = JedisConnectionFactory.getJedis();
         //选择库
        jedis.select(0);
    }

   @AfterEach
    void tearDown() {
        if (jedis != null) {
            jedis.close();
        }
    }
```



## 4. SpringDataRedis

SpringData是Spring中数据操作的模块，包含对各种数据库的集成，其中对Redis的集成模块就叫做SpringDataRedis，官网地址：https://spring.io/projects/spring-data-redis

* 提供了对不同Redis客户端的整合（Lettuce和Jedis）
* 提供了RedisTemplate统一API来操作Redis
* 支持Redis的发布订阅模型
* 支持Redis哨兵和Redis集群
* 支持基于Lettuce的响应式编程
* 支持基于JDK.JSON.字符串.Spring对象的数据序列化及反序列化
* 支持基于Redis的JDKCollection实现

SpringDataRedis中提供了RedisTemplate工具类，其中封装了各种对Redis的操作。并且将不同数据类型的操作API封装到了不同的类型中：

![image-20241002220054485](/assets/Redis简介.assets/image-20241002220054485.png)



### 4.1 Demo

SpringBoot已经提供了对SpringDataRedis的支持，使用非常简单：

1. 导入pom坐标

```xml
        <!--redis依赖-->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-redis</artifactId>
        </dependency>
        <!--common-pool-->
        <dependency>
            <groupId>org.apache.commons</groupId>
            <artifactId>commons-pool2</artifactId>
        </dependency>
        <!--Jackson依赖-->
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.13.4</version> <!-- 或你项目兼容的版本 -->
        </dependency>
```

2. 基础配置

```yaml
spring:
  redis:
    host: 192.168.150.101
    port: 6379
    password: 123321
    lettuce:
      pool:
        max-active: 8  #最大连接
        max-idle: 8   #最大空闲连接
        min-idle: 0   #最小空闲连接
        max-wait: 100ms #连接等待时间
```

3. 测试

```java
@SpringBootTest
class RedisDemoApplicationTests {

    //@Autowired 按类型注入，如果没有自定义RedisTemplate<String, Object>类型的bean，这里会报错
    @Resource //报错可以改用@Resource，按名称注入
    private RedisTemplate<String, Object> redisTemplate;

    @Test
    void testString() {
        // 写入一条String数据
        redisTemplate.opsForValue().set("name", "虎哥");
        // 获取string数据
        Object name = redisTemplate.opsForValue().get("name");
        System.out.println("name = " + name);
    }
}
```



### 4.2 数据序列化器

`RedisTemplate`可以接收任意`Object`作为值写入Redis：

<img src="/assets/Redis简介.assets/image-20241002220103759.png" alt="image-20241002220103759" style="zoom:67%;" />

只不过写入前会把Object序列化为字节形式，默认是采用JDK序列化，得到的结果是这样的：

<img src="/assets/Redis简介.assets/image-20241002220112112.png" alt="image-20241002220112112" style="zoom:67%;" />

缺点：

- 可读性差
- 内存占用较大

我们可以**自定义RedisTemplate的序列化方式**，代码如下：

```java
@Configuration
public class RedisConfig {

    @Bean// 创建JSON序列化工具
    public GenericJackson2JsonRedisSerializer jsonRedisSerializer() {
        return new GenericJackson2JsonRedisSerializer();
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory, GenericJackson2JsonRedisSerializer jsonRedisSerializer) {
        // 创建RedisTemplate对象
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        // 设置连接工厂
        template.setConnectionFactory(connectionFactory);
        // 设置Key的序列化
        template.setKeySerializer(RedisSerializer.string());
        template.setHashKeySerializer(RedisSerializer.string());
        // 设置Value的序列化
        template.setValueSerializer(jsonRedisSerializer); //通过方法参数注入，自动注入
        template.setHashValueSerializer(jsonRedisSerializer);
        // 返回
        return template;
    }
}
```

这里采用了JSON序列化来代替默认的JDK序列化方式。最终结果如图：

<img src="/assets/Redis简介.assets/image-20241002220124610.png" alt="image-20241002220124610" style="zoom:67%;" />

整体可读性有了很大提升，并且能将Java对象自动的序列化为JSON字符串，并且查询时能自动把JSON反序列化为Java对象。不过，其中记录了序列化时对应的class名称，目的是为了查询时实现自动反序列化。这会带来额外的内存开销。



### 4.3 StringRedisTemplate

尽管JSON的序列化方式可以满足我们的需求，但依然存在一些问题，如图：

<img src="/assets/Redis简介.assets/image-20241002220132638.png" alt="image-20241002220132638" style="zoom: 80%;" />

为了在反序列化时知道对象的类型，JSON序列化器会将类的class类型写入json结果中，存入Redis，会带来额外的内存开销。

为了减少内存的消耗，我们可以采用手动序列化的方式，换句话说，就是不借助默认的序列化器，而是我们自己来控制序列化的动作，同时，**我们只采用String的序列化器**，这样，在存储value时，我们就不需要在内存中就不用多存储数据，从而节约我们的内存空间

![image-20241002220147148](/assets/Redis简介.assets/image-20241002220147148.png)

这种用法比较普遍，因此SpringDataRedis就提供了RedisTemplate的子类：StringRedisTemplate，它的key和value的序列化方式默认就是String方式。

<img src="/assets/Redis简介.assets/image-20241002220156109.png" alt="image-20241002220156109" style="zoom: 67%;" />



省去了我们自定义RedisTemplate的序列化方式的步骤，而是直接使用：

```java
@SpringBootTest
class RedisDemoApplicationTests {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Test
    void testString() {
        User user = new User("Keith", "male", 20);
        String jsonUser = JSON.toJSONString(user);
        stringRedisTemplate.opsForValue().set("User", jsonUser);
        String stringUser = stringRedisTemplate.opsForValue().get("User");
        User user2 = JSON.parseObject(stringUser, User.class);
        if (user2 != null) {
            System.out.println(user2.getName());
        }
    }
}
```

结果：

<img src="/assets/Redis.assets/image-20241002214052981.png" alt="image-20241002214052981" style="zoom: 67%;" />



### 4.4 Hash结构操作

```java
@SpringBootTest
class RedisStringTests {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Test
    void testHash() {
        Map<String, String> map = Map.of(
                "name", "Keith",
                "gender", "male"
        );
        stringRedisTemplate.opsForHash().putAll("user:400", map);
        stringRedisTemplate.opsForHash().put("user:400", "userName", "Lysssyo");
        stringRedisTemplate.opsForHash().put("user:400", "age", "21");

        Map<Object, Object> entries = stringRedisTemplate.opsForHash().entries("user:400");
        System.out.println("entries = " + entries);
    }
}
```

