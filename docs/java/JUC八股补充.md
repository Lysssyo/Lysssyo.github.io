
## 1. 多线程

#### **wait & notify**

class WaitNotifyExample {  
    private static final Object lock = new Object();  
    private static boolean dataReady = false;  
​  
    public static void main(String[] args) {  
        // 生产者线程  
        Thread producerThread = new Thread(() -> {  
            synchronized (lock) {  
                System.out.println("生产者正在准备数据...");  
                try {  
                    // 模拟数据准备过程  
                    Thread.sleep(2000);  
                    dataReady = true;  
                    System.out.println("数据已准备好");  
​  
                    // 通知等待的消费者线程  
                    lock.notify();  
                } catch (InterruptedException e) {  
                    e.printStackTrace();  
                }  
            }  
        });  
​  
        // 消费者线程  
        Thread consumerThread = new Thread(() -> {  
            synchronized (lock) {  
                try {  
                    // 如果数据未准备好，则等待  
                    while (!dataReady) {  
                        System.out.println("消费者等待数据...");  
                        lock.wait(); // 释放锁并等待通知  
                    }  
​  
                    // 数据准备好后继续执行  
                    System.out.println("消费者开始处理数据");  
                } catch (InterruptedException e) {  
                    e.printStackTrace();  
                }  
            }  
        });  
​  
        // 启动线程  
        consumerThread.start();  
        producerThread.start();  
    }  
}

#### **调用 interrupt 是如何让线程抛出异常的?**

要理解调用 `Thread.interrupt()` 如何导致线程抛出异常，我们需要区分**线程中断的两种行为**：**设置中断状态** 和 **抛出 `InterruptedException`**。以下是详细的解释：

1. **线程的中断状态**
    

每个线程都有一个 **中断状态标志**（`interrupted`），用来表示线程是否被请求中断：

- 初始值为 `false`。
    
- 调用 `Thread.interrupt()` 后，线程的 **中断状态** 被设置为 `true`。
    

如果线程调用以下静态方法检查自己的中断状态：

- **`Thread.interrupted()`**：返回线程的中断状态，**并重置中断状态为 `false`。**
    
- **`isInterrupted()`**：返回线程的中断状态，但不修改状态。
    

2. **`Thread.interrupt()` 的两种响应场景**
    

场景 1: 线程处于阻塞状态（会抛出异常）

当线程调用某些可被中断的方法（例如 `Thread.sleep()`、`Thread.join()`、或 `Object.wait()`）时：

- 如果其他线程调用了
    
    Thread.interrupt()
    
    则会：
    
    1. **清除中断状态**：中断标志被清除（设置为 `false`）。
        
    2. **抛出 `InterruptedException`**：从方法内部抛出，提醒线程被中断。
        

例如：

public class InterruptExample {  
    public static void main(String[] args) {  
        Thread t = new Thread(() -> {  
            try {  
                System.out.println("Thread is sleeping...");  
                Thread.sleep(5000); // 阻塞  
            } catch (InterruptedException e) {  
                System.out.println("Thread was interrupted during sleep.");  
            }  
        });  
​  
        t.start();  
​  
        try {  
            Thread.sleep(1000); // 主线程等待1秒  
        } catch (InterruptedException e) {  
            e.printStackTrace();  
        }  
​  
        t.interrupt(); // 中断子线程  
    }  
}

**输出：**

Thread is sleeping...  
Thread was interrupted during sleep.

**分析：**

- 子线程调用 `Thread.sleep()` 时进入阻塞状态。
    
- 主线程调用 `t.interrupt()`，子线程立即从 `sleep` 方法中退出，并抛出 `InterruptedException`。
    
- 线程中断标志被清除（`isInterrupted()` 返回 `false`）。
    

---

场景 2: 线程未处于阻塞状态（设置中断标志）

如果线程未处于阻塞状态，`Thread.interrupt()` 仅会设置线程的中断状态为 `true`，不会抛出异常。此时线程可以通过显式检查中断状态决定是否停止任务。

例如：

public class InterruptPollingExample {  
    public static void main(String[] args) {  
        Thread t = new Thread(() -> {  
            while (!Thread.currentThread().isInterrupted()) {  
                System.out.println("Thread is running...");  
                try {  
                    Thread.sleep(500); // 模拟工作  
                } catch (InterruptedException e) {  
                    System.out.println("Thread interrupted during sleep.");  
                    Thread.currentThread().interrupt(); // 恢复中断状态  
                }  
            }  
            System.out.println("Thread is stopping.");  
        });  
​  
        t.start();  
​  
        try {  
            Thread.sleep(2000); // 主线程等待  
        } catch (InterruptedException e) {  
            e.printStackTrace();  
        }  
​  
        t.interrupt(); // 中断子线程  
    }  
}

**输出：**

Thread is running...  
Thread is running...  
Thread is running...  
Thread interrupted during sleep.  
Thread is stopping.

**分析：**

- 子线程轮询检查中断状态（`while (!Thread.currentThread().isInterrupted())`）。
    
- 主线程调用 `t.interrupt()` 时，子线程正在 `Thread.sleep()` 中。
    
- `sleep()` 抛出 `InterruptedException`，清除中断标志，线程需要显式调用 `Thread.currentThread().interrupt()` 恢复中断标志，最终退出循环。
    

---

总结

- **中断状态**：`Thread.interrupt()` 通常只是设置线程的中断标志。
    
- **抛出异常**：当线程在调用 **可中断方法**（如 `sleep`、`join`、`wait`）时被中断，会清除中断标志并抛出 `InterruptedException`。
    
- 线程处理中断：
    
    - 如果线程阻塞：捕获异常处理。
        
    - 如果线程未阻塞：通过轮询检查中断标志自行处理。
        

#### **volatile关键字**

volatile关键字主要用于解决变量在多个线程之间的可见性。**可见性**指的是：**当一个线程修改了某个共享变量的值，其他线程能够立即知道这个修改**。在多线程环境下，由于线程之间通常会有各自的工作内存（线程缓存），共享变量的修改可能不会立即同步到主内存，从而导致其他线程看不到最新的值，这就是可见性问题。

假设一个简单的例子：一个线程 `Thread-1` 修改了变量 `flag`，另一个线程 `Thread-2` 需要根据 `flag` 的变化停止运行。

如果没有volatile：

class VisibilityProblem {  
    private static boolean flag = false;  
​  
    public static void main(String[] args) {  
        // 线程1：修改 flag  
        Thread writerThread = new Thread(() -> {  
            try {  
                Thread.sleep(1000); // 模拟一些操作  
                flag = true; // 修改共享变量  
                System.out.println("Thread-1: flag 已修改为 true");  
            } catch (InterruptedException e) {  
                e.printStackTrace();  
            }  
        });  
​  
        // 线程2：读取 flag  
        Thread readerThread = new Thread(() -> {  
            while (!flag) { // 持续检查 flag  
                // 模拟一些工作，防止死循环优化  
            }  
            System.out.println("Thread-2: 发现 flag 为 true，退出循环");  
        });  
​  
        writerThread.start();  
        readerThread.start();  
    }  
}

> Thread2永远发现不了flag已经变为了true，无法退出循环

有volatile关键字：

class VisibilityProblem {  
    private volatile static boolean flag = false;  
​  
    public static void main(String[] args) {  
        // 线程1：修改 flag  
        Thread writerThread = new Thread(() -> {  
            try {  
                Thread.sleep(1000); // 模拟一些操作  
                flag = true; // 修改共享变量  
                System.out.println("Thread-1: flag 已修改为 true");  
            } catch (InterruptedException e) {  
                e.printStackTrace();  
            }  
        });  
​  
        // 线程2：读取 flag  
        Thread readerThread = new Thread(() -> {  
            while (!flag) { // 持续检查 flag  
                // 模拟一些工作，防止死循环优化  
            }  
            System.out.println("Thread-2: 发现 flag 为 true，退出循环");  
        });  
​  
        writerThread.start();  
        readerThread.start();  
    }  
}

> Thread2马上就发现flag已经变为了true，退出循环

但是不能保证原子性：[Java并发常见面试题总结](https://javaguide.cn/java/concurrent/java-concurrent-questions-02.html#volatile-%E5%8F%AF%E4%BB%A5%E4%BF%9D%E8%AF%81%E5%8E%9F%E5%AD%90%E6%80%A7%E4%B9%88)

#### 为什么自旋锁可以避免线程上下文切换的开销？

在传统的锁（如 `synchronized` 或 `ReentrantLock`）中，如果一个线程无法获取锁，通常会：

1. 被操作系统挂起。
    
2. 放入等待队列中。
    
3. 当锁释放后被唤醒，再次尝试获取锁。
    

这种机制涉及**线程的上下文切换**，包括：

- **保存线程状态**（如寄存器信息、栈信息等）。
    
- **切换到其他线程执行**，需要通过操作系统内核调用，开销较大。
    

而 **自旋锁** 在锁被占用时，仅在用户态反复检查锁的状态，不进入内核态，不会引发线程上下文切换，因此避免了这些开销。

class SpinLock {  
    private AtomicBoolean lock = new AtomicBoolean(false);  
  
    public void acquire() {  
        while (!lock.compareAndSet(false, true)) {  
            // 自旋等待  
        }  
    }  
  
    public void release() {  
        lock.set(false);  
    }  
}

- 通过 `compareAndSet` 方法（基于 CPU 的硬件指令，例如 x86 架构的 `CAS` 指令），可以在并发情况下安全地操作锁的状态。
    
- 自旋锁避免了复杂的操作系统调用逻辑，纯粹依赖用户态实现，因此实现简单。
    

自旋锁在以下场景下非常有效：

1. **临界区代码很短**：锁被持有的时间很短，线程无需等待太久即可获取锁。
    
2. **线程数较少**：竞争锁的线程数量较少，避免自旋时大量线程同时占用 CPU。
    

自旋锁的局限性：

1. **高 CPU 开销**：如果临界区较长或锁竞争激烈，自旋会导致 CPU 空转，浪费资源。
    
2. **不可中断**：大多数自旋锁实现不支持线程中断，可能会导致系统不可控的行为。
    
3. **死锁风险**：设计不当可能会导致死锁，例如线程在获取锁前意外退出。
    

#### AQS原理

AQS 核心思想是，如果被请求的共享资源空闲，则将当前请求资源的线程设置为有效的工作线程，并且将共享资源设置为锁定状态。如果被请求的共享资源被占用，那么就需要一套线程阻塞等待以及被唤醒时锁分配的机制，这个机制 ，AQS 是基于 **CLH 锁** 实现的。

在我看来，AQS就是是一个用于构建**同步工具**的框架。它通过一个**状态变量 (`state`)** 和一个**线程等待队列**，为各种同步器（如 ReentrantLock、CountDownLatch、Semaphore 等）提供了**可扩展的基础**。

在基于AQS设计一个同步工具的时候，你只需要想好你这个同步工具的实现方式是独占模式还是共享模式，如果是独占模式就实现 tryAcquire/tryRelease，如果是共享模式实现 tryAcquireShared/tryReleaseShared，定义好state 的含义。AQS 会自动帮你处理线程的排队，阻塞和唤醒，超时控制，中断处理等。

例如：

可重入的互斥锁 `ReentrantLock` 为例，它的内部维护了一个 `state` 变量，用来表示锁的占用状态。`state` 的初始值为 0，表示锁处于未锁定状态。当线程 A 调用 `lock()` 方法时，其实就是调用内部类的sync的父类AQS的acquire方法，而AQS的acquire的方法又会去调用子类也就是sync的 `tryAcquire()` 方法独占该锁，并让 `state` 的值加 1。如果成功了，那么线程 A 就获取到了锁。如果失败了，那么线程 A 就会被加入到一个等待队列（CLH 队列）中，直到其他线程释放该锁。

[ReentrantLock源码](https://zhuanlan.zhihu.com/p/65727594)

再例如：

共享锁锁 `CountDownLatch` 为例，它的内部维护了一个 `state` 变量，用来表示锁的占用状态。

![image-20241123113419014](file://C:\Users\Lysssyo\Desktop\%E6%96%87%E6%A1%A3\assets\2024-11-21-JUC.assets\image-20241123113419014.png?lastModify=1768218220)

## 2. ThreadLocal

#### ThreadLocal的原理

粗略地讲，ThreadLocal用来实现变量的线程隔离的。

一般情况下，我们创建的普通的变量是所有线程共享的，每个线程都可以通过get和set去访问和修改变量的值。那么怎样才能让每个变量在不同的线程都有自己的副本呢？就比如说有一个变量A，我希望线程1访问和修改变量A不影响线程2访问和修改变量B。ThreadLocal就是用来解决这个问题的。

如果你创建了一个`ThreadLocal`变量，那么访问这个变量的每个线程都会有这个变量的本地副本，线程A的访问和修改不影响线程B。

具体而言，Thread类有一个名为`threadLocals`的成员变量，类型为`ThreadLocal`类的内部类`ThreadLocalMap`，`ThreadLocalMap`类似于`HashMap`，但不是真的HashMap，优化了性能，弱化了功能。

当我们想要新建一个ThreadLocal类型的变量，希望各个线程的访问和修改互不影响，其实就是在Thread类的成员变量`threadlocals`中多加了一个键值对，`key`为`ThreadLocal`，`value`为想要各个线程访问互不影响的`Object`对象。

## 3. 线程池

#### ThreadPoolExecutor用法

    /**  
     * 用给定的初始参数创建一个新的ThreadPoolExecutor。  
     */  
    public ThreadPoolExecutor(int corePoolSize,//线程池的核心线程数量  
                              int maximumPoolSize,//线程池的最大线程数  
                              long keepAliveTime,//当线程数大于核心线程数时，多余的空闲线程存活的最长时间  
                              TimeUnit unit,//时间单位  
                              BlockingQueue<Runnable> workQueue,//任务队列，用来储存等待执行任务的队列  
                              ThreadFactory threadFactory,//线程工厂，用来创建线程，一般默认即可  
                              RejectedExecutionHandler handler//拒绝策略，当提交的任务过多而不能及时处理时，我们可以定制策略来处理任务  
                               ) {  
        if (corePoolSize < 0 ||  
            maximumPoolSize <= 0 ||  
            maximumPoolSize < corePoolSize ||  
            keepAliveTime < 0)  
            throw new IllegalArgumentException();  
        if (workQueue == null || threadFactory == null || handler == null)  
            throw new NullPointerException();  
        this.corePoolSize = corePoolSize;  
        this.maximumPoolSize = maximumPoolSize;  
        this.workQueue = workQueue;  
        this.keepAliveTime = unit.toNanos(keepAliveTime);  
        this.threadFactory = threadFactory;  
        this.handler = handler;  
    }

例一：

        ThreadPoolExecutor executor = new ThreadPoolExecutor(  
                2, // corePoolSize  
                5, // maximumPoolSize  
                60L, // keepAliveTime  
                TimeUnit.SECONDS, // unit  
                new LinkedBlockingQueue<>(10) // workQueue  
        );  
  
        // 提交 3 个任务  
        for (int i = 0; i < 3; i++) {  
            executor.execute(() -> {  
                System.out.println(Thread.currentThread().getName() + " 正在执行任务");  
                try {  
                    Thread.sleep(5000);  
                } catch (InterruptedException e) {  
                    e.printStackTrace();  
                }  
            });  
        }  
        executor.shutdown();

> 核心线程2个，最大线程数5个，任务队列最多可以放10个任务。
> 
> 提交了3个任务，前2个任务提交给核心线程执行。**第3个任务进入任务队列，等前2个任务执行完才执行**

例二

        ThreadPoolExecutor executor = new ThreadPoolExecutor(  
                2, // corePoolSize  
                4, // maximumPoolSize  
                60L, // keepAliveTime  
                TimeUnit.SECONDS, // unit  
                new LinkedBlockingQueue<>(2) // workQueue  
        );  
  
        // 提交 6 个任务  
        for (int i = 0; i < 6; i++) {  
            int taskNum = i + 1;  
            executor.execute(() -> {  
                System.out.println("任务 " + taskNum + " 由 " + Thread.currentThread().getName() + " 执行");  
                try {  
                    Thread.sleep(3000);  
                } catch (InterruptedException e) {  
                    e.printStackTrace();  
                }  
            });  
        }  
        executor.shutdown();

> 核心线程2个，最大线程数4个，任务队列最多可以放2个任务。
> 
> 提交了6个任务，前2个任务提交给核心线程执行。**第3个，第4个任务进入任务队列，任务队列满，启用备用线程（非核心线程）执行任务5，6**

例三：

        ThreadPoolExecutor executor = new ThreadPoolExecutor(  
                2, // corePoolSize  
                4, // maximumPoolSize  
                60L, // keepAliveTime  
                TimeUnit.SECONDS, // unit  
                new ArrayBlockingQueue<>(3) // workQueue，有界队列，必须指定容量，避免 OOM。  
        );  
  
        // 提交 8 个任务  
        for (int i = 0; i < 8; i++) {  
            int taskNum = i + 1;  
            executor.execute(() -> {  
                System.out.println("任务 " + taskNum + " 由 " + Thread.currentThread().getName() + " 执行");  
                try {  
                    Thread.sleep(2000);  
                } catch (InterruptedException e) {  
                    e.printStackTrace();  
                }  
            });  
        }  
        executor.shutdown();

> 核心线程2个，最大线程数4个，任务队列最多可以放3个任务。
> 
> 提交了8个任务，前2个任务提交给核心线程执行。**第3个，第4个，第5个任务进入任务队列，任务队列满，启用备用线程（非核心线程）执行任务6，7**，这时备用线程也用满了，第8个线程进来就触发拒绝策略。