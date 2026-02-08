### 方案一：Script Query (脚本查询) —— **性能极差，仅限测试**

这是在不修改数据结构的情况下，唯一能做的方法。

但是，因为你是动态 Key，我们无法通过列式存储（DocValues）来遍历（DocValues 必须知道具体的 Field Name）。我们被迫读取 `_source`（原始 JSON），这会导致 ES 扫描所有文档，**完全放弃索引优势**。

**查询语句：**

JSON

```
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