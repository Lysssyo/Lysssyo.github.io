---
name: cozeloop-es-search-practice
description: Specialized Elasticsearch indexing strategy and query optimization for cozeLoop experiment filtering.
metadata:
  category: reference
  triggers: dynamic_templates, Map mapping, cozeLoop, full-text search
---

# Elasticsearch 实现 cozeloop 实验结果过滤

本文档深入探讨了在 Elasticsearch (ES) 中实现 cozeLoop 动态元数据过滤的方案，包括基于动态模板的索引设计、写入流程以及针对高性能列式读取的查询优化。

## 1. 索引结构

针对 cozeLoop 的业务特性，我们设计了如下支持动态 Map 映射的索引结构：

```json
PUT /expt_turn_result_filter
{
  "settings": {
    "number_of_shards": 3, 
    "number_of_replicas": 1,
    "refresh_interval": "1s"
  },
  "mappings": {
    "dynamic": "strict", 
    "_source": { "enabled": true },
    "properties": {
      -- 1. ID 类字段 (对应 CK String)
      "space_id": { "type": "keyword" },
      "expt_id":  { "type": "keyword" }, 
      "item_id":  { "type": "keyword" },
      "turn_id":  { "type": "keyword" },
      
      -- 2. 数值与状态 (对应 CK Int32)
      "item_idx": { "type": "integer" },
      "status":   { "type": "integer" },
      "evaluator_score_corrected": { "type": "integer" },

      -- 3. 核心难点：文本内容的 Map
      "eval_target_data": {
        "type": "object", 
        "dynamic": true,
        "properties": {
          "input": { 
            "type": "text", 
            "analyzer": "ik_max_word",
            "search_analyzer": "ik_smart",
            "fields": { "keyword": { "type": "keyword" } }
          },
          "actual_output": { 
            "type": "text", 
            "analyzer": "ik_max_word",
            "fields": { "keyword": { "type": "keyword" } }
          }
        }
      },

      -- 4. 核心难点：动态分数的 Map
      "evaluator_score": {
        "type": "object",
        "dynamic": true 
      },
      "annotation_float": {
        "type": "object",
        "dynamic": true
      },

      -- 5. 标注类 Map
      "annotation_bool": {
        "type": "object",
        "dynamic": true
      },
      "annotation_string": {
        "type": "object",
        "dynamic": true
      },

      -- 6. 时间字段
      "created_date": { "type": "date", "format": "yyyy-MM-dd" },
      "created_at":   { "type": "date", "format": "yyyy-MM-dd HH:mm:ss||strict_date_optional_time" },
      "updated_at":   { "type": "date", "format": "yyyy-MM-dd HH:mm:ss||strict_date_optional_time" },
      "eval_set_version_id": { "type": "keyword" }
    },

    -- 7. 动态模板
    "dynamic_templates": [
      {
        "scores_as_float": {
          "path_match": "evaluator_score.*",
          "mapping": { "type": "float" }
        }
      },
      {
        "annotations_as_float": {
          "path_match": "annotation_float.*",
          "mapping": { "type": "float" }
        }
      },
      {
        "bools_as_byte": {
          "path_match": "annotation_bool.*",
          "mapping": { "type": "byte" }
        }
      },
      {
        "strings_as_keyword": {
          "path_match": "annotation_string.*",
          "mapping": { "type": "keyword" }
        }
      },
      {
        "target_data_as_text": {
          "path_match": "eval_target_data.*",
          "mapping": {
            "type": "text",
            "analyzer": "ik_max_word",
            "fields": {
              "keyword": { "type": "keyword", "ignore_above": 256 }
            }
          }
        }
      }
    ]
  }
}
```

可以注意到：

1. `expt_id` 的类型是 `keyword`，方便等值查询，底层数据结构是倒排索引。
2. `evaluator_score`是 `object` 类型，并且 `"dynamic": true` 即可以往里面加未定义的key。每个key的类型都必须是 `float`，动态模板规定的。

---

## 2. 写入流程

写入时，ES 会根据 `dynamic_templates` 自动识别容器内的 key 并激活对应的底层数据结构。

```json
POST /expt_turn_result_filter/_doc/doc_correct_01
{
  "item_id": "item_1001",
  "expt_id": "2026020620370008",
  "status": 2,
  
  -- 容器 A: 文本内容（分词，支持全文检索）
  "eval_target_data": {
    "input": "请计算 1+1 等于几？",
    "actual_output": "答案是 2",
    "trace_log": "Calculation module invoked..."
  },

  -- 容器 B: 数值分数（BKD Tree，支持范围查询）
  "evaluator_score": {
    "accuracy": 1.0,
    "fluency": 0.95
  },

  -- 容器 C: 标签（Keyword，支持精确过滤与聚合）
  "annotation_string": {
    "category": "Math",
    "model_version": "v3"
  }
}
```

---

## 3. 查询与优化深度剖析

### 3.1 range 过滤查询

```json
GET /expt_turn_result_filter/_search
{
  "_source": ["item_id", "evaluator_score"], 
  "query": {
    "bool": {
      "filter": [
        {
          "range": {
            "evaluator_score.key1": { "gt": 0.5 }
          }
        }
      ]
    }
  }
}
```

基础的查询。底层执行过程可以分为两个阶段。

- 第一阶段：Query Phase (召回)，利用BKD定位出 `gt: 0.5` 的文档 ID。 具体参考 [5. BKD 树](020-Elasticsearch%20核心数据结构.md#5.%20BKD%20树)
- 第二阶段：Fetch Phase（取回），利用ID取回文档。具体参考 [7. 两阶段检索](020-Elasticsearch%20核心数据结构.md#7.%20两阶段检索)

---
### 3.2 term 过滤 + range 过滤

```json
GET /expt_turn_result_filter/_search
{
  "_source": ["item_id", "evaluator_score"],
  "query": {
    "bool": {
      "filter": [
        { 
          "term": { "expt_id": "7597428938863804417" } 
        },
        { 
          "range": { "evaluator_score.key1": { "gt": 0.5 } } 
        }
      ]
    }
  }
}
```

具体参考 [4.3 多索引结构的并行求交集 (Index Intersection)](040-Elasticsearch%20读写链路.md#4.3%20多索引结构的并行求交集%20(Index%20Intersection))


### 3.3 avg 计算

#### 3.3.1 概述

例如：查询 `avg(evaluator_score)`

基于当前的 Mapping 设计，Elasticsearch 很难高效地（利用倒排索引或 BKD 树）实现这个查询。

因为在 ES 的底层存储中，`evaluator_score` 是 `object` 类型，而你开启了 `dynamic: true`。 假设你存入的数据是：

```json
{
  "evaluator_score": {
    "fluency": 0.8,
    "accuracy": 0.4
  }
}
```

在 Lucene 层面，这会被打平成两个**完全独立**的字段：

1. `evaluator_score.fluency` (float)
    
2. `evaluator_score.accuracy` (float)
    

它们之间**没有关联**。ES 并没有一个地方存储了“evaluator_score 下所有值的列表”。因此，想要“计算所有子字段的平均值”，你必须在查询时动态读取所有字段，这违反了利用索引加速的初衷。

#### 3.3.2 实现方案

##### 方案一：Script Query (脚本查询)

这是在不修改数据结构的情况下，唯一能做的方法。**但是性能极差。**

因为你是动态 Key，我们无法通过列式存储（DocValues）来遍历（DocValues 必须知道具体的 Field Name）。**我们被迫读取 `_source`（原始 JSON），这会导致 ES 扫描所有文档，完全放弃索引优势**。

**查询语句：**

```json
GET /expt_turn_result_filter/_search
{
  "query": {
    "bool": {
      "filter": {
        "script": {
          "script": {
            "lang": "painless",
            "source": """
              // 1. 检查字段是否存在
              if (params['_source']['evaluator_score'] == null) {
                return false;
              }
              
              // 2. 获取 map 对象
              def scoresMap = params['_source']['evaluator_score'];
              double sum = 0;
              int count = 0;

              // 3. 遍历动态 Key 并计算 Sum
              for (def key : scoresMap.keySet()) {
                if (scoresMap[key] instanceof Number) {
                  sum += scoresMap[key];
                  count++;
                }
              }

              // 4. 计算平均值并比较
              if (count == 0) return false;
              return (sum / count) > 0.5;
            """
          }
        }
      }
    }
  }
}
```

**⚠️ 为什么性能差？**

- **Full Scan**: 它会遍历所有文档。
    
- **Source Load**: 它必须从磁盘加载巨大的 `_source` JSON 并反序列化，无法利用我们之前讨论的 BKD 树或倒排索引。
    
- **Latency**: 这种查询在数据量上百万后，耗时通常以“秒”甚至“分钟”计。

##### 方案二：预计算，写入avg

很简单，就是写入数据的时候，加多一个字段，这个字段的值为 `avg(evaluator_score)`