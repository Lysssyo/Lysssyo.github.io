---
date created: 2026-03-25 15:24:43
date modified: 2026-03-25 21:08:54
---
# Lab2

## System call tracing（中等）

在这个作业中，你将添加一个系统调用追踪功能，这可能会在调试后续实验时对你有所帮助。你需要创建一个新的 `trace` 系统调用来控制追踪行为。它接受一个整数参数 `mask`（掩码），其**二进制位**指定了要追踪哪些系统调用。例如，要追踪 `fork` 系统调用，程序需要调用 `trace(1 << SYS_fork)`，其中 `SYS_fork` 是 `kernel/syscall.h` 中的系统调用编号。你需要修改 xv6 内核，使得每当一个系统调用即将返回时，如果该系统调用的编号在掩码中被设置了，就打印一行信息。这行信息应包含进程 ID、系统调用名称和返回值；你不需要打印系统调用的参数。`trace` 系统调用应该对调用它的进程以及它后续 `fork` 出的所有子进程启用追踪，但不应影响其他进程。

我们提供了一个用户态的 `trace` 程序，它可以在启用追踪的情况下运行另一个程序（见 `user/trace.c`）。完成后，你应该能看到如下输出：

```
$ trace 32 grep hello README
3: syscall read -> 1023
3: syscall read -> 966
3: syscall read -> 70
3: syscall read -> 0
$
$ trace 2147483647 grep hello README
4: syscall trace -> 0
4: syscall exec -> 3
4: syscall open -> 3
4: syscall read -> 1023
4: syscall read -> 966
4: syscall read -> 70
4: syscall read -> 0
4: syscall close -> 0
$
$ grep hello README
$
$ trace 2 usertests forkforkfork
usertests starting
test forkforkfork: 407: syscall fork -> 408
408: syscall fork -> 409
409: syscall fork -> 410
410: syscall fork -> 411
409: syscall fork -> 412
410: syscall fork -> 413
409: syscall fork -> 414
411: syscall fork -> 415
...
$
```

在第一个例子中，`trace` 调用 `grep` 时只追踪 `read` 系统调用，`32` 就是 `1<<SYS_read`。在第二个例子中，`trace` 在追踪所有系统调用的情况下运行 `grep`，`2147483647` 的低 31 位全部为 1。在第三个例子中，程序没有被追踪，所以没有打印任何追踪输出。在第四个例子中，`usertests` 中 `forkforkfork` 测试的所有子孙进程的 `fork` 系统调用都被追踪了。只要你的程序行为与上面展示的一致，你的解答就是正确的（尽管进程 ID 可能不同）。

**提示**

- 在 `Makefile` 的 `UPROGS` 中添加 `$U/_trace`。
- 运行 `make qemu`，你会发现编译器无法编译 `user/trace.c`，因为该系统调用的用户态桩函数还不存在：需要在 `user/user.h` 中添加系统调用的函数原型，在 `user/usys.pl` 中添加桩函数，在 `kernel/syscall.h` 中添加系统调用编号。`Makefile` 会调用 Perl 脚本 `user/usys.pl`，生成 `user/usys.S`，即真正的系统调用桩函数，它们使用 RISC-V 的 `ecall` 指令切换到内核。修复编译问题后，运行 `trace 32 grep hello README`，它会失败，因为你还没有在内核中实现该系统调用。
- 在 `kernel/sysproc.c` 中添加 `sys_trace()` 函数，通过将参数保存到 `proc` 结构体（见 `kernel/proc.h`）中的一个新变量来实现新的系统调用。从用户空间获取系统调用参数的函数在 `kernel/syscall.c` 中，你可以在 `kernel/sysproc.c` 中看到使用示例。
- 修改 `kernel/proc.c` 中的 `fork()`，将追踪掩码从父进程复制到子进程。
- 修改 `kernel/syscall.c` 中的 `syscall()` 函数来打印追踪输出。你需要添加一个系统调用名称数组用于索引。

### 题解

这道题的核心思路是：**用户通过 `trace(mask)` 设置一个掩码，内核在每次系统调用返回时检查该掩码，如果命中就打印信息。** 掩码的第 N 位为 1 表示要追踪编号为 N 的系统调用。

> [!TIP]
> mask 的每一个**二进制位**对应一个系统调用：
> 
> ```
> 位编号：  7    6    5    4    3    2    1    0
>           ↑    ↑    ↑    ↑    ↑    ↑    ↑    ↑
>                    对应各个系统调用编号
> ```
> 
> 想追踪 `read`（编号5），就把第5位设为1：
> 
> ```
> mask = 0010 0000 = 32 = 1<<SYS_read
> ```
> 
> 想追踪 `fork`（编号1），就把第1位设为1：
> 
> ```
> mask = 0000 0010 = 2 = 1<<SYS_fork
> ```
> 
> 想同时追踪多个，就用 `|` 合并：
> 
> ```
> mask = (1<<SYS_read) | (1<<SYS_fork)
>      = 0010 0000 | 0000 0010
>      = 0010 0010
> ```


整个实现可以分为两大步：**注册系统调用**和**实现追踪逻辑**。

#### 第一步：注册 trace 系统调用

新增一个系统调用需要改动多个文件。

**1. 分配系统调用编号** — `kernel/syscall.h`

```c
#define SYS_trace  22
```

**2. 添加用户态桩函数** — `user/usys.pl`

在文件末尾添加：

```perl
//...
entry("chdir");
entry("dup");
entry("getpid");
entry("sbrk");
entry("sleep");
entry("uptime");
entry("trace"); //新增
```

`Makefile` 会调用这个 Perl 脚本自动生成 `user/usys.S`，里面的汇编代码会把系统调用编号放进 `a7` 寄存器，然后执行 `ecall` 陷入内核。

```
.global uptime
uptime:
 li a7, SYS_uptime
 ecall
 ret
# 以下为新增
.global trace
trace:
 li a7, SYS_trace
 ecall
 ret
```

**3. 声明用户态接口** — `user/user.h`

```c
int trace(int);
```

**4. 将 trace 程序加入编译** — `Makefile`

在 `UPROGS` 中添加：

```makefile
$U/_trace\
```

至此，用户态的 `trace` 程序可以编译通过了，但调用会失败，因为内核还没有实现。

#### 第二步：实现内核追踪逻辑

**1. 扩展进程结构体** — `kernel/proc.h`

在 `struct proc` 末尾新增一个字段，用于存储当前进程的追踪掩码：

```c
struct proc {
  // ... 原有字段 ...
  char name[16];               // Process name (debugging)

  int mask;                    // trace 掩码
};
```

**2. 实现 sys_trace()** — `kernel/sysproc.c`

这个函数的职责很简单：从用户传入的参数中取出 mask，保存到当前进程的 `proc` 结构体中。

```c
uint64
sys_trace(void)
{
  int mark;

  if (argint(0, &mark) < 0)
    return -1;

  struct proc *p = myproc();
  p->mask = mark;
  return 0;
}
```

`argint(0, &mark)` 是 xv6 获取系统调用第 0 个参数的标准方式。用户态调用 `trace(mask)` 时，参数 `mask` 被放在 `a0` 寄存器中传入内核，`argint` 就是从 trapframe 的对应寄存器里把它读出来。

**3. fork 时继承掩码** — `kernel/proc.c`

题目要求子进程也要继承父进程的追踪设置，所以在 `fork()` 中把 mask 复制过去：

```c
// copy saved user registers.
*(np->trapframe) = *(p->trapframe);

np->mask = p->mask;   // 子进程继承父进程的 trace 掩码

// Cause fork to return 0 in the child.
np->trapframe->a0 = 0;
```

**4. 在 syscall 分发处打印追踪信息** — `kernel/syscall.c`

首先，需要注册新的系统调用处理函数：

```c
extern uint64 sys_trace(void);

static uint64 (*syscalls[])(void) = {
  // ... 原有条目 ...
  [SYS_close]  sys_close,
  [SYS_trace]  sys_trace,
};
```

然后，添加一个系统调用名称数组，用于根据编号查名字：

```c
char *syscall_names[] = {
    "",       // 0 占位，因为编号从1开始
    "fork",   // 1
    "exit",   // 2
    "wait",   // 3
    "pipe",   // 4
    "read",   // 5
    "kill",   // 6
    "exec",   // 7
    "fstat",  // 8
    "chdir",  // 9
    "dup",    // 10
    "getpid", // 11
    "sbrk",   // 12
    "sleep",  // 13
    "uptime", // 14
    "open",   // 15
    "write",  // 16
    "mknod",  // 17
    "unlink", // 18
    "link",   // 19
    "mkdir",  // 20
    "close",  // 21
    "trace",  // 22
};
```

最后，修改 `syscall()` 函数，在系统调用执行后检查掩码并打印：

```c
void syscall(void)
{
  int num;
  struct proc *p = myproc();

  num = p->trapframe->a7;

  if (num > 0 && num < NELEM(syscalls) && syscalls[num])
  {
    int value = syscalls[num]();   // 执行系统调用，拿到返回值
    p->trapframe->a0 = value;      // 将返回值写回 a0 寄存器，用户态返回后就能拿到

    // 检查掩码：如果 mask 的第 num 位为 1，说明需要追踪这个系统调用
    if (p->mask & (1 << num))
    {
      printf("%d: syscall %s -> %d\n", p->pid, syscall_names[num], value);
    }
  }
  else
  {
    printf("%d %s: unknown sys call %d\n", p->pid, p->name, num);
    p->trapframe->a0 = -1;
  }
}
```

核心判断就是 `p->mask & (1 << num)`：把 1 左移系统调用编号位，与掩码做按位与，非零说明用户要求追踪该调用。

#### 整体调用链路

```
用户态: trace(1 << SYS_read)
  → usys.S: 将 SYS_trace 放入 a7, ecall 陷入内核
    → syscall(): 根据 a7 分发到 sys_trace()
      → sys_trace(): 将 mask 存入 p->mask
        → 返回用户态

用户态: read(fd, buf, n)
  → usys.S: 将 SYS_read 放入 a7, ecall 陷入内核
    → syscall(): 调用 sys_read(), 得到返回值
      → 检查 p->mask & (1 << SYS_read) → 命中！
      → printf("pid: syscall read -> 返回值")
        → 返回用户态
```

总而言之，这个实验其实就两步。第一步就是注册 trace 这个系统调用，让程序可以在用户态调用这个系统调用，同时内核的 sys_trace 方法可以收到这个调用。第二步就是实现逻辑。


## Sysinfo（中等）

在这个作业中，你需要添加一个系统调用 `sysinfo`，用于收集正在运行的系统的信息。该系统调用接受一个参数：指向 `struct sysinfo` 的指针（见 `kernel/sysinfo.h`）。内核需要填充这个结构体的字段：`freemem` 字段应设置为空闲内存的字节数，`nproc` 字段应设置为状态不是 `UNUSED` 的进程数量。我们提供了一个测试程序 `sysinfotest`；如果它打印出 `"sysinfotest: OK"` 则表示通过。

**提示：**

- 在 Makefile 的 `UPROGS` 中添加 `$U/_sysinfotest`
- 运行 `make qemu`，`user/sysinfotest.c` 会编译失败。按照上一个作业的相同步骤添加系统调用 `sysinfo`。要在 `user/user.h` 中声明 `sysinfo()` 的原型，需要预先声明 `struct sysinfo` 的存在：

```c
    struct sysinfo;
    int sysinfo(struct sysinfo *);
```

```
修复编译问题后，运行 `sysinfotest`，它会失败，因为你还没有在内核中实现该系统调用。
```

- `sysinfo` 需要将 `struct sysinfo` 拷贝回用户空间；参考 `sys_fstat()`（`kernel/sysfile.c`）和 `filestat()`（`kernel/file.c`）中使用 `copyout()` 的示例
- 要收集空闲内存的数量，在 `kernel/kalloc.c` 中添加一个函数
- 要收集进程数量，在 `kernel/proc.c` 中添加一个函数