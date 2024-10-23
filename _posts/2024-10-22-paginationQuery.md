---
title: 传统分页与滚动分页
date: 2024-10-22 18:28:00 +0800
categories: [Java, JavaWeb]
tags: [Java,业务,Redis]
---



## 1. 传统分页

要想从数据库中进行分页查询，我们要使用`LIMIT`关键字。

查询第1页数据的SQL语句是：

```sql
select * from emp  limit 0 , 10;
```

查询第2页数据的SQL语句是：

```sql
select * from emp limit 10 , 10;
```

查询第3页的数据的SQL语句是：

```sql
select * from emp limit 20 , 10;
```

观察以上SQL语句，发现： 开始索引一直在改变 ， 每页显示条数是固定的。

开始索引的计算公式：   **开始索引 = (当前页码 - 1)  *  每页显示条数**

**示例——业务要求：**

- 接口基本信息

  | 字段         | 描述               |
  | ------------ | ------------------ |
  | **路径**     | `/admin/dish/page` |
  | **方法**     | `GET`              |
  | **接口描述** | -                  |


- 请求参数

  | 参数名称       | 是否必须 | 示例值   | 备注         |
  | -------------- | -------- | -------- | ------------ |
  | **page**       | 是       | 1        | 页码         |
  | **pageSize**   | 是       | 10       | 每页记录数   |
  | **name**       | 否       | 鱼香肉丝 | 菜品名称     |
  | **categoryId** | 否       | 1        | 分类ID       |
  | **status**     | 否       | 1        | 菜品启售状态 |


- 返回数据

  | 名称                   | 类型     | 是否必须 | 备注     | 其他信息          |
  | ---------------------- | -------- | -------- | -------- | ----------------- |
  | **code**               | integer  | 必须     | -        | format: int32     |
  | **data**               | object   | 必须     | -        | -                 |
  | ├─ **records**         | object[] | 非必须   | -        | item 类型: object |
  | │  ├─ **id**           | number   | 必须     | -        | -                 |
  | │  ├─ **name**         | string   | 必须     | -        | -                 |
  | │  ├─ **price**        | number   | 必须     | -        | -                 |
  | │  ├─ **image**        | string   | 必须     | -        | -                 |
  | │  ├─ **description**  | string   | 必须     | -        | -                 |
  | │  ├─ **status**       | integer  | 必须     | -        | -                 |
  | │  ├─ **updateTime**   | string   | 必须     | -        | -                 |
  | │  ├─ **categoryName** | string   | 必须     | 分类名称 | -                 |
  | ├─ **total**           | integer  | 必须     | -        | format: int64     |
  | **msg**                | string   | 非必须   | -        | -                 |

**实现：**

1. 实现类

   ```java
   // 实体类
   @Data
   public class DishPageQueryDTO implements Serializable {
       
       private int page;
       private int pageSize;
       private String name;
       private Integer categoryId; //分类id
       private Integer status; //状态 0表示禁用 1表示启用
   
   }
   
   @Data
   @Builder
   @NoArgsConstructor
   @AllArgsConstructor
   public class DishVO implements Serializable {
   
       private Long id;
       //菜品名称
       private String name;
       //菜品分类id
       private Long categoryId;
       //菜品价格
       private BigDecimal price;
       //图片
       private String image;
       //描述信息
       private String description;
       //0 停售 1 起售
       private Integer status;
       //更新时间
       private LocalDateTime updateTime;
       //分类名称
       private String categoryName;
   }
   
   @Data
   @AllArgsConstructor
   @NoArgsConstructor
   public class PageResult implements Serializable {
   
       private long total; //总记录数
   
       private List records; //当前页数据集合
   
   }
   ```

2. controller层

   ```java
   	/**
        * 菜品分页查询
        *
        * @param dishPageQueryDTO
        * @return
        */
       @GetMapping("/page")
       @ApiOperation("菜品分页查询")
       public Result<PageResult> page(DishPageQueryDTO dishPageQueryDTO) {
           log.info("菜品分页查询:{}", dishPageQueryDTO);
           PageResult pageResult = dishService.pageQuery(dishPageQueryDTO);
           return Result.success(pageResult);
       }
   ```

3. service层

   ```java
   	// service层
       public PageResult pageQuery(DishPageQueryDTO dishPageQueryDTO) {
           PageHelper.startPage(dishPageQueryDTO.getPage(), dishPageQueryDTO.getPageSize());
           Page<DishVO> page = dishMapper.pageQuery(dishPageQueryDTO);
           return new PageResult(page.getTotal(), page.getResult());
       }
   ```

   > - 如果不用PageHelper，需要先`select count(*)`获取到总记录数`total`（接口要求传递给前端），然后手动根据`page`和`pageSize`算出SQL的起始索引，然后再根据算到的起始索引和pageSize再写一条SQL进行搜索，最后，还要把`total`和查询到的`list`封装为`PageResult`。
   >
   > - 如果使用PageHelper，在执行`select * from table`时，PageHelper完成了以下工作：
   >
   >   1. 先获取到要执行的SQL语句：`select  *  from  table` 
   >   2. 把SQL语句中的字段列表，变为：`count(*)`
   >   3. 执行SQL语句：`select  count(*)  from  table`          //获取到总记录数
   >   4. 再对要执行的SQL语句：`select  *  from  table` 进行改造，在末尾添加` limit ? , ?`
   >   5. 执行改造后的SQL语句：`select  *  from  tablelimit  ? , ? `
   >
   > - PageHelper依赖
   >
   >   ```xml
   >   <dependency>
   >       <groupId>com.github.pagehelper</groupId>
   >       <artifactId>pagehelper-spring-boot-starter</artifactId>
   >       <version>1.4.2</version>
   >   </dependency>
   >   ```

4. mapper层

   ```java
   	// DishMapper
       Page<DishVO> pageQuery(DishPageQueryDTO dishPageQueryDTO); //要用PageHelper，返回值为Page类型
   ```

   ```xml
   	<!-- DishMapper.xml -->
   <select id="pageQuery" resultType="com.sky.vo.DishVO">
           select d.* , c.name as categoryName from dish d left outer join category c on d.category_id = c.id
           <where>
               <if test="name != null">
                   and d.name like concat('%',#{name},'%')
               </if>
               <if test="categoryId != null">
                   and d.category_id = #{categoryId}
               </if>
               <if test="status != null">
                   and d.status = #{status}
               </if>
           </where>
           order by d.create_time desc
   </select>
   ```

   > `c.name as categoryName`起别名是为了让MyBatis可以正确封装，因为DishVO中的一个成员变量是`categoryName`

   

## 2. 滚动分页

有如下推送业务：每个用户都可以关注若干个博主。博主发推文可以推送给所有用户（把推文推送到关注的用户的收件箱）。用户可以查看通过查收收件箱查看关注的博主发送的推文。

> 这里通过Redis的Sorted Set实现收件箱，因为Sorted Set有排序的功能。

具体如下：当博主发送推文时，推文会被投递到所有用户的收件箱：

![image-20241022184207678](assets/2024-10-22-paginationQuery.assets/image-20241022184207678.png)

在这里，`feed:15`，`feed:16`，`feed:17`分别为userID为15，16，17的用户的收件箱。userID为15的用户的收件箱中有5个推文，推文在数据库中的Id分别为24，25，26，28，29。Score为收到推文的时间戳。

要求用户查收收件箱的推文时，推文的展示时间的排序是由近期至远期。如果用分页查询（角标），每页查询2条推文，第一页为Id为29，28的推文。如果在查询第二页时，有新的推文被推送到了收件箱，那么新的推文会排到最前面，排第0。29排第1，28排第2。此时再查询第二页，就会查到Id为28，26的推文，那么Id为28的推文就被重复查询了。综上，传统的利用角标分页的查询不可用。

> 所以，其实如果新数据是插入表头而不是表尾，那么传统分页查询就会出错。

**滚动分页的关键在于记录上次查询到的最后一条，下次查询时就从记录的“最后一条”的下一条开始**。同样假设每页查询2条推文，第一次查询29，28的推文（可以认为是查询Id为无穷大的推文的下一条），并记录最后一条推文的Id即为28。此时，有新的推文被推送到了收件箱，那么新的推文会排到最前面，排第0。29排第1，28排第2。再查询第二页，从28的下一条开始查询，即查询到28，27。无论有多少被插到最前面，都不影响滚动分页的查询。

**具体实现：**

```
ZREVRANGEBYSCORE key max min [WITHSCORES] [LIMIT offset count]
```

> 查询`key`的`score`在`min`与`max`之前的元素，从第`offset`个大于等于`min`的元素开始查**（第0个大于等于`min`的元素是`min`本身）**，查询`count`个

```
> ZREVRANGEBYSCORE feed:15 9999999999999 0 withscores limit  0 2
29
1729593383369
28
1729593383366
> ZREVRANGEBYSCORE feed:15 1729593383366 0 withscores limit  1 2
26
1729593383365
24
1729515335034
```

考虑如下问题，如果有多个相同时间戳（`score`）的推文：

| ID (Total: 6) | Score         | Member |
| ------------- | ------------- | ------ |
| 1             | 1729593383369 | 29     |
| 2             | 1729593383366 | 28     |
| 3             | 1729593383366 | 33     |
| 4             | 1729593383366 | 34     |
| 5             | 1729593383365 | 26     |
| 6             | 1729515335034 | 24     |

```
> ZREVRANGEBYSCORE feed:15 999999999999999 0 withscores limit  0 3
29
1729593383369
34
1729593383366
33
1729593383366
> ZREVRANGEBYSCORE feed:15 1729593383366 0 withscores limit  1 3
33
1729593383366
28
1729593383366
26
1729593383365
```

可以发现Id为33的推文被重复查询了。因为`ZREVRANGEBYSCORE feed:15 1729593383366 0 withscores limit  1 3`查询的是第1个小于等于`1729593383366`的推文，Id为33的推文是第一个小于等于`1729593383366`的推文。所以`offset`的设置需要依据最后的元素的时间戳的元素的个数。

```
> ZREVRANGEBYSCORE feed:15 999999999999999 0 withscores limit  0 3
29
1729593383369
34
1729593383366
33
1729593383366
> ZREVRANGEBYSCORE feed:15 1729593383366 0 withscores limit  2 3
28
1729593383366
26
1729593383365
24
1729515335034
```

**具体实现：**

| 说明     |                                                              |
| -------- | ------------------------------------------------------------ |
| 请求方式 | GET                                                          |
| 请求路径 | /blog/of/follow                                              |
| 请求参数 | **lastId**：上一次查询的最小时间戳 **offset**：偏移量        |
| 返回值   | **List\<Blog>**：小于指定时间戳的笔记集合 **minTime**：本次查询的推送的最小时间戳 **offset**：偏移量 |

```java
    @GetMapping("/blog/of/follow")
    public Result queryBlogOfFollow(
            @RequestParam("lastId") Long lastMinTimeStamp, 
        	@RequestParam(value = "offset", defaultValue = "0") Integer offset) {
        return blogService.queryBlogOfFollow(lastMinTimeStamp, offset);
    }

	@Override
    public Result queryBlogOfFollow(Long lastMinTimeStamp, Integer offset) {
        UserDTO user = UserHolder.getUser(); // 当前用户
        String key = "feed:" + user.getId();
        Set<ZSetOperations.TypedTuple<String>> typedTuples = stringRedisTemplate
                .opsForZSet().reverseRangeByScoreWithScores(key, 0, lastMinTimeStamp, offset, 3);
        
        if (typedTuples == null || typedTuples.isEmpty()) {
            return Result.ok();
        }
        
        // 返回笔记集合，最小时间戳，偏移量
        // 先拿id集合
        List<Long> ids = new ArrayList<>();
        int reOffset = 1; //返回的偏移量
        long minTimeStamp = 0;
        for (ZSetOperations.TypedTuple<String> typedTuple : typedTuples) {
            Long id = Long.valueOf(Objects.requireNonNull(typedTuple.getValue())); 
            										//Objects.requireNonNull 防止空指针
            ids.add(id);
            long timeStamp = Objects.requireNonNull(typedTuple.getScore()).longValue(); //score为时间戳
            if (timeStamp == minTimeStamp) {
                reOffset++;
            } else if (timeStamp < minTimeStamp) {
                minTimeStamp = timeStamp;
                reOffset = 1;
            }
        }
        
        List<Blog> blogs = blogMapper.queryByIds(ids);
        
        // 6.封装并返回
        ScrollResult r = new ScrollResult();
        r.setList(blogs);
        r.setOffset(reOffset);
        r.setMinTime(minTimeStamp);

        return Result.ok(r);
    }


@Data
public class ScrollResult {
    private List<?> list;
    private Long minTime;
    private Integer offset;
}
```

















