---
title: Annotation and Reflection
date: 2024-09-21 17:00:00 +0800
categories: [Java, Grammar]
tags: [Java, Grammar]
---
## 1.Annotation

### 1.1 元注解 (Meta-Annotations)

#### 1.1.1 `@Target`

`@Target` 表示注解可以应用的元素类型，如类、方法、字段等。

**定义:**

```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
public @interface Target {
    ElementType[] value();
}
```

**`ElementType` 枚举类型:**

```java
public enum ElementType {
    TYPE,            // 类、接口（包括注解类型）或枚举声明
    FIELD,           // 字段声明（包括枚举常量）
    METHOD,          // 方法声明
    PARAMETER,       // 参数声明
    CONSTRUCTOR,     // 构造方法声明
    LOCAL_VARIABLE,  // 局部变量声明
    ANNOTATION_TYPE, // 注解类型声明
    PACKAGE,         // 包声明
    TYPE_PARAMETER,  // 类型参数声明 (Java 8)
    TYPE_USE         // 使用类型 (Java 8)
}
```

**示例:**

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@interface MyAnnotation {
}

// @MyAnnotation 放在类上会报错："@MyAnnotation" not applicable to type
public class AnnotationTest {
    @MyAnnotation // @MyAnnotation 放在方法上是合法的
    public void test1() {
        
    }   
}
```

#### 1.1.2 `@Retention`

`@Retention` 表示注解的生命周期，决定了注解在何时可见。

**定义:**

```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
public @interface Retention {
    RetentionPolicy value();
}
```

**`RetentionPolicy` 枚举类型:**

```java
public enum RetentionPolicy {
    SOURCE,    // 注解只在源代码中保留，编译时被丢弃
    CLASS,     // 注解在编译期保留在类文件中，但运行时不保留（默认行为）
    RUNTIME    // 注解在运行时也保留，可以通过反射读取
}
```

**说明:**

- `RUNTIME`: 运行时可通过反射获取注解信息（所有阶段都有效）。
- `CLASS`: 注解保留在类文件中，但运行时不可见。
- `SOURCE`: 注解只在源代码中保留，不包含在编译后的字节码中。

#### 1.1.3 `@Documented`

`@Documented` 表示注解是否会包含在 JavaDoc 中。

**定义:**

```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
public @interface Documented {
}
```

#### 1.1.4 `@Inherited`

`@Inherited` 表示注解是否会被子类继承。如果一个类使用了被 `@Inherited` 注解修饰的注解，那么其子类将自动继承该注解。

**定义:**

```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.ANNOTATION_TYPE)
@Inherited
public @interface Inherited {
}
```

**示例:**

```java
@Inherited
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@interface MyInheritedAnnotation {
}

@MyInheritedAnnotation
class ParentClass {
}

class ChildClass extends ParentClass {
    // ChildClass 将继承 ParentClass 的 MyInheritedAnnotation 注解
}
```

### 1.2 自定义注解

自定义注解使用 `@interface` 关键字，自动继承自 `java.lang.annotation.Annotation` 接口。

**基本格式:**

```java
public @interface 注解名 {
    ElementType value();
}
```

- **方法名称**：表示参数名称。
- **返回类型**：表示参数类型，只能是基本类型、`String`、`Class`、`enum` 等。
- **默认值**：使用 `default` 关键字为元素指定默认值。

**注意:**

- 如果只有一个元素，通常将其命名为 `value`。
- 注解元素必须有值，除非指定了默认值。

**示例一：**

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@interface MyAnnotation {
    String name() default "";
    int age();
    int id() default -1;
    String[] schools() default {"广州大学"};
}

public class AnnotationTest {
    @MyAnnotation(age = 10)// 使用注解时必须为 age 赋值
    public void test1() {
       
    }
}
```

**示例二：**

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@interface MyAnnotation {
    String value() default "";
}

public class AnnotationTest {
    @MyAnnotation("Keith")
    public void test1() {
        // 只有一个参数时，默认使用 "value"
    }
}
```



## 2. Reflection

### 2.1 简介

`Reflection`（反射）是Java中使其具有动态语言特性的核心机制。反射机制允许程序在运行时动态获取类的内部信息，并且可以直接操作对象的属性和方法。Java类加载完成后，JVM在方法区中会生成一个`Class`类型的对象（一个类只有一个Class类型的对象），这个对象包含了该类的完整结构信息。通过反射，我们可以通过`Class`对象来获取类的属性、方法、构造器以及实现的接口等信息，因此将反射比喻为通过“镜子”查看类的内部结构。

<img src="/assets/AnnotationAndReflection.assets/image-20240921101956474.png" alt="image-20240921101956474" style="zoom: 67%;" />



`Class`对象的特点：

- `Class`本身是一个类。
- `Class`对象只能由JVM系统创建。
- 每个加载的类在JVM中只会有一个`Class`实例。
- 每个`Class`对象对应一个加载到JVM中的`.class`文件。
- 通过`Class`对象可以完整获取类的所有结构信息。
- **`Class`类是反射机制的根本，动态加载和运行类时必须首先获取对应的`Class`对象。**

### 2.2 类加载过程

在讨论反射之前，需要先复习一下Java的内存布局：

- **堆内存：** 用于存放由`new`关键字创建的对象和数组，可以被所有线程共享，但不会存放对象的引用。
- **栈内存：** 用于存放基本变量类型的具体数值以及引用对象的地址。
- **方法区：** 包含所有类的结构信息（如`class`和`static`变量），可以被所有线程共享。

当程序首次使用某个类时，如果该类尚未加载到内存中，JVM会通过以下三个步骤加载该类：

<img src="/assets/AnnotationAndReflection.assets/image-20240921154231550.png" alt="image-20240921154231550" style="zoom: 50%;" />

- **加载（Loading）：**

  - 将`.class`文件的字节码加载到内存中，并将其转换为方法区中的运行时数据结构。
  - 生成一个代表该类的`java.lang.Class`对象，作为访问该类在方法区中的数据的入口。

  **链接（Linking）：**

  - 将Java类的二进制代码合并到JVM的运行状态中，包括以下步骤：
    - **验证（Verification）：** 确保类文件格式正确并符合JVM的安全规范。
    - **准备（Preparation）：** 为类的静态变量分配内存并赋初始值，通常存放在方法区中。
    - **解析（Resolution）：** 将常量池中的符号引用转换为直接引用（内存地址）。

  **初始化（Initialization）：**

  - **执行类的构造器方法`<clinit>()`**，该方法由编译器自动收集类变量的赋值动作和静态代码块中的语句合并而成。
  - 若父类尚未初始化，JVM会先初始化父类。
  - JVM会确保`<clinit>()`方法在多线程环境中正确加锁和同步。

**示例：**

```java
class A {
    static {
        System.out.println("A类静态代码块初始化");
        m = 300;
    }

    static int m = 100;

    public A() {
        System.out.println("A类无参构造");
    }
}
```

当程序主动使用A类时，会把A类加载到内存，产生一个A类对应的Class对象。然后，链接，链接结束后`m = 0`.再然后，初始化，执行类构造器的`<clinit>()`方法

```java
	<clinit>(){
		System.out.println("A类静态代码块初始化");
	    m = 300;
	    m = 100;
	}
```

#### 2.2.1 类初始化

- 类的主动引用（一定会发生类的初始化）

  - 当虚拟机启动，先初始化`main`方法所在的类

  - `new`一个类的对象

  - 调用类的静态成员（除了`final`常量）和静态方法

  - 使用`java.lang.reflect`包的方法对类进行反射调用

  - 当初始化一个类，如果其父类没有被初始化，则先会初始化它的父类

- 类的被动引用（不会发生类的初始化）

  - 当访问一个静态域时，只有真正声明这个域的类才会被初始化。如：当通过子类引用父类的静态变量，不会导致子类初始化

  - 通过数组定义类引用，不会触发此类的初始化

  - 引用常量不会触发此类的初始化（常量在链接阶段就存入调用类的常量池中了）

**例一：**

```java
public class ReflectionTest02 {
    static {
        System.out.println("main类被加载");
    }

    public static void main(String[] args) throws ClassNotFoundException {
        Son son = new Son();
    }
}

class Father {
    static {
        System.out.println("父类被加载");
    }
}

class Son extends Father {
    static {
        System.out.println("子类被加载");
    }
}
```

**输出：**

```
main类被加载
父类被加载
子类被加载
```

**例二：**

```java
public class ReflectionTest02 {
    static {
        System.out.println("main类被加载");
    }

    public static void main(String[] args) throws ClassNotFoundException {
        Class c = Class.forName("com.xuecheng.Son");
    }
}

class Father {
    static {
        System.out.println("父类被加载");
    }
}

class Son extends Father {
    static {
        System.out.println("子类被加载");
    }
}
```

**输出：**

```
main类被加载
父类被加载
子类被加载
```

**例三：**

```java
public class ReflectionTest02 {
    static {
        System.out.println("main类被加载");
    }

    public static void main(String[] args) throws ClassNotFoundException {
        int value = Son.fatherValue;
    }
}

class Father {
    static {
        System.out.println("父类被加载");
    }

    static int fatherValue = 10;
}

class Son extends Father {
    static {
        System.out.println("子类被加载");
    }
}
```

输出：

```
main类被加载
父类被加载
```

**例四：**

```java
public class ReflectionTest02 {
    static {
        System.out.println("main类被加载");
    }

    public static void main(String[] args) throws ClassNotFoundException {
        Father[] array = new Father[10];
    }
}

class Father {
    static {
        System.out.println("父类被加载");
    }
}
```

输出：

```
main类被加载
```

**例五：**

```java
package com.xuecheng;

public class ReflectionTest02 {
    static {
        System.out.println("main类被加载");
    }

    public static void main(String[] args) throws ClassNotFoundException {
        System.out.println(Son.M);
    }
}

class Father {
    static {
        System.out.println("父类被加载");
    }

    static int fatherValue = 10;
}

class Son extends Father {
    static {
        System.out.println("子类被加载");
    }

    static final int M = 10;
}
```

输出：

```
main类被加载
10
```



#### 2.2.2 类加载器

类加载的作用：将class文件字节码内容加载到内存中，并将这些静态数据转换成方法区的运行时数据结构，然后在堆中生成一个代表这个类的`java.lang.Class`对象，作为方法区中类数据的访问入口。

类缓存：标准的JavaSE类加载器可以按要求查找类，但一旦某个类被加载到类加载器中，它将维持加载(缓存)一段时间。不过JVM垃圾回收机制可以回收这些Class对象

<img src="/assets/AnnotationAndReflection.assets/image-20240921135244146.png" alt="image-20240921135244146" style="zoom:67%;" />



类加载器作用是用来把类（class）装载进内存的。JVM 规范定义了如下类型的类的加载器

<img src="/assets/AnnotationAndReflection.assets/image-20240921135805481.png" alt="image-20240921135805481" style="zoom: 67%;" />

**示例：**

```java
public class ClassLoaderTest {
    public static void main(String[] args) throws ClassNotFoundException {
        // 获取系统类加载器
        ClassLoader systemClassLoader = ClassLoader.getSystemClassLoader();
        System.out.println(systemClassLoader);

        // 获取系统类加载器的父类加载器——扩展类加载器
        ClassLoader extensionClassLoader = systemClassLoader.getParent();
        System.out.println(extensionClassLoader);

        // 获取扩展类加载器的父类加载器——引导类加载器（根加载器）
        ClassLoader bootstapClassLoader = extensionClassLoader.getParent();
        System.out.println(bootstapClassLoader);//引导类加载器用C++写的，无法直接获取

        // 测试当前类是哪个加载器加载的
        ClassLoader classLoader1 = Class.forName("com.xuecheng.ClassLoaderTest").getClassLoader();
        System.out.println(classLoader1);

        // 测试JDK内置的类是哪个加载器加载的
        ClassLoader classLoader2 = Class.forName("java.lang.Object").getClassLoader();
        System.out.println(classLoader2);

        // 系统类加载器可以加载的路径
        String classPath = System.getProperty("java.class.path");
        System.out.println(classPath);
    }
}
```

输出：

```java
sun.misc.Launcher$AppClassLoader@18b4aac2
sun.misc.Launcher$ExtClassLoader@5a10411
null
sun.misc.Launcher$AppClassLoader@18b4aac2
null
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\charsets.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\access-bridge-64.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\cldrdata.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\dnsns.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\jaccess.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\jfxrt.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\localedata.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\nashorn.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\sunec.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\sunjce_provider.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\sunmscapi.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\sunpkcs11.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\ext\zipfs.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\jce.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\jfr.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\jfxswt.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\jsse.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\management-agent.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\resources.jar;
C:\Users\Lysssyo\.jdks\corretto-1.8.0_422\jre\lib\rt.jar;
D:\AAA_SecondDesktop\A_Technology\Test\xuecheng-plus\xuecheng-plus-media\xuecheng-plus-media-service\target\test-classes;
D:\AAA_SecondDesktop\A_Technology\Test\xuecheng-plus\xuecheng-plus-media\xuecheng-plus-media-service\target\classes;
D:\Develop\apache-maven-3.6.1\mvn_repo\com\alibaba\cloud\spring-cloud-starter-alibaba-nacos-config\2.2.6.RELEASE\spring-cloud-starter-alibaba-nacos-config-2.2.6.RELEASE.jar;
D:\Develop\apache-maven-3.6.1\mvn_repo\com\alibaba\spring\spring-context-support\1.0.10\spring-context-support-1.0.10.jar;D:\Develop\apache-maven-3.6.1\mvn_repo\com\alibaba\nacos\nacos-client\1.4.2\nacos-client-1.4.2.jar;
// 省略很多Maven仓库中的jar包
```



### 2.3 获取Class类的实例

```java
public class ReflectionTest01 {
    public static void main(String[] args) throws ClassNotFoundException {
        Person person = new Student();
        System.out.println("这个人是：" + person.name);

        // 获取Student对应的Class类的对象：
        // 方式一：通过对象获得
        Class c1 = person.getClass();
        System.out.println(c1);
        System.out.println(c1.hashCode());

        // 方式二：forName获得
        Class c2 = Class.forName("com.xuecheng.Student");
        System.out.println(c1);
        System.out.println(c2.hashCode());

        // 方式三：类名.class获得
        Class c3 = Student.class;
        System.out.println(c1);
        System.out.println(c3.hashCode());

        // 方式四：基本内置类型的包装类都有一个Type属性
        Class<Integer> c4 = Integer.TYPE;
        System.out.println(c4);

        // 获得父类类型
        Class c5 = c1.getSuperclass();
        System.out.println(c5);
    }
}

class Person extends Object {
    String name;

    public Person() {
    }

    public Person(String name) {
        this.name = name;
    }
}

class Student extends Person {
    public Student() {
        this.name = "学生";
    }
}

class Teacher extends Person {
    public Teacher() {
        this.name = "老师";
    }
}
```

补充：所有类型的Class对象

```java
public class ReflectionTest03 {
    public static void main(String[] args) throws Exception {
        Class c1 = Object.class;  // 类
        Class c2 = Comparable.class;  // 接口
        Class c3 = String[].class;  // 二维数组
        Class c4 = int[][].class;  // 二维数组
        Class c5 = Override.class;  // 注解
        Class c6 = ElementType.class;  // 枚举
        Class c7 = Integer.class;  // 基本数据类型
        Class c8 = void.class;  // void
        Class c9 = Class.class;  // Class

        System.out.println(c1);
        System.out.println(c2);
        System.out.println(c3);
        System.out.println(c4);
        System.out.println(c5);
        System.out.println(c6);
        System.out.println(c7);
        System.out.println(c8);
        System.out.println(c9);
    }
}
```

输出：

```
class java.lang.Object
interface java.lang.Comparable
class [Ljava.lang.String;
class [[I
interface java.lang.Override
class java.lang.annotation.ElementType
class java.lang.Integer
void
class java.lang.Class
```



### 2.4 Class类API

|               方法名               |                           功能说明                           |
| :--------------------------------: | :----------------------------------------------------------: |
| static Class.forName(String name)  |                 返回指定类名name的Class对象                  |
|        Object newInstance()        |          调用缺省构造函数，返回Class对象的一个实例           |
|             getName()              | 返回此Class对象所表示的实体（类，接口，数组类或void）的名称。 |
|          getSuperClass()           |              返回当前Class对象的父类的Class对象              |
|          getClassLoader()          |                 获取当前Class对象的类加载器                  |
|         getConstructors()          |            返回一个包含某些Constructor对象的数组             |
| getMethod(String name, Class... T) |       返回一个Method对象，此对象的形参类型为paramType        |
|       getField(String name)        |          getField(String name) 是获取成员变量的方法          |

#### 2.4.1 获取运行时类的完整结构

**示例：**

有如下类：

```java
class User {
    private int id;
    private String name;
    private int age;

    public User() {

    }

    public User(int id, String name, int age) {
        this.id = id;
        this.name = name;
        this.age = age;
    }
    
    //省略get，set和toString
}
```

1. 获得类的名字

   ```java
           System.out.println(c1.getName());// 包名+类名
           System.out.println(c1.getSimpleName());// 类名
   ```

   输出：

   ```
   com.xuecheng.User
   User
   ```

2. 获得类的属性：

   ```java
           Field[] fields = c1.getFields();//只能找到public属性
           for (Field field : fields) {
               System.out.println(field);
           }
           Field[] declaredFields = c1.getDeclaredFields();
           for (Field declaredField : declaredFields) {
               System.out.println(declaredField);
           }
   
           // 获得指定属性的值
           System.out.println("----------------------------");
           Field name = c1.getDeclaredField("name");
           System.out.println(name);
   ```

   输出：

   ```
   ----------------------------
   private int com.xuecheng.User.id
   private java.lang.String com.xuecheng.User.name
   private int com.xuecheng.User.age
   ----------------------------
   private java.lang.String com.xuecheng.User.name
   ```

3. 获得类的方法

   ```java
           Method[] methods = c1.getMethods();//获得本类及其父类的方法
           for (Method method : methods) {
               System.out.println(method);
           }
           System.out.println("----------------------------");
           Method[] declaredMethods = c1.getDeclaredMethods();
           for (Method declaredMethod : declaredMethods) {
               System.out.println(declaredMethod);//获得本类的方法，包括私有
           }
           
           // 获得指定的方法
           System.out.println("----------------------------");
           Method getName = c1.getMethod("getName", null);
           Method setName = c1.getMethod("setName", String.class);
           System.out.println(getName);
           System.out.println(setName);
   ```

   输出：

   ```
   ----------------------------
   public java.lang.String com.xuecheng.User.getName()
   public void com.xuecheng.User.setName(java.lang.String)
   public int com.xuecheng.User.getId()
   public void com.xuecheng.User.setId(int)
   public int com.xuecheng.User.getAge()
   public void com.xuecheng.User.setAge(int)
   public final void java.lang.Object.wait(long,int) throws java.lang.InterruptedException
   public final native void java.lang.Object.wait(long) throws java.lang.InterruptedException
   public final void java.lang.Object.wait() throws java.lang.InterruptedException
   public boolean java.lang.Object.equals(java.lang.Object)
   public java.lang.String java.lang.Object.toString()
   public native int java.lang.Object.hashCode()
   public final native java.lang.Class java.lang.Object.getClass()
   public final native void java.lang.Object.notify()
   public final native void java.lang.Object.notifyAll()
   ----------------------------
   public java.lang.String com.xuecheng.User.getName()
   public void com.xuecheng.User.setName(java.lang.String)
   public int com.xuecheng.User.getId()
   public void com.xuecheng.User.setId(int)
   public int com.xuecheng.User.getAge()
   public void com.xuecheng.User.setAge(int)
   ----------------------------
   public java.lang.String com.xuecheng.User.getName()
   public void com.xuecheng.User.setName(java.lang.String)
   ```

4. 获得类的构造器

   ```java
           Constructor[] constructors = c1.getConstructors(); //获得公有
           for (Constructor constructor : constructors) {
               System.out.println(constructor);
           }
           Constructor[] declaredConstructors = c1.getDeclaredConstructors(); //获得所有
           for (Constructor declaredConstructor : declaredConstructors) {
               System.out.println(declaredConstructor);
           }
   
           // 获得指定构造器
           Constructor declaredConstructor = c1.getDeclaredConstructor(int.class, String.class, int.class);
           System.out.println(declaredConstructor);
   ```

   输出：

   ```
   public com.xuecheng.User()
   public com.xuecheng.User(int,java.lang.String,int)
   public com.xuecheng.User()
   public com.xuecheng.User(int,java.lang.String,int)
   public com.xuecheng.User(int,java.lang.String,int)
   ```



#### 2.4.2 通过反射实例化对象

1. 调用Class对象的`newInstance()`方法  

   1）类必须有一个无参数的构造器

   2）类的构造器的访问权限需要足够

```java
        Class c1 = Class.forName("com.xuecheng.User");
        User user = (User) c1.newInstance();
        System.out.println(user);
```

输出：

```
User{id=0, name='null', age=0}
```

2. 通过Class类的getDeclaredConstructor(Class... parameterTypes)取得本类的指定形参类型的构造器

```
        Class c1 = Class.forName("com.xuecheng.User");
        Constructor constructor = c1.getConstructor(int.class, String.class, int.class);
        User user = (User) constructor.newInstance(1, "Keith", 18);
        System.out.println(user);
```

输出：

```
User{id=1, name='Keith', age=18}
```



#### 2.4.3 通过反射调用实例化对象的方法

```java
//通过反射获取一个方法
Method setName = c1.getDeclaredMethod(name:"setName",String.class);
setName.invoke(user3,"狂神");
System.out.println(user3.getName());
```

`invoke`方法的第一个参数是类的对象，第二个参数是方法的参数



#### 2.4.4 通过反射操作实例化对象的属性

```java
        Class c1 = Class.forName("com.xuecheng.User");
        User user = (User) c1.newInstance();
        Field name = c1.getDeclaredField("name");
        name.setAccessible(true);
        name.set(user, "Keith");
        System.out.println(user.getName());
```

`setAccessible`：

- `Method`和`Field`、`Constructor`对象都有`setAccessible()`方法。
- `setAccessible()`作用是启动和禁用访问安全检查的开关。
- 参数值为`true`则指示反射的对象在使用时应该取消Java语言访问检查
  - 提高反射的效率。如果代码中必须用反射，而该句代码需要频繁的被调用，那么请设置为`true`。
  - 使得原本无法访问的私有成员也可以访问
- 参数值为`false`则指示反射的对象应该实施Java语言访问检查



### 2.5 反射获取注解信息

**示例：**实现简易ORM（Object relationship Mapping，对象关系映射）

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@interface myTable {
    String value();
}

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@interface tableField {
    String columnName();

    String type();

    int length();
}

@Data
@RequiredArgsConstructor
@myTable("user_table")
class User {
    @tableField(columnName = "id", type = "int", length = 10)
    private int id;
    @tableField(columnName = "name", type = "String", length = 10)
    private String name;
    @tableField(columnName = "age", type = "int", length = 10)
    private int age;
}
```

```java
public class ReflectionTest03 {
    public static void main(String[] args) throws Exception {
        Class c1 = Class.forName("com.xuecheng.User");
        //Annotation annotation = c1.getAnnotation(myTable.class);强制类型转换
        myTable myTable = (myTable) c1.getAnnotation(myTable.class);
        String value = myTable.value();
        System.out.println(value);
        
        System.out.println("------------------");
        Field name = c1.getDeclaredField("name");
        tableField nameAnnotation = name.getAnnotation(tableField.class);
        System.out.println(nameAnnotation.columnName());
        System.out.println(nameAnnotation.type());
        System.out.println(nameAnnotation.length());
    }
}
```

输出：

```
user_table
------------------
name
String
10
```
