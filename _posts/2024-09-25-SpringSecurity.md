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
                   .resourceIds("xuecheng-plus")//资源列表
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
   > <img src="SpringSecurity实现登录认证与授权.assets/image-20240925193513898.png" alt="image-20240925193513898" style="zoom: 50%;" />

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

```json
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
>     "xuecheng-plus"
>   ]
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



## 6. 网关



## 7. 统一认证







