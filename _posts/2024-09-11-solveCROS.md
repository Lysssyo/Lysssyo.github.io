---
title: 解决跨域问题
date: 2024-09-11 15:16:00 +0800
categories: [Java, JavaWeb]
tags: [Java, JavaWeb]
---

前端请求后端时可能出错：

chrome浏览器报错如下：

```
Access to XMLHttpRequest at 'http://localhost:63110/system/dictionary/all' from origin 'http://localhost:8601' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

firefox浏览器报错如下：

```
已拦截跨源请求：同源策略禁止读取位于 http://localhost:63110/system/dictionary/all 的远程资源。（原因：CORS 头缺少 'Access-Control-Allow-Origin'）。状态码：200。
```

CORS全称是 cross origin resource share 表示跨域资源共享。

出这个提示的原因是基于浏览器的同源策略，去判断是否跨域请求，同源策略是浏览器的一种安全机制，从一个地址请求另一个地址，如果协议、主机、端口三者全部一致则不属于跨域，否则有一个不一致就是跨域请求。

比如：

从http://localhost:8601  到   http://localhost:8602  由于端口不同，是跨域。

从http://192.168.101.10:8601  到   http://192.168.101.11:8601  由于主机不同，是跨域。

从http://192.168.101.10:8601  到   [https://192.168.101.10:8601](https://192.168.101.11:8601)  由于协议不同，是跨域。

注意：服务器之间不存在跨域请求。

浏览器判断是跨域请求会在请求头上添加origin，表示这个请求来源哪里。

比如：

```
GET / HTTP/1.1
Origin: http://localhost:8601
```

服务器收到请求判断这个Origin是否允许跨域，如果允许则在响应头中说明允许该来源的跨域请求，如下：

```
Access-Control-Allow-Origin：http://localhost:8601
```

如果允许任何域名来源的跨域请求，则响应如下：

```
Access-Control-Allow-Origin：*
```

解决跨域的方法：

1、JSONP

通过script标签的src属性进行跨域请求，如果服务端要响应内容则首先读取请求参数callback的值，callback是一个回调函数的名称，服务端读取callback的值后将响应内容通过调用callback函数的方式告诉请求方。如下图：

<img src="/assets/跨域问题.assets/image-20240911151217889.png" alt="image-20240911151217889" style="zoom:67%;" />

2、添加响应头

服务端在响应头添加 Access-Control-Allow-Origin：*

3、通过nginx代理跨域

由于服务端之间没有跨域，浏览器先访问nginx，再由nginx去访问跨域地址。

<img src="/assets/跨域问题.assets/image-20240911151312404.png" alt="image-20240911151312404" style="zoom:67%;" />

1）浏览器先访问http://192.168.101.10:8601 nginx提供的地址，进入页面

2）此页面不能直接跨域访问http://www.baidu.com:8601，而是访问nginx的一个同源地址，比如：[http://192.168.101.10:8601/api](http://192.168.101.11:8601/api) ，通过[http://192.168.101.10:8601/api](http://192.168.101.11:8601/api) 的代理(Nginx)去访问http://www.baidu.com:8601。

这样就实现了跨域访问。

> 浏览器由http://192.168.101.10:8601 到[http://192.168.101.10:8601/api](http://192.168.101.11:8601/api) 没有跨域
>
> nginx到http://www.baidu.com:8601通过服务端通信，没有跨域。

基于方法二：

```java
 @Configuration
 public class GlobalCorsConfig {

  /**
   * 允许跨域调用的过滤器
   */
  @Bean
  public CorsFilter corsFilter() {
   CorsConfiguration config = new CorsConfiguration();
   //允许白名单域名进行跨域调用
   config.addAllowedOrigin("*");
   //允许跨越发送cookie
   config.setAllowCredentials(true);
   //放行全部原始头信息
   config.addAllowedHeader("*");
   //允许所有请求方法跨域调用
   config.addAllowedMethod("*");
   UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
   source.registerCorsConfiguration("/**", config);
   return new CorsFilter(source);
  }
 }
```

此配置类实现了跨域过虑器，在响应头添加Access-Control-Allow-Origin。
