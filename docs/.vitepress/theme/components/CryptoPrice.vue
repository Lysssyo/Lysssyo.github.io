<script setup>
import { ref, onMounted } from 'vue'
const price = ref('Loading...')
// 模拟拉取数据
onMounted(() => {
  price.value = '$98,000' 
})
</script>
<template>
  <div class="coin-card">
    <span>Bitcoin: </span>
    <span class="price">{{ price }}</span>
  </div>
</template>
<style scoped>
.coin-card { padding: 10px; background: #f3f3f3; border-radius: 8px; font-weight: bold; }
.price { color: #d81b60; }
</style>