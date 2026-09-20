<template>
  <view class="page">
    <view class="card">
      <text class="title">登录 AI 待办</text>
      <input v-model="email" class="input" placeholder="邮箱" />
      <input v-model="password" class="input" password placeholder="密码" />
      <button class="btn" :loading="loading" @tap="handleLogin">登录</button>
      <navigator url="/pages/register/register" open-type="navigate" class="link">没有账号？邮箱注册</navigator>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { login, setToken } from '@/api/todo';

const email = ref('');
const password = ref('');
const loading = ref(false);

const handleLogin = async () => {
  if (!email.value.trim() || !password.value) {
    uni.showToast({ title: '请输入邮箱和密码', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const res: any = await login(email.value.trim(), password.value);
    setToken(res.token);
    password.value = '';
    uni.reLaunch({ url: '/pages/index/index' });
  } catch (e: any) {
    uni.showToast({ title: String(e), icon: 'none' });
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
.card { width: 100%; max-width: 420px; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(15,23,42,.08); }
.title { display: block; font-size: 20px; font-weight: 700; margin-bottom: 16px; }
.input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.btn { background: #4f46e5; color: #fff; border-radius: 8px; }
.link { display: block; text-align: center; margin-top: 12px; color: #64748b; font-size: 13px; }
</style>
