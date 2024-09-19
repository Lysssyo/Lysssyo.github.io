---
title: 配置文件注入的两种方式
date: 2024-09-19 10:11:00 +0800
categories: [Java, JavaWeb]
tags: [Java, JavaWeb]
---
在 Spring 应用中，配置文件的属性注入是一个常见的需求，通常用于将外部化配置与应用程序代码解耦。以下介绍两种常用的配置文件注入方式：

### 方式一：基于 `@Value` 注解的注入

`@Value` 注解用于从配置文件中注入单个属性值，适用于较简单的配置场景。它可以在任何 Spring 组件中使用，如 `@Configuration`、`@Component`、`@Service` 等。

```java
@Configuration
public class MinioConfig {

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.accessKey}")
    private String accessKey;

    @Value("${minio.secretKey}")
    private String secretKey;

    @Bean
    public MinioClient minioClient() {
        // 构建并返回 MinioClient 实例
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }
}
```

**配置文件示例：**

```yaml
# application.yml 或 bootstrap.yml
minio:
  endpoint: http://localhost:9000
  accessKey: minioadmin
  secretKey: minioadmin
  bucket:
    files: mediafiles
    videofiles: video
```

**总结：**

- `@Value` 注解适合处理简单的配置项，可以灵活地注入单个配置值。
- 适用于配置项数量较少或没有层次结构的场景。

### 方式二：基于 `@ConfigurationProperties` 注解的注入

`@ConfigurationProperties` 注解用于将配置文件中的一组属性注入到一个 Java 对象中。它能够很好地处理复杂的配置结构，尤其适合需要注入多个相关配置项的场景。

```java
@Component
@ConfigurationProperties(prefix = "sky.alioss")
@Data
public class AliOssProperties {

    private String endpoint;
    private String accessKeyId;
    private String accessKeySecret;
    private String bucketName;
}
```

**配置文件示例：**

```yaml
# application.yml
spring:
  profiles:
    active: dev # 指定使用 application-dev.yml 配置文件

sky:
  jwt:
    admin-secret-key: itcast
    admin-ttl: 720000000
    admin-token-name: token
    user-secret-key: itcast
    user-ttl: 720000000
    user-token-name: authentication

  alioss:
    endpoint: ${sky.alioss.endpoint}
    access-key-id: ${sky.alioss.access-key-id}
    access-key-secret: ${sky.alioss.access-key-secret}
    bucket-name: ${sky.alioss.bucket-name}
```

```yaml
# application-dev.yml
sky:
  alioss:
    endpoint: oss-cn-guangzhou.aliyuncs.com
    access-key-id: #DemoAccessKeyId
    access-key-secret: #DemoAccessSecret
    bucket-name: #lysssyo-sky
```

**总结：**

- `@ConfigurationProperties` 注解能够更好地处理复杂、分层的配置。
- 支持将多个相关配置项映射到一个 Java Bean 中，增强了代码的可维护性和清晰度。
- 适合大型项目或配置项复杂的场景。