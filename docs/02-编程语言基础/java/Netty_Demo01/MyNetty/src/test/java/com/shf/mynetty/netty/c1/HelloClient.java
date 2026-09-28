package com.shf.mynetty.netty.c1;

import io.netty.bootstrap.Bootstrap;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.nio.NioSocketChannel;
import io.netty.handler.codec.string.StringEncoder;
import lombok.SneakyThrows;

import java.net.InetSocketAddress;

/**
 * channel 数据的传输通道
 * msg 流动的数据，最开始是ByteBuf，但经过pipeline的加工，会变成其他类型对象，最后又变成ByteBuf
 * <p>
 * 把 handler 理解为数据的处理工序
 * 1. 工序有多道，合在一起就是pipeline，pipeline负责发布事件（读、读取完成）传播给每个handler，handler对自己感兴趣的事件进行处理（重写了相应事件的处理方法）
 * 2. handler分为 Inbound和OutBound两类
 * <p>
 * 把 eventLoop 理解为处理数据的工人
 * 1. 工人可以管理多个channel的io操作，并且一旦工人负责了某个channel，就需要负责到底（绑定）
 * 2. 工人既可以执行io操作，也可也进行任务处理，每位工人有任务队列，队列里可以堆放多个channel的待处理任务，任务分为普通任务、定时任务
 * 3. 工人按照pipeline顺序，依次按照handler的规划（代码） 处理数据，可以为每道工序指定不同的工人
 */
public class HelloClient {
    @SneakyThrows
    public static void main(String[] args) {
//        1. 启动类
        new Bootstrap()
//                2. 添加EventLoop
                .group(new NioEventLoopGroup())
//                3. 选择客户端 channel 实现
                .channel(NioSocketChannel.class)
                .handler(new ChannelInitializer<NioSocketChannel>() {
                    @Override // 在连接建立后被调用
                    protected void initChannel(NioSocketChannel nioSocketChannel) throws Exception {
                        nioSocketChannel.pipeline().addLast(new StringEncoder());
                    }
                })
//                5. 连接到服务器
                .connect(new InetSocketAddress("localhost", 8080))
//                阻塞方法，直到连接建立
                .sync()
//                代表连接对象
                .channel()
//                6. 向服务器发送数据
                .writeAndFlush("hello, world")
        ;

    }
}
