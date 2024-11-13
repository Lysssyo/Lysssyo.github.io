---
title: 集合源码分析
date: 2024-11-08 14:59:00 +0800
categories: [Java, Grammar]
tags: [Java,Grammar,源码]
---



## 1. ArrayList

### 1.1 **add()**

JDK8：

```java
/**
* 将指定的元素追加到此列表的末尾。
*/
public boolean add(E e) {
    // 加元素之前，先调用ensureCapacityInternal方法
    ensureCapacityInternal(size + 1);  // Increments modCount
    // 这里看到ArrayList添加元素的实质就相当于为数组赋值
    elementData[size++] = e;
    return true;
}

// 确保内部容量达到指定的最小容量，如果容量不够，在这个方法进行扩容
private void ensureCapacityInternal(int minCapacity) {// minCapacity为所需容量
    ensureExplicitCapacity(calculateCapacity(elementData, minCapacity));
}

// 根据给定的最小容量和当前数组元素来计算所需容量。
// 这个方法除了第一次会返回默认容量，其他情况都会返回minCapacity
private static int calculateCapacity(Object[] elementData, int minCapacity) {
    // 如果当前数组元素为空数组（初始情况），返回默认容量和最小容量中的较大值作为所需容量
    if (elementData == DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
        return Math.max(DEFAULT_CAPACITY, minCapacity);
    }
    // 否则直接返回最小容量（除了第一次外，都是返回minCapacity，也就是参数要多少容量就返回多少）
    return minCapacity;
}

//判断是否需要扩容
private void ensureExplicitCapacity(int minCapacity) {
    modCount++;
    //判断当前数组容量是否足以存储minCapacity个元素
    if (minCapacity - elementData.length > 0)
        //调用grow方法进行扩容
        grow(minCapacity);
}

/**
 * 要分配的最大数组大小
 */
private static final int MAX_ARRAY_SIZE = Integer.MAX_VALUE - 8;

/**
 * ArrayList扩容的核心方法。
 */
private void grow(int minCapacity) {
    // oldCapacity为旧容量，newCapacity为新容量
    int oldCapacity = elementData.length;
    // 将oldCapacity 右移一位，其效果相当于oldCapacity /2，
    // 我们知道位运算的速度远远快于整除运算，整句运算式的结果就是将新容量更新为旧容量的1.5倍，
    int newCapacity = oldCapacity + (oldCapacity >> 1);

    // 然后检查新容量是否大于最小需要容量，若还是小于最小需要容量，那么就把最小需要容量当作数组的新容量，
    if (newCapacity - minCapacity < 0)
        newCapacity = minCapacity;

    // 如果新容量大于 MAX_ARRAY_SIZE,进入(执行) `hugeCapacity()` 方法来比较 minCapacity 和 MAX_ARRAY_SIZE，
    // 如果minCapacity大于最大容量，则新容量则为`Integer.MAX_VALUE`，否则，新容量大小则为 MAX_ARRAY_SIZE 即为 `Integer.MAX_VALUE - 8`。
    if (newCapacity - MAX_ARRAY_SIZE > 0)
        newCapacity = hugeCapacity(minCapacity);

    // minCapacity is usually close to size, so this is a win:
    elementData = Arrays.copyOf(elementData, newCapacity);
}
```

![image-20241108150116099](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241108150116099.png)

JDK11

```java
public boolean add(E e) {
        modCount++;
        add(e, elementData, size);
        return true;
}

private void add(E e, Object[] elementData, int s) {
        if (s == elementData.length)
            elementData = grow();
        elementData[s] = e;
        size = s + 1;
}

private Object[] grow() {
        return grow(size + 1);
}

private Object[] grow(int minCapacity) {
        return elementData = Arrays.copyOf(elementData,
                                           newCapacity(minCapacity));
}

private int newCapacity(int minCapacity) {
        // overflow-conscious code
        int oldCapacity = elementData.length;
        int newCapacity = oldCapacity + (oldCapacity >> 1);
        if (newCapacity - minCapacity <= 0) {
            if (elementData == DEFAULTCAPACITY_EMPTY_ELEMENTDATA)
                // 相当于把JDK8的calculatecapacity方法移动到了这里
                return Math.max(DEFAULT_CAPACITY, minCapacity);
            if (minCapacity < 0) // overflow
                throw new OutOfMemoryError();
            return minCapacity;
        }
        return (newCapacity - MAX_ARRAY_SIZE <= 0)
            ? newCapacity
            : hugeCapacity(minCapacity);
}
```

![image-20241108150240356](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241108150240356.png)



## 2. HashMap

参考：[java-HashMap源码详细分析(JDK1.8) -SegmentFault思否](https://segmentfault.com/a/1190000012926722)

### 2.1 putVal()

![image-20241110200115365](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241110200115365.png)

"key是否存在" 的表述不够准确：

- 第一个 "key是否存在" 应为 "table[i]的key是否等于要插入的键值对的key" 。

  > 如果这里走**否**的逻辑，说明发生了哈希冲突

- 第二个 "key是否存在" 应为 "链表中第i个节点的key是否等于要插入的键值对的key"

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);// 扰动算法，是hash值更加均匀，减少hash冲突
}

public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

final V putVal(int hash, K key, V value, boolean onlyIfAbsent, boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    // 初始化桶数组 table，table 被延迟到插入新数据时再进行初始化
    if ((tab = table) == null || (n = tab.length) == 0) // 这里对tab赋值为table，对n赋值为tab的长度
        n = (tab = resize()).length;
    // 如果桶中不包含键值对节点引用，则将新键值对节点的引用存入桶中即可
    if ((p = tab[i = (n - 1) & hash]) == null)// (n-1) & hash相当于 hash % n
        tab[i] = newNode(hash, key, value, null);// 创建一个新的节点，直接插入
    else {
        Node<K,V> e; K k;
        // 判断该位置数据的key和新来的数据是否一样
        if (p.hash == hash &&
            ((k = p.key) == key || (key != null && key.equals(k))))
            // 如果一样，证明为修改操作，该节点的数据赋值给e，后边会用到
            e = p;
            
        // 如果桶中的引用类型为 TreeNode，则调用红黑树的插入方法
        else if (p instanceof TreeNode)
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);
        else {
            // 对链表进行遍历，并统计链表长度
            for (int binCount = 0; ; ++binCount) { // 死循环
                // 链表中不包含要插入的键值对节点时，则将该节点接在链表的最后
                if ((e = p.next) == null) {
                    p.next = newNode(hash, key, value, null);
                    // 如果链表长度大于或等于树化阈值，则进行树化操作
                    if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st
                        treeifyBin(tab, hash);
                    break;// 结束循环
                }
                
                // 条件为 true，表示当前链表包含要插入的键值对，终止遍历
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    break;// 结束循环
                
                // 把下一个节点赋值为当前节点，相当于p = p.next
                p = e;
            }
        }
        
        // 判断要插入的键值对是否存在 HashMap 中
        if (e != null) { // existing mapping for key
            V oldValue = e.value;
            // onlyIfAbsent 表示是否仅在 oldValue 为 null 的情况下更新键值对的值
            if (!onlyIfAbsent || oldValue == null)
                e.value = value;
            afterNodeAccess(e);
            return oldValue;// 如果是修改操作返回旧值
        }
    }
    ++modCount;
    // 键值对数量超过阈值时，则进行扩容
    if (++size > threshold)
        resize();
    afterNodeInsertion(evict);
    return null;// 如果是新增操作返回null
}
```

> `i = (n - 1) & hash`
>
> - 如果 `n` 是 2 的幂（比如 16、32、64），则 `n - 1` 的二进制表示将全为 1，比如：
>
>   - `n = 16` 时，`n - 1` 是 `15`（二进制为 `01111`）。
>
>   - `n = 32` 时，`n - 1` 是 `31`（二进制为 `011111`）。
>
>   这种情况下，`(n - 1) & hash` 相当于 `hash % n`，只保留 `hash` 的最低几位来映射索引。这能确保结果落在 `[0, n-1]` 的范围内，而不会超出数组索引范围。
>
> - **减少取模运算的性能开销**： 在哈希表中，通常使用 `hash % n` 来保证散列均匀性，**但取模运算相对较慢**。利用 `n - 1` 的二进制全 1 属性，**通过 `&` 操作来快速替代取模运算，大幅提升了计算速度。**
>
> - **在哈希表实现中，通常要求数组的长度 `n` 是 2 的幂**，这是为了利用 `n - 1` 这种二进制全为 1 的特性来高效地实现取模操作。如果 `n` 不是 2 的幂次方，使用 `(n - 1) & hash` 可能会导致索引分布不均匀，从而引发以下问题：
>
>   - **索引计算不均匀**： 只有当 `n` 是 2 的幂时，`(n - 1) & hash` 能够将哈希值均匀映射到 `[0, n-1]` 范围。如果 `n` 不是 2 的幂，则 `n - 1` 的二进制表示中不全是 1，这样会导致某些索引位置比其他位置更频繁地被使用，增加哈希冲突的可能性，降低查找性能。
>
>   - **不能实现有效的取模效果**： 比如，如果 `n = 10`，`n - 1 = 9`（二进制为 `1001`），那么 `(n - 1) & hash` 只会保留 `hash` 的某些特定位，而不是取模操作那样的均匀分布。这样就无法有效地映射哈希值，导致部分索引可能会得不到使用，而另一些索引会频繁碰撞。

### 2.2 resize()

介绍一下扩容机制：

HashMap是通过resize()方法进行扩容的。大致可以分为3步。第一步，计算新桶数组的容量 newCap 和新阈值 newThr；第二步，根据计算出的 newCap 创建新的桶数组，桶数组 table 也是在这里进行初始化的；第三步是最重要的，把旧桶的数据迁移到新桶。一个很自然的迁移的想法就是遍历旧数组的所有键值对，用`(n-1) & hash`重新计算在某个key要放在哪个桶。但是，因为n是2的幂，所以这个计算过程可以优化。

大致来说，有如下两个优化。第一，某个键值对要不要迁移到新的索引处只用看一个bit位。第二，如果，某个键值对迁移到新的索引，那么新索引等于**旧桶序号+旧桶总数**

```java
// 扩容，初始化数组
final Node<K,V>[] resize() {
    Node<K,V>[] oldTab = table;
    int oldCap = (oldTab == null) ? 0 : oldTab.length;
    int oldThr = threshold;// 老的扩容阈值
    int newCap, newThr = 0;// 新的数组容量以及新的扩容阈值先设置为0
    // 1. 计算新桶数组的容量 newCap 和新阈值 newThr
    // 如果 table 不为空，表明已经初始化过了
    if (oldCap > 0) {
        // 当 table 容量超过容量最大值，则不再扩容（安全校验）
        if (oldCap >= MAXIMUM_CAPACITY) {
            threshold = Integer.MAX_VALUE;
            return oldTab;
        } 

		// 如果在最大长度范围内，则需要扩容 oldcap<<1 等价于 oldcap*2
		// 运算过后判断是不是最大值并且oldcap需要大于16
        else if ((newCap = oldCap << 1) < MAXIMUM_CAPACITY &&
                 oldCap >= DEFAULT_INITIAL_CAPACITY)
            newThr = oldThr << 1; // double threshold 等价于 oldThr * 2
    } else if (oldThr > 0) // initial capacity was placed in threshold // 
        /*
         * 这里对应用构造方法2、3初始化的情况，oldCap为0（因为oldTab == null）
         * 且oldThr > 0（构造方法3用tableSizeFor方法为threshold赋值了）
         */ 
        newCap = oldThr;
    else {               // zero initial threshold signifies using defaults
        // 数组未初始化的情况，将阈值和扩容因子都设置为默认值
        newCap = DEFAULT_INITIAL_CAPACITY;// 默认容量为16
        newThr = (int)(DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);// 新的阈值为 16*0.75=12
    }
    
    // newThr 为 0 时，按阈值计算公式进行计算
    if (newThr == 0) {
        float ft = (float)newCap * loadFactor;
        newThr = (newCap < MAXIMUM_CAPACITY && ft < (float)MAXIMUM_CAPACITY ?
                  (int)ft : Integer.MAX_VALUE);
    }
    threshold = newThr;
    
    // 2. 根据计算出的 newCap 创建新的桶数组，桶数组 table 也是在这里进行初始化的
    Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];
    table = newTab;
    // 3. 将键值对节点重新映射到新的桶数组里。
    // 如果节点是 TreeNode 类型，则需要拆分红黑树。如果是普通节点，则节点按原顺序进行分组
    if (oldTab != null) {
        // 如果旧的桶数组不为空，则遍历桶数组，并将键值对映射到新的桶数组中
        for (int j = 0; j < oldCap; ++j) {
            Node<K,V> e;
            if ((e = oldTab[j]) != null) {
                // 旧数组的j为置为null
                oldTab[j] = null;
                if (e.next == null)
                    // 重新计算这个结点在新数组的位置并放进去            
                    newTab[e.hash & (newCap - 1)] = e; 
                
                // 有下个节点的情况，并且判断是否已经树化
                else if (e instanceof TreeNode)
                    // 重新映射时，需要对红黑树进行拆分
                    ((TreeNode<K,V>)e).split(this, newTab, j, oldCap);
                
                // 有下个节点的情况，并且没有树化(链表形式)
                else { // preserve order
                    Node<K,V> loHead = null, loTail = null;
                    Node<K,V> hiHead = null, hiTail = null;
                    Node<K,V> next;
                    // 遍历链表，并将链表节点按原顺序进行分组
                    do {
                        next = e.next;
                        if ((e.hash & oldCap) == 0) {
                            
                            if (loTail == null)
                                loHead = e;
                            else
                                loTail.next = e;
                            loTail = e;
                        }
                        else {
                            if (hiTail == null)
                                hiHead = e;
                            else
                                hiTail.next = e;
                            hiTail = e;
                        }
                    } while ((e = next) != null);
                    // 将分组后的链表映射到新桶中
                    if (loTail != null) {
                        loTail.next = null;
                        newTab[j] = loHead;
                    }
                    if (hiTail != null) {
                        hiTail.next = null;
                        newTab[j + oldCap] = hiHead;
                    }
                } // else结束
            }
        }
    }
    return newTab;
}
```

扩容之后，对于所有桶中的所有结点都要重新计算一次放进哪个桶，因为扩容之后桶的个数变了，那么`hash % n`也就变了，如果不重新计算结点应该属于哪个桶然后把结点挪到新桶，那么扩容之后进行`get`操作就有可能`get`不到了（因为`hash % 新n` != `hash % 旧n`）

具体而言：

1. 没扩容之前

   ![image-20241111114311208](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241111114311208.png)

2. 扩容之后

   ![image-20241111114343004](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241111114343004.png)

   可以发现`key2`两次计算的桶的位置不一样了。第一次应该放在5号桶，第二次应该放在21号桶。

**那么，怎么知道哪个节点要移动到新桶，哪个结点不用移动到新桶呢？如果要移动到新桶，是移到几号桶呢？**

首先，先思考这个问题：上图的key2为什么会要移到到新桶呢？

因为当桶数扩到32时，`n-1`变为31，即n-1从`0000 1111`变为`0001 1111`，所以与`hash(key2)`做按位运算就会与原来不一样（确定某个key属于哪个桶是通过`hash(key) & (n-1)`），不一样的原因是 `0001 1111`的新n-1的第5位的1（容量的最高位）导致的。第5位的这个1刚好是旧n的最高位的1（旧n：0001 0000）。所以，如果hash(key2)与旧n做按位运算，运算结果不为0就要改桶的位置。并且，新桶的位置为**旧桶序号+旧桶总数**

> 当然，也可以直接还是用`hash(key) & n-1 `的方法算结点在哪个新桶，但是显然，上面的方法更快。**只需要看原来hash值在新增的那个bit位是0还是1，如果是0就没变，如果是1索引就要变成旧桶序号+旧桶总数**

对应代码：

```java
// 扩容，初始化数组
final Node<K,V>[] resize() {
    Node<K,V>[] oldTab = table;
    int oldCap = (oldTab == null) ? 0 : oldTab.length;
    int oldThr = threshold;// 老的扩容阈值
    int newCap, newThr = 0;// 新的数组容量以及新的扩容阈值先设置为0
    // 1. 计算新桶数组的容量 newCap 和新阈值 newThr
    // ...
    
    // 2. 根据计算出的 newCap 创建新的桶数组，桶数组 table 也是在这里进行初始化的
    Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];
    table = newTab;
    // 3. 将键值对节点重新映射到新的桶数组里。
    // 如果节点是 TreeNode 类型，则需要拆分红黑树。如果是普通节点，则节点按原顺序进行分组
    if (oldTab != null) {
        // 如果旧的桶数组不为空，则遍历桶数组，并将键值对映射到新的桶数组中
        for (int j = 0; j < oldCap; ++j) {
            Node<K,V> e;
            if ((e = oldTab[j]) != null) {
                // ...
                
                 // 有下个节点的情况，并且没有树化(链表形式)
                else { // preserve order
                    Node<K,V> loHead = null, loTail = null;
                    Node<K,V> hiHead = null, hiTail = null;
                    Node<K,V> next;
                    // 遍历链表，并将链表节点按原顺序进行分组
                    do {
                        next = e.next;
                        if ((e.hash & oldCap) == 0) { //这里！！！
                            
                            if (loTail == null)
                                loHead = e;
                            else
                                loTail.next = e;
                            loTail = e;
                        }
                        else {
                            if (hiTail == null)
                                hiHead = e;
                            else
                                hiTail.next = e;
                            hiTail = e;
                        }
                    } while ((e = next) != null);
                    // 将分组后的链表映射到新桶中
                    // ...
                } // else结束
            }
        }
    }
    return newTab;
}
```

例如：

![image-20241111125750331](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241111125750331.png)

假设我们上图的桶数组进行扩容，扩容后容量 n = 16，重新映射过程如下:

依次遍历链表，并计算节点 `hash & oldCap` 的值。如下图所示

![image-20241111125756559](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241111125756559.png)

如果值为0，将 loHead 和 loTail 指向这个节点。如果后面还有节点 hash & oldCap 为0的话，则将节点链入 loHead 指向的链表中，并将 loTail 指向该节点。如果值为非0的话，则让 hiHead 和 hiTail 指向该节点。完成遍历后，可能会得到两条链表，此时就完成了链表分组：

![image-20241111125810860](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241111125810860.png)

最后再将这两条链接存放到相应的桶中，完成扩容。如下图：

![image-20241111125821031](assets/2024-11-08-CollectionAndMapSourceCodeAnalysis.assets/image-20241111125821031.png)











