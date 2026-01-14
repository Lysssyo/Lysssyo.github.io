---
date created: 2026-01-14 20:23:05
date modified: 2026-01-14 23:56:46
---
# 响应头字段Content-Disposition

`Content-Disposition`是HTTP响应头字段，它告诉浏览器如何处理服务器返回的资源，主要控制是**内联显示**（`inline`）还是作为**附件下载**（`attachment`），并可以指定下载时的**默认文件名**，常用于文件下载和文件上传（`multipart/form-data`）。 

主要用途

1. **文件下载控制**
    - `inline`：建议浏览器在当前页面或新页面中直接打开内容（如PDF, 图像）。
    - `attachment`：强制浏览器弹出下载对话框，提示用户保存文件。
    - `filename="example.pdf"`：指定下载时文件的默认名称。
2. **文件上传**
    - 在`multipart/form-data`（文件上传请求）中，`Content-Disposition`用于标识每个数据部分是普通表单字段（`name="fieldname"`）还是文件（`name="fieldname"; filename="file.txt"`）。 

示例

- **强制下载**: `Content-Disposition: attachment; filename="report.pdf"`
	> [!TIP]
	> 即使**强制下载**，js代码也可以拿到数据，强制下载是强制浏览器下载
- **直接显示**: `Content-Disposition: inline; filename="image.jpg"`
- **上传字段**: 在`multipart/form-data`中，类似 `<input type="file" name="photo">` 对应的头信息会包含 `Content-Disposition: form-data; name="photo"; filename="myphoto.png"`。