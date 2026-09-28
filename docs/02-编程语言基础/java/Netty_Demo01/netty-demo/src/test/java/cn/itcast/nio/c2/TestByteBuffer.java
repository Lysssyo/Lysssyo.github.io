package cn.itcast.nio.c2;

import lombok.extern.slf4j.Slf4j;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.Buffer;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;

import static cn.itcast.nio.c2.ByteBufferUtil.debugAll;

@Slf4j
public class TestByteBuffer {

    public static void main(String[] args) throws IOException {
        Files.walkFileTree(Paths.get("/Users/heqiguang/knowledge_base/knowledge_base/Netty_Demo01/netty-demo/target"), new SimpleFileVisitor<Path>() {

            @Override
            public FileVisitResult preVisitDirectory(Path dir,   BasicFileAttributes attrs) throws IOException {
                System.out.println("===================>>" + dir);
                return super.preVisitDirectory(dir, attrs);
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                System.out.println("===>>" + file);
                return super.visitFile(file, attrs);
            }
        });
    }
}
