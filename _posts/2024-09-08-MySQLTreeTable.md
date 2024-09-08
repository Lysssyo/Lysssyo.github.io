---
title: 树形表以及树形表的传递
date: 2024-09-08 13:10:00 +0800
categories: [数据库, 高级]
tags: [数据库, MySQL]
---
## 1. 树形表的优势

定义树形表的主要优势包括：

1. **层次化数据组织**：树形表能够自然地表示层次结构，便于存储和查询类似树结构的数据，如组织结构、分类目录等，清晰地展现父子关系。
2. **提高数据查询效率**：对于层次结构明确的数据，使用树形表可以减少复杂的递归查询，并通过索引优化树结构的检索。
3. **简化数据管理**：通过树形表可以方便地进行数据的增删改操作，比如删除某一节点时可以递归删除其所有子节点，保证数据的一致性和完整性。
4. **便于展示**：树形表的数据结构非常适合在前端以树形组件或菜单的方式展示，直观、层次分明。
5. **支持多层级关系**：无论是二级还是多级关系，树形表都可以灵活表达不同深度的数据结构，适应不同业务需求。
6. **减少数据冗余**：树形表通过存储节点与其父节点的关系，避免了重复存储同类数据，优化了存储效率。

## 2. 树形表示例

树形表的各个字段定义如下：

![image-20240908111752597](/assets/树形表以及树形表转JSON数组.assets/image-20240908111752597.png)

示例数据：

![image-20240908111824129](/assets/树形表以及树形表转JSON数组.assets/image-20240908111824129.png)

> 建表语句见文末

以上树形表的层次如下：

<img src="/assets/树形表以及树形表转JSON数组.assets/image-20240908112232897.png" alt="image-20240908112232897" style="zoom:80%;" />

## 3. 传递树形表

将树形表以json数组的形式传递给前端，如下：

```json
 [
         {
            "childrenTreeNodes" : [
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-1",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "HTML/CSS",
                  "name" : "HTML/CSS",
                  "orderby" : 1,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-2",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "JavaScript",
                  "name" : "JavaScript",
                  "orderby" : 2,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-3",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "jQuery",
                  "name" : "jQuery",
                  "orderby" : 3,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-4",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "ExtJS",
                  "name" : "ExtJS",
                  "orderby" : 4,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-5",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "AngularJS",
                  "name" : "AngularJS",
                  "orderby" : 5,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-6",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "ReactJS",
                  "name" : "ReactJS",
                  "orderby" : 6,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-7",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "Bootstrap",
                  "name" : "Bootstrap",
                  "orderby" : 7,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-8",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "Node.js",
                  "name" : "Node.js",
                  "orderby" : 8,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-9",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "Vue",
                  "name" : "Vue",
                  "orderby" : 9,
                  "parentid" : "1-1"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-1-10",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "其它",
                  "name" : "其它",
                  "orderby" : 10,
                  "parentid" : "1-1"
               }
            ],
            "id" : "1-1",
            "isLeaf" : null,
            "isShow" : null,
            "label" : "前端开发",
            "name" : "前端开发",
            "orderby" : 1,
            "parentid" : "1"
         },
         {
            "childrenTreeNodes" : [
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-2-1",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "微信开发",
                  "name" : "微信开发",
                  "orderby" : 1,
                  "parentid" : "1-2"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-2-2",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "iOS",
                  "name" : "iOS",
                  "orderby" : 2,
                  "parentid" : "1-2"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-2-3",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "手游开发",
                  "name" : "手游开发",
                  "orderby" : 3,
                  "parentid" : "1-2"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-2-4",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "Swift",
                  "name" : "Swift",
                  "orderby" : 4,
                  "parentid" : "1-2"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-2-5",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "Android",
                  "name" : "Android",
                  "orderby" : 5,
                  "parentid" : "1-2"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-2-6",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "ReactNative",
                  "name" : "ReactNative",
                  "orderby" : 6,
                  "parentid" : "1-2"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-2-7",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "Cordova",
                  "name" : "Cordova",
                  "orderby" : 7,
                  "parentid" : "1-2"
               },
               {
                  "childrenTreeNodes" : null,
                  "id" : "1-2-8",
                  "isLeaf" : null,
                  "isShow" : null,
                  "label" : "其它",
                  "name" : "其它",
                  "orderby" : 8,
                  "parentid" : "1-2"
               }
            ],
            "id" : "1-2",
            "isLeaf" : null,
            "isShow" : null,
            "label" : "移动开发",
            "name" : "移动开发",
            "orderby" : 2,
            "parentid" : "1"
         }
   ]
```

每一个结点都包含`id` , `isLeaf` , `isShow` , `label` , `name` ,  `orderby` , `parentid`以及**`childrenTreeNodes`数组**

重点在于**`childrenTreeNodes`数组**的处理，前端接收到数据后，会做如下展示：

<img src="/assets/树形表以及树形表转JSON数组.assets/image-20240908112909752.png" alt="image-20240908112909752" style="zoom:80%;" />

下面，给出数据库持久层对象转为以上json数据的代码

```java
    public List<CourseCategoryTreeDto> queryTreeNodes(String id) {
        List<CourseCategoryTreeDto> courseCategoryTreeDtos = courseCategoryMapper.selectTreeNodes(id);
        // 1.将list转map，以备使用，注意要排除根节点（这里是为了等下方便通过ParentId找到结点）
        Map<String, CourseCategoryTreeDto> mapTemp = courseCategoryTreeDtos
                .stream()
                .filter(item -> !id.equals(item.getId()))
                .collect(Collectors.toMap(key -> key.getId(), value -> value, (key1, key2) -> key2));
        
        // 2.定义最终返回的结果list
        List<CourseCategoryTreeDto> categoryTreeDtos = new ArrayList<>();
        
        // 3.再遍历一次,数据处理好后放入结果List，注意也要排除根节点
        courseCategoryTreeDtos
                .stream()
                .filter(item -> !id.equals(item.getId()))
                // 检查每一个item
                .forEach(item -> {
                    // 这个if，用于把 2级结点 放入结果List（根结点为1级结点）
                    if (item.getParentid().equals(id)) {
                        // 不是所有 courseCategoryTreeDtos 都要放进去结果List中，
                        // 只有 courseCategoryTreeDtos 的Parentidid等于id才放，
                        // 剩余的放结果List的每一项的ChildrenTreeNodes
                        categoryTreeDtos.add(item);
                    }
                    // 下面是为了把子节点放入父节点的childrenTreeNodes，
                    // 例如3级结点放入2级结点的childrenTreeNodes，4级结点放入3级结点的childrenTreeNodes
                    // 找到当前结点的父节点（利用Map）
                    CourseCategoryTreeDto courseCategoryTreeDto = mapTemp.get(item.getParentid());
                    // 如果找得到
                    if (courseCategoryTreeDto != null) {
                        // 如果找到的父节点的 childrenTreeNodes 为空，
                        // 要先new（因为创建的时候 childrenTreeNodes 默认为null）
                        if (courseCategoryTreeDto.getChildrenTreeNodes() == null) {
                            courseCategoryTreeDto.setChildrenTreeNodes(new ArrayList<CourseCategoryTreeDto>());
                        }
                        // 往父节点的ChildrenTreeNodes属性中放子节点（遍历到的item）
                        courseCategoryTreeDto.getChildrenTreeNodes().add(item);
                    }
                });
        return categoryTreeDtos;
    }
// 下面给出CourseCategoryTreeDto类的定义
@Data
public class CourseCategoryTreeDto extends CourseCategory implements Serializable {
    List<CourseCategoryTreeDto> childrenTreeNodes;
}

@Data
@TableName("course_category")
public class CourseCategory implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 主键
     */
    private String id;

    /**
     * 分类名称
     */
    private String name;

    /**
     * 分类标签默认和名称一样
     */
    private String label;

    /**
     * 父结点id（第一级的父节点是0，自关联字段id）
     */
    private String parentid;

    /**
     * 是否显示
     */
    private Integer isShow;

    /**
     * 排序字段
     */
    private Integer orderby;

    /**
     * 是否叶子
     */
    private Integer isLeaf;


}
```















