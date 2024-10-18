---
title: 多线程
date: 2024-8-18 10:42:00 +0800
categories: [Java, Grammar]
tags: [Java, Grammar,Thread]
---



## 1. 实现多线程

### 1.1 继承Thread类

| 方法名       | 说明                                        |
| ------------ | ------------------------------------------- |
| void run()   | 在线程开启后，此方法将被调用执行            |
| void start() | 使此线程开始执行，Java虚拟机会调用run方法() |

示例：

```java
public class MyThread extends Thread {
    @Override
    public void run() {
        for(int i=0; i<100; i++) {
            System.out.println(i);
        }
    }
}
public class MyThreadDemo {
    public static void main(String[] args) {
        MyThread my1 = new MyThread();
        MyThread my2 = new MyThread();

        my1.start();
        my2.start();
    }
}
```

### 1.2 实现Runnable接口

| 方法名                               | 说明                   |
| ------------------------------------ | ---------------------- |
| Thread(Runnable target)              | 分配一个新的Thread对象 |
| Thread(Runnable target, String name) | 分配一个新的Thread对象 |

示例：

```java
public class MyRunnable implements Runnable {
    @Override
    public void run() {
        for(int i=0; i<100; i++) {
            System.out.println(Thread.currentThread().getName()+":"+i);
        }
    }
}
public class MyRunnableDemo {
    public static void main(String[] args) {
        //创建MyRunnable类的对象
        MyRunnable my = new MyRunnable();

        //创建Thread类的对象，把MyRunnable对象作为构造方法的参数
        //Thread(Runnable target)
		//Thread t1 = new Thread(my);
		//Thread t2 = new Thread(my);
        
        //Thread(Runnable target, String name)
        Thread t1 = new Thread(my,"坦克");
        Thread t2 = new Thread(my,"飞机");

        //启动线程
        t1.start();
        t2.start();
    }
}
```

### 1.3 实现Callable接口

| 方法名                           | 说明                                               |
| -------------------------------- | -------------------------------------------------- |
| V call()                         | 计算结果，如果无法计算结果，则抛出一个异常         |
| FutureTask(Callable<V> callable) | 创建一个 FutureTask，一旦运行就执行给定的 Callable |
| V get()                          | 如有必要，等待计算完成，然后获取其结果             |

示例：

```java
public class MyCallable implements Callable<String> {
    @Override
    public String call() throws Exception {
        for (int i = 0; i < 100; i++) {
            System.out.println("跟女孩表白" + i);
        }
        //返回值就表示线程运行完毕之后的结果
        return "答应";
    }
}
public class Demo {
    public static void main(String[] args) throws ExecutionException, InterruptedException {
        //线程开启之后需要执行里面的call方法
        MyCallable mc = new MyCallable();

        //Thread t1 = new Thread(mc);

        //可以获取线程执行完毕之后的结果.也可以作为参数传递给Thread对象
        FutureTask<String> ft = new FutureTask<>(mc);

        //创建线程对象
        Thread t1 = new Thread(ft);

        String s = ft.get();
        //开启线程
        t1.start();

        //String s = ft.get();
        System.out.println(s);
    }
}
```

## 2. 基本方法

| 方法名                                  | 说明                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| void  setName(String name)              | 将此线程的名称更改为等于参数name                             |
| String  getName()                       | 返回此线程的名称                                             |
| **Thread**  currentThread()             | 返回对当前正在执行的**线程对象的引用**                       |
| static void sleep(long millis)          | 使当前正在执行的线程停留（暂停执行）指定的毫秒数             |
| final int getPriority()                 | 返回此线程的优先级（默认为5）                                |
| final void setPriority(int newPriority) | 更改此线程的优先级线程；线程优先级的范围是：1-10             |
| void setDaemon(boolean on)              | 将此线程标记为守护线程，当运行的线程都是守护线程时，Java虚拟机将退出 |

例一（`sleep()方法`）：

```java
public class MyRunnable implements Runnable {
    @Override
    public void run() {
        for (int i = 0; i < 100; i++) {
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }

            System.out.println(Thread.currentThread().getName() + "---" + i);
        }
    }
}

class Demo {
    public static void main(String[] args) throws InterruptedException {
        System.out.println("睡觉前");
        Thread.sleep(1000);
        System.out.println("睡醒了");

        MyRunnable mr = new MyRunnable();

        Thread t1 = new Thread(mr);
        Thread t2 = new Thread(mr);

        t1.start();
        t2.start();
        Thread.sleep(1000);
        
        for (int i = 0; i < 10; i++) {
            System.out.println("111");
        }

    }
}
```

输出：

```
睡觉前
睡醒了
Thread-1---0
Thread-0---0
Thread-0---1
...
Thread-0---6
Thread-1---7
Thread-0---7
Thread-1---8
Thread-0---8
111
111
111
111
111
111
111
111
111
111
Thread-0---9
Thread-1---9
...
Thread-1---12
```

> `111`可以连续打印是因为主线程运行较快，子线程运行较慢（因为中间的休眠`Thread.sleep(100);`）

例二（守护线程）：

```java
public class MyThread1 extends Thread {
    @Override
    public void run() {
        for (int i = 0; i < 10; i++) {
            System.out.println(getName() + "---" + i);
        }
    }
}

class MyThread2 extends Thread {
    @Override
    public void run() {
        for (int i = 0; i < 100; i++) {
            System.out.println(getName() + "---" + i);
        }
    }
}

class Demo {
    public static void main(String[] args) {
        MyThread1 t1 = new MyThread1();
        MyThread2 t2 = new MyThread2();

        t1.setName("女神");
        t2.setName("备胎");

        // 把第二个线程设置为守护线程
        // 当普通线程执行完之后,那么守护线程也没有继续运行下去的必要了.
        t2.setDaemon(true);

        t1.start();
        t2.start();
    }
}
```

输出：

```
备胎---0
备胎---1
备胎---2
女神---0
备胎---3
女神---1
女神---2
女神---3
女神---4
备胎---4
女神---5
女神---6
女神---7
女神---8
女神---9
备胎---5
备胎---6
备胎---7
备胎---8
备胎---9
备胎---10
备胎---11
备胎---12
```

## 3. 线程的生命周期

![image-20241018105215616](assets/2024-10-18-JdkThread.assets/image-20241018105215616.png)

当线程被创建并启动以后，它既不是一启动就进入了执行状态，也不是一直处于执行状态。线程对象在不同的时期有不同的状态。那么Java中的线程存在哪几种状态呢？Java中的线程状态被定义在了java.lang.Thread.State枚举类中，State枚举类的源码如下：

```java
public class Thread {
    
    public enum State {
    
        /* 新建 */
        NEW , 

        /* 可运行状态 */
        RUNNABLE , 

        /* 阻塞状态 */
        BLOCKED , 

        /* 无限等待状态 */
        WAITING , 

        /* 计时等待 */
        TIMED_WAITING , 

        /* 终止 */
        TERMINATED;
    
	}
    
    // 获取当前线程的状态
    public State getState() {
        return jdk.internal.misc.VM.toThreadState(threadStatus);
    }
    
}
```

通过源码我们可以看到Java中的线程存在6种状态，每种线程状态的含义如下

| 线程状态      | 具体含义                                                     |
| ------------- | ------------------------------------------------------------ |
| NEW           | 一个尚未启动的线程的状态。也称之为初始状态、开始状态。线程刚被创建，但是并未启动。还没调用start方法。MyThread t = new MyThread()只有线程象，没有线程特征。 |
| RUNNABLE      | 当我们调用线程对象的start方法，那么此时线程对象进入了RUNNABLE状态。那么此时才是真正的在JVM进程中创建了一个线程，线程一经启动并不是立即得到执行，线程的运行与否要听令与CPU的调度，那么我们把这个中间状态称之为可执行状态(RUNNABLE)也就是说它具备执行的资格，但是并没有真正的执行起来而是在等待CPU的度。 |
| BLOCKED       | 当一个线程试图获取一个对象锁，而该对象锁被其他的线程持有，则该线程进入Blocked状态；当该线程持有锁时，该线程将变成Runnable状态。 |
| WAITING       | 一个正在等待的线程的状态。也称之为等待状态。造成线程等待的原因有两种，分别是调用Object.wait()、join()方法。处于等待状态的线程，正在等待其他线程去执行一个特定的操作。例如：因为wait()而等待的线程正在等待另一个线程去调用notify()或notifyAll()；一个因为join()而等待的线程正在等待另一个线程结束。 |
| TIMED_WAITING | 一个在限定时间内等待的线程的状态。也称之为限时等待状态。造成线程限时等待状态的原因有三种，分别是：Thread.sleep(long)，Object.wait(long)、join(long)。 |
| TERMINATED    | 一个完全运行完成的线程的状态。也称之为终止状态、结束状态     |

## 4. 线程同步

### 4.1 卖票问题

```java
class SellTicket implements Runnable {
    private int tickets = 100;

    //在SellTicket类中重写run()方法实现卖票，代码步骤如下
    @Override
    public void run() {
        //卖完了
        while (tickets > 0) {
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            tickets--;
            System.out.println(Thread.currentThread().getName() + "在卖票,还剩下" + tickets + "张票");
        }
    }
}

class SellTicketDemo {
    public static void main(String[] args) {
        //创建SellTicket类的对象
        SellTicket st = new SellTicket();

        //创建三个Thread类的对象，把SellTicket对象作为构造方法的参数，并给出对应的窗口名称
        Thread t1 = new Thread(st, "窗口1");
        Thread t2 = new Thread(st, "窗口2");
        Thread t3 = new Thread(st, "窗口3");

        //启动线程
        t1.start();
        t2.start();
        t3.start();
    }
}
```

显然这会超卖

### 4.2 同步代码块解决超卖问题

同步代码块格式：

```java
synchronized(任意对象) { 
	多条语句操作共享数据的代码 
}
```

> `synchronized(任意对象)`：就相当于给代码加锁了，任意对象就可以看成是一把锁

同步的好处和弊端  

- 好处：解决了多线程的数据安全问题
- 弊端：当线程很多时，因为每个线程都会去判断同步上的锁，这是很耗费资源的，无形中会降低程序的运行效率

解决超卖问题：

```java
class SellTicket implements Runnable {
    private int tickets = 0;
    private final Object obj = new Object();

    @Override
    public void run() {
        while (true) {
            synchronized (obj) { // 对可能有安全问题的代码加锁,多个线程必须使用同一把锁
                // t1进来后，就会把这段代码给锁起来
                if (tickets <= 99) {
                    // 窗口1正在出售第100张票
                    System.out.println(Thread.currentThread().getName() + "正在出售第" + ++tickets + "张票");
                }
            }
            // t1出来了，这段代码的锁就被释放了
        }
    }
}

class SellTicketDemo {
    public static void main(String[] args) {
        SellTicket st = new SellTicket();

        Thread t1 = new Thread(st, "窗口1");
        Thread t2 = new Thread(st, "窗口2");
        Thread t3 = new Thread(st, "窗口3");

        t1.start();
        t2.start();
        t3.start();
    }
}
```

### 4.3 同步方法解决超卖问题

同步方法的格式：

```java
修饰符 synchronized 返回值类型 方法名(方法参数) { 
	方法体；
}
```

> 同步方法的锁对象是**this**

解决超卖问题：

```java
class Ticket implements Runnable {
    //票的数量
    private int ticketCount = 0;  //最多卖100张
    private ReentrantLock lock = new ReentrantLock();

    @Override
    public void run() {
        while (true) {
            try {
                lock.lock();
                if (ticketCount > 99) {
                    break;
                }
                ticketCount++;
                System.out.println(Thread.currentThread().getName() + "正在出售第" + ++ticketCount + "张票");

            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                lock.unlock();
            }
        }
    }
}

class Demo {
    public static void main(String[] args) {
        Ticket ticket = new Ticket();

        Thread t1 = new Thread(ticket);
        Thread t2 = new Thread(ticket);
        Thread t3 = new Thread(ticket);

        t1.setName("窗口一");
        t2.setName("窗口二");
        t3.setName("窗口三");

        t1.start();
        t2.start();
        t3.start();
    }
}
```

补充：同步静态方法——就是把synchronized关键字加到静态方法上

```java
修饰符 static synchronized 返回值类型 方法名(方法参数) { 
	方法体；
}
```

> 同步静态方法的锁对象是**类名.class**

如果上面的`synchronizedMethod`为静态方法，那么锁对象为`MyRunnable.class`

### 4.4 Lock锁解决超卖问题

虽然我们可以理解同步代码块和同步方法的锁对象问题，但是我们并没有直接看到在哪里加上了锁，在哪里释放了锁，为了更清晰的表达如何加锁和释放锁，JDK5以后提供了一个新的锁对象Lock。

`Lock`是接口不能直接实例化，这里采用它的实现类`ReentrantLock`来实例化

`ReentrantLock`构造方法

| 方法名          | 说明                        |
| --------------- | --------------------------- |
| ReentrantLock() | 创建一个ReentrantLock的实例 |

加锁解锁方法

| 方法名        | 说明   |
| ------------- | ------ |
| void lock()   | 获得锁 |
| void unlock() | 释放锁 |

解决超卖问题：

```java
class Ticket implements Runnable {
    //票的数量
    private int ticket = 100;
    private ReentrantLock lock = new ReentrantLock();

    @Override
    public void run() {
        while (true) {
            try {
                lock.lock();
                if (ticket <= 0) {
                    //卖完了
                    break;
                } else {
                    Thread.sleep(100);
                    ticket--;
                    System.out.println(Thread.currentThread().getName() + "在卖票,还剩下" + ticket + "张票");
                }
            } catch (InterruptedException e) {
                e.printStackTrace();
            } finally {
                lock.unlock();
            }
        }
    }
}

class Demo {
    public static void main(String[] args) {
        Ticket ticket = new Ticket();

        Thread t1 = new Thread(ticket);
        Thread t2 = new Thread(ticket);
        Thread t3 = new Thread(ticket);

        t1.setName("窗口一");
        t2.setName("窗口二");
        t3.setName("窗口三");

        t1.start();
        t2.start();
        t3.start();
    }
}
```

## 5. 生产者消费者问题

生产者消费者模式是一个十分经典的**多线程协作的模式**。为了解耦生产者和消费者的关系，通常会采用共享的数据区域，就像是一个仓库生产者生产数据之后直接放置在共享数据区中，并不需要关心消费者的行为；消费者只需要从共享数据区中去获取数据，并不需要关心生产者的行为。

Object类的等待和唤醒方法

| 方法名           | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| void wait()      | 导致当前线程等待，直到另一个线程调用该对象的 notify()方法或 notifyAll()方法 |
| void notify()    | 唤醒正在等待对象监视器的单个线程                             |
| void notifyAll() | 唤醒正在等待对象监视器的所有线程                             |

代码实现：

```java
class Desk {
    // 定义一个标记
    // true 就表示桌子上有汉堡包的，此时允许吃货执行
    // false 就表示桌子上没有汉堡包的，此时允许厨师执行
    public static boolean flag = false;

    // 汉堡包的总数量
    public static int count = 10;

    // 锁对象
    public static final Object lock = new Object();
}

class Cooker extends Thread {
    // 生产者步骤：
    // 1. 判断桌子上是否有汉堡包
    // 2. 如果有就等待，如果没有才生产
    // 3. 把汉堡包放在桌子上
    // 4. 叫醒等待的消费者开吃
    @Override
    public void run() {
        while (true) {
            synchronized (Desk.lock) { // 互斥访问临界资源
                if (Desk.count == 0) {
                    break;
                }
                if (!Desk.flag) { //没有面包
                    //生产
                    System.out.println("厨师正在生产汉堡包");
                    Desk.flag = true;
                    Desk.lock.notifyAll(); // 使用什么对象当做锁，那么就必须用这个对象去调用等待和唤醒的方法
                } else {
                    try {
                        Desk.lock.wait();
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }

            }
        }
    }
}

class Foodie extends Thread {
    @Override
    public void run() {
        // 1. 判断桌子上是否有汉堡包。
        // 2. 如果没有就等待。
        // 3. 如果有就开吃
        // 4. 吃完之后，桌子上的汉堡包就没有了
        // 5. 叫醒等待的生产者继续生产
        // 6. 汉堡包的总数量减一
        while (true) {
            synchronized (Desk.lock) {
                if (Desk.count == 0) {
                    break;
                }
                if (Desk.flag) {
                    //有
                    System.out.println("吃货在吃汉堡包");
                    Desk.flag = false;
                    Desk.lock.notifyAll();
                    Desk.count--;
                } else {
                    //没有就等待
                    //使用什么对象当做锁,那么就必须用这个对象去调用等待和唤醒的方法.
                    try {
                        Desk.lock.wait();
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }

            }
        }

    }
}

class Demo {
    public static void main(String[] args) {
        /*消费者步骤：
        1，判断桌子上是否有汉堡包。
        2，如果没有就等待。
        3，如果有就开吃
        4，吃完之后，桌子上的汉堡包就没有了
                叫醒等待的生产者继续生产
        汉堡包的总数量减一*/

        /*生产者步骤：
        1，判断桌子上是否有汉堡包
        如果有就等待，如果没有才生产。
        2，把汉堡包放在桌子上。
        3，叫醒等待的消费者开吃。*/

        Foodie f = new Foodie();
        Cooker c = new Cooker();

        f.start();
        c.start();

    }
}
```

> **关键在于线程之间的相互依赖的关系**

## 6. 线程池

### 6.1 基本原理

系统创建一个线程的成本是比较高的，因为它涉及到与操作系统交互，当程序中需要创建大量生存期很短暂的线程时，频繁的创建和销毁线程对系统的资源消耗有可能大于业务处理是对系统资源的消耗，这样就有点"舍本逐末"了。针对这一种情况，为了提高性能，我们就可以采用线程池。**线程池在启动的时，会创建大量空闲线程，当我们向线程池提交任务的时，线程池就会启动一个线程来执行该任务。等待任务执行完毕以后，线程并不会死亡，而是再次返回到线程池中称为空闲状态。等待下一次任务的执行。**

### 6.2 Executors默认线程池

JDK对线程池也进行了相关的实现，在真实企业开发中我们也很少去自定义线程池，而是使用JDK中自带的线程池。

我们可以使用Executors中所提供的**静态**方法来创建线程池

```java
	public static ExecutorService newCachedThreadPool()    //创建一个默认的线程池
	public static newFixedThreadPool(int nThreads)	    	//创建一个指定最多线程数量的线程池
```

**示例：** 

```java
public class MyThreadPoolDemo {
    public static void main(String[] args) throws InterruptedException {

        // 创建一个默认的线程池对象.池子中默认是空的.默认最多可以容纳int类型的最大值那么多的线程
        ExecutorService executorService = Executors.newCachedThreadPool();
        
        // 提交任务
        executorService.submit(()->{
            System.out.println(Thread.currentThread().getName() + "在执行了");
        });
        
        Thread.sleep(2000);// 任务完成后，线程归还线程池

        executorService.submit(()->{
            System.out.println(Thread.currentThread().getName() + "在执行了");
        });

        //executorService.shutdown();// 消耗线程池
    }
}
```

输出：

```
pool-1-thread-1在执行了
pool-1-thread-1在执行了
```

如果注释掉`Thread.sleep(2000);`

输出：

```
pool-1-thread-1在执行了
pool-1-thread-2在执行了
```

### 6.3 Executors创建指定上限的线程池

**使用Executors中所提供的静态方法来创建线程池**

```java
    static ExecutorService newFixedThreadPool(int nThreads) //创建一个指定最多线程数量的线程池
```

**代码实现 :** 

```java
public class MyThreadPoolDemo2 {
    public static void main(String[] args) {
        //参数不是初始值而是最大值
        ExecutorService executorService = Executors.newFixedThreadPool(10);

        ThreadPoolExecutor pool = (ThreadPoolExecutor) executorService;
        System.out.println(pool.getPoolSize());//0

        executorService.submit(()->{
            System.out.println(Thread.currentThread().getName() + "在执行了");
        });

        executorService.submit(()->{
            System.out.println(Thread.currentThread().getName() + "在执行了");
        });

        System.out.println(pool.getPoolSize());//2
//        executorService.shutdown();
    }
}
```

### 6.4 ThreadPoolExecutor

**创建线程池对象 :** 

```java
    public ThreadPoolExecutor(int corePoolSize,
                              int maximumPoolSize,
                              long keepAliveTime,
                              TimeUnit unit,
                              BlockingQueue<Runnable> workQueue,
                              ThreadFactory threadFactory,
                              RejectedExecutionHandler handler) {
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
```

> - `corePoolSize`：核心线程的最大值，不能小于0
>
> - `maximumPoolSize`：最大线程数，不能小于等于0，`maximumPoolSize` >= `corePoolSize`
>
>   > 只有任务队列满的时候才会调用临时线程执行没有入任务队列的任务
>
> - `keepAliveTime`：空闲线程最大存活时间，不能小于0
>
> - `unit`：时间单位
>
> - `workQueue`：任务队列，不能为null
>
> - `threadFactory`：创建线程工厂，不能为null      
>
> - `handler`：任务的拒绝策略，不能为null 
>
>   > 如果任务数量大于`maximumPoolSize`加`workQueue`可容纳的任务数量，多出的任务就会触发任务的拒绝策略

**示例：** 

```java
    public static void main(String[] args) {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(
                1,
                2,
                2,
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(1),
                Executors.defaultThreadFactory(),
                new ThreadPoolExecutor.AbortPolicy());
        pool.submit(() -> {
            System.out.println("任务1" + Thread.currentThread().getName() + "在执行了");
        });
        pool.submit(() -> {
            System.out.println("任务2" + Thread.currentThread().getName() + "在执行了");
        });
        pool.submit(() -> {
            System.out.println("任务3" + Thread.currentThread().getName() + "在执行了");
        });
        pool.submit(() -> {
            System.out.println("任务4" + Thread.currentThread().getName() + "在执行了");
        });
        pool.submit(() -> {
            System.out.println("任务5" + Thread.currentThread().getName() + "在执行了");
        });
        pool.submit(() -> {
            System.out.println("任务6" + Thread.currentThread().getName() + "在执行了");
        });
        pool.submit(() -> {
                System.out.println("任务7" + Thread.currentThread().getName() + "在执行了");
        });
        pool.submit(() -> {
                System.out.println("任务8" + Thread.currentThread().getName() + "在执行了");
        });
        pool.shutdown();
    }
```

输出：

```
任务1pool-1-thread-1在执行了
任务3pool-1-thread-2在执行了
任务2pool-1-thread-1在执行了
Exception in thread "main" java.util.concurrent.RejectedExecutionException: Task java.util.concurrent.FutureTask@343f4d3d[Not completed, task = java.util.concurrent.Executors$RunnableAdapter@42e26948[Wrapped task = com.hmdp.pojo.MyThreadPoolDemo3$$Lambda$17/0x0000000800066440@57baeedf]] rejected from java.util.concurrent.ThreadPoolExecutor@53b32d7[Running, pool size = 2, active threads = 2, queued tasks = 1, completed tasks = 0]
```

### 6.5 非默认任务拒绝策略

RejectedExecutionHandler是jdk提供的一个任务拒绝策略接口，它下面存在4个子类。

| 策略名称                                 | 描述                                                         | 推荐程度                   |
| ---------------------------------------- | ------------------------------------------------------------ | -------------------------- |
| `ThreadPoolExecutor.AbortPolicy`         | 丢弃任务并抛出 `RejectedExecutionException` 异常。是默认的策略。 | 推荐                       |
| `ThreadPoolExecutor.DiscardPolicy`       | 丢弃任务，但不抛出异常。                                     | 不推荐                     |
| `ThreadPoolExecutor.DiscardOldestPolicy` | 抛弃队列中等待最久的任务，然后将当前任务加入队列中。         | 适用于需要保留新任务的场景 |
| `ThreadPoolExecutor.CallerRunsPolicy`    | 调用任务的 `run()` 方法绕过线程池直接执行。                  | 适用于避免任务丢失的场景   |

