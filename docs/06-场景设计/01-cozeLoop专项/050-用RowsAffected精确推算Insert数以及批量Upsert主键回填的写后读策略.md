# 用 RowsAffected 精确推算 Insert 数：以及批量 Upsert 主键回填的写后读策略


这篇笔记记录两个在批量写入场景里经常被问到的问题：

1. 执行 `INSERT ... ON DUPLICATE KEY UPDATE` 之后，**到底新增了多少条（Insert）**？
2. 当一部分数据发生冲突走了 `UPDATE` 分支时，**内存里的主键可能不准**，该怎么补救？

---

### 1. MySQL `RowsAffected`（受影响行数）规则

在 MySQL 中执行 `INSERT ... ON DUPLICATE KEY UPDATE` 时，返回的 `RowsAffected`（受影响行数）有特殊定义：

- **新插入（Insert）**：返回 **1**
- **发生冲突并更新（Update）**：返回 **2**
- **发生冲突但值未变化（No-op）**：返回 **0**

> 第三种情况是否会出现，取决于你的 `UPDATE` 子句写法以及新旧值是否相同。

---

### 2. 设变量

- `N = len(items)`：本次尝试写入的总条数
- `I`：真正执行 **Insert（新增）** 的条数（目标）
- `U`：发生冲突并执行 **Update（更新）** 的条数
- `Z`：发生冲突但**没有更新**（返回 0）的条数
- `R`：MySQL 返回的 `RowsAffected`

---

### 3. 建立方程

总数关系：

$$ N = I + U + Z $$

受影响行数关系：

$$ R = 1\cdot I + 2\cdot U + 0\cdot Z $$

---

### 4. 结论：如何从 `N` 和 `R` 推算新增数

**情况 A：可以确认不会出现 “冲突但不更新”（即 `Z = 0`）**

此时：

$$ N = I + U $$

代入：

$$ R = I + 2U = I + 2(N - I) = 2N - I $$

因此：

$$ \boxed{I = 2N - R} $$

**情况 B：可能出现 “冲突但不更新”（`Z` 未知）**

仅凭 `N` 和 `R` **无法唯一确定** `I`，因为 `Z` 不参与 `R`。

你仍然能写出：

- `U = (R - I) / 2`
- `Z = N - I - U`

但要算出 `I`，必须有额外信息（例如业务上保证更新字段一定变化，或通过额外查询/策略统计）。

---

### 5. 实用建议（在使用公式前的检查）

- 在使用 `I = 2N - R` 前，先确认你的 SQL 逻辑能保证：
    - 一旦冲突就一定会更新到不同的值（从而 `Z = 0`）。
- 如果无法保证，考虑：
    - 让 `UPDATE` 子句强制写入一个必变字段（例如 `updated_at = NOW()`），从而避免 `Z`
    - 或在写入前后通过额外查询统计新增数量（成本更高，但最可靠）

---

### 6. 另一个常见坑：Batch Upsert 后内存主键不准确

会有这样的一种场景：

- batchInsert 一个列表。
- 如果其中一部分 **Insert 成功**，那么内存里这部分的主键是正确的（因为是先生成数据库主键，再去 Insert），返回给下层没有问题。
- 但如果 Insert 失败而走 `UPDATE ON DUPLICATE KEY`，这部分数据的主键可能是不准确的，因为先前生成的主键并没有真正入库。

**目标：如何让冲突走 Update 的数据不影响下游逻辑？**

核心思路：对可能冲突的记录做一次 **Read-After-Write（写后读）**，用唯一键（例如 `ItemKey`）把真实落库后的 `ID / ItemID` 查回来并回填。

---

### 7. 处理示例：Read-After-Write（写后读）补救策略

```go
func (s *DatasetServiceImpl) mCreateItems(ctx context.Context, ds *DatasetWithSchema, items []*entity.Item) (added int64, err error) {
	release, err := s.withWriteItemBarrier(ctx, [ds.ID](<http://ds.ID>), int64(len(items)))
	if err != nil {
		return 0, err
	}
	defer func() { release() }()

	added, err = s.saveItems(ctx, ds, items) // Batch Insert Or Update
	if err != nil {
		return 0, err
	}

	// 如果 added != len(items)，说明有冲突：部分记录可能走了 UPDATE
	if int64(len(items)) != added {
		logs.CtxInfo(ctx, "add %d items, %d added, conflict keys may happened, item reloaded", len(items), added)
		if err := s.reloadConflictItems(ctx, ds, items); err != nil {
			return added, err
		}
	}
	return added, nil
}

func (s *DatasetServiceImpl) reloadConflictItems(ctx context.Context, ds *DatasetWithSchema, items []*entity.Item) error {
	keys := gslice.FilterMap(items, func(i *entity.Item) (string, bool) {
		itemID := strconv.FormatInt(i.ItemID, 10)
		// 系统指定的 ItemKey 为 ItemID，此处仅查询用户指定 ItemKey 的 item，只有这种情况会冲突
		return i.ItemKey, itemID != i.ItemKey
	})

	loaded, _, err := s.repo.ListItems(ctx, &repo.ListItemsParams{
		SpaceID:   ds.SpaceID,
		DatasetID: [ds.ID](<http://ds.ID>),
		ItemKeys:  keys,              // 用刚才收集的 Key 去查
		AddVNEq:   ds.NextVersionNum, // 重点：只查当前版本的数据
	})
	if err != nil {
		return errors.WithMessage(err, "reload conflict items")
	}
	logs.CtxInfo(ctx, "reload %d conflict items, dataset_id=%d", len(loaded), [ds.ID](<http://ds.ID>))

	m := gslice.ToMap(loaded, func(i *entity.Item) (string, *entity.Item) { return i.ItemKey, i }) // 把查回来的结果转成 Map: Key -> Item
	m := gslice.ToMap(loaded, func(i *entity.Item) (string, *entity.Item) { return i.ItemKey, i })

	   l, ok := m[item.ItemKey]    // 拿着手里的 ItemKey 去 Map 里找
		l, ok := m[item.ItemKey]
		if ok {
			// 【关键动作】把真实落库后的主键回填到内存对象
			item.ItemID = l.ItemID
			[item.ID](<http://item.ID>) = [l.ID](<http://l.ID>)
		}
		return nil
	return nil
}
```

---

### 8. 关键点小结

- `RowsAffected` 能否反推出 Insert 数，取决于你能否保证 `Z = 0`。
- 当 Upsert 里存在 “先生成主键但实际走了 Update” 的可能时，下游不要直接信任内存对象里的 ID。
- 最稳的处理方式是：用业务唯一键做一次写后读，把真实的落库主键回填。