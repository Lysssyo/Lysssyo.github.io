# CK 与 ES 查询、计算对比

## 1. 背景

扣子罗盘和 Athena 都有评估实验的模块，评估实验有结果过滤的功能，即可以通过对 Item 的关键词、对评估器的评估结果、对评估器评估结果的聚合数据（例如 avg(eval_store) ）进行过滤，但是，Athena 与 扣子罗盘的技术选型不同。扣子罗盘选择了 ClickHouse ，而 Athena 选择了 Elasticsearch。

下面，分析各个过滤场景下，ClickHouse 与 Elasticsearch 的性能差距对比。


## 2. CK 与 ES 的表/索引结构

[030-ClickHouse 实现 cozeloop 实验结果过滤](../04-中间件/ClickHouse/030-ClickHouse%20实现%20cozeloop%20实验结果过滤.md)

[070- Elasticsearch 实现 cozeloop 实验结果过滤](../04-中间件/Elasticsearch/070-%20Elasticsearch%20实现%20cozeloop%20实验结果过滤.md)


## 3. 场景分析

## 3.1 expt_id + eval_target_data.output 过滤

对于 ClickHouse：

ClickHouse 实现这个过滤的sql语句是：

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

expt_id 为 稀疏索引主键的一部分，即如果指定了expt_id，就可以利用稀疏索引主键加速 granule 的过滤，可以利用到 ClickHouse 底层的最大优势。

做了 granule 的过滤之后，就可以通过 expt_id.mrk 以及 expt_id.bin 得出这一行在 granule 中的行偏移，然后就能去  eval_target_data.mrk,eval_target_data.offset.bin,eval_target_data.key.bin,eval_target_data.value.bin ，遍历得到eval_target_data.output的值，然后判断这一行是否可以被过滤。

最后因为有final，取出每个part所有数据后，要在内存进行**Merge-on-Read**（读时合并）

对于 Elasticsearch：

Elasticsearch实现的请求是：

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
          "match": { "eval_target_data.output": "报错" } 
        }
      ]
    }
  }
}
```

对于ES来说，这是多索引结构的并行过滤，在这里，driver是 expt_id的倒排索引，verify是 eval_target_data.output的倒排索引。

`"term": { "expt_id": "7597428938863804417" } `走倒排索引查询，很快就能拿到符合条件的docID，然后用eval_target_data.output的倒排索引去校验这些docID符不符合他的条件。

对比：

ES 会快一些，因为 ES用倒排索引可以很快定位到要模糊查询的文本，不用做遍历来过滤，并且ES是写入时更新，可以覆盖写入，不用在内存做多版本的final合并


## 以下不用看
---

一共有哪些场景：

主键 + 文本模糊匹配 -》 ck，es一样快

主键 + range ck，es一样快

查 Term + Range，如果driver部分有很多符合的，也是用docvalue吗


这是一个直击 Lucene 优化器灵魂的深层问题。

**直接回答：不，这时候就不会用 DocValues 了。**

当 Term 查询命中的文档非常多（“Driver 部分有很多符合”）时，Lucene 的代价估算器（Cost Estimator）会认为：**“再去查 DocValues（随机 I/O）太慢了，不如直接查 BKD 树（Index）。”**

这时候，查询模式会从 **“主从验证模式” (Driver-Verifier)** 切换为 **“双迭代器交集模式” (Conjunction / Leapfrog)**。

---

### 1. 为什么“很多符合”时不用 DocValues？

我们要算一笔账：

- **DocValues 的读取方式**：是 **随机访问 (Random Access)**。
    
    - 查一个 DocID 的值，就是一次磁盘 Seek（或者内存页跳转）。
        
    - 如果是 1000 个文档，Seek 1000 次，很快。
        
    - 如果是 **1000 万个文档**，Seek 1000 万次，**慢得要死**（即使有 OS Cache 也很耗 CPU）。
        
- **BKD 树的读取方式**：是 **有序迭代 (Sequential / Skip)**。
    
    - 它本身就是一棵树，本来就存好了 `price > 100` 的所有文档 ID 列表（以压缩块形式）。
        
    - 读取它是批量加载 Block，利用 Skip List 快速跳跃。
        

**阈值逻辑**：

Lucene 内部有一个类叫 `IndexOrDocValuesQuery`。它会根据 `lead_cost`（Driver 的文档数）做判断：

> **如果 (Driver 匹配数) >>> (读取 BKD 树索引的开销)，那么放弃 DocValues，改用 BKD 树。**

---

### 2. 切换后的模式：Leapfrog (跳蛙式交集)

当 Term 和 Range 都很大时，它们地位变得**平等**了。ES 不再是谁驱动谁，而是让两个迭代器（Iterator）**互相追赶**。

**场景**：

- **Term Query** (`status='active'`): 匹配 1000 万个文档 `[1, 5, 10, ...]`
    
- **Range Query** (`price > 50`): 匹配 2000 万个文档 `[3, 8, 10, ...]`
    

**执行流程 (Leapfrog Algorithm)**：

1. **Term Iter** 说：“我现在在 **Doc 1**。”
    
2. **Range Iter** (BKD) 说：“我当前的最小文档是 3。**Doc 1 我没有，你直接跳到 (Advance) >= 3 的位置吧。**”
    
3. **Term Iter** 说：“好，我利用跳表（Skip List）跳到了 **Doc 5**。现在我在 5。”
    
4. **Range Iter** 说：“我的 3 后面是 8。**Doc 5 我没有，你跳到 >= 8 吧。**”
    
5. **Term Iter** 说：“好，我跳到了 **Doc 10**。”
    
6. **Range Iter** 说：“哎巧了！我也跳到了 **Doc 10**。**-> Match! (放入结果集)**”
    
7. ... 继续互相跳跃 ...
    

### 3. 图解对比：少量 vs 多量

为了让你彻底明白这个分界线，请看下面的对比图：

代码段

```
graph TD
    subgraph "Scenario A: Driver 很少 (e.g. 100 hits)"
        direction TB
        DA[Term Query Result] -- "List: [10, 20, 50]" --> LogicA
        LogicA{Cost Estimator} -- "很少" --> PathA
        
        PathA["<b>路径: DocValues 验证</b><br>(随机查值)"]
        PathA -- "Seek Doc 10..." --> DVD[DocValues 文件]
        PathA -- "Seek Doc 20..." --> DVD
        
        NoteA[优点: O(1) 查值<br>缺点: 此时不用爬树]
    end

    subgraph "Scenario B: Driver 很多 (e.g. 1000万 hits)"
        direction TB
        DB[Term Query Result] -- "List: [1...1000w]" --> LogicB
        LogicB{Cost Estimator} -- "太多了!" --> PathB
        
        PathB["<b>路径: BKD Tree 交集</b><br>(Leapfrog 跳跃)"]
        
        subgraph Leapfrog
            Iter1[Term Iterator<br>倒排链] 
            Iter2[Range Iterator<br>BKD 树]
            
            Iter1 -- "advance(target)" --> Iter2
            Iter2 -- "advance(target)" --> Iter1
            NoteB[两个巨大的有序链表<br>互相跳过不匹配的区域]
        end
    end
    
    style PathA fill:#e1f5fe,stroke:#01579b
    style PathB fill:#fff9c4,stroke:#fbc02d
```

### 4. 总结：ES 的“智能”之处

Elasticsearch (Lucene) 的强大之处就在于它不做“一刀切”。

1. **Term 命中少** -> **查 DocValues**。
    
    - _比喻_：老板让你查 5 个人是不是经理。你直接拿着这 5 个人的名字去翻人事档案表（DocValues）。
        
2. **Term 命中多** -> **查 BKD 树 (Index)**。
    
    - _比喻_：老板让你查“销售部”（1万人）里谁是“经理”（500人）。你不会去翻 1 万次档案。你会直接拿“销售部花名册”和“经理花名册”，两个人坐在一起比对（Leapfrog），看谁的名字同时也出现在两张表上。
        

所以，**DocValues 并不是 Range 查询的唯一路径，它只是“少量验证”时的捷径。** 一旦数据量大了，还是得靠索引（BKD / Inverted Index）的正规军来打阵地战。

主键 + range 查询 + 文本模糊匹配 ck，es 一样快

主键 + 计算 -》 ck 秒杀


