---
title: CAS与AQS在ConcurrentHashMap中的运用
date: 2025-06-05 09:00:00 +0800
categories: [Java,并发]
tags: [Java,并发]
---



## CAS

CAS在concurrentHashMap中代替了Segment锁，JDK7 的 `ConcurrentHashMap` 是基于 **Segment 分段锁** 实现的，每段维护一个锁。JDK8 完全移除了 Segment，改为采用 **CAS + synchronized（极少用）** 实现更细粒度的控制。

- 初始化 table 时使用 CAS

  ```java
  if (tab == null || tab.length == 0) {
      if (UNSAFE.compareAndSwapObject(this, sizeCtlOffset, sc, -1)) {
          // 初始化 table
      }
  }
  ```

- 节点插入时，如果目标桶（Node节点）为空，用 CAS 尝试插入头节点

  ```java
  if (casTabAt(tab, i, null, new Node<K,V>(...))) {
      // 插入成功，不需要加锁
  }
  ```

- 在链表转红黑树时使用 CAS 更新结构

## AQS

concurrentHashMap没有直接使用AQS或者是AQS的实现类，而是自己模拟了轻量 AQS，主要用于链表转红黑树后，对红黑树结构的修改，例如插入、修改、旋转，需要加锁保证线程安全

在单个桶（bin）中，当链表长度超过 **TREEIFY_THRESHOLD（默认为 8）** 且表容量大于 **MIN_TREEIFY_CAPACITY（默认 64）**，链表会转换成一个红黑树来提升查找性能。在转换后，桶中不再是链表头节点 `Node<K, V>`，而是一个 `TreeBin` 对象：

```java
static final class TreeBin<K,V> extends Node<K,V> {
    TreeNode<K,V> root;
    volatile TreeNode<K,V> first;
    volatile Thread waiter;
    volatile int lockState; //  用于实现自旋锁 / 可重入锁行为。
    // values for lockState
	static final int WRITER = 1; // set while holding write lock
	static final int WAITER = 2; // set when waiting for write lock
	static final int READER = 4; // increment value for setting read lock
    ...
}
```

当执行 `ConcurrentHashMap.put(key, value)`，发现目标桶是一个红黑树（`TreeBin`）时，会进入类似如下流程：

```java
TreeBin<K,V> t = (TreeBin<K,V>) f;
TreeNode<K,V> p;
if ((p = t.putTreeVal(hash, key, value)) == null)
    return null;
```

### `putTreeVal` 内部逻辑（核心）

```java
final TreeNode<K,V> putTreeVal(int h, K k, V v) {
    lockRoot();  // 加锁，防止并发修改红黑树结构
    try {
        // 正常插入红黑树节点（可能涉及左旋、右旋）
        ...
    } finally {
        unlockRoot(); // 解锁
    }
}
```

所以，加锁发生在：

> **对红黑树进行插入或删除操作前，TreeBin 会使用 `lockRoot()` 加锁。**

这个锁是通过自定义的 `lockState` + `CAS + LockSupport` 实现的，不是标准的 `ReentrantLock`，但具有相同的效果。

### `lockRoot()` 加锁逻辑（类似 ReentrantLock）

```java
final void lockRoot() {
    if (!U.compareAndSwapInt(this, LOCKSTATE, 0, WRITER))
        contendedLock(); // 自旋失败则进入等待
}
```

- 尝试用 **CAS** 获取写锁；
- 如果失败，说明可能已有线程在读或写，进入 `contendedLock()`；
- `contendedLock()` 内部实现了**阻塞等待**（类似 `AQS.acquire()` 的逻辑）：

```java
private final void contendedLock() {
    boolean waiting = false;
    for (int s;;) {
        if (((s = lockState) & ~WAITER) == 0) {
            if (U.compareAndSwapInt(this, LOCKSTATE, s, WRITER)) {
                if (waiting) waiter = null;
                return;
            }
        }
        else if ((s & WAITER) == 0) {
            if (U.compareAndSwapInt(this, LOCKSTATE, s, s | WAITER)) {
                waiting = true;
                waiter = Thread.currentThread();
            }
        }
        else if (waiting)
            LockSupport.park(this); // 挂起线程
    }
}
```

这段代码实现了：

- 尝试加写锁；
- 如果有其他线程持有锁，则挂起当前线程；
- 等释放时使用 `LockSupport.unpark()` 唤醒线程，和 AQS 非常相似
