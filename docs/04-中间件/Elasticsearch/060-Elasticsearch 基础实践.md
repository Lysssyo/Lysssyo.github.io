---
name: elasticsearch-comprehensive-guide
description: Comprehensive reference for Elasticsearch including inverted index, mapping, DSL, and aggregations.
metadata:
  category: reference
  triggers: Elasticsearch, Inverted Index, DSL, Aggregations, Mapping
---

# Elasticsearch 基础实践

本文档提供 Elasticsearch 的全方位技术参考，涵盖底层原理、Mapping 约束、DSL 操作手册以及聚合分析。

## 1. 核心原理：倒排索引

ES 的高性能搜索源于 **倒排索引 (Inverted Index)**。

- **正向索引**：根据文档找词条（如 MySQL 的 `LIKE %keyword%`），模糊匹配时需全表扫描。
- **倒排索引**：根据词条找文档。
  1. 将文档分词得到 **词条 (Term)**。
  2. 建立词条与文档 ID 的映射关系。
  3. 搜索时先匹配词条，再通过 ID 获取文档。

### 核心概念对比

| MySQL | Elasticsearch | 说明 |
| :--- | :--- | :--- |
| Table | Index | 索引是文档的集合，类似于表。 |
| Row | Document | 文档是数据的最小单元，JSON 格式。 |
| Column | Field | 字段是 JSON 中的属性。 |
| Schema | Mapping | Mapping 定义字段类型、分词器等约束。 |
| SQL | DSL | Domain Specific Language，JSON 风格的查询。 |

---

## 2. 分词器与 Mapping

### IK 分词器实践

中文搜索建议安装 IK 分词器：

- **ik_max_word**：最细粒度拆分，最大化召回率。
- **ik_smart**：智能语义拆分，提高精确度。

**优化组合**：写入时使用 `ik_max_word` 以存全数据，搜索时使用 `search_analyzer: ik_smart` 以理解意图。

| **阶段** | **设置** | **行为** | **目的** |
| :--- | :--- | :--- | :--- |
| **存入数据** | `analyzer: ik_max_word` | 把“清华大学”拆成：`清华大学`, `清华`, `大学` | **尽可能存全**，确保搜关键词能命中。 |
| **用户搜索** | `search_analyzer: ik_smart` | 把“清华大学”不拆碎，视为一个整体语义。 | **理解用户意图**，减少语义无关的噪音。 |

### Mapping 关键属性

- **type** | 字段类型。`text`（全文检索）、`keyword`（精确匹配）、数值、日期、布尔等。
- **index** | 默认为 `true`。若设为 `false` 则该字段无法被搜索。
- **properties** | 定义子字段（如对象嵌套）。

---

## 3. DSL 操作手册

由于 ES 采用 RESTful 风格 API，所有操作均通过标准的 HTTP 方法（PUT, POST, GET, DELETE）结合 JSON 载荷实现。

### 3.1 索引库管理

索引库一旦创建，**无法修改已存在的字段定义**（因为会破坏倒排索引）。如果需要变更，通常需要重新创建索引并做数据迁移。

- **创建索引 (PUT)**：
  ```json
  PUT /products
  {
    "mappings": {
      "properties": {
        "id": { "type": "keyword" },
        "name": { "type": "text", "analyzer": "ik_max_word" , "search_analyzer": "ik_smart"},
        "price": { "type": "integer" },
        "tags": { "type": "keyword", "index": false }
      }
    }
  }
  ```

- **添加新字段 (PUT)**：允许向已有 Mapping 中追加新字段。
  ```json
  PUT /products/_mapping
  {
    "properties": {
      "stock": { "type": "integer" }
    }
  }
  ```

---

### 3.2 文档 CRUD 实践

- **新增/全量覆盖 (PUT)**：使用指定的 ID。如果 ID 已存在，则执行“先删除后新增”的操作。
  ```json
  PUT /products/_doc/1001
  {
    "name": "小米手机",
    "price": 3999,
    "stock": 100
  }
  ```

- **局部更新 (POST)**：仅修改指定的 Field，不影响其他内容。
  ```json
  POST /products/_update/1001
  { "doc": { "price": 3888 } }
  ```

- **批量处理 (Bulk)**：支持在一个请求中执行多次增删改。
  ```json
  POST /_bulk
  { "index" : { "_index" : "products", "_id" : "1002" } }
  { "name" : "华为手机", "price": 4999 }
  ```

---

## 4. 检索原理深度剖析

### 4.1 查询上下文 vs 过滤上下文

ES 的 `bool` 查询将子句分为两种上下文，其处理机制有本质不同。

#### must/should (查询上下文)

- **目标**：回答“文档有多匹配？”。
- **机制**：计算 **BM25 算法** 相关性算分 (`_score`)。考虑词频 (TF) 和逆文档频率 (IDF)。
- **性能**：由于涉及浮点运算且结果不可预测，无法被缓存。

#### filter/must_not (过滤上下文)

- **目标**：回答“文档匹配吗？”（Yes/No）。
- **机制**：不计算分数。ES 会生成一个 **Bitset**（位图），记录每个文档的匹配状态（0 或 1）。
- **缓存**：常用的 Bitset 会被缓存在内存中。下次查询时直接进行位运算（AND/OR），性能极快。

---

### 4.2 复合查询协作示例

假设我们要搜索“品牌为华为，价格在 3000-5000 之间，且名称中包含‘手机’二字”的产品。

#### DSL 实现

```json
GET /products/_search
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "brand": "华为" } },
        { "range": { "price": { "gte": 3000, "lte": 5000 } } }
      ],
      "must": [
        { "match": { "name": "手机" } }
      ]
    }
  }
}
```

---

## 5. 数据聚合 (Aggregations)

聚合是对数据的统计分析，允许在搜索结果的基础上进行分组和指标计算。

### 5.1 聚合分类

1.  **桶聚合 (Bucket)**：类似于 SQL 的 `GROUP BY`。将文档分配到不同的容器（桶）中。如 `terms`（按值分组）、`range`（按区间分组）。
2.  **度量聚合 (Metric)**：类似于 SQL 的聚合函数。对桶内的文档进行数值计算。如 `avg`, `max`, `min`, `stats`（同时求多种指标）。
3.  **管道聚合 (Pipeline)**：对其他聚合的结果再次进行聚合。

---

### 5.2 嵌套聚合实战示例

**业务意图**：找出价格在 1000 元以上的所有商品，按“品牌”进行分组，并计算每个品牌下商品的“平均价格”，最后按“平均价格”降序排列。

#### DSL 实现

```json
GET /products/_search
{
  "query": {
    "range": { "price": { "gt": 1000 } }
  },
  "size": 0, -- 关键：设为 0 表示不返回文档原文，仅返回聚合结果
  "aggs": {
    "brand_agg": { -- 自定义聚合名称
      "terms": { // 负责分桶
        "field": "brand",
        "size": 10,
        "order": { "avg_price_agg": "desc" } -- 根据子聚合结果排序
      },
      "aggs": { -- 子聚合：在品牌桶内计算指标
        "avg_price_agg": {
          "avg": { "field": "price" }
        }
      }
    }
  }
}
```

---

### 5.3 底层原理：Doc Values

聚合之所以能高效运行，是因为 ES 除了倒排索引外，还维护了一套 **Doc Values**（正向索引/列式存储）。

| **特性** | **倒排索引 (Inverted Index)** | **Doc Values** |
| :--- | :--- | :--- |
| **存储结构** | `Term -> Document IDs` | `Document ID -> Field Values` |
| **主要用途** | 搜索词项匹配文档 | 排序、聚合、脚本计算 |
| **数据布局** | 行式存储思想（适合找行） | **列式存储**（适合处理某一列的所有值） |

**性能警示**：
- **禁止对 `text` 字段聚合**：`text` 字段默认不开启 Doc Values。如果强制聚合，ES 会尝试使用 **Fielddata**（在内存中实时构建正向索引），这极易导致内存溢出 (OOM)。
- **聚合字段必须是 `keyword` 或数值类型**。