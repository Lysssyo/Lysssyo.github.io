---
title: Linux内核模块编程入门
date: 2024-09-05 15:25:00 +0800
categories: [Linux]
tags: [Linux]
---

### 1. **检查是否有 `root` 权限**

内核模块编程需要管理员权限，因此你首先需要确保你在服务器上有 `root` 权限。

#### 检查方法：

```bash
whoami
```

如果返回的是 `root`，则表明你有管理员权限。如果不是 `root`，可以使用 `sudo` 执行命令，或者联系服务器管理员提升权限。

### 2. **检查当前内核版本**

内核模块需要与当前运行的内核版本兼容，因此你需要确认服务器的内核版本。

#### 检查方法：

```bash
uname -r
```

此命令会返回当前内核的版本号。你需要根据这个版本下载对应的内核头文件和源码。

### 3. **检查内核头文件是否安装**

内核模块编程需要依赖内核头文件。你可以通过以下命令检查内核开发文件是否已安装。

#### 检查方法（CentOS/RHEL）：

```bash
rpm -qa | grep kernel-devel
```

#### 检查方法（Ubuntu/Debian）：

```bash
dpkg -l | grep linux-headers-$(uname -r)
```

如果没有安装内核开发文件，输出将为空。

#### 安装内核头文件：

- **CentOS/RHEL**:

  ```bash
  sudo yum install kernel-devel
  ```

- **Ubuntu/Debian**:

  ```bash
  sudo apt install linux-headers-$(uname -r)
  ```

### 4. **检查是否有编译工具**

你需要确保服务器上已经安装了编译工具链，包括 `gcc`、`make` 等。

#### 检查方法：

```bash
gcc --version
make --version
```

如果没有安装，可以通过以下命令安装：

- **CentOS/RHEL**:

  ```bash
  sudo yum groupinstall "Development Tools"
  ```

- **Ubuntu/Debian**:

  ```bash
  sudo apt update
  sudo apt install build-essential
  ```

### 5. **测试内核模块编译**

可以编写一个简单的内核模块进行测试，看看是否能够成功编译和加载。

#### 创建一个简单的内核模块：

1. 创建一个名为 `hello.c` 的文件：

   ```c
   #include <linux/module.h>
   #include <linux/kernel.h>
   
   MODULE_LICENSE("GPL");
   
   static int __init hello_init(void) {
       printk(KERN_INFO "Hello, Kernel!\n");
       return 0;
   }
   
   static void __exit hello_exit(void) {
       printk(KERN_INFO "Goodbye, Kernel!\n");
   }
   
   module_init(hello_init);
   module_exit(hello_exit);
   ```

   > 这个模块的作用是：
   >
   > - 在加载时打印 `"Hello, Kernel!"`。
   > - 在卸载时打印 `"Goodbye, Kernel!"`。
   >
   > 保存文件为 `hello.c`。

2. 创建一个 `Makefile`：

   `Makefile` 用来自动化编译过程。在当前目录下创建一个名为 `Makefile` 的文件，内容如下：

   ```
   # obj-m 表示要编译的目标模块。hello.o 是我们要编译的内核模块目标。
   obj-m += hello.o
   
   # all 目标表示执行 "make" 时的默认动作。
   # /lib/modules/$(shell uname -r)/build 是当前内核的编译目录
   # M=$(PWD) 告诉 make 命令模块的源文件在当前目录
   all:
   	make -C /lib/modules/$(shell uname -r)/build M=$(PWD) modules
   
   # clean 目标用于清理生成的文件。
   clean:
   	make -C /lib/modules/$(shell uname -r)/build M=$(PWD) clean
   ```

   > 注意`make`命令以及其他命令前是`tab`不是空格，可以用notepad++确保之
   >
   > 检查方法：
   >
   > 使用 `cat -T Makefile` 命令查看是否正确缩进，Tab 会显示为 `^I` 符号。确保命令部分有 **Tab** 而不是空格。

3. 编译内核模块：

   在 `hello.c` 和 `Makefile` 文件所在的目录下执行以下命令来编译内核模块：

   ```bash
   make
   ```

   这会调用 `Makefile`，并根据其中的指令生成内核模块 `hello.ko`。

4. 加载内核模块：

   ```bash
   sudo insmod hello.ko
   ```

5. 检查内核日志：

   ```bash
   dmesg | tail
   ```

   如果模块加载成功，你应该看到 `Hello, Kernel!` 这样的输出。

6. 卸载内核模块：

   ```bash
   sudo rmmod hello
   ```

   再次使用 `dmesg | tail` 来确认内核模块的卸载是否成功，并查看是否打印了 `"Goodbye, Kernel!"`。

7. 清理编译文件

   如果想清理编译生成的文件（例如 `.o` 文件和 `.ko` 文件），可以执行以下命令：

   ```bash
   make clean
   ```

   这个命令会删除编译过程中生成的中间文件和目标文件，使目录干净。

