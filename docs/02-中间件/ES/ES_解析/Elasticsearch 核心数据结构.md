# Elasticsearch 核心数据结构


---

## 2. 写入路径的微观机制：缓冲区、Translog 与数据持久化

数据的写入路径（Write Path）是理解 ES 数据可靠性（Durability）与近实时性（Near Real-Time, NRT）的关键。在微观层面，这一过程涉及 JVM 堆内存、操作系统页缓存（OS Page Cache）以及物理磁盘之间的复杂交互。

### 2.1 Indexing Buffer 内部的完整工作流

一个文档进入 Indexing Buffer 后，实际上会根据字段类型的不同，被**拆分**成四路**并行**处理。

第一步：分词与分析 (Analysis)

- **动作：** 原始文本（如 "iPhone 16 Pro"）被 Analyzer 拆解、小写化、去停用词，变成 Term 流（`[iphone, 16, pro]`）。

第二步：四路并行构建 (The Heavy Lifting)

1. **倒排索引 (Inverted Index) —— _用于全文检索_**
    
    - **映射：** `Term` $\rightarrow$ `DocID + Freq + Position`
        
    - **内存状态：** 使用 Hash Map (BytesRefHash) 快速查重 Term，然后将 DocID 等信息**追加**到内存块中。
        
2. **列式存储 (DocValues) —— _用于排序聚合_**
    
    - **映射：** `DocID` $\rightarrow$ `Value (数值/Keyword)`
        
    - **内存状态：** 维护一个以 DocID 为索引的**增长数组**。每来一个文档，就在数组对应位置填入它的值。如果是字符串类型，还会维护一个去重的字典。
        
3. **BKD 树 (Point Values) —— _用于数值/地理范围查询_**
    
    - **映射：** `Point (x, y, ...)` $\rightarrow$ `DocID`
        
    - **内存状态：** 系统不会在内存里费力去构建平衡树（太慢）。它只是单纯地将多维数值点（如 `price=100`, `date=2024-01-01`）**追加**到一个巨大的缓冲列表（HeapPointWriter）中。
        
4. **行式存储 (Stored Fields) —— _用于展示结果_**
    
    - **映射：** `DocID` $\rightarrow$ `JSON Source`
        
    - **内存状态：** 直接将原始的 JSON 或指定存储的字段值，作为字节流**追加**到内存 Buffer 的末尾。

这一阶段的数据完全存在于 RAM 中，尚未生成物理文件。如果此时发生断电或进程崩溃，Indexing Buffer 中的数据将面临丢失风险。

| **组件**                   | **Indexing Buffer**                                                                     | ** Flush/Refresh**                                                     | **Segment**                                                            |
| ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **倒排索引**                 | **Term Hash (哈希表)**：<br>乱序存储，利用 Hash 快速去重；使用 **IntBlockPool** 存储原始 DocID 列表，追求 O(1) 写入。 | **全量排序** (字典序) → **差值计算** (Delta Encoding) → **FOR 压缩**                | **.tip (FST 前缀树)**：内存常驻，极速定位 Block；<br>**.doc (倒排表)**：存储 FOR 压缩后的二进制块。 |
| **列式存储** (DocValues)     | **原始数组**：使用 `long[]` 或 `byte[]` 直接追加，数组下标即 DocID，无压缩。                                   | **统计分布** (Min/Max/GCD) → **选择算法** (GCD压缩/表编码) → **位打包** (Bit-packing)。 | **.dvd (紧凑列存)**：高度压缩的二进制流，支持通过 Offset 随机访问 (Random Access)。            |
| **多维数据** (BKD Tree)      | **点数据列表** (HeapPointWriter)：简单的数值堆积，**无树结构**，仅做追加。                                      | **多维全量排序** → **递归切分** (Partitioning) → **构建平衡 K-D 树**。                 | **.dim (平衡 K-D 树)**：仅叶子节点存数据，内部节点存索引，查询复杂度 O(log N)。                   |
| **行式存储** (Stored Fields) | **字节缓冲** (Byte Buffer)：简单的 Byte Block 追加，存储原始 JSON 字节流。                                 | **数据分块** (Chunking) → **通用压缩** (LZ4 / Deflate)。                        | **.fdt (压缩数据块)**：仅支持按 ID 解压读取，无法搜索，仅做原样展示。                             |

---

## 3. 倒排索引

传统数据库（如 MySQL）采用**正向索引（Forward Index）**。想象一本书的“目录”：它按章节（文档 ID）排列，告诉你每一章讲了什么。如果你想找“为了什么”这个词在哪些章节出现，你必须从头到尾读完整本书（全表扫描），效率极低。

**倒排索引**则像书末尾的“索引页”：它按关键词（Term）排序，列出每个词出现在哪些页码（文档 ID）。

- **正向**：`文档 1 -> "The Blue Sky"`
    
- **倒排**：`"Blue" -> [文档 1]`, `"Sky" -> [文档 1]`
    

这种结构使得搜索复杂度从 $O(N)$（扫描所有文档）降低到了 $O(1)$ 或 $O(\log N)$（直接定位词项）。

### 3.1 词典问题的复杂性

在一个成熟的索引中，Term 的数量可能非常巨大。如果将所有 Term 组成的字典（Term Dictionary）直接存储在磁盘上，查询时需要多次随机 I/O 才能二分查找到目标 Term；如果全部加载到内存，又会消耗几十 GB 的堆内存，导致各种 OOM（Out Of Memory）问题。

Lucene 解决这一问题的方案是 **“词项索引（Term Index） + 词项字典（Term Dictionary）”** 的分层架构 。

| **文件扩展名**     | **名称**          | **作用与内容**                                                                                                                                        |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **.tip**      | Term Index      | **词项索引**。**存储在内存中**（FST 结构），用于快速定位.tim 文件中的位置。这是“索引的索引”。                                                                                         |
| **.tim**      | Term Dictionary | **词项字典**。这里存了完整的 Term，以及这个 Term 的**元数据 (Metadata)**，包括 **DocFreq**（有多少个文档包含这个词）、`TotalTermFreq`（这个词出现多少次）、`File Pointers`（指向.doc文件存具体id列表的地方的指针） |
| **.doc**      | Postings        | **倒排表**。存储包含该词项的文档 ID 列表（使用 FOR 压缩）。                                                                                                             |
| **.pos**      | Positions       | **位置信息**。存储词项在文档中的位置（用于短语搜索）。                                                                                                                    |
| **.fdt/.fdx** | Stored Fields   | **存储字段**。原始 JSON 文档的内容（_source），用于展示结果。                                                                                                          |

### 3.2 核心数据结构：有限状态转换器 (FST)

现代 ES（Lucene 4+）中，`.tip` 文件的核心结构不再是简单的数组或 B 树，而是 **FST (Finite State Transducer)**。FST 是一种在保证查找时间复杂度为 $O(length(term))$ 的前提下，能将内存占用压缩到极致的数据结构 。

#### 3.2.1 FST 的压缩原理：前缀与后缀共享

FST 本质上是一个有向无环图（DAG）。与 Trie 树（字典树）利用公共前缀压缩类似，FST 进一步利用了**公共后缀**的共享。

- **前缀共享**：例如 "moth" 和 "mop" 共享 "m-o" 路径。
    
- **后缀共享**：例如 "pop" 和 "top"，虽然前缀不同，但后缀 "op" 是相同的。在 FST 中，这两个单词的路径在经过首字母后，可以汇聚到相同的后续节点上。对于英语等存在大量后缀变化（-ing, -ed, -s）的语言，这种压缩效果极其显著 。
    

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260129171643693.png)

#### 3.2.3 内存映射与堆外加载

在物理文件 `.tip` 中，FST 被序列化为极其紧凑的字节数组。

- **VInt 编码**：所有的弧（Arc）跳转地址和 Output 值都使用变长整数（VInt）编码。
    
- **MMap**：ES 通常通过 MMap（内存映射）方式将 `.tip` 文件加载到地址空间。这意味着 FST 实际上驻留在操作系统的 Page Cache 中（即堆外内存），而不是 JVM Heap。这极大地减轻了 JVM GC 的压力，同时允许操作系统根据内存压力自动管理 FST 的换入换出 。
    

### 3.3 倒排表的压缩：Frame of Reference (FOR)

对于常用词（Stop words 或高频词），倒排表可能包含数百万个文档 ID。如果直接存储 32 位整数（4 Bytes * 1,000,000 = 4MB），空间浪费巨大且 I/O 缓慢。

Lucene 采用了 **Frame of Reference (FOR)** 技术结合 **Delta Encoding** 进行压缩 。

FOR 算法的核心思想是将数据分组，并利用“基准值”或“最大位宽”来压缩每一组数据。它分为三个步骤：

**第一步：Delta Encoding（增量编码）** 倒排表中的文档 ID 是有序递增的。例如，一个原本的 ID 列表为：**`[73, 300, 302, 332, 343, 372]`** 如果直接存储这些大整数，数值较大。通过计算相邻数值的差值（Delta），可以将列表转化为：`[73, 227, 2, 30, 11, 29]`，（注：$300-73=227$, $302-300=2$, 以此类推）。 显然，转化后的数值变小了，所需的存储位数也随之减少 。

**第二步：Block Subdivision（分块）** Lucene 将增量列表划分为固定大小的块（Block），通常为 128 或 256 个整数。每个块独立压缩。这不仅有助于压缩，还支持通过 Skip List（跳表）快速跳过不需要的块，避免解压整个列表 。

**第三步：Bit Packing（位压缩）**

这是 FOR 算法的精髓。对于每一个块，Lucene 会计算该块中**最大数值**所需的二进制位数。

假设一个块包含 Delta 值：`[2, 3, 5, 2]`（最大值为 5，二进制 `101`，需要 3 bits）。

FOR 算法会在块头记录元数据：“本块每个整数占用 3 bits”。

然后，所有数值都被强制压缩为 3 bits 存储：

- 2 -> `010`
    
- 3 -> `011`
    
- 5 -> `101`
    
    总共占用 $4 \times 3 = 12$ bits，而不是 $4 \times 32 = 128$ bits。

这种方法的优势在于解码速度极快。因为每个数值的位宽相同，CPU 可以直接通过位移操作和掩码批量读取数据，甚至利用 SIMD 指令在单个 CPU 周期内解压多个整数。相比传统的 VInt（变长整数），FOR 的解压速度提升了数倍，使得磁盘 I/O 不再是瓶颈 。

> ([https://www.elastic.co/blog/frame-of-reference-and-roaring-bitmaps](https://www.elastic.co/blog/frame-of-reference-and-roaring-bitmaps))


### 3.4 位置与载荷信息：.pos 与.pay

除了文档 ID，全文检索还需要位置信息（Positions）来支持短语查询（Phrase Query）和临近查询（Proximity Query）。

- **`.pos` 文件**：存储 Term 在文档中的出现位置。同样使用 Delta Encoding + VInt 压缩 。
    
- **`.pay` 文件**：存储 Payload（用户自定义数据）和 Offset（字符偏移量）。这些通常用于高级评分或高亮显示。
    

---

## 4. DocValues

倒排索引在“通过词找文档”方面性能卓越，但在“通过文档找值”方面（例如：对 `price` 字段排序，或按 `category` 字段聚合）却效率极低。因为这需要对倒排表进行“反向查找”，这在物理上意味着大量的随机磁盘 I/O。

为了解决排序和聚合的性能问题，ES 引入了 **DocValues**，这是一种完全的**列式存储**结构 。

以这里为例，所有文档的 `price` 值在磁盘上是连续存储的。聚合计算 `avg(price)` 时，磁盘磁头可以执行连续的顺序读取（Sequential Read），CPU 也能利用 SIMD 指令进行向量化处理，性能提升可达数个数量级 。

### 4.2 物理结构与压缩编码

DocValues 对应物理文件 **`.dvd` (Data)** 和 **`.dvm` (Metadata)** 。针对不同的数据类型，DocValues 采用了多种自适应压缩策略。

#### 4.2.1 数值类型 (Numerics)

对于 Integer/Long/Float/Date 类型，Lucene 会先分析整个 Segment 中该列数据的分布特征，选择最优编码 ：

1. **GCD Compression（最大公约数压缩）**：
    
    - 场景：适用于时间戳或特定精度的数值。
        
    - 原理：如果一列数据是 **`[100, 200, 300, 500]`**，最大公约数是 100。Lucene 仅存储商 **`[1, 2, 3, 5]`** 和元数据 `GCD=100`。读取时通过公式 **`Value = Stored_Val * GCD`** 还原。
        
2. **Table Encoding（表编码）**：
    
    - 场景：适用于基数（Cardinality）很低的列（例如 `status` 只有 0, 1, 2）。
        
    - 原理：建立一个去重的数值表 `Table:` ，然后文档只存储该值在表中的索引（0, 1, 2）。这实际上是数值层面的字典编码。
        
3. **Delta Encoding**：
    
    - 场景：数值分布紧密。
        
    - 原理：计算最小值 `Min`，然后存储 `Value - Min` 的偏移量。
        

#### 4.2.2 字符串类型 (Keyword / SortedSet)

对于 Keyword 字段，DocValues 必须解决字符串存储冗余的问题。

- **全局字典序（Global Ordinals）**：Lucene 会将 Segment 内该字段所有唯一的字符串提取出来，按字典序排序，构建一个映射表。
    
- **Ordinal Storage**：在文档的实际列存储位置，不再存储 "US", "CN" 这样的字符串，而是存储它们在字典中的序号（Ordinal，如 0, 1）。这不仅压缩了空间，还极大地加速了 `Terms Aggregation`，因为聚合过程可以直接操作整数 Ordinal，直到最后阶段才需要查表换回字符串 。
    

#### 4.2.3 稀疏性与迭代器 (Sparse & Iterator)

在 Lucene 6 之前，DocValues 主要是稠密数组，对于稀疏字段（即很多文档该字段为空）会浪费空间存储“缺失标记”。现代 Lucene 引入了基于 **Iterator API** 的访问模式，允许底层使用 **IndexedDisk** 格式：只存储存在的 DocID 和 Value，通过跳表或位图快速跳过空值文档。这使得 DocValues 即使在稀疏数据集上也能保持高效 。

### 4.3 堆外内存管理

与 FST 类似，DocValues 数据通常不加载到 JVM Heap，而是通过 MMap 驻留在 Off-heap 内存（Page Cache）。

- **优势**：这意味着聚合计算时，JVM 堆内存压力极小。即便处理 100GB 的数据聚合，只要操作系统有足够的剩余内存做 Cache，性能就会非常快。
    
- **代价**：如果物理内存不足导致 Page Cache 频繁换页（Thrashing），DocValues 的性能会急剧下降。因此，监控磁盘 I/O wait 是诊断聚合性能问题的关键 。
    

---

## 5. BKD 树

**BKD 树 (Block K-D Tree)** 是 Elasticsearch（准确地说是底层 Lucene 6.0 之后）处理 **数值类型 (Numeric)**、**日期类型 (Date)** 和 **地理位置 (Geo-point)** 的核心数据结构。

它的引入是 Elasticsearch 性能的一个巨大飞跃，让 ES 在处理范围查询（Range Query）和多维查询（如：找“价格在 100-200 之间 且 时间在昨天”的数据）时，速度比旧版本快了数倍甚至数十倍。



---

## 7. 位图索引与 Filter 缓存：Roaring Bitmaps

在 ES 中，Filter 查询（如 `term query` 在 `filter` 上下文中）不计算评分，只关心“匹配与否”。为了高效地处理这些集合运算（交集、并集、差集），ES 广泛使用了 **Roaring Bitmaps** 。

### 7.1 Roaring Bitmap 的微观设计

传统的 BitSet（位图）在数据稀疏时非常浪费内存（例如只存了 ID 1 和 ID 100,000,000，传统 BitSet 需要创建 100M bits 的空间）。Roaring Bitmap 采用了一种混合容器（Hybrid Container）的设计来解决这个问题。

它将 32 位的 Integer 空间划分为高 16 位（Key）和低 16 位（Value）。根据低 16 位数据的密度，动态选择底层的 **Container**：

|**容器类型**|**触发条件 (阈值)**|**数据结构**|**空间复杂度**|**适用场景**|
|---|---|---|---|---|
|**Array Container**|元素数 < 4096|有序数组 `short`|2 Bytes * N|极其稀疏的数据|
|**Bitmap Container**|元素数 >= 4096|固定位图 (BitSet)|固定 8 KB|稠密数据|
|**Run Container**|连续序列较多|RLE (Run-Length Encoding)|变长|连续 ID (如 10..1000)|

#### 7.1.1 阈值 4096 的数学推导

为什么是 4096？因为 Bitmap Container 固定占用 8KB ($2^{16}$ bits / 8 = 8192 Bytes)。而 Array Container 存储每个 short 需要 2 Bytes。

$$4096 \times 2 \text{ Bytes} = 8192 \text{ Bytes}$$

当元素数量超过 4096 时，Array Container 的体积就会超过 8KB，此时转换为 Bitmap Container 更节省空间且查询更快（O(1) vs O(logN)）。

### 7.2 Node Query Cache

这种高效的位图结构被用于 ES 的 **Node Query Cache**。当一个 Segment 上的某个 Filter 查询被频繁访问时，ES 会计算其结果集并缓存为 Roaring Bitmap。后续相同的查询直接进行位运算（Bitwise AND），速度极快且 CPU 缓存友好。

---

## 8. 段合并与生命周期管理：Segment Merging

ES 的写入是产生不可变 Segment 的过程。随着时间推移，会产生大量的小 Segment。这会导致：

1. **资源消耗**：每个 Segment 都需要文件句柄、内存和 CPU 开销。
    
2. **搜索延迟**：搜索操作必须遍历所有 Segment 并合并结果。
    

因此，后台的 **Merge（合并）** 过程至关重要 。

### 8.1 TieredMergePolicy (分层合并策略)

ES 默认使用 **TieredMergePolicy**，其逻辑远比简单的“合并相邻文件”复杂。

#### 8.1.1 评分机制 (Scoring Merges)

TieredMergePolicy 不会强制合并相邻的 Segment，而是从所有 Segment 中挑选出“最适合”的一组进行合并。它会计算每个候选合并组合（Merge Specification）的得分（Score），得分越低越好（Lower is better）。

核心评分考量因素：

- **Skew（大小偏斜度）**：参与合并的 Segment 大小越接近越好。合并一个 10GB 和一个 1KB 的段是非常低效的。
    
- **Total Size（总大小）**：合并后的总大小越小，I/O 开销越小。
    
- **Deletes（删除数据比例）**：这是关键优化点。包含大量 Tombstone（已删除文档标记）的 Segment 会被优先选中。因为只有在 Merge 过程中，这些被标记为删除的文档才会被物理丢弃，从而回收磁盘空间 。
    

### 8.2 物理删除与 Tombstone (.liv)

在 ES 中执行 `DELETE` 操作，并不会立即从 `.fdt` 或 `.tim` 中抹去数据。

1. **Soft Delete**：Lucene 只是在 **LiveDocs (`.liv`)** 位图文件中将该文档 ID 对应的位标记为 0 。
    
2. **Search Filtering**：搜索时，Lucene 依然会扫描到该文档，但在收集结果时会查阅 LiveDocs 并将其过滤掉。这解释了为什么删除大量文档后，搜索性能短期内反而可能下降（因为即使是死文档也参与了 I/O 和解码）。
    
3. **Reclaim**：只有当 Merge 发生时，新生成的 Segment 才会跳过这些 ID，实现真正的物理删除。
    

### 8.3 Force Merge 的风险

用户可以手动调用 `_forcemerge` API 将索引合并为 1 个 Segment。虽然这能最大化搜索性能，但对于频繁写入的索引极其危险：

1. **巨型 Segment**：产生一个巨大的 Segment（如 50GB），后续几乎无法再被自动合并（因为很难找到跟它大小匹配的伙伴）。
    
2. **I/O 阻塞**：强制合并会触发大量的磁盘 I/O，可能导致集群短时间内无响应。
    
    因此，`_forcemerge` 通常只建议用于 **Rollover** 后的冷索引（不再写入的历史数据）。
    

---

## 9. 结论

Elasticsearch 的存储内核是一个集成了计算机科学众多领域精髓的工程杰作。它没有采用单一的通用结构，而是针对不同数据特征选择了最优解：

- **对于文本**：利用 **FST** 和 **FOR 压缩** 的倒排索引，实现了极低内存占用的全文检索。
    
- **对于结构化数据**：利用 **DocValues** 的列式存储和 **GCD/Table 编码**，解决了大规模聚合与排序的 I/O 瓶颈。
    
- **对于多维数据**：利用 **BKD 树** 的块状空间划分，革新了数值与地理查询性能。
    
- **对于向量数据**：利用 **HNSW 图**，在非结构化语义搜索领域占据了一席之地。
    
- **对于数据安全**：利用 **Translog** 和 **Page Cache** 的精妙配合，在近实时性能与数据持久性之间找到了平衡。
    

深入理解这些微观机制，对于我们在生产环境中进行索引优化（Mapping 设计）、容量规划（Heap vs Disk）以及故障排查（I/O Util vs GC）具有决定性的指导意义。