---
title: IT在线教育平台
date: 2023-10-26 14:45:00 +0800
categories: [Java, 项目]
tags: [Java,业务,简历项目]
---



## 1. 业务

### 1.1 微服务相关配置

### 1.2 SpringSecurity统一登录校验

#### 1.2.1 Oauth2协议

以本项目为例。客户端即在线教育平台。资源拥有者即用户，认证服务器即微信的认证服务器，资源服务器即微信的资源服务器。

具体步骤：

1. 用户扫码授权客户端获取获取授权码
2. 微信的认证服务器为客户端下发授权码
3. 客户端拿授权码去认证服务器申请令牌
4. 认证服务器给客户端下发令牌
5. 客户端拿令牌去访问资源服务器

#### 1.2.2 JWT令牌生成

如果不用Spring Security，那么生成一个JWT令牌其实也就2步：确认JWT的签名算法、使用的密钥、有效期、载荷，比对密码之后生成JWT。

Spring Security主要完成了比对密码的部分。JWT的签名算法、使用的密钥、有效期都是可以通过TokenConfig令牌管理服务进行配置的。

具体而言就是我们配置令牌的基本信息，然后前端发过来的获取JWT令牌的请求会传递给认证管理器实现的类DAP，他会调用UserDetailService的loadUserByUsername方法，这个UserDetailService是需要我们自己实现的，也就是说我们实现UserDetailService并重写loadUserByUsername方法，从数据库获取用户密码等封装为UserDetail给DAP，由DAP去比对密码，比对完之后生成令牌给前端。

#### 1.2.3 JWT令牌校验

不用手动校验，只要前端按照正确的格式返回JWT令牌框架就会自动解析校验。



#### 1.2.4 获取令牌信息

jwt令牌中记录了用户身份信息，当客户端携带jwt访问资源服务，资源服务验签通过后将前两部分的内容还原即可取出用户的身份信息（在UserDetailService中的loadUserByUsername方法中封装在UserDetail的username中的），并将用户身份信息放在了SecurityContextHolder上下文，SecurityContextHolder与当前线程进行绑定，方便获取用户身份。

![image-20241210200340026](assets/2024-10-26-OnlineItEduPlatform.assets/image-20241210200340026.png)

```java
@Slf4j
public class SecurityUtil {

    public static XcUser getUser() {
        try {
            Object principalObj = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            if (principalObj instanceof String) {
                //取出用户身份信息
                String principal = principalObj.toString();
                //将json转成对象
                XcUser user = JSON.parseObject(principal, XcUser.class);
                return user;
            }
        } catch (Exception e) {
            log.error("获取当前登录用户身份出错:{}", e.getMessage());
            e.printStackTrace();
        }

        return null;
    }


    @Data
    public static class XcUser implements Serializable {
        // ...
    }
}
```



#### 1.2.5 策略模式-统一认证

> 统一认证过了就生成JWT令牌

统一认证是指我们通过一个接口就能实现用户名密码登录认证、手机号验证码登录认证、微信扫码认证。

SpringSecurity框架下，实现用户认证的核心是**认证管理器（AuthenticationManager）**，web表单的对应的AuthenticationManager实现类为DaoAuthenticationProvider，它的内部又维护着一个UserDetailsService负责UserDetails的获取。

就是说，我们通过http提交的用户名和密码是交给DaoAuthenticationProvider的UserDetailsService来进行验证的。我们需要实现UserDetailsService接口，重写接口的loadUserByUsername方法，在方法中填充UserDetail，返回给DaoAuthenticationProvider。UserDetail中封装了用户名和密码等信息，DaoAuthenticationProvider拿到这个UserDetail就可以比对密码。

也就是说，如果我们要实现统一认证的话，比对密码这个工作就不能交给DaoAuthenticationProvider执行了。我们需要自己执行比对密码的操作，也很简单。只需要自己实现一个AuthenticationProvider去继承DaoAuthenticationProvider了。然后，再在这个类中引入自己的UserDetailsService，还是通过UserDetailsService的loadUserByUsername返回UserDeatil给框架，不过比对密码也放到这一步执行了。

我们进行密码比对的抽象策略是一个名为AuthService的类，这个类的execute方法用来比对密码。就比如，现在项目里面有PasswordAuthServiceImpl用来实现密码认证和PhoneNumberAuthServiceImpl用来实现手机号验证码，这两个类都是用来进行统一认证的，都继承了AuthService类实现了AuthService的excute方法。具体在认证的时候是采用密码认证还是手机号验证码登录，就看前端传过来的字段选择的模式，选哪个模式就会在loadUserByUsername方法中调用对应的bean。

```java
@Service("password_authservice")
public class PasswordAuthServiceImpl implements AuthService {

    @Autowired
    XcUserMapper xcUserMapper;

    @Autowired
    PasswordEncoder passwordEncoder;


    @Override
    public XcUserExt execute(AuthParamsDto authParamsDto) {

        //账号
        String username = authParamsDto.getUsername();
        XcUser user = xcUserMapper.selectOne(new LambdaQueryWrapper<XcUser>().eq(XcUser::getUsername, username));
        if (user == null) {
            //返回空表示用户不存在
            throw new RuntimeException("账号不存在");
        }

        XcUserExt xcUserExt = new XcUserExt();
        BeanUtils.copyProperties(user, xcUserExt);
        //校验密码
        //取出数据库存储的正确密码
        String passwordDb = user.getPassword();
        String passwordForm = authParamsDto.getPassword();
        boolean matches = passwordEncoder.matches(passwordForm, passwordDb);
        if (!matches) {
            throw new RuntimeException("账号或密码错误");
        }
        return xcUserExt;
    }
}
```



#### 1.2.6 用户授权RBAC

```java
/**
 * @author Mr.M
 * @version 1.0
 * @description 自定义UserDetailsService用来对接Spring Security
 * @date 2022/9/28 18:09
 */
@Slf4j
@Service
public class UserServiceImpl implements UserDetailsService {

    @Autowired
    XcUserMapper xcUserMapper;

    @Autowired
    ApplicationContext applicationContext;

    @Autowired
    XcMenuMapper xcMenuMapper;

    /**
     * @param s AuthParamsDto类型的json数据
     * @return org.springframework.security.core.userdetails.UserDetails
     * @description 查询用户信息组成用户身份信息
     * @author Mr.M
     * @date 2022/9/28 18:30
     */
    @Override
    public UserDetails loadUserByUsername(String s) throws UsernameNotFoundException {

        AuthParamsDto authParamsDto = null;
        try {
            //将认证参数转为AuthParamsDto类型
            authParamsDto = JSON.parseObject(s, AuthParamsDto.class);
        } catch (Exception e) {
            log.info("认证请求不符合项目要求:{}", s);
            throw new RuntimeException("认证请求数据格式不对");
        }

        //认证方法
        String authType = authParamsDto.getAuthType();
        AuthService authService = applicationContext.getBean(authType + "_authservice", AuthService.class);
        XcUserExt user = authService.execute(authParamsDto);

        return getUserPrincipal(user);
    }


    /**
     * @param user 用户id，主键
     * @return com.xuecheng.ucenter.model.po.XcUser 用户信息
     * @description 查询用户信息
     * @author Mr.M
     * @date 2022/9/29 12:19
     */
    public UserDetails getUserPrincipal(XcUserExt user) {
        //用户权限,如果不加报Cannot pass a null GrantedAuthority collection
        //查询用户权限
        List<XcMenu> xcMenus = xcMenuMapper.selectPermissionByUserId(user.getId());
        List<String> permissions = new ArrayList<>();
        if (xcMenus.size() <= 0) {
            //用户权限,如果不加则报Cannot pass a null GrantedAuthority collection
            permissions.add("p1");
        } else {
            xcMenus.forEach(menu -> {
                permissions.add(menu.getCode());
            });
        }
        //将用户权限放在XcUserExt中
        user.setPermissions(permissions);
        String password = user.getPassword();
        //为了安全在令牌中不放密码
        user.setPassword(null);
        //将user对象转json
        String userString = JSON.toJSONString(user);

        String[] authorities = permissions.toArray(new String[0]);

        //创建UserDetails对象
        UserDetails userDetails = User
                .withUsername(userString)
                .password("123")
                .authorities(authorities)
                .build();
        return userDetails;
    }

}
```

![image-20241211152935835](assets/2024-10-26-OnlineItEduPlatform.assets/image-20241211152935835.png)

### 1.3 任务处理SDK

基于模板方法模式构建高可靠异步任务处理框架，通过线程池、分布式调度、乐观锁和本地消息表，实现复杂异步任务（如视频转码、课程发布）的可靠执行，并保证任务不重复执行。

#### 1.3.1 任务不重复执行

xxl-job的路由策略（分片广播）、阻塞处理策略（丢弃后续调度）、乐观锁

乐观锁：

```java
    @Select("SELECT t.* FROM mq_message t " +
            "WHERE t.id % #{shardTotal} = #{shardindex} " +
            "       and t.state='0' " +
            "       and t.message_type=#{messageType} " +
            "limit #{count}")
    List<MqMessage> selectListByShardIndex(@Param("shardTotal") int shardTotal, @Param("shardindex") int shardindex, @Param("messageType") String messageType,@Param("count") int count);
```

#### 1.3.2 线程池

```java
	// MessageProcessAbstract类
	// 静态线程池，类加载时初始化，所有实例共享
    private static final ExecutorService THREAD_POOL;

    static {
        THREAD_POOL = new ThreadPoolExecutor(
                10, // 核心线程数
                50, // 最大线程数
                60L, // 空闲线程存活时间
                TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(100), // 阻塞队列
                new ThreadPoolExecutor.DiscardPolicy() // 拒绝策略：不处理新任务，直接丢弃掉
        );
    }
```

如何设置线程池的参数？

> IO密集型：2N

一次取多少任务？

> 刚好填满线程池

#### 1.3.3 模板方法模式

```java
@Slf4j
@Data
public abstract class MessageProcessAbstract {

    @Autowired
    MqMessageService mqMessageService;

    // 静态线程池，类加载时初始化，所有实例共享
    private static final ExecutorService THREAD_POOL;

    static {
        THREAD_POOL = new ThreadPoolExecutor(
                8, // 核心线程数
                8, // 最大线程数
                60L, // 空闲线程存活时间
                TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(100), // 阻塞队列
                new ThreadPoolExecutor.DiscardPolicy() // 拒绝策略：不处理新任务，直接丢弃掉
        );
    }

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
            // 扫描消息表获取任务清单
            List<MqMessage> messageList = mqMessageService.getMessageList(shardIndex, shardTotal, messageType, count);
            // 任务个数
            int size = messageList.size();
            log.debug("取出待处理消息" + size + "条");
            if (size <= 0) {
                return;
            }

            // 计数器
            CountDownLatch countDownLatch = new CountDownLatch(size);
            messageList.forEach(message -> { // 对于每一条任务，都用线程池执行
                THREAD_POOL.execute(() -> {
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

            // 等待,给一个充裕的超时时间,防止无限等待，到达超时时间还没有处理完成则结束任务
            countDownLatch.await(timeout, TimeUnit.SECONDS);
            System.out.println("结束....");

        } catch (InterruptedException e) {
            e.printStackTrace();

        }

    }

}
```

- `MessageProcessAbstract`是一个抽象类，`MessageProcessAbstract`中的`execute`方法在本类的`process`方法中调用，用户需要继承`MessageProcessAbstract`类，实现其`execute`方法（定义具体的消息处理逻辑）。

- 在`MessageProcessAbstract`的`process`方法中，使用`MqMessageService`接口获取待处理的消息列表，然后通过多线程执行消息处理逻辑。每条消息的处理结果由`execute`方法决定，若处理成功则调用`completed`方法将任务标记为完成，最后归档到历史表中。



#### 1.3.4 课程发布功能

基于xxl-job，本地消息表以及乐观锁，完成课程发布功能中的分布式事务最终一致性控制

<img src="assets/2024-10-26-coursePublish.assets/image-20241026145906546.png" alt="image-20241026145906546" style="zoom:80%;" />

课程发布后，需要异步进行 “生成课程静态化页面并上传至文件系统” ，“将课程信息缓存至redis”。课程发布时，已经将相关信息添加到消息表（即消息类型代码message_type以及关联业务信息`bussiness_key1`）。

> 消息表结构如下：
>
> ![image-20241026152109538](assets/2024-10-26-coursePublish.assets/image-20241026152109538.png)
>
> 定义消息表，可以统一处理

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
    public boolean execute(MqMessage mqMessage) {
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



#### 1.3.5 技术选型相关问题

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

![image-20241116152627523](assets/2024-10-26-OnlineItEduPlatform.assets/image-20241116152627523.png)

为什么选择向消息队列发送信息？

首先，可以选择的是直接写表、写任务处理表、发信息给消息队列

直接写表：

- 简单，但是MySQL吞吐量有限

写任务处理表：

- 相对于直接写表可以少写一个表
- 任务重试简单
- 实现简单
- 已经有现成的任务处理SDK

发信息给消息队列

- 吞吐量高
- 实现复杂一点
- 任务失败处理复杂





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

























































