---
title: 上传文件至Minio，上传文件信息至数据库
date: 2024-09-11 20:52:00 +0800
categories: [Java, JavaWeb]
tags: [Java, JavaWeb]
---
## 1. 业务要求

### 1.1 接口定义

前端系统需向后端服务发起文件上传请求，采用 `multipart/form-data` 格式传输。具体要求如下：

1. **请求方式**：前端通过 HTTP POST 请求上传文件。
2. **接口路径**：`{{media_host}}/media/upload/coursefile`
3. **请求头**：
   - `Content-Type`: `multipart/form-data`，并包含特定的 `boundary` 分隔符（如：`WebAppBoundary`）。
4. **请求体**：包含表单数据**`Content-Disposition:form-data`**
   - 表单项名称`name`：命名为`filedata`
   - 文件名`filename`：根据实际情况
   - 文件内容类型`Content-Type`：`application/octet-stream`（用于表示任意二进制数据）。

---

示例请求：

```
POST {{media_host}}/media/upload/coursefile
Content-Type: multipart/form-data; boundary=WebAppBoundary

--WebAppBoundary
Content-Disposition: form-data; name="filedata"; filename="1.png"
Content-Type: application/octet-stream

< C:/Users/Lysssyo/Desktop/temp/JSR303校验.assets/image-20240911093214047.png
```

更加详尽的介绍见附1。

### 1.2 前端向controller传递的参数

1. 文件。后端以`MultipartFile`接收前端传递的表单中的文件
2. 文件名。后端可以通过`MultipartFile`的`getOriginalFilename()`方法获取文件名

### 1.3 service向Minio传入文件的格式

1. 根据文件类型，传入名为`mediafiles`或`video`的`bucket`

2. 假设要传入的文件为图片，图片原始名为`image-20240911093214047.png`，在表单项中设置`filename`为`1.png`，那么，在Minio的`bucket`中，文件名为`{}.png,图片的md5值`。并且，图片位于`bucket`的的`year`目录下的`month`目录下的`day`中。

   例如：图片原始名为`image-20240911093214047.png`，图片md5的值为`a6d87d1db041d4e8b35a8107065e9f4d`，图片在2024年9月12日上传，所以，图片的存放目录及命名为：

   ![image-20240912195733335](/assets/上传文件至Minio，上传文件信息至数据库.assets/image-20240912195733335.png)

### 1.4 service向数据库传入的文件信息

需要将文件信息写入数据库中的`media_files`表中：

<img src="/assets/上传文件至Minio，上传文件信息至数据库.assets/image-20240912201351765.png" alt="image-20240912201351765" style="zoom:67%;" />

- `id`由service传递根据具体文件生成

- `company_id`由Controller向service传递

- `filename`由Controller封装到`uploadFileParamsDto`向service传递

- `file_type`由Controller封装到`uploadFileParamsDto`向service传递

- `bucket`通过`@Value`注入service，绑定到service的`private String bucket_File`参数

- `file_path`为传入bucket的子目录加文件的md5的值

  例如：`2022/10/07/33c643206bb7c08e2cb99b622d7a1b63.png`

- `file_id`为文件md5的值

- url为`/bucket名`+`file_path`

  例如：`/mediafiles/2022/10/07/33c643206bb7c08e2cb99b622d7a1b63.png`。前端可以根据Minio的hostName+port+url得到图片的访问地址：例如`localhost:9090/mediafiles/2022/10/07/33c643206bb7c08e2cb99b622d7a1b63.png`

- `create_time`创建时间

- `status`设为`1`

- `audit_status`设为`002003`

- `file_size`由Controller封装到`uploadFileParamsDto`向service传递

### 1.5 service向Controller返回的参数

返回数据库表所有字段。



## 2. 具体实现

### 2.1 Controller层

```java
    @ApiOperation("上传文件")
    @RequestMapping(value = "/upload/coursefile", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    public UploadFileResultDto upload(@RequestPart("filedata") MultipartFile filedata) throws IOException {
        Long companyId = 1232141425L;
        UploadFileParamsDto uploadFileParamsDto = new UploadFileParamsDto();
        // 文件大小
        uploadFileParamsDto.setFileSize(filedata.getSize());
        // 图片
        uploadFileParamsDto.setFileType("001001");
        // 文件名称
        uploadFileParamsDto.setFilename(filedata.getOriginalFilename());
        // 创建临时文件
        
        File tempFile = File.createTempFile("minio", "temp");
        // 上传的文件拷贝到临时文件
        filedata.transferTo(tempFile);
        // 文件路径
        String absolutePath = tempFile.getAbsolutePath();
        // 上传文件
        UploadFileResultDto uploadFileResultDto = mediaFileService
            .uploadFile(companyId, uploadFileParamsDto, absolutePath);
        return uploadFileResultDto;
    }
```

1. `consumes` 属性用于指定该方法可以处理的**请求内容类型**（Content-Type），即客户端发送的请求数据类型。`MediaType.MULTIPART_FORM_DATA_VALUE` 是 Spring 提供的常量，代表 `multipart/form-data`，用于处理表单上传文件的请求。

2. 当前端通过 `multipart/form-data` 上传文件时，Spring MVC 会将表单中的文件字段映射为 `MultipartFile` 对象，你可以通过这个对象来处理文件。

   **主要方法：**

   - `getOriginalFilename()`：获取上传文件的原始文件名（即表单中`filename`设置的值）。
   - `getContentType()`：获取文件的 MIME 类型（例如 `image/jpeg`、`application/pdf` 等）。
   - `getBytes()`：将文件内容作为字节数组返回。
   - `getInputStream()`：获取文件内容的输入流。
   - `transferTo(File dest)`：将上传的文件保存到目标位置。

3. controller没有直接把`filedata`传递给service，而是创建临时文件，把filedata拷贝给临时文件`tempFile`，再把临时文件的路径`absolutePath`传递给service：

   ```java
           // 创建临时文件
           File tempFile = File.createTempFile("minio", "temp");
           // 上传的文件拷贝到临时文件
           filedata.transferTo(tempFile);
   ```

   该文件存放在系统的临时文件目录中，通常位于 `/tmp`（在 Unix 系统上）或 `C:\Users\<username>\AppData\Local\Temp`（在 Windows 系统上）。文件名将由指定的 `prefix` 和 `suffix` 以及一个唯一的数字组成，以确保文件名唯一。

   ![image-20240912203009863](/assets/上传文件至Minio，上传文件信息至数据库.assets/image-20240912203009863.png)

4. controller返回的类型为`UploadFileResultDto`，其实就是数据库表的字段，但是，为了扩展，设置为了DTO

   ```java
   @Data
   public class UploadFileResultDto extends MediaFiles { //MediaFiles类对应meida_files
   
   
   }
   ```

### 2.2 service层

主要实现上传文件至Minio以及数据库表的写入。

```java
    @Override
    public UploadFileResultDto uploadFile(Long companyId, UploadFileParamsDto uploadFileParamsDto, String localFilePath) {
        File file = new File(localFilePath);
        if (!file.exists()) {
            XueChengPlusException.cast("文件不存在");
        }
        //文件名称
        String filename = uploadFileParamsDto.getFilename();
        //文件扩展名
        String extension = filename.substring(filename.lastIndexOf("."));
        //文件mimeType
        String mimeType = getMimeType(extension);
        //文件的md5值
        String fileMd5 = getFileMd5(file);
        //文件的默认目录
        String defaultFolderPath = getDefaultFolderPath();
        //存储到minio中的对象名(带目录)
        String objectName = defaultFolderPath + fileMd5 + extension;
        //将文件上传到minio
        boolean b = addMediaFilesToMinIO(localFilePath, mimeType, bucket_File, objectName);
        //文件大小
        uploadFileParamsDto.setFileSize(file.length());
        //将文件信息存储到数据库
        MediaFiles mediaFiles = addMediaFilesToDb(companyId, fileMd5, uploadFileParamsDto, bucket_File, objectName);
        //准备返回数据
        UploadFileResultDto uploadFileResultDto = new UploadFileResultDto();
        BeanUtils.copyProperties(mediaFiles, uploadFileResultDto);
        return uploadFileResultDto;

    }
```

1. `String mimeType = getMimeType(extension);`

   获取文件扩展名是为了调用`getMimeType`方法，获取文件的`mimeType`。因为，上传文件到Minio如果手动指定`mimeType`可以增强稳定性。

   给出上传文件至miniO的基础代码：

   ```java
   @Test
   public void upload() {
       //根据扩展名取出mimeType
       ContentInfo extensionMatch = ContentInfoUtil.findExtensionMatch(".jpg");
       String mimeType = MediaType.APPLICATION_OCTET_STREAM_VALUE; //通用mimeType，字节流
       if (extensionMatch != null) {
           mimeType = extensionMatch.getMimeType();
       }
       try {
           UploadObjectArgs testbucket = UploadObjectArgs.builder()
                   .bucket("mediafiles")
                   .object("2024/1/2/LearningJava1.jpg")
                   .filename("D:\\AAA_SecondDesktop\\A_Technology\\Java\\LearningJava.md")
                   .contentType(mimeType) //默认根据扩展名确定文件内容类型，也可以指定
                   .build();
           minioClient.uploadObject(testbucket);
           System.out.println("mimeType=" + mimeType);
           System.out.println("上传成功");
       } catch (Exception e) {
           e.printStackTrace();
           System.out.println("上传失败");
       }
   }
   ```

   给出`getMimeType`方法：

   ```java
       private String getMimeType(String extension) {
           if (extension == null)
               extension = ""; // 如果是null就给一个空字符串，因为空字符串传入下面的方法会报错
           //根据扩展名取出mimeType
           ContentInfo extensionMatch = ContentInfoUtil.findExtensionMatch(extension);
           //通用mimeType，字节流
           String mimeType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
           if (extensionMatch != null) {
               mimeType = extensionMatch.getMimeType();
           }
           return mimeType;
       }
   ```

2. `String fileMd5 = getFileMd5(file);`

   文件的md5值的值是唯一的，以文件的md5值作为数据库表的id字段，可以在插入新的文件信息到数据库表时，检查这个文件信息是否已经插入过了。此外，`objectName`中带有md5的值，可以保证存入minio的文件不会重名

   ```java
       //获取文件的md5
       private String getFileMd5(File file) {
           try (FileInputStream fileInputStream = new FileInputStream(file)) {
               String fileMd5 = DigestUtils.md5Hex(fileInputStream);
               return fileMd5;
           } catch (Exception e) {
               e.printStackTrace();
               return null;
           }
       }
   ```

3. `String defaultFolderPath = getDefaultFolderPath();`

   ```java
       //获取文件默认存储目录路径 年/月/日
       private String getDefaultFolderPath() {
           SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
           String folder = sdf.format(new Date()).replace("-", "/") + "/";
           return folder;
       }
   ```

   用于构造文件存入bucket的子文件夹。例如`2022/10/07/33c643206bb7c08e2cb99b622d7a1b63.png`

4. `addMediaFilesToMinIO()`

   ```java
       public boolean addMediaFilesToMinIO(String localFilePath, String mimeType, String bucket, String objectName) {
           try {
               UploadObjectArgs testbucket = UploadObjectArgs.builder()
                       .bucket(bucket)
                       .object(objectName)
                       .filename(localFilePath)
                       .contentType(mimeType)
                       .build();
               minioClient.uploadObject(testbucket);
               log.debug("上传文件到minio成功,bucket:{},objectName:{}", bucket, objectName);
               System.out.println("上传成功");
               return true;
           } catch (Exception e) {
               e.printStackTrace();
               log.error("上传文件到minio出错,bucket:{},objectName:{},错误原因:{}", bucket, objectName, e.getMessage(), e);
               XueChengPlusException.cast("上传文件到文件系统失败");
           }
           return false;
       }
   ```

5. `addMediaFilesToDb()`

   ```java
       public MediaFiles addMediaFilesToDb(Long companyId, String fileMd5, UploadFileParamsDto uploadFileParamsDto, String bucket, String objectName) {
           //从数据库查询文件
           MediaFiles mediaFiles = mediaFilesMapper.selectById(fileMd5);
           if (mediaFiles == null) {
               mediaFiles = new MediaFiles();
               //拷贝基本信息
               BeanUtils.copyProperties(uploadFileParamsDto, mediaFiles);
               mediaFiles.setId(fileMd5);
               mediaFiles.setFileId(fileMd5);
               mediaFiles.setCompanyId(companyId);
               mediaFiles.setUrl("/" + bucket + "/" + objectName);
               mediaFiles.setBucket(bucket);
               mediaFiles.setFilePath(objectName);
               mediaFiles.setCreateDate(LocalDateTime.now());
               mediaFiles.setAuditStatus("002003");
               mediaFiles.setStatus("1");
               //保存文件信息到文件表
               int insert = mediaFilesMapper.insert(mediaFiles);
               if (insert < 0) {
                   log.error("保存文件信息到数据库失败,{}", mediaFiles.toString());
                   XueChengPlusException.cast("保存文件信息失败");
               }
               log.debug("保存文件信息到数据库成功,{}", mediaFiles.toString());
   
           }
           return mediaFiles;
   
       }
   ```



## 附1. 提交表单详解

上传文件的原始form表单，要求表单必须具备以下三点（上传文件页面三要素）：

- 表单必须有file域，用于选择要上传的文件

  > ~~~html
  > <input type="file" name="image"/>
  > ~~~

- 表单提交方式必须为POST

  > 通常上传的文件会比较大，所以需要使用 POST 提交方式

- 表单的编码类型enctype必须要设置为：**multipart/form-data**

  > 普通默认的编码格式是不适合传输大型的二进制数据的，所以在文件上传时，表单的编码格式必须设置为multipart/form-data

例如：

```xml
<form action="/upload" method="post" enctype="multipart/form-data">
	姓名: <input type="text" name="username"><br>
    年龄: <input type="text" name="age"><br>
    头像: <input type="file" name="image"><br>
    <input type="submit" value="提交">
</form>
```

> `enctype`用于指定编码格式，必须是`multipart/form-data`

当提交表单后，浏览器请求情况如下：

![image-20240912193833280](/assets/上传文件至Minio，上传文件信息至数据库.assets/image-20240912193833280.png)

![image-20240912193844845](/assets/上传文件至Minio，上传文件信息至数据库.assets/image-20240912193844845.png)

`Content-Type`中指定的分隔符`boundary`用于分割提交的表单数据，在请求体（请求有效载荷`payload`）中，每一个表单项都以`boundary`开始。并且，每一个表单项都会指定`Content-Disposition`为`form-data`
