---
title: RestTemplate
date: 2024-07-29 16:34:00 +0800
categories: [Java, JavaWeb]
tags: [Java, HttpRequest,RestTemplate,ResponseEntity,SpringFramework]
---

## Demo

使用RestTemplate发起如下Http请求

![image-20240729163253769](/assets/RestTemplate.assets/image-20240729163253769.png)

> 没有请求体，参数是路径参数

使用RestTemplate发起请求代码如下，这里使用RestTemplate的exchange函数

```java
        ResponseEntity<List<ItemDTO>> response = restTemplate.exchange(
                "http://localhost:8081/items?ids={ids}",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<ItemDTO>>() {
                },
                Map.of("ids", CollUtils.join(itemIds, ","))
        );
```

![image-20240729163427137](/assets/RestTemplate.assets/image-20240729163427137.png)

- exchange函数有多个重载，这里用的是第5个。

> 参数具体而言
>
> **URL**: `"http://localhost:8081/items?ids={ids}"`
> 这是请求的 URL，其中 `{ids}` 是一个占位符，稍后会被替换为实际的 ID 列表。
>
> **HTTP 方法**: `HttpMethod.GET`
> 这是 HTTP 方法，表示这是一个 GET 请求。
>
> **请求实体**: `null`
> 这里没有请求体，因为 GET 请求通常不需要请求体。
>
> **响应类型**: `new ParameterizedTypeReference<List<ItemDTO>>() {}`
> 这个参数指定了响应的类型。由于 Java 泛型类型擦除的限制，不能直接使用 `List<ItemDTO>.class`，因此需要使用 `ParameterizedTypeReference` 来指定泛型类型。`ParameterizedTypeReference` 是 Spring 提供的一个抽象类，用于捕获和操作泛型类型的信息。
>
> **URI 参数**: `Map.of("ids", CollUtils.join(itemIds, ","))`
> 这是一个包含 URI 参数的映射。在这种情况下，将 `itemIds` 列表中的 ID 连接成一个用逗号分隔的字符串，然后将其作为 `ids` 参数的值。

- `ResponseEntity` 是 Spring Framework 提供的一个类，用于表示整个 HTTP 响应（包括状态码、头部信息和响应体）。在本例中，`ResponseEntity<List<ItemDTO>>` 表示一个包含 `List<ItemDTO>` 作为响应体的 HTTP 响应。`response` 对象包含以下信息：
  - **状态码**：可以通过 `response.getStatusCode()` 获取。
  - **头部信息**：可以通过 `response.getHeaders()` 获取。
  - **响应体**：可以通过 `response.getBody()` 获取，这里是一个 `List<ItemDTO>` 对象。

```java
        if (!response.getStatusCode().is2xxSuccessful()){
            return;
        }
        List<ItemDTO> items = response.getBody();
```







