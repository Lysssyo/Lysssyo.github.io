---
title: 微服务
date: 2024-08-19 14:30:00 +0800
categories: [Java, 微服务]
tags: [Java, 微服务,SpringCloud,nacos,Sentinel,openFeign]
---

## 1. 认识微服务

### 1.1 单体架构

单体架构（monolithic structure）：顾名思义，整个项目中所有功能模块都在一个工程中开发；项目部署时需要对所有模块一起编译、打包；项目的架构设计、开发模式都非常简单。

<img src="/assets/微服务.assets/image-20240728144634112.png" alt="image-20240728144634112" style="zoom:67%;">



当项目规模较小时，这种模式上手快，部署、运维也都很方便，因此早期很多小型项目都采用这种模式。

但随着项目的业务规模越来越大，团队开发人员也不断增加，单体架构就呈现出越来越多的问题：

- **团队协作成本高**：试想一下，你们团队数十个人同时协作开发同一个项目，由于所有模块都在一个项目中，不同模块的代码之间物理边界越来越模糊。最终要把功能合并到一个分支，你绝对会陷入到解决冲突的泥潭之中。
- **系统发布效率低**：任何模块变更都需要发布整个系统，而系统发布过程中需要多个模块之间制约较多，需要对比各种文件，任何一处出现问题都会导致发布失败，往往一次发布需要数十分钟甚至数小时。
- **系统可用性差**：单体架构各个功能模块是作为一个服务部署，相互之间会互相影响，一些热点功能会耗尽系统资源，导致其它服务低可用。

> 例如高并发接口会影响其他接口



### 1.2 微服务

微服务架构，首先是服务化，就是将单体架构中的功能模块从单体应用中拆分出来，独立部署为多个服务。同时要满足下面的一些特点：

- **单一职责**：一个微服务负责一部分业务功能，并且其核心数据不依赖于其它模块。
- **团队自治**：每个微服务都有自己独立的开发、测试、发布、运维人员，团队人员规模不超过10人（2张披萨能喂饱）
- **服务自治**：每个微服务都独立打包部署，访问自己独立的数据库。并且要做好服务隔离，避免对其它服务产生影响

例如，黑马商城项目，我们就可以把商品、用户、购物车、交易等模块拆分，交给不同的团队去开发，并独立部署：

<img src="/assets/微服务.assets/image-20240728144745904.png" alt="image-20240728144745904" style="zoom: 50%;">

**微服务架构解决了单体项目的问题：**

- 团队协作成本高
  - 由于服务拆分，每个服务代码量大大减少，参与开发的后台人员在1~3名，协作成本大大降低
- 系统发布效率低
  - 每个服务都是独立部署，当有某个服务有代码变更时，只需要打包部署该服务即可
- 系统可用性差
  - 每个服务独立部署，并且做好服务隔离，使用自己的服务器资源，不会影响到其它服务。

综上所述，微服务架构解决了单体架构存在的问题，特别适合大型互联网项目的开发，因此被各大互联网公司普遍采用。分布式就是服务拆分的过程，微服务架构正是分布式架构的一种最佳实践的方案。

### 1.3 SpringCloud

微服务拆分以后碰到的各种问题都有对应的解决方案和微服务组件，而SpringCloud框架可以说是目前Java领域最全面的微服务组件的集合了。

![image-20240728144943105](/assets/微服务.assets/image-20240728144943105.png)

而且SpringCloud依托于SpringBoot的自动装配能力，大大降低了其项目搭建、组件使用的成本。对于没有自研微服务组件能力的中小型企业，使用SpringCloud全家桶来实现微服务开发可以说是最合适的选择了！

目前SpringCloud最新版本为`2022.0.x`版本，对应的SpringBoot版本为`3.x`版本，但它们全部依赖于JDK17，目前在企业中使用相对较少。

| **SpringCloud版本**                                          | **SpringBoot版本**                    |
| :----------------------------------------------------------- | :------------------------------------ |
| [2022.0.x](https://github.com/spring-cloud/spring-cloud-release/wiki/Spring-Cloud-2022.0-Release-Notes) aka Kilburn | 3.0.x                                 |
| [2021.0.x](https://github.com/spring-cloud/spring-cloud-release/wiki/Spring-Cloud-2021.0-Release-Notes) aka Jubilee | 2.6.x, 2.7.x (Starting with 2021.0.3) |
| [2020.0.x](https://github.com/spring-cloud/spring-cloud-release/wiki/Spring-Cloud-2020.0-Release-Notes) aka Ilford | 2.4.x, 2.5.x (Starting with 2020.0.3) |
| [Hoxton](https://github.com/spring-cloud/spring-cloud-release/wiki/Spring-Cloud-Hoxton-Release-Notes) | 2.2.x, 2.3.x (Starting with SR5)      |
| [Greenwich](https://github.com/spring-projects/spring-cloud/wiki/Spring-Cloud-Greenwich-Release-Notes) | 2.1.x                                 |
| [Finchley](https://github.com/spring-projects/spring-cloud/wiki/Spring-Cloud-Finchley-Release-Notes) | 2.0.x                                 |
| [Edgware](https://github.com/spring-projects/spring-cloud/wiki/Spring-Cloud-Edgware-Release-Notes) | 1.5.x                                 |
| [Dalston](https://github.com/spring-projects/spring-cloud/wiki/Spring-Cloud-Dalston-Release-Notes) | 1.5.x                                 |

因此，使用次新版本：Spring Cloud 2021.0.x以及Spring Boot 2.7.x版本。



## 2. 微服务拆分原则

### 2.1 什么时候拆

一般情况下，对于一个初创的项目，首先要做的是验证项目的可行性。因此这一阶段的首要任务是敏捷开发，快速产出生产可用的产品，投入市场做验证。为了达成这一目的，该阶段项目架构往往会比较简单，很多情况下会直接采用单体架构，这样开发成本比较低，可以快速产出结果，一旦发现项目不符合市场，损失较小。

如果这一阶段采用复杂的微服务架构，投入大量的人力和时间成本用于架构设计，最终发现产品不符合市场需求，等于全部做了无用功。

所以，对于大多数小型项目来说，一般是先采用单体架构，随着用户规模扩大、业务复杂后再逐渐拆分为微服务架构。这样初期成本会比较低，可以快速试错。但是，在后期做服务拆分时，可能会遇到很多代码耦合带来的问题，拆分比较困难（**前易后难**）。

而对于一些大型项目，在立项之初目的就很明确，为了长远考虑，在架构设计时就直接选择微服务架构。虽然前期投入较多，但后期就少了拆分服务的烦恼（**前难后易**）。

### 2.2 拆分的目标

微服务拆分时**粒度要小**，这其实是拆分的目标。

- **高内聚**：每个微服务的职责要尽量单一，包含的业务相互关联度高、完整度高。
- **低耦合**：每个微服务的功能要相对独立，尽量减少对其它微服务的依赖，或者依赖接口的稳定性要强。

**高内聚**首先是**单一职责，**但不能说一个微服务就一个接口，而是要保证微服务内部业务的完整性为前提。目标是当我们要修改某个业务时，最好就只修改当前微服务，这样变更的成本更低。

一旦微服务做到了高内聚，那么服务之间的**耦合度**自然就降低了。

当然，微服务之间不可避免的会有或多或少的业务交互，比如下单时需要查询商品数据。这个时候我们不能在订单服务直接查询商品数据库，否则就导致了数据耦合。而应该由商品服务对应暴露接口，并且一定要保证微服务对外**接口的稳定性**（即：尽量保证接口外观不变）。虽然出现了服务间调用，但此时无论你如何在商品服务做内部修改，都不会影响到订单微服务，服务间的耦合度就降低了。

### 2.3 拆分方式

- **纵向**拆分
- **横向**拆分

所谓**纵向拆分**，就是按照项目的功能模块来拆分。例如黑马商城中，就有用户管理功能、订单管理功能、购物车功能、商品管理功能、支付功能等。那么按照功能模块将他们拆分为一个个服务，就属于纵向拆分。这种拆分模式可以尽可能提高服务的内聚性。

而**横向拆分**，是看各个功能模块之间有没有公共的业务部分，如果有将其抽取出来作为通用服务。例如用户登录是需要发送消息通知，记录风控数据，下单时也要发送短信，记录风控数据。因此消息发送、风控数据记录就是通用的业务功能，因此可以将他们分别抽取为公共服务：消息中心服务、风控管理服务。这样可以提高业务的复用性，避免重复开发。同时通用业务一般接口稳定性较强，也不会使服务之间过分耦合。

### 2.4 远程调度

业务需要其他模块的数据，通过java代码发起http请求向其他模块获取数据。



## 3. 注册中心

### 3.1 需求背景

在上一章我们实现了微服务拆分，并且通过Http请求实现了跨微服务的远程调用。不过这种手动发送Http请求的方式存在一些问题。

试想一下，假如商品微服务被调用较多，为了应对更高的并发，我们进行了多实例部署，如图：

<img src="/assets/微服务.assets/image-20240729171615370.png" alt="image-20240729171615370" style="zoom:50%;">

此时，每个`item-service`的实例其IP或端口不同，问题来了：

- item-service这么多实例，cart-service如何知道每一个实例的地址？
- http请求要写url地址，`cart-service`服务到底该调用哪个实例呢？
- 如果在运行过程中，某一个`item-service`实例宕机，`cart-service`依然在调用该怎么办？
- 如果并发太高，`item-service`临时多部署了N台实例，`cart-service`如何知道新实例的地址？

为了解决上述问题，就必须引入注册中心的概念。

### 3.2 基本概念

在微服务远程调用的过程中，包括两个角色：

- 服务提供者：提供接口供其它微服务访问，比如`item-service`
- 服务消费者：调用其它微服务提供的接口，比如`cart-service`

在大型微服务项目中，服务提供者的数量会非常多，为了管理这些服务就引入了**注册中心**的概念。注册中心、服务提供者、服务消费者三者间关系如下：

<img src="/assets/微服务.assets/image-20240729171731511.png" alt="image-20240729171731511" style="zoom:50%;">

流程如下：

- 服务启动时就会注册自己的服务信息（服务名、IP、端口）到注册中心
- 调用者可以从注册中心订阅想要的服务，获取服务对应的**实例列表**（1个服务可能多实例部署）
- 调用者自己对实例列表负载均衡，挑选一个实例
- 调用者向该实例发起远程调用

当服务提供者的实例宕机或者启动新实例时，调用者如何得知呢？

- 服务提供者会定期向注册中心发送请求，报告自己的健康状态（心跳请求）
- 当注册中心长时间收不到提供者的心跳时，会认为该实例宕机，将其从服务的实例列表中剔除
- 当服务有新实例启动时，会发送注册服务请求，其信息会被记录在注册中心的服务实例列表
- 当注册中心服务列表变更时，会主动通知微服务，更新本地服务列表



### 3.3 Nacos

目前开源的注册中心框架有很多，国内比较常见的有：

- Eureka：Netflix公司出品，目前被集成在SpringCloud当中，一般用于Java应用
- Nacos：Alibaba公司出品，目前被集成在SpringCloudAlibaba中，一般用于Java应用
- Consul：HashiCorp公司出品，目前集成在SpringCloud中，不限制微服务语言

以上几种注册中心都遵循SpringCloud中的API规范，因此在业务开发使用上没有太大差异。由于Nacos是国内产品，中文文档比较丰富，而且同时具备**配置管理**功能，因此在国内使用较多。

基于Docker的部署见md文档《Docker部署nacos》



#### 3.3.1 基于nacos做服务注册

**1. 引入依赖**

```xml
<!--nacos 服务注册发现-->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    <version>2021.0.4.0</version>
</dependency>
```

> 这个version不行就2021.0.3

**2. 配置nacos**

在的`application.yml`中添加nacos地址配置：

```yaml
spring:
  application:
    name: item-service # 服务名称
  cloud:
    nacos:
      server-addr: 192.168.150.101:8848 # nacos地址
```

**3. 启动服务实例**

为了展示多实例的效果，这里多启动一个实例

<img src="/assets/微服务.assets/image-20240730222927014.png" alt="image-20240730222927014" style="zoom: 67%;" />
<img src="/assets/微服务.assets/image-20240730223011397.png" alt="image-20240730223011397" style="zoom:67%;">

启动两个实例后

![image-20240730223047041](/assets/微服务.assets/image-20240730223047041.png)



#### 3.3.2 基于nacos做发现并调用服务

**1. 引入依赖**

```xml
<!--nacos 服务注册发现-->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    <version>2021.0.4.0</version>
</dependency>
```

> 这个version不行就2021.0.3
>
> 可以发现，这里Nacos的依赖于服务注册时一致，这个依赖中同时包含了服务注册和发现的功能。因为任何一个微服务都可以调用别人，也可以被别人调用，即可以是调用者，也可以是提供者。
>
> 因此，等一会儿`cart-service`启动，同样会注册到Nacos

**2. 配置nacos**

在的`application.yml`中添加nacos地址配置：

```yaml
spring:
  application:
    name: cart-service # 服务名称
  cloud:
    nacos:
      server-addr: 192.168.150.101:8848 # nacos地址
```

**3. 发现并调用服务**

服务提供者有多个实例，因此服务调用者必须利用负载均衡的算法，从多个实例中挑选一个去访问。常见的负载均衡算法有：

- 随机
- 轮询
- IP的hash
- 最近最少访问
- ...

这里我们可以选择最简单的随机负载均衡进行模拟

另外，服务发现需要用到一个工具，DiscoveryClient，SpringCloud已经帮我们自动装配，我们可以直接注入使用：

<img src="/assets/微服务.assets/image-20240730223334427.png" alt="image-20240730223334427" style="zoom: 80%;">

> 来自org.springframework.cloud.client.discovery.DiscoveryClient;

调用示例：

```java
        // 2.查询商品
        List<ServiceInstance> instances = discoveryClient.getInstances("item-service");//通过服务名得到服务列表
        if (instances.isEmpty()) {
            return;//服务列表为空，返回
        }
        ServiceInstance instance = instances.get(RandomUtil.randomInt(instances.size()));//随机一个实例，假装实现负载均衡
        URI uri = instance.getUri();
        log.debug("通过负载均衡得到服务“{}”的url，为：{}", "item-service", uri);
        ResponseEntity<List<ItemDTO>> response = restTemplate.exchange(
                uri + "/items?ids={ids}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ItemDTO>>() {
                },
                Map.of("ids", CollUtils.join(itemIds, ","))

        );
```

<img src="/assets/微服务.assets/image-20240730223530282.png" alt="image-20240730223530282" style="zoom:80%;">



### 3.4 OpenFign

#### 3.4.1 需求背景

利用RestTemplate可以实现了服务的远程调用，但是远程调用的代码太复杂了：

```java
        // 2.查询商品
        List<ServiceInstance> instances = discoveryClient.getInstances("item-service");
        if (instances.isEmpty()) {
            return;
        }
        ServiceInstance instance = instances.get(RandomUtil.randomInt(instances.size()));
        URI uri = instance.getUri();
        log.debug("通过负载均衡得到服务“{}”的url，为：{}", "item-service", uri);
        ResponseEntity<List<ItemDTO>> response = restTemplate.exchange(
                uri + "/items?ids={ids}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ItemDTO>>() {
                },
                Map.of("ids", CollUtils.join(itemIds, ","))

        );

        if (!response.getStatusCode().is2xxSuccessful()) {
            return;
        }
        List<ItemDTO> items = response.getBody();
```

这种调用方式，与原本的本地方法调用差异太大，编程时的体验也不统一，一会儿远程调用，一会儿本地调用。

因此，我们必须想办法改变远程调用的开发模式，让**远程调用像本地方法调用一样简单**。而这就要用到OpenFeign组件了。

其实远程调用的关键点就在于四个：

- 请求方式
- 请求路径
- 请求参数
- 返回值类型

所以，OpenFeign就利用SpringMVC的相关注解来声明上述4个参数，然后基于动态代理帮我们生成远程调用的代码，而无需我们手动再编写，非常方便。

#### 3.4.2 实现

**1. 引入依赖**

```xml
  <!--openFeign-->
  <dependency>
      <groupId>org.springframework.cloud</groupId>
      <artifactId>spring-cloud-starter-openfeign</artifactId>
  </dependency>
  <!--负载均衡器-->
  <dependency>
      <groupId>org.springframework.cloud</groupId>
      <artifactId>spring-cloud-starter-loadbalancer</artifactId>
  </dependency>
```

**2. 启用openFeign**

<img src="/assets/微服务.assets/image-20240806151432564.png" alt="image-20240806151432564" style="zoom:80%;">

**3. 编写OpenFeign客户端**

```java
@FeignClient("item-service")
public interface ItemClient {

    @GetMapping("/items")
    List<ItemDTO> queryItemByIds(@RequestParam("ids") Collection<Long> ids);
}
```

> - `@FeignClient("item-service")` ：声明服务名称
> - `@GetMapping` ：声明请求方式
> - `@GetMapping("/items")` ：声明请求路径
> - `@RequestParam("ids") Collection<Long> ids` ：声明请求参数
> - `List<ItemDTO>` ：返回值类型

**4. 使用FeignClient**

<img src="/assets/微服务.assets/image-20240806151640719.png" alt="image-20240806151640719" style="zoom:67%;">



#### 3.4.3 连接池

Feign底层发起http请求，依赖于其它的框架。其底层支持的http客户端实现包括：

- HttpURLConnection：默认实现，不支持连接池
- Apache HttpClient ：支持连接池
- OKHttp：支持连接池

因此我们通常会使用带有连接池的客户端来代替默认的HttpURLConnection。比如，我们使用OKHttp.

**1. 引入依赖**

```xml
<!--OK http 的依赖 -->
<dependency>
  <groupId>io.github.openfeign</groupId>
  <artifactId>feign-okhttp</artifactId>
</dependency>
```

**2. 开启连接池**

```xml
feign:
  okhttp:
    enabled: true # 开启OKHttp功能
```



#### 3.4.4 最佳实践

`cart-service`需要引用`item-service`的服务，如果由`cart-service`编写`client`，那就只能是给`cart-service`用，如果`order-service`也需要引用`item-service`，那么`order-service`也要写一个`client`，显然，代码重复编写且糅合，并且如果接口改变，`order-service`和`cart-service`都需要重写

避免重复编码的办法就是**抽取**。不过这里有两种抽取思路：

<img src="/assets/微服务.assets/image-20240806162801520.png" alt="image-20240806162801520" style="zoom: 50%;">

- 方案1抽取更加简单，工程结构也比较清晰，但缺点是整个项目耦合度偏高。
- 方案2抽取相对麻烦，工程结构相对更复杂，但服务之间耦合度降低。

<img src="/assets/微服务.assets/image-20240806163227393.png" alt="image-20240806163227393" style="zoom: 80%;">

抽取后如图所示。

其中，ItemClient如下

```java
@FeignClient("item-service")
public interface ItemClient {
    @GetMapping("/items")
    List<ItemDTO> queryItemByIds(@RequestParam("ids") Collection<Long> ids);
}
```

> 具体实现见3.4.2 实现

但是，抽取后，ItemClient没有在服务调用者（例如`cart-service`）的包中，所以启动类启动时就扫描不到这个ItemClient，所以，要这些写注解：

<img src="/assets/微服务.assets/image-20240806163440717.png" alt="image-20240806163440717" style="zoom:80%;">



#### 3.4.5 日志设置

OpenFeign只会在FeignClient所在包的日志级别为**DEBUG**时，才会输出日志。而且其日志级别有4级：

- **NONE**：不记录任何日志信息，这是默认值。
- **BASIC**：仅记录请求的方法，URL以及响应状态码和执行时间
- **HEADERS**：在BASIC的基础上，额外记录了请求和响应的头信息
- **FULL**：记录所有请求和响应的明细，包括头信息、请求体、元数据。

**1. 在hm-api模块下新建一个配置类，定义Feign的日志级别：**

<img src="/assets/微服务.assets/image-20240806171045620.png" alt="image-20240806171045620" style="zoom:80%;">



**2. 配置**

- **局部**生效：在某个`FeignClient`中配置，只对当前`FeignClient`生效

```Java
@FeignClient(value = "item-service", configuration = DefaultFeignConfig.class)
```

- **全局**生效：在`@EnableFeignClients`中配置，针对所有`FeignClient`生效。

```Java
@EnableFeignClients(basePackages = "com.hmall.api.clients",defaultConfiguration = DefaultFeignConfig.class)
```



## 4. 网关路由

### 4.1 认识网关

<img src="/assets/微服务.assets/image-20240807171656758.png" alt="image-20240807171656758" style="zoom: 50%;">

在SpringCloud当中，提供了两种网关实现方案：

- Netflix Zuul：早期实现，目前已经淘汰
- SpringCloudGateway：基于Spring的WebFlux技术，完全支持响应式编程，吞吐能力更强

### 4.2 Demo

**1. 创建新的模块**

<img src="/assets/微服务.assets/image-20240807171822597.png" alt="image-20240807171822597" style="zoom: 67%;">

**2. 引入依赖**

```xml
    <dependencies>
        <!--common-->
        <dependency>
            <groupId>com.heima</groupId>
            <artifactId>hm-common</artifactId>
            <version>1.0.0</version>
        </dependency>
        <!--网关-->
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-gateway</artifactId>
        </dependency>
        <!--nacos discovery-->
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
        </dependency>
        <!--负载均衡-->
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-loadbalancer</artifactId>
        </dependency>
    </dependencies>
```

**3. 编写启动类**

```java
@SpringBootApplication
public class GatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
```

**4. 编写路由**

```yaml
server:
  port: 8080
spring:
  application:
    name: gateway
  cloud:
    nacos:
      server-addr: ip:8848
    gateway:
      routes:
        - id: item # 路由规则id，自定义，唯一
          uri: lb://item-service # 路由的目标服务，lb代表负载均衡，会从注册中心拉取服务列表
          predicates: # 路由断言，判断当前请求是否符合当前规则，符合则路由到目标服务
            - Path=/items/**,/search/** # 这里是以请求路径作为判断规则
        - id: cart
          uri: lb://cart-service
          predicates:
            - Path=/carts/**
        - id: user
          uri: lb://user-service
          predicates:
            - Path=/users/**,/addresses/**
        - id: trade
          uri: lb://trade-service
          predicates:
            - Path=/orders/**
        - id: pay
          uri: lb://pay-service
          predicates:
            - Path=/pay-orders/**
```

> 官方文档：[Spring Cloud Gateway](https://docs.spring.io/spring-cloud-gateway/docs/3.1.8/reference/html/)
>
> `predicates`是路由断言。SpringCloudGateway中支持的断言类型有很多：
>
> | **名称**   | **说明**                       | **示例**                                                     |
> | :--------- | :----------------------------- | :----------------------------------------------------------- |
> | After      | 是某个时间点后的请求           | - After=2037-01-20T17:42:47.789-07:00[America/Denver]        |
> | Before     | 是某个时间点之前的请求         | - Before=2031-04-13T15:14:47.433+08:00[Asia/Shanghai]        |
> | Between    | 是某两个时间点之前的请求       | - Between=2037-01-20T17:42:47.789-07:00[America/Denver], 2037-01-21T17:42:47.789-07:00[America/Denver] |
> | Cookie     | 请求必须包含某些cookie         | - Cookie=chocolate, ch.p                                     |
> | Header     | 请求必须包含某些header         | - Header=X-Request-Id, \d+                                   |
> | Host       | 请求必须是访问某个host（域名） | - Host=**.somehost.org,**.anotherhost.org                    |
> | Method     | 请求方式必须是指定方式         | - Method=GET,POST                                            |
> | Path       | 请求路径必须符合指定规则       | - Path=/red/{segment},/blue/**                               |
> | Query      | 请求参数必须包含指定参数       | - Query=name, Jack或者- Query=name                           |
> | RemoteAddr | 请求者的ip必须是指定范围       | - RemoteAddr=192.168.1.1/24                                  |
> | weight     | 权重处理                       |                                                              |



### 4.3 网关登录校验

#### 4.3.1 网关工作流程

<img src="/assets/微服务.assets/image-20240810223414855.png" alt="image-20240810223414855" style="zoom:67%;">

1. 客户端请求进入网关后由`HandlerMapping`对请求做判断，找到与当前请求匹配的路由规则（**`Route`**），然后将请求交给`WebHandler`去处理。
2. `WebHandler`则会加载当前路由下需要执行的过滤器链（**`Filter chain`**），然后按照顺序逐一执行过滤器（后面称为**`Filter`**）。
3. 图中`Filter`被虚线分为左右两部分，是因为`Filter`内部的逻辑分为`pre`和`post`两部分，分别会在请求路由到微服务**之前**和**之后**被执行。
4. 只有所有`Filter`的`pre`逻辑都依次顺序执行通过后，请求才会被路由到微服务。
5. 微服务返回结果后，再倒序执行`Filter`的`post`逻辑。
6. 最终把响应结果返回。

如图中所示，最终请求转发是有一个名为`NettyRoutingFilter`的过滤器来执行的，而且这个过滤器是整个过滤器链中顺序最靠后的一个。**如果我们能够定义一个过滤器，在其中实现登录校验逻辑，并且将过滤器执行顺序定义到`NettyRoutingFilter`之前**，这就符合我们登录校验的需求了！



#### 4.3.2 过滤器

网关过滤器链中的过滤器有两种：

- **`GatewayFilter`**：路由过滤器，作用范围比较灵活，可以是任意指定的路由`Route`. 
- **`GlobalFilter`**：全局过滤器，作用范围是所有路由，不可配置。

<img src="/assets/微服务.assets/image-20240810224119689.png" alt="image-20240810224119689" style="zoom:80%;">

其实`GatewayFilter`和`GlobalFilter`这两种过滤器的方法签名完全一致：

```Java
/**
 * 处理请求并将其传递给下一个过滤器
 * @param exchange 当前请求的上下文，其中包含request、response等各种数据
 * @param chain 过滤器链，基于它向下传递请求
 * @return 根据返回值标记当前请求是否被完成或拦截，chain.filter(exchange)就放行了。
 */
Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain);
```

`FilteringWebHandler`（见4.3.1图）在处理请求时，会将`GlobalFilter`装饰为`GatewayFilter`，然后放到同一个过滤器链中，排序以后依次执行。

>  `Gateway`中内置了很多的`GatewayFilter`，详情可以参考官方文档：
>
>  [Spring Cloud Gateway](https://docs.spring.io/spring-cloud-gateway/docs/3.1.7/reference/html/#gatewayfilter-factories)

`Gateway`内置的`GatewayFilter`过滤器使用起来非常简单，无需编码，只要在yaml文件中简单配置即可。而且其作用范围也很灵活，配置在哪个`Route`下，就作用于哪个`Route`

例如，有一个过滤器叫做`AddRequestHeaderGatewayFilterFacotry`，顾明思议，就是添加请求头的过滤器，可以给请求添加一个请求头并传递到下游微服务。

使用的使用只需要在application.yaml中这样配置：

```YAML
spring:
  cloud:
    gateway:
      routes:
      - id: test_route
        uri: lb://test-service
        predicates:
          -Path=/test/**
        filters:
          - AddRequestHeader=key, value # 逗号之前是请求头的key，逗号之后是value
```

如果想要让过滤器作用于所有的路由，则可以这样配置：

```YAML
spring:
  cloud:
    gateway:
      default-filters: # default-filters下的过滤器可以作用于所有路由
        - AddRequestHeader=key, value
      routes:
      - id: test_route
        uri: lb://test-service
        predicates:
          -Path=/test/**
```





#### 4.3.3 自定义GlobalFilter

**1. 网关模块下建包**

<img src="/assets/微服务.assets/image-20240810225411909.png" alt="image-20240810225411909" style="zoom:80%;">

```java
@Component// 被Spring容器识别
public class MyGlobalFilter implements GlobalFilter, Ordered {
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // 模拟登录校验逻辑
        ServerHttpRequest request = exchange.getRequest();
        HttpHeaders headers = request.getHeaders();
        System.out.println("headers = "+ headers);
        // 放行
        return  chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        // 过滤器执行顺序，值越小，优先级越高
        return 0;
    }
}
```

#### 4.3.4 自定义GatewayFilter

自定义`GatewayFilter`不是直接实现`GatewayFilter`，而是实现`AbstractGatewayFilterFactory`。最简单的方式是这样的：

```Java
@Component
public class PrintAnyGatewayFilterFactory extends AbstractGatewayFilterFactory<Object> {
    @Override
    public GatewayFilter apply(Object config) {
        return new GatewayFilter() {
            @Override
            public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
                // 获取请求
                ServerHttpRequest request = exchange.getRequest();
                // 编写过滤器逻辑
                System.out.println("过滤器执行了");
                // 放行
                return chain.filter(exchange);
            }
        };
    }
}
```

**注意**：该类的名称一定要以`GatewayFilterFactory`为后缀！

然后在yaml配置中这样使用：

```YAML
spring:
  cloud:
    gateway:
      default-filters:
            - PrintAny # 此处直接以自定义的GatewayFilterFactory类名称前缀类声明过滤器
```

另外，这种过滤器还可以支持动态配置参数，不过实现起来比较复杂，示例：

```Java
@Component
public class PrintAnyGatewayFilterFactory // 父类泛型是内部类的Config类型
                extends AbstractGatewayFilterFactory<PrintAnyGatewayFilterFactory.Config> {

    @Override
    public GatewayFilter apply(Config config) {
        // OrderedGatewayFilter是GatewayFilter的子类，包含两个参数：
        // - GatewayFilter：过滤器
        // - int order值：值越小，过滤器执行优先级越高
        return new OrderedGatewayFilter(new GatewayFilter() {
            @Override
            public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
                // 获取config值
                String a = config.getA();
                String b = config.getB();
                String c = config.getC();
                // 编写过滤器逻辑
                System.out.println("a = " + a);
                System.out.println("b = " + b);
                System.out.println("c = " + c);
                // 放行
                return chain.filter(exchange);
            }
        }, 100);
    }

    // 自定义配置属性，成员变量名称很重要，下面会用到
    @Data
    static class Config{
        private String a;
        private String b;
        private String c;
    }
    // 将变量名称依次返回，顺序很重要，将来读取参数时需要按顺序获取
    @Override
    public List<String> shortcutFieldOrder() {
        return List.of("a", "b", "c");
    }
        // 返回当前配置类的类型，也就是内部的Config
    @Override
    public Class<Config> getConfigClass() {
        return Config.class;
    }

}
```

然后在yaml文件中使用：

```YAML
spring:
  cloud:
    gateway:
      default-filters:
            - PrintAny=1,2,3 # 注意，这里多个参数以","隔开，将来会按照shortcutFieldOrder()方法返回的参数顺序依次复制
```

上面这种配置方式参数必须严格按照shortcutFieldOrder()方法的返回参数名顺序来赋值。

还有一种用法，无需按照这个顺序，就是手动指定参数名：

```YAML
spring:
  cloud:
    gateway:
      default-filters:
            - name: PrintAny
              args: # 手动指定参数名，无需按照参数顺序
                a: 1
                b: 2
                c: 3
```



#### 4.3.5 实现登录校验

##### 4.3.5.1 原理

<img src="/assets/微服务.assets/image-20240811182054447.png" alt="image-20240811182054447" style="zoom: 50%;">

##### 4.3.5.2  准备

利用自定义`GlobalFilter`来完成登录校验。

登录校验需要用到JWT，而且JWT的加密需要秘钥和加密工具。这些在`hm-service`中已经有了，我们直接拷贝过来：

<img src="/assets/微服务.assets/image-20240811181634377.png" alt="image-20240811181634377" style="zoom:67%;">

> - `AuthProperties`：配置登录校验需要拦截的路径，因为不是所有的路径都需要登录才能访问
> - `JwtProperties`：定义与JWT工具有关的属性，比如秘钥文件位置
> - `SecurityConfig`：工具的自动装配
> - `JwtTool`：JWT工具，其中包含了校验和解析`token`的功能
> - `hmall.jks`：秘钥文件

`AuthProperties`

```java
@Data
@Component
@ConfigurationProperties(prefix = "hm.auth")
public class AuthProperties {
    private List<String> includePaths;
    private List<String> excludePaths;
}
```

`JwtProperties`

```java
@Data
@ConfigurationProperties(prefix = "hm.jwt")
public class JwtProperties {
    private Resource location;
    private String password;
    private String alias;
    private Duration tokenTTL = Duration.ofMinutes(10);
}
```

`SecurityConfig`

```java
@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder(){
        return new BCryptPasswordEncoder();
    }

    @Bean
    public KeyPair keyPair(JwtProperties properties){
        // 获取秘钥工厂
        KeyStoreKeyFactory keyStoreKeyFactory =
                new KeyStoreKeyFactory(
                        properties.getLocation(),
                        properties.getPassword().toCharArray());
        //读取钥匙对
        return keyStoreKeyFactory.getKeyPair(
                properties.getAlias(),
                properties.getPassword().toCharArray());
    }
}
```

`JwtTool`

```java
@Component
public class JwtTool {
    private final JWTSigner jwtSigner;

    public JwtTool(KeyPair keyPair) {
        this.jwtSigner = JWTSignerUtil.createSigner("rs256", keyPair);
    }

    /**
     * 创建 access-token
     *
     * @param userDTO 用户信息
     * @return access-token
     */
    public String createToken(Long userId, Duration ttl) {
        // 1.生成jws
        return JWT.create()
                .setPayload("user", userId)
                .setExpiresAt(new Date(System.currentTimeMillis() + ttl.toMillis()))
                .setSigner(jwtSigner)
                .sign();
    }

    /**
     * 解析token
     *
     * @param token token
     * @return 解析刷新token得到的用户信息
     */
    public Long parseToken(String token) {
        // 1.校验token是否为空
        if (token == null) {
            throw new UnauthorizedException("未登录");
        }
        // 2.校验并解析jwt
        JWT jwt;
        try {
            jwt = JWT.of(token).setSigner(jwtSigner);
        } catch (Exception e) {
            throw new UnauthorizedException("无效的token", e);
        }
        // 2.校验jwt是否有效
        if (!jwt.verify()) {
            // 验证失败
            throw new UnauthorizedException("无效的token");
        }
        // 3.校验是否过期
        try {
            JWTValidator.of(jwt).validateDate();
        } catch (ValidateException e) {
            throw new UnauthorizedException("token已经过期");
        }
        // 4.数据格式校验
        Object userPayload = jwt.getPayload("user");
        if (userPayload == null) {
            // 数据为空
            throw new UnauthorizedException("无效的token");
        }

        // 5.数据解析
        try {
           return Long.valueOf(userPayload.toString());
        } catch (RuntimeException e) {
            // 数据格式有误
            throw new UnauthorizedException("无效的token");
        }
    }
}
```

其中`AuthProperties`和`JwtProperties`所需的属性要在`application.yaml`中配置：

```YAML
hm:
  jwt:
    location: classpath:hmall.jks # 秘钥地址
    alias: hmall # 秘钥别名
    password: hmall123 # 秘钥文件密码
    tokenTTL: 30m # 登录有效期
  auth:
    excludePaths: # 无需登录校验的路径
      - /search/**
      - /users/login
      - /items/**
```

##### 4.3.5.3 实现自定义GlobalFilter

```java
@Component
@RequiredArgsConstructor //构造函数传参
public class AuthGlobalFilter implements GlobalFilter, Ordered {
    private final JwtTool jwtTool;
    private final AuthProperties authProperties;
    private final AntPathMatcher antPathMatcher = new AntPathMatcher();// spring提供的路径匹配器
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // 1.获取request
        ServerHttpRequest request = exchange.getRequest();
        // 2.判断是否需要拦截
        if (isExclude(request.getPath().toString())) {
            // 放行
            return chain.filter(exchange);
        }
        // 3.获取token
        String token = null;
        // JWT令牌默认保存在key为authentication的请求头中
        List<String> authorization = request.getHeaders().get("authorization");
        if (authorization != null && !authorization.isEmpty()) {
            token = authorization.get(0);
        }
        // 4.校验并解析token
        Long userId;
        try {
            userId = jwtTool.parseToken(token);
        } catch (UnauthorizedException e) {
            // 如果无效，拦截
            ServerHttpResponse response = exchange.getResponse();
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return response.setComplete();
        }
        // 5.传递用户信息
        System.out.println("userId = " + userId);
        String userInfo = userId.toString();
        ServerWebExchange ex = exchange.mutate()
                .request((builder -> builder.header("user-info", userInfo)))
                .build();// 用户信息放在请求头传递给微服务
        // 6.放行
        return chain.filter(ex);
    }
    //这个函数用于判断拦截的路径是否包含于AuthProperties（见4.3.5.2 准备）的excludePaths（不用拦截）
    private boolean isExclude(String antPath) {
        for (String pathPattern : authProperties.getExcludePaths()) {
            if(antPathMatcher.match(pathPattern, antPath)){
                return true;
            }
        }
        return false;
    }

    @Override
    public int getOrder() {
        //return的值越小，该Filter越先拦截
        return 0;
    }
}
```

##### 4.3.5.4 网关传用户信息给微服务

原http请求在转发到微服务之后就失效，由微服务调用其他微服务时需要重新在请求头中加入用户信息

在这里实现：

```java
        // 5.传递用户信息
        System.out.println("userId = " + userId);
        String userInfo = userId.toString();
        ServerWebExchange ex = exchange.mutate()
                .request((builder -> builder.header("user-info", userInfo)))
                .build();// 用户信息放在请求头传递给微服务
        // 6.放行
        return chain.filter(ex);
```

##### 4.3.5.5 微服务获取用户信息

微服务通过拦截器获取用户信息，由于每个微服务都有获取登录用户的需求，因此拦截器我们直接写在`hm-common`中，并写好自动装配。这样微服务只需要引入`hm-common`就可以直接具备拦截器功能，无需重复编写。

在hm-common中已经有一个用于保存登录用户的ThreadLocal工具，其中已经提供了保存和获取用户的方法：

<img src="/assets/微服务.assets/image-20240811182808521.png" alt="image-20240811182808521" style="zoom: 67%;">

接下来，只需要编写拦截器，获取用户信息并保存到`UserContext`，然后放行即可。

**定义拦截器：**

```java
public class UserInfoInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 1.获取请求头中的用户信息
        String userInfo = request.getHeader("user-info");
        // 2.判断是否为空
        if (StrUtil.isNotBlank(userInfo)) {
            // 不为空，保存到ThreadLocal
            UserContext.setUser(Long.valueOf(userInfo));
        }
        // 3.放行
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        // 移除用户
        UserContext.removeUser();
    }
}
```

**配置拦截器：**

```java
@Configuration
@ConditionalOnClass(DispatcherServlet.class)
public class MvcConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new UserInfoInterceptor());
    }
}
```

> - `@ConditionalOnClass(DispatcherServlet.class)`
>
>   @ConditionalOnClass是Spring Boot中的一个条件注解，它可以用来指定在类路径中存在特定的类时才加载某个配置类或Bean。这个注解可以用于自动配置类或普通的Spring组件中，以实现根据类路径中的情况来决定是否加载某个配置或Bean。
>
>   gateway不是基于springMvc的，所以该MvcConfig不应该生效（但是因为gateway也引入了hm-common这个包，MvcConfig会在gateway钟生效）。通过@ConditionalOnClass(DispatcherServlet.class)，表示MvcConfig仅对包含了springMvc的核心类(DispatcherServlet)的微服务生效
>
> - registry.addInterceptor(new UserInfoInterceptor());
>
>   通过 registry.addInterceptor(new UserInfoInterceptor()) 将一个名为UserInfoInterceptor的拦截器添加到拦截器注册表中。这样自定义的拦截器才会生效

不过，需要注意的是，这个配置类默认是不会生效的，因为它所在的包是`com.hmall.common.config`，与其它微服务的扫描包不一致，无法被扫描到，因此无法生效。

基于SpringBoot的自动装配原理，我们要将其添加到`resources`目录下的`META-INF/spring.factories`文件中：

<img src="/assets/微服务.assets/image-20240811183342009.png" alt="image-20240811183342009" style="zoom:50%;">

`spring.factories`

```
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.hmall.config.MyBatisConfig,\
  com.hmall.config.JsonConfig,\
  com.hmall.config.MvcConfig
```



##### 4.3.5.6 微服务间传递用户信息

前端发起的请求都会经过网关再到微服务，由于我们之前编写的过滤器和拦截器功能，微服务可以轻松获取登录用户信息。但有些业务是比较复杂的，请求到达微服务后还需要调用其它多个微服务。比如下单业务，流程如下：

<img src="/assets/微服务.assets/image-20240811201307429.png" alt="image-20240811201307429" style="zoom:80%;">

下单的过程中，需要调用商品服务扣减库存，调用购物车服务清理用户购物车。而清理购物车时必须知道当前登录的用户身份。但是，**订单服务调用购物车服务时并没有传递用户信息**，购物车服务无法知道当前用户是谁！

> 前端发起请求，网关解析jwt中的用户信息，保存到请求头中，例如请求头的`user-Info`保存`userId`，再将请求转发给订单服务，订单服务的拦截器可以解析请求头获取用户信息保存到`ThreadLocal`中但是订单服务在向商品服务发起请求的时候，请求由`OpenFeign`发出，请求头没有携带`user-Info`，所以商品服务的拦截器没有收到`userId`

微服务之间调用是基于OpenFeign来实现的，并不是我们自己发送的请求。我们如何才能让每一个由OpenFeign发起的请求自动携带登录用户信息呢？

这里要借助Feign中提供的一个拦截器接口：`feign.RequestInterceptor`

```Java
public interface RequestInterceptor {
  /**
   * Called for every request. 
   * Add data using methods on the supplied {@link RequestTemplate}.
   */
  void apply(RequestTemplate template);
}
```

我们只需要实现这个接口，然后实现apply方法，利用`RequestTemplate`类来添加请求头，将用户信息保存到请求头中。这样以来，每次OpenFeign发起请求的时候都会调用该方法，传递用户信息。

由于`FeignClient`全部都是在`hm-api`模块，因此我们在`hm-api`模块的`com.hmall.api.config.DefaultFeignConfig`中编写这个拦截器：

```java
public class DefaultFeignConfig {
    @Bean
    public Logger.Level feignLogLevel(){
        return Logger.Level.FULL;
    }
    @Bean
    public RequestInterceptor userInfoRequestInterceptor(){
        return new RequestInterceptor() {
            @Override
            public void apply(RequestTemplate template) {
                // 获取登录用户
                Long userId = UserContext.getUser();
                if(userId == null) {
                    // 如果为空则直接跳过
                    return;
                }
                // 如果不为空则放入请求头中，传递给下游微服务
                template.header("user-info", userId.toString());
            }
        };
    }
}
```

> 在`com.hmall.api.config.DefaultFeignConfig`中添加一个Bean



## 5. 配置管理

### 5.1 背景

- 网关路由在配置文件中写死了，如果变更必须重启微服务
- 某些业务配置在配置文件中写死了，每次修改都要重启服务
- 每个微服务都有很多重复的配置，维护成本高

这些问题都可以通过统一的**配置管理器服务**解决。而Nacos不仅仅具备注册中心功能，也具备配置管理的功能：

<img src="/assets/微服务.assets/image-20240812141240504.png" alt="image-20240812141240504" style="zoom:50%;">

微服务共享的配置可以统一交给Nacos保存和管理，在Nacos控制台修改配置后，Nacos会将配置变更推送给相关的微服务，并且无需重启即可生效，实现配置热更新。

网关的路由同样是配置，因此同样可以基于这个功能实现动态路由功能，无需重启网关即可修改路由配置。

### 5.2 配置共享

我们可以把微服务共享的配置抽取到Nacos中统一管理，这样就不需要每个微服务都重复配置了。分为两步：

- 在Nacos中添加共享配置
- 微服务拉取配置

#### 5.2.1 添加共享配置

可以将不同微服务相同的配置抽取出来，由nacos统一管理

我们在nacos控制台分别添加这些配置。

首先是jdbc相关配置，在`配置管理`->`配置列表`中点击`+`新建一个配置：

<img src="/assets/微服务.assets/image-20240812143847173.png" alt="image-20240812143847173" style="zoom:50%;">

在弹出的表单中填写信息：

<img src="/assets/微服务.assets/image-20240812143909356.png" alt="image-20240812143909356" style="zoom: 80%;">

```yaml
spring:
  datasource:
    url: jdbc:mysql://${hm.db.host}/${hm.db.database}?useUnicode=true&characterEncoding=UTF-8&autoReconnect=true&serverTimezone=Asia/Shanghai
    driver-class-name: com.mysql.cj.jdbc.Driver
    username: root
    password: ${hm.db.pw}

mybatis-plus:
  configuration:
    default-enum-type-handler: com.baomidou.mybatisplus.core.handlers.MybatisEnumTypeHandler
  global-config:
    db-config:
      update-strategy: not_null
      id-type: auto
```

注意这里的jdbc的相关参数并没有写死，例如：

- `数据库ip`：通过`${hm.db.host}`配置
- `数据库database`：可以通过`${hm.db.database}`来设定，无默认值

> 此外，可以设置默认值，例如`${hm.db.port:3306}`，配置了默认值为`3306`，同时允许通过`${hm.db.port}`来覆盖默认值
>
> 这些配置的值可以在application.yaml中读取：
>
> ![image-20240812144509488](/assets/微服务.assets/image-20240812144509488.png)

后面两个同理：

![image-20240812144227711](/assets/微服务.assets/image-20240812144227711.png)

`shared-log.yaml`

```yaml
logging:
  level:
    com.hmall: debug
  pattern:
    dateformat: HH:mm:ss:SSS
  file:
    path: "logs/${spring.application.name}"
```

`shared-swagger.yaml`

```yaml
knife4j:
  enable: true
  openapi:
    title: ${hm.swagger.title}
    description: ${hm.swagger.desc}
    email: lyssyo@qq.com
    concat: Lysssyo
    url: https://www.lysssyo.cn
    version: v1.0.0
    group:
      default:
        group-name: default
        api-rule: package
        api-rule-resources:
          - ${hm.swagger.package}
```

#### 5.2.2 拉取共享配置

接下来，我们要在微服务拉取共享配置。将拉取到的共享配置与本地的`application.yaml`配置合并，完成项目上下文的初始化。

不过，需要注意的是，读取Nacos配置是SpringCloud上下文（`ApplicationContext`）初始化时处理的，发生在项目的引导阶段。然后才会初始化SpringBoot上下文，去读取`application.yaml`。

也就是说引导阶段，`application.yaml`文件尚未读取，根本不知道nacos 地址，该如何去加载nacos中的配置文件呢？

SpringCloud在初始化上下文的时候会先读取一个名为`bootstrap.yaml`(或者`bootstrap.properties`)的文件，如果我们将nacos地址配置到`bootstrap.yaml`中，那么在项目引导阶段就可以读取nacos中的配置了。

<img src="/assets/微服务.assets/image-20240812144711435.png" alt="image-20240812144711435" style="zoom:67%;">

因此，微服务整合Nacos配置管理的步骤如下：

1）引入依赖：

在cart-service模块引入依赖：

```XML
  <!--nacos配置管理-->
  <dependency>
      <groupId>com.alibaba.cloud</groupId>
      <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
  </dependency>
  <!--读取bootstrap文件-->
  <dependency>
      <groupId>org.springframework.cloud</groupId>
      <artifactId>spring-cloud-starter-bootstrap</artifactId>
  </dependency>
```

2）新建bootstrap.yaml

微服务的resources目录新建一个bootstrap.yaml文件：

<img src="/assets/微服务.assets/image-20240812144807233.png" alt="image-20240812144807233" style="zoom: 80%;">

```yaml
spring:
  application:
    name: item-service #微服务名称
  profiles:
    active: local
  cloud:
    nacos:
      server-addr: ip:8848
      config:
        file-extension: yaml # 文件后缀名
        shared-configs: # 共享配置
          - dataId: shared-jdbc.yaml # 共享mybatis配置
          - dataId: shared-log.yaml # 共享日志配置
          - dataId: shared-swagger.yaml # 共享日志配置
```

3）修改application.yaml

由于一些配置挪到了bootstrap.yaml，因此application.yaml需要修改为：

<img src="/assets/微服务.assets/image-20240812144921924.png" alt="image-20240812144921924" style="zoom:80%;">

```yaml
server:
  port: 8081
feign:
  okhttp:
    enabled: true # 开启OKHttp连接池支持
hm:
  swagger:
    title: "商品服务接口文档"
    package: com.hmall.item.controller
  db:
    database: hm-item
```



### 5.3 配置热更新

有很多的业务相关参数，将来可能会根据实际情况临时调整。例如购物车业务，购物车数量有一个上限，默认是10，对应代码如下：

<img src="/assets/微服务.assets/image-20240812152951369.png" alt="image-20240812152951369" style="zoom:80%;">

现在这里购物车是写死的固定值，我们应该将其配置在配置文件中，方便后期修改。

但现在的问题是，即便写在配置文件中，修改了配置还是需要重新打包、重启服务才能生效。能不能不用重启，直接生效呢？

这就要用到Nacos的配置热更新能力了，分为两步：

- 在Nacos中添加配置
- 在微服务读取配置

1）在Nacos中添加配置

首先，我们在nacos中添加一个配置文件，将购物车的上限数量添加到配置中：

<img src="/assets/微服务.assets/image-20240812153204230.png" alt="image-20240812153204230" style="zoom:80%;">

> 注意，DataID必须为`[服务名]-[spring.active.profile].[后缀名]`（其中`[spring.active.profile]`可选），因为SpringCloud在启动时会读取名为这个的配置文件：![image-20240812153453222](/assets/微服务.assets/image-20240812153453222.png)

2）读取配置

在`cart-service\src\main\java\com\hmall\cart\config`中新建一个属性读取类：

```java
@Data
@Component
@ConfigurationProperties(prefix = "hm.cart")
public class CartProperties {
    private Integer maxAmount;
}
```

接着，在业务中使用该属性加载类：

![image-20240812154849654](/assets/微服务.assets/image-20240812154849654.png)



## 6. 微服务保护

### 6.1 业务背景

查询购物车的业务需要调用商品服务，假如商品服务业务并发较高，占用过多Tomcat连接。可能会导致商品服务的所有接口响应时间增加，延迟变高，甚至是长时间阻塞直至查询失败。

此时查询购物车业务需要查询并等待商品查询结果，从而导致查询购物车列表业务的响应时间也变长，甚至也阻塞直至无法访问。而如果查询购物车的请求较多，可能导致购物车服务的Tomcat连接占用较多，所有接口的响应时间都会增加，整个服务性能很差， 甚至不可用。即商品服务的不可用导致购物车服务的不可用

依次类推，整个微服务群中与购物车服务、商品服务等有调用关系的服务可能都会出现问题，最终导致整个集群不可用。

这就是**级联失败**问题，或者叫**雪崩**问题。

综上，雪崩产生的原因是：

- 微服务相互调用，服务提供者出现故障或阻塞。
- 服务调用者没有做好异常处理，导致自身故障
- 调用链中的所有服务级联失败，导致整个集群故障

从而，解决方法是

- 尽量避免服务出现故障或阻塞
  - 保证代码的健壮性
  - 保证网络畅通
  - 能应对较高的并发请求
- 服务调用者做好远程调用异常的后备方案，避免故障扩散

### 6.2 保护方案

#### 6.2.1 请求限流

<img src="/assets/微服务.assets/image-20240814164620579.png" alt="image-20240814164620579" style="zoom: 50%;">



#### 6.2.2 线程隔离

线程隔离的思想来自轮船的舱壁模式：

<img src="/assets/微服务.assets/image-20240814171438340.png" alt="image-20240814171438340" style="zoom:40%;">

轮船的船舱会被隔板分割为N个相互隔离的密闭舱，假如轮船触礁进水，只有损坏的部分密闭舱会进水，而其他舱由于相互隔离，并不会进水。这样就把进水控制在部分船体，避免了整个船舱进水而沉没。

为了避免某个接口故障或压力过大导致整个服务不可用，我们可以限定每个接口可以使用的资源范围，也就是将其“隔离”起来。

<img src="/assets/微服务.assets/image-20240814171506676.png" alt="image-20240814171506676" style="zoom:50%;">

如图所示，我们给查询购物车业务限定可用线程数量上限为20，这样即便查询购物车的请求因为查询商品服务而出现故障，也不会导致购物车服务的服务器线程资源被耗尽，不会影响到其它接口。

#### 6.2.3 服务熔断

如上图所示，虽然基于线程隔离可用避免购物车服务的服务器的线程资源耗尽，但是，即使在已知商品服务故障且查询购物车的线程没有耗尽的情况下，依然会有查询购物车的请求。这显然不合理，合理的做法应该是已知商品服务故障的情况下，不再对其发起请求。

所以，我们要做两件事情：

- **编写服务降级逻辑**：就是服务调用失败后的处理逻辑，根据业务场景，可以抛出异常，也可以返回友好提示或默认数据。
- **异常统计和熔断**：统计服务提供方的异常比例，当比例过高表明该接口会影响到其它服务，应该拒绝调用该接口，而是直接走降级逻辑。

<img src="/assets/微服务.assets/image-20240814171939068.png" alt="image-20240814171939068" style="zoom:50%;">

### 6.3 Sentinel

#### 6.3.1 配置

[官方文档：introduction | Sentinel (sentinelguard.io)](https://sentinelguard.io/zh-cn/docs/introduction.html)

Sentinel 的使用可以分为两个部分：
核心库(Jar包)：不依赖任何框架/库，能够运行于 Java8 及以上的版本的运行时环境，同时对Dubbo/Spring cloud 等框架也有较好的支持。在项目中引入依赖即可实现服务限流、隔离、熔断等功能。
控制台(Dashboard)：Dashboard 主要负责管理推送规则、监控、管理机器信息等。

> jar启动命令
>
> ```shell
> java -Dserver.port=8090 -Dcsp.sentinel.dashboard.server=localhost:8090 -Dproject.name=sentinel-dashboard -jar sentinel-dashboard.jar
> ```
>
> [启动配置项 · alibaba/Sentinel Wiki (github.com)](https://github.com/alibaba/Sentinel/wiki/启动配置项)

**微服务整合**

1）引入sentinel依赖

```XML
<!--sentinel-->
<dependency>
    <groupId>com.alibaba.cloud</groupId> 
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
```

2）配置控制台

修改application.yaml文件，添加下面内容：

```YAML
spring:
  cloud: 
    sentinel:
      transport:
        dashboard: localhost:8090
```

3）访问`cart-service`的任意端点

重启`cart-service`，然后访问查询购物车接口，sentinel的客户端就会将服务访问的信息提交到`sentinel-dashboard`控制台。并展示出统计信息：

![image-20240818192905117](/assets/微服务.assets/image-20240818192905117.png)

> 点击簇点链路菜单，会看到下面的页面：
>
> ![image-20240818193207789](/assets/微服务.assets/image-20240818193207789.png)
>
> 所谓簇点链路，就是单机调用链路，是一次请求进入服务后经过的每一个被`Sentinel`监控的资源。默认情况下，`Sentinel`会监控`SpringMVC`的每一个`Endpoint`（接口）。
>
> 因此，我们看到`/carts`这个接口路径就是其中一个簇点，我们可以对其进行限流、熔断、隔离等保护措施。

此外，我们可以选择打开Sentinel的请求方式前缀，把`请求方式 + 请求路径`作为簇点资源名：

在`cart-service`的`application.yml`中添加下面的配置：

```YAML
spring:
  cloud:
    sentinel:
      transport:
        dashboard: localhost:8090
      http-method-specify: true # 开启请求方式前缀
```

修改后：

![image-20240818193225875](/assets/微服务.assets/image-20240818193225875.png)



#### 6.3.2 请求限流

在簇点链路后面点击流控按钮，即可对其做限流配置：

<img src="/assets/微服务.assets/image-20240818193253050.png" alt="image-20240818193253050" style="zoom:50%;">

在弹出的菜单中这样填写：

<img src="/assets/微服务.assets/image-20240818193307289.png" alt="image-20240818193307289" style="zoom: 50%;">

这样就把查询购物车列表这个簇点资源的流量限制在了每秒6个，也就是最大QPS为6.

> QPS 是 "每秒查询数"（Queries Per Second）的缩写

#### 6.3.3 线程隔离

限流可以降低服务器压力，尽量减少因并发流量引起的服务故障的概率，但并不能完全避免服务故障。一旦某个服务出现故障，我们必须隔离对这个服务的调用，避免发生雪崩。

比如，查询购物车的时候需要查询商品，为了避免因商品服务出现故障导致购物车服务级联失败，我们可以把购物车查询购物车的部分隔离起来，限制可用的线程资源：

<img src="/assets/微服务.assets/image-20240818193413130.png" alt="image-20240818193413130" style="zoom:50%;">

<img src="/assets/微服务.assets/image-20240818193650104.png" alt="image-20240818193650104" style="zoom:50%;">

#### 6.3.4 FallBack

<img src="/assets/微服务.assets/image-20240818195531760.png" alt="image-20240818195531760" style="zoom:67%;">

**业务背景**

刚刚的案例中，对整个查询购物车的服务进行线程隔离，其实可以只对商品服务(ItemClient)进行线程隔离。并且，如果无法向商品服务发起请求，可以设置一个fallback逻辑，触发限流或熔断后的请求不一定要直接报错，也可以返回一些默认数据或者友好提示，用户体验会更好。

**具体实现**

给FeignClient编写失败后的降级逻辑有两种方式：

- 方式一：FallbackClass，无法对远程调用的异常做处理
- 方式二：FallbackFactory，可以对远程调用的异常做处理，我们一般选择这种方式。

步骤如下：

1. 开启Feign的sentinel功能（为了开启远程调用feignclient作为簇点，可以被流量监控）

> 这一步是使购物车服务中调用的ItemClient进行流量管控

```yaml
feign:
  sentinel:
    enabled: true # 开启feign对sentinel的支持
```

2. 在hm-api模块中给`ItemClient`定义降级处理类，实现`FallbackFactory`

```java
@Slf4j
public class ItemClientFallback implements FallbackFactory<ItemClient> {
    @Override
    public ItemClient create(Throwable cause) {
        return new ItemClient() {
            @Override
            public List<ItemDTO> queryItemByIds(Collection<Long> ids) {
                log.error("远程调用ItemClient#queryItemByIds方法出现异常，参数：{}", ids, cause);
                // 查询购物车允许失败，查询失败，返回空集合
                return CollUtils.emptyList();
            }

            @Override
            public void deductStock(List<OrderDetailDTO> items) {
                // 库存扣减业务需要触发事务回滚，查询失败，抛出异常
                throw new BizIllegalException(cause);
            }
        };
    }
}
```

3. 在`hm-api`模块中的`com.hmall.api.config.DefaultFeignConfig`类中将`ItemClientFallback`注册为一个`Bean`

<img src="/assets/微服务.assets/image-20240818193957599.png" alt="image-20240818193957599" style="zoom:80%;">

4. 在`hm-api`模块中的`ItemClient`接口中使用`ItemClientFallbackFactory`

![image-20240818194026296](/assets/微服务.assets/image-20240818194026296.png)

重启后，再次测试，发现被限流的请求不再报错，走了降级逻辑：

![image-20240818194042911](/assets/微服务.assets/image-20240818194042911.png)



#### 6.3.5 服务熔断

查询商品的RT较高（模拟的500ms），从而导致查询购物车的RT也变的很长。这样不仅拖慢了购物车服务，消耗了购物车服务的更多资源，而且用户体验也很差。对于商品服务这种不太健康的接口，我们应该停止调用，直接走降级逻辑，避免影响到当前服务。也就是将商品查询接口**熔断**。当商品服务接口恢复正常后，再允许调用。这其实就是**断路器**的工作模式了。

Sentinel中的断路器不仅可以统计某个接口的**慢请求比例**，还可以统计**异常请求比例**。当这些比例超出阈值时，就会**熔断**该接口，即拦截访问该接口的一切请求，降级处理；当该接口恢复正常时，再放行对于该接口的请求。

断路器的工作状态切换有一个状态机来控制：

<img src="/assets/微服务.assets/image-20240818201525312.png" alt="image-20240818201525312" style="zoom: 67%;">

状态机包括三个状态：

- **closed**：关闭状态，断路器放行所有请求，并开始统计异常比例、慢请求比例。超过阈值则切换到open状态
- **open**：打开状态，服务调用被**熔断**，访问被熔断服务的请求会被拒绝，快速失败，直接走降级逻辑。Open状态持续一段时间后会进入half-open状态
- **half-open**：半开状态，放行一次请求，根据执行结果来判断接下来的操作。 
  - 请求成功：则切换到closed状态
  - 请求失败：则切换到open状态

**新增熔断规则：**

<img src="/assets/微服务.assets/image-20240818201620845.png" alt="image-20240818201620845" style="zoom: 50%;">

这种是按照慢调用比例来做熔断，上述配置的含义是：

- RT超过200毫秒的请求调用就是慢调用
- 统计最近1000ms内的最少5次请求，如果慢调用比例不低于0.5，则触发熔断
- 熔断持续时长20s

测试：

![image-20240818201734283](/assets/微服务.assets/image-20240818201734283.png)





### 6.4 分布式事务

#### 6.4.1 业务背景

<img src="/assets/微服务.assets/image-20240819010900586.png" alt="image-20240819010900586" style="zoom:50%;">

由于订单、购物车、商品分别在三个不同的微服务，而每个微服务都有自己独立的数据库，因此下单过程中就会跨多个数据库完成业务。而每个微服务都会执行自己的本地事务：

- 交易服务：下单事务
- 购物车服务：清理购物车事务
- 库存服务：扣减库存事务

整个业务中，各个本地事务是有关联的。因此每个微服务的本地事务，也可以称为**分支事务**。多个有关联的分支事务一起就组成了**全局事务**。我们必须保证整个全局事务同时成功或失败。

#### 6.4.2 Seata

[官方文档：Apache Seata](https://seata.apache.org/zh-cn/)

其实分布式事务产生的一个重要原因，就是参与事务的多个分支事务互相无感知，不知道彼此的执行状态。因此解决分布式事务的思想非常简单：

就是找一个统一的**事务协调者**，与多个分支事务通信，检测每个分支事务的执行状态，保证全局事务下的每一个分支事务同时成功或失败即可。大多数的分布式事务框架都是基于这个理论来实现的。

Seata也不例外，在Seata的事务管理中有三个重要的角色：

-  **TC (Transaction Coordinator) - 事务协调者：**维护全局和分支事务的状态，协调全局事务提交或回滚。 
-  **TM (Transaction Manager) -** **事务管理器：**定义全局事务的范围、开始全局事务、提交或回滚全局事务。 
-  **RM (Resource Manager) -** **资源管理器：**管理分支事务，与TC交谈以注册分支事务和报告分支事务的状态，并驱动分支事务提交或回滚。 

Seata的工作架构如图所示：

<img src="/assets/微服务.assets/image-20240819011132056.png" alt="image-20240819011132056" style="zoom: 60%;">

其中，**TM**和**RM**可以理解为Seata的客户端部分，引入到参与事务的微服务依赖中即可。将来**TM**和**RM**就会协助微服务，实现本地分支事务与**TC**之间交互，实现事务的提交或回滚。而**TC**服务则是事务协调中心，是一个独立的微服务，需要单独部署。

> 理解为TM负责发放任务，TC是包工头或队长，RM是打工的

#### 6.4.3 部署TC

**1. 准备数据库表**

Seata支持多种存储模式，但考虑到持久化的需要，我们一般选择基于数据库存储。`D:\A_Technology\Docker\images\seata\seata-tc.sql`，导入数据库

**2. 编写配置文件**

将整个seata文件夹拷贝到虚拟机的`/root`目录

<img src="/assets/微服务.assets/image-20240819011857050.png" alt="image-20240819011857050" style="zoom:67%;">

**3. Docker部署**

将`D:\AAA_SecondDesktop\A_Technology\Docker\images\seata\seata-1.5.2.tar`拖入虚拟机，执行下面的命令

```shell
# 1. 创建镜像
docker load -i seata-1.5.2.tar
# 2. 创建容器，加入到正确的网络
docker run --name seata \
-p 8099:8099 \
-p 7099:7099 \
-e SEATA_IP=192.168.150.101 \
-v ./seata:/seata-server/resources \
--privileged=true \
--network hm-net \
-d \
seataio/seata-server:1.5.2
```

**4. seata启动！**

http://ip:7099/访问seata控制台

> 同时，seata也通过它的配置文件注册到了nacos中
>
> ![image-20240819013336009](/assets/微服务.assets/image-20240819013336009.png)



#### 6.4.4 微服务集成Seata

**1. 引入依赖**

参与分布式事务的每一个微服务都需要集成Seata，为了方便各个微服务集成seata，我们需要把seata配置共享到nacos，因此参与分布式事务的每一个微服务不仅仅要引入seata依赖，还要引入nacos依赖：

```xml
<!--统一配置管理-->
  <dependency>
      <groupId>com.alibaba.cloud</groupId>
      <artifactId>spring-cloud-starter-alibaba-nacos-config</artifactId>
  </dependency>
  <!--读取bootstrap文件-->
  <dependency>
      <groupId>org.springframework.cloud</groupId>
      <artifactId>spring-cloud-starter-bootstrap</artifactId>
  </dependency>
  <!--seata-->
  <dependency>
      <groupId>com.alibaba.cloud</groupId>
      <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
  </dependency>
```

**2. nacos新增seata共享配置**

> 因为参与分布式事务的微服务都要用，所以写成共享配置好一点

```yaml
seata:
  registry: # TC服务注册中心的配置，微服务根据这些信息去注册中心获取tc服务地址
    type: nacos # 注册中心类型 nacos
    nacos:
      server-addr: 192.168.150.101:8848 # nacos地址
      namespace: "" # namespace，默认为空
      group: DEFAULT_GROUP # 分组，默认是DEFAULT_GROUP
      application: seata-server # seata服务名称
      username: nacos
      password: nacos
  tx-service-group: hmall # 事务组名称
  service:
    vgroup-mapping: # 事务组与tc集群的映射关系
      hmall: "default"
```

<img src="/assets/微服务.assets/image-20240819013512837.png" alt="image-20240819013512837" style="zoom:80%;">

**3. `bootstrap.yaml`添加seata配置**

```yaml
spring:
  application:
    name: trade-service # 服务名称
  profiles:
    active: dev
  cloud:
    nacos:
      server-addr: 192.168.150.101 # nacos地址
      config:
        file-extension: yaml # 文件后缀名
        shared-configs: # 共享配置
          - dataId: shared-jdbc.yaml # 共享mybatis配置
          - dataId: shared-log.yaml # 共享日志配置
          - dataId: shared-swagger.yaml # 共享日志配置
          - dataId: shared-seata.yaml # 共享seata配置
```

所有参与分布式事务的微服务都要这么操作。

查看seata日志：

![image-20240819014341658](/assets/微服务.assets/image-20240819014341658.png)

#### 6.4.5 XA模式

Seata支持四种不同的分布式事务解决方案：

- **XA**
- **TCC**
- **AT**
- **SAGA**

`XA` 规范是` X/Open` 组织定义的分布式事务处理（DTP，Distributed Transaction Processing）标准，XA 规范 描述了全局的`TM`与局部的`RM`之间的接口，几乎所有主流的数据库都对 XA 规范 提供了支持。

> 补充：`XA`规范
>
> 正常情况：
>
> <img src="/assets/微服务.assets/image-20240819115405498.png" alt="image-20240819115405498" style="zoom: 67%;">
>
> 异常情况：
>
> <img src="/assets/微服务.assets/image-20240819115426747.png" alt="image-20240819115426747" style="zoom:67%;">
>
> 一阶段：
>
> - 事务协调者通知每个事务参与者执行本地事务
> - 本地事务执行完成后报告事务执行状态给事务协调者，此时事务不提交，继续持有数据库锁
>
> 二阶段：
>
> - 事务协调者基于一阶段的报告来判断下一步操作
> - 如果一阶段都成功，则通知所有事务参与者，提交事务
> - 如果一阶段任意一个参与者失败，则通知所有事务参与者回滚事务

Seata对原始的XA模式做了简单的封装和改造，以适应自己的事务模型，基本架构如图：

<img src="/assets/微服务.assets/image-20240819115458869.png" alt="image-20240819115458869" style="zoom:80%;">

> 请求进入全局事务对应的方法，TM会向TC注册一个全局事务，TM开始执行内部业务逻辑，内部业务逻辑最终是要调用这些微服务的，其中每一个微服务都可以认为是全局事务中的分支事务。当分支事务开始执行时候，资源管理器RM会拦截其对数据库的操作，会先向TC报告，注册一下分支事务，属于哪个全局，然后才能去执行业务sql，sql执行完后，但是XA规范规定sql是不能提交的。(事务不提交，其对应的锁不会释放，事务写操作，往往会开启一个排他锁，占用操作资源，只要锁没有释放，其他任何人无法对这些资源进行操作。)等到TM告诉TC事务结束，TC会检查所有分支事务的状态，若成功，则让所有事务提交，释放锁，否则回滚。

`RM`一阶段的工作：

1. 注册分支事务到`TC`
2. 执行分支业务sql但不提交

> 不提交事务，sql语句不会生效，且数据库资源不会释放，因此性能较差

3. 报告执行状态到`TC`

`TC`二阶段的工作：

1.  `TC`检测各分支事务执行状态
   1. 如果都成功，通知所有RM提交事务
   2. 如果有失败，通知所有RM回滚事务 

`RM`二阶段的工作：

- 接收`TC`指令，提交或回滚事务

**实现XA模式：**

1. 在applicat.yaml中配置（或者在Nacos中的共享shared-seata.yaml配置文件中设置）：

```yaml
seata:
  data-source-proxy-mode: XA
```

2. 利用`@GlobalTransactional`标记分布式事务的入口方法：

<img src="/assets/微服务.assets/image-20240819120758015.png" alt="image-20240819120758015" style="zoom:50%;">

> 分支事务可以手动加上 `@Transational`注解

#### 6.4.6 AT模式

Seata主推的是AT模式，AT模式同样是分阶段提交的事务模型，不过缺弥补了XA模型中资源锁定周期过长的缺陷

<img src="/assets/微服务.assets/image-20240819141235124.png" alt="image-20240819141235124" style="zoom:67%;">

阶段一`RM`的工作：

- 注册分支事务
- 记录undo-log（数据快照）
- 执行业务sql并提交
- 报告事务状态

阶段二提交时`RM`的工作：

- 删除undo-log即可

阶段二回滚时`RM`的工作：

- 根据undo-log恢复数据到更新前

> 简述`AT`模式与`XA`模式最大的区别是什么？
>
> `XA`模式一阶段不提交事务，锁定资源；`AT`模式一阶段直接提交，不锁定资源。
>
> `XA`模式依赖数据库机制实现回滚；`AT`模式利用数据快照实现数据回滚。
>
> `XA`模式强一致；`AT`模式最终一致

**实现AT模式：**

1. 参与事务的所有微服务的数据库加一张表

```sql
-- for AT mode you must to init this sql for you business database. the seata server not need it.
CREATE TABLE IF NOT EXISTS `undo_log`
(
    `branch_id`     BIGINT       NOT NULL COMMENT 'branch transaction id',
    `xid`           VARCHAR(128) NOT NULL COMMENT 'global transaction id',
    `context`       VARCHAR(128) NOT NULL COMMENT 'undo_log context,such as serialization',
    `rollback_info` LONGBLOB     NOT NULL COMMENT 'rollback info',
    `log_status`    INT(11)      NOT NULL COMMENT '0:normal status,1:defense status',
    `log_created`   DATETIME(6)  NOT NULL COMMENT 'create datetime',
    `log_modified`  DATETIME(6)  NOT NULL COMMENT 'modify datetime',
    UNIQUE KEY `ux_undo_log` (`xid`, `branch_id`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  DEFAULT CHARSET = utf8mb4 COMMENT ='AT transaction mode undo table';
```

2. 在applicat.yaml中配置（或者在Nacos中的共享shared-seata.yaml配置文件中设置）：

> 事实上，不配置也行，默认AT

```yaml
seata:
  data-source-proxy-mode: AT
```

3. 测试：某个分支事务出错时，全部回滚

![image-20240819142255641](/assets/微服务.assets/image-20240819142255641.png)

> 在执行过程中，分支事务会提交，然后undo_log会生成日志：
>
> ![image-20240819142706120](/assets/微服务.assets/image-20240819142706120.png)
