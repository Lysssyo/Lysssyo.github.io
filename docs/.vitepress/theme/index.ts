// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './style.css'
import 'markdown-it-github-alerts/styles/github-base.css'
import 'markdown-it-github-alerts/styles/github-colors-light.css'
import 'markdown-it-github-alerts/styles/github-colors-dark-class.css'
import CryptoPrice from './components/CryptoPrice.vue'
import Layout from '../components/Layout.vue'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import mediumZoom from 'medium-zoom'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(Layout)      
    })
  },
  setup() {
    const route = useRoute()
    const initZoom = () => {
      // 给所有文章内容的图片添加 medium-zoom
      // 排除 .vp-doc 以外的图片（比如 logo）
      mediumZoom('.vp-doc img', { background: 'var(--vp-c-bg)' })
    }
    onMounted(() => {
      initZoom()
      
      // 全局拦截 /98-Private/ 链接
      window.addEventListener('click', (e) => {
        const link = (e.target as Element).closest('a')
        if (link) {
          const href = link.getAttribute('href')
          // 解码 href 以处理中文路径
          if (href && decodeURIComponent(href).includes('/98-Private/')) {
            e.preventDefault()
            const targetPath = decodeURIComponent(href)
            console.log('拦截到私密链接:', targetPath)
            // 跳转到保险箱，并带上目标路径
            // 注意：这里使用 window.location 可能会导致刷新，改用 router.go 需要获取 router 实例
            // 但在 setup 中我们没有 router 实例，使用 window.location.href 修改 hash/path
            // VitePress 使用的是 router，我们可以直接修改 window.location.href 
            // 更好的方式：利用 VitePress 的 useRouter (如果能拿到) 或者直接更改 location
            
            // 构造目标 URL： /保险箱?target=...
            // 假设 base 是 /，这里直接跳转
            window.location.href = `/保险箱?target=${encodeURIComponent(targetPath)}`
          }
        }
      })
    })
    watch(
      () => route.path,
      () => nextTick(() => initZoom())
    )
  },
  enhanceApp({ app, router, siteData }) {
    app.component('CryptoPrice', CryptoPrice)
  }
} satisfies Theme