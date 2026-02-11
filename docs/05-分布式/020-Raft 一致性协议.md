---
title: Raft 一致性协议深度解析
category: 分布式
tags: [Raft, 一致性协议, 分布式, 共识算法]
date created: 2026-02-09 19:36:34
date modified: 2026-02-11 10:41:43
---

# Raft 一致性协议

Raft 是一种用于管理 **复制日志（Replicated Log）** 的分布式一致性算法。

Raft 主要解决分布式系统中的 **一致性（Consensus）** 与 **高可用（High Availability）** 问题：

- **容错（Fault Tolerance）：** 允许集群中 $N$ 个节点有 $F$ 个节点宕机（$N \ge 2F+1$），系统仍能正常工作。
- **数据一致性：** 防止由于网络分区（Network Partition）或节点崩溃导致的数据丢失、脏读或脑裂（Split-Brain）。

---

## 1. 核心子问题拆解

Raft 将一致性问题拆解为三个独立的子问题：**Leader 选举**、**日志复制** 和 **安全性**。

### 1.1 选主 (Leader Election)

Raft 使用 **强领导者（Strong Leader）** 模型，集群中同一时刻只能有一个 Leader。

**触发机制**：基于 **心跳（Heartbeat）** 和 **超时（Timeout）**。Leader 周期性向 Follower 发送心跳。如果 Follower 在“选举超时时间”（Election Timeout）内未收到心跳，则认为 Leader 已挂，发起选举。

#### 角色流转与选举逻辑

1.  **初始状态 (Follower)**：
    - 所有节点启动时均为 **Follower**，被动等待来自 Leader 的心跳。
    - 若在一段时间内（Election Timeout）未收到心跳，则判定 Leader 失效，转换为 **Candidate** 触发选举。

2.  **选举阶段 (Follower → Candidate)**：
    - 节点增加当前任期号（Term），给自己投一票，并并行向其他节点发送 `RequestVote` 请求。
    - **情况 A (成为 Leader)**：获得集群中 **大多数（Majority）** 节点的选票，成功当选。
    - **情况 B (退回 Follower)**：等待期间收到来自其他更高任期（Term >= 自己）的 Leader 心跳，承认其权威，退回 Follower。
    - **情况 C (瓜分选票/Split Vote)**：无节点获得多数票（如多个 Follower 同时超时），等待随机超时后发起新一轮选举。

> [!TIP]
> 当一个 Candidate 向 Follower 请求投票时，它会携带自己最后一条日志的 `LastLogTerm`（任期号）和 `LastLogIndex`（索引号）。Follower 会将这些信息与自己的日志进行比较：
>      **比较任期（Term）：** 如果 Candidate 的最后一条日志的任期号 < Follower 的任期号，拒绝投票。
>      **比较索引（Index）：** 如果任期号相同，但 Candidate 的日志长度（Index） < Follower 的日志长度，拒绝投票。


3.  **领导阶段 (Leader)**：
    - 一旦当选，立即向所有 Follower 发送心跳包确立权威。
    - 开始接收客户端请求，将操作写入本地日志，并负责将日志 **复制**（Log Replication）到 Follower。

4.  **异常处理 (Leader → Follower)**：
    - 网络分区恢复后，若旧 Leader 发现集群中存在任期号（Term）更高的 Leader，立即退位并变回 Follower。

> [!TIP] 随机超时（Randomized Timeout）
> 为了避免“瓜分选票”导致选举僵局，Raft 将每个节点的选举超时时间设为固定区间（如 150-300ms）内的随机值，极大提升了选主收敛速度。

---

### 1.2 日志复制 (Log Replication)

一旦选出 Leader，它全权负责处理客户端请求和日志管理。

- **标准流程**：
    1. Leader 接收客户端请求，将其作为 Log Entry 追加到本地日志（此时状态为 Uncommitted）。
    2. Leader 并行向所有 Follower 发送 `AppendEntries RPC`。
    3. Follower 收到并持久化日志后，返回 ACK。
    4. Leader 统计 ACK，满足 **“过半写入”** 条件时，将日志标记为 **Committed**，应用到状态机并响应客户端。
    5. Leader 在后续心跳中通知 Follower 该日志已提交，Follower 随之同步应用。

> [!IMPORTANT] 日志匹配特性（Log Matching Property）
> Raft 强制保证：如果两个日志在相同的索引位置（Index）拥有相同的任期号（Term），那么从头到该索引的所有日志条目都完全相同。

### 1.3 日志截断与追加 (Log Truncation & Appending)

在 Raft 中，Leader 是日志的唯一权威。当 Follower 的日志与 Leader 不一致时（通常是因为 Follower 拥有旧 Leader 未提交的脏数据），Follower 必须 **无条件服从**：强制删除（截断）冲突日志，并追加（复制）Leader 的新日志。

#### 核心机制：AppendEntries 一致性检查

每次 Leader 发送 `AppendEntries RPC` 时，不仅仅是发送新日志，还携带了 **前一条日志** 的指纹，用于连贯性检查：

- **`prevLogIndex`**：新日志条目紧邻的前一个索引值。
- **`prevLogTerm`**：`prevLogIndex` 处的任期号。
    

**Follower 的处理逻辑：**

1. **检查指纹**：查找本地日志中是否存在 `prevLogIndex`。
2. **Term 匹配**：如果存在，检查该处的 Term 是否等于 `prevLogTerm`。
3. **冲突解决**：
    
    - **匹配成功**：保留该位置之前的日志，**追加** 新日志。
    - **匹配失败**：拒绝请求，Leader 将 **回溯** 并重试，直到找到一致点。

#### 详细回溯算法 (Backtracking)

如果 Follower 落后太多或日志严重冲突，Raft 会通过 `nextIndex` 进行回溯：

1. **探测 (Probe)**：Leader 维护每个 Follower 的 `nextIndex`（预计发送的下一个日志位置）。初始值为 Leader 的最后一条日志 Index + 1。
2. **失败 (Reject)**：如果 Follower 返回 `False`（因为 `prevLogIndex` 没找到或 Term 不匹配）。
3. **递减 (Decrement)**：Leader 将该 Follower 的 `nextIndex` 减 1。
4. **重试 (Retry)**：Leader 重新发送新的 `AppendEntries`（携带更早的 `prevLogIndex`）。
5. **收敛 (Converge)**：重复上述步骤，直到找到 Leader 和 Follower 日志完全一致的那个点（最坏情况是回溯到 Index 0）。一旦匹配成功，Follower 会 **截断** 冲突点之后的所有数据，并 **追加** Leader 发送过来的所有新数据。
    

> [!IMPORTANT] 安全性原则 为什么 Follower 删除日志是安全的？ 
> 因为 Raft 的选举机制（2.1 节提到的）保证了 **被删除的日志绝对不可能已经是 Committed（已提交）状态**。只有未提交的、旧 Term 的脏数据才会被截断。

> [!TIP] 优化提示 实际生产级的 Raft 实现（如 Etcd 的 Raft 库）
> 通常不会每次只回退 1 个 Index，而是采用 **快速回退（Fast Backtracking）** 机制：Follower 在拒绝时告知 Leader 自己当前冲突 Term 的第一条日志 Index，Leader 可以直接跳过整个冲突 Term，大幅减少 RPC 交互次数。

---

## 2. 一致性保障基石

### 2.1 过半写入 (Quorum / Majority Write)

这是 Raft 保证数据不丢失和一致性的核心。

- **定义**：任何日志条目的提交（Commit），必须获得集群中 **超过半数（$N/2 + 1$）** 节点的确认。
- **防止脑裂**：在网络分区时，少数派分区的 Leader 无法凑齐过半选票，从而无法提交新数据，确保只有多数派分区能继续工作。
- **保证持久性**：基于抽屉原理，新 Leader 的选票中必然包含来自“拥有最新已提交日志”节点的投票。Raft 规定日志不够新的 Candidate 无法当选，确保已提交数据永不丢失。

### 2.2 任期 (Term)

Raft 引入 **逻辑时钟** 概念，称为 **任期（Term）**，用单调递增的整数表示。

- **版本控制**：每一个 Term 代表一段由某个特定 Leader 统治的时间片段。
- **发现过期信息**：
    - 若 `RPC Term < CurrentTerm`：直接拒绝请求（旧主请求，无效）。
    - 若 `RPC Term > CurrentTerm`：接收者立即更新自己的 Term 并转为 Follower（新主已立，同步信息）。