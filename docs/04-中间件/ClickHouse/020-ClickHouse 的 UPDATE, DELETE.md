# ClickHouse 的 UPDATE, DELETE

> [!IMPORTANT]
> 在 ClickHouse 的世界里，关于 `UPDATE` 有一句名言：**“数据是用来分析的，不是用来反复横跳的。”** 

## 1. UPDATE

### 1.1 为什么 ClickHouse 讨厌传统的 UPDATE？

因为 ClickHouse 的数据是**高度压缩且按列存储**的。 想象你有一张存了 1 亿行数据的表，按列存放在 `.bin` 文件里。如果你想修改第 500 万行的 `status`：

- **物理上**：数据库必须解压包含这一行的整个压缩块。
    
- **逻辑上**：由于索引和标记文件的存在，改变一个值的长度或位置可能导致后续所有偏移量失效。
    
- **结论**：这比重新写一份数据还要慢。


### 1.2 方案一：真正的 `UPDATE`（Mutation 突变）

如果你执行 `ALTER TABLE table UPDATE col = x WHERE id = y`：

1. **异步执行**：ClickHouse 接受指令后会立即返回，但这并不意味着数据改完了。它会在后台慢慢处理。
    
2. **重写 Part**：ClickHouse 会找到包含该数据的 **整个 Data Part 目录**，读取旧文件，修改内存中的值，然后**写出一个全新的 Data Part 目录**。
    
3. **代价极大**：即使你只更新 1 行，ClickHouse 也会重写这个 Part 里的所有列文件。如果有 100GB 数据，可能就要产生 100GB 的磁盘写 IO。
    

> **警告**：千万不要像在 MySQL 里那样每秒执行几百个 `UPDATE`，这会导致磁盘 IO 瞬间爆炸，甚至让数据库宕机。


### 1.3 方案二：利用 ReplacingMergeTree（推荐方案）

建表时用了 `ReplacingMergeTree(version_column)`。

这其实是 ClickHouse 官方推荐的“更新”方式：**以插代改**。

- **操作**：你不需要执行 `UPDATE`。如果想改数据，直接 **INSERT** 一条主键相同但内容更新、`version_column` 更大的数据。
    
- **原理**：
    
    - 新数据写入新的 Part 目录。
        
    - 后台合并（Merge）时，ClickHouse 发现主键重复，通过 `version_column` 判定新旧，**自动丢弃旧行，保留新行。**


### 1.4 如何查询才能拿到最新数据？

由于后台合并是异步的，为了保证查询结果没有重复，通常有两种做法：

#### 方法 A：使用 `FINAL` 关键字（最简单但慢）


```sql
SELECT * FROM table FINAL WHERE id = 100;
```

`FINAL` 会强制在查询执行瞬间，在内存中对所有 Part 进行实时合并去重。

- **优点**：结果绝对准确。
    
- **缺点**：对于超大规模表，性能损耗非常大。
    

#### 方法 B：使用 `argMax` 聚合函数（更专业，性能好）

``` sql
SELECT 
    id, 
    argMax(status, updated_at) -- 拿到 updated_at 最大时的 status
FROM table 
GROUP BY id;
```

这种方式利用聚合逻辑来模拟去重，通常比 `FINAL` 快得多。


## 2. DELETE

在 ClickHouse 中，`DELETE` 的命运和 `UPDATE` 非常相似。

因为数据是压缩存储的，你不能简单地“抠掉”一行数据。根据你的需求不同，ClickHouse 提供了**三种完全不同**的删除机制。

### 2.1 方式 A：重型删除 (Mutation) 

这是最传统的删除方式，和 `ALTER ... UPDATE` 一样，属于 **Mutation（突变）** 操作。

- **语法：**
        
    ```sql
    ALTER TABLE expt_turn_result_filter 
    DELETE WHERE expt_id = 'EXP_001' AND item_id = 'ITEM_999';
    ```
    
- **底层原理：**
    
    1. **查找：** 找到包含这些数据的 **所有 Data Parts**。
        
    2. **重写：** 读取旧 Part，过滤掉要删除的行，**将剩余数据重写到一个新的 Part**。
        
    3. **替换：** 也就是所谓的“拷贝-过滤-替换”过程。
        
- **代价：** **极高**。哪怕只删 1 行，也可能导致整个 Part（可能有几百万行）被重写。
    
- **适用场景：** 低频、大批量的删除（比如为了 GDPR 合规删除某个用户的全部历史数据）。
    

---

### 2.2 方式 B：轻量级删除

这是 ClickHouse 新版本引入的功能（类似传统的 SQL 删除），专门为了解决 Mutation 太重的问题。

- **语法：**
    
    ```sql
    DELETE FROM expt_turn_result_filter 
    WHERE expt_id = 'EXP_001';
    ```
    
- **底层原理 (Masking)：**
    
    1. **不重写数据：** 它**不会**去动现有的 `.bin` 文件。
        
    2. **打补丁：** 它会在受影响的 Part 目录里生成一个隐藏的小文件（Bitmap 掩码），标记哪些行被删除了。
        
    3. **查询时：** 自动过滤掉这些被掩码标记的行。
        
    4. **物理删除：** 等到后台不定时 **Merge** 发生时，这些行才会被真正从磁盘上抹去。
        
- **代价：** 中等。写入快，查询略有损耗（需要读掩码）。
    
- **适用场景：** 中等频率的删除。
    

---

### 2.3 方式 C：逻辑删除

既然你用的是 `ReplacingMergeTree`，这是 **OLAP 系统中最推荐** 的删除方式。

- **原理：** 给表加一个标记列，比如 `is_deleted` (Int8)。
    
- **操作：** * 不要执行 `DELETE` 语句。
    
    - **INSERT** 一条主键相同、`updated_at` 更大、且 `is_deleted = 1` 的新数据。
        
- **查询时：**
    
    ```sql    
    SELECT * FROM table FINAL WHERE is_deleted = 0;
    ```
    
- **物理清理：**
    
    - 如果不做额外配置，这行数据（标记为删除的行）会一直留在磁盘上。
        
    - **进阶技巧：** 可以在建表时设置 `TTL` 或添加清理策略，让 Merge 进程自动丢弃 `is_deleted=1` 的行。