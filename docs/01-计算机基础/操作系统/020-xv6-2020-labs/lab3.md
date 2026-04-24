# lab3

## Print a page table（简单）

为了帮助你学习 RISC-V 页表，也为了方便后续调试，你的第一个任务是编写一个打印页表内容的函数。

定义一个名为 `vmprint()` 的函数。它接受一个 `pagetable_t` 参数，按照下面描述的格式打印该页表。在 `exec.c` 中 `return argc` 之前插入 `if(p->pid==1) vmprint(p->pagetable)`，以打印第一个进程的页表。如果你通过了 `make grade` 的 pte printout 测试，就能获得这个作业的满分。

现在当你启动 xv6 时，它应该输出如下内容，描述的是第一个进程刚执行完 `exec()` init 时的页表：

```
page table 0x0000000087f6e000
..0: pte 0x0000000021fda801 pa 0x0000000087f6a000
.. ..0: pte 0x0000000021fda401 pa 0x0000000087f69000
.. .. ..0: pte 0x0000000021fdac1f pa 0x0000000087f6b000
.. .. ..1: pte 0x0000000021fda00f pa 0x0000000087f68000
.. .. ..2: pte 0x0000000021fd9c1f pa 0x0000000087f67000
..255: pte 0x0000000021fdb401 pa 0x0000000087f6d000
.. ..511: pte 0x0000000021fdb001 pa 0x0000000087f6c000
.. .. ..510: pte 0x0000000021fdd807 pa 0x0000000087f76000
.. .. ..511: pte 0x0000000020001c0b pa 0x0000000080007000
```

第一行显示传给 `vmprint` 的参数。之后每个 PTE 一行，包括指向更深层页表页的 PTE。每行 PTE 的缩进用 `" .."` 来表示它在树中的深度。每行显示 PTE 在其所在页表页中的索引、PTE 的位信息，以及从 PTE 中提取出的物理地址。不要打印无效的 PTE。在上面的例子中，顶层页表页有第 0 项和第 255 项的映射。第 0 项的下一层只映射了索引 0，该索引 0 的最底层映射了第 0、1、2 项。

你的代码输出的物理地址可能与上面不同。条目数量和虚拟地址应该相同。

**一些提示：**

- 你可以把 `vmprint()` 放在 `kernel/vm.c` 中。
- 使用 `kernel/riscv.h` 文件末尾的宏。
- `freewalk` 函数可能会给你启发。
- 在 `kernel/defs.h` 中定义 `vmprint` 的原型，这样你才能从 `exec.c` 中调用它。
- 在 `printf` 调用中使用 `%p` 来打印完整的 64 位十六进制 PTE 和地址，如示例所示。

**思考题：** 用教材图 3-4 来解释 `vmprint` 的输出。第 0 页包含什么？第 2 页包含什么？在用户模式下运行时，进程能否读/写第 1 页映射的内存？

### 题解

共需修改三个文件：

**1. `kernel/defs.h`** —— 添加 `vmprint` 的函数声明：

```c
// vm.c
...
int             copyinstr(pagetable_t, char *, uint64, uint64);
void            vmprint(pagetable_t);
```

**2. `kernel/exec.c`** —— 在 `exec()` 函数的 `return argc` 之前，为 pid==1 的进程打印页表：

```c
  proc_freepagetable(oldpagetable, oldsz);

  if(p->pid==1) 
    vmprint(p->pagetable);

  return argc; // this ends up in a0, the first argument to main(argc, argv)
```

**3. `kernel/vm.c`** —— 在文件末尾添加 `vmprint` 及其递归辅助函数：

```c
void vmprint_helper(pagetable_t pagetable, int level)
{
  for (int i = 0; i < 512; i++)
  {
    pte_t pte = pagetable[i];
    if (pte & PTE_V)
    {
      for (int j = 1; j <= level; j++)
      {
        printf(".. ");
      }
      printf("..%d: pte %p pa %p\n", i, pte, PTE2PA(pte));
      // 如果非叶子节点，继续往下走
      if ((pte & (PTE_R | PTE_W | PTE_X)) == 0)
      {
        vmprint_helper((pagetable_t)PTE2PA(pte), level + 1);
      }
    }
  }
}

void vmprint(pagetable_t pagetable)
{
  printf("page table %p\n", pagetable);
  // there are 2^9 = 512 PTEs in a page table.
  vmprint_helper(pagetable, 0);
}
```

**思路说明：**

- RISC-V 的 Sv39 方案使用三级页表，每级页表有 512 个 PTE（页表项）
- `vmprint_helper` 递归遍历页表树：对每个有效的 PTE（`PTE_V` 位为 1），打印其索引、PTE 值和对应的物理地址
- 通过检查 `PTE_R | PTE_W | PTE_X` 是否全为 0 来判断是否为非叶子节点——非叶子节点指向下一级页表，需要继续递归
- `level` 参数控制缩进，用 `".. "` 前缀表示当前节点在页表树中的深度
- 该实现参考了 `freewalk` 函数的遍历方式


## A kernel page table per process（困难）

xv6 有一个全局内核页表，每当在内核态执行时都使用它。这个内核页表是物理地址的恒等映射，即内核虚拟地址 x 映射到物理地址 x。xv6 还为每个进程的用户地址空间维护一个单独的页表，只包含该进程用户内存的映射，从虚拟地址 0 开始。因为内核页表不包含这些用户映射，所以用户地址在内核中是无效的。因此，当内核需要使用系统调用传入的用户指针时（例如传给 `write()` 的缓冲区指针），内核必须先将该指针翻译为物理地址。本节和下一节的目标是让内核能够直接解引用用户指针。

你的第一个任务是修改内核，使每个进程在内核态执行时使用自己的内核页表副本。修改 `struct proc`，为每个进程维护一个内核页表，并修改调度器在切换进程时同时切换内核页表。在这一步中，每个进程的内核页表应与现有的全局内核页表完全相同。如果 `usertests` 能正确运行，就算通过这部分实验。

请阅读本作业开头提到的教材章节和代码；理解虚拟内存的工作原理后，修改代码会更容易正确。页表设置中的 bug 可能导致因缺少映射而触发 trap，可能导致读写操作影响到意料之外的物理内存页，也可能导致从错误的内存页执行指令。

**一些提示：**

- 在 `struct proc` 中添加一个字段，存放进程的内核页表。
- 为新进程生成内核页表的一个合理方式是：实现一个 `kvminit` 的修改版本，创建一个新页表而不是修改全局 `kernel_pagetable`。你需要在 `allocproc` 中调用这个函数。
- 确保每个进程的内核页表包含该进程内核栈的映射。在未修改的 xv6 中，所有内核栈都在 `procinit` 中设置。你需要将部分或全部这个功能移到 `allocproc` 中。
- 修改 `scheduler()`，将进程的内核页表加载到 CPU 的 `satp` 寄存器中（参考 `kvminithart` 的写法）。切记在调用 `w_satp()` 之后调用 `sfence_vma()`。
- 当没有进程在运行时，`scheduler()` 应使用全局 `kernel_pagetable`。
- 在 `freeproc` 中释放进程的内核页表。
- 你需要一种方法来释放页表本身，但不释放叶子层指向的物理内存页。
- `vmprint` 可能有助于调试页表。
- 可以修改 xv6 现有函数或添加新函数；你可能至少需要修改 `kernel/vm.c` 和 `kernel/proc.c`。（但不要修改 `kernel/vmcopyin.c`、`kernel/stats.c`、`user/usertests.c` 和 `user/stats.c`。）
- 缺少页表映射很可能导致内核遇到 page fault。内核会打印包含 `sepc=0x00000000XXXXXXXX` 的错误信息。你可以在 `kernel/kernel.asm` 中搜索 `XXXXXXXX` 来定位故障发生的位置。

### 题解

**整体思路：** 让每个进程拥有自己的内核页表（内容与全局内核页表相同），并把该进程的内核栈也映射进去。调度器切换进程时，同时切换 `satp` 到该进程的内核页表。

需要修改的文件：`kernel/proc.h`、`kernel/proc.c`、`kernel/vm.c`、`kernel/defs.h`。

---

**1. `kernel/proc.h` —— 给 `struct proc` 加 `kpgtbl` 字段**

```c
struct proc {
  // ...
  pagetable_t pagetable;       // User page table
  pagetable_t kpgtbl;          // 每个进程的内核页表副本
  // ...
};
```

---

**2. `kernel/proc.c` —— 实现 `proc_kernel_pagetable`**

仿照 `kvminit` 建立内核映射，但不包含 CLINT（CLINT 只在机器模式的 `timerinit` 中使用，进程在 S-mode 下永远不会访问它）。同时在这里分配该进程的内核栈，映射到固定位置 `TRAMPOLINE - 2 * PGSIZE`：

```c
pagetable_t proc_kernel_pagetable(struct proc *p){
  pagetable_t pagetable = uvmcreate();
  if(pagetable == 0)
    return 0;

  mappages(pagetable, UART0,    PGSIZE,               UART0,    PTE_R | PTE_W);
  mappages(pagetable, VIRTIO0,  PGSIZE,               VIRTIO0,  PTE_R | PTE_W);
  // CLINT 不映射：只在 M-mode 下使用，进程内核态不需要
  mappages(pagetable, PLIC,     0x400000,             PLIC,     PTE_R | PTE_W);
  mappages(pagetable, KERNBASE, (uint64)etext-KERNBASE, KERNBASE, PTE_R | PTE_X);
  mappages(pagetable, (uint64)etext, PHYSTOP-(uint64)etext, (uint64)etext, PTE_R | PTE_W);
  mappages(pagetable, TRAMPOLINE, PGSIZE,             (uint64)trampoline, PTE_R | PTE_X);

  // 分配内核栈并映射
  char *pa = kalloc();
  if(pa == 0)
    panic("kalloc");
  uint64 va = TRAMPOLINE - 2 * PGSIZE;
  mappages(pagetable, va, PGSIZE, (uint64)pa, PTE_R | PTE_W);
  p->kstack = va;

  return pagetable;
}
```

> [!TIP]
> 原版 xv6 在 `procinit` 中为所有进程预分配内核栈并映射到全局内核页表。改为每进程内核页表后，内核栈的分配和映射需要移到 `proc_kernel_pagetable` 里，`procinit` 中对应的代码需要注释掉。

---

**3. `kernel/proc.c` —— 修改 `allocproc`，调用 `proc_kernel_pagetable`**

在创建用户页表之后，调用 `proc_kernel_pagetable` 为新进程创建内核页表：

```c
p->kpgtbl = proc_kernel_pagetable(p);
if(p->kpgtbl == 0){
  freeproc(p);
  release(&p->lock);
  return 0;
}
```

---

**4. `kernel/proc.c` —— 修改 `freeproc`，释放 `kpgtbl`**

进程退出时，先释放内核栈的物理页，再释放内核页表的页表页本身（注意不能释放内核页表叶子映射的物理内存，那些是内核共享的）：

```c
if(p->kpgtbl){
  if(p->kstack){
    uvmunmap(p->kpgtbl, p->kstack, 1, 1); // do_free=1，释放内核栈物理页
    p->kstack = 0;
  }
  proc_free_kernel_pagetable(p->kpgtbl);
}
```

---

**5. `kernel/proc.c` —— 实现 `proc_free_kernel_pagetable`**

递归释放页表页，但跳过叶子 PTE（不释放叶子指向的物理页，因为那些是内核共享资源）：

```c
void proc_free_kernel_pagetable(pagetable_t pagetable){
  for(int i = 0; i < 512; i++){
    pte_t pte = pagetable[i];
    if((pte & PTE_V) && (pte & (PTE_R|PTE_W|PTE_X)) == 0){
      // 非叶子：递归释放子页表页
      uint64 child = PTE2PA(pte);
      proc_free_kernel_pagetable((pagetable_t)child);
      pagetable[i] = 0;
    }
    // 叶子 PTE：只清零，不 kfree（内核物理页不属于此进程）
  }
  kfree((void*)pagetable); // 释放当前页表页本身
}
```

> [!TIP]
> 这与 `freewalk` 的区别在于：`freewalk` 遇到有效叶子 PTE 会 panic（因为用户页表的叶子都应该被 `uvmunmap` 提前清掉）。而内核页表的叶子映射的是共享的内核物理内存，不能释放也不需要提前清掉，所以跳过即可。

---

**6. `kernel/proc.c` —— 修改 `scheduler`，切换到进程的内核页表**

在 `swtch` 切换到进程前，将 `satp` 切换到进程的内核页表；进程让出 CPU 后，切回全局内核页表：

```c
p->state = RUNNING;
c->proc = p;

w_satp(MAKE_SATP(p->kpgtbl)); // 切换到进程的内核页表
sfence_vma();

swtch(&c->context, &p->context);

kvminithart(); // 切回全局内核页表（w_satp(kernel_pagetable) + sfence_vma）
```

---

**7. `kernel/vm.c` —— 修改 `kvmpa`**

原版 `kvmpa` 用全局 `kernel_pagetable` 查地址，现在改用当前进程的 `kpgtbl`：

```c
pte = walk(myproc()->kpgtbl, va, 0);
```

---

**8. `kernel/proc.c` —— 注释掉 `procinit` 中的内核栈分配**

内核栈的分配已经移到 `proc_kernel_pagetable` 中，`procinit` 中对应代码注释掉：

```c
void procinit(void){
  // ...
  for(p = proc; p < &proc[NPROC]; p++){
    initlock(&p->lock, "proc");
    // 以下代码注释掉，内核栈改在 proc_kernel_pagetable 中分配
    // char *pa = kalloc();
    // if(pa == 0) panic("kalloc");
    // uint64 va = KSTACK((int)(p - proc));
    // kvmmap(va, (uint64)pa, PGSIZE, PTE_R | PTE_W);
    // p->kstack = va;
  }
  // kvminithart(); // 也注释掉，启动流程在 main.c 中已调用
}
```



## Simplify copyin/copyinstr（困难）

内核的 `copyin` 函数读取用户指针所指向的内存。它通过将用户指针翻译成物理地址来实现这一点，而内核可以直接解引用物理地址。它通过在软件中遍历进程页表来完成这个翻译过程。本部分实验的任务是：向每个进程的**内核页表**（在上一小节中创建的）中添加用户地址映射，使得 `copyin`（以及相关的字符串函数 `copyinstr`）能够直接解引用用户指针。

---

**具体要求：**

将 `kernel/vm.c` 中 `copyin` 的函数体替换为对 `copyin_new`（定义在 `kernel/vmcopyin.c`）的调用；对 `copyinstr` 和 `copyinstr_new` 做同样的替换。向每个进程的内核页表中添加用户地址的映射，使 `copyin_new` 和 `copyinstr_new` 能够正常工作。如果 `usertests` 能正确运行，且所有 `make grade` 测试通过，则本任务完成。

---

**背景说明：**

该方案依赖于用户虚拟地址范围与内核自身指令和数据所使用的虚拟地址范围**不能重叠**。Xv6 的用户地址空间从零开始，而幸运的是内核内存从相对较高的地址开始。然而，这一方案限制了用户进程的最大大小，必须小于内核的最低虚拟地址。内核启动后，内核用到的最低虚拟地址在 xv6 中为 `0xC000000`，即 PLIC 寄存器的地址（参见 `kernel/vm.c` 中的 `kvminit()`、`kernel/memlayout.h` 以及课本中的图 3-4）。**你需要修改 xv6，防止用户进程增长超过 PLIC 地址。**

---

**提示：**

- 先将 `copyin()` 替换为对 `copyin_new` 的调用，并使其正常工作，然后再处理 `copyinstr`。
- 每当内核更改进程的用户映射时，同步以相同的方式更改该进程的内核页表。这些时机包括 `fork()`、`exec()` 和 `sbrk()`。
- 不要忘记在 `userinit` 中将第一个进程的用户页表也包含进其内核页表。
- 在进程内核页表中，用户地址的 PTE 需要什么权限？（注意：设置了 `PTE_U` 的页在内核模式下无法访问。）
- 不要忘记上面提到的 PLIC 地址上限限制。

---

**扩展说明：**

Linux 使用了与你所实现的类似技术。几年前，许多内核在用户态和内核态都使用同一份**进程页表**，其中同时包含用户和内核的地址映射，以避免在用户态和内核态切换时切换页表。然而，这种做法允许了诸如 **Meltdown** 和 **Spectre** 之类的侧信道攻击。

### 题解

**整体思路：** 在进程的内核页表中，额外维护一份用户地址空间的镜像映射（虚拟地址和用户页表相同，权限去掉 `PTE_U`）。`copyin_new` / `copyinstr_new` 依赖当前 `satp` 就是**进程内核页表**，**可以直接用用户虚拟地址访问，无需软件遍历页表翻译**。关键是保持内核页表中的用户映射与用户页表始终同步。

---

**1. `kernel/vm.c` —— 实现 `u2kvmcopy`**

将用户页表中 `oldsz` 到 `newsz` 范围的映射，同步复制到内核页表，并去掉 `PTE_U`（内核模式下 `PTE_U` 的页无法访问）：

```c
int u2kvmcopy(pagetable_t pagetable, pagetable_t kpagetable, uint64 oldsz, uint64 newsz){
  for(uint64 i = PGROUNDUP(oldsz); i < newsz; i += PGSIZE){
    pte_t *pte = walk(pagetable, i, 0);
    if(pte == 0 || (*pte & PTE_V) == 0)
      return -1;
    uint64 pa = PTE2PA(*pte);
    uint flags = PTE_FLAGS(*pte) & ~PTE_U; // 去掉 PTE_U，内核态才能访问
    mappages(kpagetable, i, PGSIZE, pa, flags);
  }
  return 0;
}
```

---

**2. `kernel/vm.c` —— 替换 `copyin` 和 `copyinstr`**

```c
int copyin(pagetable_t pagetable, char *dst, uint64 srcva, uint64 len){
  return copyin_new(pagetable, dst, srcva, len);
}

int copyinstr(pagetable_t pagetable, char *dst, uint64 srcva, uint64 max){
  return copyinstr_new(pagetable, dst, srcva, max);
}
```

---

**3. 同步用户映射到内核页表的四个时机**

每当用户地址空间发生变化，必须同步更新 `kpgtbl` 中的用户映射：

**`userinit`**（第一个进程初始化后）：

```c
uvminit(p->pagetable, initcode, sizeof(initcode));
p->sz = PGSIZE;
u2kvmcopy(p->pagetable, p->kpgtbl, 0, p->sz); // 同步
```

**`fork`**（子进程创建后，用户内存已复制完毕）：

```c
// uvmcopy 之后
u2kvmcopy(np->pagetable, np->kpgtbl, 0, np->sz);
```

**`exec`**（新程序加载完毕，旧页表释放后）：

```c
proc_freepagetable(oldpagetable, oldsz);
uvmunmap(p->kpgtbl, 0, PGROUNDUP(oldsz) / PGSIZE, 0); // 先清掉旧的用户映射
u2kvmcopy(pagetable, p->kpgtbl, 0, sz);                // 再同步新的
```

**`growproc`**（`sbrk` 扩大或缩小内存时）：

```c
if(n > 0){
  if(sz + n > PLIC)  // 不能超过 PLIC 地址，否则会与内核映射冲突
    return -1;
  sz = uvmalloc(p->pagetable, sz, sz + n);
  u2kvmcopy(p->pagetable, p->kpgtbl, p->sz, sz); // 同步新增的页
} else if(n < 0){
  uint64 newsz = uvmdealloc(p->pagetable, sz, sz + n);
  uvmunmap(p->kpgtbl, PGROUNDUP(newsz),
           (PGROUNDUP(sz) - PGROUNDUP(newsz)) / PGSIZE, 0); // 清掉释放的页
  sz = newsz;
}
```

> [!TIP]
> `exec` 需要分两步：先用 `uvmunmap` 清掉内核页表里旧的用户映射（`do_free=0`，不释放物理页，那是用户页表的职责），再用 `u2kvmcopy` 同步新程序的映射。如果只同步不清理，内核页表里会残留旧程序的 PTE，可能造成安全问题或 panic。
