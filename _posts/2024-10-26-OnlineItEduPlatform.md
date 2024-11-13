---
title: IT在线教育平台
date: 2024-10-26 14:45:00 +0800
categories: [Java, 项目]
tags: [Java,业务,简历项目]
---



## 1. 业务

### 1.1 微服务相关配置

### 1.2 SpringSecurity统一登录校验



### 1.3 课程发布功能中的分布式事务最终一致性控制

#### 1.3.1 基本流程

基于xxl-job，本地消息表以及乐观锁，完成课程发布功能中的分布式事务最终一致性控制

<img src="assets/2024-10-26-coursePublish.assets/image-20241026145906546.png" alt="image-20241026145906546" style="zoom:80%;" />

课程发布后，需要异步进行 “生成课程静态化页面并上传至文件系统” ，“将课程信息缓存至redis”。课程发布时，已经将相关信息添加到消息表（即消息类型代码message_type以及关联业务信息`bussiness_key1`）。

> 消息表结构如下：
>
> ![image-20241026152109538](assets/2024-10-26-coursePublish.assets/image-20241026152109538.png)
>
> 定义消息表，可以统一处理

#### 1.3.2 消息SDK

```java
@Slf4j
@Data
public abstract class MessageProcessAbstract {

    @Autowired
    MqMessageService mqMessageService;


    /**
     * @param mqMessage 执行任务内容
     * @return boolean true:处理成功，false处理失败
     * @description 任务处理
     * @author Mr.M
     * @date 2022/9/21 19:47
     */
    public abstract boolean execute(MqMessage mqMessage);


    /**
     * @param shardIndex  分片序号
     * @param shardTotal  分片总数
     * @param messageType 消息类型
     * @param count       一次取出任务总数
     * @param timeout     预估任务执行时间,到此时间如果任务还没有结束则强制结束 单位秒
     * @return void
     * @description 扫描消息表多线程执行任务
     * @author Mr.M
     * @date 2022/9/21 20:35
     */
    public void process(int shardIndex, int shardTotal, String messageType, int count, long timeout) {

        try {
            //扫描消息表获取任务清单
            List<MqMessage> messageList = mqMessageService.getMessageList(shardIndex, shardTotal, messageType, count);
            //任务个数
            int size = messageList.size();
            log.debug("取出待处理消息" + size + "条");
            if (size <= 0) {
                return;
            }

            //创建线程池
            ExecutorService threadPool = Executors.newFixedThreadPool(size);
            //计数器
            CountDownLatch countDownLatch = new CountDownLatch(size);
            messageList.forEach(message -> {
                threadPool.execute(() -> {
                    log.debug("开始任务:{}", message);
                    //处理任务
                    try {
                        boolean result = execute(message);
                        if (result) {
                            log.debug("任务执行成功:{})", message);

                            //更新任务状态,删除消息表记录,添加到历史表
                            int completed = mqMessageService.completed(message.getId());
                            if (completed > 0) {
                                log.debug("任务执行成功:{}", message);
                            } else {
                                log.debug("任务执行失败:{}", message);
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                        log.debug("任务出现异常:{},任务:{}", e.getMessage(), message);
                    } finally {
                        //计数
                        countDownLatch.countDown();
                    }
                    log.debug("结束任务:{}", message);

                });
            });

            //等待,给一个充裕的超时时间,防止无限等待，到达超时时间还没有处理完成则结束任务
            countDownLatch.await(timeout, TimeUnit.SECONDS);
            System.out.println("结束....");
            // 关闭线程池F
            threadPool.shutdown();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }


    }
}
```

- `MessageProcessAbstract`是一个抽象类，`MessageProcessAbstract`中的`execute`方法在本类的`process`方法中调用，用户需要继承`MessageProcessAbstract`类，实现其`execute`方法（定义具体的消息处理逻辑）。

- 在`MessageProcessAbstract`的`process`方法中，使用`MqMessageService`接口获取待处理的消息列表，然后通过多线程执行消息处理逻辑。每条消息的处理结果由`execute`方法决定，若处理成功则调用`completed`方法将任务标记为完成，最后归档到历史表中。



```java
public interface MqMessageService extends IService<MqMessage> {

    /**
     * @description 扫描消息表记录，采用与扫描视频处理表相同的思路
     * @param shardIndex 分片序号
     * @param shardTotal 分片总数
     * @param count 扫描记录数
     * @return java.util.List 消息记录
     * @author Mr.M
     * @date 2022/9/21 18:55
     */
    public List<MqMessage> getMessageList(int shardIndex, int shardTotal,  String messageType,int count);

    /**
     * @description 添加消息
     * @param businessKey1 业务id
     * @param businessKey2 业务id
     * @param businessKey3 业务id
     * @return com.xuecheng.messagesdk.model.po.MqMessage 消息内容
     * @author Mr.M
     * @date 2022/9/23 13:45
    */
    public MqMessage addMessage(String messageType,String businessKey1,String businessKey2,String businessKey3);
    /**
     * @description 完成任务
     * @param id 消息id
     * @return int 更新成功：1
     * @author Mr.M
     * @date 2022/9/21 20:49
     */
    public int completed(long id);

    /**
     * @description 完成阶段任务
     * @param id 消息id
     * @return int 更新成功：1
     * @author Mr.M
     * @date 2022/9/21 20:49
     */
    public int completedStageOne(long id);
    public int completedStageTwo(long id);
    public int completedStageThree(long id);
    public int completedStageFour(long id);

    /**
     * @description 查询阶段状态
     * @param id
     * @return int
     * @author Mr.M
     * @date 2022/9/21 20:54
    */
    public int getStageOne(long id);
    public int getStageTwo(long id);
    public int getStageThree(long id);
    public int getStageFour(long id);

}

@Slf4j
@Service
public class MqMessageServiceImpl extends ServiceImpl<MqMessageMapper, MqMessage> implements MqMessageService {

    @Autowired
    MqMessageMapper mqMessageMapper;

    @Autowired
    MqMessageHistoryMapper mqMessageHistoryMapper;


    @Override
    public List<MqMessage> getMessageList(int shardIndex, int shardTotal, String messageType,int count) {
        return mqMessageMapper.selectListByShardIndex(shardTotal,shardIndex,messageType,count);
    }

    @Override
    public MqMessage addMessage(String messageType, String businessKey1, String businessKey2, String businessKey3) {
        MqMessage mqMessage = new MqMessage();
        mqMessage.setMessageType(messageType);
        mqMessage.setBusinessKey1(businessKey1);
        mqMessage.setBusinessKey2(businessKey2);
        mqMessage.setBusinessKey3(businessKey3);
        int insert = mqMessageMapper.insert(mqMessage);
        if(insert>0){
            return mqMessage;
        }else{
            return null;
        }

    }

    @Transactional
    @Override
    public int completed(long id) {
        MqMessage mqMessage = new MqMessage();
        //完成任务
        mqMessage.setState("1");
        int update = mqMessageMapper.update(mqMessage, new LambdaQueryWrapper<MqMessage>().eq(MqMessage::getId, id));
        if(update>0){

            mqMessage = mqMessageMapper.selectById(id);
            //添加到历史表
            MqMessageHistory mqMessageHistory = new MqMessageHistory();
            BeanUtils.copyProperties(mqMessage,mqMessageHistory);
            mqMessageHistoryMapper.insert(mqMessageHistory);
            //删除消息表
            mqMessageMapper.deleteById(id);
            return 1;
        }
        return 0;

    }

    @Override
    public int completedStageOne(long id) {
        MqMessage mqMessage = new MqMessage();
        //完成阶段1任务
        mqMessage.setStageState1("1");
        return mqMessageMapper.update(mqMessage,new LambdaQueryWrapper<MqMessage>().eq(MqMessage::getId,id));
    }

    @Override
    public int completedStageTwo(long id) {
        MqMessage mqMessage = new MqMessage();
        //完成阶段2任务
        mqMessage.setStageState2("1");
        return mqMessageMapper.update(mqMessage,new LambdaQueryWrapper<MqMessage>().eq(MqMessage::getId,id));
    }

    @Override
    public int completedStageThree(long id) {
        MqMessage mqMessage = new MqMessage();
        //完成阶段3任务
        mqMessage.setStageState3("1");
        return mqMessageMapper.update(mqMessage,new LambdaQueryWrapper<MqMessage>().eq(MqMessage::getId,id));
    }

    @Override
    public int completedStageFour(long id) {
        MqMessage mqMessage = new MqMessage();
        //完成阶段4任务
        mqMessage.setStageState4("1");
        return mqMessageMapper.update(mqMessage,new LambdaQueryWrapper<MqMessage>().eq(MqMessage::getId,id));
    }

    @Override
    public int getStageOne(long id) {
        return Integer.parseInt(mqMessageMapper.selectById(id).getStageState1());
    }

    @Override
    public int getStageTwo(long id) {
        return Integer.parseInt(mqMessageMapper.selectById(id).getStageState2());
    }

    @Override
    public int getStageThree(long id) {
        return Integer.parseInt(mqMessageMapper.selectById(id).getStageState3());
    }

    @Override
    public int getStageFour(long id) {
        return Integer.parseInt(mqMessageMapper.selectById(id).getStageState4());
    }


}
```

`MessageProcessAbstract`中的`MqMessageService`接口用于提供消息处理服务的方法，主要包括获取消息、添加消息、标记任务完成、完成任务阶段以及查询任务阶段的状态。它通过这些方法管理消息表中的任务并确保任务的执行状态同步，最终实现消息的状态更新与历史记录的归档。

#### 1.3.3 异步消息处理

```java
@Component
@Slf4j
public class CoursePublishTask extends MessageProcessAbstract {
    @Autowired
    CoursePublishService coursePublishService;

    @XxlJob("coursePublishJobHandler")
    public void coursePublishJobHandler() {
        // 分片参数
        int shardIndex = XxlJobHelper.getShardIndex();
        int shardTotal = XxlJobHelper.getShardTotal();
        log.info("分片参数：当前分片序号 = {}, 总分片数 = {}", shardIndex, shardTotal);
        //参数:分片序号、分片总数、消息类型、一次最多取到的任务数量、一次任务调度执行的超时时间
        process(shardIndex, shardTotal, "course_publish", 30, 60);

    }


    @Override
    public boolean execute(MqMessage mqMessage) {   // 加Redis分布式锁
        // 获取消息相关的业务信息
        String businessKey1 = mqMessage.getBusinessKey1();// courseId
        long courseId = Long.parseLong(businessKey1);
        // 课程静态化
        generateCourseHtml(mqMessage, courseId);
        // 课程索引
        saveCourseIndex(mqMessage, courseId);
        // 课程缓存
        saveCourseCache(mqMessage, courseId);

        // 所有子任务处理完毕
        return true;
    }

    // 生成课程静态化页面并上传至文件系统
    private void generateCourseHtml(MqMessage mqMessage, long courseId) {
        log.debug("开始进行课程静态化,课程id:{}", courseId);
        // 消息id
        Long id = mqMessage.getId();
        // 消息处理的service
        MqMessageService mqMessageService = this.getMqMessageService();
        // 消息幂等处理
        int stageOne = mqMessageService.getStageOne(id);
        if (stageOne > 0) {
            log.debug("课程静态化已处理直接返回，课程id:{}", courseId);
            return;
        }
        // 进行页面静态化
        File file = coursePublishService.generateCourseHtml(courseId);

        //上传静态化页面
        if (file == null) {
            XueChengPlusException.cast("页面静态化异常");
        }
        coursePublishService.uploadCourseHtml(courseId, file);

        //保存第一阶段状态
        mqMessageService.completedStageOne(id);
    }

    //将课程信息缓存至redis
    public void saveCourseCache(MqMessage mqMessage, long courseId) {
        log.debug("将课程信息缓存至redis,课程id:{}", courseId);
        // 消息id
        Long id = mqMessage.getId();
        // 消息处理的service
        MqMessageService mqMessageService = this.getMqMessageService();
        // 消息幂等处理
        int stageTwo = mqMessageService.getStageTwo(id);
        if (stageTwo > 0) {
            log.debug("课程信息已经缓存至redis直接返回，课程id:{}", courseId);
            return;
        }
        // todo 将课程信息缓存至redis...

        //保存第二阶段状态
        mqMessageService.completedStageTwo(id);

    }

    private void saveCourseIndex(MqMessage mqMessage, long courseId) {
        log.debug("保存课程索引信息,课程id:{}", courseId);
        // 消息id
        Long id = mqMessage.getId();
        // 消息处理的service
        MqMessageService mqMessageService = this.getMqMessageService();
        // 消息幂等处理
        int stageThree = mqMessageService.getStageThree(id);
        if (stageThree > 0) {
            log.debug("课程索引信息已经保存，课程id:{}", courseId);
            return;
        }
        // todo 保存课程索引信息...

        //保存第二阶段状态
        mqMessageService.completedStageThree(id);
    }
}
```



#### 1.3.4 技术选型相关问题

1. 为什么不用消息队列？

   首先，为什么要用xxl-job结合本地消息表呢，优势是什么？

   - 相对消息队列实现简单。
   - 可重用，只需要一张消息表可以进行多种任务。

   - 业务幂等性，保证任务不重复执行。消息表中的`stage_state1`等字段可以作为乐观锁。从而可以保证任务不重复执行

   - 失败重试策略。只有大任务完成才会从消息表中删去，只有所有子任务完成才会判断大任务完成。 “生成课程静态化页面并上传至文件系统” 和“将课程信息缓存至redis”这两个任务都有可能失败。只有任务完成，才会修改消息表的标记状态，才不会继续执行。

     并且，消息表可以设置每个子任务都设置最大重试次数

   如果用消息队列也可以，就是设置两个队列两个消费者处理两个消息，但也要做好业务幂等性和失败重试。那么要怎么做呢？

   - 业务幂等性，保证业务不重复执行。可以用“ 唯一消息ID”的方法

   - 失败重试：并一定要设置失败消费者的失败重试策略，失败后将消息投递到一个指定的，专门存放异常消息的队列，后续由人工集中处理。

2. xxl-job结合本地消息表时为什么不用Redis分布式锁？

   因为消息表的state天然适合分布式锁。



### 1.4 异步课程优惠券秒杀



### 1.5 签到功能，统计连续签到天数

#### 1.5.1 BitMap（位图）操作命令

* SETBIT：向指定位置（offset）存入一个0或1
* GETBIT ：获取指定位置（offset）的bit值
* BITCOUNT ：统计BitMap中值为1的bit位的数量
* BITFIELD ：操作（查询、修改、自增）BitMap中bit数组中的指定位置（offset）的值
* BITFIELD_RO ：获取BitMap中bit数组，并以十进制形式返回
* BITOP ：将多个BitMap的结果做位运算（与 、或、异或）
* BITPOS ：查找bit数组中指定范围内第一个0或1出现的位置

#### 1.5.2 实现签到功能

```java
// UserController
@PostMapping("/sign")
public Result sign(){
   return userService.sign();
}
 
// UserServiceImpl
@Override
public Result sign() {
    // 1.获取当前登录用户
    Long userId = UserHolder.getUser().getId();
    // 2.获取日期
    LocalDateTime now = LocalDateTime.now();
    // 3.拼接key
    String keySuffix = now.format(DateTimeFormatter.ofPattern(":yyyyMM"));
    String key = USER_SIGN_KEY + userId + keySuffix;
    // 4.获取今天是本月的第几天
    int dayOfMonth = now.getDayOfMonth();
    // 5.写入Redis SETBIT key offset 1
    stringRedisTemplate.opsForValue().setBit(key, dayOfMonth - 1, true);
    return Result.ok();
}
```

#### 1.5.3 统计连续签到天数

从最后一次签到开始向前统计，直到遇到第一次未签到为止，计算总的签到次数，就是连续签到天数。

![1653834455899](assets/2024-10-26-OnlineItEduPlatform.assets/1653834455899.png)

```java
// UserController
@GetMapping("/sign/count")
public Result signCount(){
    return userService.signCount();
}

// UserServiceImpl
@Override
public Result signCount() {
    // 1.获取当前登录用户
    Long userId = UserHolder.getUser().getId();
    // 2.获取日期
    LocalDateTime now = LocalDateTime.now();
    // 3.拼接key
    String keySuffix = now.format(DateTimeFormatter.ofPattern(":yyyyMM"));
    String key = USER_SIGN_KEY + userId + keySuffix;
    // 4.获取今天是本月的第几天
    int dayOfMonth = now.getDayOfMonth();
    // 5.获取本月截止今天为止的所有的签到记录，返回的是一个Long类型的十进制的数字
    List<Long> result = stringRedisTemplate.opsForValue().bitField(
            key,
            BitFieldSubCommands.create() // 创建一个BitFieldSubCommands实例，以便定义一系列位字段子命令
                    .get(BitFieldSubCommands.BitFieldType.unsigned(dayOfMonth)).valueAt(0) //子命令
    );
    if (result == null || result.isEmpty()) {
        // 没有任何签到结果
        return Result.ok(0);
    }
    Long num = result.get(0);// 只有一个子命令，所以result中第0个就是解
    if (num == null || num == 0) {
        return Result.ok(0);
    }
    // 6.循环遍历
    int count = 0;
    while (true) {
        // 6.1.让这个数字与1做按位与运算，得到数字的最后一个bit位
        if ((num & 1) == 0) {  // 判断这个bit位是否为0
            // 如果为0，说明未签到，结束
            break;
        }else {
            // 如果不为0，说明已签到，计数器+1
            count++;
        }
        // 把数字右移一位，抛弃最后一个bit位，继续下一个bit位
        num >>>= 1;
    }
    return Result.ok(count);
}
```

























































