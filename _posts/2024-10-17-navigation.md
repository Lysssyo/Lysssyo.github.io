---
title: 导航
date: 2024-10-17 15:50:00 +0800
categories: [导航]
tags: []
---

## 1. MySQL

[为什么大家说mysql数据库单表最大两千万？依据是啥？ (qq.com)](https://mp.weixin.qq.com/s?__biz=MzkxNTU5MjE0MQ==&mid=2247493065&idx=1&sn=2a3eb0a73e44ae5a696a050106be2f70&source=41#wechat_redirect)

[mysql的索引为什么使用B+树而不使用跳表？ (juejin.cn)](https://juejin.cn/post/7168631143539933192?searchId=20241017150254B4E7447D34E98E7F322B)

## 2. 设计模式

[单例模式](https://mp.weixin.qq.com/s/ZwrJHk1Lo6G1Gpqvel0WeA)

[工厂模式](https://www.cnblogs.com/yssjun/p/11102162.html)

[模板方法模式](https://mp.weixin.qq.com/s/QBmDiyfST13nQJUcPLLXOg)

[策略模式-接口属于策略模式吗-CSDN博客](https://blog.csdn.net/qq_44886213/article/details/127314585)

> 针对特定行为提供多种可互换的算法实现
>
> ```java
> // 定义策略接口（抽象策略）
> interface SortStrategy {
>     void sort(List<Integer> list);
> }
> 
> // 快速排序策略
> class QuickSortStrategy implements SortStrategy {
>     public void sort(List<Integer> list) {
>         // 快速排序实现
>         System.out.println("使用快速排序");
>     }
> }
> 
> // 冒泡排序策略
> class BubbleSortStrategy implements SortStrategy {
>     public void sort(List<Integer> list) {
>         // 冒泡排序实现
>         System.out.println("使用冒泡排序");
>     }
> }
> 
> // 排序上下文
> class Sorter {
>     private SortStrategy strategy;
> 
>     public void setStrategy(SortStrategy strategy) {
>         this.strategy = strategy;
>     }
> 
>     public void performSort(List<Integer> list) {
>         strategy.sort(list);
>     }
> }
> ```

[继承与模板方法模式](https://chatgpt.com/c/6745b547-79e8-8005-8ae4-60ba9f871cec)

