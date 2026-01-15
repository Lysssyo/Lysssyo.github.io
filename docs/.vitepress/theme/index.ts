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