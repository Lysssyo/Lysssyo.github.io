# OLAP 查询与计算对比：ClickHouse vs. Elasticsearch

## 1. 背景

在 **CozeLoop** 与 **Athena** 的评估实验体系中，针对海量实验项（Item）的实时检索与指标计算是核心诉求。用户通常需要基于关键词、评估分（Score）、或评估结果的统计值进行多维过滤。

然而，两者的技术底层选型逻辑截然不同：
- **CozeLoop (ClickHouse)**：基于列式存储的极致物理扫描，侧重于高吞吐的计算性能。
- **Athena (Elasticsearch)**：基于倒排索引与搜索优化器，侧重于亚秒级的检索响应。

## 2. CK 与 ES 的表/索引结构

详细的技术实现与索引设计请参考：
- [ClickHouse 实现 CozeLoop 实验结果过滤](../04-中间件/ClickHouse/030-ClickHouse%20实现%20cozeloop%20实验结果过滤.md)
- [Elasticsearch 实现 CozeLoop 实验结果过滤](../04-中间件/Elasticsearch/070-%20Elasticsearch%20实现%20cozeloop%20实验结果过滤.md)

## 3. 场景分析

### 3.1 场景一：精准维度 + 文本内容过滤

#### **ClickHouse 实现分析**

CK 采用的是 **稀疏索引 (Sparse Index) + 列式物理扫描** 模式。

```sql
SELECT
    item_id    
FROM expt_turn_result_filter
FINAL
WHERE expt_id = '7597428938863804417'
  AND status = 2
  AND eval_target_data['output'] LIKE '%报错%'
ORDER BY item_idx
LIMIT 20 OFFSET 0;
```

1.  **稀疏索引定位**：`expt_id` 作为排序键（OrderBy Key），CK 利用稀疏索引快速定位 `Granule`（数据颗粒）。这能跳过绝大多数无关的数据块，将扫描范围缩小到特定的 Granule。
2.  **Map 列解析**：CK 在存储 `Map(String, String)` 时，底层拆分为两个嵌套列（Keys 和 Values）。过滤时需先扫描 Keys 找到 `output` 的偏移量，再从 Values 中提取对应值进行匹配。
3.  **Merge-on-Read (FINAL) 瓶颈**：由于实验数据存在版本更新（Turn 覆盖），使用 `FINAL` 会触发 `ReplacingMergeTree` 的实时合并。
    *   **知识修正**：`FINAL` 并非简单的“内存合并”，而是在读取流中进行 **多路归并（Stream Merging）**。这会导致查询无法完全并行化，且 CPU 需高频比对版本字段，开销随数据量增长剧烈。
4.  **文本匹配**：`LIKE '%报错%'` 是纯粹的指令集暴力扫描，在大文本场景下 CPU 损耗极大。

#### **Elasticsearch 实现分析**

ES 采用的是 **倒排索引 (Inverted Index) 驱动的检索** 模式。

```json
GET /expt_turn_result_filter/_search
{
  "_source": ["item_id", "evaluator_score"],
  "query": {
    "bool": {
      "filter": [
        { "term": { "expt_id": "7597428938863804417" } },
        { "match": { "eval_target_data.output": "报错" } }
      ]
    }
  }
}
```

1.  **倒排链集合运算**：`expt_id` 和 `output` 的过滤条件各自对应一个倒排链（Posting List）。ES 通过跳表（Skip List）或 Bitset 在内存中进行位运算，直接定位到符合条件的 DocID，无需扫描原文。（也不一定，参考[4.3 多索引结构的并行求交集 (Index Intersection)](../04-中间件/Elasticsearch/040-Elasticsearch%20读写链路.md#4.3%20多索引结构的并行求交集%20(Index%20Intersection))）
2.  **读优化设计**：ES 在写入时即完成索引构建，查询时数据通常已在后台合并（Segment Merge）。读取路径是“静态”的，无需像 CK 的 `FINAL` 那样在查询时实时处理多版本冲突。

补充一点：

在这里，`{ "match": { "eval_target_data.output": "报错" } }` 是利用倒排索引做查询（match就是查分词器分出来的词），但是，如果没用 `match`，即走真正的模糊查询（用 `wildcard`）就得暴力扫了。

不过，``wildcard`` 的暴力扫是扫词典，也扫的比 CK 遍历 `.bin`快。（而且还可能走多索引结构并行求交集）

#### **对比结论：ES 优势明显**

在 **“带文本搜索的过滤场景”** 下，ES 的速度通常优于 CK。
*   **本质原因**：ES 查的是“目录”，而 CK 扫的是“明细”。 ES 一扫就扫到符合条件的 DocID ，而 CK 要遍历 `.bin` 文件才能找到
*   **核心痛点**：CK 的 `FINAL` 会显著拖慢大结果集的返回速度，而 ES 利用倒排索引实现了近乎恒定的检索延迟。

### 3.2 场景二：精准维度 + Range 范围过滤

#### **ClickHouse 实现分析**

```sql
SELECT
    item_id
FROM expt_turn_result_filter
FINAL
WHERE expt_id = '7597428938863804417'  
  AND evaluator_score['key1'] > 0.5
ORDER BY item_idx
LIMIT 20 OFFSET 0;
```

1.  **分块过滤**：同 3.1 节，依靠 `expt_id` 的稀疏索引定位 Granule。
2.  **向量化执行 (Vectorized Execution)**：
    *   针对 `evaluator_score > 0.5`，CK 的物理读取引擎会批量加载 score 列的 `.bin` 文件。
    *   由于数值类型是固定长度且连续存储的，CK 会利用 **SIMD (单指令多数据流)** 指令集在 CPU 层面进行并行比对，处理百万级数据的开销极低。
3.  **FINAL 的持续拖累**：虽然数值比对极快，但由于存在 `FINAL`，CK 仍需进行多路归并以保证结果的唯一性，这依然是此链路的主要耗时点。

#### **Elasticsearch 实现分析**

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "expt_id": "7597428938863804417" } },
        { "range": { "evaluator_score.key1": { "gt": 0.5 } } }
      ]
    }
  }
}
```

ES 处理数值 Range 查询的核心不再是倒排索引，而是 **BKD 树**。其查询效率取决于 **代价估算器 (Cost Estimator)** 的动态决策：

1.  **策略一：DocValues 验证 (Driver-Verifier)**
    *   **适用场景**：当 `expt_id` 命中的文档数很少（如 < 10,000 条）时。
    *   **逻辑**：先通过倒排索引查出所有相关 DocID，然后直接去 `DocValues`（列式存储）中读取对应的 score 值进行校验。
    *   **优势**：避免了昂贵的 BKD 树遍历开销，随机 I/O 在数据量小时性价比最高。

2.  **策略二：跳蛙式求交 (Leapfrog / BKD Conjunction)**
    *   **适用场景**：当 `expt_id` 命中的文档数极多时。
    *   **逻辑**：此时 ES 会让 `expt_id` 的倒排迭代器与 `score` 的 BKD 迭代器“互相追赶”。利用 BKD 树自带的有序列表和跳表，快速跳过不重合的区间。
    *   **优势**：在大数据量下，避免了数百万次的随机寻址，效率远高于策略一。

#### **对比结论：势均力敌，CK 在大范围过滤下略胜**

*   **小范围过滤**：两者基本秒回，差异体现在 ES 的分片聚合开销 vs CK 的 `FINAL` 合并开销。
*   **大范围过滤/全表扫描**：**CK 通常完胜。** 因为数值比对是 CK 的“主场”，向量化引擎在处理单纯的数值计算时，其吞吐量远非 ES 这种复杂的索引结构所能比拟。

### 3.3 场景三：精确维度 + 文本内容 + Range 范围过滤

#### **ClickHouse 实现分析**

```sql
SELECT
    item_id
FROM expt_turn_result_filter
FINAL
WHERE expt_id = '7597428938863804417'
  AND eval_target_data['output'] LIKE '%超时%'
  AND evaluator_score['key1'] > 0.8
ORDER BY item_idx
LIMIT 20 OFFSET 0;
```

1.  **扫描模型限制**：CK 依然遵循“先定位 Granule，再线性扫描”的逻辑。
2.  **多重解析开销**：每一行数据都要同时解压并读取 `eval_target_data` (文本) 和 `evaluator_score` (数值)。
3.  **性能木桶效应**：查询速度受限于最慢的过滤条件。由于 `LIKE` 是暴力扫描，即使数值比对是向量化的，整体速度仍被拉低到文本扫描的水平。
4.  **FINAL 并发瓶颈**：复杂的过滤条件配合 `FINAL` 会导致单次查询占用大量 CPU 周期，高并发下极易导致查询排队。

#### **Elasticsearch 实现分析**

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "expt_id": "7597428938863804417" } },
        { "match": { "eval_target_data.output": "超时" } },
        { "range": { "evaluator_score.key1": { "gt": 0.8 } } }
      ]
    }
  }
}
```

ES 的核心优势在于 **“多索引联合驱动” (Multi-Index Conjunction)**：

1.  **三路交集计算**：
    *   ES 同时启动 `expt_id` 的倒排链、`output` 的词项索引以及 `score` 的 BKD 树。
    *   利用 **跳表 (Skip List) 并行追赶**：例如从 `expt_id` 拿到 DocID 100，立刻去 `output` 的倒排链里跳过所有小于 100 的 ID；如果 `output` 刚好有 100，再让 BKD 树校验 100 是否符合范围。
2.  **缓存友好 (Filter Cache)**：
    *   常见的过滤条件（如 `expt_id`）会被 ES 以 Bitset 形式缓存。后续复合查询只需进行位运算（Bitwise AND），速度极其惊人。
3.  **代价估算再升级**：
    *   如果 ES 发现 `output` 的词项匹配极其稀疏（如全表仅 5 行包含“超时”），它会直接让“超时”作为 Driver（首发），另外两个条件退化为 Verifier（验证）。这种灵活性是 CK 物理扫描无法实现的。

#### **对比结论：ES 压倒性优势**

在 **“多重复合过滤”** 场景下，ES 是绝对的王者。
*   **原因**：CK 必须读取所有符合 `expt_id` 的原始数据块；而 ES 可以利用三个维度的索引不断“减枝”，最终可能只需要读取几十个文档的元数据。
*   **适用边界**：只要过滤条件能显著减少结果集（过滤率高），首选 ES。


### 3.4 场景四：精确维度 + 行级动态计算过滤 (Row-level Calculation)

#### **ClickHouse 实现分析**

```sql
SELECT
    item_id
FROM expt_turn_result_filter
FINAL
WHERE expt_id = '7597428938863804417'
  AND arrayAvg(mapValues(evaluator_score)) > 0.5;
```

1. **主键索引过滤 (Primary Key Pruning)**： 你的表 `ORDER BY (expt_id, ...)`。CK 首先利用稀疏索引（`.idx` 文件）快速定位到 `expt_id = '759...'` 所在的那几个 **Data Part**（数据块）。
    
    - _效果_：直接过滤掉 99.9% 的无关数据块。
        
2. **列裁剪 (Column Pruning)**： 在剩下的数据块中，CK **只读取** `evaluator_score.values` 这一列的数据。其他列（如 `input`, `created_at`）完全不碰。
    
3. **向量化计算 (SIMD Vectorization)**： 这是 CK 的杀手锏。它加载一坨数据（比如 65536 行）进入 CPU 缓存。
    
    - 调用 `mapValues`：其实就是直接拿到了底层那个 Float 数组。
        
    - 调用 `arrayAvg`：利用 CPU 的 SIMD 指令（单指令多数据流），一次性计算多个数组的平均值。
        
    - **速度**：这种计算是在内存中纯数字的运算，没有 JSON 解析，没有对象反序列化，速度接近内存带宽极限。

#### **Elasticsearch 实现分析**

```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "expt_id": "7597428938863804417" } },
        {
          "script": {
            "script": {
              "source": "double sum = 0; int count = 0; for (v in doc['evaluator_score.values']) { sum += v; count++; } return count > 0 && (sum/count) > 0.5",
              "lang": "painless"
            }
          }
        }
      ]
    }
  }
}
```

在 Lucene 层面，这会被打平成多个**完全独立**的字段：

1. `evaluator_score.fluency` (float)
    
2. `evaluator_score.accuracy` (float)
    

它们之间**没有关联**。ES 并没有一个地方存储了“evaluator_score 下所有值的列表”。因此，想要“计算所有子字段的平均值”，你必须在查询时动态读取所有字段，这违反了利用索引加速的初衷。

#### **对比结论：CK 碾压级优势**

在 **“行级动态计算（列间计算）”** 场景下，CK 的表现远超 ES。
*   **性能代差**：CK 凭借原生数组函数和向量化执行，通常比 ES 的脚本查询快 10 倍以上。
*   **架构选型建议**：如果业务中涉及大量“根据 A 列和 B 列的某种计算结果进行过滤”的需求，ClickHouse 是唯一能保证实时性的选择。




