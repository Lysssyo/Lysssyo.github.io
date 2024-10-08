---
title: 会话跟踪技术
date: 2024-10-08 13:11:00 +0800
categories: [Java,JavaWeb]
tags: [会话跟踪技术]
---

## 1. 基本概念

### 1.1 会话

在web开发当中，会话指的就是浏览器与服务器之间的一次连接。在**用户打开浏览器第一次访问服务器的时候，会话就建立了**，直到有任何一方断开连接，此时会话才结束。**在一次会话当中，是可以包含多次请求和响应的。**

### 1.2 会话跟踪

识别多次请求是否来自于同一浏览器的过程，称为会话跟踪。会话跟踪技术有三种——Cookie（客户端会话跟踪技术）、Session（服务端会话跟踪技术）以及令牌技术。

## 2. Cookie

Cookie是客户端会话跟踪技术，它是存储在客户端浏览器的。如果要使用cookie来跟踪会话，就可以在浏览器第一次向服务器发起请求时**在服务器端设置一个cookie**。

服务器端在给客户端在响应数据的时候，会**自动**的将cookie响应给客户端，客户端接收到响应回来的cookie后，会**自动**的将cookie的值存储在客户端本地。接下来在后续的每一次请求当中，都会将客户端本地所存储的cookie**自动**地携带到服务端。

> **为什么这一切都是自动化进行的？**
>
> 是因为cookie是 HTP 协议当中所支持的技术，而各大浏览器厂商都支持了这一标准。在 HTTP 协议官方给我们提供了一个响应头和请求头：
>
> - 响应头 Set-Cookie ：设置Cookie数据的
>
> - 请求头 Cookie：携带Cookie数据的

**测试**

```java
@Slf4j
@RestController
public class SessionController {

    //设置Cookie
    @GetMapping("/c1")
    public Result cookie1(HttpServletResponse response){
        response.addCookie(new Cookie("login_username","itheima")); //设置Cookie/响应Cookie
        return Result.success();
    }
	
    //获取Cookie
    @GetMapping("/c2")
    public Result cookie2(HttpServletRequest request){
        Cookie[] cookies = request.getCookies();
        for (Cookie cookie : cookies) {
            if(cookie.getName().equals("login_username")){
                System.out.println("login_username: "+cookie.getValue()); 
            }
        }
        return Result.success();
    }
}    
```

结果：

1. 第一次访问`localhost:8081/c1`：

   ![image-20241008005217075](/assets/会话跟踪技术.assets/image-20241008005217075.png)

   第一次访问`localhost:8081/c1`时，请求头的Cookie是默认值，响应头Set-Cookie设置了Cookie数据

   > 浏览器会将Cookie**自动**存储在浏览器端：
   >
   > ![image-20241008005759384](/assets/会话跟踪技术.assets/image-20241008005759384.png)

2. 第二次访问`localhost:8081/c1`：

   ![image-20241008005529142](/assets/会话跟踪技术.assets/image-20241008005529142.png)

   可以发现虽然浏览器没有手动进行任何配置或者其他操作，当浏览器向服务器发起请求的时候，请求头会自动携带Cookie

3. 访问`localhost:8081/c2`：

   控制台输出：

   ```
   login_username: itheima
   ```

   通过`HttpServletRequest request`可以成功获取cookie，

**优缺点**

- 优点：HTTP协议中支持的技术，Set-Cookie响应头的解析以及Cookie请求头数据的携带，都是**浏览器自动进行**的，是无需我们手动操作的）
- 缺点：
  - 移动端APP(Android、IOS)中无法使用Cookie
  - 不安全，用户可以自己禁用Cookie
  - Cookie不能跨域

> 区分跨域的维度：**协议、IP/协议、端口**
>
> 只要上述的三个维度有任何一个维度不同，那就是跨域操作
>
> 举例：
>
> `http://192.168.150.200/login.html` ----------> `https://192.168.150.200/login `  		[协议不同，跨域]
>
> `http://192.168.150.200/login.html` ----------> `http://192.168.150.100/login`    		[IP不同，跨域]
>
> `http://192.168.150.200/login.html` ----------> `http://192.168.150.200:8080/login`   [端口不同，跨域]
>
> `http://192.168.150.200/login.html `----------> `http://192.168.150.200/login`   		 [不跨域]   

## 3. Session

Session是**服务器端会话跟踪技术**，是存储在服务器端的。**Session就是基于Cookie实现的**。

当浏览器**首次请求服务器**时，服务器会**自动创建一个会话对象**（Session），并为每个会话对象生成一个唯一标识符，称为**SessionID**。随后，服务器在**首次响应浏览器请求时**，通过响应头中的`Set-Cookie`字段将SessionID传递给浏览器。浏览器会**自动识别**该字段，并将Cookie**自动存储**到本地。

在Java代码中，服务器可以通过`HttpSession`的`setAttribute`方法在session中存储数据，通过`getAttribute`方法从session中获取数据。

**测试**

```java
@Slf4j
@RestController
public class SessionController {

    @GetMapping("/s1")
    public Result session1(HttpSession session){
        log.info("HttpSession-s1: {}", session.hashCode());
        session.setAttribute("loginUser", "tom"); //往session中存储数据
        return Result.success();
    }

    @GetMapping("/s2")
    public Result session2(HttpServletRequest request){
        HttpSession session = request.getSession();
        log.info("HttpSession-s2: {}", session.hashCode());

        Object loginUser = session.getAttribute("loginUser"); //从session中获取数据
        log.info("loginUser: {}", loginUser);
        return Result.success(loginUser);
    }
}
```

1. 第一次访问`http://localhost:8081/user/s1`时：

   控制台输出：

   ```
   HttpSession-s1: 345631911
   ```

   > 说明服务器会自动为会话分配一个ID

   查看浏览器的网络请求与响应：

   ![image-20241008110009444](/assets/会话跟踪技术.assets/image-20241008110009444.png)

   可以发现服务器通过响应头的Set-Cookie将Session的ID通过Cookie传递给了浏览器

2. 再次访问`http://localhost:8081/user/s1`时：

   控制台输出：

   ```
   HttpSession-s1: 345631911
   ```

   查看浏览器的网络请求与响应：

   ![image-20241008110052163](/assets/会话跟踪技术.assets/image-20241008110052163.png)

   可以发现响应头没有Set-Cookie，说明只有第一次请求与响应才会通过Cookie设置SessionID

3. 访问`http://localhost:8081/user/s2`时：

   ![image-20241008110106796](/assets/会话跟踪技术.assets/image-20241008110106796.png)

   控制台输出：

   ```
   HttpSession-s2: 345631911
   loginUser: tom
   ```

## 4. JWT令牌

JWT全称：JSON Web Token (官网：https://jwt.io/)

- 定义了一种简洁的、自包含的格式，用于在通信双方以json数据格式安全的传输信息。由于数字签名的存在，这些信息是可靠的。

  > 简洁：是指jwt就是一个简单的字符串。可以在请求参数或者是请求头当中直接传递。
  >
  > 自包含：指的是jwt令牌，看似是一个随机的字符串，但是我们是可以根据自身的需求在jwt令牌中存储自定义的数据内容。如：可以直接在jwt令牌中存储用户的相关信息。
  >
  > 简单来讲，jwt就是将原始的json数据格式进行了安全的封装，这样就可以直接基于jwt在通信双方安全的进行信息传输了。

JWT的组成：JWT令牌由三个部分组成，三个部分之间使用英文的点来分割

- 第一部分：Header(/assets/头）， 记录令牌类型、签名算法等。 例如：{“alg”:”HS256”,”type”:”JWT”}

- 第二部分：Payload(有效载荷），携带一些自定义信息、默认信息等。 例如：{“id”:”1”,”username”:”Tom”}

- 第三部分：Signature(签名），防止Token被篡改、确保安全性。**将header、payload，并加入指定秘钥，通过指定签名算法计算而来**。

  > 第三部分签名是根据前两部分以及签名密钥得到的，签名的目的就是为了防jwt令牌被篡改，而正是因为jwt令牌最后一个部分数字签名的存在，所以整个jwt 令牌是非常安全可靠的。一旦jwt令牌当中任何一个部分、任何一个字符被篡改了，整个令牌在校验的时候都会失败，所以它是非常安全可靠的。

![image-20241008110403208](/assets/会话跟踪技术.assets/image-20241008110403208.png)

> JWT是如何将原始的JSON格式数据，转变为字符串的呢？
>
> 其实在生成JWT令牌时，**会对JSON格式的数据进行一次编码：进行base64编码**
>
> Base64：是一种基于64个可打印的字符来表示二进制数据的编码方式。既然能编码，那也就意味着也能解码。所使用的64个字符分别是A到Z、a到z、 0- 9，一个加号，一个斜杠，加起来就是64个字符。任何数据经过base64编码之后，最终就会通过这64个字符来表示。当然还有一个符号，那就是等号。等号它是一个补位的符号
>
> 需要注意的是Base64是编码方式，而不是加密方式。

JWT令牌最典型的应用场景就是登录认证：

1. 在浏览器发起请求来执行登录操作，此时会访问登录的接口，如果登录成功之后，我们需要生成一个jwt令牌，将生成的 jwt令牌返回给前端。
2. 前端拿到jwt令牌之后，会将jwt令牌存储起来。在后续的每一次请求中都会将jwt令牌携带到服务端。
3. 服务端统一拦截请求之后，先来判断一下这次请求有没有把令牌带过来，如果没有带过来，直接拒绝访问，如果带过来了，还要校验一下令牌是否是有效。如果有效，就直接放行进行请求的处理。

**与Cookie和Session不同的是：JWT令牌不会自动生成，客户端也不会自动存储JWT令牌，客户端发起请求的时候也不会自动带上JWT令牌，这些都需要手动配置**

**生成、校验JWT令牌：**

1. 引入依赖

   ```xml
           <!-- JWT依赖-->
           <dependency>
               <groupId>io.jsonwebtoken</groupId>
               <artifactId>jjwt</artifactId>
               <version>0.9.1</version>
           </dependency>
           <dependency>
               <groupId>javax.xml.bind</groupId>
               <artifactId>jaxb-api</artifactId>
               <version>2.3.1</version>
           </dependency>
   ```

   > `javax.xml.bind.DatatypeConverter` 类在 Java 9 及之后的版本中被移除。`io.jsonwebtoken` 使用了该类进行 Base64 编码和解码，但在 Java 11 或更高版本中，`javax.xml.bind` 不再默认包含在 JDK 中。所以，为了正常使用`jjwt`，需要手动添加 `javax.xml.bind` 依赖

2. 生成令牌

   ```java
       @Test
       public void genJwt() {
           Map<String, Object> claims = new HashMap<>();
           claims.put("id", 1);
           claims.put("username", "Tom");
   
           String jwt = Jwts.builder()
                   .setClaims(claims) //自定义内容(载荷)
                   .signWith(SignatureAlgorithm.HS256, "itheima") //签名算法、签名密钥
                   .setExpiration(new Date(System.currentTimeMillis() + 24 * 3600 * 1000)) //有效期
                   .compact();
   
           System.out.println(jwt);
       }
   ```

3. 校验令牌

   ```java
   @Test
   public void parseJwt(){
       String jwt = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6wfQ.fHi0Ub8npbyt71UqLXDdLyipptLgxBUg_mSuGJtXtBk";
       Claims claims = Jwts.parser()
           .setSigningKey("itheima") //指定签名密钥（必须保证和生成令牌时使用相同的签名密钥
           .parseClaimsJws(jwt)
           .getBody();
   
       System.out.println(claims);
   }
   ```

   输出：

   ```
   {id=1, exp=1728443611, username=Tom}
   ```

   