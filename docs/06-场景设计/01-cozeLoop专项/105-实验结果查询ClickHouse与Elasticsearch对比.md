# 实验分析场景下 CK 与 ES 性能对比

我们还是用之前的那个例子 [030-实验结果过滤](../../04-中间件/ClickHouse/030-实验结果过滤.md)

在这个例子里面，我们建了一张表：

```sql
CREATE TABLE IF NOT EXISTS expt_turn_result_filter
(
    `space_id` String,
    `expt_id` String,
    `item_id` String,
    `item_idx` Int32,
    `turn_id` String,
    `status` Int32,

    -- 业务元数据
    `eval_target_data` Map(String, String),    -- 存储模型输入/输出，用于搜索
    `evaluator_score` Map(String, Float64),   -- 存储自动评估器的打分
    
    -- 人工标注 Map
    `annotation_float` Map(String, Float64),   -- 连续数值评分
    `annotation_bool` Map(String, Int8),      -- 布尔标记 (0/1)
    `annotation_string` Map(String, String),  -- 分类标签或备注文字

    `evaluator_score_corrected` Int32,
    `eval_set_version_id` String,
    `created_date` Date,
    `created_at` DateTime,
    `updated_at` DateTime,

    -- 用于索引过滤的二级索引
    INDEX idx_space_id space_id TYPE bloom_filter() GRANULARITY 1,
    INDEX idx_expt_id expt_id TYPE bloom_filter() GRANULARITY 1,
    INDEX idx_item_id item_id TYPE bloom_filter() GRANULARITY 1,
    INDEX idx_turn_id turn_id TYPE bloom_filter() GRANULARITY 1
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY created_date
ORDER BY (expt_id, item_id, turn_id)
SETTINGS index_granularity = 8192;
```

查询示例：

```sql
SELECT
    item_id,
    status
FROM expt_turn_result_filter
FINAL -- 关键：执行多版本合并，确保状态准确
WHERE expt_id = '7597428938863804417'
  AND status = 2
  AND evaluator_score['key1'] > 0.5
  AND eval_target_data['actual_output'] LIKE '%报错%'
ORDER BY item_idx
LIMIT 20 OFFSET 0;
```

这个查询的核心是：

1. 用稀疏主键索引定位到要查的实验在哪些 granule 里面，然后去查 `exp_id.bin` ，拿到对应id的实验在 granule 里面的偏移量。
2. 拿到偏移量之后，利用偏移量快速去查 `stautus.bin` ，`evaluator_score` 的几个 bin 等。

总而言之，加速查询的核心是稀疏主键索引定位到了要查的 granule，查 bin 的时候也很快（加载到内存，连续读内存）。

那么对于这个表，这个查询，如果迁移到 Elasticsearch 会是怎么样的呢？

Elasticsearch 对应结构：

``` json
PUT /expt_turn_result_filter
{
  "settings": {
    "number_of_shards": 3, 
    "number_of_replicas": 1,
    "refresh_interval": "1s" // 根据写入实时性调整
  },
  "mappings": {
    "dynamic": "strict", // 如果写入的文档包含 Mapping 中未定义的字段，ES 会直接报错并拒绝写入。根层级严格，防止脏数据，Map 字段内部开放
    "_source": { "enabled": true },
    "properties": {
      // --- 1. ID 类字段 (对应 CK String) ---
      // 使用 keyword 类型，对应 CK 的 LowCardinality(String) 或 String
      // 场景：精确匹配、聚合
      "space_id": { "type": "keyword" }, 
      "expt_id":  { "type": "keyword" }, 
      "item_id":  { "type": "keyword" },
      "turn_id":  { "type": "keyword" },
      
      // --- 2. 数值与状态 (对应 CK Int32) ---
      "item_idx": { "type": "integer" },
      "status":   { "type": "integer" },
      "evaluator_score_corrected": { "type": "integer" },

      // --- 3. 核心难点：文本内容的 Map ---
      // CK: Map(String, String) -> eval_target_data['actual_output']
      // 需求：全文检索 (LIKE %xxx%)
      "eval_target_data": {
        "type": "object", 
        "dynamic": true, // 允许写入任意 Key
        "properties": {
          // 固定成员
          "input": { 
            "type": "text", 
            "analyzer": "ik_max_word", // 建议中文分词
            "search_analyzer": "ik_smart",
            "fields": { "keyword": { "type": "keyword" } } // 支持精确排重
          },
          "actual_output": { 
            "type": "text", 
            "analyzer": "ik_max_word",
            "fields": { "keyword": { "type": "keyword" } }
          }
        }
      },

      // --- 4. 核心难点：动态分数的 Map ---
      // CK: Map(String, Float64) -> evaluator_score['key1'] > 0.5
      // 需求：Range 查询
      "evaluator_score": {
        "type": "object",
        "dynamic": true 
        // 配合下面的 dynamic_templates 自动映射为 float
      },
      "annotation_float": {
        "type": "object",
        "dynamic": true
      },

      // --- 5. 标注类 Map ---
      "annotation_bool": {
        "type": "object",
        "dynamic": true // 将 Int8 映射为 byte 或 boolean
      },
      "annotation_string": {
        "type": "object",
        "dynamic": true // 映射为 keyword
      },

      // --- 6. 时间字段 ---
      "created_date": { "type": "date", "format": "yyyy-MM-dd" },
      "created_at":   { "type": "date", "format": "yyyy-MM-dd HH:mm:ss||strict_date_optional_time" },
      "updated_at":   { "type": "date", "format": "yyyy-MM-dd HH:mm:ss||strict_date_optional_time" },
      "eval_set_version_id": { "type": "keyword" }
    },

    // --- 7. 动态模板 ---
    // 自动处理 Map 中未知的 Key
    "dynamic_templates": [
      {
        "scores_as_float": { // 模块名称
          "path_match": "evaluator_score.*", // 路径在 `evaluator_score` 内部的所有 Key
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
        // eval_target_data 里未知的 Key 默认既能全文搜，也能精确搜
        "target_data_as_text": {
          "path_match": "eval_target_data.*",
          "mapping": {
            "type": "text",
            "analyzer": "ik_max_word", // 需要安装 IK 分词器
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

细节补充：
1. `type keyword`，底层实现是倒排索引，擅长 `term` (精确等值匹配)
2. `type integer`，底层实现是 BKD-Tree，擅长范围查找


写入示例：

```json
POST /expt_turn_result_filter/_doc/YOUR_GENERATED_ID_HERE
{
  "space_id": "7591761752719622145",
  "expt_id": "7597428938863804417",
  "item_id": "7594089701489917953",
  "item_idx": 2,
  "turn_id": "0",
  "status": 2,
  "updated_at": "2026-01-20 13:07:44",
  
  // CK Map -> JSON Object
  "eval_target_data": {
    "input": "你是谁？",
    "actual_output": "你好，我是人工智能助手..."
  },
  "evaluator_score": {
    "key1": 0.8,
    "semantic_similarity": 1.0
  },
  "annotation_string": {
    "error_type": "Hallucination"
  }
}
```


读取示例：

**场景 A：分值过滤**

- CK: `WHERE evaluator_score['key1'] > 0.5`
    
- ES: `{ "range": { "evaluator_score.key1": { "gt": 0.5 } } }`

**场景 B：全文检索**

- CK: `WHERE eval_target_data['actual_output'] LIKE '%报错%'`
    
- ES: `{ "match": { "eval_target_data.actual_output": "报错" } }`
    
完整示例：

```json
GET /expt_turn_result_filter/_search
{
  "_source": ["item_id", "status"],  // 对应 SELECT item_id, status
  "from": 0,                          // 对应 OFFSET 0
  "size": 20,                         // 对应 LIMIT 20
  "sort": [
    { "item_idx": { "order": "asc" } } // 对应 ORDER BY item_idx
  ],
  "query": {
    "bool": {
      "filter": [  // --- 对应 WHERE 中的精确过滤 (不计算相关性得分，性能快) ---
        { 
          "term": { "expt_id": "7597428938863804417" } // 对应 AND expt_id = ...
        },
        { 
          "term": { "status": 2 }                      // 对应 AND status = 2
        },
        { 
          "range": { 
            "evaluator_score.key1": { "gt": 0.5 }      // 对应 Map 过滤: score['key1'] > 0.5
          } 
        }
      ],
      "must": [    // --- 对应 WHERE 中的文本搜索 (计算得分) ---
        {
          "match_phrase": {                            // 对应 LIKE '%报错%' (短语匹配)
            "eval_target_data.actual_output": "报错"
          }
        }
      ]
    }
  }
}
```