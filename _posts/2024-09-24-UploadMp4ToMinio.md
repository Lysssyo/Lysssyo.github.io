---
title: Minio视频分块上传
date: 2024-09-24 13:56:00 +0800
categories: [中间件,Minio]
tags: [Minio, 文件分块上传,断点续传技术]
---

## 1. 断点续传技术

如图所示：

<img src="/assets/Minio视频分块上传.assets/image-20240924114034337.png" alt="image-20240924114034337" style="zoom:50%;" />

流程如下：

1. 前端上传前先把文件分成块

2. 一块一块地上传，上传中断后重新上传，已上传的分块则不用再上传

3. 各分块上传完成最后在服务端合并文件



## 2. 文件的分块与合并

**文件分块：**

```java
    //测试文件分块方法
    @Test
    public void testChunk() throws IOException {
        File sourceFile = new File("D:/AAA_SecondDesktop/A_Technology/Docker/images/nginx/nginx.tar");
        String chunkPath = "D:/AAA_SecondDesktop/A_Technology/Docker/images/nginx/chunk/";
        File chunkFolder = new File(chunkPath);
        if (!chunkFolder.exists()) {
            chunkFolder.mkdirs();
        }
        //分块大小
        long chunkSize = 6 * 1024 * 1024 * 1; //6MB
        //分块数量
        long chunkNum = (long) Math.ceil(sourceFile.length() * 1.0 / chunkSize);
        System.out.println("分块总数：" + chunkNum);
        //缓冲区大小
        byte[] b = new byte[1024]; //1KB
        //使用RandomAccessFile访问文件
        RandomAccessFile raf_read = new RandomAccessFile(sourceFile, "r");
        //分块
        /**
         * 分块的大小为1MB，缓冲区的大小为1KB，每次从缓冲区读，读够1KB就把下1KB的源文件放入缓冲区，
         * 如果分块文件已经接收的大小大于等于设置的分块大小，则新建一个分块，继续读
         */
        for (int i = 0; i < chunkNum; i++) {
            //创建分块文件
            File file = new File(chunkPath + i);
            if (file.exists()) {
                file.delete();
            }
            boolean newFile = file.createNewFile();
            if (newFile) {
                //向分块文件中写数据
                RandomAccessFile raf_write = new RandomAccessFile(file, "rw");
                int len = -1;
                while ((len = raf_read.read(b)) != -1) {
                    raf_write.write(b, 0, len);// 将字符数组b写入文件，从数组b的0索引开始写，写入len个字节
                    if (file.length() >= chunkSize) {
                        break;
                    }
                }
                raf_write.close();
                System.out.println("完成分块" + i);
            }

        }
        raf_read.close();

    }
```

首先计算需要分块的数量`chunkNum`，然后利用for循环`int i = 0; i < chunkNum; i++`，创建分块文件。

每个分块文件，都通过`RandomAccessFile raf_read`访问文件，把文件数据写入缓冲区，再通过`RandomAccessFile raf_write`向分块文件写入数据。

**文件合并：**

```java
    @Test
    public void testMerge() throws IOException {
        //块文件目录
        File chunkFolder = new File("D:/AAA_SecondDesktop/A_Technology/Docker/images/nginx/chunk/"); // 可以读到目录下所有文件
        //原始文件
        File originalFile = new File("D:/AAA_SecondDesktop/A_Technology/Docker/images/nginx/nginx.tar");
        //合并文件
        File mergeFile = new File("D:/AAA_SecondDesktop/A_Technology/Docker/images/nginx/nginx2.tar");
        if (mergeFile.exists()) {
            mergeFile.delete();
        }
        //创建新的合并文件
        boolean newFile = mergeFile.createNewFile();
        if (!newFile) {
            throw new IOException("文件创建失败");
        }
        //用于读写文件
        RandomAccessFile raf_write = new RandomAccessFile(mergeFile, "rw");
        //指针指向文件顶端
        raf_write.seek(0);
        //缓冲区
        byte[] b = new byte[6 * 1024]; //6*1KB
        //分块列表
        File[] fileArray = chunkFolder.listFiles();
        // 转成集合，便于排序
        List<File> fileList = Arrays.asList(fileArray);
        // 从小到大排序
        Collections.sort(fileList, new Comparator<File>() {
            @Override
            public int compare(File o1, File o2) {
                return Integer.parseInt(o1.getName()) - Integer.parseInt(o2.getName());
            }
        });
        //合并文件
        for (File chunkFile : fileList) {
            RandomAccessFile raf_read = new RandomAccessFile(chunkFile, "rw");
            int len = -1;
            while ((len = raf_read.read(b)) != -1) {
                raf_write.write(b, 0, len); // 将字符数组b写入文件，从数组b的0索引开始写，写入len个字节
            }
            raf_read.close();
        }
        raf_write.close();

        //校验文件
        try (
                FileInputStream fileInputStream = new FileInputStream(originalFile);
                FileInputStream mergeFileStream = new FileInputStream(mergeFile);

        ) {
            //取出原始文件的md5
            String originalMd5 = DigestUtils.md5Hex(fileInputStream);
            //取出合并文件的md5进行比较
            String mergeFileMd5 = DigestUtils.md5Hex(mergeFileStream);
            if (originalMd5.equals(mergeFileMd5)) {
                System.out.println("合并文件成功");
            } else {
                System.out.println("合并文件失败");
            }

        }
    }
```



## 3. 视频分块上传至Minio

```java
    static MinioClient minioClient =
            MinioClient.builder()
                    .endpoint("http://localhost:9000")
                    .credentials("minioadmin", "minioadmin")
                    .build();
    // 将分块文件上传至minio
    @Test
    public void uploadChunk() {
        String chunkFolderPath = "D:/AAA_SecondDesktop/A_Technology/Docker/images/nginx/chunk/";
        File chunkFolder = new File(chunkFolderPath);
        //分块文件
        File[] files = chunkFolder.listFiles();
        //将分块文件上传至minio
        for (int i = 0; i < Objects.requireNonNull(files).length; i++) { //  files.length 表示文件个数
            try {
                UploadObjectArgs uploadObjectArgs = UploadObjectArgs.builder()
                        .bucket("test")
                        .object("chunk/" + i)
                        .filename(files[i].getAbsolutePath())
                        .build();
                minioClient.uploadObject(uploadObjectArgs);
                System.out.println("上传分块成功" + i);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
```





## 4. Minio合并分块文件

```java
    // 合并文件，要求分块文件最小5M
    @Test
    public void test_merge() throws Exception {
        //Stream流写法
        List<ComposeSource> sources = Stream.iterate(0, i -> ++i)
                .limit(23)
                .map(i -> ComposeSource.builder()
                        .bucket("test")
                        .object("chunk/".concat(Integer.toString(i)))
                        .build())
                .collect(Collectors.toList());

        ComposeObjectArgs composeObjectArgs = ComposeObjectArgs.builder()
                .bucket("test")
                .object("nginx.tar")
                .sources(sources)
                .build();
        minioClient.composeObject(composeObjectArgs);
    }

    //清除分块文件
    @Test
    public void test_removeObjects() {
        //合并分块完成将分块文件清除
        List<DeleteObject> deleteObjects = Stream.iterate(0, i -> ++i)
                .limit(23)
                .map(i -> new DeleteObject("chunk/".concat(Integer.toString(i))))
                .collect(Collectors.toList());

        RemoveObjectsArgs removeObjectsArgs = RemoveObjectsArgs.builder()
                .bucket("test")
                .objects(deleteObjects)
                .build();
        
        Iterable<Result<DeleteError>> results = minioClient.removeObjects(removeObjectsArgs);
        results.forEach(r -> {
            DeleteError deleteError = null;
            try {
                deleteError = r.get();
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
```