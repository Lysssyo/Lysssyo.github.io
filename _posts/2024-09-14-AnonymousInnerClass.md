---
title: 匿名内部类
date: 2024-09-14 22:52:00 +0800
categories: [Java, Grammar]
tags: [Java, Grammar]
---
## 1. 什么是匿名内部类

匿名内部类（Anonymous Inner Class）是 Java 中的一种特殊类型的内部类，**没有显式地命名类名**，而是通过在实例化时直接**定义并实现接口或继承类**。匿名内部类通常用于简化代码，尤其是在需要**一次性实现某个接口或类的功能**时，而无需专门创建一个独立的类文件。

> 匿名内部类就是没有名字的类，这个类不会单独地写一个java文件声明，而是在创建对象时声明

## 2. 为什么要使用匿名内部类

在开发过程中，我们经常需要实现接口或继承类，但这些实现只在特定场景下使用一次。为此专门创建一个新的类会显得繁琐且增加代码量。匿名内部类允许我们直接在需要的地方定义和使用该类的实例，减少了额外的类定义，使代码更紧凑、更易读。

## 3. 具体示例

### 3.1 不使用匿名内部类实现接口

假设我们有一个 `Animal` 接口和一个 `Owner` 类，`Owner` 类的方法需要接收一个 `Animal` 类型的参数：

```java
public interface Animal {
    void eat();
    void sleep();
}

public class Owner {
    public void playWithAnimal(Animal animal) {
        System.out.println("Owner loves animal.");
        System.out.println("You can see owner's pet is eating:");
        animal.eat();
    }
}
```

为了使用 `playWithAnimal` 方法，我们需要创建一个实现了 `Animal` 接口的类，例如 `Cat` 类：

```java
public class Cat implements Animal {
    @Override
    public void eat() {
        System.out.println("Cat is eating cat food.");
    }

    @Override
    public void sleep() {
        System.out.println("Cat doesn't sleep at night.");
    }
}

```

调用示例：

```java
    @Test
    void testInterfaceAsParam() {
        Owner owner = new Owner();
        owner.playWithAnimal(new Cat());
    }
```

输出：

```
Owner loves animal.
You can see owner's pet is eating:
Cat is eating cat food.
```



### 3.2 使用匿名内部类实现接口

我们可以使用匿名内部类来实现同样的功能，而无需专门定义 `Cat` 类。代码如下：

```java
    @Test
    void testAnonymousInnerClass() {
        Owner owner = new Owner();
        owner.playWithAnimal(new Animal() {
            @Override
            public void eat() {
                System.out.println("cat is eating cat food");
            }

            @Override
            public void sleep() {
                System.out.println("don't sleep at night");
            }
        });
    }
```

输出：

```
owner love animal
you can see owner's pet is eating:
cat is eating cat food
```

在这个例子中，匿名内部类直接实现了 `Animal` 接口，`animal`是匿名内部类的实例，省去了创建一个独立类文件的步骤。

如果`playWithAnimal`方法有多个参数呢，像这样：

```java
public class Owner {
    public void playWithAnimal(Animal animal, String s) {
        System.out.println("owner love animal");
        System.out.println("you can see owner's pet is Eating:");
        System.out.print(s);
        animal.eat();
    }
}
```

也很简单：

```java
    @Test
    void testAnonymousInnerClass() {

        Owner owner = new Owner();
        owner.playWithAnimal(new Animal() {
            @Override
            public void eat() {
                System.out.println("cat is eating cat food");
            }

            @Override
            public void sleep() {
                System.out.println("don't sleep at night");
            }
        }, "Look:");
    }
```

输出：

```
owner love animal
you can see owner's pet is eating:
Look:cat is eating cat food
```

### 3.3 匿名内部类的本质

在上面的匿名内部类中：

```java
new Animal() {
            @Override
            public void eat() {
                System.out.println("cat is eating cat food");
            }

            @Override
            public void sleep() {
                System.out.println("don't sleep at night");
            }
        }
```

实际上，这段代码等价于创建了 `Animal` 接口的一个**实现类实例**，只不过这个实现类是**匿名的**，没有明确的类名，它的定义直接嵌入到方法调用中。

## 4.匿名内部类的其他用途

### 4.1 作为非方法参数使用

上面的例子，是用匿名内部类实现接口，作为方法的参数传递给方法，实际上，匿名内部类不一定要是方法的参数

例如：

```java
    @Test
    void testAnonymousInnerClass2(){
        Animal animal=new Animal() {
            @Override
            public void eat() {
                System.out.println("cat is eating");
            }

            @Override
            public void sleep() {
                System.out.println("don't sleep at night");
            }
        };
        animal.eat();
    }
```

我们知道，接口没有对象。但是，上面的代码通过多态+匿名内部类的形式，调用了`Animal`接口的`animal`的eat方法，上面的代码等价于：

```java
public class Cat implements Animal {
    @Override
    public void eat() {
        System.out.println("cat is eating cat food");
    }

    @Override
    public void sleep() {
        System.out.println("don't sleep at night");
    }
}
```

```java
    @Test
    void testAnonymousInnerClass2(){
        Animal animal=new Cat();
        animal.eat();
    }
```

### 4.2 继承普通类或抽象类

此外，匿名内部类也不仅仅只能用于实现接口，还可以继承父类（抽象类以及普通父类）：

**继承普通类：**

```java
public class Cat {
    public void eat() {
        System.out.println("cat is eating cat food");
    }

    public void sleep() {
        System.out.println("cat doesn't sleep at night");
    }
}

@Test
void testAnonymousInnerClassInheritingClass() {
    Cat cat = new Cat() { // 匿名子类，重写父类的方法
        @Override
        public void eat() {
            System.out.println("cat is eating delicious cat food");
        }
    };
    cat.eat();
}
```

**继承抽象类：**

```java
abstract class Animal {
    public abstract void eat();
}

@Test
void testAnonymousInnerClassInheritingAbstractClass() {
    Animal animal = new Animal() {
        @Override
        public void eat() {
            System.out.println("cat is eating");
        }
    };
    animal.eat();
}
```

在这两种情况下，匿名内部类可以继承普通类或抽象类，并且可以重写父类的方法。对于抽象类，匿名内部类**必须实现所有抽象方法**。

