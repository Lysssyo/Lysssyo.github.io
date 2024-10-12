---
title: MyBatisPlus
date: 2024-09-06 14:20:00 +0800
categories: [Java,JavaWeb]
tags: [数据库,MyBatisPlus]
---

## 1. MybatisPlus简介

​		MyBatisPlus是基于MyBatis框架基础上开发的增强型工具，旨在简化开发、提高效率

​		MyBatisPlus的官网为:`https://mp.baomidou.com/`

​		引入：

```xml
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-boot-starter</artifactId>
            <version>3.5.3.1</version>
        </dependency>
```



### 1.1 标准CRUD开发

![image-20240718154501406](/assets/MyBatisPlus.assets/image-20240718154501406.png)

> updateById()如果T的某些数据成员没有指定（为null），则不会对这些字段进行修改



## 2. 更新

**方式一：使用updateById(T t)**

```java
    @Test
    void testUpdate(){
        User user=new User();
        user.setId(5L);
        user.setUsername("Lysssyo");
        userMapper.updateById(user);
    }
```

**方式二：使用update(T entity,Wrapper\<T> updateWrapper )**

```java
    @Test
    void testUpdate(){
        User user=new User();
        QueryWrapper<User> queryWrapper=new QueryWrapper<>();
        //1. 要更新的数据
        user.setUsername("Lysssyo");
        //2. 要更新的条件
        queryWrapper.eq("id","5");
        userMapper.update(user,queryWrapper);
    }
```

```sql
==>  Preparing: UPDATE user SET username=? WHERE (id = ?)
==> Parameters: Lysssyo(String), 5(String)
<==    Updates: 1
```



```java
    void testUpdateWrapper() {
        List<Long> ids = List.of(1L, 2L, 4L);
        // 1.生成SQL
        UpdateWrapper<User> wrapper = new UpdateWrapper<User>()
                .setSql("balance = balance - 200") // SET balance = balance - 200
                .in("id", ids); // WHERE id in (1, 2, 4)
        // 2.更新，注意第一个参数可以给null，也就是不填更新字段和数据，而是基于UpdateWrapper中的setSQL来更新
        userMapper.update(null, wrapper);
    }
```

```sql
==>  Preparing: UPDATE user SET balance = balance - 200 WHERE (id IN (?,?,?))
==> Parameters: 1(Long), 2(Long), 4(Long)
<==    Updates: 3
```



## 3. 查询

### 3.0 条件构造器

​		除了新增以外，修改、删除、查询的SQL语句都需要指定where条件。因此BaseMapper中提供的相关方法除了以`id`作为`where`条件以外，还支持更加复杂的`where`条件。

<img src="/assets/MyBatisPlus.assets/image-20240725175343370.png" alt="image-20240725175343370" style="zoom:67%;">



### 3.1 构建条件查询

```java
    void select() {
        // 方法一：QueryWrapper
        QueryWrapper queryWrapper=new QueryWrapper();
        queryWrapper.lt("age",18);//age < 18
        List<User> users = userDao.selectList(queryWrapper);
        System.out.println(users);
    }
```



```java
    void select() {
        // 方法二：lambda表达式
        QueryWrapper<User> qw = new QueryWrapper<>();
        qw.lambda().lt(User::getAge, 18);//age < 18
        List<User> users = userDao.selectList(qw);
        System.out.println(users);

    }
```



```java
    void select() {
        // 方法三：LambadQueryWrapper
        LambdaQueryWrapper<User> lqw = new LambdaQueryWrapper<>();
        lqw.lt(User::getAge, 10);//age < 10
        List<User> users = userDao.selectList(lqw);
        System.out.println(users);
    }
```



### 3.2 多个条件查询

#### 3.2.1 并且

```java
    void select() {
		LambdaQueryWrapper<User> lqw = new LambdaQueryWrapper<>();
        //age > 10 且 age < 30
        lqw.lt(User::getAge, 30);
        lqw.gt(User::getAge, 10);
        //或者链式编程
        //lqw.lt(User::getAge, 30).gt(User::getAge, 10);
        List<User> users = userDao.selectList(lqw);
        System.out.println(users);
    }
```

#### 3.2.1 或者

```java
    void select() {
		LambdaQueryWrapper<User> lqw = new LambdaQueryWrapper<>();
        //age < 10 或 age < 30
        lqw.gt(User::getAge, 30).or.lt(User::getAge, 10);
        List<User> users = userDao.selectList(lqw);
        System.out.println(users);
    }
```



### 3.3 空值处理

```java
    void testGetAll(){
        //模拟页面传递过来的查询数据
        UserQuery uq = new UserQuery();
        uq.setAge(10);
        uq.setAge2(30);
        LambdaQueryWrapper<User> lqw = new LambdaQueryWrapper<User>();
        lqw.lt(null!=uq.getAge2(),User::getAge, uq.getAge2());// 第一个参数为true才拼接后面的判断
        lqw.gt(null!=uq.getAge(),User::getAge, uq.getAge());
        List<User> userList = userDao.selectList(lqw);
        System.out.println(userList);
    }
```

​		lt()方法：

![1631025068317](/assets/MyBatisPlus.assets/1631025068317.png)

​		condition为boolean类型，返回true，则添加条件，返回false则不添加条件



### 3.4 查询投影

​		只查询出指定内容的数据。

```java
    void testGetAll(){
        LambdaQueryWrapper<User> lqw = new LambdaQueryWrapper<User>();
        lqw.select(User::getId,User::getName,User::getAge);
        List<User> userList = userDao.selectList(lqw);
        System.out.println(userList);
    }
```

​		如果使用的不是lambda，就需要手动指定字段

```java
    void testGetAll(){
        QueryWrapper<User> lqw = new QueryWrapper<User>();
        lqw.select("id","name","age","tel");
        List<User> userList = userDao.selectList(lqw);
        System.out.println(userList);
    }
```

* select(...)方法用来设置查询的字段列，可以设置多个，最终的sql语句为:

  ```sql
  SELECT id,name,age FROM user
  ```

> 起别名会导致查询失败。
>
> 例如，给`name`起别名`姓名`，在user中找不到`姓名`这个属性，导致封装到类中会封装失败。



### 3.5 聚合查询

```java
    void select() {
        QueryWrapper qw=new QueryWrapper();
        qw.select("count(*) as Count");
        List<Map<String, Object>> userList = userDao.selectMaps(qw);
        System.out.println(userList);
    }
```

![image-20240719154537386](/assets/MyBatisPlus.assets/image-20240719154537386.png)



### 3.6 分组查询

```java
    void select() {
        QueryWrapper qw=new QueryWrapper();
        qw.select("count(*) as Count,age");
        qw.groupBy("age");
        List<Map<String, Object>> userList = userDao.selectMaps(qw);
        System.out.println(userList);
    }
```

![image-20240719154957142](/assets/MyBatisPlus.assets/image-20240719154957142.png)



### 3.7 其他查询条件

#### 3.7.1 等值查询

```java
    @Test
    void testSelect(){
        LambdaQueryWrapper<User> lqw=new LambdaQueryWrapper<User>();
        lqw.eq(User::getName,"Lysssyo");
        User user = userDao.selectOne(lqw);
        System.out.println(user);
    }
```

> 查询结果为单行数据时使用`selectOne()`



#### 3.7.2 范围查询

​		lt()、le()、gt()、ge()、between()

> * lt():小于(<)
> * le():小于等于(<=)
> * gt():大于(>)
> * ge():大于等于(>=)
> * between():between ? and ?

```java
    @Test
    void testSelect() {
        LambdaQueryWrapper<User> lqw = new LambdaQueryWrapper<User>();
        lqw.between(User::getAge, 3, 4);
        List<User> users = userDao.selectList(lqw);
        System.out.println(users);
    }
```

![image-20240724165004703](/assets/MyBatisPlus.assets/image-20240724165004703.png)



#### 3.7.3 模糊查询

​	例如：查询表中name属性的值以`J`开头的用户信息,使用like进行模糊查询

* like():前后加百分号,如 %J%
* likeLeft():前面加百分号,如 %J
* likeRight():后面加百分号,如 J%



#### 3.7.4 排序查询

![image-20240724165702078](/assets/MyBatisPlus.assets/image-20240724165702078.png)

* orderBy()
  * condition：条件，true则添加排序，false则不添加排序
  * isAsc：是否为升序，true升序，false降序
  * columns：排序字段，可以有多个
* orderByASC()，orderByDesc()
  * 函数有重载版本，可以指定condition，也可以不指定
  * column（需要排序的列）可以有多个

```java
    @Test
    void testGetAll(){
        LambdaQueryWrapper<User> lwq = new LambdaQueryWrapper<>();
        /**
         * condition ：条件，返回boolean，
         当condition为true，进行排序，如果为false，则不排序
         * isAsc:是否为升序，true为升序，false为降序
         * columns：需要操作的列
         */
        lwq.orderBy(true,true, User::getId);

        userDao.selectList(lwq);
    }
```



### 3.8 分页查询

1. 配置MyBatisPlus拦截器

```java
@Configuration
public class MyBatisPlusConfig {
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor(){
        //1 创建MybatisPlusInterceptor拦截器对象
        MybatisPlusInterceptor mpInterceptor=new MybatisPlusInterceptor();
        //2 添加分页拦截器
        mpInterceptor.addInnerInterceptor(new PaginationInnerInterceptor());
        return mpInterceptor;
    }
}
```

2. 调用MyBatisPlus的方法

   例一：

   ```java
       void testSelectPage(){
           //1 创建IPage分页对象,设置分页参数,1为当前页码，3为每页显示的记录数
           IPage<User> page=new Page<>(1,3);
           //2 执行分页查询
           userDao.selectPage(page,null);
           //3 获取分页结果
           System.out.println("当前页码值："+page.getCurrent());
           System.out.println("每页显示数："+page.getSize());
           System.out.println("一共多少页："+page.getPages());
           System.out.println("一共多少条数据："+page.getTotal());
           System.out.println("数据："+page.getRecords());
       }
   ```

   例二：

   ```java
       void testCourseBaseMapper() {
           
           LambdaQueryWrapper<CourseBase> queryWrapper = new LambdaQueryWrapper<>();
           //查询条件
           QueryCourseParamsDto queryCourseParamsDto = new QueryCourseParamsDto();
           queryCourseParamsDto.setCourseName("java");
           queryCourseParamsDto.setAuditStatus("202004");
           queryCourseParamsDto.setPublishStatus("203001");
   
           //拼接查询条件
           //根据课程名称模糊查询  name like '%名称%'
           queryWrapper.like(
                   StringUtils.isNotEmpty(queryCourseParamsDto.getCourseName()),
                   CourseBase::getName,
                   queryCourseParamsDto.getCourseName());
           //根据课程审核状态
           queryWrapper.eq(
                   StringUtils.isNotEmpty(queryCourseParamsDto.getAuditStatus()), 
                   CourseBase::getAuditStatus, 
                   queryCourseParamsDto.getAuditStatus());
   
           //分页参数
           PageParams pageParams = new PageParams();
           pageParams.setPageNo(1L);//页码
           pageParams.setPageSize(3L);//每页记录数
           Page<CourseBase> page = new Page<>(pageParams.getPageNo(), pageParams.getPageSize());
   
           //分页查询E page 分页参数, @Param("ew") Wrapper<T> queryWrapper 查询条件
           Page<CourseBase> pageResult = courseBaseMapper.selectPage(page, queryWrapper);
   
           //数据
           List<CourseBase> items = pageResult.getRecords();
           //总记录数
           long total = pageResult.getTotal();
   
           //准备返回数据 List<T> items, long counts, long page, long pageSize
           PageResult<CourseBase> courseBasePageResult = 
               new PageResult<>(items, total, pageParams.getPageNo(), pageParams.getPageSize());
           System.out.println(courseBasePageResult);
       }
   ```

如果想查看MP执行的SQL语句，可以修改application.yml配置文件，

```yml
mybatis-plus:
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl #打印SQL日志到控制台
```

打开日志后，就可以在控制台打印出对应的SQL语句，开启日志功能性能就会受到影响，调试完后记得关闭。

![1631019896688](/assets/MyBatisPlus.assets/1631019896688.png)



### 3.9 批量查询

```java
List<T> selectBatchIds(@Param(Constants.COLLECTION) Collection<? extends Serializable> idList);
```







## 4. 映射匹配兼容性

​		**MyBatisPlus如何知道数据库表的信息？**

​		MyBatisPlus通过扫描实体类，并基于反射获取实体类信息作为数据库表信息。

> 类名驼峰转下划线作为表名
>
> > 例如类为`userInfo`，找表就找`user_info`
>
> 名为id的字段作为主键
>
> 变量名驼峰转下划线作为表的字段名
>
> > 例如变量名为`createTime`，找表字段就找`create_time`

​		如果类、表不满足上述约定，需要自己配置

### 4.1 表字段与编码属性设计不同步

​		MyBatisPlus给我们提供了一个注解`@TableField`，使用该注解可以实现模型类属性名和表的列名之间的映射关系

![image-20240724170304028](/assets/MyBatisPlus.assets/image-20240724170304028.png)

​		实际的sql：`select pwd as password from user;`

​		相当于把模型类属性名作为别名，真正查询的是表字段名

​		除了表字段与编码属性设计不同步，以下情况也要使用`@TableField`

​		1. 类属性为is开头的且为boolean类型的，例如`Boolean isMarried`。MyBatisPlus在底层会把这个变量名去掉is转为`Married`。所以这种也要加`@TableField`

​		2. 成员变量名与数据库关键字冲突，例如`Inter order`，与MySQL的`order by`冲突，所以`order`也要加@TableField，即`@TableField(value="'order'")`（加上转义字符`）



### 4.2 编码中添加了数据库中未定义的属性

​		当模型类中多了一个数据库表不存在的字段，就会导致生成的sql语句中在select的时候查询了数据库不存在的字段，程序运行就会报错，错误信息为:

​		==Unknown column '多出来的字段名称' in 'field list'==

![image-20240724171408848](/assets/MyBatisPlus.assets/image-20240724171408848.png)

​		具体的解决方案用到的还是`@TableField`注解，它有一个属性叫`exist`，设置该字段是否在数据库表中存在，如果设置为false则不存在，生成sql语句查询的时候，就不会再查询该字段了。

![1631031054206](/assets/MyBatisPlus.assets/1631031054206.png)

### 4.3 采用默认查询开放了更多的字段查看权限

​		查询表中所有的列的数据，就可能把一些敏感数据查询到返回给前端，这个时候我们就需要限制哪些字段默认不要进行查询。解决方案是`@TableField`注解的一个属性叫`select`，该属性设置默认是否需要查询该字段的值，true(默认值)表示默认查询该字段，false表示默认不查询该字段。

![image-20240724171750928](/assets/MyBatisPlus.assets/image-20240724171750928.png)

### 4.4 表名与编码开发设计不同步

![image-20240724171832473](/assets/MyBatisPlus.assets/image-20240724171832473.png)



### 4.5 表主键与类中主键命名不一致

![image-20240725170351257](/assets/MyBatisPlus.assets/image-20240725170351257.png)

> 如果表中的主键名字不为id，需要用注解指定
>
> @TableId其他作用见5.1节



### 4.6 总结

#### 4.6.1 @TableField

| 名称     | @TableField                                                  |
| -------- | ------------------------------------------------------------ |
| 类型     | ==属性注解==                                                 |
| 位置     | 模型类属性定义上方                                           |
| 作用     | 设置当前属性对应的数据库表中的字段关系                       |
| 相关属性 | value(默认)：设置数据库表字段名称<br/>exist:设置属性在数据库表字段中是否存在，默认为true，此属性不能与value合并使用<br/>select:设置属性是否参与查询，此属性与select()映射配置不冲突 |

#### 4.6.2 @TableName

| 名称     | @TableName                    |
| -------- | ----------------------------- |
| 类型     | ==类注解==                    |
| 位置     | 模型类定义上方                |
| 作用     | 设置当前类对应于数据库表关系  |
| 相关属性 | value(默认)：设置数据库表名称 |

#### 4.6.3 @TableId

| 名称     | @TableId                           |
| -------- | ---------------------------------- |
| 类型     | ==属性注解==                       |
| 位置     | 模型类属性定义上方                 |
| 作用     | 设置当前属性对应的数据库表中的主键 |
| 相关属性 | value(默认)：设置数据库表的主键名  |









## 5. ID生成

### 5.0 插入操作

```java
    @Test
    void insertTest(){
        User user=new User();
        user.setName("Tom888");
        user.setAge(20);
        user.setPassword("tom888");
        user.setTel("18666666666");
        userDao.insert(user);
    }
```



### 5.1 ID生成策略

#### 5.1.1 生成策略详解

<img src="/assets/MyBatisPlus.assets/image-20240724174638149.png" alt="image-20240724174638149" style="zoom: 67%;">

- `AUTO`的作用是**使用数据库ID自增**，在使用该策略的时候一定要**确保对应的数据库表设置了ID主键自增**，否则无效。
- 其他的几个策略均已过时，都将被ASSIGN_ID和ASSIGN_UUID代替掉。
- 使用ASSIGN_ID或ASSIGN_UUID不应该手工指定id，不然生成的id会被手工指定的id代替
- 使用uuid需要注意的是，主键的类型不能是Long，而应该改成String类型
- **如果没有指定策略，默认`ASSIGB_ID`**



#### 5.1.2 雪花算法

​		雪花算法(SnowFlake),是Twitter官方给出的算法实现 是用Scala写的。其生成的结果是一个64bit大小整数，它的结构如下图：

![1631243987800](/assets/MyBatisPlus.assets/1631243987800.png)

1. 1bit,不用,因为二进制中最高位是符号位，1表示负数，0表示正数。生成的id一般都是用整数，所以最高位固定为0。
2. 41bit-时间戳，用来记录时间戳，毫秒级
3. 10bit-工作机器id，用来记录工作机器id,其中高位5bit是数据中心ID其取值范围0-31，低位5bit是工作节点ID其取值范围0-31，两个组合起来最多可以容纳1024个节点
4. 序列号占用12bit，每个节点每毫秒0开始不断累加，最多可以累加到4095，一共可以产生4096个ID



#### 5.1.3 ID生成策略对比

* NONE: 不设置id生成策略，MP不自动生成，约等于INPUT，所以这两种方式都需要用户手动设置，但是手动设置第一个问题是容易出现相同的ID造成主键冲突，为了保证主键不冲突就需要做很多判定，实现起来比较复杂

* AUTO:数据库ID自增,这种策略适合在数据库服务器只有1台的情况下使用,不可作为分布式ID使用

* ASSIGN_UUID:可以在分布式的情况下使用，而且能够保证唯一，但是生成的主键是32位的字符串，长度过长占用空间而且还不能排序，查询性能也慢

* ASSIGN_ID:可以在分布式的情况下使用，生成的是Long类型的数字，可以排序性能也高，但是生成的策略和服务器时间有关，如果修改了系统时间就有可能导致出现重复主键

  综上所述，每一种主键策略都有自己的优缺点，根据自己项目业务的实际情况来选择使用才是最明智的选择。



## 6. 配置文件简化注解配置

### 6.1 模型类主键策略设置

​		如果要在项目中的每一个模型类上都需要使用相同的生成策略，稍微有点繁琐![1631245676125](/assets/MyBatisPlus.assets/1631245676125.png)

​		改为使用配置文件：

```yml
mybatis-plus:
  global-config:
    db-config:
    	id-type: assign_id
```

​		配置完成后，每个模型类的主键ID策略都将成为assign_id



### 6.2 数据库表与模型类的映射关系

​		MyBatisPlus会默认将模型类的类名名首字母小写作为表名使用，假如数据库表的名称都以`tbl_`开头，那么我们就需要将所有的模型类上添加`@TableName`，如:

![1631245757169](/assets/MyBatisPlus.assets/1631245757169.png)

​		配置起来还是比较繁琐，简化方式为在配置文件中配置如下内容:

```yml
mybatis-plus:
  global-config:
    db-config:
    	table-prefix: tbl_
```

​		设置表的前缀内容，这样MP就会拿 `tbl_`加上模型类的首字母小写，就刚好组装成数据库的表名。

#### 5.2.3 其他配置

​		MyBatisPlus的配置项继承了MyBatis原生配置和一些自己特有的配置。例如:

<img src="/assets/MyBatisPlus.assets/image-20240725173025461.png" alt="image-20240725173025461" style="zoom:80%;">





## 7. 逻辑删除

​		有时候，某个表的数据不是希望真正的删除，而是让数据不被使用、不被统计，而不是真正把它删了，这时候就用到“逻辑删除”

​		**逻辑删除的本质其实是修改操作。如果加了逻辑删除字段，查询数据时也会自动带上逻辑删除字段。**

**@TableLogic**

| 名称     | @TableLogic                                |
| -------- | ------------------------------------------ |
| 类型     | ==属性注解==                               |
| 位置     | 模型类中用于表示删除字段的属性定义上方     |
| 作用     | 标识该字段为进行逻辑删除的字段             |
| 相关属性 | value：逻辑未删除值<br/>delval：逻辑删除值 |

​		例如：

![image-20240724205730850](/assets/MyBatisPlus.assets/image-20240724205730850.png)

​		员工与合同为一对多关系。

​		员工ID为1的张业绩，总共签了三个合同，如果此时他离职了，我们需要将员工表中的数据进行删除，会执行delete操作。如果表在设计的时候有主外键关系，那么同时也得将合同表中的前三条数据也删除掉。

​		后期要统计所签合同的总金额，就会发现对不上，原因是已经将员工1签的合同信息删除掉了。如果只删除员工不删除合同表数据，那么合同的员工编号对应的员工信息不存在，那么就会出现垃圾数据，就会出现无主合同，根本不知道有张业绩这个人的存在。所以经过分析，我们不应该将表中的数据删除掉，而是需要进行保留，但是又得把离职的人和在职的人进行区分，这样就解决了上述问题，如：

![image-20240724205830729](/assets/MyBatisPlus.assets/image-20240724205830729.png)

​		区分的方式，就是在员工表中添加一列数据`deleted`，如果为0说明在职员工，如果离职则将其改完1（0和1所代表的含义是可以自定义的）

**步骤1：修改数据库表添加`deleted`列**

字段名可以任意，内容也可以自定义，比如`0`代表正常，`1`代表删除，可以在添加列的同时设置其默认值为`0`正常。

<img src="/assets/MyBatisPlus.assets/1631247439168.png" alt="1631247439168" style="zoom: 80%;">

**步骤2：实体类添加属性**

(1)添加与数据库表的列对应的一个属性名，名称可以任意，如果和数据表列名对不上，可以使用@TableField进行关系映射，如果一致，则会自动对应。

(2)标识新增的字段为逻辑删除字段，使用`@TableLogic`

```java
@Data
//@TableName("tbl_user") 可以不写是因为配置了全局配置
public class User {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    @TableField(value="pwd",select=false)
    private String password;
    private Integer age;
    private String tel;
    @TableField(exist=false)
    private Integer online;
    @TableLogic(value="0",delval="1")
    //value为正常数据的值，delval为删除数据的值
    private Integer deleted;
}
```

**步骤3：运行删除方法**

```java
    @Test
    void deleteTest(){
       QueryWrapper qw=new QueryWrapper();
        List users = userDao.selectList(qw);
        System.out.println(users);
        userDao.deleteById(5L);
    }
```

![1631247818327](/assets/MyBatisPlus.assets/1631247818327.png)

​		从测试结果来看，逻辑删除最后走的是update操作，会将指定的字段修改成删除状态对应的值。

**思考**

逻辑删除，对查询有没有影响呢?

* 执行查询操作

  ```java
      @Test
      void testFind(){
         System.out.println(userDao.selectList(null));
      }
  ```

  运行测试，会发现打印出来的sql语句中会多一个查询条件，如:

  ![1631248019999](/assets/MyBatisPlus.assets/1631248019999.png)

  可想而知，MP的逻辑删除会将所有的查询都添加一个未被删除的条件，也就是已经被删除的数据是不应该被查询出来的。

* 如果还是想把已经删除的数据都查询出来该如何实现呢?

  ```java
  @Mapper
  public interface UserDao extends BaseMapper<User> {
      //查询所有数据包含已经被删除的数据
      @Select("select * from tbl_user")
      public List<User> selectAll();
  }
  ```

* 如果每个表都要有逻辑删除，那么就需要在每个模型类的属性上添加`@TableLogic`注解，如何优化?

  在配置文件中添加全局配置，如下:

  ```yml
  mybatis-plus:
    global-config:
      db-config:
        # 逻辑删除字段名
        logic-delete-field: deleted
        # 逻辑删除字面值：未删除为0
        logic-not-delete-value: 0
        # 逻辑删除字面值：删除为1
        logic-delete-value: 1
  ```

​		值得注意的是，加了@TableLogic注解后，MyBatisPlus的delete方法就都变成逻辑删除了（对于加了注解的类而言）



## 8. 乐观锁

### 8.1 业务背景

* 假如有100个商品或者票在出售，为了能保证每个商品或者票只能被一个人购买，如何保证不会出现超买或者重复卖
* 对于这一类问题，其实有很多的解决方案可以使用
* 第一个最先想到的就是锁，锁在一台服务器中是可以解决的，但是如果在多台服务器下锁就没有办法控制，比如12306有两台服务器在进行卖票，在两台服务器上都添加锁的话，那也有可能会导致在同一时刻有两个线程在进行卖票，还是会出现并发问题
* 我们接下来介绍的这种方式是针对于小型企业的解决方案，因为数据库本身的性能就是个瓶颈，如果对其并发量超过2000以上的就需要考虑其他的解决方案了。

简单来说，乐观锁主要解决的问题是当要更新一条记录的时候，希望这条记录没有被别人更新。

### 8.2 实现思路

​		修改操作用这样的sql语句：

```sql
==>  Preparing: UPDATE user SET password=?, version=? WHERE id=? AND version=? AND if_delete=0
==> Parameters: 123456(String), 2(Integer), 8(Long), 1(Integer)
<==    Updates: 1
```

​		表中增加一个字段，设为version，不同的线程对表做更新操作时，都要把version+1

​		线程每次调用updateById(@Param User entity)更新数据时，都要根据参数user的属性`version`判断能否修改，如果参数user的属性`version`不等于表中的version字段的值，很显然根据sql的where条件，无法更新。

### 8.3 具体实现

**步骤1：数据库表添加列**

列名可以任意，比如使用`version`，给列设置默认值为`1`

![1631249913103](/assets/MyBatisPlus.assets/1631249913103.png)

**步骤2：在模型类中添加对应的属性**

根据添加的字段列名，在模型类中添加对应的属性值

```java
@Data
//@TableName("tbl_user") 可以不写是因为配置了全局配置
public class User {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    @TableField(value="pwd",select=false)
    private String password;
    private Integer age;
    private String tel;
    @TableField(exist=false)
    private Integer online;
    private Integer deleted;
    @Version
    private Integer version;
}
```

**步骤3：添加乐观锁的拦截器**

```java
@Configuration
public class MpConfig {
    @Bean
    public MybatisPlusInterceptor mpInterceptor() {
        //1.定义Mp拦截器
        MybatisPlusInterceptor mpInterceptor = new MybatisPlusInterceptor();
        //2.添加乐观锁拦截器
        mpInterceptor.addInnerInterceptor(new OptimisticLockerInnerInterceptor());
        return mpInterceptor;
    }
}
```

**步骤4：执行更新操作**

```java
    //错误的，没有携带version参数
	@Test
    void testUpdate(){
       User user = new User();
        user.setId(3L);
        user.setName("Jock666");
        userDao.updateById(user);
    }
```

<img src="/assets/MyBatisPlus.assets/image-20240724215115865.png" alt="image-20240724215115865" style="zoom:80%;">

```java
	//修改
    @Test
    void testUpdate(){
        User user = new User();
        user.setId(3L);
        user.setName("Jock666");
        user.setVersion(1);
        userDao.updateById(user);
    }
```

<img src="/assets/MyBatisPlus.assets/1631252393659.png" alt="1631252393659" style="zoom:80%;">

参考文档：

`https://mp.baomidou.com/guide/interceptor-optimistic-locker.html#optimisticlockerinnerinterceptor`



## 9. 自定义SQL

​		我们可以利用MyBatisPlus的Wrapper来构建复杂的Where条件，然后自己定义SQL语句中剩下的部分。

**用法：**

1. 基于Wrapper构建where条件

```Java
@Test
void testCustomWrapper() {
    // 1.准备自定义查询条件
    List<Long> ids = List.of(1L, 2L, 4L);
    QueryWrapper<User> wrapper = new QueryWrapper<User>().in("id", ids);

    // 2.调用mapper的自定义方法，直接传递Wrapper
    userMapper.deductBalanceByIds(200, wrapper);
}
```

2. 在mapper方法参数中用Param注解声明wrapper变量名称，必须是ew

```Java
public interface UserMapper extends BaseMapper<User> {
    void deductBalanceByIds(@Param("money") int money, @Param("ew") QueryWrapper<User> wrapper);
}
```

3. 自定义SQL，并使用Wrapper条件

```xml
<update id="deductBalanceByIds">
    UPDATE user SET balance = balance - #{money} ${ew.customSqlSegment}
</update>
```



## 10. 代码生成器

1. 导入包

```xml
        <!--代码生成器-->
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-generator</artifactId>
            <version>3.4.1</version>
        </dependency>

        <!--velocity模板引擎-->
        <dependency>
            <groupId>org.apache.velocity</groupId>
            <artifactId>velocity-engine-core</artifactId>
            <version>2.3</version>
        </dependency>
```

2. 使用

```java
public class CodeGenerator {
    public static void main(String[] args) {
        //1.获取代码生成器的对象
        AutoGenerator autoGenerator = new AutoGenerator();

        //设置数据库相关配置
        DataSourceConfig dataSource = new DataSourceConfig();
        dataSource.setDriverName("com.mysql.cj.jdbc.Driver");
        dataSource.setUrl("jdbc:mysql://localhost:3306/mybatisplus_db");
        dataSource.setUsername("root");
        dataSource.setPassword("123456");
        autoGenerator.setDataSource(dataSource);

        //设置全局配置
        GlobalConfig globalConfig = new GlobalConfig();
        globalConfig.setOutputDir(System.getProperty("user.dir")+"/MyBatisDemo/src/main/java");    
        //设置代码生成位置
        globalConfig.setOpen(false);    //设置生成完毕后是否打开生成代码所在的目录
        globalConfig.setAuthor("黑马程序员");    //设置作者
        globalConfig.setFileOverride(true);     //设置是否覆盖原始生成的文件
        globalConfig.setMapperName("%sDao");    //设置数据层接口名，%s为占位符，指代模块名称
        globalConfig.setIdType(IdType.ASSIGN_ID);   //设置Id生成策略
        autoGenerator.setGlobalConfig(globalConfig);

        //设置包名相关配置
        PackageConfig packageInfo = new PackageConfig();
        packageInfo.setParent("com.ccc");   //设置生成的包名，与代码所在位置不冲突，二者叠加组成完整路径
        packageInfo.setEntity("domain");    //设置实体类包名
        packageInfo.setMapper("dao");   //设置数据层包名
        autoGenerator.setPackageInfo(packageInfo);

        //策略设置
        StrategyConfig strategyConfig = new StrategyConfig();
        strategyConfig.setInclude("user");  //设置当前参与生成的表名，参数为可变参数
        //strategyConfig.setTablePrefix("tbl_");  
        //设置数据库表的前缀名称，模块名 = 数据库表名 - 前缀名  例如： User = tbl_user - tbl_
        strategyConfig.setRestControllerStyle(true);    //设置是否启用Rest风格
        strategyConfig.setVersionFieldName("version");  //设置乐观锁字段名
        strategyConfig.setLogicDeleteFieldName("if_delete");  //设置逻辑删除字段名
        strategyConfig.setEntityLombokModel(true);  //设置是否启用lombok
        autoGenerator.setStrategy(strategyConfig);
        //2.执行生成操作
        autoGenerator.execute();
    }
}
```

例二：

```java
public class ContentCodeGenerator {

	// 服务名
	private static final String SERVICE_NAME = "content";
	// 数据库账号
	private static final String DATA_SOURCE_USER_NAME  = "root";
	// 数据库密码
	private static final String DATA_SOURCE_PASSWORD  = "123";
	// 生成的表
	private static final String[] TABLE_NAMES = new String[]{
			"course_base",
			"course_market",
			"course_teacher",
			"course_category",
			"teachplan",
			"teachplan_media",
			"course_publish",
			"course_publish_pre"
	};

	// 默认生成entity，需要生成DTO修改此变量
	// 一般情况下要先生成 DTO 类 然后修改此参数再生成 PO 类。
	private static final Boolean IS_DTO = false;

	public static void main(String[] args) {
		// 代码生成器
		AutoGenerator autoGenerator = new AutoGenerator();
		// 选择 freemarker 引擎，默认 Velocity（需要添加依赖）
		autoGenerator.setTemplateEngine(new FreemarkerTemplateEngine());

		// 全局配置
		GlobalConfig globalConfig = new GlobalConfig();
		globalConfig.setFileOverride(true);
		globalConfig.setOutputDir(System.getProperty("user.dir") 
                                  + "/xuecheng-plus-generator/src/main/java");
		globalConfig.setAuthor("itcast");
		globalConfig.setOpen(false);
		globalConfig.setSwagger2(false); //不使用Swagger2的注解，即@Api等，生成DTO的时候才打开，因为DTO需要和前端交互
		globalConfig.setServiceName("%sService");
		globalConfig.setBaseResultMap(true); // 自动生成BaseResultMap，具体见下
		globalConfig.setBaseColumnList(true);// 自动生成BaseColumnList，具体见下

		if (IS_DTO) {
			globalConfig.setSwagger2(true);
			globalConfig.setEntityName("%sDTO");
		}
		autoGenerator.setGlobalConfig(globalConfig);

		// 数据库配置
		DataSourceConfig dataSourceConfig = new DataSourceConfig();
		dataSourceConfig.setDbType(DbType.MYSQL);
		dataSourceConfig.setUrl("jdbc:mysql://localhost:3306/xc166_" + SERVICE_NAME
				+ "?serverTimezone=UTC&useUnicode=true&useSSL=false&" +
				"characterEncoding=utf8&allowPublicKeyRetrieval=true");
		dataSourceConfig.setDriverName("com.mysql.cj.jdbc.Driver");
		dataSourceConfig.setUsername(DATA_SOURCE_USER_NAME);
		dataSourceConfig.setPassword(DATA_SOURCE_PASSWORD);
		autoGenerator.setDataSource(dataSourceConfig);

		// 包配置
		PackageConfig packageConfig = new PackageConfig();
		packageConfig.setModuleName(SERVICE_NAME);
		packageConfig.setParent("com.xuecheng");//parent + moduleName = 生成的代码的位置
		packageConfig.setServiceImpl("service.impl"); //service的impl在 parent.moudleName.service.impl
		packageConfig.setXml("mapper");
		packageConfig.setEntity("model.po");
		autoGenerator.setPackageInfo(packageConfig);


		// 设置模板
		TemplateConfig templateConfig = new TemplateConfig();
		autoGenerator.setTemplate(templateConfig);

		// 策略配置
		StrategyConfig strategy = new StrategyConfig();
		strategy.setNaming(NamingStrategy.underline_to_camel);// 表名转类名时表的的下划线命名转为驼峰命名
		strategy.setColumnNaming(NamingStrategy.underline_to_camel);// 字段名从下划线命名转为属性的驼峰命名
		strategy.setEntityLombokModel(true);
		strategy.setRestControllerStyle(true);
		strategy.setInclude(TABLE_NAMES);
		strategy.setControllerMappingHyphenStyle(true);
		strategy.setTablePrefix(packageConfig.getModuleName() + "_");//设置表前缀，去除生成类名时不需要的表前缀
		strategy.setEntityBooleanColumnRemoveIsPrefix(false);// Boolean类型字段是否移除is前缀处理
		strategy.setRestControllerStyle(true);


		// 自动填充字段配置
		strategy.setTableFillList(Arrays.asList(
				new TableFill("create_date", FieldFill.INSERT),
				new TableFill("change_date", FieldFill.INSERT_UPDATE),
				new TableFill("modify_date", FieldFill.UPDATE)
		));
		autoGenerator.setStrategy(strategy);

		autoGenerator.execute();
	}
}
```

> <img src="/assets/MyBatisPlus.assets/image-20240906113809852.png" alt="image-20240906113809852" style="zoom:80%;">
>
> `freemarker`依赖：
>
> ```xml
>      <!-- spring boot 的 freemark 模板引擎 -->
>      <dependency>
>          <groupId>org.springframework.boot</groupId>
>          <artifactId>spring-boot-starter-freemarker</artifactId>
>      </dependency>
> ```

## 11. 枚举处理器

### 11.1 业务背景

​		User类中有一个用户状态字段：

<img src="/assets/MyBatisPlus.assets/image-20240725231210325.png" alt="image-20240725231210325" style="zoom:67%;">

​		像这种字段我们一般会定义一个枚举，做业务判断的时候就可以直接基于枚举做比较。但是我们数据库采用的是`int`类型，对应的PO也是`Integer`。因此业务操作时必须手动把`枚举`与`Integer`转换，非常麻烦。

​		因此，MybatisPlus提供了一个处理枚举的类型转换器，可以帮我们**把枚举类型与数据库类型自动转换**。

### 11.2 具体实现

添加配置：

```yaml
mybatis-plus:
  configuration:
    default-enum-type-handler: com.baomidou.mybatisplus.core.handlers.MybatisEnumTypeHandler
```

我们定义一个用户状态的枚举：

```java
@Getter
public enum UserStatus {
    NORMAL(1, "正常"),
    FREEZE(2, "冻结");
    
    //要让MybatisPlus处理枚举与数据库类型自动转换，我们必须告诉MybatisPlus，枚举中的哪个字段的值作为数据库值。 			     //MybatisPlus提供了@EnumValue注解来标记枚举属性
	@EnumValue
    private final int value;
    private final String desc;

    UserStatus(int value, String desc) {
        this.value = value;
        this.desc = desc;
    }
}
```

然后把`User`类中的`status`字段改为`UserStatus` 类型：

<img src="/assets/MyBatisPlus.assets/image-20240725231348158.png" alt="image-20240725231348158" style="zoom:50%;">

测试：

```java
    @Test
    void testService() {
        List<User> users = userMapper.selectList(null);
        users.forEach(System.out::println);
    }
```

![image-20240725234927338](/assets/MyBatisPlus.assets/image-20240725234927338.png)



## 12. JSON处理器

### 12.1 业务背景

数据库的user表中有一个`info`字段，是JSON类型：

<img src="/assets/MyBatisPlus.assets/image-20240726145348316.png" alt="image-20240726145348316" style="zoom:80%;">

> 格式：
>
> ```json
> {"age": 20, "intro": "佛系青年", "gender": "male"}
> ```

而目前`User`实体类中却是`String`类型：

<img src="/assets/MyBatisPlus.assets/image-20240726145426308.png" alt="image-20240726145426308" style="zoom:80%;">

这样一来，我们要读取info中的属性时就非常不方便。如果要方便获取，info的类型最好是一个`Map`或者实体类。

而一旦我们把`info`改为`对象`类型，就需要在写入数据库时手动转为`String`，再读取数据库时，手动转换为`对象`，这会非常麻烦。

因此MybatisPlus提供了很多特殊类型字段的类型处理器，解决特殊字段类型与数据库类型转换的问题。例如处理JSON就可以使用`JacksonTypeHandler`处理器。

### 12.2 具体实现

**定义实体**

<img src="/assets/MyBatisPlus.assets/image-20240726145509196.png" alt="image-20240726145509196" style="zoom:80%;">

```java
@Data
public class UserInfo {
    private Integer age;
    private String intro;
    private String gender;
}
```



**使用类型处理器**

<img src="/assets/MyBatisPlus.assets/image-20240726145534529.png" alt="image-20240726145534529" style="zoom:80%;">

测试可以发现，所有数据都正确封装到UserInfo当中了

<img src="/assets/MyBatisPlus.assets/image-20240726145632165.png" alt="image-20240726145632165" style="zoom:80%;">
