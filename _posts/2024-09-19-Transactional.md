---
title: 事务
date: 2024-09-19 10:11:00 +0800
categories: [Java, JavaWeb]
tags: [Java, JavaWeb,事务]
---
## 1. 简介

**事务**是一组操作的集合，它是一个不可分割的工作单位。事务会把所有的操作作为一个整体，一起向数据库提交或者是撤销操作请求。所以这组操作要么同时成功，要么同时失败。

## 2. 常见属性

### 2.1 异常回滚rollbackFor

默认情况下，**只有出现RuntimeException(运行时异常)才会回滚事务**。假如我们想让所有的异常都回滚，需要来配置@Transactional注解当中的rollbackFor属性，通过rollbackFor这个属性可以指定出现何种异常类型回滚事务。

```java
@Slf4j
@Service
public class DeptServiceImpl implements DeptService {
    @Autowired
    private DeptMapper deptMapper;

    @Autowired
    private EmpMapper empMapper;

    
    @Override
    @Transactional(rollbackFor=Exception.class)
    public void delete(Integer id){
        //根据部门id删除部门信息
        deptMapper.deleteById(id);
        
        //模拟：异常发生
        int num = id/0;

        //删除部门下的所有员工信息
        empMapper.deleteByDeptId(id);   
    }
}
```

### 2.2 事务传播propagation

这个属性是用来配置事务的传播行为的。

| **属性值**    | **含义**                                                     |
| ------------- | ------------------------------------------------------------ |
| REQUIRED      | 【默认值】需要事务，有则加入，无则创建新事务                 |
| REQUIRES_NEW  | 需要新事务，无论有无，总是创建新事务                         |
| SUPPORTS      | 支持事务，有则加入，无则在无事务状态中运行                   |
| NOT_SUPPORTED | 不支持事务，在无事务状态下运行,如果当前存在已有事务,则挂起当前事务 |
| MANDATORY     | 必须有事务，否则抛异常                                       |
| NEVER         | 必须没事务，否则抛异常                                       |

**示例：**解散部门需要记录操作日志，无论是否解散成功

```java
@Slf4j
@Service
//@Transactional //当前业务实现类中的所有的方法，都添加了spring事务管理机制
public class DeptServiceImpl implements DeptService {
    @Autowired
    private DeptMapper deptMapper;
    
    @Autowired
    private EmpMapper empMapper;

    @Autowired
    private DeptLogService deptLogService;


    //根据部门id，删除部门信息及部门下的所有员工
    @Override
    @Log
    @Transactional(rollbackFor = Exception.class,propagation = Propagation.REQUIRES_NEW) 
    // propagation = Propagation.REQUIRES_NEW 事务传播行为：不论是否有事务，都新建事务
    public void delete(Integer id) throws Exception {
        try {
            //根据部门id删除部门信息
            deptMapper.deleteById(id);
            //模拟：异常
            if(true){
                throw new Exception("出现异常了~~~");
            }
            //删除部门下的所有员工信息
            empMapper.deleteByDeptId(id);
        }finally {
            //不论是否有异常，最终都要执行的代码：记录日志
            DeptLog deptLog = new DeptLog();
            deptLog.setCreateTime(LocalDateTime.now());
            deptLog.setDescription("执行了解散部门的操作，此时解散的是"+id+"号部门");
            //调用其他业务类中的方法
            deptLogService.insert(deptLog);
        }
    }
    
    //省略其他代码...
}
```

如果`@Transactional`注解不配置`propagation`为`REQUIRES_NEW`，那么默认会加入原有的事务，即`propagation`默认为`REQUIRED`，所以，如果`empMapper.deleteByDeptId(id);`出错，会直接回滚，无法记录日志：

![image-20240919085804368](/assets/事务.assets/image-20240919085804368.png)

而配置`propagation`为`REQUIRES_NEW`后：

![image-20240919085923816](/assets/事务.assets/image-20240919085923816.png)

那此时，DeptServiceImpl中的delete方法运行时，会开启一个事务。 当调用  deptLogService.insert(deptLog)  时，也会创建一个新的事务，当insert方法运行完毕之后，事务就已经提交了。 即使外部的事务出现异常，内部已经提交的事务，也不会回滚了，因为是两个独立的事务。

## 3. 事务失效

有如下业务：

```java
// MediaFileServiceImpl类
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

`uploadFile`方法上添加`@Transactional`，当调用`uploadFile`方法前会开启数据库事务，如果上传文件过程时间较长那么数据库的事务持续时间就会变长，这样数据库链接释放就慢，最终导致数据库链接不够用。

我们只将`addMediaFilesToDb`方法添加事务控制即可,`uploadFile`方法上的`@Transactional`注解去掉。

即：

```java
    @Override
    public UploadFileResultDto uploadFile(Long companyId, UploadFileParamsDto uploadFileParamsDto, String localFilePath) {
    	// ...省略其他代码
        //将文件信息存储到数据库
        MediaFiles mediaFiles = addMediaFilesToDb(companyId, fileMd5, uploadFileParamsDto, bucket_File, objectName);
        //准备返回数据
        UploadFileResultDto uploadFileResultDto = new UploadFileResultDto();
        BeanUtils.copyProperties(mediaFiles, uploadFileResultDto);
        return uploadFileResultDto;

    }

// addMediaFilesToDb
    @Transactional
    public MediaFiles addMediaFilesToDb(Long companyId, String fileMd5, UploadFileParamsDto uploadFileParamsDto, String bucket, String objectName) {
        // 省略
        return mediaFiles;

    }
```

但是，**这样做事务会失效**。原因：**非事务方法调同类一个事务方法，事务无法控制。**只有通过代理对象调用方法，且此方法上添加了@Transactional注解，才能进行事务控制

具体分析如下：

在uploadFile方法上添加@Transactional注解，代理对象执行此方法前会开启事务，如下图：

<img src="/assets/事务.assets/image-20240919090837294.png" alt="image-20240919090837294" style="zoom: 67%;" />

如果在uploadFile方法上没有@Transactional注解，代理对象执行此方法前不进行事务控制，如下图：

<img src="/assets/事务.assets/image-20240919090905285.png" alt="image-20240919090905285" style="zoom:67%;" />

`addMediaFilesToDb`上添加`@Transactional`注解，也不会进行事务控制是因为**并不是通过代理对象**执行的`addMediaFilesToDb`方法。

> ​	为了判断在uploadFile方法中去调用addMediaFilesToDb方法是否是通过代理对象去调用，我们可以打断点跟踪。
>
> <img src="/assets/事务.assets/image-20240919091117701.png" alt="image-20240919091117701" style="zoom:67%;" />
>
> 可以发现，并不是通过`Proxy`去调用

**解决方式：**通过代理对象去调用addMediaFilesToDb方法即可解决。

在MediaFileService的实现类中注入MediaFileService的代理对象，如下：

```java
@Autowired
MediaFileService currentProxy;
```

将addMediaFilesToDb方法提成接口：

```java
// MediaFileServiceImpl类的接口MediaFileService
/**
 * @description 将文件信息添加到文件表
 * @param companyId  机构id
 * @param fileMd5  文件md5值
 * @param uploadFileParamsDto  上传文件的信息
 * @param bucket  桶
 * @param objectName 对象名称
 * @return com.xuecheng.media.model.po.MediaFiles
 * @author Mr.M
 * @date 2022/10/12 21:22
 */

public MediaFiles addMediaFilesToDb(Long companyId,String fileMd5,UploadFileParamsDto uploadFileParamsDto,String bucket,String objectName);
```

调用addMediaFilesToDb方法的代码处改为如下：

```Java
.....
//写入文件表
MediaFiles mediaFiles = currentProxy.addMediaFilesToDb(companyId, fileMd5, uploadFileParamsDto, bucket_files, objectName);
 ....
```

![image-20240919092809190](/assets/事务.assets/image-20240919092809190.png)

