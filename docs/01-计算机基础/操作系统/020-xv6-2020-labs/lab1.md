---
date created: 2026-03-18 17:43:29
date modified: 2026-03-18 17:43:40
---
# Lab1

## sleep (简单)

为 xv6 实现 UNIX 的 `sleep` 程序；你的 `sleep` 程序应该暂停用户指定的“滴答数”（ticks）。一个 tick（滴答）是 xv6 内核定义的时间概念，也就是定时器芯片两次硬件中断之间的时间间隔。你的代码必须写在 `user/sleep.c` 文件中。

**一些提示 (Hints):**

- 在开始写代码之前，请先阅读 xv6 手册的第一章。
- 看看 `user/` 目录下的其他程序（例如 `user/echo.c`、`user/grep.c` 和 `user/rm.c`），学习如何获取传递给程序的命令行参数（Command-line arguments）。
- 如果用户忘记传递参数，`sleep` 应该打印一条错误提示信息。
- 命令行参数是以字符串的形式传递进来的；你可以使用 `atoi` 函数将其转换为整数（具体实现请看 `user/ulib.c`）。
- 使用 `sleep` 这个系统调用。
- 查看 `kernel/sysproc.c` 中实现 `sleep` 系统调用的内核代码（寻找 `sys_sleep` 函数）；查看 `user/user.h` 中提供给用户程序调用的 `sleep` 函数的 C 语言声明；还要查看 `user/usys.S` 中实现从用户代码跳转进内核执行 `sleep` 的底层汇编代码。
- 确保你的 `main` 函数在最后调用了 `exit()` 来正常退出程序。
- 把你的 `sleep` 程序加到 `Makefile` 文件的 `UPROGS` 列表中；搞定这一步后，运行 `make qemu` 就会自动编译你的程序，随后你就可以在 xv6 的 shell 里直接运行它了。
- 查阅 Kernighan 和 Ritchie 合著的《C程序设计语言（第二版）》（K&R）来学习 C 语言的语法。

## **pingpong（简单）**

编写一个程序，使用 UNIX 系统调用通过一对管道在两个进程之间来回传递一个字节，每个方向各用一个管道。

- **父进程**：向子进程发送一个字节
- **子进程**：打印 `"<pid>: received ping"`（`<pid>` 是其进程 ID），将该字节写入管道发回给父进程，然后退出
- **父进程**：从子进程读取该字节，打印 `"<pid>: received pong"`，然后退出

你的解答应写在 `user/pingpong.c` 文件中。

**提示：**

- 用 `pipe` 创建管道
- 用 `fork` 创建子进程
- 用 `read` 从管道读取数据，用 `write` 向管道写入数据
- 用 `getpid` 获取当前进程的进程 ID
- 将该程序添加到 Makefile 的 `UPROGS` 中
- xv6 上的用户程序只能使用有限的库函数，可以在 `user/user.h` 中查看列表；相关源码（系统调用除外）在 `user/ulib.c`、`user/printf.c` 和 `user/umalloc.c` 中

在 xv6 shell 中运行程序，应产生如上所示的输出（子进程 pid 为 4，父进程 pid 为 3）。


## **primes（中等/困难）**

使用管道编写一个并发版本的质数筛。这个想法来自 Unix 管道的发明者 Doug McIlroy。请参考[这个页面](https://swtch.com/~rsc/thread/)中间的图片和说明来了解实现方法。你的解答应写在 `user/primes.c` 文件中。

你的目标是使用 `pipe` 和 `fork` 来建立一个流水线。第一个进程将 2 到 35 的数字输入流水线。对于每个质数，你需要创建一个进程，该进程通过管道从左邻居读取数据，再通过另一个管道写给右邻居。由于 xv6 的文件描述符和进程数量有限，第一个进程只需处理到 35。

**提示：**

- 注意关闭进程不需要的文件描述符，否则程序会在第一个进程到达 35 之前耗尽 xv6 的资源
- 第一个进程到达 35 后，应等待整个流水线终止，包括所有子进程、孙进程等。因此主 primes 进程只能在所有输出打印完毕、所有其他进程退出后才能退出
- 提示：当管道的写端关闭时，`read` 返回 0
- 最简单的方式是直接向管道写入 32 位（4字节）的 `int`，而不是用格式化的 ASCII I/O
- 只在需要时才创建流水线中的进程
- 将程序添加到 Makefile 的 `UPROGS` 中


## **find（中等）**

编写一个简单版本的 UNIX `find` 程序：在目录树中查找所有具有特定名称的文件。你的解答应写在 `user/find.c` 文件中。

**提示：**

- 查看 `user/ls.c`，了解如何读取目录
- 使用递归让 `find` 能够进入子目录
- 不要递归进入 `.` 和 `..`
- 对文件系统的修改在 qemu 重启后会保留；如果想要干净的文件系统，运行 `make clean` 然后再 `make qemu`
- 需要用到 C 字符串，可以参考 K&R（C 语言圣经），例如第 5.5 节
- 注意 `==` 不能像 Python 那样比较字符串，要用 `strcmp()`
- 将程序添加到 Makefile 的 `UPROGS` 中


## **xargs（中等）**

编写一个简单版本的 UNIX `xargs` 程序：从标准输入读取每一行，并为每一行执行一个命令，将该行内容作为参数传给命令。你的解答应写在 `user/xargs.c` 文件中。

下面的例子说明了 `xargs` 的行为：

```
$ echo hello too | xargs echo bye
bye hello too
```

注意这里的命令是 `echo bye`，附加参数是 `hello too`，合并后执行的是 `echo bye hello too`，输出 `bye hello too`。

请注意，UNIX 上的 `xargs` 有一个优化，会一次性把多个参数传给命令。本实验不要求实现这个优化。如果想让 UNIX 上的 `xargs` 按照本实验期望的方式运行，请使用 `-n 1` 选项，例如：

```
$ echo "1\n2" | xargs -n 1 echo line
line 1
line 2
```

**提示：**

- 使用 `fork` 和 `exec` 来对每一行输入执行命令，在父进程中用 `wait` 等待子进程完成
- 每次读取一个字符，直到遇到换行符 `'\n'` 为止，以此读取每一行
- `kernel/param.h` 声明了 `MAXARG`，在需要声明 `argv` 数组时可能有用
- 将程序添加到 Makefile 的 `UPROGS` 中
- 对文件系统的修改在 qemu 重启后会保留；如果想要干净的文件系统，运行 `make clean` 然后再 `make qemu`

`xargs`、`find` 和 `grep` 组合使用效果很好：

```
$ find . b | xargs grep hello
```

这会对 `.` 目录下所有名为 `b` 的文件执行 `grep hello`。