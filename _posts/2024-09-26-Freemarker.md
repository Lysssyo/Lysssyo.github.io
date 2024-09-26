---
title: Freemarker
date: 2024-09-26 15:50:00 +0800
categories: [Java,JavaWeb]
tags: [模板引擎]
---

常用的java模板引擎有Jsp、Freemarker、Thymeleaf 、Velocity 等。

Freemarker官方地址：http://freemarker.foofun.cn/

FreeMarker是一款 模板引擎：即一种基于模板和要改变的数据， 并用来生成输出文本(HTML网页，电子邮件，配置文件，源代码等)的通用工具。它不是面向最终用户的，而是一个Java类库，是一款程序员可以嵌入他们所开发产品的组件。FreeMarker是免费的，基于Apache许可证2.0版本发布。

## 1. 简单Demo

1. 引入依赖

   ```xml
           <!-- Spring Boot 对结果视图 Freemarker 集成 -->
           <dependency>
               <groupId>org.springframework.boot</groupId>
               <artifactId>spring-boot-starter-freemarker</artifactId>
           </dependency>
   ```

2. 配置

   ```yaml
   spring:
     freemarker:
       enabled: true
       cache: false   #关闭模板缓存，方便测试
       settings:
         template_update_delay: 0
       suffix: .ftl   #页面模板后缀名
       charset: UTF-8
       template-loader-path: classpath:/templates/   #页面模板位置(默认为 classpath:/templates/)
       resources:
         add-mappings: false   #关闭项目中的静态资源映射(static、resources文件夹下的资源)
   ```

3. 类路径下`template`目录中下添加模板

   ```xml
   <!--test.ftl-->
   <!DOCTYPE html>
   <html>
   <head>
       <meta charset="utf-8">
       <title>Hello World!</title>
   </head>
   <body>
   Hello ${name}!
   </body>
   </html>
   ```

4. 编写controller

   ```java
   @Controller
   public class FreemarkerController {
   
       @GetMapping("/testfreemarker")
       public ModelAndView test(){
           ModelAndView modelAndView = new ModelAndView();
           //设置模型数据
           modelAndView.addObject("name","小明");
           //设置模板名称
           modelAndView.setViewName("test");
           return modelAndView;
       }
   }
   ```

   

## 2. 进阶使用

### 2.1. 变量和数据模型

FreeMarker支持多种数据类型，如Map、List、简单对象等。在模板中可以通过`${}`语法访问数据。

```java
@Controller
public class FreemarkerController {

    @GetMapping("/testfreemarker")
    public ModelAndView test() {
        Map<String, Object> dataModel = new HashMap<>();
        dataModel.put("name", "小明");
        dataModel.put("age", 20);
        dataModel.put("hobbies", Arrays.asList("阅读", "运动", "编程"));

        ModelAndView modelAndView = new ModelAndView("test");
        modelAndView.addAllObjects(dataModel);
        return modelAndView;
    }
}

```

```xml
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>用户信息</title>
</head>
<body>
    <h1>用户信息</h1>
    <p>姓名: ${name}</p>
    <p>年龄: ${age}</p>
    <p>爱好: 
        <#list hobbies as hobby>
            ${hobby}<#if hobby_has_next>, </#if>
        </#list>
    </p>
</body>
</html>
```

### 2.2. 控制结构

FreeMarker支持条件判断和循环：

```xml
<#if age >= 18>
   <p>你是成年人。</p>
<#else>
   <p>你是未成年人。</p>
</#if>

<#list names as name>
   <p>${name}</p>
</#list>
```

### 2.3. 自定义宏

可以定义宏以重用模板片段：

```xml
<#macro greeting name>
   Hello ${name}!
</#macro>

<@greeting "小明"/>
```



## 3. 页面静态化

1. 通过数据模型为模板填充数据，然后将填充好的模板输出到文件中

   ```java
       @Test
       public void testGenerateHtmlByTemplate() throws IOException, TemplateException {
           //配置freemarker
           Configuration configuration = new Configuration(Configuration.getVersion());
   
           //加载模板
           //选指定模板路径，classpath下templates下
           //得到classpath路径
           String classpath = this.getClass().getResource("/").getPath();
           configuration.setDirectoryForTemplateLoading(new File(classpath + "/templates/"));
           //设置字符编码
           configuration.setDefaultEncoding("utf-8");
   
           //指定模板文件名称
           Template template = configuration.getTemplate("course_template.ftl");
   
           //准备数据
           CoursePreviewDto coursePreviewInfo = coursePublishService.getCoursePreviewInfo(120L);
   
           Map<String, Object> map = new HashMap<>();
           map.put("model", coursePreviewInfo);
   
           //静态化
           //参数1：模板，参数2：数据模型
           String content = FreeMarkerTemplateUtils.processTemplateIntoString(template, map);
           System.out.println(content);
           //将静态化内容输出到文件中
           InputStream inputStream = IOUtils.toInputStream(content);
           //输出流
           FileOutputStream outputStream = new FileOutputStream("D:\\...\\120.html");
           IOUtils.copy(inputStream, outputStream);
   
       }
   ```

2. 将静态化页面（例如上面的`120.html`）放到Minio上，通过Minio的文件url进行访问

   > 例如：localhost:9000/mediafiles/course/120.html，即域名+端口+`bucketName`+`objectName`
   >
   > 可以通过Nginx填充样式
