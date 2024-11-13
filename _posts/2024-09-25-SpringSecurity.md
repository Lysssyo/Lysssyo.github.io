---
title: Spring Security实现登录认证与授权
date: 2024-09-25 20:50:00 +0800
categories: [Java,JavaWeb]
tags: [Spring Security,登录校验]
---

## 1. Spring Security简介



## 2. 工作原理

Spring Security所解决的问题就是**安全访问控制**，而安全访问控制功能其实就是对所有进入系统的请求进行拦截，校验每个请求是否能够访问它所期望的资源。

Spring Security对Web资源的保护是靠Filter实现的，当初始化Spring Security时，会创建一个名为`SpringSecurityFilterChain`的Servlet过滤器，类型为`org.springframework.security.web.FilterChainProxy`，它实现了`javax.servlet.Filter`，因此外部的请求会经过此类，下图是Spring Security过滤器链结构图：

<img src="/assets/SpringSecurity实现登录认证与授权.assets/image-20240925191947272.png" alt="image-20240925191947272" style="zoom:50%;" />

FilterChainProxy是一个代理，真正起作用的是FilterChainProxy中SecurityFilterChain所包含的各个Filter，同时这些Filter作为Bean被Spring管理，它们是Spring Security核心，各有各的职责，但他们并不直接处理用户的**认证**，也不直接处理用户的**授权**，而是把它们交给了**认证管理器（AuthenticationManager）**和**决策管理器（AccessDecisionManager）**进行处理。

![image-20240925192141293](/assets/SpringSecurity实现登录认证与授权.assets/image-20240925192141293.png)

Spring Security的执行流程如下：

<img src="/assets/SpringSecurity实现登录认证与授权.assets/image-20240925192252194.png" alt="image-20240925192252194" style="zoom: 67%;" />

1. 用户提交用户名、密码被SecurityFilterChain中的`UsernamePasswordAuthenticationFilter`过滤器获取到，封装为请求`Authentication`，通常情况下是UsernamePasswordAuthenticationToken这个实现类。
2. 然后过滤器将`Authentication`提交至认证管理器（AuthenticationManager）进行认证
3. 认证成功后，`AuthenticationManager`身份管理器返回一个被填充满了信息的（包括上面提到的权限信息，身份信息，细节信息，但密码通常会被移除）`Authentication`实例。（图中Step9）
4. `SecurityContextHolder`安全上下文容器将第3步填充了信息的`Authentication`，通过SecurityContextHolder.getContext().setAuthentication(…)方法，设置到其中。

可以看出AuthenticationManager接口（认证管理器）是认证相关的核心接口，也是发起认证的出发点，它的实现类为ProviderManager。而Spring Security支持多种认证方式，因此ProviderManager维护着一个`List<AuthenticationProvider>`列表，存放多种认证方式，最终实际的认证工作是由AuthenticationProvider完成的。

web表单的对应的AuthenticationProvider实现类为DaoAuthenticationProvider，它的内部又维护着一个UserDetailsService负责UserDetails的获取。最终AuthenticationProvider将UserDetails填充至Authentication。

## 3. OAuth2



## 4. 实现用户认证（密码模式）

### 4.1 基础Demo

业务背景：用户在前端输入用户名和密码，后端校验用户名密码，用户名存在且密码正确，生成一个jwt令牌。

1. 引入依赖

   ```xml
   <!--认证相关-->
   <dependency>
       <groupId>org.springframework.cloud</groupId>
       <artifactId>spring-cloud-starter-security</artifactId>
   </dependency>
   <dependency>
       <groupId>org.springframework.cloud</groupId>
       <artifactId>spring-cloud-starter-oauth2</artifactId>
   </dependency>
   ```

2. 基础配置

   **配置文件：**只用配置database

   ```yaml
   server:
     servlet:
       context-path: /auth
     port: 63070
   spring:
     datasource:
       driver-class-name: com.mysql.cj.jdbc.Driver
       url: jdbc:mysql://localhost:3306/xcplus_users?serverTimezone=UTC&userUnicode=true&useSSL=false&
       username: root
       password: 123
   ```

   **`AuthorizationServer`类：**

   ```java
   @Configuration
   @EnableAuthorizationServer
   public class AuthorizationServer extends AuthorizationServerConfigurerAdapter {
   
       @Resource(name = "authorizationServerTokenServicesCustom")
       private AuthorizationServerTokenServices authorizationServerTokenServices;
   
       @Autowired
       private AuthenticationManager authenticationManager;
   
       // 客户端详情服务
       @Override
       public void configure(ClientDetailsServiceConfigurer clients) throws Exception {
           clients.inMemory()// 使用in-memory存储
                   .withClient("XcWebApp")// client_id
                   //.secret("XcWebApp")//客户端密钥
                   .secret(new BCryptPasswordEncoder().encode("XcWebApp"))//客户端密钥
                   .resourceIds("xuecheng-plus") //资源服务标识
                   .authorizedGrantTypes("authorization_code", "password", "client_credentials",
                                         "implicit", "refresh_token")
               // 该client允许的授权类型authorization_code,password,refresh_token,implicit,client_credentials
                   .scopes("all")// 允许的授权范围
                   .autoApprove(false)//false跳转到授权页面
                   //客户端接收授权码的重定向地址
                   .redirectUris("http://www.51xuecheng.cn")
           ;
       }
   
       // 令牌端点的访问配置
       @Override
       public void configure(AuthorizationServerEndpointsConfigurer endpoints) {
           endpoints
                   .authenticationManager(authenticationManager)//认证管理器
                   .tokenServices(authorizationServerTokenServices)//令牌管理服务
                   .allowedTokenEndpointRequestMethods(HttpMethod.POST);
       }
   
       //令牌端点的安全配置
       @Override
       public void configure(AuthorizationServerSecurityConfigurer security) {
           security
                   .tokenKeyAccess("permitAll()")                    //oauth/token_key是公开
                   .checkTokenAccess("permitAll()")                  //oauth/check_token公开
                   .allowFormAuthenticationForClients();             //表单认证（申请令牌）
       }
   }
   ```

   上面的`AuthorizationServer`类中的`configure(ClientDetailsServiceConfigurer clients)`配置了请求登录的客户端需要满足的要求，例如这里，客户端登录时要携带这些参数：

   ```
   POST {{auth_host}}/auth/oauth/token?client_id=XcWebApp&client_secret=XcWebApp&grant_type=password&username=t1&password=111111
   ```

   > `/auth`是由配置文件中的`server.servlet.context-path`决定的

   **`TokenConfig`类：**

   ```java
   @Configuration
   public class TokenConfig {
   
       private final String SIGNING_KEY = "mq123";
   
       @Autowired
       TokenStore tokenStore;
   
       @Autowired
       private JwtAccessTokenConverter accessTokenConverter;
   
       @Bean
       public TokenStore tokenStore() {
           return new JwtTokenStore(accessTokenConverter());
       }
   
       @Bean
       public JwtAccessTokenConverter accessTokenConverter() {
           JwtAccessTokenConverter converter = new JwtAccessTokenConverter();
           converter.setSigningKey(SIGNING_KEY);
           return converter;
       }
   
       // 令牌管理服务
       @Bean(name = "authorizationServerTokenServicesCustom")
       public AuthorizationServerTokenServices tokenService() {
           DefaultTokenServices service = new DefaultTokenServices();
           service.setSupportRefreshToken(true);//支持刷新令牌
           service.setTokenStore(tokenStore);//令牌存储策略
   
           TokenEnhancerChain tokenEnhancerChain = new TokenEnhancerChain();
           tokenEnhancerChain.setTokenEnhancers(Arrays.asList(accessTokenConverter));
           service.setTokenEnhancer(tokenEnhancerChain);
   
           service.setAccessTokenValiditySeconds(7200); // 令牌默认有效期2小时
           service.setRefreshTokenValiditySeconds(259200); // 刷新令牌默认有效期3天
           return service;
       }
   }
   ```

   这个类用于设置令牌管理服务，启用jwt令牌校验，在这里jwt密钥是`mq123`

   **`WebSecurityConfig`类：**

   ```java
   @EnableWebSecurity
   @EnableGlobalMethodSecurity(securedEnabled = true, prePostEnabled = true)
   public class WebSecurityConfig extends WebSecurityConfigurerAdapter {
   
       @Bean
       public AuthenticationManager authenticationManagerBean() throws Exception {
           return super.authenticationManagerBean();
       }
   
       @Bean
       public PasswordEncoder passwordEncoder() {
           //密码为明文方式
           //return NoOpPasswordEncoder.getInstance();
           return new BCryptPasswordEncoder(); //将用户输入的密码编码为BCrypt格式与数据库中的密码进行比对
       }
   
       //配置安全拦截机制
       @Override
       protected void configure(HttpSecurity http) throws Exception {
           http
                   .authorizeRequests()
                   .antMatchers("/r/**").authenticated()//访问/r开始的请求需要认证通过
                   .anyRequest().permitAll()//其它请求全部放行
                   .and()
                   .formLogin().successForwardUrl("/login-success");//登录成功跳转到/login-success
       }
   
   }
   ```

   - `AuthenticationManager authenticationManagerBean()`方法向容器注入认证相关的核心接口——AuthenticationManager接口（认证管理器）

   - `PasswordEncoder passwordEncoder()`方法设置了密码格式器，因为数据库的密码编码为了BCrypt格式，所以，在校验用户每次登录输入的密码时，都要转为BCrypt格式与数据库对应用户的密码进行对比

     > 数据库：
     >
     > ![image-20240925202728435](/assets/SpringSecurity实现登录认证与授权.assets/image-20240925202728435.png)

   - `void configure(HttpSecurity http)`方法设置了只拦截`/r`开头的请求，其他路径的请求不拦截，意思是用户不一定要进行登录认证，但是，不登录就拿不到jwt令牌，没有jwt令牌就无法访问部分服务。

3. 重要配置

   用户提交账号和密码由`DaoAuthenticationProvider`调用`UserDetailsService`的`loadUserByUsername()`方法获取`UserDetails`（用户信息）。

   > DaoAuthenticationProvider的源代码如下：
   >
   > <img src="/assets/SpringSecurity实现登录认证与授权.assets/image-20240925193513898.png" alt="image-20240925193513898" style="zoom: 50%;" />

   UserDetailsService是一个接口，如下：

   ```
   package org.springframework.security.core.userdetails;
   
   public interface UserDetailsService {
       UserDetails loadUserByUsername(String var1) throws UsernameNotFoundException;
   }
   ```

   UserDetails是用户信息接口：

   ```java
   public interface UserDetails extends Serializable {
       Collection<? extends GrantedAuthority> getAuthorities();
   
       String getPassword();
   
       String getUsername();
   
       boolean isAccountNonExpired();
   
       boolean isAccountNonLocked();
   
       boolean isCredentialsNonExpired();
   
       boolean isEnabled();
   }
   ```

   我们只要实现`UserDetailsService`接口，重写接口的`loadUserByUsername`方法，查询数据库得到用户信息封装到`UserDetails `，框架会调用重写的`loadUserByUsername()`方法拿到用户信息，框架中的`DaoAuthenticationProvider`会进行密码校验

   实现如下：

   ```java
   @Service
   public class UserServiceImpl implements UserDetailsService {
   
       @Autowired
       XcUserMapper xcUserMapper;
   
       /**
        * @description 根据账号查询用户信息
        * @param s  用户名
        * @return org.springframework.security.core.userdetails.UserDetails
        * @author Keith He
        * @date 2024/9/25 19:40
       */
       @Override
       public UserDetails loadUserByUsername(String s) throws UsernameNotFoundException {
   
           XcUser user = xcUserMapper
               .selectOne(new LambdaQueryWrapper<XcUser>().eq(XcUser::getUsername, s));
           //查询数据库，将数据库中的信息映射为XcUser对象，其中包含username，password等        
   
           if(user==null){
               //返回空表示用户不存在
               return null;
           }
           
           //取出数据库存储的正确密码
           String password  =user.getPassword();
           //用户权限,如果不加报Cannot pass a null GrantedAuthority collection
           String[] authorities= {"test"};
           
           //创建UserDetails对象,权限信息待实现授权功能时再向UserDetail中加入
           UserDetails userDetails = User
               .withUsername(user.getUsername())
               .password(password)
               .authorities(authorities)
               .build();
   
           return userDetails;
       }
   }
   ```

4. 测试：

   ```
   ### 密码模式
   POST {{auth_host}}/auth/oauth/token?client_id=XcWebApp&client_secret=XcWebApp&grant_type=password&username=t1&password=111111
   ```

   结果：

   ```
   POST http://localhost:63070/auth/oauth/token?client_id=XcWebApp&client_secret=XcWebApp&grant_type=password&username=t1&password=111111
   
   HTTP/1.1 200 
   Cache-Control: no-store
   Pragma: no-cache
   X-Content-Type-Options: nosniff
   X-XSS-Protection: 1; mode=block
   X-Frame-Options: DENY
   Content-Type: application/json;charset=UTF-8
   Transfer-Encoding: chunked
   Date: Wed, 25 Sep 2024 12:23:12 GMT
   Keep-Alive: timeout=60
   Connection: keep-alive
   
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsieHVlY2hlbmctcGx1cyJdLCJ1c2VyX25hbWUiOiJ7XCJjb21wYW55SWRcIjpcIjEyMzIxNDE0MjVcIixcImNyZWF0ZVRpbWVcIjpcIjIwMjItMDktMjhUMDg6MzI6MDNcIixcImlkXCI6XCI1MlwiLFwibmFtZVwiOlwiTeiAgeW4iFwiLFwicGFzc3dvcmRcIjpcIiQyYSQxMCQwcHQ3V2xmVGJuUERUY1d0cC8uMk11NUNUWHZvaG5OUWhSNjI4cXE0Um9LU2MwZEdBZEVnbVwiLFwic2V4XCI6XCIxXCIsXCJzdGF0dXNcIjpcIlwiLFwidXNlcm5hbWVcIjpcInQxXCIsXCJ1dHlwZVwiOlwiMTAxMDAyXCJ9Iiwic2NvcGUiOlsiYWxsIl0sImV4cCI6MTcyNzI3NDE5MiwiYXV0aG9yaXRpZXMiOlsidGVzdCJdLCJqdGkiOiIzMmM1MmViNi04YWJjLTQ0NDctYmM5Yy04MzM2MDk0YTRhNmQiLCJjbGllbnRfaWQiOiJYY1dlYkFwcCJ9.xgAEZZKip65YD85_JdG1Ul6P7ZqsZ-EGnUgFwnnXhlM",
     "token_type": "bearer",
     "refresh_token": "eyJhbGc....vAY8",
     "expires_in": 7199,
     "scope": "all",
     "jti": "32c52eb6-8abc-4447-bc9c-8336094a4a6d"
   }
   
   Response code: 200; Time: 217ms; Content length: 1471 bytes
   ```

   成功拿到jwt令牌。

   > 1. access_token：生成的jwt令牌，用于访问资源使用。
   > 2. token_type：bearer是在RFC6750中定义的一种token类型，在携带jwt访问资源时需要在head中加入bearer jwt令牌内容
   > 3. refresh_token：当jwt令牌快过期时使用刷新令牌可以再次生成jwt令牌。
   > 4. expires_in：过期时间（秒）
   > 5. scope：令牌的权限范围，服务端可以根据令牌的权限范围去对令牌授权。
   > 6. jti：令牌的唯一标识。

### 4.2 为jwt令牌添加更多信息

解析刚刚得到的jwt令牌：

```
###校验jwt令牌
POST {{auth_host}}/auth/oauth/check_token?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsieHVlY2hlbmctcGx1c3NzcyJdLCJ1c2VyX25hbWUiOiJ7XCJjb21wYW55SWRcIjpcIjEyMzIxNDE0MjVcIixcImNyZWF0ZVRpbWVcIjpcIjIwMjItMDktMjhUMDg6MzI6MDNcIixcImlkXCI6XCI1MlwiLFwibmFtZVwiOlwiTeiAgeW4iFwiLFwicGFzc3dvcmRcIjpcIiQyYSQxMCQwcHQ3V2xmVGJuUERUY1d0cC8uMk11NUNUWHZvaG5OUWhSNjI4cXE0Um9LU2MwZEdBZEVnbVwiLFwic2V4XCI6XCIxXCIsXCJzdGF0dXNcIjpcIlwiLFwidXNlcm5hbWVcIjpcInQxXCIsXCJ1dHlwZVwiOlwiMTAxMDAyXCJ9Iiwic2NvcGUiOlsiYWxsIl0sImV4cCI6MTcyNzI3NTQzNywiYXV0aG9yaXRpZXMiOlsidGVzdCJdLCJqdGkiOiJjYWI4NWE4Zi0xNmQxLTQ3MjAtOGJmYi03OTJiN2E1YTAwZjUiLCJjbGllbnRfaWQiOiJYY1dlYkFwcCJ9.cFYMvhLaJEbuBJ20TwC0KC-NQZnckqpFfHsYmd0HqLg
```

结果：

```
HTTP/1.1 200 
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Cache-Control: no-cache, no-store, max-age=0, must-revalidate
Pragma: no-cache
Expires: 0
X-Frame-Options: DENY
Content-Type: application/json
Transfer-Encoding: chunked
Date: Wed, 25 Sep 2024 12:31:27 GMT
Keep-Alive: timeout=60
Connection: keep-alive

{
  "aud": [
    "xuecheng-plus"
  ],
  "user_name": "t1",
  "scope": [
    "all"
  ],
  "active": true,
  "exp": 1727274668,
  "authorities": [
    "test"
  ],
  "jti": "40883216-65d9-4af0-b144-e786976a1017",
  "client_id": "XcWebApp"
}
```

> ```json
> "aud": [
>  "xuecheng-plus"
> ]
> ```
>
> 来源自`AuthorizationServer`的`configure(ClientDetailsServiceConfigurer clients)`方法配置的资源列表

注意到jwt令牌中的`payload`（有效载荷）太少了，只有用户名`t1`。进一步观察到，`payload`是在这里设置的：

```java
	//UserServiceImpl
	@Override
    public UserDetails loadUserByUsername(String s) throws UsernameNotFoundException {

        //...
        
        //创建UserDetails对象,权限信息待实现授权功能时再向UserDetail中加入
        UserDetails userDetails = User
            .withUsername(user.getUsername())
            .password(password)
            .authorities(authorities)
            .build();

        return userDetails;
    }
```

`UserDetails`中的`withUsername`就是在设置jwt令牌的载荷，我们可以把需要的数据封装为JSON，用的时候再把JSON转回对象就可以实现jwt令牌传递更多数据。

修改UserServiceImpl如下：

```java
@Service
public class UserServiceImpl implements UserDetailsService {

    @Autowired
    XcUserMapper xcUserMapper;

    @Override
    public UserDetails loadUserByUsername(String s) throws UsernameNotFoundException {

        XcUser user = xcUserMapper.selectOne(new LambdaQueryWrapper<XcUser>().eq(XcUser::getUsername, s));
        if(user==null){
            //返回空表示用户不存在
            return null;
        }

        //取出数据库存储的正确密码
        String password  =user.getPassword();
        //用户权限,如果不加报Cannot pass a null GrantedAuthority collection
        String[] authorities = {"p1"};
       //为了安全在令牌中不放密码
        user.setPassword(null);
        
        //将user对象转json
        String userString = JSON.toJSONString(user);
        //创建UserDetails对象
        UserDetails userDetails = User
            .withUsername(userString)
            .password(password)
            .authorities(authorities)
            .build();

        return userDetails;
    }
}
```

测试：

再次登录获取jwt令牌，解析jwt令牌，结果如下：

```json
{
  "aud": [
    "xuecheng-plus"
  ],
  "user_name": "{\"companyId\":\"1232141425\",\"createTime\":\"2022-09-28T08:32:03\",\"id\":\"52\",\"name\":\"M老师\",\"password\":\"$2a$10$0pt7WlfTbnPDTcWtp/.2Mu5CTXvohnNQhR628qq4RoKSc0dGAdEgm\",\"sex\":\"1\",\"status\":\"\",\"username\":\"t1\",\"utype\":\"101002\"}",
  "scope": [
    "all"
  ],
  "active": true,
  "exp": 1727275437,
  "authorities": [
    "test"
  ],
  "jti": "cab85a8f-16d1-4720-8bfb-792b7a5a00f5",
  "client_id": "XcWebApp"
}
```

## 5. 携带jwt令牌访问资源

### 5.1 jwt令牌认证

业务背景：

1. **资源文件所在的微服务引入SpringSecurity依赖**

   ```xml
   <!--认证相关-->
   <dependency>
       <groupId>org.springframework.cloud</groupId>
       <artifactId>spring-cloud-starter-security</artifactId>
   </dependency>
   <dependency>
       <groupId>org.springframework.cloud</groupId>
       <artifactId>spring-cloud-starter-oauth2</artifactId>
   </dependency>
   ```

2. **基础配置**

   **`ResouceServerConfig`类：**

   ```java
   @Configuration
   @EnableResourceServer
   @EnableGlobalMethodSecurity(securedEnabled = true, prePostEnabled = true)
   public class ResouceServerConfig extends ResourceServerConfigurerAdapter {
   
       //资源服务标识
       public static final String RESOURCE_ID = "xuecheng-plus";
   
       @Autowired
       TokenStore tokenStore;
   
       @Override
       public void configure(ResourceServerSecurityConfigurer resources) {
           resources.resourceId(RESOURCE_ID)//资源 id
                   .tokenStore(tokenStore)
                   .stateless(true);
       }
   
       @Override
       public void configure(HttpSecurity http) throws Exception {
           http.csrf().disable()
                   .authorizeRequests()
                   .antMatchers("/r/**", "/course/**").authenticated()//所有/r/**以及course/**的请求必须认证通过
                   .anyRequest().permitAll() //其他的可以直接访问
           ;
       }
   
   }
   ```

   **`TokenConfig`类：**

   ```java
   @Configuration
   public class TokenConfig {
   
       String SIGNING_KEY = "mq123";//签名密钥
   
   
       /**
        * TokenStore 是 OAuth2 框架用来存储和读取访问令牌的组件。
        * 这里你使用的是 JwtTokenStore，它意味着使用 JWT 格式的令牌，而不是普通的令牌存储（如数据库或内存）。
        */
       @Bean
       public TokenStore tokenStore() {
           return new JwtTokenStore(accessTokenConverter());
       }
   
       /**
        * 这个方法返回一个 JwtAccessTokenConverter 实例，用于在 JWT 和 OAuth2 访问令牌之间进行转换。
        * JwtAccessTokenConverter 是一个帮助类，它将 JWT 作为 OAuth2 令牌的一部分。它的主要职责是帮助对 JWT 进行编码和解码操作。
        * 在这里，它通过 setSigningKey(SIGNING_KEY) 设置了签名密钥，这样 JWT 令牌会使用这个密钥进行签名。只有知道这个密钥的服务器才能对其进行验证。
        */
       @Bean
       public JwtAccessTokenConverter accessTokenConverter() {
           JwtAccessTokenConverter converter = new JwtAccessTokenConverter();
           converter.setSigningKey(SIGNING_KEY);
           return converter;
       }
   
   }
   ```

3. **测试：**

   ```
   ### 查询课程信息
   GET {{content_host}}/content/course/120
   Authorization: Bearer eyJhbGciOiJIUzI1NiI....
   ```

   结果：

   成功查询

### 5.2 获取jwt令牌中的数据

在《4. 实现用户认证》中，我们通过`userDetail`向jwt令牌中封装了更多的数据：

```java
@Service
public class UserServiceImpl implements UserDetailsService {

    @Autowired
    XcUserMapper xcUserMapper;

    @Override
    public UserDetails loadUserByUsername(String s) throws UsernameNotFoundException {

        XcUser user = xcUserMapper.selectOne(new LambdaQueryWrapper<XcUser>()
                                             .eq(XcUser::getUsername, s));
        if(user==null){
            //返回空表示用户不存在
            return null;
        }

        //取出数据库存储的正确密码
        String password  =user.getPassword();
        //用户权限,如果不加报Cannot pass a null GrantedAuthority collection
        String[] authorities = {"p1"};
       //为了安全在令牌中不放密码
        user.setPassword(null);
        
        //将user对象转json
        String userString = JSON.toJSONString(user);
        //创建UserDetails对象
        UserDetails userDetails = User
            .withUsername(userString)
            .password(password)
            .authorities(authorities)
            .build();

        return userDetails;
    }
}
```

我们可以在资源微服务中，把这些数据取出来：

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

        private static final long serialVersionUID = 1L;

        private String id;

        private String username;

        private String password;

        private String salt;

        private String name;
        
        private String nickname;
        
        private String wxUnionid;
        
        private String companyId;
        /**
         * 头像
         */
        private String userpic;

        private String utype;

        private LocalDateTime birthday;

        private String sex;

        private String email;

        private String cellphone;

        private String qq;

        /**
         * 用户状态
         */
        private String status;

        private LocalDateTime createTime;

        private LocalDateTime updateTime;

    }
}
```

<img src="/assets/SpringSecurity实现登录认证与授权.assets/image-20240926143546714.png" alt="image-20240926143546714" style="zoom: 80%;" />

需要的时候调用`SecurityUtil`的`getUser`方法即可

## 6. 网关认证

所有访问微服务的请求都要经过网关，在网关进行用户身份的认证可以将很多非法的请求拦截到微服务以外，这叫做网关认证。

<img src="/assets/SpringSecurity实现登录认证与授权.assets/image-20240926145227324.png" alt="image-20240926145227324" style="zoom:67%;" />

网关的职责：

1. 网站白名单维护

   > 针对不用认证的URL全部放行。

2. 校验jwt的合法性

   除了白名单剩下的就是需要认证的请求，网关需要验证jwt的合法性，jwt合法则说明用户身份合法，否则说明身份不合法则拒绝继续访问。

**Attention：**网关校验后，jwt依然会被传递给微服务

**具体步骤：**

1. 引入依赖

   ```xml
   <dependency>
       <groupId>org.springframework.cloud</groupId>
       <artifactId>spring-cloud-starter-security</artifactId>
   </dependency>
   <dependency>
       <groupId>org.springframework.cloud</groupId>
       <artifactId>spring-cloud-starter-oauth2</artifactId>
   </dependency>
   <dependency>
       <groupId>org.projectlombok</groupId>
       <artifactId>lombok</artifactId>
   </dependency>
   <dependency>
       <groupId>com.alibaba</groupId>
       <artifactId>fastjson</artifactId>
   </dependency>
   ```

2. 基础配置

   **`GatewayAuthFilter`类：**

   ```java
   @Component
   @Slf4j
   public class GatewayAuthFilter implements GlobalFilter, Ordered {
   
       //白名单
       private static List<String> whitelist = null;
   
       static {
           //加载白名单
           try (
                   InputStream resourceAsStream = GatewayAuthFilter.class.getResourceAsStream("/security-whitelist.properties");
           ) {
               Properties properties = new Properties();
               properties.load(resourceAsStream);
               Set<String> strings = properties.stringPropertyNames();
               whitelist = new ArrayList<>(strings);
   
           } catch (Exception e) {
               log.error("加载/security-whitelist.properties出错:{}", e.getMessage());
               e.printStackTrace();
           }
   
   
       }
   
       @Autowired
       private TokenStore tokenStore;
   
   
       @Override
       public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
           String requestUrl = exchange.getRequest().getPath().value();
           AntPathMatcher pathMatcher = new AntPathMatcher();
           // 白名单放行
           for (String url : whitelist) {
               if (pathMatcher.match(url, requestUrl)) {
                   return chain.filter(exchange);
               }
           }
   
           // 检查token是否存在
           String token = getToken(exchange);
           if (StringUtils.isBlank(token)) {
               return buildReturnMono("没有认证", exchange);
           }
           // 判断是否是有效的token
           OAuth2AccessToken oAuth2AccessToken;
           try {
               oAuth2AccessToken = tokenStore.readAccessToken(token);
   
               boolean expired = oAuth2AccessToken.isExpired();
               if (expired) {
                   return buildReturnMono("认证令牌已过期", exchange);
               }
               return chain.filter(exchange);
           } catch (InvalidTokenException e) {
               log.info("认证令牌无效: {}", token);
               return buildReturnMono("认证令牌无效", exchange);
           }
   
       }
   
       /**
        * 获取token
        */
       private String getToken(ServerWebExchange exchange) {
           String tokenStr = exchange.getRequest().getHeaders().getFirst("Authorization");
           if (StringUtils.isBlank(tokenStr)) {
               return null;
           }
           String token = tokenStr.split(" ")[1];
           if (StringUtils.isBlank(token)) {
               return null;
           }
           return token;
       }
   
   
       private Mono<Void> buildReturnMono(String error, ServerWebExchange exchange) {
           ServerHttpResponse response = exchange.getResponse();
           String jsonString = JSON.toJSONString(new RestErrorResponse(error));
           byte[] bits = jsonString.getBytes(StandardCharsets.UTF_8);
           DataBuffer buffer = response.bufferFactory().wrap(bits);
           response.setStatusCode(HttpStatus.UNAUTHORIZED);
           response.getHeaders().add("Content-Type", "application/json;charset=UTF-8");
           return response.writeWith(Mono.just(buffer));
       }
   
   
       @Override
       public int getOrder() {
           return 0;
       }
   }
   ```

   **`SecurityConfig`类：**

   ```java
   @EnableWebFluxSecurity
   @Configuration
   public class SecurityConfig {
   
       //安全拦截配置
       @Bean
       public SecurityWebFilterChain webFluxSecurityFilterChain(ServerHttpSecurity http) {
   
           return http.authorizeExchange()
                   .pathMatchers("/**").permitAll()
                   .anyExchange().authenticated()
                   .and().csrf().disable().build();
       }
       
   }
   ```

   **`TokenConfig`类：**

   ```java
   @Configuration
   public class TokenConfig {
   
       String SIGNING_KEY = "mq123"; //jwt密钥
   
   
       @Bean
       public TokenStore tokenStore() {
           return new JwtTokenStore(accessTokenConverter());
       }
   
       @Bean
       public JwtAccessTokenConverter accessTokenConverter() {
           JwtAccessTokenConverter converter = new JwtAccessTokenConverter();
           converter.setSigningKey(SIGNING_KEY);
           return converter;
       }
   
   
   }
   ```

   **`RestErrorResponse`类：**

   ```java
   public class RestErrorResponse implements Serializable {
   
       private String errMessage;
   
       public RestErrorResponse(String errMessage) {
           this.errMessage = errMessage;
       }
   
       public String getErrMessage() {
           return errMessage;
       }
   
       public void setErrMessage(String errMessage) {
           this.errMessage = errMessage;
       }
   }
   ```

   

## 7. 统一认证

### 7.1 准备

通过`oauth/token?client_id=#{}&client_secret=#{}&grant_type=password&username=#{}&password=#{}`进行密码模式认证时，如果username只传递数据库里面的username，那这个接口只能进行`用户名+密码`的校验模式，但是，如果向这个属性传递一个类（以json的形式），例如`AuthParamsDto`，这个类封装许多认证方法，那么这个接口就可以实现多种认证方法。

**具体步骤：**

1. 创建一个DTO类表示认证的参数：

   ```java
   @Data
   public class AuthParamsDto {
   
       private String username; //用户名
       private String password; //域  用于扩展
       private String cellphone;//手机号
       private String checkcode;//验证码
       private String checkcodekey;//验证码key
       private String authType; // 认证的类型   password:用户名密码模式类型    sms:短信模式类型
       private Map<String, Object> payload = new HashMap<>();//附加数据，作为扩展，不同认证类型可拥有不同的附加数据。如认证类型为短信时包含smsKey : sms:3d21042d054548b08477142bbca95cfa; 所有情况下都包含clientId
   
   }
   ```

2. 修改`loadUserByUsername()`方法

   ```java
   @Slf4j
   @Service
   public class UserServiceImpl implements UserDetailsService {
   
       @Autowired
       XcUserMapper xcUserMapper;
   
       @Override
       public UserDetails loadUserByUsername(String s) throws UsernameNotFoundException {
   
           AuthParamsDto authParamsDto = null;
           try {
               //将认证参数转为AuthParamsDto类型
               authParamsDto = JSON.parseObject(s, AuthParamsDto.class);
           } catch (Exception e) {
               log.info("认证请求不符合项目要求:{}",s);
               throw new RuntimeException("认证请求数据格式不对");
           }
           //账号
           String username = authParamsDto.getUsername();
           XcUser user = xcUserMapper
          				 .selectOne(new LambdaQueryWrapper<XcUser>()
          				 .eq(XcUser::getUsername, username));
           if(user==null){
               //返回空表示用户不存在
               return null;
           }
           //取出数据库存储的正确密码
           String password  =user.getPassword();
           //用户权限,如果不加报Cannot pass a null GrantedAuthority collection
           String[] authorities = {"p1"};
           //将user对象转json
           String userString = JSON.toJSONString(user);
           //创建UserDetails对象
           UserDetails userDetails = User
               .withUsername(userString)
               .password(password)
               .authorities(authorities)
               .build();
   
           return userDetails;
       }
   }
   ```

   > 修改后请求如下
   >
   > ```
   > ################扩展认证请求参数后######################
   > ###密码模式
   > POST {{auth_host}}/auth/oauth/token?client_id=XcWebApp&client_secret=XcWebApp&grant_type=password&username={"username":"stu1","authType":"password","password":"111111"}
   > ```

3. 如图所示。

   ![image-20240926151127985](/assets/SpringSecurity实现登录认证与授权.assets/image-20240926151127985.png)

   `UserDetailsService`会把`UserDetail`传递给`DaoAuthenticationProvider`，由`DaoAuthenticationProvider`，但是，我们现在已经通过修改传入`UserDetailsService`的`loadUserByUsername`方法实现了多种认证方式，这些认证方式不是都需要密码的，所以这里也要修改。

   现在重新定义`DaoAuthenticationProviderCustom`类，重写类的`additionalAuthenticationChecks`方法。

   ```java
   @Component
   public class DaoAuthenticationProviderCustom extends DaoAuthenticationProvider {
       @Autowired
       public void setUserDetailsService(UserDetailsService userDetailsService) {
           super.setUserDetailsService(userDetailsService);    // 注入了实现UserService接口的UserServiceImpl
       }
   
       /**
        * 重写密码对比方法
        *
        * @param userDetails
        * @param authentication
        * @throws AuthenticationException
        */
       @Override
       protected void additionalAuthenticationChecks(UserDetails userDetails, UsernamePasswordAuthenticationToken authentication) throws AuthenticationException {
   
       }
   }
   ```

   修改`WebSecurityConfig`类指定`daoAuthenticationProviderCustom`

   ```java
   @EnableWebSecurity
   @EnableGlobalMethodSecurity(securedEnabled = true, prePostEnabled = true)
   public class WebSecurityConfig extends WebSecurityConfigurerAdapter {
       @Autowired
       DaoAuthenticationProviderCustom daoAuthenticationProviderCustom;
   
       //...
       
       @Override
       protected void configure(AuthenticationManagerBuilder auth) throws Exception {
           auth.authenticationProvider(daoAuthenticationProviderCustom);
       }
   
   }
   ```

   测试：

   ```
   ################扩展认证请求参数后######################
   ###密码模式
   POST {{auth_host}}/auth/oauth/token?client_id=XcWebApp&client_secret=XcWebApp&grant_type=password&username={"username":"stu1","authType":"password","password":"111111"}
   ```

   <img src="/assets/SpringSecurity实现登录认证与授权.assets/image-20240926152238872.png" alt="image-20240926152238872" style="zoom:80%;" />

   `UserServiceImpl`可以顺利解析user。

   ![image-20240926152422772](/assets/SpringSecurity实现登录认证与授权.assets/image-20240926152422772.png)

   `loadUserByUsername`方法结束后，返回值交给自定义`DaoAuthenticationProvider`



### 7.2 账户密码认证

我们定义一个认证Service接口以进行各种类型的认证

```java
public interface AuthService {

    /**
     * @description 认证方法
     * @param authParamsDto 认证参数
     * @return com.xuecheng.ucenter.model.po.XcUser 用户信息
     * @author Mr.M
     * @date 2022/9/29 12:11
     */
    XcUserExt execute(AuthParamsDto authParamsDto);

}
```

然后，在`loadUserByUsername`方法中加入这个接口的execute方法，用这个方法自己实现密码的校验（前面屏蔽了框架原来的密码校验）

下面，实现这个接口，并把这个接口的实现放入`loadUserByUsername`方法

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
        XcUser user = xcUserMapper.selectOne(new LambdaQueryWrapper<XcUser>()
                                             .eq(XcUser::getUsername, username));
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

> ```java
> @Data
> public class XcUserExt extends XcUser {
>  //用户权限
>  List<String> permissions = new ArrayList<>();
> }
> ```
>
> 这个类是为了扩展性

```java
@Slf4j
@Service
public class UserServiceImpl implements UserDetailsService {

    @Autowired
    XcUserMapper xcUserMapper;

    @Autowired
    ApplicationContext applicationContext;
    

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
        String[] authorities = {"p1"};
        String password = user.getPassword();
        //为了安全在令牌中不放密码
        user.setPassword(null);
        //将user对象转json
        String userString = JSON.toJSONString(user);
        //创建UserDetails对象
        UserDetails userDetails = User
            .withUsername(userString)
            .password(password)
            .authorities(authorities)
            .build();
        return userDetails;
    }

}
```

**Attention：**认证Service接口的实现类`PasswordAuthServiceImpl`并不是用`@Autowired`或类似的方式进行注入，原因是：在项目完善后，显然不会只有一种认证方法，即认证Service接口的实现类不会只有一种，所以`@Autowird`这种按类型注入的方式不合适。这里是按名注入。

以上是全部。
