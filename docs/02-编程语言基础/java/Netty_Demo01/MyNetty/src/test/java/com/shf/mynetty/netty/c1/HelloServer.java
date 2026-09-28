package com.shf.mynetty.netty.c1;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.channel.socket.nio.NioSocketChannel;
import io.netty.handler.codec.string.StringDecoder;

public class HelloServer {
    public static void main(String[] args) {
//        1. 启动器，负责组装 netty 组件，启动服务器
        new ServerBootstrap()
//                2.BossEventLoop，WorkerEventLoop(selector,thread)
                .group(new NioEventLoopGroup())
//                3. 选择 服务器的 serverSocketChannel 实现
                .channel(NioServerSocketChannel.class) // OIO BIO
//                4. boss 负责处理连接 worker(child) 负责处理读写，决定了 worker(child) 能执行那些操作(handler)
                .childHandler(
//                        5. channel代表和客户端进行数据读写的通道Initializer 初始化，负责添加别的handler
                        new ChannelInitializer<NioSocketChannel>() {
                            @Override
                            protected void initChannel(NioSocketChannel nioSocketChannel) throws Exception {
                                nioSocketChannel.pipeline().addLast(new StringDecoder()); // 将ByteBuf 转换为字符串
                                nioSocketChannel.pipeline().addLast(new ChannelInboundHandlerAdapter() { // 自定义handler
                                    @Override // 读事件
                                    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
                                        System.out.println(msg);
                                    }
                                });
                            }
                        })
                .bind(8080);
    }
}
