---
title: Minio入门
date: 2024-09-24 11:56:00 +0800
categories: [中间件,Minio]
tags: [Minio]
---

# Minio入门

## 1. 简介

MinIO 是一个非常轻量的服务，可以很简单的和其他应用的结合使用，它兼容亚马逊 S3 云存储服务接口，非常适合于存储大容量非结构化的数据，例如图片、视频、日志文件、备份数据和容器/虚拟机镜像等。

它一大特点就是轻量，使用简单，功能强大，支持各种平台，单个文件最大5TB，兼容 Amazon S3接口，提供了 Java、Python、GO等多版本SDK支持。

官网：https://min.io

中文：https://www.minio.org.cn/，http://docs.minio.org.cn/docs/

MinIO集群采用**去中心化共享架构**，每个结点是对等关系，通过Nginx可对MinIO进行负载均衡访问。

<img src="/assets/Minio入门.assets/image-20240924110840538.png" alt="image-20240924110840538" style="zoom:50%;" />

Minio使用**纠删码技术**来保护数据，它是一种恢复丢失和损坏数据的数学算法，它将数据分块冗余的分散存储在各各节点的磁盘上，所有的可用磁盘组成一个集合，上图由8块硬盘组成一个集合，当上传一个文件时会通过纠删码算法计算对文件进行分块存储，除了将文件本身分成4个数据块，还会生成4个校验块，数据块和校验块会分散的存储在这8块硬盘上。

使用纠删码的好处是即便丢失一半数量（N/2）的硬盘，仍然可以恢复数据。 比如上边集合中有4个以内的硬盘损害仍可保证数据恢复，不影响上传和下载，如果多于一半的硬盘坏了则无法恢复。

## 2. 创建bucket

通过控制台创建bucket

<img src="/assets/Minio入门.assets/image-20240924111002082.png" alt="image-20240924111002082" style="zoom:80%;" />

进入bucket可以设置访问权限

![image-20240924111115287](/assets/Minio入门.assets/image-20240924111115287.png)

## 3. API

### 3.1 上传文件API

1. Maven依赖如下：

   ```xml
   <dependency>
       <groupId>io.minio</groupId>
       <artifactId>minio</artifactId>
       <version>8.4.3</version>
   </dependency>
   <dependency>
       <groupId>com.squareup.okhttp3</groupId>
       <artifactId>okhttp</artifactId>
       <version>4.8.1</version>
   </dependency>
   ```

2. 在控制台创建一个名为`test`的bucket，并设置访问权限为`public`

3. 上传文件

   ```java
       static MinioClient minioClient =
               MinioClient.builder()
                       .endpoint("http://localhost:9000")
                       .credentials("minioadmin", "minioadmin")
                       .build();
   	@Test
       public void upload() {
           // 根据扩展名取出mimeType
           ContentInfo extensionMatch = ContentInfoUtil.findExtensionMatch(".md");
           String mimeType = MediaType.APPLICATION_OCTET_STREAM_VALUE;//通用mimeType，字节流
           if (extensionMatch != null) {
               mimeType = extensionMatch.getMimeType();
           }
           try {
               UploadObjectArgs testbucket = UploadObjectArgs.builder()
                       .bucket("test")
                       .object("Keith/LearningJava.md")
                       .filename("D:\\AAA_SecondDesktop\\A_Technology\\Java\\LearningJava.md")
                       .contentType(mimeType)//默认根据扩展名确定文件内容类型，也可以指定
                       .build();
               minioClient.uploadObject(testbucket);
               System.out.println("mimeType=" + mimeType);
               System.out.println("上传成功");
           } catch (Exception e) {
               e.printStackTrace();
               System.out.println("上传失败");
           }
       }
   ```

   代码段`static MinioClient minioClient =........ .bulid()`是在进行MinIO 客户端初始化，通过 `MinioClient.builder()` 方法构建一个 `MinioClient` 实例。

   调用`MinioClient`实例的`uploadObject()`方法，通过构建`UploadObjectArgs`对象进行文件上传。

4. 结果

   ![image-20240924112637349](/assets/Minio入门.assets/image-20240924112637349.png)



### 3.2 删除文件API

```java
    @Test
    public void delete() {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder().bucket("test").object("LearningJava.md").build());
            System.out.println("删除成功");
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("删除失败");
        }
    }
```



### 3.3 查询文件API

```java
//查询文件
@Test
public void getFile() {
    GetObjectArgs getObjectArgs = GetObjectArgs.builder().bucket("test").object("LearningJava.md").build();
    try(
        FilterInputStream inputStream = minioClient.getObject(getObjectArgs);
        FileOutputStream outputStream = new FileOutputStream(new File("D:\\develop\\upload\\1_2.mp4"));
     ) {
        IOUtils.copy(inputStream,outputStream);
     } catch (Exception e) {
        e.printStackTrace();
     }
}

```

抛出异常则说明文件不存在。

> 注意，这里不是普通的`try-catch`语法，而是`try-with-resources`，`try-with-resources`可以**自动资源管理**，使用 `try-with-resources` 语法，`inputStream` 和 `outputStream` 在 `try` 块结束时会自动关闭，无需手动处理。这大大减少了代码的复杂性和潜在的资源泄露风险。
>
> 在 **try-with-resources** 语法中，小括号里面的数据需要是实现了 `java.lang.AutoCloseable` 接口的对象。这包括所有实现了 `Closeable` 接口的类，如：
>
> 1. **输入输出流类**：
>    - `InputStream` 和其子类（如 `FileInputStream`、`BufferedInputStream`）
>    - `OutputStream` 和其子类（如 `FileOutputStream`、`BufferedOutputStream`）
>    - `Reader` 和其子类（如 `FileReader`、`BufferedReader`）
>    - `Writer` 和其子类（如 `FileWriter`、`BufferedWriter`）
> 2. **数据库连接类**：
>    - `Connection`、`Statement`、`ResultSet`（在 JDBC 中）
> 3. **其他资源**：
>    - `Socket`、`ServerSocket` 等网络相关的类。



## 4. 完整性校验

将Minio的文件下载下来，和原始文件比较md5的值，可以实现完整性校验

```java
//校验文件的完整性对文件的内容进行md5
FileInputStream fileInputStream1 = new FileInputStream(new File("D:\\develop\\upload\\1.mp4"));
String source_md5 = DigestUtils.md5Hex(fileInputStream1);
FileInputStream fileInputStream = new FileInputStream(new File("D:\\develop\\upload\\1a.mp4"));
String local_md5 = DigestUtils.md5Hex(fileInputStream);
if(source_md5.equals(local_md5)){
    System.out.println("下载成功");
}
```







