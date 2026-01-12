[‌⁠‍‌‍‌MQ基础 - 飞书云文档 (feishu.cn)](https://b11et3un53m.feishu.cn/wiki/OQH4weMbcimUSLkIzD6cCpN0nvc)

## 1. 背景

### 1.1 同步调用

以商城的支付功能为例

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195710735.png)

目前我们采用的是基于OpenFeign的同步调用，也就是说业务执行流程是这样的：

- 支付服务需要先调用用户服务完成余额扣减
- 然后支付服务自己要更新支付流水单的状态
- 然后支付服务调用交易服务，更新业务订单状态为已支付

> 三个步骤依次执行

存在的问题：

- **拓展性差**
    > 每次有新的需求，现有支付逻辑都要跟着变化，代码经常变动，不符合开闭原则，拓展性不好。
- **性能下降**
    > 由于我们采用了同步调用，调用者需要等待服务提供者执行完返回结果后，才能继续向下执行，也就是说每次远程调用，调用者都是阻塞等待状态。最终整个业务的响应时长就是每次远程调用的执行时长之和
- **级联失败**
    > 由于我们是基于OpenFeign调用交易服务、通知服务。当交易服务、通知服务出现故障时，整个事务都会回滚，交易失败。

### 1.2 异步调用

异步调用方式其实就是基于消息通知的方式，一般包含三个角色：

- 消息发送者：投递消息的人，就是原来的调用方
- 消息Broker：管理、暂存、转发消息，你可以把它理解成微信服务器
- 消息接收者：接收和处理消息的人，就是原来的服务提供方

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195723285.png)

在异步调用中，发送者不再直接同步调用接收者的业务接口，而是发送一条消息投递给消息Broker。然后接收者根据自己的需求从消息Broker那里订阅消息。每当发送方发送消息后，接受者都能获取消息并处理。

这样，发送消息的人和接收消息的人就完全解耦了。

对于上面支付服务的例子，这样修改：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195732009.png)

假如产品经理提出了新的需求，比如要在支付成功后更新用户积分。支付代码完全不用变更，而仅仅是让积分服务也订阅消息即可

不管后期增加了多少消息订阅者，作为支付服务来讲，执行问扣减余额、更新支付流水状态后，发送消息即可。业务耗时仅仅是这三部分业务耗时，仅仅100ms，大大提高了业务性能。

另外，不管是交易服务、通知服务，还是积分服务，他们的业务与支付关联度低。现在采用了异步调用，解除了耦合，他们即便执行过程中出现了故障，也不会影响到支付服务。

综上，异步调用的优势包括：

- 耦合度更低
- 性能更好
- 业务拓展性强
- 故障隔离，避免级联失败

当然，异步通信也并非完美无缺，它存在下列缺点：

- 完全依赖于Broker的可靠性、安全性和性能
- 架构复杂，后期维护和调试麻烦

### 1.3 技术选型

消息代理Broker，目前常见的实现方案就是消息队列（MessageQueue），简称为MQ.

目比较常见的MQ实现：

- ActiveMQ
- RabbitMQ
- RocketMQ
- Kafka

几种常见MQ的对比：

| |RabbitMQ|ActiveMQ|RocketMQ|Kafka|
|---|---|---|---|---|
|公司/社区|Rabbit|Apache|阿里|Apache|
|开发语言|Erlang|Java|Java|Scala&Java|
|协议支持|AMQP，XMPP，SMTP，STOMP|OpenWire,STOMP，REST,XMPP,AMQP|自定义协议|自定义协议|
|可用性|高|一般|高|高|
|单机吞吐量|一般|差|高|非常高|
|消息延迟|微秒级|毫秒级|毫秒级|毫秒以内|
|消息可靠性|高|一般|高|一般|

> `Erlang`为高并发而生
>
> 追求可用性：Kafka、 RocketMQ 、RabbitMQ
>
> 追求可靠性：RabbitMQ、RocketMQ
>
> 追求吞吐能力：RocketMQ、Kafka
>
> 追求消息低延迟：RabbitMQ、Kafka

## 2. RabbitMQ

[RabbitMQ](https://www.rabbitmq.com/)

### 2.1 部署

1. 拉取镜像

 ```bash
    docker pull rabbitmq:3.12-management
    ```

2. 创建并运行容器

    ```bash
    docker run \
    --name mq \
     -e RABBITMQ_DEFAULT_USER=itheima \
     -e RABBITMQ_DEFAULT_PASS=123321 \
     -p 15672:15672 \
     -p 5672:5672 \
     -d \
     -d rabbitmq:3.12-management
    ```

### 2.2 收发信息

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195742713.png)

- **`publisher`**：生产者，也就是发送消息的一方
- **`consumer`**：消费者，也就是消费消息的一方
- **`queue`**：队列，存储消息。生产者投递的消息会暂存在消息队列中，等待消费者处理
- **`exchange`**：交换机，负责消息路由。生产者发送的消息由交换机决定投递到哪个队列。
- **`virtual host`**：虚拟主机，起到数据隔离的作用。每个虚拟主机相互独立，有各自的exchange、queue

> 1. `queue`需要与`exchange`绑定，发送到`exchange`的信息才回到`queue`
>
>    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195751429.png)
>
>    > 控制台需要在服务器的docker容器安装好后，在服务器的`15672`端口运行
>
> 2. `virtual host`用于实现数据隔离，对于小型企业而言，出于成本考虑，我们通常只会搭建一套MQ集群，公司内的多个不同项目同时使用。这个时候为了避免互相干扰， 我们会利用`virtual host`的隔离特性，将不同项目隔离。一般会做两件事情：
>
>    - 给每个项目创建独立的运维账号，将管理权限分离。
>    - 给每个项目创建不同的`virtual host`，将每个项目的数据隔离。

## 3. SpringAMQP

SpringAMQP提供了三个功能：

- 自动声明队列、交换机及其绑定关系
- 基于注解的监听器模式，异步接收消息
- 封装了RabbitTemplate工具，用于发送消息

引入SpringAMQP：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

`application.yml`:

```yaml
spring:
  rabbitmq:
    host: 192.168.150.101 # 你的虚拟机IP
    port: 5672 # 端口
    virtual-host: /hmall # 虚拟主机，创建虚拟主机时前面记得加“/”
    username: hmall # 用户名
    password: 123 # 密码
```

### 3.1 WorkQueues模型

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195759227.png)

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        prefetch: 1 # 每次只能获取一条消息，处理完成才能获取下一个消息
```

如果没有上述配置，假设`Consumer1`和`Consumer2`处理消息的能力不一样，那么对于Queue中的所有消息，`Consumer1`和`Consumer2`都是各自处理一半，而如果有了上述配置，`Consumer1`和`Consumer2`每次只能获取一条消息，处理完成才能获取下一个消息，处理效率提升。类似于，能者多劳。

### 3.2 交换机

Exchange（交换机）**只负责转发消息，不具备存储消息的能力**，因此如果没有任何队列与Exchange绑定，或者没有符合路由规则的队列，那么消息会丢失！

交换机的类型有四种：

- **Fanout**：广播，将消息交给所有绑定到交换机的队列
- **Direct**：订阅，基于RoutingKey（路由key）发送给订阅了消息的队列
- **Topic**：通配符订阅，与Direct类似，只不过RoutingKey可以使用通配符
- **Headers**：头匹配，基于MQ的消息头匹配，用的较少

#### 3.2.1 Fanout

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195806672.png)

- 可以有多个队列
- 每个队列都要绑定到Exchange（交换机）
- 生产者发送的消息，只能发送到交换机
- 交换机把消息发送给绑定过的所有队列
- 订阅队列的消费者都能拿到消息

测试：

1. 控制台中添加两个队列`fanout1.queue1`与`fanout.queue2`，然后再创建一个交换机：`hmall.fanout`，并且绑定两个队列到交换机

    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195819002.png)

    > 注意添加交换机时选择正确的Type
    >
    > ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195828132.png)

2. 消息发送

    ```java
    @Test
    public void testFanoutExchange() {
        // 交换机名称
        String exchangeName = "hmall.fanout";
        // 消息
        String message = "hello, everyone!";
        rabbitTemplate.convertAndSend(exchangeName, "", message);
    }
    ```

    ![image-20240820142524683.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240820142524683.png)

    在 `rabbitTemplate.convertAndSend(exchangeName, "", message);` 这一行代码中，第二个参数是路由键 (Routing Key)。对于 `FanoutExchange` 类型的交换机，这个路由键并不会被实际使用，因为 `FanoutExchange` 会将消息广播到所有绑定到该交换机的队列中，而不考虑路由键。

3. 消息接收

    方法的类上加`@Component`注解使其被Spring管理

    ```java
    @RabbitListener(queues = "fanout.queue1")
    public void listenFanoutQueue1(String msg) {
        System.out.println("消费者1接收到Fanout消息：【" + msg + "】");
    }
    
    @RabbitListener(queues = "fanout.queue2")
    public void listenFanoutQueue2(String msg) {
        System.out.println("消费者2接收到Fanout消息：【" + msg + "】");
    }
    ```

    ![image-20240820142558922.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240820142558922.png)

#### 3.2.2 Direct

在`Fanout`模式中，一条消息，会被所有订阅的队列都消费。但是，在某些场景下，我们希望**不同的消息被不同的队列消费**。这时就要用到`Direc`t类型的`Exchange`。

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112195955044.png)

在Direct模型下：

- 队列与交换机的绑定，不能是任意绑定了，而是要指定一个`RoutingKey`（路由key）
- publisher在向Exchange发送消息时，也必须指定消息的 `RoutingKey`。
- Exchange不再把消息交给每一个绑定的队列，而是根据消息的`Routing Key`进行判断，只有队列的`Routingkey`与消息的 `Routing key`完全一致，才会接收到消息

测试：

> 背景：
>
> - 声明一个名为`hmall.direct`的交换机
>
> - 声明队列`direct.queue1`，绑定`hmall.direct`，`bindingKey`为`blud`和`red`
>
> - 声明队列`direct.queue2`，绑定`hmall.direct`，`bindingKey`为`yellow`和`red`
>
> - 在`consumer`服务中，编写两个消费者方法，分别监听direct.queue1和direct.queue2
>
> - 在publisher中编写测试方法，向`hmall.direct`发送消息

1. 消息接收

    ```java
    @RabbitListener(queues = "direct.queue1")
    public void listenDirectQueue1(String msg) {
        System.out.println("消费者1接收到direct.queue1的信息：【" + msg + "】");
    }
    
    @RabbitListener(queues = "direct.queue2")
    public void listenDirectQueue2(String msg) {
        System.out.println("消费者2接收到direct.queue1的信息：【" + msg + "】");
    }
    ```

2. 消息发送

    ```java
    @Test
    public void testFanoutExchange() throws InterruptedException {
        // 交换机名称
        String exchangeName = "hmall.direct";
        // 消息
        String routingKey = "blue";
        String message = "hello, " + routingKey;
        // 发送消息，每20毫秒发送一次，相当于每秒发送50条消息
        rabbitTemplate.convertAndSend(exchangeName, routingKey, message);
    }
    ```

![image-20240820182818227.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240820182818227.png)

> 描述下Direct交换机与Fanout交换机的差异？
>
> - Fanout交换机将消息路由给每一个与之绑定的队列
> - Direct交换机根据RoutingKey判断路由给哪个队列
> - 如果多个队列具有相同的RoutingKey，则与Fanout功能类似

#### 3.2.3 Topic交换机

`Topic`类型的`Exchange`与`Direct`相比，都是可以根据`RoutingKey`把消息路由到不同的队列，只不过`Topic`类型`Exchange`可以让队列在绑定`BindingKey` 的时候使用通配符。

> - BindingKey 一般都是有一个或多个单词组成，多个单词之间以`.`分割，例如： `item.insert`
>
> - 通配符规则：
>
>     - `#`：匹配一个或多个词
>
>     - `*`：匹配不多不少恰好1个词

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200008555.png)

- `topic.queue1`：绑定的是`china.#` ，凡是以 `china.`开头的`routing key` 都会被匹配到，包括：

    - `china.news`

    - `china.weather`

- `topic.queue2`：绑定的是`#.news` ，凡是以 `.news`结尾的 `routing key` 都会被匹配。包括:

    - `china.news`

    - `japan.news`

> Direct交换机与Topic交换机的差异：
>
> - Direct交换机接收的消息RoutingKey必须是多个单词，以 **`.`** 分割
>
> - Topic交换机与队列绑定时的bindingKey可以指定通配符
>
> - `#`：代表0个或多个词
>
> - `*`：代表1个词

### 3.3 声明队列和交换机

#### 3.3.1 基本API

`SpringAMQP`提供了一个`Queue`类，用来创建队列

![image-20240820205538004.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240820205538004.png)

`SpringAMQP`还提供了一个`Exchange`接口，来表示所有不同类型的交换机

![image-20240820205602784.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240820205602784.png)

我们可以自己创建队列和交换机，不过SpringAMQP还提供了ExchangeBuilder来简化这个过程

![image-20240820205633471.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240820205633471.png)

而在绑定队列和交换机时，则需要使用BindingBuilder来创建Binding对象：

![image-20240820205657468.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240820205657468.png)

一般可以在消费者这边声明队列、交换机和绑定关系，因为作为发送方来讲，发送方不需要关心队列，发送发唯一关心的是交换机，向某个交换机发消息就可以了

#### 3.3.2 声明队列和Fanout交换机

```java
@Configuration
public class FanoutConfig {
    /**
     * 声明交换机
     * @return Fanout类型交换机
     */
    @Bean
    public FanoutExchange fanoutExchange(){
        return new FanoutExchange("hmall.fanout");
        // 或者 return ExchangeBuilder.fanoutExchange("hmall.fanout").build();
    }

    /**
     * 第1个队列
     */
    @Bean
    public Queue fanoutQueue1(){
        return new Queue("fanout.queue1");
    }

    /**
     * 第2个队列
     */
    @Bean
    public Queue fanoutQueue2(){
        return new Queue("fanout.queue2");
    }

    /**
     * 绑定队列和交换机
     */
    @Bean
    public Binding bindingQueue1(Queue fanoutQueue1, FanoutExchange fanoutExchange){
        return BindingBuilder.bind(fanoutQueue1).to(fanoutExchange);
    }


    /**
     * 绑定队列和交换机
     */
    @Bean
    public Binding bindingQueue2(Queue fanoutQueue2, FanoutExchange fanoutExchange){
        return BindingBuilder.bind(fanoutQueue2).to(fanoutExchange);
    }
}
```

> 关于`bindingQueue1`方法
>
> `bindingQueue1`方法中的参数`Queue fanoutQueue1`, `FanoutExchange fanoutExchange`之所以能够自动引用到前面定义的队列和交换机，是因为Spring的自动装配（autowiring）机制。具体来说，这里发生了以下几步：
>
> 1. Bean的创建：当Spring容器启动时，它会扫描所有带有@Bean注解的方法，并调用这些方法以创建并注册bean到容器中。在你的例子中，这包括fanoutExchange、fanoutQueue1和bindingQueue1方法。
>
>    > Bean的名称：默认情况下，Spring会使用方法名作为bean的名称（当然，你也可以通过@Bean注解的name属性指定一个不同的名称）。因此，fanoutExchange1方法创建的bean的名称是fanoutExchange1
>
> 2. 自动装配：例如，`bindingQueue1(Queue fanoutQueue1, FanoutExchange fanoutExchange)`方法中，Spring会自动查找类型为`Queue`的Bean `fanoutQueue1`和类型为`FanoutExchange`的Bean `fanoutExchange`，并将它们注入到方法参数中。
>
>    > 因为类型为`Queue`的Bean有多个，所以如果`bindingQueue1`的`Queue`类型的参数名不是已经存在的Bean的名称，那么就无法正确注入：
>
>    > ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200052227.png)

程序运行后，会自动创建队列和Fanout交换机

#### 3.3.3 声明队列和Direct交换机

```java
@Configuration
public class DirectConfig {

    /**
     * 声明交换机
     * @return Direct类型交换机
     */
    @Bean
    public DirectExchange directExchange(){
        return ExchangeBuilder.directExchange("hmall.direct").build();
    }

    /**
     * 第1个队列
     */
    @Bean
    public Queue directQueue1(){
        return new Queue("direct.queue1");
    }

    /**
     * 绑定队列和交换机
     */
    @Bean
    public Binding bindingQueue1WithRed(Queue directQueue1, DirectExchange directExchange){
        return BindingBuilder.bind(directQueue1).to(directExchange).with("red");
    }
    /**
     * 绑定队列和交换机
     */
    @Bean
    public Binding bindingQueue1WithBlue(Queue directQueue1, DirectExchange directExchange){
        return BindingBuilder.bind(directQueue1).to(directExchange).with("blue");
    }

    /**
     * 第2个队列
     */
    @Bean
    public Queue directQueue2(){
        return new Queue("direct.queue2");
    }

    /**
     * 绑定队列和交换机
     */
    @Bean
    public Binding bindingQueue2WithRed(Queue directQueue2, DirectExchange directExchange){
        return BindingBuilder.bind(directQueue2).to(directExchange).with("red");
    }
    /**
     * 绑定队列和交换机
     */
    @Bean
    public Binding bindingQueue2WithYellow(Queue directQueue2, DirectExchange directExchange){
        return BindingBuilder.bind(directQueue2).to(directExchange).with("yellow");
    }
}
```

基于@Bean的方式声明队列和交换机比较麻烦，Spring还提供了基于注解方式来声明。

```java
@RabbitListener(bindings = @QueueBinding(
    value = @Queue(name = "direct.queue1",durable="true"),
    exchange = @Exchange(name = "hmall.direct", type = ExchangeTypes.DIRECT),
    key = {"red", "blue"}
))
public void listenDirectQueue1(String msg){
    System.out.println("消费者1接收到direct.queue1的消息：【" + msg + "】");
}

@RabbitListener(bindings = @QueueBinding(
    value = @Queue(name = "direct.queue2"),
    exchange = @Exchange(name = "hmall.direct", type = ExchangeTypes.DIRECT),
    key = {"red", "yellow"}
))
public void listenDirectQueue2(String msg){
    System.out.println("消费者2接收到direct.queue2的消息：【" + msg + "】");
}
```

> 在 `@Queue` 注解中，`durable` 属性用于指定队列是否为持久队列（Durable Queue）。持久队列在消息代理（例如 RabbitMQ）重启后仍然存在，不会被删除。

#### 3.3.4 声明队列和Topic交换机

```java
@RabbitListener(bindings = @QueueBinding(
    value = @Queue(name = "topic.queue1"),
    exchange = @Exchange(name = "hmall.topic", type = ExchangeTypes.TOPIC),
    key = "china.#"
))
public void listenTopicQueue1(String msg){
    System.out.println("消费者1接收到topic.queue1的消息：【" + msg + "】");
}

@RabbitListener(bindings = @QueueBinding(
    value = @Queue(name = "topic.queue2"),
    exchange = @Exchange(name = "hmall.topic", type = ExchangeTypes.TOPIC),
    key = "#.news"
))
public void listenTopicQueue2(String msg){
    System.out.println("消费者2接收到topic.queue2的消息：【" + msg + "】");
}
```

### 3.4 消息转换器

Spring的消息发送代码接收的消息体是一个Object：

![image-20240821004352583.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821004352583.png)

而在数据传输时，它会把你发送的消息序列化为字节发送给MQ，接收消息的时候，还会把字节反序列化为Java对象。

只不过，默认情况下Spring采用的序列化方式是**JDK序列化**。众所周知，JDK序列化存在下列问题：

- 数据体积过大
- 有安全漏洞
- 可读性差

显然，JDK序列化方式并不合适。我们希望消息体的体积更小、可读性更高，因此可以使用**JSON方式**来做序列化和反序列化。

1. 在`publisher`和`consumer`两个服务中都引入依赖

    ```xml
    <dependency>
        <groupId>com.fasterxml.jackson.dataformat</groupId>
        <artifactId>jackson-dataformat-xml</artifactId>
        <version>2.9.10</version>
    </dependency>
    ```

    > 注意，如果项目中引入了`spring-boot-starter-web`依赖，则无需再次引入`Jackson`依赖。

2. 配置消息转换器，在`publisher`和`consumer`两个服务的启动类中添加一个Bean即可

    ```java
    @Bean
    public MessageConverter messageConverter(){
        // 1.定义消息转换器
        Jackson2JsonMessageConverter jackson2JsonMessageConverter = new Jackson2JsonMessageConverter();
        // 2.配置自动创建消息id，用于识别不同消息，也可以在业务中基于ID判断是否是重复消息
        jackson2JsonMessageConverter.setCreateMessageIds(true);
        return jackson2JsonMessageConverter;
    }
    ```

    > 消息转换器中添加的messageId可以便于我们将来做幂等性判断。

3. 这时候，就可以自动使用json消息转换器

> 我们在consumer服务中定义一个新的消费者，publisher是用Map发送，那么消费者也一定要用**Map接收**，格式如下：
>
> ```java
> @RabbitListener(queues = "object.queue")
> public void listenSimpleQueueMessage(Map<String, Object> msg) throws InterruptedException {
>     System.out.println("消费者接收到object.queue消息：【" + msg + "】");
> }
> ```

## 4. 可靠性

首先，我们一起分析一下消息丢失的可能性有哪些。

消息从发送者发送消息，到消费者处理消息，需要经过的流程是这样的：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200116883.png)

消息从生产者到消费者的每一步都可能导致消息丢失：

- 发送消息时丢失：
    - 生产者发送消息时连接MQ失败
    - 生产者发送消息到达MQ后未找到`Exchange`
    - 生产者发送消息到达MQ的`Exchange`后，未找到合适的`Queue`
    - 消息到达MQ后，处理消息的进程发生异常
- MQ导致消息丢失：
    - 消息到达MQ，保存到队列后，尚未消费就突然宕机
- 消费者处理消息时：
    - 消息接收后尚未处理突然宕机
    - 消息接收后处理过程中抛出异常

综上，我们要解决消息丢失问题，保证MQ的可靠性，就必须从3个方面入手：

- 确保生产者一定把消息发送到MQ
- 确保MQ不会将消息弄丢
- 确保消费者一定要处理消息

### 4.1 生产者的可靠性

#### 4.1.1 生产者重试机制

修改`publisher`模块的`application.yaml`文件，添加下面的内容

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

> **注意**：当网络不稳定的时候，利用重试机制可以有效提高消息发送的成功率。不过SpringAMQP提供的重试机制是**阻塞式**的重试，也就是说多次重试等待的过程中，当前线程是被阻塞的。
>
> 如果对于业务性能有要求，建议禁用重试机制。如果一定要使用，请合理配置等待时长和重试次数，当然也可以考虑使用异步线程来执行发送消息的代码。

#### 4.1.2 生产者确认机制

在少数情况下，也会出现消息发送到MQ之后丢失的现象，比如：

- MQ内部处理消息的进程发生了异常
- 生产者发送消息到达MQ后未找到`Exchange`
- 生产者发送消息到达MQ的`Exchange`后，未找到合适的`Queue`，因此无法路由

针对上述情况，RabbitMQ提供了生产者消息确认机制，包括`Publisher Confirm`和`Publisher Return`两种。在开启确认机制的情况下，当生产者发送消息给MQ后，MQ会根据消息处理的情况返回不同的**回执**。

> `Publisher Confirm`用于确认消息是否成功到达 RabbitMQ 服务器。
>
> `Publisher Return` 用于处理不可路由的消息

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200125646.png)

总结如下：

![image-20241024164554726.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20241024164554726.png)

> **当RabbitMQ成功接收到生产者发送的消息时，它会向生产者发送一个`Basic.Ack`命令**，表示消息已经被成功接收并准备进行后续的路由操作
>
> `ack`和`nack`属于**Publisher Confirm**机制，`ack`是投递成功；`nack`是投递失败。而`return`则属于**Publisher Return**机制。

- 当消息投递到MQ，但是路由失败时，通过**Publisher Return返回异常信息**，**同时返回ack的确认信息**，**代表投递成功**
    
    > 路由失败跟MQ没有关系，路由失败只有两种原因：routine key填的不对、要么就是这个交换机没有队列给它绑定。MQ自己的内部机制是不可能失败的，一般在业务开发当中几乎不太可能会出现这种情况，因为一旦出现这种情况只能说明两件事，要么是代码写的有问题，要么是交换机的配置有问题，这都是开发人员导致的，完全可以在开发层面避免它。

- 临时消息投递到了MQ，并且入队成功，返回ACK，告知投递成功
- 持久消息投递到了MQ，并且入队完成持久化，返回ACK ，告知投递成功
- 其它情况都会返回NACK，告知投递失败
    
    > 例如没有到达交换机
    > 例如持久化消息入队但是未持久化

**实现生产者确认机制：**

1. 在publisher模块的`application.yaml`中添加配置

    ```yaml
    spring:
      rabbitmq:
        publisher-confirm-type: correlated # 开启publisher confirm机制，并设置confirm类型
        publisher-returns: true # 开启publisher return机制
    ```

    这里`publisher-confirm-type`有三种模式可选

    - `none`：关闭confirm机制
    - `simple`：同步阻塞等待MQ的回执消息
    - `correlated`：MQ异步回调方式返回回执消息

2. **定义ReturnCallback**
    
    作用：监听消息是否从交换机成功传递到队列
    
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

    > `@PostConstruct`注解：在bean被创建并完成属性注入后，执行一些初始化操作（带有@PostConstruct注解的方法会被自动调用）

    也可以这样写：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112213732607.png)
    
3. **定义ConfirmCallback**
    
    由于每个消息发送时的处理逻辑不一定相同，因此ConfirmCallback需要在每次发消息时定义。具体来说，是在调用RabbitTemplate中的convertAndSend方法时，多传递一个参数：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200154070.png)

    
    这里的`CorrelationData`中包含两个核心的东西：
    
    - `id`：消息的唯一标示，MQ对不同的消息的回执以此做判断，避免混淆
    
    - `SettableListenableFuture`：回执结果的Future对象
    
    
    将来MQ的回执就会通过这个`Future`来返回，我们可以提前给`CorrelationData`中的`Future`添加回调函数来处理消息回执：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200159141.png)

    
    测试：
    
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

    例如：
    
    1. 没有到达交换机
        
        ![image-20240821201948884.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821201948884.png)

        
    2. 到了交换机路由失败
        
        ![image-20240821202128683.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821202128683.png)

        
    3. 到了交换机且路由成功
        
        ![image-20240821203202210.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821203202210.png)

        

注意：

1. 定义`ReturnCallback`与`ConfirmCallback`没有先后之分，不一定都存在
    
2. 开启生产者确认比较消耗MQ性能，一般不建议开启。而且触发确认的几种情况：
    
    - 路由失败：一般是因为RoutingKey错误导致，往往是编程导致
        
    - 交换机名称错误：同样是编程错误导致
        
    - MQ内部故障：这种需要处理，但概率往往较低。因此只有对消息可靠性要求非常高的业务才需要开启，而且仅仅需要开启ConfirmCallback处理nack就可以了。

### 4.2 MQ的可靠性

消息到达MQ以后，如果MQ不能及时保存，也会导致消息丢失，所以MQ的可靠性也非常重要。

> 1. 消息发送到MQ默认是发送到内存，mq在内存满的情况下，会持久化一部分到磁盘，然而这个过程较为耗时，所以这个过程中发送过来的消息就相当于丢失了。
>     
> 2. SpringAMQP创建的消息、队列、交换机默认都是持久化的

#### 4.2.1 数据持久化

为了提升性能，默认情况下MQ的数据都是在内存存储的临时数据，重启后就会消失。为了保证数据的可靠性，必须配置数据持久化，包括：

- 交换机持久化
    
- 队列持久化
    
- 消息持久化
    

1. **交换机持久化**
    
    在控制台的`Exchanges`页面，添加交换机时可以配置交换机的`Durability`参数：
    
    设置 `durable=true`，表示**RabbitMQ 重启后交换机仍然存在**，不会丢失。
    
    ![image-20240821211201804.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821211201804.png)

    
    > SpringAMQP创建的交换机默认持久化
>
>     @Configuration  
>     public class DirectConfig {  
>   
>     /**  
>      * 声明交换机  
>      * @return Direct类型交换机  
>      */  
>     @Bean  
>     public DirectExchange directExchange(){
>         return ExchangeBuilder.directExchange("hmall.direct").build();  
>     }
> }
    
2. **队列持久化**
    
    设置 `durable=true`，表示**RabbitMQ 重启后队列还存在**（队列结构保留），不会丢失。
    
    SpringAMQP创建的队列默认持久化
    
    @Configuration  
    public class DirectConfig {  
      
        /**  
         * 声明交换机  
         * @return Direct类型交换机  
         */  
        @Bean  
        public DirectExchange directExchange(){
            return ExchangeBuilder.directExchange("hmall.direct").build();  
        }
      
        /**  
         * 第1个队列  
         */  
        @Bean  
        public Queue directQueue1(){
            return new Queue("hmall.direct.queue1");  
        }
      
        /**  
         * 绑定队列和交换机  
         */  
        @Bean  
        public Binding bindingQueue1WithRed(Queue directQueue1, DirectExchange directExchange){
            return BindingBuilder.bind(directQueue1).to(directExchange).with("q");  
        }
    }
    
3. **消息持久化**
    
    消息在发送时，设置 `deliveryMode=2`（持久化模式），表示消息会**写入磁盘**，即使 RabbitMQ 异常宕机也能恢复。
    
    SpringAMQP创建的消息默认持久化
    
        @Test  
        public void testSendMap() throws InterruptedException {
            // 准备消息  
            Map<String,Object> msg = new HashMap<>();  
            msg.put("name", "柳岩");  
            msg.put("age", 21);  
            // 发送消息  
            rabbitTemplate.convertAndSend("object3.queue", msg);
        }
    
    ![image-20240821211717209.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821211717209.png)

#### 4.2.2 LazyQueue

在默认情况下，RabbitMQ会将接收到的信息保存在内存中以降低消息收发的延迟。但在某些特殊情况下，这会导致消息积压，比如：

- 消费者宕机或出现网络故障
    
- 消息发送量激增，超过了消费者处理速度
    
- 消费者处理业务发生阻塞
    

一旦出现消息堆积问题，RabbitMQ的内存占用就会越来越高，直到触发内存预警上限。此时RabbitMQ会将内存消息刷到磁盘上，这个行为成为`PageOut`. `PageOut`会耗费一段时间，并且会阻塞队列进程。因此在这个过程中RabbitMQ不会再处理新的消息，生产者的所有请求都会被阻塞。

为了解决这个问题，从RabbitMQ的3.6.0版本开始，就增加了LazyQueues的模式，也就是惰性队列。惰性队列的特征如下：

- 接收到消息后**直接存入磁盘**而非内存
    
    > 对写入磁盘的IO操作做了优化
>
- 消费者要消费消息时才会从磁盘中读取并加载到内存（也就是懒加载）
    
- 支持数百万条的消息存储
    

而**在3.12版本之后，LazyQueue已经成为所有队列的默认格式。**因此官方推荐升级MQ为3.12版本或者所有队列都设置为LazyQueue模式。

**代码配置Lazy模式：**

在利用SpringAMQP声明队列的时候，添加`x-queue-mod=lazy`参数也可设置队列为Lazy模式：

@Bean  
public Queue lazyQueue(){
    return QueueBuilder  
            .durable("lazy.queue")  
            .lazy() // 开启Lazy模式  
            .build();  
}

> 这里是通过`QueueBuilder`的`lazy()`函数配置Lazy模式，底层源码如下：
>
> ![image-20240821213137634.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821213137634.png)


当然，我们也可以基于注解来声明队列并设置为Lazy模式：

@RabbitListener(queuesToDeclare = @Queue(  
        name = "lazy.queue",  
        durable = "true",  
        arguments = @Argument(name = "x-queue-mode", value = "lazy")  
))
public void listenLazyQueue(String msg){
    log.info("接收到 lazy.queue的消息：{}", msg);
}

> 队列接收到信息后：
>
> ![image-20240821214413681.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821214413681.png)

> 
> 如果不是lazyQueue：
>
> ![image-20240821215207435.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821215207435.png)

> 
> **消息（总数、就绪、未确认）**：
>
> - **总数**：队列中的消息总数，在本例中为 `1`。
>
> - **就绪**：准备好被发送到消费者但尚未发送的消息数量，这里是 `1`。
>
> - **未确认**：已发送给消费者但尚未被确认的消息数量，这个值为 `0`，意味着没有消息在等待确认。
>
> 
> **处理内存（总数、内存中、持久、临时、分页出）**：
>
> - **总数**：队列中消息使用的总内存，为 `19 KiB`（19 千字节）。
>
> - **内存中**：存储在内存中的消息大小，为 `18 B`。
>
> - **持久**：标记为持久的消息大小，为 `18 B`。持久消息是指那些在代理重启后仍然存在的消息。
>
> - **临时**：临时消息（非持久消息）的大小，为 `0 B`，表示没有临时消息。
>
> - **分页出**：由于内存压力而被分页到磁盘的消息大小，为 `0 B`，表示没有消息被分页出。
>

### 4.3 消费者的可靠性

当RabbitMQ向消费者投递消息以后，需要知道消费者的处理状态如何。因为消息投递给消费者并不代表就一定被正确消费了，可能出现的故障有很多，比如：

- 消息投递的过程中出现了网络故障
    
- 消费者接收到消息后突然宕机
    
- 消费者接收到消息后，**因处理不当导致异常**
    
- ...

一旦发生上述情况，消息也会丢失。因此，RabbitMQ必须知道消费者的处理状态，一旦消息处理失败才能重新投递消息。

#### 4.3.1 消费者确认机制

为了确认消费者是否成功处理消息，RabbitMQ提供了消费者确认机制（**Consumer Acknowledgement**）。即：**当消费者处理消息结束后（处理消息的方法执行完毕）**，应该向RabbitMQ发送一个回执，告知RabbitMQ自己消息处理状态。回执有三种可选值：

- `ack`：成功处理消息，RabbitMQ从队列中删除该消息
    
- `nack`：消息处理失败，RabbitMQ需要再次投递消息
    
- `reject`：消息处理失败并拒绝该消息，RabbitMQ从队列中删除该消息

由于消息回执的处理代码比较统一，因此SpringAMQP帮我们实现了消息确认。并允许我们通过配置文件设置ACK处理方式，有三种模式：

- **`none`**：不处理。即消息投递给消费者后立刻ack，消息会立刻从MQ删除。非常不安全，不建议使用
- **`manual`**：手动模式。需要自己在业务代码中调用api，发送`ack`或`reject`，存在业务入侵，但更灵活
    
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
    
    在 `Channel` 层面，**`basicAck` 和 `basicNack`** 是 RabbitMQ _显式确认_（manual acknowledge）协议的核心 API
    
    1. `channel.basicAck(long deliveryTag, boolean multiple)`
        
    
    |参数|作用| 
    |---|---|
    |`deliveryTag`|**通道内自增序号**，代表_哪一条_消息被确认。由 `MessageProperties#getDeliveryTag()` 取得。|
    |`multiple`|`true` = 把 **到当前 tag 为止的所有未确认消息** 一起确认（批量）；`false` = 仅当前这条。|
    
    > **语义**：Broker 收到 ACK 后就立即把这条消息从队列的 _unacked_ 区域删除，永不再投递。 **代码中的两次 `basicAck(tag, false)`**
    >
    > 1. 发现重复消息 → 直接确认，省资源。
    >
    > 2. 推送 CRM 成功 → 业务完成，确认并释放交付标记。
    >
    
    2. `channel.basicNack(long deliveryTag, boolean multiple, boolean requeue)`
        
    
    |参数|作用|
    |---|---|
    |`deliveryTag`|和 ACK 一样，指明哪条消息（或在哪之前的多条）。|
    |`multiple`|批量 NACK；通常保持 `false`，避免把“健康消息”一起打回。|
    |`requeue`|`true` = 直接回到**同一个队列尾部**；`false` = **不回原队列**，而是走 **死信逻辑**（如果配置了 `x-dead-letter-exchange`）。|
    
    为何示例代码写 `requeue=false`？
    
    1. **需要延迟重试**：回到同队列不会产生延迟，又会立即被同集群消费，形不成退避。
        
    2. **防止“消息打滚”**：如果 CRM 永远 500，立刻重投 → 又失败 → 再重投 … 队列会被卡死。
        
    3. **让 DLX + TTL 队列接管** 重试节奏（30 s / 5 min …）。
        
- **`auto`**：自动模式。SpringAMQP利用AOP对我们的消息处理逻辑做了环绕增强，当业务正常执行时则自动返回`ack`. 当业务出现异常时，根据异常判断返回不同结果：
    
    - 如果是**业务异常**，会自动返回`nack`；
        
    - 如果是**消息处理或校验异常**，自动返回`reject`;
        
        > ![image-20240821225616085.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821225616085.png)


通过下面的配置可以修改SpringAMQP的ACK处理方式：

spring:  
  rabbitmq:  
    listener:  
      simple:  
        acknowledge-mode: none # 不做处理

**测试1：**

1. 配置`acknowledge-mode`为`none`
    
    spring:  
      rabbitmq:  
        listener:  
          simple:  
            acknowledge-mode: none # 不做处理
    
2. 消费者在处理信息时出现错误
    
        @RabbitListener(queues = "hmall.queue1")  
        public void listenDirectQueue1(String msg) {  
            System.out.println("消费者1接收到direct.queue1的信息：【" + msg + "】");  
            if (true) {  
                throw new MessageConversionException("故意的");  
            }
            log.info("消息处理完成");  
        }
    
3. 结果
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200336047.png)

    
    信息会被直接删去


**测试2：**

1. 配置`acknowledge-mode`为`auto`
    
2. 消费者在处理信息时出现`MessageConversionException`
    
        @RabbitListener(queues = "hmall.queue1")  
        public void listenDirectQueue1(String msg) {  
            System.out.println("消费者1接收到direct.queue1的信息：【" + msg + "】");  
            if (true) {  
                throw new MessageConversionException("故意的");  
            }
            log.info("消息处理完成");  
        }
    
3. 结果
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200342752.png)
    自动返回`reject`，信息会被直接删去

**测试3：**

1. 配置`acknowledge-mode`为`auto`
    
2. 消费者在处理信息时出现`RuntimeException`
    
3. 结果
    
    遇到错误之前：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200347240.png)

    
    遇到错误后：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200351004.png)

    
    自动返回`nack`，RabbitMQ需要重新投递

**测试4：**

1. 配置`acknowledge-mode`为`auto`
    
2. 消费者在处理信息时出现`RuntimeException`（这个`Exception`只会触发一次）
    
    @Component  
    @Slf4j  
    public class SpringRabbitListener {  
        private static int num = 1;  
      
        @RabbitListener(queues = "hmall.queue1")  
        public void listenDirectQueue1(String msg) {  
            System.out.println("消费者1接收到direct.queue1的信息：【" + msg + "】");  
            if (num == 1) {  
                num--;  
                throw new RuntimeException("故意的");  
            }
            log.info("消息处理完成");  
        }
    }
    
3. 结果
    
    ![image-20240821230414790.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240821230414790.png)

    

#### 4.3.2 失败重试机制

当消费者出现异常后，消息会不断requeue（重入队）到队列，再重新发送给消费者。如果消费者再次执行依然出错，消息会再次requeue到队列，再次投递，直到消息处理成功为止。

极端情况就是消费者一直无法执行成功，那么消息requeue就会无限循环，导致mq的消息处理飙升，带来不必要的压力：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200428499.png)

当然，上述极端情况发生的概率还是非常低的，不过不怕一万就怕万一。为了应对上述情况Spring又提供了**消费者失败重试机制：在消费者出现异常时利用本地重试**，而不是无限制的requeue到mq队列。

spring:  
  rabbitmq:  
    listener:  
      simple:  
        retry:  
          enabled: true # 开启消费者失败重试  
          initial-interval: 1000ms # 初始的失败等待时长为1秒  
          multiplier: 1 # 失败的等待时长倍数，下次等待时长 = multiplier * last-interval（上一次的等待时长）  
          max-attempts: 3 # 最大重试次数  
          stateless: true # true无状态；false有状态。如果业务中包含事务，这里改为false

测试：

1. 消费者：
    
        @RabbitListener(queues = "hmall.queue1")  
        public void listenDirectQueue1(String msg) {  
            System.out.println("消费者1接收到direct.queue1的信息：【" + msg + "】");  
                throw new RuntimeException("故意的");  
        }
    
2. 发送者：
    
        @Test  
        void testPageOut(){
            String exchangeName="hmall.direct";  
            String message="Hello 23点02分";  
            rabbitTemplate.convertAndSend(exchangeName,"blue",message);
        }
    
3. 结果：
    
    ![image-20240824160049872.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240824160049872.png)

    
4. 结论：
    
    - 开启本地重试时，消息处理过程中抛出异常，不会requeue到队列，而是在消费者本地重试
        
    - 重试达到最大次数后，**SpringAMOP会返回reject**，消息会被丢弃
        

注意！！失败后**同一条消息仍占用消费线程**；若重试间隔较长（秒级以上），线程被 block，吞吐骤降（所以**内部重试适合“毫秒级、极少次数”的瞬时异常**；）

什么时候可以只用**内部重试**？

| 典型场景|原因|
|---|---|
|数据库偶发死锁、网络抖动|RT<50 ms，重试 1-2 次即可；长时间挂起线程影响小|
|同步调用链需要“失败即回滚”|不允许最终一致；要么立即成功，要么全局事务回滚|
|插件已安装 `x-delayed-message` 但运维不允许|小团队可权衡先用内部重试，后期再切 DLX|

#### 4.3.3 失败处理策略

在4.3.2的测试中，本地测试达到最大重试次数后，消息会被丢弃。这在某些对于消息可靠性要求较高的业务场景下，显然不太合适了。

因此Spring允许我们自定义重试次数耗尽后的消息处理策略，这个策略是由`MessageRecovery`接口来定义的，它有3个不同实现：

- `RejectAndDontRequeueRecoverer`：重试耗尽后，直接`reject`，丢弃消息。默认就是这种方式
- `ImmediateRequeueMessageRecoverer`：重试耗尽后，返回`nack`，消息重新入队
- `RepublishMessageRecoverer`：重试耗尽后，将失败消息投递到指定的交换机

比较优雅的一种处理方案是`RepublishMessageRecoverer`，失败后将消息投递到一个指定的，专门存放异常消息的队列，后续由人工集中处理。

> 可以通过邮件或者短信告知开发者，由开发者人工处理

![image-20240824161026114.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240824161026114.png)


使用方法：

1. 在consumer服务中定义处理失败消息的交换机和队列
    
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
    
2. 定义一个`RepublishMessageRecoverer`，关联队列和交换机
    
    @Bean  
    public MessageRecoverer republishMessageRecoverer(RabbitTemplate rabbitTemplate){
        return new RepublishMessageRecoverer(rabbitTemplate, "error.direct", "error");  
    }
    
    > `RepublishMessageRecoverer`的主要作用是在消息处理失败时，将失败的消息**自动**重新发布到指定的交换机和路由键。
    
3. 完整代码
    
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
    
    > `@ConditionalOnProperty`注解：在开启消费者失败重试机制的模块才加载的以下的bean，因为开启失败者重试机制要这样配置：
>
> ![image-20240824161622212.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240824161622212.png)

    
4. 结果：
    
    ErrorQueue收到信息：
    
    ![image-20240824162110247.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240824162110247.png)


综上：

消费者如何保证消息一定被消费?

- 开启消费者确认机制为auto，由spring确认消息处理成功后返回ack，异常时返回nack
    
    > 可能出现死循环

- 或者开启消费者失败重试机制，并设置MessageRecoverer，多次重试失败后将消息投递到异常交换机，交由人工处理


### 4.4 兜底方案

核心在于**主动查询**。

例如：既然MQ通知不一定发送到交易服务，那么交易服务就必须自己**主动去查询**支付状态。这样即便支付服务的MQ通知失败，我们依然能通过主动查询来保证订单状态的一致。

![image-20240824165411656.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240824165411656.png)


> 那么问题来了，我们到底该在什么时间主动查询支付状态呢？
>
> 这个时间是无法确定的，因此，通常我们采取的措施就是利用**定时任务**定期查询，例如每隔20秒就查询一次，并判断支付状态。如果发现订单已经支付，则立刻更新订单状态为已支付即可。

综上，支付服务与交易服务之间的订单状态一致性是如何保证的？

- 首先，支付服务会正在用户支付成功以后利用MQ消息通知交易服务，完成订单状态同步。
    
- 其次，为了保证MQ消息的可靠性，我们采用了生产者确认机制、消费者确认、消费者失败重试等策略，确保消息投递的可靠性
    
- 最后，我们还在交易服务设置了定时任务，定期查询订单支付状态。这样即便MQ通知失败，还可以利用定时任务作为兜底方案，确保订单支付状态的最终一致性。


## 5. 业务幂等性处理

何为幂等性？

**幂等**是一个数学概念，用函数表达式来描述是这样的：`f(x) = f(f(x))`，例如求绝对值函数。

在程序开发中，则是指同一个业务，执行一次或多次对业务状态的影响是一致的。例如：

- 根据id删除数据
    
- 查询数据
    
- 新增数据

但是数据的更新往往不是幂等的。

思考下面一个场景：

1. 假如用户刚刚支付完成，并且投递消息到交易服务，交易服务更改订单为**已支付**状态。
    
2. 消费者执行完业务后 ，还没有回执就宕机了，结果判断为消息没有确认，还在队列中，再投递给其他消费者。
    
3. 但是，在新投递的消息被消费之前，用户选择了退款，将订单状态改为了**已退款**状态。
    
4. 退款完成后，新投递的消息才被消费，那么订单状态会被再次改为**已支付**。业务异常。

因此，我们必须想办法保证消息处理的幂等性。这里给出两种方案：

- 唯一消息ID
    
- 业务状态判断


### 5.1 唯一消息ID

思路：

1. 每一条消息都生成一个唯一的id，与消息一起投递给消费者。
    
2. 消费者接收到消息后处理自己的业务，业务处理成功后将消息ID保存到数据库
    
3. 如果下次又收到相同消息，去数据库查询判断是否存在，存在则为重复消息放弃处理。


> 缺点：业务侵入、且有数据库的操作影响业务性能

SpringAMQP的`MessageConverter`自带了MessageID的功能，我们只要开启这个功能即可。

以Jackson的消息转换器为例：

@Bean  
public MessageConverter messageConverter(){
    // 1.定义消息转换器  
    Jackson2JsonMessageConverter jjmc = new Jackson2JsonMessageConverter();  
    // 2.配置自动创建消息id，用于识别不同消息，也可以在业务中基于ID判断是否是重复消息  
    jjmc.setCreateMessageIds(true);
    return jjmc;
}

![image-20240824164354219.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240824164354219.png)


> 意思就是，SpringAMOP帮你写好了新建MessageId的代码，但是利用MessageId实现业务幂等需要自己写

### 5.2 业务判断

业务判断就是基于业务本身的逻辑或状态来判断是否是重复的请求或消息，不同的业务场景判断的思路也不一样。

例如我们当前案例中，处理消息的业务逻辑是把订单状态从未支付修改为已支付。因此我们就可以在执行业务时判断订单状态是否是未支付，如果不是则证明订单已经被处理过，无需重复处理。

以支付修改订单的业务为例，我们需要修改`OrderServiceImpl`中的`markOrderPaySuccess`方法：

    @Override  
    public void markOrderPaySuccess(Long orderId) {
        // 1.查询订单  
        Order old = getById(orderId);
        // 2.判断订单状态  
        if (old == null || old.getStatus() != 1) {  
            // 订单不存在或者订单状态不是1，放弃处理  
            return;  
        }
        // 3.尝试更新订单  
        Order order = new Order();  
        order.setId(orderId);
        order.setStatus(2);
        order.setPayTime(LocalDateTime.now());  
        updateById(order);
    }

## 6. 顺序性

MQ发信息是有序的，只会在消费信息的时候乱序，出现乱序的场景：

- 一个队列有多个消费者
    
    ![image-20250713155122713.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20250713155122713.png)

    
- 一个queue对应一个consumer，但是consumer里面进行了多线程消费，这样也会造成消息消费顺序错误
    
    ![image-20250713155157917.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20250713155157917.png)

    

保证消息的顺序性

- 拆分多个queue，每个queue一个consumer，就是多一些queue而已，确实是麻烦点；这样也会造成吞吐量下降
    
    > MQ层面保证顺序性，按业务 key 分片路由多个 queue + 每 queue 1 个消费者（worker）
>
> 这个方案的本质是“**逻辑分片（shard）+ 分治处理**”。
>
> - 例如你按 userId 取模后路由：
>
>     userId % 4 → queue_0 ~ queue_3
>
> - 每个 queue 保证“同一用户的消息”都落到固定队列
>
> - 每个 queue 配一个 consumer，**内部严格按顺序处理消息**
>
    
    ![image-20250713155210411.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20250713155210411.png)

    
- 一个 queue，一个 consumer，consumer 内用内存队列做顺序控制再分发，然后分发给底层不同的worker来处理
    
    > 消费段保证顺序性
>
    工作流程：
    
    - 一个 queue + 一个 consumer
        
    - consumer 接收消息后，放入某个内存消息通道（比如按 userId 分发到不同本地 worker 的队列）
        
    - 每个 worker 负责一个 userId 的处理，串行执行
        
    
    RabbitMQ Queue → 单个 Consumer → userId 路由到内存Map<userId, 队列> → 各自worker消费
    
    ![image-20250713155221850.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20250713155221850.png)


## 7. 延迟信息

在电商的支付业务中，对于一些库存有限的商品，为了更好的用户体验，通常都会在用户下单时立刻扣减商品库存。例如电影院购票、高铁购票，下单后就会锁定座位资源，其他人无法重复购买。

但是这样就存在一个问题，假如用户下单后一直不付款，就会一直占有库存资源，导致其他客户无法正常交易，最终导致商户利益受损！

因此，电商中通常的做法就是：**对于超过一定时间未支付的订单，应该立刻取消订单并释放占用的库存**。

像这种在一段时间以后才执行的任务，我们称之为**延迟任务**，而要实现延迟任务，最简单的方案就是利用MQ的延迟消息了。

在RabbitMQ中实现延迟消息也有两种方案：

- 死信交换机+TTL
    
- 延迟消息插件


### 7.1 死信交换机和延迟消息

#### 7.1.1 死信交换机（DLX）

- **DLX 本质就是普通交换机**（direct/fanout/topic/headers）——只是被「死信」专用。
    
- **死信 (Dead Letter)** 指**没有被正常消费完毕**、需要“特殊处理”的消息。


当一个队列中的消息满足下列情况之一时，可以成为死信（dead letter）：

|触发类型|场景示例|Spring AMQP 写法|
|---|---|---|
|**TTL 过期**|消息或队列 TTL 到期|`x-message-ttl`, `expiration`|
|**被 NACK 并且不重回队列**|`basicNack(tag,false,false)`|`channel.basicNack…`|
|**被 Reject 并且不重回队列**|`basicReject(tag,false)`|`channel.basicReject…`|
|**队列超长 / 超多字节**|`x-max-length`, `x-max-length-bytes`|`QueueBuilder…withArgument()`|

> **触发后**：Broker 把消息投递到 **队列参数** `x-dead-letter-exchange = <DLX>` `x-dead-letter-routing-key = <DL-RK>` 指定的交换机 / 路由键。

死信交换机有什么作用呢？

1. 收集那些因处理失败而被拒绝的消息
    
2. 收集那些因队列满了而被拒绝的消息
    
3. 收集因TTL（有效期）到期的消息


示例：

@Configuration  
public class RabbitmqConfig3 {  
  
    public static final String ORDER_FINISHED_EXCHANGE = "order.finished.x";  
    public static final String CRM_ORDER_QUEUE = "crm.order.q";  
    public static final String CRM_DLX_EXCHANGE = "crm.dlx.x";  
    public static final String CRM_RETRY_QUEUE = "crm.retry.q";  
  
    @Bean  
    public FanoutExchange orderFinishedExchange() {  
        return ExchangeBuilder.fanoutExchange(ORDER_FINISHED_EXCHANGE)  
                .durable(true)  
                .build();  
    }
  
    @Bean  
    public DirectExchange crmDlxExchange() {  
        return ExchangeBuilder.directExchange(CRM_DLX_EXCHANGE).durable(true).build();  
    }
  
    @Bean  
    public Queue crmOrderQueue() {  
        return QueueBuilder.durable(CRM_ORDER_QUEUE)  
                .withArgument("x-dead-letter-exchange", CRM_DLX_EXCHANGE) // 设置死信交换机  
                .withArgument("x-dead-letter-routing-key", CRM_RETRY_QUEUE) // 死信交换机路由键  
                .build();  
    }
  
    @Bean  
    public Queue crmRetryQueue() {  
        return QueueBuilder.durable(CRM_RETRY_QUEUE)  
                .withArgument("x-message-ttl", 30000) // 消息存活 30 秒  
                .withArgument("x-dead-letter-exchange", ORDER_FINISHED_EXCHANGE) // 死信交换机  
                .withArgument("x-dead-letter-routing-key", "") // fanout 模式下 routing key 可为空  
                .build();  
    }
  
  
    @Bean  
    public Binding crmBinding() {  
        return BindingBuilder.bind(crmOrderQueue()).to(orderFinishedExchange());  
    }
  
    @Bean  
    public Binding retryBinding() {  
        return BindingBuilder.bind(crmRetryQueue()).to(crmDlxExchange()).with(CRM_RETRY_QUEUE);
    }
}

             60s 未消费或处理失败  
[crm.order.q] ───────────▶ [crm.dlx.x] ──(routing key: crm.retry.q)──▶ [crm.retry.q]  
                                ↑                                         ↓  
                      死信交换机（direct）                   TTL: 30 秒后死信  
                                                                          ↓  
                                                       [order.finished.x] (fanout)  
                                                                          ↓  
                                                                  [crm.order.q]（重新处理）

> **消息初始进入 `crm.order.q`**。
>
> 如果消费失败或超时 → 死信投递到 `crm.dlx.x`。
>
> `crm.dlx.x` → 根据 routing key `crm.retry.q` → 投到 `crm.retry.q`。
>
> 在 `crm.retry.q` 等待 30 秒 → 到期 → 死信投递到 `order.finished.x`。
>
> `order.finished.x` 是 fanout → 广播到所有绑定的队列 → 又回到了 `crm.order.q`。
>
> 实现了：**失败后延迟 30 秒，再次重试消费**。

在上面，死信交换机用作延迟队列。那么死信交换机还有别的用途吗？

| 场景                 | 目标                           | 典型做法                                                  | 你的充电订单示例                                       |
| ------------------ | ---------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| **1. 延迟重试 / 指数退避** | 失败消息隔一段时间再投，化解瞬时故障           | 业务队列 ➜ DLX ➜ _retry_ 队列（带 TTL 或 `x-delay`）➜ 回原交换机     | CRM 接口 502 → 30 s 后再推，仍失败 5 min 后再推            |
| **2. 峰值削峰 / 弹性缓冲** | 当消费端被打爆时，把 NACK 消息 “缓冲” 一会儿  | 运行时 `basicNack(requeue=false)` ➜ DLX 中转               | 计费服务宕机：状态消息转入 DLX，待服务恢复再批量处理                   |
| **3. 失效数据归档**      | 业务 TTL 到期的旧消息集中收集，供离线分析或清理   | 队列/消息 TTL → DLX → archive .q                          | 订单 48 h 未支付自动作废，归档到 `order.expired.q`          |
| **4. 毒性 / 非法消息隔离** | 把无法解析或多次失败的“毒药包”单独沉淀，防止阻塞主队列 | 消费端识别后 `basicReject(...false)` ➜ DLX ➜ parking lot .q | JSON 字段缺失导致反序列化异常的消息全部进 `order.parking.q` 手工排查 |
| **5. 队列溢出保护**      | 当主队列超长或超字节时，把新消息自动甩到备用队列     | 在队列上配 `x-max-length` + DLX                            | 高峰期突增的桩状态上报超出 500 k 长度 → 自动分流                  |
| **6. 灰度发布 / 分流试验** | 有选择地把部分流量旁路到测试或影子系统          | header/规则 NACK ➜ 特定 DLX                               | 把 1% 订单流量打到 `crm.sandbox.q` 做 AB test          |
| **7. 监控 & 告警入口**   | 所有异常消息统一收集，便于实时告警            | DLX 绑定告警服务或 Prometheus exporter                       | `x-death.count>3` 时触发 PagerDuty                |

#### 7.1.2 延迟信息

前面两种作用场景可以看做是把死信交换机当做一种消息处理的最终兜底方案，与消费者重试时讲的`RepublishMessageRecoverer`作用类似。

而最后一种，可以用于延迟信息：

如图，有一组绑定的交换机（`ttl.fanout`）和队列（`ttl.queue`）。但是`ttl.queue`没有消费者监听，而是设定了死信交换机`hmall.direct`，而队列`direct.queue1`则与死信交换机绑定，RoutingKey是blue

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200643359.png)


假如我们现在发送一条消息到`ttl.fanout`，RoutingKey为blue，并设置消息的**有效期**为5000毫秒

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200648917.png)


> 尽管这里的`ttl.fanout`不需要`RoutingKey`，但是当消息变为死信并投递到死信交换机时，会沿用之前的`RoutingKey`，这样`hmall.direct`才能正确路由消息。

消息肯定会被投递到`ttl.queue`之后，由于没有消费者，因此消息无人消费。5秒之后，消息的有效期到期，成为死信

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200655881.png)


死信被再次投递到死信交换机`hmall.direct`，并沿用之前的RoutingKey，也就是`blue`：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200703848.png)


由于`direct.queue1`与`hmall.direct`绑定的key是blue，因此最终消息被成功路由到`direct.queue1`，如果此时有消费者与`direct.queue1`绑定， 也就能成功消费消息了。但此时已经是5秒钟以后了：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200708330.png)


也就是说，publisher发送了一条消息，但最终consumer在5秒后才收到消息。我们成功实现了**延迟消息**。

**注意：**

RabbitMQ的消息过期是基于追溯方式来实现的，也就是说当一个消息的TTL到期以后不一定会被移除或投递到死信交换机，而是在消息恰好处于队首时才会被处理。

当队列中消息堆积很多的时候，过期消息可能不会被按时处理，因此你设置的TTL时间不一定准确。


### 7.2 DelayExchange

基于死信队列虽然可以实现延迟消息，但是太麻烦了。因此RabbitMQ社区提供了一个延迟消息插件来实现相同的效果。

[SchedulingMessagesWithRabbitMQ](https://www.rabbitmq.com/blog/2015/04/16/scheduling-messages-with-rabbitmq)

> 这个插件可以将普通交换机改造为支持延迟消息功能的交换机，当消息投递到交换机后可以暂存一定时间，到期后再投递到队列。

安装、部署见《2. RabbitMQ》

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112200717003.png)


插件的使用：

1. 声明交换机和队列
    
    基于注解方式：
    
    @RabbitListener(bindings = @QueueBinding(  
            value = @Queue(name = "delay.queue", durable = "true"),  
            exchange = @Exchange(name = "delay.direct", delayed = "true"),  
            key = "delay"  
    ))
    public void listenDelayMessage(String msg){
        log.info("接收到delay.queue的延迟消息：{}", msg);
    }
    
    基于`@Bean`的方式：
    
    @Slf4j  
    @Configuration  
    public class DelayExchangeConfig {  
      
        @Bean  
        public DirectExchange delayExchange(){
            return ExchangeBuilder  
                    .directExchange("delay.direct") // 指定交换机类型和名称  
                    .delayed() // 设置delay的属性为true  
                    .durable(true) // 持久化  
                    .build();  
        }
      
        @Bean  
        public Queue delayedQueue(){
            return new Queue("delay.queue");  
        }
          
        @Bean  
        public Binding delayQueueBinding(){
            return BindingBuilder.bind(delayedQueue()).to(delayExchange()).with("delay");  
        }
    }
    
2. 发送延迟消息
    
    发送消息时，必须通过x-delay属性设定延迟时间
    
    @Test  
    void testPublisherDelayMessage() {
        // 1.创建消息  
        String message = "hello, delayed message";  
        // 2.发送消息，利用消息后置处理器添加消息头  
        rabbitTemplate.convertAndSend("delay.direct", "delay", message, new MessagePostProcessor() {
            @Override  
            public Message postProcessMessage(Message message) throws AmqpException {  
                // 添加延迟消息属性  
                message.getMessageProperties().setDelay(5000);
                return message;
            }
        });
    }
    
    **注意：**
    
    延迟消息插件内部会维护一个本地数据库表，同时使用Elang Timers功能实现计时。如果消息的延迟时间设置较长，可能会导致堆积的延迟消息非常多，会带来较大的CPU开销，同时延迟消息的时间会存在误差。
    
    > 由CPU来维护计时时间，是密集型的任务
>
    因此，**不建议设置延迟时间过长的延迟消息**。