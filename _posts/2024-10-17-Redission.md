---
title: Redission
date: 2024-10-17 09:42:00 +0800
categories: [中间件, Redis]
tags: [Redis,Redission]
---



## 1. 简单Demo

1. 引入依赖

   ```pom
   <dependency>
   	<groupId>org.redisson</groupId>
   	<artifactId>redisson</artifactId>
   	<version>3.13.6</version>
   </dependency>
   ```

2. 配置Redisson客户端

   ```java
   @Configuration
   public class RedissonConfig {
   
       @Bean
       public RedissonClient redissonClient(){
           // 配置
           Config config = new Config();
           config.useSingleServer().setAddress("redis://192.168.150.101:6379")
               .setPassword("123321");
           // 创建RedissonClient对象
           return Redisson.create(config);
       }
   }
   ```

3. 使用Redission的分布式锁

   ```java
   @Resource
   private RedissionClient redissonClient;
   
   @Test
   void testRedisson() throws Exception{
       //获取锁(可重入)，指定锁的名称
       RLock lock = redissonClient.getLock("anyLock");
       //尝试获取锁，参数分别是：获取锁的最大等待时间(期间会重试)，锁自动释放时间，时间单位
       boolean isLock = lock.tryLock(1,10,TimeUnit.SECONDS);
       //判断获取锁成功
       if(isLock){
           try{
               System.out.println("执行业务");          
           }finally{
               //释放锁
               lock.unlock();
           }
           
       }   
   }
   ```

4. 以秒杀业务为例

   原代码：

   ```java
   	@Override
       public Result seckillVoucher(Long voucherId) {
       	// 1.查询优惠券
   	    SeckillVoucher voucher = seckillVoucherService.getById(voucherId);
       	// 2.判断秒杀是否开始
   	    if (voucher.getBeginTime().isAfter(LocalDateTime.now())) {
       	    // 尚未开始
           	throw new HeimaDpException(CommonException.SEC_KILL_NOT_BEGIN.getErrMessage());
   	    }
           // 3.判断秒杀是否已经结束
           if (voucher.getEndTime().isBefore(LocalDateTime.now())) {
               // 尚未开始
               throw new HeimaDpException(CommonException.SEC_KILL_HAS_BEEN_ENDED.getErrMessage());
           }
           // 4.判断库存是否充足
           if (voucher.getStock() < 1) {
               // 库存不足
               throw new HeimaDpException(CommonException.SOCK_NOT_ENOUGH.getErrMessage());
           }
           
           Long userId = UserHolder.getUser().getId();
           // 创建锁对象
           SimpleRedisLock lock = new SimpleRedisLock("order:" + userId, stringRedisTemplate);
           // 获取锁对象
           boolean isLock = lock.tryLock(10); // 10秒后自动释放
   		// 加锁失败
           if (!isLock) {
               throw new HeimaDpException("加锁失败，已给用户上锁！");
           }
           try {
               // 获取代理对象，代理对象执行 createVoucherOrder，开启事务
               long voucherOrderId = currentProxy.createVoucherOrder(voucherId, voucher);
               return Result.ok(voucherOrderId);
           } finally {
               // 释放锁
               lock.unlock();
           }
       }
   
       public long createVoucherOrder(Long voucherId, SeckillVoucher voucher) {
   
           //5，扣减库存
           boolean success = seckillVoucherMapper.updateStock(voucherId, voucher.getStock());
           if (!success) {
               //扣减库存
               throw new HeimaDpException(CommonException.SEC_KILL_HAS_BEEN_ENDED.getErrMessage());
           }
           //6.创建订单
           VoucherOrder voucherOrder = new VoucherOrder();
           // 6.1.订单id
           long orderId = redisWorker.nextId("order");
           voucherOrder.setId(orderId);
           // 6.2.用户id
           Long userId = UserHolder.getUser().getId();
           voucherOrder.setUserId(userId);
           // 6.3.代金券id
           voucherOrder.setVoucherId(voucherId);
           save(voucherOrder);
           return orderId;
       }
   ```

   修改为：

   ```java
   @Resource
   private RedissonClient redissonClient;
   
   @Override
   public Result seckillVoucher(Long voucherId) {
           ...
           Long userId = UserHolder.getUser().getId();
           //创建锁对象 这个代码不用了，因为我们现在要使用分布式锁
           //SimpleRedisLock lock = new SimpleRedisLock("order:" + userId, stringRedisTemplate);
           RLock lock = redissonClient.getLock("lock:order:" + userId);
           //获取锁对象
           boolean isLock = lock.tryLock();
          
   		//加锁失败
           if (!isLock) {
               return Result.fail("不允许重复下单");
           }
           try {
               //获取代理对象(事务)
               IVoucherOrderService proxy = (IVoucherOrderService) AopContext.currentProxy();
               return proxy.createVoucherOrder(voucherId);
           } finally {
               //释放锁
               lock.unlock();
           }
    }
   ```
