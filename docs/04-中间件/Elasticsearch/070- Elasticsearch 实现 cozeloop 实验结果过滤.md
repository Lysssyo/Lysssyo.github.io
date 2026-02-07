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