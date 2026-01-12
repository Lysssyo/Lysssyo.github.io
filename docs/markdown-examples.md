# Markdown Extension Examples

This page demonstrates some of the built-in markdown extensions provided by VitePress.

## Syntax Highlighting

VitePress provides Syntax Highlighting powered by [Shiki](https://github.com/shikijs/shiki), with additional features like line-highlighting:

**Input**

````md
```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```
````

**Output**

```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```

## Custom Containers

::: tip
This is a standard tip container.
:::

::: callout 🚀
**Notion 同款 Callout**
这是一个自定义的容器，你可以指定任意 Emoji 作为图标。
支持多行内容和 **Markdown** 语法。
:::

## Tables

## More

Check out the documentation for the [full list of markdown extensions](https://vitepress.dev/guide/markdown).
