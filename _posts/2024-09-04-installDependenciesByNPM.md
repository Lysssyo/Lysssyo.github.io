---
title: vue项目下载依赖报错解决方法
date: 2024-09-4 9:05:00 +0800
categories: [前端, 包管理]
tags: [npm, yarn,前端]
---
一般使用npm通过`npm install`下载依赖，如果下载依赖报错，删除`node_modules`重新下载。

- 可以选择其他版本的npm进行下载：

```shell
#运行以下命令检查 Node.js 和 npm 的版本，确保它们已经更新
node --version
npm --version
#选用其他版本的npm，以14为例
nvm install 14
nvm use 14
```

- 也可以选择用yarn下载

```shell
#确保已经下载了yarn
yarn --version
#使用yarn进行下载
yarn install
```



