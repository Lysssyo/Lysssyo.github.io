---
date created: 2026-01-27 15:49:20
date modified: 2026-01-28 17:14:36
---
# Guide

Welcome Back!

## Updated Recently

- 2026年2月8日：基于 Gemini Deep Research [020-Apache Kafka 深度剖析](04-中间件/MessageQueue/020-Apache%20Kafka%20深度剖析.md)
- 2026年2月8日： ElasticSearch 和 clickhouse 各个场景下的对比 [060-OLAP 查询与计算对比：ClickHouse vs. Elasticsearch](06-场景设计/060-OLAP%20查询与计算对比：ClickHouse%20vs.%20Elasticsearch.md)
- 2026年2月7日：厘清 ES 的 BKD 树底层实现以及过滤路径，厘清 ES 的两阶段检索，厘清 ES 的多索引结构并行求交集，生产、优化文档 [070- Elasticsearch 实现 cozeloop 实验结果过滤](04-中间件/Elasticsearch/070-%20Elasticsearch%20实现%20cozeloop%20实验结果过滤.md)、[020-Elasticsearch 核心数据结构](04-中间件/Elasticsearch/020-Elasticsearch%20核心数据结构.md)、[040-Elasticsearch 读写链路](04-中间件/Elasticsearch/040-Elasticsearch%20读写链路.md)
- 2026年2月5日：基于 coze-loop 探索 ClickHouse 的生产实践 [030-ClickHouse 实现 cozeloop 实验结果过滤](04-中间件/ClickHouse/030-ClickHouse%20实现%20cozeloop%20实验结果过滤.md) （待润色）
- 2026年2月5日：基于 Gemini 整理笔记 [020-ClickHouse 的变更操作详解](04-中间件/ClickHouse/020-ClickHouse%20的变更操作详解.md)
- 2026年2月5日：过 python 基础语法 [基础语法](02-编程语言基础/pyhton/基础语法.md)
- 2026年2月4日：整理 ClickHouse 核心数据结构 [010-ClickHouse 核心数据结构与存储架构](04-中间件/ClickHouse/010-ClickHouse%20核心数据结构与存储架构.md)
- 2026年2月3日：整理 Elasticsearch 核心数据结构 [020-Elasticsearch 核心数据结构](04-中间件/Elasticsearch/020-Elasticsearch%20核心数据结构.md)
- 2026年1月28日：~~基于 Gemini Deep Research 和 Gemini 学习辅导 构建的报告~~（废弃）
- 2026年1月27日：基于 Gemini Deep Research 构建的报告 [Skill](80-人工智能/Skill.md)
- 2026年1月27日：基于 Gemini Deep Research 构建的报告 [MCP](80-人工智能/MCP.md)
- 2026年1月26日：Function Call demo [Function Call](80-人工智能/Function%20Call.md)

## TODO

2026年1月27日：

- [x] 魔法方法、鸭子类型补充学习，enumerate和另一个的区别
- [ ] coze-loop的数据集版本发布方案，对比Apollo：Apollo怎么做的，coze-loop怎么做的（注意总结 MVCC ，copy-on-write ， 零拷贝，RocketMQ异步链路，冷热查询链路）
- [ ] 三种 MQ 对比
- [ ] 三种 MQ 的可靠性、幂等性、顺序性如何保证
- [ ] rabbitmq如何实现负载均衡、仲裁模式下rabbitmq的消费如何工作
- [ ] CK 什么时候会用到 CPU 的 SMID
- [x] ElasticSearch 整理核心数据结构
- [x] ElasticSearch 整理读写链路
- [x] ElasticSearch 整理分布式相关
- [x] clickhouse 核心数据结构
- [ ] clickhouse 读写链路
- [ ] clickhouse 分布式相关（低优先级）
- [x] BKD树内部到底长什么样子呢
- [x] ElasticSearch 和 clickhouse 数值范围对比、文本检索对比、数值范围查询 + 文本检索对比
- [x] ElasticSearch 和 clickhouse 聚合分析对比
- [ ] 总结Apollo评测结果通过binlog异步同步到ES的策略，写、读分别是怎么做的，对比coze-loop的实现有什么优势、劣势；
- [ ] Apollo（coze-loop）实验调度总结，内化
- [ ] 整理简历实习部分，形成文档（在上面的TODO以及前期基础上补充，链接）
- [ ] 整理简历开源部分，形成文档
- [ ] 简历补充：ES 计算优化
- [x] 过 Python 语法
- [ ] 整理 Python 环境相关的文档
- [ ] 整理`daily-news-report`的文档
- [ ] SQL 里的悲观锁： `SELECT * xxx FOR UPDATE;` 探讨

## LeetCode TOREDO

- [ ] [回文链表](https://leetcode.cn/problems/palindrome-linked-list/description/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [两两交换链表节点 - 迭代法](https://leetcode.cn/prolems/swap-nodes-in-pairs/description/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [K个一组翻转链表 - 迭代法](https://leetcode.cn/problems/reverse-nodes-in-k-group/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [随机链表的复制](https://leetcode.cn/problems/copy-list-with-random-pointer/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [中序遍历-迭代法](https://leetcode.cn/problems/binary-tree-inorder-traversal/submissions/697285211/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [中序遍历-迭代法](https://leetcode.cn/problems/kth-smallest-element-in-a-bst/description/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [前序-中序构造树](https://leetcode.cn/problems/construct-binary-tree-from-preorder-and-inorder-traversal/description/?envType=study-plan-v2&envId=top-100-liked)


## Quick Reference

- apiKey与密码串：[密码串](98-Private/密码串.md)