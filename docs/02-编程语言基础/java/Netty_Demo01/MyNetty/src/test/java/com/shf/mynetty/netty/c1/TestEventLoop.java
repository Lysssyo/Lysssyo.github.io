package com.shf.mynetty.netty.c1;

import io.netty.channel.DefaultEventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;

import java.util.concurrent.TimeUnit;

public class TestEventLoop {
    public static void main(String[] args) {
//        1. 创建事件循环数组
        NioEventLoopGroup group = new NioEventLoopGroup(2);
        DefaultEventLoopGroup group1 = new DefaultEventLoopGroup();

//        2. 获取下一个事件循环对象
        System.out.println(group.next());
        ;
        System.out.println(group.next());
        ;
        System.out.println(group.next());
        ;
        System.out.println(group.next());
        ;

//        3. 执行普通任务
        group.next().submit(() -> {
            try {
                Thread.sleep(1000);
                System.out.println("submit");
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        });

//        4. 执行定时任务
        group.next().scheduleAtFixedRate(() -> {
            System.out.println("scheduleAtFixedRate");
        }, 0, 1, TimeUnit.SECONDS);

    }
}
