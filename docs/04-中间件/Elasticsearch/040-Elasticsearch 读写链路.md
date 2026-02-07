---
date created: 2026-01-29 20:51:54
date modified: 2026-02-03 21:08:29
---
# Elasticsearch 读写链路

## 1. 绪论

Elasticsearch 作为基于 Lucene 构建的分布式搜索与分析引擎，其核心竞争力在于能够处理 PB 级数据的近实时（Near Real-Time, NRT）搜索与聚合分析。理解 ES 的读写链路机制，不仅仅是掌握 API 的调用，更是对其底层分布式协调、数据一致性模型、Lucene 段合并机制以及故障恢复原理的深度解构。本报告将从分布式系统的视角出发，详尽剖析 ES 的内部运行机制，涵盖集群拓扑、数据分片模型、写入全链路、读取执行计划以及底层容错恢复机制。

在深入读写链路之前，必须首先建立对 ES 集群节点角色的认知。[050-分布式协同与一致性机制](050-分布式协同与一致性机制.md)

## 2. 宏观集群写入链路

ES 的写入路径设计极其精妙，旨在平衡高吞吐量的写入需求与数据的一致性、持久性。该过程涉及协调节点的路由、主分片的执行、Translog 的预写日志机制、以及基于 PacificA 模型变体的副本同步。

### 2.1 协调节点阶段：请求路由与分发

当客户端发起一个 Index/Delete/Update 请求时（例如 `PUT /index/_doc/1`），请求首先到达集群中的任意一个节点，该节点随即充当**协调节点**。

#### 2.1.1 路由计算算法

协调节点首先验证请求的格式。随后，它必须确定该文档应当存储在哪个主分片上。ES 默认使用 `_id` 的哈希值进行路由计算，公式如下：

$$\text{shard} = \text{hash}(\text{routing}) \pmod{\text{number\_of\_primary\_shards}}$$

这里的 **`routing` 默认是文档的 `_id`**，也可以由用户显式指定。这个公式解释了为什么**主分片数量在创建索引后不能随意修改**——如果主分片数变化，哈希取模的结果也会变化，导致无法定位到已有的数据 。如果用户需要自定义路由（例如将同一租户的数据路由到同一分片以优化查询），可以在请求中指定 `routing` 参数。

#### 2.1.2 请求转发

计算出目标主分片 ID 后，协调节点通过访问集群状态（Cluster State）中的路由表，查找该主分片当前所在的 Data Node IP 地址，并将请求转发给该节点。这个过程是透明的，客户端无需感知分片的具体位置 。

> [!TIP] 不需要访问主节点
> **集群状态**是由 Master 节点负责维护和更改的（例如分片迁移、节点加入）。但是，Master 节点并不是这个状态的“唯一访问入口”。当集群状态发生变化时，Master 节点会将最新的 `Cluster State` **主动推送到集群中的所有节点**。所以，每个节点都知道`Cluster State`

### 2.2 主分片执行阶段：内存缓冲与事务日志

请求到达主分片所在节点后，进入核心写入流程。ES 采用的是**乐观锁**。

#### 2.2.1 乐观锁与序列号

在执行写操作前，主分片会检查并发冲突。

- 在 ES 6.x 之前，主要使用 `_version` 字段进行版本控制。
    
- 从 6.x 开始（并在 7.x 中完善），ES 引入了更严谨的 **Sequence Number (`_seq_no`)** 和 **Primary Term (`_primary_term`)** 机制。
    
    - **_seq_no**：主分片为每个操作（索引、更新、删除）分配一个递增的序列号。这个序列号在分片级别是唯一的且严格递增。
        
    - **_primary_term**：主分片任期号。每当主分片发生故障转移或重新选举时，Term 加 1。
        
    - 这两个参数共同构成了数据的唯一版本标识，用于解决分布式环境下的乱序与冲突问题，特别是在跨集群复制（CCR）和快速恢复场景中至关重要 。

ES 的乐观锁机制并非隐形，它显式地暴露在 REST API 的请求与响应中。

**(1) 获取版本凭证（GET 响应）** 在修改数据前，客户端通常需要先读取文档。此时，ES 会在响应体中显式返回当前的并发控制元数据。这是客户端获取“锁凭证”的唯一途径。

``` json
// GET /products/_doc/1
{
  "_index": "products",
  "_id": "1",
  "_version": 5,          // 传统的版本号（仅用于兼容或简单比对）
  "_seq_no": 12,          // 【关键】当前操作序列号（门票）
  "_primary_term": 1,     // 【关键】当前主分片任期号（场次）
  "found": true,
  "_source": {
    "price": 100
  }
}
```


**(2) 带条件的写入（PUT/POST 请求参数）** 客户端在执行写操作（Index 或 Update）时，必须将上一步获取的 `_seq_no` 和 `_primary_term` 作为查询字符串参数（Query String Parameters）传回给 ES。这相当于告诉 ES：“我基于序列号 12 和任期 1 进行修改”。

``` json
PUT /products/_doc/1?if_seq_no=12&if_primary_term=1
{
  "price": 99
}
```

当乐观锁检查失败时，ES 的行为如下：

**(1) 失败响应 (HTTP 409)** 如果版本不匹配，ES 不会阻塞等待，而是直接抛出异常，状态码为 **409 Conflict**。

``` json
{
  "error": {
    "type": "version_conflict_engine_exception",
    "reason": "[1]: version conflict, required seqNo [12], primary term [1]. current document has seqNo [13] and primary term [1]",
    ...
  },
  "status": 409
}
```

> **含义**：告诉你“你手里的版本是 12，但数据库里已经是 13 了，你的修改被拒绝。”

**(2) 解决方案 A：业务层重试（Manual Retry）** 开发人员需要在代码中捕获 409 异常，重新执行 `GET` 获取最新版本，应用业务逻辑后再次 `PUT`。这是最严谨的做法。

**(3) 解决方案 B：内部自动重试（retry_on_conflict）** 对于部分更新（Partial Update）接口，ES 提供了一个简化参数，允许服务端内部自动处理“读取-修改-写回”的循环。

``` json
// 告诉 ES：如果冲突，请帮我自动重试最多 3 次
POST /products/_update/1?retry_on_conflict=3
{
  "doc": { "price": 99 }
}
```

- **适用场景**：简单的字段更新或脚本累加。
    
- **不适用场景**：需要依赖旧值进行复杂外部逻辑判断（如调用第三方支付）的业务。


#### 2.2.2 写入内存缓冲区

**文档首先被写入 Lucene 的内存缓冲区（Indexing Buffer）。此时，文档还不可被搜索。** 这是 ES 被称为“近实时”而非“实时”搜索的关键原因。Lucene 的倒排索引结构非常复杂，实时构建索引开销巨大，因此采用缓冲机制批量构建 。

要详细了解这个过程，我们先看看这三大核心数据结构是什么。[020-Elasticsearch 核心数据结构](020-Elasticsearch%20核心数据结构.md)

#### 2.2.3 写入 Translog

为了保证数据持久性（Durability），操作会同时被**追加写** **Translog**（顺序IO，性能极高）。Translog 是一个顺序写的日志文件，类似于数据库的 WAL（Write-Ahead Log）。

- **Crash Recovery**：Lucene 的内存 Buffer 数据在服务器断电时会丢失，而 Translog 的存在就是为了在节点重启时重放（Replay）这些未落盘的操作，恢复数据 。
    
- **fsync 策略**：Translog 的落盘策略由 `index.translog.durability` 控制。
    
    - **request（默认）**：ES 会在每个请求返回成功前，强制对 Translog 执行 `fsync` 到磁盘。这意味着虽然 Lucene 索引尚未持久化，但数据已安全记录在 Translog 中。这是最安全但性能最低的模式。
        
    - **async**：会定时（默认 5秒）刷盘。这虽然显著提升了写入吞吐量，但引入了数据丢失风险（宕机可能丢失最近 5 秒的数据）。
        

### 2.3 副本复制阶段：PacificA模型与一致性

一旦主分片上的操作执行成功（即写入了 Memory Buffer 和 Translog），主分片会并发地将该操作发送给所有处于 **In-Sync** 状态的副本分片 。

> [!TIP] In-Sync Allocation IDs
> ES 维护一个“同步副本集合”，只有在这个集合中的副本才会被视为有效副本。如果一个副本因为网络分区或宕机落后太多，它会被移出该集合，不再接收新的写入请求，直到它执行 Peer Recovery 追上主分片 。

#### 2.3.1 并行复制机制

与某些主从复制系统（如 Kafka 的 ISR 链式复制）不同，ES 的主分片是**并行**向所有副本发送请求的。这降低了整体延迟，但也带来了乱序到达的风险。ES 通过在副本上校验 `_seq_no` 和 `_primary_term` 来确保操作顺序的正确性 。

> [!TIP] 乱序了怎么办
> 例如：主分片连续收到了两个写请求：**请求 A**：`_seq_no = 10` （先发出的）以及**请求 B**：`_seq_no = 11` （后发出的）
> 副本分片收到 `SeqNo: 11` 时，它查看自己的 **Local Checkpoint（本地检查点）**，发现是 `9`。
> - **副本心想**：“我当前处理完的是 9，现在来了个 11，说明中间缺了个 10。”
> - **动作**：
>     
>     1. 先把 11 **写入内存和磁盘**（不会丢弃）。
>         
>     2. 但是，**不推进** Local Checkpoint。
>         
>     3. 告诉主分片：“我收到了”。
>         
>     4. 等到 `SeqNo: 10` 终于姗姗来迟并写入后，副本发现 `9, 10, 11` 连起来了。
>         
>     5. **瞬间推进** Local Checkpoint 到 11。

> [!TIP] 如果`SeqNo:10`一直不来怎么办
> 1. 网络重试：TCP层、ES Transport 层
> 2. 副本触发Peer Recovery（节点间恢复）
> 3. 踢出 ISR (In-Sync Replicas)
#### 2.3.2 副本执行与 Ack

副本分片接收到请求后，执行与主分片类似的操作（写入 Buffer , Translog）。**副本分片使用的是主分片分配的 `_seq_no` 和 `_primary_term`，这保证了所有分片上数据版本的一致性**。 主分片等待所有“同步中（In-Sync）”的副本分片响应成功。一旦满足 `wait_for_active_shards`（默认为 1，即只要主分片成功即可，但在高可靠场景下通常设置为 `all` 或 `quorum`）的条件，主分片向协调节点报告成功，协调节点再向客户端返回成功 。

#### 2.3.3 数据复制模型：PacificA

ES 的数据复制模型基于微软研究院的 **PacificA** 算法。

- **配置管理**：ES 的 Master 节点类似于 PacificA 中的 Configuration Manager，负责维护副本组（Replica Group）的成员关系。
- **In-Sync Allocation IDs**：ES 维护一个“同步副本集合”，只有在这个集合中的副本才会被视为有效副本。如果一个副本因为网络分区或宕机落后太多，它会被移出该集合，不再接收新的写入请求，直到它执行 **Peer Recovery** 追上主分片 。
- **Peer Recovery（节点间恢复）** 过程，主要在做两件事：
	- **情况 A：落后太多（或新加入） -> 复制文件**
	    
	    - 如果副本是全新的，或者落后太久导致 Translog 已经被清理了。
	        
	    - **它在干嘛**：它在通过网络，直接从主分片那里**拷贝底层的 Segment 文件**（物理文件复制）。这时候它根本没空也没能力处理实时的写入请求。
	        
	- **情况 B：落后一点点 -> 重放 Translog**
	    
	    - 如果副本只是短暂断网（比如重启了 1 分钟）。
	        
	    - **它在干嘛**：它在请求主分片把这 1 分钟内错过的操作（Operation）通过 **Translog（事务日志）** 重放给它。
    

## 3. 分片内 Lucene 写入机制

在上述标准写入流程之外，ES 内部有三个至关重要的后台过程，它们决定了数据的可见性（Searchability）、持久性（Durability）和存储效率（Storage Efficiency）。

### 3.1 Refresh：实现近实时搜索 (NRT)

ES 被称为“近实时”搜索引擎，其核心机制在于 **Refresh**。默认每 1 秒，ES 会执行一次 Refresh 操作 ：

1. **内存封存**：Indexing Buffer 中的数据被“封存”，不可再写入。
    
2. **生成段（Segment）**：Lucene 将封存的数据序列化为一个新的 Segment。此时，Term Dictionary、倒排表、DocValues 等结构被写入文件系统。
    
3. **OS Cache 可见性**：关键在于，这些新生成的文件并没有强制 `fsync` 到物理磁盘，而是写入了操作系统的 **Page Cache**（文件系统缓存）。**在 Linux 系统中，写入 Page Cache 的文件可以被立即打开并读取。**
    
4. **Reopen**：Lucene 重新打开 IndexReader，包含这个新的 Segment。此时，文档即变得“可被搜索”。
    

正是因为跳过了昂贵的磁盘 `fsync`，Refresh 操作才能做到轻量级且高频（秒级）。但也正因如此，此时的数据安全完全依赖 Translog，因为新生成的 Segment 仍处于易失的内存（Page Cache）中 。
    
- **性能权衡**：频繁的 Refresh 会产生大量小 Segment，导致合并压力大。在批量导入（Bulk Indexing）期间，通常建议将 `refresh_interval` 设置为 `-1` 或更大值（如 `30s`），以提升写入吞吐量 。
    

### 3.2 Flush：确保数据持久化

随着时间推移，Translog 会越来越大，内存中的未落盘 Segment 也越来越多。如果不清理，恢复时间将不可接受。

- **触发条件**：默认每 30 分钟，或者 Translog 大小达到 512MB（`index.translog.flush_threshold_size`）。
    
- **动作**：
    
    1. 执行一次 Refresh，清空 Buffer。
        
    2. 调用 Lucene 的 **Commit** 操作：将所有文件系统缓存中的 Segments 强制 `fsync` 到物理磁盘。
        
    3. **清空 Translog**（或滚动生成新的 Translog），因为数据已经安全落盘，不再需要旧的日志来恢复了。
        
    4. 更新 Commit Point 文件，记录当前所有有效的 Segments。
        
- 这个过程被称为 **Flush**。它是真正的持久化操作。理解 Flush 和 Refresh 的区别是理解 ES 数据安全性的关键 。
    

### 3.3 Merge：段合并与清理

由于每秒一次的 Refresh 会产生大量的小 Segment，这会导致文件句柄耗尽并严重降低搜索性能（搜索需要遍历所有段）。

- **机制**：ES 后台运行 Merge 线程，自动选择一些大小相似的 Segments 进行合并。
    
- **物理删除**：在 Lucene 中，删除操作只是在 `.del` 文件中打个标记。只有在 Merge 过程中，被标记为“已删除”（Deleted）或“被更新”（Updated，即旧版本）的文档才会被真正丢弃，不再写入新 Segment。这是 ES 释放磁盘空间的唯一方式。
    
- **TieredMergePolicy**：ES 默认使用分层合并策略（TieredMergePolicy）。
    
    - **策略细节**：它将 Segment 按大小分层，允许合并非相邻的 Segment。
        
    - **关键参数**：
        
        - `index.merge.policy.segments_per_tier`：每层允许的段数量。值越小，合并越积极，搜索越快，但写入开销越大。
            
        - `index.merge.policy.max_merge_at_once`：一次合并最多处理多少个段。
            
    - 这种策略旨在平衡写入放大（Write Amplification）和读取放大（Read Amplification）。
        

**表 1：Refresh, Flush 与 Merge 的关键特性对比**

|**特性**|**Refresh**|**Flush**|**Merge**|
|---|---|---|---|
|**核心目的**|使数据可被搜索 (Visibility)|使数据持久化到磁盘 (Durability)|优化存储结构，物理删除数据 (Optimization)|
|**默认频率**|1秒|30分钟 或 Translog 512MB|后台持续运行|
|**数据流向**|Memory Buffer -> OS Cache|OS Cache -> Physical Disk|Multiple Segments -> One Segment|
|**Translog影响**|不清理|**清理/截断**|不涉及|
|**性能影响**|影响搜索实时性，消耗 CPU|影响磁盘I/O (fsync)|消耗大量CPU和I/O，但提升后续搜索速度|

## 4. 读取链路

> [!TIP]
> 分布式搜索的能力

搜索是 ES 的核心能力，其分布式查询流程被设计为 **Scatter-Gather（发散-汇聚）** 模式。为了最小化网络传输量，避免在不知晓哪些文档匹配的情况下就传输大量完整文档，ES 将搜索过程严格拆分为两个阶段：**Query Phase（查询阶段）** 和 **Fetch Phase（取回阶段）**。

### 4.1 第一阶段：查询阶段

当搜索请求发送到协调节点时，第一阶段开始：

1. **广播请求**：协调节点解析查询请求（如 `{"query": {"match": "elasticsearch"}}`），并将其广播到索引的所有分片（主分片或副本分片均可）。协调节点会通过轮询（Round-Robin）或其他负载均衡策略（如 Adaptive Replica Selection，根据节点负载智能选择）选择副本，以分摊负载 。
    
2. **本地执行与评分**：每个分片在本地执行 Lucene 查询。
    
    - 它会在倒排索引中查找匹配的文档 ID。
        
    - **Scoring**：根据 TF-IDF 或 BM25 算法计算相关性得分 (`_score`)。**注意**：这里的评分是基于**分片本地**的词频（Term Frequency）和文档频率（Document Frequency）计算的。如果数据分布不均（例如一个分片有 100 个 "apple"，另一个分片只有 1 个），可能导致评分偏差。
        
3. **构建优先队列（Priority Queue）**：每个分片并不返回所有匹配的文档，而是根据请求的 `from` 和 `size` 参数，创建一个本地优先队列。例如请求 `from=0, size=10`，分片只会保留得分最高的 10 个文档的 ID 和 Score。
    
4. **返回元数据**：各分片将这“前 N 个”结果的**元数据**（仅包含 Document ID, Score, 和用于排序的 Sort Values）返回给协调节点，**不包含**文档的原始数据 `_source`。这种设计极大地减少了第一阶段的数据传输量 。

> [!TIP]
> `from`是偏移量，`size`是取出文档的个数

### 4.2 第二阶段：取回阶段

协调节点收到所有分片的局部结果后，进入第二阶段：

1. **全局排序**：协调节点将所有分片返回的元数据（假设有 5 个分片，每片 10 条，共 50 条）合并到一个全局的优先队列中，并再次排序，选出最终全局得分最高的 10 个文档 ID 。
    
2. **多重 GET（Multi-GET）**：协调节点根据这 10 个 ID，去对应的分片上请求完整的文档内容（`_source` 字段）。
    
3. **结果拼接与返回**：分片返回文档内容，协调节点拼接成最终 JSON 响应，包含 `hits` 数组、聚合结果等，返回给客户端 。
    

### 4.3 高级搜索模式与性能陷阱

#### 4.3.1 DFS Query Then Fetch：解决评分偏差

默认的 "Query Then Fetch" 在数据分布不均时会导致评分不准。

- **机制**：**DFS (Distributed Frequency Search) Query Then Fetch** 在 Query Phase 之前增加了一个预查询（Pre-query）阶段。协调节点先向所有分片询问全局的词频和文档频率。
    
- **计算**：协调节点计算出全局的 IDF，代入到各分片中进行评分。
    
- **代价**：多了一次网络往返（RTT），性能较差。通常只有在数据量极少且分布极端不均时才使用。对于大数据量索引，本地词频通常已经足够接近全局词频，无需开启此模式 。
    

#### 4.3.2 深度分页的性能危机

ES 的这种两阶段查询机制导致了著名的“深度分页”问题。

- **场景**：如果请求 `from=10000, size=10`。
    
- **计算放大**：每个分片必须查出前 10010 条记录（Sorted Top N）。如果有 5 个分片，协调节点需要汇总 $10010 \times 5 = 50050$ 条记录的 ID 和 Score。
    
- **内存消耗**：这 50050 条记录必须在协调节点的内存中进行排序，然后丢弃前 10000 条，只取最后 10 条。这会消耗大量 CPU 和 内存，甚至引发 OOM。
    
- **限制**：为了保护集群，`index.max_result_window` 默认为 10,000。
    
- **解决方案对比**：
    

|**分页方式**|**机制描述**|**优点**|**缺点**|**适用场景**|
|---|---|---|---|---|
|**From + Size**|标准偏移量分页|简单直观，支持随机跳转|深度分页性能极差，OOM风险|浅分页 (前10页)|
|**Scroll API**|创建服务端快照 (Context)|数据一致性好，支持全量遍历|维护Context消耗大量内存，非实时|批量导出数据|
|**Search After**|使用上一页最后一条的Sort Values作为游标|无状态，性能高，无深度限制|不支持随机跳转 (只能一页页翻)|实时深度分页|
|**PIT (Point In Time)**|轻量级视图锁定|保证分页期间数据一致性|需要显式创建和关闭 PIT|配合 Search After 使用|

## 5. 分片内 Lucene 读取机制

在单个分片内，**ES 其实是在对所有 Segment 做了一次微型的 "Scatter-Gather"**：

1. **Scatter**: 把查询逻辑下发给每一个 Segment（查倒排、查 BKD）。
    
2. **Gather**: Shard 收集所有 Segment 的结果，在内存中排序，选出本分片的“冠军”，然后再送去参加协调节点的“奥运会”。

### 5.1 第一阶段：查询阶段

当一个 Shard 接收到查询请求（比如 `from=0, size=10`）时，它**不能**只查一个文件，它必须查询自己管理的**所有**活跃 Segment。

这个过程在 Shard 内部是这样发生的：

#### A. 多段并发/串行搜索

Shard 会遍历内部所有的 Segment（包括内存里的 Buffer 生成的新段，和磁盘上的老段）。

- **动作**：Shard 对每个 Segment 说：“给我找出符合条件的文档，并计算分数。”
    

#### B. Segment 内部的“原子”操作

这是最底层的物理操作，根据查询类型的不同，Segment 会拿出不同的武器：

1. **如果是文本搜索 (`match`)**：
    
    - **查词典 (Term Dictionary)**：在 FST（内存前缀树）中找到 "elasticsearch" 这个词。
        
    - **拿链表 (Postings List)**：找到对应的文档 ID 列表 `[doc_1, doc_5, doc_9...]`。
        
    - **算分 (Scoring)**：利用 Segment 内部存储的 **Norms**（字段长度归一化因子）结合 TF-IDF/BM25 公式，给每个 ID 打分。
        
2. **如果是数值/范围搜索 (`range`)**：
    
    - **查 BKD-Tree**：利用 `.dii` 快速定位，去 `.dim` 文件里找到符合 `price > 100` 的文档 ID 集合。
        
    - **位图操作 (BitSet)**：如果使用了 Filter 缓存，直接对位图进行 `AND` 操作。
        

#### C. Shard 级别的“汇聚”

**这是关键点：** 每个 Segment 都会产生一堆匹配的 `(DocID, Score)`。 Shard 维护了一个 **局部优先队列 (Local Priority Queue)**。

- **入队竞争**：Segment A 找到了 5 个文档，Segment B 找到了 3 个文档... 它们会把这些结果往 Shard 的优先队列里塞。
    
- **截断**：Shard 的队列大小也是 `from + size`。如果队列满了，新进来的低分结果就会被直接丢弃。
    

**结论**：在 Query Phase 结束时，Shard 手里拿到了它这个分片范围内（跨越所有 Segment）的 Top 10，然后它把这 10 个结果返回给协调节点。

---

### 2. 第二阶段：Fetch Phase

当协调节点决定了全局最终的 Top 10，它会向特定的 Shard 发送指令：“把 ID 为 `X` 的文档内容给我”。

此时，Shard 内部发生了什么？

#### A. 定位 Segment (Which Segment)

Shard 知道 ID 为 `X` 的文档存在于分片内，但不知道具体在哪个 Segment 里（因为 Document ID 在 Lucene 内部是段内唯一的，但在 ES 层面有全局 UID 映射）。

- **查找**：Shard 快速定位到包含该 ID 的 Segment（通常通过 UID 映射或 Bloom Filter 优化）。
    

#### B. 读取正文 (Loading Data)

一旦确定了文档在 `Segment_3` 里：

- **定位**：通过 **`.fdx` (Field Index)** 索引文件，找到该文档在 **`.fdt` (Field Data)** 文件中的物理偏移量。
    
- **解压**：ES 的 `_source` 字段通常是压缩存储的（LZ4/Deflate）。Segment 会读取磁盘块，解压数据块。
    
- **提取**：解析 JSON，取出需要的字段。
    

## 5. 性能调优与架构启示

### 5.1 写入吞吐量优化

1. **加大 Refresh Interval**：默认 1s 的 Refresh 意味着每秒生成一个 Segment。对于海量写入，这会引发频繁 Merge。将 `index.refresh_interval` 设为 `30s` 或 `-1`（批量导入时），可以显著降低 I/O 压力，提升写入速度 。
    
2. **Translog 异步化**：设置 `index.translog.durability: async`。这会牺牲约 5 秒的数据安全性，但能大幅减少磁盘 fsync 次数。适用于对数据丢失容忍度较高的日志场景 。
    
3. **调整 Buffer 大小**：`indices.memory.index_buffer_size` 默认是堆内存的 10%。对于重写场景，确保此值足够大（如 512MB），让 Segment 更大，减少 Merge 频率 。
    

### 5.2 查询性能优化

1. **强制使用 Keyword**：对于聚合和精确匹配，务必使用 `keyword` 类型字段，利用 `Doc_values` 列存结构。
    
2. **利用缓存**：
    
    - **Node Query Cache**：缓存 Filter 上下文的位图（BitSet）。复用 Filter 条件（如 `term` query）可以极大提升性能。
        
    - **Shard Request Cache**：缓存聚合结果。对于像“统计过去一小时日志量”这种重复聚合，效果显著 。
        
3. **只读索引 Force Merge**：如果索引是基于时间的（如昨天的日志 `log-2023-10-01`），一旦不再写入，执行 `force_merge` 将 Segment 合并为 1 个。这将最大限度减少搜索时的 I/O 和 CPU 开销 。（因为我们可以知道：Shard 内部的的优先队列需要接收来自 `Seg1, Seg2, ... SegN` 的结果。Segment 越多，Shard 级别的“归并排序”压力就越大，上下文切换和堆内存占用就越高。）
    
4. **慢查询日志（Slow Logs）**：配置 Search Slow Log 和 Index Slow Log。通过 `index.search.slowlog.threshold.query.warn: 10s` 等设置，捕获耗时操作，分析是 Query 阶段慢还是 Fetch 阶段慢，从而定位问题（如正则查询效率低、返回字段过大等）。
    