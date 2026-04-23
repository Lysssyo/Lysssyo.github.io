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