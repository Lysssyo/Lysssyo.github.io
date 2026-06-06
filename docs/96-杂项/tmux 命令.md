---
date created: 2026-04-28 20:29:49
date modified: 2026-04-28 20:31:52
---
# tmux 命令总结

`tmux` 是一个终端复用工具，常用于服务器、WSL、SSH 环境。它的主要作用是：

- **分屏**：一个终端里同时打开多个命令区域。
- **保活**：SSH 断开后，tmux 里的程序仍然继续运行。
- **会话管理**：可以退出终端后重新连接到之前的工作环境。

---

## 1. 安装 tmux

### Ubuntu / Debian / WSL

```bash
sudo apt update  
sudo apt install -y tmux
```

如果当前是 `root` 用户，可以不加 `sudo`：

```bash
apt update  
apt install -y tmux
```

### 查看版本

```bash
tmux -V
```

---

## 2. 创建和进入会话

### 新建一个 tmux 会话

```bash
tmux
```

### 新建一个带名字的会话

```bash
tmux new -s work
```

例如给 Codex 单独开一个会话：

```bash
tmux new -s codex
```

---

## 3. 暂时离开 tmux，但不关闭程序

在 tmux 里面按：

```
Ctrl + b
```

松开后再按：

```
d
```

也就是：

```
Ctrl+b，然后按 d
```

这叫 `detach`，表示暂时离开当前 tmux 会话。里面运行的程序不会停止。

---

## 4. 查看已有会话

```bash
tmux ls
```

可能看到类似：

```
work: 1 windows  
codex: 1 windows
```

---

## 5. 重新进入会话

### 如果只有一个会话

```bash
tmux attach
```

### 指定进入某个会话

```bash
tmux attach -t work
```

简写：

```bash
tmux a -t work
```

例如重新进入 Codex 会话：

```bash
tmux attach -t codex
```

---

## 6. 关闭 tmux 会话

### 方式一：在 tmux 里面关闭当前会话

在 tmux 里输入：

```bash
exit
```

或者按：

```
Ctrl + d
```

如果会话里有多个分屏或窗口，需要把每个分屏/窗口都退出，最后会话会自动结束。

### 方式二：在 tmux 外面关闭指定会话

先查看会话：

```bash
tmux ls
```

关闭指定会话：

```bash
tmux kill-session -t work
```

例如：

```bash
tmux kill-session -t codex
```

### 方式三：关闭所有 tmux 会话

慎用，会把所有 tmux 里的程序都结束：

```bash
tmux kill-server
```

---

## 7. 分屏操作

tmux 的快捷键都以 `Ctrl+b` 开头。

注意：不是同时按所有键，而是：

```
先按 Ctrl+b，松开，再按后面的键
```

### 左右分屏

```
Ctrl+b，然后按 %
```

`%` 通常是：

```
Shift + 5
```

### 上下分屏

```
Ctrl+b，然后按 "
```

`"` 通常是：

```
Shift + '
```

### 在分屏之间切换

```
Ctrl+b，然后按方向键
```

例如切换到右边分屏：

```
Ctrl+b，然后按 →
```

### 关闭当前分屏

在当前分屏里输入：

```bash
exit
```

或者：

```
Ctrl+d
```

---

## 8. 调整分屏大小

### 快捷键方式

```
Ctrl+b，然后 Ctrl+方向键
```

例如让当前分屏向右扩大：

```
Ctrl+b，然后 Ctrl+→
```

有些终端可能不支持这个快捷键。

### 命令方式

按：

```
Ctrl+b，然后按 :
```

底部出现命令栏后输入：

```
resize-pane -R 10
```

常用命令：

```
resize-pane -L 10   # 向左调整  
resize-pane -R 10   # 向右调整  
resize-pane -U 5    # 向上调整  
resize-pane -D 5    # 向下调整
```

---

## 9. 鼠标滚轮和点击分屏

tmux 默认可能不支持鼠标滚轮和点击切换分屏，需要开启鼠标模式。

### 临时开启

在 tmux 里按：

```
Ctrl+b，然后按 :
```

输入：

```
set -g mouse on
```

回车。

开启后可以：

- 鼠标滚轮滚动当前分屏历史
- 鼠标点击切换分屏
- 鼠标拖动分屏边界调整大小

### 永久开启

```bash
echo 'set -g mouse on' >> ~/.tmux.conf  
tmux source-file ~/.tmux.conf
```

---

## 10. 查看长输出：滚动模式

如果某个分屏上下文很长，不建议拖终端右侧滚动条。因为右侧滚动条通常是外层终端的，不一定对应当前 tmux 分屏。

推荐进入 tmux 的滚动模式：

```
Ctrl+b，然后按 [
```

进入滚动模式后：

```
PageUp       向上翻一页  
PageDown     向下翻一页  
↑ / ↓        一行一行移动  
g            跳到最上面  
G            跳到最下面  
q            退出滚动模式
```

最常用：

```
Ctrl+b [  
PageUp  
PageDown  
q
```

---

## 11. 增大历史缓存

如果输出很多，默认历史可能不够长，可以增大缓存：

```bash
echo 'set -g history-limit 50000' >> ~/.tmux.conf  
tmux source-file ~/.tmux.conf
```

之后新开的窗口/分屏会保存更多历史输出。

---

## 12. 让鼠标滚轮一次滚更多行

可以加入配置：

```bash
cat >> ~/.tmux.conf << 'EOF'  
set -g mouse on  
set -g history-limit 50000  
  
bind -T copy-mode-vi WheelUpPane send-keys -X -N 5 scroll-up  
bind -T copy-mode-vi WheelDownPane send-keys -X -N 5 scroll-down  
EOF  
  
tmux source-file ~/.tmux.conf
```

其中 `-N 5` 表示一次滚动 5 行，可以改成 10：

```
-N 10
```

---

## 13. 常用窗口操作

tmux 里除了分屏，还有窗口，类似浏览器标签页。

### 新建窗口

```
Ctrl+b，然后按 c
```

### 下一个窗口

```
Ctrl+b，然后按 n
```

### 上一个窗口

```
Ctrl+b，然后按 p
```

### 查看窗口列表

```
Ctrl+b，然后按 w
```

### 关闭当前窗口

```bash
exit
```

---

## 14. 最常用命令速查

```bash
tmux new -s work              # 新建名为 work 的会话  
tmux new -s codex             # 新建名为 codex 的会话  
tmux ls                       # 查看所有 tmux 会话  
tmux attach -t work           # 进入 work 会话  
tmux a -t work                # attach 的简写  
tmux kill-session -t work     # 关闭 work 会话  
tmux kill-server              # 关闭所有 tmux 会话，慎用  
tmux -V                       # 查看 tmux 版本
```

---

## 15. 最常用快捷键速查

```
Ctrl+b d        暂时离开 tmux，会话继续运行  
Ctrl+b %        左右分屏  
Ctrl+b "        上下分屏  
Ctrl+b 方向键   切换分屏  
Ctrl+b [        进入滚动模式  
PageUp          滚动模式中向上翻页  
PageDown        滚动模式中向下翻页  
q               退出滚动模式  
Ctrl+b c        新建窗口  
Ctrl+b n        下一个窗口  
Ctrl+b p        上一个窗口  
Ctrl+b w        窗口列表  
exit            关闭当前分屏/窗口  
Ctrl+d          关闭当前分屏/窗口
```

---

## 16. 推荐使用流程

### 用 tmux 开一个工作环境

```bash
tmux new -s work
```

### 左右分屏

```
Ctrl+b %
```

### 上下分屏

```
Ctrl+b "
```

### 切换分屏

```
Ctrl+b 方向键
```

### 暂时离开

```
Ctrl+b d
```

### 重新回来

```bash
tmux attach -t work
```

### 关闭会话

```bash
tmux kill-session -t work
```

---
