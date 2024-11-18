---
title: ArticleHub
date: 2024-11-01 14:12:00 +0800
categories: [Java, 项目]
tags: [Java,JavaWeb,项目]
---



## 0. 简介

“文聚集”是一款用于收藏公众号文章的微信小程序，提供文章分类管理、在线浏览、AI总结、每日好文推荐等功能。用户可在公众号文章页面选择“在小程序中打开”，随后会跳转到小程序。在用户为文章设定好标签后，可以将其添加到个人收藏，并异步调用API实现AI总结。**该项目在学校老师的指导下完成，并申请了软件著作**

## 1. 业务

### 1.1 登录

<img src="assets/2024-11-01-ArticleHub.assets/image-20241101141237343.png" alt="image-20241101141237343" style="zoom:67%;" />



### 1.2 校验

基于JWT令牌技术，采用自定义拦截器结合ThreadLocal机制，获取微信提供的openId实现用户登录验证

<img src="assets/2024-11-01-ArticleHub.assets/image-20241101142012609.png" alt="image-20241101142012609" style="zoom:67%;" />

### 1.3 新增文章

**如何实现的？**

![image-20241101141346193](assets/2024-11-01-ArticleHub.assets/image-20241101141346193.png)

### 1.4 数据库公共字段填充

**如何实现的？**

基于Spring AOP切面技术，实现数据库公共字段的自动填充，从而减少代码冗余并降低模块间的耦合度。

**项目中如何用到反射？**

在项目中主要用反射为插入数据库的实体的公共字段赋值。

一般插入数据到数据库的方法都是把要插入数据库的字段封装到一个实体里面，然后通过`mapper.insert(Entity)`的方式插入到数据库，在插入之前需要对这个实体的各个属性进行set的操作。但是很多实体都有相同的属性例如`createTime`和`updateTime`，每次都set就很麻烦，所以就通过SpringAOP+反射的方式来实现这些公共字段的set操作。

我用SpringAOP增强了插入实体到数据库的方法，在通知中，我通过jointPoint.getArgs()获得了方法的参数，getArgs()方法返回的是一个数组，我这里规定了插入数据库的实体是插入数据库的方法的第一个参数，所以jointPoint.getArgs()返回的数组的第一个元素就是我要插入数据库的实体。然后，我就用实体调用getClass方法，返回实体的Class对象，调用Class对象的getDeclaredMethod方法获得Method对象，再用Method对象调用invoke方法真正调用实体的set方法为实体赋值。

**全局唯一Id是如何生成的呢？**

不同的实体都需要一个Id序列，比如Article需要一个Id序列，Tag需要一个Id序列。在Redis数据库中，就为每个实体都创建了一个键值对用于存储这类实体的Id序列。例如，在Redis数据库中，有一个名为`ArticleHub:increment:Article`的key，它的value就是当前最大Article的Id的值，当有一个新的Article需要一个新的Id后，就会使这个值+1返回给后端。

后端拿到这个值之后不会直接用，如果直接用那就和MySQL的自增Id没什么区别了。后端拿到Redis生成的Id后，会生成一个long类型的时间戳，然后左移32位，再与Redis生成的Id按位或，这样，即保证了Id的安全性，也保证了Id的自增属性。

当然，这个生成Id的操作封装成了一个工具类，要用的时候可以直接调用。

- Id自动填充

  1. 设计了自定义注解

     ```java
     @Target(ElementType.METHOD)
     @Retention(RetentionPolicy.RUNTIME)
     public @interface AutoCreateId {
         // 自动生成id的类型名
         EntityType value();
     }
     
     /**
      * 自动生成id的类型名
      */
     public enum EntityType {
         USER,
         ARTICLE,
         TAG,
         CATEGORY,
         SIMPLE_ARTICLE,
         CATEGORY_ARTICLE,
         ARTICLE_DETAIL
     }
     ```

     > 自定义注解的主要作用就是为切面类带点信息，同时不侵入原有代码

  2. 设计了切面类，利用自定义工具类`RedisIdUtil`中的nextId方法生成Id

     ```java
     @Component
     @Slf4j
     @Aspect
     @RequiredArgsConstructor
     public class AutoCreateIdAspect {
         private final StringRedisTemplate stringRedisTemplate;
     
         /**
          * 切入点
          */
         @Pointcut("execution(* org.lysssyo.mapper.*.*(..)) && @annotation(org.lysssyo.annoctation.AutoCreateId)")
         public void autoCreateIdPointCut() {
         }
     
         /**
          * 前置通知，在通知中进行公共字段的赋值
          */
         @Before("autoCreateIdPointCut()")
         public void autoFill(JoinPoint joinPoint) {
             log.info("开始进行Id自动生成...");
             //Signature signature1 = joinPoint.getSignature();
             MethodSignature signature = (MethodSignature) joinPoint.getSignature();
             //MethodSignature是Signature的一个子接口，专门用于表示方法签名。
             //它提供了额外的方法，可以获取方法的参数类型、返回值类型等信息。这在处理方法增强时非常有用。
             AutoCreateId annotation = signature.getMethod().getAnnotation(AutoCreateId.class);
             // 返回注解对象
             EntityType value = annotation.value();
     
             // 获取被拦截的参数
             Object[] args = joinPoint.getArgs(); //规定插入数据库方法的第一个参数为插入实体
     
             if (args == null || args.length == 0) {
                 return;
             }
     
             Object entity = args[0];
     
             String keyPrefix = value.toString();
     
             // 构造Id
             long id = RedisIdUtil.nextId(keyPrefix, stringRedisTemplate);
     
             // 插入生成的id
             try {
                 entity.getClass().getDeclaredMethod("setId", Long.class).invoke(entity, id);
             } catch (Exception e) {
                 log.error("生成Id失败");
                 e.printStackTrace();
             }
     
         }
     }
     ```

     ![image-20241106093517895](assets/2024-11-01-ArticleHub.assets/image-20241106093517895.png)

  3. 使用的时候，在方法上加注解即可

     ```java
     public interface ArticleDetailMapper {
         @AutoFill(value = OperationType.INSERT)
         @AutoCreateId(value = EntityType.ARTICLE_DETAIL)
         void insert(ArticleDetail articleDetail);
         
     }
     ```

- `createTime`和`updateTime`自动填充

  1. 自定义注解

     ```java
     @Target(ElementType.METHOD)
     @Retention(RetentionPolicy.RUNTIME)
     public @interface AutoFill {
         // 数据库操作类型：Update Insert
         OperationType value();
     }
     ```

  2. 自定义切面类

     ```java
     @Component
     @Slf4j
     @Aspect
     public class AutoFillAspect {
         /**
          * 切入点
          */
         @Pointcut("execution(* org.lysssyo.mapper.*.*(..)) && @annotation(org.lysssyo.annoctation.AutoFill)")
         public void autoFillPointCut() {
         }
     
         /**
          * 前置通知，在通知中进行公共字段的赋值
          */
         @Before("autoFillPointCut()")
         public void autoFill(JoinPoint joinPoint) {
             log.info("开始进行公共字段自动填充...");
             //Signature signature1 = joinPoint.getSignature();
             MethodSignature signature = (MethodSignature) joinPoint.getSignature();
             //MethodSignature是Signature的一个子接口，专门用于表示方法签名。
             //它提供了额外的方法，可以获取方法的参数类型、返回值类型等信息。这在处理方法增强时非常有用。
             AutoFill annotation = signature.getMethod().getAnnotation(AutoFill.class);// 返回注解对象
             OperationType value = annotation.value(); //获取注解的value值
     
             // 获取被拦截的参数
             Object[] args = joinPoint.getArgs();
     
             if (args == null || args.length == 0) {
                 return;
             }
     
             Object entity = args[0]; //规定方法的第一个参数为insert或update的实体参数
     
             //准备赋值的数据
             LocalDateTime now = LocalDateTime.now();
             try {
                 if (value == OperationType.INSERT) {
                     Method setCreateTime = entity.getClass().getDeclaredMethod("setCreateTime", LocalDateTime.class);
                     Method setUpdateTime = entity.getClass().getDeclaredMethod("setUpdateTime", LocalDateTime.class);
                     setCreateTime.invoke(entity, now);
                     setUpdateTime.invoke(entity, now);
                 }
                 if (value == OperationType.UPDATE) {
                     Method setUpdateTime = entity.getClass().getDeclaredMethod("setUpdateTime", LocalDateTime.class);
                     setUpdateTime.invoke(entity, now);
                 }
             } catch (Exception e) {
                 log.error("公共字段填充出错");
                 e.printStackTrace();
             }
     
     
         }
     }
     ```

  3. 使用的时候，在方法上加注解即可

### 1.5 树形结构实现多层级文章收藏夹

基于树形结构实现多层级文章收藏夹，以便于实现灵活的文章收藏管理和高效的查询性能

**概述：**

首先，用户查看文章有两种方式。第1种是根据标签查询。小程序的首页会显示用户按照时间由近到远添加的所有文章。然后首页有一个下拉条，用户可以在下拉条种看见自己在新增文章收藏时为文章打的所有标签。用户可以通过点击标签筛选打了这个标签的文章。第2种方式是按照收藏夹查看收藏的文件。用户在新增文章收藏的时候可以选择文章归属的文件夹，然后展示的时候也按这个层级来展示。例如，用户建立了文件夹A、B、C，文件夹A下又有文件夹A-1，A-2。用户在新增文章α的时候把α放在了文件夹A-1，新增文章β的时候把β放在了文件夹B，那么我们展示的时候也是这样展示。即用户在“收藏页”会看到3个文件夹，点进文件夹B会看到文章β，点进文件夹A会看到A-1，A-2，再点进A-1会看到α。**并且规定，文章一定要属于某个层级**，即可以不为文章打标签，但一定要为文章选择收藏夹

**如何实现按标签查看查看收藏的文章呢？**

查`category`表，根据`userId`找到用户的所有`category`项，根据用户的所有`category`去查`category_article`表，获得用户的所有`articleId`，根据`articleId`表去查`simple_article`表，从而获得文章的url，tittle和pic。

**如何实现按收藏夹查看收藏的文章呢？**

前端发起请求后，后端会把category树返回给前端，树的每个结点除了包括结点的名称（收藏夹名称）、父节点的id（父收藏夹的Id）等结点的基本信息，还包括归宿该结点（也就是该文件夹）的文章。以下是详细说明。

#### 1.5.0 数据库设计

数据库中有如下表：

![image-20241106144127961](assets/2024-11-01-ArticleHub.assets/image-20241106144127961.png)

![image-20241106144157151](assets/2024-11-01-ArticleHub.assets/image-20241106144157151.png)

数据库中的每一行就是一个文件夹，每一行记录了这个文件夹的名称，所属用户，以及是否是根文件夹（parentId==0），如果不是根文件夹的话，上层文件夹是哪个。用户查看文章时，如果选择按照收藏夹查看，那么就会返回用户的收藏层级给他，并把对应层级的文章填进去。

例如，userId为1的用户查看文章时，会得到如下的收藏夹层级

```
根目录1
├── 根1的子1
│   └── 根1的子1的子1
├── 根1的子2
根目录2
根目录3
```

**具体实现：**

#### 1.5.1 查看文章收藏层级

1. 前端发起请求

   ```java
   @RestController
   @RequestMapping("/category")
   @RequiredArgsConstructor
   public class ArticleCategoryController {
       private final ArticleCategoryService articleCategoryService;
   
       @GetMapping()
       public Result<List<CategoryTreeNode>> getArticleCategory() {
           return Result.success(articleCategoryService.getArticleCategory());
       }
   
   }
   ```

2. 查表，建树，填充文章

   ```java
       @Override
       public List<CategoryTreeNode> getArticleCategory() {
           List<CategoryTreeNode> articleCategoryList =
                   categoryMapper.queryByUserId(BaseContext.getCurrentId()); // 获取category表的项
   
           // 1.将 list 转换为 map，方便通过 ParentId 找到节点
           Map<Long, CategoryTreeNode> mapTemp = articleCategoryList.stream()
                   .collect(Collectors.toMap(
                           CategoryTreeNode::getId,  // 键：ArticleCategoryTreeNode 的 id
                           item -> item,             // 值：ArticleCategoryTreeNode 实例
                           (existing, replacement) -> existing));  // 如果有重复键，保留第一个值
   
           // 2.定义最终返回的结果list
           List<CategoryTreeNode> resultList = new ArrayList<>();
   
           // 3.再遍历一次,数据处理好后放入结果List，注意也要排除根节点
           articleCategoryList
                   .stream()
                   // 检查每一个item
                   .forEach(item -> {
                       List<SimpleArticle> simpleArticleList = 
                           simpleArticleMapper.queryByCategory(item.getId());
                       if (item.getSimpleArticleList() == null) {
                           item.setSimpleArticleList(simpleArticleList);
                       }
                       // 这个if，用于把 1级结点 放入结果List
                       // 如果parentId == 0，那么是一级结点，放入结果List
                       if (item.getParentId() == 0L) {
                           // 不是所有 courseCategoryTreeDtos 都要放进去结果List中，只有 courseCategoryTreeDtos 的ParentId等于id才放，
                           // 剩余的放结果List的每一项的ChildrenTreeNodes
                           resultList.add(item);
                       }
                       // 如果parentId != 0，那么不是一级结点
                       // 下面是为了把子节点放入父节点的childrenTreeNodes，3级结点放入2级结点的childrenTreeNodes，4级结点放入3级结点的childrenTreeNodes
                       // 找到当前结点的父节点（利用Map）
                       // 注意这个articleCategoryTreeNode不是新建的，而是引用List中的结点
                       CategoryTreeNode articleCategoryTreeNode = mapTemp.get(item.getParentId());
                       // 如果找得到
                       if (articleCategoryTreeNode != null) {
                           // 如果找到的父节点的 childrenTreeNodes 为空，要先new（因为创建的时候 childrenTreeNodes 默认为null）
                           if (articleCategoryTreeNode.getArticleCategoryTreeNodes() == null) {
                               articleCategoryTreeNode.setArticleCategoryTreeNodes(new ArrayList<>());
                           }
                           // 往父节点的ChildrenTreeNodes属性中放子节点（遍历到的item）
                           articleCategoryTreeNode.getArticleCategoryTreeNodes().add(item);
                       }
                   });
   
           return resultList;
       }
   ```

   ```java
       @Select("SELECT a.* " +
               "FROM category AS c " +
               "LEFT JOIN category_article AS ca ON c.id = ca.category_id " +
               "LEFT JOIN simple_article AS a ON ca.article_id = a.id " +
               "WHERE c.id = #{id}")
       List<SimpleArticle> queryByCategory(Long id);
   ```

3. 返回结果

   ```
   {
       "code": 1,
       "msg": null,
       "data": [
           {
               "id": 383572456780070920,
               "name": "大文件夹1",
               "label": null,
               "parentId": 0,
               "isShow": true,
               "orderBy": 1,
               "userId": 383928990605246465,
               "createTime": [
                   2024,
                   10,
                   30,
                   15,
                   37,
                   3
               ],
               "updateTime": [
                   2024,
                   10,
                   30,
                   15,
                   37,
                   3
               ],
               "simpleArticleList": [
                   {
                       "id": 383965858604515356,
                       "url": "https://mp.weixin.qq.com/s/Kc9NDmDt7xTDsTuDvpk-bw",
                       "tittle": "2025年广东省普通高考报名百答百问（五）",
                       "pic": "https://mmbiz.qpic.cn/sz_mmbiz_jpg/zWvuQpwibS7NZpQyS7NoDMQ6ol2WnJLyGcmYhX6icnKE1urd9R2tMtrkp4WDianMdBy1PKyicTZAiaZdsw8xgXD1vEw/0?wx_fmt=jpeg",
                       "createTime": [
                           2024,
                           10,
                           31,
                           17,
                           3,
                           39
                       ],
                       "updateTime": [
                           2024,
                           10,
                           31,
                           17,
                           3,
                           39
                       ]
                   },
                   {
                       "id": 383972983955259428,
                       "url": "https://mp.weixin.qq.com/s/ksaLN5EUflEoihI0de1XhQ",
                       "tittle": "每个人是自己健康的第一责任人",
                       "pic": "https://mmbiz.qpic.cn/sz_mmbiz_jpg/ZeS39BAIp3bKp3pOdqZWyYDRAV4bRNr2m0FEzic9Fwo45RyicZtsAvYArAIKopZxXlnlNR8BXSW3ticP64vmCKo0g/0?wx_fmt=jpeg",
                       "createTime": [
                           2024,
                           10,
                           31,
                           17,
                           31,
                           19
                       ],
                       "updateTime": [
                           2024,
                           10,
                           31,
                           17,
                           31,
                           19
                       ]
                   },
                   {
                       "id": 383987659858509861,
                       "url": "https://mp.weixin.qq.com/s/j4ksNwvRTobizBsZ6maNnQ",
                       "tittle": "推进高水平对外开放！“五外联动”助番禺拓展“新蓝海”",
                       "pic": "https://mmbiz.qpic.cn/sz_mmbiz_jpg/Ly1RT34mP0KQ9vwCI6McQs8obMMkFysT2TwDMhKHfiaGSJIDA86A1KQ4F8plmL7cwzdBlqHzkxicflecdVr6YNAg/0?wx_fmt=jpeg",
                       "createTime": [
                           2024,
                           10,
                           31,
                           18,
                           28,
                           15
                       ],
                       "updateTime": [
                           2024,
                           10,
                           31,
                           18,
                           28,
                           15
                       ]
                   },
                   {
                       "id": 383987659858509861,
                       "url": "https://mp.weixin.qq.com/s/j4ksNwvRTobizBsZ6maNnQ",
                       "tittle": "推进高水平对外开放！“五外联动”助番禺拓展“新蓝海”",
                       "pic": "https://mmbiz.qpic.cn/sz_mmbiz_jpg/Ly1RT34mP0KQ9vwCI6McQs8obMMkFysT2TwDMhKHfiaGSJIDA86A1KQ4F8plmL7cwzdBlqHzkxicflecdVr6YNAg/0?wx_fmt=jpeg",
                       "createTime": [
                           2024,
                           10,
                           31,
                           18,
                           28,
                           15
                       ],
                       "updateTime": [
                           2024,
                           10,
                           31,
                           18,
                           28,
                           15
                       ]
                   },
                   {
                       "id": 384224523009916929,
                       "url": "https://mp.weixin.qq.com/s/3i79wyLzAHdk-lZrXlTKJw",
                       "tittle": "院士面对面，点燃学子科技梦！",
                       "pic": "https://mmbiz.qpic.cn/sz_mmbiz_jpg/ydbVNBWvsibKxYRiayX9TAjoIOPJ5wfic4BBnDKDadM9y0oXW3cpdJXeiajtLJU6cjBnicDf3xre8VzmCGGpjSLic7DA/0?wx_fmt=jpeg",
                       "createTime": [
                           2024,
                           11,
                           1,
                           9,
                           47,
                           24
                       ],
                       "updateTime": [
                           2024,
                           11,
                           1,
                           9,
                           47,
                           24
                       ]
                   },
                   {
                       "id": 384225244564422658,
                       "url": "https://mp.weixin.qq.com/s/RlaVd3W33lxcRAxJevFmng",
                       "tittle": "准备发朋友圈，P了很久都不满意…“完美主义”真的好吗？",
                       "pic": "https://mmbiz.qpic.cn/mmbiz_jpg/1PGg9z8BNYPxvHibyiag79YgBAbVJDqo5kLSorvV5Mia9Z1uzcXicXenBafK5aV3GlaRE0CLrhDD4yOQLCgoUMGgRQ/0?wx_fmt=jpeg",
                       "createTime": [
                           2024,
                           11,
                           1,
                           9,
                           50,
                           12
                       ],
                       "updateTime": [
                           2024,
                           11,
                           1,
                           9,
                           50,
                           12
                       ]
                   },
                   null,
                   {
                       "id": 384242398663802884,
                       "url": "https://mp.weixin.qq.com/s/A5qLKYI3M61Zc9Xg8w7h5g",
                       "tittle": "唐屹峰白涛到南海区调研：推动科技创新和产业创新融合发展 加快塑造高质量发展新动能新优势",
                       "pic": "https://mmbiz.qpic.cn/mmbiz_jpg/dCSBZibaHmgdShxS9QK6BfNDaaYRZtoicg1IK4mrMZ47lUsibepd8JdN6huwWUaJBMHEwvcaPPuvsvnMQCrwjKjzw/0?wx_fmt=jpeg",
                       "createTime": [
                           2024,
                           11,
                           1,
                           10,
                           56,
                           46
                       ],
                       "updateTime": [
                           2024,
                           11,
                           1,
                           10,
                           56,
                           46
                       ]
                   },
                   null,
                   {
                       "id": 384244537557516295,
                       "url": "https://mp.weixin.qq.com/s/iwSNi7mX4FEsmbx44rTzIQ",
                       "tittle": "竹苑5栋五室一站 | 爱国卫生大扫除活动总结",
                       "pic": "https://mmbiz.qpic.cn/sz_mmbiz_jpg/ETNW4krxVTW6N3uTsfj2iaYdlyxySicPT05edVJWicFYM7Pe7KNnRSf4JEBa5wtfGbLgkXDG5nvIjpnya5DiaBDj8Q/0?wx_fmt=jpeg",
                       "createTime": [
                           2024,
                           11,
                           1,
                           11,
                           5,
                           4
                       ],
                       "updateTime": [
                           2024,
                           11,
                           1,
                           11,
                           5,
                           4
                       ]
                   }
               ],
               "articleCategoryTreeNodes": [
                   {
                       "id": 383572723068043275,
                       "name": "大文件夹1的小文件夹",
                       "label": null,
                       "parentId": 383572456780070920,
                       "isShow": true,
                       "orderBy": 1,
                       "userId": 383928990605246465,
                       "createTime": [
                           2024,
                           10,
                           30,
                           15,
                           38,
                           5
                       ],
                       "updateTime": [
                           2024,
                           10,
                           30,
                           15,
                           38,
                           5
                       ],
                       "simpleArticleList": [
                           null
                       ],
                       "articleCategoryTreeNodes": null
                   }
               ]
           },
           {
               "id": 383572624283795465,
               "name": "大文件夹2",
               "label": null,
               "parentId": 0,
               "isShow": true,
               "orderBy": 1,
               "userId": 383928990605246465,
               "createTime": [
                   2024,
                   10,
                   30,
                   15,
                   37,
                   42
               ],
               "updateTime": [
                   2024,
                   10,
                   30,
                   15,
                   37,
                   42
               ],
               "simpleArticleList": [
                   null
               ],
               "articleCategoryTreeNodes": null
           },
           {
               "id": 383572637168697354,
               "name": "大文件夹3",
               "label": null,
               "parentId": 0,
               "isShow": true,
               "orderBy": 1,
               "userId": 383928990605246465,
               "createTime": [
                   2024,
                   10,
                   30,
                   15,
                   37,
                   45
               ],
               "updateTime": [
                   2024,
                   10,
                   30,
                   15,
                   37,
                   45
               ],
               "simpleArticleList": [
                   null
               ],
               "articleCategoryTreeNodes": null
           }
       ]
   }
   ```

#### 1.5.2 新增文章收藏层级

如何想要新增一个层级，只需要知道想要新增的层级的name以及parentId。例如，想要为大文件夹1下新增一个子文件夹，那么只需要把大文件夹一的Id作为parentId，以及这个子文件夹的名字传递给后端。具体如下：

```java
@RestController
@RequestMapping("/category")
@RequiredArgsConstructor
public class ArticleCategoryController {
    private final ArticleCategoryService articleCategoryService;

    @PostMapping()
    public Result saveArticleCategory(@RequestBody AddArticleCategoryDTO addArticleCategoryDTO) {
        articleCategoryService.saveArticleCategory(addArticleCategoryDTO);
        return Result.success();
    }
}

@Data
public class AddArticleCategoryDTO {
    private String name;
    private String label;
    private Long parentId;
    private Integer orderBy;
}
```

### 1.6 每日必读功能

管理员可以在后台新增每日必读文章，需要填写文章标题、章首图以及文章内容（Html）。填写完成后，表单将提交给后端，后端把表单存入数据库。SpringTask会定时扫描数据库，把当天的每日必读放入Redis中。每日必读文章在Redis中以Zset的形式存储，score为点赞量，member为转为json字符串的文章。

#### 1.6.1 展示每日必读

展示每日必读这里还实现了按照点赞排行的功能。

![image-20241113204242020](assets/2024-11-01-ArticleHub.assets/image-20241113204242020.png)

```java
		// 根据key获取当天的每日必读（带上score）
		String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy:MM:dd"));

		Set<ZSetOperations.TypedTuple<String>> rankingSetWithScores = stringRedisTemplate.opsForZSet()
            .reverseRangeWithScores("ArticleHub:Ranking:" + date, 0, 9);

		// 包装一下传递给前端
        List<DailyReadArticleDTO> dailyReadArticleDTOList = rankingSetWithScores.stream()
                .map(new Function<ZSetOperations.TypedTuple<String>, DailyReadArticleDTO>() {
                    @Override
                    public DailyReadArticleDTO apply(ZSetOperations.TypedTuple<String> stringTypedTuple) {
                        DailyReadArticleDTO dailyReadArticleDTO = new DailyReadArticleDTO();
                        Double score = stringTypedTuple.getScore();
                        String value = stringTypedTuple.getValue();
                        dailyReadArticleDTO = JSONUtil.toBean(value, DailyReadArticleDTO.class);
                        dailyReadArticleDTO.setStars(score);
                        dailyReadArticleDTO.setJsonArticle(value);
                        return dailyReadArticleDTO;
                    }
                }).collect(Collectors.toList());
```



#### 1.6.2 每日必读定时刷新

<img src="assets/2024-11-01-ArticleHub.assets/image-20241113204738436.png" alt="image-20241113204738436" style="zoom: 40%;" />

> - 删除昨天的Zset文章排行榜可以直接把Key`ArticleHub:Ranking:yyyy:MM:dd`删了
> - 删除昨天各个文章的点赞用户集合需要知道各个文章的Id，因为点赞集合的key是`ArticleHub:Ranking:detail`+`ArticleId`

```java
@Component
@Slf4j
@RequiredArgsConstructor
public class RankingTask {
    private final DailyReadArticleMapper dailyReadArticleMapper;
    private final StringRedisTemplate stringRedisTemplate;

    /**
     * 定时任务 每天0点0时0分触发
     */
	@Scheduled(cron = "0 0 0 * * ?")
    public void executeTask() {
        log.info("定时任务开始执行：{}", new Date());
        List<DailyReadArticle> dailyArticleLists = dailyReadArticleMapper.getDailyArticleLists();
        String keyPrefix = "ArticleHub:Ranking:";
        
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime yesterday = now.plusDays(-1L);

        String yesterdayDate = yesterday.format(DateTimeFormatter.ofPattern("yyyy:MM:dd"));
        String date = now.format(DateTimeFormatter.ofPattern("yyyy:MM:dd"));
        
        // 删除旧文章以及点赞旧文章的Set
        stringRedisTemplate.opsForZSet().removeRange(keyPrefix + yesterdayDate, 0, 9); //删除昨天的

        // stringRedisTemplate.delete("key"); 删除旧的Set
        for (int i = 0; i < 10; i++) {
            stringRedisTemplate.delete(keyPrefix + "detail:" + i);
        }


        for (int i = 0; i < dailyArticleLists.size(); i++) {

            String key = "ArticleHub:Ranking:" + date;

            // 新文章加入排行榜
            stringRedisTemplate.opsForZSet().add(key, JSONUtil.toJsonStr(dailyArticleLists.get(i)), 0);

        }
        System.out.println(1);

    }
}
```



#### 1.6.2 每日必读点赞以及取消点赞

点赞排行榜已经实现了，因为在《1.6.1 展示每日必读》的时候就是按照点赞的个数从高到低返回给前端的。下面只需要实现点赞功能。

<img src="assets/2024-11-01-ArticleHub.assets/image-20241113205754268.png" alt="image-20241113205754268" style="zoom:50%;" />

```java
    @PostMapping("/stars")
    public Result addStar(@RequestBody String jsonArticle) {
        articleService.addStar(jsonArticle);
        // jsonArticle是存文章排行榜的Zset的Member，通过DailyReadArticleDTO在《展示每日必读》功能传递给了前端
        return Result.success();
    }

    @Override
    public void addStar(String jsonArticle) {
        // 1. 解析出articleId
        DailyReadArticleDTO dailyReadArticleDTO = JSONUtil.toBean(jsonArticle, DailyReadArticleDTO.class);
        Long articleId = dailyReadArticleDTO.getId();
        String starsSetKey = "ArticleHub:Ranking:detail:" + articleId;//存这个文章的点赞用户的Set

        String rankingKeyPrefix = "ArticleHub:Ranking:";
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy:MM:dd"));
        String key = rankingKeyPrefix + date;// 排行榜

        Boolean flag = stringRedisTemplate.opsForSet()
            .isMember(starsSetKey, Long.toString(BaseContext.getCurrentId()));

        // 2.查用户是否已经点赞
        if (Boolean.TRUE.equals(flag)) {
            stringRedisTemplate.opsForZSet().add(key, jsonArticle, -1);
            stringRedisTemplate.opsForSet().remove(starsSetKey, Long.toString(BaseContext.getCurrentId()));
            return;
        }

        // 3.文章赞数增加
        stringRedisTemplate.opsForZSet().add(key, jsonArticle, 1);
        // 4.用户加入点赞集合
        stringRedisTemplate.opsForSet().add(starsSetKey, Long.toString(BaseContext.getCurrentId()));


    }
```

### 1.9 异步AI总结

**如何实现的？**

在1.3 新增文章中，写入`simple_article`后，会调用智谱API生成总结，写入`article_detail`。

1. 自定义了Fanout类型交换机和队列，绑定交换机和队列

   ```java
   @Configuration
   public class FanoutConfig {
       @Bean
       public MessageConverter messageConverter(){
           // 1.定义消息转换器
           Jackson2JsonMessageConverter jackson2JsonMessageConverter = new Jackson2JsonMessageConverter();
           // 2.配置自动创建消息id，用于识别不同消息，也可以在业务中基于ID判断是否是重复消息
           jackson2JsonMessageConverter.setCreateMessageIds(true);
           return jackson2JsonMessageConverter;
       }
       /**
        * 声明交换机
        * @return Fanout类型交换机
        */
       @Bean
       public FanoutExchange fanoutExchange(){
           return new FanoutExchange("articleHub.handleArticleFanoutExchange");
           // 或者 return ExchangeBuilder.fanoutExchange("hmall.fanout").build();
       }
   
       /**
        * 第1个队列
        */
       @Bean
       public Queue fanoutQueue1(){
           return new Queue("handleArticle.queue1");
       }
   
       /**
        * 绑定队列和交换机
        */
       @Bean
       public Binding bindingQueue1(Queue fanoutQueue1, FanoutExchange fanoutExchange){
           return BindingBuilder.bind(fanoutQueue1).to(fanoutExchange);
       }
   
   }
   ```

2. 自定义了监听器

   ```java
   @Component
   @RequiredArgsConstructor
   public class handleArticleListener {
       private final ArticleDetailMapper articleDetailMapper;
   
       @RabbitListener(queues = "handleArticle.queue1")
       public void listenHandleArticleQueue1(ArticleDetail articleDetail) {
           System.out.println("消费者1接收到信息：" + articleDetail);
           // articleDetail.setSummary();
           // 填充summary
           articleDetailMapper.insert(articleDetail);
   
       }
   }
   ```

3. 在新增文章的方法中，如果要添加的文章不在数据库，那么在把基本信息填进simple_article表后，会调用`RabbitTemplate`类的`convertAndSend()`方法，向交换机发送信息，发送信息时带上`ArticleDetail articleDetail`，与交换机绑定的队列会根据`articleDetail`获取`tittle`和粗略的`content`以实现总结，填入`article_detail`数据库





























