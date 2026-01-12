# ES初始

## 1. 简介

[Elasticsearch：官方分布式搜索和分析引擎 | Elastic](https://www.elastic.co/cn/elasticsearch)

Elasticsearch是由elastic公司开发的一套搜索引擎技术，它是Elastic技术栈中的一部分。完整的技术栈包括：

- Elasticsearch：用于数据存储、计算和搜索
- Logstash/Beats：用于数据收集
- Kibana：用于数据可视化

> Kibana是elastic公司提供的用于操作Elasticsearch的可视化控制台。它的功能非常强大，包括：
>
> - 对Elasticsearch数据的搜索、展示
> - 对Elasticsearch数据的统计、聚合，并形成图形化报表、图形
> - 对Elasticsearch的集群状态监控
> - 它还提供了一个开发控制台（DevTools），在其中对Elasticsearch的Restful的API接口提供了**语法提示**

整套技术栈被称为ELK，经常用来做日志收集、系统监控和状态分析等等。

## 2. 底层原理

Elasticsearch之所以有如此高性能的搜索表现，正是得益于底层的倒排索引技术。那么什么是倒排索引呢？

**倒排索引**的概念是基于MySQL这样的**正向索引**而言的。

### 2.1 正向索引

例如有一张名为`tb_goods`的表：

| **id** | **title** | **price** |
| ------ | --------- | --------- |
| 1      | 小米手机      | 3499      |
| 2      | 华为手机      | 4999      |
| 3      | 华为小米充电器   | 49        |
| 4      | 小米手环      | 49        |
| ...    | ...       | ...       |

其中的**`id`**字段已经创建了**索引**，由于索引底层采用了**B+树**结构，因此我们根据id搜索的速度会非常快。但是其他字段例如**`title`**，只在叶子节点上存在。

因此要根据`title`搜索的时候只能遍历树中的每一个叶子节点，判断title数据是否符合要求。

比如用户的SQL语句为：

```sql
select * from tb_goods where title like '%手机%';
```

那搜索的大概流程如图：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201414022.png)

综上，根据id精确匹配时，可以走索引，查询效率较高。而当搜索条件为模糊匹配时，由于索引无法生效，导致从索引查询退化为全表扫描，效率很差。

因此，正向索引适合于根据索引字段的精确搜索，不适合基于部分词条的模糊匹配。

而倒排索引恰好解决的就是根据部分词条模糊匹配的问题。

### 2.2 倒排索引

倒排索引中有两个非常重要的概念：

- 文档（`Document`）：用来搜索的数据，其中的每一条数据就是一个文档。例如一个网页、一个商品信息
- 词条（`Term`）：对文档数据或用户搜索数据，利用某种算法分词，得到的具备含义的词语就是词条。例如：我是中国人，就可以分为：我、是、中国人、中国、国人这样的几个词条

**创建倒排索引**是对正向索引的一种特殊处理和应用，流程如下：

- 将每一个文档的数据利用**分词算法**根据语义拆分，得到一个个词条
- 创建表，每行数据包括词条、词条所在文档id、位置等信息
- 因为词条唯一性，可以给词条创建**正向**索引

此时形成的这张以词条为索引的表，就是倒排索引表，两者对比如下：

**正向索引**

|**id（索引）**|**title**|**price**|
|---|---|---|
|1|小米手机|3499|
|2|华为手机|4999|
|3|华为小米充电器|49|
|4|小米手环|49|
|...|...|...|

**倒排索引**

|**词条（索引）**|**文档id**|
|---|---|
|小米|1，3，4|
|手机|1，2|
|华为|2，3|
|充电器|3|
|手环|4|

倒排索引的**搜索流程**如下（以搜索"华为手机"为例），如图：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201440632.png)

虽然要先查询倒排索引，再查询倒排索引，但是无论是词条、还是文档id都建立了索引，查询速度非常快！无需全表扫描。

### 2.3 正向和倒排

那么为什么一个叫做正向索引，一个叫做倒排索引呢？

- **正向索引**是最传统的，根据id索引的方式。但根据词条查询时，必须先逐条获取每个文档，然后判断文档中是否包含所需要的词条，是**根据文档找词条的过程**。
- 而**倒排索引**则相反，是先找到用户要搜索的词条，根据词条得到保护词条的文档的id，然后根据id获取文档。是**根据词条找文档的过程**。

**正向索引**：

- 优点：
    - 可以给多个字段创建索引
    - 根据索引字段搜索、排序速度非常快
- 缺点：
    - 根据**非索引字段**，或者**索引字段中的部分词条**查找时，只能全表扫描。

**倒排索引**：

- 优点：
    - 根据词条搜索、模糊搜索时，速度非常快
- 缺点：
    - 只能给词条创建索引，而不是字段
    - 无法根据字段做排序

## 3. 基础概念

### 3.1 文档与字段

Elasticsearch是面向**文档（Document）**存储的，可以是数据库中的一条商品数据，一个订单信息。文档数据会被序列化为`json`格式后存储在`Elasticsearch`中：

![image-20240826151437429.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/image-20240826151437429.png)


```json
{
    "id": 1,
    "title": "小米手机",
    "price": 3499
}
{
    "id": 2,
    "title": "华为手机",
    "price": 4999
}
{
    "id": 3,
    "title": "华为小米充电器",
    "price": 49
}
{
    "id": 4,
    "title": "小米手环",
    "price": 299
}
```

因此，原本数据库中的一行数据就是Elasticsearch中的一个JSON文档；而数据库中每行数据都包含很多列，这些列就转换为JSON文档中的**字段（Field）**。

### 3.2 索引与映射

随着业务发展，需要在es中存储的文档也会越来越多，比如有商品的文档、用户的文档、订单文档等等：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201458527.png)

所有文档都散乱存放显然非常混乱，也不方便管理。

因此，我们要将类型相同的文档集中在一起管理，称为**索引（Index）**。例如：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201505957.png)

- 所有用户文档，就可以组织在一起，称为用户的索引；
- 所有商品的文档，可以组织在一起，称为商品的索引；
- 所有订单的文档，可以组织在一起，称为订单的索引；

因此，我们可以把索引当做是数据库中的表。

数据库的表会有约束信息，用来定义表的结构、字段的名称、类型等信息。因此，索引库中就有**映射（mapping）**，是索引中文档的字段约束信息，类似表的结构约束。

### 3.3 Mysql与Elasticsearch对比

|**MySQL**|**Elasticsearch**|**说明**|
|---|---|---|
|Table|Index|索引(index)，就是文档的集合，类似数据库的表(table)|
|Row|Document|文档（Document），就是一条条的数据，类似数据库中的行（Row），文档都是JSON格式|
|Column|Field|字段（Field），就是JSON文档中的字段，类似数据库中的列（Column）|
|Schema|Mapping|Mapping（映射）是索引中文档的约束，例如字段类型约束。类似数据库的表结构（Schema）|
|SQL|DSL|DSL是elasticsearch提供的JSON风格的请求语句，用来操作elasticsearch，实现CRUD|

> DSL（[Domain Specific Language](https://www.elastic.co/guide/en/elasticsearch/reference/7.12/query-dsl.html)）基于JSON

- Mysql：擅长事务类型操作，可以确保数据的安全和一致性
- Elasticsearch：擅长海量数据的搜索、分析、计算

因此在企业中，往往是两者结合使用：

- 对安全性要求较高的写操作，使用mysql实现
- 对查询性能要求较高的搜索需求，使用elasticsearch实现
- 两者再基于某种方式，实现数据的同步，保证一致性

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201518501.png)

## 4. IK分词器

IK分词器包含两种模式：

- `ik_smart`：智能语义切分
- `ik_max_word`：最细粒度切分

1. Elasticsearch官方提供的标准分词器

    ```json
    POST /_analyze
    {
      "analyzer": "standard",
      "text": "黑马程序员学习java太棒了"
    }
    ```

    结果：

    ```json
    {
      "tokens" : [
        {
          "token" : "黑",
          "start_offset" : 0,
          "end_offset" : 1,
          "type" : "<IDEOGRAPHIC>",
          "position" : 0
        },
        {
          "token" : "马",
          "start_offset" : 1,
          "end_offset" : 2,
          "type" : "<IDEOGRAPHIC>",
          "position" : 1
        },
        // ... (omitted for brevity)
      ]
    }
    ```

    标准分词器智能1字1词条，无法正确对中文做分词。

2. IK分词器

    ```json
    POST /_analyze
    {
      "analyzer": "ik_smart",
      "text": "黑马程序员学习java太棒了"
    }
    ```

    结果：

    ```json
    {
      "tokens" : [
        {
          "token" : "黑马",
          "start_offset" : 0,
          "end_offset" : 2,
          "type" : "CN_WORD",
          "position" : 0
        },
        {
          "token" : "程序员",
          "start_offset" : 2,
          "end_offset" : 5,
          "type" : "CN_WORD",
          "position" : 1
        },
        // ...
      ]
    }
    ```

    可以智能分词

3. 扩展词典

    1）打开IK分词器config目录：`/var/lib/docker/volumes/es-plugins/_data/elasticsearch-analysis-ik-7.12.1/config`

    2）在IKAnalyzer.cfg.xml配置文件内容添加：

    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
    <properties>
            <comment>IK Analyzer 扩展配置</comment>
            <!--用户可以在这里配置自己的扩展字典 *** 添加扩展词典-->
            <entry key="ext_dict">ext.dic</entry>
    </properties>
    ```

    3）在IK分词器的config目录新建一个 `ext.dic`，可以参考config目录下复制一个配置文件进行修改

    ```text
    传智播客
    泰裤辣
    ```

    4）重启elasticsearch

    5）测试

    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201532277.png)

## 5. Mapper映射属性

Mapping是对索引库中文档的约束，常见的Mapping属性包括：

- `type`：字段数据类型，常见的简单类型有：
    - 字符串：`text`（可分词的文本）、`keyword`（精确值，例如：品牌、国家、ip地址）
    - 数值：`long`、`integer`、`short`、`byte`、`double`、`float`
    - 布尔：`boolean`
    - 日期：`date`
    - 对象：`object`
- `index`：是否创建索引，**默认为`true`**
- `analyzer`：使用哪种分词器
- `properties`：该字段的子字段

例如这个文档：

```json
{
    "age": 21,
    "weight": 52.1,
    "isMarried": false,
    "info": "黑马程序员Java讲师",
    "email": "zy@itcast.cn",
    "score": [99.1, 99.5, 98.9],
    "name": {
        "firstName": "云",
        "lastName": "赵"
    }
}
```

对应：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201543433.png)

## 6. DSL实现索引库操作

由于Elasticsearch采用的是Restful风格的API，因此其请求方式和路径相对都比较规范，而且请求参数也都采用JSON风格。

### 6.1 增

```json
PUT /索引库名称
{
  "mappings": {
    "properties": {
      "字段名":{
        "type": "text",
        "analyzer": "ik_smart"
      },
      "字段名2":{
        "type": "keyword",
        "index": "false"
      },
      "字段名3":{
        "properties": {
          "子字段": {
            "type": "keyword"
          }
        }
      }
      // ...略
    }
  }
}
```

### 6.2 删

```
DELETE /索引库名
```

### 6.3 改

倒排索引结构虽然不复杂，但是一旦数据结构改变（比如改变了分词器），就需要重新创建倒排索引，这简直是灾难。因此索引库**一旦创建，无法修改mapping**。

> 改变了分词器会导致拆分的词改变；倒排索引的构建依赖于特定的分词器和数据预处理流程，这些流程会影响最终的索引结构。

虽然无法修改mapping中已有的字段，但是却允许添加新的字段到mapping中，因为不会对倒排索引产生影响。因此修改索引库能做的就是向索引库中添加新字段，或者更新索引库的基础属性。

```json
PUT /索引库名/_mapping
{
  "properties": {
    "新字段名":{
      "type": "integer"
    }
  }
}
```

### 6.4 查

```
GET /索引库名
```

## 7. DSL实现文档操作

### 7.1 增

```json
POST /索引库名/_doc/文档id
{
    "字段1": "值1",
    "字段2": "值2",
    "字段3": {
        "子字段": "值3",
        "子字段": "值4"
    }
}
```

### 7.2 删

```
DELETE /{索引库名}/_doc/id值
```

### 7.3 改

#### 7.3.1 全量修改

全量修改是覆盖原来的文档，其本质是两步操作：

- 根据指定的id删除文档
- 新增一个相同id的文档

**注意**：如果根据id删除时，id不存在，第二步的新增也会执行，也就从修改变成了新增操作了。

```json
PUT /{索引库名}/_doc/文档id
{
    "字段1": "值1",
    "字段2": "值2",
    // ... 略
}
```

#### 7.3.2 局部修改

```json
POST /{索引库名}/_update/文档id
{
    "doc": {
         "字段名": "新的值"
    }
}
```

### 7.4 查

```
GET /{索引库名称}/_doc/{id}
```

### 7.5 批处理

```json
POST _bulk
{ "index" : { "_index" : "test", "_id" : "1" } }
{ "field1" : "value1" }
{ "delete" : { "_index" : "test", "_id" : "2" } }
{ "create" : { "_index" : "test", "_id" : "3" } }
{ "field1" : "value3" }
{ "update" : {"_id" : "1", "_index" : "test"} }
{ "doc" : {"field2" : "value2"} }
```

> **`index`**：可以创建新文档或更新现有文档。
>
> **`create`**：只能创建新文档，如果文档已存在则会失败。

例如：

```json
POST /_bulk
{"index": {"_index":"heima", "_id": "3"}}
{"info": "黑马程序员C++讲师", "email": "ww@itcast.cn", "name":{"firstName": "五", "lastName":"王"}}
{"index": {"_index":"heima", "_id": "4"}}
{"info": "黑马程序员前端讲师", "email": "zhangsan@itcast.cn", "name":{"firstName": "三", "lastName":"张"}}
```

例如：

```json
POST /_bulk
{"delete":{"_index":"heima", "_id": "3"}}
{"delete":{"_index":"heima", "_id": "4"}}
```

## 8. RestClient实现索引库、文档操作

[Java High Level REST Client | Java REST Client 7.12 | Elastic](https://www.elastic.co/guide/en/elasticsearch/client/java-rest/7.12/java-rest-high.html)

### 8.1 初始化

在Elasticsearch提供的API中，与Elasticsearch一切交互都封装在一个名为`RestHighLevelClient`的类中，必须先完成这个对象的初始化，建立与Elasticsearch的连接。

1. 引入`es`的`RestHighLevelClient`依赖

    ```xml
     <properties>
         <elasticsearch.version>7.12.1</elasticsearch.version>
     </properties>
    <dependency>
        <groupId>org.elasticsearch.client</groupId>
        <artifactId>elasticsearch-rest-high-level-client</artifactId>
    </dependency>
    ```

    > SpringBoot默认的ES版本是`7.17.10`

2. 初始化RestHighLevelClient

    ```java
    RestHighLevelClient client = new RestHighLevelClient(RestClient.builder(
            HttpHost.create("http://192.168.150.101:9200")
    ));
    ```

    例如：

    ```java
    public class IndexTest {
    
        private RestHighLevelClient client;
    
        @BeforeEach
        void setUp() {
            this.client = new RestHighLevelClient(RestClient.builder(
                    HttpHost.create("http://192.168.150.101:9200")
            ));
        }
    
        @Test
        void testConnect() {
            System.out.println(client);
        }
    
        @AfterEach
        void tearDown() throws IOException {
            this.client.close();
        }
    }
    ```

    > `@BeforeEach`注释的方法在`@Test`注释的方法执行前执行
    >
    > `@AfterEach`注释的方法在`@Test`注释的方法执行后执行
    >
    > **所有调用ElasticSearch的API方法前后都要加上`setUp()`和`tearDown()`！**

### 8.2 索引库API

例如：有如下的索引库

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201605504.png)

对应的Mapping：

```json
PUT /items
{
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "name":{
        "type": "text",
        "analyzer": "ik_max_word"
      },
      "price":{
        "type": "integer"
      },
      "stock":{
        "type": "integer"
      },
      "image":{
        "type": "keyword",
        "index": false
      },
      "category":{
        "type": "keyword"
      },
      "brand":{
        "type": "keyword"
      },
      "sold":{
        "type": "integer"
      },
      "commentCount":{
        "type": "integer",
        "index": false
      },
      "isAD":{
        "type": "boolean"
      },
      "updateTime":{
        "type": "date"
      }
    }
  }
}
```

#### 8.2.1 增

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201615781.png)

代码分为三步：

- 1）创建Request对象。
    - 因为是创建索引库的操作，因此Request是`CreateIndexRequest`。
        > `import org.elasticsearch.client.indices.CreateIndexRequest;`
- 2）添加请求参数
    - 其实就是Json格式的Mapping映射参数。因为json字符串很长，这里是定义了静态字符串常量`MAPPING_TEMPLATE`，让代码看起来更加优雅。
- 3）发送请求
    - `client.indices()`方法的返回值是`IndicesClient`类型，封装了所有与索引库操作有关的方法。例如创建索引、删除索引、判断索引是否存在等
        > `indices`是`index`的复数

#### 8.2.2 删

与创建索引库相比：

- 请求方式从PUT变为DELTE
- 请求路径不变
- 无请求参数

所以代码的差异，注意体现在Request对象上。流程如下：

- 1）创建Request对象。这次是DeleteIndexRequest对象
- 2）准备参数。这里是无参，因此省略
- 3）发送请求。改用delete方法

```java
@Test
void testDeleteIndex() throws IOException {
    // 1.创建Request对象
    DeleteIndexRequest request = new DeleteIndexRequest("items");
    // 2.发送请求
    client.indices().delete(request, RequestOptions.DEFAULT);
}
```

#### 8.2.3 查

```java
@Test
void testExistsIndex() throws IOException {
    // 1.创建Request对象
    GetIndexRequest request = new GetIndexRequest("items");
    // 2.发送请求
    boolean exists = client.indices().exists(request, RequestOptions.DEFAULT);
    // 3.输出
    System.err.println(exists ? "索引库已经存在！" : "索引库不存在！");
}
```

### 8.3 文档API

#### 8.3.1 增

例如：从`hmall`数据库的`item`表导入到Elasticsearch的`Item`索引库

因为不是`item`表的所有字段都要导入索引库，所以需要新建一个`ItemDoc`实体类。表导入到`ItemDTO`再转为`ItemDoc`

具体过程如下：

```java
@Test
void testAddDocument() throws IOException {
    // 1.根据id查询商品数据
    Item item = itemService.getById(100002644680L);
    // 2.转换为文档类型
    ItemDoc itemDoc = BeanUtil.copyProperties(item, ItemDoc.class);
    // 3.将ItemDTO转json
    String doc = JSONUtil.toJsonStr(itemDoc);

    // 1.准备Request对象
    IndexRequest request = new IndexRequest("items").id(itemDoc.getId());
    // 2.准备Json文档
    request.source(doc, XContentType.JSON);
    // 3.发送请求
    client.index(request, RequestOptions.DEFAULT);
}
```

> `index`是新增的意思

#### 8.3.2 删

```java
@Test
void testDeleteDocument() throws IOException {
    // 1.准备Request，两个参数，第一个是索引库名，第二个是文档id
    DeleteRequest request = new DeleteRequest("item", "100002644680");
    // 2.发送请求
    client.delete(request, RequestOptions.DEFAULT);
}
```

#### 8.3.3 改

修改的两种方式：

- 全量修改：本质是先根据id删除，再新增
- 局部修改：修改文档中的指定字段值

**全量修改与新增的API完全一致**，判断依据是ID：

- 如果新增时，ID已经存在，则修改
- 如果新增时，ID不存在，则新增

局部修改：

```java
@Test
void testUpdateDocument() throws IOException {
    // 1.准备Request
    UpdateRequest request = new UpdateRequest("items", "100002644680");
    // 2.准备请求参数
    request.doc(
            "price", 58800,
            "commentCount", 1
    );
    // 3.发送请求
    client.update(request, RequestOptions.DEFAULT);
}
```

#### 8.3.4 查

```java
@Test
void testGetDocumentById() throws IOException {
    // 1.准备Request对象
    GetRequest request = new GetRequest("items").id("100002644680");
    // 2.发送请求
    GetResponse response = client.get(request, RequestOptions.DEFAULT);
    // 3.获取响应结果中的source
    String json = response.getSourceAsString();
    
    ItemDoc itemDoc = JSONUtil.toBean(json, ItemDoc.class);
    System.out.println("itemDoc= " + itemDoc);
}
```

> 可以看到，响应结果是一个JSON，其中文档放在一个`_source`属性中，因此解析就是拿到`_source`，反序列化为Java对象即可。

#### 8.3.5 批量导入

常见的方案有：

- 利用`Logstash`批量导入
    - 对数据的再加工能力较弱
    - 无需编码，但要学习编写`Logstash`导入配置
- 利用JavaAPI批量导入
    - 需要编码，但基于JavaAPI，学习成本低
    - 更加灵活，可以任意对数据做再加工处理后写入索引库

下面介绍利用JavaAPI

```java
@Test
void testLoadItemDocs() throws IOException {
    // 分页查询商品数据
    int pageNo = 1;
    int size = 1000;
    while (true) {
        Page<Item> page = itemService.lambdaQuery().eq(Item::getStatus, 1).page(new Page<Item>(pageNo, size));
        // 非空校验
        List<Item> items = page.getRecords();
        if (CollUtils.isEmpty(items)) {
            return;
        }
        log.info("加载第{}页数据，共{}条", pageNo, items.size());
        // 1.创建Request
        BulkRequest request = new BulkRequest("items");
        // 2.准备参数，添加多个新增的Request
        for (Item item : items) {
            // 2.1.转换为文档类型ItemDTO
            ItemDoc itemDoc = BeanUtil.copyProperties(item, ItemDoc.class);
            // 2.2.创建新增文档的Request对象
            request.add(new IndexRequest()
                    .id(itemDoc.getId())
                    .source(JSONUtil.toJsonStr(itemDoc), XContentType.JSON));
        }
        // 3.发送请求
        client.bulk(request, RequestOptions.DEFAULT);

        // 翻页
        pageNo++;
    }
}
```

## 9. DSL实现查询

Elasticsearch的查询可以分为两大类：

- **叶子查询（Leaf** **query** **clauses）**：一般是在特定的字段里查询特定值，属于简单查询，很少单独使用。
- **复合查询（Compound** **query** **clauses）**：以逻辑方式组合多个叶子查询或者更改叶子查询的行为方式。

### 9.1 叶子查询

[Query DSL](https://nageoffer.com/shortlink/#%E9%A1%B9%E7%9B%AE%E6%8F%8F%E8%BF%B0)

例如：

- **全文检索查询（Full Text Queries）**：利用分词器对用户输入搜索条件先分词，得到词条，然后再利用倒排索引搜索词条。例如：
    - `match`
    - `multi_match`
- **精确查询（Term-level queries）**：不对用户输入搜索条件分词，根据字段内容精确值匹配。但只能查找keyword、数值、日期、boolean类型的字段。例如：
    - `ids`
    - `term`
    - `range`
- **地理坐标查询：**用于搜索地理位置，搜索方式很多，例如：
    - `geo_bounding_box`：按矩形搜索
    - `geo_distance`：按点和半径搜索

#### 9.1.1 全文检索查询

[Full text queries | Elasticsearch Guide 7.12 | Elastic](https://www.elastic.co/guide/en/elasticsearch/reference/7.12/full-text-queries.html)

以全文检索中的`match`为例，语法如下：

```json
GET /{索引库名}/_search
{
  "query": {
    "match": {
      "字段名": "搜索条件"
    }
  }
}
```

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201631769.png)

与`match`类似的还有`multi_match`，区别在于可以同时对多个字段搜索，而且多个字段都要满足，语法示例：

```json
GET /{索引库名}/_search
{
  "query": {
    "multi_match": {
      "query": "搜索条件",
      "fields": ["字段1", "字段2"]
    }
  }
}
```

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201640370.png)

#### 9.1.2 精确查询

[Term-level queries | Elasticsearch Guide 7.12 | Elastic](https://www.elastic.co/guide/en/elasticsearch/reference/7.12/term-level-queries.html)

词条级别的查询，也就是说不会对用户输入的搜索条件再分词，而是作为一个词条，与搜索的字段内容精确值匹配。因此推荐查找`keyword`、数值、日期、`boolean`类型的字段。

以`term`查询为例，其语法如下：

```json
GET /{索引库名}/_search
{
  "query": {
    "term": {
      "字段名": {
        "value": "搜索条件"
      }
    }
  }
}
```

`range`查询，语法如下：

```json
GET /{索引库名}/_search
{
  "query": {
    "range": {
      "字段名": {
        "gte": {最小值},
        "lte": {最大值}
      }
    }
  }
}
```

> `range`是范围查询，对于范围筛选的关键字有：
>
> - `gte`：大于等于
> - `gt`：大于
> - `lte`：小于等于
> - `lt`：小于

### 9.2 复合查询

复合查询大致可以分为两类：

- 第一类：基于逻辑运算组合叶子查询，实现组合条件，例如
    - `bool`
- 第二类：基于某种算法修改查询时的文档相关性算分，从而改变文档排名。例如：
    - `function_score`
    - `dis_max`

bool查询，即布尔查询。就是利用逻辑运算来组合一个或多个查询子句的组合。bool查询支持的逻辑运算有：

- must：必须匹配每个子查询，类似“与”
- should：选择性匹配子查询，类似“或”
- must_not：必须不匹配，**不参与算分**，类似“非”
- filter：必须匹配，**不参与算分**

bool查询的语法如下：

```json
GET /items/_search
{
  "query": {
    "bool": {
      "must": [
        {"match": {"name": "手机"}}
      ],
      "should": [
        {"term": {"brand": { "value": "vivo" }}},
        {"term": {"brand": { "value": "小米" }}}
      ],
      "must_not": [
        {"range": {"price": {"gte": 2500}}}
      ],
      "filter": [
        {"range": {"price": {"lte": 1000}}}
      ]
    }
  }
}
```

出于性能考虑，与搜索关键字无关的查询尽量采用must_not或filter逻辑运算，避免参与相关性算分。

例如黑马商城的搜索页面：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201651128.png)

其中输入框的搜索条件肯定要参与相关性算分，可以采用`must`。但是价格范围过滤、品牌过滤、分类过滤等尽量采用`filter`，不要参与相关性算分。

比如，我们要搜索`手机`，但品牌必须是`华为`，价格必须是`900~1599`，那么可以这样写：

```json
GET /items/_search
{
  "query": {
    "bool": {
      "must": [
        {"match": {"name": "手机"}}
      ],
      "filter": [
        {"term": {"brand": { "value": "华为" }}},
        {"range": {"price": {"gte": 90000, "lt": 159900}}}
      ]
    }
  }
}
```

### 9.3 排序

[Sort search results | Elasticsearch Guide 7.12 | Elastic](https://www.elastic.co/guide/en/elasticsearch/reference/7.12/sort-search-results.html)

Elasticsearch默认是根据相关度算分（`_score`）来排序，但是也支持自定义方式对搜索结果排序。不过分词字段无法排序，能参与排序字段类型有：`keyword`类型、数值类型、地理坐标类型、日期类型等。

例如：

```json
GET /indexName/_search
{
  "query": {
    "match_all": {}
  },
  "sort": [
    {
      "排序字段": {
        "order": "排序方式asc和desc"
      }
    }
  ]
}
```

### 9.4 分页

[Paginate search results | Elasticsearch Guide 7.12 | Elastic](https://www.elastic.co/guide/en/elasticsearch/reference/7.12/paginate-search-results.html)

#### 9.4.1 基础分页

elasticsearch中通过修改`from`、`size`参数来控制要返回的分页结果：

- `from`：从第几个文档开始
- `size`：总共查询几个文档

类似于mysql中的`limit ?, ?`

```json
GET /items/_search
{
  "query": {
    "match_all": {}
  },
  "from": 0, // 分页开始的位置，默认为0
  "size": 10,  // 每页文档数量，默认10
  "sort": [
    {
      "price": {
        "order": "desc"
      }
    }
  ]
}
```

#### 9.4.2 深度分页

Elasticsearch的数据一般会采用分片存储，也就是把一个索引中的数据分成N份，存储到不同节点上。这种存储方式比较有利于数据扩展，但给分页带来了一些麻烦。

比如一个索引库中有100000条数据，分别存储到4个分片，每个分片25000条数据。现在每页查询10条，查询第99页。那么分页查询的条件如下：

```json
GET /items/_search
{
  "from": 990, // 从第990条开始查询
  "size": 10, // 每页查询10条
  "sort": [
    {
      "price": "asc"
    }
  ]
}
```

从语句来分析，要查询第990~1000名的数据。

从实现思路来分析，肯定是将所有数据排序，找出前1000名，截取其中的990~1000的部分。但问题来了，我们如何才能找到所有数据中的前1000名呢？

要知道每一片的数据都不一样，第1片上的第900~1000，在另1个节点上并不一定依然是900~1000名。所以我们只能在每一个分片上都找出排名前1000的数据，然后汇总到一起，重新排序，才能找出整个索引库中真正的前1000名，此时截取990~1000的数据即可。

如图：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201701884.png)

试想一下，假如我们现在要查询的是第999页数据呢，是不是要找第9990~10000的数据，那岂不是需要把每个分片中的前10000名数据都查询出来，汇总在一起，在内存中排序？如果查询的分页深度更深呢，需要一次检索的数据岂不是更多？

由此可知，当查询分页深度较大时，汇总数据过多，对内存和CPU会产生非常大的压力。

因此Elasticsearch会禁止`from + size`超过10000的请求。

针对深度分页，Elasticsearch提供了两种解决方案：

- `search after`：分页时需要排序，原理是从上一次的排序值开始，查询下一页数据。官方推荐使用的方式。
- `scroll`：原理将排序后的文档id形成快照，保存下来，基于快照做分页。官方已经不推荐使用。

### 9.5 高亮

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201711999.png)

观察页面源码，你会发现两件事情：

- 高亮词条都被加了`<em>`标签
- `<em>`标签都添加了红色样式

实现高亮的思路就是：

- 用户输入搜索关键字搜索数据
- 服务端根据搜索关键字到elasticsearch搜索，并给搜索结果中的关键字词条添加`html`标签
- 前端提前给约定好的`html`标签添加`CSS`样式

实现如下：

```json
GET /{索引库名}/_search
{
  "query": {
    "match": {
      "搜索字段": "搜索关键字"
    }
  },
  "highlight": {
    "fields": {
      "高亮字段名称": {
        "pre_tags": "<em>",
        "post_tags": "</em>"
      }
    }
  }
}
```

> **注意**：
>
> - 搜索必须有查询条件，而且是全文检索类型的查询条件，例如`match`
> - 参与高亮的字段必须是`text`类型的字段
> - 默认情况下参与高亮的字段要与搜索字段一致，除非添加：`required_field_match=false`

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201719149.png)

## 10. RestClient实现查询

注意：参考8.1。**所有调用ElasticSearch的API方法前后都要加上`setUp()`和`tearDown()`！**

### 10.1 基本Demo

以`match_all`为例

**核心代码：**

```java
@Test
void testMatchAll() throws IOException {
    // 1.准备Request
    SearchRequest request = new SearchRequest("items");
    // 2.组织DSL参数
    request.source()
           .query(QueryBuilders.matchAllQuery());
    // 3.发送请求，得到响应结果
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应结果
    handleResponse(response);//这个函数具体实现见下一个代码块
}
```

代码解读：

- 第一步，创建`SearchRequest`对象，指定索引库名
- 第二步，利用`request.source()`构建DSL，DSL中可以包含查询、分页、排序、高亮等
    - `query()`：代表查询条件，利用`QueryBuilders.matchAllQuery()`构建一个`match_all`查询的DSL
- 第三步，利用`client.search()`发送请求，得到响应

关键API：

- `request.source()`，它构建的就是DSL中的完整JSON参数。其中包含了`query`、`sort`、`from`、`size`、`highlight`等所有功能：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201734805.png)

- `QueryBuilders`，其中包含了我们学习过的各种**叶子查询**、**复合查询**等：
    
    ![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201741693.png)

**解析结果：**

在发送请求以后，得到了响应结果`SearchResponse`，这个类的结构与我们在kibana中看到的响应结果JSON结构完全一致：

```json
{
    "took" : 0,
    "timed_out" : false,
    "hits" : {
        "total" : {
            "value" : 2,
            "relation" : "eq"
        },
        "max_score" : 1.0,
        "hits" : [
            {
                "_index" : "heima",
                "_type" : "_doc",
                "_id" : "1",
                "_score" : 1.0,
                "_source" : {
                "info" : "Java讲师",
                "name" : "赵云"
                }
            }
        ]
    }
}
```

```java
private void handleResponse(SearchResponse response) {
    SearchHits searchHits = response.getHits();
    // 1.获取总条数
    long total = searchHits.getTotalHits().value;
    System.out.println("共搜索到" + total + "条数据");
    // 2.遍历结果数组
    SearchHit[] hits = searchHits.getHits();
    for (SearchHit hit : hits) {
        // 3.得到_source，也就是原始json文档
        String source = hit.getSourceAsString();
        // 4.反序列化并打印
        ItemDoc item = JSONUtil.toBean(source, ItemDoc.class);
        System.out.println(item);
    }
}
```

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201748491.png)

### 10.2 更多的叶子查询示例

所有的查询条件都是由QueryBuilders来构建的，叶子查询也不例外。

`match`查询：

```java
@Test
void testMatch() throws IOException {
    // 1.创建Request
    SearchRequest request = new SearchRequest("items");
    // 2.组织请求参数
    request.source().query(QueryBuilders.matchQuery("name", "脱脂牛奶"));
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);
}
```

`multi_match`查询：

```java
@Test
void testMultiMatch() throws IOException {
    // 1.创建Request
    SearchRequest request = new SearchRequest("items");
    // 2.组织请求参数
    request.source().query(QueryBuilders.multiMatchQuery("脱脂牛奶", "name", "category"));
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);
}
```

`range`查询：

```java
@Test
void testRange() throws IOException {
    // 1.创建Request
    SearchRequest request = new SearchRequest("items");
    // 2.组织请求参数
    request.source().query(QueryBuilders.rangeQuery("price").gte(10000).lte(30000));
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);
}
```

`term`查询：

```java
@Test
void testTerm() throws IOException {
    // 1.创建Request
    SearchRequest request = new SearchRequest("items");
    // 2.组织请求参数
    request.source().query(QueryBuilders.termQuery("brand", "华为"));
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);
}
```

### 10.3 复合查询

复合查询也是由`QueryBuilders`来构建，我们以`bool`查询为例，DSL和JavaAPI的对比如图

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201759109.png)

```java
@Test
void testBool() throws IOException {
    // 1.创建Request
    SearchRequest request = new SearchRequest("items");
    // 2.组织请求参数
    // 2.1.准备bool查询
    BoolQueryBuilder bool = QueryBuilders.boolQuery();
    // 2.2.关键字搜索
    bool.must(QueryBuilders.matchQuery("name", "脱脂牛奶"));
    // 2.3.品牌过滤
    bool.filter(QueryBuilders.termQuery("brand", "德亚"));
    // 2.4.价格过滤
    bool.filter(QueryBuilders.rangeQuery("price").lte(30000));
    request.source().query(bool);
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);
}
```

### 10.4 分页与排序

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201805005.png)

```java
@Test
void testPageAndSort() throws IOException {
    int pageNo = 1, pageSize = 5;
    // 1.创建Request
    SearchRequest request = new SearchRequest("items");
    // 2.组织请求参数
    // 2.1.搜索条件参数
    request.source().query(QueryBuilders.matchQuery("name", "脱脂牛奶"));
    // 2.2.排序参数
    request.source().sort("price", SortOrder.ASC);
    // 2.3.分页参数
    request.source().from((pageNo - 1) * pageSize).size(pageSize);
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);
}
```

### 10.5 高亮

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201810586.png)

```java
@Test
void testHighlight() throws IOException {
    // 1.创建Request
    SearchRequest request = new SearchRequest("items");
    // 2.组织请求参数
    // 2.1.query条件
    request.source().query(QueryBuilders.matchQuery("name", "脱脂牛奶"));
    // 2.2.高亮条件
    request.source().highlighter(
            SearchSourceBuilder.highlight()
                    .field("name")
                    .preTags("<em>")
                    .postTags("</em>")
    );
    // 3.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 4.解析响应
    handleResponse(response);
}
```

**结果解析：**

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201816478.png)

```java
private void handleResponse(SearchResponse response) {
    SearchHits searchHits = response.getHits();
    // 1.获取总条数
    long total = searchHits.getTotalHits().value;
    System.out.println("共搜索到" + total + "条数据");
    // 2.遍历结果数组
    SearchHit[] hits = searchHits.getHits();
    for (SearchHit hit : hits) {
        // 3.得到_source，也就是原始json文档
        String source = hit.getSourceAsString();
        // 4.反序列化
        ItemDoc item = JSONUtil.toBean(source, ItemDoc.class);
        // 5.获取高亮结果
        Map<String, HighlightField> hfs = hit.getHighlightFields();
        if (CollUtils.isNotEmpty(hfs)) {
            // 5.1.有高亮结果，获取name的高亮结果
            HighlightField hf = hfs.get("name");
            if (hf != null) {
                // 5.2.获取第一个高亮结果片段，就是商品名称的高亮值
                String hfName = hf.getFragments()[0].string();
                item.setName(hfName);
            }
        }
        System.out.println(item);
    }
}
```

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201821991.png)

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201825308.png)

## 11. DSL实现数据聚合

[Aggregations | Elasticsearch Guide 7.12 | Elastic](https://www.elastic.co/guide/en/elasticsearch/reference/7.12/search-aggregations.html)

聚合（`aggregations`）可以让我们极其方便的实现对数据的统计、分析、运算。例如：

- 什么品牌的手机最受欢迎？
- 这些手机的平均价格、最高价格、最低价格？
- 这些手机每月的销售情况如何？

实现这些统计功能的比数据库的sql要方便的多，而且查询速度非常快，可以实现近实时搜索效果。

聚合常见的有三类：

- **桶（`Bucket`）聚合**：用来对文档做分组
    - `TermAggregation`：按照文档字段值分组，例如按照品牌值分组、按照国家分组
    - `Date Histogram`：按照日期阶梯分组，例如一周为一组，或者一月为一组
- **度量（`Metric`）聚合**：用以计算一些值，比如：最大值、最小值、平均值等
    - `Avg`：求平均值
    - `Max`：求最大值
    - `Min`：求最小值
    - `Stats`：同时求`max`、`min`、`avg`、`sum`等
- **管道（`pipeline`）聚合**：其它聚合的结果为基础做进一步运算

> 参加聚合的字段必须是`keyword`、日期、数值、布尔类型

### 11.1 Bucket聚合

例如我们要统计所有商品中共有哪些商品分类，其实就是以分类（category）字段对数据分组。`category`值一样的放在同一组，属于`Bucket`聚合中的`Term`聚合。

```json
GET /items/_search
{
  "size": 0,
  "aggs": {
    "category_agg": {
      "terms": {
        "field": "category",
        "size": 20
      }
    }
  }
}
```

- `size`：设置`size`为0，就是每页查0条，则结果中就不包含文档，只包含聚合
- `aggs`：定义聚合
    - `category_agg`：聚合名称，自定义，但不能重复
        - `terms`：聚合的类型，按分类聚合，所以用`term`
            - `field`：参与聚合的字段名称
            - `size`：希望返回的聚合结果的最大数量

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201833699.png)

### 11.2 带条件聚合

默认情况下，Bucket聚合是对索引库的所有文档做聚合，例如我们统计商品中所有的品牌，结果如下：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201838721.png)

可以看到统计出的品牌非常多。

但真实场景下，用户会输入搜索条件，因此聚合必须是对搜索结果聚合。那么聚合必须添加限定条件。

例如，我想知道价格高于3000元的**手机品牌**有哪些，该怎么统计呢？

我们需要从需求中分析出搜索查询的条件和聚合的目标：

- 搜索查询条件：
    - 价格高于3000
    - 必须是手机
- 聚合目标：统计的是品牌，肯定是对brand字段做term聚合

```json
GET /items/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "term": {
            "category": "手机"
          }
        },
        {
          "range": {
            "price": {
              "gte": 300000
            }
          }
        }
      ]
    }
  },
  "size": 0,
  "aggs": {
    "brand_agg": {
      "terms": {
        "field": "brand",
        "size": 20
      }
    }
  }
}
```

结果如下：

```json
{
  "took" : 2,
  "timed_out" : false,
  "hits" : {
    "total" : {
      "value" : 13,
      "relation" : "eq"
    },
    "max_score" : null,
    "hits" : [ ]
  },
  "aggregations" : {
    "brand_agg" : {
      "doc_count_error_upper_bound" : 0,
      "sum_other_doc_count" : 0,
      "buckets" : [
        {
          "key" : "华为",
          "doc_count" : 7
        },
        {
          "key" : "Apple",
          "doc_count" : 5
        },
        {
          "key" : "小米",
          "doc_count" : 1
        }
      ]
    }
  }
}
```

### 11.3 Metric聚合

上面的代码段中，我们统计了价格高于3000的手机品牌，形成了一个个桶。现在我们需要对桶内的商品做运算，获取每个品牌价格的最小值、最大值、平均值。

这就要用到`Metric`聚合了，例如`stats`聚合，就可以同时获取`min`、`max`、`avg`等结果。

```json
GET /items/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "term": {
            "category": "手机"
          }
        },
        {
          "range": {
            "price": {
              "gte": 300000
            }
          }
        }
      ]
    }
  },
  "size": 0,
  "aggs": {
    "brand_agg": {
      "terms": {
        "field": "brand",
        "size": 20
      },
      "aggs": {
        "stats_meric": {
          "stats": {
            "field": "price"
          }
        }
      }
    }
  }
}
```

可以看到我们在`brand_agg`聚合的内部，我们新加了一个`aggs`参数。这个聚合就是`brand_agg`的子聚合，会对`brand_agg`形成的每个桶中的文档分别统计。

- `stats_meric`：聚合名称
    - `stats`：聚合类型，stats是`metric`聚合的一种
        - `field`：聚合字段，这里选择`price`，统计价格

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201849661.png)

另外，我们还可以让聚合按照每个品牌的价格平均值排序：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201854878.png)

## 12. RestClient实现聚合

可以看到在DSL中，`aggs`聚合条件与`query`条件是同一级别，都属于查询JSON参数。因此依然是利用`request.source()`方法来设置。

不过聚合条件的要利用`AggregationBuilders`这个工具类来构造。

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201900202.png)

聚合结果与搜索文档同一级别，因此需要单独获取和解析。具体解析语法如下：

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112201904994.png)

```java
@Test
void testAgg() throws IOException {
    // 1.创建Request
    SearchRequest request = new SearchRequest("items");
    // 2.准备请求参数
    BoolQueryBuilder bool = QueryBuilders.boolQuery()
            .filter(QueryBuilders.termQuery("category", "手机"))
            .filter(QueryBuilders.rangeQuery("price").gte(300000));
    request.source().query(bool).size(0);
    // 3.聚合参数
    request.source().aggregation(
            AggregationBuilders.terms("brand_agg").field("brand").size(5)
    );
    // 4.发送请求
    SearchResponse response = client.search(request, RequestOptions.DEFAULT);
    // 5.解析聚合结果
    Aggregations aggregations = response.getAggregations();
    // 5.1.获取品牌聚合
    Terms brandTerms = aggregations.get("brand_agg");
    // 5.2.获取聚合中的桶
    List<? extends Terms.Bucket> buckets = brandTerms.getBuckets();
    // 5.3.遍历桶内数据
    for (Terms.Bucket bucket : buckets) {
        // 5.4.获取桶内key
        String brand = bucket.getKeyAsString();
        System.out.print("brand = " + brand);
        long count = bucket.getDocCount();
        System.out.println("; count = " + count);
    }
}
```
