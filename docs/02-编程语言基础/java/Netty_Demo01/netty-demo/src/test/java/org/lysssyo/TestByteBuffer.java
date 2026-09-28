package org.lysssyo;

import lombok.extern.slf4j.Slf4j;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;


@Slf4j
public class TestByteBuffer {
    public static void main(String[] args) {
        try(FileChannel channel = new FileInputStream("test.txt").getChannel()) {
            ByteBuffer buffer = ByteBuffer.allocate(1024);
            while (channel.read(buffer) != -1){
                log.debug("read {} bytes", buffer.remaining());
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

    }
}
