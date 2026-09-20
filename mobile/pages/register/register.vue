<template>
  <view class="page">
    <view class="card">
      <text class="title">邮箱注册</text>
      <input v-model="username" class="input" placeholder="用户名" />
      <input v-model="email" class="input" placeholder="邮箱" />
      <input v-model="password" class="input" password placeholder="密码（≥8位，含字母数字）" />
      <view class="row">
        <input v-model="code" class="input flex" placeholder="验证码" />
        <button class="code-btn" :loading="sending" @tap="handleSendCode">获取验证码</button>
      </view>
      <button class="btn" :loading="loading" @tap="handleRegister">注册</button>
      <navigator url="/pages/login/login" open-type="navigate" class="link">已有账号？去登录</navigator>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { register, sendVerifyCode, setToken } from '@/api/todo';

const username = ref('');
const email = ref('');
const password = ref('');
const code = ref('');
const loading = ref(false);
const sending = ref(false);

const handleSendCode = async () => {
  if (!email.value.trim()) {
    uni.showToast({ title: '请先填写邮箱', icon: 'none' });
    return;
  }
  sending.value = true;
  try {
    const res: any = await sendVerifyCode(email.value.trim());
    uni.showToast({ title: res.message || '已处理', icon: 'none' });
  } catch (e: any) {
    uni.showToast({ title: String(e), icon: 'none' });
  } finally {
    sending.value = false;
  }
};

const handleRegister = async () => {
  loading.value = true;
  try {
    const res: any = await register({
      username: username.value.trim(),
      email: email.value.trim(),
      password: password.value,
      code: code.value.trim(),
    });
    if (res.pending) {
      uni.showToast({ title: res.message || '等待审核', icon: 'none' });
      return;
    }
    if (res.token) setToken(res.token);
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
.card { width: 100%; max-width: 420px; background: #fff; border-radius: 12px; padding: 24px; }
.title { display: block; font-size: 20px; font-weight: 700; margin-bottom: 16px; }
.input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.row { display: flex; gap: 8px; }
.flex { flex: 1; }
.code-btn { background: #e2e8f0; color: #0f172a; font-size: 12px; border-radius: 8px; white-space: nowrap; }
.btn { background: #4f46e5; color: #fff; border-radius: 8px; }
.link { display: block; text-align: center; margin-top: 12px; color: #64748b; font-size: 13px; }
</style>
