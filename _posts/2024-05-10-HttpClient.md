---
title: HttpClient
date: 2024-05-10 19:01:00 +0800
categories: [Java, HttpRequest]
tags: [Java, HttpRequest,apache,jsonResponse]
---
# Java：通过HttpClient发起网络请求

​		概要：本文介绍Java中如何通过HttpClient发起网络请求——GET请求以及POST请求，以及利用Gson解析响应的方法。

## HttpClient简介

​		HttpClient 是Apache Jakarta Common 下的子项目，可以用来提供高效的、最新的、功能丰富的支持 HTTP 协议的客户端编程工具包，并且它支持 HTTP 协议最新的版本和建议。

## HttpClient发起GET请求

​	使用之前需要导包：

```xml
<dependency>
    <groupId>org.apache.httpcomponents</groupId>
    <artifactId>httpclient</artifactId>
    <version>4.5.13</version>
</dependency>
```

> 使用maven

​		具体代码：

```java
public class GETDemo {
    private static String url ="http://localhost:80/test";//请求的路径
    
    public static void main(String[] args) {
        //创建一个默认配置的HttpClient实例。HttpClient是用来发送HTTP请求的
        HttpClient httpClient = HttpClients.createDefault();
        
        //创建一个HttpGet对象（请求对象），用于表示即将发送的HTTP GET请求，url是请求的目的地址
        HttpGet request=new HttpGet(url);       

        //发送HttpGet请求，并获取HttpResponse对象，该对象表示服务器响应
        HttpResponse response = httpClient.execute(request);

        //HttpResponse对象中获取响应实体，即服务器返回的内容
        HttpEntity responseEntity = response.getEntity();

        //将响应实体从JSON形式转换为字符串形式
        String jsonResponse = EntityUtils.toString(responseEntity);
    }
}
```

> 此时，jsonResponse里面存的就是响应结果，例如：
>
> ![image-20240418213257555](/assets/HttpClient.assets/image-20240418213257555.png)

## HttpClient发起POST请求

​		以带请求体，请求参数为JSON格式的为例：

```java
public class POSTDemo {
    private static String url ="https://example.cn/showArticle";
    public static void main(String[] args) {
        //创建一个默认配置的HttpClient实例。HttpClient是用来发送HTTP请求的
        HttpClient httpClient = HttpClients.createDefault();

        //创建一个HttpPost对象，用于表示即将发送的HTTP POST请求，url是请求的目的地址
        HttpPost request = new HttpPost(url);

        //设置请求头，指定发送的内容类型为JSON，即告诉服务器，发送的数据是JSON格式的。
        request.setHeader("Content-Type", "application/json");

        //设置请求体，下面是不导入第三方库的方法   
        //首先，利用map集合将JSON格式的请求体存入
        Map<String, Object> map = new HashMap<>();
        map.put("param1", "value1");
        map.put("param2", "value2");
        
        //利用StringBuilder将存了JSON格式的请求体改为字符串的形式
        StringBuilder stringBuilder = new StringBuilder();
        stringBuilder.append("{");
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            stringBuilder.append("\"").append(entry.getKey()).append("\":\"").append(entry.getValue()).append("\",");
        }
        stringBuilder.deleteCharAt(stringBuilder.length() - 1); 
        stringBuilder.append("}");
        String param = stringBuilder.toString();
        //请求体param为：{"param1": "value1","param2": "value2"}

        //创建一个StringEntity对象，它将作为HTTP请求的实体，即请求的内容。
        //这里将上面定义的JSON字符串作为实体内容，并指定字符编码为UTF-8
        StringEntity entity = new StringEntity(param, StandardCharsets.UTF_8);

        //将StringEntity对象设置为HttpPost请求的实体，即添加请求内容
        request.setEntity(entity);

        //发送HttpPost请求，并获取HttpResponse对象，该对象表示服务器响应
        HttpResponse response = httpClient.execute(request);

        //HttpResponse对象中获取响应实体，即服务器返回的内容
        HttpEntity responseEntity = response.getEntity();

        //将响应实体由JSON格式转换为字符串形式
        String jsonResponse = EntityUtils.toString(responseEntity);
    }
}
```

> 请求体设置方法二：
>
> ​		利用第三方库，将map转为JSON形式的字符串，不用自己手动用StringBuilder拼接
>
> ​		首先引入第三方库：
>
> ```xml
>         <!--这个库用于将map转为json形式的字符串-->
>         <dependency>
>             <groupId>com.google.code.gson</groupId>
>             <artifactId>gson</artifactId>
>             <version>2.8.9</version>
>         </dependency>
> ```
>
> 
>
> ```java
>         //请求体设置的方法二：
>         Map<String, String> map = new HashMap<>();
>         map.put("param1", "value1");
>         map.put("param2", "value2");
>         Gson gson = new Gson();
>         String param = gson.toJson(map);
> ```



## 利用Gson解析响应结果

​		以这个响应结果为例：

> 假设通过上例通过HttpClient发起POST请求`jsonResponse`接收到了以下内容

```json
{
    "code": 1,
    "msg": "success",
    "data": [
        {
            "url": "https://example1.com",           
            "tittle": "在外企工作是什么体验？高薪且不卷，愿意干到退休！",
            "hasImage": 1
        },
        {
            "url": "https://example2.com",
            "tittle": "广东清明假期连续暴雨+强对流天气！这些安全知识你必须知道→",
            "hasImage": 1
        },
        {
            "url": "https://example3.com",
            "tittle": "前方高能！有“猛兽”出现！",
            "hasImage": 0
        },
        {
            "url": "https://example4.com",
            "tittle": "西电访学 | 笃行致远，“码”到西电",
            "hasImage": 0
        }
    ]
}
```

​		要使用Gson解析这个JSON字符串，首先需要定义一个Java类，它的字段与JSON对象中的键对应。然后，可以使用Gson库将JSON字符串解析为这个类的实例。	

```java
public class ResponseData {
    private int code;
    private String msg;
    private List<Article> data;

    // 省略 getter 和 setter 方法

    public static class Article {
        private String url;
        private String title;
        private int hasImage;

        // 省略 getter 和 setter 方法
    }
}
```

​		解析`jsonResponse`：

```java
        Gson gson2 = new GsonBuilder().create();
        Type responseType = new TypeToken<ResponseData>() {
        }.getType();
		//创建一个TypeToken的匿名子类实例，并调用了它的getType()方法。
		//TypeToken是Gson库中的一个类，用于在运行时获取泛型类型的信息。
		//在这个例子中，我们想要解析的JSON数据对应于ResponseData类，这个类包含一个泛型列表List<Article>。由于Java的类型擦除，我们需要使用TypeToken来捕获这个泛型类型的信息。getType()方法返回了一个Type对象，这个对象代表了ResponseData类的泛型类型。
        ResponseData responseData = gson2.fromJson(jsonResponse, responseType);

        System.out.println("Code: " + responseData.getCode());
        System.out.println("Message: " + responseData.getMsg());
        for (ResponseData.Article article : responseData.getData()) {
            System.out.println("URL: " + article.getUrl());
            System.out.println("Title: " + article.getTitle());
            System.out.println("Has Image: " + article.getHasImage());
            System.out.println();
        }
```



