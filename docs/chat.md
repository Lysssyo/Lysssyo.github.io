---
date created: 2026-01-14 11:36:43
date modified: 2026-01-15 14:21:57
---
[plugin:vite:vue] D:/AAA_KnowledgeBase/docs/.vitepress/components/PrivateVault.vue:135:1: Unclosed block

D:/AAA_KnowledgeBase/docs/.vitepress/components/PrivateVault.vue:423:1

421|  /* 移动端适配 */
422|  @media (max-width: 768px) {
423|    .mobile-sidebar-toggle {
   |   ^
424|      display: block; /* Mobile 显示 */
425|    }

    at Input.error (D:\AAA_KnowledgeBase\node_modules\postcss\lib\input.js:135:16)
    at Parser.unclosedBlock (D:\AAA_KnowledgeBase\node_modules\postcss\lib\parser.js:575:22)
    at Parser.endFile (D:\AAA_KnowledgeBase\node_modules\postcss\lib\parser.js:335:35)
    at Parser.parse (D:\AAA_KnowledgeBase\node_modules\postcss\lib\parser.js:476:10)
    at parse (D:\AAA_KnowledgeBase\node_modules\postcss\lib\parse.js:11:12)
    at new LazyResult (D:\AAA_KnowledgeBase\node_modules\postcss\lib\lazy-result.js:165:16)
    at Processor.process (D:\AAA_KnowledgeBase\node_modules\postcss\lib\processor.js:53:14)
    at doCompileStyle (D:\AAA_KnowledgeBase\node_modules\@vue\compiler-sfc\dist\compiler-sfc.cjs.js:19542:36)
    at Object.compileStyleAsync (D:\AAA_KnowledgeBase\node_modules\@vue\compiler-sfc\dist\compiler-sfc.cjs.js:19462:10)
    at transformStyle (file:///D:/AAA_KnowledgeBase/node_modules/@vitejs/plugin-vue/dist/index.mjs:2832:41

Click outside, press Esc key, or fix the code to dismiss.  
You can also disable this overlay by setting `server.hmr.overlay` to `false` in `vite.config.js`.