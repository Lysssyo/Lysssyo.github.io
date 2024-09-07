---
title: MySQL递归CTE
date: 2024-09-08 01:14:00 +0800
categories: [数据库, 高级]
tags: [数据库, MySQL,CTE]
---

```sql
    WITH [RECURSIVE]
        cte_name [(col_name [, col_name] ...)] AS (subquery)
        [, cte_name [(col_name [, col_name] ...)] AS (subquery)] ...
```

> **`()`**：括号表示**必须**包含的部分。这意味着表达式中用括号包围的部分是执行时**必不可少**的。
> 例如，`cte_name [(col_name [, col_name] ...)]` 中的 `cte_name` 必须提供，而 `subquery` 是一个必要的子查询。
>
> **`[]`**：方括号表示**可选**的部分。表达式中的这部分内容可以选择性地包含，也可以省略。
> 例如，`[RECURSIVE]` 中的 `RECURSIVE` 是可选的，只有当你要定义递归CTE（Common Table Expression）时才使用。
> 另外，`[(col_name [, col_name] ...)]` 中的列名列表也是可选的。**如果不显式指定列名，MySQL会使用子查询中的列名。**

### 例一

```sql
WITH RECURSIVE cte (id, name) AS (
    -- 基础部分 (非递归部分): 查询最高管理者
    SELECT id, name FROM employees WHERE manager_id IS NULL

    UNION ALL

    -- 递归部分: 查询管理层次
    SELECT e.id, e.name 
    FROM employees e
    INNER JOIN cte ON e.manager_id = cte.id
)
-- 最终结果: 查询CTE中的所有数据
SELECT * FROM cte;
```

示例数据：

假设 `employees` 表如下：

| id   | name  | manager_id |
| ---- | ----- | ---------- |
| 1    | Alice | NULL       |
| 2    | Bob   | 1          |
| 3    | Carol | 1          |
| 4    | David | 2          |
| 5    | Eve   | 2          |

执行步骤：

- **第一步**：找到所有没有上级的员工，即 `Alice`。
- **第二步**：在 CTE 中，找到 `Alice` 的下属 `Bob` 和 `Carol`。
- **第三步**：继续递归，找到 `Bob` 的下属 `David` 和 `Eve`。

最终结果会是：

| id   | name  |
| ---- | ----- |
| 1    | Alice |
| 2    | Bob   |
| 3    | Carol |
| 4    | David |
| 5    | Eve   |

结论：

这段代码通过递归 CTE 展现了层次结构（比如公司组织架构）中的管理者和下属关系。

### 例二

```sql
-- 定义递归临时表 temp_table，包含字段 id, name, label, parentid, is_show, orderby, is_leaf
with recursive temp_table(id, name, label, parentid, is_show, orderby, is_leaf) as (
  
  -- 第一个查询，选择 id 为 '1' 的记录，作为递归的起始点
  select * from course_category p where id = '1'
  
  -- 使用 UNION ALL 进行递归查询，将 parentid 匹配的记录加入结果
  union all
  
  -- 递归查找course_category表中的parentID等于temp_table表的id的行
  select t.* from course_category t
  inner join temp_table on temp_table.id = t.parentid
)

-- 最终选择所有结果，并根据 id 和 orderby 进行排序
select * from temp_table order by temp_table.id, temp_table.orderby;
```

示例数据：

假设 `course_category` 表如下：

| id      | name       | label      | parentid | is_show | orderby | is_leaf |
| ------- | ---------- | ---------- | -------- | ------- | ------- | ------- |
| 1       | 根结点     | 根结点     | 0        | 1       | 1       | 0       |
| 1-1     | 前端开发   | 前端开发   | 1        | 1       | 1       | 0       |
| 1-1-1   | HTML/CSS   | HTML/CSS   | 1-1      | 1       | 1       | 1       |
| 1-1-10  | 其它       | 其它       | 1-1      | 1       | 10      | 1       |
| 1-1-2   | JavaScript | JavaScript | 1-1      | 1       | 2       | 1       |
| 1-1-3   | jQuery     | jQuery     | 1-1      | 1       | 3       | 1       |
| 1-1-4   | ExtJS      | ExtJS      | 1-1      | 1       | 4       | 1       |
| 1-1-5   | AngularJS  | AngularJS  | 1-1      | 1       | 5       | 1       |
| 1-1-6   | ReactJS    | ReactJS    | 1-1      | 1       | 6       | 1       |
| 1-1-7   | Bootstrap  | Bootstrap  | 1-1      | 1       | 7       | 1       |
| 1-1-8   | Node.js    | Node.js    | 1-1      | 1       | 8       | 1       |
| 1-1-9   | Vue        | Vue        | 1-1      | 1       | 9       | 1       |
| 1-10    | 研发管理   | 研发管理   | 1        | 1       | 10      | 0       |
| 1-10-1  | 敏捷开发   | 敏捷开发   | 1-10     | 1       | 1       | 1       |
| 1-10-2  | 软件设计   | 软件设计   | 1-10     | 1       | 2       | 1       |
| 1-10-3  | 软件测试   | 软件测试   | 1-10     | 1       | 3       | 1       |
| 1-10-4  | 研发管理   | 研发管理   | 1-10     | 1       | 4       | 1       |
| 1-10-5  | 其它       | 其它       | 1-10     | 1       | 5       | 1       |
| 1-11    | 系统运维   | 系统运维   | 1        | 1       | 11      | 0       |
| 1-11-1  | Linux      | Linux      | 1-11     | 1       | 1       | 1       |
| 1-11-10 | 其它       | 其它       | 1-11     | 1       | 10      | 1       |
| 1-11-2  | Windows    | Windows    | 1-11     | 1       | 2       | 1       |
| 1-11-3  | UNIX       | UNIX       | 1-11     | 1       | 3       | 1       |
| 1-11-4  | Mac OS     | Mac OS     | 1-11     | 1       | 4       | 1       |

最终结果会是：

![image-20240908011157057](/assets/MySQL递归查询.assets/image-20240908011157057.png)

复习MySQL的连接：https://blog.csdn.net/laodanqiu/article/details/131233741?ops_request_misc=&request_id=&biz_id=102&utm_term=mysql%20%E8%BF%9E%E6%8E%A5&utm_medium=distribute.pc_search_result.none-task-blog-2~all~sobaiduweb~default-1-131233741.142^v100^control&spm=1018.2226.3001.4187

