---
title: Nginx配置文件解读
date: 2024-09-23 20:05:00 +0800
categories: [Nginx]
tags: [Nginx, 杂记]
---

```nginx
#user  nobody;
worker_processes  1;

#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;

#pid        logs/nginx.pid;


events {
    worker_connections  1024;
}


http {
    include       mime.types;
    default_type  application/octet-stream;

    #log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
    #                  '$status $body_bytes_sent "$http_referer" '
    #                  '"$http_user_agent" "$http_x_forwarded_for"';

    #access_log  logs/access.log  main;

    sendfile        on;
    #tcp_nopush     on;

    #keepalive_timeout  0;
    keepalive_timeout  65;

    #gzip  on;
	
	#文件服务上游服务器组，可以负载均衡
	upstream fileserver{
		server localhost:9000 weight=10;
	} 
	
	#网关
	upstream gatewayserver{
		server 127.0.0.1:63010 weight=10;
    } 
	
	#在 Nginx 配置中，server 是一个重要的指令块，用于定义一个虚拟主机的配置。每个 server 块可以包含特定的请求处理规则，如监听的端口、域名、请求路径以及其他相关配置。
	server {
        listen       80;
        server_name  file.51xuecheng.cn;
        #charset koi8-r;
        ssi on;
        ssi_silent_errors on;
        #access_log  logs/host.access.log  main;
        location /video {
            proxy_pass   http://fileserver;
        }

        location /mediafiles {
            proxy_pass   http://fileserver;
        }
	}

    server {
        listen       80;
        server_name  www.51xuecheng.cn localhost;

        #charset koi8-r;
		
        ssi on;
        ssi_silent_errors on;

        #access_log  logs/host.access.log  main;
		
		#api
        location /api/ {
            proxy_pass http://gatewayserver/;
        } 
		
		location /course/ {  
			proxy_pass http://fileserver/mediafiles/course/;
		} 

        location / {
            alias   D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal/;
            index  index.html index.htm;
        }
		#openapi
		location /open/content/ {
				proxy_pass http://gatewayserver/content/open/;
		} 
		location /open/media/ {
				proxy_pass http://gatewayserver/media/open/;
		} 
        #静态资源
        location /static/img/ {  
                alias  D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal/img/;
        } 
        location /static/css/ {  
                alias   D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal/css/;
        } 
        location /static/js/ {  
                alias   D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal/js/;
        } 
        location /static/plugins/ {  
                alias   D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal/plugins/;
                add_header Access-Control-Allow-Origin http://ucenter.51xuecheng.cn;  
                add_header Access-Control-Allow-Credentials true;  
                add_header Access-Control-Allow-Methods GET;
        } 
        location /plugins/ {  
                alias   D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal/plugins/;
        } 
		
		location /course/preview/learning.html {
                alias D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal/course/learning.html;
        } 
        location /course/search.html {  
                root   D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal;
        } 
        location /course/learning.html {  
                root   D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal;
        } 

        #error_page  404              /404.html;

        # redirect server error pages to the static page /50x.html
        #
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }

        # proxy the PHP scripts to Apache listening on 127.0.0.1:80
        #
        #location ~ \.php$ {
        #    proxy_pass   http://127.0.0.1;
        #}

        # pass the PHP scripts to FastCGI server listening on 127.0.0.1:9000
        #
        #location ~ \.php$ {
        #    root           html;
        #    fastcgi_pass   127.0.0.1:9000;
        #    fastcgi_index  index.php;
        #    fastcgi_param  SCRIPT_FILENAME  /scripts$fastcgi_script_name;
        #    include        fastcgi_params;
        #}

        # deny access to .htaccess files, if Apache's document root
        # concurs with nginx's one
        #
        #location ~ /\.ht {
        #    deny  all;
        #}
    }


    # another virtual host using mix of IP-, name-, and port-based configuration
    #
    #server {
    #    listen       8000;
    #    listen       somename:8080;
    #    server_name  somename  alias  another.alias;

    #    location / {
    #        root   html;
    #        index  index.html index.htm;
    #    }
    #}


    # HTTPS server
    #
    #server {
    #    listen       443 ssl;
    #    server_name  localhost;

    #    ssl_certificate      cert.pem;
    #    ssl_certificate_key  cert.key;

    #    ssl_session_cache    shared:SSL:1m;
    #    ssl_session_timeout  5m;

    #    ssl_ciphers  HIGH:!aNULL:!MD5;
    #    ssl_prefer_server_ciphers  on;

    #    location / {
    #        root   html;
    #        index  index.html index.htm;
    #    }
    #}

}
```

这个 Nginx 配置文件定义了两个虚拟主机（`server` 块），分别用于处理不同的域名和路径请求。以下是对该配置文件的逐行解读：

### 全局配置

- `worker_processes  1;`：指定 Nginx 使用一个工作进程来处理请求。

- `events` 块中：
  - `worker_connections  1024;`：每个工作进程最多可以处理 1024 个连接。

### HTTP 配置块

- `include mime.types;`：包含一个文件，该文件定义了 MIME 类型，以便 Nginx 能够根据文件扩展名设置正确的 `Content-Type` 响应头。
- `default_type application/octet-stream;`：如果未能确定 MIME 类型，将使用 `application/octet-stream` 作为默认类型。

- `sendfile on;`：启用 `sendfile`，它可以直接从磁盘读取文件内容，并将其发送到客户端，通常能提高文件传输的效率。
- `keepalive_timeout 65;`：设置连接的保持活动时间为 65 秒。

### `upstream` 配置

- `upstream fileserver` 和 `upstream gatewayserver`：定义了两个上游服务器的组。
  - `fileserver`：指向本地的 `localhost:9000`，用于处理文件服务相关请求。
  - `gatewayserver`：指向 `127.0.0.1:63010`，用于处理网关相关请求。

### 第一个 `server` 块（文件服务）

- `listen 80;`：监听 80 端口。
- `server_name file.51xuecheng.cn;`：为域名 `file.51xuecheng.cn` 配置虚拟主机。
- `ssi on;`：启用服务器端包含（SSI），允许在返回的 HTML 中动态插入内容。
- `location /video` 和 `location /mediafiles`：这两个路径下的请求将通过 `proxy_pass` 转发到 `fileserver`，即 `localhost:9000`。

### 第二个 `server` 块（门户网站）

- `listen 80;`：同样监听 80 端口。
- `server_name www.51xuecheng.cn localhost;`：为域名 `www.51xuecheng.cn` 和 `localhost` 配置虚拟主机。
- `ssi on;`：启用 SSI。

#### 路径处理

- `location /api/`：以 `/api/` 开头的请求将通过 `proxy_pass` 转发到 `gatewayserver`，即 `127.0.0.1:63010`。
- `location /`：其他请求将从 `D:/AAA_SecondDesktop/A_Technology/xc-ui-pc-static-portal/` 目录中返回静态文件，默认页面是 `index.html` 或 `index.htm`。
- `location /static/img/`、`/static/css/`、`/static/js/`、`/static/plugins/`：这些路径分别用于处理静态资源的请求，`alias` 指定了实际文件所在的目录。
- `location /course/preview/learning.html`、`/course/search.html`、`/course/learning.html`：处理特定课程页面的请求，指向指定的目录或文件。

#### 其他配置

- `error_page 500 502 503 504 /50x.html;`：在服务器内部错误时，显示 `/50x.html` 页面。
- `location = /50x.html`：指定 `/50x.html` 文件的根目录为 `html`。

### 注释掉的配置

- 配置文件中注释掉了一些其他功能，比如日志、PHP 脚本处理、HTTPS 支持等，这些功能可以根据需求进行启用和配置。

### 总结

这个 Nginx 配置文件主要用于配置两个不同的虚拟主机，一个用于处理文件服务的请求，另一个用于处理门户网站的请求和静态资源。它通过 `upstream` 机制将不同的请求转发到后端服务，并且使用了服务器端包含和静态资源的别名路径来优化资源处理。