---
date created: 2026-03-18 17:43:29
date modified: 2026-03-18 17:43:40
---
# Lab1

## sleep (简单难度)

为 xv6 实现 UNIX 的 `sleep` 程序；你的 `sleep` 程序应该暂停用户指定的“滴答数”（ticks）。一个 tick（滴答）是 xv6 内核定义的时间概念，也就是定时器芯片两次硬件中断之间的时间间隔。你的代码必须写在 `user/sleep.c` 文件中。

**一些提示 (Hints):**

- [x] 在开始写代码之前，请先阅读 xv6 手册的第一章。
- [ ] 看看 `user/` 目录下的其他程序（例如 `user/echo.c`、`user/grep.c` 和 `user/rm.c`），学习如何获取传递给程序的命令行参数（Command-line arguments）。
- [x] 如果用户忘记传递参数，`sleep` 应该打印一条错误提示信息。
- [x] 命令行参数是以字符串的形式传递进来的；你可以使用 `atoi` 函数将其转换为整数（具体实现请看 `user/ulib.c`）。
- [ ] 使用 `sleep` 这个系统调用。
- [ ] 查看 `kernel/sysproc.c` 中实现 `sleep` 系统调用的内核代码（寻找 `sys_sleep` 函数）；查看 `user/user.h` 中提供给用户程序调用的 `sleep` 函数的 C 语言声明；还要查看 `user/usys.S` 中实现从用户代码跳转进内核执行 `sleep` 的底层汇编代码。
- [ ] 确保你的 `main` 函数在最后调用了 `exit()` 来正常退出程序。
- [ ] 把你的 `sleep` 程序加到 `Makefile` 文件的 `UPROGS` 列表中；搞定这一步后，运行 `make qemu` 就会自动编译你的程序，随后你就可以在 xv6 的 shell 里直接运行它了。
- [x] 查阅 Kernighan 和 Ritchie 合著的《C程序设计语言（第二版）》（K&R）来学习 C 语言的语法。