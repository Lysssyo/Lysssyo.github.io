---
title: 方法引用
date: 2024-09-17 20:54:00 +0800
categories: [Java, Grammar]
tags: [Java, Grammar]
---
## 1. 什么是方法引用

方法引用可以理解为引用java已经写好的方法或者第三方工具类的方法，代替“重写函数式接口的抽象方法”，完成任务。

## 2. 方法引用的要求

1. 引用处是函数式接口

2. 被引用的方法已经存在

   > 可以是java已经写好的，也可以是第三方工具类

3. 被引用的方法的形参和返回值与抽象方法保持一致

4. 被引用方法的功能要满足当前需求

## 3. 具体示例

### 3.1 引用静态方法

格式：`类::被引用的方法`

**示例：**集合的每个元素的数据类型由字符串转为Integer

```java
    @Test
    void testMethodReference() {
        ArrayList<String> list = new ArrayList<>();
        Collections.addAll(list, "1", "2", "3", "4", "5", "6");
        list.stream().map(new Function<String, Integer>() {
            @Override
            public Integer apply(String s) {
                Integer i = Integer.parseInt(s);
                return i;
            }
        }).forEach(s -> System.out.println(s));
    }
```

对于`map`方法，它的参数`Function`是函数式接口，并且，这个函数式接口的作用是接收一个字符串，把它转为整数类型。碰巧的是，已经有一个方法的参数与返回值与需求一致，方法的作用与需求一致：

```java
//Integer类
	public static int parseInt(String s) throws NumberFormatException {
        return parseInt(s,10);
    }
```

所以，上面的方法可以改为：

```java
    @Test
    void testMethodReference() {
        ArrayList<String> list = new ArrayList<>();
        Collections.addAll(list, "1", "2", "3", "4", "5", "6");
        list.stream().map(Integer::parseInt).forEach(s -> System.out.println(s));
    }
```

### 3.2 引用成员方法

#### 3.2.1 引用其他类的成员方法

格式：`类的对象::成员方法`

**示例：**过滤至只剩名字为三个字且姓张的

```java
    @Test
    void testMethodReference2() {
        ArrayList<String> list = new ArrayList<>();
        Collections.addAll(list, "张三丰", "张无忌", "张翠山", "王二麻子", "张良", "谢广坤");
        list.stream().filter(new Predicate<String>() {
            @Override
            public boolean test(String s) {
                return s.length() == 3;
            }
        }).filter(new Predicate<String>() {
            @Override
            public boolean test(String s) {
                return s.startsWith("张");
            }
        }).forEach(System.out::println);
    }
```

可以改成：

```java
public class StringOperation {
    public boolean judgeString(String s) {
        return s.startsWith("张") && s.length() == 3;
    }
}
```

```java
	@Test
    void testMethodReference2() {
        ArrayList<String> list = new ArrayList<>();
        Collections.addAll(list, "张三丰", "张无忌", "张翠山", "王二麻子", "张良", "谢广坤");
        //写法一：
        //list.stream().filter(new StringOperation()::judgeString).forEach(System.out::println);
        //写法二：
        StringOperation stringOperation = new StringOperation();
        list.stream().filter(stringOperation::judgeString).forEach(System.out::println);
    }
```

#### 3.2.2 引用本类或父类的成员方法

格式：`this::成员方法`	or	`super::成员方法`

> **注意：引用处不能是静态方法**，因为静态方法没有`this`与`super`关键字

#### 3.2.3 引用构造方法

格式：`类名::new`

> 目的：创建这个类的对象

**示例：**由字符串List转为Student类型的List

```java
    @Test
    void testMethodReference3() {
        ArrayList<String> list = new ArrayList<>();
        Collections.addAll(list, "张三丰,15", "张无忌,16", "张翠山,17", "王二麻子,18", "张良,19", "谢广坤,20");
        List<Student> studentList = list.stream().map(new Function<String, Student>() {
            @Override
            public Student apply(String s) {
                String[] arr = s.split(",");
                String name = arr[0];
                int age = Integer.parseInt(arr[1]);
                return new Student(name, age);
            }
        }).collect(Collectors.toList());
    }
```

改为：

```java
    @Test
    void testMethodReference3() {
        ArrayList<String> list = new ArrayList<>();
        Collections.addAll(list, "张三丰,15", "张无忌,16", "张翠山,17", "王二麻子,18", "张良,19", "谢广坤,20");
        List<Student> studentList = list.stream().map(Student::new).collect(Collectors.toList());
    }
//Student类需要多一个构造方法
    public Student(String str) {
        String[] arr = str.split(",");
        String name = arr[0];
        int age = Integer.parseInt(arr[1]);
        this.name = name;
        this.age = age;
    }
```

### 3.3 其他

#### 3.3.1 类名::成员方法

这种引用方法必须满足如下规则：

1. 引用处是函数式接口
2. 被引用的方法已经存在
3. 被引用方法的形参需要与抽象方法的第二个形参到最后一个形参保持一致，返回值保持一致
4. 被引用方法的功能需要满足当前需求

**示例：**集合中的每个元素小写转大写

普通写法：

```java
    void testMethodReference4() {
        ArrayList<String> list = new ArrayList<>();
        Collections.addAll(list, "aaa", "bbb", "ccc", "ddd", "eee", "fff");
        list.stream().map(new Function<String, String>() {
            @Override
            public String apply(String s) {
                return s.toUpperCase();
            }
        }).forEach(System.out::println);
    }
```

改写：

```java
    @Test
    void testMethodReference4() {
        ArrayList<String> list = new ArrayList<>();
        Collections.addAll(list, "aaa", "bbb", "ccc", "ddd", "eee", "fff");
        list.stream().map(String::toUpperCase).forEach(System.out::println);
    }
```

输出：

```
AAA
BBB
CCC
DDD
EEE
FFF
```

解释：

首先给出`String`类的`toUpperCase`方法的源码

```java
    public String toUpperCase() {
        return toUpperCase(Locale.getDefault());
    }
```

可以发现，`toUpperCase`方法没有参数，方法的返回值与实习抽象接口时的返回值一致。

再来看抽象方法的形参：

```java
		list.stream().map(new Function<String, String>() {
            @Override
            public String apply(String s) {
                return s.toUpperCase();
            }
        }).forEach(System.out::println);
```

在这里，`map`方法的第一个参数表示被引用方法的调用者，决定了可以引用那些类的方法。例如，在这里，第一个参数是String类型，所以可以引用String类型的方法；第二个参数到最后一个参数需要与引用方法保持一致。例如，这里没有第二个参数，说明被引用方法需要是无参的。