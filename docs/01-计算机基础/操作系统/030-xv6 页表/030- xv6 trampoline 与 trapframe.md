# xv6 trampoline 与 trapframe

## 一、概念

**trampoline**：一段**代码**（汇编，在 `kernel/trampoline.S` 中），负责用户态和内核态之间的切换（切换页表、跳转）。所有进程共享同一个物理页。

- **进入内核时（uservec）**：把所有寄存器保存到 trapframe，从 trapframe 取出内核栈指针和内核页表地址，切换 satp 到内核页表，刷新 TLB，跳转到 `usertrap()`。
- **返回用户时（userret）**：切换 satp 到用户页表，刷新 TLB，从 trapframe 恢复所有寄存器，执行 `sret` 回到用户态。

> [!TIP]
> **核心就是在页表切换的瞬间充当"跳板"**——因为它在两张页表里都映射到同一个虚拟地址，所以切换前后代码执行不会断裂。

**trapframe**：一块**数据**（结构体），负责保存和恢复进程的寄存器状态。**每个进程各自一份**，由 `kalloc()` 独立分配。

## 二、在虚拟地址空间中的位置

trampoline 和 trapframe 在虚拟地址空间的最顶端紧挨着（注意只是虚拟地址紧挨，物理上可能相距很远）：

```
MAXVA →        ┌──────────────┐
               │  trampoline  │  TRAMPOLINE = MAXVA - PGSIZE（最后一个合法页起始地址）
               ├──────────────┤
               │  trapframe   │  TRAPFRAME = TRAMPOLINE - PGSIZE
               ├──────────────┤
               │     ...      │
```

相关宏定义：

```c
#define TRAMPOLINE (MAXVA - PGSIZE)
#define TRAPFRAME  (TRAMPOLINE - PGSIZE)
```

## 三、映射关系

### trampoline 的映射

trampoline 在**两张页表**中都有映射，且映射到**同一个虚拟地址**：

内核页表中（`kvminit`）：`kvmmap(TRAMPOLINE, (uint64)trampoline, PGSIZE, PTE_R | PTE_X)`

用户页表中（`proc_pagetable`）：`mappages(pagetable, TRAMPOLINE, PGSIZE, (uint64)trampoline, PTE_R | PTE_X)`

两者都指向同一个物理页（内核代码段中 trampoline 代码的位置）。

> [!TIP]
> trampoline 代码是内核二进制的一部分，在编译链接时就确定了位置，加载到物理内存后就固定在那里，整个系统运行期间不会变。
>
> `kernel/trampoline.S` 编译后被链接进内核镜像，启动时内核被加载到从 `0x80000000` 开始的物理内存中，trampoline 代码就在其中某个固定偏移处。`(uint64)trampoline` 这个符号的值就是它在物理内存中的地址，由链接器决定，运行时不变。

**为什么要在两张页表中都映射？** 因为 trampoline 代码执行时正在切换页表（`csrw satp`），切换前后 PC 指向的虚拟地址必须在两张页表中都有效，否则执行会断裂。

> [!TIP]  切换瞬间发生的事
> 
>   csrw satp, t1    ← 执行这条指令，satp 从用户页表变成内核页表
> 
>   PC 自动 +4，指向下一条指令
>   PC = 0x3ffffff084（还在 TRAMPOLINE 页内）
> 
>   CPU 用新的内核页表翻译这个地址：
>     用户页表：0x3ffffff084 → 物理地址 0x80007084
>     内核页表：0x3ffffff084 → 物理地址 0x80007084  ← 结果一样
> 
>   如果内核页表里没有 TRAMPOLINE 的映射，csrw satp 之后 CPU 取下一条指令时就 page fault，系统崩溃。

### trapframe 的映射

trapframe **只映射在用户页表**中（`proc_pagetable`）：

```c
mappages(pagetable, TRAPFRAME, PGSIZE, (uint64)(p->trapframe), PTE_R | PTE_W)
```

**内核页表中不需要映射 trapframe**，因为内核是恒等映射，内核代码通过 `p->trapframe`直接访问。

假设在 `allocproc` 中（后附 `allocproc`的代码，这个方法用于从进程表里找一个空位，初始化一个新进程 ）， `kalloc()` 给 trapframe 分配的物理地址是 `0x87f50000`：

**内核页表**里，`kvminit` 做了这条映射：

```c
kvmmap((uint64)etext, (uint64)etext, PHYSTOP-(uint64)etext, PTE_R | PTE_W);
```

这把从 `etext` 到 `PHYSTOP` 的**整个物理内存区域**都映射了，虚拟地址等于物理地址。`0x87f50000` 在这个范围内，所以虚拟地址 `0x87f50000` 已经自动映射到物理地址 `0x87f50000`。内核代码用 `p->trapframe`（值为 `0x87f50000`）直接访问，硬件翻译后还是 `0x87f50000`，能正常读写。

```
0x3ffffff000 ─────── TRAMPOLINE（远超物理内存范围，必须显式映射）
    ...
    （中间大片没有映射）
    ...
PHYSTOP ──────────── 恒等映射到此为止
    空闲物理内存
    内核代码、数据
    UART, VIRTIO...
0x0 ─────────────── 恒等映射覆盖的范围（物理内存）
```

**用户页表**里，没有这种恒等映射。

#### 两种访问方式

```
用户页表下：trampoline 代码用虚拟地址 TRAPFRAME 访问
                       ↓
                  映射到物理地址（如 0x87f50000）

内核页表下：内核代码用 p->trapframe（如 0x87f50000）访问
                       ↓
                  恒等映射到同一物理地址
```

两条路径，同一个物理页，不同的访问方式。

## 四、trapframe 结构体

定义在 `kernel/proc.h` 中：

```c
struct trapframe {
  uint64 kernel_satp;    // 内核页表地址
  uint64 kernel_sp;      // 内核栈指针
  uint64 kernel_trap;    // usertrap() 的地址
  uint64 kernel_hartid;  // CPU 编号
  uint64 ra;             // 以下为 32 个通用寄存器
  uint64 sp;
  uint64 gp;
  uint64 tp;
  uint64 t0;
  uint64 t1;
  // ... 所有 32 个寄存器
};
```

每个进程在 `allocproc` 中分配：

```c
p->trapframe = (struct trapframe *)kalloc();
```

## 五、trampoline 代码的工作流程

### 用户态 → 内核态（uservec）

1. 此时 `satp` 是用户页表
2. 把所有 32 个寄存器保存到 trapframe（通过虚拟地址 TRAPFRAME 访问）
3. **从 trapframe 中取出内核栈指针，写入 `sp` 寄存器**。取出来之后，后续跳转到 `usertrap()` 执行 C 代码时，函数调用的局部变量、返回地址等都会压到这个内核栈上。这一步本质是：**在跳入内核 C 代码之前，把栈切换到内核栈**，保证内核函数调用有地方放数据。
4. 从 trapframe 中取出内核页表地址等
5. `csrw satp` 切换到内核页表
6. `sfence.vma` 刷新 TLB
7. 跳转到 `usertrap()`

```
.globl uservec
uservec:
    # 保存寄存器到 trapframe
    # 切换页表
    # 跳转到 usertrap()
    ...
```

我们知道，进程的 trapframe 在 alloc_proc中被分配（参考[allocproc — 进程的骨架](../040-xv6%20进程创建/010-xv6%20进程创建流程.md#二、allocproc%20—%20进程的骨架)），在进程用户态、内核态切换时起到了关键作用（保存用户态的寄存器，参考[trap 触发：A 用户态 → A 内核态](../040-xv6%20进程创建/020-xv6%20进程切换.md#5.1%20trap%20触发：A%20用户态%20→%20A%20内核态)）。

那么 trapframe 中的内核栈指针，内核页表地址是什么时候写入的呢？

是在进程从内核态返回用户态的时候被写入的，具体参考 [B 内核态 → B 用户态](../040-xv6%20进程创建/020-xv6%20进程切换.md#5.5%20B%20内核态%20→%20B%20用户态)。

### 内核态 → 用户态（userret）

1. `csrw satp` 切换到用户页表
2. `sfence.vma` 刷新 TLB
3. 从 trapframe 恢复所有 32 个寄存器
4. `sret` 返回用户态

```
.globl userret
userret:
    # 切换页表
    # 从 trapframe 恢复寄存器
    # sret 返回用户态
    ...
```

## 六、映射的建立与释放

### 用户态建立：在 `proc_pagetable` 中

```c
// Create a user page table for a given process,
// with no user memory, but with trampoline pages.
pagetable_t proc_pagetable(struct proc *p){
  pagetable_t pagetable;

  // An empty page table.
  pagetable = uvmcreate();
  if(pagetable == 0)
    return 0;

  // map the trampoline code (for system call return)
  // at the highest user virtual address.
  // only the supervisor uses it, on the way
  // to/from user space, so not PTE_U.
  if(mappages(pagetable, TRAMPOLINE, PGSIZE,
              (uint64)trampoline, PTE_R | PTE_X) < 0){
    uvmfree(pagetable, 0);
    return 0;
  }

  // map the trapframe just below TRAMPOLINE, for trampoline.S.
  if(mappages(pagetable, TRAPFRAME, PGSIZE,
              (uint64)(p->trapframe), PTE_R | PTE_W) < 0){
    uvmunmap(pagetable, TRAMPOLINE, 1, 0);
    uvmfree(pagetable, 0);
    return 0;
  }

  return pagetable;
}
```


> [!TIP]
> 这个方法在 `allocproc` 中被调用。

#### `allocproc` 完整代码

`allocproc` 是从进程表里找一个空位，初始化一个新进程。它做这些事：找空闲 slot、分配 PID、分配 trapframe、创建用户页表、初始化内核上下文。

这个方法在两个地方被调用：
1. **`userinit()`** — 启动时创建第一个进程（init），只调用一次
2. **`fork()`** — 之后每次创建子进程都调用

```c
// Look in the process table for an UNUSED proc.
// If found, initialize state required to run in the kernel,
// and return with p->lock held.
// If there are no free procs, or a memory allocation fails, return 0.
static struct proc* allocproc(void){
  struct proc *p;

  for(p = proc; p < &proc[NPROC]; p++) {
    acquire(&p->lock);
    if(p->state == UNUSED) {
      goto found;
    } else {
      release(&p->lock);
    }
  }
  return 0;

found:
  p->pid = allocpid();

  // Allocate a trapframe page.
  // trapframe 是一个结构体，用来保存进程从用户态进入内核态时所有寄存器的值
  if((p->trapframe = (struct trapframe *)kalloc()) == 0){
    release(&p->lock);
    return 0;
  }

  // An empty user page table.
  p->pagetable = proc_pagetable(p);
  if(p->pagetable == 0){
    freeproc(p);
    release(&p->lock);
    return 0;
  }

  // Set up new context to start executing at forkret,
  // which returns to user space.
  memset(&p->context, 0, sizeof(p->context));
  p->context.ra = (uint64)forkret;
  p->context.sp = p->kstack + PGSIZE;

  return p;
}
```

### 内核态建立：在 kvminit 中

```c
/*
 * create a direct-map page table for the kernel.
 */
void kvminit(){
  kernel_pagetable = (pagetable_t) kalloc(); // 分配一页内存
  memset(kernel_pagetable, 0, PGSIZE);

  // uart registers
  kvmmap(UART0, UART0, PGSIZE, PTE_R | PTE_W);

  // virtio mmio disk interface
  kvmmap(VIRTIO0, VIRTIO0, PGSIZE, PTE_R | PTE_W);

  // CLINT
  kvmmap(CLINT, CLINT, 0x10000, PTE_R | PTE_W);

  // PLIC
  kvmmap(PLIC, PLIC, 0x400000, PTE_R | PTE_W);

  // map kernel text executable and read-only.
  kvmmap(KERNBASE, KERNBASE, (uint64)etext-KERNBASE, PTE_R | PTE_X);

  // map kernel data and the physical RAM we'll make use of.
  kvmmap((uint64)etext, (uint64)etext, PHYSTOP-(uint64)etext, PTE_R | PTE_W);

  // map the trampoline for trap entry/exit to
  // the highest virtual address in the kernel.
  kvmmap(TRAMPOLINE, (uint64)trampoline, PGSIZE, PTE_R | PTE_X);
}
```

### 释放（进程退出时）

释放由 `freeproc` 发起，它先释放 trapframe 物理页，再调用 `proc_freepagetable` 清理用户页表：
#### `freeproc`

```c
static void freeproc(struct proc *p){
  if(p->trapframe)
    kfree((void*)p->trapframe);   // 1. 先释放 trapframe 的物理页
  p->trapframe = 0;
  if(p->pagetable)
    proc_freepagetable(p->pagetable, p->sz); // 2. 再清理用户页表
  p->pagetable = 0;
  p->sz = 0;
  p->pid = 0;
  p->parent = 0;
  p->name[0] = 0;
  p->chan = 0;
  p->killed = 0;
  p->xstate = 0;
  p->state = UNUSED;
}
```

#### `proc_freepagetable`

```c
void
proc_freepagetable(pagetable_t pagetable, uint64 sz)
{
  uvmunmap(pagetable, TRAMPOLINE, 1, 0); // 清 PTE，不释放物理页（所有进程共享）
  uvmunmap(pagetable, TRAPFRAME, 1, 0);  // 清 PTE，不释放物理页（已在 freeproc 中 kfree）
  uvmfree(pagetable, sz);                // 释放 0~sz 范围的用户数据页 + 页表页本身
}
```

#### 释放顺序总结

```
freeproc
  ├── kfree(p->trapframe)              释放 trapframe 物理页
  └── proc_freepagetable
        ├── uvmunmap TRAMPOLINE, 0      清 PTE，不释放物理页（共享的）
        ├── uvmunmap TRAPFRAME,  0      清 PTE，不释放物理页（已释放）
        └── uvmfree(pagetable, sz)
              ├── uvmunmap 0~sz, 1      清 PTE，释放用户数据的物理页
              └── freewalk             释放所有页表页本身
```

**为什么 trapframe 要在 `freeproc` 里单独 `kfree`，而不是在 `proc_freepagetable` 里随 `uvmunmap` 一起释放？**

因为 `uvmfree` 只释放 0 到 `p->sz` 范围内的用户数据页。`p->sz` 是进程实际使用的用户内存大小（代码 + 数据 + 堆 + 栈），对于一个简单程序可能只有几个页（如 `0x4000` = 16KB），而 TRAPFRAME 在 `0x3ffffe000`，远不在这个范围内。

```
0x3ffffff000  ┌──────────────┐
              │  TRAMPOLINE  │
0x3ffffe000   ├──────────────┤
              │  TRAPFRAME   │   ← uvmfree 根本不会遍历到这里
              ├──────────────┤
              │              │
              │  巨大的空洞   │
              │              │
p->sz -----   ├──────────────┤
              │  stack       │
              │  heap/data   │   ← uvmfree 只释放这个范围
              │  text(代码)   │
0x0           └──────────────┘
```

`p->sz` 在以下位置被赋值：

- **`userinit()`**：`p->sz = PGSIZE`，第一个进程的 initcode 只有一页
- **`growproc()`**：`sbrk` 系统调用的底层，用户程序申请/释放内存时动态调整 `p->sz`
- **`fork()`**：`np->sz = p->sz`，子进程继承父进程的大小

所以 `uvmfree` 不会碰 TRAPFRAME，而 `uvmunmap(pagetable, TRAPFRAME, 1, 0)` 最后一个参数是 0，只清 PTE，不释放物理页。必须在 `freeproc` 里单独 `kfree(p->trapframe)` 把这页物理内存还给分配器。

如果不单独释放，这页物理内存就泄漏了——PTE 清掉了，`p->trapframe` 也会被清零，再也没有人知道这页内存的地址，永远回收不了。


