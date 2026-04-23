---
date created: 2026-01-27 15:49:20
date modified: 2026-01-28 17:14:36
---
# Guide

Welcome Back!

## Updated Recently 202604

- 4月9日：整理笔记 [040-xv6 页表映射流程](01-计算机基础/操作系统/040-xv6%20页表映射流程.md)
- 4月18日 - 4月22日：整理笔记[050- xv6 trampoline 与 trapframe](01-计算机基础/操作系统/050-%20xv6%20trampoline%20与%20trapframe.md)，[055-xv6 内核页表](01-计算机基础/操作系统/055-xv6%20内核页表.md)、[055-xv6 用户页表](01-计算机基础/操作系统/055-xv6%20用户页表.md)、[060-xv6 进程创建流程](01-计算机基础/操作系统/060-xv6%20进程创建流程.md)、[065-xv6 进程切换](01-计算机基础/操作系统/065-xv6%20进程切换.md)、[070-xv6 启动第一个进程](01-计算机基础/操作系统/070-xv6%20启动第一个进程.md)、[080-地址访问底层](01-计算机基础/操作系统/080-地址访问底层.md)
- 4月23日：完成lab3 [lab3](01-计算机基础/操作系统/xv6-2020-labs/lab3.md)


## TODO

- [x] 魔法方法、鸭子类型补充学习，enumerate和另一个的区别
- [ ] coze-loop的数据集版本发布方案，对比Apollo：Apollo怎么做的，coze-loop怎么做的（注意总结 MVCC ，copy-on-write ， 零拷贝，RocketMQ异步链路，冷热查询链路）
- [ ] 三种 MQ 对比
- [ ] 三种 MQ 的可靠性、幂等性、顺序性如何保证
- [ ] 三种MQ 什么时候读写主从？还是一直都是读主写主吗
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
- [ ] [路径之和](https://leetcode.cn/studyplan/top-100-liked/)
- [ ] [分割回文串](https://leetcode.cn/problems/palindrome-partitioning/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [寻找旋转排序数组中的最小值](https://leetcode.cn/problems/find-minimum-in-rotated-sorted-array/?envType=study-plan-v2&envId=top-100-liked)看题解
- [ ] [寻找两个正序数组的中位数](https://leetcode.cn/problems/median-of-two-sorted-arrays/description/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [堆排序](https://leetcode.cn/problems/kth-largest-element-in-an-array?envType=study-plan-v2&envId=top-100-liked)
- [ ] [前k个高频](https://leetcode.cn/problems/top-k-frequent-elements/submissions/700622289/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [跳跃游戏Ⅱ](https://leetcode.cn/problems/jump-game-ii/submissions/701788659/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [划分字母区间](https://leetcode.cn/problems/partition-labels/submissions/701798249/?envType=study-plan-v2&envId=top-100-liked)
- [ ] [最长公共子序列](https://leetcode.cn/problems/longest-common-subsequence/description/?envType=study-plan-v2&envId=top-100-liked) 注意设 dp 数组的大小时，设多 1 可以使代码简洁
- [ ] [最长递增子序列](https://leetcode.cn/problems/longest-increasing-subsequence?envType=study-plan-v2&envId=top-100-liked)


## Quick Reference

- apiKey与密码串：[密码串](98-Private/密码串.md)