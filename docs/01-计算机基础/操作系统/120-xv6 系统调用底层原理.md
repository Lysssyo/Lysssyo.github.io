---
date created: 2026-03-18 21:23:29
date modified: 2026-03-18 21:31:09
---
# xv6 系统调用底层原理

> 以 `user/sleep.c` 为例，深入剖析库函数调用与系统调用的底层机制

---

## 0. 起点：我们写的 user/sleep.c

在 MIT xv6 Lab 1 中，我们编写了如下用户程序：

```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int main(int argc, char *argv[])
{
  if (argc <= 1) {
    fprintf(2, "Usage: sleep ticks\n");
    exit(1);
  }
  int tick = atoi(argv[1]);  // ← 库函数调用
  sleep(tick);               // ← 系统调用
  exit(0);
}
```

这个文件只有 15 行，却包含了**两种截然不同的函数调用方式**：

- `atoi(argv[1])` —— 库函数调用
- `sleep(tick)` —— 系统调用

它们在代码里写法一模一样，但底层执行路径完全不同。本文将以这两行为主线，逐一追踪它们各自的完整执行链路。

---

## 1. 核心区分：两种调用，两个世界

| 维度       | `atoi`（库函数调用）  | `sleep`（系统调用）            |
| -------- | -------------- | ------------------------ |
| 定义位置     | `user/ulib.c`  | `kernel/sysproc.c`（真正实现） |
| 执行权限     | 用户态 U-Mode     | 内核态 S-Mode               |
| 跳转方式     | 普通函数跳转（JAL 指令） | 硬件陷阱（`ecall` 指令）         |
| 是否跨越权限边界 | 否，全程用户态        | 是，强制切换到内核态               |
| 执行内容     | 纯逻辑计算（字符串转数字）  | 操作底层时钟硬件、切换进程状态          |

> [!TIP]
> `sleep.c` 里的 `sleep(tick)` 和 `atoi(argv[1])` 调用语法相同，但一个永远不离开用户态，另一个必须跨越权限边界才能完成工作。

---

## 2. 轨迹 A：atoi 是如何被调用的？

### 2.1 它是怎么"找到"的——静态链接

`atoi` 的实现写在 `user/ulib.c` 中，它是一段纯粹的逻辑代码，**与操作系统内核毫无关联**。`sleep.c` 能调用它，靠的是**编译与链接**这两个阶段的配合。

**第一步：编译阶段打"空头支票"**

编译器在编译 `sleep.c` 时，看到 `user/user.h` 里有这样一行声明：

```c
int atoi(const char*);
```

编译器对自己说："程序员保证有这个函数，我先放行，留个占位符，链接器最后来填地址。"于是生成了 `sleep.o`，其中 `atoi` 的地址暂时空着。

**第二步：链接阶段"兑现支票"**

当你运行 `make qemu` 时，`Makefile` 会调用链接器 `ld`，执行类似如下的命令：

```bash
riscv64-unknown-elf-ld -o user/_sleep \
    user/sleep.o \
    user/ulib.o \    ← atoi 的真身在这里
    user/usys.o \
    user/printf.o \
    user/umalloc.o
```

链接器在 `ulib.o` 的符号表里找到了 `atoi` 的真实地址，把 `sleep.o` 里的占位符替换掉。此后，`atoi` 的机器码就被**物理拼入**了 `_sleep` 可执行文件中。

**第三步：运行时，就像调用自己写的函数**

程序执行 `atoi(argv[1])` 时，CPU 只是发出一条普通的跳转指令（JAL），跳到内存中 `atoi` 代码所在的位置，计算完结果后跳回来。全程在用户态完成，没有任何权限切换。

### 2.2 小结

`atoi` 早在 `make qemu` 的那一刻，就被链接器缝合进了 `_sleep` 的二进制文件里。调用它和调用你自己写的一个普通函数没有区别。

---

## 3. 轨迹 B：sleep 是如何被调用的？

`sleep` 的情况复杂得多。`sleep.c` 绝对不可能在编译时把 `kernel/sysproc.c` 缝合进来——那是内核代码，运行在不同的权限层。

### 3.1 第一层：user/user.h 里的"欺骗性声明"

`user/user.h` 里有一行：

```c
int sleep(int);
```

你在 `sleep.c` 里写下 `sleep(tick)` 时，你以为自己在直接调用内核的 `sys_sleep`。实际上，链接器帮你绑定的是一个**汇编跳板（Stub）**，它在 `user/usys.S` 里。

### 3.2 第二层：user/usys.S —— 汇编跳板的真身

打开 `user/usys.S`，可以看到 `sleep` 的汇编实现：

```asm
.global sleep
sleep:
    li a7, SYS_sleep   # 把 sleep 的系统调用编号写入 a7 寄存器
    ecall              # 触发 CPU 硬件陷阱，瞬间跳入内核
    ret                # 内核执行完后，回到这里，返回给 C 代码
```

只有三行，但每一行都不可替代。

> [!TIP] **为什么必须用汇编写？不能用 C 吗？**
> 
> C 语言是一门通用的抽象语言，它的目的是"在任何机器上都能跑"，因此它的语法里根本没有"陷入内核"这个词。具体来说有三个原因：
> 
> 1. **语法树里没这个词**：C 语言标准里没有 `traps_into_kernel()` 这样的语句，GCC 不知道该把它翻译成什么机器码。
> 2. **寄存器必须被精确控制**：内核规定，执行 `ecall` 之前，系统调用编号必须放进 `a7` 寄存器。C 语言的变量可能被编译器放进任意寄存器，无法保证。汇编指令 `li a7, SYS_sleep` 是物理级别的强制锁定。
> 3. **不能引入多余的栈帧开销**：C 函数调用会自动创建栈帧，这些多余的开销可能干扰内核对寄存器的保存逻辑。汇编代码"裸奔"，只完成最关键的那一跳。

### 3.3 第三层：ecall —— 跨越权限边界的那一刻

`ecall` 是整个系统调用机制的核心。这条指令一旦执行：

- CPU 的特权级从 **U-Mode（用户态）** 瞬间提升到 **S-Mode（内核态）**
- 程序的执行流被强制中断，跳入内核预设的陷阱入口（地址存储在 `stvec` 硬件寄存器中）
- 内核开始接管 CPU 控制权

### 3.4 第四层：kernel/syscall.c —— 内核的路由分发器

内核被唤醒后，首先进入 `kernel/trap.c`，保存用户程序的寄存器现场，然后来到 `kernel/syscall.c` 进行路由：

```c
// kernel/syscall.c 简化逻辑
void syscall(void) {
    int num = p->trapframe->a7;  // 读取 a7 寄存器里的系统调用编号
    p->trapframe->a0 = syscalls[num]();  // 查表，调用对应的内核函数
}
```

它读取 `a7` 寄存器，发现值是 `SYS_sleep`（例如编号 13），于是通过函数指针表，把执行流分发给 `sys_sleep`。

### 3.5 第五层：kernel/sysproc.c —— 真正的内核实现

```c
// kernel/sysproc.c
uint64 sys_sleep(void) {
    int n;
    argint(0, &n);         // 从寄存器读取参数 tick
    // 操作底层时钟，将当前进程标记为 SLEEPING 状态
    // 记录唤醒时间，让出 CPU 给其他进程
    // ...
}
```

`sys_sleep` 拥有最高权限，可以直接操作硬件时钟、修改进程控制块（PCB）、调度其他进程。这些都是 `sleep.c` 这个"平民程序"永远做不到的。

### 3.6 返回：原路遣返

时间到了，时钟中断唤醒该进程。内核执行 `sret` 指令（Supervisor Return）：

- CPU 特权级从 S-Mode 降回 U-Mode
- 执行流回到 `usys.S` 中 `ecall` 的下一行（`ret`）
- `ret` 将控制权交还给 `sleep.c` 中 `sleep(tick)` 的下一行

你的程序醒来，继续执行 `exit(0)`，仿佛什么都没发生过。

---

## 4. 为什么链接器能找到 ulib.o 和 usys.o？

链接器本身是一个"笨"工具——它不会自动扫描代码库，只在你明确传给它的文件里查找符号。它能同时找到 `atoi`（在 `ulib.o` 里）和 `sleep` 的汇编跳板（在 `usys.o` 里），原因完全相同：**`Makefile` 把它们都硬塞进去了**。

打开 xv6 的 `Makefile`，可以找到：

```makefile
ULIB = $U/ulib.o $U/usys.o $U/printf.o $U/umalloc.o

_%: %.o $(ULIB)
    $(LD) $(LDFLAGS) -o $@ $^
```

`ULIB` 变量把这四个 `.o` 文件打包在一起，构建规则规定：**任何一个用户态程序在链接时，都必须把自身的 `.o` 加上整个 `$(ULIB)` 一起传给链接器**。因此，链接 `_sleep` 时实际执行的命令是：

```bash
riscv64-unknown-elf-ld -o user/_sleep \
    user/sleep.o \
    user/ulib.o \    ← atoi 在这里，Makefile 塞进来的
    user/usys.o \    ← sleep 汇编跳板在这里，Makefile 塞进来的
    user/printf.o \
    user/umalloc.o
```

`atoi` 和 `sleep` 跳板的查找机制是完全对称的，没有任何区别。两者都不是链接器"自动发现"的，而是 MIT 教授在编写构建脚本时就写死了：所有用户程序，无一例外，都要带上这四个"陪嫁"文件。

如果你分别把它们从 `ULIB` 里删掉，会得到对称的报错：

```
# 删掉 ulib.o 后
undefined reference to 'atoi'

# 删掉 usys.o 后
undefined reference to 'sleep'
```

两个错误的根源和解法完全一致。

---

## 5. 完整调用链：从 sleep.c 到 sys_sleep 的六棒接力

把以上所有内容串联起来，`sleep(tick)` 这一行代码的完整执行路径如下：

```
user/sleep.c
    │  执行到 sleep(tick)，通过链接器缝合的地址跳转
    ▼
user/usys.S  [sleep 标签]
    │  li a7, SYS_sleep  ← 写入系统调用编号
    │  ecall             ← 触发硬件陷阱
    ▼
RISC-V 硬件（CPU）
    │  特权级从 U-Mode 提升到 S-Mode
    │  跳入 stvec 寄存器指向的内核入口
    ▼
kernel/trap.c  [usertrap()]
    │  保存用户寄存器现场（trapframe）
    │  识别这是系统调用类型的陷阱
    ▼
kernel/syscall.c  [syscall()]
    │  读取 a7 = SYS_sleep
    │  查函数指针表，路由到 sys_sleep
    ▼
kernel/sysproc.c  [sys_sleep()]
    │  读取参数 tick
    │  操作底层时钟，将进程标记为 SLEEPING
    │  让出 CPU，等待时钟中断唤醒
    ▼
（时间到，时钟中断唤醒进程）
    │  sret 指令：S-Mode 降回 U-Mode
    ▼
user/usys.S  [ret]
    │  返回给 C 调用者
    ▼
user/sleep.c  继续执行 exit(0)
```

---

## 附录：相关文件一览

| 文件                 | 角色                     | 运行权限              |
| ------------------ | ---------------------- | ----------------- |
| `user/sleep.c`     | 用户程序入口，发起调用            | 用户态               |
| `user/user.h`      | 函数声明，告诉编译器"有这个函数"      | —                 |
| `user/ulib.c`      | `atoi` 等库函数的实现         | 用户态               |
| `user/usys.S`      | 所有系统调用的汇编跳板            | 用户态（触发 ecall 后切换） |
| `kernel/trap.c`    | 陷阱入口，保存现场              | 内核态               |
| `kernel/syscall.c` | 系统调用路由分发器              | 内核态               |
| `kernel/sysproc.c` | `sys_sleep` 等系统调用的真正实现 | 内核态               |
